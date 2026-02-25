import { CurrentState } from "../../types/index.ts";
import { JobsEtl, JobsEtlType } from "../../../api_sqlite/table_jobs.ts";
import { JobsSave, JobsSaveType } from "../../../api_sqlite/table_jobs_save.ts";
import { itemDiv } from "./components/job_card.ts";
import { Page, registerPage } from "../../pages/page_registry.ts";

/** Source filter types */
type SourceFilter = "jobs-etl" | "all-saved" | "saved-only" | "saved-archived";

/** Clean filters by removing non-database fields */
const cleanFiltersForEtl = (filters: Record<string, any>): Record<string, any> => {
  const cleaned = { ...filters };
  delete cleaned["source"];
  delete cleaned["rejectedKeywords"];
  return cleaned;
};

/** Get jobs based on source filter */
const getJobsBySource = async (
  source: SourceFilter,
  filters: Record<string, any>,
  limit: number,
  offset: number,
): Promise<{ jobs: (JobsEtlType | JobsSaveType)[]; source: SourceFilter }> => {
  const jobsSave = new JobsSave();
  
  // Ensure table exists
  try {
    await jobsSave.createTable();
  } catch {
    // Table might not exist yet
  }

  // Clean filters for ETL queries (remove non-database fields)
  const etlFilters = cleanFiltersForEtl(filters);

  switch (source) {
    case "jobs-etl": {
      // JobsETL Only - show only ETL jobs
      const jobsEtl = new JobsEtl();
      const jobs = await jobsEtl.search(etlFilters, limit, offset);
      return { jobs, source };
    }
    
    case "saved-only": {
      // Saved Only - show only saved jobs (non-archived), applying filters
      const savedJobs = await jobsSave.getSavedJobs(limit, offset, "updated_at", "DESC", etlFilters);
      return { jobs: savedJobs, source };
    }
    
    case "saved-archived": {
      // Saved + Archived - show all saved jobs
      const savedJobs = await jobsSave.getAllJobs(limit, offset, "updated_at", "DESC");
      return { jobs: savedJobs, source };
    }
    
    case "all-saved":
    default: {
      // All + Saved - show ETL jobs and saved jobs
      const jobsEtl = new JobsEtl();
      const etlJobs = await jobsEtl.search(etlFilters, limit, offset);
      
      // Get saved jobs to check which are saved
      const savedJobs = await jobsSave.getSavedJobs(1000, 0, "updated_at", "DESC");
      const savedJobIds = new Set(savedJobs.map(s => s.job_etl_id));
      
      // For each ETL job, check if it's saved and add saved info
      const combinedJobs = etlJobs.map(job => {
        if (savedJobIds.has(job.id)) {
          const saved = savedJobs.find(s => s.job_etl_id === job.id);
          return { ...job, _savedJob: saved };
        }
        return job;
      });
      
      return { jobs: combinedJobs, source };
    }
  }
};

/** Build the jobs table page */
const buildJobsPage = async (state: CurrentState): Promise<string> => {
  const tableContent = await buildJobsTable(state);

  return `
    <div id="page-content">
      ${tableContent}
    </div>
  `;
};

/** Build jobs table with infinite scroll */
const buildJobsTable = async (state: CurrentState): Promise<string> => {
  const nByPage = state.pagination.pageSize;
  const offset = (state.pagination.page - 1) * nByPage;

  // Get source filter from state (default: all-saved)
  const sourceFilter = state.filters.source;
  const source = (typeof sourceFilter === 'string' ? sourceFilter : Array.isArray(sourceFilter) ? sourceFilter[0] : "all-saved") as SourceFilter;
  
  // Get jobs based on source filter
  const { jobs, source: actualSource } = await getJobsBySource(source, state.filters, nByPage, offset);

  // Get saved jobs map for displaying saved status
  const jobsSave = new JobsSave();
  const savedJobsMap = new Map<string, any>();
  
  try {
    const savedJobs = await jobsSave.getSavedJobs(1000, 0, "updated_at", "DESC");
    for (const savedJob of savedJobs) {
      savedJobsMap.set(savedJob.job_etl_id, savedJob);
    }
  } catch {
    // Table doesn't exist yet or other error - ignore
  }

  // Serialize state for hx-vals
  const stateJson = JSON.stringify(state).replace(/'/g, "&#39;");

  // Build table rows
  const rows = jobs.map((job, idx) => {
    const isLast = idx === jobs.length - 1;
    const loadMoreAttrs = isLast
      ? `hx-post="/api/loadMoreJobs"
         hx-ext="json-enc"
         hx-trigger="intersect"
         hx-vals='{"state": ${stateJson}}'
         hx-swap="afterend"`
      : "";

    // For saved-only and saved-archived views, job already IS the saved job
    // For other views, we need to check if it's saved
    let savedJob = null;
    if ('job_etl_id' in job) {
      // This is a JobsSaveType
      savedJob = job;
    } else if ('id' in job) {
      // This is a JobsEtlType
      savedJob = savedJobsMap.get(job.id) || null;
    }

    return `
      <tr ${loadMoreAttrs}>
        <td>
          ${itemDiv(job as JobsEtlType, savedJob)}
        </td>
      </tr>
    `;
  }).join("");

  return `
    <table class="table">
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

/** Build additional job rows for infinite scroll */
const buildMoreJobsRows = async (
  state: CurrentState,
): Promise<string> => {
  const nByPage = state.pagination.pageSize;
  const offset = (state.pagination.page - 1) * nByPage;

  const sourceFilter = state.filters.source;
  const source = (typeof sourceFilter === 'string' ? sourceFilter : Array.isArray(sourceFilter) ? sourceFilter[0] : "all-saved") as SourceFilter;
  const { jobs } = await getJobsBySource(source, state.filters, nByPage, offset);

  if (jobs.length === 0) {
    return "";
  }

  // Get saved jobs map
  const jobsSave = new JobsSave();
  const savedJobsMap = new Map<string, any>();
  
  try {
    const savedJobs = await jobsSave.getSavedJobs(1000, 0, "updated_at", "DESC");
    for (const savedJob of savedJobs) {
      savedJobsMap.set(savedJob.job_etl_id, savedJob);
    }
  } catch {
    // Table doesn't exist yet
  }

  // Serialize state for hx-vals (with incremented page for next batch)
  const nextState = { ...state, pagination: { ...state.pagination, page: state.pagination.page + 1 } };
  const stateJson = JSON.stringify(nextState).replace(/'/g, "&#39;");

  // Build table rows
  const rows = jobs.map((job, idx) => {
    const isLast = idx === jobs.length - 1;
    const loadMoreAttrs = isLast
      ? `hx-post="/api/loadMoreJobs"
         hx-ext="json-enc"
         hx-trigger="intersect"
         hx-vals='{"state": ${stateJson}}'
         hx-swap="afterend"`
      : "";

    let savedJob = null;
    if ('job_etl_id' in job) {
      savedJob = job;
    } else if ('id' in job) {
      savedJob = savedJobsMap.get(job.id) || null;
    }

    return `
      <tr ${loadMoreAttrs}>
        <td>
          ${itemDiv(job as JobsEtlType, savedJob)}
        </td>
      </tr>
    `;
  }).join("");

  return rows;
};

/** Jobs Page implementation */
const jobsPage: Page = {
  id: "jobs",
  name: "Jobs List",
  icon: "fa-list",
  build: buildJobsPage,
};

// Register the page
registerPage(jobsPage);

// Keep exports for backwards compatibility
export { buildJobsPage, buildMoreJobsRows };
