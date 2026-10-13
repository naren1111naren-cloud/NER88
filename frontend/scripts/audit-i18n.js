import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');
const localesDir = path.resolve(__dirname, '../src/i18n/locales');

console.log('====================================================');
console.log('NER88 i18n & Multilingual Production Quality Audit');
console.log('====================================================\n');

// 1. Audit Locale Coverage
const expectedLocales = ['en', 'hi', 'as', 'bn', 'or', 'ta', 'brx', 'mni', 'lus', 'ne', 'kha', 'grt'];
const localeStats = {};
let masterKeys = [];

for (const loc of expectedLocales) {
  const locPath = path.join(localesDir, `${loc}.json`);
  if (!fs.existsSync(locPath)) {
    console.error(`[FAIL] Missing locale JSON file: ${loc}.json`);
    continue;
  }
  try {
    const content = JSON.parse(fs.readFileSync(locPath, 'utf8'));
    const countKeys = (obj) => {
      let count = 0;
      for (const k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          count += countKeys(obj[k]);
        } else {
          count++;
        }
      }
      return count;
    };
    const getAllKeys = (obj, prefix = '') => {
      let keys = [];
      for (const k in obj) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          keys = keys.concat(getAllKeys(obj[k], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    };

    const keys = getAllKeys(content);
    if (loc === 'en') {
      masterKeys = keys;
    }
    localeStats[loc] = { total: keys.length, keys };
  } catch (err) {
    console.error(`[FAIL] Invalid JSON in ${loc}.json:`, err.message);
  }
}

console.log(`[OK] Checked ${expectedLocales.length} locales:`);
for (const loc of expectedLocales) {
  const stat = localeStats[loc];
  const missingCount = masterKeys.filter(k => !stat?.keys.includes(k)).length;
  console.log(`  • ${loc.padEnd(5)}: ${stat?.total || 0} keys (${missingCount === 0 ? '100% synchronized' : `${missingCount} missing keys`})`);
}

// 2. Audit JSX files for untranslated strings
console.log('\nScanning frontend/src/ for untranslated hardcoded UI text...');

const IGNORED_FILES = [
  'index.css',
  'api.js',
  'apiHelpers.js',
  'main.jsx'
];

const IGNORED_PATTERNS = [
  /^[0-9\s.,:;/%+\-_#@|!?()[\]{}<>]+$/, // numbers, punctuation
  /^[A-Z0-9_\-]+$/, // constants / IDs (e.g. NH-6, V-102, IST, LIVE)
  /^(https?:|\/api\/|mailto:)/, // URLs / API routes
  /^bg-|^text-|^flex|^grid|^w-|^h-|^p-|^m-|^border/, // tailwind classes
  /^NER88/i, // brand names
  /^[a-z]+[A-Z][a-zA-Z]*$/, // camelCase technical identifiers
  /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u, // emoji only
  /^✓|✕|⟳|•|·|→|←|↑|↓|↔|⚡|⚠️|🔴|🟢|🟠|🟡$/
];

function isIgnored(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 3) return true;
  for (const pat of IGNORED_PATTERNS) {
    if (pat.test(trimmed)) return true;
  }
  return false;
}

const suspiciousFindings = [];

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'locales' && entry.name !== '__tests__' && entry.name !== 'assets') {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
      if (IGNORED_FILES.includes(entry.name)) continue;
      
      const fileContent = fs.readFileSync(fullPath, 'utf8');
      const relPath = path.relative(srcDir, fullPath);

      // Check if file uses useTranslation or t()
      const hasI18n = fileContent.includes('useTranslation') || fileContent.includes('i18n.t') || fileContent.includes('t(');

      // Check for raw text inside JSX tags: >Some English Words<
      const jsxTagTextRegex = />\s*([A-Za-z][A-Za-z0-9\s',.!?/-]{4,})\s*</g;
      let match;
      while ((match = jsxTagTextRegex.exec(fileContent)) !== null) {
        const text = match[1].trim();
        if (!isIgnored(text) && !text.startsWith('{') && !text.includes('className') && !text.includes('import ') && !text.includes('export ')) {
          suspiciousFindings.push({
            file: relPath,
            string: text,
            line: fileContent.substring(0, match.index).split('\n').length
          });
        }
      }
    }
  }
}

scanDirectory(srcDir);

// Deduplicate findings
const uniqueFindings = [];
const seen = new Set();
for (const f of suspiciousFindings) {
  const key = `${f.file}:${f.string}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueFindings.push(f);
  }
}

if (uniqueFindings.length === 0) {
  console.log('\n[SUCCESS] No hardcoded user-visible English strings detected in scanned components!');
} else {
  console.log(`\n[INFO] Found ${uniqueFindings.length} potentially hardcoded strings to verify:`);
  for (const f of uniqueFindings.slice(0, 25)) {
    console.log(`  • ${f.file}:${f.line} -> "${f.string}"`);
  }
  if (uniqueFindings.length > 25) {
    console.log(`  ... and ${uniqueFindings.length - 25} more.`);
  }
}

console.log('\n====================================================');
console.log('Audit Completed Successfully');
console.log('====================================================');
