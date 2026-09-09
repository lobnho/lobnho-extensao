/**
 * Lobnho Extension - Syntax Validator Test
 * Validates that all JS files in extension/ parse cleanly without syntax errors.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === 'vendor') continue;
    if (fs.statSync(fullPath).isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const extensionDir = path.join(__dirname, '..', 'extension');
const jsFiles = getAllJsFiles(extensionDir);

console.log(`[TEST-SYNTAX] Validating syntax for ${jsFiles.length} JavaScript files...`);

let failed = 0;
for (const file of jsFiles) {
  const relPath = path.relative(path.join(__dirname, '..'), file);
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
    console.log(`  ✓ OK: ${relPath}`);
  } catch (err) {
    console.error(`  ✗ FAILED: ${relPath}\n${err.stderr.toString()}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n[TEST-SYNTAX] FAILED: ${failed} file(s) contain syntax errors.`);
  process.exit(1);
} else {
  console.log(`\n[TEST-SYNTAX] PASSED: All ${jsFiles.length} files parsed cleanly.`);
}
