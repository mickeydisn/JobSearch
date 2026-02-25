// Streaming Module
// Process streaming for logs and real-time updates

import { killProcess, refreshFilters } from './api.js';
import { setJobCount, getJobCount, currentState } from './state.js';
import { updateTitle, extractJobCountFromDOM } from './title_manager.js';
import { showToast, applyOobUpdates } from './ui.js';

let processEventSource = null;
let currentProcessId = null;
let currentJobId = null;

// Job definitions loaded from the server
let jobDefinitions = [];

/** Initialize job definitions from the embedded JSON */
function initJobDefinitions() {
    const jobsDataEl = document.getElementById('jobs-data');
    if (jobsDataEl) {
        try {
            jobDefinitions = JSON.parse(jobsDataEl.textContent);
        } catch (e) {
            console.error('Failed to parse jobs data:', e);
        }
    }
}

/** Get job definition by ID */
function getJobDefinition(jobId) {
    return jobDefinitions.find(job => job.id === jobId);
}

/** Handle job selection from dropdown */
export async function onJobSelected(jobId) {
    initJobDefinitions();
    currentJobId = jobId;
    
    const descriptionPanel = document.getElementById('job-description-panel');
    const descriptionText = document.getElementById('job-description-text');
    const configPanel = document.getElementById('job-config-panel');
    const configTextarea = document.getElementById('job-config-textarea');
    const configJobIdInput = document.getElementById('job-config-jobid');
    const runPanel = document.getElementById('job-run-panel');
    const saveMessage = document.getElementById('config-save-message');
    
    if (!jobId) {
        // Hide all panels if no job selected
        if (descriptionPanel) descriptionPanel.style.display = 'none';
        if (configPanel) configPanel.style.display = 'none';
        if (runPanel) runPanel.style.display = 'none';
        if (saveMessage) saveMessage.innerHTML = '';
        return;
    }
    
    const job = getJobDefinition(jobId);
    if (!job) {
        console.error('Unknown job:', jobId);
        return;
    }
    
    // Show description panel
    if (descriptionPanel) {
        descriptionPanel.style.display = 'block';
        descriptionText.textContent = job.description;
    }
    
    // Load and show config
    try {
        const response = await fetch(`/api/job-config/${encodeURIComponent(jobId)}`);
        if (response.ok) {
            const data = await response.json();
            if (configTextarea) {
                configTextarea.value = data.configJson;
            }
            if (configJobIdInput) {
                configJobIdInput.value = jobId;
            }
        }
    } catch (error) {
        console.error('Failed to load job config:', error);
    }
    
    if (configPanel) {
        configPanel.style.display = 'block';
    }
    
    // Show run panel
    if (runPanel) {
        runPanel.style.display = 'block';
    }
    
    // Clear save message
    if (saveMessage) {
        saveMessage.innerHTML = '';
    }
}

