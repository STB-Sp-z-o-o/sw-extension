
// injected.js

// This script is injected into the main page context to bridge the gap
// between the content script's isolated world and the chrome runtime APIs.

window.addEventListener('searchSharePoint', (e) => {
    const { query } = e.detail;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'search_sharepoint_data', query: query }, (response) => {
            window.dispatchEvent(new CustomEvent('sharePointSearchResults', { detail: response }));
        });
    } else {
        console.error("chrome.runtime.sendMessage is not available.");
        window.dispatchEvent(new CustomEvent('sharePointSearchResults', { detail: { success: false, error: "Extension context not available." } }));
    }
});
