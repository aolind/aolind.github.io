#!/usr/bin/env node
// Fast syntax check for <script> blocks in HTML files.
// Usage: node check-html-js.mjs <file.html> [file2.html ...]
// Exits 2 on any JS syntax error so it can be wired up as a blocking hook.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: check-html-js.mjs <file.html> [...]');
  process.exit(1);
}

let failed = false;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`[skip] not found: ${file}`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let blockIdx = 0;
  while ((m = scriptRe.exec(html)) !== null) {
    blockIdx++;
    const tagOpen = m[0].slice(0, m[0].indexOf('>') + 1);
    if (/\bsrc\s*=/.test(tagOpen)) continue; // external script, nothing to parse
    const code = m[1];
    if (!code.trim()) continue;
    try {
      new vm.Script(code, { filename: `${path.basename(file)}#script-${blockIdx}` });
    } catch (err) {
      failed = true;
      console.error(`[fail] ${file} (script block #${blockIdx}): ${err.message}`);
    }
  }
}

if (failed) {
  console.error('\nJavaScript syntax check failed. Edit blocked.');
  process.exit(2);
}
process.exit(0);
