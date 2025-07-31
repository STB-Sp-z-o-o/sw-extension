// Logic for the commission page

let fetchWithAuth;

// Encapsulate all commission page logic into a single function
export function initializeCommissionPage() {
    // Shared commissionData variable for cross-function access
    let sharedCommissionData = null;
    // --- Checklist filter and auto-fill logic ---
    function filterAndFillChecklist() {
        console.log('[Checklist] filterAndFillChecklist() called');
        console.log('[Checklist] sharedCommissionData in filterAndFillChecklist:', sharedCommissionData);
        // Get used products and their quantities
        const usedProductsTable = document.querySelector('.used-materials__table');
        console.log('[Checklist] .used-materials__table:', usedProductsTable);
        if (!usedProductsTable) {
            console.log('[Checklist] Used products table not found.');
            return;
        }
        const usedProducts = [];
        usedProductsTable.querySelectorAll('tbody tr').forEach(tr => {
            const nameCell = tr.cells[0];
            const qtyCell = tr.cells[1];
            if (nameCell && qtyCell) {
                // Extract product name and code from text (e.g. "CLV-Guard-2CAM (CLV-GUARD-2CAM)")
                const txt = nameCell.textContent.trim();
                const match = txt.match(/(.+?)\s*\(([^)]+)\)/);
                if (match) {
                    usedProducts.push({
                        name: match[1].trim(),
                        code: match[2].trim(),
                        qty: parseInt(qtyCell.textContent.replace(/\D/g, ''), 10) || 1
                    });
                }
            }
        });
        console.log('[Checklist] Used products:', usedProducts);
        if (!usedProducts.length) {
            console.log('[Checklist] No used products found.');
            return;
        }

        // Parse recipe table
        const recipeTable = document.querySelector('#attribute-548 table');
        console.log('[Checklist] #attribute-548 table:', recipeTable);
        if (!recipeTable) {
            console.log('[Checklist] Recipe table not found.');
            return;
        }
        // Map: product code -> [{name, code, qty}]
        const recipeMap = {};
        let currentSet = null;
        recipeTable.querySelectorAll('tbody tr').forEach(tr => {
            if (tr.children.length === 1) {
                // Set header row
                currentSet = tr.textContent.trim();
            } else if (tr.children.length === 4 && currentSet) {
                const prodName = tr.children[1].textContent.trim();
                const prodCode = tr.children[2].textContent.trim();
                const prodQty = parseInt(tr.children[3].textContent.replace(/\D/g, ''), 10) || 1;
                if (!recipeMap[currentSet]) recipeMap[currentSet] = [];
                recipeMap[currentSet].push({ name: prodName, code: prodCode, qty: prodQty });
            }
        });
        console.log('[Checklist] Recipe map:', recipeMap);

        // Calculate needed components
        const neededComponents = {};
        usedProducts.forEach(prod => {
            const set = recipeMap[prod.name] || recipeMap[prod.code];
            if (set) {
                set.forEach(comp => {
                    if (!neededComponents[comp.code]) {
                        neededComponents[comp.code] = { name: comp.name, code: comp.code, qty: 0 };
                    }
                    neededComponents[comp.code].qty += comp.qty * prod.qty;
                });
            } else {
                console.log(`[Checklist] No recipe set found for product:`, prod);
            }
        });
        console.log('[Checklist] Needed components:', neededComponents);

        // Filter and fill all checklists (523, 549, 565, ...)
        const checklistIds = [523, 549, 565, 592];
        checklistIds.forEach(attrId => {
            const checklistTable = document.querySelector(`#attribute-${attrId} .attribute-checklist__table`);
            console.log(`[Checklist] #attribute-${attrId} .attribute-checklist__table:`, checklistTable);
            if (!checklistTable) {
                console.log(`[Checklist] Checklist table for ${attrId} not found.`);
                return;
            }
            checklistTable.querySelectorAll('tbody tr').forEach(tr => {
                const labelCell = tr.querySelector('td.css-1dpfuy6');
                const textarea = tr.querySelector('textarea');
                if (labelCell && textarea) {
                    // Extract code from label (e.g. "Monitor 7” FHD (M001)")
                    const labelTxt = labelCell.textContent;
                    const codeMatch = labelTxt.match(/\(([^)]+)\)/);
                    const code = codeMatch ? codeMatch[1].trim() : null;
                    if (code && neededComponents[code]) {
                        tr.style.display = '';
                        // Optionally fill textarea only if empty (for initial sync)
                        // if (textarea.value.trim() === '') textarea.value = `Ilość: ${neededComponents[code].qty}`;
                        console.log(`[Checklist] Showing and filling row for code: ${code}, qty: ${neededComponents[code].qty}`);
                    } else {
                        tr.style.display = 'none';
                        console.log(`[Checklist] Hiding row for code: ${code}`);
                    }
                }
            });
        });

        // Show and always update needed components in the attribute div (#attribute-523)
        const attributeDiv = document.getElementById('attribute-523');
        if (attributeDiv) {
            let componentsDiv = document.getElementById('needed-components-list');
            if (!componentsDiv) {
                componentsDiv = document.createElement('div');
                componentsDiv.id = 'needed-components-list';
                componentsDiv.style.marginTop = '10px';
                componentsDiv.style.background = '#e3f2fd';
                componentsDiv.style.borderRadius = '8px';
                componentsDiv.style.padding = '16px 18px';
                componentsDiv.style.border = '1.5px solid #90caf9';
                componentsDiv.style.marginBottom = '10px';
                attributeDiv.prepend(componentsDiv);
            }
            // Collect recipe sets used
            const usedRecipeSets = [];
            usedProducts.forEach(prod => {
                if (recipeMap[prod.name]) usedRecipeSets.push(prod.name);
                else if (recipeMap[prod.code]) usedRecipeSets.push(prod.code);
            });
            // Always update the contents
            let html = '<div style="font-weight:600; color:#1976d2; font-size:1.08em; margin-bottom:10px;">Filtrowanie komponentów na podstawie użytych produktów</div>';
            html += '<div style="margin-bottom:8px; color:#1976d2; font-size:0.98em;">Wykorzystane receptury: <span style="font-weight:bold;">' + (usedRecipeSets.length ? usedRecipeSets.join(', ') : 'Brak') + '</span></div>';
            html += '<ul style="list-style:none; padding-left:0; margin-bottom:10px;">';
            Object.values(neededComponents).forEach(comp => {
                html += `<li style='margin-bottom:4px;'><span style='font-weight:bold;'>${comp.name} (${comp.code})</span> – Ilość: <span style='font-weight:bold;'>${comp.qty}</span></li>`;
            });
            html += '</ul>';
            componentsDiv.innerHTML = html;

            // Toggle logic for the button
            let btn = document.getElementById('show-all-checklist-btn');
            if (!btn) {
                btn = document.createElement('button');
                btn.id = 'show-all-checklist-btn';
                btn.textContent = 'Pokaż wszystkie komponenty';
                btn.className = 'btn btn-secondary btn-sm';
                btn.style.marginTop = '10px';
                btn.dataset.showingAll = 'false';
                btn.onclick = () => {
                    const showingAll = btn.dataset.showingAll === 'true';
                    if (!showingAll) {
                        checklistTable.querySelectorAll('tbody tr').forEach(tr => {
                            tr.style.display = '';
                        });
                        btn.textContent = 'Pokaż tylko wymagane komponenty';
                        btn.dataset.showingAll = 'true';
                    } else {
                        checklistTable.querySelectorAll('tbody tr').forEach(tr => {
                            const labelCell = tr.querySelector('td.css-1dpfuy6');
                            const textarea = tr.querySelector('textarea');
                            let code = null;
                            if (labelCell) {
                                const labelTxt = labelCell.textContent;
                                const codeMatch = labelTxt.match(/\(([^)]+)\)/);
                                code = codeMatch ? codeMatch[1].trim() : null;
                            }
                            if (code && neededComponents[code]) {
                                tr.style.display = '';
                            } else {
                                tr.style.display = 'none';
                            }
                        });
                        btn.textContent = 'Pokaż wszystkie komponenty';
                        btn.dataset.showingAll = 'false';
                    }
                };
            }
            // Remove button if already present elsewhere
            if (btn.parentNode && btn.parentNode !== componentsDiv) {
                btn.parentNode.removeChild(btn);
            }
            componentsDiv.appendChild(btn);

            // Add 'Załaduj ilość' button
            let loadBtn = document.getElementById('load-qty-btn');
            if (!loadBtn) {
                loadBtn = document.createElement('button');
                loadBtn.id = 'load-qty-btn';
                loadBtn.textContent = 'Załaduj ilość';
                loadBtn.className = 'btn btn-primary btn-sm';
                loadBtn.style.marginLeft = '10px';
                loadBtn.onclick = () => {
                    // For each checklist, prepare rows and synchronize comments
                    const checklistIds = [523, 549, 565, 592];
                    let allChecklistRows = {};
                    checklistIds.forEach(attrId => {
                        const checklistTable = document.querySelector(`#attribute-${attrId} .attribute-checklist__table`);
                        if (!checklistTable) return;
                        checklistTable.querySelectorAll('tbody tr').forEach(tr => {
                            const labelCell = tr.querySelector('td.css-1dpfuy6');
                            const textarea = tr.querySelector('textarea');
                            let code = null;
                            let name = null;
                            if (labelCell) {
                                const labelTxt = labelCell.textContent;
                                const codeMatch = labelTxt.match(/\(([^)]+)\)/);
                                code = codeMatch ? codeMatch[1].trim() : null;
                                name = labelTxt.split('(')[0].trim();
                            }
                            if (code) {
                                if (!allChecklistRows[code]) allChecklistRows[code] = [];
                                allChecklistRows[code].push({
                                    attrId,
                                    tr,
                                    textarea,
                                    name,
                                    qty: neededComponents[code] ? neededComponents[code].qty : '',
                                    needed: !!neededComponents[code]
                                });
                            }
                        });
                    });
                    // Synchronize comments: if any textarea for a code is filled, use that comment for all checklists in PATCH payload only (do not fill textarea in DOM)
                    let codeQtyMap = {};
                    Object.entries(allChecklistRows).forEach(([code, rows]) => {
                        let filledComment = null;
                        rows.forEach(row => {
                            if (row.textarea && row.textarea.value.trim() !== '') {
                                filledComment = row.textarea.value.trim();
                            }
                        });
                        if (filledComment !== null) {
                            codeQtyMap[code] = filledComment;
                        }
                    });
                    // Prepare PATCH payload for each checklist
                    let attributesPayload = [];
                    checklistIds.forEach(attrId => {
                        // Get attribute value ids from sharedCommissionData
                        let attributeValueMap = {};
                        if (sharedCommissionData && sharedCommissionData.data && sharedCommissionData.data.attributes) {
                            const attrObj = sharedCommissionData.data.attributes.find(attr => attr.id === attrId);
                            if (attrObj && Array.isArray(attrObj.value)) {
                                attrObj.value.forEach(val => {
                                    if (val.value) {
                                        const codeMatch = val.value.match(/\(([^)]+)\)/);
                                        if (codeMatch) {
                                            const code = codeMatch[1].trim();
                                            attributeValueMap[code] = val.id;
                                        }
                                    }
                                });
                            }
                        }
                        // Prepare rows for PATCH
                        const checklistTable = document.querySelector(`#attribute-${attrId} .attribute-checklist__table`);
                        if (!checklistTable) return;
                        const rows = [];
                        checklistTable.querySelectorAll('tbody tr').forEach(tr => {
                            const labelCell = tr.querySelector('td.css-1dpfuy6');
                            let code = null;
                            if (labelCell) {
                                const labelTxt = labelCell.textContent;
                                const codeMatch = labelTxt.match(/\(([^)]+)\)/);
                                code = codeMatch ? codeMatch[1].trim() : null;
                            }
                            // Zawsze nadpisuj komentarz ilością wyliczoną
                            if (code && neededComponents[code]) {
                                let comment = `Ilość: ${neededComponents[code].qty}`;
                                rows.push({
                                    id: attributeValueMap[code] !== undefined ? attributeValueMap[code] : null,
                                    comment,
                                    selected: true
                                });
                            }
                        });
                        attributesPayload.push({
                            id: attrId,
                            value: rows
                        });
                    });
                    const payload = {
                        fields: "id",
                        extra_fields: attributesPayload.map(a => `attributes.${a.id}`).join(','),
                        setting: { mode_relations_add: 1 },
                        data: {
                            attributes: attributesPayload
                        }
                    };
                    console.log('[Załaduj ilość] Prepared API payload:', payload);

                    // Send PATCH request to API
                    const commissionId = sharedCommissionData?.data?.id;
                    if (!commissionId) {
                        console.error('Brak commissionId, nie można wysłać PATCH.');
                        return;
                    }
                    const patchUrl = `/api/commissions/${commissionId}`;
                    fetchWithAuth(patchUrl, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    })
                    .then(async res => {
                        const result = await res.json().catch(() => null);
                        console.log('[Załaduj ilość] PATCH response:', res.status, result);
                        // Refresh page after successful PATCH
                        location.reload();
                    })
                    .catch(err => {
                        console.error('[Załaduj ilość] PATCH error:', err);
                    });
                };
            }
            if (loadBtn.parentNode && loadBtn.parentNode !== componentsDiv) {
                loadBtn.parentNode.removeChild(loadBtn);
            }
            componentsDiv.appendChild(loadBtn);

        // Dodaj przycisk 'Synchronizuj'
        let syncBtn = document.getElementById('sync-comments-btn');
        if (!syncBtn) { 
            syncBtn = document.createElement('button');
            syncBtn.id = 'sync-comments-btn';
            syncBtn.textContent = 'Synchronizuj uwagi';
            syncBtn.className = 'btn btn-warning btn-sm';
            syncBtn.style.marginLeft = '10px';
            syncBtn.onclick = () => {
                // Zbierz komentarze z głównej listy (523)
                const mainChecklistId = 523;
                const checklistIds = [523, 549, 565, 592];
                const mainChecklistTable = document.querySelector(`#attribute-${mainChecklistId} .attribute-checklist__table`);
                if (!mainChecklistTable) return;
                // Mapowanie: code -> comment (tylko wypełnione textarea)
                let codeCommentMap = {};
                mainChecklistTable.querySelectorAll('tbody tr').forEach(tr => {
                    const labelCell = tr.querySelector('td.css-1dpfuy6');
                    const textarea = tr.querySelector('textarea');
                    let code = null;
                    if (labelCell) {
                        const labelTxt = labelCell.textContent;
                        const codeMatch = labelTxt.match(/\(([^)]+)\)/);
                        code = codeMatch ? codeMatch[1].trim() : null;
                    }
                    if (code && textarea && textarea.value.trim() !== '') {
                        codeCommentMap[code] = textarea.value.trim();
                    }
                });

                // Przygotuj PATCH payload dla wszystkich checklist
                let attributesPayload = [];
                checklistIds.forEach(attrId => {
                    // Pobierz mapę id wartości atrybutów z sharedCommissionData
                    let attributeValueMap = {};
                    if (sharedCommissionData && sharedCommissionData.data && sharedCommissionData.data.attributes) {
                        const attrObj = sharedCommissionData.data.attributes.find(attr => attr.id === attrId);
                        if (attrObj && Array.isArray(attrObj.value)) {
                            attrObj.value.forEach(val => {
                                if (val.value) {
                                    const codeMatch = val.value.match(/\(([^)]+)\)/);
                                    if (codeMatch) {
                                        const code = codeMatch[1].trim();
                                        attributeValueMap[code] = val.id;
                                    }
                                }
                            });
                        }
                    }
                    // Przygotuj wiersze do PATCH tylko dla kodów z codeCommentMap
                    const checklistTable = document.querySelector(`#attribute-${attrId} .attribute-checklist__table`);
                    if (!checklistTable) return;
                    const rows = [];
                    checklistTable.querySelectorAll('tbody tr').forEach(tr => {
                        const labelCell = tr.querySelector('td.css-1dpfuy6');
                        let code = null;
                        if (labelCell) {
                            const labelTxt = labelCell.textContent;
                            const codeMatch = labelTxt.match(/\(([^)]+)\)/);
                            code = codeMatch ? codeMatch[1].trim() : null;
                        }
                        if (code && codeCommentMap[code]) {
                            rows.push({
                                id: attributeValueMap[code] !== undefined ? attributeValueMap[code] : null,
                                comment: codeCommentMap[code],
                                selected: true
                            });
                        }
                    });
                    attributesPayload.push({
                        id: attrId,
                        value: rows
                    });
                });
                const payload = {
                    fields: "id",
                    extra_fields: attributesPayload.map(a => `attributes.${a.id}`).join(','),
                    setting: { mode_relations_add: 1 },
                    data: {
                        attributes: attributesPayload
                    }
                };
                console.log('[Synchronizuj uwagi] Prepared API payload:', payload);

                // Wyślij PATCH do API
                const commissionId = sharedCommissionData?.data?.id;
                if (!commissionId) {
                    console.error('Brak commissionId, nie można wysłać PATCH.');
                    return;
                }
                const patchUrl = `/api/commissions/${commissionId}`;
                fetchWithAuth(patchUrl, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })
                .then(async res => {
                    const result = await res.json().catch(() => null);
                    console.log('[Synchronizuj uwagi] PATCH response:', res.status, result);
                    location.reload(); // Odśwież stronę po synchronizacji jeśli chcesz
                })
                .catch(err => {
                    console.error('[Synchronizuj uwagi] PATCH error:', err);
                });
            };
        }
        if (syncBtn.parentNode && syncBtn.parentNode !== componentsDiv) {
            syncBtn.parentNode.removeChild(syncBtn);
        }
        componentsDiv.appendChild(syncBtn);
        }
    }

    // Use a global observer for React-driven DOM
    function observeChecklistTableGlobally() {
        const checklistTableSelector = '#attribute-523 .attribute-checklist__table';
        const observer = new MutationObserver((mutations, obs) => {
            const checklistTable = document.querySelector(checklistTableSelector);
            const usedProductsTable = document.querySelector('.used-materials__table');
            const recipeTable = document.querySelector('#attribute-548 table');
            if (checklistTable && usedProductsTable && recipeTable) {
                console.log('[Checklist] Global observer: All required tables found, running filterAndFillChecklist');
                filterAndFillChecklist();
                obs.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Run global observer immediately and on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Checklist] DOMContentLoaded event fired, scheduling observeChecklistTableGlobally');
        observeChecklistTableGlobally();
    });
    observeChecklistTableGlobally();
    console.log("Commission page detected. Checking user status.");

    // Promisify chrome.storage.get for sync and local storage
    const getFromSyncStorage = (keys) => new Promise(resolve => chrome.storage.sync.get(keys, resolve));
    const getFromLocalStorage = (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve));

    // First, check if the user is a superuser (from local storage)
    getFromLocalStorage(['extension_user']).then(storageData => {
        if (storageData.extension_user && storageData.extension_user.user && storageData.extension_user.user.isSuperUser) {
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
        const { extension_auth_token, extension_settings } = await getFromSyncStorage(['extension_auth_token', 'extension_settings']);

        if (!extension_auth_token || !extension_settings || !extension_settings.apiUrl) {
            console.error('Authentication token or API URL not found in sync storage.');
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
            console.log('Commission data received from API:', commissionData);
            sharedCommissionData = commissionData;
            // Call checklist logic again after commissionData is loaded
            filterAndFillChecklist();

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
            console.log('Constructed attribute priorities map:', attributePriorities);

            // Poll for the attributes container to exist before proceeding.
            const checkInterval = setInterval(() => {
                const attributesContainer = document.querySelector('.lazyload-wrapper');
                if (attributesContainer) {
                    console.log('Attributes container found. Initializing label display and observer.');
                    // Stop polling once the container is found.
                    clearInterval(checkInterval);

                    // Run once on load with the fetched priorities
                    addAttributeIdsToLabels(attributePriorities);

                    // Set up a more targeted observer for dynamic changes within the container
                    const attributeObserver = new MutationObserver(() => {
                        addAttributeIdsToLabels(attributePriorities);
                    });

                    attributeObserver.observe(attributesContainer, {
                        childList: true,
                        subtree: true
                    });
                }
            }, 500); // Check every 500 milliseconds

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
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}
function addAttributeIdsToLabels(attributePriorities) {
    console.log('Running addAttributeIdsToLabels...');
    const attributesContainer = document.querySelector('.lazyload-wrapper');
    if (!attributesContainer) {
        console.log('Attribute container not found. Aborting.');
        return;
    }

    const attributeDivs = attributesContainer.querySelectorAll('div[id^="attribute-"]');
    console.log(`Found ${attributeDivs.length} attribute divs.`);

    attributeDivs.forEach(div => {
        const id = div.id.replace('attribute-', '');
        // Expanded selector to find labels for regular attributes and file attributes.
        const label = div.querySelector('label.chakra-form__label, .attribute-file h4.chakra-heading');

        if (label) {
            // Check if the ID span already exists to prevent duplicates.
            if (label.querySelector(`.attribute-id-display[data-id='${id}']`)) {
                return; 
            }

            const priority = attributePriorities[id];
            const priorityText = priority !== undefined ? ` (Priority: ${priority})` : '';
            const idText = ` (ID: ${id}${priorityText})`;

            const idSpan = document.createElement('span');
            idSpan.textContent = idText;
            idSpan.className = 'attribute-id-display';
            idSpan.dataset.id = id;
            idSpan.style.marginLeft = '8px';
            idSpan.style.fontWeight = 'bold';
            idSpan.style.fontSize = '0.9em';
            idSpan.style.color = '#2D3748';

            const editBtn = document.createElement('a');
            editBtn.href = `https://serwis.stb.tech/commissionAttribute/edit/commission_attribute_id/${id}`;
            editBtn.target = '_blank';
            editBtn.textContent = 'Edytuj';
            editBtn.className = 'edit-attribute-btn'; // Add a class for potential selection
            editBtn.dataset.id = id;
            editBtn.style.marginLeft = '8px';
            editBtn.style.padding = '2px 8px';
            editBtn.style.fontSize = '0.8em';
            editBtn.style.color = 'white';
            editBtn.style.backgroundColor = '#6c757d'; // A secondary/gray color
            editBtn.style.border = 'none';
            editBtn.style.borderRadius = '4px';
            editBtn.style.textDecoration = 'none';

            // For labels, append to the .chakra-text span if it exists.
            const textSpan = label.querySelector('.chakra-text');
            if (label.tagName === 'LABEL' && textSpan) {
                console.log(`Appending ID ${id} to .chakra-text in`, label);
                textSpan.appendChild(idSpan);
                textSpan.appendChild(editBtn);
            } else {
                // For H4s or labels without a specific inner span, append directly.
                console.log(`Appending ID ${id} directly to`, label);
                label.appendChild(idSpan);
                label.appendChild(editBtn);
            }
        } else {
            console.log(`Could not find a label or heading for attribute div with id: ${div.id}`);
        }
    });
}

//# sourceMappingURL=commissionPage.js.map
console.log('[Checklist] commissionPage.js loaded');

// Ensure commission page logic runs
initializeCommissionPage();
