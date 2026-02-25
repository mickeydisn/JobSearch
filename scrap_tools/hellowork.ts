// Import necessary modules
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { sleep } from "https://deno.land/x/sleep@v1.3.0/mod.ts";
import { JobsRaw, JobsRawType } from "../api_sqlite/table_jobs_raw.ts";
import { JobsEtl, JobsEtlType } from "../api_sqlite/table_jobs.ts";
import { getDb } from "../api_sqlite/db.ts";
import { registerScraper } from "./scraper_registry.ts";
import { loadConfig, type ScraperConfig } from "../web_service/core/config_manager.ts";
import { calculateTfIdfScores } from "../utils/tfidf.ts";
import type { ScraperContext } from "./base_scraper.ts";

// Hardcoded HelloWork constants
const HELLOWORK_BASE_URL = "https://www.hellowork.com";

const commonUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/** Get fresh scraper config */
async function getScraperConfig(): Promise<ScraperConfig> {
  const config = await loadConfig();
  return config.scrap_jobs.hellowork;
}

/** Extract job details from a HelloWork offer page */
export async function scrapeHelloWorkOffer(offerLink: string) {
  try {
    const response = await fetch(offerLink, {
      headers: {
        "User-Agent": commonUserAgent,
      },
    });

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) {
      console.error("Failed to parse the HTML.");
      return;
    }

    // Test if offer is dead
    const divs = Array.from(doc.querySelectorAll("div.tw-h-full")).map((el) =>
      Array.from(el.querySelectorAll("span"))
    ).flat();
    const isTextFound = divs.some((div) =>
      div.textContent.includes("n'est plus disponible")
    );
    if (isTextFound) {
      console.error("Job Not Found");
      return;
    }

    const jobTitle = doc.querySelector('span[data-cy="jobTitle"]');

    // Extract enterprise links
    const allLinks = doc.querySelectorAll("a");
    const entrepriseLinks = Array.from(allLinks)
      .filter((el) =>
        el.getAttribute("href")?.startsWith("/fr-fr/entreprises/")
      )
      .map((el) => ({
        name: el.textContent.trim(),
        link: el.getAttribute("href") || "",
      }))[0];

    // Try to find date from old selector first, then from page text
    let date = "";
    const allDate = doc.querySelectorAll(
      "span.tw-block.tw-typo-xs.tw-text-grey.tw-break-words",
    );
    const dates = Array.from(allDate).map((el) => el.textContent.trim());
    if (dates.length > 0) {
      date = dates[0];
    }
    
    // If no date found, try to extract from page text using regex
    if (!date) {
      const pageText = doc.textContent || "";
      const dateMatch = pageText.match(/Publiée? le (\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) {
        date = dateMatch[0];
      }
    }

    // Job description is in section elements (HTML structure changed)
    const allJobText = doc.querySelectorAll("section");
    const jobText = Array.from(allJobText)
      .map((el) => el.textContent.trim())
      .filter((text) => text.length > 50) // Filter out empty/short sections
      .join("\n\n"); // Join sections with double newline

    const jobHtml = Array.from(allJobText)
      .map((el) => el.innerHTML)
      .filter((html) => html.length > 100) // Filter out empty sections
      .join("\n"); // Join HTML sections

    return {
      title: jobTitle?.textContent || "",
      company: entrepriseLinks?.name || "",
      entrepriseLinks: entrepriseLinks?.link || "",
      date: date,
      jobText: jobText,
      jobHtml: jobHtml,
    };
  } catch (error) {
    const err = error as Error;
    console.error("Error scraping HelloWork:", err.message);
    return;
  }
}

