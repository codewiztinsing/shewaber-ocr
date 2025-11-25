# Quick Setup Guide

## Prerequisites
- Node.js 18+ and npm
- PostgreSQL 15+ (or use Docker)
- Docker and Docker Compose (optional, for containerized setup)

## Quick Start with Docker (Recommended)

```bash
# Clone the repository
cd shewaber-ocr

# Start all services
docker-compose up --build

# The application will be available at:
# - Frontend: http://localhost:3000
# - Backend GraphQL: http://localhost:4000/graphql
```

## Local Development Setup

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Set Up Database

**Option A: Using Docker (Easiest)**
```bash
docker run --name shewaber-ocr-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=shewaber_ocr -p 5432:5432 -d postgres:15-alpine
```

**Option B: Local PostgreSQL**
```bash
# Create database
createdb shewaber_ocr

# Or using psql
psql -U postgres
CREATE DATABASE shewaber_ocr;
```

### 3. Configure Environment

**Backend:**
```bash
cd backend
# Create .env file (copy from .env.example if it exists)
echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shewaber_ocr?schema=public"
PORT=4000
NODE_ENV=development
UPLOAD_DIR=./uploads' > .env
```

**Frontend:**
```bash
cd frontend
# Create .env.local file
echo 'NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql' > .env.local
```

### 4. Run Database Migrations

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Start Development Servers

**Option A: From root (using concurrently)**
```bash
# From project root
npm run dev
```

**Option B: Separate terminals**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Testing

1. Open http://localhost:3000
2. Upload a receipt image (JPEG, PNG, GIF, or WebP)
3. Wait for OCR processing (10-30 seconds)
4. View extracted data

### Sample Receipts

You can test with any receipt image. For best results:
- Use clear, high-resolution images
- Ensure text is readable
- Avoid blurry or rotated images

## Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check DATABASE_URL in backend/.env
- Verify database exists: `psql -U postgres -l`

### OCR Not Working
- Check server logs for errors
- Ensure image is clear and readable
- Try a different receipt format

### Port Already in Use
- Change PORT in backend/.env
- Update NEXT_PUBLIC_GRAPHQL_URL in frontend/.env.local

