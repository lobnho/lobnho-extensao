const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const popup = fs.readFileSync(path.join(root, 'src/popup/popup.js'), 'utf8');
const exporter = fs.readFileSync(path.join(root, 'src/content/theme-exporter.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(path.join(root, '..', 'website-lobinho-app/public/extension/version.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(popup.includes("const installedVersion = chrome.runtime?.getManifest?.()?.version || '1.1.8';"), 'popup must read installed version dynamically');
assert(popup.includes('isNewerVersion(release.version, installedVersion)'), 'popup must compare remote version to installed version');
assert(popup.includes('if (release.version && isNewerVersion'), 'popup must gate update notice by newer remote version');
assert(exporter.includes('oklabToSrgb'), 'exporter must normalize oklab colors');
assert(exporter.includes('9999px'), 'exporter must normalize absurd radii');
assert(exporter.includes('components = { buttons:'), 'exporter must export button variants');
assert(exporter.includes('cards,'), 'exporter must export card collection');
assert(manifest.version === '1.1.8', 'source manifest remains 1.1.8 for update-banner regression test');
assert(metadata.version === '1.1.9', 'remote metadata must be 1.1.9');
assert(metadata.downloadUrl.endsWith('lobnho-extension-1.1.9.zip'), 'remote metadata must target 1.1.9 package');
console.log('Extension focused tests: PASS');
