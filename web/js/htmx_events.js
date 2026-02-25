// HTMX Event Handlers Module
// Handles all HTMX-related DOM events

import { currentState, setState, getState } from './state.js';
import { setJobCount } from './state.js';
import { updateUI, updateMainContent } from './ui.js';
import { updateTitle, extractJobCountFromDOM } from './title_manager.js';

/**
 * Handle htmx:configRequest event
 * Attaches current state to POST requests
 */
function handleConfigRequest(evt) {
    if (evt.detail.path && evt.detail.path.includes('config-editor')) {
        return;
    }
    
    // Set Content-Type to application/json for loadMoreJobs endpoint
    if (evt.detail.path && evt.detail.path.includes('loadMoreJobs')) {
        evt.detail.headers['Content-Type'] = 'application/json';
        
        // Ensure swap is set to afterend (insert after the trigger element)
        if (!evt.detail.swapSpec) {
            evt.detail.swapSpec = 'afterend';
        }
    }
    
    if (evt.detail.verb === 'post') {
        // For loadMoreJobs, we want to send proper JSON body
        if (evt.detail.path && evt.detail.path.includes('loadMoreJobs')) {
            // Get fresh state from DOM - this is the most reliable source
            let stateToUse = null;
            
            const stateInput = document.getElementById('state-input');
            if (stateInput) {
                const stateDataAttr = stateInput.getAttribute('data-state');
                if (stateDataAttr) {
                    try {
                        const decoded = atob(stateDataAttr);
                        stateToUse = JSON.parse(decoded);
                    } catch (e) {
                        // Fall through to fallback
                    }
                }
                
                // Fallback to value attribute
                if (!stateToUse && stateInput.value && stateInput.value !== 'null') {
                    try {
                        stateToUse = JSON.parse(stateInput.value);
                    } catch (e) {
                        // Fall through to fallback
                    }
                }
            }
            
            // Last resort: use getState()
            if (!stateToUse) {
                stateToUse = getState();
            }
            
            // For HTMX json-enc extension, we need to set evt.detail.parameters as a JavaScript object
            evt.detail.parameters = { state: stateToUse };
        } else {
            // Other POST requests - original logic
            try {
                const existingParams = JSON.parse(evt.detail.parameters || '{}');
                
                let stateFromDOM = null;
                const stateInput = document.getElementById('state-input');
                if (stateInput && stateInput.value) {
                    try {
                        stateFromDOM = JSON.parse(stateInput.value);
                    } catch (e) {
                        // Ignore
                    }
                }
                
                existingParams.state = existingParams.state || stateFromDOM || getState();
                evt.detail.parameters = JSON.stringify(existingParams);
            } catch (e) {
                evt.detail.parameters = JSON.stringify({ state: getState() });
            }
        }
    }
}

/**
 * Handle htmx:afterSwap event
 * Processes responses and updates UI
 */
function handleAfterSwap(evt) {
    const xhr = evt.detail.xhr;
    const requestPath = evt.detail.path || evt.detail.requestConfig?.path || '';
    const isLoadMoreJobs = requestPath.includes('loadMoreJobs') || requestPath.includes('loadMore');
    
    if (isLoadMoreJobs) {
        const responseText = xhr.responseText || '';
        
        // If response contains end-of-list indicator, remove the trigger element
        if (responseText.includes('end-of-list-indicator') || responseText.includes("You've reached the end of the list")) {
            const trigger = evt.detail.trigger;
            if (trigger) {
                trigger.remove();
            }
        } else {
            // New rows were loaded, remove the OLD trigger element
            const oldTrigger = evt.detail.requestConfig?.elt;
            if (oldTrigger) {
                oldTrigger.remove();
            }
            
            // Parse the state from response hx-vals
            let hxValsMatch = responseText.match(/hx-vals='([^']+)'/);
            if (!hxValsMatch) {
                hxValsMatch = responseText.match(/hx-vals="([^"]+)"/);
            }
            
            if (hxValsMatch && hxValsMatch[1]) {
                try {
                    const unescaped = hxValsMatch[1].replace(/&#39;/g, "'").replace(/"/g, '"');
                    const newStateData = JSON.parse(unescaped);
                    
                    if (newStateData && newStateData.state) {
                        // Update the global state
                        setState(newStateData.state);
                        
                        // Update the hidden state input
                        const stateInput = document.getElementById('state-input');
                        if (stateInput) {
                            const serializedState = JSON.stringify(newStateData.state);
                            stateInput.setAttribute('data-state', btoa(serializedState));
                            stateInput.value = serializedState;
                        }
                    }
                } catch (e) {
                    console.error('Error parsing state from response:', e);
                }
            }
        }
    }
    
    if (xhr && xhr.responseText) {
        // Skip JSON parsing for loadMoreJobs (returns HTML)
        if (isLoadMoreJobs) {
            setTimeout(() => {
                const jobCount = extractJobCountFromDOM();
                if (jobCount > 0) {
                    setJobCount(jobCount);
                    updateTitle();
                }
            }, 100);
            return;
        }
        
        try {
            const response = JSON.parse(xhr.responseText);
            
            if (response.state) {
                setState(JSON.parse(response.state));
                const stateInput = document.getElementById('state-input');
                if (stateInput) {
                    stateInput.value = response.state;
                }
            }
            
            if (response.oobUpdates && Array.isArray(response.oobUpdates)) {
                response.oobUpdates.forEach(update => {
                    const target = document.querySelector(update.target);
                    if (target) {
                        target.innerHTML = update.html;
                    }
                });
            }
            
            if (response.components) {
                updateUI(response.components);
            }
            
            if (response.mainContent) {
                updateMainContent(response.mainContent);
                
                setTimeout(() => {
                    const jobCount = extractJobCountFromDOM();
                    if (jobCount > 0) {
                        setJobCount(jobCount);
                        updateTitle();
                    }
                }, 100);
                
                const hasChartsContainer = response.mainContent.includes('analysis-charts-container');
                if (hasChartsContainer) {
                    import('./chart_loader.js').then(({ loadAndRenderCharts }) => {
                        loadAndRenderCharts();
                    });
                }
            }
        } catch (e) {
            // Ignore parsing errors for non-JSON responses
        }
    }
}

/**
 * Handle htmx:afterSettle event
 */
function handleAfterSettle(evt) {
    // Reserved for future use
}

/**
 * Initialize all HTMX event listeners
 */
export function initHtmxEvents() {
    document.body.addEventListener('htmx:configRequest', handleConfigRequest);
    document.body.addEventListener('htmx:afterSwap', handleAfterSwap);
    document.body.addEventListener('htmx:afterSettle', handleAfterSettle);
}
