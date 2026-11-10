#!/usr/bin/env node
// Exports a clinic's preview as its real, standalone website — ready for its own domain.
// Usage: node src/export.mjs <slug> <domain>      e.g. node src/export.mjs sunrise-dental-andheri sunrisedental.in
// Output: export/<slug>/  → upload that folder to a new GitHub repo, turn on Pages, point the domain at it.
// Differences from the preview: no Parmarpro banners, indexable by Google, canonical URL on the clinic's domain,
// favicon in the clinic's colour, and a small "Website by Parmarpro" credit in the footer.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { build, ROOT } from './build.mjs';
import { clinicPage } from './templates/clinic.mjs';

const [slug, domainArg] = process.argv.slice(2);
if (!slug) { console.error('Usage: node src/export.mjs <slug> <domain>'); process.exit(1); }
const result = build();
if (!result) process.exit(1);
const c = result.clinics.find((x) => x.slug === slug);
if (!c) { console.error(`No clinic "${slug}" in src/clinics/.`); process.exit(1); }
const domain = (domainArg || c.domain || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!domain) { console.error('Give the clinic\'s domain, e.g. node src/export.mjs ' + slug + ' sunrisedental.in'); process.exit(1); }
c.domain = domain;

const out = path.join(ROOT, 'export', slug);
fs.rmSync(out, { recursive: true, force: true });
const put = (rel, content) => { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
const copy = (from, to) => put(to, fs.readFileSync(path.join(ROOT, from)));
const v = (rel) => crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex').slice(0, 8);

copy('assets/css/clinic.css', 'assets/css/clinic.css');
copy('assets/js/site.js', 'assets/js/site.js');
const initial = (c.shortName || c.name).slice(0, 1).replace(/[<&>"]/g, '');
put('assets/img/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${c.brandColor}"/><text x="32" y="43" text-anchor="middle" font-family="Georgia,serif" font-size="32" fill="#fff">${initial}</text></svg>`);
const assets = {
  css: { clinic: `/assets/css/clinic.css?v=${v('assets/css/clinic.css')}` },
  js: { site: `/assets/js/site.js?v=${v('assets/js/site.js')}` },
  ogFor: () => null,
};
put('index.html', String(clinicPage({ site: result.site, c, assets, live: true })));
put('CNAME', domain + '\n');
put('.nojekyll', '');
put('robots.txt', `User-agent: *\nAllow: /\n`);
console.log(`\nExported ${c.name} → export/${slug}/ for https://${domain}/`);
console.log('Next: create a GitHub repo for the clinic, upload the contents of that folder, enable Pages (Settings → Pages → main branch), then add the DNS records GitHub shows you at the domain registrar.');
