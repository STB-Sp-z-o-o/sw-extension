// background.js

// Function to generate a random string for the code verifier
function generateCodeVerifier() {
    const array = new Uint32Array(28);
    self.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

// Function to generate the code challenge from the code verifier
async function generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await self.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Function to get the manifest
function getManifest() {
    return chrome.runtime.getManifest();
}

// Main function to handle MS365 authentication
async function authenticate(interactive) {
    const manifest = getManifest();
    const clientId = manifest.oauth2.client_id;
    const tenantId = manifest.oauth2.tenant_id;
    const scopes = manifest.oauth2.scopes.join(' ');
    const redirectUri = chrome.identity.getRedirectURL();
    
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    if (!tenantId || tenantId === 'YOUR_TENANT_ID_HERE') {
        return Promise.reject(new Error('Tenant ID is not configured in manifest.json.'));
    }

    let authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
    authUrl += `?client_id=${clientId}`;
    authUrl += `&response_type=code`;
    authUrl += `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    authUrl += `&response_mode=query`;
    authUrl += `&scope=${encodeURIComponent(scopes)}`;
    authUrl += `&code_challenge=${codeChallenge}`;
    authUrl += `&code_challenge_method=S256`;

    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: interactive
        }, async (responseUrl) => {
            if (chrome.runtime.lastError || !responseUrl) {
                console.error("Authentication Error:", chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Authentication failed or was cancelled.'));
                return;
            }

            console.log("Full response URL from auth flow:", responseUrl); // For debugging

            const url = new URL(responseUrl);
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');

            if (error) {
                const errorDescription = url.searchParams.get('error_description');
                reject(new Error(`MS365 Auth Error: ${error} - ${errorDescription}`))
                return;
            }

            if (!code) {
                reject(new Error('Authorization code not found in response.'))
                return;
            }

            // Exchange authorization code for an access token
            const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
            const params = new URLSearchParams();
            params.append('client_id', clientId);
            params.append('scope', scopes);
            params.append('code', code);
            params.append('redirect_uri', redirectUri);
            params.append('grant_type', 'authorization_code');
            params.append('code_verifier', codeVerifier);

            try {
                const tokenResponse = await fetch(tokenUrl, {
                    method: 'POST',
                    body: params,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                const tokenData = await tokenResponse.json();
                if (!tokenResponse.ok) {
                    throw new Error(tokenData.error_description || 'Token exchange failed.');
                }

                // Store tokens and expiry time
                const expiryTime = Date.now() + (tokenData.expires_in * 1000);
                chrome.storage.local.set({
                    ms365_token: tokenData.access_token,
                    ms365_refresh_token: tokenData.refresh_token,
                    ms365_token_expiry: expiryTime
                }, () => {
                    console.log('MS365 tokens stored successfully.');
                    resolve(tokenData.access_token);
                });

            } catch (error) {
                console.error('Token exchange error:', error);
                reject(error);
            }
        });
    });
}

// Function to fetch available SharePoint lists from a site
async function getAvailableLists() {
    try {
        const token = await getAccessToken();
        // The site URL is hardcoded for now. This could be a setting in the future.
        const siteUrl = "stabautech.sharepoint.com:/sites/zamowienia";
        const apiUrl = `https://graph.microsoft.com/v1.0/sites/${siteUrl}/lists`;

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("SharePoint API Error (getAvailableLists):", errorData);
            throw new Error(`Failed to fetch available lists: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        // We only need the name and id of each list
        return data.value.map(list => ({ id: list.id, name: list.displayName }));
    } catch (error) {
        console.error('Error fetching available SharePoint lists:', error);
        throw error;
    }
}


// Function to fetch SharePoint list data
async function getSharePointListData() {
    try {
        const settings = await new Promise(resolve => chrome.storage.local.get('selectedSharePointList', resolve));
        const listId = settings.selectedSharePointList;

        if (!listId) {
            throw new Error("No SharePoint list selected. Please choose a list in the extension settings.");
        }

        const token = await getAccessToken();
        const siteUrl = "stabautech.sharepoint.com:/sites/zamowienia";
        
        const apiUrl = `https://graph.microsoft.com/v1.0/sites/${siteUrl}/lists/${listId}/items?expand=fields(select=*)`;

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("SharePoint API Error:", errorData);
            throw new Error(`Failed to fetch SharePoint data: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.value; // The list items are in the 'value' property

    } catch (error) {
        console.error('Error fetching SharePoint list data:', error);
        throw error; // Re-throw the error to be caught by the message listener
    }
}

// Function to fetch available SharePoint lists
async function getSharePointLists() {
    try {
        const token = await getAccessToken();
        const siteUrl = "stabautech.sharepoint.com:/sites/zamowienia";
        
        const apiUrl = `https://graph.microsoft.com/v1.0/sites/${siteUrl}/lists`;

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("SharePoint API Error (get lists):", errorData);
            throw new Error(`Failed to fetch SharePoint lists: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        // Return both id and displayName for the popup
        return data.value.map(list => ({ id: list.id, displayName: list.displayName }));

    } catch (error) {
        console.error('Error fetching SharePoint lists:', error);
        throw error;
    }
}


async function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['ms365_token', 'ms365_token_expiry', 'ms365_refresh_token'], (data) => {
            if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
            }

            if (data.ms365_token && Date.now() < data.ms365_token_expiry) {
                console.log("Found valid MS365 access token.");
                resolve(data.ms365_token);
            } else if (data.ms365_refresh_token) {
                console.log("MS365 access token expired, attempting to refresh.");
                refreshAccessToken(data.ms365_refresh_token)
                    .then(newAccessToken => resolve(newAccessToken))
                    .catch(error => {
                        console.error("Failed to refresh token, user needs to login again.", error);
                        reject(new Error('MS365 session expired. Please log in again.'));
                    });
            } else {
                reject(new Error('MS365 token not found. Please log in.'));
            }
        });
    });
}

async function refreshAccessToken(refreshToken) {
    const manifest = getManifest();
    const clientId = manifest.oauth2.client_id;
    const tenantId = manifest.oauth2.tenant_id;
    const scopes = manifest.oauth2.scopes.join(' ');

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('scope', scopes);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const response = await fetch(tokenUrl, {
        method: 'POST',
        body: params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    const tokenData = await response.json();
    if (!response.ok) {
        throw new Error(tokenData.error_description || 'Token refresh failed.');
    }

    const expiryTime = Date.now() + (tokenData.expires_in * 1000);
    await new Promise((resolve, reject) => {
        chrome.storage.local.set({
            ms365_token: tokenData.access_token,
            ms365_refresh_token: tokenData.refresh_token,
            ms365_token_expiry: expiryTime
        }, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else {
                console.log('MS365 tokens refreshed and stored successfully.');
                resolve();
            }
        });
    });

    return tokenData.access_token;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ms365_login') {
        authenticate(true)
            .then(token => sendResponse({ success: true, token: token }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicates that the response is sent asynchronously
    }

    if (request.action === 'get_access_token') {
        getAccessToken()
            .then(token => sendResponse({ success: true, token: token }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Required for async sendResponse
    }

    if (request.action === 'fetch_sharepoint_lists') {
        getSharePointLists()
            .then(lists => sendResponse({ success: true, data: lists }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicates that the response is sent asynchronously
    }

    if (request.action === 'fetch_sharepoint_data') {
        getSharePointListData()
            .then(data => sendResponse({ success: true, data: data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicates that the response is sent asynchronously
    }

    if (request.action === 'get_available_lists') {
        getAvailableLists()
            .then(lists => sendResponse({ success: true, lists: lists }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicates that the response is sent asynchronously
    }

    if (request.action === 'ms365_logout') {
        chrome.storage.local.remove(['ms365_token', 'ms365_refresh_token', 'ms365_token_expiry'], () => {
            sendResponse({ success: true });
        });
        return true;
    }
});
