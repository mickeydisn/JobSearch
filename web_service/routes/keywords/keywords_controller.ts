// deno-lint-ignore-file
import { CurrentState, KeywordSortBy } from "../../types/index.ts";
import { JobsEtl } from "../../../api_sqlite/table_jobs.ts";

// ----------------------------------
// KEYWORDS PAGE CONTROLLER

/** Clean filters by removing non-database fields */
const cleanFilters = (filters: Record<string, any>): Record<string, any> => {
  const cleaned = { ...filters };
  delete cleaned["source"];
  delete cleaned["rejectedKeywords"];
  return cleaned;
};

/**
 * Build the keywords page with table of top 200 keywords
 * Uses the state filters and sorting preference
 */
export const buildKeywordsPage = async (state: CurrentState): Promise<string> => {
  const jobsEtl = new JobsEtl();
  const cleanFiltersState = cleanFilters(state.filters);
  const keywords = await jobsEtl.aggJobKeywordScore(cleanFiltersState, 200);
  const sortedKeywords = sortKeywords(keywords, state.keywordPage.sortedBy);
  return buildKeywordsTable(sortedKeywords, state.keywordPage.sortedBy);
};

/**
 * Sort keywords based on the selected criteria
 */
const sortKeywords = (
  keywords: [string, number, number][],
  sortedBy: KeywordSortBy,
): [string, number, number][] => {
  const sorted = [...keywords];
  
  if (sortedBy === "count") {
    sorted.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[2] - a[2];
    });
  } else {
    sorted.sort((a, b) => {
      if (b[2] !== a[2]) return b[2] - a[2];
      return b[1] - a[1];
    });
  }
  
  return sorted;
};

/**
 * Build the keywords table HTML
 */
const buildKeywordsTable = (
  keywords: [string, number, number][],
  sortedBy: KeywordSortBy,
): string => {
  const tableRows = keywords.map(([name, count, score], index) => {
    return `
      <tr>
        <td style="padding: var(--space-md); color: var(--color-gray-500);">${index + 1}</td>
        <td style="padding: var(--space-md);">
          <strong style="color: var(--color-gray-800);">${name}</strong>
        </td>
        <td style="padding: var(--space-md); text-align: center;">${count}</td>
        <td style="padding: var(--space-md); text-align: center; font-family: monospace;">${score.toFixed(4)}</td>
        <td style="padding: var(--space-md); text-align: center;">
          <div style="display: flex; gap: var(--space-sm); justify-content: center;">
            <button class="btn btn-primary btn-sm"
                    data-action="addFilter"
                    data-filter-key="jobKeywordScore"
                    data-filter-value="${encodeURIComponent(name)}"
                    onclick="handleMenuAction(this)">
              <i class="fa fa-filter"></i>
              Filter
            </button>
            <button class="btn btn-danger btn-sm"
                    data-action="addFilter"
                    data-filter-key="rejectedKeywords"
                    data-filter-value="${encodeURIComponent(name)}"
                    onclick="handleMenuAction(this)"
                    title="Exclude jobs containing this keyword">
              <i class="fa fa-ban"></i>
              Reject
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h2 style="font-size: var(--font-size-xl); font-weight: 600;">
            <i class="fa fa-key" style="color: var(--color-accent);"></i>
            Keywords Dashboard
          </h2>
          <p style="font-size: var(--font-size-sm); color: var(--color-gray-500); margin-top: var(--space-xs);">
            Top ${keywords.length} keywords sorted by ${sortedBy === "count" ? "job count" : "average score"}
          </p>
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Keyword</th>
              <th style="text-align: center;">
                <button class="btn btn-ghost btn-sm ${sortedBy === "count" ? "active" : ""}"
                        style="font-weight: 600;"
                        data-action="setKeywordSort"
                        data-sort-value="count"
                        onclick="handleMenuAction(this)">
                  Job Count ${sortedBy === "count" ? "▼" : ""}
                </button>
              </th>
              <th style="text-align: center;">
                <button class="btn btn-ghost btn-sm ${sortedBy === "score" ? "active" : ""}"
                        style="font-weight: 600;"
                        data-action="setKeywordSort"
                        data-sort-value="score"
                        onclick="handleMenuAction(this)">
                  Avg Score ${sortedBy === "score" ? "▼" : ""}
                </button>
              </th>
              <th style="text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || `
              <tr>
                <td colspan="5" style="padding: var(--space-xl); text-align: center; color: var(--color-gray-500);">
                  <i class="fa fa-inbox" style="font-size: 48px; margin-bottom: var(--space-md); color: var(--color-gray-300);"></i>
                  <p>No keywords found</p>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>

    <div class="stats-grid" style="margin-top: var(--space-lg);">
      <div class="stat-card">
        <div class="stat-value">${keywords.length}</div>
        <div class="stat-label">Total Keywords</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${keywords.reduce((sum, [, count]) => sum + count, 0)}</div>
        <div class="stat-label">Total Job References</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${keywords.length > 0 ? keywords[0][0] : "-"}</div>
        <div class="stat-label">Top Keyword</div>
      </div>
    </div>
  `;
};
