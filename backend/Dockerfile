FROM node:18-alpine

WORKDIR /app

# Install system dependencies needed for Tesseract.js and native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Configure npm for better performance and reduce output
RUN npm config set fetch-retries 3 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set progress false && \
    npm config set loglevel warn

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (production + dev needed for build)
# Using --ignore-scripts first to avoid Tesseract.js download during install
# This speeds up the initial install significantly
RUN npm install --ignore-scripts

# Now rebuild Tesseract.js which will download language data
# This is the slowest part but necessary for OCR to work
RUN npm rebuild tesseract.js || npm install tesseract.js --force

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size (optional)
RUN npm prune --production

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 4000

CMD ["npm", "start"]

