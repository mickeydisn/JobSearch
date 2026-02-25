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

// Hardcoded Welcome to the Jungle constants
const WELCOME_BASE_URL = "https://www.welcometothejungle.com";
const WELCOME_API_URL = "https://csekhvms53-dsn.algolia.net/1/indexes/*/queries";
const WELCOME_ALGOLIA_APP_ID = "CSEKHVMS53";
const WELCOME_ALGOLIA_API_KEY = "4bd8f6215d0cc52b26430765769e65a0";

const commonUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/** Get fresh scraper config */
async function getScraperConfig(): Promise<ScraperConfig> {
  const config = await loadConfig();
  return config.scrap_jobs.welcome;
}

/** Extract job details from a Welcome to the Jungle offer page */
export async function scrapeWelcomeOffer(offerLink: string) {
  try {
    const response = await fetch(offerLink, {
      headers: {
        "User-Agent": commonUserAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      console.error(`HTTP error! Status: ${response.status} for ${offerLink}`);
      return;
    }

    const html = await response.text();
    
    if (!html || html.length < 100) {
      console.error(`Empty or too short response for: ${offerLink}`);
      return;
    }
    
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) {
      console.error("Failed to parse the HTML.");
      return;
    }

    // Try multiple selectors for job title (Welcome uses dynamic class names)
    let jobTitle = doc.querySelector("h1") || 
                   doc.querySelector("h2") ||
                   doc.querySelector('[data-testid="job-title"]') ||
                   doc.querySelector('.wui-text');
    
    // If still not found, try to extract from JSON-LD
    let titleText = jobTitle?.textContent?.trim() || "";
    if (!titleText) {
      const jsonLdMatch = html.match(/"title"\s*:\s*"([^"]+)"/);
      if (jsonLdMatch) {
        titleText = jsonLdMatch[1];
      }
    }

    if (!titleText) {
      console.error("Job title not found for:", offerLink);
      return;
    }

    // Job description sections
    const allJobText = doc.querySelectorAll(
      "div[data-testid='job-section-description'], div[data-testid='job-section-experience']",
    );
    
    // If no sections found, try to get from main content
    let jobText: string[] = [];
    let jobHtml: string[] = [];
    
    if (allJobText.length > 0) {
      jobText = Array.from(allJobText)
        .map((el) => el.textContent?.trim())
        .filter((text): text is string => Boolean(text));
      jobHtml = Array.from(allJobText)
        .map((el) => el.innerHTML)
        .filter(Boolean);
    } else {
      // Fallback: try to get text from main section
      const mainSection = doc.querySelector("section");
      if (mainSection) {
        jobText = [mainSection.textContent.trim()];
        jobHtml = [mainSection.innerHTML];
      }
    }

    // Try to find date from time element or JSON-LD
    let dateText = "";
    const timeElem = doc.querySelector("time");
    if (timeElem) {
      dateText = timeElem.getAttribute("datetime")?.split("T")[0].replaceAll("-", "/") || "";
    }
    
    // Fallback to regex for date
    if (!dateText) {
      const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})T/);
      if (dateMatch) {
        dateText = dateMatch[1].replaceAll("-", "/");
      }
    }

    return {
      title: titleText,
      date: dateText,
      jobText: jobText.join("\n"),
      jobHtml: jobHtml.join("\n"),
    };
  } catch (error) {
    const err = error as Error;
    console.error("Error scraping Welcome:", err.message);
    return;
  }
}

