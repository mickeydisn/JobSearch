# Module: web

## Overview

Frontend assets for the HTMX-based single-page application. Uses vanilla JavaScript for state management and streaming, CSS with custom properties for theming, and HTMX for server communication.

## File Structure

```
web/
├── index.html              # Main HTML shell with HTMX setup
├── js/
│   ├── main.js            # App initialization, event handlers
│   ├── state.js           # State management utilities
│   ├── api.js             # API calls (init, loadMore, etc.)
│   ├── ui.js              # DOM manipulation helpers
│   ├── actions.js         # Action handlers for buttons/clicks
│   ├── streaming.js       # SSE process streaming
│   ├── htmx_events.js     # HTMX event handlers (configRequest, afterSwap)
│   ├── title_manager.js   # Page title management
│   ├── chart_loader.js    # Chart loading and rendering
│   └── analysis_charts.js # Chart.js integration
└── styles/
    ├── base.css           # CSS variables, reset, base styles
    ├── layout.css         # Page layout, sidebar, grid
    ├── components.css     # Buttons, cards, tables, forms
    └── filters.css        # Filter-specific styles
```

## Key Features

| Feature           | Description                                    |
| ----------------- | ---------------------------------------------- |
| HTMX SPA          | Server-rendered pages with HTMX swaps          |
| State Persistence | Hidden input stores JSON state across requests |
| SSE Streaming     | Real-time process log display                  |
| Infinite Scroll   | IntersectionObserver triggers page load        |
| Chart.js          | Analytics visualization for job data           |
| CSS Variables     | Theming with custom properties                 |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  <head>                                               │  │
│  │  ├── HTMX 1.9.10                                      │  │
│  │  ├── Chart.js 4.4.1                                   │  │
│  │  └── CSS files (base, layout, components, filters)  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  <body>                                               │  │
│  │  ├── <aside class="page-sidebar">                     │  │
│  │  │   ├── Navigation (page-buttons)                    │  │
│  │  │   ├── State Display (current-state)                │  │
│  │  │   ├── Hidden input (#state-input)                  │  │
│  │  │   ├── Filters (filters)                            │  │
│  │  │   └── Keyword Filters (keyword-filters)            │  │
│  │  └── <main class="page-content">                      │  │
│  │      └── Page Content (page-content)                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTMX requests + JS modules
┌─────────────────────────────────────────────────────────────┐
│                       JS Modules                            │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐  │
│  │ main.js   │  │ state.js  │  │  api.js   │  │  ui.js   │  │
│  │ (entry)   │  │ (state)   │  │ (http)    │  │ (dom)    │  │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘  │
│  ┌───────────┐  ┌───────────┐  ┌─────────────────────────┐  │
│  │ actions.js│  │streaming.js│  │   htmx_events.js        │  │
│  │(handlers) │  │  (sse)    │  │ (htmx event handling)   │  │
│  └───────────┘  └───────────┘  └─────────────────────────┘  │
│  ┌───────────────────┐  ┌────────────────────────────────┐   │
│  │   title_manager.js │  │      chart_loader.js           │   │
│  │  (title updates)   │  │    (chart loading/rendering)  │   │
│  └───────────────────┘  └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## HTMX Configuration

```html
<script src="https://unpkg.com/htmx.org@1.9.10"></script>
<script src="https://unpkg.com/htmx-ext-json-enc@2.0.1/json-enc.js"></script>
<script>
  // Enable script tags in swapped content
  htmx.config.allowScriptTags = true;
</script>
```

### JSON Encoding Extension

The `json-enc` extension is used to send POST requests with JSON-encoded body instead of the default `application/x-www-form-urlencoded`. This is required for endpoints that expect `application/json` content type:

```html
<!-- Using json-enc extension for JSON POST requests -->
<div hx-post="/api/loadMoreJobs" hx-ext="json-enc">Load More</div>
```

## JavaScript Modules

### state.js - State Management

```javascript
// Current state (in-memory)
let currentState = {
  currentPage: "jobs",
  filters: {},
  pagination: { page: 1, pageSize: 10 },
  keywordPage: { sortedBy: "score" },
};

// Update state from server response
export function setState(newState) {
  currentState = { ...currentState, ...newState };
}

// Get current state
export function getState() {
  return currentState;
}
```

### htmx_events.js - HTMX Event Handling

This module handles HTMX events for the infinite scroll pagination:

```javascript
// Key handlers in htmx_events.js:

// 1. htmx:configRequest - Attach state to requests
function handleConfigRequest(evt) {
  if (evt.detail.path?.includes('loadMoreJobs')) {
    // Set Content-Type to application/json
    evt.detail.headers['Content-Type'] = 'application/json';
    
    // Read state from DOM (prioritize data-state attribute)
    const stateInput = document.getElementById('state-input');
    let stateToUse = null;
    
    // Try data-state first (base64 encoded)
    const dataState = stateInput?.getAttribute('data-state');
    if (dataState) {
      stateToUse = JSON.parse(atob(dataState));
    }
    // Fall back to value attribute
    else if (stateInput?.value && stateInput.value !== 'null') {
      stateToUse = JSON.parse(stateInput.value);
    }
    
    // Attach state to request body
    evt.detail.parameters = { state: stateToUse };
  }
}

// 2. htmx:afterSwap - Update state after response
function handleAfterSwap(evt) {
  const isLoadMoreJobs = evt.detail.path?.includes('loadMoreJobs');
  
  if (isLoadMoreJobs) {
    const responseText = evt.detail.xhr.responseText;
    
    // Parse hx-vals from response HTML
    const hxValsMatch = responseText.match(/hx-vals='([^']+)'/);
    if (hxValsMatch) {
      const newStateData = JSON.parse(
        hxValsMatch[1].replace(/&#39;/g, "'").replace(/"/g, '"')
      );
      
      // Update global state
      setState(newStateData.state);
      
      // Update hidden input
      const stateInput = document.getElementById('state-input');
      const serializedState = JSON.stringify(newStateData.state);
      stateInput.setAttribute('data-state', btoa(serializedState));
      stateInput.value = serializedState;
    }
    
    // Remove old trigger element to prevent duplicate requests
    const oldTrigger = evt.detail.requestConfig?.elt;
    if (oldTrigger) oldTrigger.remove();
  }
}
```

### ui.js - DOM Manipulation

```javascript
// Update main content and process HTMX
export function updateMainContent(html) {
  const pageContent = document.getElementById('page-content');
  pageContent.innerHTML = html;
  
  // Ensure HTMX processes new content
  if (window.htmx) {
    window.htmx.process(pageContent);
  }
}

// Update UI components
export function updateUI(components) {
  if (components.stateDisplay) {
    document.getElementById('current-state-content').innerHTML = components.stateDisplay;
  }
  // ... other component updates
}
```

## Streaming (streaming.js)

```javascript
// Start SSE connection for process logs
export function startProcessStream(processId, containerId) {
  const eventSource = new EventSource(`/api/process/stream/${processId}`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case "log":
        appendLogEntry(data.level, data.message);
        break;
      case "complete":
        showCompletion(data.durationMs);
        eventSource.close();
        break;
      case "error":
        showError(data.message);
        eventSource.close();
        break;
    }
  };
}
```

## Infinite Scroll

The infinite scroll uses HTMX's `intersect` trigger to detect when the user scrolls to the last row:

```html
<!-- Last row of table triggers load -->
<tr
  hx-post="/api/loadMoreJobs"
  hx-ext="json-enc"
  hx-trigger="intersect"
  hx-vals='{"state": {"pagination": {"page": 2, "pageSize": 10}, ...}}'
  hx-swap="afterend"
>
  <td>Job card content...</td>
</tr>
```

### How Pagination Works

1. **Initial Load**: Server returns page 1 with hx-vals containing page 1
2. **Client Updates**: After receiving rows:
   - Parse hx-vals from response HTML
   - Update global `currentState` via `setState()`
   - Update hidden input (`#state-input`) with new page number
3. **Next Scroll**: Client reads state from DOM, sends to server
4. **Server Response**: Returns rows with hx-vals containing page+1

**Important**: The page increment happens in `buildMoreJobsRows()` on the server side - it includes `page + 1` in the hx-vals. The server does NOT increment the page itself.

## Charts (analysis_charts.js)

```javascript
// Render charts with Chart.js
export function renderAnalysisCharts(data) {
  // Status distribution pie chart
  new Chart(document.getElementById("statusChart"), {
    type: "pie",
    data: data.statusDistribution,
  });

  // Scraper distribution bar chart
  new Chart(document.getElementById("scraperChart"), {
    type: "bar",
    data: data.scraperDistribution,
  });

  // Timeline line chart
  new Chart(document.getElementById("dateChart"), {
    type: "line",
    data: data.timeline,
  });
}
```

## CSS Architecture

### Variables (base.css)

```css
:root {
  /* Colors */
  --color-accent: #4299e1;
  --color-accent-dark: #3182ce;
  --color-accent-light: #bee3f8;
  --color-success: #48bb78;
  --color-warning: #ed8936;
  --color-danger: #f56565;

  /* Grays */
  --color-gray-50: #f7fafc;
  --color-gray-100: #edf2f7;
  --color-gray-800: #1a202c;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;

  /* Typography */
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-xl: 1.25rem;

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;

  /* Shadows */
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

### Layout (layout.css)

```css
.page {
  display: grid;
  grid-template-columns: 300px 1fr;
  min-height: 100vh;
}

.page-sidebar {
  background: var(--color-gray-50);
  border-right: 1px solid var(--color-gray-200);
  padding: var(--space-lg);
}

.page-content {
  padding: var(--space-lg);
  overflow-y: auto;
}
```

## Action Handlers (actions.js)

```javascript
// Global handlers exposed to window for HTMX onclick
window.handleMenuAction = (element) => {
  const action = element.dataset.action;
  const payload = extractPayload(element);

  htmx.ajax("POST", "/api/action", {
    values: { action: { type: action, payload } },
  });
};

window.handleTagClick = (jobId, tag) => {
  // Toggle tag on job
};
```
