import { FilterSectionConfig, FilterOption, CountFormatter, defaultCountFormatter } from "./types.ts";

/** Build a filter section with collapsible header and selectable options */
export const buildFilterSection = (config: FilterSectionConfig, countFormatter?: CountFormatter): string => {
  const {
    id,
    title,
    icon,
    filterKey,
    options,
    selectedValues,
    emptyMessage = "No items found",
  } = config;

  const formatter = countFormatter || defaultCountFormatter;
  const hasOptions = options.length > 0;

  // Build options HTML
  const optionsHtml = hasOptions
    ? options.map((opt) => buildFilterOption(opt, filterKey, selectedValues, formatter)).join("")
    : `<p style="color: var(--color-gray-500); font-size: var(--font-size-sm);"><i>${emptyMessage}</i></p>`;

  // Build header badge if items are selected
  const badgeHtml = selectedValues.length > 0
    ? `<span class="badge badge-primary">${selectedValues.length}</span>`
    : "";

  return `
    <div class="box" style="margin-bottom: var(--space-md);">
      <div class="box-header" onclick="toggleElement('FH_${id}')" style="cursor: pointer;">
        <div class="box-title" style="display: flex; align-items: center; gap: var(--space-sm);">
          <i class="fa ${icon}" style="color: var(--color-gray-400);"></i>
          ${title}
          ${badgeHtml}
        </div>
        <i class="fa fa-chevron-down" style="color: var(--color-gray-400);"></i>
      </div>
      <div id="FH_${id}" class="box-body hidden" style="padding-top: 0;">
        <div class="select-list">
          ${optionsHtml}
        </div>
      </div>
    </div>
  `;
};

/** Build a single filter option item */
const buildFilterOption = (
  option: FilterOption,
  filterKey: string,
  selectedValues: string[],
  countFormatter: CountFormatter,
): string => {
  const isSelected = selectedValues.includes(option.value);
  const encodedValue = encodeURIComponent(option.value);
  const displayText = option.displayText || option.value;
  const countText = countFormatter(option);

  return `
    <div class="select-item ${isSelected ? "selected" : ""}"
         data-action="toggleFilter"
         data-filter-key="${filterKey}"
         data-filter-value="${encodedValue}"
         onclick="handleMenuAction(this)">
      <span>${displayText}</span>
      <span class="select-item-count">${countText}</span>
    </div>
  `;
};

/** Build multiple filter sections */
export const buildFilterSections = (sections: FilterSectionConfig[]): string => {
  return sections.map((section) => buildFilterSection(section)).join("");
};
