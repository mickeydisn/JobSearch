import { Application, Context, Router, send } from "@oak/oak";

// State management
import {
  parseState,
  serializeState,
  buildStateDisplay,
  applyAction,
} from "./sidebar/state_manager.ts";

// Menu/Filter builders
import { buildPageButtons } from "./sidebar/page_buttons.ts";
import { buildFilterMenu } from "./sidebar/filter_builder.ts";
import { buildKeywordFilterMenu } from "./sidebar/filter_keyword.ts";

// Page registry (imports all pages to trigger registration)
import { buildPageContent } from "./pages/mod.ts";

// Keep buildMoreJobsRows for infinite scroll
import { buildMoreJobsRows } from "./routes/jobs/page.ts";

// Import page builders for direct imports in processing endpoints
import {
  buildConfigEditor,
  buildConfigSaveResponse,
  getJobConfig,
  updateJobConfig,
} from "./routes/processing/components/config_editor.ts";
import { buildProcessResponse } from "./routes/processing/components/runner.ts";

// Analysis chart data
import { getChartData } from "./routes/analysis/chart_data.ts";

// Process management
import { processManager } from "./core/process_manager.ts";
import { ScrapJobsUsecase } from "./usecases/scrap_jobs_usecase.ts";
import { UpdateJobsUsecase } from "./usecases/update_jobs_usecase.ts";

// Types
import { CurrentState } from "./types/index.ts";

// Register processes
processManager.register(ScrapJobsUsecase);
processManager.register(UpdateJobsUsecase);
console.log("📋 Registered processes:", processManager.getProcessDefinitions().map(p => p.name).join(", "));

// Initialize database tables on startup
import { JobsEtl } from "../api_sqlite/table_jobs.ts";
import { JobsSave } from "../api_sqlite/table_jobs_save.ts";
import { Keywords } from "../api_sqlite/table_keywords.ts";
import { KeywordFrequency } from "../api_sqlite/table_keyword_frequency.ts";
import { FilterProfile } from "../api_sqlite/table_filter_profile.ts";

const initTables = async () => {
  console.log("🏗️ Initializing database tables...");
  
  const jobsEtl = new JobsEtl();
  await jobsEtl.createTable();
  console.log("  ✅ jobs_etl table ready");
  
  const jobsSave = new JobsSave();
  await jobsSave.createTable();
  console.log("  ✅ jobs_save table ready");
  
  const keywords = new Keywords();
  await keywords.createTable();
  console.log("  ✅ keywords table ready");
  
  const keywordFreq = new KeywordFrequency();
  await keywordFreq.createTable();
  console.log("  ✅ keyword_frequency table ready");
  
  const filterProfile = new FilterProfile();
  await filterProfile.createTable();
  console.log("  ✅ filter_profile table ready");
  
  console.log("🏁 Database initialization complete");
};

await initTables();

/** Serve static files */
export const serveStatic = async (context: Context) => {
  const filePath = context.request.url.pathname;
  const rootDir = `${Deno.cwd()}/`;
  try {
    await send(context, filePath, { root: rootDir, index: "index.html" });
  } catch {
    context.response.status = 404;
    context.response.body = "File not found";
  }
};

const router = new Router();

// Static files
router.get("/web/(.*)", serveStatic);
router.get("/styles.css", serveStatic);

// ============================================
// API Endpoints - All use POST with JSON state
// ============================================

/** Initialize page - loads all menu components */
router.post("/api/init", async (context: Context) => {
  const body = await context.request.body.json();
  const state: CurrentState = body.state || parseState(null);

  context.response.body = {
    state: serializeState(state),
    components: {
      stateDisplay: buildStateDisplay(state),
      pageButtons: buildPageButtons(state),
      filters: await buildFilterMenu(state),
      keywordFilters: await buildKeywordFilterMenu(state),
    },
  };
});

