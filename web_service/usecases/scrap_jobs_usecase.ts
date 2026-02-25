/**
 * Scrap Jobs Use Case
 * Implements the jobs_scrap.ts functionality using the JobUsecaseBase abstraction
 */

import { JobUsecaseBase } from '../core/job_usecase.ts';
import { JobsEtl } from '../../api_sqlite/table_jobs.ts';
import { KeywordFrequency } from '../../api_sqlite/table_keyword_frequency.ts';
import { saveDocuments } from '../../api_sqlite/db.ts';
import type { ScraperContext } from '../../scrap_tools/base_scraper.ts';

// Import scraper registry - this registers all scrapers
import { getEnabledScrapers, getScraper } from '../../scrap_tools/mod.ts';

/** Scrap Jobs Use Case */
export class ScrapJobsUsecase extends JobUsecaseBase {
  /** Optional specific scraper to run (if null, runs all enabled) */
  private specificScraper: string | null = null;
  /** Scraper context containing keyword frequencies and total jobs count */
  private scraperContext: ScraperContext = {
    keywordFreqMap: new Map(),
    totalJobs: 0,
  };

  constructor() {
    super(
      'scrap',
      'Scrape Jobs',
      'fa-download',
      'Scrape jobs from all enabled sources and calculate TF-IDF scores'
    );
  }

  /** Set a specific scraper to run (for individual scraper execution) */
  setSpecificScraper(scraperName: string | null): void {
    this.specificScraper = scraperName;
  }

  /** Get description based on execution mode */
  getDescription(): string {
    if (this.specificScraper) {
      return `Scrape jobs from ${this.specificScraper} source and calculate TF-IDF scores`;
    }
    return 'Scrape jobs from all enabled sources and calculate TF-IDF scores';
  }

  /** Main execution method */
  async execute(): Promise<void> {
    // Step 1: Load keyword frequencies for TF-IDF calculation
    await this.loadKeywordFrequencies();
    this.checkCancelled();

    // Step 2: Scrape from enabled sources
    let scrapersToRun;
    
    if (this.specificScraper) {
      // Run specific scraper
      const scraper = getScraper(this.specificScraper);
      if (!scraper) {
        this.logError(`Scraper '${this.specificScraper}' not found`);
        return;
      }
      if (!scraper.enabled) {
        this.logWarn(`Scraper '${this.specificScraper}' is disabled in configuration`);
        return;
      }
      scrapersToRun = [scraper];
      this.logInfo(`Running specific scraper: ${scraper.displayName}`);
    } else {
      // Run all enabled scrapers
      scrapersToRun = getEnabledScrapers();
      
      if (scrapersToRun.length === 0) {
        this.logWarn('No scrapers are enabled. Check app_configuration.json');
        return;
      }

      this.logInfo(`Found ${scrapersToRun.length} enabled scraper(s): ${scrapersToRun.map(s => s.displayName).join(', ')}`);
    }

    // Run scrapers with context for TF-IDF calculation
    for (const scraper of scrapersToRun) {
      await this.wrapOperation(`${scraper.displayName} Scraping`, async () => {
        await scraper.scrape(this.scraperContext);
      });
      this.checkCancelled();
      await this.sleep(2);
    }

    // Step 3: Save data to JSON
    await this.saveDataToJson();
  }

  /** Load keyword frequencies and total jobs count */
  private async loadKeywordFrequencies(): Promise<void> {
    await this.wrapOperation('Load Keyword Frequencies', async () => {
      const jobsEtl = new JobsEtl();
      const keywordFreq = new KeywordFrequency();

      const allJobs = await jobsEtl.search({}, 100000);
      this.scraperContext.totalJobs = allJobs.length;
      this.scraperContext.keywordFreqMap = await keywordFreq.getAllForIdf();
      
      this.logInfo(`Loaded ${this.scraperContext.keywordFreqMap.size} keywords, ${this.scraperContext.totalJobs} total jobs for TF-IDF calculation`);
    });
  }

  /** Save data to JSON files */
  private async saveDataToJson(): Promise<void> {
    await this.wrapOperation('Save Data to JSON', async () => {
      const jobsEtl = new JobsEtl();

      await saveDocuments(
        'jobs_raw',
        `./data/jobs_raw.ljson`
      );
      this.logInfo(`Saved jobs_raw to JSON`);

      await saveDocuments(
        jobsEtl.tableName,
        `./data/${jobsEtl.tableName}.ljson`
      );
      this.logInfo(`Saved ${jobsEtl.tableName} to JSON`);
    });
  }
}
