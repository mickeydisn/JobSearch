// Chart Data API for Analysis Page
// Provides aggregated data for charts

import { CurrentState } from "../../types/index.ts";
import { JobsEtl } from "../../../api_sqlite/table_jobs.ts";
import { getDb } from "../../../api_sqlite/db.ts";

export interface ChartDataResponse {
  statusData: [string, number][];
  scraperData: [string, number][];
  dateData: [string, number][];
}

/**
 * Get chart data for the analysis page
 * Aggregates data by status, scraper, and date
 */
export async function getChartData(state: CurrentState): Promise<ChartDataResponse> {
  const db = getDb();
  const tableName = "jobs_etl";
  
  // Build WHERE clause from filters
  const { whereClause, values } = buildWhereClause(state.filters);
  
  // Get status distribution
  const statusData = await aggregateByField(db, tableName, "status", whereClause, values);
  
  // Get scraper distribution
  const scraperData = await aggregateByField(db, tableName, "scraper", whereClause, values);
  
  // Get date distribution
  const dateData = await aggregateByDate(db, tableName, whereClause, values);
  
  return {
    statusData,
    scraperData,
    dateData,
  };
}

/**
 * Build WHERE clause from filters
 */
function buildWhereClause(filters: Record<string, string[]>): { whereClause: string; values: any[] } {
  const values: any[] = [];
  const conditions: string[] = [];
  
  // Array fields in the database
  const arrayFields = new Set(["titleKey", "iaKeywordsW5a", "jobKeywords", "jobKeywordScore"]);
  
  for (const [key, filterValues] of Object.entries(filters)) {
    // Skip non-database filter fields
    if (key === "rejectedKeywords" || key === "source") continue;
    
    if (!filterValues || filterValues.length === 0) continue;
    
    const isArrayField = arrayFields.has(key);
    
    if (filterValues.length === 1) {
      // Single value
      if (isArrayField) {
        conditions.push(`${key} LIKE ?`);
        values.push(`%"${filterValues[0]}"%`);
      } else {
        conditions.push(`${key} = ?`);
        values.push(filterValues[0]);
      }
    } else {
      // Multiple values - OR condition
      const orConditions: string[] = [];
      for (const value of filterValues) {
        if (isArrayField) {
          orConditions.push(`${key} LIKE ?`);
          values.push(`%"${value}"%`);
        } else {
          orConditions.push(`${key} = ?`);
          values.push(value);
        }
      }
      conditions.push(`(${orConditions.join(" OR ")})`);
    }
  }
  
  // Handle rejected keywords - exclude jobs containing these
  if (filters.rejectedKeywords && filters.rejectedKeywords.length > 0) {
    for (const keyword of filters.rejectedKeywords) {
      conditions.push(`jobKeywordScore NOT LIKE ?`);
      values.push(`%"${keyword}"%`);
    }
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  
  return { whereClause, values };
}

/**
 * Aggregate data by a field
 */
async function aggregateByField(
  db: any,
  tableName: string,
  field: string,
  whereClause: string,
  values: any[],
  limit: number = 20
): Promise<[string, number][]> {
  const sql = `
    SELECT ${field} as key, COUNT(*) as count 
    FROM ${tableName} 
    ${whereClause}
    GROUP BY ${field} 
    ORDER BY count DESC 
    LIMIT ${limit}
  `;
  
  const results = [...db.queryEntries(sql, values)];
  
  return results.map((row: any) => [
    row.key || "Unknown",
    row.count as number,
  ]);
}

/**
 * Aggregate data by date
 */
async function aggregateByDate(
  db: any,
  tableName: string,
  whereClause: string,
  values: any[],
  limit: number = 30
): Promise<[string, number][]> {
  // Try dateClean first, fall back to date, then createAt
  const sql = `
    SELECT 
      CASE 
        WHEN dateClean IS NOT NULL AND dateClean != '' THEN dateClean
        WHEN date IS NOT NULL AND date != '' THEN date
        ELSE substr(createAt, 1, 10)
      END as date_key,
      COUNT(*) as count 
    FROM ${tableName} 
    ${whereClause}
    GROUP BY date_key 
    ORDER BY date_key DESC 
    LIMIT ${limit}
  `;
  
  const results = [...db.queryEntries(sql, values)];
  
  return results.map((row: any) => [
    row.date_key as string,
    row.count as number,
  ]);
}
