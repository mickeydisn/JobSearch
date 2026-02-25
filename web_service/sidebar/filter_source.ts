import { CurrentState } from "../types/index.ts";
import { SOURCE_FILTER_OPTIONS } from "./filter_config.ts";
import { JobsEtl } from "../../api_sqlite/table_jobs.ts";
import { JobsSave } from "../../api_sqlite/table_jobs_save.ts";

/** Build source filter section */
export const buildSourceFilter = async (state: CurrentState): Promise<string> => {
  const sourceFilter = state.filters.source;
  const currentSource = typeof sourceFilter === 'string' ? sourceFilter : Array.isArray(sourceFilter) ? sourceFilter[0] : "all-saved";

  // Get counts
  let etlCount = 0;
  let savedCount = 0;
  let archivedCount = 0;

  try {
    const jobsEtl = new JobsEtl();
    const etlJobs = await jobsEtl.search({}, 10000);
    etlCount = etlJobs.length;
  } catch {
    // Ignore errors
  }

  try {
    const jobsSave = new JobsSave();
    await jobsSave.createTable();
    savedCount = await jobsSave.getSavedCount();
    archivedCount = await jobsSave.getArchivedCount();
  } catch {
    // Table doesn't exist yet
  }

  const optionsHtml = SOURCE_FILTER_OPTIONS.map((option) => {
    const isActive = currentSource === option.value;
    const radioChecked = isActive ? 'checked' : '';

    return `
      <label class="source-option ${isActive ? 'active' : ''}" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm); border-radius: var(--radius-sm); cursor: pointer; margin-bottom: var(--space-xs);">
        <input type="radio" 
               name="source-filter" 
               value="${option.value}" 
               ${radioChecked}
               data-action="setSourceFilter"
               data-source="${option.value}"
               onchange="handleMenuAction(this)"
               style="display: none;">
        <span class="radio-custom" style="width: 16px; height: 16px; border: 2px solid var(--color-gray-400); border-radius: 50%; display: inline-block; position: relative; ${isActive ? 'border-color: var(--color-accent);' : ''}">
          ${isActive ? '<span style="position: absolute; top: 2px; left: 2px; width: 8px; height: 8px; background: var(--color-accent); border-radius: 50%;"></span>' : ''}
        </span>
        <span style="flex: 1;">
          <strong>${option.label}</strong>
          <span style="color: var(--color-gray-500); font-size: var(--font-size-sm);"> - ${option.description}</span>
        </span>
      </label>
    `;
  }).join("");

  return `
    <div class="filter-section" style="margin-bottom: var(--space-lg);">
      <div style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-gray-600); margin-bottom: var(--space-sm);">
        <i class="fa fa-database"></i> SOURCE
      </div>
      <div style="background: var(--color-gray-50); padding: var(--space-md); border-radius: var(--radius-md);">
        ${optionsHtml}
      </div>
      <div style="margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-gray-200); font-size: var(--font-size-sm); color: var(--color-gray-500);">
        <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-xs);">
          <span>ETL Jobs:</span>
          <strong>${etlCount.toLocaleString()}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-xs);">
          <span>Saved:</span>
          <strong style="color: var(--color-success);">${savedCount}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Archived:</span>
          <strong style="color: var(--color-gray-400);">${archivedCount}</strong>
        </div>
      </div>
    </div>
  `;
};
