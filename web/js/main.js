// Main Entry Point
// Initialize the application

console.log('[MAIN.JS] File loaded - v2 (split)');

import { currentState, setState } from './state.js';
import { initApp } from './api.js';
import { updateUI, updateMainContent, showError } from './ui.js';
import { initTitleManager, updateTitle, extractJobCountFromDOM } from './title_manager.js';

// Make functions available globally for HTMX and inline handlers
import { handleMenuAction, toggleElement, handleSaveFilterAction } from './actions.js';
import { startProcessStream, killProcessStream } from './streaming.js';
import { loadConfigEditor } from './api.js';
import { renderAnalysisCharts } from './analysis_charts.js';

// Import from new modules
import { initHtmxEvents } from './htmx_events.js';
import { initChartObserver } from './chart_loader.js';

console.log('[MAIN.JS] Imports completed');

// Expose functions globally for HTMX and inline handlers
window.handleMenuAction = handleMenuAction;
window.toggleElement = toggleElement;
window.handleSaveFilterAction = handleSaveFilterAction;
window.startProcessStream = startProcessStream;
window.killProcessStream = killProcessStream;
window.loadConfigEditor = loadConfigEditor;
window.renderAnalysisCharts = renderAnalysisCharts;

// Initialize HTMX event handlers
initHtmxEvents();

// Initialize chart observer for analysis page
initChartObserver();

// Initialize Page
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAIN] DOMContentLoaded fired');
    
    // Initialize title manager
    initTitleManager();
    
    initApp()
        .then(response => response.json())
        .then(data => {
            console.log('[MAIN] App initialized, data:', Object.keys(data));
            if (data.state) {
                setState(JSON.parse(data.state));
            }
            if (data.mainContent) {
                updateMainContent(data.mainContent);
                // Extract and set initial job count
                setTimeout(() => {
                    const jobCount = extractJobCountFromDOM();
                    if (jobCount > 0) {
                        import('./state.js').then(({ setJobCount }) => {
                            setJobCount(jobCount);
                            updateTitle();
                        });
                    }
                }, 100);
            }
        })
        .catch(error => {
            console.error('Initialization error:', error);
            showError('Error loading page. Please refresh.');
        });
});

console.log('[MAIN.JS] Setup complete');
