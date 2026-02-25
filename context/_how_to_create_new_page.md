# How to Create a New Page

This guide documents the step-by-step workflow to add a new page or feature to the JobSearch project.

---

## Project Architecture Overview

### Technology Stack
- **Frontend**: Vanilla JS + HTMX + CSS
- **Backend**: Deno + Oak framework
- **Database**: SQLite
- **Rendering**: Server-side HTML generation
- **State**: Server-driven with client-side copy

### Core Architecture Pattern

The application uses a **server-driven state** pattern:

1. Client sends actions to `/api/action` endpoint
2. Server applies action via handlers in `web_service/actions/handlers.ts`
3. Server rebuilds affected components (sidebar, filters, page content)
4. Server returns new state + HTML updates (OOB pattern)
5. Client updates UI and maintains state copy

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `web/` | Frontend assets (HTML, JS, CSS) |
| `web_service/` | Backend server (Deno + Oak) |
| `api_sqlite/` | Database layer |
| `utils/` | Utility functions |
| `scrap_tools/` | Job scraping tools |

---

## Step-by-Step Workflow

### Phase 1: Define the Page Requirements

#### Step 1.1: Determine Page Scope
- [ ] Define the page ID (e.g., `"settings"`, `"reports"`, `"export"`)
- [ ] Define display name for navigation
- [ ] Choose FontAwesome icon
- [ ] Identify if page needs filters
- [ ] Identify if page needs pagination
- [ ] Identify data sources required

#### Step 1.2: Select Implementation Pattern
Reference existing implementations:
- **Simple data page**: See `web_service/routes/keywords/page.ts`
- **Complex analytics page**: See `web_service/routes/analysis/page.ts`
- **Process runner page**: See `web_service/routes/processing/page.ts`

---

### Phase 2: Create Backend Page Module

#### Step 2.1: Create Route Directory
Create directory: `web_service/routes/[page-id]/`

#### Step 2.2: Create Page Builder File
Reference: `web_service/routes/keywords/page.ts`
- [ ] Import `CurrentState` from `../../types/index.ts`
- [ ] Import `Page, registerPage` from `../../pages/page_registry.ts`
- [ ] Create `build[PageName]Page` async function
- [ ] Implement Page object with `id`, `name`, `icon`, `build`
- [ ] Call `registerPage(myPage)` to register
- [ ] Export the build function

#### Step 2.3: Register Page
File: `web_service/pages/mod.ts`
- [ ] Add import for new page: `import "../routes/[page-id]/page.ts";`

**Validation:**
- [ ] Server starts without errors
- [ ] Page appears in navigation (check console for registration message)
- [ ] Page loads when clicked in sidebar

---

### Phase 3: Implement Page Content

#### Step 3.1: Query Data (if needed)
Reference: `api_sqlite/table_jobs.ts`
- Use `JobsEtl` class for job data
- Use `search(filters, limit, offset)` method
- Use `aggFieldCount()` for statistics
- Use `aggJobKeywordScore()` for keyword analysis

#### Step 3.2: Build HTML Content
Reference: `web_service/routes/analysis/page.ts`
- Return complete HTML strings via template literals
- Include HTMX attributes (`hx-post`, `hx-trigger`, `hx-swap`) for interactivity
- Use CSS classes from `web/styles/` files
- Add scoped `<style>` blocks if needed

**Validation:**
- [ ] Page loads with correct content
- [ ] Data displays properly
- [ ] No console errors

---

### Phase 4: Add Filter Support (Conditional)

**When: Page needs filtering like Jobs or Keywords page**

#### Step 4.1: Update Filter Configuration
File: `web_service/sidebar/filter_config.ts`
- [ ] Add filter keys to `JOB_FILTER_KEYS` array (if new database field)
- [ ] Add display names to `FILTER_DISPLAY_NAMES`

#### Step 4.2: Use Filters in Query
Reference: `web_service/routes/jobs/page.ts`
- [ ] Pass `state.filters` to database search method

**Validation:**
- [ ] Filters appear in sidebar
- [ ] Clicking filter updates page content
- [ ] Multiple filters work together

---

### Phase 5: Add Custom Actions (Conditional)

**When: Page needs special interactions beyond setPage/toggleFilter**

#### Step 5.1: Define Action Type
File: `web_service/actions/action_types.ts`
- [ ] Add new action type to `ActionType` union

#### Step 5.2: Create Action Handler
File: `web_service/actions/handlers.ts`
- [ ] Create handler function following existing pattern
- [ ] Register in `actionHandlers` map

#### Step 5.3: Handle in Frontend
File: `web/js/actions.js`
- [ ] Add case in `handleMenuAction()` switch statement

**Validation:**
- [ ] Action sends correct payload
- [ ] Server processes correctly
- [ ] UI updates appropriately

---

### Phase 6: Add API Endpoints (Conditional)

**When: Page needs dedicated API endpoints**

#### Step 6.1: Create Endpoint
File: `web_service/server.ts`
- [ ] Define route (GET/POST)
- [ ] Implement handler
- [ ] Return appropriate response (JSON or HTML)

**Validation:**
- [ ] Endpoint responds correctly
- [ ] Handles errors gracefully

