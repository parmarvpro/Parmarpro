import { html, inr } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { page, logo, ppFooter, FONTS_PARMARPRO } from './layout.mjs';

const SYSTEMS = [
  ['globe', 'A website that books', 'Built for phones, written for patients, with WhatsApp booking on every screen.'],
  ['pin', 'Google profile tune-up', 'Categories, services, photos and posts — where most new patients first see you.'],
  ['star', 'Review engine', 'Every patient gets a polite review request after their visit. Every review gets a reply.'],
  ['chat', 'WhatsApp booking & reminders', 'Patients book when it suits them. Reminders the day before cut no-shows.'],
  ['refresh', 'Recall & reactivation', 'Bring back patients who are due for a check-up — they already trust you.'],
  ['chart', 'Monthly scoreboard', 'One page: profile views, calls, chats, bookings, reviews. No guesswork.'],
];

export function hub({ site, clinics, assets, sample }) {
  const free = site.freeShare;
  const showcase = clinics.filter((c) => c.showcase && !c.demo);
  const work = [
    ...showcase.map((c) => ({ title: c.name, kind: `Dental clinic · ${c.area}`, url: `/p/${c.slug}/` })),
    ...(site.extraWork || []),
  ];
  const pk = site.offer.packages;

  const body = html`
<header class="nav">
  <div class="wrap nav-in">
    ${logo(site)}
    <nav class="nav-links">
      <a href="#how">How it works</a><a href="#free">What's free</a><a href="#systems">Systems</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a>
    </nav>
    <a class="btn btn-primary btn-sm" href="${assets.wa}">${icon('whatsapp')}<span>Free preview</span></a>
  </div>
</header>

<main>
<section class="hero">
  <div class="wrap hero-in">
    <div class="hero-copy reveal">
      <span class="eyebrow">${icon('tooth')} For dental clinics in ${site.market}</span>
      <h1>Your clinic's new website and growth plan. <span class="accent">Built before you pay.</span></h1>
      <p class="lede">Send us your clinic's Google Maps link. Within ${site.turnaround} you get a private preview of your new website and a step-by-step plan to get more patients from Google. Keep the plan for free — or let us run it for you.</p>
      <div class="cta-row">
        <a class="btn btn-accent" href="${assets.wa}">${icon('whatsapp')}Get my free preview</a>
        ${sample ? html`<a class="btn btn-ghost" href="/p/${sample.slug}/">See a sample ${icon('arrow')}</a>` : ''}
      </div>
      <ul class="hero-ticks">
        <li>${icon('check')}No call needed</li><li>${icon('check')}Private link, not indexed</li><li>${icon('check')}Yours to keep</li>
      </ul>
    </div>
    <div class="hero-visual reveal" aria-hidden="true">
      <div class="mock-browser">
        <div class="mock-bar"><i></i><i></i><i></i><span>${site.domain}/p/your-clinic</span></div>
        <div class="mock-body">
          <div class="mock-nav"><b></b><s></s><em></em></div>
          <div class="mock-line w80 big"></div><div class="mock-line w55 big"></div>
          <div class="mock-line w90"></div><div class="mock-line w70"></div>
          <div class="mock-ctas"><em></em><s></s></div>
          <div class="mock-cards"><i></i><i></i><i></i></div>
        </div>
      </div>
      <div class="mock-plan">
        <div class="mock-plan-head"><strong>Growth plan</strong><span class="pill">6 fixes found</span></div>
        <ul>
          <li class="bad">${icon('x')}No website on Google profile</li>
          <li class="bad">${icon('x')}Booking only by phone</li>
          <li class="warn">${icon('alert')}74 reviews vs 412 nearby</li>
          <li class="good">${icon('check')}4.6★ rating</li>
        </ul>
        <div class="meter"><span style="width:${free}%"></span></div>
        <small>${free}% done for you — free</small>
      </div>
    </div>
  </div>
</section>

<div class="strip">
  <div class="wrap strip-in">
    <span>Every preview includes</span>
    <ul>${['New website', 'Google profile audit', 'Competitor check', 'Review scripts', 'WhatsApp templates', 'Recall plan'].map((s) => html`<li>${icon('check')}${s}</li>`)}</ul>
  </div>
</div>

<section id="how">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="kicker">How it works</span>
      <h2>Real work first. A conversation later — only if you want one.</h2>
    </div>
    <ol class="steps">
      ${[
        ['pin', 'We find your clinic', 'Send us your Google Maps link — or we may have already found you there.'],
        ['wrench', 'We build your preview', 'A new website for your clinic, plus a growth plan based on your Google profile, reviews and the clinics around you.'],
        ['eye', 'You see everything first', 'One private link. Not public, not indexed by Google, clearly marked as a concept. Use any of it.'],
        ['calendar', 'We switch it on — if you want', 'We launch the site on your domain and run the systems every week. Month-to-month.'],
      ].map(([ic, t, d], i) => html`<li class="card step reveal"><span class="step-n">0${i + 1}</span>${icon(ic, 'i step-i')}<h3>${t}</h3><p class="muted">${d}</p></li>`)}
    </ol>
  </div>
</section>

<section id="free" class="dark">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="kicker">What's free</span>
      <h2>${free}% of the work is yours, free.</h2>
      <p class="lede">We don't hide the strategy behind a sales call. The thinking, the design and the scripts are all in your preview. You only pay for the part that takes time every week: running it.</p>
    </div>
    <div class="split-bar reveal" role="img" aria-label="${free}% free, ${100 - free}% paid">
      <span style="width:${free}%">${free}% free<em> — in your preview</em></span><span style="width:${100 - free}%">${100 - free}%<em> done-for-you</em><i> paid</i></span>
    </div>
    <div class="grid g2 reveal">
      <div class="glass">
        <h3>${icon('gift')}Yours free, in the preview</h3>
        <ul class="ticks">${['New website design and copy for your clinic', 'Google profile audit + 10-point checklist', 'Comparison with the clinics around you', 'Review request and reply scripts', 'WhatsApp booking and reminder templates', '6-month recall message'].map((s) => html`<li>${icon('check')}${s}</li>`)}</ul>
      </div>
      <div class="glass glass-accent">
        <h3>${icon('wrench')}Done for you, if you'd like</h3>
        <ul class="ticks">${['Launch on your own domain, with hosting', 'Every Google profile change made for you', 'Automatic review requests after each visit', 'WhatsApp Business setup and reminders', 'Monthly recall campaigns', 'A one-page scoreboard every month'].map((s) => html`<li>${icon('check')}${s}</li>`)}</ul>
      </div>
    </div>
  </div>
</section>

<section id="systems">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="kicker">The systems</span>
      <h2>Six simple systems. Together, they fill your calendar.</h2>
      <p class="lede">Nothing fancy, nothing you have to learn. Each one fixes a specific leak between "dentist near me" and a patient in your chair.</p>
    </div>
    <div class="bento">
      ${SYSTEMS.map(([ic, t, d]) => html`<div class="card bento-card reveal">${icon(ic, 'i bento-i')}<h3>${t}</h3><p class="muted">${d}</p></div>`)}
    </div>
  </div>
</section>

<section id="pricing" class="tint">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="kicker">Pricing</span>
      <h2>Simple pricing. No long contracts.</h2>
      <p class="lede">At an average of ${inr(site.offer.avgPatientValue)} per patient, ${pk.find((p) => p.cadence === 'month')?.name || 'the monthly plan'} pays for itself with ${Math.ceil((pk.find((p) => p.cadence === 'month')?.amount || 0) / site.offer.avgPatientValue)} new patients a month.</p>
    </div>
    <div class="grid g2 pricing">
      ${pk.map((p) => html`<div class="card price reveal${p.featured ? ' featured' : ''}">
        ${p.featured ? html`<span class="pill pill-accent">Most clinics choose this</span>` : ''}
        <h3>${p.name}</h3>
        <p class="price-amt"><strong>${inr(p.amount)}</strong><span>${p.cadence === 'month' ? '/ month' : 'one-time'}</span></p>
        <p class="muted">${p.blurb}</p>
        <ul class="ticks">${p.items.map((s) => html`<li>${icon('check')}${s}</li>`)}</ul>
        <a class="btn ${p.featured ? 'btn-accent' : 'btn-ghost'} btn-block" href="${assets.waFor(`Hi ${site.brand}, I'm interested in ${p.name} for my clinic.`)}">${icon('whatsapp')}Ask about ${p.name}</a>
      </div>`)}
    </div>
    <div class="guarantee reveal">${icon('shield')}<p><strong>Our promise:</strong> ${site.offer.guarantee}</p></div>
  </div>
</section>

${work.length ? html`<section id="work">
  <div class="wrap">
    <div class="section-head reveal"><span class="kicker">Work</span><h2>Selected work</h2></div>
    <div class="grid g3">
      ${work.map((w) => html`<a class="card work-card reveal" href="${w.url}"><span class="muted small">${w.kind}</span><h3>${w.title}</h3><span class="link">View ${icon('arrow')}</span></a>`)}
    </div>
  </div>
</section>` : ''}

<section class="founder">
  <div class="wrap founder-in reveal">
    <div class="avatar">${site.founder.name.slice(0, 1)}</div>
    <div>
      <p class="quote">"I'd rather show you than pitch you. Every clinic we contact gets real, finished work up front. If it's useful, we'll work together. If not, you keep it — no hard feelings."</p>
      <p class="muted">— ${site.founder.name}, ${site.founder.role}, ${site.brand}</p>
    </div>
  </div>
</section>

<section id="faq">
  <div class="wrap faq-wrap">
    <div class="section-head reveal"><span class="kicker">FAQ</span><h2>Questions clinics ask us</h2></div>
    <div class="faq">
      ${site.faq.map((f) => html`<details class="reveal"><summary>${f.q}</summary><p>${f.a}</p></details>`)}
    </div>
  </div>
</section>

<section class="final">
  <div class="wrap">
    <div class="final-card reveal">
      <h2>Want to see your clinic's preview?</h2>
      <p class="lede">Send your Google Maps link on WhatsApp. Your private preview arrives within ${site.turnaround}.</p>
      <a class="btn btn-accent" href="${assets.wa}">${icon('whatsapp')}Get my free preview</a>
    </div>
  </div>
</section>
</main>
${ppFooter(site, assets)}`;

  return page({
    title: `${site.brand} — ${site.tagline}`,
    description: `New website and growth plan for your dental clinic, built before you pay. ${free}% free; we run the rest if you want.`,
    url: `${site.baseUrl}/`,
    image: assets.ogHub,
    css: [assets.css.parmarpro],
    js: [assets.js.site],
    fonts: FONTS_PARMARPRO,
    body,
  });
}
