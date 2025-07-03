// content.js
console.log("content.js script injected and running. v5 - Specific Modal");

const defaultFeatureSettings = {
    commissionPage: true,
    credentialsPage: true,
    editPage: true
};

function runWithSettings(callback) {
    chrome.storage.local.get({ featureSettings: defaultFeatureSettings }, (data) => {
        callback(data.featureSettings);
    });
}

function checkForSpecificModal() {
  const dialogs = document.querySelectorAll('[role="dialog"]');

  dialogs.forEach((dialog) => {
    const modalTitle = dialog.querySelector('.modal-title');
    if (modalTitle) {
        const titleText = modalTitle.textContent.trim();
        if (titleText === 'Nowy montaż') {
          console.log('SUCCESS: Detected "Nowy montaż" modal! Halting observer.');
          console.log('Modal Element:', dialog);
          chrome.runtime.sendMessage({ modalFound: true, title: 'Nowy montaż' });
          observer.disconnect(); // Stop observing after the modal is found.
        } else if (titleText === 'Nowa wysyłka') {
            console.log('SUCCESS: Detected "Nowa wysyłka" modal! Fetching SharePoint data.');
            chrome.runtime.sendMessage({ action: 'fetch_sharepoint_data' }, (response) => {
                if (response.success) {
                    console.log('SharePoint List Data:', response.data);
                } else {
                    console.error('Failed to fetch SharePoint data:', response.error);
                    alert(`Error fetching SharePoint data: ${response.error}`);
                }
            });
            observer.disconnect(); // Stop observing after the modal is found and data is requested.
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

// Also check if a modal is already present on page load.
console.log("Running initial check for specific modal.");
checkForSpecificModal();

// --- Logic for adding attribute IDs to labels on commission show page ---

let fetchWithAuth;

// Only run this logic on the commission show page
runWithSettings(settings => {
    if (settings.commissionPage && window.location.href.includes('https://serwis.stb.tech/commission/show/commission_id/')) {
        console.log("Commission page detected. Checking user status.");

        // Promisify chrome.storage.local.get to use with async/await
        const getFromStorage = (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve));

        // First, check if the user is a superuser
        getFromStorage(['user']).then(storageData => {
            if (storageData.user && storageData.user.isSuperUser) {
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
            const { token, api_url } = await getFromStorage(['token', 'api_url']);
            if (!token || !api_url) {
                console.error('Authentication token or API URL not found.');
                return Promise.reject('No auth token or API URL');
            }

            const headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            return fetch(api_url + url, { ...options, headers });
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
});


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
runWithSettings(settings => {
    if (settings.credentialsPage && window.location.href.includes('https://serwis.stb.tech/commissionAttribute/addAttributeCredentials/commission_attribute_id/')) {
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
});

runWithSettings(settings => {
    if (settings.editPage && window.location.href.includes('https://serwis.stb.tech/commissionAttribute/edit/commission_attribute_id/')) {
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
});