import { CurrentState } from "../types/index.ts";
import { ActionHandler, FilterPayload, 
  SaveJobPayload, UpdateJobStatusPayload, UpdateJobPriorityPayload,
  AddJobTagPayload, RemoveJobTagPayload, UpdateJobReviewPayload,
  AddReviewTagPayload, RemoveReviewTagPayload, FilterProfilePayload,
  AddStopwordPayload, RemoveStopwordPayload, AddKeywordTagPayload,
  RemoveKeywordTagPayload, SearchKeywordsPayload } from "./action_types.ts";
import { FilterProfile } from "../../api_sqlite/table_filter_profile.ts";
import { JobsSave } from "../../api_sqlite/table_jobs_save.ts";
import { JobsEtl } from "../../api_sqlite/table_jobs.ts";
import { JobsSaveType } from "../../api_sqlite/table_jobs_save.ts";
import { Keywords } from "../../api_sqlite/table_keywords.ts";

/** Save a new filter profile */
export const saveFilterProfileHandler: ActionHandler = async (state, payload) => {
  try {
    const profilePayload = payload as FilterProfilePayload;
    
    if (profilePayload.name && profilePayload.filters) {
      const filterProfile = new FilterProfile();
      await filterProfile.createProfile(profilePayload.name, profilePayload.filters);
    }
    
    return state;
  } catch (error) {
    console.error('Error saving filter profile:', error);
    throw error;
  }
};

/** Apply a filter profile (replace current filters) */
export const applyFilterProfileHandler: ActionHandler = async (state, payload) => {
  const profilePayload = payload as FilterProfilePayload;
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  
  if (profilePayload.profileId) {
    const filterProfile = new FilterProfile();
    const profileFilters = await filterProfile.getFilters(profilePayload.profileId);
    
    if (profileFilters) {
      newState.filters = profileFilters;
      newState.pagination.page = 1;
    }
  }
  
  return newState;
};

/** Add a filter profile (merge with current filters) */
export const addFilterProfileHandler: ActionHandler = async (state, payload) => {
  const profilePayload = payload as FilterProfilePayload;
  const newState: CurrentState = JSON.parse(JSON.stringify(state));
  
  if (profilePayload.profileId) {
    const filterProfile = new FilterProfile();
    const profileFilters = await filterProfile.getFilters(profilePayload.profileId);
    
    if (profileFilters) {
      // Merge filters: add values from profile that don't exist in current
      for (const [key, values] of Object.entries(profileFilters)) {
        const currentFilter = newState.filters[key];
        // Convert to array if it's a string
        let filterArray: string[];
        if (typeof currentFilter === 'string') {
          filterArray = [currentFilter];
        } else if (Array.isArray(currentFilter)) {
          filterArray = currentFilter;
        } else {
          filterArray = [];
        }
        
        for (const value of values) {
          if (!filterArray.includes(value)) {
            filterArray.push(value);
          }
        }
        newState.filters[key] = filterArray;
      }
      newState.pagination.page = 1;
    }
  }
  
  return newState;
};

/** Delete a filter profile */
export const deleteFilterProfileHandler: ActionHandler = async (state, payload) => {
  const profilePayload = payload as FilterProfilePayload;
  
  if (profilePayload.profileId) {
    const filterProfile = new FilterProfile();
    await filterProfile.deleteProfile(profilePayload.profileId);
  }
  
  return state;
};

/** Save a job to saved jobs list */
export const saveJobHandler: ActionHandler = async (state, payload) => {
  try {
    const savePayload = payload as SaveJobPayload;
    const jobsSave = new JobsSave();
    const jobsEtl = new JobsEtl();
    
    // Ensure table exists
    await jobsSave.createTable();
    
    // Get the job from jobs_etl
    const job = await jobsEtl.getById(savePayload.jobId);
    if (job) {
      // Check if already saved
      const isSaved = await jobsSave.isJobSaved(savePayload.jobId);
      if (!isSaved) {
        await jobsSave.saveFromJobEtl(job);
      } else {
        // Job already saved - sync with latest ETL data to keep it updated
        await jobsSave.syncFromJobEtl(job);
        console.log(`Synced saved job ${savePayload.jobId} with latest ETL data`);
      }
    }
    
    return state;
  } catch (error) {
    console.error('Error saving job:', error);
    throw error;
  }
};

