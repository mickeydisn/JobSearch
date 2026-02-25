/**
 * Jobs Count Use Case
 * Handles job count queries based on filters - moved from state_manager.ts
 * This is database logic that belongs in a use case, not in the UI layer
 */

import { getDb } from "../../api_sqlite/db.ts";

/** Filter type for job count queries */
export type JobsCountFilters = Record<string, any>;

/**
 * Get job count based on filters
 * Determines which table to query based on source filter
 * 
 * @param filters - Filter object containing source and other filter criteria
 * @returns Number of jobs matching the filters
 */
export const getJobsCount = (filters: JobsCountFilters): number => {
  const db = getDb();
  
  // Get source filter - default to all-saved
  // Source can be a string or array (e.g., "saved-only" or ["saved-only"])
  const sourceFilter = filters["source"];
  const source = Array.isArray(sourceFilter) ? sourceFilter[0] : (sourceFilter as string || "all-saved");
  
  // Extract source from filters for counting
  const regularFilters = { ...filters };
  delete regularFilters["source"];
  delete regularFilters["rejectedKeywords"];
  
  // Build WHERE clause for filters
  let whereClause = "";
  const values: any[] = [];
  const conditions: string[] = [];

  // Handle regular filters
  const filterEntries = Object.entries(regularFilters);
  for (const [key, value] of filterEntries) {
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

  // Handle rejected keywords - exclude jobs containing these
  const rejectedKeywords = filters["rejectedKeywords"] || [];
  for (const keyword of rejectedKeywords) {
    conditions.push(`jobKeywordScore NOT LIKE ?`);
    values.push(`%${keyword}%`);
  }

  if (conditions.length > 0) {
    whereClause = "WHERE " + conditions.join(" AND ");
  }

  // Query based on source filter
  let sql: string;
  if (source === "saved-only") {
    // Count only saved jobs (non-archived: archive = 0), applying filters
    // Build WHERE clause: archive = 0 AND [other filters]
    const savedConditions = [...conditions];
    savedConditions.unshift("archive = 0");
    const savedWhereClause = savedConditions.length > 0 ? "WHERE " + savedConditions.join(" AND ") : "";
    sql = `SELECT COUNT(*) as count FROM jobs_save ${savedWhereClause}`;
  } else if (source === "saved-archived") {
    // Count only archived jobs (archive = 1), applying filters
    const archivedConditions = [...conditions];
    archivedConditions.unshift("archive = 1");
    const archivedWhereClause = archivedConditions.length > 0 ? "WHERE " + archivedConditions.join(" AND ") : "";
    sql = `SELECT COUNT(*) as count FROM jobs_save ${archivedWhereClause}`;
  } else if (source === "jobs-etl") {
    // Count only ETL jobs
    sql = `SELECT COUNT(*) as count FROM jobs_etl ${whereClause}`;
  } else {
    // all-saved: count ETL jobs (saved jobs are shown alongside)
    sql = `SELECT COUNT(*) as count FROM jobs_etl ${whereClause}`;
  }

  try {
    const results = [...db.query(sql, values)];
    return (results[0][0] as number) || 0;
  } catch (error) {
    console.error("Error getting jobs count:", error);
    return 0;
  }
};
