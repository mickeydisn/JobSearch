// deno-lint-ignore-file
import { TableNode } from "./table.ts";
import { FieldDefinition } from "./db.ts";

export type KeywordFrequencyType = {
  id: string; // keyword (used as primary key)
  keyword: string;
  frequency: number;
  job_count: number;
};

export class KeywordFrequency extends TableNode<KeywordFrequencyType> {
  static override schema: Record<string, FieldDefinition> = {
    id: { type: "TEXT", primaryKey: true, notNull: true },
    keyword: { type: "TEXT", index: true },
    frequency: { type: "INTEGER", default: 0 },
    job_count: { type: "INTEGER", default: 0 },
  };

  static override fields: string[] = Object.keys(KeywordFrequency.schema);

  override tableName: string;

  constructor(tableName: string = "keyword_frequency") {
    super();
    this.tableName = tableName;
  }

  override etlJob(doc: KeywordFrequencyType): KeywordFrequencyType {
    return doc;
  }

  /**
   * Get IDF (Inverse Document Frequency) for a keyword
   * IDF = log(total_jobs / (job_count + 1))
   * Adding 1 for smoothing to avoid division by zero
   */
  async getIdf(keyword: string, totalJobs: number): Promise<number> {
    const doc = await this.getById(keyword);
    if (!doc) return Math.log(totalJobs); // If keyword not found, return max IDF
    
    const jobCount = doc.job_count || 0;
    // Exclude keywords appearing in less than 5 jobs
    if (jobCount < 5) return 0;
    
    return Math.log(totalJobs / (jobCount + 1));
  }

  /**
   * Get all keyword frequencies for batch IDF calculation
   */
  async getAllForIdf(): Promise<Map<string, number>> {
    const all = await this.search({}, 100000);
    const map = new Map<string, number>();
    
    for (const item of all) {
      // Exclude keywords appearing in less than 5 jobs
      if (item.job_count >= 5) {
        map.set(item.keyword, item.job_count);
      }
    }
    
    return map;
  }
}
