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
    console.log('[HTMX_EVENTS] htmx:configRequest fired, path:', evt.detail.path);
    if (evt.detail.path && evt.detail.path.includes('config-editor')) {
        return;
    }
    
    // Set Content-Type to application/json for loadMoreJobs endpoint
    if (evt.detail.path && evt.detail.path.includes('loadMoreJobs')) {
        console.log('[HTMX_EVENTS] Setting Content-Type to application/json for loadMoreJobs');
        evt.detail.headers['Content-Type'] = 'application/json';
        
        // Ensure swap is set to afterend (insert after the trigger element)
        if (!evt.detail.swapSpec) {
            evt.detail.swapSpec = 'afterend';
        }
    }
    
    if (evt.detail.verb === 'post') {
        // For loadMoreJobs, we want to send proper JSON body
        if (evt.detail.path && evt.detail.path.includes('loadMoreJobs')) {
            // ALWAYS get fresh state from DOM - this is the most reliable source
            // Priority: data-state attribute > value attribute > currentState
            let stateToUse = null;
            
            // Try data-state attribute first (base64 encoded)
            const stateInput = document.getElementById('state-input');
            if (stateInput) {
                const stateDataAttr = stateInput.getAttribute('data-state');
                if (stateDataAttr) {
                    try {
                        const decoded = atob(stateDataAttr);
                        stateToUse = JSON.parse(decoded);
                        console.log('[HTMX_EVENTS] Got state from data-state - page:', stateToUse?.pagination?.page);
                    } catch (e) {
                        console.log('[HTMX_EVENTS] Failed to decode data-state:', e.message);
                    }
                }
                
                // Fallback to value attribute
                if (!stateToUse && stateInput.value && stateInput.value !== 'null') {
                    try {
                        stateToUse = JSON.parse(stateInput.value);
                        console.log('[HTMX_EVENTS] Got state from value - page:', stateToUse?.pagination?.page);
                    } catch (e) {
                        console.log('[HTMX_EVENTS] Failed to parse value:', e.message);
                    }
                }
            }
            
            // Last resort: use getState() which returns currentState
            if (!stateToUse) {
                stateToUse = getState();
                console.log('[HTMX_EVENTS] Falling back to getState() - page:', stateToUse?.pagination?.page);
            }
            
            console.log('[HTMX_EVENTS] Final state to send - page:', stateToUse.pagination?.page, 'filters:', JSON.stringify(stateToUse.filters));
            
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
                        console.log('[HTMX_EVENTS] Failed to parse state from DOM input');
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
    console.log('[HTMX_EVENTS] htmx:afterSwap event fired, path:', evt.detail.path);
    const xhr = evt.detail.xhr;
    // Get path more reliably - check multiple sources
    const requestPath = evt.detail.path || evt.detail.requestConfig?.path || '';
    console.log('[HTMX_EVENTS] Request path for afterSwap:', requestPath);
    
    // Check if this is a loadMoreJobs request - handle both cases
    const isLoadMoreJobs = requestPath.includes('loadMoreJobs') || requestPath.includes('loadMore');
    console.log('[HTMX_EVENTS] Is loadMoreJobs:', isLoadMoreJobs);
    
    if (isLoadMoreJobs) {
        console.log('[HTMX_EVENTS] Processing loadMoreJobs response');
        const responseText = xhr.responseText || '';
        
        // If response contains end-of-list indicator, remove the trigger element
        if (responseText.includes('end-of-list-indicator') || responseText.includes("You've reached the end of the list")) {
            const trigger = evt.detail.trigger;
            if (trigger) {
                console.log('[HTMX_EVENTS] End of list reached, removing trigger element');
                trigger.remove();
            }
        } else {
            // New rows were loaded, remove the OLD trigger element to prevent duplicate requests
            const oldTrigger = evt.detail.requestConfig?.elt;
            if (oldTrigger) {
                console.log('[HTMX_EVENTS] Removing old trigger element after swap');
                oldTrigger.remove();
            }
            
            // Parse the state directly from the response HTML
            console.log('[HTMX_EVENTS] Response text length:', responseText.length);
            
            // Try multiple regex patterns to find hx-vals
            let hxValsMatch = responseText.match(/hx-vals='([^']+)'/);
            if (!hxValsMatch) {
                hxValsMatch = responseText.match(/hx-vals="([^"]+)"/);
            }
            if (!hxValsMatch) {
                hxValsMatch = responseText.match(/hx-vals='({[^']+})'/);
            }
            
            console.log('[HTMX_EVENTS] hx-vals match found:', !!hxValsMatch);
            
            if (hxValsMatch && hxValsMatch[1]) {
                console.log('[HTMX_EVENTS] Raw hx-vals (first 200 chars):', hxValsMatch[1].substring(0, 200));
                
                try {
                    // Unescape HTML entities
                    let unescaped = hxValsMatch[1].replace(/&#39;/g, "'").replace(/"/g, '"');
                    console.log('[HTMX_EVENTS] Unescaped (first 200 chars):', unescaped.substring(0, 200));
                    
                    const newStateData = JSON.parse(unescaped);
                    console.log('[HTMX_EVENTS] Parsed JSON, state pagination:', newStateData?.state?.pagination);
                    
                    if (newStateData && newStateData.state) {
                        console.log('[HTMX_EVENTS] Parsed state from response - page:', newStateData.state.pagination?.page);
                        
                        // UPDATE THE GLOBAL STATE
                        setState(newStateData.state);
                        
                        const stateInput = document.getElementById('state-input');
                        if (stateInput) {
                            const serializedState = JSON.stringify(newStateData.state);
                            stateInput.setAttribute('data-state', btoa(serializedState));
                            stateInput.value = serializedState;
                            console.log('[HTMX_EVENTS] Updated state-input to page:', newStateData.state.pagination?.page);
                        }
                    }
                } catch (e) {
                    console.log('[HTMX_EVENTS] ERROR parsing hx-vals:', e.message);
                }
            } else {
                console.log('[HTMX_EVENTS] No hx-vals found in response - checking response content...');
                console.log('[HTMX_EVENTS] Response sample (first 500 chars):', responseText.substring(0, 500));
            }
        }
    }
    
    if (xhr && xhr.responseText) {
        console.log('[HTMX_EVENTS] Response received, length:', xhr.responseText.length);
        
        // Skip JSON parsing for loadMoreJobs (returns HTML)
        if (isLoadMoreJobs) {
            console.log('[HTMX_EVENTS] loadMoreJobs returns HTML, not parsing as JSON');
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
            console.log('[HTMX_EVENTS] Parsed response:', Object.keys(response));
            
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
                console.log('[HTMX_EVENTS] mainContent received, length:', response.mainContent.length);
                updateMainContent(response.mainContent);
                
                setTimeout(() => {
                    const jobCount = extractJobCountFromDOM();
                    if (jobCount > 0) {
                        setJobCount(jobCount);
                        updateTitle();
                    }
                }, 100);
                
                const hasChartsContainer = response.mainContent.includes('analysis-charts-container');
                console.log('[HTMX_EVENTS] Contains analysis-charts-container:', hasChartsContainer);
                if (hasChartsContainer) {
                    console.log('[HTMX_EVENTS] Calling loadAndRenderCharts...');
                    import('./chart_loader.js').then(({ loadAndRenderCharts }) => {
                        loadAndRenderCharts();
                    });
                }
            } else {
                console.log('[HTMX_EVENTS] No mainContent in response');
            }
        } catch (e) {
            console.log('[HTMX_EVENTS] Response is not JSON, treating as HTML');
            setTimeout(() => {
                const jobCount = extractJobCountFromDOM();
                if (jobCount > 0) {
                    setJobCount(jobCount);
                    updateTitle();
                }
            }, 100);
        }
    } else {
        console.log('[HTMX_EVENTS] No xhr or responseText');
    }
}

/**
 * Handle htmx:afterSettle event
 */
function handleAfterSettle(evt) {
    console.log('[HTMX_EVENTS] htmx:afterSettle fired');
    const chartsContainer = document.getElementById('analysis-charts-container');
    if (chartsContainer) {
        console.log('[HTMX_EVENTS] Analysis charts container found in DOM after settle');
    }
}

/**
 * Initialize all HTMX event listeners
 */
export function initHtmxEvents() {
    document.body.addEventListener('htmx:configRequest', handleConfigRequest);
    document.body.addEventListener('htmx:afterSwap', handleAfterSwap);
    document.body.addEventListener('htmx:afterSettle', handleAfterSettle);
    console.log('[HTMX_EVENTS] HTMX event listeners initialized');
}
