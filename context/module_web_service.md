# Module: web_service

## Overview

Oak-based web server implementing HTMX architecture with server-side rendering, state management, and real-time process streaming. Features a modular page system with action-based state transitions.

## File Structure

```
web_service/
├── server.ts                  # Oak app setup, routes, middleware
├── types/
│   └── index.ts              # TypeScript interfaces (CurrentState, FilterOption...)
├── core/
│   ├── process_base.ts       # Abstract base class for processes
│   ├── process_manager.ts    # Singleton process registry & streaming
│   ├── job_usecase.ts        # Base class for job usecases
│   └── config_manager.ts     # App configuration handling
├── pages/
│   ├── mod.ts               # Page imports (registers all pages)
│   └── page_registry.ts     # Page registry pattern
├── routes/
│   ├── jobs/
│   │   ├── page.ts          # Jobs list page with infinite scroll
│   │   └── components/
│   │       └── job_card.ts  # Job card component
│   ├── keywords/
│   │   └── page.ts          # Keywords analytics page
│   ├── processing/
│   │   ├── page.ts          # Process runner page
│   │   └── components/
│   │       ├── config_editor.ts
│   │       └── runner.ts
│   └── analysis/
│       ├── page.ts          # Charts/analytics page
│       └── chart_data.ts    # Chart data API
├── sidebar/
│   ├── state_manager.ts     # State parsing, serialization, actions
│   ├── filter_builder.ts    # Filter menu generation
│   ├── filter_config.ts     # Filter key definitions
│   ├── filter_keyword.ts    # Keyword filter menu
│   └── page_buttons.ts      # Navigation buttons
├── actions/
│   ├── action_types.ts      # Action type definitions
│   └── handlers.ts          # Action handlers (setPage, addFilter...)
└── usecases/
    ├── scrap_jobs_usecase.ts    # Scrap jobs process
    └── update_jobs_usecase.ts   # Update jobs process
```

## Key Features

| Feature           | Description                                       |
| ----------------- | ------------------------------------------------- |
| HTMX Architecture | Server-side rendering with HTMX for interactivity |
| State Management  | JSON-serialized state with action-based updates   |
| Process Streaming | SSE for real-time process logs                    |
| Page Registry     | Dynamic page registration system                  |
| Infinite Scroll   | HTMX intersect trigger for pagination             |
| Filter System     | Multi-facet filtering with rejected keywords      |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   HTMX       │  │    State     │  │   Event Listeners    │  │
│  │  (requests)  │  │   (hidden    │  │  (click, intersect)  │  │
│  │              │  │   input)     │  │                      │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────────┘  │
└─────────┼───────────────────────────────────────────────────────┘
          │ POST /api/action {state, action}
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Server (Oak)                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Router                                                   │  │
│  │  ├── POST /api/init      → Return initial components      │  │
│  │  ├── POST /api/action    → Apply action, return updates   │  │
│  │  ├── POST /api/loadMoreJobs → Infinite scroll rows        │  │
│  │  ├── GET  /api/process/stream/:id → SSE stream            │  │
│  │  └── POST /api/analysis/chart-data → Chart JSON           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Action Pipeline                                          │  │
│  │  parseState() → applyAction() → serializeState()          │  │
│  │                                                           │  │
│  │  Actions: setPage | addFilter | removeFilter |            │  │
│  │           clearFilters | setPageNumber                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Page Registry                                            │  │
│  │  registerPage() → buildPageContent(pageId, state)         │  │
│  │                                                           │  │
│  │  Pages: jobs | keywords | processing | analysis           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Process Manager (Singleton)                              │  │
│  │  ├── register(ScrapJobsUsecase)                           │  │
│  │  ├── register(UpdateJobsUsecase)                          │  │
│  │  ├── runProcess(id) → Promise<ProcessResult>              │  │
│  │  └── createProcessStream(id) → ReadableStream (SSE)       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Endpoint                   | Method | Description                          |
| -------------------------- | ------ | ------------------------------------ |
| `/api/init`                | POST   | Initialize app state & components    |
| `/api/action`              | POST   | Apply action, return state + content |
| `/api/loadMoreJobs`        | POST   | Get next page for infinite scroll    |
| `/api/refreshFilters`      | POST   | Update filter menus                  |
| `/api/process/run/:id`     | POST   | Run process (blocking)               |
| `/api/process/stream/:id`  | GET    | SSE stream for process logs          |
| `/api/process/kill/:id`    | POST   | Kill running process                 |
| `/api/analysis/chart-data` | POST   | Get chart data for analysis page     |
| `/api/job-config/:jobId`   | GET    | Get job-specific configuration       |
| `/api/job-config/:jobId`   | POST   | Save job-specific configuration      |

## State Management

```typescript
interface CurrentState {
  currentPage: string; // "jobs" | "keywords" | "processing" | "analysis"
  filters: Record<string, string[]>; // { status: ["new"], company: ["Google"] }
  pagination: {
    page: number;
    pageSize: number;
  };
  keywordPage: {
    sortedBy: "count" | "score";
  };
}
```

### State Flow

1. **Serialize**: State stored in hidden input as JSON
2. **Request**: HTMX includes state in POST body
3. **Parse**: Server deserializes state
4. **Action**: Handler applies action to produce new state
5. **Build**: Components rebuilt with new state
6. **Response**: JSON with state + HTML updates
7. **Update**: Client updates state input and DOM

## Action System

```typescript
// Action handlers map
type ActionHandler = (state: CurrentState, payload: unknown) => CurrentState;

const handlers: Record<string, ActionHandler> = {
  setPage: (state, page) => ({ ...state, currentPage: page }),
  addFilter: (state, { key, value }) => ({ ...state, filters: {...} }),
  removeFilter: (state, { key, value }) => ({ ...state, filters: {...} }),
  clearFilters: (state) => ({ ...state, filters: {} }),
};
```

## Page System

```typescript
interface Page {
  id: string; // Unique identifier
  name: string; // Display name
  icon: string; // FontAwesome class
  build(state: CurrentState): Promise<string>; // HTML generator
}

// Registration
registerPage({
  id: "jobs",
  name: "Jobs List",
  icon: "fa-list",
  build: buildJobsPage,
});
```

## Process System

```typescript
abstract class ProcessBase {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;

  abstract execute(): Promise<void>;

  // Logging with streaming support
  protected logInfo(message: string);
  protected logWarn(message: string);
  protected logError(message: string);

  // Run with result
  async run(): Promise<ProcessResult>;
}
```

### Streaming (SSE)

```
Client: GET /api/process/stream/scrap:hellowork
Server: data: {"type":"start","message":"Process starting..."}
        data: {"type":"log","level":"info","message":"Scraping...","timestamp":"..."}
        data: {"type":"complete","durationMs":12345}
```

## Response Format

```typescript
interface ApiResponse {
  state: string; // Serialized state
  mainContent?: string; // HTML for main content area
  oobUpdates?: {
    // Out-of-band updates
    target: string; // CSS selector
    html: string;
  }[];
  components?: {
    // Initial load
    stateDisplay: string;
    pageButtons: string;
    filters: string;
    keywordFilters: string;
  };
}
```
