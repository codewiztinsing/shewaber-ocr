# BullMQ Background Processing Setup

## ✅ Implementation Complete

Background processing for OCR using BullMQ has been successfully implemented!

## Architecture

```
┌─────────┐      ┌──────────┐      ┌─────────┐      ┌──────────┐
│ Client  │─────▶│  API     │─────▶│  Queue  │─────▶│  Worker  │
│ (Upload)│      │ (Express)│      │ (BullMQ)│      │ (OCR)    │
└─────────┘      └──────────┘      └─────────┘      └──────────┘
                       │                  │                │
                       ▼                  ▼                ▼
                  ┌─────────┐      ┌─────────┐      ┌─────────┐
                  │Database │      │  Redis  │      │Database │
                  │(Receipt)│      │ (Queue) │      │(Update) │
                  └─────────┘      └─────────┘      └─────────┘
```

## Components

### 1. Queue Service (`src/queue/ocr.queue.ts`)
- Creates and manages the OCR processing queue
- Handles job creation and status checking
- Uses Redis for job storage

### 2. Worker Service (`src/worker/ocr.worker.ts`)
- Processes OCR jobs from the queue
- Handles OCR extraction and database updates
- Supports concurrent processing (2 jobs at a time)
- Rate limiting (5 jobs per minute)

### 3. API Endpoints

**POST `/api/upload`**
- Uploads file and creates placeholder receipt
- Adds OCR job to queue
- Returns immediately with job ID

**GET `/api/job/:jobId`**
- Check job status and progress
- Returns job state, progress, and result

### 4. GraphQL Query

```graphql
query {
  jobStatus(jobId: "ocr-1234567890-abc123") {
    id
    state
    progress
    result {
      receiptId
      storeName
      totalAmount
      items {
        name
        quantity
        price
      }
    }
    failedReason
  }
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start Redis

**Option A: Using Docker (Recommended)**
```bash
docker compose up -d redis
```

**Option B: Local Redis**
```bash
# Install Redis
sudo apt-get install redis-server  # Ubuntu/Debian
brew install redis                 # macOS

# Start Redis
redis-server
```

### 3. Configure Environment

Add to `backend/.env`:
```env
REDIS_URL=redis://localhost:6379
# Or for Docker:
REDIS_URL=redis://redis:6379
```

### 4. Start Services

**Development Mode:**

Terminal 1 - API Server:
```bash
cd backend
npm run dev
```

Terminal 2 - Worker:
```bash
cd backend
npm run dev:worker
```

**Production Mode (Docker):**
```bash
docker compose up -d
```

This starts:
- Redis (port 6380 externally, 6379 internally)
- PostgreSQL
- Backend API
- Worker process
- Frontend

## Usage

### Upload Receipt (Returns Immediately)

```bash
curl -X POST http://localhost:4000/api/upload \
  -F "file=@receipt.jpg"
```

**Response:**
```json
{
  "jobId": "ocr-1234567890-abc123",
  "receiptId": "uuid-here",
  "message": "File uploaded successfully. OCR processing started in background.",
  "status": "processing",
  "receipt": {
    "id": "uuid-here",
    "storeName": null,
    "totalAmount": null,
    "items": []
  }
}
```

### Check Job Status

```bash
curl http://localhost:4000/api/job/ocr-1234567890-abc123
```

**Response:**
```json
{
  "id": "ocr-1234567890-abc123",
  "state": "completed",
  "progress": 100,
  "result": {
    "receiptId": "uuid-here",
    "storeName": "Walmart",
    "totalAmount": 45.67,
    "items": [
      {
        "name": "Milk",
        "quantity": 2,
        "price": 3.99
      }
    ]
  }
}
```

### Polling for Completion (Frontend Example)

```javascript
async function uploadAndWait(file) {
  // Upload file
  const formData = new FormData();
  formData.append('file', file);
  
  const uploadRes = await fetch('http://localhost:4000/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  const { jobId, receiptId } = await uploadRes.json();
  
  // Poll for completion
  while (true) {
    const statusRes = await fetch(`http://localhost:4000/api/job/${jobId}`);
    const status = await statusRes.json();
    
    if (status.state === 'completed') {
      return status.result;
    } else if (status.state === 'failed') {
      throw new Error(status.failedReason);
    }
    
    // Wait 1 second before next poll
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

## Job States

- **waiting**: Job is in queue, waiting to be processed
- **active**: Job is currently being processed
- **completed**: Job finished successfully
- **failed**: Job failed (check `failedReason`)
- **delayed**: Job is delayed (retry with backoff)

## Configuration

### Worker Concurrency

Edit `src/worker/ocr.worker.ts`:
```typescript
{
  concurrency: 2, // Process 2 jobs at a time
  limiter: {
    max: 5,        // Max 5 jobs
    duration: 60000, // Per minute
  },
}
```

### Job Retry Settings

Edit `src/queue/ocr.queue.ts`:
```typescript
defaultJobOptions: {
  attempts: 3,              // Retry 3 times
  backoff: {
    type: 'exponential',
    delay: 2000,            // Start with 2s delay
  },
}
```

## Monitoring

### Check Queue Status

```bash
# Connect to Redis
redis-cli

# Check queue length
LLEN bull:ocr-processing:waiting
LLEN bull:ocr-processing:active
LLEN bull:ocr-processing:completed
LLEN bull:ocr-processing:failed
```

### View Worker Logs

```bash
# Docker
docker logs shewaber-ocr-worker -f

# Local
# Check terminal running npm run dev:worker
```

## Troubleshooting

### Redis Connection Error

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution:**
1. Check Redis is running: `redis-cli ping` (should return `PONG`)
2. Verify `REDIS_URL` in `.env`
3. For Docker, use `redis://redis:6379`

### Worker Not Processing Jobs

**Check:**
1. Worker is running: `docker logs shewaber-ocr-worker`
2. Redis is accessible from worker
3. Database connection is working
4. Check worker logs for errors

### Jobs Stuck in Queue

**Solution:**
1. Restart worker: `docker restart shewaber-ocr-worker`
2. Check Redis: `redis-cli ping`
3. Clear stuck jobs (if needed):
   ```bash
   redis-cli DEL bull:ocr-processing:waiting
   ```

### Port Conflict (Redis)

If port 6379 is already in use:
1. Change docker-compose.yml port mapping: `"6380:6379"`
2. Update REDIS_URL if connecting from host: `redis://localhost:6380`
3. Or stop existing Redis: `sudo systemctl stop redis`

## Benefits

✅ **Non-blocking**: API responds immediately  
✅ **Scalable**: Multiple workers can process jobs  
✅ **Reliable**: Jobs are persisted in Redis  
✅ **Retry logic**: Automatic retries on failure  
✅ **Progress tracking**: Real-time job progress  
✅ **Rate limiting**: Prevents overload  

## Next Steps

- Add job prioritization
- Add webhook notifications on completion
- Add job cancellation
- Add job scheduling
- Add monitoring dashboard (Bull Board)

