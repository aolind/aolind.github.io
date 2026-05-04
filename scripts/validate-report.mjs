#!/usr/bin/env node
// Headless render of citations/report.html. Fails on console errors or 4xx/5xx asset loads.
// Resolves Playwright from the global npm prefix so this works without project-local node_modules.

import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const reportPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  'citations',
  'report.html',
);

if (!fs.existsSync(reportPath)) {
  console.error(`[skip] ${reportPath} does not exist; nothing to validate.`);
  process.exit(0);
}

let chromium;
try {
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  const require = createRequire(path.join(globalRoot, 'noop.js'));
  ({ chromium } = require('playwright'));
} catch (err) {
  console.error('[fail] Could not load Playwright. Install with: npm install -g playwright && npx playwright install chromium');
  console.error(err.message);
  process.exit(2);
}

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText})`));
page.on('response', (resp) => {
  const status = resp.status();
  if (status >= 400) errors.push(`http ${status}: ${resp.url()}`);
});

try {
  await page.goto(`file://${reportPath}`, { waitUntil: 'networkidle', timeout: 15000 });
  // Allow any deferred work (counter animations, chart render) to settle.
  await page.waitForTimeout(500);
} catch (err) {
  errors.push(`navigation: ${err.message}`);
}

await browser.close();

// Filter false positives: external CDN/font requests that may be flaky offline.
const ignored = errors.filter((e) =>
  /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(e)
);
const real = errors.filter((e) => !ignored.includes(e));

if (real.length) {
  console.error('Report validation failed:');
  for (const e of real) console.error(`  - ${e}`);
  if (ignored.length) {
    console.error(`\n(${ignored.length} font/CDN issue${ignored.length > 1 ? 's' : ''} ignored)`);
  }
  process.exit(2);
}

console.log(`citations/report.html validated cleanly${ignored.length ? ` (${ignored.length} font/CDN issue${ignored.length > 1 ? 's' : ''} ignored)` : ''}.`);
process.exit(0);
