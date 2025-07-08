// Logic for SharePoint integration

// Flag to prevent multiple enhancements of the same modal instance.
let isModalEnhanced = false;
let accessToken = null;

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

        // Dispatch an event to be caught by the main content script (main.js)
        // which has access to chrome.storage and chrome.runtime.
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

// Main initialization function for all SharePoint integrations
export function initializeSharePointIntegration() {
    console.log("Initializing SharePoint integrations...");

    // Set up a single observer to handle both modals for efficiency.
    const observer = new MutationObserver((mutations, obs) => {
        // Use a unified approach to find modals
        const dialogs = document.querySelectorAll('[role="dialog"]');

        dialogs.forEach(dialog => {
            const modalTitleEl = dialog.querySelector('.modal-title');
            if (!modalTitleEl) return;

            const titleText = modalTitleEl.textContent.trim();

            // 1. Check for the legacy "Nowa wysyłka" modal
            if (titleText === 'Nowa wysyłka') {
                // The existing function already has a guard to prevent multiple enhancements.
                checkForSpecificModal();
            }
            // 2. Check for the new "Nowe zamówienie CLV" modal
            else if (titleText === 'Nowe zamówienie CLV') {
                const modalBody = dialog.querySelector('.modal-body .bootbox-body');

                // Use a unique ID for the CLV search container to avoid conflicts
                if (modalBody && !modalBody.querySelector('#sharepoint-search-container-clv')) {
                    console.log("'Nowe zamówienie CLV' modal detected. Injecting SharePoint search UI.");

                    const searchContainer = document.createElement('div');
                    searchContainer.id = 'sharepoint-search-container-clv'; // Unique ID
                    searchContainer.style.marginTop = '20px';
                    searchContainer.style.borderTop = '1px solid #eee';
                    searchContainer.style.paddingTop = '20px';

                    // Use Bootstrap-style classes for better visual integration
                    searchContainer.innerHTML = `
                        <div class="form-group">
                            <label for="sp-search-input-clv">Wyszukaj w SharePoint</label>
                            <div class="input-group">
                                <input id="sp-search-input-clv" class="form-control" placeholder="Wpisz numer zamówienia...">
                                <span class="input-group-btn">
                                    <button id="sp-search-button-clv" class="btn btn-primary">Szukaj</button>
                                </span>
                            </div>
                        </div>
                        <div id="sp-search-results-clv" style="margin-top: 10px;"></div>
                    `;

                    modalBody.appendChild(searchContainer);

                    const searchButton = modalBody.querySelector('#sp-search-button-clv');
                    const searchInput = modalBody.querySelector('#sp-search-input-clv');
                    const resultsDiv = modalBody.querySelector('#sp-search-results-clv');

                    const performSearch = () => {
                        const query = searchInput.value.trim();
                        if (!query) {
                            resultsDiv.innerHTML = '<p style="color: orange;">Wpisz numer zamówienia do wyszukania.</p>';
                            return;
                        }

                        resultsDiv.innerHTML = '<p>Szukanie...</p>';

                        chrome.storage.sync.get(['selectedSharePointListClv', 'sharepointClvOrderColumn', 'sharepointSitePathClv'], (settings) => {
                            const { selectedSharePointListClv, sharepointClvOrderColumn, sharepointSitePathClv } = settings;

                            if (!selectedSharePointListClv || !sharepointClvOrderColumn) {
                                resultsDiv.innerHTML = '<p style="color: red;">Skonfiguruj listę SharePoint i nazwę kolumny dla zamówień CLV w ustawieniach wtyczki.</p>';
                                return;
                            }

                            if (!sharepointSitePathClv) {
                                resultsDiv.innerHTML = '<p style="color: red;">Skonfiguruj ścieżkę witryny SharePoint dla zamówień CLV w ustawieniach wtyczki.</p>';
                                return;
                            }

                            chrome.runtime.sendMessage({
                                action: 'search_sharepoint_by_field',
                                params: {
                                    listId: selectedSharePointListClv,
                                    fieldName: sharepointClvOrderColumn,
                                    query: query,
                                    sitePath: sharepointSitePathClv // Pass the site path
                                }
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.error('Error sending message:', chrome.runtime.lastError);
                                    resultsDiv.innerHTML = `<p style="color: red;">Błąd komunikacji z wtyczką: ${chrome.runtime.lastError.message}</p>`;
                                    return;
                                }

                                if (response.success) {
                                    displayClvSharePointResults(response.data, resultsDiv, modalBody);
                                } else {
                                    resultsDiv.innerHTML = `<p style="color: red;">Błąd wyszukiwania: ${response.error}</p>`;
                                }
                            });
                        });
                    };

                    searchButton.addEventListener('click', performSearch);
                    searchInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            performSearch();
                        }
                    });
                }
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Function to display CLV SharePoint results
function displayClvSharePointResults(items, resultsContainer, modal) {
    resultsContainer.innerHTML = ''; // Clear previous results

    if (!items || items.length === 0) {
        resultsContainer.innerHTML = '<p>Brak wyników.</p>';
        return;
    }

    const list = document.createElement('ul');
    list.style.listStyleType = 'none';
    list.style.padding = '0';
    list.style.maxHeight = '200px';
    list.style.overflowY = 'auto';


    items.forEach(item => {
        const fields = item.fields;
        const orderNumber = fields.Nrzam_x00f3_wienia || 'Brak numeru'; // Assuming order number is in 'Title'
        const companyName = fields.Firma || 'Brak firmy';
        const offerNumber = fields.Numeroferty || 'Brak numeru oferty';
        const realizationDate = fields.Terminrealizacji || 'Brak terminu realizacji';
        const orderDate = fields.Datazam_x00f3_wienia || '';
        const endClient = fields.Klientko_x0144_cowy || 'Klient końcowy'; // Assuming this is the end client field
        const customer = fields.Zamawiaj_x0105_cy0 || 'Brak zamawiającego'; // Assuming this is the customer field
        // handlowiec
        const salesRepresentative = fields.Handlowiec || 'Brak handlowca'; // Assuming this is the sales representative field
        const dt = fields.DT || 'Brak DT'; // Assuming this is the DT field
        // uwagi
        const articleName = fields.Nazwa || 'Brak nazwy artykułu';
        // ilosc
        const quantity = fields.Zamawiaj_x0105_cy || 'Brak ilości';
        // Wartosc
        const value = fields.Warto_x015b__x0107_systemu || 'Brak wartości';
        const systemPrice = fields.Cenasprzeda_x017c_y || 'Brak ceny sprzedaży';
        // adres dostawy
        const deliveryAddress = fields.Adresdostawy || 'Brak adresu dostawy';
        const deliveryDate = fields.Datawysy_x0142_ki0 || '';
        // przewoznik
        const carrier = fields.Formatransportu || 'Brak przewoźnika';
        const comments = fields.Uwagi || 'Brak uwag';
        const vat = fields.FakturaVAT || 'Brak Faktury VAT';


        const listItem = document.createElement('li');
        listItem.style.padding = '8px';
        listItem.style.border = '1px solid #E2E8F0';
        listItem.style.borderRadius = '4px';
        listItem.style.marginBottom = '5px';
        listItem.style.cursor = 'pointer';

        listItem.innerHTML = `
            <strong>Nr zamówienia:</strong> ${orderNumber}<br>
            <strong>Firma:</strong> ${companyName}<br>
            <strong>Data zamówienia:</strong> ${orderDate}<br>
            <strong>Termin realizacji:</strong> ${realizationDate}<br>
            <strong>Klient końcowy:</strong> ${endClient}<br>
            <strong>Zamawiający:</strong> ${customer}<br>
            <strong>Handlowiec:</strong> ${salesRepresentative}<br>
            <strong>DT:</strong> ${dt}<br>
            <strong>Numer oferty:</strong> ${offerNumber}<br>
            <strong>Nazwa artykułu:</strong> ${articleName}<br>
            <strong>Ilość:</strong> ${quantity}<br>
            <strong>Wartość:</strong> ${value}<br>
            <strong>Cena sprzedaży:</strong> ${systemPrice}<br>
            <strong>Adres dostawy:</strong> ${deliveryAddress}<br>
            <strong>Data wysyłki:</strong> ${deliveryDate}<br>
            <strong>Przewoźnik:</strong> ${carrier}<br>
            <strong>Faktura VAT:</strong> ${vat}<br>
            <strong>Uwagi:</strong> ${comments}<br>
            
            
        `;

        listItem.addEventListener('mouseenter', () => listItem.style.backgroundColor = '#F7FAFC');
        listItem.addEventListener('mouseleave', () => listItem.style.backgroundColor = 'transparent');

        listItem.addEventListener('click', () => {
            // Here you can add logic to auto-fill fields in the modal
            // For example, find the "Nr. zamówienia" input and fill it
            // Nr zamówienia
            const orderNumberInput = modal.querySelector('textarea[id="commission_attributes_476_value"]');
            if (orderNumberInput) {
                orderNumberInput.value = orderNumber;
                orderNumberInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Data zamówienia
            const orderDateInput = modal.querySelector('input[id="commission_attributes_482_value"]');
            if (orderDateInput) {
                orderDateInput.value = orderDate;
                orderDateInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Firma
            const companyNameInput = modal.querySelector('input[id="commission_company_id_autofield"]');
            if (companyNameInput) {
                let companyNameRefactor = companyName.replace('Sp. z o.o.', '').replace('Spółka z ograniczoną odpowiedzialnością', '').trim();
                companyNameInput.value = companyNameRefactor;
                companyNameInput.dispatchEvent(new Event('input', { bubbles: true }));
                companyNameInput.focus(); // Trigger focus to show autocomplete
            }

            // Numer oferty
            const offerNumberInput = modal.querySelector('textarea[id="commission_attributes_477_value"]');
            if (offerNumberInput) {
                offerNumberInput.value = offerNumber;
                offerNumberInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Termin realizacji
            const realizationDateInput = modal.querySelector('textarea[id="commission_attributes_478_value"]');
            if (realizationDateInput) {
                realizationDateInput.value = realizationDate;
                realizationDateInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            

            // Klient końcowy
            const endClientInput = modal.querySelector('textarea[id="commission_attributes_480_value"]');
            if (endClientInput) {
                endClientInput.value = endClient;
                endClientInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Zamawiający
            const customerInput = modal.querySelector('textarea[id="commission_attributes_489_value"]');
            if (customerInput) {
                customerInput.value = customer;
                customerInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Handlowiec
            const salesRepInput = modal.querySelector('textarea[id="commission_attributes_490_value"]');
            if (salesRepInput) {
                salesRepInput.value = salesRepresentative;
                salesRepInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // DT
            const dtInput = modal.querySelector('textarea[id="commission_attributes_491_value"]');
            if (dtInput) {
                dtInput.value = dt;
                dtInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Nazwa artykułu
            const articleNameInput = modal.querySelector('textarea[id="commission_attributes_492_value"]');
            if (articleNameInput) {
                articleNameInput.value = articleName;
                articleNameInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Ilość
            const quantityInput = modal.querySelector('input[id="commission_attributes_493_value"]');
            if (quantityInput) {
                quantityInput.value = quantity;
                quantityInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Wartość
            const valueInput = modal.querySelector('textarea[id="commission_attributes_494_value"]');
            if (valueInput) {
                valueInput.value = value;
                valueInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Cena sprzedaży
            const systemPriceInput = modal.querySelector('textarea[id="commission_attributes_495_value"]');
            if (systemPriceInput) {
                systemPriceInput.value = systemPrice;
                systemPriceInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Adres dostawy
            const deliveryAddressInput = modal.querySelector('textarea[id="commission_attributes_496_value"]');
            if (deliveryAddressInput) {
                deliveryAddressInput.value = deliveryAddress;
                deliveryAddressInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Data wysyłki
            const deliveryDateInput = modal.querySelector('input[id="commission_attributes_497_value"]');
            if (deliveryDateInput) {
                deliveryDateInput.value = deliveryDate;
                deliveryDateInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Przewoźnik
            const carrierInput = modal.querySelector('textarea[id="commission_attributes_498_value"]');
            if (carrierInput) {
                carrierInput.value = carrier;
                carrierInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Faktura VAT
            const vatInput = modal.querySelector('textarea[id="commission_attributes_500_value"]');
            if (vatInput) {
                vatInput.value = vat;
                vatInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Uwagi
            const commentsInput = modal.querySelector('textarea[id="commission_attributes_481_value"]');
            if (commentsInput) {
                commentsInput.value = comments;
                commentsInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            resultsContainer.innerHTML = `<p style="color: green;">Wybrano zamówienie: ${orderNumber}</p>`;
        });

        list.appendChild(listItem);
    });

    resultsContainer.appendChild(list);
}
