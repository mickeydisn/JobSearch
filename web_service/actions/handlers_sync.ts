import { CurrentState, PageType } from "../types/index.ts";
import { ActionHandler, FilterPayload, 
  SetSavedJobsSortPayload, SetSourceFilterPayload } from "./action_types.ts";

/** Set current page */
export const setPageHandler: ActionHandler = (state, payload) => {
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  newState.currentPage = payload as PageType;
  newState.pagination.page = 1;
  return newState;
};

/** Convert filter value to array format */
const toFilterArray = (filter: string | string[] | undefined): string[] => {
  if (!filter) return [];
  if (typeof filter === 'string') return [filter];
  if (Array.isArray(filter)) return filter;
  return [];
};

/** Toggle filter (add if not present, remove if present) */
export const toggleFilterHandler: ActionHandler = (state, payload) => {
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  const { key, value } = payload as FilterPayload;

  const currentFilter = toFilterArray(newState.filters[key]);
  const index = currentFilter.indexOf(value);
  
  if (index === -1) {
    currentFilter.push(value);
    newState.filters[key] = currentFilter;
  } else {
    currentFilter.splice(index, 1);
    if (currentFilter.length === 0) {
      delete newState.filters[key];
    } else {
      newState.filters[key] = currentFilter;
    }
  }
  newState.pagination.page = 1;
  return newState;
};

/** Add filter (only if not already present) */
export const addFilterHandler: ActionHandler = (state, payload) => {
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  const { key, value } = payload as FilterPayload;

  const currentFilter = toFilterArray(newState.filters[key]);
  if (!currentFilter.includes(value)) {
    currentFilter.push(value);
    newState.filters[key] = currentFilter;
  }
  newState.pagination.page = 1;
  return newState;
};

/** Remove specific filter value */
export const removeFilterHandler: ActionHandler = (state, payload) => {
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  const { key, value } = payload as FilterPayload;

  if (newState.filters[key]) {
    const currentFilter = toFilterArray(newState.filters[key]);
    const filtered = currentFilter.filter((v) => v !== value);
    if (filtered.length === 0) {
      delete newState.filters[key];
    } else {
      newState.filters[key] = filtered;
    }
  }
  return newState;
};

/** Clear all filters */
export const clearFiltersHandler: ActionHandler = (state) => {
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  newState.filters = {};
  newState.pagination.page = 1;
  return newState;
};

/** Set page number for pagination */
export const setPageNumberHandler: ActionHandler = (state, payload) => {
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  newState.pagination.page = payload as number;
  return newState;
};

/** Set keyword page sort order */
export const setKeywordSortHandler: ActionHandler = (state, payload) => {
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  newState.keywordPage.sortedBy = payload as "score" | "count";
  return newState;
};

/** Set saved jobs sort */
export const setSavedJobsSortHandler: ActionHandler = (state, payload) => {
  const sortPayload = payload as SetSavedJobsSortPayload;
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  
  // Store as string for single-value fields like sortBy and sortOrder
  newState.filters.sortBy = [sortPayload.sortBy as string];
  newState.filters.sortOrder = [sortPayload.sortOrder as string];
  newState.pagination.page = 1;
  
  return newState;
};

/** Set source filter */
export const setSourceFilterHandler: ActionHandler = (state, payload) => {
  const sourcePayload = payload as SetSourceFilterPayload;
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  
  // Store as string for single-value fields like source
  newState.filters.source = [sourcePayload.source as string];
  newState.pagination.page = 1;
  
  return newState;
};

/** Map of sync action handlers */
export const syncActionHandlers: Record<string, ActionHandler> = {
  setPage: setPageHandler,
  toggleFilter: toggleFilterHandler,
  addFilter: addFilterHandler,
  removeFilter: removeFilterHandler,
  clearFilters: clearFiltersHandler,
  setPageNumber: setPageNumberHandler,
  setKeywordSort: setKeywordSortHandler,
  setSavedJobsSort: setSavedJobsSortHandler,
  setSourceFilter: setSourceFilterHandler,
};