/** Save job configuration */
export async function saveJobConfig(event) {
    event.preventDefault();
    
    const form = event.target;
    const jobId = form.querySelector('[name="jobId"]').value;
    const configContent = form.querySelector('[name="configContent"]').value;
    const saveMessage = document.getElementById('config-save-message');
    
    try {
        const response = await fetch(`/api/job-config/${encodeURIComponent(jobId)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ configContent })
        });
        
        if (saveMessage) {
            saveMessage.innerHTML = await response.text();
        }
    } catch (error) {
        if (saveMessage) {
            saveMessage.innerHTML = `
                <div class="alert alert-danger" style="padding: var(--space-sm); font-size: var(--font-size-sm);">
                    <i class="fa fa-exclamation-triangle"></i>
                    Error: ${error.message}
                </div>
            `;
        }
    }
}

/** Reload job configuration */
export async function reloadJobConfig() {
    if (currentJobId) {
        await onJobSelected(currentJobId);
        const saveMessage = document.getElementById('config-save-message');
        if (saveMessage) {
            saveMessage.innerHTML = `
                <div class="alert alert-info" style="padding: var(--space-sm); font-size: var(--font-size-sm);">
                    <i class="fa fa-refresh"></i>
                    Configuration reloaded
                </div>
            `;
            setTimeout(() => {
                saveMessage.innerHTML = '';
            }, 2000);
        }
    }
}

/** Run the selected job */
export function runSelectedJob() {
    if (!currentJobId) {
        console.error('No job selected');
        return;
    }
    
    // Map jobId to process ID
    let processId = currentJobId;
    let processName = getJobDefinition(currentJobId)?.name || currentJobId;
    
    startProcessStream(processId, processName);
}

/** Kill the currently running job */
export function killCurrentJob() {
    if (!currentProcessId) return;
    killProcessStream(currentProcessId);
}

/** Start streaming logs for a process */
export function startProcessStream(processId, processName) {
    currentProcessId = processId;
    const logContainer = document.getElementById('log-lines');
    const indicator = document.getElementById('process-indicator');
    const runBtn = document.getElementById('run-process-btn');
    const killBtn = document.getElementById('kill-process-btn');
    
    if (!logContainer) return;
    
    logContainer.innerHTML = `<div class="process-log-line success">[${new Date().toLocaleTimeString()}] Starting ${processName}...</div>`;
    
    if (indicator) indicator.style.display = 'flex';
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.classList.add('disabled');
        runBtn.style.display = 'none';
    }
    if (killBtn) {
        killBtn.disabled = false;
        killBtn.classList.remove('disabled');
        killBtn.style.display = 'flex';
    }
    
    if (processEventSource) {
        processEventSource.close();
    }
    
    // Determine the correct streaming endpoint
    let streamUrl = '/api/process/stream/' + encodeURIComponent(processId);
    
    // Handle individual scraper execution
    if (processId.startsWith('scrap:')) {
        const scraperName = processId.split(':')[1];
        streamUrl = '/api/process/stream/scrap/' + encodeURIComponent(scraperName);
    }
    
    processEventSource = new EventSource(streamUrl);
    
    processEventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.type === 'log') {
            const time = new Date(data.timestamp).toLocaleTimeString();
            logContainer.innerHTML += `<div class="process-log-line ${data.level}">[${time}] ${data.message}</div>`;
            const pre = document.getElementById('process-log-content');
            if (pre) pre.scrollTop = pre.scrollHeight;
        } else if (data.type === 'complete') {
            logContainer.innerHTML += `<div class="process-log-line success">[${new Date().toLocaleTimeString()}] Process completed in ${data.durationMs}ms</div>`;
            
            // After scrape completes, refresh filters and update job count
            handleScrapeComplete();
            
            cleanupProcessStream();
        } else if (data.type === 'error') {
            logContainer.innerHTML += `<div class="process-log-line error">[${new Date().toLocaleTimeString()}] ERROR: ${data.message}</div>`;
            cleanupProcessStream();
        } else if (data.type === 'cancelled') {
            logContainer.innerHTML += `<div class="process-log-line warning">[${new Date().toLocaleTimeString()}] CANCELLED: ${data.message}</div>`;
            cleanupProcessStream();
        }
    };
    
    processEventSource.onerror = function() {
        logContainer.innerHTML += `<div class="process-log-line error">[${new Date().toLocaleTimeString()}] Connection lost</div>`;
        cleanupProcessStream();
    };
}

/** Kill a running process stream */
export async function killProcessStream(processId) {
    if (!processId && currentProcessId) {
        processId = currentProcessId;
    }
    if (!processId) return;
    
    const logContainer = document.getElementById('log-lines');
    if (logContainer) {
        logContainer.innerHTML += `<div class="process-log-line warning">[${new Date().toLocaleTimeString()}] Sending kill request...</div>`;
    }
    
    try {
        const response = await killProcess(processId);
        const data = await response.json();
        if (!data.success && logContainer) {
            logContainer.innerHTML += `<div class="process-log-line error">[${new Date().toLocaleTimeString()}] ${data.message}</div>`;
            cleanupProcessStream();
        }
    } catch (err) {
        if (logContainer) {
            logContainer.innerHTML += `<div class="process-log-line error">[${new Date().toLocaleTimeString()}] Failed to kill: ${err.message}</div>`;
        }
        cleanupProcessStream();
    }
}

/** Clean up after process stream ends */
export function cleanupProcessStream() {
    currentProcessId = null;
    if (processEventSource) {
        processEventSource.close();
        processEventSource = null;
    }
    
    const indicator = document.getElementById('process-indicator');
    const runBtn = document.getElementById('run-process-btn');
    const killBtn = document.getElementById('kill-process-btn');
    
    if (indicator) indicator.style.display = 'none';
    if (runBtn) {
        runBtn.disabled = false;
        runBtn.classList.remove('disabled');
        runBtn.style.display = 'flex';
    }
    if (killBtn) {
        killBtn.disabled = true;
        killBtn.classList.add('disabled');
        killBtn.style.display = 'none';
    }
}

/**
 * Handle scrape completion - refresh filters and update UI
 */
async function handleScrapeComplete() {
    try {
        // Refresh filter dropdowns
        const filterData = await refreshFilters(currentState);
        
        // Apply OOB updates to filter elements
        if (filterData.oobUpdates) {
            applyOobUpdates(filterData.oobUpdates);
        }
        
        // Update job count in title
        setTimeout(() => {
            const jobCount = extractJobCountFromDOM();
            if (jobCount > 0) {
                const prevCount = getJobCount();
                setJobCount(jobCount);
                // If new jobs were added while tab is hidden, title will show "(!)"
                updateTitle();
                console.log(`[STREAMING] Job count updated: ${prevCount} -> ${jobCount}`);
            }
        }, 500);
        
        // Show success toast
        showToast('Filters updated with new data', 'success');
        
    } catch (error) {
        console.error('[STREAMING] Failed to refresh filters:', error);
        showToast('Failed to refresh filters', 'error');
    }
}

// Make functions available globally for inline event handlers
window.onJobSelected = onJobSelected;
window.saveJobConfig = saveJobConfig;
window.reloadJobConfig = reloadJobConfig;
window.runSelectedJob = runSelectedJob;
window.killCurrentJob = killCurrentJob;
