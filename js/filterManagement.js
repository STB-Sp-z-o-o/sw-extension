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

function getFilterContainers() {
    // Returns both list and kanban filter containers
    return [
        document.querySelector('.list__filters'),
        document.querySelector('.kanban__filters')
    ].filter(Boolean);
}

function getReorderableParents() {
    return [
        document.querySelector('.list__filters-container'),
        document.querySelector('.kanban__filters-container')
    ].filter(Boolean);
}

function setupFilters() {
    console.log("Filter container found. Proceeding with setup.");

    // First, ensure all filters have a unique ID. This is crucial for persistence.
    // Ensure all filters have a unique ID in both containers
    getFilterContainers().forEach(assignFilterIds);

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

        const containers = getReorderableParents();
        containers.forEach(filtersContainer => {
            const heading = filtersContainer ? filtersContainer.querySelector('h2') : null;
            if (heading) {
                heading.insertAdjacentElement('afterend', manageButton);
            } else if (filtersContainer) {
                filtersContainer.prepend(manageButton);
            }
        });
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

function assignFilterIds(filterContainer) {
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

function populateFilterManager() {
    const filterList = document.getElementById('filter-list-manager');
    // Try both containers
    const filterContainers = getFilterContainers();
    const allFiltersOnPage = filterContainers.flatMap(container => Array.from(container.querySelectorAll('.chakra-form-control')));
    if (allFiltersOnPage.length === 0 || !filterList) {
        console.error("Filter manager could not find the filter list or container.");
        return;
    }
    filterList.innerHTML = '';
    const pageId = getPageIdentifier();
    chrome.storage.local.get(null, (data) => {
        let savedSettings = data[pageId] || [];
        if (data[`${pageId}_chunkCount`] > 0) {
            savedSettings = [];
            for (let i = 0; i < data[`${pageId}_chunkCount`]; i++) {
                savedSettings = savedSettings.concat(data[`${pageId}_chunk${i}`] || []);
            }
        }
        const settingsMap = new Map(savedSettings.map(s => [s.id, s]));
        const filtersOnPageMap = new Map(allFiltersOnPage.map(f => [f.getAttribute('data-filter-id'), f]));
        const finalFilterOrder = [];
        const processedIds = new Set();
        if (savedSettings.length > 0) {
            savedSettings.forEach(setting => {
                finalFilterOrder.push(setting);
                processedIds.add(setting.id);
            });
        }
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
            name: nameSpan ? nameSpan.getAttribute('data-filter-name') : '' 
        };
    });

    // Debug: log what will be saved
    console.log('Saving filter settings to local:', pageId, settings);

    // Chunk settings if too large for one item (Chrome local storage limit is ~5MB per item)
    const maxChunkSize = 5000; // Number of filters per chunk (adjust as needed)
    if (settings.length > maxChunkSize) {
        const chunks = [];
        for (let i = 0; i < settings.length; i += maxChunkSize) {
            chunks.push(settings.slice(i, i + maxChunkSize));
        }
        const chunkKeys = chunks.map((_, idx) => `${pageId}_chunk${idx}`);
        const chunkData = {};
        chunkKeys.forEach((key, idx) => {
            chunkData[key] = chunks[idx];
        });
        chunkData[`${pageId}_chunkCount`] = chunks.length;
        console.log('Saving chunked filter settings to local:', chunkData);
        chrome.storage.local.set(chunkData, () => {
            console.log('Large filter settings saved in chunks. Reloading page to apply changes.');
           location.reload();
        });
    } else {
        const obj = { [pageId]: settings };
        chrome.storage.local.set(obj, () => {
            console.log('Filter settings saved. Reloading page to apply changes.', obj);
           location.reload();
        });
    }
}

function applyFilterSettings() {
    const pageId = getPageIdentifier();
    // First, check if chunked data exists
    chrome.storage.local.get(null, (data) => {
        let settings = data[pageId];
        if (data[`${pageId}_chunkCount`] > 0) {
            // Reconstruct settings from chunks
            settings = [];
            for (let i = 0; i < data[`${pageId}_chunkCount`]; i++) {
                settings = settings.concat(data[`${pageId}_chunk${i}`] || []);
            }
        }
        if (!settings || settings.length === 0) {
            console.log("No saved filter settings found for this page. Applying default order.");
            getFilterContainers().forEach(assignFilterIds);
            return;
        }

        const filterContainers = getFilterContainers();
        const reorderableParents = getReorderableParents();
        const elementMap = new Map();
        filterContainers.forEach(container => {
            container.querySelectorAll('[data-filter-id]').forEach(el => {
                elementMap.set(el.getAttribute('data-filter-id'), el);
            });
        });

        // Check if already populated correctly
        const currentOrder = Array.from(reorderableParents[0].children)
            .filter(el => el.hasAttribute('data-filter-id'))
            .map(el => el.getAttribute('data-filter-id'));
        const savedOrder = settings.map(s => s.id);
        const isSameOrder = currentOrder.length === savedOrder.length && currentOrder.every((id, idx) => id === savedOrder[idx]);
        if (isSameOrder) {
            // Only update visibility if needed
            settings.forEach(setting => {
                const el = elementMap.get(setting.id);
                if (el) {
                    el.style.display = setting.visible ? '' : 'none';
                }
            });
            console.log("Filter settings already populated. Updated visibility only.");
            return;
        }

        isApplyingSettings = true;
        filterContainers.forEach(container => {
            container.querySelectorAll('[data-filter-id]').forEach(el => el.remove());
        });
        settings.forEach(setting => {
            const el = elementMap.get(setting.id);
            if (el) {
                // Append to the first reorderable parent (or both if needed)
                (reorderableParents[0] || reorderableParents[1]).appendChild(el);
                el.style.display = setting.visible ? '' : 'none';
            }
        });
        console.log("Applied filter settings.");
        setTimeout(() => {
            isApplyingSettings = false;
        }, 50);
    });
}

function observeFilterContainerForChanges() {
    // If an observer is already running for the filters, don't create another one.
    if (filterChangeObserver) {
        // If we are already observing, we can still check if the container exists now
        // and run setup if it does and hasn't been run.
        if ((getReorderableParents().length > 0) && !document.getElementById('manage-filters-btn')) {
            setupFilters();
        }
        return;
    }

    const targetNode = document.body;

    const observer = new MutationObserver((mutations, obs) => {
        const reorderableParents = getReorderableParents();
        // 1. If the container now exists, run the initial setup and then focus on observing it.
        if (reorderableParents.length > 0 && !document.getElementById('manage-filters-btn')) {
            setupFilters();
            // We can disconnect the body observer and attach a more specific one if needed,
            // but observing the body for childList changes is generally fine.
        }

        // 2. Handle dynamic changes (React re-renders)
        if (reorderableParents.length > 0) {
            // If the mutation was caused by our own script, ignore it.
            if (isApplyingSettings) {
                return;
            }

            // Check if nodes were added or removed inside the container.
            const wasListModified = mutations.some(m => {
                return (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0) && reorderableParents.some(parent => parent.contains(m.target)));
            });

            if (wasListModified) {
                console.log("MutationObserver: Detected external change to filter container. Re-applying settings.");
                
                // It's crucial to re-assign IDs, as React might have created brand new elements
                // without our data-filter-id attribute.
                getFilterContainers().forEach(assignFilterIds); 
                
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

// function assignFilterIds() {
//     const filterContainer = document.querySelector('.list__filters');
//     if (!filterContainer) return;

//     const filters = filterContainer.querySelectorAll('.chakra-form-control');
//     filters.forEach(filter => {
//         // If it already has an ID, don't re-assign.
//         if (filter.getAttribute('data-filter-id')) return;

//         // Prioritize finding an input/select/textarea with an ID, as requested.
//         const inputElement = filter.querySelector('input[id], select[id], textarea[id]');
        
//         if (inputElement && inputElement.id) {
//             // Use the actual ID of the form element to create a stable filter ID.
//             const filterId = `filter-control-${inputElement.id}`;
//             filter.setAttribute('data-filter-id', filterId);
//         } else {
//             // Fallback to using the label text if no element with an ID is found.
//             const label = filter.querySelector('label');
//             if (label && label.textContent.trim()) {
//                 const filterName = label.textContent.trim();
//                 const filterId = `filter-control-${filterName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
//                 filter.setAttribute('data-filter-id', filterId);
//                 console.warn(`Fallback: Generated filter ID for "${filterName}" from its label text.`);
//             }
//         }
//     });
// }