/**
 * Base Scraper Class
 * Provides common functionality for all job scrapers
 */

import { JobsRaw, JobsRawType } from "../api_sqlite/table_jobs_raw.ts";
import { JobsEtl } from "../api_sqlite/table_jobs.ts";
import { calculateTfIdfScores } from "../utils/tfidf.ts";

/**
 * Context object passed to scrapers containing TF-IDF calculation data
 */
export interface ScraperContext {
  /** Map of keyword -> document frequency (how many jobs contain this keyword) */
  keywordFreqMap: Map<string, number>;
  /** Total number of jobs for IDF calculation */
  totalJobs: number;
}

/**
 * Base class for all job scrapers
 * Handles common logic: job existence check, TF-IDF calculation, and dual table insertion
 */
export abstract class BaseScraper {
  protected jobsRaw: JobsRaw;
  protected jobsEtl: JobsEtl;
  protected context: ScraperContext;

  constructor(context: ScraperContext) {
    this.context = context;
    this.jobsRaw = new JobsRaw();
    this.jobsEtl = new JobsEtl();
  }

  /**
   * Check if a job exists in jobs_raw table
   * @param jobId - The job ID to check
   * @returns true if job exists, false otherwise
   */
  protected jobExists(jobId: string): boolean {
    return this.jobsRaw.exists(jobId);
  }

  /**
   * Save a job to both jobs_raw and jobs_etl tables (if it doesn't already exist)
   * Also calculates TF-IDF scores using the provided context
   * 
   * @param rawJob - The raw job data
   * @returns true if job was inserted (new), false if it already existed
   */
  protected async saveJobIfNew(rawJob: JobsRawType): Promise<boolean> {
    // Check if job already exists
    if (this.jobExists(rawJob.id)) {
      return false; // Already exists, skip
    }

    // Transform to ETL format
    const etlJob = this.jobsEtl.fromRaw(rawJob);

    // Calculate TF-IDF scores using the context (pre-loaded keyword frequencies)
    const jobKeywordScore = calculateTfIdfScores(
      etlJob.jobKeywords,
      this.context.keywordFreqMap,
      this.context.totalJobs
    );

    // Insert to jobs_raw
    await this.jobsRaw.save(rawJob);

    // Insert to jobs_etl with TF-IDF scores
    await this.jobsEtl.save({
      ...etlJob,
      jobKeywordScore,
    });

    return true; // New job inserted
  }

  /**
   * Main scraping method - must be implemented by subclasses
   */
  abstract scrape(): Promise<void>;
}
