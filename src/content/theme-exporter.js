(function (global) {
  'use strict';

  class LobnhoThemeExporter {
    static async exportTheme() {
      const hostname = window.location.hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'site';
      const themeData = this.extractTheme(document);
      const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
      const filename = `${hostname}-theme.json`;
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not encode theme file'));
        reader.readAsDataURL(blob);
      });
      let downloaded = false;
      if (global.LobnhoBrowser?.runtime?.sendMessage) {
        try { downloaded = Boolean((await global.LobnhoBrowser.runtime.sendMessage({ action: 'download-file', url: dataUrl, filename }))?.success); } catch (_) { downloaded = false; }
      }
      if (!downloaded) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      return themeData;
    }

    static extractTheme(doc = document) {
      const computed = (element) => element ? window.getComputedStyle(element) : null;
      const genericFonts = new Set(['ui-sans-serif', 'ui-serif', 'ui-monospace', 'system-ui', 'sans-serif', 'serif', 'monospace', 'arial', 'helvetica', 'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji']);
      const normalizeColor = (value) => {
        if (!value || value === 'transparent' || /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(value)) return null;
        const raw = String(value).trim();
        if (!/(oklab|oklch|color\()/i.test(raw)) return raw.toLowerCase();
        try {
          const canvas = doc.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) {
            context.fillStyle = raw;
            if (context.fillStyle && !/(oklab|oklch|color\()/i.test(context.fillStyle)) return context.fillStyle.toLowerCase();
          }
        } catch (_) { /* unsupported color syntax */ }
        return null;
      };
      const normalizeRadius = (value) => !value ? '0px' : (/e[+-]?\d+/i.test(value) || parseFloat(value) >= 999 ? '9999px' : value);
      const normalizeShadow = (value) => {
        if (!value || value === 'none') return null;
        const layers = value.split(/,(?![^()]*\))/).map((layer) => layer.trim());
        const visible = layers.filter((layer) => !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)\s+0px\s+0px\s+0px\s+0px/i.test(layer));
        return visible.length ? visible.join(', ') : null;
      };
      const token = (element) => {
        const style = computed(element);
        return {
          background: normalizeColor(style.backgroundColor),
          color: normalizeColor(style.color),
          border: `${style.borderWidth} ${style.borderStyle} ${normalizeColor(style.borderColor)}`,
          borderRadius: normalizeRadius(style.borderRadius),
          boxShadow: normalizeShadow(style.boxShadow),
          height: style.height,
          minHeight: style.minHeight,
          minWidth: style.minWidth,
          display: style.display,
          gap: style.gap,
          padding: style.padding,
          paddingX: style.paddingLeft,
          paddingY: style.paddingTop,
          transition: style.transition,
          backdropFilter: style.backdropFilter !== 'none' ? style.backdropFilter : null
        };
      };
      const empty = { meta: { site: '', url: '', extractedAt: new Date().toISOString(), generator: 'Lobnho Extension Theme Exporter v1.1.8' }, palette: {}, typography: {}, components: {}, effects: {}, tokens: {} };
      if (!doc.body) return empty;
      const elements = Array.from(doc.querySelectorAll('*')).filter((element) => {
        const style = computed(element);
        return style && style.display !== 'none' && style.visibility !== 'hidden' && !['SCRIPT', 'STYLE', 'SVG'].includes(element.tagName);
      });
      const roots = [doc.documentElement, doc.body, doc.querySelector('main'), doc.querySelector('#root'), doc.querySelector('#__next'), ...Array.from(doc.body.children)].filter(Boolean);
      const rootColors = roots.map((element) => normalizeColor(computed(element)?.backgroundColor)).filter(Boolean);
      const background = rootColors.find((color) => !/^#(?:fff|ffffff)$|^rgb\(255,\s*255,\s*255\)$/i.test(color)) || rootColors[0] || '#ffffff';
      const counts = new Map();
      const gradients = new Set();
      elements.forEach((element) => {
        const style = computed(element);
        for (const color of [normalizeColor(style.backgroundColor), normalizeColor(style.color), normalizeColor(style.borderColor)]) if (color) counts.set(color, (counts.get(color) || 0) + 1);
        if (style.backgroundImage && style.backgroundImage !== 'none') gradients.add(style.backgroundImage);
      });
      const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([color]) => color);
      const text = ranked.find((color) => color !== background) || '#111827';
      const primary = ranked.find((color) => color !== background && color !== text) || '#ff00f6';
      const secondary = ranked.find((color) => color !== background && color !== text && color !== primary) || '#3b82f6';
      const surface = rootColors.find((color) => color !== background) || ranked.find((color) => color !== background) || '#ffffff';
      const buttons = elements.filter((element) => element.matches('button, a[role="button"], input[type="button"], input[type="submit"], [class*="button"], [class*="btn"]')).slice(0, 20).map((element) => ({ selector: element.tagName.toLowerCase(), style: token(element) }));
      const uniqueButtons = [...new Map(buttons.map((item) => [JSON.stringify(item.style), item])).values()];
      const cards = elements.filter((element) => /card|panel|tile|surface|rounded-(xl|2xl)/i.test(`${element.className} ${element.getAttribute('data-testid') || ''}`)).slice(0, 10).map(token);
      const card = cards.find((item) => item.background || item.border || item.backdropFilter) || null;
      const families = elements.map((element) => computed(element)?.fontFamily?.split(',').map((font) => font.trim().replace(/["']/g, '')).find((font) => font && !genericFonts.has(font.toLowerCase()))).filter(Boolean);
      const familyCounts = families.reduce((map, family) => map.set(family, (map.get(family) || 0) + 1), new Map());
      const brandFont = [...familyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'sans-serif';
      const scale = Object.fromEntries(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((tag) => { const style = computed(doc.querySelector(tag)); return [tag, style ? { fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight } : null]; }));
      const nav = doc.querySelector('nav, header, [role="navigation"]');
      const palette = { background, surface, primary, secondary, text, textMuted: ranked.find((color) => color !== text) || '#6b7280', border: ranked.find((color) => color !== text && color !== primary) || '#e5e7eb', gradients: [...gradients].slice(0, 10) };
      const typography = { brandFont, fontFamilies: [...new Set(families)].slice(0, 20), scale };
      const components = { buttons: { primary: uniqueButtons[0]?.style || null, secondary: uniqueButtons[1]?.style || null }, cards: card ? { ...card, padding: card.padding } : null, card, navbar: nav ? token(nav) : null };
      const effects = { glassmorphism: elements.filter((element) => computed(element).backdropFilter !== 'none').slice(0, 10).map((element) => ({ selector: element.tagName.toLowerCase(), backdropFilter: computed(element).backdropFilter })), transitions: elements.filter((element) => computed(element).transition !== 'all 0s ease 0s').slice(0, 20).map((element) => computed(element).transition), keyframes: [] };
      const cssVariablesBlock = `:root {\n  --theme-primary: ${primary};\n  --theme-secondary: ${secondary};\n  --theme-background: ${background};\n  --theme-surface: ${surface};\n  --theme-text: ${text};\n  --theme-text-muted: ${palette.textMuted};\n  --theme-border: ${palette.border};\n  --theme-font-brand: ${brandFont};\n}`;
      const tailwindConfig = { theme: { extend: { colors: { primary, secondary, background, surface, textMain: text, textMuted: palette.textMuted, border: palette.border }, fontFamily: { brand: [brandFont] } } } };
      return { meta: { site: window.location.hostname, url: window.location.href, extractedAt: new Date().toISOString(), generator: 'Lobnho Extension Theme Exporter v1.1.8' }, palette, typography, components, effects, tokens: { palette, typography, components }, cssVariablesBlock, tailwindConfig };
    }
  }

  global.LobnhoThemeExporter = LobnhoThemeExporter;
})(typeof globalThis !== 'undefined' ? globalThis : window);
