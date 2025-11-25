# Docker Build Optimization Guide

## Why Builds Are Slow

The Docker build takes a long time (10-20 minutes) because:

1. **Tesseract.js is Heavy**: 
   - Large package (~50MB)
   - Downloads language data files (~100MB+)
   - Requires native compilation

2. **System Dependencies**:
   - Installing build tools (g++, make, python3)
   - Compiling native modules

3. **Network Speed**:
   - Downloading npm packages
   - Tesseract.js language data downloads

## What Was Fixed

✅ **Fixed `npm ci` error**: Changed to `npm install` (no package-lock.json required)  
✅ **Simplified build process**: Removed complex cache mount setup  
✅ **Optimized install order**: Install dependencies first, then rebuild Tesseract.js  
✅ **Reduced output**: Less verbose npm logs for faster terminal output  

## Build Time Breakdown

- System dependencies: ~1-2 minutes
- npm install (without scripts): ~2-5 minutes
- Tesseract.js rebuild: ~5-15 minutes (this is the slowest part)
- Prisma generate: ~30 seconds
- TypeScript build: ~1-2 minutes

**Total: ~10-25 minutes** (depending on network and CPU)

## Speed Optimization Tips

### 1. Use Docker BuildKit (Faster Layer Caching)

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Then build
docker compose build
```

### 2. Generate package-lock.json (Faster Installs)

```bash
cd backend
npm install  # This generates package-lock.json
cd ..
docker compose build  # Now npm ci will work and be faster
```

### 3. Use Multi-Stage Build (Smaller Images)

The current Dockerfile already optimizes layers, but you can further optimize by using a builder stage.

### 4. Pre-download Tesseract.js Language Data

You can pre-download the language data to speed up rebuilds:

```dockerfile
# Add this before npm install
RUN npm install -g tesseract.js && \
    node -e "const { createWorker } = require('tesseract.js'); (async () => { const worker = await createWorker('eng'); await worker.terminate(); })()"
```

### 5. Use .dockerignore

Make sure `.dockerignore` excludes unnecessary files (already done).

## Quick Build Commands

```bash
# Build with BuildKit (faster)
DOCKER_BUILDKIT=1 docker compose build

# Build only backend
docker compose build backend

# Build without cache (fresh build)
docker compose build --no-cache backend

# Build and run
docker compose up --build
```

## Troubleshooting

### Build Fails with "npm ci" Error
✅ **Fixed**: Now uses `npm install` instead

### Build Hangs on Tesseract.js
- This is normal - it's downloading language data
- Be patient, it can take 10-15 minutes
- Check your internet connection

### Out of Memory During Build
- Increase Docker memory limit (Settings → Resources)
- Minimum 4GB RAM recommended
- 8GB+ for faster builds

### Build Succeeds But App Doesn't Work
- Check logs: `docker compose logs backend`
- Verify database connection
- Ensure Prisma migrations ran: `docker compose exec backend npx prisma migrate deploy`

## Alternative: Use Pre-built Image

For production, consider:
1. Building the image once
2. Pushing to a registry (Docker Hub, AWS ECR, etc.)
3. Pulling the pre-built image instead of building

```bash
# Build and tag
docker build -t your-registry/shewaber-ocr-backend:latest ./backend

# Push
docker push your-registry/shewaber-ocr-backend:latest

# Use in docker-compose.yml
# image: your-registry/shewaber-ocr-backend:latest
```

