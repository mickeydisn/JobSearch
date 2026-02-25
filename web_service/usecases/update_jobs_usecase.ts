/**
 * Update Jobs Use Case
 * Implements the jobs_update.ts functionality using the JobUsecaseBase abstraction
 * Rebuilds jobs_etl and keyword_frequency tables from jobs_raw
 */

import { JobUsecaseBase } from '../core/job_usecase.ts';
import { getDb, closeDb } from '../../api_sqlite/db.ts';
import { JobsEtl, JobsEtlType } from '../../api_sqlite/table_jobs.ts';
import { JobsRaw, JobsRawType } from '../../api_sqlite/table_jobs_raw.ts';
import { KeywordFrequency, KeywordFrequencyType } from '../../api_sqlite/table_keyword_frequency.ts';
import { loadConfig, type UpdateJobsConfig, type UpdateJobsFilter } from '../core/config_manager.ts';
import { calculateTfIdfScores } from '../../utils/tfidf.ts';

/** Update Jobs Use Case */
export class UpdateJobsUsecase extends JobUsecaseBase {
  /** Chunk size for processing jobs */
  private readonly JOB_CHUNK_SIZE = 100;
  /** Chunk size for inserting keywords */
  private readonly KEYWORD_CHUNK_SIZE = 500;
  /** Filter configuration from app_configuration.json */
  private filterConfig: UpdateJobsFilter = {
    created_at_after: "2026-01-01",
    exclude_status: [],
    exclude_tag: []
  };

  constructor() {
    super(
      'update',
      'Update Jobs ETL',
      'fa-refresh',
      'Rebuild jobs_etl and keyword_frequency tables from jobs_raw with TF-IDF scoring'
    );
  }

  /** Load filter configuration from app_configuration.json */
  private async loadFilterConfig(): Promise<void> {
    const config = await loadConfig();
    this.filterConfig = config.update_jobs.filter;
  }

  /** Check if a job should be excluded based on status or tags */
  private shouldExcludeJob(job: JobsRawType): boolean {
    // Check excluded statuses
    if (this.filterConfig.exclude_status && this.filterConfig.exclude_status.length > 0) {
      if (this.filterConfig.exclude_status.includes(job.status)) {
        return true;
      }
    }

    // Check excluded tags (exclude if job has ANY of the excluded tags)
    if (this.filterConfig.exclude_tag && this.filterConfig.exclude_tag.length > 0) {
      const jobTags = job.tag || [];
      const hasExcludedTag = this.filterConfig.exclude_tag.some(excludedTag => 
        jobTags.includes(excludedTag)
      );
      if (hasExcludedTag) {
        return true;
      }
    }

    return false;
  }

  /** Main execution method */
  async execute(): Promise<void> {
    // Load filter configuration
    await this.loadFilterConfig();

    this.logInfo('Starting 5-Step ETL Rebuild Process');
    this.logInfo(`Filter: created_at_after > ${this.filterConfig.created_at_after || "(none)"}`);
    this.logInfo(`Exclude status: ${this.filterConfig.exclude_status?.join(', ') || "(none)"}`);
    this.logInfo(`Exclude tags: ${this.filterConfig.exclude_tag?.join(', ') || "(none)"}`);
    this.logInfo(`Job chunk size: ${this.JOB_CHUNK_SIZE}`);
    this.logInfo(`Keyword chunk size: ${this.KEYWORD_CHUNK_SIZE}`);

    // Step 1: Drop tables
    await this.step1_dropTables();
    this.checkCancelled();

    // Step 2: Create jobs_etl table
    await this.step2_createEtlTable();
    this.checkCancelled();

    // Step 3: Process and insert jobs
    const totalJobs = await this.step3_processJobs();
    this.checkCancelled();

    if (totalJobs === 0) {
      this.logWarn('No jobs processed, aborting');
      return;
    }

    // Step 4: Build keyword_frequency
    await this.step4_buildKeywordFrequency(totalJobs);
    this.checkCancelled();

    // Step 5: Update TF-IDF scores
    await this.step5_updateScores(totalJobs);

    this.logSuccess('ALL STEPS COMPLETE!');
  }

  /** Step 1: Drop tables */
  private async step1_dropTables(): Promise<void> {
    await this.wrapOperation('Step 1: Drop tables', async () => {
      const jobsEtl = new JobsEtl();
      const keywordFreq = new KeywordFrequency();

      // Drop jobs_etl
      try {
        await jobsEtl.dropTable();
        this.logInfo('Dropped jobs_etl table');
      } catch {
        this.logWarn('jobs_etl table did not exist');
      }

      // Drop keyword_frequency
      try {
        await keywordFreq.dropTable();
        this.logInfo('Dropped keyword_frequency table');
      } catch {
        this.logWarn('keyword_frequency table did not exist');
      }
    });
  }

