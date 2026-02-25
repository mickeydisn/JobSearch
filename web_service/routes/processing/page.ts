import { CurrentState } from "../../types/index.ts";
import { buildProcessRunner } from "./components/runner.ts";
import { Page, registerPage } from "../../pages/page_registry.ts";

/** Build the processing page */
const buildProcessingPage = async (state: CurrentState): Promise<string> => {
  const processRunnerContent = await buildProcessRunner(state);

  return `
    <div class="details-group">
      <details class="details" open>
        <summary>
          <i class="fa fa-play-circle" style="color: var(--color-success);"></i>
          <strong>Process Runner</strong>
        </summary>
        <div class="details-content">
          ${processRunnerContent}
        </div>
      </details>
    </div>
  `;
};

/** Processing Page implementation */
const processingPage: Page = {
  id: "processing",
  name: "Processing",
  icon: "fa-cog",
  build: buildProcessingPage,
};

// Register the page
registerPage(processingPage);

// Keep exports for backwards compatibility
export { buildProcessingPage };
