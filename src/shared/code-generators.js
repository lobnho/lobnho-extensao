/**
 * Lobnho Extension - Code Generators
 * Generates React JSX, Tailwind CSS, SVG Vector, and GSAP code from live DOM elements.
 */
(function (global) {
  'use strict';

  function camelCase(prop) {
    return prop.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function parseStyleString(styleStr) {
    if (!styleStr || typeof styleStr !== 'string') return {};
    const obj = {};
    const declarations = styleStr.split(';');
    for (const decl of declarations) {
      const trimmed = decl.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const key = camelCase(trimmed.slice(0, colonIdx).trim());
      const val = trimmed.slice(colonIdx + 1).trim();
      if (key && val) {
        obj[key] = val;
      }
    }
    return obj;
  }

  const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

  function nodeToJsx(node, depth = 0) {
    const indent = '  '.repeat(depth);

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      return text ? `${indent}${text}\n` : '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tagName = node.tagName.toLowerCase();
    const attrs = [];

    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      let name = attr.name;
      let value = attr.value;

      if (name === 'class') {
        name = 'className';
      } else if (name === 'for') {
        name = 'htmlFor';
      } else if (name === 'style') {
        const styleObj = parseStyleString(value);
        attrs.push(`style={${JSON.stringify(styleObj)}}`);
        continue;
      } else if (name.includes('-') && !name.startsWith('data-') && !name.startsWith('aria-')) {
        name = camelCase(name);
      }

      attrs.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
    }

    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

    if (VOID_ELEMENTS.has(tagName) || (!node.hasChildNodes() && tagName !== 'script' && tagName !== 'div' && tagName !== 'span')) {
      return `${indent}<${tagName}${attrStr} />\n`;
    }

    let childrenStr = '';
    for (const child of node.childNodes) {
      childrenStr += nodeToJsx(child, depth + 1);
    }

    if (!childrenStr.trim()) {
      return `${indent}<${tagName}${attrStr}></${tagName}>\n`;
    }

    return `${indent}<${tagName}${attrStr}>\n${childrenStr}${indent}</${tagName}>\n`;
  }

  function htmlToReactJsx(element) {
    if (!element) return '// No element selected';
    const componentName = (element.id ? camelCase(element.id) : element.tagName.toLowerCase()) + 'Component';
    const capitalizedName = componentName.charAt(0).toUpperCase() + componentName.slice(1);

    const jsxBody = nodeToJsx(element, 2);

    return `import React from 'react';

export default function ${capitalizedName}() {
  return (
${jsxBody}  );
}`;
  }

  function cssToTailwind(element) {
    if (!element || typeof window === 'undefined') return '';
    const style = window.getComputedStyle(element);
    const classes = [];

    // Display & Layout
    if (style.display === 'flex') {
      classes.push('flex');
      if (style.flexDirection === 'column') classes.push('flex-col');
      if (style.alignItems === 'center') classes.push('items-center');
      if (style.justifyContent === 'center') classes.push('justify-center');
      else if (style.justifyContent === 'space-between') classes.push('justify-between');
      else if (style.justifyContent === 'flex-end') classes.push('justify-end');
      if (style.gap && style.gap !== 'normal' && style.gap !== '0px') classes.push(`gap-[${style.gap}]`);
    } else if (style.display === 'grid') {
      classes.push('grid');
    } else if (style.display === 'inline-block') {
      classes.push('inline-block');
    } else if (style.display === 'none') {
      classes.push('hidden');
    }

    // Position
    if (style.position === 'absolute') classes.push('absolute');
    else if (style.position === 'relative') classes.push('relative');
    else if (style.position === 'fixed') classes.push('fixed');

    // Box Model
    if (style.padding && style.padding !== '0px') {
      classes.push(`p-[${style.paddingTop}]`);
    }
    if (style.margin && style.margin !== '0px') {
      classes.push(`m-[${style.marginTop}]`);
    }
    if (style.borderRadius && style.borderRadius !== '0px') {
      classes.push(`rounded-[${style.borderRadius}]`);
    }

    // Colors & Typography
    if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      classes.push(`bg-[${style.backgroundColor}]`);
    }
    if (style.color) {
      classes.push(`text-[${style.color}]`);
    }
    if (style.fontSize) {
      classes.push(`text-[${style.fontSize}]`);
    }
    if (style.fontWeight >= 700) {
      classes.push('font-bold');
    } else if (style.fontWeight >= 600) {
      classes.push('font-semibold');
    } else if (style.fontWeight >= 500) {
      classes.push('font-medium');
    }

    // Shadows & Borders
    if (style.boxShadow && style.boxShadow !== 'none') {
      classes.push('shadow-md');
    }
    if (style.borderWidth && style.borderWidth !== '0px') {
      classes.push(`border-[${style.borderWidth}]`);
      if (style.borderColor) classes.push(`border-[${style.borderColor}]`);
    }

    return classes.join(' ');
  }

  function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function parseCssColorToSvgAttrs(colorStr, fillOrStroke = 'fill') {
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
    return `${fillOrStroke}="${escapeXml(colorStr)}"`;
  }

  function elementToSvg(element) {
    if (!element || typeof window === 'undefined') {
      return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"></svg>';
    }

    const rootRect = element.getBoundingClientRect();
    const width = Math.max(1, Math.round(rootRect.width));
    const height = Math.max(1, Math.round(rootRect.height));

    let bodyContent = '';

    function traverse(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

      if (node.id === 'lobnho-target-cursor-host' || node.id === 'lobnho-inspector-host') return;

      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

      const rect = node.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w <= 0 || h <= 0) return;

      const x = Math.round(rect.left - rootRect.left);
      const y = Math.round(rect.top - rootRect.top);

      const bgAttr = parseCssColorToSvgAttrs(style.backgroundColor, 'fill');
      const borderRadius = parseFloat(style.borderRadius) || 0;
      const borderWidth = parseFloat(style.borderWidth) || 0;
      const strokeAttr = borderWidth > 0 ? `${parseCssColorToSvgAttrs(style.borderColor, 'stroke')} stroke-width="${borderWidth}"` : '';

      let groupContent = '';

      if (bgAttr !== 'fill="none"' || strokeAttr) {
        groupContent += `    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${borderRadius}" ${bgAttr} ${strokeAttr} />\n`;
      }

      if (node.tagName.toLowerCase() === 'img' && node.src) {
        const escapedSrc = escapeXml(node.src);
        groupContent += `    <image href="${escapedSrc}" xlink:href="${escapedSrc}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" />\n`;
      }

      if (node.childNodes.length > 0) {
        for (const child of node.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            const rawText = child.textContent ? child.textContent.trim() : '';
            if (rawText) {
              const textEscaped = escapeXml(rawText.replace(/[\r\n\t]+/g, ' '));
              const fillAttr = parseCssColorToSvgAttrs(style.color, 'fill');
              const fontSize = parseFloat(style.fontSize) || 14;
              const fontFamily = style.fontFamily ? escapeXml(style.fontFamily) : 'sans-serif';
              const fontWeight = style.fontWeight || '400';
              groupContent += `    <text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}px" font-weight="${fontWeight}" ${fillAttr} dominant-baseline="text-before-edge">${textEscaped}</text>\n`;
            }
          }
        }
      }

      if (groupContent) {
        const nodeId = node.id ? ` id="${escapeXml(node.id)}"` : '';
        const nodeClass = node.className && typeof node.className === 'string' ? ` class="${escapeXml(node.className.trim().slice(0, 40))}"` : '';
        bodyContent += `  <g${nodeId}${nodeClass}>\n${groupContent}  </g>\n`;
      }

      for (const child of node.children) {
        traverse(child);
      }
    }

    traverse(element);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- Exported via Lobnho Extension for Figma & Vector Editors -->
${bodyContent}</svg>`;
  }

  function generateGsapCode(element) {
    if (!element || typeof window === 'undefined') return '// No element selected';
    const style = window.getComputedStyle(element);
    const selector = element.id ? `#${element.id}` : (element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/)[0]}` : element.tagName.toLowerCase());

    const hasTransition = style.transition && style.transition !== 'all 0s ease 0s' && style.transition !== 'none';
    const duration = hasTransition ? 0.4 : 0.6;

    return `// GSAP Animation snippet for ${selector}
gsap.to("${selector}", {
  duration: ${duration},
  opacity: 1,
  scale: 1.05,
  y: -4,
  ease: "power2.out",
  boxShadow: "0 8px 24px rgba(237, 37, 144, 0.25)"
});`;
  }

  global.LobnhoCodeGenerators = {
    htmlToReactJsx,
    cssToTailwind,
    elementToSvg,
    generateGsapCode,
    parseStyleString
  };
})(typeof window !== 'undefined' ? window : globalThis);
