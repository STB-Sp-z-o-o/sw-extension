console.log("content.js loading main.js as a module.");

(async () => {
  const src = chrome.runtime.getURL('js/main.js');
  const contentScript = await import(src);
  // The main.js file handles all initializations.
})();