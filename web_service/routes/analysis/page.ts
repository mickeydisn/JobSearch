import { CurrentState } from "../../types/index.ts";
import { JobsEtl } from "../../../api_sqlite/table_jobs.ts";
import { getDb, aggFieldCount } from "../../../api_sqlite/db.ts";
import { Page, registerPage } from "../../pages/page_registry.ts";

/** Clean filters by removing non-database fields */
const cleanFilters = (filters: Record<string, any>): Record<string, any> => {
  const cleaned = { ...filters };
  delete cleaned["source"];
  delete cleaned["rejectedKeywords"];
  return cleaned;
};

/** Build the analysis page */
const buildAnalysisPage = async (state: CurrentState): Promise<string> => {
  const stats = await buildAnalysisStats(state);
  const charts = buildAnalysisCharts();
  const keywordCloud = await buildKeywordCloud(state);

  return `
    <div id="page-content">
      ${stats}
      ${charts}
      ${keywordCloud}
    </div>
  `;
};

/** Build analysis stats cards */
const buildAnalysisStats = async (state: CurrentState): Promise<string> => {
  const jobsEtl = new JobsEtl();
  const cleanStateFilters = cleanFilters(state.filters);
  
  // Get total count with filters applied
  const allJobs = await jobsEtl.search(cleanStateFilters, 100000, 0);
  const totalJobs = allJobs.length;
  
  // Get unique scrapers count
  const scrapers = new Set(allJobs.map(j => j.scraper)).size;
  
  // Get unique companies count
  const companies = new Set(allJobs.map(j => j.company).filter(Boolean)).size;
  
  // Get date range
  const dates = allJobs.map(j => j.dateClean).filter(Boolean).sort();
  const dateRange = dates.length > 0 
    ? `${dates[0]} to ${dates[dates.length - 1]}`
    : "No dates available";

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${totalJobs}</div>
        <div class="stat-label">Total Jobs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${scrapers}</div>
        <div class="stat-label">Sources</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${companies}</div>
        <div class="stat-label">Companies</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="font-size: var(--font-size-sm);">${dateRange}</div>
        <div class="stat-label">Date Range</div>
      </div>
    </div>
  `;
};

/** Build analysis charts section */
const buildAnalysisCharts = (): string => {
  return `
    <div class="card" style="margin-top: var(--space-lg);" id="analysis-charts-container">
      <div class="card-header">
        <div>
          <h2 style="font-size: var(--font-size-xl); font-weight: 600;">
            <i class="fa fa-bar-chart" style="color: var(--color-accent);"></i>
            Job Analytics
          </h2>
          <p style="font-size: var(--font-size-sm); color: var(--color-gray-500); margin-top: var(--space-xs);">
            Visual breakdown of your job search data
          </p>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg); margin-top: var(--space-md);">
        <!-- Status Pie Chart -->
        <div class="chart-container">
          <h3 style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-md); text-align: center;">
            <i class="fa fa-pie-chart" style="color: var(--color-accent);"></i>
            Jobs by Status
          </h3>
          <canvas id="statusChart" width="300" height="300"></canvas>
        </div>
        
        <!-- Scraper Pie Chart -->
        <div class="chart-container">
          <h3 style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-md); text-align: center;">
            <i class="fa fa-pie-chart" style="color: var(--color-accent);"></i>
            Jobs by Source
          </h3>
          <canvas id="scraperChart" width="300" height="300"></canvas>
        </div>
        
        <!-- Date Bar Chart -->
        <div class="chart-container" style="grid-column: 1 / -1;">
          <h3 style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-md); text-align: center;">
            <i class="fa fa-bar-chart" style="color: var(--color-accent);"></i>
            Jobs by Date
          </h3>
          <canvas id="dateChart" width="800" height="300"></canvas>
        </div>
      </div>
      
    </div>
  `;
};

/** Build keyword cloud section */
const buildKeywordCloud = async (state: CurrentState): Promise<string> => {
  const jobsEtl = new JobsEtl();
  const cleanStateFilters = cleanFilters(state.filters);
  const keywords = await jobsEtl.aggJobKeywordScore(cleanStateFilters, 100);
  
  // Calculate min/max scores for normalization
  const scores = keywords.map(k => k[2]);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  
  // Generate keyword cloud HTML
  const keywordItems = keywords.map(([keyword, count, score]) => {
    const normalizedScore = maxScore > minScore 
      ? (score - minScore) / (maxScore - minScore) 
      : 0.5;
    const fontSize = 0.8 + (normalizedScore * 1.5); // 0.8rem to 2.3rem
    const opacity = 0.5 + (normalizedScore * 0.5); // 0.5 to 1.0
    
    return `
      <span class="keyword-cloud-item"
            style="font-size: ${fontSize.toFixed(2)}rem; 
                   opacity: ${opacity.toFixed(2)};"
            data-action="addFilter"
            data-filter-key="jobKeywordScore"
            data-filter-value="${encodeURIComponent(keyword)}"
            onclick="handleMenuAction(this)"
            title="${keyword}: ${count} jobs (score: ${score.toFixed(4)})">
        ${keyword}
      </span>
    `;
  }).join('');

  return `
    <div class="card" style="margin-top: var(--space-lg);">
      <div class="card-header">
        <div>
          <h2 style="font-size: var(--font-size-xl); font-weight: 600;">
            <i class="fa fa-cloud" style="color: var(--color-accent);"></i>
            Keyword Cloud
          </h2>
          <p style="font-size: var(--font-size-sm); color: var(--color-gray-500); margin-top: var(--space-xs);">
            Top ${keywords.length} keywords by relevance. Click to filter.
          </p>
        </div>
      </div>
      
      <div class="keyword-cloud">
        ${keywordItems || `
          <div class="empty" style="padding: var(--space-xl);">
            <i class="fa fa-inbox empty-icon"></i>
            <p>No keywords found</p>
          </div>
        `}
      </div>
    </div>
    
    <style>
      .keyword-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        padding: var(--space-lg);
        justify-content: center;
        align-items: center;
        min-height: 200px;
      }
      
      .keyword-cloud-item {
        display: inline-block;
        padding: var(--space-xs) var(--space-sm);
        background: var(--color-accent-light);
        color: var(--color-accent-dark);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 500;
        line-height: 1.4;
      }
      
      .keyword-cloud-item:hover {
        background: var(--color-accent);
        color: var(--color-white);
        transform: scale(1.05);
      }
      
      .chart-container {
        background: var(--color-gray-50);
        border-radius: var(--radius-md);
        padding: var(--space-md);
        height: 350px;
        position: relative;
      }
      
      .chart-container canvas {
        max-width: 100%;
        max-height: 100%;
      }
    </style>
  `;
};

/** Analysis Page implementation */
const analysisPage: Page = {
  id: "analysis",
  name: "Job Analysis",
  icon: "fa-area-chart",
  build: buildAnalysisPage,
};

// Register the page
registerPage(analysisPage);

// Keep exports for backwards compatibility
export { buildAnalysisPage };
