# Troubleshooting Guide - Common Errors & Fixes

## Root Causes of Frequent Errors

### 1. **OCR Worker Memory Leaks** ⚠️ CRITICAL
**Problem:** 
- A new `OCRService` instance was created for each request
- The Tesseract.js worker was never properly terminated
- Workers accumulated in memory, causing:
  - Memory leaks
  - Slower performance over time
  - Eventual server crashes

**Solution:**
- Implemented singleton pattern for OCR service
- Added proper worker initialization with race condition protection
- Added graceful shutdown handlers
- Worker is reused across requests (more efficient)

### 2. **Race Conditions in Worker Initialization**
**Problem:**
- Multiple concurrent requests could try to create workers simultaneously
- This caused conflicts and unpredictable behavior

**Solution:**
- Added `isInitializing` flag and `initPromise` to prevent concurrent initialization
- Only one worker creation happens at a time

### 3. **No Error Handling for Worker Failures**
**Problem:**
- If `createWorker()` failed, the error wasn't caught properly
- Worker could get into a bad state and never recover

**Solution:**
- Added try-catch blocks around worker creation
- Worker is reset if it fails during recognition
- Better error messages for debugging

### 4. **Array Mutation Bug**
**Problem:**
- `lines.reverse()` was mutating the original array
- If `parseReceiptText()` was called multiple times, results were incorrect

**Solution:**
- Create a copy before reversing: `[...lines].reverse()`
- Original array remains unchanged

### 5. **No Timeout Protection**
**Problem:**
- OCR processing could hang indefinitely
- No way to cancel stuck operations

**Solution:**
- Added 30-second timeout using `Promise.race()`
- Requests fail gracefully instead of hanging

### 6. **Missing Graceful Shutdown**
**Problem:**
- On server shutdown, workers weren't terminated
- Database connections weren't closed properly

**Solution:**
- Added SIGTERM and SIGINT handlers
- Proper cleanup of OCR worker and Prisma connections

## Common Error Messages & Solutions

### "OCR processing failed"
**Causes:**
- Image file is corrupted or unreadable
- OCR worker initialization failed
- Timeout (processing took > 30 seconds)

**Solutions:**
- Check image file is valid
- Restart server to reset worker
- Try a different image format
- Check server logs for detailed error

### "Failed to initialize OCR worker"
**Causes:**
- Tesseract.js dependencies missing
- Insufficient memory
- Concurrent initialization conflicts (now fixed)

**Solutions:**
- Reinstall dependencies: `npm install`
- Increase server memory
- Restart server

### "OCR processing timeout (30s)"
**Causes:**
- Image is too large or complex
- Server is overloaded
- Worker is stuck

**Solutions:**
- Use smaller/resized images
- Check server resources
- Restart server

### Database Connection Errors
**Causes:**
- PostgreSQL not running
- Wrong DATABASE_URL
- Connection pool exhausted

**Solutions:**
- Verify PostgreSQL is running: `pg_isready`
- Check `.env` file has correct DATABASE_URL
- Restart database service
- Run migrations: `npx prisma migrate dev`

## Performance Tips

1. **Image Optimization:**
   - Resize large images before upload (max 2000px width)
   - Use JPEG format for photos
   - Keep file size under 5MB for faster processing

2. **Server Resources:**
   - Allocate at least 2GB RAM for OCR processing
   - Use SSD storage for faster file I/O
   - Consider using a queue system (BullMQ) for high traffic

3. **Monitoring:**
   - Watch memory usage over time
   - Monitor OCR processing times
   - Set up alerts for errors

## Prevention Checklist

✅ OCR service uses singleton pattern  
✅ Worker initialization has race condition protection  
✅ Proper error handling and recovery  
✅ Timeout protection (30s)  
✅ Graceful shutdown handlers  
✅ Array mutations fixed  
✅ File cleanup on errors  
✅ Better error messages  

## Testing the Fixes

1. **Test Concurrent Requests:**
   ```bash
   # Upload multiple files simultaneously
   for i in {1..5}; do
     curl -X POST http://localhost:4000/api/upload \
       -F "file=@receipt$i.jpg" &
   done
   ```

2. **Monitor Memory:**
   ```bash
   # Watch memory usage
   watch -n 1 'ps aux | grep node | grep -v grep'
   ```

3. **Test Graceful Shutdown:**
   - Start server
   - Send SIGTERM: `kill -TERM <pid>`
   - Verify clean shutdown in logs

## Still Having Issues?

1. Check server logs for detailed error messages
2. Verify all dependencies are installed: `npm install`
3. Ensure database is running and accessible
4. Try restarting all services
5. Check system resources (memory, disk space)

