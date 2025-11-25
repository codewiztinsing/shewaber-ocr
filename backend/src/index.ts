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
import { addOCRJob, closeQueue } from './queue/ocr.queue';

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
// Use environment variable or default to uploads directory relative to app root
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
console.log(`📁 Upload directory: ${uploadDir}`);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Serve uploaded images
app.use('/uploads', express.static(uploadDir, {
  setHeaders: (res, path) => {
    // Set proper cache headers for images
    if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png') || 
        path.endsWith('.gif') || path.endsWith('.webp')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  },
}));

// Create a singleton OCR service instance to reuse worker
let ocrServiceInstance: any = null;

async function getOCRService() {
  if (!ocrServiceInstance) {
    const { OCRService } = await import('./services/ocr.service');
    ocrServiceInstance = new OCRService();
  }
  return ocrServiceInstance;
}

// REST endpoint for file upload (now uses background processing)
// @ts-ignore - Multer type conflict with Express types
app.post('/api/upload', upload.single('file'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Use consistent path that works in both backend and worker containers
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadDir, req.file.filename);
    const imageUrl = `/uploads/${req.file.filename}`;

    // Verify file was saved correctly
    if (!fs.existsSync(filePath)) {
      throw new Error(`File was not saved correctly: ${filePath}`);
    }

    // Create a placeholder receipt in the database immediately
    const placeholderReceipt = await prisma.receipt.create({
      data: {
        storeName: null,
        purchaseDate: null,
        totalAmount: null,
        imageUrl,
        items: {
          create: [], // Empty items initially
        },
      },
    });

    // Add OCR job to queue for background processing
    const job = await addOCRJob({
      filePath,
      filename: req.file.filename,
      imageUrl,
      receiptId: placeholderReceipt.id,
    });

    console.log(`[API] Added OCR job ${job.id} to queue for receipt ${placeholderReceipt.id}`);

    // Return job ID and receipt immediately
    res.json({
      jobId: job.id,
      receiptId: placeholderReceipt.id,
      message: 'File uploaded successfully. OCR processing started in background.',
      status: 'processing',
      receipt: placeholderReceipt,
    });
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
    const errorMessage = error.message || 'Upload failed';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// REST endpoint to check job status
app.get('/api/job/:jobId', async (req: express.Request, res: express.Response) => {
  try {
    const { getJobStatus } = await import('./queue/ocr.queue');
    const status = await getJobStatus(req.params.jobId);
    
    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json(status);
  } catch (error: any) {
    console.error('Job status error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get job status'
    });
  }
});

const server = new ApolloServer({
  typeDefs,
  resolvers,
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
  
  // Close queue connection
  try {
    await closeQueue();
  } catch (error) {
    console.error('Error closing queue:', error);
  }
  
  // Disconnect Prisma
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