  /** Step 2: Create jobs_etl table */
  private async step2_createEtlTable(): Promise<void> {
    await this.wrapOperation('Step 2: Create jobs_etl table', async () => {
      const jobsEtl = new JobsEtl();
      await jobsEtl.createTable();
      this.logInfo('Created jobs_etl table');
    });
  }

  /** Get total raw jobs count */
  private getTotalRawJobsCount(): number {
    const db = getDb();
    let sql = "SELECT COUNT(*) as count FROM jobs_raw";
    const params: any[] = [];
    const conditions: string[] = [];

    if (this.filterConfig.created_at_after) {
      conditions.push("createAt > ?");
      params.push(this.filterConfig.created_at_after);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    const result = [...db.query(sql, params)];
    return result[0]?.[0] as number || 0;
  }

  /** Get raw jobs in range */
  private getRawJobsInRange(offset: number, limit: number): JobsRawType[] {
    const db = getDb();
    let sql = "SELECT * FROM jobs_raw";
    const params: any[] = [];
    const conditions: string[] = [];

    if (this.filterConfig.created_at_after) {
      conditions.push("createAt > ?");
      params.push(this.filterConfig.created_at_after);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const results = [...db.queryEntries(sql, params)];
    return results.map((row) => {
      const doc: any = { ...row };
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === "string") {
          if ((value.startsWith("[") && value.endsWith("]")) ||
              (value.startsWith("{") && value.endsWith("}"))) {
            try {
              doc[key] = JSON.parse(value);
            } catch {
              // Keep as string
            }
          }
        }
      }
      return doc as JobsRawType;
    });
  }

  /** Step 3: Process and insert jobs */
  private async step3_processJobs(): Promise<number> {
    return await this.wrapOperation('Step 3: Process and insert jobs', async () => {
      const totalJobs = this.getTotalRawJobsCount();
      this.logInfo(`Total raw jobs to process: ${totalJobs}`);

      if (totalJobs === 0) {
        this.logWarn('No jobs found to process');
        return 0;
      }

      const jobsEtl = new JobsEtl();
      let processedCount = 0;
      let insertedCount = 0;
      const totalChunks = Math.ceil(totalJobs / this.JOB_CHUNK_SIZE);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        this.checkCancelled();
        const offset = chunkIndex * this.JOB_CHUNK_SIZE;
        const currentChunk = chunkIndex + 1;

        this.logInfo(`Processing chunk ${currentChunk}/${totalChunks}...`);

        const rawJobs = this.getRawJobsInRange(offset, this.JOB_CHUNK_SIZE);

        for (const rawJob of rawJobs) {
          try {
            // Check if job should be excluded
            if (this.shouldExcludeJob(rawJob)) {
              processedCount++;
              continue;
            }

            // Transform using ETL
            const etlJob = jobsEtl.fromRaw(rawJob);

            // Insert with empty jobKeywordScore (will be updated in Step 5)
            await jobsEtl.save({
              ...etlJob,
              jobKeywordScore: [],
            });
            insertedCount++;
            processedCount++;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logError(`Error processing job ${rawJob.id}: ${message}`);
          }
        }

        this.logInfo(`Chunk ${currentChunk} complete (${processedCount}/${totalJobs} processed, ${insertedCount} inserted)`);

        if (chunkIndex < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      this.logSuccess(`Step 3 complete: ${insertedCount} jobs inserted`);
      return insertedCount;
    });
  }

  /** Insert keywords batch */
  private insertKeywordsBatch(keywords: KeywordFrequencyType[]): void {
    const db = getDb();
    const placeholders = keywords.map(() => "(?, ?, ?, ?)").join(", ");
    const values = keywords.flatMap(k => [k.id, k.keyword, k.frequency, k.job_count]);
    const sql = `INSERT OR REPLACE INTO keyword_frequency (id, keyword, frequency, job_count) VALUES ${placeholders}`;
    db.query(sql, values);
  }

  /** Step 4: Build keyword_frequency table */
  private async step4_buildKeywordFrequency(totalJobs: number): Promise<void> {
    await this.wrapOperation('Step 4: Build keyword_frequency table', async () => {
      const keywordFreq = new KeywordFrequency();
      await keywordFreq.createTable();
      this.logInfo('Created keyword_frequency table');

      // Aggregate keywords from all jobs in jobs_etl
      this.logInfo('Aggregating keywords from jobs_etl...');

      const db = getDb();
      const totalEtlJobs = [...db.query("SELECT COUNT(*) FROM jobs_etl")][0][0] as number;
      const totalChunks = Math.ceil(totalEtlJobs / this.JOB_CHUNK_SIZE);

      const keywordStats = new Map<string, { frequency: number; job_count: number }>();

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        this.checkCancelled();
        const offset = chunkIndex * this.JOB_CHUNK_SIZE;
        const results = [...db.queryEntries(
          "SELECT jobKeywords FROM jobs_etl LIMIT ? OFFSET ?",
          [this.JOB_CHUNK_SIZE, offset],
        )];

        for (const row of results) {
          const jobKeywords = row.jobKeywords as string;
          if (!jobKeywords) continue;

          try {
            const keywords: [string, number][] = JSON.parse(jobKeywords);
            for (const [keyword, freq] of keywords) {
              const stats = keywordStats.get(keyword);
              if (stats) {
                stats.frequency += freq;
                stats.job_count += 1;
              } else {
                keywordStats.set(keyword, { frequency: freq, job_count: 1 });
              }
            }
          } catch {
            // Skip invalid JSON
          }
        }

        if ((chunkIndex + 1) % 10 === 0 || chunkIndex === totalChunks - 1) {
          this.logInfo(`Processed ${Math.min((chunkIndex + 1) * this.JOB_CHUNK_SIZE, totalEtlJobs)}/${totalEtlJobs} jobs, ${keywordStats.size} unique keywords`);
        }
      }

      this.logInfo(`Found ${keywordStats.size} unique keywords`);

      // Insert in batches
      this.logInfo('Inserting keywords in batches...');
      let batch: KeywordFrequencyType[] = [];
      let insertedCount = 0;
      let skippedCount = 0;

      for (const [keyword, stats] of keywordStats.entries()) {
        // Skip keywords appearing in less than 5 jobs
        if (stats.job_count < 5) {
          skippedCount++;
          continue;
        }

        batch.push({
          id: keyword,
          keyword,
          frequency: stats.frequency,
          job_count: stats.job_count,
        });

        if (batch.length >= this.KEYWORD_CHUNK_SIZE) {
          this.insertKeywordsBatch(batch);
          insertedCount += batch.length;
          this.logInfo(`Inserted ${insertedCount} keywords...`);
          batch = [];
        }
      }

      // Insert remaining
      if (batch.length > 0) {
        this.insertKeywordsBatch(batch);
        insertedCount += batch.length;
      }

      this.logSuccess(`Step 4 complete: ${insertedCount} keywords inserted`);
      this.logInfo(`Skipped ${skippedCount} keywords (appearing in < 5 jobs)`);
    });
  }


