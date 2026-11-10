#!/usr/bin/env node
// Builds the whole site from src/site.json and src/clinics/*.json.
// Usage: node src/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { waLink, digits } from './lib/html.mjs';
import { hub } from './templates/hub.mjs';
import { clinicPage } from './templates/clinic.mjs';
import { planPage } from './templates/plan.mjs';
import { workPage, notFound } from './templates/work.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const warnings = [];
const errors = [];

const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { errors.push(`${path.relative(ROOT, p)}: ${e.message}`); return null; }
};

export function build() {
  warnings.length = 0;
  errors.length = 0;
  const site = readJson(path.join(SRC, 'site.json'));
  if (!site) return report();
  site.domain = new URL(site.baseUrl).host;
  if (!/^\d{11,15}$/.test(digits(site.contact.whatsapp))) warnings.push('site.json → contact.whatsapp is empty or not a full number (e.g. "919876543210"). Every Parmarpro WhatsApp button is dead until you add it.');
  if (!site.contact.email) warnings.push('site.json → contact.email is empty (optional, shown in the footer).');

  const clinicDir = path.join(SRC, 'clinics');
  const clinics = fs.readdirSync(clinicDir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => {
      const c = readJson(path.join(clinicDir, f));
      if (!c) return null;
      const fileSlug = f.replace(/\.json$/, '');
      c.slug ||= fileSlug;
      const where = `src/clinics/${f}`;
      if (c.slug !== fileSlug) errors.push(`${where}: "slug" (${c.slug}) must match the file name (${fileSlug}).`);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug)) errors.push(`${where}: slug must be lowercase letters, numbers and dashes.`);
      for (const k of ['name', 'area', 'city', 'address', 'phone']) if (!c[k]) errors.push(`${where}: "${k}" is required.`);
      if (c.brandColor && !/^#[0-9a-fA-F]{6}$/.test(c.brandColor)) errors.push(`${where}: brandColor must look like #0E7C86.`);
      c.brandColor ||= '#0E7C86';
      c.preparedOn ||= new Date().toISOString().slice(0, 10);
      if (!c.demo && !c.services?.length) warnings.push(`${where}: no services listed.`);
      if (!c.demo && !/^\d{11,15}$/.test(digits(c.whatsapp || c.phone))) warnings.push(`${where}: phone/whatsapp doesn't look like a full number with country code — the Book button may not work.`);
      return c;
    })
    .filter(Boolean)
    .sort((a, b) => b.preparedOn.localeCompare(a.preparedOn) || a.name.localeCompare(b.name));

  if (errors.length) return report();

  const hash = (rel) => crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex').slice(0, 8);
  const versioned = (rel) => `/${rel}?v=${hash(rel)}`;
  const og = (rel) => (fs.existsSync(path.join(ROOT, rel)) ? `${site.baseUrl}/${rel}?v=${hash(rel)}` : null);

  const assets = {
    css: { parmarpro: versioned('assets/css/parmarpro.css'), clinic: versioned('assets/css/clinic.css') },
    js: { site: versioned('assets/js/site.js') },
    wa: waLink(site.contact.whatsapp, site.contact.waMessage),
    waFor: (text) => waLink(site.contact.whatsapp, text),
    ogHub: og('assets/img/og.png'),
    ogFor: (c) => og(`p/${c.slug}/og.png`) || og('assets/img/og.png'),
  };

  const written = [];
  const write = (rel, content) => {
    const file = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(content));
    written.push(rel);
  };

  const sample = clinics.find((c) => c.demo);
  write('index.html', hub({ site, clinics, assets, sample }));
  write('work/index.html', workPage({ site, clinics, assets }));
  write('404.html', notFound({ site, assets }));
  for (const c of clinics) {
    write(`p/${c.slug}/index.html`, clinicPage({ site, c, assets }));
    write(`p/${c.slug}/plan/index.html`, planPage({ site, c, assets }));
  }

  // Remove previews whose clinic file was deleted (e.g. a clinic asked to be taken down).
  const pDir = path.join(ROOT, 'p');
  const keep = new Set(clinics.map((c) => c.slug));
  for (const d of fs.existsSync(pDir) ? fs.readdirSync(pDir) : []) {
    if (!keep.has(d)) {
      fs.rmSync(path.join(pDir, d), { recursive: true, force: true });
      console.log(`removed  p/${d}/  (no src/clinics/${d}.json)`);
    }
  }

  for (const w of written) console.log(`built    ${w}`);
  report();
  return { site, clinics };
}

function report() {
  for (const w of warnings) console.warn(`\x1b[33mwarning\x1b[0m  ${w}`);
  for (const e of errors) console.error(`\x1b[31merror\x1b[0m    ${e}`);
  if (errors.length) process.exitCode = 1;
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
