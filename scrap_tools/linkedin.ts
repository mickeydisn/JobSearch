// Import necessary modules
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { sleep } from "https://deno.land/x/sleep@v1.3.0/mod.ts";
import { JobsRaw, JobsRawType } from "../api_sqlite/table_jobs_raw.ts";
import { JobsEtl, JobsEtlType } from "../api_sqlite/table_jobs.ts";
import { getDb } from "../api_sqlite/db.ts";
import { fetchWithTimeout } from "../utils/crypto_and_fetch.ts";
import { registerScraper } from "./scraper_registry.ts";
import { loadConfig, type ScraperConfig } from "../web_service/core/config_manager.ts";
import { calculateTfIdfScores } from "../utils/tfidf.ts";
import type { ScraperContext } from "./base_scraper.ts";

// Hardcoded LinkedIn constants
const LINKEDIN_BASE_URL = "https://www.linkedin.com";

const commonUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

// Timeout for individual requests (10 seconds)
const REQUEST_TIMEOUT = 10000;

/** Get fresh scraper config */
async function getScraperConfig(): Promise<ScraperConfig> {
  const config = await loadConfig();
  return config.scrap_jobs.linkedin;
}

/** Result type for LinkedIn offer scraping */
export type ScrapeResult = 
  | { success: true; data: { title: string; entrepriseLinks: string; company: string; jobText: string; jobHtml: string; tag: string[] } }
  | { success: false; notFound: true }
  | { success: false; error: string };

/** Extract job details from a LinkedIn offer page */
export async function scrapeLinkedInOffer(offerLink: string): Promise<ScrapeResult> {
  try {
    const response = await fetchWithTimeout(offerLink, {
      headers: {
        "User-Agent": commonUserAgent,
      },
    }, REQUEST_TIMEOUT);

    const htmlraw = await response.text();
    const html = htmlraw.replaceAll("&#039;", "'");
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) {
      console.error("Failed to parse the HTML.");
      return { success: false, error: "HTML_PARSE_ERROR" };
    }

    // Test if offer is dead (3 different checks)
    {
      const divs = Array.from(doc.querySelectorAll("h1"));
      const isTextFound = divs.some((div) =>
        div.textContent.includes("Oups, cette page est introuvable")
      );
      if (isTextFound) {
        console.error("Job Not Found: Oups, cette page est introuvable");
        return { success: false, notFound: true };
      }
    }
    {
      const divs = Array.from(
        doc.querySelectorAll("span.artdeco-inline-feedback__message"),
      );
      const isTextFound = divs.some((div) =>
        div.textContent.includes("No longer accepting applications")
      );
      if (isTextFound) {
        console.error("Job Not Found: No longer accepting applications");
        return { success: false, notFound: true };
      }
    }
    {
      const divs = Array.from(doc.querySelectorAll("h2.subheading"));
      const isTextFound = divs.some((div) =>
        div.textContent.includes("we can't seem to find the page you're looking for")
      );
      if (isTextFound) {
        console.error("Job Not Found: we can't seem to find the page");
        return { success: false, notFound: true };
      }
    }

    // JOB TITLE
    const jobTitle = doc.querySelector("h1.top-card-layout__title");
    if (!jobTitle) {
      console.error("Job Not Found: No title found");
      return { success: false, notFound: true };
    }

    const entrepriseLinks = Array.from(
      doc.querySelectorAll("a.topcard__org-name-link"),
    ).map((el) => ({
      name: el.textContent.trim(),
      link: el.getAttribute("href") || "",
    }))[0];

    const allJobText = doc.querySelectorAll("div.description__text");
    const jobText = Array.from(allJobText)
      .map((el) => el.textContent.trim())
      .filter(Boolean)
      .join("");

    const jobHtml = Array.from(allJobText)
      .map((el) => el.innerHTML)
      .filter(Boolean)
      .join("");

    const jobTag = doc.querySelectorAll("span.description__job-criteria-text");
    const tags = Array.from(jobTag).map((el) => el.innerHTML.trim());

    return {
      success: true,
      data: {
        title: jobTitle?.textContent || "",
        entrepriseLinks: entrepriseLinks?.link || "",
        company: entrepriseLinks?.name || "",
        jobText: jobText,
        jobHtml: jobHtml,
        tag: tags,
      }
    };
  } catch (error) {
    const err = error as Error;
    console.error("Error scraping LinkedIn:", err.message);
    return { success: false, error: err.message };
  }
}

