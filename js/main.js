// js/main.js
console.log("main.js loaded");

import { initializeCommissionPage } from './commissionPage.js';
import { initializeFilterManagement } from './filterManagement.js';
import { initializeCredentialsPage, initializeEditPage } from './attributePage.js';
import { initializeRoutePlanner } from './routePlanner.js';

const defaultFeatureSettings = {
    commissionPage: false,
    credentialsPage: false,
    editPage: false,
    materialCost: false,
    filterManagement: false,
    routePlanner: false
};

// This function will hold all the logic that needs to be re-run when settings change.
function initializeFeatures(settings) {
    console.log("Initializing features with settings:", settings);

    // Logic for commission show page
    if (settings.commissionPage && window.location.href.includes('/commission/show/commission_id/')) {
        initializeCommissionPage();
        // if (settings.routePlanner) {
        //     initializeRoutePlanner();
        // }
    }

    // Logic for attribute credentials page
    if (settings.credentialsPage && window.location.href.includes('https://serwis.stb.tech/commissionAttribute/addAttributeCredentials/commission_attribute_id/')) {
        initializeCredentialsPage();
    }

    // Logic for attribute edit page
    if (settings.editPage && window.location.href.includes('/commissionAttribute/edit/commission_attribute_id/')) {
        initializeEditPage();
    }

    // Logic for Filter Management on list pages
    if ((settings.filterManagement && window.location.href.includes('/list')) || (settings.filterManagement && window.location.href.includes('/kanban/show/id/'))) {
        initializeFilterManagement();
    }

    // The SharePoint integration is initialized based on modal appearances, not a specific page URL.
    // Its initialization is handled within sharepointIntegration.js itself.
}

// --- Listener for settings changes ---
let settingsListenerAdded = false;

// --- Initial Run ---

// Wrapper to get settings and run the main initialization function.
function runWithSettings() {
    // run only when client is logged in
    chrome.storage.local.get('extension_user', (result) => {
        if (!result.extension_user) {
            console.log("User is not logged in, skipping feature initialization.");
            return;
        }
     chrome.storage.local.get({ featureSettings: defaultFeatureSettings }, (data) => {
        initializeFeatures(data.featureSettings);

        // Add the settings listener only once, after we know chrome.storage is available.
        if (!settingsListenerAdded) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local' && changes.featureSettings) {
                    const newSettings = changes.featureSettings.newValue;
                    // We might need to clear or reset existing modifications before re-initializing
                    // For now, we'll just re-run the initialization.
                    initializeFeatures(newSettings);
                }
            });
            settingsListenerAdded = true;
        }
    });
    });
   
}

// Run all initializations when the script first loads.
runWithSettings();
