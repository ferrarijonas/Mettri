// Mettri Background Service Worker

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    // First install
    chrome.storage.local.set({
      settings: {
        panelEnabled: true,
        captureEnabled: true,
        theme: 'auto',
        historyEnabled: false,
      },
      version: '2.0.0',
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['settings'], result => {
      sendResponse(result.settings || {});
    });
    return true; // Keep channel open for async response
  }

  return false;
});
