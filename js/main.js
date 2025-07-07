// js/main.js
console.log("main.js loaded");

import { initializeCommissionPage } from './commissionPage.js';
import { initializeFilterManagement } from './filterManagement.js';
import { initializeSharePointIntegration } from './sharepointIntegration.js';

const defaultFeatureSettings = {
    commissionPage: true,
    credentialsPage: true,
    editPage: true,
    materialCost: true,
    filterManagement: true
};

// This function will hold all the logic that needs to be re-run when settings change.
function initializeFeatures(settings) {
    console.log("Initializing features with settings:", settings);

    // Logic for commission show page
    if (settings.commissionPage && window.location.href.includes('https://serwis.stb.tech/commission/show/commission_id/')) {
        initializeCommissionPage();
    }

    // Logic for attribute credentials page
    if (settings.credentialsPage && window.location.href.includes('https://serwis.stb.tech/commissionAttribute/addAttributeCredentials/commission_attribute_id/')) {
        // Placeholder for future credentials page logic
    }

    // Logic for attribute edit page
    if (settings.editPage && window.location.href.includes('https://serwis.stb.tech/commissionAttribute/edit/commission_attribute_id/')) {
        // Placeholder for future edit page logic
    }

    // Logic for Filter Management on list pages
    if (settings.filterManagement && window.location.href.includes('/list')) {
        initializeFilterManagement();
    }

    // The SharePoint integration is initialized based on modal appearances, not a specific page URL.
    // Its initialization is handled within sharepointIntegration.js itself.
    initializeSharePointIntegration();
}

// --- Listener for settings changes ---

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.featureSettings) {
        console.log('Detected a change in feature settings.');
        const newSettings = changes.featureSettings.newValue;
        // We might need to clear or reset existing modifications before re-initializing
        // For now, we'll just re-run the initialization.
        initializeFeatures(newSettings);
    }
});

// --- Initial Run ---

// Wrapper to get settings and run the main initialization function.
function runWithSettings() {
    chrome.storage.sync.get({ featureSettings: defaultFeatureSettings }, (data) => {
        initializeFeatures(data.featureSettings);
    });
}

// Run all initializations when the script first loads.
runWithSettings();
