# Environment Setup Guide

## ✅ Fixed: DATABASE_URL Error

The error `Environment variable not found: DATABASE_URL` has been fixed by:

1. ✅ Added `dotenv` configuration at the top of `index.ts`
2. ✅ Created `.env` file in the `backend/` directory
3. ✅ Added validation to show helpful error if DATABASE_URL is missing

## Quick Setup

### 1. Verify .env File Exists

The `.env` file should be in `/backend/.env` with:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shewaber_ocr?schema=public"
PORT=4000
NODE_ENV=development
UPLOAD_DIR=./uploads
```

### 2. Start PostgreSQL Database

**Option A: Using Docker (Recommended)**
```bash
# Start just the database
docker compose up -d postgres

# Or start everything
docker compose up -d
```

**Option B: Local PostgreSQL**
```bash
# Make sure PostgreSQL is running
sudo systemctl start postgresql

# Create database if it doesn't exist
createdb shewaber_ocr
# Or using psql:
psql -U postgres -c "CREATE DATABASE shewaber_ocr;"
```

### 3. Run Database Migrations

```bash
cd backend
npx prisma migrate dev
```

This will:
- Create the database tables
- Generate Prisma Client
- Set up the schema

### 4. Start the Backend Server

```bash
cd backend
npm run dev
```

## Troubleshooting

### Error: "DATABASE_URL environment variable is not set"

**Solution:**
1. Check that `.env` file exists in `backend/` directory
2. Verify the file has `DATABASE_URL=...` (no spaces around `=`)
3. Restart the server after creating/editing `.env`

### Error: "Can't reach database server"

**Solution:**
1. Check PostgreSQL is running:
   ```bash
   # Docker
   docker ps | grep postgres
   
   # Local
   sudo systemctl status postgresql
   ```

2. Verify connection string in `.env`:
   - Host: `localhost` (or `postgres` if using Docker)
   - Port: `5432`
   - Database: `shewaber_ocr`
   - User: `postgres`
   - Password: `postgres` (or your actual password)

3. Test connection:
   ```bash
   psql -h localhost -U postgres -d shewaber_ocr
   ```

### Error: "Database does not exist"

**Solution:**
```bash
# Create the database
createdb shewaber_ocr

# Or using Docker
docker compose exec postgres psql -U postgres -c "CREATE DATABASE shewaber_ocr;"
```

### Error: "Migration failed"

**Solution:**
```bash
cd backend
npx prisma migrate reset  # WARNING: This deletes all data!
npx prisma migrate dev
```

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ Yes |
| `PORT` | Server port | `4000` | No |
| `NODE_ENV` | Environment (development/production) | `development` | No |
| `UPLOAD_DIR` | Directory for uploaded files | `./uploads` | No |

## Docker vs Local Development

### Docker
- Environment variables come from `docker-compose.yml`
- No `.env` file needed in Docker
- Database host is `postgres` (service name)

### Local Development
- Requires `.env` file in `backend/` directory
- Database host is `localhost`
- Make sure PostgreSQL is running locally

## Next Steps

After setting up the environment:

1. ✅ Verify `.env` file exists
2. ✅ Start PostgreSQL
3. ✅ Run migrations: `npx prisma migrate dev`
4. ✅ Start server: `npm run dev`
5. ✅ Test GraphQL endpoint: http://localhost:4000/graphql

