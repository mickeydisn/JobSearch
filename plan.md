# Documentation Context

this project have a documentation context in context/**.md .. you can list all the context file, and read then as referance for the project. If user ask for any update of refactoring of the project , the documentation must be change to if need. 


# New Feature: Keyword Management Enhancement

> Better keyword management with search, stopwords, and tags functionality

---

## Phase 1: Database & Backend ✅ COMPLETE

### Step 1: Create Keyword Table with Stopwords & Tags ✅ COMPLETE

Reference: `api_sqlite/table.ts` - "Create a new table class"

- [x] Create new `table_keywords.ts` in `api_sqlite/`
- [x] Define schema: `id`, `keyword` (unique), `is_stopword` (boolean), `tags` (JSON array)
- [x] Implement CRUD methods: `addStopword()`, `removeStopword()`, `addTag()`, `removeTag()`, `searchKeywords()`, `getAllStopwords()`, `getByTag()`, `getAllTags()`
- [x] Register new table in `api_sqlite/db.ts` (tables are created on-demand)

**Implementation Details** (`api_sqlite/table_keywords.ts`):
```typescript
export type KeywordType = {
  id: string;           // keyword (used as primary key)
  keyword: string;
  is_stopword: boolean; // 0/1 in SQLite
  tags: string[];        // JSON array
};

export class Keywords extends TableNode<KeywordType> {
  // Methods implemented:
  async addStopword(keyword: string): Promise<void>
  async removeStopword(keyword: string): Promise<void>
  async addTag(keyword: string, tag: string): Promise<void>
  async removeTag(keyword: string, tag: string): Promise<void>
  async searchKeywords(searchTerm: string, limit?: number, offset?: number): Promise<KeywordType[]>
  async getAllStopwords(limit?: number): Promise<KeywordType[]>
  async getByTag(tag: string, limit?: number): Promise<KeywordType[]>
  async getAllTags(): Promise<string[]>
}
```

### Step 2: Add New Action Types ✅ COMPLETE

Reference: `web_service/actions/action_types.ts` - "Add new action type"

- [x] Add `addStopword` action type
- [x] Add `removeStopword` action type  
- [x] Add `addKeywordTag` action type
- [x] Add `removeKeywordTag` action type
- [x] Add `searchKeywords` action type
- [x] Add `setKeywordSearch` action type (for search input)

**Implementation Details** (`web_service/actions/action_types.ts`):
```typescript
export interface AddStopwordPayload { keyword: string; }
export interface RemoveStopwordPayload { keyword: string; }
export interface AddKeywordTagPayload { keyword: string; tag: string; }
export interface RemoveKeywordTagPayload { keyword: string; tag: string; }
export interface SearchKeywordsPayload { searchTerm: string; limit?: number; offset?: number; }
export interface SetKeywordSearchPayload { searchTerm: string; }
```

### Step 3: Create Action Handlers ✅ COMPLETE

Reference: `web_service/actions/handlers.ts` - "Create Action Handler"

- [x] Implement handler for adding stopword to keyword (`addStopwordHandler`)
- [x] Implement handler for removing stopword from keyword (`removeStopwordHandler`)
- [x] Implement handler for adding tag to keyword (`addKeywordTagHandler`)
- [x] Implement handler for removing tag from keyword (`removeKeywordTagHandler`)
- [x] Implement handler for searching keywords (`searchKeywordsHandler`)

**Implementation Details** (`web_service/actions/handlers_async.ts`):
```typescript
export const addStopwordHandler: ActionHandler = async (state, payload) => { ... }
export const removeStopwordHandler: ActionHandler = async (state, payload) => { ... }
export const addKeywordTagHandler: ActionHandler = async (state, payload) => { ... }
export const removeKeywordTagHandler: ActionHandler = async (state, payload) => { ... }
export const searchKeywordsHandler: ActionHandler = async (state, payload) => { ... }

export const asyncActionHandlers = {
  addStopword: addStopwordHandler,
  removeStopword: removeStopwordHandler,
  addKeywordTag: addKeywordTagHandler,
  removeKeywordTag: removeKeywordTagHandler,
  searchKeywords: searchKeywordsHandler,
};
```

### Step 4: Update Filter Configuration ✅ COMPLETE

Reference: `web_service/sidebar/filter_config.ts` - "Update Filter Configuration"

- [x] Add `keywordTag` to `JOB_FILTER_KEYS`
- [x] Add display name to `FILTER_DISPLAY_NAMES`

**Implementation Details** (`web_service/sidebar/filter_config.ts`):
```typescript
export const JOB_FILTER_KEYS = [
  // ... existing keys
  "keywordTag",
] as const;

export const FILTER_DISPLAY_NAMES: Record<string, string> = {
  // ... existing names
  keywordTag: "Keyword Tag",
};
```

---

## Phase 2: Frontend UI Updates ✅ COMPLETE

### Step 5: Update Keywords Page ✅ COMPLETE

Reference: `web_service/routes/keywords/keywords_controller.ts` - "Build HTML Content"

- [x] Add search input field at top of keywords page
- [x] Add "Add Stopword" / "Remove Stopword" button to each keyword row (next to Filter/Reject buttons)
- [x] Add collapsible `<details>` section for stopwords list (closed by default)
- [x] Add tags column/section to keyword display
- [x] Add tag management UI (dropdown to select existing + input to create new)
- [x] Add sort buttons for count/score

**Implementation Details** (`web_service/routes/keywords/keywords_controller.ts`):
- Search input with Enter key and button support
- Stopwords collapsible section with count badge
- Tags displayed as removable chips
- Dropdown + input for adding new tags
- Stopword toggle button with visual state change
- Filter and Reject buttons per keyword row

### Step 6: Frontend Action Handling ✅ COMPLETE

Reference: `web/js/actions.js` - "Handle in Frontend"

- [x] Add cases for new action types in `handleMenuAction()`:
  - `addStopword` - extracts keyword from dataset
  - `removeStopword` - extracts keyword from dataset
  - `addKeywordTag` - extracts keyword and tag from dataset
  - `removeKeywordTag` - extracts keyword and tag from dataset
  - `setKeywordSearch` - extracts searchTerm from dataset
- [x] Connect search input to setKeywordSearch action

**Implementation Details** (`web/js/actions.js`):
```javascript
case 'addStopword':
    payload = {
        keyword: decodeURIComponent(element.dataset.keyword)
    };
    break;
case 'removeStopword':
    payload = {
        keyword: decodeURIComponent(element.dataset.keyword)
    };
    break;
case 'addKeywordTag':
    payload = {
        keyword: decodeURIComponent(element.dataset.keyword),
        tag: decodeURIComponent(element.dataset.tag)
    };
    break;
case 'removeKeywordTag':
    payload = {
        keyword: decodeURIComponent(element.dataset.keyword),
        tag: decodeURIComponent(element.dataset.tag)
    };
    break;
case 'setKeywordSearch':
    payload = {
        searchTerm: element.dataset.searchTerm || ''
    };
    break;
```

---

## Phase 3: Integration & Testing ✅ COMPLETE (All Tests Passed)

Reference: `context/_how_to_create_new_page.md` - "Testing"

**Testing Checklist - All Passed:**

- [x] **Test 1:** Keyword search returns correct results
  - Navigate to keywords page
  - Enter search term in search box
  - Press Enter or click Search
  - Verify filtered results are displayed

- [x] **Test 2:** Adding stopwords persists to database
  - Click "Stopword" button on a keyword row
  - Button should change to show "✓ Stopword" with warning style
  - Refresh page
  - Keyword should still show as stopword
  - Check stopwords collapsible section

- [x] **Test 3:** Removing stopwords persists to database
  - Click "✓ Stopword" button on a stopword
  - Button should change back to "Stopword"
  - Refresh page
  - Keyword should no longer be a stopword

- [x] **Test 4:** Tags can be added via dropdown selection
  - Click dropdown next to "+ Tag"
  - Select existing tag
  - Tag should appear as chip below
  - Refresh page - tag should persist

- [x] **Test 5:** New tags can be created via input
  - Type new tag name in "New..." input
  - Press Enter
  - New tag should appear as chip
  - Tag should be available in other keyword dropdowns

- [x] **Test 6:** Tags can be removed
  - Click X on tag chip
  - Tag should be removed
  - Refresh page - tag should be removed

- [x] **Test 7:** Keyword tags appear in sidebar filter options
  - Check if `keywordTag` appears in sidebar filters
  - Should see available tags as filter options

- [x] **Test 8:** Filtering by keyword tag works correctly
  - Select a keyword tag in sidebar
  - Jobs should filter to only show those with tagged keywords
  - Verify filtering works correctly

---

## Phase 4: Documentation ✅ COMPLETE

### Step 8: Update Documentation ✅ COMPLETE

Reference: `context/_how_to_create_new_page.md` - "Check for documentation update"

**Documentation Updates Completed:**

- [x] **Update `context/module_api_sqlite.md`**
  - Added `table_keywords.ts` to File Structure
  - Added Keywords table schema with all fields
  - Added Keywords TableNode methods with usage examples
  
- [x] **Update `context/JOB_WORKFLOW.md`**
  - Added `keywords` table to Database Tables section
  - Added `jobs_save` table to Database Tables section

---

## Implementation Summary

### Completed Features:

| Feature | File | Status |
|---------|------|--------|
| Keywords Table CRUD | `api_sqlite/table_keywords.ts` | ✅ |
| Action Types | `web_service/actions/action_types.ts` | ✅ |
| Async Handlers | `web_service/actions/handlers_async.ts` | ✅ |
| Filter Config | `web_service/sidebar/filter_config.ts` | ✅ |
| Keywords Page UI | `web_service/routes/keywords/keywords_controller.ts` | ✅ |
| Frontend Actions | `web/js/actions.js` | ✅ |
| Documentation | `context/module_api_sqlite.md`, `context/JOB_WORKFLOW.md` | ✅ |

### Feature Complete - All Tests Passed ✅

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS keywords (
  id TEXT PRIMARY KEY NOT NULL,
  keyword TEXT,
  is_stopword INTEGER DEFAULT 0,
  tags TEXT
);
```

### API Flow

1. **User clicks "Add Stopword"** → `handleMenuAction()` in `actions.js`
2. **Payload sent via HTMX** → `sendAction()` in `api.js`
3. **Server processes** → `addStopwordHandler` in `handlers_async.ts`
4. **Database updated** → `Keywords.addStopword()` in `table_keywords.ts`
5. **UI refreshes** → Keywords page rebuilds with updated state

---

## Future Enhancements (Out of Scope)

- Export/import stopwords list as CSV
- Bulk tag operations
- Keyword usage analytics
- Tag-based job recommendations
