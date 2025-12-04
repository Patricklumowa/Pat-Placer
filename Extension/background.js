/**
 * PatPlacer - Background Service Worker
 * Handles script injection into page MAIN world
 */

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'executeScript') {
    executeLocalScript(sender.tab.id, message.scriptName)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (message.action === 'injectCSS') {
    injectCSS(sender.tab.id, message.cssName)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Execute a local script file in the page's MAIN world
 * This allows the script to access page variables like window.__svelte
 */
async function executeLocalScript(tabId, scriptName) {
  try {
    const scriptUrl = chrome.runtime.getURL(`scripts/${scriptName}`);
    const response = await fetch(scriptUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch script: ${scriptName}`);
    }
    
    const code = await response.text();
    
    // Get URLs for resources that the injected script needs
    const pixelFrameUrl = chrome.runtime.getURL('pixelframe.png');
    const iconsBaseUrl = chrome.runtime.getURL('icons/');
    
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN', // Run in page context to access page variables
      func: injectScript,
      args: [code, scriptName, pixelFrameUrl, iconsBaseUrl]
    });
    
    console.log(`[PatPlacer] Injected script: ${scriptName}`);
  } catch (error) {
    console.error(`[PatPlacer] Failed to inject script: ${scriptName}`, error);
    throw error;
  }
}

/**
 * Function that runs in page context to inject the script
 */
function injectScript(code, scriptName, pixelFrameUrl, iconsBaseUrl) {
  try {
    // Set up resource URLs before the script runs
    window.__PATPLACER_RESOURCES__ = {
      pixelFrameUrl: pixelFrameUrl,
      iconsBaseUrl: iconsBaseUrl
    };
    
    const script = document.createElement('script');
    script.textContent = code;
    script.setAttribute('data-patplacer-script', scriptName);
    document.head.appendChild(script);
    // Don't remove immediately - some scripts need to stay
    console.log(`[PatPlacer] Script loaded: ${scriptName}`);
  } catch (error) {
    console.error(`[PatPlacer] Error injecting script: ${scriptName}`, error);
  }
}

/**
 * Inject CSS file into the page
 */
async function injectCSS(tabId, cssName) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: [`styles/${cssName}`]
    });
    console.log(`[PatPlacer] Injected CSS: ${cssName}`);
  } catch (error) {
    console.error(`[PatPlacer] Failed to inject CSS: ${cssName}`, error);
    throw error;
  }
}

// Log when service worker starts
console.log('[PatPlacer] Background service worker started');
