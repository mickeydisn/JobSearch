import { CurrentState } from "../../types/index.ts";
import { buildKeywordsPage as buildOriginalKeywordsPage } from "./keywords_controller.ts";
import { Page, registerPage } from "../../pages/page_registry.ts";

/** Build the keywords page */
const buildKeywordsPage = async (state: CurrentState): Promise<string> => {
  // Pass state directly to the keyword page builder
  const content = await buildOriginalKeywordsPage(state);

  return `
    <div id="page-content">
      ${content}
    </div>
  `;
};

/** Keywords Page implementation */
const keywordsPage: Page = {
  id: "keywords",
  name: "Keywords",
  icon: "fa-key",
  build: buildKeywordsPage,
};

// Register the page
registerPage(keywordsPage);

// Keep exports for backwards compatibility
export { buildKeywordsPage };
