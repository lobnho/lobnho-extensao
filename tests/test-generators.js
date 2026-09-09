/**
 * Lobnho Extension - Generator Unit Tests
 * Verifies that code generators work accurately.
 */
const fs = require('fs');
const path = require('path');

console.log('[TEST-GENERATORS] Testing code-generators.js...');

// Load file in simulated environment
const codePath = path.join(__dirname, '..', 'extension', 'src', 'shared', 'code-generators.js');
const fileContent = fs.readFileSync(codePath, 'utf8');

const mockGlobal = {};
const fn = new Function('global', 'window', fileContent);
fn(mockGlobal, mockGlobal);

const generators = mockGlobal.LobnhoCodeGenerators;
if (!generators) {
  console.error('✗ LobnhoCodeGenerators was not exported properly!');
  process.exit(1);
}

let errors = 0;

// Test parseStyleString
const styleObj = generators.parseStyleString('color: red; margin-top: 10px; background-color: #fff');
if (styleObj.color === 'red' && styleObj.marginTop === '10px' && styleObj.backgroundColor === '#fff') {
  console.log('  ✓ parseStyleString passed');
} else {
  console.error('  ✗ parseStyleString failed:', styleObj);
  errors++;
}

// Test generator functions exist
const expectedFns = ['htmlToReactJsx', 'cssToTailwind', 'elementToSvg', 'generateGsapCode'];
for (const name of expectedFns) {
  if (typeof generators[name] === 'function') {
    console.log(`  ✓ Generator function "${name}" exists`);
  } else {
    console.error(`  ✗ Missing generator function: "${name}"`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n[TEST-GENERATORS] FAILED with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('\n[TEST-GENERATORS] PASSED: All generator unit tests green.');
}
