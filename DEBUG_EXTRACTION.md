# OCR Extraction Debugging Guide

## ✅ Fixed Issues

1. **File Path Resolution**: Fixed file path handling to work correctly in Docker containers
2. **Date Validation**: Added validation to prevent invalid dates from being saved to database
3. **Worker Container**: Worker is now running and processing jobs

## Current Status

✅ **Backend**: Running on port 4000  
✅ **Worker**: Running and ready to process jobs  
✅ **Redis**: Running on port 6380  
✅ **PostgreSQL**: Running on port 5433  
✅ **Frontend**: Running on port 3000  

## Debugging Steps

### 1. Check Worker Status

```bash
# Check if worker is running
docker compose ps | grep worker

# View worker logs
docker compose logs worker --tail 50 -f
```

**Expected output:**
```
[Worker] OCR Worker started and ready to process jobs
```

### 2. Check Queue Status

```bash
# Connect to Redis
docker compose exec redis redis-cli

# Check queue lengths
LLEN bull:ocr-processing:waiting
LLEN bull:ocr-processing:active
LLEN bull:ocr-processing:completed
LLEN bull:ocr-processing:failed
```

### 3. Test File Upload

```bash
# Upload a test image
curl -X POST http://localhost:4000/api/upload \
  -F "file=@/path/to/receipt.jpg"
```

**Expected response:**
```json
{
  "jobId": "ocr-1234567890-abc123",
  "receiptId": "uuid-here",
  "message": "File uploaded successfully. OCR processing started in background.",
  "status": "processing"
}
```

### 4. Check Job Status

```bash
# Replace JOB_ID with actual job ID from upload response
curl http://localhost:4000/api/job/JOB_ID
```

**Job States:**
- `waiting`: Job is in queue
- `active`: Job is being processed
- `completed`: Job finished successfully
- `failed`: Job failed (check `failedReason`)

### 5. Monitor Worker Processing

```bash
# Watch worker logs in real-time
docker compose logs worker -f
```

**Look for:**
- `[Worker] Processing OCR job...` - Job started
- `[Worker] Using file path: ...` - File found
- `[Worker] Successfully processed job...` - Job completed
- `[Worker] Error processing job...` - Job failed

## Common Issues & Solutions

### Issue: "File not found" Error

**Symptoms:**
```
[Worker] Error processing job: File not found: /app/uploads/filename.jpg
```

**Solutions:**
1. **Check file exists:**
   ```bash
   docker compose exec backend ls -la /app/uploads
   docker compose exec worker ls -la /app/uploads
   ```

2. **Check volume mount:**
   ```bash
   docker compose config | grep uploads
   ```

3. **Verify file was uploaded:**
   ```bash
   # Check backend logs for upload confirmation
   docker compose logs backend | grep "Added OCR job"
   ```

### Issue: "Invalid Date" Error

**Symptoms:**
```
Invalid value for argument `purchaseDate`: Provided Date object is invalid.
```

**Solution:**
✅ **Fixed**: Date validation now prevents invalid dates from being saved. Invalid dates are set to `null`.

### Issue: Jobs Stuck in Queue

**Symptoms:**
- Jobs remain in `waiting` state
- Worker logs show no activity

**Solutions:**
1. **Check worker is running:**
   ```bash
   docker compose ps worker
   ```

2. **Restart worker:**
   ```bash
   docker compose restart worker
   ```

3. **Check Redis connection:**
   ```bash
   docker compose exec worker node -e "const Redis = require('ioredis'); const r = new Redis('redis://redis:6379'); r.ping().then(console.log).catch(console.error);"
   ```

### Issue: OCR Not Extracting Data

**Symptoms:**
- Job completes but receipt has no data (null storeName, totalAmount, etc.)

**Solutions:**
1. **Check image quality:**
   - Image should be clear and readable
   - Text should not be rotated or blurry
   - Minimum resolution: 300 DPI recommended

2. **Check OCR logs:**
   ```bash
   docker compose logs worker | grep -i "ocr\|extract"
   ```

3. **Test with a simple receipt:**
   - Use a clear, well-lit receipt image
   - Ensure text is horizontal
   - Avoid receipts with complex layouts

### Issue: Worker Crashes

**Symptoms:**
- Worker container stops unexpectedly
- Jobs fail repeatedly

**Solutions:**
1. **Check worker logs:**
   ```bash
   docker compose logs worker --tail 100
   ```

2. **Check memory:**
   ```bash
   docker stats shewaber-ocr-worker
   ```

3. **Restart worker:**
   ```bash
   docker compose restart worker
   ```

## Testing Extraction

### 1. Upload a Receipt

```bash
curl -X POST http://localhost:4000/api/upload \
  -F "file=@receipt.jpg" \
  -v
```

### 2. Get Job ID from Response

```json
{
  "jobId": "ocr-1764085360549-nijksd72l",
  "receiptId": "ea92ebc5-c823-4576-93d4-f70fbd7fc2b5",
  ...
}
```

### 3. Poll Job Status

```bash
# Replace with your job ID
JOB_ID="ocr-1764085360549-nijksd72l"

# Poll until completed
while true; do
  STATUS=$(curl -s http://localhost:4000/api/job/$JOB_ID | jq -r '.state')
  echo "Job status: $STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 2
done

# Get final result
curl -s http://localhost:4000/api/job/$JOB_ID | jq
```

### 4. Check Receipt in Database

```bash
# Using GraphQL
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { receipt(id: \"RECEIPT_ID\") { id storeName totalAmount items { name quantity price } } }"
  }'
```

## Performance Tips

1. **Image Optimization:**
   - Resize large images before upload (max 2000px width)
   - Use JPEG format for photos
   - Keep file size under 5MB

2. **Worker Concurrency:**
   - Current: 2 jobs concurrently
   - Adjust in `src/worker/ocr.worker.ts`:
     ```typescript
     concurrency: 2, // Increase for more parallel processing
     ```

3. **Queue Monitoring:**
   - Monitor queue length to avoid backlog
   - Set up alerts for failed jobs

## Logs Location

- **Backend logs**: `docker compose logs backend`
- **Worker logs**: `docker compose logs worker`
- **Redis logs**: `docker compose logs redis`
- **PostgreSQL logs**: `docker compose logs postgres`

## Next Steps

If extraction still doesn't work:

1. ✅ Verify all containers are running
2. ✅ Check worker logs for errors
3. ✅ Test with a simple, clear receipt image
4. ✅ Verify file is accessible in both containers
5. ✅ Check Redis queue status
6. ✅ Review OCR service logs for extraction issues

## Quick Health Check

```bash
# Run this to check everything
echo "=== Containers ===" && \
docker compose ps && \
echo -e "\n=== Worker Status ===" && \
docker compose logs worker --tail 5 && \
echo -e "\n=== Queue Status ===" && \
docker compose exec redis redis-cli LLEN bull:ocr-processing:waiting && \
echo -e "\n=== Uploads Directory ===" && \
docker compose exec backend ls -la /app/uploads | head -5
```

