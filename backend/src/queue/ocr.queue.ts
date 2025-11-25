import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Create Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create OCR queue
export const ocrQueue = new Queue('ocr-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 24 hours
    },
  },
});

export interface OCRJobData {
  filePath: string;
  filename: string;
  imageUrl: string;
  receiptId?: string; // Optional: if receipt was created before processing
}

export interface OCRJobResult {
  receiptId: string;
  storeName?: string;
  purchaseDate?: Date;
  totalAmount?: number;
  items: Array<{
    name: string;
    quantity?: number;
    price?: number;
  }>;
}

// Helper function to add OCR job to queue
export async function addOCRJob(data: OCRJobData) {
  const job = await ocrQueue.add('process-receipt', data, {
    jobId: `ocr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  });
  return job;
}

// Helper function to get job status
export async function getJobStatus(jobId: string) {
  const job = await ocrQueue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;
  const result = job.returnvalue as OCRJobResult | undefined;
  const failedReason = job.failedReason;

  return {
    id: job.id,
    state,
    progress,
    result,
    failedReason,
    timestamp: job.timestamp,
  };
}

// Cleanup function
export async function closeQueue() {
  await ocrQueue.close();
  await connection.quit();
}

