// deno-lint-ignore-file
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

// Database connection
const DB_PATH = Deno.env.get("SQLITE_DB_PATH") || "./data/jobsearch.db";

let db: DB | null = null;

export function getDb(): DB {
  if (!db) {
    db = new DB(DB_PATH);
    // Enable WAL mode for better concurrent access and to prevent locking issues
    db.query("PRAGMA journal_mode = WAL;");
    // Set busy timeout to wait for locks instead of failing immediately
    db.query("PRAGMA busy_timeout = 5000;");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Type mapping from ES types to SQLite types
export type SQLiteType = "TEXT" | "INTEGER" | "REAL" | "BLOB";

export type FieldDefinition = {
  type: SQLiteType;
  primaryKey?: boolean;
  notNull?: boolean;
  default?: string | number;
  index?: boolean;
};

// Base query match all
export const MATCH_ALL = {};

// Fields that are stored as JSON arrays in the database
const ARRAY_FIELDS = new Set([
  "titleKey",
  "iaKeywordsW5a",
  "jobKeywords",
  "jobKeywordScore",
  "tag",
]);

// Initialize database tables
export function createTable(
  tableName: string,
  schema: Record<string, FieldDefinition>,
): void {
  const db = getDb();

  const columns = Object.entries(schema).map(([name, def]) => {
    let col = `${name} ${def.type}`;
    if (def.primaryKey) col += " PRIMARY KEY";
    if (def.notNull) col += " NOT NULL";
    if (def.default !== undefined) col += ` DEFAULT ${def.default}`;
    return col;
  });

  const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(", ")})`;
  db.query(sql);

  // Create indexes for indexed fields
  Object.entries(schema).forEach(([name, def]) => {
    if (def.index && !def.primaryKey) {
      const indexName = `idx_${tableName}_${name}`;
      db.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${name})`);
    }
  });

  console.log(`✅ Table created: ${tableName}`);
}

export function dropTable(tableName: string): void {
  const db = getDb();
  db.query(`DROP TABLE IF EXISTS ${tableName}`);
  console.log(`✅ Table dropped: ${tableName}`);
}

// CRUD Operations
export function insert<T extends Record<string, any>>(
  tableName: string,
  doc: T,
): void {
  const db = getDb();
  const columns = Object.keys(doc);
  const placeholders = columns.map(() => "?").join(", ");
  const values = columns.map((col) => serializeValue(doc[col]));

  const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;

  try {
    db.query(sql, values);
  } catch (error) {
    // Handle duplicate key by updating
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      update(tableName, doc, doc.id);
    } else {
      throw error;
    }
  }
}

export function update<T extends Record<string, any>>(
  tableName: string,
  doc: T,
  id: string,
): void {
  const db = getDb();
  const columns = Object.keys(doc).filter((key) => key !== "id");
  const setClause = columns.map((col) => `${col} = ?`).join(", ");
  const values = columns.map((col) => serializeValue(doc[col]));
  values.push(id);

  const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
  db.query(sql, values);
}

export function upsert<T extends Record<string, any>>(
  tableName: string,
  doc: T,
): void {
  const db = getDb();

  if (exists(tableName, doc.id)) {
    update(tableName, doc, doc.id);
  } else {
    insert(tableName, doc);
  }
}

export function exists(tableName: string, id: string): boolean {
  const db = getDb();
  const result = [...db.query(`SELECT 1 FROM ${tableName} WHERE id = ?`, [id])];
  return result.length > 0;
}

export function getById<T>(tableName: string, id: string): T | null {
  const db = getDb();
  const result = [...db.queryEntries(`SELECT * FROM ${tableName} WHERE id = ?`, [id])];
  return result.length > 0 ? (deserializeRow(result[0]) as T) : null;
}

/**
 * Build WHERE clause condition for a field and value
 * For array fields (JSON arrays): uses LIKE to match within JSON
 * For string fields: uses exact match or LIKE for substring
 */
function buildFieldCondition(
  key: string,
  value: string | string[],
  values: any[],
): string {
  const isArrayField = ARRAY_FIELDS.has(key);

  if (Array.isArray(value)) {
    if (value.length === 0) return "1=1";
    
    // Build OR conditions for multiple values
    const conditions = value.map(() => {
      if (isArrayField) {
        return `${key} LIKE ?`;
      } else {
        return `${key} = ?`;
      }
    });
    
    // Add values with proper formatting
    value.forEach(v => {
      if (isArrayField) {
        // For JSON array fields: wrap in quotes for JSON substring match
        values.push(`%"${escapeLikePattern(v)}"%`);
      } else {
        // For plain string fields: exact match
        values.push(v);
      }
    });
    
    return `(${conditions.join(" OR ")})`;
  } else {
    // Single value
    if (isArrayField) {
      values.push(`%"${escapeLikePattern(value)}"%`);
      return `${key} LIKE ?`;
    } else {
      values.push(value);
      return `${key} = ?`;
    }
  }
}

