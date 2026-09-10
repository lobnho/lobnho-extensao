/**
 * Lobnho Extension - Theme Exporter
 * Extracts structured theme tokens, CSS custom properties (:root), and Tailwind configuration.
 */
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
      if (global.LobnhoBrowser && global.LobnhoBrowser.runtime && global.LobnhoBrowser.runtime.sendMessage) {
        try {
          const response = await global.LobnhoBrowser.runtime.sendMessage({
            action: 'download-file',
            url: dataUrl,
            filename
          });
          downloaded = Boolean(response && response.success);
        } catch {
          downloaded = false;
        }
      }

      if (!downloaded) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      return themeData;
    }

    static extractTheme(doc = document) {
      const colorMap = new Map();
      const fontFamilies = new Set();
      const fontSizes = new Map();
      const buttonStyles = [];
      const containerMaxWidths = new Set();
      const gradients = new Set();

      const allElements = Array.from(doc.querySelectorAll('*'));
      const sampleSize = Math.min(allElements.length, 600);

      const trackColor = (colorStr, type) => {
        if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return;
        const normalized = colorStr.toLowerCase();
        if (!colorMap.has(normalized)) colorMap.set(normalized, { color: normalized, count: 0, types: new Set() });
        const item = colorMap.get(normalized);
        item.count++;
        item.types.add(type);
      };

      for (let i = 0; i < sampleSize; i++) {
        const el = allElements[i];
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'SVG') continue;

        const style = window.getComputedStyle(el);
        if (!style || style.display === 'none' || style.visibility === 'hidden') continue;

        trackColor(style.color, 'text');
        trackColor(style.backgroundColor, 'bg');
        trackColor(style.borderColor, 'border');

        if (style.backgroundImage && style.backgroundImage.includes('gradient')) {
          gradients.add(style.backgroundImage);
        }

        if (style.fontFamily) {
          style.fontFamily.split(',').forEach((f) => {
            const clean = f.trim().replace(/^['"]|['"]$/g, '');
            if (clean) fontFamilies.add(clean);
          });
        }

        const tag = el.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag) || tag === 'body' || tag === 'p') {
          fontSizes.set(tag, {
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            fontFamily: style.fontFamily
          });
        }

        if (tag === 'button' || el.getAttribute('role') === 'button' || (tag === 'a' && (el.className || '').toString().includes('btn'))) {
          if (buttonStyles.length < 5) {
            buttonStyles.push({
              tag,
              class: el.className ? String(el.className).substring(0, 50) : '',
              background: style.backgroundColor,
              color: style.color,
              padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
              borderRadius: style.borderRadius,
              border: `${style.borderWidth} ${style.borderStyle} ${style.borderColor}`,
              boxShadow: style.boxShadow !== 'none' ? style.boxShadow : null,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight
            });
          }
        }

        if (style.maxWidth && style.maxWidth !== 'none' && style.maxWidth !== '100%') {
          containerMaxWidths.add(style.maxWidth);
        }
      }

      const sortedColors = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);

      const bgColors = sortedColors.filter((c) => c.types.has('bg'));
      const textColors = sortedColors.filter((c) => c.types.has('text'));
      const borderList = sortedColors.filter((c) => c.types.has('border'));

      const bgColor = bgColors[0] ? bgColors[0].color : '#ffffff';
      const surfaceColor = bgColors[1] ? bgColors[1].color : '#f8f9fa';
      const primaryColor = bgColors.find((c) => c.color !== '#ffffff' && c.color !== '#000000' && c.color !== 'rgb(255, 255, 255)' && c.color !== 'rgb(0, 0, 0)')?.color || '#ff00f6';
      const secondaryColor = bgColors.find((c) => c.color !== primaryColor && c.color !== bgColor && c.color !== surfaceColor)?.color || '#3b82f6';
      const textColor = textColors[0] ? textColors[0].color : '#111827';
      const textMutedColor = textColors[1] ? textColors[1].color : '#6b7280';
      const borderColor = borderList[0] ? borderList[0].color : '#e5e7eb';

      const palette = {
        background: bgColor,
        surface: surfaceColor,
        primary: primaryColor,
        secondary: secondaryColor,
        text: textColor,
        textMuted: textMutedColor,
        border: borderColor,
        gradients: Array.from(gradients).slice(0, 5)
      };

      const typography = {
        fontFamilies: Array.from(fontFamilies),
        scale: {
          h1: fontSizes.get('h1') || { fontSize: '2.25rem', fontWeight: '700' },
          h2: fontSizes.get('h2') || { fontSize: '1.875rem', fontWeight: '700' },
          h3: fontSizes.get('h3') || { fontSize: '1.5rem', fontWeight: '600' },
          h4: fontSizes.get('h4') || { fontSize: '1.25rem', fontWeight: '600' },
          h5: fontSizes.get('h5') || { fontSize: '1.125rem', fontWeight: '600' },
          h6: fontSizes.get('h6') || { fontSize: '1rem', fontWeight: '600' },
          body: fontSizes.get('body') || fontSizes.get('p') || { fontSize: '1rem', fontWeight: '400' }
        }
      };

      const components = {
        buttons: {
          primary: buttonStyles[0] || null,
          secondary: buttonStyles[1] || null
        },
        containers: {
          maxWidths: Array.from(containerMaxWidths).slice(0, 5)
        }
      };

      const cssVariablesLines = [
        ':root {',
        `  --theme-primary: ${palette.primary};`,
        `  --theme-secondary: ${palette.secondary};`,
        `  --theme-background: ${palette.background};`,
        `  --theme-surface: ${palette.surface};`,
        `  --theme-text: ${palette.text};`,
        `  --theme-text-muted: ${palette.textMuted};`,
        `  --theme-border: ${palette.border};`,
        `  --theme-font-family: ${typography.fontFamilies[0] ? `'${typography.fontFamilies[0]}', sans-serif` : 'sans-serif'};`,
        '}'
      ];
      const cssVariablesBlock = cssVariablesLines.join('\n');

      const tailwindConfig = {
        theme: {
          extend: {
            colors: {
              primary: palette.primary,
              secondary: palette.secondary,
              background: palette.background,
              surface: palette.surface,
              textMain: palette.text,
              textMuted: palette.textMuted,
              border: palette.border
            },
            fontFamily: {
              sans: typography.fontFamilies.length ? typography.fontFamilies : ['Inter', 'sans-serif']
            }
          }
        }
      };

      return {
        meta: {
          site: window.location.hostname,
          url: window.location.href,
          extractedAt: new Date().toISOString(),
          generator: 'Lobnho Extension Theme Exporter v1.1.8'
        },
        tokens: {
          palette,
          typography,
          components
        },
        cssVariablesBlock,
        tailwindConfig
      };
    }

    // High-fidelity extractor overrides legacy sampling implementation above.
    static extractTheme(doc = document) {
      const computed = (el) => el ? window.getComputedStyle(el) : null;
      const cleanColor = (value, fallback = null) => {
        if (!value || value === 'transparent' || /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(value)) return fallback;
        const raw = String(value).trim();
        if (!/(oklab|oklch|color\()/i.test(raw)) return raw.toLowerCase();
        try {
          const canvas = doc.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = raw;
          const parsed = ctx.fillStyle;
          if (parsed && !/(oklab|oklch|color\()/i.test(parsed)) return parsed.toLowerCase();
        } catch (_) { /* DOM fallback unavailable */ }
        const probe = doc.createElement('span');
        probe.style.color = raw;
        probe.style.position = 'fixed';
        probe.style.visibility = 'hidden';
        doc.body.appendChild(probe);
        const parsed = computed(probe).color;
        probe.remove();
        return parsed && !/(oklab|oklch|color\()/i.test(parsed) ? parsed.toLowerCase() : fallback;
      };
      const normalizeRadius = (value) => {
        if (!value || value === '0px') return value || '0px';
        return /e[+-]?\d+/i.test(value) || parseFloat(value) >= 999 ? '9999px' : value;
      };
      const cleanShadow = (value) => {
        if (!value || value === 'none') return null;
        const layers = value.split(/,(?![^()]*\))/).map((layer) => layer.trim());
        const visible = layers.filter((layer) => !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)\s+0px\s+0px\s+0px\s+0px/i.test(layer));
        return visible.length ? visible.join(', ') : null;
      };
      const metrics = (style) => ({
        height: style.height,
        minWidth: style.minWidth,
        paddingX: style.paddingLeft,
        paddingY: style.paddingTop
      });
      const styleToken = (el) => {
        const s = computed(el);
        return { background: cleanColor(s.backgroundColor), color: cleanColor(s.color), border: `${s.borderWidth} ${s.borderStyle} ${cleanColor(s.borderColor)}`, borderRadius: normalizeRadius(s.borderRadius), boxShadow: cleanShadow(s.boxShadow), backdropFilter: s.backdropFilter !== 'none' ? s.backdropFilter : null, transitionDuration: s.transitionDuration, transitionTimingFunction: s.transitionTimingFunction, transitionProperty: s.transitionProperty, ...metrics(s) };
      };
      const elements = Array.from(doc.querySelectorAll('*')).filter((el) => { const s = computed(el); return s && s.display !== 'none' && s.visibility !== 'hidden' && !['SCRIPT', 'STYLE', 'SVG'].includes(el.tagName); });
      const body = doc.body;
      const roots = [doc.documentElement, body, doc.querySelector('#__next'), doc.querySelector('main')].filter(Boolean);
      const rootStyles = roots.map(computed).filter(Boolean);
      const bgCandidates = rootStyles.map((s) => cleanColor(s.backgroundColor)).filter(Boolean);
      const darkRoot = rootStyles.find((s) => { const c = cleanColor(s.backgroundColor); return c && !/^rgb\(255, 255, 255\)$|^#fff(?:fff)?$/i.test(c); });
      const colors = new Map();
      const gradients = new Set();
      const addColor = (value, type) => { const color = cleanColor(value); if (!color) return; const item = colors.get(color) || { color, count: 0, types: new Set() }; item.count++; item.types.add(type); colors.set(color, item); };
      elements.slice(0, 1200).forEach((el) => { const s = computed(el); addColor(s.color, 'text'); addColor(s.backgroundColor, 'bg'); addColor(s.borderColor, 'border'); if (s.backgroundImage.includes('gradient')) gradients.add(s.backgroundImage); });
      const sorted = Array.from(colors.values()).sort((a, b) => b.count - a.count);
      const byType = (type) => sorted.filter((x) => x.types.has(type));
      const backgrounds = byType('bg');
      const background = cleanColor(darkRoot && darkRoot.backgroundColor) || bgCandidates.find((c) => c !== '#ffffff' && c !== 'rgb(255, 255, 255)') || backgrounds[0]?.color || '#ffffff';
      const surface = backgrounds.find((x) => x.color !== background)?.color || background;
      const buttons = elements.filter((el) => el.matches('button, [role="button"], a.btn, a[class*="btn"]')).map((el) => ({ element: el, style: styleToken(el) }));
      const uniqueButtons = []; const seenButtons = new Set(); buttons.forEach((item) => { const key = JSON.stringify(item.style); if (!seenButtons.has(key)) { seenButtons.add(key); uniqueButtons.push(item); } });
      const primary = uniqueButtons.sort((a, b) => (b.style.background && b.style.background !== 'rgba(0, 0, 0, 0)' ? 1 : 0) - (a.style.background && a.style.background !== 'rgba(0, 0, 0, 0)' ? 1 : 0))[0]?.style || null;
      const secondary = uniqueButtons.find((item) => JSON.stringify(item.style) !== JSON.stringify(primary))?.style || null;
      const card = elements.filter((el) => /card|panel|tile|surface/i.test(String(el.className))).map((el) => styleToken(el))[0] || null;
      const nav = doc.querySelector('nav, header, [role="navigation"]');
      const scale = {}; ['h1','h2','h3','h4','h5','h6'].forEach((tag) => { const el = doc.querySelector(tag); const s = computed(el); scale[tag] = s ? { fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight } : null; });
      const bodyStyle = computed(body); scale.body = bodyStyle ? { fontSize: bodyStyle.fontSize, lineHeight: bodyStyle.lineHeight, fontWeight: bodyStyle.fontWeight } : null;
      const families = elements.map((el) => computed(el).fontFamily?.split(',')[0].trim().replace(/["']/g, '')).filter(Boolean); const familyCounts = families.reduce((m, f) => m.set(f, (m.get(f) || 0) + 1), new Map()); const brandFont = Array.from(familyCounts.entries()).sort((a,b) => b[1]-a[1])[0]?.[0] || 'sans-serif';
      const transitions = elements.map((el) => computed(el)).filter((s) => s.transitionProperty !== 'none' && s.transitionDuration !== '0s').slice(0, 10).map((s) => ({ property: s.transitionProperty, duration: s.transitionDuration, timingFunction: s.transitionTimingFunction }));
      const keyframes = Array.from(doc.styleSheets).flatMap((sheet) => { try { return Array.from(sheet.cssRules || []).filter((r) => r.type === CSSRule.KEYFRAMES_RULE).map((r) => r.name); } catch (_) { return []; } });
      const palette = { background, surface, primary: backgrounds.find((x) => x.color !== background && x.color !== surface)?.color || '#ff00f6', secondary: backgrounds.find((x) => x.color !== background && x.color !== surface)?.color || '#3b82f6', text: byType('text')[0]?.color || '#111827', textMuted: byType('text')[1]?.color || '#6b7280', border: byType('border')[0]?.color || '#e5e7eb', gradients: Array.from(gradients).slice(0, 10) };
      const typography = { brandFont, fontFamilies: [brandFont], scale };
      const components = { buttons: { primary, secondary }, card, navbar: nav ? { height: computed(nav).height, background: cleanColor(computed(nav).backgroundColor), borderBottom: `${computed(nav).borderBottomWidth} ${computed(nav).borderBottomStyle} ${cleanColor(computed(nav).borderBottomColor)}` } : null, containers: { maxWidths: Array.from(new Set(elements.map((el) => computed(el).maxWidth).filter((v) => v && v !== 'none' && v !== '100%'))).slice(0, 10) } };
      const effects = { glassmorphism: elements.filter((el) => computed(el).backdropFilter !== 'none').slice(0, 10).map((el) => ({ selector: el.tagName.toLowerCase(), backdropFilter: computed(el).backdropFilter })), transitions, keyframes: Array.from(new Set(keyframes)).slice(0, 20) };
      const cssVariablesBlock = `:root {\n  --theme-primary: ${palette.primary};\n  --theme-secondary: ${palette.secondary};\n  --theme-background: ${palette.background};\n  --theme-surface: ${palette.surface};\n  --theme-text: ${palette.text};\n  --theme-text-muted: ${palette.textMuted};\n  --theme-border: ${palette.border};\n  --theme-font-brand: ${brandFont};\n}`;
      const tailwindConfig = { theme: { extend: { colors: { primary: palette.primary, secondary: palette.secondary, background: palette.background, surface: palette.surface, textMain: palette.text, textMuted: palette.textMuted, border: palette.border }, fontFamily: { brand: [brandFont] } } } };
      return { meta: { site: window.location.hostname, url: window.location.href, extractedAt: new Date().toISOString(), generator: 'Lobnho Extension Theme Exporter v1.1.8' }, palette, typography, components, effects, tokens: { palette, typography, components }, cssVariablesBlock, tailwindConfig };
    }
  }

  global.LobnhoThemeExporter = LobnhoThemeExporter;
})(typeof globalThis !== 'undefined' ? globalThis : window);
