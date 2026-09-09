/**
 * Lobnho Extension - Content Main Orchestrator
 * Connects Target Cursor, Orkut Inspector Modal, Page Exporter, and Message Bus.
 */
(function (global) {
  'use strict';

  const logger = new global.LobnhoLogger('CONTENT-MAIN');

  let targetCursor = null;
  let inspectorModal = null;

  function init() {
    logger.info('Initializing Lobnho Extension content scripts');

    inspectorModal = new global.LobnhoInspectorModal({
      onReinspect: () => {
        inspectorModal.hide();
        targetCursor.activate();
      },
      onActivateCursor: () => {
        inspectorModal.hide();
        targetCursor.activate();
      },
      onClose: () => {
        targetCursor.deactivate();
      }
    });

    targetCursor = new global.LobnhoTargetCursor({
      onSelect: (element) => {
        targetCursor.deactivate();
        inspectorModal.show(element);
      }
    });

    // Listen for messages from popup or background service worker
    if (global.LobnhoBrowser) {
      global.LobnhoBrowser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        logger.debug('Received message in content script', message);

        if (message.action === 'toggle-tracker') {
          if (targetCursor.isEnabled) {
            targetCursor.deactivate();
            inspectorModal.hide();
          } else {
            inspectorModal.hide();
            targetCursor.activate();
          }
          sendResponse({ success: true, isEnabled: targetCursor.isEnabled });
          return true;
        }

        if (message.action === 'export-page') {
          global.LobnhoPageExporter.exportFullPagePackage()
            .then(() => sendResponse({ success: true }))
            .catch((error) => {
              logger.error('Page export failed', error);
              sendResponse({ success: false, error: error && error.message ? error.message : 'Export failed' });
            });
          return true;
        }

        if (message.action === 'get-status') {
          sendResponse({
            isTrackerEnabled: targetCursor.isEnabled
          });
          return true;
        }
      });
    }


    logger.info('Lobnho Extension initialized successfully');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