/**
 * Escape special characters for LIKE pattern matching
 */
function escapeLikePattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export function search<T>(
  tableName: string,
  filters: Record<string, any> = {},
  limit: number = 100,
  offset: number = 0,
): T[] {
  const db = getDb();

  let sql = `SELECT * FROM ${tableName}`;
  const values: any[] = [];

  const conditions = Object.entries(filters);
  if (conditions.length > 0) {
    const whereConditions: string[] = [];
    
    for (const [key, value] of conditions) {
      if (value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      
      whereConditions.push(buildFieldCondition(key, value, values));
    }
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(" AND ")}`;
    }
  }

  sql += ` LIMIT ? OFFSET ?`;
  values.push(limit, offset);

  const results = [...db.queryEntries(sql, values)];
  return results.map((row) => deserializeRow(row) as T);
}

export function searchText<T>(
  tableName: string,
  field: string,
  searchTerm: string,
  limit: number = 100,
  offset: number = 0,
): T[] {
  const db = getDb();
  const sql = `SELECT * FROM ${tableName} WHERE ${field} LIKE ? LIMIT ? OFFSET ?`;
  const results = [...db.queryEntries(sql, [`%${escapeLikePattern(searchTerm)}%`, limit, offset])];
  return results.map((row) => deserializeRow(row) as T);
}

// Aggregation
export function aggFieldCount(
  tableName: string,
  field: string,
  filters: Record<string, any> = {},
  limit: number = 100,
): [string, number][] {
  const db = getDb();

  let whereClause = "";
  const values: any[] = [];

  const conditions = Object.entries(filters);
  if (conditions.length > 0) {
    const whereConditions: string[] = [];
    
    for (const [key, value] of conditions) {
      if (value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      
      whereConditions.push(buildFieldCondition(key, value, values));
    }
    
    if (whereConditions.length > 0) {
      whereClause = "WHERE " + whereConditions.join(" AND ");
    }
  }

  // For array fields stored as JSON, we need a different approach
  const sql = `
    SELECT ${field} as key, COUNT(*) as count 
    FROM ${tableName} 
    ${whereClause}
    GROUP BY ${field} 
    ORDER BY count DESC 
    LIMIT ${limit}
  `;

  const results = [...db.queryEntries(sql, values)];

  const buckets: [string, number][] = [];

  for (const row of results) {
    const key = (row as any).key;
    const count = (row as any).count as number;

    if (key === null || key === undefined) {
      buckets.push(["_Empty_", count]);
    } else if (typeof key === "string" && key.startsWith("[")) {
      // Handle JSON arrays
      try {
        const arr = JSON.parse(key);
        if (Array.isArray(arr)) {
          arr.forEach((item) => buckets.push([String(item), count]));
        } else {
          buckets.push([String(key), count]);
        }
      } catch {
        buckets.push([String(key), count]);
      }
    } else {
      buckets.push([String(key), count]);
    }
  }

  // Aggregate counts for duplicate keys
  const aggregated = new Map<string, number>();
  for (const [key, count] of buckets) {
    aggregated.set(key, (aggregated.get(key) || 0) + count);
  }

  return Array.from(aggregated.entries()).sort((a, b) => b[1] - a[1]);
}

// Process all documents with a callback
export function processAll<T extends Record<string, any>>(
  tableName: string,
  callback: (doc: T) => void | Promise<void>,
  _batchSize: number = 100,
): void {
  const db = getDb();
  const sql = `SELECT * FROM ${tableName}`;
  const results = [...db.queryEntries(sql)];

  for (const row of results) {
    callback(deserializeRow(row) as T);
  }
}

// Save documents to file (backup)
export async function saveDocuments<T>(
  tableName: string,
  filePath: string,
): Promise<void> {
  const db = getDb();
  const results = [...db.queryEntries(`SELECT * FROM ${tableName}`)];

  const lines = results.map((row) => JSON.stringify(deserializeRow(row)));
  await Deno.writeTextFile(filePath, lines.join("\n"), { create: true });

  console.log(`✅ Saved ${results.length} documents to ${filePath}`);
}

// Helper functions for serialization/deserialization
function serializeValue(value: any): any {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function deserializeRow(row: any): any {
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
  return result;
}

// Copy documents from one table to another
export function copyDocuments(
  tableFrom: string,
  tableTo: string,
  transformFunc?: (doc: any) => any,
): void {
  const db = getDb();
  const results = [...db.queryEntries(`SELECT * FROM ${tableFrom}`)];

  for (const row of results) {
    const doc = deserializeRow(row);
    const transformedDoc = transformFunc ? transformFunc(doc) : doc;
    if (transformedDoc) {
      upsert(tableTo, transformedDoc);
    }
  }

  console.log(`✅ Copied ${results.length} documents from ${tableFrom} to ${tableTo}`);
}