/** Search for jobs on Welcome to the Jungle using Algolia API */
async function scrapeWelcomeSearch(keysearch: string, page: number, scraperConfig: ScraperConfig) {
  const URL = `${WELCOME_API_URL}?x-algolia-agent=Algolia%20for%20JavaScript%20(4.20.0)%3B%20Browser&search_origin=job_search_client`;

  const filters = scraperConfig.filters 
    ? `("offices.country_code":"${scraperConfig.filters.country}" AND "offices.district":"${scraperConfig.filters.district}" AND "offices.state":"${scraperConfig.filters.state}") AND ("contract_type":"${scraperConfig.filters.contractType}")`
    : "";

  const request = {
    "requests": [{
      "indexName": "wttj_jobs_production_fr_published_at_desc",
      "params": `attributesToHighlight=%5B%22name%22%5D&attributesToRetrieve=%5B%22*%22%5D&clickAnalytics=true&hitsPerPage=30&maxValuesPerFacet=999&analytics=true&enableABTest=true&userToken=70715438-24da-4918-bea3-a3eadbcff207&analyticsTags=%5B%22page%3Ajobs_index%22%2C%22language%3Afr%22%5D&facets=%5B%22description%22%2C%22benefits%22%2C%22organization.commitments%22%2C%22contract_type%22%2C%22contract_duration_minimum%22%2C%22contract_duration_maximum%22%2C%22has_contract_duration%22%2C%22education_level%22%2C%22has_education_level%22%2C%22experience_level_minimum%22%2C%22has_experience_level_minimum%22%2C%22organization.nb_employees%22%2C%22organization.labels%22%2C%22salary_yearly_minimum%22%2C%22has_salary_yearly_minimum%22%2C%22salary_currency%22%2C%22followedCompanies%22%2C%22language%22%2C%22new_profession.category_reference%22%2C%22new_profession.sub_category_reference%22%2C%22remote%22%2C%22sectors.parent_reference%22%2C%22sectors.reference%22%5D&filters=${encodeURIComponent(filters)}&page=${page}&query=${keysearch}`,
    }],
  };

  const response = await fetch(URL, {
    headers: {
      "User-Agent": commonUserAgent,
      "x-algolia-api-key": WELCOME_ALGOLIA_API_KEY,
      "x-algolia-application-id": WELCOME_ALGOLIA_APP_ID,
      "Content-Type": "application/json",
      "origin": WELCOME_BASE_URL,
      "referer": WELCOME_BASE_URL + "/",
    },
    body: JSON.stringify(request),
    method: "POST",
  });

  const html = await response.text();
  // deno-lint-ignore no-explicit-any
  const jobsInfo = JSON.parse(html).results[0].hits.map((hits: any) => {
    return {
      title: hits.name,
      id: "welcome-" + hits.slug,
      loc: scraperConfig.filters?.district ?? "",
      contract: "CDI",
      link: `${WELCOME_BASE_URL}/fr/companies/${hits.organization.slug}/jobs/${hits.slug}`,
      date: hits.published_at.split("T")[0].replaceAll("-", "/"),
      entrepriseLinks: `${WELCOME_BASE_URL}/fr/companies/${hits.organization.slug}/`,
      company: hits.organization.name || "",
      tag: [],
    };
  });

  return jobsInfo;
}

/** Welcome Scraper Class with Batch Processing */
class WelcomeScraper {
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
  private async scrapeWelcomeSearchPage(
    search: string,
    page: number,
    context: ScraperContext,
    scraperConfig: ScraperConfig
  ): Promise<{ processed: number; newJobs: number }> {
    let processed = 0;
    let newJobs = 0;

    try {
      const jobsInfo = await scrapeWelcomeSearch(search, page, scraperConfig) || [];
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

        const jobInfo = await scrapeWelcomeOffer(job.link);

        if (jobInfo) {
          console.log(`- Scap Job OK - ${job.id}`);
          const jobFull: JobsRawType = {
            createAt: new Date().toISOString(),
            scraper: "welcome",
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

      await sleep(3);
    } catch (error) {
      const err = error as Error;
      console.error("Error scraping Welcome page:", err.message);
    }

    return { processed, newJobs };
  }

  /** Main entry point for Welcome to the Jungle scraping */
  async scrape(context: ScraperContext): Promise<void> {
    const scraperConfig = await getScraperConfig();

    if (!scraperConfig.enabled) {
      console.log("Welcome scraper is disabled");
      return;
    }

    const searchs = scraperConfig.searchKeywords;
    let totalProcessed = 0;
    let totalNew = 0;

    for (const search of searchs) {
      console.log(`\n=== Welcome: Searching for "${search}" ===`);
      const rangeArray = Array.from({ length: scraperConfig.pages }, (_, i) => i);

      for (const i of rangeArray) {
        console.log(`Search page : ${i + 1}/${scraperConfig.pages}`);
        const { processed, newJobs } = await this.scrapeWelcomeSearchPage(search, i, context, scraperConfig);
        totalProcessed += processed;
        totalNew += newJobs;
      }
    }

    console.log(`\n=== Welcome Scrape Complete: ${totalProcessed} processed, ${totalNew} new jobs ===`);
  }
}

// Register the scraper
async function registerWelcomeScraper() {
  const scraperConfig = await getScraperConfig();
  const scraper = new WelcomeScraper();

  registerScraper({
    name: "welcome",
    displayName: "Welcome to the Jungle",
    enabled: scraperConfig.enabled,
    scrape: (context: ScraperContext) => scraper.scrape(context),
  });
}

// Register on module load
registerWelcomeScraper();
