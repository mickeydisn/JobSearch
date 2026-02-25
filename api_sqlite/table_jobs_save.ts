// deno-lint-ignore-file
import { TableNode } from "./table.ts";
import { FieldDefinition, getDb } from "./db.ts";
import { JobsEtlType } from "./table_jobs_raw.ts";

export type JobsSaveType = {
  // User fields (NEW)
  id: string;
  saved_at: string;
  updated_at: string;
  userStatus: "saved" | "applied" | "interview" | "rejected" | "offer";
  userPriority: "low" | "medium" | "high";
  userTags: string; // JSON array: ["urgent", "remote"]
  reviewTags: string; // JSON array: ["good", "bad"] - tags for job review
  userReview: string;
  userMetadata: string; // JSON: {"contact": "email@...", "salary": "60k"}
  archive: number; // Soft delete (0 = active, 1 = archived)
  archived_at: string;

  // All fields from jobs_etl
  job_etl_id: string;
  createAt: string;
  scraper: string;
  updateAt: string;
  status: string;

  title: string;
  link: string;
  loc: string;
  tag: string;

  contract: string;
  entrepriseLinks: string;

  date: string;

  jobHead: string;
  jobText: string;
  jobHtml: string;

  company: string;
  titleKey: string[];
  dateClean: string;
  jobKeywords: [string, number][];
  jobKeywordScore: [string, number][];

  iaKeywordsW5a: string[];
  iaScoreW5a: number;
  iaScoreW6a: number;

  userTag: string;
};

export class JobsSave extends TableNode<JobsSaveType> {
  static override schema: Record<string, FieldDefinition> = {
    // User fields (NEW)
    id: { type: "TEXT", primaryKey: true, notNull: true },
    saved_at: { type: "TEXT", index: true, notNull: true },
    updated_at: { type: "TEXT", index: true, notNull: true },
    userStatus: { type: "TEXT", index: true, default: "saved" },
    userPriority: { type: "TEXT", default: "medium" },
    userTags: { type: "TEXT" }, // Stored as JSON array
    reviewTags: { type: "TEXT" }, // Stored as JSON array
    userReview: { type: "TEXT" },
    userMetadata: { type: "TEXT" }, // Stored as JSON object
    archive: { type: "INTEGER", default: 0, index: true },
    archived_at: { type: "TEXT" },

    // All fields from jobs_etl
    job_etl_id: { type: "TEXT", notNull: true },
    createAt: { type: "TEXT" },
    scraper: { type: "TEXT" },
    updateAt: { type: "TEXT" },
    status: { type: "TEXT" },

    title: { type: "TEXT" },
    link: { type: "TEXT" },
    loc: { type: "TEXT" },
    tag: { type: "TEXT" },

    contract: { type: "TEXT" },
    entrepriseLinks: { type: "TEXT" },

    date: { type: "TEXT" },

    jobHead: { type: "TEXT" },
    jobText: { type: "TEXT" },
    jobHtml: { type: "TEXT" },

    company: { type: "TEXT" },
    titleKey: { type: "TEXT" }, // Stored as JSON array
    dateClean: { type: "TEXT" },
    jobKeywords: { type: "TEXT" }, // Stored as JSON array of [keyword, frequency] tuples
    jobKeywordScore: { type: "TEXT" }, // Stored as JSON array of [keyword, tfidf_score] tuples

    iaKeywordsW5a: { type: "TEXT" }, // Stored as JSON array
    iaScoreW5a: { type: "INTEGER" },
    iaScoreW6a: { type: "INTEGER" },

    userTag: { type: "TEXT" },
  };

  static override fields: string[] = Object.keys(JobsSave.schema);

  override tableName: string;

  constructor(tableName: string = "jobs_save") {
    super();
    this.tableName = tableName;
  }

