/**
 * Action Handlers - Main Entry Point
 * 
 * This file re-exports handlers from split files for backward compatibility.
 * New code should import directly from:
 *   - handlers_sync.ts (pure state handlers)
 *   - handlers_async.ts (async handlers with DB calls)
 */

// Re-export sync handlers
export {
  setPageHandler,
  toggleFilterHandler,
  addFilterHandler,
  removeFilterHandler,
  clearFiltersHandler,
  setPageNumberHandler,
  setKeywordSortHandler,
  setKeywordSearchHandler,
  setSavedJobsSortHandler,
  setSourceFilterHandler,
  syncActionHandlers,
} from "./handlers_sync.ts";

// Re-export async handlers
export {
  saveFilterProfileHandler,
  applyFilterProfileHandler,
  addFilterProfileHandler,
  deleteFilterProfileHandler,
  saveJobHandler,
  unsaveJobHandler,
  updateJobStatusHandler,
  updateJobPriorityHandler,
  addJobTagHandler,
  removeJobTagHandler,
  updateJobReviewHandler,
  addReviewTagHandler,
  removeReviewTagHandler,
  asyncActionHandlers,
} from "./handlers_async.ts";

// Re-export FilterProfilePayload from action_types
export type { FilterProfilePayload } from "./action_types.ts";

// Re-export for backward compatibility - combined handlers map
import { syncActionHandlers } from "./handlers_sync.ts";
import { asyncActionHandlers } from "./handlers_async.ts";
import { ActionHandler } from "./action_types.ts";

/** Combined map of all action handlers (for backward compatibility) */
export const actionHandlers: Record<string, ActionHandler> = {
  ...syncActionHandlers,
  ...asyncActionHandlers,
};

/** Get handler for an action type */
export const getActionHandler = (actionType: string): ActionHandler | undefined => {
  return actionHandlers[actionType];
};
