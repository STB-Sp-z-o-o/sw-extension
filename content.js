// content.js
console.log("content.js script injected and running. v5 - Specific Modal");

const defaultFeatureSettings = {
    commissionPage: true,
    credentialsPage: true,
    editPage: true,
    materialCost: true, // Added for consistency
    filterManagement: true
};

// --- Main Initialization Logic ---

// This function will hold all the logic that needs to be re-run when settings change.
function initializeFeatures(settings) {
    console.log("Initializing features with settings:", settings);

    // Logic for commission show page
    if (settings.commissionPage && window.location.href.includes('https://serwis.stb.tech/commission/show/commission_id/')) {
        initializeCommissionPage();
    }

    // Logic for attribute credentials page
    if (settings.credentialsPage && window.location.href.includes('https://serwis.stb.tech/commissionAttribute/addAttributeCredentials/commission_attribute_id/')) {
        initializeCredentialsPage();
    }

    // Logic for attribute edit page
    if (settings.editPage && window.location.href.includes('https://serwis.stb.tech/commissionAttribute/edit/commission_attribute_id/')) {
        initializeEditPage();
    }

    // Logic for Filter Management on list pages
    if (settings.filterManagement && window.location.href.includes('/list')) {
        initializeFilterManagement();
    }

    // Note: The modal logic and material cost calculation are embedded within the commission page logic,
    // so they are controlled by the `commissionPage` setting.
}

// --- Listener for settings changes ---

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.featureSettings) {
        console.log('Detected a change in feature settings.');
        const newSettings = changes.featureSettings.newValue;
        // We might need to clear or reset existing modifications before re-initializing
        // For now, we'll just re-run the initialization.
        initializeFeatures(newSettings);
    }
});

// --- Initial Run ---

// Wrapper to get settings and run the main initialization function.
function runWithSettings() {
    chrome.storage.sync.get({ featureSettings: defaultFeatureSettings }, (data) => {
        initializeFeatures(data.featureSettings);
    });
}

// Run all initializations when the script first loads.
runWithSettings();


// --- Feature-specific Functions ---

// Flag to prevent multiple enhancements of the same modal instance.
let isModalEnhanced = false;

