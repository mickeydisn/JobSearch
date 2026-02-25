import { CurrentState, PageType } from "../types/index.ts";

/** Action type definitions */
export type ActionType =
  | "setPage"
  | "toggleFilter"
  | "addFilter"
  | "removeFilter"
  | "clearFilters"
  | "setPageNumber"
  | "setKeywordSort"
  | "saveFilterProfile"
  | "applyFilterProfile"
  | "addFilterProfile"
  | "deleteFilterProfile"
  | "saveJob"
  | "unsaveJob"
  | "updateJobStatus"
  | "updateJobPriority"
  | "updateJobTags"
  | "addJobTag"
  | "removeJobTag"
  | "updateJobReview"
  | "addReviewTag"
  | "removeReviewTag"
  | "setSavedJobsSort"
  | "setSourceFilter"
  | "addStopword"
  | "removeStopword"
  | "addKeywordTag"
  | "removeKeywordTag"
  | "searchKeywords";

/** Action payload types */
export interface SetPagePayload {
  page: PageType;
}

export interface FilterPayload {
  key: string;
  value: string;
}

export interface SetPageNumberPayload {
  pageNumber: number;
}

export interface SetKeywordSortPayload {
  sortedBy: "score" | "count";
}

export interface SaveJobPayload {
  jobId: string;
}

export interface UpdateJobStatusPayload {
  jobId: string;
  status: "saved" | "applied" | "interview" | "rejected" | "offer";
}

export interface UpdateJobPriorityPayload {
  jobId: string;
  priority: "low" | "medium" | "high";
}

export interface UpdateJobTagsPayload {
  jobId: string;
  tags: string[];
}

export interface AddJobTagPayload {
  jobId: string;
  tag: string;
}

export interface RemoveJobTagPayload {
  jobId: string;
  tag: string;
}

export interface UpdateJobReviewPayload {
  jobId: string;
  review: string;
}

export interface AddReviewTagPayload {
  jobId: string;
  tag: string;
}

export interface RemoveReviewTagPayload {
  jobId: string;
  tag: string;
}

export interface SetSavedJobsSortPayload {
  sortBy: "updated_at" | "saved_at" | "userStatus" | "userPriority";
  sortOrder: "ASC" | "DESC";
}

export interface SetSourceFilterPayload {
  source: "jobs-etl" | "all-saved" | "saved-only" | "saved-archived";
}

export interface FilterProfilePayload {
  profileId?: string;
  name?: string;
  filters?: Record<string, string[]>;
}

export interface AddStopwordPayload {
  keyword: string;
}

export interface RemoveStopwordPayload {
  keyword: string;
}

export interface AddKeywordTagPayload {
  keyword: string;
  tag: string;
}

export interface RemoveKeywordTagPayload {
  keyword: string;
  tag: string;
}

export interface SearchKeywordsPayload {
  searchTerm: string;
  limit?: number;
  offset?: number;
}

export interface SetKeywordSearchPayload {
  searchTerm: string;
}

/** Union type for all action payloads */
export type ActionPayload =
  | PageType
  | FilterPayload
  | number
  | "score"
  | "count"
  | SaveJobPayload
  | UpdateJobStatusPayload
  | UpdateJobPriorityPayload
  | UpdateJobTagsPayload
  | AddJobTagPayload
  | RemoveJobTagPayload
  | UpdateJobReviewPayload
  | AddReviewTagPayload
  | RemoveReviewTagPayload
  | SetSavedJobsSortPayload
  | SetSourceFilterPayload
  | AddStopwordPayload
  | RemoveStopwordPayload
  | AddKeywordTagPayload
  | RemoveKeywordTagPayload
  | SearchKeywordsPayload
  | unknown;

/** Action handler function type - supports both sync and async handlers */
export type ActionHandler = (
  state: CurrentState,
  payload: ActionPayload,
) => CurrentState | Promise<CurrentState>;
