document.addEventListener('DOMContentLoaded', () => {
    // Main views
    const initialSetupView = document.getElementById('initial-setup-view');
    const loginView = document.getElementById('login-view');
    const mainContainer = document.getElementById('main-container');

    // Buttons for core auth
    const saveSettingsButton = document.getElementById('save_settings');
    const loginButton = document.getElementById('login_button');
    const logoutButton = document.getElementById('logout_button');

    // Tab elements
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Buttons
    const saveFeatureSettingsButton = document.getElementById('save-feature-settings');
    const ms365LoginButton = document.getElementById('ms365-login-button');
    const ms365LogoutButton = document.getElementById('ms365-logout-button');
    // The save button is no longer needed, selection is saved on change.
    // const saveSharePointListButton = document.getElementById('save-sharepoint-list');

    // --- View Management ---
    function showView(viewToShow) {
        [initialSetupView, loginView, mainContainer].forEach(view => {
            view.style.display = view === viewToShow ? 'block' : 'none';
        });
    }

    function checkExtensionAuthState() {
        // Check for core extension settings first, then for a login token.
        // NOTE: Using chrome.storage.local for consistency with where settings were likely saved.
        chrome.storage.local.get(['extension_settings', 'extension_auth_token'], (data) => {
            if (!data.extension_settings || !data.extension_settings.apiUrl) {
                showView(initialSetupView);
            } else if (!data.extension_auth_token) {
                showView(loginView);
            } else {
                showView(mainContainer);
                // Now that we are in the main view, initialize its features
                loadFeatureSettings();
                checkLoginStatus(); // This is for the MS365 connection
                displayUserDataFromStorage();
            }
        });
    }

    async function displayUserDataFromStorage() {
        try {
            const data = await new Promise((resolve, reject) => {
                chrome.storage.local.get('extension_user', (result) => {
                    if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                    resolve(result);
                });
            });

            if (data.extension_user && data.extension_user.user.username) {
                document.getElementById('loggedInUser').textContent = data.extension_user.user.username;
            } else {
                document.getElementById('loggedInUser').textContent = 'N/A';
            }
        } catch (error) {
            console.error('Error displaying user data from storage:', error);
            document.getElementById('loggedInUser').textContent = 'Error';
        }
    }

    async function fetchAndStoreUserData(token, apiUrl) {
        try {
            const response = await fetch(`${apiUrl}/api/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API error! status: ${response.status}`);
            }

            const userData = await response.json();

            await new Promise((resolve, reject) => {
                chrome.storage.local.set({ extension_user: userData }, () => {
                    if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                    console.log('User data fetched and stored.');
                    resolve();
                });
            });
        } catch (error) {
            console.error('Error fetching user data:', error);
            // We can decide if we want to clear the login state here or just log the error
        }
    }

    // --- Core Extension Auth Logic ---
    saveSettingsButton.addEventListener('click', () => {
        const settings = {
            clientId: document.getElementById('client_id').value,
            authToken: document.getElementById('auth_token').value,
            apiUrl: document.getElementById('api_url').value,
        };
        if (settings.apiUrl) { // Simple validation
            chrome.storage.local.set({ extension_settings: settings }, () => {
                console.log('Extension settings saved.');
                checkExtensionAuthState(); // Re-check state, should now show login view
            });
        } else {
            // Optional: show an error to the user
            console.error('API URL is required.');
        }
    });

    loginButton.addEventListener('click', () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            console.error('Username and password are required.');
            // TODO: Show this error on the UI
            return;
        }

        chrome.storage.local.get('extension_settings', (data) => {
            if (!data.extension_settings || !data.extension_settings.apiUrl || !data.extension_settings.clientId) {
                console.error('API settings are missing.');
                // TODO: Show this error on the UI
                return;
            }

            const { apiUrl, clientId, authToken } = data.extension_settings;
            const loginUrl = `${apiUrl}/_/security/login`;

            const loginPayload = {
                clientId: clientId,
                authToken: authToken,
                login: username,
                password: password,
            };

            fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginPayload),
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.message || err.error_description || `HTTP error! status: ${response.status}`) });
                }
                return response.json();
            })
            .then(async (tokenData) => { // Made this async to await the user fetch
                const token = tokenData.token || tokenData.access_token;
                if (token) {
                    // First, fetch and store the user data
                    await fetchAndStoreUserData(token, apiUrl);

                    // Then, save the token and update the view
                    chrome.storage.local.set({ extension_auth_token: token }, () => {
                        console.log('Extension login successful.');
                        checkExtensionAuthState(); // Re-check state, should now show main container
                    });
                } else {
                    throw new Error('Authentication token not found in response.');
                }
            })
            .catch(error => {
                console.error('Login error:', error);
                // TODO: Display a user-friendly error message in the popup
            });
        });
    });

    logoutButton.addEventListener('click', () => {
        chrome.storage.local.remove(['extension_auth_token', 'extension_user'], () => {
            console.log('Extension logout successful.');
            checkExtensionAuthState(); // Re-check state, should now show login view
        });
    });

    // Tab switching logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetTab = tab.getAttribute('data-tab');
            tabContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });

    // --- Feature Toggles Logic ---
    function saveFeatureSettings() {
        const settings = {};
        document.querySelectorAll('.feature-toggle').forEach(toggle => {
            const featureName = toggle.dataset.feature;
            if (featureName) {
                settings[featureName] = toggle.checked;
            }
        });
        chrome.storage.sync.set({ featureSettings: settings }, () => {
            console.log('Feature settings saved.');
            // Optionally, show a confirmation message
        });
    }

    function loadFeatureSettings() {
        chrome.storage.sync.get('featureSettings', (data) => {
            if (data.featureSettings) {
                document.querySelectorAll('.feature-toggle').forEach(toggle => {
                    const featureName = toggle.dataset.feature;
                    if (featureName && data.featureSettings.hasOwnProperty(featureName)) {
                        toggle.checked = data.featureSettings[featureName];
                    }
                });
            }
        });
    }

    saveFeatureSettingsButton.addEventListener('click', saveFeatureSettings);

    // --- MS365 & SharePoint Logic ---
    async function checkLoginStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'get_access_token' });
            if (response && response.success) {
                console.log('MS365 is connected.');
                updateUiWithLoginStatus(true);
            } else {
                console.log('MS365 is not connected.', response ? response.error : 'No response');
                updateUiWithLoginStatus(false);
            }
        } catch (error) {
            // This catch block handles errors where the sendMessage itself fails
            console.error('Error checking MS365 login status:', error);
            updateUiWithLoginStatus(false);
        }
    }

    function updateUiWithLoginStatus(isLoggedIn) {
        const statusSpan = document.getElementById('ms365-connection-status');
        const ms365Settings = document.getElementById('ms365-settings');

        if (isLoggedIn) {
            ms365LoginButton.style.display = 'none';
            ms365LogoutButton.style.display = 'block';
            statusSpan.textContent = 'Connected';
            statusSpan.style.color = 'green';
            ms365Settings.style.display = 'block';
            populateSharePointLists();
        } else {
            ms365LoginButton.style.display = 'block';
            ms365LogoutButton.style.display = 'none';
            statusSpan.textContent = 'Not Connected';
            statusSpan.style.color = 'red';
            ms365Settings.style.display = 'none';
        }
    }

    ms365LoginButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'ms365_login' }, (response) => {
            if (response && response.success) {
                console.log('Login successful');
                checkLoginStatus();
            } else {
                console.error('Login failed:', response ? response.error : 'No response');
                // Optionally, display the error to the user
            }
        });
    });

    ms365LogoutButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'ms365_logout' }, (response) => {
            if (response && response.success) {
                console.log('Logout successful');
                checkLoginStatus();
            } else {
                console.error('Logout failed');
            }
        });
    });

    async function populateSharePointLists() {
        const select = document.getElementById('sharepoint-list-select');
        const statusDiv = document.getElementById('sharepoint-list-status');
        select.innerHTML = '<option>Loading...</option>';

        try {
            const response = await chrome.runtime.sendMessage({ action: 'get_available_lists' });
            if (response && response.success) {
                select.innerHTML = ''; // Clear loading message
                if (response.lists.length === 0) {
                    select.innerHTML = '<option>No lists found</option>';
                    return;
                }

                response.lists.forEach(list => {
                    const option = document.createElement('option');
                    option.value = list.id;
                    option.textContent = list.name;
                    select.appendChild(option);
                });

                const settings = await chrome.storage.local.get('selectedSharePointList');
                if (settings.selectedSharePointList) {
                    select.value = settings.selectedSharePointList;
                }
            } else {
                throw new Error(response.error || 'Failed to fetch lists.');
            }
        } catch (error) {
            console.error('Error populating SharePoint lists:', error);
            select.innerHTML = '<option>Error loading lists</option>';
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.style.color = 'red';
        }
    }

    // Event listener to save the SharePoint list on selection change
    document.getElementById('sharepoint-list-select').addEventListener('change', (event) => {
        const selectedListId = event.target.value;
        const statusDiv = document.getElementById('sharepoint-list-status');

        if (selectedListId && selectedListId !== 'Error loading lists' && selectedListId !== 'No lists found') {
            chrome.storage.local.set({ selectedSharePointList: selectedListId }, () => {
                console.log('SharePoint list selection saved.');
                statusDiv.textContent = 'Selection saved!';
                statusDiv.style.color = 'green';
                setTimeout(() => statusDiv.textContent = '', 3000); // Clear message after 3 seconds
            });
        } else {
            // This case might not be necessary if the dropdown only contains valid lists or a disabled default
            statusDiv.textContent = 'Please select a valid list.';
            statusDiv.style.color = 'red';
        }
    });

    // The dedicated save button is no longer needed.
    /*
    saveSharePointListButton.addEventListener('click', () => {
        const selectedListId = document.getElementById('sharepoint-list-select').value;
        const statusDiv = document.getElementById('sharepoint-list-status');

        if (selectedListId && selectedListId !== 'Error loading lists' && selectedListId !== 'No lists found') {
            chrome.storage.local.set({ selectedSharePointList: selectedListId }, () => {
                console.log('SharePoint list selection saved.');
                statusDiv.textContent = 'Selection saved!';
                statusDiv.style.color = 'green';
                setTimeout(() => statusDiv.textContent = '', 3000);
            });
        } else {
            statusDiv.textContent = 'Please select a valid list.';
            statusDiv.style.color = 'red';
        }
    });
    */

    // --- Initial Load ---
    checkExtensionAuthState(); // This is now the main entry point
});
