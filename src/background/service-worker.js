/**
 * Lobnho Extension - Service Worker (Background)
 * Manifest V3 background service worker for commands and dispatch.
 */

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download-file') {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: false
    }, (downloadId) => {
      sendResponse({ success: true, downloadId });
    });
    return true;
  }
});

console.log('[Lobnho Background] Service Worker initialized');
