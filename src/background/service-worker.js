/**
 * Lobnho Extension - Service Worker (Background)
 * Manifest V3 background service worker for commands and dispatch.
 */

const UPDATE_ALARM = 'lobnho-extension-update-check';
const UPDATE_INTERVAL_MINUTES = 60;

function setUpdateBadge(text) {
  chrome.action.setBadgeText({ text }).catch(() => {});
  if (text) chrome.action.setBadgeBackgroundColor({ color: '#ff00f6' }).catch(() => {});
}
const RELEASE_URL = 'https://lobinho.eu/extension/version.json';

function scheduleUpdateCheck() {
  chrome.alarms.create(UPDATE_ALARM, { delayInMinutes: UPDATE_INTERVAL_MINUTES, periodInMinutes: UPDATE_INTERVAL_MINUTES });
}

async function checkReleaseBadge() {
  try {
    const response = await fetch(`${RELEASE_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const release = await response.json();
    const current = chrome.runtime.getManifest().version.split('.').map(Number);
    const remote = String(release.version || '').split('.').map(Number);
    const firstDifference = [0, 1, 2].find((index) => remote[index] !== (current[index] || 0));
    const newer = remote.length === 3 && remote.every(Number.isFinite) && firstDifference !== undefined && remote[firstDifference] > (current[firstDifference] || 0);
    await chrome.action.setBadgeText({ text: newer ? 'NEW' : '' });
    if (newer) await chrome.action.setBadgeBackgroundColor({ color: '#ED2590' });
  } catch (_) {
    // Network failure must not affect extension runtime.
  }
}

chrome.runtime.onInstalled.addListener(() => { scheduleUpdateCheck(); void checkReleaseBadge(); });
chrome.runtime.onStartup.addListener(() => { scheduleUpdateCheck(); void checkReleaseBadge(); });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== UPDATE_ALARM) return;
  void checkReleaseBadge();
  try {
    chrome.runtime.requestUpdateCheck((status) => {
      void chrome.runtime.lastError;
      setUpdateBadge(status === 'update_available' ? 'NEW' : '');
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
