import { CurrentState } from "../../../types/index.ts";
import { processManager } from "../../../core/process_manager.ts";
import { loadConfig, type AppConfiguration, type ScraperConfig, type UpdateJobsConfig } from "../../../core/config_manager.ts";

/** Job definition for the UI */
export interface JobDefinition {
  id: string;
  name: string;
  category: 'scrap' | 'update';
  description: string;
  icon: string;
  configSection: string;
}

/** Load all available jobs from configuration */
async function loadJobDefinitions(): Promise<JobDefinition[]> {
  const config = await loadConfig();
  const jobs: JobDefinition[] = [];

  // Add Update Jobs
  jobs.push({
    id: 'update',
    name: 'Update Jobs ETL',
    category: 'update',
    description: 'Rebuild jobs_etl and keyword_frequency tables from jobs_raw with TF-IDF scoring. Applies filters for date, status, and tags.',
    icon: 'fa-refresh',
    configSection: 'update_jobs'
  });

  // Add Scrap Jobs (all scrapers)
  jobs.push({
    id: 'scrap',
    name: 'Scrape All Jobs',
    category: 'scrap',
    description: 'Scrape jobs from all enabled sources (HelloWork, LinkedIn, Welcome to the Jungle) and process TF-IDF scores.',
    icon: 'fa-download',
    configSection: 'scrap_jobs'
  });

  // Add individual scrapers
  for (const [name, scraperConfig] of Object.entries(config.scrap_jobs)) {
    jobs.push({
      id: `scrap:${name}`,
      name: `Scrape ${scraperConfig.name}`,
      category: 'scrap',
      description: `Scrape jobs from ${scraperConfig.name} (${scraperConfig.baseUrl}). ${scraperConfig.enabled ? 'Enabled' : 'Disabled'} in configuration.`,
      icon: 'fa-globe',
      configSection: `scrap_jobs.${name}`
    });
  }

  return jobs;
}

/** Build job selector options */
async function buildJobSelectorOptions(): Promise<string> {
  const jobs = await loadJobDefinitions();
  
  return jobs.map(job => `
    <option value="${job.id}" data-category="${job.category}">
      ${job.name}
    </option>
  `).join('');
}

/** Get job config for editing */
async function getJobConfigSection(jobId: string, config: AppConfiguration): Promise<unknown> {
  if (jobId === 'update') {
    return config.update_jobs;
  }
  if (jobId === 'scrap') {
    return config.scrap_jobs;
  }
  if (jobId.startsWith('scrap:')) {
    const scraperName = jobId.split(':')[1] as keyof typeof config.scrap_jobs;
    return config.scrap_jobs[scraperName];
  }
  return null;
}

/** Build the process runner section with job selection and config editor */
export const buildProcessRunner = async (_state: CurrentState): Promise<string> => {
  const jobOptions = await buildJobSelectorOptions();
  const jobs = await loadJobDefinitions();
  const jobsJson = JSON.stringify(jobs);

  return `
    <div id="process-runner-container">
      <div style="display: grid; grid-template-columns: 350px 1fr; gap: var(--space-lg);">
        <!-- Left: Job Selection & Config -->
        <div>
          <!-- Job Selector -->
          <div class="box" style="margin-bottom: var(--space-md);">
            <div class="box-header">
              <div class="box-title">
                <i class="fa fa-tasks"></i>
                Select Job
              </div>
            </div>
            <div class="box-body">
              <div class="form-group">
                <select id="job-selector" class="form-select" onchange="onJobSelected(this.value)" style="width: 100%;">
                  <option value="">-- Select a job --</option>
                  ${jobOptions}
                </select>
              </div>
            </div>
          </div>

          <!-- Job Description -->
          <div id="job-description-panel" class="box" style="margin-bottom: var(--space-md); display: none;">
            <div class="box-header">
              <div class="box-title">
                <i class="fa fa-info-circle"></i>
                Description
              </div>
            </div>
            <div class="box-body">
              <p id="job-description-text" style="font-size: var(--font-size-sm); color: var(--color-gray-600); margin: 0;"></p>
            </div>
          </div>

          <!-- Job Config Editor -->
          <div id="job-config-panel" class="box" style="margin-bottom: var(--space-md); display: none;">
            <div class="box-header">
              <div class="box-title">
                <i class="fa fa-wrench"></i>
                Configuration
              </div>
            </div>
            <div class="box-body">
              <form id="job-config-form" onsubmit="saveJobConfig(event)">
                <input type="hidden" id="job-config-jobid" name="jobId" value="">
                <div class="form-group">
                  <textarea id="job-config-textarea" 
                            name="configContent"
                            class="form-input form-textarea" 
                            spellcheck="false"
                            style="font-family: monospace; font-size: var(--font-size-sm); min-height: 300px;"></textarea>
                </div>
                <div style="display: flex; gap: var(--space-sm);">
                  <button type="submit" class="btn btn-primary btn-sm">
                    <i class="fa fa-save"></i>
                    Save Config
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm" onclick="reloadJobConfig()">
                    <i class="fa fa-refresh"></i>
                    Reload
                  </button>
                </div>
              </form>
              <div id="config-save-message" style="margin-top: var(--space-sm);"></div>
            </div>
          </div>

          <!-- Run Button -->
          <div id="job-run-panel" style="display: none;">
            <button id="run-process-btn" class="btn btn-success btn-lg btn-block" onclick="runSelectedJob()">
              <i class="fa fa-play"></i>
              <strong>Run Job</strong>
            </button>
            <button id="kill-process-btn" class="btn btn-danger btn-lg btn-block" 
                    disabled
                    onclick="killCurrentJob()"
                    style="display: none; margin-top: var(--space-sm);">
              <i class="fa fa-stop"></i>
              <strong>Stop Job</strong>
            </button>
            <div id="process-indicator" class="loading" style="display: none; margin-top: var(--space-md);">
              <i class="fa fa-spinner fa-spin"></i>
              <span>Running...</span>
            </div>
          </div>
        </div>

        <!-- Right: Log Output -->
        <div class="box" style="margin: 0;">
          <div class="box-header" style="background: var(--color-gray-800); color: var(--color-white);">
            <div class="box-title" style="color: var(--color-white);">
              <i class="fa fa-terminal"></i>
              Log Output
            </div>
          </div>
          <div class="box-body" style="padding: 0;">
            <pre id="process-log-content" class="process-log" style="margin: 0; border-radius: 0; max-height: 600px; overflow-y: auto;">
              <code id="log-lines">Select a job and click "Run Job" to start execution...

Logs will appear here in real-time...</code>
            </pre>
          </div>
        </div>
      </div>

      <!-- Store jobs data for JavaScript -->
      <script id="jobs-data" type="application/json">${jobsJson}</script>
    </div>
  `;
};

/** Build process execution response from ProcessResult (fallback for non-streaming) */
export const buildProcessResponse = (processId: string, output: string, error?: string): string => {
  const timestamp = new Date().toLocaleString();

  if (error) {
    return `<div class="process-log-line error">[${timestamp}] ERROR running ${processId}: ${error}</div>`;
  }

  return `<div class="process-log-line success">[${timestamp}] Process '${processId}' completed successfully\n${"=".repeat(60)}\n${output || "(No output)"}\n${"=".repeat(60)}\nDone.</div>`;
};
