// Worker process entry point
// This file runs the OCR worker that processes jobs from the queue

import './worker/ocr.worker';

// Keep the process alive
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

