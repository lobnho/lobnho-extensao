/**
 * Lobnho Extension - Popup Script
 * Coordinates user actions in the popup dashboard with content scripts.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const browserApi = window.LobnhoBrowser;
  const btnToggle = document.getElementById('btn-toggle-tracker');
  const btnExport = document.getElementById('btn-export-page');
  const trackerText = document.getElementById('tracker-status-text');

  let activeTabId = null;

  async function getActiveTab() {
    const tabs = await browserApi.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  async function sendToActiveTab(message) {
    if (!activeTabId) return null;
    try {
      return await browserApi.tabs.sendMessage(activeTabId, message);
    } catch {
      await browserApi.tabs.ensureContentScript(activeTabId);
      return browserApi.tabs.sendMessage(activeTabId, message);
    }
  }

  const tab = await getActiveTab();
  if (tab) {
    activeTabId = tab.id;
    try {
      const response = await sendToActiveTab({ action: 'get-status' });
      if (response) {
        updateTrackerState(response.isTrackerEnabled);
      }
    } catch {
      trackerText.textContent = 'Inspecionar elemento';
    }
  }

  function updateTrackerState(isEnabled) {
    if (isEnabled) {
      trackerText.textContent = 'Desativar inspeção';
      btnToggle.style.background = 'linear-gradient(180deg, #666 0%, #444 100%)';
    } else {
      trackerText.textContent = 'Inspecionar elemento';
      btnToggle.style.background = '';
    }
  }

  btnToggle.addEventListener('click', async () => {
    if (!activeTabId) return;
    try {
      const response = await sendToActiveTab({ action: 'toggle-tracker' });
      if (response) {
        updateTrackerState(response.isEnabled);
        window.close();
      }
    } catch {
      trackerText.textContent = 'Abra uma página comum para ativar';
    }
  });

  btnExport.addEventListener('click', async () => {
    if (!activeTabId) return;
    btnExport.disabled = true;
    const originalText = btnExport.textContent;
    btnExport.textContent = 'Gerando arquivo único...';
    try {
      const response = await sendToActiveTab({ action: 'export-page' });
      if (!response || response.success !== true) {
        throw new Error(response && response.error ? response.error : 'Content script indisponível');
      }
      btnExport.textContent = 'Arquivo completo exportado!';
      setTimeout(() => {
        window.close();
      }, 800);
    } catch (err) {
      btnExport.disabled = false;
      btnExport.textContent = originalText;
      const reason = err && err.message ? `\n\nDetalhe: ${err.message}` : '';
      alert(`Não foi possível exportar a página nesta aba.${reason}`);
    }
  });
});
