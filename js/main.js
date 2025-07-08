// js/main.js
console.log("main.js loaded");

import { initializeCommissionPage } from './commissionPage.js';
import { initializeFilterManagement } from './filterManagement.js';
import { initializeSharePointIntegration } from './sharepointIntegration.js';
import { initializeCredentialsPage, initializeEditPage } from './attributePage.js';
import { initializeRoutePlanner } from './routePlanner.js';

const defaultFeatureSettings = {
    commissionPage: true,
    credentialsPage: true,
    editPage: true,
    materialCost: true,
    filterManagement: true,
    routePlanner: true
};

// This function will hold all the logic that needs to be re-run when settings change.
function initializeFeatures(settings) {
    console.log("Initializing features with settings:", settings);

    // Logic for commission show page
    if (settings.commissionPage && window.location.href.includes('https://serwis.stb.tech/commission/show/commission_id/')) {
        initializeCommissionPage();
        if (settings.routePlanner) {
            initializeRoutePlanner();
        }
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

    // The SharePoint integration is initialized based on modal appearances, not a specific page URL.
    // Its initialization is handled within sharepointIntegration.js itself.
    initializeSharePointIntegration();
}

// --- Listener for SharePoint Search ---
window.addEventListener('PerformSharePointSearch', (event) => {
    const { query } = event.detail;
    console.log(`main.js: Caught PerformSharePointSearch event with query: ${query}`);

    // Get the appropriate list ID and site path from sync storage
    chrome.storage.sync.get(['selectedSharePointList', 'sharepointSitePathWysylka'], (settings) => {
        const { selectedSharePointList, sharepointSitePathWysylka } = settings;

        if (!selectedSharePointList) {
            console.error('SharePoint list for "Nowa wysyłka" is not configured.');
            window.dispatchEvent(new CustomEvent('SharePointSearchResults', {
                detail: { success: false, error: 'Lista SharePoint dla "Nowa wysyłka" nie jest skonfigurowana.' }
            }));
            return;
        }

        if (!sharepointSitePathWysylka) {
            console.error('SharePoint site path for "Nowa wysyłka" is not configured.');
            window.dispatchEvent(new CustomEvent('SharePointSearchResults', {
                detail: { success: false, error: 'Ścieżka witryny SharePoint dla "Nowa wysyłka" nie jest skonfigurowana.' }
            }));
            return;
        }

        // Send message to background script to perform the search
        chrome.runtime.sendMessage({
            action: 'search_sharepoint',
            params: {
                listId: selectedSharePointList,
                query: query,
                sitePath: sharepointSitePathWysylka
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message to background script:', chrome.runtime.lastError);
                window.dispatchEvent(new CustomEvent('SharePointSearchResults', {
                    detail: { success: false, error: chrome.runtime.lastError.message }
                }));
                return;
            }
            // Dispatch results back to the content script
            console.log('main.js: Received response from background script, dispatching SharePointSearchResults.', response);
            window.dispatchEvent(new CustomEvent('SharePointSearchResults', { detail: response }));
        });
    });
});

// --- Listener for settings changes ---
let settingsListenerAdded = false;

// --- Initial Run ---

// Wrapper to get settings and run the main initialization function.
function runWithSettings() {
    chrome.storage.sync.get({ featureSettings: defaultFeatureSettings }, (data) => {
        initializeFeatures(data.featureSettings);

        // Add the settings listener only once, after we know chrome.storage is available.
        if (!settingsListenerAdded) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'sync' && changes.featureSettings) {
                    console.log('Detected a change in feature settings.');
                    const newSettings = changes.featureSettings.newValue;
                    // We might need to clear or reset existing modifications before re-initializing
                    // For now, we'll just re-run the initialization.
                    initializeFeatures(newSettings);
                }
            });
            settingsListenerAdded = true;
        }
    });
}

// Run all initializations when the script first loads.
runWithSettings();
