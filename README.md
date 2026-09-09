# Lobnho Extension 🐺

> A nostalgic, Orkut-themed developer & designer extension for modern browsers (Manifest V3). Features a precision **React Bits Target Cursor** element tracker, an intelligent **Multi-Tab Inspector** (HTML, CSS, React JSX, Animations, Typography, Assets, Tailwind, Figma Vector), a **Multi-Software Page Exporter** (Figma, Adobe Illustrator/Photoshop, offline HTML bundle), and an **Automated 1-Click Browser Installer**.

---

## 🌟 Key Features

### 1. Retro Orkut Visual Identity
- Classic Orkut aesthetics: `#ED2590` (Orkut magenta/pink), `#E7EEF6` (retro ice-blue background), `#3B5998` (vintage blue header).
- Clean, retro typography, rounded tab borders, and vintage scrap-style feedback toasts.

### 2. Precision Target Cursor Element Tracker
- Faithful port of [React Bits Target Cursor](https://reactbits.dev/animations/target-cursor) adapted for browser extension content scripts.
- Runs inside an isolated **Shadow DOM** (`#lobnho-target-cursor-host`) with `pointer-events: none` and `z-index: 2147483647`—guaranteeing zero visual or CSS collision with the host webpage.
- 4 corner brackets (`.target-cursor-corner`) dynamically interpolate and snap to target element bounding boxes using GSAP ticker with `getContainingBlockOffset` compensation.
- Center pulse dot with scale feedback on click and continuous idle rotation.
- Color transitions to Orkut Magenta (`#ED2590`) on target lock-on.

### 3. Intelligent Multi-Tab Inspector Drawer
Once an element is selected, a floating/docked Orkut inspector opens with 8 specialized inspection tabs:
1. **HTML**: Formatted `outerHTML` / `innerHTML` with syntax highlighting and indentation.
2. **CSS**: Clean computed styles, declared stylesheets, and an interactive Box Model visualizer (margin, border, padding).
3. **React / JSX**: Automatic conversion of the element and inline styles into an idiomatic React functional component.
4. **Animations & Keyframes**: Captures active CSS `@keyframes`, transitions, transforms, filters, and generates equivalent GSAP tween code (`gsap.to(...)`).
5. **Typography**: Identifies rendered fonts, weights, sizes, line heights, letter spacings, and provides `@font-face` snippets.
6. **Assets & Media**: Detects SVGs, inline images, and background URLs with 1-click Base64 Data URL copying or SVG downloading.
7. **Tailwind CSS**: Converts computed styles into modern Tailwind CSS utility classes (`flex items-center ...`).
8. **Figma / Vector (SVG)**: Generates clean standalone SVG vector markup ready for direct paste into Figma canvas (Ctrl+V).

**Context-Aware 1-Click Copy**: A prominent action button dynamically copies the currently active tab's processed code to clipboard with immediate visual confirmation.

### 4. Full Page Copier (Standalone HTML Bundle)
Downloads a 100% self-contained single `.html` snapshot of the complete page:
- **Frozen DOM snapshot**: Stylesheets inlined, web fonts resolved, and images/canvases converted to Base64 Data URIs.
- **SPA Safe Mode**: Client-side scripts are safely neutralized (`type="text/plain"`), preventing router crashes or API re-mounts when opening locally via `file:///`.
- **Embedded Figma AST & Vector SVG**: Contains structured Figma node tree and multi-layer SVG data for design workflows in Figma and Adobe suites.

### 5. Automated 1-Click Browser Installer
- `install-extension.ps1` & `install.bat`: Automatically detects your Windows default browser via Registry (`HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice`).
- Directly supports **Thorium**, **Brave**, **Google Chrome**, **Microsoft Edge**, **Opera**, and **Mozilla Firefox**.
- Launches the browser with developer flags (`--load-extension`) and creates a desktop shortcut: `Launch Lobnho Extension`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ (tested on Node v24 LTS)
- PowerShell 5.1+ (Windows 10/11)

### Quick Start
```powershell
# 1. Install dependencies and setup local vendor libraries:
npm install

# 2. Run automated test suite:
npm test

# 3. Launch automated browser installer:
npm run install:browser
# or simply double-click install.bat
```

---

## 📁 Repository Structure

```
lobnho-extensao/
├── extension/                     # Extension source (Manifest V3)
│   ├── manifest.json              # Cross-browser extension manifest
│   ├── assets/                    # Local icons, Orkut branding, fonts
│   └── src/
│       ├── background/            # MV3 service worker
│       ├── content/               # Content scripts (TargetCursor, Inspector, Exporter)
│       ├── popup/                 # Orkut dashboard popup
│       └── shared/                # Utilities (browser-api, logger, code-generators, vendor)
├── scripts/                       # Vendor sync and build helpers
├── tests/                         # Automated test suite (syntax, manifest, generators)
├── install-extension.ps1          # Automated browser installer
├── install.bat                    # Quick launch batch script
└── ARCHITECTURE.md                # In-depth architectural blueprint
```

---

## 🧪 Testing & Verification

Run the automated verification suite anytime:
```powershell
npm test
```
- `npm run test:syntax`: Checks 100% of JS files with Node syntax parser.
- `npm run test:manifest`: Validates `manifest.json` against MV3 standards.
- `npm run test:generators`: Verifies HTML-to-JSX, Tailwind, and SVG vector converters.

---

## 📄 License
MIT License. Created with ❤️ by Lobnho.