/** Search for jobs on HelloWork */
async function scrapeHelloWorkSearch(keysearch: string, page: number, scraperConfig: ScraperConfig) {
  try {
    const URL = `${HELLOWORK_BASE_URL}/fr-fr/emploi/recherche.html?` +
      `k=${keysearch}&k_autocomplete=` +
      `&l=${scraperConfig.filters.location}&l_autocomplete=${encodeURIComponent(scraperConfig.filters.locationAutocomplete || "")}` +
      `&st=relevance&ray=${scraperConfig.filters.radius || 20}&d=all&p=${page}`;

    const response = await fetch(URL, {
      headers: {
        "User-Agent": commonUserAgent,
      },
    });

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) {
      console.error("Failed to parse the HTML.");
      return;
    }

    const jobBlocs = doc.querySelectorAll("div[data-cy='serpCard']");

    return Array.from(jobBlocs).map((el) => {
      const jobLinks = el.querySelectorAll("a[data-cy='offerTitle']")[0];
      const loc = el.querySelectorAll("div[data-cy='localisationCard']")[0];
      const contract = el.querySelectorAll("div[data-cy='contractCard']")[0];
      const tag = el.querySelectorAll("div[data-cy='contractTag']")[0];

      const link = jobLinks.getAttribute("href") || "";

      function extractIdFromUrl(url: string): string {
        const match = url.match(/\/fr-fr\/emplois\/(\d+)\.html/);
        return match ? match[1] : "";
      }
      const jobId = extractIdFromUrl(link);

      return {
        title: jobLinks.textContent.trim(),
        link: HELLOWORK_BASE_URL + link,
        id: `hellowork-${jobId}`,
        loc: loc ? loc.textContent.trim() : "",
        contract: contract ? contract.textContent.trim() : "",
        tag: tag ? [tag.textContent.trim()] : [],
      };
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error scraping HelloWork:", err.message);
    return [];
  }
}

/** HelloWork Scraper Class with Batch Processing */
class HelloWorkScraper {
  /**
   * Get existing job IDs from jobs_raw table (as reference)
   */
  private getExistingJobIds(jobIds: string[]): Set<string> {
    if (jobIds.length === 0) return new Set();
    const db = getDb();
    const placeholders = jobIds.map(() => "?").join(",");
    const results = [...db.query(
      `SELECT id FROM jobs_raw WHERE id IN (${placeholders})`,
      jobIds
    )];
    return new Set(results.map((row) => row[0] as string));
  }

  /**
   * Batch insert jobs to jobs_raw table
   */
  private batchInsertJobsRaw(jobs: JobsRawType[]): void {
    if (jobs.length === 0) return;

    const db = getDb();

    // Get all fields from schema
    const fields = Object.keys(JobsRaw.schema);
    const fieldList = fields.join(", ");
    const placeholders = fields.map(() => "?").join(", ");

    const sql = `INSERT INTO jobs_raw (${fieldList}) VALUES (${placeholders})`;

    for (const job of jobs) {
      const values: (string | number | null)[] = fields.map((field) => {
        const value = (job as Record<string, unknown>)[field];
        if (value === undefined || value === null) return null;
        if (Array.isArray(value) || typeof value === "object") {
          return JSON.stringify(value);
        }
        return String(value);
      });
      db.query(sql, values);
    }
  }

  /**
   * Batch insert jobs to jobs_etl table
   */
  private batchInsertJobs(jobs: JobsEtlType[]): void {
    if (jobs.length === 0) return;

    const db = getDb();

    // Get all fields from schema
    const fields = Object.keys(JobsEtl.schema);
    const fieldList = fields.join(", ");
    const placeholders = fields.map(() => "?").join(", ");

    const sql = `INSERT INTO jobs_etl (${fieldList}) VALUES (${placeholders})`;

    for (const job of jobs) {
      const values: (string | number | null)[] = fields.map((field) => {
        const value = (job as Record<string, unknown>)[field];
        if (value === undefined || value === null) return null;
        if (Array.isArray(value) || typeof value === "object") {
          return JSON.stringify(value);
        }
        return String(value);
      });
      db.query(sql, values);
    }
  }

  /** Scrape a single search page with batch processing */
  private async scrapeHelloWorkSearchPage(
    search: string,
    page: number,
    context: ScraperContext,
    scraperConfig: ScraperConfig
  ): Promise<{ processed: number; newJobs: number }> {
    let processed = 0;
    let newJobs = 0;

    try {
      const jobsInfo = await scrapeHelloWorkSearch(search, page, scraperConfig) || [];
      console.log(`Found job - ${jobsInfo.length}`);

      // Collect all job IDs to check existence in bulk
      const jobIds = jobsInfo.map((job: { id: string }) => job.id);
      const existingIds = this.getExistingJobIds(jobIds);
      const newJobsList: JobsRawType[] = [];

      // Scrape each job detail
      let scrapCount = 0;
      const totalToScrap = jobIds.length - existingIds.size;

      for (const job of jobsInfo) {
        processed++;

        // Skip if already exists
        if (existingIds.has(job.id)) {
          continue;
        }

        scrapCount++;
        console.log(`- Scap Job ${scrapCount}/${totalToScrap} - ${job.id}`);

        const jobInfo = await scrapeHelloWorkOffer(job.link);

        if (jobInfo) {
          console.log(`- Scap Job OK - ${job.id}`);
          const jobFull: JobsRawType = {
            createAt: new Date().toISOString(),
            scraper: "hellowork",
            updateAt: new Date().toISOString(),
            status: "New",
            ...job,
            ...jobInfo,
          };
          newJobsList.push(jobFull);
        } else {
          console.log(`- Scap Job not found - ${job.id}`);
        }
        await sleep(scraperConfig.delayBetweenRequests);
      }

      // Batch process new jobs - save to both jobs_raw and jobs_etl
      if (newJobsList.length > 0) {
        // First save raw jobs to jobs_raw table
        this.batchInsertJobsRaw(newJobsList);
        console.log(`Saved ${newJobsList.length} jobs to jobs_raw`);

        // Then convert to ETL and save to jobs_etl
        const jobsEtl = new JobsEtl();
        const etlJobs: JobsEtlType[] = [];

        for (const rawJob of newJobsList) {
          const etlJob = jobsEtl.fromRaw(rawJob);
          const jobKeywordScore = calculateTfIdfScores(
            etlJob.jobKeywords,
            context.keywordFreqMap,
            context.totalJobs
          );
          etlJobs.push({ ...etlJob, jobKeywordScore });
        }

        // Batch insert to ETL
        this.batchInsertJobs(etlJobs);
        newJobs = etlJobs.length;
        console.log(`${newJobs} New Job Find`);
      } else {
        console.log(`- Scap Job .. All jobs already exist`);
      }
    } catch (error) {
      const err = error as Error;
      console.error("Error scraping HelloWork page:", err.message);
    }

    return { processed, newJobs };
  }

  /** Main entry point for HelloWork scraping */
  async scrape(context: ScraperContext): Promise<void> {
    const scraperConfig = await getScraperConfig();

    if (!scraperConfig.enabled) {
      console.log("HelloWork scraper is disabled");
      return;
    }

    const searchs = scraperConfig.searchKeywords;
    let totalProcessed = 0;
    let totalNew = 0;

    for (const search of searchs) {
      console.log(`\n=== HelloWork: Searching for "${search}" ===`);
      const rangeArray = Array.from({ length: scraperConfig.pages }, (_, i) => i);

      for (const i of rangeArray) {
        console.log(`Search page : ${i + 1}/${scraperConfig.pages}`);
        const { processed, newJobs } = await this.scrapeHelloWorkSearchPage(search, i, context, scraperConfig);
        totalProcessed += processed;
        totalNew += newJobs;
      }
    }

    console.log(`\n=== HelloWork Scrape Complete: ${totalProcessed} processed, ${totalNew} new jobs ===`);
  }
}

// Register the scraper
async function registerHelloWorkScraper() {
  const scraperConfig = await getScraperConfig();
  const scraper = new HelloWorkScraper();

  registerScraper({
    name: "hellowork",
    displayName: "HelloWork",
    enabled: scraperConfig.enabled,
    scrape: (context: ScraperContext) => scraper.scrape(context),
  });
}

// Register on module load
registerHelloWorkScraper();
