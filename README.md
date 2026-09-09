# Lobnho Extension

> Browser developer & designer extension for instant element inspection, code generation (React JSX, CSS, Tailwind, SVG), and single-file page export for Figma and Adobe workflows.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.7-blueviolet.svg)](manifest.json)

---

## Features

- **🎯 Target Cursor Tracker**: Precision element selector with smooth GSAP snapping, isolated in Shadow DOM to prevent any CSS collision with host web pages.
- **🔍 Multi-Tab Inspector**: Instant inspection modal with 8 focused tabs:
  - **HTML**: Clean, indented markup.
  - **CSS**: Computed styles, layout properties, and interactive box model.
  - **React / JSX**: Instant translation of DOM nodes and inline styles to clean React components.
  - **Tailwind CSS**: Automatic mapping of computed styling to modern Tailwind utility classes.
  - **Figma / Vector (SVG)**: Standalone vector markup ready to copy and paste directly into Figma canvas.
  - **Animations**: Captures CSS keyframes and transitions, with 1-click GSAP code generation.
  - **Typography**: Rendered font stacks, line heights, and weights with `@font-face` snippets.
  - **Assets & Media**: Direct extraction of SVGs, images, and Data URIs.
- **📦 Single-File Page Exporter**: Downloads a complete, self-contained `.html` snapshot of the page with inlined styles, Base64 assets, safely neutralized client scripts (`type="text/plain"`), and embedded Figma AST node tree for design workflows.

---

## Installation

This extension is built with standard Manifest V3 and runs directly on any Chromium browser (Google Chrome, Brave, Thorium, Microsoft Edge, Opera):

1. **Download or Clone** this repository:
   ```bash
   git clone https://github.com/lobnho/lobnho-extensao.git
   ```
2. Open your browser's extensions page:
   - Chrome / Brave / Thorium: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`
   - Opera: `opera://extensions`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (*Carregar sem compactação*).
5. Select this repository folder.

---

## Usage

1. Click the **Lobnho** extension icon in your browser toolbar (or press `Alt + Shift + L`).
2. Click **Inspecionar elemento** to enable the visual target cursor.
3. Hover over any element on the page and click to open the inspector drawer.
4. Switch tabs to view or copy generated code (React JSX, Tailwind, CSS, SVG, etc.).
5. To archive or export the entire page for design software, click **Salvar Página Completa (.html)**.

---

## Project Structure

```
lobnho-extensao/
├── assets/                  # Extension icons and graphics
├── src/
│   ├── background/          # Manifest V3 service worker
│   ├── content/             # Content scripts (Target Cursor, Inspector, Exporter)
│   ├── popup/               # Extension popup dashboard
│   └── shared/              # Cross-browser APIs, code generators, and vendor libs
├── manifest.json            # Extension manifest (MV3)
├── package.json             # Project metadata
├── LICENSE                  # MIT License
└── README.md                # Documentation
```

---

## License

MIT License © [Lobnho](https://github.com/lobnho).
