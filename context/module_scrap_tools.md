# Module: scrap_tools

## Overview

Scraping infrastructure for job aggregation. Implements a registry pattern for managing multiple scrapers with a shared base class providing common functionality like duplicate detection and TF-IDF calculation.

## File Structure

```
scrap_tools/
├── base_scraper.ts      # Abstract base class with saveJobIfNew() logic
├── scraper_registry.ts  # Registry pattern for scraper management
├── mod.ts              # Main exports and enabled scraper retrieval
├── linkedin.ts         # LinkedIn job scraper
├── hellowork.ts        # HelloWork job scraper
└── welcome.ts          # Welcome to the Jungle scraper
```

## Key Features

| Feature          | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| Base Scraper     | Abstract class with duplicate detection and dual-table insertion   |
| TF-IDF Context   | Pre-loaded keyword frequencies for real-time scoring during scrape |
| Registry Pattern | Dynamic scraper registration with enabled/disabled configuration   |
| Deduplication    | jobExists() check prevents duplicate entries across sources        |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Scraper Context                      │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │ keywordFreqMap  │  │ totalJobs (for IDF calc)    │   │
│  │ (Map<string, n>)│  │ (number)                    │   │
│  └────────┬────────┘  └─────────────────────────────┘   │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────────────────────────┐    │
│  │           BaseScraper (abstract)                │    │
│  │  ┌───────────────┐  ┌────────────────────────┐  │    │
│  │  │ jobExists()   │  │ saveJobIfNew()         │  │    │
│  │  │ jobsRaw.exists│  │ → jobsRaw.save()       │  │    │
│  │  └───────────────┘  │ → jobsEtl.save()       │  │    │
│  │                     │ → TF-IDF calculation   │  │    │
│  │                     └────────────────────────┘  │    │
│  └───────────────────────────┬─────────────────────┘    │
│                              │                          │
│         ┌────────────────────┼────────────────────┐     │
│         ▼                    ▼                    ▼     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐│
│  │   LinkedIn  │     │  HelloWork  │     │   Welcome   ││
│  │   Scraper   │     │   Scraper   │     │   Scraper   ││
│  │  (scrape()) │     │  (scrape()) │     │  (scrape()) ││
│  └─────────────┘     └─────────────┘     └─────────────┘│
└─────────────────────────────────────────────────────────┘
```

## Class Hierarchy

### BaseScraper

```typescript
abstract class BaseScraper {
  protected jobsRaw: JobsRaw;
  protected jobsEtl: JobsEtl;
  protected context: ScraperContext;

  protected jobExists(jobId: string): boolean;
  protected async saveJobIfNew(rawJob: JobsRawType): Promise<boolean>;
  abstract scrape(): Promise<void>;
}
```

### ScraperContext

Passed to all scrapers containing pre-calculated TF-IDF data:

```typescript
interface ScraperContext {
  keywordFreqMap: Map<string, number>; // keyword -> document frequency
  totalJobs: number; // total jobs for IDF calculation
}
```

## Scraper Registry

```typescript
// Registration (automatic via decorator/import)
registerScraper(LinkedInScraper);
registerScraper(HelloWorkScraper);
registerScraper(WelcomeScraper);

// Usage
const enabled = getEnabledScrapers(); // Filtered by app_configuration.json
const scraper = getScraper("linkedin"); // Get specific scraper
```

## Configuration (app_configuration.json)

```json
{
  "scrap_jobs": {
    "hellowork": {
      "enabled": true,
      "pages": 3,
      "delayBetweenRequests": 3,
      "searchKeywords": ["data engineer", "platform engineer"],
      "filters": { "location": "Paris", "radius": 20 }
    },
    "linkedin": { ... },
    "welcome": { ... }
  }
}
```

## Data Flow

1. **Load Context**: Usecase loads keyword frequencies and total job count
2. **Scrape**: Each scraper fetches jobs from its source
3. **Deduplicate**: Check if job exists in `jobs_raw` table
4. **Transform**: Convert raw job to ETL format
5. **Score**: Calculate TF-IDF scores for extracted keywords
6. **Save**: Insert into both `jobs_raw` and `jobs_etl` tables

## Adding a New Scraper

1. Create class extending `BaseScraper`
2. Implement `scrape()` method
3. Call `saveJobIfNew()` for each job found
4. Register in `mod.ts`
5. Add configuration to `app_configuration.json`

```typescript
class NewScraper extends BaseScraper {
  async scrape(): Promise<void> {
    const jobs = await fetchJobsFromSource();
    for (const job of jobs) {
      await this.saveJobIfNew(job);
    }
  }
}
```
