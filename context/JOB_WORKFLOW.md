# Job Workflow Documentation

## Overview
The JobSearch project implements a daily ETL pipeline that scrapes jobs from multiple sources, stores raw data, and transforms it into filtered ETL tables for user consumption.

---

## Daily Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DAILY ETL PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │   SCRAP     │     │     RAW      │     │     ETL      │
   │   (Step 1)  │ ──► │   (Step 2)   │ ──► │   (Step 3)   │
   └──────────────┘     └──────────────┘     └──────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │  Scraper     │     │  jobs_raw    │     │  jobs_etl    │
   │  Registry    │     │  Table       │     │  Table       │
   │              │     │              │     │              │
   │ - HelloWork  │     │ Raw scraped  │     │ Filtered &   │
   │ - LinkedIn   │     │ data with    │     │ scored jobs  │
   │ - Welcome    │     │ NLP keywords │     │ with TF-IDF  │
   └──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                           ┌─────────────────────┘
                           ▼
                    ┌──────────────┐
                    │ keyword_     │
                    │ frequency    │
                    │ Table        │
                    └──────────────┘
```

---

## Step-by-Step Process

### Step 1: SCRAP (ScrapJobsUsecase)
**File:** `web_service/usecases/scrap_jobs_usecase.ts`

- Loads keyword frequencies from existing ETL jobs for TF-IDF calculation
- Runs enabled scrapers (HelloWork, LinkedIn, Welcome to the Jungle)
- Each scraper:
  1. Searches jobs by keywords (config: `app_configuration.json`)
  2. Extracts job details (title, company, description, location, etc.)
  3. Saves new jobs to `jobs_raw` table
  4. Saves to JSON files (`data/jobs_raw.ljson`)

**Scraper Files:**
- `scrap_tools/base_scraper.ts` - Base class for all scrapers
- `scrap_tools/hellowork.ts` - HelloWork scraper
- `scrap_tools/linkedin.ts` - LinkedIn scraper
- `scrap_tools/welcome.ts` - Welcome to the Jungle scraper

---

### Step 2: RAW (JobsRaw Table)
**File:** `api_sqlite/table_jobs_raw.ts`

**Schema:** `id`, `createAt`, `scraper`, `updateAt`, `status`, `title`, `link`, `loc`, `tag`, `contract`, `entrepriseLinks`, `date`, `jobHead`, `jobText`, `jobHtml`, `company`, `titleKey`, `dateClean`

**ETL Processing:**
- Extracts company from title
- Extracts keywords from title using NLP (stemming: English + French)
- Cleans and normalizes date format

---

### Step 3: UPDATE (UpdateJobsUsecase)
**File:** `web_service/usecases/update_jobs_usecase.ts`

**5-Step ETL Rebuild Process:**

1. **Step 1:** Drop existing `jobs_etl` and `keyword_frequency` tables
2. **Step 2:** Create fresh `jobs_etl` table
3. **Step 3:** Process raw jobs:
   - Filter by date (config: `created_at_after`)
   - Exclude by status/tags (config: `exclude_status`, `exclude_tag`)
   - Transform using ETL (NLP keyword extraction)
   - Insert into `jobs_etl` table
4. **Step 4:** Build `keyword_frequency` table:
   - Aggregate keywords from all ETL jobs
   - Count frequency and job count per keyword
   - Skip keywords appearing in < 5 jobs
5. **Step 5:** Calculate TF-IDF scores:
   - For each job, calculate TF-IDF scores for keywords
   - Update `jobKeywordScore` field in `jobs_etl`

---

## User Interaction

### Web Interface
The user interacts through a web UI with these main pages:

1. **Jobs List Page** (`web_service/routes/jobs/page.ts`)
   - Displays filtered job listings
   - Infinite scroll for pagination
   - Click to view job details

2. **Processing Page** (`web_service/routes/processing/page.ts`)
   - Job selector dropdown
   - Configuration editor
   - Run/Stop buttons
   - Real-time log output

3. **Filter Sidebar** (`web_service/sidebar/`)
   - Filter by keywords, location, company, etc.
   - Rejected keywords filtering
   - Filter profile management

### User Actions (`web/js/actions.js`)
- `setPage` - Navigate between pages
- `addFilter` / `removeFilter` / `toggleFilter` - Manage filters
- `clearFilters` - Reset all filters
- `saveFilterProfile` - Save filter configuration
- `applyFilterProfile` - Load saved filters

### API Handlers (`web_service/actions/handlers.ts`)
- Processes user actions
- Returns updated state and UI content

---

## Configuration

**File:** `app_configuration.json`

```json
{
  "scrap_jobs": {
    "hellowork": { "enabled": true, "pages": 4, "searchKeywords": [...] },
    "linkedin": { "enabled": true, "pages": 4, "searchKeywords": [...] },
    "welcome": { "enabled": true, "pages": 4, "searchKeywords": [...] }
  },
  "update_jobs": {
    "filter": {
      "created_at_after": "2026-02-09",
      "exclude_status": [],
      "exclude_tag": []
    }
  }
}
```

---

## Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `jobs_raw` | Raw scraped data | `id`, `title`, `jobText`, `titleKey` |
| `jobs_etl` | Filtered & scored jobs | `id`, `jobKeywordScore`, `iaScoreW5a`, `userTag` |
| `keyword_frequency` | TF-IDF base data | `keyword`, `frequency`, `job_count` |
| `filter_profile` | Saved user filters | `name`, `filters` |

---

## Key Code References

| Component | File Path |
|-----------|-----------|
| Scrap Use Case | `web_service/usecases/scrap_jobs_usecase.ts` |
| Update Use Case | `web_service/usecases/update_jobs_usecase.ts` |
| Jobs Raw Table | `api_sqlite/table_jobs_raw.ts` |
| Jobs ETL Table | `api_sqlite/table_jobs.ts` |
| Keyword Frequency | `api_sqlite/table_keyword_frequency.ts` |
| Base Scraper | `scrap_tools/base_scraper.ts` |
| Scraper Registry | `scrap_tools/scraper_registry.ts` |
| Processing UI | `web_service/routes/processing/components/runner.ts` |
| Jobs Page | `web_service/routes/jobs/page.ts` |
| Filter Sidebar | `web_service/sidebar/` |
| User Actions | `web/js/actions.js` |
| App Config | `app_configuration.json` |
