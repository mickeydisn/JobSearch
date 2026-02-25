// Scraper Registry
// Provides a pluggable system for job scrapers

import type { ScraperContext } from "./base_scraper.ts";

/** Scraper interface that all scrapers must implement */
export interface Scraper {
  /** Unique name for this scraper */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** Whether this scraper is enabled in config */
  enabled: boolean;
  /** Main scraping function - context is passed for TF-IDF calculation */
  scrape(context: ScraperContext): Promise<void>;
}

/** Registry of all available scrapers */
const scrapers = new Map<string, Scraper>();

/** Register a new scraper */
export function registerScraper(scraper: Scraper): void {
  scrapers.set(scraper.name, scraper);
}

/** Get all registered scrapers */
export function getAllScrapers(): Scraper[] {
  return Array.from(scrapers.values());
}

/** Get only enabled scrapers */
export function getEnabledScrapers(): Scraper[] {
  return getAllScrapers().filter(s => s.enabled);
}

/** Get a specific scraper by name */
export function getScraper(name: string): Scraper | undefined {
  return scrapers.get(name);
}

/** Check if a scraper is registered */
export function hasScraper(name: string): boolean {
  return scrapers.has(name);
}

/** Clear all registered scrapers (useful for testing) */
export function clearScrapers(): void {
  scrapers.clear();
}
