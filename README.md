# Lobnho Extension

> Visual element inspector, design token extractor, and multi-format page exporter for Chromium browsers (Manifest V3).

[![Version](https://img.shields.io/badge/version-v1.1.14-ED2590?style=flat-square)](https://lobinho.eu/extension/)
[![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Brave%20%7C%20Thorium%20%7C%20Edge%20%7C%20Opera%20%7C%20Vivaldi-3B5998?style=flat-square)](https://lobinho.eu/extension/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Official Page](https://img.shields.io/badge/%F0%9F%8C%90%20Official%20Site-lobinho.eu%2Fextension-10B981?style=flat-square)](https://lobinho.eu/extension/)

---

### [🌐 Visit Official Website & Download Portal](https://lobinho.eu/extension/)

Official distribution portal featuring 1-click CRX auto-update packages, ZIP downloads, and browser setup guides.

---

## Features

- **🎯 Element Inspector**: Target any UI component to generate React JSX, Tailwind CSS, clean CSS, or Figma-compatible SVG instantly.
- **📥 Single-File Page Exporter**: Download the complete DOM as a self-contained offline `.html` file with embedded inline CSS, web fonts, Base64 assets, and Figma vector node tree.
- **🎨 Design Token & Theme Exporter**: Extract color palettes, typography scale, CSS variables, and component tokens directly into a structured `[site]-theme.json`.
- **⚡ Native Silent Auto-Update**: Background Omaha update protocol (`updates.xml` + signed CRX3) keeps the extension updated automatically.

---

## Quick Installation

### Option 1: 1-Click Package (.crx) — *Recommended for Auto-Updates*
1. Download [`lobnho-extension.crx`](https://lobinho.eu/extension/downloads/lobnho-extension.crx).
2. Open `chrome://extensions` (or `brave://extensions` / `edge://extensions`).
3. Enable **Developer mode** toggle in the top-right corner.
4. Drag and drop the `.crx` file onto the extensions page.
5. *Enjoy automatic background updates with zero manual maintenance.*

### Option 2: Developer Unpacked (.zip)
1. Download the latest [`lobnho-extension.zip`](https://lobinho.eu/extension/) from [Releases](https://github.com/lobnho/lobnho-extensao/releases).
2. Extract the archive into a permanent folder on your machine.
3. In `chrome://extensions`, enable **Developer mode**.
4. Click **Load unpacked** and select the extracted directory.

---

## Usage

1. Open any webpage and click the **Lobnho** extension icon in your toolbar (or press `Alt + Shift + L`).
2. Select **Inspecionar elemento** to lock onto any element.
3. Select **Salvar Página Completa (.html)** for full offline snapshot capture.
4. Select **Exportar Tema (.json)** to export design tokens.

---

## Downloads & Releases

- Latest builds are published on [GitHub Releases](https://github.com/lobnho/lobnho-extensao/releases).
- Official distribution hub: [https://lobinho.eu/extension/](https://lobinho.eu/extension/)

---

## License

[MIT](LICENSE) © Ecossistema Lobnho
