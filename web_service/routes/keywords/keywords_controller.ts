// deno-lint-ignore-file
import { CurrentState, KeywordSortBy } from "../../types/index.ts";
import { JobsEtl } from "../../../api_sqlite/table_jobs.ts";
import { Keywords } from "../../../api_sqlite/table_keywords.ts";

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
  const keywordsTable = new Keywords();
  
  // Get all keywords from the keywords table to get their stopword status and tags
  const allKeywordsData = await keywordsTable.search({}, 1000, 0);
  const keywordDataMap = new Map<string, { is_stopword: boolean; tags: string[] }>();
  for (const kw of allKeywordsData) {
    keywordDataMap.set(kw.keyword.toLowerCase(), {
      is_stopword: kw.is_stopword,
      tags: Array.isArray(kw.tags) ? kw.tags : [],
    });
  }
  
  // Get all available tags for the dropdown
  const allTags = await keywordsTable.getAllTags();
  
  // Get stopwords list
  const stopwords = await keywordsTable.getAllStopwords();
  
  const cleanFiltersState = cleanFilters(state.filters);
  
  // If there's a search term, filter keywords
  let keywords = await jobsEtl.aggJobKeywordScore(cleanFiltersState, 200);
  const searchTerm = state.keywordPage.searchTerm?.toLowerCase() || "";
  
  if (searchTerm) {
    keywords = keywords.filter(([name]) => 
      name.toLowerCase().includes(searchTerm)
    );
  }
  
  const sortedKeywords = sortKeywords(keywords, state.keywordPage.sortedBy);
  return buildKeywordsTable(sortedKeywords, state.keywordPage.sortedBy, state.keywordPage.searchTerm, keywordDataMap, allTags, stopwords);
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
 * Build tag dropdown options for a keyword
 */
const buildTagOptions = (
  keyword: string,
  currentTags: string[],
  allTags: string[],
): string => {
  const unusedTags = allTags.filter(t => !currentTags.includes(t));
  
  if (unusedTags.length === 0) {
    return `<option value="">No more tags available</option>`;
  }
  
  return unusedTags.map(tag => 
    `<option value="${encodeURIComponent(tag)}">${tag}</option>`
  ).join("");
};

/**
 * Build the keywords table HTML
 */
