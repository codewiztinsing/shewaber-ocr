# 📸 Receipt OCR & Data Extraction System

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-E10098?style=flat&logo=graphql&logoColor=white)](https://graphql.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

A production-ready full-stack application that automatically extracts structured data from receipt images using Optical Character Recognition (OCR) technology. The system processes uploaded receipts, extracts key information, and provides a GraphQL API for querying and managing receipt data.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Development](#-development)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### Core Functionality
- **📤 Image Upload**: Support for JPEG, PNG, GIF, and WebP formats
- **🔍 OCR Processing**: Automatic text extraction using Tesseract.js
- **📊 Data Extraction**:
  - Store name (detected from TIN number or header)
  - Purchase date (multiple format support)
  - Total amount spent
  - List of purchased items with quantities
- **🔎 Advanced Filtering**: Filter receipts by store name and date range
- **📱 Modern UI**: Responsive Next.js frontend with real-time updates
- **🔌 GraphQL API**: Type-safe API with Apollo Server
- **🐳 Docker Support**: Complete containerization for easy deployment

### Technical Features
- Background job processing with Redis/BullMQ
- Image validation and error handling
- Optimized OCR worker pool
- Database migrations with Prisma
- TypeScript for type safety
- RESTful file upload endpoint

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **TypeScript** | Type-safe development |
| **Express** | HTTP server framework |
| **Apollo GraphQL Server** | GraphQL API server |
| **Prisma ORM** | Database ORM and migrations |
| **PostgreSQL** | Relational database |
| **Tesseract.js** | OCR engine for text extraction |
| **Multer** | File upload middleware |
| **BullMQ** | Job queue for background processing |
| **Redis** | Queue backend and caching |

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with SSR |
| **Apollo Client** | GraphQL client |
| **TypeScript** | Type safety |
| **React** | UI library |

### DevOps
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |

## 🏗 Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP/GraphQL
       ▼
┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend   │
│  (Next.js)  │     │ (Express +  │
│             │     │  GraphQL)   │
└─────────────┘     └──────┬──────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │PostgreSQL│    │  Redis   │    │  Worker  │
    │          │    │  Queue   │    │   OCR    │
    └──────────┘    └──────────┘    └──────────┘
```

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher
- **npm** 9.x or higher (or **yarn**)
- **PostgreSQL** 15.x or higher (optional if using Docker)
- **Docker** and **Docker Compose** (recommended)
- **Git** for version control

## 🚀 Installation

### Option 1: Docker (Recommended)

The easiest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/codewiztinsing/shewaber-ocr.git
cd shewaber-ocr

# Start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

This will start:
- PostgreSQL database on port `5433`
- Redis on port `6380`
- Backend API on port `4000`
- Frontend application on port `3000`

Access the application at:
- **Frontend**: http://localhost:3000
- **GraphQL Playground**: http://localhost:4000/graphql
- **API Upload Endpoint**: http://localhost:4000/api/upload

To stop all services:
```bash
docker-compose down
```

### Option 2: Local Development

#### 1. Install Dependencies

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

#### 2. Database Setup

Create a PostgreSQL database:

```bash
# Using createdb command
createdb shewaber_ocr

# Or using psql
psql -U postgres
CREATE DATABASE shewaber_ocr;
\q
```

#### 3. Environment Configuration

**Backend Environment Variables** (`backend/.env`):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shewaber_ocr?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=4000
NODE_ENV=development
UPLOAD_DIR="./uploads"
FRONTEND_URL="http://localhost:3000"
```

**Frontend Environment Variables** (`frontend/.env.local`):

```env
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
NEXT_PUBLIC_API_URL=http://localhost:4000
```

#### 4. Database Migrations

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

#### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Worker (Optional, for background processing):**
```bash
cd backend
npm run start:worker
```

## ⚙️ Configuration

### Environment Variables

#### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `PORT` | Server port | `4000` |
| `NODE_ENV` | Environment mode | `development` |
| `UPLOAD_DIR` | Upload directory path | `./uploads` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

#### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_GRAPHQL_URL` | GraphQL endpoint | `http://localhost:4000/graphql` |
| `NEXT_PUBLIC_API_URL` | API base URL | `http://localhost:4000` |

## 📖 Usage

### Web Interface

1. **Upload a Receipt**:
   - Navigate to http://localhost:3000
   - Click "Choose File" and select a receipt image
   - Click "Upload & Extract"
   - Wait for OCR processing (10-30 seconds)
   - View extracted data in the receipt list

2. **Filter Receipts**:
   - Enter a store name in the filter field
   - Select start and end dates for date range filtering
   - Click "Apply Filters" to see filtered results
   - Click "Clear Filters" to reset

3. **View Receipt Details**:
   - Click "View Details" on any receipt card
   - See complete receipt information including:
     - Store name
     - Purchase date
     - Total amount
     - Complete list of purchased items with quantities

### GraphQL API

#### Query Receipts

```graphql
query GetReceipts($filter: ReceiptFilter) {
  receipts(filter: $filter) {
    id
    storeName
    purchaseDate
    totalAmount
    imageUrl
    items {
      id
      name
      quantity
      price
    }
    createdAt
    updatedAt
  }
}
```

**Variables:**
```json
{
  "filter": {
    "storeName": "ELF IGN CAFE",
    "startDate": "2023-01-01",
    "endDate": "2023-12-31"
  }
}
```

#### Get Single Receipt

```graphql
query GetReceipt($id: ID!) {
  receipt(id: $id) {
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

#### Update Receipt

```graphql
mutation UpdateReceipt($id: ID!, $input: UpdateReceiptInput!, $items: [UpdateItemInput!]) {
  updateReceipt(id: $id, input: $input, items: $items) {
    id
    storeName
    purchaseDate
    totalAmount
    items {
      name
      quantity
    }
  }
}
```

#### Delete Receipt

```graphql
mutation DeleteReceipt($id: ID!) {
  deleteReceipt(id: $id)
}
```

### REST API

#### Upload Receipt Image

```bash
curl -X POST http://localhost:4000/api/upload \
  -F "file=@/path/to/receipt.jpg"
```

**Response:**
```json
{
  "jobId": "ocr-1234567890-abc123",
  "message": "Receipt uploaded successfully",
  "status": "processing"
}
```

#### Check Job Status

```bash
curl http://localhost:4000/api/job-status/ocr-1234567890-abc123
```

## 📁 Project Structure

```
shewaber-ocr/
├── backend/
│   ├── src/
│   │   ├── graphql/
│   │   │   ├── schema.ts          # GraphQL type definitions
│   │   │   └── resolvers.ts       # GraphQL resolvers
│   │   ├── services/
│   │   │   └── ocr.service.ts     # OCR extraction logic
│   │   ├── queue/
│   │   │   └── ocr.queue.ts       # Job queue configuration
│   │   ├── worker/
│   │   │   └── ocr.worker.ts      # Background worker
│   │   ├── utils/
│   │   │   └── fileUpload.ts      # File upload utilities
│   │   └── index.ts                # Server entry point
│   ├── prisma/
│   │   ├── schema.prisma           # Database schema
│   │   └── migrations/            # Database migrations
│   ├── uploads/                    # Uploaded receipt images
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Main page component
│   │   │   ├── layout.tsx          # Root layout
│   │   │   └── globals.css        # Global styles
│   │   └── lib/
│   │       └── apollo-client.ts   # Apollo Client setup
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml              # Docker Compose configuration
├── README.md
└── package.json
```

## 🗄️ Database Schema

### Receipt Model

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
```

### Item Model

```prisma
model Item {
  id        String   @id @default(uuid())
  name      String
  quantity  Int?
  price     Float?
  receiptId String
  receipt   Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

## 🔧 Development

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Code Formatting

```bash
# Format backend code
cd backend
npm run format

# Format frontend code
cd frontend
npm run format
```

### Database Migrations

```bash
cd backend

# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Building for Production

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build
```

## 🚢 Deployment

### Docker Production Build

```bash
# Build optimized images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d
```

### Environment-Specific Configuration

Ensure production environment variables are set:
- Use strong database passwords
- Configure proper CORS settings
- Set up SSL/TLS certificates
- Configure Redis for production
- Set appropriate file upload limits

## 🐛 Troubleshooting

### Common Issues

#### OCR Not Extracting Data

**Symptoms**: Receipts uploaded but no data extracted

**Solutions**:
- Check image quality (should be clear and readable)
- Ensure text is not rotated or skewed
- Verify Tesseract.js is properly installed
- Check server logs for OCR errors
- Try different receipt formats

#### Database Connection Errors

**Symptoms**: Cannot connect to PostgreSQL

**Solutions**:
- Verify PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` in `.env` file
- Ensure database exists: `psql -l | grep shewaber_ocr`
- Verify network connectivity
- Check firewall settings

#### File Upload Fails

**Symptoms**: Upload button doesn't work or returns error

**Solutions**:
- Verify file size is under 10MB limit
- Check file type (JPEG, PNG, GIF, WebP only)
- Ensure `uploads/` directory exists and is writable
- Check server logs for detailed error messages
- Verify CORS settings

#### GraphQL Query Errors

**Symptoms**: GraphQL queries return errors

**Solutions**:
- Check GraphQL Playground at http://localhost:4000/graphql
- Verify query syntax
- Check that required fields are provided
- Review server logs for detailed error messages

### Debugging

Enable debug logging:

```bash
# Backend
DEBUG=* npm run dev

# Frontend
NODE_ENV=development npm run dev
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Commit your changes**: `git commit -m 'Add some amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure code passes linting and type checking

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tesseract.js](https://github.com/naptha/tesseract.js) for OCR capabilities
- [Apollo GraphQL](https://www.apollographql.com/) for the GraphQL framework
- [Prisma](https://www.prisma.io/) for the excellent ORM
- [Next.js](https://nextjs.org/) for the React framework

## 📞 Support

For issues, questions, or contributions:
- Open an issue on [GitHub](https://github.com/codewiztinsing/shewaber-ocr/issues)
- Check existing documentation
- Review the troubleshooting section

---

**Made with ❤️ using TypeScript, Next.js, and GraphQL**
