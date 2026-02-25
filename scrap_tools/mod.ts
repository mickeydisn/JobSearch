// Scraper Module
// Import this module to register all scrapers

// Import all scrapers - this triggers their registration
import "./linkedin.ts";
import "./hellowork.ts";
import "./welcome.ts";

// Re-export registry functions
export {
  getAllScrapers,
  getEnabledScrapers,
  getScraper,
  hasScraper,
  registerScraper,
  clearScrapers,
  type Scraper,
} from "./scraper_registry.ts";

// Re-export base scraper types
export {
  BaseScraper,
  type ScraperContext,
} from "./base_scraper.ts";
