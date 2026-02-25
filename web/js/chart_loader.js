// Chart Loader Module
// Handles loading and rendering analysis charts

import { currentState } from './state.js';

let chartObserver = null;

/**
 * Load chart data and render charts for the analysis page
 */
export async function loadAndRenderCharts() {
    console.log('loadAndRenderCharts called');
    
    // Wait a bit for DOM to settle
    setTimeout(async () => {
        try {
            // Check if canvas elements exist
            const statusCanvas = document.getElementById('statusChart');
            console.log('statusChart canvas exists:', !!statusCanvas);
            
            // Check if Chart.js is loaded
            console.log('Chart.js loaded:', typeof Chart !== 'undefined');
            
            console.log('Fetching chart data with state:', currentState);
            
            const response = await fetch('/api/analysis/chart-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: JSON.stringify(currentState) })
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch chart data: ' + response.status);
            }
            
            const data = await response.json();
            console.log('Chart data received:', data);
            
            if (window.renderAnalysisCharts) {
                console.log('Calling renderAnalysisCharts');
                window.renderAnalysisCharts(data);
            } else {
                console.error('renderAnalysisCharts function not available');
            }
        } catch (error) {
            console.error('Failed to load chart data:', error);
        }
    }, 200); // Increased delay to ensure DOM is ready
}

/**
 * Initialize the MutationObserver to detect when analysis charts are added to DOM
 */
export function initChartObserver() {
    chartObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node;
                        // Check if the added node is or contains the analysis-charts-container
                        if (element.id === 'analysis-charts-container' || element.querySelector('#analysis-charts-container')) {
                            console.log('[MUTATION OBSERVER] Analysis charts container detected in DOM!');
                            const statusCanvas = document.getElementById('statusChart');
                            const scraperCanvas = document.getElementById('scraperChart');
                            const dateCanvas = document.getElementById('dateChart');
                            console.log('[MUTATION OBSERVER] Canvases found:', {
                                status: !!statusCanvas,
                                scraper: !!scraperCanvas,
                                date: !!dateCanvas
                            });
                            // Trigger chart rendering
                            console.log('[MUTATION OBSERVER] Calling loadAndRenderCharts...');
                            loadAndRenderCharts();
                        }
                    }
                });
            }
        });
    });

    // Start observing the page-content element
    const pageContent = document.getElementById('page-content');
    if (pageContent) {
        chartObserver.observe(pageContent, { childList: true, subtree: true });
        console.log('[CHART_LOADER] MutationObserver started watching #page-content');
    } else {
        console.log('[CHART_LOADER] #page-content not found, will retry on DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', () => {
            const pc = document.getElementById('page-content');
            if (pc) {
                chartObserver.observe(pc, { childList: true, subtree: true });
                console.log('[CHART_LOADER] MutationObserver started watching #page-content (after DOMContentLoaded)');
            }
        });
    }
}

export { chartObserver };
