# Docker Image Access Configuration

## ✅ Fixed: Image Access in Docker

Images are now properly accessible from both Docker containers and the host machine.

## Configuration

### Backend (Image Server)

1. **Upload Directory**: `/app/uploads` (mounted from `./backend/uploads`)
2. **Static Route**: `/uploads` serves images
3. **CORS**: Configured to allow frontend access
4. **Environment Variable**: `UPLOAD_DIR=/app/uploads`

### Frontend (Image Client)

1. **API URL**: Uses `NEXT_PUBLIC_API_URL` environment variable
2. **Image URLs**: Constructed as `${NEXT_PUBLIC_API_URL}${receipt.imageUrl}`
3. **Fallback**: Defaults to `http://localhost:4000` if not set

## How It Works

### File Upload Flow

1. **Upload**: File uploaded to `/api/upload`
2. **Storage**: Saved to `/app/uploads` in container (mapped to `./backend/uploads` on host)
3. **Database**: Image URL stored as `/uploads/filename.jpg`
4. **Serving**: Express static middleware serves from `/uploads` route

### Image Access Flow

1. **Frontend Request**: `<img src="http://localhost:4000/uploads/filename.jpg" />`
2. **Backend Route**: Express serves file from `/app/uploads/filename.jpg`
3. **Response**: Image streamed to browser

## Environment Variables

### Backend
```env
UPLOAD_DIR=/app/uploads
FRONTEND_URL=http://localhost:3000
```

### Frontend
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
```

## Docker Volumes

```yaml
volumes:
  - ./backend/uploads:/app/uploads  # Maps host directory to container
```

This ensures:
- ✅ Images persist after container restart
- ✅ Images accessible from host machine
- ✅ Images accessible from frontend container
- ✅ Images accessible from worker container

## Accessing Images

### From Browser (Frontend)
```
http://localhost:4000/uploads/1234567890-abc123.jpg
```

### From Host Machine
```
./backend/uploads/1234567890-abc123.jpg
```

### From Docker Container
```bash
docker exec shewaber-ocr-backend ls -la /app/uploads
```

## Troubleshooting

### Images Not Loading

1. **Check uploads directory exists:**
   ```bash
   docker exec shewaber-ocr-backend ls -la /app/uploads
   ```

2. **Check file permissions:**
   ```bash
   docker exec shewaber-ocr-backend chmod -R 755 /app/uploads
   ```

3. **Check CORS configuration:**
   - Verify `FRONTEND_URL` in backend environment
   - Check browser console for CORS errors

4. **Check image URL:**
   - Verify `NEXT_PUBLIC_API_URL` in frontend
   - Check network tab for 404 errors

### Images Not Persisting

1. **Verify volume mount:**
   ```bash
   docker compose config | grep uploads
   ```

2. **Check host directory:**
   ```bash
   ls -la ./backend/uploads
   ```

### CORS Errors

If you see CORS errors in browser console:

1. **Update backend CORS:**
   ```typescript
   app.use(cors({
     origin: process.env.FRONTEND_URL || 'http://localhost:3000',
     credentials: true,
   }));
   ```

2. **Verify environment variable:**
   ```bash
   docker exec shewaber-ocr-backend env | grep FRONTEND_URL
   ```

## Testing

### Test Image Upload
```bash
curl -X POST http://localhost:4000/api/upload \
  -F "file=@receipt.jpg"
```

### Test Image Access
```bash
curl http://localhost:4000/uploads/1234567890-abc123.jpg \
  --output test-image.jpg
```

### Test from Frontend
1. Upload a receipt via frontend
2. Check browser network tab
3. Verify image loads correctly
4. Check image URL matches pattern

## Production Considerations

For production, consider:

1. **CDN**: Use a CDN (CloudFront, Cloudflare) for image serving
2. **Object Storage**: Use S3, GCS, or Azure Blob for image storage
3. **Image Optimization**: Resize/compress images on upload
4. **Security**: Add authentication for image access
5. **Caching**: Implement proper cache headers (already done)

## Current Implementation

✅ Images stored in mounted volume  
✅ Images served via Express static middleware  
✅ CORS configured for frontend access  
✅ Environment variables for flexible configuration  
✅ Error handling for failed image loads  
✅ Cache headers for performance  

