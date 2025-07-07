// Logic for SharePoint integration

// Flag to prevent multiple enhancements of the same modal instance.
let isModalEnhanced = false;

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
            <p style="margin: 0 0 3px 0; font-size: 0.9em;"><strong>Firma:</strong> ${serialNumber || '-'}</span>
            <p style="margin: 0 0 3px 0; font-size: 0.9em;"><strong>Producent:</strong> ${producent || '-'}</span>
            <p style="margin: 0 0 3px 0; font-size: 0.9em;"><strong>Model:</strong> ${model || '-'}</span>
            <p style="margin: 0 0 3px 0; font-size: 0.9em;"><strong>Status:</strong> ${fields.Status || '-'}</span>
            <p style="margin: 0; font-size: 0.9em;"><strong>Produkt:</strong> ${fields.Produkt || '-'}</span>
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

export function initializeSharePointIntegration() {
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
}
