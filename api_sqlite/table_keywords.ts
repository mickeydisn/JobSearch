// deno-lint-ignore-file
import { TableNode } from "./table.ts";
import { FieldDefinition } from "./db.ts";

export type KeywordType = {
  id: string; // keyword (used as primary key)
  keyword: string;
  is_stopword: boolean;
  tags: string[]; // JSON array
};

export class Keywords extends TableNode<KeywordType> {
  static override schema: Record<string, FieldDefinition> = {
    id: { type: "TEXT", primaryKey: true, notNull: true },
    keyword: { type: "TEXT", index: true },
    is_stopword: { type: "INTEGER", default: 0 }, // SQLite doesn't have boolean, use 0/1
    tags: { type: "TEXT" }, // Stored as JSON array
  };

  static override fields: string[] = Object.keys(Keywords.schema);

  override tableName: string;

  constructor(tableName: string = "keywords") {
    super();
    this.tableName = tableName;
  }

  override etlJob(doc: KeywordType): KeywordType {
    return doc;
  }

  /**
   * Add a keyword as stopword
   */
  async addStopword(keyword: string): Promise<void> {
    const id = keyword.toLowerCase().trim();
    const existing = await this.getById(id);
    
    if (existing) {
      await this.update({ ...existing, is_stopword: true }, id);
    } else {
      await this.save({
        id,
        keyword: keyword.toLowerCase().trim(),
        is_stopword: true,
        tags: [],
      });
    }
  }

  /**
   * Remove stopword status from a keyword
   */
  async removeStopword(keyword: string): Promise<void> {
    const id = keyword.toLowerCase().trim();
    const existing = await this.getById(id);
    
    if (existing) {
      await this.update({ ...existing, is_stopword: false }, id);
    }
  }

  /**
   * Add a tag to a keyword
   */
  async addTag(keyword: string, tag: string): Promise<void> {
    const id = keyword.toLowerCase().trim();
    const existing = await this.getById(id);
    
    if (existing) {
      const currentTags = Array.isArray(existing.tags) ? existing.tags : [];
      if (!currentTags.includes(tag)) {
        await this.update({ ...existing, tags: [...currentTags, tag] }, id);
      }
    } else {
      await this.save({
        id,
        keyword: keyword.toLowerCase().trim(),
        is_stopword: false,
        tags: [tag],
      });
    }
  }

  /**
   * Remove a tag from a keyword
   */
  async removeTag(keyword: string, tag: string): Promise<void> {
    const id = keyword.toLowerCase().trim();
    const existing = await this.getById(id);
    
    if (existing) {
      const currentTags = Array.isArray(existing.tags) ? existing.tags : [];
      const newTags = currentTags.filter((t) => t !== tag);
      await this.update({ ...existing, tags: newTags }, id);
    }
  }

  /**
   * Search keywords by term
   */
  async searchKeywords(
    searchTerm: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<KeywordType[]> {
    return this.searchText("keyword", searchTerm, limit, offset);
  }

  /**
   * Get all stopwords
   */
  async getAllStopwords(limit: number = 1000): Promise<KeywordType[]> {
    return this.search({ is_stopword: 1 }, limit, 0);
  }

  /**
   * Get all keywords with a specific tag
   */
  async getByTag(tag: string, limit: number = 100): Promise<KeywordType[]> {
    // Search for keywords that have the specific tag
    // Since tags is stored as JSON, we need to use searchText
    const allWithTag = await this.search({}, limit * 2, 0);
    return allWithTag.filter((kw) => {
      const tags = Array.isArray(kw.tags) ? kw.tags : [];
      return tags.includes(tag);
    }).slice(0, limit);
  }

  /**
   * Get all unique tags
   */
  async getAllTags(): Promise<string[]> {
    const allKeywords = await this.search({}, 10000, 0);
    const tagSet = new Set<string>();
    
    for (const kw of allKeywords) {
      const tags = Array.isArray(kw.tags) ? kw.tags : [];
      tags.forEach((tag) => tagSet.add(tag));
    }
    
    return Array.from(tagSet).sort();
  }
}
