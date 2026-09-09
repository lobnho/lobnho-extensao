/**
 * Lobnho Extension - Element Inspector Modal
 * Renders an isolated Shadow DOM drawer with 8 tabs and dynamic context-aware copy.
 */
(function (global) {
  'use strict';

  const logger = new global.LobnhoLogger('INSPECTOR-MODAL');

  class LobnhoInspectorModal {
    constructor(options = {}) {
      this.options = Object.assign({
        onReinspect: null,
        onClose: null
      }, options);

      this.hostElement = null;
      this.shadowRoot = null;
      this.activeElement = null;
      this.activeTab = 'css';
      this.isMinimized = false;

      this.tabsData = {};
    }

    _buildDOM() {
      if (this.hostElement) return;

      this.hostElement = document.createElement('div');
      this.hostElement.id = 'lobnho-inspector-host';
      this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

      // Inlined scoped styles
      const linkEl = document.createElement('link');
      linkEl.rel = 'stylesheet';
      linkEl.href = global.LobnhoBrowser.runtime.getURL('src/content/inspector-modal.css');
      this.shadowRoot.appendChild(linkEl);

      const container = document.createElement('div');
      container.className = 'orkut-inspector-container';

      container.innerHTML = `
        <div class="orkut-header">
          <div class="orkut-brand">
            <img class="orkut-brand-logo" src="${global.LobnhoBrowser.runtime.getURL('assets/LOBINHOLOGO.png')}" alt="Lobnho">
            <span>Lobnho Inspector</span>
            <span class="orkut-tag-badge" id="tag-badge" title="Clique para copiar o nome do elemento">&lt;element&gt;</span>
            <button class="orkut-btn-cursor" id="btn-activate-cursor" title="Inspecionar elemento" aria-label="Inspecionar elemento">🎯</button>
          </div>
          <div class="orkut-header-actions">
            <button class="orkut-btn-header" id="btn-reinspect" title="Re-inspecionar outro elemento">+</button>
            <button class="orkut-btn-header" id="btn-minimize" title="Minimizar / Expandir">—</button>
            <button class="orkut-btn-header" id="btn-close" title="Fechar">✕</button>
          </div>
        </div>

        <div class="orkut-tab-bar" id="tab-bar">
          <button class="orkut-tab" data-tab="html">HTML</button>
          <button class="orkut-tab active" data-tab="css">CSS</button>
          <button class="orkut-tab" data-tab="jsx">React JSX</button>
          <button class="orkut-tab" data-tab="animations">Animações</button>
          <button class="orkut-tab" data-tab="assets">Assets & Mídia</button>
          <button class="orkut-tab" data-tab="tailwind">Tailwind</button>
          <button class="orkut-tab" data-tab="figma">Figma (SVG)</button>
        </div>

        <div class="orkut-content-area" id="content-area">
          <pre class="orkut-code-box" id="code-display">// Selecione um elemento</pre>
        </div>

        <div class="orkut-footer">
          <button class="orkut-btn-copy" id="btn-copy-active">
            <span>📋</span>
            <span id="btn-copy-label">Copiar CSS</span>
          </button>
          <button class="orkut-btn-secondary" id="btn-copy-all">
            <span>💾 Baixar Pacote HTML</span>
          </button>
        </div>

        <div class="orkut-toast" id="toast">Copiado com sucesso!</div>
      `;

      this.shadowRoot.appendChild(container);

      this._bindEvents();
      (document.body || document.documentElement).appendChild(this.hostElement);
    }

    _bindEvents() {
      const root = this.shadowRoot;

      root.getElementById('btn-close').addEventListener('click', () => {
        this.hide();
        if (typeof this.options.onClose === 'function') this.options.onClose();
      });

      root.getElementById('btn-minimize').addEventListener('click', () => {
        this.isMinimized = !this.isMinimized;
        const container = root.querySelector('.orkut-inspector-container');
        const content = root.getElementById('content-area');
        const tabs = root.getElementById('tab-bar');
        const footer = root.querySelector('.orkut-footer');

        if (this.isMinimized) {
          content.style.display = 'none';
          tabs.style.display = 'none';
          footer.style.display = 'none';
        } else {
          content.style.display = 'block';
          tabs.style.display = 'flex';
          footer.style.display = 'flex';
        }
      });

      root.getElementById('btn-reinspect').addEventListener('click', () => {
        if (typeof this.options.onReinspect === 'function') {
          this.options.onReinspect();
        }
      });

      root.getElementById('btn-activate-cursor').addEventListener('click', () => {
        if (typeof this.options.onActivateCursor === 'function') {
          this.options.onActivateCursor();
        }
      });

      root.getElementById('tab-bar').addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.orkut-tab');
        if (!tabBtn) return;
        const tabName = tabBtn.dataset.tab;
        this.switchTab(tabName);
      });

      root.getElementById('btn-copy-active').addEventListener('click', () => {
        this._copyActiveTabContent();
      });

      root.getElementById('btn-copy-all').addEventListener('click', () => {
        this._downloadElementPackage();
      });

      const tagBadge = root.getElementById('tag-badge');
      if (tagBadge) {
        tagBadge.addEventListener('click', () => {
          const badgeText = tagBadge.textContent;
          if (!badgeText) return;
          navigator.clipboard.writeText(badgeText).then(() => {
            this._showToast('Elemento copiado!');
            logger.info('Tag badge copied to clipboard:', badgeText);
          }).catch((err) => {
            logger.error('Failed to copy tag badge', err);
          });
        });
      }
    }

    show(element) {
      this._buildDOM();
      this.activeElement = element;
      this.hostElement.style.display = 'block';

      this._extractAllData(element);
      this.switchTab(this.activeTab);

      logger.info('Inspector modal opened for element', element);
    }

    hide() {
      if (this.hostElement) {
        this.hostElement.style.display = 'none';
      }
    }

    switchTab(tabName) {
      this.activeTab = tabName;
      const root = this.shadowRoot;

      root.querySelectorAll('.orkut-tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });

      const copyLabel = root.getElementById('btn-copy-label');
      const tabLabels = {
        html: 'Copiar HTML',
        css: 'Copiar CSS',
        jsx: 'Copiar React JSX',
        animations: 'Copiar Animação GSAP',
        assets: 'Copiar Assets',
        tailwind: 'Copiar Tailwind',
        figma: 'Copiar SVG para Figma'
      };
      copyLabel.textContent = tabLabels[tabName] || 'Copiar';

      const codeDisplay = root.getElementById('code-display');
      if (tabName === 'assets') {
        codeDisplay.classList.add('orkut-assets-box');
        codeDisplay.innerHTML = this.tabsData.assetsHtml || '<span class="orkut-empty">// Nenhum asset de imagem ou SVG direto encontrado neste elemento.</span>';
      } else {
        codeDisplay.classList.remove('orkut-assets-box');
        codeDisplay.textContent = this.tabsData[tabName] || '// Sem dados para esta aba';
      }
    }

    _escapeHtml(value) {
      return String(value).replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      }[character]));
    }

    _extractAllData(element) {
      if (!element) return;
      const generators = global.LobnhoCodeGenerators || {};

      // 1. Tag badge
      const tag = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : '';
      const cls = element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/)[0]}` : '';
      this.shadowRoot.getElementById('tag-badge').textContent = `<${tag}${id}${cls}>`;

      // 2. HTML
      this.tabsData.html = element.outerHTML;

      // 3. CSS
      const style = window.getComputedStyle(element);
      const cssRules = [
        `/* Computed Styles for <${tag}${id}${cls}> */`,
        `display: ${style.display};`,
        `position: ${style.position};`,
        `width: ${style.width};`,
        `height: ${style.height};`,
        `padding: ${style.padding};`,
        `margin: ${style.margin};`,
        `background: ${style.background};`,
        `color: ${style.color};`,
        `border: ${style.border};`,
        `border-radius: ${style.borderRadius};`,
        `font-family: ${style.fontFamily};`,
        `font-size: ${style.fontSize};`,
        `font-weight: ${style.fontWeight};`,
        `line-height: ${style.lineHeight};`,
        `letter-spacing: ${style.letterSpacing};`,
        `text-transform: ${style.textTransform};`,
        `box-shadow: ${style.boxShadow};`
      ].filter(line => !line.includes(': none') && !line.includes(': 0px 0px') && !line.includes(': auto;'));
      this.tabsData.css = cssRules.join('\n');

      // 4. React JSX
      this.tabsData.jsx = generators.htmlToReactJsx ? generators.htmlToReactJsx(element) : '// Generator not available';

      // 5. Animations & GSAP
      this.tabsData.animations = generators.generateGsapCode ? generators.generateGsapCode(element) : '// GSAP generator not available';

      // 7. Assets & Mídia
      const assetUrls = [];
      const addAsset = (label, url) => {
        if (!url || url === 'none' || assetUrls.some((asset) => asset.url === url)) return;
        assetUrls.push({ label, url });
      };
      if (element.tagName === 'IMG') addAsset('Imagem', element.currentSrc || element.src);
      element.querySelectorAll('img').forEach((image) => addAsset('Imagem interna', image.currentSrc || image.src));
      if (element.tagName === 'SVG' || element.querySelector('svg')) assetUrls.push({ label: 'SVG inline', url: '' });
      const backgroundMatch = style.backgroundImage && style.backgroundImage.match(/url\\(["']?(.*?)["']?\\)/i);
      if (backgroundMatch) addAsset('Imagem de fundo', backgroundMatch[1]);
      this.tabsData.assetsHtml = assetUrls.map((asset) => {
        if (!asset.url) return `<div class="orkut-asset-row"><strong>${this._escapeHtml(asset.label)}</strong><span>Veja aba Figma (SVG)</span></div>`;
        const safeUrl = this._escapeHtml(asset.url);
        return `<div class="orkut-asset-row"><strong>${this._escapeHtml(asset.label)}</strong><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a></div>`;
      }).join('');
      this.tabsData.assets = assetUrls.map((asset) => `${asset.label}: ${asset.url || 'SVG inline'}`).join('\n') || '// Nenhum asset de imagem ou SVG direto encontrado neste elemento.';

      // 8. Tailwind
      this.tabsData.tailwind = generators.cssToTailwind ? generators.cssToTailwind(element) : '// Tailwind generator not available';

      // 9. Figma / SVG Vector
      this.tabsData.figma = generators.elementToSvg ? generators.elementToSvg(element) : '// SVG generator not available';
    }

    _copyActiveTabContent() {
      const content = this.tabsData[this.activeTab];
      if (!content) return;

      navigator.clipboard.writeText(content).then(() => {
        this._showToast('Copiado com sucesso!');
        logger.info(`Tab ${this.activeTab} content copied to clipboard`);
      }).catch((err) => {
        logger.error('Failed to copy', err);
      });
    }

    _downloadElementPackage() {
      if (!this.activeElement) return;
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Elemento Exportado - Lobnho Orkut</title>
  <style>
    body { font-family: sans-serif; padding: 40px; background: #E7EEF6; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
  </style>
</head>
<body>
  ${this.activeElement.outerHTML}
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lobnho-element-${this.activeElement.tagName.toLowerCase()}.html`;
      a.click();
      URL.revokeObjectURL(url);
      this._showToast('Elemento baixado!');
    }

    _showToast(msg) {
      const toast = this.shadowRoot.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
  }

  global.LobnhoInspectorModal = LobnhoInspectorModal;
})(typeof window !== 'undefined' ? window : globalThis);
