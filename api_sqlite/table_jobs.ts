// deno-lint-ignore-file
import { TableNode } from "./table.ts";
import { FieldDefinition, getDb } from "./db.ts";
import { JobsRawType } from "./table_jobs_raw.ts";
import { STOPWORD } from "./stopword.ts";
import { extractKeywords } from "../utils/nlp.ts";
import { processJobHtmlImages } from "../utils/html_cleaner.ts";
import { cleanDate } from "../utils/date_utils.ts";

export type JobsEtlType = {
  id: string;
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

export class JobsEtl extends TableNode<JobsEtlType> {
  static override schema: Record<string, FieldDefinition> = {
    id: { type: "TEXT", primaryKey: true, notNull: true },
    createAt: { type: "TEXT", index: true },
    scraper: { type: "TEXT", index: true },
    updateAt: { type: "TEXT" },
    status: { type: "TEXT", index: true },

    title: { type: "TEXT" },
    link: { type: "TEXT" },
    loc: { type: "TEXT", index: true },
    tag: { type: "TEXT" },

    contract: { type: "TEXT", index: true },
    entrepriseLinks: { type: "TEXT" },

    date: { type: "TEXT" },

    jobHead: { type: "TEXT" },
    jobText: { type: "TEXT" },
    jobHtml: { type: "TEXT" },

    company: { type: "TEXT", index: true },
    titleKey: { type: "TEXT" }, // Stored as JSON array
    dateClean: { type: "TEXT", index: true },
    jobKeywords: { type: "TEXT" }, // Stored as JSON array of [keyword, frequency] tuples
    jobKeywordScore: { type: "TEXT" }, // Stored as JSON array of [keyword, tfidf_score] tuples

    iaKeywordsW5a: { type: "TEXT" }, // Stored as JSON array
    iaScoreW5a: { type: "INTEGER" },
    iaScoreW6a: { type: "INTEGER" },

    userTag: { type: "TEXT", index: true },
  };

  static override fields: string[] = Object.keys(JobsEtl.schema);

  override tableName: string;

  constructor(tableName: string = "jobs_etl") {
    super();
    this.tableName = tableName;
  }

  /**
   * Apply default values for ETL fields
   */
  private applyDefaults(doc: JobsEtlType): JobsEtlType {
    return {
      ...doc,
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

  override async save(doc: JobsEtlType): Promise<void> {
    const docWithDefaults = this.applyDefaults(doc);
    await super.save(docWithDefaults);
  }

  /**
   * Aggregate keywords from jobKeywordScore field
   * Extracts keywords from [keyword, tfidf_score] tuples and sums scores
   * Returns top keywords sorted by total TF-IDF score
   */
  async aggJobKeywordScore(
    filters: Record<string, any> = {},
    limit: number = 100,
  ): Promise<[string, number, number][]> {
    const db = getDb();

    // Build WHERE clause for filters
    let whereClause = "";
    const values: any[] = [];

    const conditions = Object.entries(filters);
    if (conditions.length > 0) {
      const whereConditions: string[] = [];

      for (const [key, value] of conditions) {
        // Skip rejectedKeywords - it's not a real database column
        if (key === "rejectedKeywords") continue;
        if (value === null || value === undefined) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        if (typeof value === "string" && value.trim() === "") continue;

        // Use LIKE for array fields, exact match for others
        const isArrayField = ["titleKey", "iaKeywordsW5a", "jobKeywords", "jobKeywordScore"].includes(key);

        if (Array.isArray(value)) {
          const orConditions = value.map(() => isArrayField ? `${key} LIKE ?` : `${key} = ?`);
          value.forEach((v: string) => {
            values.push(isArrayField ? `%%${v}%%` : v);
          });
          whereConditions.push(`(${orConditions.join(" OR ")})`);
        } else {
          whereConditions.push(isArrayField ? `${key} LIKE ?` : `${key} = ?`);
          values.push(isArrayField ? `%%${value}%%` : value);
        }
      }

      if (whereConditions.length > 0) {
        whereClause = "WHERE " + whereConditions.join(" AND ");
      }
    }

    // Query to get all jobKeywordScore data
    const sql = `SELECT jobKeywordScore FROM ${this.tableName} ${whereClause}`;
    const results = [...db.queryEntries(sql, values)];

    // Aggregate keywords and calculate average TF-IDF scores
    const keywordSums = new Map<string, number>();
    const keywordCounts = new Map<string, number>();

    for (const row of results) {
      const jobKeywordScore = (row as any).jobKeywordScore as string;
      if (!jobKeywordScore) continue;

      try {
        const tuples: [string, number][] = JSON.parse(jobKeywordScore);
        if (Array.isArray(tuples)) {
          for (const [keyword, score] of tuples) {
            if (typeof keyword === "string" && typeof score === "number") {
              keywordSums.set(keyword, (keywordSums.get(keyword) || 0) + score);
              keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
            }
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }

    // Calculate averages and convert to array with count
    // Returns [keyword, count, avgScore] for display as [count/avgScore]
    const keywordResults: [string, number, number][] = [];
    for (const [keyword, sum] of keywordSums.entries()) {
      const count = keywordCounts.get(keyword) || 1;
      const avgScore = sum / count;
      keywordResults.push([keyword, count, avgScore]);
    }

    // Sort by average score descending and return top N
    return keywordResults
      .sort((a, b) => b[2] - a[2])
      .slice(0, limit);
  }

  /**
   * Override search to support rejected keywords filtering
   * Jobs containing any rejected keyword in jobKeywordScore will be excluded
   */
  override async search(
    filters: Record<string, any> = {},
    limit: number = 100,
    offset: number = 0,
  ): Promise<JobsEtlType[]> {
    const db = getDb();

    let sql = `SELECT * FROM ${this.tableName}`;
    const values: any[] = [];

    const conditions: string[] = [];

    // Extract rejected keywords from filters
    const rejectedKeywords = filters["rejectedKeywords"] || [];
    const regularFilters = { ...filters };
    delete regularFilters["rejectedKeywords"];

    // Handle regular filters
    const filterEntries = Object.entries(regularFilters);
    if (filterEntries.length > 0) {
      for (const [key, value] of filterEntries) {
        if (value === null || value === undefined) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        if (typeof value === "string" && value.trim() === "") continue;

        const isArrayField = ["titleKey", "iaKeywordsW5a", "jobKeywords", "jobKeywordScore"].includes(key);

        if (Array.isArray(value)) {
          const orConditions = value.map(() => isArrayField ? `${key} LIKE ?` : `${key} = ?`);
          value.forEach((v: string) => {
            values.push(isArrayField ? `%%${v}%%` : v);
          });
          conditions.push(`(${orConditions.join(" OR ")})`);
        } else {
          conditions.push(isArrayField ? `${key} LIKE ?` : `${key} = ?`);
          values.push(isArrayField ? `%%${value}%%` : value);
        }
      }
    }

    // Handle rejected keywords - exclude jobs containing these
    if (rejectedKeywords.length > 0) {
      for (const keyword of rejectedKeywords) {
        conditions.push(`jobKeywordScore NOT LIKE ?`);
        values.push(`%%${keyword}%%`);
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += ` LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    console.log("SQL:", sql, "Values:", values);
    const results = [...db.queryEntries(sql, values)];
    return results.map((row) => this.deserializeRow(row));
  }

  /**
   * Deserialize a database row to JobsEtlType
   */
  private deserializeRow(row: any): JobsEtlType {
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
    return result as JobsEtlType;
  }

  fromRaw(doc: JobsRawType): JobsEtlType {
    // Convert JobsRawType to JobsEtlType by handling type differences
    const etlDoc: JobsEtlType = {
      ...doc,
      // Convert tag from string[] to string (join array elements)
      tag: Array.isArray(doc.tag) ? doc.tag.join(", ") : doc.tag,
      // Ensure optional fields from JobsRawType have defaults
      jobHead: doc.jobHead || "",
      titleKey: doc.titleKey || [],
      dateClean: doc.dateClean || "",
      // Initialize ETL-specific fields with defaults
      jobKeywords: [],
      jobKeywordScore: [],
      iaKeywordsW5a: [],
      iaScoreW5a: 0,
      iaScoreW6a: 0,
      userTag: "",
    };
    return this.etlJob(etlDoc);
  }

  override etlJob(doc: JobsEtlType): JobsEtlType {
    const title = typeof doc.title == "string" ? doc.title : doc.title;
    const titleSplit = title.split(/\n/);
    const company = doc.company
      ? (doc.company as string)
      : (titleSplit.length > 0 ? (titleSplit[1] ? titleSplit[1] : "") : "");

    const titleArray = titleSplit[0].toLowerCase().split(/\s+/).filter((k) =>
      !STOPWORD.includes(k)
    );

    // Process jobHtml to limit image sizes to max 100x100
    const processedJobHtml = processJobHtmlImages(doc.jobHtml);

    // Extract keywords from job content
    const jobKeywords = extractKeywords(
      doc.jobText,
      doc.jobHtml,
      doc.jobHead,
    );

    return {
      ...doc,
      company: company.trim(),
      titleKey: titleArray,
      dateClean: cleanDate(doc.date, doc.createAt),
      jobKeywords: jobKeywords,
      jobKeywordScore: doc.jobKeywordScore || [],
      jobHtml: processedJobHtml,
    };
  }
}
