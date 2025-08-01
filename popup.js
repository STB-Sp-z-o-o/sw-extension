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

    // --- View Management ---
    function showView(viewToShow) {
        [initialSetupView, loginView, mainContainer].forEach(view => {
            if (view) view.style.display = (view === viewToShow) ? 'block' : 'none';
        });
    }

    function checkExtensionAuthState() {
        // Check for core extension settings first, then for a login token.
        chrome.storage.local.get(['extension_settings', 'extension_auth_token'], (data) => {
            if (!data.extension_settings || !data.extension_settings.apiUrl) {
                showView(initialSetupView);
            } else if (!data.extension_auth_token) {
                showView(loginView);
            } else {
                showView(mainContainer);
                // Now that we are in the main view, initialize its features
                displayUserDataFromStorage();
            }
        });
    }

    async function displayUserDataFromStorage() {
        try {
            const data = await new Promise(resolve => chrome.storage.local.get('extension_user', resolve));

            if (data.extension_user && data.extension_user.user && data.extension_user.user.username) {
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
                chrome.storage.local.set({ extension_user: userData });
            });
        } catch (error) {
            console.error('Error fetching user data:', error);
            // We can decide if we want to clear the login state here or just log the error
        }
    }

    // --- Core Extension Auth Logic ---
    if (saveSettingsButton) {
        saveSettingsButton.addEventListener('click', () => {
            console.log('Save settings button clicked');
            const settings = {
                clientId: document.getElementById('client_id').value,
                authToken: document.getElementById('auth_token').value,
                apiUrl: document.getElementById('api_url').value,
            };
            if (settings.apiUrl) {
                chrome.storage.local.set({ extension_settings: settings }, () => {
                    console.log('Extension settings saved.');
                    checkExtensionAuthState();
                    showMessage('Ustawienia zostały zapisane!', 'success');
                });
            } else {
                // Show error in UI
                let errorDiv = document.getElementById('settings-error');
                if (!errorDiv) {
                    errorDiv = document.createElement('div');
                    errorDiv.id = 'settings-error';
                    errorDiv.style.color = 'red';
                    errorDiv.style.marginTop = '10px';
                    initialSetupView.appendChild(errorDiv);
                }
                errorDiv.textContent = 'API URL is required.';
                showMessage('Błąd podczas zapisywania ustawień.', 'error');
            }
        });
    } else {
        console.error('Save settings button (#save_settings) not found in DOM.');
        let errorDiv = document.getElementById('settings-error');
        if (!errorDiv && initialSetupView) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'settings-error';
            errorDiv.style.color = 'red';
            errorDiv.style.marginTop = '10px';
            initialSetupView.appendChild(errorDiv);
        }
        if (errorDiv) errorDiv.textContent = 'Błąd: przycisk zapisu ustawień nie został znaleziony.';
    }

    loginButton.addEventListener('click', () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Clear previous error
        let errorDiv = document.getElementById('login-error');
        if (errorDiv) errorDiv.textContent = '';

        if (!username || !password) {
            if (!errorDiv && loginView) {
                errorDiv = document.createElement('div');
                errorDiv.id = 'login-error';
                errorDiv.style.color = 'red';
                errorDiv.style.marginTop = '10px';
                loginView.appendChild(errorDiv);
            }
            if (errorDiv) errorDiv.textContent = 'Podaj nazwę użytkownika i hasło.';
            return;
        }

        chrome.storage.local.get('extension_settings', (data) => {
            if (!data.extension_settings || !data.extension_settings.apiUrl || !data.extension_settings.clientId) {
                if (!errorDiv && loginView) {
                    errorDiv = document.createElement('div');
                    errorDiv.id = 'login-error';
                    errorDiv.style.color = 'red';
                    errorDiv.style.marginTop = '10px';
                    loginView.appendChild(errorDiv);
                }
                if (errorDiv) errorDiv.textContent = 'Brak ustawień API lub ClientId.';
                return;
            }

            const { apiUrl, clientId, authToken } = data.extension_settings;
            console.log('Attempting to log in with settings:', { apiUrl, clientId, authToken, username });
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
            .then(async response => {
                if (!response.ok) {
                    let errText = await response.text();
                    let errJson;
                    try { errJson = JSON.parse(errText); } catch { errJson = {}; }
                    throw new Error(errJson.message || errJson.error_description || errText || `HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(async (tokenData) => {
                const token = tokenData.token || tokenData.access_token;
                if (token) {
                    chrome.storage.local.set({ extension_auth_token: token }, async () => {
                        console.log('Extension login successful.');
                        showMessage('Zalogowano pomyślnie!', 'success');
                        checkExtensionAuthState();
                        // Now fetch user data, but don't block saving token
                        try {
                            await fetchAndStoreUserData(token, apiUrl);
                        } catch (err) {
                            console.error('Error fetching user data after login:', err);
                        }
                    });
                } else {
                    throw new Error('Authentication token not found in response.');
                }
            })
            .catch(error => {
                console.error('Login error:', error);
                if (!errorDiv && loginView) {
                    errorDiv = document.createElement('div');
                    errorDiv.id = 'login-error';
                    errorDiv.style.color = 'red';
                    errorDiv.style.marginTop = '10px';
                    loginView.appendChild(errorDiv);
                }
                if (errorDiv) {
                    errorDiv.textContent = 'Błąd logowania: ' + (error.message || error);
                    showMessage('Błędny login lub hasło.', 'error');
                }
            });
        });
    });

    logoutButton.addEventListener('click', () => {
        // Remove user data from local storage
        chrome.storage.local.remove(['extension_auth_token', 'extension_user', 'featureSettings', 'filterSettings_commission_list'], () => {
            console.log('Extension logout successful.');
            checkExtensionAuthState();
            showMessage('Zostałeś wylogowany.', 'info');
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
    const featureToggles = document.querySelectorAll('.feature-toggle');
    const saveFeatureSettingsButton = document.getElementById('save-feature-settings');

    function loadFeatureSettings() {
        chrome.storage.local.get('featureSettings', (data) => {
            const settings = data.featureSettings || {};
            featureToggles.forEach(toggle => {
                const feature = toggle.dataset.feature;
                toggle.checked = !!settings[feature];
            });
        });
    }

    // Ensure checkboxes are synced every time the settings tab is shown
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetTab = tab.getAttribute('data-tab');
            tabContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add('active');
                    // If settings tab is activated, sync checkboxes
                    if (targetTab === 'settings-tab') {
                        loadFeatureSettings();
                    }
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });

    // Also sync on popup open
    loadFeatureSettings();

    function saveFeatureSettings() {
        const settings = {};
        featureToggles.forEach(toggle => {
            const feature = toggle.dataset.feature;
            settings[feature] = toggle.checked;
        });
        chrome.storage.local.set({ featureSettings: settings }, () => {
            console.log('Feature settings saved:', settings);
            showMessage('Ustawienia funkcji zapisane!', 'success');
        });
    }

    if (saveFeatureSettingsButton) {
        saveFeatureSettingsButton.addEventListener('click', saveFeatureSettings);
    }

    // --- Initial Load ---
    checkExtensionAuthState(); // This is now the main entry point

    // --- Message Display Logic ---
    function showMessage(msg, type = 'info') {
        const el = document.getElementById('user-message');
        el.textContent = msg;
        el.style.display = 'block';
        if (type === 'error') {
            el.style.background = '#f8d7da';
            el.style.color = '#721c24';
            el.style.borderColor = '#f5c6cb';
        } else if (type === 'success') {
            el.style.background = '#d4edda';
            el.style.color = '#155724';
            el.style.borderColor = '#c3e6cb';
        } else {
            el.style.background = '#f8f9fa';
            el.style.color = '#333';
            el.style.borderColor = '#c3e6cb';
        }
        setTimeout(() => { el.style.display = 'none'; }, 3000);
    }
});
