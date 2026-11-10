import { html } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';

export const FONTS_PARMARPRO = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
export const FONTS_CLINIC = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap';

export function page({ title, description, url, image, noindex, css, js, fonts, themeColor = '#0D0F12', style, bodyClass, body }) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${noindex ? html`<meta name="robots" content="noindex, nofollow">\n` : ''}<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
${image ? html`<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
` : ''}<meta name="theme-color" content="${themeColor}">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add('js')</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
${css.map((h) => html`<link rel="stylesheet" href="${h}">\n`)}${style ? html`<style>${style}</style>\n` : ''}</head>
<body${bodyClass ? html` class="${bodyClass}"` : ''}>
${body}
${(js || []).map((h) => html`<script src="${h}" defer></script>\n`)}</body>
</html>
`;
}

// Shared Parmarpro pieces (hub, plan, work pages)
export function logo(site) {
  return html`<a class="logo" href="/" aria-label="${site.brand} home"><span class="logo-mark">P</span><span>${site.brand}</span></a>`;
}

export function ppFooter(site, assets) {
  const year = new Date().getFullYear();
  return html`<footer class="pp-footer">
  <div class="wrap pp-footer-in">
    <div>${logo(site)}<p class="muted small">${site.tagline} · ${site.market}</p></div>
    <nav class="pp-footer-links">
      <a href="/#how">How it works</a>
      <a href="/#pricing">Pricing</a>
      <a href="${assets.wa}">${icon('whatsapp')}WhatsApp</a>
      ${site.contact.email ? html`<a href="mailto:${site.contact.email}">${site.contact.email}</a>` : ''}
    </nav>
  </div>
  <div class="wrap"><p class="muted small">© ${year} ${site.brand}. Previews are concepts made by ${site.brand} and are not affiliated with the businesses shown.</p></div>
</footer>`;
}
