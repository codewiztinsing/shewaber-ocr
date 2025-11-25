import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { OCRService } from '../services/ocr.service';
import { OCRJobData, OCRJobResult } from '../queue/ocr.queue';
import fs from 'fs';
import path from 'path';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();
const ocrService = new OCRService();

// Create Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create worker
export const ocrWorker = new Worker<OCRJobData, OCRJobResult>(
  'ocr-processing',
  async (job: Job<OCRJobData, OCRJobResult>) => {
    const { filePath, filename, imageUrl, receiptId } = job.data;

    console.log(`[Worker] Processing OCR job ${job.id} for file: ${filename}`);

    try {
      // Update job progress
      await job.updateProgress(10);

      // Construct file path using UPLOAD_DIR if filePath is relative or doesn't exist
      const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
      let actualFilePath = filePath;
      
      // If file doesn't exist at the given path, try constructing it from uploadDir
      if (!fs.existsSync(filePath)) {
        actualFilePath = path.join(uploadDir, filename);
        console.log(`[Worker] File not found at ${filePath}, trying ${actualFilePath}`);
      }
      
      // Verify file exists
      if (!fs.existsSync(actualFilePath)) {
        throw new Error(`File not found: ${filePath} or ${actualFilePath}`);
      }
      
      console.log(`[Worker] Using file path: ${actualFilePath}`);

      await job.updateProgress(20);

      // Perform OCR
      const extractedData = await ocrService.extractData(actualFilePath);
      await job.updateProgress(70);

      // Save to database
      let receipt;
      
      if (receiptId) {
        // Update existing receipt
        // Validate date before saving
        let validDate = null;
        if (extractedData.purchaseDate && !isNaN(extractedData.purchaseDate.getTime())) {
          validDate = extractedData.purchaseDate;
        }
        
        receipt = await prisma.receipt.update({
          where: { id: receiptId },
          data: {
            storeName: extractedData.storeName || null,
            purchaseDate: validDate,
            totalAmount: extractedData.totalAmount || null,
            items: {
              deleteMany: {}, // Remove old items
              create: extractedData.items.map((item) => ({
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
      } else {
        // Create new receipt
        // Validate date before saving
        let validDate = null;
        if (extractedData.purchaseDate && !isNaN(extractedData.purchaseDate.getTime())) {
          validDate = extractedData.purchaseDate;
        }
        
        receipt = await prisma.receipt.create({
          data: {
            storeName: extractedData.storeName || null,
            purchaseDate: validDate,
            totalAmount: extractedData.totalAmount || null,
            imageUrl,
            items: {
              create: extractedData.items.map((item) => ({
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
      }

      await job.updateProgress(100);

      console.log(`[Worker] Successfully processed job ${job.id}, receipt ID: ${receipt.id}`);

      // Return result
      return {
        receiptId: receipt.id,
        storeName: receipt.storeName || undefined,
        purchaseDate: receipt.purchaseDate || undefined,
        totalAmount: receipt.totalAmount || undefined,
        items: receipt.items.map((item) => ({
          name: item.name,
          quantity: item.quantity || undefined,
          price: item.price || undefined,
        })),
      };
    } catch (error: any) {
      console.error(`[Worker] Error processing job ${job.id}:`, error);
      
      // Clean up file on error
      const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
      const fileToDelete = fs.existsSync(filePath) ? filePath : path.join(uploadDir, filename);
      if (fs.existsSync(fileToDelete)) {
        try {
          fs.unlinkSync(fileToDelete);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // Process 2 jobs concurrently
    limiter: {
      max: 5, // Max 5 jobs
      duration: 60000, // Per minute
    },
  }
);

// Worker event handlers
ocrWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

ocrWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

ocrWorker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

// Graceful shutdown
async function gracefulShutdown() {
  console.log('[Worker] Shutting down gracefully...');
  
  await ocrWorker.close();
  await ocrService.terminate();
  await prisma.$disconnect();
  await connection.quit();
  
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

console.log('[Worker] OCR Worker started and ready to process jobs');

