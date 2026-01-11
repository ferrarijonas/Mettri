// Mettri Background Service Worker

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    // First install
    chrome.storage.local.set({
      settings: {
        panelEnabled: true,
        captureEnabled: true,
        theme: 'auto',
      },
      messages: [],
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

  if (message.type === 'SAVE_MESSAGE') {
    chrome.storage.local.get(['messages'], result => {
      const messages = result.messages || [];
      messages.push(message.payload);
      chrome.storage.local.set({ messages });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_MESSAGES') {
    chrome.storage.local.get(['messages'], result => {
      sendResponse(result.messages || []);
    });
    return true;
  }

  return false;
});
