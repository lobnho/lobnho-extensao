/**
 * Lobnho Extension - Cross-Browser API Polyfill / Adapter
 * Normalizes chrome.* and browser.* APIs across Chromium & Firefox.
 */
(function (global) {
  'use strict';

  const hasBrowser = typeof browser !== 'undefined';
  const hasChrome = typeof chrome !== 'undefined';

  const api = hasBrowser ? browser : (hasChrome ? chrome : null);

  const LobnhoBrowser = {
    runtime: {
      sendMessage: (message) => {
        return new Promise((resolve, reject) => {
          if (!api || !api.runtime || !api.runtime.sendMessage) {
            return reject(new Error('runtime.sendMessage not available'));
          }
          api.runtime.sendMessage(message, (response) => {
            const err = api.runtime.lastError;
            if (err) return reject(err);
            resolve(response);
          });
        });
      },
      onMessage: {
        addListener: (callback) => {
          if (api && api.runtime && api.runtime.onMessage) {
            api.runtime.onMessage.addListener(callback);
          }
        },
        removeListener: (callback) => {
          if (api && api.runtime && api.runtime.onMessage) {
            api.runtime.onMessage.removeListener(callback);
          }
        }
      },
      getURL: (path) => {
        if (api && api.runtime && api.runtime.getURL) {
          return api.runtime.getURL(path);
        }
        return path;
      }
    },
    storage: {
      local: {
        get: (keys) => {
          return new Promise((resolve) => {
            if (!api || !api.storage || !api.storage.local) {
              return resolve({});
            }
            api.storage.local.get(keys, (data) => resolve(data || {}));
          });
        },
        set: (items) => {
          return new Promise((resolve) => {
            if (!api || !api.storage || !api.storage.local) {
              return resolve();
            }
            api.storage.local.set(items, () => resolve());
          });
        }
      }
    },
    tabs: {
      query: (queryInfo) => {
        return new Promise((resolve) => {
          if (!api || !api.tabs || !api.tabs.query) return resolve([]);
          api.tabs.query(queryInfo, (tabs) => resolve(tabs || []));
        });
      },
      ensureContentScript: (tabId) => {
        return new Promise((resolve, reject) => {
          if (!api || !api.scripting || !api.scripting.executeScript) {
            return reject(new Error('Automatic injection unavailable'));
          }
          api.scripting.executeScript({
            target: { tabId },
            files: [
              'src/shared/vendor/gsap.min.js',
              'src/shared/vendor/jszip.min.js',
              'src/shared/browser-api.js',
              'src/shared/logger.js',
              'src/shared/code-generators.js',
              'src/content/target-cursor.js',
              'src/content/inspector-modal.js',
              'src/content/page-exporter.js',
              'src/content/theme-exporter.js',
              'src/content/content-main.js'
            ]
          }, () => {
            const err = api.runtime && api.runtime.lastError;
            if (err) return reject(err);
            resolve();
          });
        });
      },
      sendMessage: (tabId, message) => {
        return new Promise((resolve, reject) => {
          if (!api || !api.tabs || !api.tabs.sendMessage) {
            return reject(new Error('tabs.sendMessage not available'));
          }
          api.tabs.sendMessage(tabId, message, (response) => {
            const err = api.runtime?.lastError;
            if (err) return reject(err);
            resolve(response);
          });
        });
      }
    }
  };

  global.LobnhoBrowser = LobnhoBrowser;
})(typeof window !== 'undefined' ? window : globalThis);
