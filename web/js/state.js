// State Management
// Global application state

export let currentState = {
    currentPage: 'jobs',
    filters: {},
    pagination: { page: 1, pageSize: 10 },
    keywordPage: { sortedBy: 'score' },
    jobCount: 0,
    lastViewedJobCount: 0,
    hasNewJobs: false
};

export function setState(newState) {
    currentState = { ...currentState, ...newState };
}

export function updateState(updater) {
    currentState = updater(currentState);
}

export function getState() {
    return currentState;
}

// Job count management
export function setJobCount(count) {
    const prevCount = currentState.jobCount;
    currentState.jobCount = count;
    // Only mark as new jobs if count increased and tab is hidden
    if (count > prevCount && document.hidden) {
        currentState.hasNewJobs = true;
    }
}

export function getJobCount() {
    return currentState.jobCount;
}

export function hasNewJobs() {
    return currentState.hasNewJobs;
}

export function markJobsAsViewed() {
    currentState.lastViewedJobCount = currentState.jobCount;
    currentState.hasNewJobs = false;
}
