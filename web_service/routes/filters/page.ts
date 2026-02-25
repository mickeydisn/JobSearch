import { CurrentState } from "../../types/index.ts";
import { buildFiltersPage as buildOriginalFiltersPage } from "./filters_controller.ts";
import { Page, registerPage } from "../../pages/page_registry.ts";

/** Build the filters page */
const buildFiltersPage = async (state: CurrentState): Promise<string> => {
  // Pass state directly to the filters page builder
  const content = await buildOriginalFiltersPage(state);

  return `
    <div id="page-content">
      ${content}
    </div>
  `;
};

/** Filters Page implementation */
const filtersPage: Page = {
  id: "filters",
  name: "Filter Manager",
  icon: "fa-filter",
  build: buildFiltersPage,
};

// Register the page
registerPage(filtersPage);

// Keep exports for backwards compatibility
export { buildFiltersPage };
