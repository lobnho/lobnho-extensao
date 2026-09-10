(function (global) {
  'use strict';

  class LobnhoThemeExporter {
    static async exportTheme() {
      const hostname = window.location.hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'site';
      const themeData = this.extractTheme(document);
      const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
      const filename = `${hostname}-theme.json`;
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error || new Error('Could not encode theme file')); reader.readAsDataURL(blob); });
      let downloaded = false;
      if (global.LobnhoBrowser?.runtime?.sendMessage) { try { downloaded = Boolean((await global.LobnhoBrowser.runtime.sendMessage({ action: 'download-file', url: dataUrl, filename }))?.success); } catch (_) { downloaded = false; } }
      if (!downloaded) { const link = document.createElement('a'); link.href = dataUrl; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); }
      return themeData;
    }

    static extractTheme(doc = document) {
      const computed = (element) => element ? window.getComputedStyle(element) : null;
      const genericFonts = new Set(['ui-sans-serif', 'ui-serif', 'ui-monospace', 'system-ui', 'sans-serif', 'serif', 'monospace', 'arial', 'helvetica', 'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji']);
      const clamp = (value) => Math.min(1, Math.max(0, value));
      const oklabToSrgb = (lightness, a, b) => {
        const l = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
        const m = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
        const s = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3);
        const channels = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(clamp);
        const encode = (channel) => Math.round(255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055));
        return `rgb(${channels.map(encode).join(', ')})`;
      };
      const normalizeColor = (value) => {
        if (!value || value === 'transparent' || /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(value)) return null;
        const raw = String(value).trim();
        if (!/(oklab|oklch|color\()/i.test(raw)) return raw.toLowerCase();
        try { const context = doc.createElement('canvas').getContext('2d'); if (context) { context.fillStyle = raw; if (context.fillStyle && !/(oklab|oklch|color\()/i.test(context.fillStyle)) return context.fillStyle.toLowerCase(); } } catch (_) { /* unsupported syntax */ }
        const match = raw.match(/oklab\(\s*([\d.]+)%?\s+([-\d.]+)\s+([-\d.]+)(?:\s*\/\s*([\d.]+)%?)?/i);
        return match ? oklabToSrgb(Number(match[1]) > 1 ? Number(match[1]) / 100 : Number(match[1]), Number(match[2]), Number(match[3])) : null;
      };
      const normalizeRadius = (value) => { if (!value) return '0px'; const raw = String(value).trim(); return /e[+-]?\d+/i.test(raw) || parseFloat(raw) >= 256 ? '9999px' : raw; };
      const normalizeShadow = (value) => { if (!value || value === 'none') return null; const layers = value.split(/,(?![^()]*\))/).map((layer) => layer.trim()); const visible = layers.filter((layer) => !/(?:rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|transparent)\s+0(?:px)?\s+0(?:px)?\s+0(?:px)?(?:\s+0(?:px)?)?/i.test(layer)); return visible.length ? visible.join(', ') : null; };
      const token = (element) => { const style = computed(element); return { background: normalizeColor(style.backgroundColor), color: normalizeColor(style.color), border: `${style.borderWidth} ${style.borderStyle} ${normalizeColor(style.borderColor)}`, borderRadius: normalizeRadius(style.borderRadius), boxShadow: normalizeShadow(style.boxShadow), height: style.height, minHeight: style.minHeight, minWidth: style.minWidth, display: style.display, gap: style.gap, padding: style.padding, paddingX: style.paddingLeft, paddingY: style.paddingTop, transition: style.transition, backdropFilter: style.backdropFilter !== 'none' ? style.backdropFilter : null }; };
      const empty = { meta: { site: '', url: '', extractedAt: new Date().toISOString(), generator: 'Lobnho Extension Theme Exporter v1.1.8' }, palette: {}, typography: {}, components: {}, effects: {}, tokens: {} };
      if (!doc.body) return empty;
      const elements = Array.from(doc.querySelectorAll('*')).filter((element) => { const style = computed(element); return style && style.display !== 'none' && style.visibility !== 'hidden' && !['SCRIPT', 'STYLE', 'SVG'].includes(element.tagName); });
      const roots = [doc.documentElement, doc.body, doc.querySelector('main'), doc.querySelector('#root'), doc.querySelector('#__next'), ...Array.from(doc.body.children), ...elements.filter((element) => { const rect = element.getBoundingClientRect(); return rect.width >= window.innerWidth * 0.55 && rect.height >= window.innerHeight * 0.35; })].filter(Boolean);
      const luminance = (color) => { const rgb = String(color).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i); if (rgb) return (0.2126 * Number(rgb[1]) + 0.7152 * Number(rgb[2]) + 0.0722 * Number(rgb[3])) / 255; const hex = String(color).match(/^#([0-9a-f]{3,8})$/i)?.[1]; if (hex) { const value = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex; return (0.2126 * parseInt(value.slice(0, 2), 16) + 0.7152 * parseInt(value.slice(2, 4), 16) + 0.0722 * parseInt(value.slice(4, 6), 16)) / 255; } return 0.5; };
      const rootColors = roots.map((element) => normalizeColor(computed(element)?.backgroundColor)).filter(Boolean);
      const background = rootColors.find((color) => luminance(color) < 0.22) || rootColors.find((color) => luminance(color) < 0.45) || rootColors[0] || '#ffffff';
      const counts = new Map(); const gradients = new Set();
      elements.forEach((element) => { const style = computed(element); [normalizeColor(style.backgroundColor), normalizeColor(style.color), normalizeColor(style.borderColor)].filter(Boolean).forEach((color) => counts.set(color, (counts.get(color) || 0) + 1)); if (style.backgroundImage?.includes('gradient')) gradients.add(style.backgroundImage); });
      const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([color]) => color);
      const text = ranked.find((color) => color !== background) || '#111827'; const primary = ranked.find((color) => color !== background && color !== text) || '#ff00f6'; const secondary = ranked.find((color) => color !== background && color !== text && color !== primary) || '#3b82f6'; const surface = rootColors.find((color) => color !== background) || ranked.find((color) => color !== background) || '#ffffff';
      const buttonElements = elements.filter((element) => element.matches('button, a[role="button"], input[type="button"], input[type="submit"], [class*="button"], [class*="btn"]'));
      const buttonStyles = [...new Map(buttonElements.slice(0, 30).map((element) => { const style = token(element); return [JSON.stringify(style), style]; })).values()];
      const primaryButton = buttonStyles.find((style) => style.background && luminance(style.background) !== luminance(background)) || buttonStyles[0] || null;
      const secondaryButton = buttonStyles.find((style) => JSON.stringify(style) !== JSON.stringify(primaryButton) && (style.border || style.background !== primaryButton?.background)) || buttonStyles[1] || null;
      const cardElements = elements.filter((element) => /card|panel|tile|surface|container|rounded-(xl|2xl)/i.test(`${element.className} ${element.getAttribute('data-testid') || ''}`));
      const cards = cardElements.slice(0, 15).map((element) => ({ selector: element.tagName.toLowerCase(), style: token(element) })); const card = cards.find((item) => item.style.background || item.style.border || item.style.backdropFilter)?.style || null;
      const families = elements.flatMap((element) => (computed(element)?.fontFamily || '').split(',').map((font) => font.trim().replace(/["']/g, '')).filter((font) => font && !genericFonts.has(font.toLowerCase()))); const familyCounts = families.reduce((map, family) => map.set(family, (map.get(family) || 0) + 1), new Map()); const brandFont = [...familyCounts.keys()].find((family) => /jura|monument|bebas|orbitron|space\s*grotesk|inter|poppins|montserrat/i.test(family)) || [...familyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'sans-serif';
      const scale = Object.fromEntries(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((tag) => { const style = computed(doc.querySelector(tag)); return [tag, style ? { fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight } : null]; })); const nav = doc.querySelector('nav, header, [role="navigation"]');
      const palette = { background, surface, primary, secondary, text, textMuted: ranked.find((color) => color !== text) || '#6b7280', border: ranked.find((color) => color !== text && color !== primary) || '#e5e7eb', gradients: [...gradients].slice(0, 10) }; const typography = { brandFont, fontFamilies: [...new Set(families)].slice(0, 20), scale }; const components = { buttons: { primary: primaryButton, secondary: secondaryButton, variants: buttonStyles }, cards, card, navbar: nav ? token(nav) : null }; const effects = { glassmorphism: elements.filter((element) => computed(element).backdropFilter !== 'none').slice(0, 10).map((element) => ({ selector: element.tagName.toLowerCase(), backdropFilter: computed(element).backdropFilter })), transitions: elements.filter((element) => computed(element).transition !== 'all 0s ease 0s').slice(0, 20).map((element) => computed(element).transition), keyframes: [] };
      const cssVariablesBlock = `:root {\n  --theme-primary: ${primary};\n  --theme-secondary: ${secondary};\n  --theme-background: ${background};\n  --theme-surface: ${surface};\n  --theme-text: ${text};\n  --theme-text-muted: ${palette.textMuted};\n  --theme-border: ${palette.border};\n  --theme-font-brand: ${brandFont};\n}`; const tailwindConfig = { theme: { extend: { colors: { primary, secondary, background, surface, textMain: text, textMuted: palette.textMuted, border: palette.border }, fontFamily: { brand: [brandFont] } } } };
      return { meta: { site: window.location.hostname, url: window.location.href, extractedAt: new Date().toISOString(), generator: 'Lobnho Extension Theme Exporter v1.1.8' }, palette, typography, components, effects, tokens: { palette, typography, components }, cssVariablesBlock, tailwindConfig };
    }
  }
  global.LobnhoThemeExporter = LobnhoThemeExporter;
})(typeof globalThis !== 'undefined' ? globalThis : window);
