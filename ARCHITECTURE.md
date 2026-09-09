# Lobnho Extension — Architecture Specification

This document provides the in-depth architectural and technical blueprint for the Lobnho Extension.

---

## 1. System Overview & MV3 Lifecycle

The extension is structured around Manifest V3 standards with a cross-browser compatibility adapter (`browser-api.js`) supporting Chromium browsers (Thorium, Brave, Chrome, Edge, Opera) and Firefox WebExtensions.

```
┌─────────────────────────────────────────────────────────────────┐
│                       Host Web Page                             │
│                                                                 │
│   ┌───────────────────────────┐   ┌───────────────────────────┐ │
│   │ Shadow DOM Host:          │   │ Shadow DOM Host:          │ │
│   │ #lobnho-target-cursor-host│   │ #lobnho-inspector-host    │ │
│   │                           │   │                           │ │
│   │ • React Bits TargetCursor │   │ • Orkut Multi-Tab Modal   │ │
│   │ • 4 Snapping Corners      │   │ • 8 Inspection Tabs       │ │
│   │ • GSAP Precision Ticker   │   │ • Context-Aware Copy      │ │
│   └─────────────┬─────────────┘   └─────────────▲─────────────┘ │
│                 │                               │               │
│                 └───────────────┬───────────────┘               │
│                                 ▼                               │
│                   ┌───────────────────────────┐                 │
│                   │ content-main.js (Bridge)  │                 │
│                   │ • Event delegation        │                 │
│                   │ • Page Exporter Engine    │                 │
│                   └─────────────┬─────────────┘                 │
└─────────────────────────────────┼───────────────────────────────┘
                                  │ Chrome Runtime Messaging
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Background Service Worker                     │
│                   (src/background/service-worker.js)            │
│  • Extension Command Shortcuts (Alt+Shift+L)                    │
│  • File Download Dispatcher (SVG, JSON, HTML)                   │
│  • Tab State & Badge Management                                 │
└─────────────────────────────────▲───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Popup Dashboard                            │
│                      (src/popup/popup.html)                     │
│  • Orkut Retro Dashboard & Status                               │
│  • Tracker Activation / Deactivation Button                     │
│  • 1-Click Page Export Trigger                                  │
│  • Diagnostics & Scrapbook Logs Drawer                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Shadow DOM Isolation Strategy

To prevent CSS collisions between the target host website and the extension UI:
1. **Target Cursor Root**:
   - Container: `div#lobnho-target-cursor-host` attached directly to `document.documentElement` (or `document.body`).
   - Shadow Root: `attachShadow({ mode: 'open' })`.
   - Styles: Scoped entirely inside the shadow root. Includes `pointer-events: none;`, `position: fixed;`, and `z-index: 2147483647;`.
2. **Inspector Modal Root**:
   - Container: `div#lobnho-inspector-host`.
   - Shadow Root: `attachShadow({ mode: 'open' })`.
   - Scoped reset styles (`all: initial; font-family: 'Trebuchet MS', Verdana, Arial, sans-serif;`).
   - No external page styles bleed into the modal, and no modal rules leak into the target page.

---

## 3. Precision Target Cursor Tracker (React Bits Adaptation)

### 3.1 Mathematical Offset Model
A CSS `position: fixed` element is relative to the viewport unless an ancestor establishes a containing block (`transform`, `perspective`, `filter`, `will-change`, or `contain`). When this occurs, the cursor's coordinates drift.
The algorithm resolves this via recursive ancestor traversal:

```javascript
function getContainingBlock(element) {
  let node = element?.parentElement;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (
      style.transform !== 'none' ||
      style.perspective !== 'none' ||
      style.filter !== 'none' ||
      style.willChange.includes('transform') ||
      style.willChange.includes('perspective') ||
      style.willChange.includes('filter') ||
      /paint|layout|strict|content/.test(style.contain)
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function getContainingBlockOffset(block) {
  if (!block) return { x: 0, y: 0 };
  const rect = block.getBoundingClientRect();
  return { x: rect.left + block.clientLeft, y: rect.top + block.clientTop };
}
```

