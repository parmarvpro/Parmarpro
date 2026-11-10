import { html, waLink, telLink } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { service, clinicFaqs } from '../lib/dental.mjs';
import { page, FONTS_CLINIC } from './layout.mjs';

const stars = (r) => html`<span class="stars" style="--r:${r}" aria-label="${r} out of 5">★★★★★</span>`;

// live = true renders the clinic's real site (no Parmarpro banners, indexable) for src/export.mjs
export function clinicPage({ site, c, assets, live = false }) {
  const short = c.shortName || c.name;
  const book = waLink(c.whatsapp || c.phone, `Hi ${short}, I'd like to book an appointment.`);
  const call = telLink(c.phone);
  const mapsQ = c.mapsQuery || `${c.name}, ${c.address}`;
  const embed = `https://maps.google.com/maps?q=${encodeURIComponent(mapsQ)}&output=embed`;
  const directions = c.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQ)}`;
  const services = (c.services || []).map(service);
  const headline = c.headline || `Gentle, modern dental care in ${c.area}.`;
  const intro = c.intro || `From routine check-ups to root canals and implants — clear explanations, careful treatment, and booking that takes under a minute on WhatsApp.`;
  const plan = `/p/${c.slug}/plan/`;

  const body = html`
${live ? '' : html`<div class="pp-ribbon">
  <div class="pp-ribbon-in">
    <span><b>${site.brand}</b> ${c.demo ? 'sample preview — this clinic and its details are made up.' : html`concept preview for ${c.name} — not the clinic's official website.`}</span>
    <a href="${plan}">See the growth plan ${icon('arrow')}</a>
  </div>
</div>`}

<header class="c-nav">
  <div class="c-wrap c-nav-in">
    <a class="c-logo" href="#top"><span class="c-mono">${short.slice(0, 1)}</span><span>${short}</span></a>
    <nav class="c-links"><a href="#treatments">Treatments</a>${c.doctors?.length ? html`<a href="#doctor">Doctor</a>` : ''}<a href="#reviews">Reviews</a><a href="#visit">Visit</a></nav>
    <a class="c-btn c-btn-brand c-btn-sm" href="${book}">${icon('whatsapp')}<span>Book</span></a>
  </div>
</header>

<main id="top">
<section class="c-hero">
  <div class="c-wrap c-hero-in">
    <div class="c-hero-copy">
      <p class="c-eyebrow">${icon('pin')}Dental clinic · ${c.area}, ${c.city}</p>
      <h1>${headline}</h1>
      <p class="c-lede">${intro}</p>
      <div class="c-ctas">
        <a class="c-btn c-btn-brand" href="${book}">${icon('whatsapp')}Book on WhatsApp</a>
        <a class="c-btn c-btn-line" href="${call}">${icon('phone')}${c.phone}</a>
      </div>
      ${c.rating ? html`<a class="c-rating" href="${directions}" target="_blank" rel="noopener">${stars(c.rating)}<span><b>${c.rating}</b> on Google · ${c.reviewCount} reviews</span></a>` : ''}
    </div>
    <div class="c-hero-visual" aria-hidden="true">
      <div class="c-chat">
        <div class="c-chat-head"><span class="c-mono">${short.slice(0, 1)}</span><div><b>${short}</b><small>Booking on WhatsApp</small></div></div>
        <div class="c-chat-body">
          <p class="out">Hi! I'd like to book a check-up.</p>
          <p class="in">Hello! We have <b>6:30 pm today</b> or <b>11:00 am tomorrow</b>. Which suits you?</p>
          <p class="out">6:30 today, please.</p>
          <p class="in">Booked ${icon('check', 'i tick')} See you at 6:30. We'll send a reminder an hour before.</p>
        </div>
      </div>
      <div class="c-float c-float-1">${icon('calendar')}<div><b>Book in under a minute</b><small>Day or night</small></div></div>
      ${c.since ? html`<div class="c-float c-float-2">${icon('shield')}<div><b>Caring since ${c.since}</b><small>${c.area}</small></div></div>` : ''}
    </div>
  </div>
</section>

<div class="c-trust">
  <div class="c-wrap c-trust-in">
    ${c.rating ? html`<div><b>${c.rating}★</b><span>Google rating</span></div>` : ''}
    ${c.reviewCount ? html`<div><b>${c.reviewCount}+</b><span>Patient reviews</span></div>` : ''}
    ${c.since ? html`<div><b>${new Date().getFullYear() - c.since}+ yrs</b><span>In ${c.area}</span></div>` : ''}
    <div><b>${services.length}</b><span>Treatments</span></div>
  </div>
</div>

<section id="treatments" class="c-section">
  <div class="c-wrap">
    <div class="c-head"><p class="c-kicker">Treatments</p><h2>Everything your family needs, under one roof.</h2></div>
    <div class="c-services">
      ${services.map((s) => html`<div class="c-card c-service">${icon(s.icon, 'i c-service-i')}<h3>${s.name}</h3><p>${s.desc}</p></div>`)}
    </div>
  </div>
</section>

<section class="c-section c-soft">
  <div class="c-wrap">
    <div class="c-head"><p class="c-kicker">Your first visit</p><h2>Simple from the first message.</h2></div>
    <ol class="c-steps">
      ${[
        ['chat', 'Message us', 'Tell us what\'s bothering you and when you\'re free — on WhatsApp or by phone.'],
        ['calendar', 'Get a confirmed slot', 'We confirm a time and send a reminder before your visit.'],
        ['tooth', 'Check-up & a clear plan', 'We examine, explain what we see, and walk you through your options and costs before any treatment.'],
      ].map(([ic, t, d], i) => html`<li><span class="c-step-n">${i + 1}</span>${icon(ic, 'i c-step-i')}<h3>${t}</h3><p>${d}</p></li>`)}
    </ol>
  </div>
</section>

${c.doctors?.length ? html`<section id="doctor" class="c-section">
  <div class="c-wrap">
    <div class="c-head"><p class="c-kicker">Meet your dentist${c.doctors.length > 1 ? 's' : ''}</p><h2>Care you can talk to.</h2></div>
    <div class="c-doctors">
      ${c.doctors.map((d) => html`<div class="c-card c-doctor">
        ${d.photo ? html`<img src="${d.photo}" alt="${d.name}" loading="lazy">` : html`<div class="c-doc-mono">${d.name.replace(/^Dr\.?\s*/i, '').slice(0, 1)}</div>`}
        <div><h3>${d.name}</h3><p class="c-cred">${d.credentials}</p>${d.bio ? html`<p>${d.bio}</p>` : ''}</div>
      </div>`)}
    </div>
  </div>
</section>` : ''}

<section id="reviews" class="c-section c-soft">
  <div class="c-wrap">
    <div class="c-head c-head-row">
      <div><p class="c-kicker">Reviews</p><h2>What patients say.</h2></div>
      ${c.rating ? html`<div class="c-score"><b>${c.rating}</b>${stars(c.rating)}<span>${c.reviewCount} Google reviews</span></div>` : ''}
    </div>
    ${c.reviews?.length ? html`<div class="c-reviews">
      ${c.reviews.map((r) => html`<figure class="c-card c-review">${stars(r.rating || 5)}<blockquote>“${r.text}”</blockquote><figcaption>${r.author} · Google review</figcaption></figure>`)}
    </div>` : ''}
    <a class="c-btn c-btn-line c-center" href="${directions}" target="_blank" rel="noopener">Read all reviews on Google ${icon('arrow')}</a>
  </div>
</section>

<section id="visit" class="c-section">
  <div class="c-wrap c-visit">
    <div class="c-card c-visit-card">
      <p class="c-kicker">Visit us</p>
      <h2>${c.name}</h2>
      <p class="c-line">${icon('pin')}<span>${c.address}</span></p>
      <p class="c-line">${icon('phone')}<a href="${call}">${c.phone}</a></p>
      ${c.hours?.length ? html`<div class="c-hours">${icon('clock')}<table>${c.hours.map((h) => html`<tr><th>${h.days}</th><td>${h.time}</td></tr>`)}</table></div>` : ''}
      <div class="c-ctas">
        <a class="c-btn c-btn-brand" href="${book}">${icon('whatsapp')}Book on WhatsApp</a>
        <a class="c-btn c-btn-line" href="${directions}" target="_blank" rel="noopener">${icon('pin')}Get directions</a>
      </div>
    </div>
    <div class="c-map"><iframe title="Map to ${c.name}" src="${embed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
  </div>
</section>

<section class="c-section c-soft">
  <div class="c-wrap c-faq-wrap">
    <div class="c-head"><p class="c-kicker">Questions</p><h2>Good to know.</h2></div>
    <div class="c-faq">${clinicFaqs(c).map((f) => html`<details><summary>${f.q}</summary><p>${f.a}</p></details>`)}</div>
  </div>
</section>

<section class="c-section">
  <div class="c-wrap">
    <div class="c-cta">
      <h2>Ready when you are.</h2>
      <p>Send us a message — we'll find a time that works for you.</p>
      <div class="c-ctas"><a class="c-btn c-btn-white" href="${book}">${icon('whatsapp')}Book on WhatsApp</a><a class="c-btn c-btn-ghost" href="${call}">${icon('phone')}Call the clinic</a></div>
    </div>
  </div>
</section>
</main>

<footer class="c-footer">
  <div class="c-wrap c-footer-in">
    <div><a class="c-logo" href="#top"><span class="c-mono">${short.slice(0, 1)}</span><span>${c.name}</span></a><p>${c.address}</p></div>
    <p>${c.phone}${live ? html`<br><a class="c-credit" href="${site.baseUrl}/">Website by ${site.brand}</a>` : ''}</p>
  </div>
</footer>

${live ? '' : html`<aside class="pp-handoff">
  <div class="c-wrap pp-handoff-in">
    <div><b>This website is a free concept made for ${c.name} by ${site.brand}.</b><p>It's yours to use. Want it live on your own domain, plus more patients from Google?</p></div>
    <a class="c-btn c-btn-white" href="${plan}">See the growth plan ${icon('arrow')}</a>
  </div>
</aside>`}

<nav class="c-mobilebar" aria-label="Quick actions">
  <a href="${call}">${icon('phone')}Call</a>
  <a class="brand" href="${book}">${icon('whatsapp')}Book on WhatsApp</a>
</nav>`;

  return page({
    title: live ? `${c.name} — Dental clinic in ${c.area}, ${c.city}` : `${c.name} — new website preview`,
    description: live
      ? `${c.name} is a dental clinic in ${c.area}, ${c.city}. ${services.slice(0, 4).map((s) => s.name).join(', ')} and more. Book on WhatsApp or call ${c.phone}.`
      : `A free concept website and growth plan prepared for ${c.name}, ${c.area} by ${site.brand}.`,
    url: live ? `https://${c.domain}/` : `${site.baseUrl}/p/${c.slug}/`,
    image: assets.ogFor(c),
    noindex: !live,
    css: [assets.css.clinic],
    js: [assets.js.site],
    fonts: FONTS_CLINIC,
    themeColor: c.brandColor,
    style: `:root{--brand:${c.brandColor}}`,
    bodyClass: 'clinic',
    body,
  });
}
