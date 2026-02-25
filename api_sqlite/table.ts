// deno-lint-ignore-file
import {
  aggFieldCount,
  createTable,
  dropTable,
  exists,
  FieldDefinition,
  getById,
  insert,
  MATCH_ALL,
  search,
  searchText,
  update,
  upsert,
} from "./db.ts";

export { MATCH_ALL };

export abstract class TableNode<T extends Record<string, any>> {
  // SQLite schema definition
  static schema: Record<string, FieldDefinition> = {
    id: { type: "TEXT", primaryKey: true, notNull: true },
  };

  static fields: string[] = [];
  abstract tableName: string;

  constructor() {
    if (new.target === TableNode) {
      throw new Error("Cannot instantiate an abstract class.");
    }
  }

  abstract etlJob(doc: T): T;

  getSchema(): Record<string, FieldDefinition> {
    return (this.constructor as typeof TableNode).schema;
  }

  async createTable(): Promise<void> {
    createTable(this.tableName, this.getSchema());
  }

  async dropTable(): Promise<void> {
    dropTable(this.tableName);
  }

  // Check if document exists
  exists(id: string): boolean {
    return exists(this.tableName, id);
  }

  // Insert or update a document
  async save(doc: T): Promise<void> {
    upsert(this.tableName, doc);
  }

  // Update a document
  async update(doc: T, id: string): Promise<void> {
    update(this.tableName, doc, id);
  }

  // Insert a document
  async insert(doc: T): Promise<void> {
    insert(this.tableName, doc);
  }

  // Get document by ID
  async getById(id: string): Promise<T | null> {
    return getById<T>(this.tableName, id);
  }

  // Search with filters
  async search(
    filters: Record<string, any> = {},
    limit: number = 100,
    offset: number = 0,
  ): Promise<T[]> {
    return search<T>(this.tableName, filters, limit, offset);
  }

  // Search with text matching
  async searchText(
    field: string,
    searchTerm: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<T[]> {
    return searchText<T>(this.tableName, field, searchTerm, limit, offset);
  }

  // Aggregate field counts
  async aggFieldCount(
    field: string,
    filters: any = MATCH_ALL,
    limit: number = 100,
  ): Promise<[string, number][]> {
    return aggFieldCount(this.tableName, field, filters, limit);
  }

  // Search by ID
  async searchId(id: string): Promise<T | null> {
    return this.getById(id);
  }
}