### 3.2 Corner Snapping & Animation Lifecycle
- **Idle State**: Cursor rotates continuously 360° at 2-second period. Center dot is white (`#ffffff`).
- **Hover Target Detected**:
  - Rotation pauses gracefully (`spinTl.pause()`).
  - Corners recalculate target coordinate matrix based on `target.getBoundingClientRect()`:
    - `corner-tl`: `(rect.left - borderWidth - offsetX, rect.top - borderWidth - offsetY)`
    - `corner-tr`: `(rect.right + borderWidth - cornerSize - offsetX, rect.top - borderWidth - offsetY)`
    - `corner-br`: `(rect.right + borderWidth - cornerSize - offsetX, rect.bottom + borderWidth - cornerSize - offsetY)`
    - `corner-bl`: `(rect.left - borderWidth - offsetX, rect.bottom + borderWidth - cornerSize - offsetY)`
  - Corner borders and center dot animate to Orkut Magenta (`#ED2590`).
  - Active strength linearly ramps to 1 using GSAP ticker.
- **Click Selection**:
  - Dot scales down to 0.7 on mousedown, springs to 1 on mouseup.
  - Triggers selection event: passes selected element reference to the Inspector Modal.
  - Tracker pauses while inspector is open.

---

## 4. Multi-Format Page Export Engine (`page-exporter.js`)

To enable designers and developers to open, edit, and inspect full web pages across diverse software (Figma, Adobe Illustrator, Adobe Photoshop, web browsers), the engine generates three formats:

### 4.1 Multi-Layer SVG Document (`page-vector.svg`)
- **Compatibility**: Natively openable in Figma (drag and drop), Adobe Illustrator, Photoshop, Affinity Designer, Inkscape.
- **Algorithm**:
  1. Computes total page bounds (`scrollWidth`, `scrollHeight`).
  2. Creates root `<svg xmlns="http://www.w3.org/2000/svg" width="..." height="..." viewBox="...">`.
  3. Traverses DOM tree recursively filtering hidden elements (`display: none`, `visibility: hidden`, `opacity: 0`, or 0x0 rect).
  4. For each element:
     - Calculates absolute coordinates relative to document origin.
     - Creates a group `<g id="..." class="...">`.
     - Renders background fill & borders as `<rect x="..." y="..." width="..." height="..." rx="..." fill="..." stroke="..." />`.
     - Extracts text nodes and renders `<text x="..." y="..." font-family="..." font-size="..." font-weight="..." fill="...">`.
     - Extracts `<img>` and converts source to embedded `<image href="data:image/...;base64,..." />`.
     - Extracts `<svg>` elements and clones their vector `<path>` definitions.
  5. Serializes XML and triggers browser download.

### 4.2 Figma-Ready JSON Tree (`figma-nodes.json`)
- Generates an Abstract Syntax Tree (AST) matching Figma node specifications:
  - Node types: `FRAME`, `RECTANGLE`, `TEXT`, `VECTOR`.
  - Properties: `absoluteBoundingBox`, `fills`, `strokes`, `strokeWeight`, `cornerRadius`, `style` (fontFamily, fontSize, fontWeight, textAlignHorizontal).
  - Can be imported directly through standard Figma community plugins (`html.to.design` or custom Figma plugin).

### 4.3 Standalone Offline HTML Snapshot (`page-offline.html`)
- Clones `document.documentElement`.
- Inlines all computed styles or external stylesheets into unified `<style>` tags.
- Converts all same-origin images to Base64 Data URIs.
- Strips external JavaScript script tags to prevent security execution errors offline.

---

## 5. Multi-Tab Inspector Drawer Specifications

### 5.1 Tabs Definition & Code Extractors
1. **HTML Tab**: Formats element outerHTML with indentations and syntax highlighting. Option to copy full element or inner markup.
2. **CSS Tab**: Filters out browser default user-agent styles. Groups active styles into Box Model, Typography, Colors, and Layout (Flex/Grid).
3. **React / JSX Tab**:
   - Converts HTML tags to valid JSX syntax.
   - Replaces `class` with `className`, `for` with `htmlFor`.
   - Converts inline style string into JavaScript style objects:
     `style="margin-top: 10px; background-color: #fff;"` ➔ `style={{ marginTop: '10px', backgroundColor: '#fff' }}`.
   - Auto-closes void elements (`<img />`, `<input />`, `<br />`, `<hr />`).
4. **Animations & Keyframes Tab**:
   - Inspects `getComputedStyle(element).animationName` and scans `document.styleSheets` for matching `@keyframes` rules.
   - Computes active `transition` properties.
   - Generates equivalent GSAP code:
     `gsap.to('.my-element', { x: 50, opacity: 1, duration: 0.5, ease: 'power2.out' });`.