  /** Step 5: Update jobKeywordScore with TF-IDF */
  private async step5_updateScores(totalJobs: number): Promise<void> {
    await this.wrapOperation('Step 5: Update jobKeywordScore with TF-IDF', async () => {
      // Load keyword frequencies
      this.logInfo('Loading keyword frequencies...');
      const keywordFreq = new KeywordFrequency();
      const keywordFreqMap = await keywordFreq.getAllForIdf();
      this.logInfo(`Loaded ${keywordFreqMap.size} keywords`);

      // Update jobs in chunks
      const db = getDb();
      const totalEtlJobs = [...db.query("SELECT COUNT(*) FROM jobs_etl")][0][0] as number;
      const totalChunks = Math.ceil(totalEtlJobs / this.JOB_CHUNK_SIZE);

      let processedCount = 0;
      let updatedCount = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        this.checkCancelled();
        const offset = chunkIndex * this.JOB_CHUNK_SIZE;
        const currentChunk = chunkIndex + 1;

        this.logInfo(`Processing chunk ${currentChunk}/${totalChunks}...`);

        const results = [...db.queryEntries(
          "SELECT id, jobKeywords FROM jobs_etl LIMIT ? OFFSET ?",
          [this.JOB_CHUNK_SIZE, offset],
        )];

        for (const row of results) {
          try {
            const jobKeywords = row.jobKeywords as string;
            if (!jobKeywords) continue;

            const keywords: [string, number][] = JSON.parse(jobKeywords);
            // Filter keywords that appear in less than 5 jobs (as per original logic)
            const filteredKeywords = keywords.filter(([keyword]) => {
              const jobCount = keywordFreqMap.get(keyword);
              return jobCount && jobCount >= 5;
            });
            
            const scores = calculateTfIdfScores(filteredKeywords, keywordFreqMap, totalJobs);

            db.query(
              "UPDATE jobs_etl SET jobKeywordScore = ? WHERE id = ?",
              [JSON.stringify(scores), row.id as string],
            );
            updatedCount++;
            processedCount++;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logError(`Error updating job ${row.id}: ${message}`);
          }
        }

        this.logInfo(`Chunk ${currentChunk} complete (${processedCount}/${totalEtlJobs} updated)`);

        if (chunkIndex < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      this.logSuccess(`Step 5 complete: ${updatedCount} jobs updated with TF-IDF scores`);
    });
  }
}
