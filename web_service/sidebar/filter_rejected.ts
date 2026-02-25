import { CurrentState } from "../types/index.ts";
import { buildFilterSection } from "../components/filter/filter_component.ts";
import { FilterOption } from "../components/filter/types.ts";

/** Build rejected keywords filter menu (shown in Keywords sidebar section) */
export const buildRejectedKeywordsMenu = async (state: CurrentState): Promise<string> => {
  const rejectedKeywords = state.filters["rejectedKeywords"] || [];

  // Convert rejected keywords to FilterOption format
  const options: FilterOption[] = rejectedKeywords.map((keyword) => ({
    value: keyword,
    count: 0,
    localCount: 0,
    selected: true,
  }));

  return buildFilterSection(
    {
      id: "REJECTED_KEYWORDS",
      title: "Rejected Keywords",
      icon: "fa-ban",
      filterKey: "rejectedKeywords",
      options,
      selectedValues: rejectedKeywords,
      emptyMessage: "No rejected keywords - click 'Reject' on keywords page to exclude jobs",
    },
  );
};
