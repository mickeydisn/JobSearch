# Module: api_sqlite

## Overview

SQLite database layer with schema definition, type-safe tables, and ETL processing. Implements a TableNode pattern for CRUD operations with JSON serialization support for complex types.

## File Structure

```
api_sqlite/
├── db.ts                   # Database connection and field definitions
├── table.ts                # Base TableNode class with CRUD operations
├── table_jobs_raw.ts       # Raw job data from scrapers
├── table_jobs.ts           # ETL-processed jobs with keywords/TF-IDF
├── table_keyword_frequency.ts  # Keyword document frequency for TF-IDF
└── stopword.ts             # Stop words list for NLP
```

## Key Features

| Feature        | Description                                          |
| -------------- | ---------------------------------------------------- |
| TableNode      | Base class providing CRUD, search, and serialization |
| Schema DSL     | Declarative field definitions with types and indexes |
| JSON Fields    | Automatic serialization for arrays/objects           |
| ETL Pipeline   | Transform raw → processed with keyword extraction    |
| TF-IDF Storage | keyword_frequency table for document frequency       |

## Table Schema

### jobs_raw

Raw job data as scraped from sources.

| Field    | Type   | Description                          |
| -------- | ------ | ------------------------------------ |
| id       | TEXT   | Primary key (source-specific)        |
| createAt | TEXT   | ISO timestamp                        |
| scraper  | TEXT   | Source name (linkedin, hellowork...) |
| title    | TEXT   | Job title                            |
| link     | TEXT   | URL to job posting                   |
| loc      | TEXT   | Location string                      |
| tag      | TEXT[] | Tags/labels as array                 |
| contract | TEXT   | Contract type                        |
| company  | TEXT   | Company name                         |
| date     | TEXT   | Posting date                         |
| jobHead  | TEXT   | Job header/description start         |
| jobText  | TEXT   | Plain text content                   |
| jobHtml  | TEXT   | HTML content                         |

### jobs_etl

Processed jobs with extracted keywords and TF-IDF scores.

| Field           | Type            | Description                       |
| --------------- | --------------- | --------------------------------- |
| id              | TEXT            | Primary key                       |
| createAt        | TEXT            | ISO timestamp                     |
| scraper         | TEXT            | Source name                       |
| updateAt        | TEXT            | Last update timestamp             |
| status          | TEXT            | Job status                        |
| title           | TEXT            | Job title                         |
| link            | TEXT            | URL                               |
| loc             | TEXT            | Location                          |
| tag             | TEXT            | Tags as string                    |
| contract        | TEXT            | Contract type                     |
| company         | TEXT            | Company name                      |
| date            | TEXT            | Posting date                      |
| jobHead         | TEXT            | Header text                       |
| jobText         | TEXT            | Plain text                        |
| jobHtml         | TEXT            | Processed HTML (images limited)   |
| titleKey        | TEXT[]          | Keywords from title               |
| dateClean       | TEXT            | Normalized date                   |
| jobKeywords     | [string, num][] | Extracted keywords with frequency |
| jobKeywordScore | [string, num][] | TF-IDF scores                     |
| iaKeywordsW5a   | TEXT[]          | AI-extracted keywords             |
| iaScoreW5a      | INTEGER         | AI relevance score                |
| iaScoreW6a      | INTEGER         | Secondary AI score                |
| userTag         | TEXT            | User-defined tags                 |

### keyword_frequency

Document frequency for TF-IDF calculation.

| Field    | Type | Description                     |
| -------- | ---- | ------------------------------- |
| keyword  | TEXT | Primary key (lowercase keyword) |
| docCount | INT  | Number of jobs containing word  |

## TableNode Base Class

```typescript
abstract class TableNode<T> {
  abstract tableName: string;
  static schema: Record<string, FieldDefinition>;
  static fields: string[];

  async save(doc: T): Promise<void>;
  async get(id: string): Promise<T | null>;
  async exists(id: string): boolean;
  async search(filters: Record, limit?: number, offset?: number): Promise<T[]>;
  async delete(id: string): Promise<void>;
  async count(filters?: Record): Promise<number>;

  // Override for ETL transformations
  etlJob(doc: T): T;
}
```

## Field Definition DSL

```typescript
type FieldDefinition = {
  type: "TEXT" | "INTEGER" | "REAL";
  primaryKey?: boolean;
  notNull?: boolean;
  index?: boolean;
  default?: string | number;
};

// Example schema
static override schema = {
  id: { type: "TEXT", primaryKey: true, notNull: true },
  company: { type: "TEXT", index: true },
  jobKeywords: { type: "TEXT" }, // Stored as JSON
};
```

## ETL Pipeline

```
┌─────────────┐     ┌─────────────────────────────────────┐     ┌─────────────┐
│  jobs_raw   │────▶│  JobsEtl.fromRaw() → etlJob()       │────▶│  jobs_etl   │
│  (source)   │     │  - Extract keywords (NLP)           │     │ (processed) │
└─────────────┘     │  - Clean dates                      │     └─────────────┘
                    │  - Limit image sizes                │
                    │  - Calculate TF-IDF                 │
                    └─────────────────────────────────────┘
```

## Query Patterns

### Search with Filters

```typescript
const jobs = await jobsEtl.search(
  { status: "new", company: ["Google", "Meta"] },
  100, // limit
  0 // offset
);
```

### Aggregate Keywords

```typescript
// Get top keywords with counts and average TF-IDF scores
const keywords = await jobsEtl.aggJobKeywordScore({ status: "new" }, 100);
// Returns: [keyword, count, avgScore][]
```

### JSON Serialization

Array and object fields are automatically serialized:

```typescript
// Saved as JSON string in DB
{
  jobKeywords: [
    ["python", 5],
    ["react", 3],
  ];
}
// → "[[\"python\",5],[\"react\",3]]"

// Deserialized on read
// → [["python", 5], ["react", 3]]
```

## Usage Example

```typescript
import { JobsRaw } from "./api_sqlite/table_jobs_raw.ts";
import { JobsEtl } from "./api_sqlite/table_jobs.ts";

const raw = new JobsRaw();
const etl = new JobsEtl();

// Insert raw job
await raw.save({ id: "123", title: "Developer", ... });

// Transform and save ETL
const etlJob = etl.fromRaw(rawJob);
await etl.save(etlJob);

// Search with rejected keywords
const jobs = await etl.search({
  status: "new",
  rejectedKeywords: ["senior", "lead"]  // Excludes jobs with these keywords
}, 50);
```
