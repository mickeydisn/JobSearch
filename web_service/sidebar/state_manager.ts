import { CurrentState, PageType } from "../types/index.ts";
import { JOB_FILTER_KEYS } from "./filter_config.ts";
import { getActionHandler } from "../actions/handlers.ts";
import { getJobsCount } from "../usecases/jobs_count_usecase.ts";

/** Default initial state */
export const getDefaultState = (): CurrentState => ({
  currentPage: "jobs",
  filters: {},
  pagination: {
    page: 1,
    pageSize: 10,
  },
  keywordPage: {
    sortedBy: "score",
  },
});

/** Parse state from JSON string or return default */
export const parseState = (jsonString: string | null): CurrentState => {
  if (!jsonString) return getDefaultState();
  try {
    const parsed = JSON.parse(jsonString);
    return {
      currentPage: parsed.currentPage || "jobs",
      filters: parsed.filters || {},
      pagination: {
        page: parsed.pagination?.page || 1,
        pageSize: parsed.pagination?.pageSize || 10,
      },
      keywordPage: {
        sortedBy: parsed.keywordPage?.sortedBy || "score",
      },
    };
  } catch {
    return getDefaultState();
  }
};

/** Serialize state to JSON string */
export const serializeState = (state: CurrentState): string => {
  return JSON.stringify(state);
};

/** Build state HTML display with filters as list */
export const buildStateDisplay = (state: CurrentState): string => {
  const filterCount = Object.keys(state.filters).length;
  
  // Get job count with current filters
  const jobsCount = getJobsCount(state.filters);
  
  // Serialize state for use in HTMX requests (stored in hidden input)
  const serializedState = serializeState(state);
  
  let filtersList = "";
  if (filterCount > 0) {
    const items: string[] = [];
    for (const [key, values] of Object.entries(state.filters)) {
      // Skip non-array filter values (e.g., source filter is a string)
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        const displayText = `${key}: ${value}`;
        const encodedValue = encodeURIComponent(value);
        items.push(`
          <div class="select-item" data-action="removeFilter" data-filter-key="${key}" data-filter-value="${encodedValue}" onclick="handleMenuAction(this)">
            <span>${displayText}</span>
            <span class="select-item-count"><i class="fa fa-times"></i></span>
          </div>
        `);
      }
    }
    filtersList = `<div class="select-list">${items.join("")}</div>`;
  } else {
    filtersList = `<p style="color: var(--color-gray-500); font-size: var(--font-size-sm);"><i>No filters applied</i></p>`;
  }

  return `
    <!-- Hidden input storing current state for HTMX requests -->
    <input type="hidden" id="state-input" data-state="${btoa(serializedState)}">
    <div style="margin-bottom: var(--space-md);">
      <div style="font-size: var(--font-size-sm); color: var(--color-gray-600); margin-bottom: var(--space-xs);">
        <strong>Current Page:</strong> ${state.currentPage}
      </div>
      <div style="font-size: var(--font-size-sm); color: var(--color-gray-600); margin-bottom: var(--space-sm);">
        <strong>Jobs Count:</strong> ${jobsCount}
      </div>
    </div>
    <div style="margin-bottom: var(--space-sm);">
      <strong style="font-size: var(--font-size-sm);">Filters (${filterCount}):</strong>
    </div>
    ${filtersList}
    ${filterCount > 0 ? `
      <button class="btn btn-sm btn-ghost" style="margin-top: var(--space-md);"
              data-action="clearFilters"
              onclick="handleMenuAction(this)">
        <i class="fa fa-trash"></i>
        Clear all filters
      </button>
    ` : ""}
  `;
};

/** Apply action to state and return new state */
export const applyAction = async (
  state: CurrentState,
  actionType: string,
  payload: unknown,
): Promise<CurrentState> => {
  const handler = getActionHandler(actionType);

  if (!handler) {
    console.warn(`Unknown action type: ${actionType}`);
    return JSON.parse(JSON.stringify(state));
  }

  try {
    return await handler(state, payload);
  } catch (error) {
    console.error(`Error applying action ${actionType}:`, error);
    return JSON.parse(JSON.stringify(state));
  }
};
