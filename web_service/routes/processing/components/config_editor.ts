import { CurrentState } from "../../../types/index.ts";
import { 
  loadConfig, 
  saveConfig, 
  type AppConfiguration,
  type ScraperConfig,
  type UpdateJobsConfig 
} from "../../../core/config_manager.ts";

/** Get configuration section for a specific job */
export async function getJobConfig(jobId: string): Promise<{ section: string; config: unknown } | null> {
  const fullConfig = await loadConfig();
  
  if (jobId === 'update') {
    return { section: 'update_jobs', config: fullConfig.update_jobs };
  }
  
  if (jobId === 'scrap') {
    return { section: 'scrap_jobs', config: fullConfig.scrap_jobs };
  }
  
  if (jobId.startsWith('scrap:')) {
    const scraperName = jobId.split(':')[1] as keyof typeof fullConfig.scrap_jobs;
    if (fullConfig.scrap_jobs[scraperName]) {
      return { 
        section: `scrap_jobs.${scraperName}`, 
        config: fullConfig.scrap_jobs[scraperName] 
      };
    }
  }
  
  return null;
}

/** Update configuration section for a specific job */
export async function updateJobConfig(
  jobId: string, 
  configContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Parse the submitted config
    const parsedConfig = JSON.parse(configContent);
    
    // Load full config
    const fullConfig = await loadConfig();
    
    // Update the appropriate section
    if (jobId === 'update') {
      fullConfig.update_jobs = parsedConfig as UpdateJobsConfig;
    } else if (jobId === 'scrap') {
      fullConfig.scrap_jobs = parsedConfig as typeof fullConfig.scrap_jobs;
    } else if (jobId.startsWith('scrap:')) {
      const scraperName = jobId.split(':')[1] as keyof typeof fullConfig.scrap_jobs;
      if (fullConfig.scrap_jobs[scraperName]) {
        fullConfig.scrap_jobs[scraperName] = parsedConfig as ScraperConfig;
      } else {
        return { success: false, error: `Unknown scraper: ${scraperName}` };
      }
    } else {
      return { success: false, error: `Unknown job ID: ${jobId}` };
    }
    
    // Save the full config
    await saveConfig(fullConfig);
    
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/** Build config save response HTML */
export function buildConfigSaveResponse(success: boolean, error?: string): string {
  if (success) {
    return `
      <div class="alert alert-success" style="padding: var(--space-sm); font-size: var(--font-size-sm);">
        <i class="fa fa-check-circle"></i>
        Configuration saved successfully!
      </div>
    `;
  } else {
    return `
      <div class="alert alert-danger" style="padding: var(--space-sm); font-size: var(--font-size-sm);">
        <i class="fa fa-exclamation-triangle"></i>
        Error: ${error || "Invalid JSON"}
      </div>
    `;
  }
}

/** Legacy: Load full config file content (for backwards compatibility) */
export async function loadFullConfig(): Promise<string> {
  try {
    const config = await loadConfig();
    return JSON.stringify(config, null, 2);
  } catch (error) {
    console.error("Error loading config:", error);
    return "{}";
  }
}

/** Legacy: Build the full config editor section (for backwards compatibility) */
export const buildConfigEditor = async (_state: CurrentState): Promise<string> => {
  const configContent = await loadFullConfig();

  return `
    <div>
      <div style="margin-bottom: var(--space-md);">
        <h4 style="font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--space-xs);">
          <i class="fa fa-file-code-o" style="color: var(--color-accent);"></i>
          Configuration Editor (Legacy)
        </h4>
        <p style="font-size: var(--font-size-sm); color: var(--color-gray-500);">
          Use the new job-specific editor in the Process Runner section above.
        </p>
      </div>

      <textarea readonly
                class="form-input form-textarea"
                spellcheck="false"
                style="font-family: monospace; font-size: var(--font-size-sm); min-height: 400px; background: var(--color-gray-100);">${configContent.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">")}</textarea>
    </div>
  `;
};

/** Legacy: Save full config file content */
export async function saveFullConfig(content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = JSON.parse(content);
    await saveConfig(parsed as AppConfiguration);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