const buildKeywordsTable = (
  keywords: [string, number, number][],
  sortedBy: KeywordSortBy,
  searchTerm: string,
  keywordDataMap: Map<string, { is_stopword: boolean; tags: string[] }>,
  allTags: string[],
  stopwords: { keyword: string; is_stopword: boolean; tags: string[] }[],
): string => {
  const tableRows = keywords.map(([name, count, score], index) => {
    const keywordData = keywordDataMap.get(name.toLowerCase()) || { is_stopword: false, tags: [] };
    const isStopword = keywordData.is_stopword;
    const tags = keywordData.tags;
    const tagOptions = buildTagOptions(name, tags, allTags);
    const tagsDisplay = tags.length > 0 
      ? tags.map(tag => 
          `<span class="tag tag-primary" style="margin-right: 4px; margin-bottom: 4px; display: inline-block;">
            ${tag}
            <button class="btn btn-xs btn-ghost" 
                    style="padding: 0 4px; margin-left: 4px; color: inherit;"
                    data-action="removeKeywordTag"
                    data-keyword="${encodeURIComponent(name)}"
                    data-tag="${encodeURIComponent(tag)}"
                    onclick="handleMenuAction(this)">
              <i class="fa fa-times"></i>
            </button>
          </span>`
        ).join("")
      : '<span style="color: var(--color-gray-400); font-size: var(--font-size-sm);">No tags</span>';
    
    return `
      <tr>
        <td style="padding: var(--space-md); color: var(--color-gray-500);">${index + 1}</td>
        <td style="padding: var(--space-md);">
          <strong style="color: var(--color-gray-800);">${name}</strong>
          ${isStopword ? '<span class="tag tag-warning" style="margin-left: 8px;">STOPWORD</span>' : ''}
        </td>
        <td style="padding: var(--space-md); text-align: center;">${count}</td>
        <td style="padding: var(--space-md); text-align: center; font-family: monospace;">${score.toFixed(4)}</td>
        <td style="padding: var(--space-md); text-align: left;">
          <div style="margin-bottom: var(--space-sm);">
            ${tagsDisplay}
          </div>
          <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; align-items: center;">
            <!-- Add tag dropdown + input -->
            <div style="display: flex; gap: 4px; align-items: center;">
              <select class="form-select form-select-sm" 
                      style="width: auto; min-width: 80px;"
                      onchange="if(this.value) { handleMenuAction({ dataset: { action: 'addKeywordTag', keyword: '${encodeURIComponent(name)}', tag: this.value } }); this.value = ''; }">
                <option value="">+ Tag</option>
                ${tagOptions}
              </select>
              <input type="text" 
                     class="form-input form-input-sm"
                     style="width: 80px; padding: 4px 8px;"
                     placeholder="New..."
                     onkeyup="if(event.key === 'Enter' && this.value.trim()) { handleMenuAction({ dataset: { action: 'addKeywordTag', keyword: '${encodeURIComponent(name)}', tag: this.value.trim() } }); this.value = ''; }">
            </div>
            <!-- Add stopword button -->
            ${isStopword 
              ? `<button class="btn btn-warning btn-sm"
                        data-action="removeStopword"
                        data-keyword="${encodeURIComponent(name)}"
                        onclick="handleMenuAction(this)"
                        title="Remove from stopwords">
                  <i class="fa fa-check"></i> Stopword
                </button>`
              : `<button class="btn btn-secondary btn-sm"
                        data-action="addStopword"
                        data-keyword="${encodeURIComponent(name)}"
                        onclick="handleMenuAction(this)"
                        title="Add to stopwords">
                  <i class="fa fa-ban"></i> Stopword
                </button>`
            }
            <button class="btn btn-primary btn-sm"
                    data-action="addFilter"
                    data-filter-key="jobKeywordScore"
                    data-filter-value="${encodeURIComponent(name)}"
                    onclick="handleMenuAction(this)">
              <i class="fa fa-filter"></i>
            </button>
            <button class="btn btn-danger btn-sm"
                    data-action="addFilter"
                    data-filter-key="rejectedKeywords"
                    data-filter-value="${encodeURIComponent(name)}"
                    onclick="handleMenuAction(this)"
                    title="Exclude jobs containing this keyword">
              <i class="fa fa-ban"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Build stopwords list
  const stopwordsList = stopwords.length > 0 
    ? stopwords.map(sw => `
        <span class="tag tag-warning" style="margin: 4px; display: inline-block;">
          ${sw.keyword}
          <button class="btn btn-xs btn-ghost" 
                  style="padding: 0 4px; margin-left: 4px; color: inherit;"
                  data-action="removeStopword"
                  data-keyword="${encodeURIComponent(sw.keyword)}"
                  onclick="handleMenuAction(this)">
            <i class="fa fa-times"></i>
          </button>
        </span>
      `).join("")
    : '<p style="color: var(--color-gray-400); font-size: var(--font-size-sm);">No stopwords defined</p>';

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
            ${searchTerm ? ` (filtered by "${searchTerm}")` : ''}
          </p>
        </div>
      </div>
      
      <!-- Search Input -->
      <div style="padding: var(--space-md); border-bottom: 1px solid var(--color-gray-200);">
        <div style="display: flex; gap: var(--space-sm); align-items: center;">
          <div style="flex: 1; position: relative;">
            <i class="fa fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-gray-400);"></i>
            <input type="text" 
                   class="form-input" 
                   style="padding-left: 36px;"
                   placeholder="Search keywords..."
                   value="${searchTerm}"
                   onkeyup="if(event.key === 'Enter') { handleMenuAction({ dataset: { action: 'setKeywordSearch', searchTerm: this.value } }); }">
          </div>
          <button class="btn btn-primary"
                  data-action="setKeywordSearch"
                  data-search-term="${searchTerm}"
                  onclick="handleMenuAction({ dataset: { action: 'setKeywordSearch', searchTerm: this.previousElementSibling.querySelector('input').value } })">
            <i class="fa fa-search"></i> Search
          </button>
          ${searchTerm ? `
            <button class="btn btn-ghost"
                    data-action="setKeywordSearch"
                    data-search-term=""
                    onclick="handleMenuAction({ dataset: { action: 'setKeywordSearch', searchTerm: '' } })">
              <i class="fa fa-times"></i> Clear
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Collapsible Stopwords Section -->
      <div style="padding: var(--space-md); border-bottom: 1px solid var(--color-gray-200); background: var(--color-gray-50);">
        <details>
          <summary style="cursor: pointer; font-weight: 600; color: var(--color-gray-700);">
            <i class="fa fa-ban" style="color: var(--color-warning);"></i>
            Stopwords (${stopwords.length})
          </summary>
          <div style="margin-top: var(--space-md); padding: var(--space-sm);">
            ${stopwordsList}
          </div>
        </details>
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
              <th style="text-align: center;">Tags & Actions</th>
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
