/**
 * Script to synchronize third-party dependencies from node_modules to extension/src/shared/vendor
 */
const fs = require('fs');
const path = require('path');

const vendorDir = path.join(__dirname, '..', 'extension', 'src', 'shared', 'vendor');
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

function copyFileIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[setup-vendor] Copied: ${path.basename(dest)}`);
    return true;
  }
  return false;
}

const nodeModulesDir = path.join(__dirname, '..', 'node_modules');

// Copy GSAP
const gsapSrc = path.join(nodeModulesDir, 'gsap', 'dist', 'gsap.min.js');
const gsapDest = path.join(vendorDir, 'gsap.min.js');
if (!copyFileIfExists(gsapSrc, gsapDest)) {
  console.warn('[setup-vendor] GSAP not found in node_modules yet. Will be copied upon npm install.');
}

// Copy JSZip
const jszipSrc = path.join(nodeModulesDir, 'jszip', 'dist', 'jszip.min.js');
const jszipDest = path.join(vendorDir, 'jszip.min.js');
if (!copyFileIfExists(jszipSrc, jszipDest)) {
  console.warn('[setup-vendor] JSZip not found in node_modules yet. Will be copied upon npm install.');
}

console.log('[setup-vendor] Vendor setup step completed.');