// Function to display search results in the modal
function displaySharePointResults(items, resultsContainer, modal) {
    resultsContainer.innerHTML = ''; // Clear previous results

    if (!items || items.length === 0) {
        resultsContainer.innerHTML = '<p>Brak wyników.</p>';
        return;
    }

    items.forEach(item => {
        console.log('Processing SharePoint item:', item);
        const fields = item.fields;
        const orderNumber = fields.Nrzam_x00f3_wienia || 'Brak numeru';
        const serialNumber = fields.Firma || 'Brak numeru seryjnego';
        const producent = fields.FirmaW_x00f3_zkowa || 'Brak producenta';
        const model = fields.TypUrz_x0105_dzenia || 'Brak modelu';

        const card = document.createElement('div');
        card.style.padding = '10px';
        card.style.border = '1px solid #ddd';
        card.style.borderRadius = '5px';
        card.style.marginBottom = '10px';
        card.style.cursor = 'pointer';
        card.style.transition = 'background-color 0.2s';

        card.innerHTML = `
            <h6 style="margin: 0 0 5px 0; font-weight: bold;">Nr zam: ${orderNumber}</h6>
            <p style="margin: 0 0 3px 0; font-size: 0.9em;"><strong>Firma:</strong> ${serialNumber || '-'}</p>
            <p style="margin: 0 0 3px 0; font-size: 0.9em;"><strong>Producent:</strong> ${producent || '-'}</p>
            <p style="margin: 0 0 3px 0; font-size: 0.9em;"><strong>Model:</strong> ${model || '-'}</p>
            <p style="margin: 0 0 3px 0; font-size: 0.9em;"><strong>Status:</strong> ${fields.Status || '-'}</p>
            <p style="margin: 0; font-size: 0.9em;"><strong>Produkt:</strong> ${fields.Produkt || '-'}</p>
        `;

        card.addEventListener('mouseenter', () => card.style.backgroundColor = '#f0f0f0');
        card.addEventListener('mouseleave', () => card.style.backgroundColor = 'transparent');

        card.addEventListener('click', () => {
            console.log('Selected SharePoint item:', fields);
            const serialNumberField = modal.querySelector('textarea[id="commission_attributes_287_value"]');
            const modelField = modal.querySelector('textarea[id="commission_attributes_288_value"]');
            const producentSelect = modal.querySelector('select[id="commission_attributes_286_value"]');
            
            if (producentSelect && producent) {
                const producentValue = producent.toLowerCase();
                let found = false;
                // Find the option with case-insensitive matching
                for (let i = 0; i < producentSelect.options.length; i++) {
                    if (producentSelect.options[i].text.toLowerCase() === producentValue) {
                        producentSelect.value = producentSelect.options[i].value;
                        found = true;
                        break;
                    }
                }
                if (found) {
                    // Trigger change event for select2 to update
                    const event = new Event('change', { bubbles: true });
                    producentSelect.dispatchEvent(event);
                } else {
                    console.warn(`Producent "${producent}" not found in the dropdown.`);
                }
            }

            if (modelField) {
                modelField.value = model || '';
                modelField.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (serialNumberField) {
                serialNumberField.value = serialNumber || '';
                serialNumberField.dispatchEvent(new Event('input', { bubbles: true }));
            }

            const descriptionField = modal.querySelector('textarea[name="description"]');
            if (descriptionField) {
                descriptionField.value = orderNumber;
                descriptionField.dispatchEvent(new Event('input', { bubbles: true }));
            }
            // alert(`Wybrano: ${orderNumber}`);
            // Hide the entire search container after selection for a cleaner UI
            const searchContainer = document.getElementById('sharepoint-search-container');
            // if(searchContainer) searchContainer.style.display = 'none';
        });
        resultsContainer.appendChild(card);
    });
}

// This function creates the search UI inside the modal
function enhanceShipmentModal(modal) {
    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody || document.getElementById('sharepoint-search-container')) {
        return; // Already enhanced or no modal body
    }

    const searchContainer = document.createElement('div');
    searchContainer.id = 'sharepoint-search-container';
    searchContainer.style.marginTop = '20px';
    searchContainer.style.borderTop = '1px solid #ccc';
    searchContainer.style.paddingTop = '15px';

    searchContainer.innerHTML = `
        <h5>Wyszukaj w SharePoint</h5>
        <div style="display: flex; margin-bottom: 10px;">
            <input type="text" id="sharepoint-search-input" placeholder="Wpisz Nr zamówienia..." style="flex-grow: 1; margin-right: 5px;" class="form-control">
            <button id="sharepoint-search-button" class="btn btn-primary">Szukaj</button>
        </div>
        <div id="sharepoint-results-container"></div>
    `;

    modalBody.appendChild(searchContainer);

    const searchInput = document.getElementById('sharepoint-search-input');
    const searchButton = document.getElementById('sharepoint-search-button');
    const resultsContainer = document.getElementById('sharepoint-results-container');

    // Listen for search results from the background script
    window.addEventListener('SharePointSearchResults', (event) => {
        console.log('Received SharePointSearchResults event:', event.detail);
        const { success, data, error } = event.detail;
        if (success) {
            displaySharePointResults(data, resultsContainer, modal);
        } else {
            const errorMessage = error || "No response from background script.";
            console.error('Failed to search SharePoint data:', errorMessage);
            resultsContainer.innerHTML = `<p style="color: red;">Błąd: ${errorMessage}</p>`;
        }
    });

    const performSearch = () => {
        const query = searchInput.value.trim();
        if (!query) {
            resultsContainer.innerHTML = ''; // Clear results if query is empty
            return;
        }

        resultsContainer.innerHTML = '<p>Szukanie...</p>';

        // Dispatch an event to be caught by the content script part that has chrome API access
        console.log('Dispatching PerformSharePointSearch event with query:', query);
        window.dispatchEvent(new CustomEvent('PerformSharePointSearch', { detail: { query } }));
    };

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission
            performSearch();
        }
    });
}

function checkForSpecificModal() {
  // If the modal has already been enhanced, don't do it again.
  if (isModalEnhanced) {
    return;
  }

  const dialogs = document.querySelectorAll('[role="dialog"]');

  dialogs.forEach((dialog) => {
    const modalTitle = dialog.querySelector('.modal-title');
    if (modalTitle) {
        const titleText = modalTitle.textContent.trim();
        if (titleText === 'Nowa wysyłka') {
            console.log('SUCCESS: Detected "Nowa wysyłka" modal! Enhancing with search UI.');
            
            // Set the flag to true to prevent re-entry for this instance.
            isModalEnhanced = true;

            // Inject the search UI into the modal
            enhanceShipmentModal(dialog);

            // Use another observer to detect when the modal is removed from the DOM
            const modalObserver = new MutationObserver(() => {
                if (!document.body.contains(dialog)) {
                    console.log('"Nowa wysyłka" modal has been closed. Resetting enhancement flag.');
                    isModalEnhanced = false; // Reset the flag
                    modalObserver.disconnect(); // Clean up this observer
                }
            });
            modalObserver.observe(document.body, { childList: true, subtree: true });
        }
    }
  });
}

