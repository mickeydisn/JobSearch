# Job List Pipeline

## Overview

The job list displays jobs based on a source filter. Each source has specific behavior for querying and displaying jobs.

## Infinite Scroll (loadMoreJobs)

The job list uses infinite scroll to load more jobs as the user scrolls. When loading more jobs, the current application state (including filters) must be preserved.

### State Management for Infinite Scroll

The state is managed through multiple layers to ensure filters are properly applied:

1. **Server-side state**: The server sends the full state (including filters) with each response
2. **Hidden input field**: A hidden `#state-input` field stores the serialized state in the DOM (both as `value` and `data-state` attribute)
3. **Frontend priority**: When making requests:
   - First: State from `data-state` attribute (base64 encoded)
   - Second: State from `value` attribute (JSON string)
   - Third: In-memory `currentState` (fallback)

### How Pagination Works

1. **Initial Load**: Server returns page 1 with hx-vals containing page 1
2. **Client Updates**: After receiving rows, client parses hx-vals and updates:
   - Global `currentState` via `setState()`
   - Hidden input field (`#state-input`) with new page number
3. **Next Scroll**: Client reads state from DOM, sends to server with current page
4. **Server Response**: Server returns rows with hx-vals containing page+1
5. **Client Updates**: Repeat from step 2

**Important**: The page increment happens client-side in `buildMoreJobsRows()` - the server does NOT increment the page. This ensures proper synchronization between client and server.

### API Details

- **Endpoint**: `POST /api/loadMoreJobs`
- **Content-Type**: `application/json`
- **Request body**: `{ "state": { ... } }` - includes filters and pagination
- **Response**: HTML fragments (new job rows) with hx-vals containing next page number

### How It Works

1. When the page loads, the server sends the full state (including active filters) with each response
2. The state is stored in a hidden `#state-input` field in the DOM
3. When `loadMoreJobs` is triggered (via scroll intersection):
   - The frontend JavaScript reads the state from the hidden input (prioritizing `data-state` attribute)
   - It constructs a proper JSON body: `{ "state": {...} }`
   - Sets `Content-Type: application/json` header
   - Sends the POST request
4. The backend receives JSON, parses the state, and applies filters when querying

### Key Files

| File | Purpose |
|------|---------|
| `web/js/htmx_events.js` | Handles HTMX events, reads state from DOM, updates global state |
| `web/js/ui.js` | Updates main content and processes HTMX after content changes |
| `web/js/state.js` | Global state management (currentState) |
| `web_service/sidebar/state_manager.ts` | Builds hidden input with state |
| `web_service/server.ts` | Handles loadMoreJobs endpoint |
| `web_service/routes/jobs/page.ts` | Builds job rows with hx-vals |

### HTMX Event Handling

The frontend uses HTMX events to manage pagination:

1. **`htmx:configRequest`**: Intercepts requests to:
   - Set `Content-Type: application/json` for loadMoreJobs
   - Read state from DOM and attach to request body

2. **`htmx:afterSwap`**: After receiving response:
   - Parse hx-vals from response HTML
   - Update global `currentState` via `setState()`
   - Update hidden input field with new state
   - Remove old trigger element to prevent duplicate requests

### Filter Interaction

When a filter is applied:
1. Action handler (e.g., `addFilterHandler`) resets pagination to page 1
2. Server returns new content starting from page 1
3. Global state is updated with page: 1
4. Infinite scroll continues from the new filtered results

## Source Filters

| Filter | Description |
|--------|-------------|
| `all-saved` | Shows all ETL jobs with saved job info merged in |
| `jobs-etl` | Shows only ETL jobs |
| `saved-only` | Shows saved jobs where archive = 0 (active) |
| `saved-archived` | Shows saved jobs where archive = 1 (archived) |

## Display Logic

The job list rendering follows these rules:

1. For `saved-only` and `saved-archived`: The job IS the saved job entry itself
2. For `all-saved` and `jobs-etl`: Jobs come from ETL, with saved info attached if the job is saved
3. When displaying a saved job, prefer ETL fields if they exist; otherwise use JobSave fields

## Code Flow

1. **State Management**: Source filter is stored in `state.filters.source`
2. **Count Query**: Determines total jobs based on filter - see [jobs_count_usecase.ts](../web_service/usecases/jobs_count_usecase.ts)
3. **Job Fetching**: Queries appropriate table(s) based on source - see [page.ts](../web_service/routes/jobs/page.ts)
4. **Rendering**: Each job is rendered as a card - see [job_card.ts](../web_service/routes/jobs/components/job_card.ts)

## Files

- Count logic: `web_service/usecases/jobs_count_usecase.ts`
- Job fetching: `web_service/routes/jobs/page.ts`
- Job card rendering: `web_service/routes/jobs/components/job_card.ts`
- Saved job queries: `api_sqlite/table_jobs_save.ts`
- ETL job queries: `api_sqlite/table_jobs.ts`
