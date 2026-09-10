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

      if (global.LobnhoBrowser && global.LobnhoBrowser.downloads && global.LobnhoBrowser.downloads.download) {
        const url = URL.createObjectURL(blob);
        await global.LobnhoBrowser.downloads.download({
          url,
          filename,
          saveAs: true
        });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
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

      const palette = {
        background: bgColors[0] ? bgColors[0].color : '#ffffff',
        surface: bgColors[1] ? bgColors[1].color : '#f8f9fa',
        primary: bgColors.find((c) => c.color !== '#ffffff' && c.color !== '#000000' && c.color !== 'rgb(255, 255, 255)' && c.color !== 'rgb(0, 0, 0)')?.color || '#ff00f6',
        secondary: bgColors.find((c) => c.color !== palette.primary && c.color !== palette.background && c.color !== palette.surface)?.color || '#3b82f6',
        text: textColors[0] ? textColors[0].color : '#111827',
        textMuted: textColors[1] ? textColors[1].color : '#6b7280',
        border: borderList[0] ? borderList[0].color : '#e5e7eb',
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
  }

  global.LobnhoThemeExporter = LobnhoThemeExporter;
})(typeof globalThis !== 'undefined' ? globalThis : window);