/** Handle menu actions (page change, filter toggle, etc.) */
router.post("/api/action", async (context: Context) => {
  const body = await context.request.body.json();
  const currentState: CurrentState = body.state || parseState(null);
  const action = body.action || {};

  console.log("Action:", action.type, action.payload);

  // Apply action to get new state
  const newState = await applyAction(currentState, action.type, action.payload);

  // Build response with updated components
  const response: {
    state: string;
    mainContent?: string;
    oobUpdates: { target: string; html: string }[];
  } = {
    state: serializeState(newState),
    oobUpdates: [],
  };

  // Always update state display (includes filters), page buttons, and filter menus
  response.oobUpdates.push(
    { target: "#current-state", html: buildStateDisplay(newState) },
    { target: "#page-buttons", html: buildPageButtons(newState) },
    { target: "#filters", html: await buildFilterMenu(newState) },
    { target: "#keyword-filters", html: await buildKeywordFilterMenu(newState) },
  );

  // Build main content based on current page using registry
  response.mainContent = await buildPageContent(newState.currentPage, newState) ||
    "<div class='empty'><p>Page not found</p></div>";

  console.log(`Action response: mainContent length=${response.mainContent?.length || 0}, oobUpdates count=${response.oobUpdates.length}`);

  // Set Content-Type to JSON
  context.response.headers.set("Content-Type", "application/json");
  context.response.body = JSON.stringify(response);
});

/** Load more jobs for infinite scroll */
router.post("/api/loadMoreJobs", async (context: Context) => {
  const contentType = context.request.headers.get("content-type") || "";
  console.log("[loadMoreJobs] Content-Type:", contentType);
  
  let state: CurrentState;
  
  if (contentType.includes("application/json")) {
    // Handle JSON request (from HTMX with json-enc)
    const rawBody = await context.request.body.text();
    console.log("[loadMoreJobs] Raw body:", rawBody?.substring(0, 200));
    
    let body;
    try {
      body = JSON.parse(rawBody);
      console.log("[loadMoreJobs] Parsed body keys:", Object.keys(body));
      console.log("[loadMoreJobs] Body.state type:", typeof body.state);
      console.log("[loadMoreJobs] Body.state:", body.state ? "exists" : "null/undefined");
      if (body.state) {
        console.log("[loadMoreJobs] Body.state.filters:", JSON.stringify(body.state.filters));
      }
    } catch (e) {
      console.log("[loadMoreJobs] Failed to parse JSON:", e.message);
      body = {};
    }
    
    state = body.state || parseState(null);
    console.log("[loadMoreJobs] Final state.filters:", JSON.stringify(state.filters));
  } else {
    // Handle form data (from HTMX hx-vals)
    console.log("[loadMoreJobs] Form data received");
    const formData = await context.request.body.formData();
    const stateStr = formData.get("state")?.toString();
    console.log("[loadMoreJobs] state from form:", stateStr?.substring(0, 100));
    if (stateStr && stateStr !== "null") {
      state = JSON.parse(stateStr);
    } else {
      state = parseState(null);
    }
  }
  
  console.log("[loadMoreJobs] Final state.filters:", JSON.stringify(state.filters));

  // Ensure state has pagination (fallback if not provided)
  if (!state.pagination) {
    state.pagination = { page: 1, pageSize: 10 };
  }

  console.log("[loadMoreJobs] Pagination:", state.pagination.page, "offset:", (state.pagination.page - 1) * state.pagination.pageSize);
  
  // NOTE: Page increment is now handled client-side in hx-vals
  // The client sends the next page number already incremented

  const rows = await buildMoreJobsRows(state);
  
  // Set Content-Type to HTML
  context.response.headers.set("Content-Type", "text/html");
  
  // If no more rows, return a visible end-of-list indicator
  if (!rows || rows.trim() === "") {
    context.response.body = `
      <tr>
        <td>
          <div class="end-of-list-indicator" style="
            text-align: center; 
            padding: 20px; 
            color: var(--color-gray-500);
            background: var(--color-bg-secondary);
            border-radius: 8px;
            margin: 10px 0;
          ">
            <i class="fa fa-check-circle" style="font-size: 24px; margin-bottom: 8px;"></i>
            <p style="margin: 0; font-size: 14px;">You've reached the end of the list</p>
          </div>
        </td>
      </tr>
    `;
  } else {
    context.response.body = rows;
  }
});

/** Refresh filters only (used after initial load) */
router.post("/api/refreshFilters", async (context: Context) => {
  const body = await context.request.body.json();
  const state: CurrentState = body.state || parseState(null);

  context.response.body = {
    state: serializeState(state),
    oobUpdates: [
      { target: "#filters", html: await buildFilterMenu(state) },
      { target: "#keyword-filters", html: await buildKeywordFilterMenu(state) },
    ],
  };
});

/** Config Editor - Load editor (legacy) */
router.get("/api/config-editor", async (context: Context) => {
  const state: CurrentState = parseState(null);
  context.response.body = await buildConfigEditor(state);
});