/** Unsave a job (archive it) */
export const unsaveJobHandler: ActionHandler = async (state, payload) => {
  try {
    const savePayload = payload as SaveJobPayload;
    const jobsSave = new JobsSave();
    const jobsEtl = new JobsEtl();
    
    // Get the job from jobs_etl to sync data if job is re-saved later
    const job = await jobsEtl.getById(savePayload.jobId);
    
    // Archive the job
    await jobsSave.archiveJob(savePayload.jobId);
    console.log(`Archived job ${savePayload.jobId}`);
    
    return state;
  } catch (error) {
    console.error('Error unsaving job:', error);
    throw error;
  }
};

/** Update job status */
export const updateJobStatusHandler: ActionHandler = async (state, payload) => {
  try {
    const statusPayload = payload as UpdateJobStatusPayload;
    const jobsSave = new JobsSave();
    const jobsEtl = new JobsEtl();
    
    // Check if job is saved
    const isSaved = await jobsSave.isJobSaved(statusPayload.jobId);
    
    // If saved, sync ETL data first, then update status
    if (isSaved) {
      const job = await jobsEtl.getById(statusPayload.jobId);
      if (job) {
        await jobsSave.syncFromJobEtl(job);
      }
      await jobsSave.updateStatus(statusPayload.jobId, statusPayload.status);
      console.log(`Updated status for job ${statusPayload.jobId} to ${statusPayload.status}`);
    }
    
    return state;
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
};

/** Update job priority */
export const updateJobPriorityHandler: ActionHandler = async (state, payload) => {
  try {
    const priorityPayload = payload as UpdateJobPriorityPayload;
    const jobsSave = new JobsSave();
    const jobsEtl = new JobsEtl();
    
    // Check if job is saved
    const isSaved = await jobsSave.isJobSaved(priorityPayload.jobId);
    
    // If saved, sync ETL data first, then update priority
    if (isSaved) {
      const job = await jobsEtl.getById(priorityPayload.jobId);
      if (job) {
        await jobsSave.syncFromJobEtl(job);
      }
      await jobsSave.updatePriority(priorityPayload.jobId, priorityPayload.priority);
      console.log(`Updated priority for job ${priorityPayload.jobId} to ${priorityPayload.priority}`);
    }
    
    return state;
  } catch (error) {
    console.error('Error updating job priority:', error);
    throw error;
  }
};

/** Add job tag */
export const addJobTagHandler: ActionHandler = async (state, payload) => {
  try {
    const tagPayload = payload as AddJobTagPayload;
    const jobsSave = new JobsSave();
    const jobsEtl = new JobsEtl();
    
    // Ensure table exists
    await jobsSave.createTable();
    
    // Check if job is already saved
    let isSaved = await jobsSave.isJobSaved(tagPayload.jobId);
    
    console.log(`addJobTag: jobId=${tagPayload.jobId}, isSaved=${isSaved}, tag="${tagPayload.tag}"`);
    
    // If not saved, try to auto-save the job first
    if (!isSaved) {
      const job = await jobsEtl.getById(tagPayload.jobId);
      if (job) {
        await jobsSave.saveFromJobEtl(job);
        isSaved = true;
        console.log(`Auto-saved job ${tagPayload.jobId} from ETL before adding tag`);
      } else {
        // Job not found in ETL - create a minimal saved job entry (like updateJobReviewHandler)
        console.log(`Job ${tagPayload.jobId} not found in ETL, creating minimal saved job entry`);
        const now = new Date().toISOString();
        const minimalJob: JobsSaveType = {
          id: crypto.randomUUID(),
          saved_at: now,
          updated_at: now,
          userStatus: "saved",
          userPriority: "medium",
          userTags: "[]",
          reviewTags: "[]",
          userReview: "",
          userMetadata: "{}",
          archive: 0,
          archived_at: "",
          job_etl_id: tagPayload.jobId,
          createAt: now,
          scraper: "unknown",
          updateAt: now,
          status: "unknown",
          title: "Unknown Job",
          link: "",
          loc: "",
          tag: "",
          contract: "",
          entrepriseLinks: "",
          date: "",
          jobHead: "",
          jobText: "",
          jobHtml: "",
          company: "",
          titleKey: [],
          dateClean: "",
          jobKeywords: [],
          jobKeywordScore: [],
          iaKeywordsW5a: [],
          iaScoreW5a: 0,
          iaScoreW6a: 0,
          userTag: "",
        };
        await jobsSave.save(minimalJob);
        isSaved = true;
        console.log(`Created minimal saved job entry for ${tagPayload.jobId}`);
      }
    }
    
    // If saved, sync ETL data first to keep it updated
    if (isSaved) {
      const job = await jobsEtl.getById(tagPayload.jobId);
      if (job) {
        await jobsSave.syncFromJobEtl(job);
      }
    }
    
    // Now get the saved job and add the tag
    const savedJob = await jobsSave.getByJobEtlId(tagPayload.jobId);
    let currentTags: string[] = [];
    
    if (savedJob) {
      if (typeof savedJob.userTags === 'string') {
        try {
          currentTags = JSON.parse(savedJob.userTags);
        } catch {
          currentTags = [];
        }
      } else if (Array.isArray(savedJob.userTags)) {
        currentTags = savedJob.userTags;
      }
    }
    
    // Add new tag if not exists
    if (!currentTags.includes(tagPayload.tag)) {
      currentTags.push(tagPayload.tag);
      await jobsSave.updateTags(tagPayload.jobId, currentTags);
      console.log(`Added tag "${tagPayload.tag}" to job ${tagPayload.jobId}, total tags: ${currentTags.length}`);
      
      // Verify the update worked
      const updatedJob = await jobsSave.getByJobEtlId(tagPayload.jobId);
      let verifiedTags: string[] = [];
      if (updatedJob) {
        if (typeof updatedJob.userTags === 'string') {
          try {
            verifiedTags = JSON.parse(updatedJob.userTags);
          } catch {
            verifiedTags = [];
          }
        } else if (Array.isArray(updatedJob.userTags)) {
          verifiedTags = updatedJob.userTags;
        }
      }
      console.log(`Verification - userTags: ${JSON.stringify(verifiedTags)}`);
    }
    
    return state;
  } catch (error) {
    console.error('Error adding job tag:', error);
    throw error;
  }
};

/** Remove job tag */
export const removeJobTagHandler: ActionHandler = async (state, payload) => {
  try {
    const tagPayload = payload as RemoveJobTagPayload;
    const jobsSave = new JobsSave();
    
    // Get current tags
    const savedJob = await jobsSave.getByJobEtlId(tagPayload.jobId);
    let currentTags: string[] = [];
    
    if (savedJob) {
      if (typeof savedJob.userTags === 'string') {
        try {
          currentTags = JSON.parse(savedJob.userTags);
        } catch {
          currentTags = [];
        }
      } else if (Array.isArray(savedJob.userTags)) {
        currentTags = savedJob.userTags;
      }
    }
    
    // Remove tag
    currentTags = currentTags.filter(t => t !== tagPayload.tag);
    await jobsSave.updateTags(tagPayload.jobId, currentTags);
    
    return state;
  } catch (error) {
    console.error('Error removing job tag:', error);
    throw error;
  }
};

/** Update job review */
export const updateJobReviewHandler: ActionHandler = async (state, payload) => {
  try {
    const reviewPayload = payload as UpdateJobReviewPayload;
    const jobsSave = new JobsSave();
    const jobsEtl = new JobsEtl();
    
    // Ensure table exists
    await jobsSave.createTable();
    
    // Check if job is already saved
    let isSaved = await jobsSave.isJobSaved(reviewPayload.jobId);
    
    console.log(`updateJobReview: jobId=${reviewPayload.jobId}, isSaved=${isSaved}, review length=${reviewPayload.review?.length || 0}`);
    
    // If not saved, try to auto-save the job first
    if (!isSaved) {
      const job = await jobsEtl.getById(reviewPayload.jobId);
      if (job) {
        await jobsSave.saveFromJobEtl(job);
        isSaved = true;
        console.log(`Auto-saved job ${reviewPayload.jobId} from ETL`);
      } else {
        // Job not found in ETL - create a minimal saved job entry
        console.log(`Job ${reviewPayload.jobId} not found in ETL, creating minimal saved job entry`);
        const now = new Date().toISOString();
        const minimalJob: JobsSaveType = {
          id: crypto.randomUUID(),
          saved_at: now,
          updated_at: now,
          userStatus: "saved",
          userPriority: "medium",
          userTags: "[]",
          reviewTags: "[]",
          userReview: "",
          userMetadata: "{}",
          archive: 0,
          archived_at: "",
          job_etl_id: reviewPayload.jobId,
          createAt: now,
          scraper: "unknown",
          updateAt: now,
          status: "unknown",
          title: "Unknown Job",
          link: "",
          loc: "",
          tag: "",
          contract: "",
          entrepriseLinks: "",
          date: "",
          jobHead: "",
          jobText: "",
          jobHtml: "",
          company: "",
          titleKey: [],
          dateClean: "",
          jobKeywords: [],
          jobKeywordScore: [],
          iaKeywordsW5a: [],
          iaScoreW5a: 0,
          iaScoreW6a: 0,
          userTag: "",
        };
        await jobsSave.save(minimalJob);
        isSaved = true;
        console.log(`Created minimal saved job entry for ${reviewPayload.jobId}`);
      }
    }
    
    if (isSaved) {
      // Sync ETL data first to keep it updated
      const job = await jobsEtl.getById(reviewPayload.jobId);
      if (job) {
        await jobsSave.syncFromJobEtl(job);
      }
      
      // Now update the review
      await jobsSave.updateReview(reviewPayload.jobId, reviewPayload.review);
      console.log(`Updated review for job ${reviewPayload.jobId}`);
      
      // Verify the update worked
      const updatedJob = await jobsSave.getByJobEtlId(reviewPayload.jobId);
      console.log(`Verification - userReview: "${updatedJob?.userReview?.substring(0, 50)}..."`);
    }
    
    return state;
  } catch (error) {
    console.error('Error updating job review:', error);
    throw error;
  }
};

/** Add review tag */
export const addReviewTagHandler: ActionHandler = async (state, payload) => {
  try {
    const tagPayload = payload as AddReviewTagPayload;
    const jobsSave = new JobsSave();
    
    // Get current review tags
    const savedJob = await jobsSave.getByJobEtlId(tagPayload.jobId);
    let currentTags: string[] = [];
    
    if (savedJob) {
      if (typeof savedJob.reviewTags === 'string') {
        try {
          currentTags = JSON.parse(savedJob.reviewTags);
        } catch {
          currentTags = [];
        }
      } else if (Array.isArray(savedJob.reviewTags)) {
        currentTags = savedJob.reviewTags;
      }
    }
    
    // Add new tag if not exists
    if (!currentTags.includes(tagPayload.tag)) {
      currentTags.push(tagPayload.tag);
      await jobsSave.updateReviewTags(tagPayload.jobId, currentTags);
    }
    
    return state;
  } catch (error) {
    console.error('Error adding review tag:', error);
    throw error;
  }
};

/** Remove review tag */
export const removeReviewTagHandler: ActionHandler = async (state, payload) => {
  try {
    const tagPayload = payload as RemoveReviewTagPayload;
    const jobsSave = new JobsSave();
    
    // Get current review tags
    const savedJob = await jobsSave.getByJobEtlId(tagPayload.jobId);
    let currentTags: string[] = [];
    
    if (savedJob) {
      if (typeof savedJob.reviewTags === 'string') {
        try {
          currentTags = JSON.parse(savedJob.reviewTags);
        } catch {
          currentTags = [];
        }
      } else if (Array.isArray(savedJob.reviewTags)) {
        currentTags = savedJob.reviewTags;
      }
    }
    
    // Remove tag
    currentTags = currentTags.filter(t => t !== tagPayload.tag);
    await jobsSave.updateReviewTags(tagPayload.jobId, currentTags);
    
    return state;
  } catch (error) {
    console.error('Error removing review tag:', error);
    throw error;
  }
};

/** Add a keyword as stopword */
export const addStopwordHandler: ActionHandler = async (state, payload) => {
  try {
    const stopwordPayload = payload as AddStopwordPayload;
    const keywords = new Keywords();
    
    await keywords.addStopword(stopwordPayload.keyword);
    console.log(`Added stopword: "${stopwordPayload.keyword}"`);
    
    return state;
  } catch (error) {
    console.error('Error adding stopword:', error);
    throw error;
  }
};

/** Remove a keyword from stopwords */
export const removeStopwordHandler: ActionHandler = async (state, payload) => {
  try {
    const stopwordPayload = payload as RemoveStopwordPayload;
    const keywords = new Keywords();
    
    await keywords.removeStopword(stopwordPayload.keyword);
    console.log(`Removed stopword: "${stopwordPayload.keyword}"`);
    
    return state;
  } catch (error) {
    console.error('Error removing stopword:', error);
    throw error;
  }
};

/** Add a tag to a keyword */
export const addKeywordTagHandler: ActionHandler = async (state, payload) => {
  try {
    const tagPayload = payload as AddKeywordTagPayload;
    const keywords = new Keywords();
    
    await keywords.addTag(tagPayload.keyword, tagPayload.tag);
    console.log(`Added tag "${tagPayload.tag}" to keyword: "${tagPayload.keyword}"`);
    
    return state;
  } catch (error) {
    console.error('Error adding keyword tag:', error);
    throw error;
  }
};

/** Remove a tag from a keyword */
export const removeKeywordTagHandler: ActionHandler = async (state, payload) => {
  try {
    const tagPayload = payload as RemoveKeywordTagPayload;
    const keywords = new Keywords();
    
    await keywords.removeTag(tagPayload.keyword, tagPayload.tag);
    console.log(`Removed tag "${tagPayload.tag}" from keyword: "${tagPayload.keyword}"`);
    
    return state;
  } catch (error) {
    console.error('Error removing keyword tag:', error);
    throw error;
  }
};

/** Search keywords */
export const searchKeywordsHandler: ActionHandler = async (state, payload) => {
  try {
    const searchPayload = payload as SearchKeywordsPayload;
    const keywords = new Keywords();
    
    const results = await keywords.searchKeywords(
      searchPayload.searchTerm,
      searchPayload.limit || 100,
      searchPayload.offset || 0
    );
    console.log(`Searched keywords for "${searchPayload.searchTerm}", found: ${results.length}`);
    
    return state;
  } catch (error) {
    console.error('Error searching keywords:', error);
    throw error;
  }
};

/** Map of async action handlers */
export const asyncActionHandlers: Record<string, ActionHandler> = {
  saveFilterProfile: saveFilterProfileHandler,
  applyFilterProfile: applyFilterProfileHandler,
  addFilterProfile: addFilterProfileHandler,
  deleteFilterProfile: deleteFilterProfileHandler,
  saveJob: saveJobHandler,
  unsaveJob: unsaveJobHandler,
  updateJobStatus: updateJobStatusHandler,
  updateJobPriority: updateJobPriorityHandler,
  addJobTag: addJobTagHandler,
  removeJobTag: removeJobTagHandler,
  updateJobReview: updateJobReviewHandler,
  saveJobReview: updateJobReviewHandler, // Alias for saveJobReview
  addReviewTag: addReviewTagHandler,
  removeReviewTag: removeReviewTagHandler,
  addStopword: addStopwordHandler,
  removeStopword: removeStopwordHandler,
  addKeywordTag: addKeywordTagHandler,
  removeKeywordTag: removeKeywordTagHandler,
  searchKeywords: searchKeywordsHandler,
};
