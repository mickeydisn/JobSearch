# JobSearch Project

A Deno-based job search application that scrapes job listings from multiple sources, processes them, and provides a web interface for analysis.

## Installation

### Prerequisites

- [Deno](https://deno.com/manual/getting_started/installation) (version 1.40 or higher)
- Git (for cloning the repository)

### 1. Clone the Repository

```bash
git clone https://github.com/mickeydisn/JobSearch.git
cd JobSearch
```

### 2. Install Dependencies

The project uses Deno's built-in dependency management. Install dependencies by caching the main server file:

```bash
deno cache --reload web_service/server.ts
```

### 3. Initialize the Project

Before running the application for the first time, initialize the project:

```bash
deno task init
```

This will:
- Create the `data/` directory
- Initialize all required database tables
- Display setup information

### 4. Start the Development Server

```bash
deno task dev
```

The server will start on http://localhost:8080

### 5. Use the Application

1. Open http://localhost:8080 in your browser
2. Navigate to the "Processing" page to scrape jobs
3. View scraped jobs in the "Jobs List" page
4. Analyze keywords and trends in the "Keywords" and "Job Analysis" pages

## Available Commands

- `deno task dev` - Start development server
- `deno task init` - Initialize project (create database tables)
- `deno task check` - Type check the project
- `deno task generate:page` - Generate page files

## Project Structure

- `api_sqlite/` - Database layer with SQLite tables
- `scrap_tools/` - Job scraping modules for different sites
- `web_service/` - Deno Oak web server and API
- `web/` - Frontend HTML, CSS, and JavaScript
- `scripts/` - Utility scripts including initialization
- `data/` - SQLite database file (created on first run)

## Database Tables

The application uses SQLite with the following tables:
- `jobs_raw` - Raw scraped job data
- `jobs_etl` - Processed job data with keywords and analysis
- `jobs_save` - Saved jobs
- `keywords` - Keyword definitions
- `keyword_frequency` - Keyword frequency data
- `filter_profile` - User filter configurations

## Scraping Sources

Currently supports scraping from:
- LinkedIn
- HelloWork
- Welcome to the Jungle

## Technologies

- **Backend**: Deno with Oak framework
- **Database**: SQLite
- **Frontend**: HTML, CSS, JavaScript with HTMX
- **NLP**: Natural language processing for keyword extraction
- **Scraping**: Custom scrapers for job boards

## Troubleshooting

If you encounter issues:

1. **Database errors**: Run `deno task init` to recreate database tables
2. **Missing dependencies**: Run `deno cache --reload web_service/server.ts` to refresh dependencies
3. **Port conflicts**: The server runs on port 8080 by default

## License

MIT