5. **Typography Tab**:
   - Identifies exact computed `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-transform`, `color`.
   - Generates ready-to-use `@font-face` and CSS font declaration snippet.
6. **Assets & Media Tab**:
   - Extracts any embedded `<img>`, `<svg>`, `<canvas>`, or CSS `background-image: url(...)`.
   - Displays visual thumbnail previews.
   - Provides 1-click buttons: "Copy Base64 Data URI", "Download SVG", "Copy Image URL".
7. **Tailwind CSS Tab**:
   - Heuristic mapper translating computed CSS values into Tailwind utility classes:
     - `display: flex` ➔ `flex`
     - `align-items: center` ➔ `items-center`
     - `justify-content: space-between` ➔ `justify-between`
     - `padding: 16px` ➔ `p-4`
     - `border-radius: 8px` ➔ `rounded-lg`
     - `background-color: rgb(237, 37, 144)` ➔ `bg-[#ED2590]`
8. **Figma Vector (SVG) Tab**:
   - Generates standalone SVG code of the selected element.
   - Copying this code and pressing `Ctrl+V` inside Figma instantly pastes a clean vector element.

### 5.2 Context-Aware 1-Click Copy
- The inspector modal features a persistent action button: **"Copiar Aba Ativa"**.
- Clicking the button automatically resolves the current tab:
  - If on CSS tab: copies all formatted CSS.
  - If on React tab: copies JSX component code.
  - If on HTML tab: copies formatted HTML.
  - If on Animations tab: copies GSAP / CSS keyframe code.
  - If on Tailwind tab: copies Tailwind class string.
  - If on Figma tab: copies SVG vector code.
- Displays a retro Orkut toast: *"Copiado com sucesso!"*.

---

## 6. Visual Theme & Orkut Nostalgia Kit

### 6.1 Color Palette
- **Orkut Magenta / Primary Accent**: `#ED2590`
- **Orkut Dark Magenta / Hover**: `#D42880`
- **Orkut Classic Header Blue**: `#3B5998`
- **Orkut Deep Navy / Borders**: `#29487D`
- **Orkut Ice Blue / Background**: `#E7EEF6`
- **Orkut Light Card Border**: `#C4D8EE`
- **Neutral Dark / Text**: `#222222`
- **Muted Text**: `#666666`

### 6.2 Nostalgic UI Components
- **Top Bar**: Orkut blue gradient header with retro lobinho logo and close icon.
- **Badges**:
  - *Confiável* (Thumbs up icon, rating 1-3)
  - *Legal* (Smiley icon, rating 1-3)
  - *Sexy* (Heart icon, rating 1-3)
- **Scrapbook Log Drawer**: Retrô collapsible drawer displaying diagnostic logs formatted as Orkut scraps ("Recados").

---

## 7. Diagnostics & Logging System (`logger.js`)

```javascript
const CONFIG = {
  DEBUG_MODE: true // Toggle to false for production build
};

class LobnhoLogger {
  constructor(component) {
    this.component = component;
  }
  debug(msg, data) { if (CONFIG.DEBUG_MODE) this._log('DEBUG', msg, data); }
  info(msg, data)  { if (CONFIG.DEBUG_MODE) this._log('INFO', msg, data); }
  warn(msg, data)  { if (CONFIG.DEBUG_MODE) this._log('WARN', msg, data); }
  error(msg, data) { this._log('ERROR', msg, data); } // Always log errors
}
```
- In development, logs are collected in `window.__LOBNHO_LOGS__` and can be inspected or exported from the popup.
- In production, setting `DEBUG_MODE: false` eliminates console output and overhead.

---

## 8. Automated Browser Installer (`install-extension.ps1`)

The installer performs:
1. **Detection**:
   - Queries `HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice` ➔ `ProgId`.
   - Resolves executable path from registry or standard directories (Thorium, Brave, Chrome, Edge, Firefox, Opera).
2. **Launch with Extension**:
   - Chromium-based: Launches browser with argument `--load-extension="<absolute_path_to_extension>"`.
   - Opens local test suite: `test-page.html`.
3. **Desktop Shortcut**:
   - Creates a Windows shortcut `Launch Lobnho Extension.lnk` on the user's Desktop for rapid development access.
