// Filter configuration

export const JOB_FILTER_KEYS = [
  "status",
  "scraper",
  "dateClean",
  "titleKey",
  "company",
  "tag",
  "iaScoreW5a",
  "iaScoreW6a",
] as const;

export type FilterKey = typeof JOB_FILTER_KEYS[number];

/** Source filter options */
export const SOURCE_FILTER_OPTIONS = [
  { value: "all-saved", label: "All + Saved", description: "Show ETL and saved jobs" },
  { value: "jobs-etl", label: "JobsETL Only", description: "Show only ETL jobs" },
  { value: "saved-only", label: "Saved Only", description: "Show saved jobs only" },
  { value: "saved-archived", label: "Saved + Archived", description: "Show all saved jobs" },
] as const;

/** Filter display names */
export const FILTER_DISPLAY_NAMES: Record<FilterKey, string> = {
  status: "Status",
  scraper: "Scraper",
  dateClean: "Date",
  titleKey: "Title Key",
  company: "Company",
  tag: "Tag",
  iaScoreW5a: "Score W5A",
  iaScoreW6a: "Score W6A",
};