  /**
   * Apply default values for saved job fields
   */
  private applyDefaults(doc: JobsSaveType): JobsSaveType {
    return {
      ...doc,
      // Ensure user fields have defaults
      userStatus: doc.userStatus || "saved",
      userPriority: doc.userPriority || "medium",
      userTags: doc.userTags || "[]",
      reviewTags: doc.reviewTags || "[]",
      userReview: doc.userReview || "",
      userMetadata: doc.userMetadata || "{}",
      archive: doc.archive || 0,
      archived_at: doc.archived_at || "",
      // Ensure tag has a value
      tag: doc.tag || "empty",
      // Ensure arrays have defaults
      titleKey: doc.titleKey || [],
      jobKeywords: doc.jobKeywords || [],
      jobKeywordScore: doc.jobKeywordScore || [],
      iaKeywordsW5a: doc.iaKeywordsW5a || [],
      // Ensure strings have defaults
      jobHead: doc.jobHead || "",
      jobHtml: doc.jobHtml || "",
      jobText: doc.jobText || "",
      dateClean: doc.dateClean || "",
      userTag: doc.userTag || "",
      // Ensure numbers have defaults
      iaScoreW5a: doc.iaScoreW5a || 0,
      iaScoreW6a: doc.iaScoreW6a || 0,
    };
  }

  override async save(doc: JobsSaveType): Promise<void> {
    const docWithDefaults = this.applyDefaults(doc);
    await super.save(docWithDefaults);
  }

  /**
   * Check if a job is already saved by job_etl_id
   */
  async isJobSaved(jobEtlId: string): Promise<boolean> {
    const db = getDb();
    const sql = `SELECT id FROM ${this.tableName} WHERE job_etl_id = ? AND archive = 0`;
    const results = [...db.queryEntries(sql, [jobEtlId])];
    return results.length > 0;
  }

  /**
   * Get saved job by job_etl_id
   */
  async getByJobEtlId(jobEtlId: string): Promise<JobsSaveType | null> {
    const db = getDb();
    const sql = `SELECT * FROM ${this.tableName} WHERE job_etl_id = ? AND archive = 0`;
    const results = [...db.queryEntries(sql, [jobEtlId])];
    if (results.length === 0) return null;
    return this.deserializeRow(results[0]);
  }