/** Config Editor - Save configuration (legacy) */
router.post("/api/config-editor/save", async (context: Context) => {
  const body = await context.request.body.formData();
  const configContent = body.get("configContent")?.toString() || "";

  // Import the save function
  const { saveFullConfig } = await import("./routes/processing/components/config_editor.ts");
  const result = await saveFullConfig(configContent);

  // Return just the message to be swapped into the message container
  context.response.body = buildConfigSaveResponse(result.success, result.error);
});

/** Job Config - Get configuration for a specific job */
router.get("/api/job-config/:jobId", async (context: Context) => {
  // @ts-ignore - params is added by router middleware
  const jobId = context.params.jobId;
  
  const config = await getJobConfig(jobId);
  
  if (!config) {
    context.response.status = 404;
    context.response.body = { error: "Job not found" };
    return;
  }
  
  context.response.body = {
    jobId,
    section: config.section,
    config: config.config,
    configJson: JSON.stringify(config.config, null, 2)
  };
});

/** Job Config - Save configuration for a specific job */
router.post("/api/job-config/:jobId", async (context: Context) => {
  // @ts-ignore - params is added by router middleware
  const jobId = context.params.jobId;
  const body = await context.request.body.json();
  const configContent = body.configContent || "";
  
  const result = await updateJobConfig(jobId, configContent);
  
  context.response.body = buildConfigSaveResponse(result.success, result.error);
});

/** Process Runner - Run a process (non-streaming, returns final result) */
router.post("/api/process/run/:processId", async (context) => {
  // @ts-ignore - params is added by router middleware
  const processId = context.params.processId;
  console.log(`Running process: ${processId}`);

  // Use the process manager to run the process
  const result = await processManager.runProcess(processId);

  context.response.body = buildProcessResponse(
    processId,
    result.output,
    result.error
  );
});

/** Process Runner - Stream process logs via SSE */
router.get("/api/process/stream/:processId", async (context) => {
  // @ts-ignore - params is added by router middleware
  const processId = context.params.processId;
  console.log(`Starting stream for process: ${processId}`);

  const stream = processManager.createProcessStream(processId);

  context.response.type = "text/event-stream";
  context.response.headers.set("Cache-Control", "no-cache");
  context.response.headers.set("Connection", "keep-alive");
  context.response.body = stream;
});

/** Process Runner - Stream process logs for individual scraper via SSE */
router.get("/api/process/stream/scrap/:scraperName", async (context) => {
  // @ts-ignore - params is added by router middleware
  const scraperName = context.params.scraperName;
  const processId = `scrap:${scraperName}`;
  console.log(`Starting stream for scraper: ${scraperName}`);

  const stream = processManager.createProcessStream(processId);

  context.response.type = "text/event-stream";
  context.response.headers.set("Cache-Control", "no-cache");
  context.response.headers.set("Connection", "keep-alive");
  context.response.body = stream;
});

/** Process Runner - Kill a running process */
router.post("/api/process/kill/:processId", async (context) => {
  // @ts-ignore - params is added by router middleware
  const processId = context.params.processId;
  console.log(`Killing process: ${processId}`);

  const killed = processManager.killProcess(processId);

  context.response.body = {
    success: killed,
    message: killed ? `Process '${processId}' killed` : `Process '${processId}' not running`,
  };
});

/** Analysis - Get chart data for the analysis page */
router.post("/api/analysis/chart-data", async (context: Context) => {
  const body = await context.request.body.json();
  const state: CurrentState = body.state ? JSON.parse(body.state) : parseState(null);
  
  const chartData = await getChartData(state);
  context.response.body = chartData;
});

// ============================================
// Legacy endpoints (kept for compatibility)
// ============================================

// import { getPromptData } from "./controllers.ts";
// import { jobPromptBar } from "./box/job_prompt_bar.ts";
// import { jobUpdateTag } from "./job_update.ts";

// router.get("/queryPrompt", getPromptData);
// router.get("/jobPromptBar/:id", jobPromptBar);
// router.get("/job/updateTag/:id/:func/:tag", jobUpdateTag);

// ============================================
// Start server
// ============================================

const app = new Application();
const port = 8080;

app.use(router.routes());
app.use(router.allowedMethods());

console.log(`Server running on http://localhost:${port}`);

await app.listen({ port });
