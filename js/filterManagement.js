// Logic for filter management

// This will hold the single, permanent observer for the filter container.
let filterChangeObserver = null;
let isApplyingSettings = false; // Flag to prevent infinite loops

export function initializeFilterManagement() {
    console.log("Initializing Filter Management feature.");

    // We will now directly try to set up the permanent observer.
    // This simplifies the logic and handles cases where the container
    // might already be present on script load.
    observeFilterContainerForChanges();
}

function setupFilters() {
    // This function contains the logic that should run once the filter container is found.
    console.log("Filter container found. Proceeding with setup.");

    // First, ensure all filters have a unique ID. This is crucial for persistence.
    assignFilterIds();

    // Now, add the button if it's not already there.
    if (!document.getElementById('manage-filters-btn')) {
        console.log("Adding 'Manage Filters' button.");
        const manageButton = document.createElement('button');
        manageButton.textContent = 'Zarządzaj filtrami';
        manageButton.id = 'manage-filters-btn';
        manageButton.className = 'chakra-button css-1wsr4ig';
        manageButton.style.marginLeft = '15px';
        manageButton.style.alignSelf = 'center';

        manageButton.addEventListener('click', openFilterManager);

        const filtersContainer = document.querySelector('.list__filters-container');
        const heading = filtersContainer ? filtersContainer.querySelector('h2') : null;
        if (heading) {
            heading.insertAdjacentElement('afterend', manageButton);
        } else if (filtersContainer) {
            filtersContainer.prepend(manageButton);
        }
    }
    
    // Apply settings once.
    applyFilterSettings();
}

function getPageIdentifier() {
    const path = window.location.pathname;
    // Example: /commission/list -> commission_list
    const pageId = path.split('/').filter(p => p).join('_');
    return `filterSettings_${pageId}`;
}

