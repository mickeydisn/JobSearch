# Module: utils

## Overview

Shared utility functions for the JobSearch application. Provides TF-IDF scoring, NLP keyword extraction, HTML cleaning, date parsing, and crypto/fetch helpers.

## File Structure

```
utils/
├── tfidf.ts           # TF-IDF score calculation
├── nlp.ts             # Natural language processing (keyword extraction)
├── html_cleaner.ts    # HTML processing (image sizing)
├── date_utils.ts      # Date parsing and normalization
├── crypto_and_fetch.ts # Cryptographic helpers and fetch wrapper
└── date_utils.ts      # Date utilities
```

## Key Features

| Feature            | Description                               |
| ------------------ | ----------------------------------------- |
| TF-IDF Scoring     | Term frequency-inverse document frequency |
| NLP Extraction     | Keyword extraction using compromise.js    |
| HTML Processing    | Image size limiting in job HTML           |
| Date Normalization | Multiple date format parsing              |
| Fetch Wrapper      | Enhanced fetch with retry logic           |

## TF-IDF (tfidf.ts)

Calculates relevance scores for keywords based on document frequency.

```typescript
function calculateTfIdfScores(
  jobKeywords: [string, number][], // [[keyword, frequency], ...]
  keywordFreqMap: Map<string, number>, // keyword -> doc count
  totalJobs: number // total documents
): [string, number][]; // [[keyword, score], ...]
```

### Algorithm

```
TF = keyword_frequency_in_job / total_keywords_in_job
IDF = log(total_jobs / (job_count_containing_keyword + 1))
TF-IDF = TF * IDF
```

### Usage

```typescript
import { calculateTfIdfScores } from "./utils/tfidf.ts";

const jobKeywords = [
  ["python", 5],
  ["react", 3],
  ["aws", 2],
];
const keywordFreqMap = new Map([
  ["python", 150],
  ["react", 200],
  ["aws", 300],
]);
const totalJobs = 1000;

const scores = calculateTfIdfScores(jobKeywords, keywordFreqMap, totalJobs);
// [["react", 0.015], ["python", 0.018], ["aws", 0.008]]
```

## NLP (nlp.ts)

Keyword extraction using compromise.js library.

```typescript
function extractKeywords(
  jobText: string,
  jobHtml: string,
  jobHead: string
): [string, number][]; // [[keyword, frequency], ...]
```

### Extraction Pipeline

1. **Normalize**: Lowercase, remove punctuation
2. **Tokenize**: Split into words
3. **Filter**: Remove stop words and short tokens
4. **N-grams**: Extract bigrams and trigrams
5. **Count**: Frequency count per keyword
6. **Sort**: By frequency descending

### Stop Words

```typescript
const STOPWORD = [
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "i",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  // ... 100+ common English words
];
```

### Usage

```typescript
import { extractKeywords } from "./utils/nlp.ts";

const keywords = extractKeywords(
  "We are looking for a senior Python developer with React experience",
  "<html>...</html>",
  "Senior Python Developer"
);
// [["python", 2], ["developer", 2], ["senior", 1], ["react", 1], ...]
```

## HTML Cleaner (html_cleaner.ts)

Processes job HTML to limit image sizes and sanitize content.

```typescript
function processJobHtmlImages(html: string): string;
```

### Features

- Limits images to max 100x100 pixels
- Removes script tags
- Preserves basic formatting

### Implementation

```typescript
export function processJobHtmlImages(html: string): string {
  if (!html) return "";

  return html
    .replace(/<img([^>]*)>/gi, (match, attrs) => {
      // Add size constraints to images
      const width = attrs.match(/width="?(\d+)"?/);
      const height = attrs.match(/height="?(\d+)"?/);

      let newAttrs = attrs;
      if (!width || parseInt(width[1]) > 100) {
        newAttrs += ' width="100"';
      }
      if (!height || parseInt(height[1]) > 100) {
        newAttrs += ' height="100"';
      }

      return `<img${newAttrs}>`;
    })
    .replace(/<script[^>]*>.*?<\/script>/gi, "");
}
```

## Date Utils (date_utils.ts)

Date parsing and normalization for various formats.

```typescript
function cleanDate(dateStr: string, fallbackDate: string): string;
function parseRelativeDate(text: string): Date | null;
```

### Supported Formats

| Format           | Example         |
| ---------------- | --------------- |
| ISO 8601         | 2024-01-15      |
| French relative  | il y a 3 jours  |
| English relative | 3 days ago      |
| Month Year       | January 2024    |
| French month     | 15 janvier 2024 |

### Usage

```typescript
import { cleanDate } from "./utils/date_utils.ts";

const normalized = cleanDate("il y a 3 jours", "2024-01-15");
// "2024-01-12"
```

## Crypto & Fetch (crypto_and_fetch.ts)

Enhanced fetch with retry logic and crypto helpers.

```typescript
// Fetch with retry
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries?: number
): Promise<Response>;

// Hash generation
function generateId(input: string): string;
function hashString(input: string): string;
```

### Fetch Retry

```typescript
const response = await fetchWithRetry(
  "https://api.example.com/jobs",
  { headers: { Accept: "application/json" } },
  3 // retry 3 times
);
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Scraper                                │
│                      (scrap_tools)                          │
└──────────────────┬──────────────────────────────────────────┘
                   │ job content
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      NLP Processing                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Tokenize   │─▶│  Filter     │─▶│  Count Frequency    │  │
│  │  (compromise│  │  (stopwords)│  │  (keyword, count)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────┬──────────────────────────────────────────┘
                   │ jobKeywords: [string, number][]
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      TF-IDF Calculation                     │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │  Load keyword   │  │  Calculate TF * IDF for each    │   │
│  │  frequencies    │  │  keyword                        │   │
│  │  (from DB)      │  │  → jobKeywordScore              │   │
│  └─────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Integration Example

```typescript
import { extractKeywords } from "./utils/nlp.ts";
import { calculateTfIdfScores } from "./utils/tfidf.ts";
import { processJobHtmlImages } from "./utils/html_cleaner.ts";
import { cleanDate } from "./utils/date_utils.ts";

// Process raw job data
function processJob(rawJob: JobsRawType, context: ScraperContext): JobsEtlType {
  // 1. Clean HTML
  const processedHtml = processJobHtmlImages(rawJob.jobHtml);

  // 2. Extract keywords
  const jobKeywords = extractKeywords(
    rawJob.jobText,
    processedHtml,
    rawJob.jobHead
  );

  // 3. Calculate TF-IDF scores
  const jobKeywordScore = calculateTfIdfScores(
    jobKeywords,
    context.keywordFreqMap,
    context.totalJobs
  );

  // 4. Clean date
  const dateClean = cleanDate(rawJob.date, rawJob.createAt);

  return {
    ...rawJob,
    jobHtml: processedHtml,
    jobKeywords,
    jobKeywordScore,
    dateClean,
  };
}
```
