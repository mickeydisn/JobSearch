// deno-lint-ignore-file
import { TableNode } from "./table.ts";
import { FieldDefinition, getDb } from "./db.ts";

export type FilterProfileType = {
  id: string;
  name: string;
  filters: string; // JSON string of filter object
  created_at: string;
  updated_at: string;
};

export class FilterProfile extends TableNode<FilterProfileType> {
  static override schema: Record<string, FieldDefinition> = {
    id: { type: "TEXT", primaryKey: true, notNull: true },
    name: { type: "TEXT", index: true },
    filters: { type: "TEXT" },
    created_at: { type: "TEXT" },
    updated_at: { type: "TEXT" },
  };

  static override fields: string[] = Object.keys(FilterProfile.schema);

  override tableName: string;

  constructor(tableName: string = "filter_profile") {
    super();
    this.tableName = tableName;
  }

  override etlJob(doc: FilterProfileType): FilterProfileType {
    return doc;
  }

  /**
   * Create a new filter profile
   */
  async createProfile(name: string, filters: Record<string, any>): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const doc: FilterProfileType = {
      id,
      name,
      filters: JSON.stringify(filters),
      created_at: now,
      updated_at: now,
    };
    
    await this.save(doc);
  }

  /**
   * Update an existing filter profile
   */
  async updateProfile(id: string, name: string, filters: Record<string, any>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Filter profile not found: ${id}`);
    }

    const doc: FilterProfileType = {
      ...existing,
      name,
      filters: JSON.stringify(filters),
      updated_at: new Date().toISOString(),
    };

    await this.update(doc, id);
  }

  /**
   * Get filters as object from a profile
   */
  async getFilters(id: string): Promise<Record<string, any> | null> {
    const profile = await this.getById(id);
    if (!profile) return null;
    
    try {
      // The filters field may already be deserialized as an object by the DB layer
      // or it may still be a string - handle both cases
      if (typeof profile.filters === 'string') {
        return JSON.parse(profile.filters);
      } else if (typeof profile.filters === 'object' && profile.filters !== null) {
        return profile.filters;
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Delete a filter profile
   */
  deleteProfile(id: string): void {
    const database = getDb();
    database.query(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }
}
