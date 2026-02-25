// Import all pages to trigger registration
// This module ensures all pages are registered when imported

import "../routes/jobs/page.ts";
import "../routes/keywords/page.ts";
import "../routes/processing/page.ts";
import "../routes/analysis/page.ts";
import "../routes/filters/page.ts";

// Re-export registry functions for convenience
export type { Page } from "./page_registry.ts";
export {
  registerPage,
  getPage,
  getAllPages,
  hasPage,
  buildPageContent,
} from "./page_registry.ts";
