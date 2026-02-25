import { CurrentState } from "../types/index.ts";
import { JobsEtl } from "../../api_sqlite/table_jobs.ts";
import { buildFilterSection } from "../components/filter/filter_component.ts";
import { FilterOption, scoreCountFormatter } from "../components/filter/types.ts";

const FETCH_LIMIT = 300;
const DISPLAY_LIMIT = 100;

/** Build keyword filter menu using reusable filter component */
export const buildKeywordFilterMenu = async (state: CurrentState): Promise<string> => {
  const keywordData = await getKeywordData(state);
  const selectedValues = state.filters["jobKeywordScore"] || [];
  const rejectedKeywords = state.filters["rejectedKeywords"] || [];

  // Sort by avgScore descending and take top N
  const sortedItems = keywordData
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, DISPLAY_LIMIT);

  // Convert to FilterOption format for "All Keywords" section
  const allOptions: FilterOption[] = sortedItems.map((item) => ({
    value: item.word,
    count: item.count,
    score: item.avgScore,
  }));

  // Build "All Keywords" section - clicking adds to positive filters
  const allKeywordsSection = buildFilterSection(
    {
      id: "KEYWORDS",
      title: "All Keywords",
      icon: "fa-key",
      filterKey: "jobKeywordScore",
      options: allOptions,
      selectedValues,
      emptyMessage: "No keywords found",
    },
    scoreCountFormatter,
  );

  // Build "Rejected Keywords" section - same list, but clicking adds to rejected
  // Mark keywords as selected if they're already rejected
  const rejectedOptions: FilterOption[] = sortedItems.map((item) => ({
    value: item.word,
    count: item.count,
    score: item.avgScore,
  }));

  const rejectedSection = buildFilterSection(
    {
      id: "REJECTED_KEYWORDS",
      title: "Rejected Keywords",
      icon: "fa-ban",
      filterKey: "rejectedKeywords",
      options: rejectedOptions,
      selectedValues: rejectedKeywords,
      emptyMessage: "Click keywords here to reject them",
    },
    scoreCountFormatter,
  );

  return allKeywordsSection + rejectedSection;
};

/** Get keyword data from jobs */
const getKeywordData = async (
  state: CurrentState,
): Promise<{ word: string; count: number; avgScore: number }[]> => {
  try {
    const jobsEtl = new JobsEtl();

    // Exclude non-database fields from filters
    const cleanFilters = { ...state.filters };
    delete cleanFilters["rejectedKeywords"];
    delete cleanFilters["source"];

    // Get top keywords with scores
    const keywordResults = await jobsEtl.aggJobKeywordScore(cleanFilters, FETCH_LIMIT);

    // Convert to our format [word, count, avgScore]
    return keywordResults.map(([word, count, avgScore]) => ({
      word,
      count,
      avgScore,
    }));
  } catch (error) {
    console.error("Error fetching keyword data:", error);
    return [];
  }
};
