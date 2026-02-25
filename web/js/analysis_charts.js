// Analysis Charts Module
// Handles rendering of Chart.js charts for the analysis page

import { currentState } from './state.js';

// Store chart instances to prevent duplicates
const chartInstances = {};

/**
 * Render all analysis charts with the provided data
 */
export function renderAnalysisCharts(data) {
    console.log('renderAnalysisCharts called with data:', data);
    
    if (!data) {
        console.error('No chart data provided');
        return;
    }
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }
    
    console.log('Chart.js version:', Chart.version);
    
    // Destroy existing charts before creating new ones
    destroyExistingCharts();
    
    renderStatusChart(data.statusData);
    renderScraperChart(data.scraperData);
    renderDateChart(data.dateData);
}

/**
 * Destroy existing chart instances
 */
function destroyExistingCharts() {
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key]) {
            chartInstances[key].destroy();
            delete chartInstances[key];
        }
    });
}

/**
 * Render Status Pie Chart
 */
function renderStatusChart(statusData) {
    const canvas = document.getElementById('statusChart');
    if (!canvas || !statusData || statusData.length === 0) {
        console.warn('Status chart canvas not found or no data');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Color palette for status
    const colors = [
        '#4299e1', // blue
        '#48bb78', // green
        '#ed8936', // orange
        '#e53e3e', // red
        '#9f7aea', // purple
        '#38b2ac', // teal
        '#ecc94b', // yellow
        '#a0aec0', // gray
    ];
    
    const labels = statusData.map(item => item[0]);
    const values = statusData.map(item => item[1]);
    
    chartInstances.status = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Render Scraper Pie Chart
 */
function renderScraperChart(scraperData) {
    const canvas = document.getElementById('scraperChart');
    if (!canvas || !scraperData || scraperData.length === 0) {
        console.warn('Scraper chart canvas not found or no data');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Different color palette for scraper
    const colors = [
        '#667eea', // indigo
        '#f56565', // red
        '#48bb78', // green
        '#ed8936', // orange
        '#38b2ac', // teal
        '#9f7aea', // purple
        '#ecc94b', // yellow
        '#4299e1', // blue
    ];
    
    const labels = scraperData.map(item => item[0]);
    const values = scraperData.map(item => item[1]);
    
    chartInstances.scraper = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Render Date Bar Chart
 */
function renderDateChart(dateData) {
    const canvas = document.getElementById('dateChart');
    if (!canvas || !dateData || dateData.length === 0) {
        console.warn('Date chart canvas not found or no data');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Sort dates chronologically
    const sortedData = [...dateData].sort((a, b) => a[0].localeCompare(b[0]));
    
    // Limit to last 30 entries if too many
    const displayData = sortedData.length > 30 
        ? sortedData.slice(-30) 
        : sortedData;
    
    const labels = displayData.map(item => item[0]);
    const values = displayData.map(item => item[1]);
    
    chartInstances.date = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jobs',
                data: values,
                backgroundColor: 'rgba(66, 153, 225, 0.8)',
                borderColor: 'rgba(66, 153, 225, 1)',
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return 'Date: ' + context[0].label;
                        },
                        label: function(context) {
                            return 'Jobs: ' + context.raw;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Jobs'
                    },
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Make function available globally for the inline script
window.renderAnalysisCharts = renderAnalysisCharts;
