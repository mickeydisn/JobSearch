# JobSearch Project Overview

JobSearch is a comprehensive job aggregation and management platform built with Deno, Oak, SQLite, and HTMX. It automatically scrapes job listings from multiple sources, indexes them with TF-IDF scoring, and provides a web interface for browsing and filtering.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           JobSearch Architecture                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │  LinkedIn   │  │ HelloWork   │  │   Welcome   │  Scrapers (scrap_tools) │
│  │   Scraper   │  │   Scraper   │  │   Scraper   │                         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                         │
│         └─────────────────┼─────────────────┘                               │
│                           ▼                                                 │
│              ┌─────────────────────────┐                                    │
│              │     BaseScraper         │                                    │
│              │  (TF-IDF calculation)   │                                    │
│              └───────────┬─────────────┘                                    │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │                    Data Layer (api_sqlite)              │               │
│  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐  │               │
│  │  │  jobs_raw    │ │  jobs_etl    │ │keyword_frequency│  │               │
│  │  │  (raw data)  │ │ (processed)  │ │   (TF-IDF)      │  │               │
│  │  └──────────────┘ └──────────────┘ └─────────────────┘  │               │
│  └──────────────────────────┬──────────────────────────────┘               │
│                             ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │              Web Service (web_service)                  │               │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐ │               │
│  │  │   Jobs    │ │ Keywords  │ │Processing │ │ Analysis │ │  Pages        │
│  │  │   Page    │ │   Page    │ │   Page    │ │   Page   │ │               │
│  │  └───────────┘ └───────────┘ └───────────┘ └──────────┘ │               │
│  │  ┌─────────────────────────────────────────────────────┐│               │
│  │  │        Process Manager (scrap/update jobs)          ││               │
│  │  └─────────────────────────────────────────────────────┘│               │
│  │  ┌─────────────────────────────────────────────────────┐│               │
│  │  │       State Manager (filters, pagination)           ││               │
│  │  └─────────────────────────────────────────────────────┘│               │
│  └──────────────────────────┬──────────────────────────────┘               │
│                             ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │                   Frontend (web)                        │               │
│  │  ┌────────────┐ ┌──────────────┐ ┌─────────────────┐   │               │
│  │  │  HTMX SPA  │ │ Chart.js     │ │ Vanilla JS      │   │               │
│  │  │  (actions) │ │ (analysis)   │ │ (state/stream)  │   │               │
│  │  └────────────┘ └──────────────┘ └─────────────────┘   │               │
│  └─────────────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module Overview

| Module                                 | Description                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| [scrap_tools](./module_scrap_tools.md) | Job scrapers for LinkedIn, HelloWork, Welcome with base class and registry pattern    |
| [api_sqlite](./module_api_sqlite.md)   | SQLite database layer with tables for raw jobs, ETL jobs, and keyword frequencies     |
| [web_service](./module_web_service.md) | Oak-based web server with HTMX frontend, state management, and process orchestration  |
| [web](./module_web.md)                 | Frontend assets: HTMX SPA, CSS components, vanilla JS for streaming and charts        |
| [utils](./module_utils.md)             | Shared utilities: TF-IDF scoring, NLP keyword extraction, HTML cleaning, date parsing |

## Tech Stack

- **Runtime**: Deno (TypeScript)
- **Web Framework**: Oak
- **Database**: SQLite
- **Frontend**: HTMX + Vanilla JS + CSS Variables
- **Visualization**: Chart.js
- **NLP**: compromise.js for keyword extraction

## Quick Start

```bash
# Initialize database
deno run --allow-all tasks/db_init.ts

# Import data
deno run --allow-all tasks/data_import.ts

# Start server
deno run --allow-all web_service/server.ts
```

## Key Features

- **Multi-source Scraping**: LinkedIn, HelloWork, Welcome to the Jungle
- **TF-IDF Scoring**: Keyword relevance scoring based on document frequency
- **Real-time Processing**: SSE streaming for job scraping and updates
- **Interactive Filters**: Dynamic filtering by status, location, company, keywords
- **Visual Analytics**: Chart.js dashboards for job analysis
- **Infinite Scroll**: HTMX-powered pagination for job listings

## Data Flow

1. **Scrape**: Jobs scraped from sources → stored in `jobs_raw`
2. **ETL**: Raw jobs processed with NLP keyword extraction → stored in `jobs_etl`
3. **Index**: Keyword frequencies calculated for TF-IDF scoring
4. **Serve**: Web interface provides filtering, sorting, and analysis
