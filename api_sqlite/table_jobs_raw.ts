// deno-lint-ignore-file
import natural from "npm:natural";
import { TableNode } from "./table.ts";
import { FieldDefinition } from "./db.ts";
import { STOPWORD } from "./stopword.ts";
import { SHORT_OK_WORDS} from "./stopword.ts"
import { JobsEtlType } from "./table_jobs.ts";

// Re-export JobsEtlType for convenience
export type { JobsEtlType };

const tokenizer = new natural.WordTokenizer();



export type JobsRawType = {
  id: string;
  createAt: string;
  scraper: string;
  updateAt: string;
  status: string;

  title: string;
  link: string;
  loc: string;
  tag: string[];

  contract: string;
  entrepriseLinks: string;

  date: string;

  jobHead?: string;
  jobText: string;
  jobHtml: string;

  company: string;
  titleKey?: string[];
  dateClean?: string;
};

export class JobsRaw extends TableNode<JobsRawType> {
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
  };

  static override fields: string[] = Object.keys(JobsRaw.schema);

  override tableName: string;

  constructor(tableName: string = "jobs_raw") {
    super();
    this.tableName = tableName;
  }

  /**
   * Apply default values for optional fields
   * - tag: [] → ["empty"]
   * - loc: "" → "empty"
   * - contract: "" → "empty"
   */
  private applyDefaults(doc: JobsRawType): JobsRawType {
    return {
      ...doc,
      tag: (doc.tag && doc.tag.length > 0) ? doc.tag : ["empty"],
      loc: doc.loc && doc.loc.trim() !== "" ? doc.loc : "empty",
      contract: doc.contract && doc.contract.trim() !== "" ? doc.contract : "empty",
    };
  }

  override async save(doc: JobsRawType): Promise<void> {
    const docWithDefaults = this.applyDefaults(doc);
    console.log("SAVE jobRaw")
    await super.save(docWithDefaults);
    console.log("ENDSAVE jobRaw")
  }

  override etlJob(doc: JobsRawType): JobsRawType {
    const title = typeof doc.title == "string" ? doc.title : doc.title;
    const titleSplit = title.split(/\n/);
    // Only extract company from title if not already set by scraper
    const company = doc.company && doc.company.length > 0
      ? doc.company
      : (titleSplit.length > 1 ? titleSplit[1] : "");

    // Extract keywords from title using natural NLP
    const titleKey = extractTitleKeywords(titleSplit[0]);

    return {
      ...doc,
      company: company.trim(),
      titleKey: titleKey,
      dateClean: cleanDate(doc.date),
    };
  }
}

/**
 * Remove accents from text using native JS
 */
const removeAccents = (text: string): string => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Apply both English and French stemming
 * Returns the stemmed form (tries English first, then French if unchanged)
 */
const stemWord = (word: string): string => {
  const englishStemmed = natural.PorterStemmer.stem(word);
  // If English stemming changed the word, use it
  if (englishStemmed !== word) {
    return englishStemmed;
  }
  // Otherwise try French stemming
  return natural.PorterStemmerFr.stem(word);
};

/**
 * Extract keywords from job title using natural NLP
 * Returns array of single-word keywords only
 */
const extractTitleKeywords = (title: string): string[] => {
  if (!title || typeof title !== "string") return [];

  // Normalize: lowercase and remove accents
  const normalizedText = removeAccents(title.toLowerCase());

  // Tokenize using natural
  const tokens = tokenizer.tokenize(normalizedText) || [];

  // Filter tokens: remove stopwords, short words, and numeric-only
  const filtered = tokens.filter((token: string) => {
    const cleanToken = token.toLowerCase().trim();

    // Skip stopwords
    if (STOPWORD.includes(cleanToken)) return false;

    // Keep short words if they're in our tech word list
    if (cleanToken.length < 3 && !SHORT_OK_WORDS.has(cleanToken)) return false;

    // Skip purely numeric terms
    if (/^\d+$/.test(cleanToken)) return false;

    return true;
  });

  // Apply English and French stemming for consistency and deduplicate
  const stemmed = filtered.map((word: string) => stemWord(word));
  return Array.from(new Set(stemmed));
};

const cleanDate = (sIn: string | string[]): string => {
  if (!sIn) return "2024/01/01";
  const s: string = typeof sIn == "string" ? sIn : sIn.join(" ");
  let dateMatch = s.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) {
    const dateClean = dateMatch[1];
    const dateSplit = dateClean.split("/");
    const dateSortable = `${dateSplit[2]}/${dateSplit[1]}/${dateSplit[0]}`;
    return dateSortable;
  }
  dateMatch = s.match(/(\d{4}\/\d{2}\/\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }
  return "2024/01/01";
};
