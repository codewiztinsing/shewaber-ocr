import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';

export interface ExtractedData {
  storeName?: string;
  purchaseDate?: Date;
  totalAmount?: number;
  items: Array<{
    name: string;
    quantity?: number;
    price?: number;
  }>;
}

export class OCRService {
  private worker: any = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    // If already initialized, return
    if (this.worker) {
      return;
    }

    // If currently initializing, wait for that to complete
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        this.worker = await createWorker('eng');
      } catch (error) {
        this.isInitializing = false;
        this.initPromise = null;
        throw new Error(`Failed to initialize OCR worker: ${error}`);
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  async extractText(imagePath: string): Promise<string> {
    await this.initialize();
    
    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    try {
      const { data: { text } } = await this.worker.recognize(imagePath);
      return text;
    } catch (error) {
      // If worker is in bad state, reset it
      if (this.worker) {
        try {
          await this.worker.terminate();
        } catch (e) {
          // Ignore termination errors
        }
        this.worker = null;
      }
      throw new Error(`OCR text extraction failed: ${error}`);
    }
  }

  async extractData(imagePath: string): Promise<ExtractedData> {
    const text = await this.extractText(imagePath);
    return this.parseReceiptText(text);
  }

  private parseReceiptText(text: string): ExtractedData {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const extracted: ExtractedData = {
      items: [],
    };

    // Extract store name (usually first line or contains "STORE", "MARKET", etc.)
    const storeNamePattern = /(STORE|MARKET|RESTAURANT|SHOP|SUPERMARKET|GROCERY)/i;
    for (const line of lines.slice(0, 5)) {
      if (storeNamePattern.test(line) || line.length > 5 && line.length < 50) {
        extracted.storeName = line.replace(/[^\w\s&]/g, '').trim();
        break;
      }
    }

    // Extract date (look for date patterns)
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s,]+(\d{1,2})[\s,]+(\d{2,4})/i,
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          try {
            extracted.purchaseDate = new Date(match[0]);
            if (!isNaN(extracted.purchaseDate.getTime())) {
              break;
            }
          } catch (e) {
            // Invalid date, continue
          }
        }
      }
      if (extracted.purchaseDate) break;
    }

    // Extract total amount (look for "TOTAL", "AMOUNT", "SUM", etc.)
    const totalPatterns = [
      /TOTAL[:\s]*\$?(\d+\.?\d*)/i,
      /AMOUNT[:\s]*\$?(\d+\.?\d*)/i,
      /SUM[:\s]*\$?(\d+\.?\d*)/i,
      /TOTAL[:\s]*(\d+\.?\d*)/i,
    ];

    // Create a reversed copy to avoid mutating the original array
    const reversedLines = [...lines].reverse();
    for (const line of reversedLines) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          extracted.totalAmount = parseFloat(match[1]);
          break;
        }
      }
      // Also check for standalone large numbers at the end (likely total)
      const numberMatch = line.match(/\$?(\d+\.\d{2})/);
      if (numberMatch && !extracted.totalAmount) {
        const amount = parseFloat(numberMatch[1]);
        if (amount > 0 && amount < 100000) {
          extracted.totalAmount = amount;
        }
      }
      if (extracted.totalAmount) break;
    }

    // Extract items (lines that look like product names with optional prices/quantities)
    const itemPattern = /^(.+?)(?:\s+(\d+)\s*x?\s*)?(?:\$?(\d+\.?\d*))?$/;
    
    // Use original lines array (not reversed) for items
    for (const line of lines) {
      // Skip lines that are clearly not items
      if (
        line.match(/TOTAL|AMOUNT|SUM|DATE|STORE|TAX|SUB/i) ||
        line.length < 3 ||
        line.length > 100
      ) {
        continue;
      }

      const match = line.match(itemPattern);
      if (match) {
        const name = match[1].trim();
        const quantity = match[2] ? parseInt(match[2]) : undefined;
        const price = match[3] ? parseFloat(match[3]) : undefined;

        // Only add if it looks like a product name
        if (name.length > 2 && name.length < 80) {
          extracted.items.push({
            name,
            quantity,
            price,
          });
        }
      } else if (line.length > 3 && line.length < 80 && !line.match(/^\d+$/)) {
        // Fallback: add as item name only
        extracted.items.push({
          name: line,
        });
      }
    }

    return extracted;
  }

  async terminate() {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (error) {
        console.error('Error terminating OCR worker:', error);
      } finally {
        this.worker = null;
        this.isInitializing = false;
        this.initPromise = null;
      }
  }
  }
}

