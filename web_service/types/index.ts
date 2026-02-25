// Global types for web_service

/** Sorting options for keywords page */
export type KeywordSortBy = 'count' | 'score';

/** Current application state */
export interface CurrentState {
  /** Current page/view (jobs, keywords, etc.) */
  currentPage: string;
  /** Current active filters - can be string or string[] for multi-value filters */
  filters: Record<string, string | string[]>;
  /** Pagination state */
  pagination: {
    page: number;
    pageSize: number;
  };
  /** Keyword page specific state (persisted even when on jobs page) */
  keywordPage: {
    sortedBy: KeywordSortBy;
    searchTerm: string;
  };
}

/** Action request from client */
export interface ActionRequest {
  /** Current state before action */
  currentState: CurrentState;
  /** Action to perform */
  action: {
    type: 'setPage' | 'addFilter' | 'removeFilter' | 'clearFilters' | 'setPageNumber';
    payload: unknown;
  };
}

/** Menu/filter item */
export interface FilterOption {
  value: string;
  count: number;
  localCount: number;
  selected: boolean;
}

/** Filter category */
export interface FilterCategory {
  key: string;
  name: string;
  options: FilterOption[];
}

/** Page types */
export type PageType = 'jobs' | 'keywords' | 'processing' | 'analysis' | 'filters';

/** HTMX response with OOB updates */
export interface HtmxResponse {
  /** Main content HTML */
  content: string;
  /** OOB updates to apply */
  oobUpdates?: {
    target: string;
    html: string;
  }[];
}
