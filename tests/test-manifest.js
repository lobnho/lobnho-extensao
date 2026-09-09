/**
 * Lobnho Extension - Manifest V3 Validator Test
 * Ensures manifest.json adheres to MV3 structure and all referenced files exist.
 */
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'extension', 'manifest.json');
console.log(`[TEST-MANIFEST] Validating ${manifestPath}...`);

if (!fs.existsSync(manifestPath)) {
  console.error('✗ manifest.json does not exist!');
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error(`✗ Failed to parse manifest.json: ${err.message}`);
  process.exit(1);
}

let errors = 0;

// Verify MV3
if (manifest.manifest_version !== 3) {
  console.error(`✗ Expected manifest_version 3, found: ${manifest.manifest_version}`);
  errors++;
} else {
  console.log('  ✓ Manifest Version 3 confirmed');
}

// Verify essential fields
const requiredFields = ['name', 'version', 'description', 'action', 'background'];
for (const field of requiredFields) {
  if (!manifest[field]) {
    console.error(`✗ Missing required field: ${field}`);
    errors++;
  } else {
    console.log(`  ✓ Field "${field}" present`);
  }
}

// Verify referenced files
const extDir = path.join(__dirname, '..', 'extension');

function checkFile(relPath, desc) {
  const full = path.join(extDir, relPath);
  if (!fs.existsSync(full)) {
    console.error(`✗ Referenced ${desc} not found: ${relPath}`);
    errors++;
  } else {
    console.log(`  ✓ Referenced ${desc} exists: ${relPath}`);
  }
}

if (manifest.action?.default_popup) {
  checkFile(manifest.action.default_popup, 'default_popup');
}

if (manifest.background?.service_worker) {
  checkFile(manifest.background.service_worker, 'service_worker');
}

if (manifest.content_scripts) {
  for (const cs of manifest.content_scripts) {
    if (cs.js) {
      for (const js of cs.js) {
        checkFile(js, 'content_script js');
      }
    }
  }
}

if (manifest.icons) {
  for (const [size, iconPath] of Object.entries(manifest.icons)) {
    checkFile(iconPath, `icon ${size}`);
  }
}

if (errors > 0) {
  console.error(`\n[TEST-MANIFEST] FAILED with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('\n[TEST-MANIFEST] PASSED: manifest.json is 100% valid.');
}
