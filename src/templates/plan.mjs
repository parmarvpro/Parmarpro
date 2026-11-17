import { html, inr, formatDate } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { audit, modules, toolkit, GBP_CHECKLIST } from '../lib/dental.mjs';
import { page, logo, ppFooter, FONTS_PARMARPRO } from './layout.mjs';

const STATUS_ICON = { good: 'check', warn: 'alert', bad: 'x' };
const STATUS_LABEL = { good: 'Working', warn: 'Could be better', bad: 'Costing you patients' };

export function planPage({ site, c, assets }) {
  const free = site.freeShare;
  const findings = audit(c);
  const fixes = findings.filter((f) => f.status !== 'good').length;
  const comps = c.audit?.competitors || [];
  const mods = modules(c);
  const kit = toolkit(c);
  const pk = site.offer.packages;
  const monthly = pk.find((p) => p.cadence === 'month');
  const go = assets.waFor(`Hi ${site.brand}, I saw the preview for ${c.name}. Let's talk about putting it live.`);
  const remove = assets.waFor(`Hi ${site.brand}, please remove the preview for ${c.name}.`);

  const body = html`
<header class="nav">
  <div class="wrap nav-in">
    ${logo(site)}
    <span class="nav-note">Prepared for <b>${c.name}</b></span>
    <a class="btn btn-ghost btn-sm" href="/p/${c.slug}/">${icon('eye')}<span>Website preview</span></a>
  </div>
</header>

<main class="doc">
<section class="doc-hero">
  <div class="wrap narrow">
    ${c.demo ? html`<p class="demo-note">${icon('alert')}Sample plan — this clinic and its numbers are made up to show what a real plan looks like.</p>` : ''}
    <span class="eyebrow">${icon('tooth')}Growth plan · ${formatDate(c.preparedOn)}</span>
    <h1>More patients from Google for ${c.name}.</h1>
    <p class="lede">We looked at how patients find ${c.name} on Google Maps, compared it with the clinics around you, and built you a new website. Below is what we found, what we've already done for you, and how to put it to work — with or without us.</p>
    <div class="doc-summary">
      <div class="card"><b>${fixes}</b><span>fixes found</span></div>
      <div class="card"><b>${mods.length}</b><span>systems in the plan</span></div>
      <div class="card"><b>${free}%</b><span>already done, free</span></div>
    </div>
    <div class="split-bar light" role="img" aria-label="${free}% free, ${100 - free}% done-for-you">
      <span style="width:${free}%">${free}% done — in this plan</span><span style="width:${100 - free}%">${100 - free}% to run</span>
    </div>
  </div>
</section>

<section class="doc-sec">
  <div class="wrap narrow">
    <span class="kicker">01 · What we found</span>
    <h2>Your Google presence today</h2>
    <ul class="findings">
      ${findings.map((f) => html`<li class="finding ${f.status}"><span class="dot">${icon(STATUS_ICON[f.status])}</span><div><p class="f-title">${f.title}<span class="f-tag">${STATUS_LABEL[f.status]}</span></p>${f.detail ? html`<p class="muted">${f.detail}</p>` : ''}</div></li>`)}
    </ul>
    ${comps.length ? html`<div class="card table-card">
      <h3>You vs the clinics nearby</h3>
      <table class="cmp">
        <thead><tr><th>Clinic</th><th>Rating</th><th>Reviews</th><th>Website</th></tr></thead>
        <tbody>
          <tr class="you"><td>${c.name} <span class="pill">You</span></td><td>${c.rating}★</td><td>${c.reviewCount}</td><td>${c.audit?.website === 'none' ? '—' : 'Yes'}</td></tr>
          ${comps.map((x) => html`<tr><td>${x.name}</td><td>${x.rating}★</td><td>${x.reviews}</td><td>${x.website === false ? '—' : 'Yes'}</td></tr>`)}
        </tbody>
      </table>
    </div>` : ''}
  </div>
</section>

<section class="doc-sec">
  <div class="wrap narrow">
    <span class="kicker">02 · The plan</span>
    <h2>Six systems, and who does what</h2>
    <p class="lede">The left column is already done — it's in this page and in your website preview. The right column is the weekly work, which you can do yourself or hand to us.</p>
    <div class="modules">
      ${mods.map((m, i) => html`<article class="card module">
        <header><span class="mod-n">${i + 1}</span>${icon(m.icon, 'i mod-i')}<div><h3>${m.title}</h3><p class="muted">${m.why}</p></div></header>
        <div class="mod-cols">
          <div class="mod-col free"><p class="mod-label">${icon('gift')}Free — done</p>${m.free.length ? html`<ul>${m.free.map((s) => html`<li>${s}</li>`)}</ul>` : html`<p class="muted small">Needs ongoing work — see right.</p>`}</div>
          <div class="mod-col dfy"><p class="mod-label">${icon('wrench')}We run it for you</p><ul>${m.dfy.map((s) => html`<li>${s}</li>`)}</ul></div>
        </div>
      </article>`)}
    </div>
  </div>
</section>

<section class="doc-sec">
  <div class="wrap narrow">
    <span class="kicker">03 · Your free toolkit</span>
    <h2>Copy, paste, use today</h2>
    <p class="lede">These are written for ${c.name}. Replace anything in [brackets] and send. No strings attached.</p>
    <div class="kit">
      ${kit.map((k, i) => html`<div class="card kit-card">
        <div class="kit-head"><h3>${k.title}</h3><button class="copy" type="button" data-copy="kit-${i}">${icon('copy')}<span>Copy</span></button></div>
        <pre id="kit-${i}">${k.text}</pre>
        <p class="muted small">${icon('sparkle')}${k.tip}</p>
      </div>`)}
    </div>

    <div class="card checklist">
      <h3>${icon('pin')}Google Business Profile: 10-point checklist</h3>
      <ol>${GBP_CHECKLIST.map(([t, d]) => html`<li><label><input type="checkbox"><span><b>${t}.</b> ${d}</span></label></li>`)}</ol>
    </div>
  </div>
</section>

<section class="doc-sec tint">
  <div class="wrap narrow">
    <span class="kicker">04 · If you'd like us to run it</span>
    <h2>Hand us the weekly work</h2>
    ${monthly ? html`<p class="lede">At an average of ${inr(site.offer.avgPatientValue)} per patient, ${monthly.name} pays for itself with ${Math.ceil(monthly.amount / site.offer.avgPatientValue)} new patients a month. Everything after that is growth.</p>` : ''}
    <div class="grid g2 pricing">
      ${pk.map((p) => html`<div class="card price${p.featured ? ' featured' : ''}">
        ${p.featured ? html`<span class="pill pill-accent">Recommended</span>` : ''}
        <h3>${p.name}</h3>
        <p class="price-amt"><strong>${inr(p.amount)}</strong><span>${p.cadence === 'month' ? '/ month' : 'one-time'}</span></p>
        <p class="muted">${p.blurb}</p>
        <ul class="ticks">${p.items.map((s) => html`<li>${icon('check')}${s}</li>`)}</ul>
      </div>`)}
    </div>
    <div class="guarantee">${icon('shield')}<p><strong>Our promise:</strong> ${site.offer.guarantee}</p></div>
  </div>
</section>

<section class="doc-sec">
  <div class="wrap narrow">
    <div class="final-card">
      <span class="kicker">Next step</span>
      <h2>Reply "GO" and we'll set up a 15-minute call.</h2>
      <p class="lede">We'll walk you through the preview, answer questions, and agree on a launch date. No pressure — the plan above is yours either way.</p>
      <div class="cta-row center">
        <a class="btn btn-accent" href="${go}">${icon('whatsapp')}Message ${site.brand}</a>
        <a class="btn btn-ghost light" href="/p/${c.slug}/">${icon('eye')}View the website again</a>
      </div>
      <p class="muted small remove">Made without being asked — sorry if it's not welcome. <a href="${remove}">Ask us to remove this preview</a> and it's gone within 24 hours.</p>
    </div>
  </div>
</section>
</main>
${ppFooter(site, assets)}`;

  return page({
    title: `Growth plan for ${c.name} — ${site.brand}`,
    description: `What we found on ${c.name}'s Google profile, the new website we built, and a step-by-step plan to get more patients.`,
    url: `${site.baseUrl}/p/${c.slug}/plan/`,
    image: assets.ogFor(c),
    noindex: true,
    css: [assets.css.parmarpro],
    js: [assets.js.site],
    fonts: FONTS_PARMARPRO,
    body,
  });
}
