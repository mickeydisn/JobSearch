// Title Manager Module
// Updates the browser tab title with job count

import { getJobCount, hasNewJobs, markJobsAsViewed } from './state.js';

const BASE_TITLE = 'Job Search';

/**
 * Update the document title based on job count and new job status
 * Format: "(X) Job Search" or "(!) Job Search" when new jobs arrive
 * @param {number} count - The job count to display
 * @param {boolean} hasNew - Whether there are new jobs since last viewed
 */
export function updateTitle(count = null, hasNew = null) {
    const jobCount = count !== null ? count : getJobCount();
    const newJobs = hasNew !== null ? hasNew : hasNewJobs();
    
    let prefix;
    if (newJobs) {
        prefix = '(!)';
    } else if (jobCount > 0) {
        prefix = `(${jobCount})`;
    } else {
        prefix = '';
    }
    
    document.title = prefix ? `${prefix} ${BASE_TITLE}` : BASE_TITLE;
}

/**
 * Reset the new jobs indicator when user views the page
 */
export function resetNewJobsIndicator() {
    markJobsAsViewed();
    updateTitle(getJobCount(), false);
}

/**
 * Initialize the title manager
 * Sets up visibility change listener to track when user views the page
 */
export function initTitleManager() {
    // Update title when page becomes visible (user returns to tab)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            resetNewJobsIndicator();
        }
    });
    
    // Set initial title
    updateTitle();
}

/**
 * Extract job count from the current page content
 * Looks for job cards or job count indicators in the DOM
 * @returns {number} The number of jobs found on the page
 */
export function extractJobCountFromDOM() {
    // Look for job cards
    const jobCards = document.querySelectorAll('.job-card');
    if (jobCards.length > 0) {
        return jobCards.length;
    }
    
    // Look for job count in pagination or summary text
    const jobCountElement = document.querySelector('[data-job-count]');
    if (jobCountElement) {
        const count = parseInt(jobCountElement.dataset.jobCount, 10);
        if (!isNaN(count)) {
            return count;
        }
    }
    
    // Look for "X jobs" text pattern in the page
    const pageContent = document.getElementById('page-content');
    if (pageContent) {
        const text = pageContent.textContent;
        const match = text.match(/(\d+)\s+job/i);
        if (match) {
            return parseInt(match[1], 10);
        }
    }
    
    return 0;
}