/** Search for jobs on LinkedIn */
async function scrapeLinkedInSearch(keysearch: string, page: number, scraperConfig: ScraperConfig) {
  try {
    const URL = `${LINKEDIN_BASE_URL}/jobs/search?` +
      `keywords=${keysearch}` +
      `&location=${scraperConfig.filters.location}&geoId=${scraperConfig.filters.geoId || ""}` +
      `&position=1` +
      `&pageNum=${page}`;

    const response = await fetchWithTimeout(URL, {
      headers: {
        "User-Agent": commonUserAgent,
      },
    }, REQUEST_TIMEOUT);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) {
      console.error("Failed to parse the HTML.");
      return;
    }

    const jobBlocs = doc.querySelectorAll("div.base-search-card--link");

    return Array.from(jobBlocs).map((el) => {
      const jobLinks = el.querySelectorAll("a.base-card__full-link")[0];
      const link = jobLinks.getAttribute("href") || "";
      const linkdecode = decodeURIComponent(link);
      const jobTitle = el.querySelectorAll("span.sr-only")[0];
      const loc = el.querySelectorAll("span.job-search-card__location")[0];
      const date = el.querySelectorAll("time.job-search-card__listdate")[0];

      function extractStartFromUrl(url: string): string {
        const match = url.match(/^(.*)\?/);
        return match ? match[1] : "";
      }

      function extractIdFromUrl(url: string): string {
        const match = url.match(/jobs\/view\/(.*)\?/);
        return match ? match[1] : "";
      }
      const jobId = "linkedin-" + extractIdFromUrl(linkdecode);

      return {
        title: jobTitle.textContent.trim(),
        link: extractStartFromUrl(linkdecode),
        id: jobId,
        loc: loc ? loc.textContent.trim() : "",
        contract: "CDI",
        date: date?.getAttribute("datetime")?.replaceAll("-", "/") || "",
      };
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error scraping LinkedIn:", err.message);
    return [];
  }
}

/** LinkedIn Scraper Class with Batch Processing */
class LinkedInScraper {
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
  private async scrapeLinkedInSearchPage(
    search: string,
    page: number,
    context: ScraperContext,
    scraperConfig: ScraperConfig
  ): Promise<{ processed: number; newJobs: number }> {
    let processed = 0;
    let newJobs = 0;

    try {
      const jobsInfo = await scrapeLinkedInSearch(search, page, scraperConfig) || [];
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

        const result = await scrapeLinkedInOffer(job.link);

        if (result.success) {
          // Job found - save with status "New"
          console.log(`- Scap Job OK - ${job.id}`);
          const jobFull: JobsRawType = {
            createAt: new Date().toISOString(),
            scraper: "linkedin",
            updateAt: new Date().toISOString(),
            status: "New",
            ...job,
            ...result.data,
          };
          newJobsList.push(jobFull);
        } else if ("notFound" in result && result.notFound) {
          // Job not found - save with status "ERROR_NO_EXIST"
          console.log(`- Scap Job not found - ${job.id}`);
          const jobFull: JobsRawType = {
            id: job.id,
            createAt: new Date().toISOString(),
            scraper: "linkedin",
            updateAt: new Date().toISOString(),
            status: "ERROR_NO_EXIST",
            title: job.title,
            link: job.link,
            loc: job.loc,
            tag: [],
            contract: job.contract,
            entrepriseLinks: "",
            date: job.date,
            jobHead: "",
            jobText: "",
            jobHtml: "",
            company: "",
            titleKey: [],
            dateClean: "2024/01/01",
          };
          newJobsList.push(jobFull);
        } else {
          // Other error - log but don't save
          const errorResult = result as { success: false; error: string };
          console.log(`- Scap Job error - ${job.id}`);
          console.error(`  ! Error scraping job ${job.id}:`, errorResult.error);
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

      await sleep(3);
    } catch (error) {
      const err = error as Error;
      console.error("Error scraping LinkedIn page:", err.message);
    }

    return { processed, newJobs };
  }

  /** Main entry point for LinkedIn scraping */
  async scrape(context: ScraperContext): Promise<void> {
    const scraperConfig = await getScraperConfig();

    if (!scraperConfig.enabled) {
      console.log("LinkedIn scraper is disabled");
      return;
    }

    const searchs = scraperConfig.searchKeywords;
    let totalProcessed = 0;
    let totalNew = 0;

    for (const search of searchs) {
      console.log(`\n=== LinkedIn: Searching for "${search}" ===`);
      const rangeArray = Array.from({ length: scraperConfig.pages }, (_, i) => i);

      for (const i of rangeArray) {
        console.log(`Search page : ${i + 1}/${scraperConfig.pages}`);
        const { processed, newJobs } = await this.scrapeLinkedInSearchPage(search, i, context, scraperConfig);
        totalProcessed += processed;
        totalNew += newJobs;
      }
    }

    console.log(`\n=== LinkedIn Scrape Complete: ${totalProcessed} processed, ${totalNew} new jobs ===`);
  }
}

// Register the scraper
async function registerLinkedInScraper() {
  const scraperConfig = await getScraperConfig();
  const scraper = new LinkedInScraper();

  registerScraper({
    name: "linkedin",
    displayName: "LinkedIn",
    enabled: scraperConfig.enabled,
    scrape: (context: ScraperContext) => scraper.scrape(context),
  });
}

// Register on module load
registerLinkedInScraper();
