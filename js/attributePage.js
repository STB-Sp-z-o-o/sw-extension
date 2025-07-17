// --- Logic for attribute credentials page ---
export function initializeCredentialsPage() {
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
export function initializeEditPage() {
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

// --- Auto-fill and filter checklist on commission detail page ---
function autoFillAndFilterChecklist() {
    // Only run once
    if (window.__checklistAutoFilled) return;
    window.__checklistAutoFilled = true;

    // Check document series and phase
    const docSeriesSpan = document.querySelector('.commission__document-series .select__single-value__label');
    const phaseSpan = document.querySelector('.commission__phase .select__single-value__label');
    if (!docSeriesSpan || !phaseSpan) return;
    const docSeries = docSeriesSpan.textContent.trim();
    const phase = phaseSpan.textContent.trim();
    if (docSeries !== 'Montaż' || phase !== 'Montaż - Kompletacja') return;

    // Get used products and their quantities
    const usedProductsTable = document.querySelector('.used-materials__table');
    if (!usedProductsTable) return;
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
    if (!usedProducts.length) return;

    // Parse recipe table
    const recipeTable = document.querySelector('#attribute-548 table');
    if (!recipeTable) return;
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
        }
    });

    // Filter and fill checklist
    const checklistTable = document.querySelector('#attribute-523 .attribute-checklist__table');
    if (!checklistTable) return;
    checklistTable.querySelectorAll('tbody tr').forEach(tr => {
        const labelCell = tr.querySelector('td.css-1dpfuy6');
        const textarea = tr.querySelector('textarea');
        if (labelCell && textarea) {
            // Extract code from label (e.g. "Monitor 7” FHD (M001)")
            const labelTxt = labelCell.textContent;
            const codeMatch = labelTxt.match(/\(([^)]+)\)/);
            const code = codeMatch ? codeMatch[1].trim() : null;
            if (code && neededComponents[code]) {
                // Fill quantity
                textarea.value = `Ilość: ${neededComponents[code].qty}`;
                tr.style.display = '';
            } else {
                tr.style.display = 'none';
            }
        }
    });

    // Add button to show all checklist items
    const checklistContainer = document.querySelector('#attribute-523');
    if (checklistContainer && !document.getElementById('show-all-checklist-btn')) {
        const btn = document.createElement('button');
        btn.id = 'show-all-checklist-btn';
        btn.textContent = 'Pokaż wszystkie komponenty';
        btn.className = 'btn btn-secondary btn-sm';
        btn.style.marginBottom = '10px';
        btn.onclick = () => {
            checklistTable.querySelectorAll('tbody tr').forEach(tr => {
                tr.style.display = '';
            });
        };
        checklistContainer.insertBefore(btn, checklistTable);
    }
}

// Run on page load (after DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(autoFillAndFilterChecklist, 500); // Delay to allow dynamic content
});
