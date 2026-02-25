// API Module
// All fetch calls and API interactions

import { currentState, setState } from './state.js';
import { updateUI } from './ui.js';

export async function initApp() {
    const response = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: currentState })
    });
    const data = await response.json();
    
    if (data.state) {
        setState(JSON.parse(data.state));
    }
    
    updateUI(data.components);
    
    return fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            state: currentState,
            action: { type: 'setPage', payload: currentState.currentPage }
        })
    });
}

export async function sendAction(actionType, payload) {
    const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            state: currentState,
            action: { type: actionType, payload: payload }
        })
    });
    return response.json();
}

export async function loadConfigEditor() {
    const contentDiv = document.getElementById('config-editor-content');
    if (!contentDiv || contentDiv.dataset.loaded === 'true') return;
    
    contentDiv.innerHTML = `
        <div class="loading">
            <i class="fa fa-spinner fa-spin"></i>
            <span>Loading configuration editor...</span>
        </div>
    `;
    
    try {
        const response = await fetch('/api/config-editor');
        const html = await response.text();
        contentDiv.innerHTML = html;
        contentDiv.dataset.loaded = 'true';
        if (window.htmx) {
            window.htmx.process(contentDiv);
        }
    } catch (error) {
        contentDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="fa fa-exclamation-triangle"></i>
                Error loading editor: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

export async function killProcess(processId) {
    return fetch('/api/process/kill/' + processId, { method: 'POST' });
}

/**
 * Refresh filter dropdowns after a scrape completes
 * @param {Object} state - Current application state
 * @returns {Promise<Object>} - Response with oobUpdates for filter HTML
 */
export async function refreshFilters(state) {
    const response = await fetch('/api/refreshFilters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
    });
    
    if (!response.ok) {
        throw new Error('Failed to refresh filters: ' + response.status);
    }
    
    return response.json();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
