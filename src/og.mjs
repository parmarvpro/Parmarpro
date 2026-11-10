#!/usr/bin/env node
// Screenshots each clinic preview (and the homepage) as a 1200x630 link-preview image,
// so the link shows your new design when you paste it into WhatsApp, email or LinkedIn.
// Usage: node src/og.mjs           (only makes missing images)
//        node src/og.mjs --force   (remakes all of them)
// Needs Playwright with Chromium (pre-installed in Claude Code cloud sessions; locally: npx playwright install chromium).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build, ROOT } from './build.mjs';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const force = process.argv.includes('--force');
const result = build();
if (!result) process.exit(1);

const port = 8000 + Math.floor(Math.random() * 900);
const server = await serve(port);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

const shots = [{ url: '/', out: 'assets/img/og.png' }, ...result.clinics.map((c) => ({ url: `/p/${c.slug}/`, out: `p/${c.slug}/og.png` }))];
let made = 0;
for (const s of shots) {
  const file = path.join(ROOT, s.out);
  if (!force && fs.existsSync(file)) continue;
  await page.goto(`http://localhost:${port}${s.url}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '.c-mobilebar{display:none!important} .reveal{opacity:1!important;transform:none!important}' });
  await page.screenshot({ path: file });
  console.log(`og image  ${s.out}`);
  made++;
}
await browser.close();
server.close();
if (made) build(); // rebuild so pages point at the new images
else console.log('All link-preview images exist (use --force to remake).');
