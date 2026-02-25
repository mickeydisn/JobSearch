// UI Module
// UI update helpers

export function updateUI(components) {
    if (!components) return;
    
    if (components.stateDisplay) {
        document.getElementById('current-state-content').innerHTML = components.stateDisplay;
    }
    if (components.pageButtons) {
        document.getElementById('page-buttons').innerHTML = components.pageButtons;
    }
    if (components.filters) {
        document.getElementById('filters').innerHTML = components.filters;
    }
    if (components.keywordFilters) {
        document.getElementById('keyword-filters').innerHTML = components.keywordFilters;
    }
}

export function processOobUpdates(oobUpdates) {
    if (!oobUpdates || !Array.isArray(oobUpdates)) return;
    
    oobUpdates.forEach(update => {
        // Handle #current-state specially - update content only, preserve title
        if (update.target === '#current-state') {
            const target = document.getElementById('current-state-content');
            if (target) {
                target.innerHTML = update.html;
            }
        } else {
            const target = document.querySelector(update.target);
            if (target) {
                target.innerHTML = update.html;
            }
        }
    });
}

export function updateMainContent(html) {
    if (html) {
        const pageContent = document.getElementById('page-content');
        pageContent.innerHTML = html;
        
        // Ensure HTMX processes the new content to initialize triggers
        if (window.htmx) {
            window.htmx.process(pageContent);
        }
    }
}

export function showError(message) {
    document.getElementById('page-content').innerHTML = `
        <div class="alert alert-danger">
            <i class="fa fa-exclamation-triangle"></i>
            ${message}
        </div>
    `;
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast: 'info', 'success', 'warning', 'error'
 * @param {number} duration - How long to show the toast in ms (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa ${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    // Add to document
    document.body.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
}

/**
 * Get the appropriate Font Awesome icon for toast type
 */
function getToastIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'error': return 'fa-times-circle';
        case 'info':
        default: return 'fa-info-circle';
    }
}

/**
 * Apply OOB (Out-of-Band) updates to the DOM
 * Used when refreshing filters after a scrape
 * @param {Array} oobUpdates - Array of {target, html} objects
 */
export function applyOobUpdates(oobUpdates) {
    if (!oobUpdates || !Array.isArray(oobUpdates)) return;
    
    oobUpdates.forEach(update => {
        const target = document.querySelector(update.target);
        if (target) {
            target.innerHTML = update.html;
        }
    });
}
