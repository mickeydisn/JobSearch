/**
 * Configuration Manager
 * Centralized management for app_configuration.json
 */

const CONFIG_PATH = "./app_configuration.json";

/** Update Jobs Filter Configuration */
export interface UpdateJobsFilter {
  created_at_after: string;
  exclude_status: string[];
  exclude_tag: string[];
}

/** Scraper Filters - Common filter structure for all scrapers */
export interface ScraperFilters {
  // Common filters
  location?: string;
  // LinkedIn specific
  geoId?: string;
  // HelloWork specific
  locationAutocomplete?: string;
  radius?: number;
  // Welcome to the Jungle specific
  country?: string;
  district?: string;
  state?: string;
  contractType?: string;
}

/** Scraper Configuration */
export interface ScraperConfig {
  enabled: boolean;
  name: string;
  pages: number;
  delayBetweenRequests: number;
  searchKeywords: string[];
  filters: ScraperFilters;
}

/** Scrap Jobs Configuration */
export interface ScrapJobsConfig {
  hellowork: ScraperConfig;
  linkedin: ScraperConfig;
  welcome: ScraperConfig;
}

/** Update Jobs Configuration */
export interface UpdateJobsConfig {
  filter: UpdateJobsFilter;
}

/** Full Application Configuration */
export interface AppConfiguration {
  scrap_jobs: ScrapJobsConfig;
  update_jobs: UpdateJobsConfig;
}

/** In-memory cache of the configuration */
let configCache: AppConfiguration | null = null;
let configLoadTime: number = 0;
const CACHE_TTL_MS = 5000; // 5 seconds cache

/** Load configuration from file */
export async function loadConfig(): Promise<AppConfiguration> {
  const now = Date.now();
  
  // Return cached config if still valid
  if (configCache && (now - configLoadTime) < CACHE_TTL_MS) {
    return configCache;
  }

  try {
    const content = await Deno.readTextFile(CONFIG_PATH);
    const config = JSON.parse(content) as AppConfiguration;
    configCache = config;
    configLoadTime = now;
    return config;
  } catch (error) {
    console.error("Error loading config:", error);
    throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Save configuration to file */
export async function saveConfig(config: AppConfiguration): Promise<void> {
  const content = JSON.stringify(config, null, 2);
  await Deno.writeTextFile(CONFIG_PATH, content);
  configCache = config;
  configLoadTime = Date.now();
}

/** Get specific scraper configuration */
export async function getScraperConfig(scraperName: keyof ScrapJobsConfig): Promise<ScraperConfig> {
  const config = await loadConfig();
  return config.scrap_jobs[scraperName];
}

/** Get update jobs configuration */
export async function getUpdateJobsConfig(): Promise<UpdateJobsConfig> {
  const config = await loadConfig();
  return config.update_jobs;
}

/** Update specific scraper configuration */
export async function updateScraperConfig(
  scraperName: keyof ScrapJobsConfig, 
  scraperConfig: ScraperConfig
): Promise<void> {
  const config = await loadConfig();
  config.scrap_jobs[scraperName] = scraperConfig;
  await saveConfig(config);
}

/** Update update_jobs configuration */
export async function updateUpdateJobsConfig(updateConfig: UpdateJobsConfig): Promise<void> {
  const config = await loadConfig();
  config.update_jobs = updateConfig;
  await saveConfig(config);
}

/** Get all enabled scrapers */
export async function getEnabledScraperNames(): Promise<(keyof ScrapJobsConfig)[]> {
  const config = await loadConfig();
  const enabled: (keyof ScrapJobsConfig)[] = [];
  
  for (const [name, scraperConfig] of Object.entries(config.scrap_jobs)) {
    if (scraperConfig.enabled) {
      enabled.push(name as keyof ScrapJobsConfig);
    }
  }
  
  return enabled;
}

/** Clear config cache (force reload on next access) */
export function clearConfigCache(): void {
  configCache = null;
  configLoadTime = 0;
}