function openFilterManager() {
    if (document.getElementById('filter-manager-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'filter-manager-modal';
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '1050';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    const modalContent = document.createElement('div');
    modalContent.style.background = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '500px';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.overflowY = 'auto';

    modalContent.innerHTML = `
        <h3>Zarządzaj filtrami</h3>
        <p>Przeciągnij i upuść, aby zmienić kolejność. Odznacz, aby ukryć.</p>
        
        <input type="text" id="filter-search-input" placeholder="Wyszukaj filtry..." style="width: 100%; box-sizing: border-box; margin-bottom: 10px; padding: 8px; border: 1px solid #ccc; border-radius: 3px;">
        
        <div style="margin-bottom: 15px;">
            <button id="select-all-filters-btn" class="btn btn-default btn-sm" style="margin-right: 5px;">Zaznacz wszystkie</button>
            <button id="deselect-all-filters-btn" class="btn btn-default btn-sm">Odznacz wszystkie</button>
        </div>

        <ul id="filter-list-manager" style="list-style: none; padding: 0; margin-bottom: 15px; max-height: 40vh; overflow-y: auto;"></ul>
        <button id="save-filters-btn" class="btn btn-primary">Zapisz</button>
        <button id="cancel-filters-btn" class="btn btn-default">Anuluj</button>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    populateFilterManager();

    // Event listeners for new controls
    document.getElementById('select-all-filters-btn').addEventListener('click', () => {
        document.querySelectorAll('#filter-list-manager li').forEach(li => {
            // Only check visible items if a search is active
            if (li.style.display !== 'none') {
                const cb = li.querySelector('input[type="checkbox"]');
                if (cb) cb.checked = true;
            }
        });
    });

    document.getElementById('deselect-all-filters-btn').addEventListener('click', () => {
        document.querySelectorAll('#filter-list-manager li').forEach(li => {
            // Only uncheck visible items if a search is active
            if (li.style.display !== 'none') {
                const cb = li.querySelector('input[type="checkbox"]');
                if (cb) cb.checked = false;
            }
        });
    });

    document.getElementById('filter-search-input').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('#filter-list-manager li').forEach(li => {
            const filterName = li.querySelector('span[data-filter-name]').textContent.toLowerCase();
            li.style.display = filterName.includes(searchTerm) ? 'flex' : 'none';
        });
    });

    document.getElementById('save-filters-btn').addEventListener('click', () => {
        saveFilterSettings();
        modal.remove();
    });
    document.getElementById('cancel-filters-btn').addEventListener('click', () => modal.remove());
}

function populateFilterManager() {
    const filterList = document.getElementById('filter-list-manager');
    const filterContainer = document.querySelector('.list__filters');
    if (!filterContainer || !filterList) {
        console.error("Filter manager could not find the filter list or container.");
        return;
    }

    filterList.innerHTML = '';
    const allFiltersOnPage = Array.from(filterContainer.querySelectorAll('.chakra-form-control'));

    const pageId = getPageIdentifier();
    chrome.storage.sync.get(pageId, (data) => {
        const savedSettings = data[pageId] || [];
        const settingsMap = new Map(savedSettings.map(s => [s.id, s]));
        const filtersOnPageMap = new Map(allFiltersOnPage.map(f => [f.getAttribute('data-filter-id'), f]));

        const finalFilterOrder = [];
        const processedIds = new Set();

        // 1. Add filters based on saved order
        if (savedSettings.length > 0) {
            savedSettings.forEach(setting => {
                finalFilterOrder.push(setting);
                processedIds.add(setting.id);
            });
        }

        // 2. Add any new filters from the page that weren't in storage
        allFiltersOnPage.forEach(filterOnPage => {
            const filterId = filterOnPage.getAttribute('data-filter-id');
            if (filterId && !processedIds.has(filterId)) {
                const label = filterOnPage.querySelector('label');
                const filterName = label ? label.textContent.trim() : '';
                if (filterName) {
                    finalFilterOrder.push({ id: filterId, name: filterName, visible: true });
                    processedIds.add(filterId);
                }
            }
        });

        // 3. Build the list items in the correct order
        finalFilterOrder.forEach(filterInfo => {
            const filterId = filterInfo.id;
            const filterName = filterInfo.name;
            const isVisible = filterInfo.visible;

            if (!filterName) {
                console.warn(`Filter with ID ${filterId} could not be populated (no name found).`);
                return;
            }

            const listItem = document.createElement('li');
            listItem.setAttribute('data-filter-id', filterId);
            listItem.setAttribute('draggable', 'true');
            listItem.style.padding = '8px';
            listItem.style.margin = '4px 0';
            listItem.style.border = '1px solid #ccc';
            listItem.style.borderRadius = '3px';
            listItem.style.backgroundColor = '#f9f9f9';
            listItem.style.cursor = 'move';
            listItem.style.display = 'flex';
            listItem.style.alignItems = 'center';

            listItem.innerHTML = `
                <input type="checkbox" ${isVisible ? 'checked' : ''} style="margin-right: 10px; cursor: pointer;">
                <span data-filter-name="${filterName}">${filterName}</span>
            `;
            filterList.appendChild(listItem);
        });

        // Add drag-and-drop functionality
        let draggedItem = null;
        filterList.addEventListener('dragstart', e => {
            draggedItem = e.target;
            setTimeout(() => e.target.style.opacity = '0.5', 0);
        });
        filterList.addEventListener('dragend', e => {
            setTimeout(() => e.target.style.opacity = '1', 0);
            draggedItem = null;
        });
        filterList.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(filterList, e.clientY);
            if (afterElement == null) {
                filterList.appendChild(draggedItem);
            } else {
                filterList.insertBefore(draggedItem, afterElement);
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveFilterSettings() {
    const pageId = getPageIdentifier();
    const filterList = document.getElementById('filter-list-manager');
    if (!filterList) return;

    const settings = Array.from(filterList.children).map(li => {
        const nameSpan = li.querySelector('span[data-filter-name]');
        return {
            id: li.getAttribute('data-filter-id'),
            visible: li.querySelector('input[type="checkbox"]').checked,
            // Ensure the name is correctly retrieved from the data attribute
            name: nameSpan ? nameSpan.getAttribute('data-filter-name') : '' 
        };
    });

    chrome.storage.sync.set({ [pageId]: settings }, () => {
        console.log('Filter settings saved. Reloading page to apply changes.');
        // Reload the page to apply changes.
        location.reload();
    });
}

function observeFilterContainerForChanges() {
    // If an observer is already running for the filters, don't create another one.
    if (filterChangeObserver) {
        // If we are already observing, we can still check if the container exists now
        // and run setup if it does and hasn't been run.
        if (document.querySelector('.list__filters-container') && !document.getElementById('manage-filters-btn')) {
            setupFilters();
        }
        return;
    }

    const targetNode = document.body;

    const observer = new MutationObserver((mutations, obs) => {
        const reorderableParent = document.querySelector('.list__filters-container');
        
        // 1. If the container now exists, run the initial setup and then focus on observing it.
        if (reorderableParent && !document.getElementById('manage-filters-btn')) {
            setupFilters();
            // We can disconnect the body observer and attach a more specific one if needed,
            // but observing the body for childList changes is generally fine.
        }

        // 2. Handle dynamic changes (React re-renders)
        if (reorderableParent) {
            // If the mutation was caused by our own script, ignore it.
            if (isApplyingSettings) {
                return;
            }

            // Check if nodes were added or removed inside the container.
            const wasListModified = mutations.some(m => {
                return (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0) && reorderableParent.contains(m.target));
            });

            if (wasListModified) {
                console.log("MutationObserver: Detected external change to filter container. Re-applying settings.");
                
                // It's crucial to re-assign IDs, as React might have created brand new elements
                // without our data-filter-id attribute.
                assignFilterIds(); 
                
                // Re-apply the settings to the newly rendered elements.
                applyFilterSettings();
            }
        }
    });

    observer.observe(targetNode, { childList: true, subtree: true });
    filterChangeObserver = observer; // Store the created observer.
    console.log("Permanently observing document body for filter container and its changes.");
}

// This observer will watch for changes made by React (or other scripts)
// and re-apply the user's settings if the filter list is overwritten.

function applyFilterSettings() {
    const pageId = getPageIdentifier();
    chrome.storage.sync.get(pageId, (data) => {
        const settings = data[pageId];
        if (!settings) {
            console.log("No saved filter settings found for this page. Applying default order.");
            assignFilterIds(); // Still ensure IDs are present for new sessions
            return;
        }

        const filterContainer = document.querySelector('.list__filters');
        if (!filterContainer) {
            console.error("Could not find filter container: .list__filters");
            return;
        }

        const reorderableParent = document.querySelector('.list__filters-container');
        if (!reorderableParent) {
            console.error("Could not find the reorderable parent container for filters (.list__filters-container).");
            return;
        }

        const elementMap = new Map();
        const allFilterElements = filterContainer.querySelectorAll('[data-filter-id]');
        allFilterElements.forEach(el => {
            elementMap.set(el.getAttribute('data-filter-id'), el);
        });

        // Set a flag to prevent the MutationObserver from re-triggering
        isApplyingSettings = true;

        // Detach all filter elements first to ensure a clean re-append
        allFilterElements.forEach(el => el.remove());

        // Re-append elements to the correct parent in the saved order and set visibility
        settings.forEach(setting => {
            const el = elementMap.get(setting.id);
            if (el) {
                reorderableParent.appendChild(el); // Append to the correct parent
                el.style.display = setting.visible ? '' : 'none';
            }
        });

        console.log("Applied filter settings.");

        // Reset the flag after a short delay to allow the DOM to settle.
        // This prevents the observer from ignoring legitimate external changes.
        setTimeout(() => {
            isApplyingSettings = false;
        }, 50); // A small delay is usually sufficient
    });
}

function assignFilterIds() {
    const filterContainer = document.querySelector('.list__filters');
    if (!filterContainer) return;

    const filters = filterContainer.querySelectorAll('.chakra-form-control');
    filters.forEach(filter => {
        // If it already has an ID, don't re-assign.
        if (filter.getAttribute('data-filter-id')) return;

        // Prioritize finding an input/select/textarea with an ID, as requested.
        const inputElement = filter.querySelector('input[id], select[id], textarea[id]');
        
        if (inputElement && inputElement.id) {
            // Use the actual ID of the form element to create a stable filter ID.
            const filterId = `filter-control-${inputElement.id}`;
            filter.setAttribute('data-filter-id', filterId);
        } else {
            // Fallback to using the label text if no element with an ID is found.
            const label = filter.querySelector('label');
            if (label && label.textContent.trim()) {
                const filterName = label.textContent.trim();
                const filterId = `filter-control-${filterName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
                filter.setAttribute('data-filter-id', filterId);
                console.warn(`Fallback: Generated filter ID for "${filterName}" from its label text.`);
            }
        }
    });
}