// Use a MutationObserver to watch for modals being added to the DOM.
const observer = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            checkForSpecificModal();
        }
    }
});

// Start observing the document body for child list changes.
console.log("Starting observer on document.body for specific modal.");
observer.observe(document.body, { childList: true, subtree: true });

// Listener for search events from the page
window.addEventListener('PerformSharePointSearch', (event) => {
    const { query } = event.detail;
    console.log(`Content script received PerformSharePointSearch event, forwarding to background. Query: ${query}`);
    
    chrome.runtime.sendMessage({ action: 'search_sharepoint_data', query: query }, (response) => {
        // Check for runtime errors (e.g., extension context invalidated)
        if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError.message);
            window.dispatchEvent(new CustomEvent('SharePointSearchResults', {
                detail: { success: false, error: chrome.runtime.lastError.message }
            }));
            return;
        }

        console.log('Received response from background, dispatching to window:', response);
        // Dispatch the results back to the window, whether success or failure
        window.dispatchEvent(new CustomEvent('SharePointSearchResults', { detail: response }));
    });
});

// Also check if a modal is already present on page load.
console.log("Running initial check for specific modal.");
checkForSpecificModal();

// --- Filter Management --- //

// This will hold the single, permanent observer for the filter container.
let filterChangeObserver = null;
let isApplyingSettings = false; // Flag to prevent infinite loops

