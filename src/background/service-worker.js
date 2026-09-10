/**
 * Lobnho Extension - Service Worker (Background)
 * Manifest V3 background service worker for commands and dispatch.
 */

const UPDATE_ALARM = 'lobnho-extension-update-check';
const UPDATE_INTERVAL_MINUTES = 120;

function scheduleUpdateCheck() {
  chrome.alarms.create(UPDATE_ALARM, { delayInMinutes: UPDATE_INTERVAL_MINUTES, periodInMinutes: UPDATE_INTERVAL_MINUTES });
}

chrome.runtime.onInstalled.addListener(scheduleUpdateCheck);
chrome.runtime.onStartup.addListener(scheduleUpdateCheck);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== UPDATE_ALARM) return;
  try {
    chrome.runtime.requestUpdateCheck(() => {
      void chrome.runtime.lastError;
    });
  } catch (_) {
    // Browser may reject update checks while offline or during startup.
  }
});

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download-file') {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: false
    }, (downloadId) => {
      const error = chrome.runtime.lastError;
      if (error || typeof downloadId !== 'number') {
        sendResponse({
          success: false,
          error: error ? error.message : 'Browser did not create download'
        });
        return;
      }
      sendResponse({ success: true, downloadId });
    });
    return true;
  }
});

console.log('[Lobnho Background] Service Worker initialized');
