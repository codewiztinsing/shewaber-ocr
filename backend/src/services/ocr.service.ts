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
    await this.initialize();
    
    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    try {
      const { data } = await this.worker.recognize(imagePath);
      const text = data.text;
      console.log('text', text);
      
      // Use word-level data to better identify store name (bold text at top)
      return this.parseReceiptText(text, data.words);
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
      throw new Error(`OCR data extraction failed: ${error}`);
    }
  }

  private parseReceiptText(text: string, words?: any[]): ExtractedData {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const extracted: ExtractedData = {
      items: [],
    };

    // Extract store name - prioritize line after TIN number
    // TIN patterns: TIN, TIN:, TIN No, TIN Number, etc. followed by numbers
    const tinPatterns = [
      /TIN\s*:?\s*[:\-]?\s*\d+/i,
      /TIN\s+NO[.:]?\s*:?\s*\d+/i,
      /TIN\s+NUMBER[.:]?\s*:?\s*\d+/i,
      /TAX\s+ID[.:]?\s*:?\s*\d+/i,
      /TAX\s+IDENTIFICATION\s+NUMBER[.:]?\s*:?\s*\d+/i,
    ];

    // First, try to find TIN number and get store name from next line
    let tinFound = false;
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      for (const pattern of tinPatterns) {
        if (pattern.test(line)) {
          // Found TIN, get store name from next line
          const nextLine = lines[i + 1]?.trim();
          if (nextLine && nextLine.length >= 3 && nextLine.length <= 60) {
            // Skip if next line looks like a date, number, metadata, or footer content
            if (
              !nextLine.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) &&
              !nextLine.match(/TOTAL|AMOUNT|SUM|DATE|TAX|SUB|PHONE|TEL|TIN/i) &&
              !nextLine.match(/powered\s+by|thank\s+you|visit\s+us|website|www\.|http/i) &&
              !nextLine.match(/^\d+$/)
            ) {
              extracted.storeName = nextLine.replace(/[^\w\s&'.-]/g, '').trim();
              console.log('[OCR] Store Name extracted (TIN-based):', extracted.storeName);
              tinFound = true;
              break;
            }
          }
        }
      }
      if (tinFound) break;
    }

    // If TIN-based extraction didn't work, try word-level analysis for bold text at top
    if (!extracted.storeName && words && Array.isArray(words) && words.length > 0) {
      // Helper functions to extract coordinates from different bbox structures
      const getY = (word: any) => {
        if (word.bbox?.y0 !== undefined) return word.bbox.y0;
        if (word.bbox?.top !== undefined) return word.bbox.top;
        if (word.bbox?.[1] !== undefined) return word.bbox[1];
        return 0;
      };
      const getX = (word: any) => {
        if (word.bbox?.x0 !== undefined) return word.bbox.x0;
        if (word.bbox?.left !== undefined) return word.bbox.left;
        if (word.bbox?.[0] !== undefined) return word.bbox[0];
        return 0;
      };
      
      // Get words from the top portion of the receipt (first 20% of Y coordinates)
      const sortedWords = [...words]
        .filter((word: any) => {
          // Handle different possible data structures
          const wordText = word.text || word.symbols?.[0]?.text || '';
          return wordText && wordText.trim().length > 0;
        })
        .sort((a: any, b: any) => {
          // Sort by Y coordinate (top to bottom), then by X (left to right)
          const aY = getY(a);
          const bY = getY(b);
          if (Math.abs(aY - bY) < 10) {
            // Same line, sort by X
            return getX(a) - getX(b);
          }
          return aY - bY;
        });

      // Get the top portion of the receipt (first 20% of words by Y position)
      const topThreshold = sortedWords.length > 0 
        ? getY(sortedWords[Math.floor(sortedWords.length * 0.2)])
        : 0;
      
      const topWords = sortedWords.filter((word: any) => 
        getY(word) <= topThreshold + 50 // Allow some tolerance
      );

      // Group top words into lines
      const topLines: string[] = [];
      let currentLine: string[] = [];
      let lastY = -1;

      for (const word of topWords.slice(0, 20)) { // Check first 20 top words
        const wordY = getY(word);
        const wordText = (word.text || word.symbols?.[0]?.text || '').trim();
        
        if (wordText.length === 0) continue;

        // If Y position changed significantly, start a new line
        if (lastY >= 0 && Math.abs(wordY - lastY) > 15) {
          if (currentLine.length > 0) {
            topLines.push(currentLine.join(' '));
            currentLine = [];
          }
        }
        
        currentLine.push(wordText);
        lastY = wordY;
      }
      
      if (currentLine.length > 0) {
        topLines.push(currentLine.join(' '));
      }

      // Check for TIN in word-level data and get next line
      for (let i = 0; i < topLines.length - 1; i++) {
        const line = topLines[i];
        for (const pattern of tinPatterns) {
          if (pattern.test(line)) {
            const nextLine = topLines[i + 1]?.trim();
            if (nextLine && nextLine.length >= 3 && nextLine.length <= 60) {
              if (
                !nextLine.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) &&
                !nextLine.match(/TOTAL|AMOUNT|SUM|DATE|TAX|SUB|PHONE|TEL|TIN/i) &&
                !nextLine.match(/powered\s+by|thank\s+you|visit\s+us|website|www\.|http/i) &&
                !nextLine.match(/^\d+$/)
              ) {
                extracted.storeName = nextLine.replace(/[^\w\s&'.-]/g, '').trim();
                console.log('[OCR] Store Name extracted (word-level TIN-based):', extracted.storeName);
                tinFound = true;
                break;
              }
            }
          }
        }
        if (tinFound) break;
      }

      // If still no store name, prioritize lines that:
      // 1. Are at the very top (first 2-3 lines)
      // 2. Have reasonable length (5-50 characters)
      // 3. Don't look like dates, totals, or other metadata
      // 4. Have higher confidence scores (bold text often has higher confidence)
      if (!extracted.storeName) {
        for (const line of topLines.slice(0, 5)) {
          const cleanLine = line.trim();
          
          // Skip if it looks like a date, total, or other metadata
          // Also skip "powered by" sections
          if (
            cleanLine.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) ||
            cleanLine.match(/TOTAL|AMOUNT|SUM|DATE|TAX|SUB|PHONE|TEL|TIN/i) ||
            cleanLine.match(/powered\s+by|thank\s+you|visit\s+us|website|www\.|http/i) ||
            cleanLine.length < 3 ||
            cleanLine.length > 60
          ) {
            continue;
          }

          // Check if this line has words with high confidence (indicating bold/prominent text)
          const lineWords = topWords.filter((word: any) => {
            const wordText = (word.text || word.symbols?.[0]?.text || '').trim();
            return line.includes(wordText);
          });
          const avgConfidence = lineWords.length > 0
            ? lineWords.reduce((sum: number, w: any) => sum + (w.confidence || 0), 0) / lineWords.length
            : 0;

          // Prioritize lines with higher confidence or reasonable length
          if (cleanLine.length >= 3 && cleanLine.length <= 60) {
            extracted.storeName = cleanLine.replace(/[^\w\s&'.-]/g, '').trim();
            console.log('[OCR] Store Name extracted (word-level):', extracted.storeName, 'confidence:', avgConfidence.toFixed(2));
            // If we found a high-confidence line, use it; otherwise continue searching
            if (avgConfidence > 80 || topLines.indexOf(line) < 2) {
              break;
            }
          }
        }
      }
    }

    // Fallback: use original logic if TIN-based and word-level data didn't help
    if (!extracted.storeName) {
      const storeNamePattern = /(STORE|MARKET|RESTAURANT|SHOP|SUPERMARKET|GROCERY)/i;
      for (const line of lines.slice(0, 5)) {
        if (storeNamePattern.test(line) || (line.length > 5 && line.length < 50)) {
          extracted.storeName = line.replace(/[^\w\s&'.-]/g, '').trim();
          console.log('[OCR] Store Name extracted (fallback):', extracted.storeName);
          break;
        }
      }
    }
    
    // Log final store name result
    if (extracted.storeName) {
      console.log('[OCR] Final Store Name:', extracted.storeName);
    } else {
      console.log('[OCR] Store Name: Not found');
    }

    // Extract date (look for date patterns)
    console.log('[OCR] Starting date extraction...');
    const datePatterns = [
      {
        pattern: /DATE\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})(?:\s+\d{1,2}\s*:\s*\d{1,2})?/i,
        name: 'DATE: DD/MM/YYYY or DD-MM-YYYY (with optional time)',
      },
      {
        pattern: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})(?:\s+\d{1,2}\s*:\s*\d{1,2})?/,
        name: 'DD/MM/YYYY or DD-MM-YYYY (with optional time)',
      },
      {
        pattern: /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
        name: 'YYYY/MM/DD or YYYY-MM-DD',
      },
      {
        pattern: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s,]+(\d{1,2})[\s,]+(\d{2,4})/i,
        name: 'Month DD YYYY',
      },
      {
        pattern: /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s,]+(\d{2,4})/i,
        name: 'DD Month YYYY',
      },
    ];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      console.log(`[OCR] Checking line ${lineIndex + 1} for date:`, line);
      
      for (let patternIndex = 0; patternIndex < datePatterns.length; patternIndex++) {
        const { pattern, name } = datePatterns[patternIndex];
        const match = line.match(pattern);
        
        if (match) {
          console.log(`[OCR] Date pattern matched (${name}):`, match[0], '| Full match:', match);
          
          try {
            let dateString = match[0];
            
            // Handle DATE: prefix - use captured group if available (it excludes the time)
            if (match[1] && name.includes('DATE:')) {
              dateString = match[1];
              console.log('[OCR] Extracted date string (removed DATE: prefix):', dateString);
            } else if (match[1]) {
              // Use captured group if available (for patterns without DATE: prefix)
              dateString = match[1];
              console.log('[OCR] Using captured date group:', dateString);
            } else {
              // Fallback: Remove time component if present (e.g., "14/08/2023 16:53" or "14/08/2023 14: 15" -> "14/08/2023")
              // Handle spaces around colon (OCR may add spaces)
              const timeMatch = dateString.match(/\s+\d{1,2}\s*:\s*\d{1,2}/);
              if (timeMatch) {
                dateString = dateString.replace(/\s+\d{1,2}\s*:\s*\d{1,2}.*$/, '').trim();
                console.log('[OCR] Removed time component, date string:', dateString);
              }
            }
            
            // Clean up any remaining whitespace
            dateString = dateString.trim();
            
            // Try to parse the date
            let parsedDate: Date;
            
            // Handle different date formats
            if (dateString.includes('/')) {
              const parts = dateString.split('/');
              if (parts.length === 3) {
                let day = parts[0];
                let month = parts[1];
                let year = parts[2];
                
                // Convert 2-digit year to 4-digit (assume 2000s if year < 50, else 1900s)
                if (year.length === 2) {
                  const yearNum = parseInt(year);
                  year = (yearNum < 50 ? '20' : '19') + year;
                  console.log('[OCR] Converted 2-digit year to 4-digit:', year);
                }
                
                // Try DD/MM/YYYY format (most common for receipts)
                if (day.length <= 2 && month.length <= 2) {
                  const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                  parsedDate = new Date(isoDate);
                  console.log('[OCR] Parsing as DD/MM/YYYY:', isoDate, '| Original:', dateString);
                } else {
                  // YYYY/MM/DD
                  parsedDate = new Date(dateString.replace(/\//g, '-'));
                  console.log('[OCR] Parsing as YYYY/MM/DD:', dateString.replace(/\//g, '-'));
                }
              } else {
                parsedDate = new Date(dateString);
                console.log('[OCR] Parsing as default (slash format):', dateString);
              }
            } else if (dateString.includes('-')) {
              parsedDate = new Date(dateString);
              console.log('[OCR] Parsing as ISO format:', dateString);
            } else {
              parsedDate = new Date(dateString);
              console.log('[OCR] Parsing as default:', dateString);
            }
            
            if (parsedDate && !isNaN(parsedDate.getTime())) {
              // Validate the date is reasonable (not too far in past/future)
              const currentYear = new Date().getFullYear();
              const dateYear = parsedDate.getFullYear();
              console.log('[OCR] Date validation - Year:', dateYear, '| Current year:', currentYear, '| Valid range: 2000 to', currentYear + 1);
              
              if (dateYear >= 2000 && dateYear <= currentYear + 1) {
                extracted.purchaseDate = parsedDate;
                console.log('[OCR] ✅ Date successfully extracted:', extracted.purchaseDate.toISOString(), '| Original:', dateString);
                break;
              } else {
                console.log('[OCR] ❌ Date parsing failed - year out of range:', dateYear, '| Date:', parsedDate.toISOString());
              }
            } else {
              console.log('[OCR] ❌ Date parsing failed - invalid date:', dateString, '| Parsed date:', parsedDate);
            }
          } catch (e: any) {
            console.error('[OCR] ❌ Date parsing exception:', e?.message || e, '| Stack:', e?.stack, '| Match:', match[0]);
          }
        }
      }
      
      if (extracted.purchaseDate) {
        console.log('[OCR] Date extraction completed at line', lineIndex + 1);
        break;
      }
    }
    
    // Log final date result
    if (extracted.purchaseDate) {
      console.log('[OCR] Final Purchase Date:', extracted.purchaseDate.toISOString());
    } else {
      console.log('[OCR] Purchase Date: Not found');
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
          console.log('[OCR] Total Amount extracted (pattern match):', extracted.totalAmount, 'from line:', line);
          break;
        }
      }
      // Also check for standalone large numbers at the end (likely total)
      const numberMatch = line.match(/\$?(\d+\.\d{2})/);
      if (numberMatch && !extracted.totalAmount) {
        const amount = parseFloat(numberMatch[1]);
        if (amount > 0 && amount < 100000) {
          extracted.totalAmount = amount;
          console.log('[OCR] Total Amount extracted (standalone number):', extracted.totalAmount, 'from line:', line);
        }
      }
      if (extracted.totalAmount) break;
    }
    
    // Log final total amount result
    if (extracted.totalAmount) {
      console.log('[OCR] Final Total Amount:', extracted.totalAmount);
    } else {
      console.log('[OCR] Total Amount: Not found');
    }

    // Extract items - look for header row with "Description", "Qty"/"Oty", "Price", "AMOUNT"
    const headerPatterns = [
      /description\s+qty\s+price\s+amount/i,
      /description\s+oty\s+price\s+amount/i,
      /description\s+qty\s+price/i,
      /description\s+oty\s+price/i,
      /desc\s+qty\s+price\s+amount/i,
      /desc\s+oty\s+price\s+amount/i,
      /desc\s+qty\s+price/i,
      /desc\s+oty\s+price/i,
      /description.*qty.*price.*amount/i,
      /description.*oty.*price.*amount/i,
      /description.*qty.*price/i,
      /description.*oty.*price/i,
    ];

    let headerIndex = -1;
    // Find the header row
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      for (const pattern of headerPatterns) {
        if (pattern.test(line)) {
          headerIndex = i;
          break;
        }
      }
      if (headerIndex !== -1) break;
    }

    // If header found, extract items from lines below it
    if (headerIndex !== -1) {
      const itemLines = lines.slice(headerIndex + 1);
      
      for (const line of itemLines) {
        // Stop if we hit a total, subtotal, or other summary line
        // Also stop at "powered by" sections (footer content)
        // Note: Don't stop on just "AMOUNT" as it might be part of item data
        // Stop on lines that start with TOTAL, SUBTOTAL, TAX, etc.
        if (
          line.match(/^(TOTAL|SUBTOTAL|TAX|GRAND\s+TOTAL|SUM|CASH|ITEM#)/i) ||
          line.match(/^\s*[-=_]+\s*$/) || // Separator lines
          line.match(/powered\s+by/i) || // Powered by sections
          line.match(/thank\s+you/i) || // Thank you messages (usually at end)
          line.match(/visit\s+us/i) || // Visit us messages (usually at end)
          (line.match(/SUBTOTAL|TXBL|TAX\d+|CASH|ITEM#/i) && !line.match(/^\w+\s+\d/)) // Summary lines that aren't items
        ) {
          break;
        }

        // Skip empty lines or very short lines
        if (line.trim().length < 2) {
          continue;
        }

        // Aggressively filter out non-item lines (addresses, phone numbers, metadata, etc.)
        const lowerLine = line.toLowerCase();
        if (
          // Skip address lines
          lowerLine.match(/h\.no|h\.\s*no|address|street|road|avenue|subcity|woreda|kebele/i) ||
          lowerLine.match(/\d+\/\d+.*[km]|city\s+mall|megenagna/i) ||
          // Skip phone/TEL lines
          lowerLine.match(/^tel|^phone|^\d{9,}/) ||
          lowerLine.match(/tel\s*:?\s*\d+/i) ||
          // Skip TIN lines
          lowerLine.match(/^tin|tin\s*:?\s*\d+/i) ||
          // Skip date lines
          lowerLine.match(/^date\s*:?\s*\d|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) ||
          // Skip reference/operator/waiter/table lines
          lowerLine.match(/^ref\s*:|^operator\s*:|^waiter\s*:|^table\s*:/i) ||
          lowerLine.match(/ref:\s*[a-z]+\-\d+/i) ||
          // Skip FS No, ERCA, etc.
          lowerLine.match(/^fs\s*no|^erca|^cash\s+invoice/i) ||
          // Skip lines that are mostly numbers or special characters
          line.match(/^[=\-_\s]+$/) ||
          // Skip lines that look like separators
          line.match(/^[=\-_\s]{3,}$/)
        ) {
          continue;
        }

        // Parse item line - typically format: "Item Name    Qty    Price    Amount"
        // Try multiple parsing strategies since OCR may not preserve column spacing perfectly
        
        let itemName = '';
        let quantity: number | undefined;
        let price: number | undefined;
        
        // Strategy 1: Try regex pattern matching first (works even with single spaces)
        // Pattern: ItemName Quantity Price (e.g., "NOLIN COFFEE 2 19.76")
        const itemPatternWithQty = /^(.+?)\s+(\d{1,3})\s+(\d+\.\d{2}|\d+\.\d+|\d+)/;
        let match = line.match(itemPatternWithQty);
        
        if (match) {
          const extractedName = match[1].trim();
          const extractedQty = parseInt(match[2]);
          const extractedPrice = parseFloat(match[3]);
          
          // Validate extracted values
          if (extractedName.length >= 3 && 
              extractedQty >= 1 && extractedQty <= 999 && 
              extractedPrice > 0 && extractedPrice < 1000000) {
            itemName = extractedName;
            quantity = extractedQty;
            price = extractedPrice;
            console.log('[OCR] Parsed via regex (with qty):', itemName, '| Qty:', quantity, '| Price:', price);
          }
        }
        
        // Strategy 2: If regex didn't work, try splitting by multiple spaces/tabs
        if (!quantity || !price) {
          const parts = line.split(/\s{2,}|\t+/).filter(p => p.trim().length > 0);
          
          if (parts.length >= 2) {
            // Find price/amount (last numeric value with decimal, prioritize decimals)
            let priceIndex = -1;
            let priceValue: number | undefined;
            
            // First, look for decimal numbers (prices usually have decimals)
            for (let i = parts.length - 1; i >= 1; i--) {
              const priceMatch = parts[i].match(/(\d+\.\d{2}|\d+\.\d+)/);
              if (priceMatch) {
                priceValue = parseFloat(priceMatch[1]);
                if (priceValue > 0 && priceValue < 1000000) {
                  priceIndex = i;
                  if (!price) price = priceValue;
                  break;
                }
              }
            }
            
            // Find quantity - it's usually the column before price
            if (priceIndex > 0 && !quantity) {
              // Check the column immediately before price
              const qtyBeforePrice = parts[priceIndex - 1];
              const qtyMatch = qtyBeforePrice.match(/^(\d{1,3})$/);
              if (qtyMatch) {
                const qtyValue = parseInt(qtyMatch[1]);
                if (qtyValue >= 1 && qtyValue <= 999) {
                  quantity = qtyValue;
                }
              }
            }
            
            // If quantity not found yet, search for it in other columns (before price)
            if (!quantity && priceIndex > 1) {
              for (let i = priceIndex - 1; i >= 1; i--) {
                const qtyMatch = parts[i].match(/^(\d{1,3})$/);
                if (qtyMatch) {
                  const qtyValue = parseInt(qtyMatch[1]);
                  if (qtyValue >= 1 && qtyValue <= 999 && (!price || qtyValue !== price)) {
                    quantity = qtyValue;
                    break;
                  }
                }
              }
            }
            
            // Determine item name - everything before quantity (or before price if no quantity)
            if (!itemName || itemName.length < 3) {
              let qtyColIndex = -1;
              if (quantity && priceIndex > 0) {
                for (let i = 1; i < priceIndex; i++) {
                  const qtyMatch = parts[i].match(/^(\d{1,3})$/);
                  if (qtyMatch && parseInt(qtyMatch[1]) === quantity) {
                    qtyColIndex = i;
                    break;
                  }
                }
              }
              
              if (qtyColIndex > 0) {
                itemName = parts.slice(0, qtyColIndex).join(' ').trim();
              } else if (priceIndex > 0) {
                itemName = parts.slice(0, priceIndex).join(' ').trim();
              } else {
                itemName = parts[0].trim();
              }
            }
          }
        }
        
        // Strategy 3: Extract from entire line using regex if still missing data
        if ((!quantity || !price || !itemName || itemName.length < 3)) {
          // Try to find quantity and price anywhere in the line
          const qtyMatch = line.match(/\b(\d{1,3})\b/);
          const priceMatch = line.match(/(\d+\.\d{2}|\d+\.\d+)/);
          
          if (priceMatch && !price) {
            const extractedPrice = parseFloat(priceMatch[1]);
            if (extractedPrice > 0 && extractedPrice < 1000000) {
              price = extractedPrice;
            }
          }
          
          if (qtyMatch && !quantity) {
            const extractedQty = parseInt(qtyMatch[1]);
            if (extractedQty >= 1 && extractedQty <= 999 && (!price || extractedQty !== price)) {
              // Make sure it's not part of the price
              const qtyPos = qtyMatch.index || 0;
              const pricePos = priceMatch?.index || line.length;
              // Quantity should appear before price
              if (qtyPos < pricePos) {
                quantity = extractedQty;
              }
            }
          }
          
          // Extract item name by removing quantity and price from the line
          if (!itemName || itemName.length < 3) {
            let cleanLine = line;
            if (quantity) {
              cleanLine = cleanLine.replace(new RegExp(`\\b${quantity}\\b`), '');
            }
            if (price) {
              cleanLine = cleanLine.replace(new RegExp(`\\b${price.toFixed(2)}\\b`), '');
              cleanLine = cleanLine.replace(new RegExp(`\\b${price}\\b`), '');
            }
            // Remove common suffixes and clean up
            cleanLine = cleanLine.replace(/[+\-%$]/g, '').trim();
            cleanLine = cleanLine.replace(/\s{2,}/g, ' ').trim();
            itemName = cleanLine;
          }
        }
        
        // Clean up item name - remove trailing numbers, special characters, etc.
        if (itemName) {
          // Remove trailing numbers that might be mistaken for quantity/price
          itemName = itemName.replace(/\s+\d+\.?\d*\s*$/, '').trim();
          // Remove trailing special characters
          itemName = itemName.replace(/[+\-%$|]+$/, '').trim();
          // Remove leading/trailing periods and commas
          itemName = itemName.replace(/^[.,;:\s]+|[.,;:\s]+$/g, '').trim();
        }
        
        // Final validation: Ensure quantity is reasonable if found
        if (quantity && (quantity < 1 || quantity > 999)) {
          console.log('[OCR] Invalid quantity ignored:', quantity, 'for item:', itemName);
          quantity = undefined; // Invalid quantity, ignore it
        }
        
        // Final validation: Ensure price is reasonable if found
        if (price && (price <= 0 || price >= 1000000)) {
          console.log('[OCR] Invalid price ignored:', price, 'for item:', itemName);
          price = undefined; // Invalid price, ignore it
        }

        // Log extracted values before validation
        if (itemName && itemName.length >= 3) {
          console.log('[OCR] Item extracted - Name:', itemName, '| Quantity:', quantity || 'N/A', '| Price:', price || 'N/A');
        }

        // CRITICAL: Only add items that have a price/amount (real items have prices)
        // Also validate that it looks like a product name, not metadata
        if (itemName.length >= 3 && itemName.length < 100 && price && price > 0) {
          // Additional filtering: skip if it looks like metadata
          const cleanItemName = itemName.toLowerCase();
          if (
            !cleanItemName.match(/description|qty|oty|price|total|amount|sum|tax|subtotal/i) &&
            !cleanItemName.match(/powered\s+by|thank\s+you|visit\s+us|website|www\.|http/i) &&
            !cleanItemName.match(/tin|tel|phone|date|ref|operator|waiter|table|fs\s*no|erca/i) &&
            !cleanItemName.match(/h\.no|address|street|subcity|woreda/i) &&
            !cleanItemName.match(/^\d+$/) && // Not just a number
            !cleanItemName.match(/^[=\-_\s]+$/) // Not just separators
          ) {
            const finalItemName = itemName.replace(/[^\w\s&'.-]/g, ' ').trim();
            extracted.items.push({
              name: finalItemName,
              quantity,
            });
            console.log('[OCR] Item added - Name:', finalItemName, '| Quantity:', quantity || 'N/A');
          } else {
            console.log('[OCR] Item filtered out (metadata):', itemName);
          }
        } else {
          if (itemName && itemName.length >= 3) {
            console.log('[OCR] Item skipped - missing price or invalid:', itemName, '| Price:', price);
          }
        }
      }
    } else {
      // Fallback: extract items without header (only if header not found)
      // This should rarely be used, but apply same strict filtering
      const itemPattern = /^(.+?)(?:\s+(\d+)\s*x?\s*)?(?:\$?(\d+\.?\d*))?$/;
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        
        // Aggressively skip non-item lines
        if (
          line.match(/TOTAL|AMOUNT|SUM|DATE|STORE|TAX|SUB|DESCRIPTION|QTY|OTY|PRICE/i) ||
          line.match(/powered\s+by|thank\s+you|visit\s+us|website|www\.|http/i) ||
          lowerLine.match(/tin|tel|phone|ref|operator|waiter|table|fs\s*no|erca/i) ||
          lowerLine.match(/h\.no|address|street|subcity|woreda|city\s+mall/i) ||
          lowerLine.match(/^date\s*:?\s*\d|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) ||
          line.match(/^[=\-_\s]+$/) ||
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

          console.log('[OCR] Fallback item extraction - Name:', name, '| Quantity:', quantity || 'N/A', '| Price:', price || 'N/A');

          // CRITICAL: Only add items with prices (real items have prices)
          const cleanName = name.toLowerCase();
          if (
            name.length >= 3 && 
            name.length < 80 &&
            price && price > 0 &&
            !cleanName.match(/powered\s+by|thank\s+you|visit\s+us|website|www\.|http/i) &&
            !cleanName.match(/tin|tel|phone|date|ref|operator|waiter|table|fs\s*no|erca/i) &&
            !cleanName.match(/h\.no|address|street|subcity|woreda/i) &&
            !cleanName.match(/^\d+$/)
          ) {
            extracted.items.push({
              name,
              quantity,
            });
            console.log('[OCR] Fallback item added - Name:', name, '| Quantity:', quantity || 'N/A');
          } else {
            console.log('[OCR] Fallback item filtered out:', name);
          }
        }
      }
    }

    // Final summary log
    console.log('[OCR] ===== Extraction Summary =====');
    console.log('[OCR] Store Name:', extracted.storeName || 'Not found');
    console.log('[OCR] Purchase Date:', extracted.purchaseDate || 'Not found');
    console.log('[OCR] Total Amount:', extracted.totalAmount || 'Not found');
    console.log('[OCR] Items Count:', extracted.items.length);
    extracted.items.forEach((item, index) => {
      console.log(`[OCR] Item ${index + 1}:`, item.name, '| Quantity:', item.quantity || 'N/A');
    });
    console.log('[OCR] ===============================');

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