---

### Phase 7: Styling

#### Step 7.1: Use Existing CSS Variables
Reference: `web/styles/base.css`

#### Step 7.2: Use Existing Components
Reference: `web/styles/components.css`
- Cards: `.card`, `.card-header`
- Tables: `.table`
- Buttons: `.btn`, `.btn-primary`, `.btn-ghost`
- Forms: `.form-group`, `.form-control`
- Stats: `.stats-grid`, `.stat-card`

#### Step 7.3: Add Custom Styles (if needed)
Add scoped styles in your page HTML using `<style>` blocks

**Validation:**
- [ ] Page matches existing design system
- [ ] Responsive on different screens

---

### Phase 8: Testing

#### Step 8.1: Manual Testing
- [ ] Page loads from navigation
- [ ] All interactive elements work
- [ ] Filters apply correctly
- [ ] No console errors

#### Step 8.2: Integration Testing
- [ ] Page works with existing data
- [ ] Performance acceptable
- [ ] Works with other pages

---

## Quick Reference

### Page Interface
Reference: `web_service/pages/page_registry.ts`

### CurrentState Reference
Reference: `web_service/types/index.ts`

### Available Standard Actions
- `setPage` - Change current page
- `toggleFilter` - Add/remove filter
- `addFilter` - Add filter
- `removeFilter` - Remove filter
- `clearFilters` - Clear all filters
- `setPageNumber` - Change pagination

### Key Files Reference

| Purpose | File |
|---------|------|
| Page Registry | `web_service/pages/page_registry.ts` |
| Page Imports | `web_service/pages/mod.ts` |
| State Types | `web_service/types/index.ts` |
| State Manager (Backend) | `web_service/sidebar/state_manager.ts` |
| State (Frontend) | `web/js/state.js` |
| Action Handlers | `web_service/actions/handlers.ts` |
| Server Routes | `web_service/server.ts` |
| Filter Config | `web_service/sidebar/filter_config.ts` |
| Navigation Buttons | `web_service/sidebar/page_buttons.ts` |
| API Client | `web/js/api.js` |
| Frontend Actions | `web/js/actions.js` |
| DB Connection | `api_sqlite/db.ts` |
| Jobs Table | `api_sqlite/table_jobs.ts` |
| Base Table Class | `api_sqlite/table.ts` |

---

## Common Patterns Reference

### Infinite Scroll
Reference: `web_service/routes/jobs/page.ts` - `buildMoreJobsRows()`

### Charts/Analytics
Reference: `web_service/routes/analysis/page.ts`

### Process Runner
Reference: `web_service/routes/processing/page.ts`

### Filter Click to Add Filter
Add these attributes to clickable elements:
- `data-action="addFilter"`
- `data-filter-key="fieldName"`
- `data-filter-value="${encodeURIComponent(value)}"`
- `onclick="handleMenuAction(this)"`

---

## Important Patterns

### JSON Field Handling (Critical)

The database layer (`api_sqlite/db.ts`) automatically deserializes JSON strings when reading from the database. When you read a field that was stored as JSON (e.g., `filters` field), the value will already be a JavaScript object, NOT a string.

**This affects:**
- Reading filter profiles
- Reading any field stored as JSON in SQLite

**Correct pattern:**
```typescript
// When reading from database and using the value
let filters: Record<string, string[]>;
if (typeof profile.filters === 'string') {
  filters = JSON.parse(profile.filters);
} else if (typeof profile.filters === 'object' && profile.filters !== null) {
  filters = profile.filters as Record<string, string[]>;
} else {
  throw new Error('Invalid filters format');
}
```

**Why this happens:**
- SQLite stores JSON as TEXT
- The `deserializeRow()` function in `db.ts` automatically parses fields that look like JSON arrays `[]` or objects `{}`
- This happens BEFORE your code receives the data

**Always check the type before using:**
1. If the field is expected to be JSON, handle both string and object formats
2. Use `typeof` to check: `if (typeof value === 'string')` vs `if (typeof value === 'object')`
3. When in doubt, log the type: `console.log('Type of filters:', typeof profile.filters)`

---

## Troubleshooting

### Page Not Appearing
- [ ] Check page is imported in `web_service/pages/mod.ts`
- [ ] Verify `registerPage()` is called in page file
- [ ] Check server console for registration message
- [ ] Check browser console for errors

### Filters Not Working
- [ ] Verify filter key exists in `JOB_FILTER_KEYS`
- [ ] Check database field exists in table schema
- [ ] Verify `search()` method receives filters correctly

### State Not Persisting
- [ ] Check state is serialized in response
- [ ] Check client updates state from response
- [ ] Verify `setState()` is called in frontend

### HTMX Not Working
- [ ] Check `hx-` attributes are correct
- [ ] Verify `htmx.process()` called after content swap
- [ ] Check browser network tab for requests
- [ ] Ensure response includes proper Content-Type

### Data Appears as "[object Object]" or Parsing Errors
- [ ] The field may already be deserialized by the DB layer
- [ ] Check if `typeof field === 'object'` instead of `'string'`
- [ ] See "JSON Field Handling" section above
