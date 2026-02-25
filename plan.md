


# New Feature: Keyword Management Enhancement

> Better keyword management with search, stopwords, and tags functionality

---

## Phase 1: Database & Backend

### Step 1: Create Keyword Table with Stopwords & Tags

Reference: `api_sqlite/table.ts` - "Create a new table class"

- [ ] Create new `table_keywords.ts` in `api_sqlite/`
- [ ] Define schema: `id`, `keyword` (unique), `is_stopword` (boolean), `tags` (JSON array)
- [ ] Implement CRUD methods: `addStopword()`, `removeStopword()`, `addTag()`, `removeTag()`, `searchKeywords()`, `getAllStopwords()`
- [ ] Register new table in `api_sqlite/db.ts`

### Step 2: Add New Action Types

Reference: `web_service/actions/action_types.ts` - "Add new action type"

- [ ] Add `addStopword` action type
- [ ] Add `removeStopword` action type  
- [ ] Add `addKeywordTag` action type
- [ ] Add `removeKeywordTag` action type
- [ ] Add `searchKeywords` action type

### Step 3: Create Action Handlers

Reference: `web_service/actions/handlers.ts` - "Create Action Handler"

- [ ] Implement handler for adding stopword to keyword
- [ ] Implement handler for removing stopword from keyword
- [ ] Implement handler for adding tag to keyword
- [ ] Implement handler for removing tag from keyword
- [ ] Implement handler for searching keywords

### Step 4: Update Filter Configuration

Reference: `web_service/sidebar/filter_config.ts` - "Update Filter Configuration"

- [ ] Add `keywordTag` to `JOB_FILTER_KEYS`
- [ ] Add display name to `FILTER_DISPLAY_NAMES`

---

## Phase 2: Frontend UI Updates

### Step 5: Update Keywords Page

Reference: `web_service/routes/keywords/keywords_controller.ts` - "Build HTML Content"

- [ ] Add search input field at top of keywords page
- [ ] Add "Add Stopword" button to each keyword row (next to Filter/Reject buttons)
- [ ] Add collapsible `<details>` section for stopwords list (closed by default)
- [ ] Add tags column/section to keyword display
- [ ] Add tag management UI (dropdown to select existing + input to create new)

### Step 6: Frontend Action Handling

Reference: `web/js/actions.js` - "Handle in Frontend"

- [ ] Add cases for new action types in `handleMenuAction()`
- [ ] Implement UI for tag selector (dropdown + new tag input)
- [ ] Connect search input to search action

---

## Phase 3: Integration & Testing

### Step 7: Integration Testing

Reference: `context/_how_to_create_new_page.md` - "Testing"

- [ ] Test keyword search returns correct results
- [ ] Test adding/removing stopwords persists to database
- [ ] Test tags can be added via dropdown selection
- [ ] Test new tags can be created via input
- [ ] Test keyword tags appear in sidebar filter options
- [ ] Test filtering by keyword tag works correctly

---

## Phase 4: Documentation

### Step 8: Update Documentation

Reference: `context/_how_to_create_new_page.md` - "Check for documentation update"

- [ ] Check if `context/module_api_sqlite.md` needs update for new keyword table
- [ ] Check if `context/JOB_WORKFLOW.md` needs update for new features

---

**Lead's Note:** Keep it simple. Start with database, then backend actions, then UI. Test each piece before moving to next phase.


