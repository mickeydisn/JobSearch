import { CurrentState } from "../types/index.ts";
import { JOB_FILTER_KEYS, FILTER_DISPLAY_NAMES } from "./filter_config.ts";
import { JobsEtl } from "../../api_sqlite/table_jobs.ts";
import { buildFilterSection } from "../components/filter/filter_component.ts";
import { FilterOption } from "../components/filter/types.ts";
import { buildSourceFilter } from "./filter_source.ts";

const FILTER_LIMIT = 50;

/** Build all filter sections HTML */
export const buildFilterMenu = async (state: CurrentState): Promise<string> => {
  // Build source filter at the top
  const sourceFilterSection = await buildSourceFilter(state);
  
  const filterSections: string[] = [sourceFilterSection];

  for (const fkey of JOB_FILTER_KEYS) {
    const section = await buildJobFilterSection(state, fkey);
    filterSections.push(section);
  }

  return filterSections.join("");
};

/** Build a single job filter section using reusable component */
const buildJobFilterSection = async (
  state: CurrentState,
  fkey: string,
): Promise<string> => {
  const displayName = FILTER_DISPLAY_NAMES[fkey as keyof typeof FILTER_DISPLAY_NAMES] || fkey;
  const options = await getFilterOptions(state, fkey);
  const selectedValues = state.filters[fkey] || [];

  return buildFilterSection({
    id: fkey,
    title: displayName,
    icon: "fa-filter",
    filterKey: fkey,
    options,
    selectedValues,
  });
};

/** Get filter options for a specific filter key */
const getFilterOptions = async (
  state: CurrentState,
  fkey: string,
): Promise<FilterOption[]> => {
  // Get source filter to determine which table to query
  const sourceFilter = state.filters["source"];
  const source = typeof sourceFilter === 'string' ? sourceFilter : Array.isArray(sourceFilter) ? sourceFilter[0] : "all-saved";
  
  // For saved-only and saved-archived views, we need different handling
  if (source === "saved-only" || source === "saved-archived") {
    // Return empty options for saved jobs view - or could use JobsSave
    // For now, return empty array since saved jobs may have different fields
    return [];
  }
  
  const jobsEtl = new JobsEtl();

  // Exclude rejectedKeywords and source from filters - not real database fields
  const cleanFilters = { ...state.filters };
  delete cleanFilters["rejectedKeywords"];
  delete cleanFilters["source"];

  // Get global counts (no filters) - limit to 50
  const globalCounts = await jobsEtl.aggFieldCount(fkey, {}, FILTER_LIMIT);

  // Get local counts (with current filters, excluding this filter) - limit to 50
  const localFilter = { ...cleanFilters };
  delete localFilter[fkey];

  const localCounts = await jobsEtl.aggFieldCount(fkey, localFilter, FILTER_LIMIT);
  const localCountMap = new Map(localCounts.map(([k, v]) => [k, v]));

  // Build options
  let options = globalCounts.map(([value, count]) => ({
    value: String(value),
    count: Number(count),
    localCount: localCountMap.get(value) || 0,
  }));

  // Sort options
  if (fkey === "dateClean") {
    options.sort((a, b) => b.value.localeCompare(a.value));
  } else if (["iaScoreW5a", "iaScoreW6a"].includes(fkey)) {
    options.sort((a, b) => Number(b.value) - Number(a.value));
  } else {
    options.sort((a, b) => {
      if (b.localCount !== a.localCount) {
        return b.localCount - a.localCount;
      }
      return b.count - a.count;
    });
  }

  return options;
};

/** Build filter summary display */
export const buildFilterSummary = (state: CurrentState): string => {
  const filters = state.filters;
  const entries = Object.entries(filters);

  if (entries.length === 0) {
    return `
      <p style="color: var(--color-gray-500); font-size: var(--font-size-sm);"><i>No filters applied</i></p>
    `;
  }

  const summaryItems = entries
    .filter(([key, _]) => key !== "source") // Skip non-array filter values
    .map(([key, values]) => {
    // Skip non-array values (like source filter which is a string)
    if (!Array.isArray(values)) return "";
    return values.map((value) => `
      <div class="filter-tag">
        <span>${FILTER_DISPLAY_NAMES[key as keyof typeof FILTER_DISPLAY_NAMES] || key}: ${value}</span>
        <button data-action="removeFilter"
                data-filter-key="${key}"
                data-filter-value="${encodeURIComponent(value)}"
                onclick="handleMenuAction(this)">
          <i class="fa fa-times"></i>
        </button>
      </div>
    `).join("");
  }).join("");

  return `
    <div style="margin-bottom: var(--space-md);">
      <div class="filter-tags">
        ${summaryItems}
      </div>
    </div>
    <button class="btn btn-sm btn-ghost"
            data-action="clearFilters"
            onclick="handleMenuAction(this)">
      <i class="fa fa-trash"></i>
      Clear all filters
    </button>
  `;
};
