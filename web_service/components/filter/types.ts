/** Filter option item */
export interface FilterOption {
  value: string;
  displayText?: string;
  count?: number;
  localCount?: number;
  score?: number;
}

/** Filter section configuration */
export interface FilterSectionConfig {
  id: string;
  title: string;
  icon: string;
  filterKey: string;
  options: FilterOption[];
  selectedValues: string[];
  emptyMessage?: string;
}

/** Build count display for filter option */
export type CountFormatter = (option: FilterOption) => string;

/** Default count formatter - shows localCount/totalCount */
export const defaultCountFormatter: CountFormatter = (option) => {
  const local = option.localCount ?? option.count ?? 0;
  const total = option.count ?? 0;
  return `${local}/${total}`;
};

/** Score formatter for keyword filters */
export const scoreCountFormatter: CountFormatter = (option) => {
  const count = option.count ?? 0;
  const score = option.score ?? 0;
  return `${count} | ${score.toFixed(2)}`;
};
