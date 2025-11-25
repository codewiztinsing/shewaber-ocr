// Load environment variables FIRST, before anything else
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { upload } from './utils/fileUpload';

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set!');
  console.error('Please create a .env file in the backend directory with:');
  console.error('DATABASE_URL="postgresql://user:password@localhost:5432/shewaber_ocr?schema=public"');
  process.exit(1);
}

const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 4000;

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// Create a singleton OCR service instance to reuse worker
let ocrServiceInstance: any = null;

async function getOCRService() {
  if (!ocrServiceInstance) {
    const { OCRService } = await import('./services/ocr.service');
    ocrServiceInstance = new OCRService();
  }
  return ocrServiceInstance;
}

// REST endpoint for file upload
app.post('/api/upload', upload.single('file'), async (req: express.Request, res: express.Response) => {
  let ocrService: any = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const imageUrl = `/uploads/${req.file.filename}`;

    // Get OCR service instance
    ocrService = await getOCRService();

    // Perform OCR with timeout (30 seconds)
    const extractedData = await Promise.race([
      ocrService.extractData(filePath),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCR processing timeout (30s)')), 30000)
      )
    ]) as any;

    // Save to database
    const receipt = await prisma.receipt.create({
      data: {
        storeName: extractedData.storeName || null,
        purchaseDate: extractedData.purchaseDate || null,
        totalAmount: extractedData.totalAmount || null,
        imageUrl,
        items: {
          create: extractedData.items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity || null,
            price: item.price || null,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    res.json(receipt);
  } catch (error: any) {
    console.error('Upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    
    // Return user-friendly error message
    const errorMessage = error.message || 'OCR processing failed';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: () => ({ prisma }),
});

async function startServer() {
  await server.start();

    app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }: { req: express.Request }) => ({ prisma, req }),
    })
  );

  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`📤 Upload endpoint at http://localhost:${PORT}/api/upload`);
  });
}

startServer().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});

// Graceful shutdown
async function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  
  // Terminate OCR worker if it exists
  if (ocrServiceInstance && typeof ocrServiceInstance.terminate === 'function') {
    try {
      await ocrServiceInstance.terminate();
    } catch (error) {
      console.error('Error terminating OCR service:', error);
    }
  }
  
  // Disconnect Prisma
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

