// Actions Module
// Handle menu actions and user interactions

import { currentState, setState } from './state.js';
import { sendAction } from './api.js';
import { updateMainContent, processOobUpdates } from './ui.js';

export async function handleMenuAction(element) {
    const action = element.dataset.action;
    let payload = {};

    switch (action) {
        case 'setPage':
            payload = element.dataset.page;
            break;
        case 'addFilter':
        case 'toggleFilter':
        case 'removeFilter':
            payload = {
                key: element.dataset.filterKey,
                value: decodeURIComponent(element.dataset.filterValue)
            };
            break;
        case 'clearFilters':
            payload = null;
            break;
        case 'setKeywordSort':
            payload = element.dataset.sortValue;
            break;
        case 'applyFilterProfile':
        case 'addFilterProfile':
        case 'deleteFilterProfile':
            payload = {
                profileId: element.dataset.profileId
            };
            break;
        case 'saveJob':
            payload = {
                jobId: element.dataset.jobId
            };
            break;
        case 'unsaveJob':
            payload = {
                jobId: element.dataset.jobId
            };
            break;
        case 'updateJobStatus':
            payload = {
                jobId: element.dataset.jobId,
                status: element.value
            };
            break;
        case 'updateJobPriority':
            payload = {
                jobId: element.dataset.jobId,
                priority: element.value
            };
            break;
        case 'addJobTag':
            // Get tag from the second argument (passed from inline onclick)
            let tagValue = arguments[1];
            if (!tagValue || !tagValue.trim()) {
                // Try to get from the input field
                const inputEl = document.getElementById(`tag-input-${element.dataset.jobId}`);
                if (inputEl) {
                    tagValue = inputEl.value;
                    inputEl.value = ''; // Clear input after getting value
                }
            }
            if (!tagValue || !tagValue.trim()) {
                alert('Please enter a tag value');
                return;
            }
            payload = {
                jobId: element.dataset.jobId,
                tag: tagValue.trim()
            };
            break;
        case 'removeJobTag':
            payload = {
                jobId: element.dataset.jobId,
                tag: element.dataset.tag
            };
            break;
        case 'addJobReview':
        case 'editJobReview':
            const reviewText = prompt('Enter your review:', element.closest('.job-review')?.querySelector('.review-text')?.textContent || '');
            if (reviewText === null) return;
            payload = {
                jobId: element.dataset.jobId,
                review: reviewText
            };
            break;
        case 'saveJobReview':
            // Get review from the second argument (passed from inline onclick)
            let reviewContent = arguments[1];
            if (!reviewContent || !reviewContent.trim()) {
                // Try to get from the textarea field
                const textareaEl = document.getElementById(`review-text-input-${element.dataset.jobId}`);
                if (textareaEl) {
                    reviewContent = textareaEl.value;
                    textareaEl.value = ''; // Clear textarea after getting value
                }
            }
            if (!reviewContent || !reviewContent.trim()) {
                alert('Please enter review notes');
                return;
            }
            payload = {
                jobId: element.dataset.jobId,
                review: reviewContent.trim()
            };
            break;
        case 'addReviewTag':
            // Get tag from the second argument (passed from inline onclick)
            const newReviewTag = arguments[1] || element.dataset.tag;
            if (!newReviewTag || !newReviewTag.trim()) return;
            payload = {
                jobId: element.dataset.jobId,
                tag: newReviewTag.trim()
            };
            break;
        case 'removeReviewTag':
            payload = {
                jobId: element.dataset.jobId,
                tag: element.dataset.tag
            };
            break;
        case 'setSavedJobsSort':
            payload = {
                sortBy: element.dataset.sortBy,
                sortOrder: element.dataset.sortOrder
            };
            break;
        case 'setSourceFilter':
            payload = {
                source: element.dataset.source
            };
            break;
        case 'setKeywordSearch':
            payload = {
                searchTerm: element.dataset.searchTerm || ''
            };
            break;
        case 'addStopword':
            payload = {
                keyword: decodeURIComponent(element.dataset.keyword)
            };
            break;
        case 'removeStopword':
            payload = {
                keyword: decodeURIComponent(element.dataset.keyword)
            };
            break;
        case 'addKeywordTag':
            payload = {
                keyword: decodeURIComponent(element.dataset.keyword),
                tag: decodeURIComponent(element.dataset.tag)
            };
            break;
        case 'removeKeywordTag':
            payload = {
                keyword: decodeURIComponent(element.dataset.keyword),
                tag: decodeURIComponent(element.dataset.tag)
            };
            break;
        default:
            console.warn('Unknown action:', action);
            return;
    }

    try {
        const data = await sendAction(action, payload);
        
        if (data.state) {
            setState(JSON.parse(data.state));
        }
        
        processOobUpdates(data.oobUpdates);
        updateMainContent(data.mainContent);
        
        if (window.htmx) {
            window.htmx.process(document.getElementById('page-content'));
        }
    } catch (error) {
        console.error('Action error:', error);
    }
}

export function toggleElement(id) {
    const element = document.getElementById(id);
    if (element) {
        element.classList.toggle('hidden');
    }
}

/**
 * Handle save filter profile action
 * Gets the profile name from input and filters from hidden field, then sends action
 */
export async function handleSaveFilterAction(element) {
    const nameInput = document.getElementById('profileName');
    const filtersInput = document.getElementById('saveFilterFilters');
    
    if (!nameInput || !filtersInput) {
        console.error('Missing required elements for save filter action');
        return;
    }
    
    const name = nameInput.value.trim();
    const filtersStr = decodeURIComponent(filtersInput.value);
    
    if (!name) {
        alert('Please enter a profile name');
        return;
    }
    
    let filters = {};
    try {
        filters = JSON.parse(filtersStr);
    } catch (e) {
        console.error('Invalid filters JSON:', e);
        filters = {};
    }
    
    const payload = {
        name: name,
        filters: filters
    };
    
    try {
        const data = await sendAction('saveFilterProfile', payload);
        
        if (data.state) {
            setState(JSON.parse(data.state));
        }
        
        processOobUpdates(data.oobUpdates);
        updateMainContent(data.mainContent);
        
        if (window.htmx) {
            window.htmx.process(document.getElementById('page-content'));
        }
        
        // Clear the input after successful save
        nameInput.value = '';
    } catch (error) {
        console.error('Save filter error:', error);
    }
}
