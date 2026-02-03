/**
 * Google Sheets Service
 * Fetches news headlines from a published Google Sheet CSV
 */

import fetch from 'node-fetch';

// Cache for Google Sheets data
let sheetsCache = null;
let sheetsCacheTime = null;
const SHEETS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Parse CSV string into array of objects
 * Handles quoted fields and commas within quotes
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Normalize headers (lowercase, remove spaces)
  const normalizedHeaders = headers.map(h =>
    h.toLowerCase().trim().replace(/\s+/g, '_')
  );

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row = {};
    normalizedHeaders.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current); // Don't forget last value

  return values;
}

/**
 * Transform raw CSV row into structured news object
 */
function transformToNewsItem(row, index) {
  // Expected columns: headline, source, url, timestamp/date
  // Flexible mapping to handle various column names
  const headline = row.headline || row.title || row.news || row.alert || '';
  const source = row.source || row.publisher || row.from || 'Google Alert';
  const url = row.url || row.link || '';

  // Parse timestamp - try multiple formats (including "date_&_time" from "Date & Time" column)
  let timestamp = row['date_&_time'] || row.date_time || row.timestamp || row.date || row.time || row.published || '';
  let parsedDate = new Date(timestamp);

  // If parsing failed, try to extract from URL or use current time
  if (isNaN(parsedDate.getTime())) {
    parsedDate = new Date();
  }

  // Generate unique ID
  const id = `gs-${parsedDate.getTime()}-${index}`;

  // Calculate relative time
  const relativeTime = getRelativeTime(parsedDate);

  return {
    id,
    headline: headline.trim(),
    source: source.trim(),
    url: url.trim(),
    timestamp: parsedDate.toISOString(),
    relativeTime,
    // These will be filled by AI analysis
    summary: '',
    category: 'General',
    impact: 'LOW',
    bias: 'neutral',
    symbols: [],
    affectedInstruments: [],
    relevance: 0,
    timeframe: 'intraday',
    isAnalyzed: false
  };
}

/**
 * Calculate relative time string (e.g., "5 mins ago")
 */
function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/**
 * Fetch news headlines from Google Sheets
 * @returns {Promise<Array>} Array of news items
 */
export async function fetchGoogleSheetsNews() {
  const csvUrl = process.env.GOOGLE_SHEET_CSV_URL;

  if (!csvUrl) {
    console.warn('GOOGLE_SHEET_CSV_URL not configured');
    return [];
  }

  const now = Date.now();

  // Return cached data if still valid
  if (sheetsCache && sheetsCacheTime && (now - sheetsCacheTime) < SHEETS_CACHE_DURATION) {
    console.log('Returning cached Google Sheets data');
    return sheetsCache;
  }

  try {
    console.log('Fetching news from Google Sheets...');

    const response = await fetch(csvUrl, {
      headers: {
        'Accept': 'text/csv'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Sheet: ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    // Transform to news items
    const newsItems = rows
      .map((row, index) => transformToNewsItem(row, index))
      .filter(item => item.headline && item.headline.length > 10) // Filter empty/invalid
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Newest first
      .slice(0, 50); // Limit to 50 items

    console.log(`Fetched ${newsItems.length} news items from Google Sheets`);

    // Cache results
    sheetsCache = newsItems;
    sheetsCacheTime = now;

    return newsItems;
  } catch (error) {
    console.error('Google Sheets fetch error:', error.message);

    // Return cached data on error if available
    if (sheetsCache) {
      console.log('Returning stale cache due to fetch error');
      return sheetsCache;
    }

    return [];
  }
}

/**
 * Clear the Google Sheets cache (for force refresh)
 */
export function clearGoogleSheetsCache() {
  sheetsCache = null;
  sheetsCacheTime = null;
  console.log('Google Sheets cache cleared');
}

/**
 * Get cache status
 */
export function getGoogleSheetsCacheStatus() {
  return {
    isCached: !!sheetsCache,
    itemCount: sheetsCache?.length || 0,
    cacheAge: sheetsCacheTime ? Date.now() - sheetsCacheTime : null,
    maxAge: SHEETS_CACHE_DURATION
  };
}
