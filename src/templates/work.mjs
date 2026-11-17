import { html } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { audit } from '../lib/dental.mjs';
import { page, logo, ppFooter, FONTS_PARMARPRO } from './layout.mjs';

// Unlisted index of every preview — not linked from the homepage and not indexed by search engines.
export function workPage({ site, clinics, assets }) {
  const body = html`
<header class="nav">
  <div class="wrap nav-in">${logo(site)}<span class="nav-note">All work · unlisted</span><a class="btn btn-primary btn-sm" href="/">Home</a></div>
</header>
<main>
<section class="doc-hero">
  <div class="wrap">
    <span class="eyebrow">${icon('lock')}Unlisted page — not linked from the homepage, hidden from Google</span>
    <h1>All previews</h1>
    <p class="lede">${clinics.length} clinic preview${clinics.length === 1 ? '' : 's'}${site.extraWork?.length ? ` and ${site.extraWork.length} other project${site.extraWork.length === 1 ? '' : 's'}` : ''}.</p>
  </div>
</section>
<section class="doc-sec">
  <div class="wrap">
    <div class="grid g3">
      ${clinics.map((c) => {
        const fixes = audit(c).filter((f) => f.status !== 'good').length;
        return html`<div class="card work-card">
          <span class="muted small">${c.area}, ${c.city} · ${c.preparedOn}${c.demo ? ' · sample' : ''}</span>
          <h3>${c.name}</h3>
          <p class="muted small">${c.rating ? `${c.rating}★ · ${c.reviewCount} reviews · ` : ''}${fixes} fixes found</p>
          <div class="work-links"><a class="link" href="/p/${c.slug}/">Website ${icon('arrow')}</a><a class="link" href="/p/${c.slug}/plan/">Plan ${icon('arrow')}</a></div>
        </div>`;
      })}
      ${(site.extraWork || []).map((w) => html`<a class="card work-card" href="${w.url}"><span class="muted small">${w.kind}</span><h3>${w.title}</h3><span class="link">View ${icon('arrow')}</span></a>`)}
    </div>
  </div>
</section>
</main>
${ppFooter(site, assets)}`;

  return page({
    title: `All work — ${site.brand}`,
    description: `Every preview built by ${site.brand}.`,
    url: `${site.baseUrl}/work/`,
    noindex: true,
    css: [assets.css.parmarpro],
    js: [assets.js.site],
    fonts: FONTS_PARMARPRO,
    body,
  });
}

export function notFound({ site, assets }) {
  const body = html`
<main class="nf">
  <div class="wrap narrow">
    ${logo(site)}
    <h1>This page isn't here.</h1>
    <p class="lede">If you were sent a preview link, it may have been taken down. Message us and we'll sort it out.</p>
    <div class="cta-row"><a class="btn btn-primary" href="/">Go home</a><a class="btn btn-ghost" href="${assets.wa}">${icon('whatsapp')}WhatsApp us</a></div>
  </div>
</main>`;
  return page({
    title: `Not found — ${site.brand}`,
    description: 'Page not found.',
    url: `${site.baseUrl}/404.html`,
    noindex: true,
    css: [assets.css.parmarpro],
    fonts: FONTS_PARMARPRO,
    body,
  });
}
