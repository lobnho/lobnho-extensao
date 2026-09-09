/**
 * Lobnho Extension - Multi-Software Page Exporter Engine
 * Exports full web page into multi-layer SVG (for Figma/Adobe), Figma AST JSON, and offline HTML.
 */
(function (global) {
  'use strict';

  const logger = new global.LobnhoLogger('PAGE-EXPORTER');

  class LobnhoPageExporter {
    static async exportFullPagePackage(options = {}) {
      logger.info('Starting full page package export');

      // Let SPA route rendering and web fonts settle before measuring the document.
      await this.waitForLayout(options.stabilizeMs || 180);

      const title = (document.title || 'page').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30);
      const timestamp = new Date().toISOString().slice(0, 10);

      // Resolve every resource before generating the single-file export.
      // This includes media, fonts, stylesheets and executable React/JS bundles.
      const imageDataUris = await this.collectImageDataUris();
      const resourceBundle = await this.collectPageResources(imageDataUris);

      // 1. Generate Multi-layer SVG (Figma / Adobe compatible)
      const svgContent = this.generateMultiLayerSvg(imageDataUris);

      // 2. Generate standalone HTML with visual state and runtime resources
      const htmlContent = await this.generateStandaloneHtml(
        imageDataUris,
        resourceBundle.dataUris,
        resourceBundle.scriptTexts,
        resourceBundle
      );

      // 3. Generate Figma AST JSON
      const figmaJson = this.generateFigmaJson();

      // Keep every export format inside one standalone HTML file. SVG and Figma
      // data remain embedded for later import without creating a ZIP package.
      const completeHtml = this.embedExportData(htmlContent, svgContent, figmaJson);
      const htmlBlob = new Blob([completeHtml], { type: 'text/html;charset=utf-8' });
      await this._triggerDownload(htmlBlob, `${title}-completo-${timestamp}.html`);
      logger.info('Single-file HTML package downloaded successfully');
    }

    static embedExportData(htmlContent, svgContent, figmaJson) {
      const svgJson = JSON.stringify(svgContent)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
      const figmaJsonText = JSON.stringify(figmaJson, null, 2)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
      const exportBlock = `
<!-- Lobnho complete export data: all formats kept in this single HTML file. -->
<script id="lobnho-figma-nodes" type="application/json">${figmaJsonText}</script>
<script id="lobnho-vector-svg" type="application/json">${svgJson}</script>
<template id="lobnho-vector-figma-template">${svgContent}</template>
`;
      return htmlContent.includes('</body>')
        ? htmlContent.replace('</body>', `${exportBlock}</body>`)
        : `${htmlContent}${exportBlock}`;
    }

    static escapeXml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }

    static parseCssColorToSvgAttrs(colorStr, fillOrStroke = 'fill') {
      if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)' || colorStr === 'none') {
        return `${fillOrStroke}="none"`;
      }
      const rgbaMatch = String(colorStr).match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
      if (rgbaMatch) {
        const r = rgbaMatch[1];
        const g = rgbaMatch[2];
        const b = rgbaMatch[3];
        const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
        if (a === 0) return `${fillOrStroke}="none"`;
        const rgb = `rgb(${r}, ${g}, ${b})`;
        if (a < 1) {
          return `${fillOrStroke}="${rgb}" ${fillOrStroke}-opacity="${a.toFixed(2)}"`;
        }
        return `${fillOrStroke}="${rgb}"`;
      }
      return `${fillOrStroke}="${LobnhoPageExporter.escapeXml(colorStr)}"`;
    }

    static waitForLayout(delay = 180) {
      return new Promise((resolve) => {
        const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (callback) => setTimeout(callback, 16);
        const finish = () => frame(() => frame(resolve));
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => setTimeout(finish, delay), () => setTimeout(finish, delay));
        } else {
          setTimeout(finish, delay);
        }
      });
    }

    static async collectImageDataUris() {
      const dataUris = new Map();
      const images = Array.from(document.images).filter((image) => image.currentSrc || image.src);
      await Promise.all(images.map(async (image) => {
        const source = image.currentSrc || image.src;
        try {
          if (source.startsWith('data:')) {
            dataUris.set(image, source);
            return;
          }
          await new Promise((resolve) => {
            if (image.complete && image.naturalWidth > 0) {
              resolve();
              return;
            }
            const timer = setTimeout(resolve, 800);
            const onDone = () => { clearTimeout(timer); resolve(); };
            image.addEventListener('load', onDone, { once: true });
            image.addEventListener('error', onDone, { once: true });
          });
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth || image.width || 100;
          canvas.height = image.naturalHeight || image.height || 100;
          if (!canvas.width || !canvas.height) return;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          try {
            dataUris.set(image, canvas.toDataURL('image/png'));
          } catch (canvasError) {
            // A tainted canvas cannot be read. Fetch the resource and encode its blob instead.
            try {
              const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
              const timeoutId = controller ? setTimeout(() => controller.abort(), 1200) : null;
              const response = await fetch(source, controller ? { signal: controller.signal } : {});
              if (timeoutId) clearTimeout(timeoutId);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const blob = await response.blob();
              const dataUri = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
              });
              if (dataUri) dataUris.set(image, dataUri);
            } catch (fetchError) {
              logger.info(`Could not inline image: ${source}`);
            }
          }
        } catch (error) {
          // Cross-origin images may fail to load before canvas or fetch fallback.
          logger.info(`Could not inline image: ${source}`);
        }
      }));
      return dataUris;
    }

    static async collectPageResources() {
      const dataUris = new Map();
      const scriptTexts = new Map();
      const cssTexts = new Map();
      const urls = new Set();
      const addUrl = (value) => {
        if (!value || value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('#')) return;
        try { urls.add(new URL(value, document.baseURI).href); } catch (e) { /* invalid URL */ }
      };

      document.querySelectorAll('link[href], script[src], video[src], video[poster], audio[src], source[src], track[src], iframe[src], [style]').forEach((element) => {
        ['href', 'src', 'poster'].forEach((attribute) => addUrl(element.getAttribute(attribute)));
        const style = element.getAttribute('style') || '';
        for (const match of style.matchAll(/url\((["']?)([^"')]+)\1\)/gi)) addUrl(match[2]);
      });
      document.querySelectorAll('style').forEach((style) => {
        for (const match of style.textContent.matchAll(/url\((["']?)([^"')]+)\1\)/gi)) addUrl(match[2]);
      });

      await Promise.all(Array.from(urls).map(async (url) => {
        try {
          const response = await fetch(url, { credentials: 'include' });
          if (!response.ok) return;
          const type = response.headers.get('content-type') || '';
          if (type.includes('javascript') || /\.m?js(?:[?#]|$)/i.test(url)) {
            scriptTexts.set(url, await response.text());
            return;
          }
          if (type.includes('css') || /\.css(?:[?#]|$)/i.test(url)) {
            cssTexts.set(url, await response.text());
          }
          const blob = await response.blob();
          const dataUri = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          if (dataUri) dataUris.set(url, dataUri);
        } catch (error) {
          logger.info(`Could not inline resource: ${url}`);
        }
      }));
      return { dataUris, scriptTexts, cssTexts };
    }

    static rewriteCssUrls(cssText, resourceDataUris) {
      return cssText.replace(/url\((["']?)([^"')]+)\1\)/gi, (full, quote, value) => {
        try {
          const absolute = new URL(value, document.baseURI).href;
          return resourceDataUris.has(absolute) ? `url(${resourceDataUris.get(absolute)})` : full;
        } catch (e) {
          return full;
        }
      });
    }

    static generateMultiLayerSvg(imageDataUris = new Map()) {
      const doc = document.documentElement;
      const body = document.body;
      const width = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0, window.innerWidth, 100);
      const height = Math.max(doc.scrollHeight, body ? body.scrollHeight : 0, window.innerHeight, 100);
      const svgElements = [];
      const defs = [];
      let definitionIndex = 0;
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;

      const addPseudo = (node, pseudo, x, y, w, h) => {
        const style = window.getComputedStyle(node, pseudo);
        if (!style || style.content === 'none' || style.display === 'none' || style.opacity === '0') return '';
        const content = style.content.replace(/^['"]|['"]$/g, '');
        if (!content || content === 'normal' || content === '""') return '';
        const color = LobnhoPageExporter.parseCssColorToSvgAttrs(style.color, 'fill');
        const size = parseFloat(style.fontSize) || 14;
        return `<text x="${x}" y="${y}" dominant-baseline="hanging" font-family="${LobnhoPageExporter.escapeXml(style.fontFamily || 'sans-serif')}" font-size="${size}px" font-weight="${style.fontWeight || '400'}" ${color}>${LobnhoPageExporter.escapeXml(content)}</text>\n`;
      };

      const splitCssFunctionArguments = (value) => {
        const args = [];
        let depth = 0;
        let current = '';
        for (const character of value) {
          if (character === '(') depth += 1;
          if (character === ')') depth = Math.max(0, depth - 1);
          if (character === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
          } else {
            current += character;
          }
        }
        if (current.trim()) args.push(current.trim());
        return args;
      };

      const getSvgRadius = (value, w, h) => {
        const numeric = parseFloat(String(value).split(/\s+/)[0]);
        if (!Number.isFinite(numeric) || numeric <= 0) return 0;
        const isPercentage = String(value).includes('%');
        const radius = isPercentage ? Math.min(w, h) * numeric / 100 : numeric;
        return Math.min(radius, Math.min(w, h) / 2);
      };

      const traverse = (node) => {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.id === 'lobnho-target-cursor-host' || node.id === 'lobnho-inspector-host') return;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const x = rect.left + scrollX;
        const y = rect.top + scrollY;
        const w = rect.width;
        const h = rect.height;
        const parts = [];
        const bg = style.backgroundColor;
        const radius = getSvgRadius(style.borderRadius || '0', w, h);
        const borderWidth = parseFloat(style.borderWidth) || 0;
        const borderColorValue = String(style.borderColor || '').trim();
        const firstBorderColor = borderColorValue.match(/^(?:rgba?\([^)]*\)|hsla?\([^)]*\)|#[\da-f]+|[a-z]+)(?=\s|$)/i)?.[0] || 'transparent';
        const stroke = borderWidth ? `${LobnhoPageExporter.parseCssColorToSvgAttrs(firstBorderColor, 'stroke')} stroke-width="${borderWidth}"` : '';
        let fill = LobnhoPageExporter.parseCssColorToSvgAttrs(bg, 'fill');
        const backgroundImage = style.backgroundImage;
        if (backgroundImage && backgroundImage !== 'none' && backgroundImage.includes('gradient')) {
          const id = `lobnho-gradient-${definitionIndex++}`;
          const match = backgroundImage.match(/linear-gradient\((.*)\)/i);
          if (match) {
            const gradientArguments = splitCssFunctionArguments(match[1]);
            const firstArgument = gradientArguments[0]?.trim().toLowerCase() || '';
            const hasDirection = /(?:deg|turn)\s*$/.test(firstArgument) || firstArgument.startsWith('to ');
            const gradientStops = hasDirection ? gradientArguments.slice(1) : gradientArguments;
            const stops = gradientStops.map((value, index, array) => {
              const color = value.trim().match(/^(rgba?\([^)]*\)|hsla?\([^)]*\)|#[\da-f]+|[a-z]+)/i)?.[1] || value.trim();
              const offset = array.length === 1 ? 0 : index / (array.length - 1);
              return `<stop offset="${offset * 100}%" ${LobnhoPageExporter.parseCssColorToSvgAttrs(color, 'stop-color')} />`;
            }).join('');
            defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>`);
            fill = `fill="url(#${id})"`;
          }
        }
        if (fill !== 'fill="none"' || stroke) {
          const shadow = style.boxShadow && style.boxShadow !== 'none' ? ` data-box-shadow="${LobnhoPageExporter.escapeXml(style.boxShadow)}"` : '';
          parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ${fill} ${stroke}${shadow} />`);
        }
        if (node.tagName === 'IMG' && node.src) {
          const source = LobnhoPageExporter.escapeXml(imageDataUris.get(node) || node.currentSrc || node.src);
          parts.push(`<image href="${source}" xlink:href="${source}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${style.objectFit === 'contain' ? 'xMidYMid meet' : 'none'}" />`);
        }
        for (const child of node.childNodes) {
          if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
            const range = document.createRange();
            range.selectNodeContents(child);
            const textRect = range.getBoundingClientRect();
            const text = child.textContent.replace(/[\r\n\t]+/g, ' ').trim();
            parts.push(`<text x="${textRect.left + scrollX}" y="${textRect.top + scrollY}" dominant-baseline="hanging" font-family="${LobnhoPageExporter.escapeXml(style.fontFamily || 'sans-serif')}" font-size="${parseFloat(style.fontSize) || 14}px" font-weight="${style.fontWeight || '400'}" letter-spacing="${style.letterSpacing}" ${LobnhoPageExporter.parseCssColorToSvgAttrs(style.color, 'fill')}>${LobnhoPageExporter.escapeXml(text)}</text>`);
          }
        }
        parts.push(addPseudo(node, '::before', x, y, w, h), addPseudo(node, '::after', x, y, w, h));
        if (parts.filter(Boolean).length) {
          const id = node.id ? ` id="${LobnhoPageExporter.escapeXml(node.id)}"` : '';
          const classes = typeof node.className === 'string' ? node.className.trim() : '';
          const classAttr = classes ? ` class="${LobnhoPageExporter.escapeXml(classes)}"` : '';
          const transform = style.transform !== 'none' ? ` transform="${LobnhoPageExporter.escapeXml(style.transform)}"` : '';
          svgElements.push(`  <g${id}${classAttr}${transform} opacity="${style.opacity}">\n    ${parts.filter(Boolean).join('\n    ')}\n  </g>`);
        }
        for (const child of node.children) traverse(child);
      };
      traverse(body);
      const pageBackground = LobnhoPageExporter.parseCssColorToSvgAttrs(window.getComputedStyle(body || doc).backgroundColor, 'fill');
      return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n  <defs>${defs.join('')}</defs>\n  <rect width="${width}" height="${height}" ${pageBackground === 'fill="none"' ? 'fill="#ffffff"' : pageBackground} />\n${svgElements.join('\n')}\n</svg>`;
    }

    static async generateStandaloneHtml(imageDataUris = new Map(), resourceDataUris = new Map(), scriptTexts = new Map(), resourceBundle = {}) {
      const clone = document.documentElement.cloneNode(true);

      // Remove extension roots from clone
      const cursorHost = clone.querySelector('#lobnho-target-cursor-host');
      if (cursorHost) cursorHost.remove();
      const inspectorHost = clone.querySelector('#lobnho-inspector-host');
      if (inspectorHost) inspectorHost.remove();

      // Preserve script source for inspection, but disable execution in file://.
      // Re-running SPA bundles can call unavailable APIs, remount React and clear
      // the already-rendered snapshot. CSS, fonts, media and HTML stay intact.
      const scripts = Array.from(clone.querySelectorAll('script'));
      scripts.forEach((script, index) => {
        if (script.dataset.lobnhoExtension || script.src.includes('chrome-extension://')) {
          script.remove();
          return;
        }
        const original = document.querySelectorAll('script')[index];
        const source = original?.src;
        if (source && scriptTexts.has(source)) {
          script.removeAttribute('src');
          script.textContent = scriptTexts.get(source);
        }
        script.type = 'text/plain';
        script.dataset.lobnhoOriginalType = script.getAttribute('type') || 'text/javascript';
        script.dataset.lobnhoDisabled = 'true';
      });

      // Ensure <head> has a base tag only as fallback for resources not allowed
      // to be inlined. Inlined assets below are independent of network access.
      let head = clone.querySelector('head');
      if (!head) {
        head = document.createElement('head');
        clone.insertBefore(head, clone.firstChild);
      }
      const existingBase = head.querySelector('base');
      if (!existingBase) {
        const baseEl = document.createElement('base');
        baseEl.href = document.baseURI || window.location.href;
        head.insertBefore(baseEl, head.firstChild);
      }

      // Inline same-origin and cross-origin stylesheets, rewriting url(...) for
      // fonts, background images and other CSS assets already collected.
      let inlinedCss = '';
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.disabled) continue;
          const rules = sheet.cssRules || sheet.rules;
          if (rules) inlinedCss += Array.from(rules).map(rule => rule.cssText).join('\n') + '\n';
        } catch (e) {
          const href = sheet.href;
          if (href && resourceBundle?.cssTexts?.has(href)) {
            inlinedCss += resourceBundle.cssTexts.get(href) + '\n';
          } else if (href && resourceDataUris.has(href)) {
            inlinedCss += resourceDataUris.get(href) + '\n';
          }
        }
      }
      if (inlinedCss.trim()) {
        inlinedCss = this.rewriteCssUrls(inlinedCss, resourceDataUris);
        const styleEl = document.createElement('style');
        styleEl.id = 'lobnho-inlined-document-styles';
        styleEl.textContent = `/* Lobnho Exporter - Inlined Complete Document Styles */\n${inlinedCss}`;
        head.appendChild(styleEl);
      }

      // Remove external stylesheet link tags from clone as styles are now fully inlined
      clone.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());

      // Freeze dynamic <canvas> elements into <img> data URL snapshots
      const originalCanvases = Array.from(document.querySelectorAll('canvas'));
      const cloneCanvases = Array.from(clone.querySelectorAll('canvas'));
      originalCanvases.forEach((origCanvas, idx) => {
        const cloneCanvas = cloneCanvases[idx];
        if (!cloneCanvas) return;
        try {
          const dataUrl = origCanvas.toDataURL('image/png');
          const img = document.createElement('img');
          img.src = dataUrl;
          img.className = cloneCanvas.className;
          img.id = cloneCanvas.id;
          if (cloneCanvas.getAttribute('style')) {
            img.setAttribute('style', cloneCanvas.getAttribute('style'));
          }
          cloneCanvas.parentNode?.replaceChild(img, cloneCanvas);
        } catch (e) {
          // Tainted canvas fallback
        }
      });

      // Inline all media and resource-bearing attributes, including picture,
      // video, audio, source, track and poster assets.
      clone.querySelectorAll('[src], [srcset], [poster], [href]').forEach((element) => {
        for (const attribute of ['src', 'poster', 'href']) {
          const value = element.getAttribute(attribute);
          if (!value || value.startsWith('#') || value.startsWith('data:')) continue;
          const absolute = new URL(value, document.baseURI).href;
          if (resourceDataUris.has(absolute)) element.setAttribute(attribute, resourceDataUris.get(absolute));
        }
        if (element.hasAttribute('srcset')) element.removeAttribute('srcset');
      });

      // Original image map wins over generic resource collection.
      Array.from(document.images).forEach((origImg, idx) => {
        const cloneImg = clone.querySelectorAll('img')[idx];
        const dataUri = imageDataUris.get(origImg);
        if (cloneImg && dataUri) cloneImg.src = dataUri;
      });

      return `<!DOCTYPE html>\n${clone.outerHTML}`;
    }

    static generateFigmaJson() {
      const root = {
        name: document.title || 'Page',
        type: 'FRAME',
        width: Math.max(document.documentElement.scrollWidth, window.innerWidth),
        height: Math.max(document.documentElement.scrollHeight, window.innerHeight),
        backgroundColor: window.getComputedStyle(document.body).backgroundColor,
        children: []
      };
      document.querySelectorAll('body > *:not(#lobnho-target-cursor-host):not(#lobnho-inspector-host)').forEach((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        if (rect.width <= 0 || rect.height <= 0 || style.display === 'none') return;
        root.children.push({
          name: node.id || (typeof node.className === 'string' && node.className) || node.tagName,
          type: node.tagName === 'IMG' ? 'IMAGE' : 'FRAME',
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
          opacity: Number(style.opacity),
          backgroundColor: style.backgroundColor,
          children: []
        });
      });
      return root;
    }

    static async _triggerDownload(blob, filename) {
      try {
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          try {
            const res = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ action: 'download-file', url: dataUrl, filename }, (r) => {
                const err = chrome.runtime.lastError;
                if (err) resolve(null);
                else resolve(r);
              });
            });
            if (res && res.success) return;
          } catch (e) {
            // fallback to DOM link click
          }
        }

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        logger.error('Download failed', e);
      }
    }
  }

  global.LobnhoPageExporter = LobnhoPageExporter;
})(typeof window !== 'undefined' ? window : globalThis);