function initializeFilterManagement() {
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
        <ul id="filter-list-manager" style="list-style: none; padding: 0; margin-bottom: 15px;"></ul>
        <button id="save-filters-btn" class="btn btn-primary">Zapisz</button>
        <button id="cancel-filters-btn" class="btn btn-default">Anuluj</button>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    populateFilterManager();

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


// --- Logic for adding attribute IDs to labels on commission show page ---

let fetchWithAuth;

// Encapsulate all commission page logic into a single function
function initializeCommissionPage() {
    console.log("Commission page detected. Checking user status.");

    // Promisify chrome.storage.get for both local and sync
    const getFromLocalStorage = (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve));
    const getFromSyncStorage = (keys) => new Promise(resolve => chrome.storage.sync.get(keys, resolve));

    // First, check if the user is a superuser
    getFromLocalStorage(['extension_user']).then(storageData => {
        if (storageData.extension_user && storageData.extension_user.isSuperUser) {
            console.log("Superuser detected. Initializing attribute features.");
            addCreateAttributeButton();
            initializeAttributeDisplay();
        } else {
            console.log("User is not a superuser. Attribute features will not be initialized.");
        }
    });

    function addCreateAttributeButton() {
        const observer = new MutationObserver((mutationsList, observer) => {
            const targetDiv = document.querySelector('.commission__details');
            if (targetDiv) {
                console.log("Target div for create attribute button found:", targetDiv);
                if (!document.querySelector('.create-attribute-btn')) {
                    const createBtn = document.createElement('a');
                    createBtn.href = 'https://serwis.stb.tech/commissionAttribute/create';
                    createBtn.target = '_blank';
                    createBtn.textContent = 'Dodaj atrybut';
                    createBtn.classList.add('create-attribute-btn', 'btn', 'btn-primary', 'btn-sm');

                    targetDiv.prepend(createBtn);
                }
                observer.disconnect(); // Stop observing once the button is added
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Define a fetch wrapper that includes the auth token
    fetchWithAuth = async (url, options = {}) => {
        const { extension_auth_token, extension_settings } = await getFromLocalStorage(['extension_auth_token', 'extension_settings']);

        if (!extension_auth_token || !extension_settings || !extension_settings.apiUrl) {
            console.error('Authentication token or API URL not found in local storage.');
            return Promise.reject('No auth token or API URL');
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${extension_auth_token}`,
            'Content-Type': 'application/json'
        };

        return fetch(extension_settings.apiUrl + url, { ...options, headers });
    };

    // Main function to fetch data and update the DOM
    async function initializeAttributeDisplay() {
        try {
            const urlParts = window.location.href.split('/');
            const commissionId = urlParts[urlParts.length - 1];

            if (!commissionId) {
                console.error('Could not extract commission ID from URL.');
                return;
            }

            const apiUrl = `/api/commissions/${commissionId}?fields=id,commissionPhase&extra_fields=attributes&setting%5Bwith_relations%5D=true`;
            const response = await fetchWithAuth(apiUrl);

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const commissionData = await response.json();

            if (commissionData && commissionData.data && commissionData.data.commissionPhase && commissionData.data.commissionPhase.commissionPhaseId === 58) {
                console.log('Commission phase is 58. Adding Rozliczenie tab and custom info.');
                appendCustomInfoToSidePanel();
            }

            const attributePriorities = {};

            if (commissionData && commissionData.data && commissionData.data.attributes) {
                commissionData.data.attributes.forEach(attr => {
                    if (attr.id && attr.options && attr.options.displayPriority !== undefined) {
                        attributePriorities[attr.id] = attr.options.displayPriority;
                    }
                });
            }

            // Run once on load with the fetched priorities
            addAttributeIdsToLabels(attributePriorities);

            // Set up the observer to also use the fetched priorities for dynamic changes
            const attributeObserver = new MutationObserver(() => {
                addAttributeIdsToLabels(attributePriorities);
            });

            attributeObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

        } catch (error) {
            console.error('Error initializing attribute display:', error);
        }
    }

    function generateExcel() {
        // XLSX is now loaded via manifest.json, so it should be available directly.
        createAndDownloadExcel();
    }

    function createAndDownloadExcel() {
        // 1. Gather Commission Data
        const commissionName = document.querySelector('h1#name .chakra-text')?.textContent.trim() || 'Brak nazwy zlecenia';
        const hourlyRate = document.getElementById('hourly-rate-input')?.value || '0';
        const hours = document.querySelector('input[id^="attribute__numeric-361"]')?.value || '0';
        const totalCost = document.querySelector('input[id^="attribute__numeric-474"]')?.value || '0';

        // 2. Gather Attributes Data
        const attributesData = [['Nazwa Atrybutu', 'Wartość']];
        document.querySelectorAll('div[id^="attribute-"]').forEach(attrDiv => {
            const label = attrDiv.querySelector('label, h4')?.textContent.split(' (')[0].trim();
            let value = '';
            const input = attrDiv.querySelector('input, textarea');
            const select = attrDiv.querySelector('.css-1u9des2-singleValue'); // For react-select

            if (input) {
                value = input.value;
            } else if (select) {
                value = select.textContent;
            } else {
                value = attrDiv.querySelector('.css-1ub2d3b,.css-1x3tsek')?.textContent || 'N/A';
            }
            
            if (label) {
                attributesData.push([label, value]);
            }
        });

        // 3. Gather Used Materials Data
        const materialsData = [['Nazwa Produktu', 'Ilość', 'Cena Netto']];
        document.querySelectorAll('.used-materials__table__row-base').forEach(row => {
            const name = row.querySelector('a p')?.textContent.trim();
            const panel = row.querySelector('.chakra-accordion__panel');
            if (name && panel) {
                const quantity = panel.querySelectorAll('p')[1]?.textContent.trim();
                const price = panel.querySelectorAll('p')[3]?.textContent.trim();
                materialsData.push([name, quantity, price]);
            }
        });

        // 4. Create Workbook and Worksheets
        const wb = XLSX.utils.book_new();

        // Summary Sheet
        const summaryData = [
            ['Zlecenie', commissionName],
            ['Stawka Godzinowa', hourlyRate],
            ['Ilość Godzin (atr. 361)', hours],
            ['Całkowity Koszt (atr. 474)', totalCost]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Podsumowanie');

        // Attributes Sheet
        const wsAttributes = XLSX.utils.aoa_to_sheet(attributesData);
        XLSX.utils.book_append_sheet(wb, wsAttributes, 'Atrybuty');

        // Materials Sheet
        const wsMaterials = XLSX.utils.aoa_to_sheet(materialsData);
        XLSX.utils.book_append_sheet(wb, wsMaterials, 'Użyte Materiały');

        // 5. Download the Excel file
        XLSX.writeFile(wb, `${commissionName.replace(/\//g, '_')}_rozliczenie.xlsx`);
    }

    function calculateUsedMaterials() {
        let totalMaterialsCost = 0;
        // Select all rows in the table body that are not the 'add-new' row.
        const materialRows = document.querySelectorAll('.used-materials__table tbody tr:not(.used-materials__table__add-new)');

        materialRows.forEach(row => {
            // The quantity and price are in the second and third input fields of the row.
            const inputs = row.querySelectorAll('input[type="number"]');
            if (inputs.length >= 2) {
                const quantity = parseFloat(inputs[0].value);
                const price = parseFloat(inputs[1].value);

                if (!isNaN(quantity) && !isNaN(price)) {
                    totalMaterialsCost += quantity * price;
                }
            }
        });

        console.log(`Total materials cost: ${totalMaterialsCost}`);
        return totalMaterialsCost;
    }

    function appendCustomInfoToSidePanel() {
        const observer = new MutationObserver((mutationsList, observer) => {
            const sideInfoPanel = document.querySelector('.commission__side-info');

            if (sideInfoPanel) {
                let customInfoSection = document.getElementById('custom-side-info-section');

                // If the section doesn't exist, create and append it.
                if (!customInfoSection) {
                    console.log('Side info panel found. Adding custom info section.');
                    customInfoSection = document.createElement('div');
                    customInfoSection.id = 'custom-side-info-section';
                    customInfoSection.className = 'css-l7va25'; // Match styling of other sections
                    customInfoSection.style.marginTop = '20px';

                    customInfoSection.innerHTML = `
                        <div class="chakra-stack css-1fv6v2f">
                            <div class="chakra-stack css-1oeb4ru">
                                <h2 class="chakra-heading css-18j379d">Rozliczenie</h2>
                            </div>
                        </div>
                        <div class="chakra-stack css-9d72bo">
                            <span class="chakra-text css-722v25">Status rozliczenia:</span>
                            <div class="css-0">
                                <span class="chakra-text css-0">W toku</span>
                            </div>
                        </div>
                        <div class="chakra-stack css-9d72bo" style="margin-top: 10px;">
                            <span class="chakra-text css-722v25">Stawka godzinowa:</span>
                            <div class="css-0">
                                <input id="hourly-rate-input" class="chakra-input css-v0kxjo" placeholder="Wpisz stawkę">
                            </div>
                        </div>
                        <div class="chakra-stack css-9d72bo" style="margin-top: 10px;">
                            <button id="calculate-button" class="chakra-button css-14aipv">Rozlicz</button>
                        </div>
                        <div class="chakra-stack css-9d72bo" style="margin-top: 10px;">
                            <button id="excel-button" class="chakra-button css-14aipv">Generuj Excel</button>
                        </div>
                    `;
                    sideInfoPanel.appendChild(customInfoSection);

                    // Add event listener for the calculate button
                    const calculateButton = document.getElementById('calculate-button');
                    if (calculateButton) {
                        calculateButton.addEventListener('click', () => {
                            const hourlyRateInput = document.getElementById('hourly-rate-input');
                            const hourlyRate = parseFloat(hourlyRateInput.value);

                            const attribute361Input = document.querySelector('input[id^="attribute__numeric-361"]');
                            const attribute474Input = document.querySelector('input[id^="attribute__numeric-474"]');

                            if (isNaN(hourlyRate)) {
                                alert('Proszę podać prawidłową stawkę godzinową.');
                                return;
                            }

                            if (attribute361Input && attribute474Input) {
                                const attribute361Value = parseFloat(attribute361Input.value);
                                if (isNaN(attribute361Value)) {
                                    alert('Wartość dla atrybutu 361 jest nieprawidłowa.');
                                    return;
                                }

                                const hourlyCalculation = hourlyRate * attribute361Value;
                                const materialsTotal = calculateUsedMaterials();
                                const result = hourlyCalculation + materialsTotal;
                                
                                // Focus the input, set the value, dispatch an event, and then blur it
                                // to ensure all of React's state and event handlers are triggered correctly.
                                attribute474Input.focus();

                                // Use the native value setter to ensure React's change detection is triggered
                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                                nativeInputValueSetter.call(attribute474Input, result.toFixed(2));

                                // Dispatch an input event to notify the web application of the change
                                const inputEvent = new Event('input', { bubbles: true });
                                attribute474Input.dispatchEvent(inputEvent);

                                // Blur the input to trigger any save-on-blur logic
                                attribute474Input.blur();

                            } else {
                                alert('Nie znaleziono pól atrybutów 361 lub 474.');
                            }
                        });
                    }

                    // Add event listener for the excel button
                    const excelButton = document.getElementById('excel-button');
                    if (excelButton) {
                        excelButton.addEventListener('click', generateExcel);
                    }
                }

                // If the section is not the last child, move it to the end.
                if (sideInfoPanel.lastChild !== customInfoSection) {
                    sideInfoPanel.appendChild(customInfoSection);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    initializeAttributeDisplay();
}


function addAttributeIdsToLabels(priorities = {}) {
    // Find all attribute divs that haven't been processed yet, including file attributes.
    const attributeDivs = document.querySelectorAll('div[id^="attribute-"]:not([data-id-appended="true"])');

    attributeDivs.forEach(div => {
        // Handles both 'attribute-123' and 'attribute__file-123'
        const idParts = div.id.split('-');
        if (idParts.length > 1) {
            const id = idParts[idParts.length - 1]; // Get the last part for the ID
            const label = div.querySelector('label, h4'); // Find the label element or heading

            if (label) {
                // The file attributes use a heading instead of a label with .chakra-text
                const labelTextElement = label.querySelector('.chakra-text') || label;
                const priority = priorities[id];

                if (labelTextElement && !labelTextElement.textContent.includes(`(${id})`)) {
                    let baseText = `${labelTextElement.textContent.trim()} (${id})`;
                    labelTextElement.textContent = baseText;

                    if (priority !== undefined) {
                        const prioritySpan = document.createElement('span');
                        prioritySpan.textContent = ` [${priority}]`;
                        prioritySpan.classList.add('priority-text');
                        labelTextElement.appendChild(prioritySpan);
                    }
                }

                // Add edit link if not already there
                if (!label.querySelector('.edit-attribute-link')) {
                    const editLink = document.createElement('a');
                    editLink.href = `https://serwis.stb.tech/commissionAttribute/edit/commission_attribute_id/${id}`;
                    editLink.textContent = ' (edit)';
                    editLink.target = '_blank';
                    editLink.style.marginLeft = '5px';
                    editLink.classList.add('edit-attribute-link');
                    label.appendChild(editLink);
                }

                // Add update priority button if not already there
                if (!label.querySelector('.update-priority-btn') && priority !== undefined) {
                    const updateBtn = document.createElement('button');
                    updateBtn.textContent = 'Zmień priorytet';
                    updateBtn.classList.add('update-priority-btn');
                    updateBtn.classList.add('chakra-button');
                    updateBtn.classList.add('css-14aipv');
                    updateBtn.style.marginLeft = '5px';

                    const updateContainer = document.createElement('span');
                    updateContainer.style.display = 'none';
                    updateContainer.style.marginLeft = '5px';

                    const priorityInput = document.createElement('input');
                    priorityInput.classList.add('chakra-input');
                    priorityInput.classList.add('css-v0kxjo');
                    priorityInput.type = 'number';
                    priorityInput.value = priority;
                    priorityInput.style.width = '60px';

                    const saveBtn = document.createElement('button');
                    saveBtn.textContent = 'Zapisz';
                    saveBtn.classList.add('btn', 'btn-primary', 'btn-sm');

                    updateContainer.appendChild(priorityInput);
                    updateContainer.appendChild(saveBtn);

                    label.appendChild(updateBtn);
                    label.appendChild(updateContainer);

                    updateBtn.addEventListener('click', () => {
                        updateContainer.style.display = updateContainer.style.display === 'none' ? 'inline-block' : 'none';
                    });

                    saveBtn.addEventListener('click', async () => {
                        const newPriority = parseInt(priorityInput.value, 10);
                        if (isNaN(newPriority)) {
                            alert('Please enter a valid number for priority.');
                            return;
                        }

                        try {
                            const apiUrl = `/api/commission_attributes/${id}`;
                            const response = await fetchWithAuth(apiUrl, {
                                method: 'PATCH',
                                body: JSON.stringify({ data: { displayPriority: newPriority } })
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(`API Error: ${errorData.message || response.status}`);
                            }

                            // Update UI
                            const prioritySpan = label.querySelector('.priority-text');
                            if (prioritySpan) {
                                prioritySpan.textContent = ` [${newPriority}]`;
                            }
                            priorities[id] = newPriority; // Update local priorities object
                            updateContainer.style.display = 'none';

                        } catch (error) {
                            console.error('Error updating priority:', error);
                            alert(`Failed to update priority: ${error.message}`);
                        }
                    });
                }
            }
        }
        // Mark the div as processed to avoid re-adding the ID.
        div.setAttribute('data-id-appended', 'true');
    });
}

// --- Logic for attribute credentials page ---
function initializeCredentialsPage() {
    console.log("Attribute credentials page detected. Applying enhancements.");

    // Keep track of which elements have been enhanced to avoid re-applying changes.
    const processedElements = {
        credential_type: false,
        phase_id: false,
        user_profile_id: false
    };

    const enhanceSelectElement = (selectId, addFilter = false) => {
        const selectElement = document.getElementById(selectId);
        if (!selectElement || processedElements[selectId]) {
            return false; // Already processed or not found
        }

        // --- 1. Resize the select box ---
        selectElement.size = 25;
        // For 'credential_type', which is not a multiple select, we adjust height.
        if (!selectElement.multiple) {
            selectElement.style.height = 'auto';
        }

        const parentDiv = selectElement.parentElement;
        if (!parentDiv) return true;

        // --- 2. Add Select/Deselect All buttons (for multi-selects) ---
        if (selectElement.multiple) {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.marginTop = '5px';

            const selectAllBtn = document.createElement('button');
            selectAllBtn.textContent = 'Zaznacz wszystko';
            selectAllBtn.type = 'button'; // Prevent form submission
            selectAllBtn.className = 'btn btn-secondary btn-sm';
            selectAllBtn.style.marginRight = '5px';
            selectAllBtn.onclick = () => {
                Array.from(selectElement.options).forEach(opt => {
                    // Only select options that are not hidden by the filter
                    if (opt.style.display !== 'none') {
                        opt.selected = true;
                    }
                });
            };

            const deselectAllBtn = document.createElement('button');
            deselectAllBtn.textContent = 'Odznacz wszystko';
            deselectAllBtn.type = 'button';
            deselectAllBtn.className = 'btn btn-secondary btn-sm';
            deselectAllBtn.onclick = () => {
                Array.from(selectElement.options).forEach(opt => {
                    // Only deselect options that are not hidden by the filter
                    if (opt.style.display !== 'none') {
                        opt.selected = false;
                    }
                });
            };

            buttonContainer.appendChild(selectAllBtn);
            buttonContainer.appendChild(deselectAllBtn);
            parentDiv.insertBefore(buttonContainer, selectElement.nextSibling);
        }

        // --- 3. Add a filter input (if requested) ---
        if (addFilter) {
            const filterInput = document.createElement('input');
            filterInput.type = 'text';
            filterInput.placeholder = 'Filtruj fazy...';
            filterInput.className = 'form-control mb-2'; // Using bootstrap classes
            filterInput.style.marginTop = '10px';

            filterInput.addEventListener('input', (e) => {
                const filterText = e.target.value.toLowerCase();
                Array.from(selectElement.options).forEach(opt => {
                    const optionText = opt.textContent.toLowerCase();
                    opt.style.display = optionText.includes(filterText) ? '' : 'none';
                });
            });

            parentDiv.insertBefore(filterInput, selectElement);
        }

        console.log(`Enhanced element: #${selectId}`);
        return true;
    };

    const observer = new MutationObserver((mutationsList, observer) => {
        // Try to enhance all three elements on each mutation
        if (!processedElements.credential_type) {
            processedElements.credential_type = enhanceSelectElement('credential_type');
        }
        if (!processedElements.phase_id) {
            processedElements.phase_id = enhanceSelectElement('phase_id', true); // Add filter for this one
        }
        if (!processedElements.user_profile_id) {
            processedElements.user_profile_id = enhanceSelectElement('user_profile_id');
        }

        // If all elements are processed, we can stop observing.
        if (processedElements.credential_type && processedElements.phase_id && processedElements.user_profile_id) {
            console.log("All credential page elements enhanced. Disconnecting observer.");
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Encapsulate all edit page logic into a single function
function initializeEditPage() {
    const initObserver = new MutationObserver((mutations, obs) => {
        const permissionsTable = document.querySelector('h3 + .col-md-6 .table-bordered');
        if (permissionsTable) {
            enhancePermissionsTable();
            obs.disconnect(); // Stop observing once the table is found and enhanced
        }
    });

    function enhancePermissionsTable() {
        const tableContainer = document.querySelector('h3 + .col-md-6');
        const table = tableContainer.querySelector('.table-bordered');

        if (!tableContainer || !table) return;
        
        if (document.getElementById('permissions-filter-container')) {
            return; // Already enhanced
        }

        const filterContainer = document.createElement('div');
        filterContainer.id = 'permissions-filter-container';
        filterContainer.className = 'form-inline';
        filterContainer.style.marginBottom = '10px';

        const profileFilter = document.createElement('input');
        profileFilter.type = 'text';
        profileFilter.placeholder = 'Filtruj profil...';
        profileFilter.className = 'form-control input-sm';
        profileFilter.style.marginRight = '5px';

        const typeFilter = document.createElement('input');
        typeFilter.type = 'text';
        typeFilter.placeholder = 'Filtruj typ...';
        typeFilter.className = 'form-control input-sm';
        typeFilter.style.marginRight = '5px';

        const phaseFilter = document.createElement('input');
        phaseFilter.type = 'text';
        phaseFilter.placeholder = 'Filtruj fazę...';
        phaseFilter.className = 'form-control input-sm';

        filterContainer.appendChild(profileFilter);
        filterContainer.appendChild(typeFilter);
        filterContainer.appendChild(phaseFilter);

        tableContainer.insertBefore(filterContainer, table);

        function groupAndFilterPermissions() {
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));

            const groupedByProfile = {};
            rows.forEach(row => {
                const profileCell = row.cells[0];
                if (profileCell) {
                    const profileName = profileCell.innerText.trim();
                    if (!groupedByProfile[profileName]) {
                        groupedByProfile[profileName] = [];
                    }
                    groupedByProfile[profileName].push(row);
                }
            });

            tbody.innerHTML = '';

            Object.keys(groupedByProfile).sort().forEach(profileName => {
                const groupHeader = document.createElement('tr');
                groupHeader.className = 'profile-group-header';
                groupHeader.innerHTML = `<td colspan="4" style="background-color: #f2f2f2; font-weight: bold; cursor: pointer;">${profileName}</td>`;

                let isVisible = true;
                groupHeader.addEventListener('click', () => {
                    isVisible = !isVisible;
                    const childRows = groupedByProfile[profileName];
                    childRows.forEach(row => {
                        // Only toggle visibility if the row is not hidden by the filter
                        if (row.style.display !== 'none' || isVisible) {
                             row.style.display = isVisible ? '' : 'none';
                        }
                    });
                });

                tbody.appendChild(groupHeader);
                groupedByProfile[profileName].forEach(row => tbody.appendChild(row));
            });

            filterPermissions();
        }

        function filterPermissions() {
            const profileValue = profileFilter.value.toLowerCase().trim();
            const typeValue = typeFilter.value.toLowerCase().trim();
            const phaseValue = phaseFilter.value.toLowerCase().trim();

            const rows = table.querySelectorAll('tbody tr:not(.profile-group-header)');
            const groupHeaders = table.querySelectorAll('tbody tr.profile-group-header');
            const visibleGroups = new Set();

            rows.forEach(row => {
                const profileCell = row.cells[0];
                const typeCell = row.cells[1];
                const phaseCell = row.cells[2];

                if (profileCell && typeCell && phaseCell) {
                    const profileText = profileCell.innerText.toLowerCase();
                    const typeText = typeCell.innerText.toLowerCase();
                    const phaseText = phaseCell.innerText.toLowerCase();

                    const profileMatch = profileText.includes(profileValue);
                    const typeMatch = typeText.includes(typeValue);
                    const phaseMatch = phaseText.includes(phaseValue);

                    if (profileMatch && typeMatch && phaseMatch) {
                        row.style.display = '';
                        visibleGroups.add(profileText);
                    } else {
                        row.style.display = 'none';
                    }
                }
            });

            groupHeaders.forEach(header => {
                const headerText = header.querySelector('td').innerText.toLowerCase().trim();
                header.style.display = visibleGroups.has(headerText) ? '' : 'none';
            });
        }

        profileFilter.addEventListener('input', filterPermissions);
        typeFilter.addEventListener('input', filterPermissions);
        phaseFilter.addEventListener('input', filterPermissions);
        
        // Directly apply the enhanced view
        groupAndFilterPermissions();

        console.log("Permissions table enhanced with filters and grouping.");
    }

    // Since the content might be loaded dynamically, observe the body for changes.
    initObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}