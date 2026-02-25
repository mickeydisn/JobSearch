// deno-lint-ignore-file
import { CurrentState } from "../../types/index.ts";
import { FilterProfile } from "../../../api_sqlite/table_filter_profile.ts";

/**
 * Build the filters page with saved filter profiles
 */
export const buildFiltersPage = async (state: CurrentState): Promise<string> => {
  const filterProfile = new FilterProfile();
  
  // Create table if it doesn't exist
  await filterProfile.createTable();
  
  const profiles = await filterProfile.search({}, 100);
  
  return buildFiltersContent(profiles, state.filters);
};

/**
 * Build the HTML content for the filters page
 */
const buildFiltersContent = (
  profiles: { id: string; name: string; filters: string | Record<string, string[]>; created_at: string; updated_at: string }[],
  currentFilters: Record<string, string[]>,
): string => {
  // Build header section with save form
  const headerHtml = buildHeader(currentFilters);
  
  // Build table of saved profiles
  const tableHtml = buildProfileTable(profiles);
  
  return `
    <div id="page-content">
      ${headerHtml}
      ${tableHtml}
    </div>
  `;
};

/**
 * Build the header with save filter form
 */
const buildHeader = (currentFilters: Record<string, string[]>): string => {
  const hasFilters = Object.keys(currentFilters).length > 0;
  const filtersJson = JSON.stringify(currentFilters);
  
  return `
    <div class="card" style="margin-bottom: var(--space-lg);">
      <div class="card-header">
        <h2 style="font-size: var(--font-size-xl); font-weight: 600;">
          <i class="fa fa-save" style="color: var(--color-accent);"></i>
          Save Current Filter
        </h2>
        <p style="font-size: var(--font-size-sm); color: var(--color-gray-500); margin-top: var(--space-xs);">
          Save your current filter configuration as a named profile
        </p>
      </div>
      <div class="card-body">
        <div style="display: flex; gap: var(--space-md); align-items: flex-end;">
          <input type="hidden" id="saveFilterFilters" value="${encodeURIComponent(filtersJson)}" />
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label for="profileName" style="font-weight: 500;">Profile Name</label>
            <input type="text" 
                   id="profileName" 
                   class="form-control" 
                   placeholder="e.g., Remote Java Jobs"
                   ${!hasFilters ? "disabled" : ""}
                   required />
          </div>
          <button class="btn btn-primary" 
                  id="saveFilterBtn"
                  ${!hasFilters ? "disabled" : ""}
                  data-action="saveFilterProfile"
                  onclick="handleSaveFilterAction(this)">
            <i class="fa fa-save"></i>
            Save Filter
          </button>
        </div>
        ${!hasFilters ? `
          <p style="font-size: var(--font-size-sm); color: var(--color-gray-500); margin-top: var(--space-sm);">
            <i class="fa fa-info-circle"></i>
            Apply some filters on the Jobs page to save them as a profile.
          </p>
        ` : ""}
      </div>
    </div>
  `;
};

/**
 * Build the table of saved filter profiles
 */
const buildProfileTable = (
  profiles: { id: string; name: string; filters: string | Record<string, string[]>; created_at: string; updated_at: string }[],
): string => {
  if (profiles.length === 0) {
    return `
      <div class="card">
        <div class="card-body" style="text-align: center; padding: var(--space-xl);">
          <i class="fa fa-filter" style="font-size: 48px; margin-bottom: var(--space-md); color: var(--color-gray-300);"></i>
          <h3 style="color: var(--color-gray-600);">No Saved Filters</h3>
          <p style="color: var(--color-gray-500);">Save your first filter profile from the Jobs page.</p>
        </div>
      </div>
    `;
  }
  
  const rows = profiles.map((profile) => {
    let filtersDisplay = "";
    try {
      // The filters field may already be deserialized as an object by the DB layer
      // or it may still be a string - handle both cases
      let filters: Record<string, string[]>;
      if (typeof profile.filters === 'string') {
        filters = JSON.parse(profile.filters);
      } else if (typeof profile.filters === 'object' && profile.filters !== null) {
        filters = profile.filters as Record<string, string[]>;
      } else {
        throw new Error('Invalid filters format');
      }
      filtersDisplay = formatFiltersForDisplay(filters);
    } catch (e) {
      console.error('Error parsing filters for profile:', profile.id, profile.name, e);
      filtersDisplay = '<span style="color: var(--color-gray-500);">Invalid filter data</span>';
    }
    
    const createdDate = new Date(profile.created_at).toLocaleDateString();
    const updatedDate = new Date(profile.updated_at).toLocaleDateString();
    
    return `
      <tr>
        <td style="padding: var(--space-md);">
          <strong>${escapeHtml(profile.name)}</strong>
        </td>
        <td style="padding: var(--space-md); font-size: var(--font-size-sm); color: var(--color-gray-600);">
          ${filtersDisplay}
        </td>
        <td style="padding: var(--space-md); font-size: var(--font-size-sm); color: var(--color-gray-500);">
          Created: ${createdDate}<br/>
          Updated: ${updatedDate}
        </td>
        <td style="padding: var(--space-md);">
          <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm"
                    data-action="applyFilterProfile"
                    data-profile-id="${profile.id}"
                    onclick="handleMenuAction(this)"
                    title="Replace current filters with this profile">
              <i class="fa fa-exchange"></i>
              Apply
            </button>
            <button class="btn btn-secondary btn-sm"
                    data-action="addFilterProfile"
                    data-profile-id="${profile.id}"
                    onclick="handleMenuAction(this)"
                    title="Add these filters to current filters">
              <i class="fa fa-plus"></i>
              Add
            </button>
            <button class="btn btn-danger btn-sm"
                    data-action="deleteFilterProfile"
                    data-profile-id="${profile.id}"
                    onclick="handleMenuAction(this)"
                    title="Delete this filter profile">
              <i class="fa fa-trash"></i>
              Remove
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
  
  return `
    <div class="card">
      <div class="card-header">
        <h2 style="font-size: var(--font-size-xl); font-weight: 600;">
          <i class="fa fa-filter" style="color: var(--color-accent);"></i>
          Saved Filter Profiles
        </h2>
        <p style="font-size: var(--font-size-sm); color: var(--color-gray-500); margin-top: var(--space-xs);">
          ${profiles.length} saved filter profile${profiles.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Filters</th>
              <th>Dates</th>
              <th style="text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

/**
 * Format filters object for display
 */
const formatFiltersForDisplay = (filters: Record<string, string[]>): string => {
  const parts: string[] = [];
  
  for (const [key, values] of Object.entries(filters)) {
    // Skip non-array filter values (like source filter which is a string)
    if (!Array.isArray(values) || values.length === 0) {
      continue;
    }
    const displayKey = key.replace(/([A-Z])/g, " $1").trim(); // Add spaces before capitals
    const displayValues = values.slice(0, 3).join(", ");
    const moreText = values.length > 3 ? ` +${values.length - 3} more` : "";
    parts.push(`<strong>${escapeHtml(displayKey)}</strong>: ${escapeHtml(displayValues)}${moreText}`);
  }
  
  return parts.length > 0 
    ? parts.join('<span style="margin: 0 8px; color: var(--color-gray-400);">|</span>')
    : '<span style="color: var(--color-gray-500);">No filters</span>';
};

/**
 * Escape HTML to prevent XSS
 */
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "'")
    .replace(/'/g, "&#039;");
};
