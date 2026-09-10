/**
 * Lobnho Extension - Popup Script
 * Coordinates user actions in the popup dashboard with content scripts.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const browserApi = window.LobnhoBrowser;
  const btnToggle = document.getElementById('btn-toggle-tracker');
  const btnExport = document.getElementById('btn-export-page');
  const btnExportTheme = document.getElementById('btn-export-theme');
  const trackerText = document.getElementById('tracker-status-text');
  const updateBox = document.getElementById('extension-update');
  const updateText = document.getElementById('extension-update-text');
  const updateLink = document.getElementById('extension-update-link');
  const installedVersion = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '1.1.8';
  const versionEndpoint = 'https://lobinho.eu/extension/version.json';

  const headerVersionEl = document.querySelector('.orkut-version');
  if (headerVersionEl) {
    headerVersionEl.textContent = `v${installedVersion}`;
  }

  function isNewerVersion(remote, local) {
    const r = (remote || '').split('.').map(n => parseInt(n, 10) || 0);
    const l = (local || '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
      const rv = r[i] || 0;
      const lv = l[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  }

  async function checkForUpdate() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(`${versionEndpoint}?v=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) return;
      const release = await response.json();
      if (release.version && isNewerVersion(release.version, installedVersion) && release.downloadUrl) {
        updateText.textContent = `Nova versão disponível: v${release.version}`;
        updateLink.href = release.releaseUrl || release.downloadUrl;
        updateBox.hidden = false;
      }
    } catch {
      // Update checks are optional and must not block extension actions.
    }
  }

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

  checkForUpdate();

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

  if (btnExportTheme) {
    btnExportTheme.addEventListener('click', async () => {
      if (!activeTabId) return;
      btnExportTheme.disabled = true;
      const originalText = btnExportTheme.textContent;
      btnExportTheme.textContent = 'Extraindo tema...';
      try {
        const response = await sendToActiveTab({ action: 'export-theme' });
        if (!response || response.success !== true) {
          throw new Error(response && response.error ? response.error : 'Content script indisponível');
        }
        btnExportTheme.textContent = 'Tema JSON exportado!';
        setTimeout(() => {
          window.close();
        }, 800);
      } catch (err) {
        btnExportTheme.disabled = false;
        btnExportTheme.textContent = originalText;
        const reason = err && err.message ? `\n\nDetalhe: ${err.message}` : '';
        alert(`Não foi possível exportar o tema nesta aba.${reason}`);
      }
    });
  }
});
