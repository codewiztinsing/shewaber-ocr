# Receipt OCR & Data Extraction API

A full-stack application that processes uploaded receipt images, extracts structured data using OCR, and exposes it via a GraphQL API.

## Tech Stack

### Backend
- **Node.js** with **TypeScript**
- **Apollo GraphQL Server** - GraphQL API
- **Prisma ORM** - Database ORM
- **PostgreSQL** - Database
- **Tesseract.js** - OCR engine for text extraction
- **Express** - HTTP server
- **Multer** - File upload handling

### Frontend
- **Next.js 14** - React framework
- **Apollo Client** - GraphQL client
- **TypeScript** - Type safety

### DevOps
- **Docker** & **Docker Compose** - Containerization

## Features

✅ Upload receipt images (JPEG, PNG, GIF, WebP)  
✅ Extract structured data:
   - Store name
   - Purchase date
   - Total amount
   - List of items with quantities and prices
✅ GraphQL API for queries and mutations  
✅ Filter receipts by store name and date range  
✅ Image validation (type and size)  
✅ Store extracted data in PostgreSQL  
✅ Docker support for easy setup  

## Project Structure

```
shewaber-ocr/
├── backend/
│   ├── src/
│   │   ├── graphql/
│   │   │   ├── schema.ts          # GraphQL schema
│   │   │   └── resolvers.ts       # GraphQL resolvers
│   │   ├── services/
│   │   │   └── ocr.service.ts     # OCR extraction logic
│   │   ├── utils/
│   │   │   └── fileUpload.ts      # File upload utilities
│   │   └── index.ts               # Server entry point
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── uploads/                   # Uploaded receipt images
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx           # Main page
│   │       ├── layout.tsx         # Root layout
│   │       └── globals.css       # Global styles
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Setup & Run Instructions

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 15+ (or use Docker)
- Docker and Docker Compose (optional)

### Option 1: Local Development (Without Docker)

#### 1. Clone and Install Dependencies

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

#### 2. Set Up Database

```bash
# Create a PostgreSQL database
createdb shewaber_ocr

# Or using psql
psql -U postgres
CREATE DATABASE shewaber_ocr;
```

#### 3. Configure Environment Variables

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env and set your DATABASE_URL
```

```bash
# Frontend
cd frontend
cp .env.local.example .env.local
# Edit .env.local if needed (default should work)
```

#### 4. Run Database Migrations

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

#### 5. Start Development Servers

```bash
# From root directory
npm run dev

# Or separately:
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend GraphQL: http://localhost:4000/graphql

### Option 2: Docker (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Or in detached mode
docker-compose up -d --build
```

This will start:
- PostgreSQL on port 5432
- Backend API on port 4000
- Frontend on port 3000

To stop:
```bash
docker-compose down
```

## Usage

### Upload a Receipt

1. Open http://localhost:3000
2. Click "Choose File" and select a receipt image
3. Click "Upload & Extract"
4. Wait for OCR processing (may take 10-30 seconds)
5. View the extracted data

### Filter Receipts

- Enter a store name to filter by store
- Select start and end dates to filter by date range
- Click "Apply Filters"

### GraphQL API

You can also interact with the API directly using GraphQL:

**Upload Receipt:**
```graphql
mutation UploadReceipt($file: Upload!) {
  uploadReceipt(file: $file) {
    id
    storeName
    purchaseDate
    totalAmount
    items {
      name
      quantity
      price
    }
  }
}
```

**Query Receipts:**
```graphql
query GetReceipts($filter: ReceiptFilter) {
  receipts(filter: $filter) {
    id
    storeName
    purchaseDate
    totalAmount
    items {
      name
      quantity
      price
    }
  }
}
```

## Testing

### Sample Receipts

You can test the application with any receipt image. The OCR engine will attempt to extract:
- Store name from the header
- Date from various date formats
- Total amount from lines containing "TOTAL", "AMOUNT", etc.
- Items from product lines

**Note:** OCR accuracy depends on image quality. For best results:
- Use clear, high-resolution images
- Ensure text is readable
- Avoid blurry or rotated images

## How to Extend the App

### Add User Authentication

1. Add a `User` model to Prisma schema:
```prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  password  String
  receipts  Receipt[]
  createdAt DateTime  @default(now())
}
```

2. Update `Receipt` model to include `userId`
3. Add authentication middleware (JWT, Passport, etc.)
4. Update GraphQL resolvers to check authentication

### Add Receipt Categorization

1. Add a `Category` model:
```prisma
model Category {
  id        String    @id @default(uuid())
  name      String
  receipts  Receipt[]
}
```

2. Add `categoryId` to `Receipt` model
3. Add category selection in frontend
4. Add category filter to GraphQL queries

### Export Data

1. Add an export resolver:
```typescript
exportReceipts: async (_, args, context) => {
  // Generate CSV/JSON/PDF
  // Return download link
}
```

2. Add export button in frontend
3. Implement CSV/JSON/PDF generation

### Background Processing with Queues

1. Install BullMQ:
```bash
npm install bullmq ioredis
```

2. Set up Redis (add to docker-compose.yml)
3. Create a queue for OCR processing
4. Move OCR logic to a worker
5. Return job ID immediately, poll for results

### Add More OCR Providers

The current implementation uses Tesseract.js. You can extend it to support:
- Google Cloud Vision API
- AWS Textract
- Azure Computer Vision

Create an interface and implement multiple providers:

```typescript
interface OCRProvider {
  extractText(imagePath: string): Promise<string>;
}

class TesseractProvider implements OCRProvider { ... }
class GoogleVisionProvider implements OCRProvider { ... }
```

## Database Schema

```prisma
model Receipt {
  id           String   @id @default(uuid())
  storeName    String?
  purchaseDate DateTime?
  totalAmount  Float?
  imageUrl     String?
  items        Item[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Item {
  id        String   @id @default(uuid())
  name      String
  quantity  Int?
  price     Float?
  receiptId String
  receipt   Receipt  @relation(fields: [receiptId], references: [id])
  createdAt DateTime @default(now())
}
```

## Troubleshooting

### OCR Not Extracting Data

- Check image quality and resolution
- Ensure text is clear and not rotated
- Check server logs for OCR errors
- Try different receipt formats

### Database Connection Issues

- Verify PostgreSQL is running
- Check DATABASE_URL in .env
- Ensure database exists
- Run migrations: `npx prisma migrate dev`

### File Upload Fails

- Check file size (max 10MB)
- Verify file type (JPEG, PNG, GIF, WebP only)
- Ensure uploads directory exists and is writable

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

