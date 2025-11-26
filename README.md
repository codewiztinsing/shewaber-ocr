📸 Receipt OCR & Data Extraction API

A modern full-stack application that lets users upload receipt images, automatically extracts structured information using OCR, and exposes the data through a clean GraphQL API.

 What This Project Does

Upload a receipt → The system reads the text → Extracts useful data → Stores it → Lets you query it.

The app can extract:

 Store name

 Purchase date

 Total amount

 List of purchased items (name, quantity, price)

And provides:

GraphQL API for queries/mutations

A Next.js frontend for uploading and browsing receipts

Filtering by store name and date range

Full Docker support

Tech Stack Overview
Backend

Node.js + TypeScript

Express + Apollo GraphQL Server

Prisma ORM

PostgreSQL

Tesseract.js (OCR)

Multer (file uploads)

Frontend

Next.js 14

Apollo Client

TypeScript

DevOps

Docker & Docker Compose

 Project Structure
shewaber-ocr/
├── backend/
│   ├── src/
│   │   ├── graphql/     # Schema & resolvers
│   │   ├── services/    # OCR logic
│   │   ├── utils/       # File upload helper
│   │   └── index.ts     # Server entry
│   ├── prisma/          # DB schema
│   ├── uploads/         # Uploaded images
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/app/         # Next.js pages & components
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md

🛠️ Local Development Setup
1. Install Dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

2. Create PostgreSQL Database
createdb shewaber_ocr


Or with SQL:

CREATE DATABASE shewaber_ocr;

3. Configure Environment Files

Backend:

cd backend
cp .env.example .env


Frontend:

cd frontend
cp .env.local.example .env.local

4. Apply Prisma Migrations
cd backend
npx prisma migrate dev
npx prisma generate

5. Run Servers
npm run dev


Frontend → http://localhost:3000

Backend → http://localhost:4000/graphql

🐳 Running With Docker (Recommended)
docker-compose up --build


Starts:

PostgreSQL (5432)

Backend API (4000)

Frontend App (3000)

Stop:

docker-compose down

🧪 How to Use the App
Upload a Receipt

Go to http://localhost:3000

Choose an image (JPG/PNG/WebP/GIF)

Click Upload & Extract

OCR runs (≈10–30 sec)

Extracted data appears instantly

Filter Receipts

Filter by store name

Filter by date range

Combine both

🧬 GraphQL API Examples
Upload a Receipt
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

Get Receipts
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

🗄️ Database Models
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