  /**
   * Get all saved jobs (non-archived)
   * @param filters - Optional filter object to apply to the query
   */
  async getSavedJobs(
    limit: number = 100,
    offset: number = 0,
    sortBy: "updated_at" | "saved_at" | "userStatus" | "userPriority" = "updated_at",
    sortOrder: "ASC" | "DESC" = "DESC",
    filters: Record<string, any> = {},
  ): Promise<JobsSaveType[]> {
    const db = getDb();
    
    // Build WHERE clause from filters
    const conditions: string[] = ["archive = 0"];
    const values: any[] = [];
    
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      
      const isArrayField = ["titleKey", "iaKeywordsW5a", "jobKeywords", "jobKeywordScore"].includes(key);
      
      if (Array.isArray(value)) {
        const orConditions = value.map(() => isArrayField ? `${key} LIKE ?` : `${key} = ?`);
        value.forEach((v: string) => {
          values.push(isArrayField ? `%${v}%` : v);
        });
        conditions.push(`(${orConditions.join(" OR ")})`);
      } else {
        conditions.push(isArrayField ? `${key} LIKE ?` : `${key} = ?`);
        values.push(isArrayField ? `%${value}%` : value);
      }
    }
    
    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    const sql = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    
    values.push(limit, offset);
    const results = [...db.queryEntries(sql, values)];
    return results.map((row) => this.deserializeRow(row));
  }

  /**
   * Get all saved jobs including archived
   */
  async getAllJobs(
    limit: number = 100,
    offset: number = 0,
    sortBy: "updated_at" | "saved_at" | "userStatus" | "userPriority" = "updated_at",
    sortOrder: "ASC" | "DESC" = "DESC",
  ): Promise<JobsSaveType[]> {
    const db = getDb();
    const sql = `SELECT * FROM ${this.tableName} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    const results = [...db.queryEntries(sql, [limit, offset])];
    return results.map((row) => this.deserializeRow(row));
  }

  /**
   * Get archived jobs only
   */
  async getArchivedJobs(
    limit: number = 100,
    offset: number = 0,
    sortBy: "updated_at" | "saved_at" | "userStatus" | "userPriority" = "updated_at",
    sortOrder: "ASC" | "DESC" = "DESC",
  ): Promise<JobsSaveType[]> {
    const db = getDb();
    const sql = `SELECT * FROM ${this.tableName} WHERE archive = 1 ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    const results = [...db.queryEntries(sql, [limit, offset])];
    return results.map((row) => this.deserializeRow(row));
  }

  /**
   * Get count of saved jobs (non-archived)
   */
  async getSavedCount(): Promise<number> {
    const db = getDb();
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE archive = 0`;
    const results = [...db.queryEntries(sql)];
    return (results[0] as any)?.count || 0;
  }

  /**
   * Get count of archived jobs
   */
  async getArchivedCount(): Promise<number> {
    const db = getDb();
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE archive = 1`;
    const results = [...db.queryEntries(sql)];
    return (results[0] as any)?.count || 0;
  }

  /**
   * Get unique user tags with counts
   */
  async getUserTagsWithCounts(): Promise<[string, number][]> {
    const db = getDb();
    // This is a simplified version - in production you'd parse the JSON array properly
    const sql = `
      SELECT userTags, COUNT(*) as count 
      FROM ${this.tableName} 
      WHERE archive = 0 AND userTags IS NOT NULL AND userTags != ''
      GROUP BY userTags
    `;
    const results = [...db.queryEntries(sql)];
    return results.map((row) => [ (row as any).userTags, (row as any).count ]);
  }

  /**
   * Update job status
   */
  async updateStatus(jobEtlId: string, status: JobsSaveType["userStatus"]): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const sql = `UPDATE ${this.tableName} SET userStatus = ?, updated_at = ? WHERE job_etl_id = ? AND archive = 0`;
    db.query(sql, [status, now, jobEtlId]);
  }

  /**
   * Update job priority
   */
  async updatePriority(jobEtlId: string, priority: JobsSaveType["userPriority"]): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const sql = `UPDATE ${this.tableName} SET userPriority = ?, updated_at = ? WHERE job_etl_id = ? AND archive = 0`;
    db.query(sql, [priority, now, jobEtlId]);
  }

  /**
   * Update job tags
   */
  async updateTags(jobEtlId: string, tags: string[]): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(tags);
    const sql = `UPDATE ${this.tableName} SET userTags = ?, updated_at = ? WHERE job_etl_id = ? AND archive = 0`;
    db.query(sql, [tagsJson, now, jobEtlId]);
  }

  /**
   * Update job review
   */
  async updateReview(jobEtlId: string, review: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const sql = `UPDATE ${this.tableName} SET userReview = ?, updated_at = ? WHERE job_etl_id = ? AND archive = 0`;
    db.query(sql, [review, now, jobEtlId]);
  }

  /**
   * Update review tags
   */
  async updateReviewTags(jobEtlId: string, tags: string[]): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(tags);
    const sql = `UPDATE ${this.tableName} SET reviewTags = ?, updated_at = ? WHERE job_etl_id = ? AND archive = 0`;
    db.query(sql, [tagsJson, now, jobEtlId]);
  }

  /**
   * Archive a saved job (soft delete)
   */
  async archiveJob(jobEtlId: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const sql = `UPDATE ${this.tableName} SET archive = 1, archived_at = ?, updated_at = ? WHERE job_etl_id = ?`;
    db.query(sql, [now, now, jobEtlId]);
  }

  /**
   * Restore an archived job
   */
  async restoreJob(jobEtlId: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const sql = `UPDATE ${this.tableName} SET archive = 0, archived_at = '', updated_at = ? WHERE job_etl_id = ?`;
    db.query(sql, [now, jobEtlId]);
  }

  /**
   * Create a saved job from a jobs_etl record
   */
  async saveFromJobEtl(jobEtl: JobsEtlType): Promise<void> {
    const now = new Date().toISOString();
    
    const saveDoc: JobsSaveType = {
      // Generate a new UUID for the saved job
      id: crypto.randomUUID(),
      saved_at: now,
      updated_at: now,
      userStatus: "saved",
      userPriority: "medium",
      userTags: "[]",
      reviewTags: "[]",
      userReview: "",
      userMetadata: "{}",
      archive: 0,
      archived_at: "",

      // Copy all fields from jobs_etl
      job_etl_id: jobEtl.id,
      createAt: jobEtl.createAt,
      scraper: jobEtl.scraper,
      updateAt: jobEtl.updateAt,
      status: jobEtl.status,
      title: jobEtl.title,
      link: jobEtl.link,
      loc: jobEtl.loc,
      tag: jobEtl.tag,
      contract: jobEtl.contract,
      entrepriseLinks: jobEtl.entrepriseLinks,
      date: jobEtl.date,
      jobHead: jobEtl.jobHead,
      jobText: jobEtl.jobText,
      jobHtml: jobEtl.jobHtml,
      company: jobEtl.company,
      titleKey: jobEtl.titleKey,
      dateClean: jobEtl.dateClean,
      jobKeywords: jobEtl.jobKeywords,
      jobKeywordScore: jobEtl.jobKeywordScore,
      iaKeywordsW5a: jobEtl.iaKeywordsW5a,
      iaScoreW5a: jobEtl.iaScoreW5a,
      iaScoreW6a: jobEtl.iaScoreW6a,
      userTag: jobEtl.userTag,
    };

    await this.save(saveDoc);
  }

  /**
   * Sync a saved job with current JobEtl data
   * Updates all ETL fields while preserving user fields (tags, review, status, etc.)
   */
  async syncFromJobEtl(jobEtl: JobsEtlType): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    
    // Update all ETL fields but preserve user fields
    const sql = `
      UPDATE ${this.tableName} SET
        updateAt = ?,
        status = ?,
        title = ?,
        link = ?,
        loc = ?,
        tag = ?,
        contract = ?,
        entrepriseLinks = ?,
        date = ?,
        jobHead = ?,
        jobText = ?,
        jobHtml = ?,
        company = ?,
        titleKey = ?,
        dateClean = ?,
        jobKeywords = ?,
        jobKeywordScore = ?,
        iaKeywordsW5a = ?,
        iaScoreW5a = ?,
        iaScoreW6a = ?,
        userTag = ?
      WHERE job_etl_id = ? AND archive = 0
    `;
    
    db.query(sql, [
      now,
      jobEtl.status,
      jobEtl.title,
      jobEtl.link,
      jobEtl.loc,
      jobEtl.tag,
      jobEtl.contract,
      jobEtl.entrepriseLinks,
      jobEtl.date,
      jobEtl.jobHead,
      jobEtl.jobText,
      jobEtl.jobHtml,
      jobEtl.company,
      JSON.stringify(jobEtl.titleKey || []),
      jobEtl.dateClean,
      JSON.stringify(jobEtl.jobKeywords || []),
      JSON.stringify(jobEtl.jobKeywordScore || []),
      JSON.stringify(jobEtl.iaKeywordsW5a || []),
      jobEtl.iaScoreW5a || 0,
      jobEtl.iaScoreW6a || 0,
      jobEtl.userTag || "",
      jobEtl.id,
    ]);
  }

  /**
   * Deserialize a database row to JobsSaveType
   */
  private deserializeRow(row: any): JobsSaveType {
    const result: any = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string") {
        // Try to parse JSON arrays or objects
        if ((value.startsWith("[") && value.endsWith("]")) ||
            (value.startsWith("{") && value.endsWith("}"))) {
          try {
            result[key] = JSON.parse(value);
            continue;
          } catch {
            // Not valid JSON, treat as string
          }
        }
      }
      result[key] = value;
    }
    return result as JobsSaveType;
  }

  override etlJob(doc: JobsSaveType): JobsSaveType {
    // JobsSave doesn't need ETL processing - it's a copy of jobs_etl
    return doc;
  }
}
