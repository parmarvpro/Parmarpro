/* Shared vector art + procedural "photography".
   Everything the film shows is drawn here in code — no external media. */
(function () {
  const F = window.F;
  const A = (F.A = {});

  /* ============================================================
     Icons (24×24, stroke = currentColor)
     ============================================================ */
  const ic = (body, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;
  A.icon = {
    check: ic('<path d="M5 12.5l4.3 4.3L19 7.2"/>'),
    globe: ic('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.5 3.6 8.5s-1 5.9-3.6 8.5M12 3.5C9.4 6.1 8.4 9 8.4 12s1 5.9 3.6 8.5"/>'),
    file: ic('<path d="M6.5 3.5h7.5l4 4v13H6.5z"/><path d="M14 3.5v4h4M10.6 11.6L9 13.3l1.6 1.7M13.4 11.6l1.6 1.7-1.6 1.7"/>'),
    calendar: ic('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
    flag: ic('<path d="M5.5 21V4M5.5 4.5h11l-2.3 4 2.3 4h-11"/>'),
    bolt: ic('<path d="M13.2 2.8L5.6 13.4h5.6l-1 7.8 7.6-10.6h-5.6z"/>'),
    play: ic('<path d="M7.5 5.2v13.6L18.6 12z"/>'),
    branch: ic('<path d="M12 21v-6.2M12 14.8L6.3 9.1M12 14.8l5.7-5.7M6.3 9.1V4.6M6.3 4.6L4.4 6.6M6.3 4.6l1.9 2M17.7 9.1v-4.5M17.7 4.6l-1.9 2M17.7 4.6l1.9 2"/>'),
    clock: ic('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 2"/>'),
    search: ic('<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.5 15.5L20 20"/>'),
    mic: ic('<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 17.8v2.7"/>'),
    plus: ic('<path d="M12 5v14M5 12h14"/>'),
    arrowUp: ic('<path d="M12 19V5.5M6.5 11L12 5.5 17.5 11"/>', 'stroke-width="2.2"'),
    chevron: ic('<path d="M7 10l5 5 5-5"/>'),
    heart: ic('<path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>'),
    comment: ic('<path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.4-4A7.5 7.5 0 1 1 20 11.5z"/>'),
    pin: ic('<path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
    menu: ic('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    user: ic('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0"/>'),
    gear: ic('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"/>'),
    listBolt: ic('<path d="M4 7h10M4 12h7M4 17h6M17.5 9l-2.6 4.4h3.6l-2.6 4.4"/>'),
    camera: ic('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="0.6" fill="currentColor"/>'),
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor"/></svg>',
    target: ic('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>'),
    loader: (() => {
      let s = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x1 = 12 + Math.cos(a) * 4.6, y1 = 12 + Math.sin(a) * 4.6;
        const x2 = 12 + Math.cos(a) * 8.6, y2 = 12 + Math.sin(a) * 8.6;
        s += `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}" opacity="${(0.25 + (i / 8) * 0.75).toFixed(2)}"/>`;
      }
      return s + '</svg>';
    })(),
  };

  /* inline SVG markup → data URL usable by <img>/canvas */
  A.svgUrl = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));

  /* mouse cursor (filled arrow) */
  A.cursor = (fill = '#111', stroke = '#fff') =>
    `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M4.5 2.8l14.6 10.4-6.6 1.2 3.6 6.9-2.7 1.4-3.6-6.9-5.3 4.4z" fill="${fill}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

  /* ============================================================
     Brand marks
     ============================================================ */
  /* Base44: a disc sliced by one horizontal gap */
  A.base44Mark = (color = 'var(--orange)') => {
    const r = 50;
    const g1 = 0.27 * r, g2 = 0.535 * r;
    const top = `M${-r} 0 A${r} ${r} 0 0 1 ${r} 0 L${r} 0 A${r} ${r} 0 0 1 ${Math.sqrt(r * r - g1 * g1).toFixed(2)} ${g1} L${(-Math.sqrt(r * r - g1 * g1)).toFixed(2)} ${g1} A${r} ${r} 0 0 1 ${-r} 0z`;
    const bx = Math.sqrt(r * r - g2 * g2).toFixed(2);
    const bottom = `M${-bx} ${g2} L${bx} ${g2} A${r} ${r} 0 0 1 ${-bx} ${g2}z`;
    return `<svg viewBox="-51 -51 102 102"><path d="${top}" fill="${color}"/><path d="${bottom}" fill="${color}"/></svg>`;
  };
  /* the wordmark's open-top "4" (the web font subset has no open-four alternate) */
  const four = (x) => `<g transform="translate(${x} 0)"><path d="M6 54 L33.5 1" stroke="currentColor" stroke-width="11.5" fill="none"/><rect x="0" y="48" width="61" height="10.5" fill="currentColor"/><rect x="37" y="0" width="11.5" height="72" fill="currentColor"/></g>`;
  A.base44Logo = (markColor, textColor = 'var(--ink)') =>
    `<span class="b44" style="color:${textColor}">${A.base44Mark(markColor)}<span class="b44-word">Base<svg class="b44-44" viewBox="0 0 128 72">${four(0)}${four(66)}</svg></span></span>`;

  /* the "your agency" mark: two stacked swoosh-arrows */
  A.agencyMark = (color = '#1d1d1d') => {
    const unit = (dx, dy) =>
      `<g transform="translate(${dx} ${dy})" fill="none" stroke="${color}" stroke-linejoin="miter"><path d="M3 36 Q16 58 38 63 L64 62" stroke-width="14"/><path d="M36 66 L51 84" stroke-width="13"/></g>`;
    return `<svg viewBox="0 0 100 100">${unit(4, 14)}${unit(30, -12)}</svg>`;
  };

  /* Open Fields monogram badge */
  A.ofBadge = (bg = '#1f6b35', fg = '#fff', size = 60) =>
    `<svg viewBox="0 0 60 60" width="${size}" height="${size}"><circle cx="30" cy="30" r="29" fill="${bg}"/><text x="30" y="38" text-anchor="middle" font-family="Young Serif, serif" font-size="24" fill="${fg}" letter-spacing="-1">OF</text><circle cx="45" cy="21" r="2.4" fill="${fg}"/></svg>`;

  /* Gmail-style envelope M */
  A.mailLogo = () =>
    `<svg viewBox="0 0 48 36"><path d="M3 34V9l21 15L45 9v25h-8V17L24 27 11 17v17z" fill="#ea4335"/><path d="M3 34h8V17L3 11z" fill="#4285f4"/><path d="M37 34h8V11l-8 6z" fill="#34a853"/><path d="M37 17l8-6V7c0-3.7-4.2-5.8-7.2-3.6L37 4.2z" fill="#fbbc04"/><path d="M11 17V4.2l-0.8-0.8C7.2 1.2 3 3.3 3 7v4z" fill="#c5221f"/></svg>`;

  /* superagent app avatar */
  A.agentAvatar = () =>
    `<svg viewBox="0 0 40 40"><rect width="40" height="40" rx="6" fill="#ee5a1c"/><g transform="translate(6 6) scale(.28) rotate(-12 50 50)">${A.agencyMark('#fff').replace(/<\/?svg[^>]*>/g, '')}</g></svg>`;

  /* soccer ball */
  A.ball = (opts = {}) => {
    const base = opts.base || '#f4f3ef';
    const ink = opts.ink || '#1d1d1d';
    return `<svg viewBox="-50 -50 100 100"><defs><clipPath id="bc${opts.id || ''}"><circle r="48"/></clipPath></defs>
      <circle r="48" fill="${base}" stroke="${ink}" stroke-width="2.5"/>
      <g clip-path="url(#bc${opts.id || ''})" fill="${ink}">
        <path d="M0-14l13.3 9.7-5.1 15.6H-8.2l-5.1-15.6z"/>
        <path d="M0-48l11-4 4 18-15 6-15-6 4-18z" opacity=".95"/>
        <path d="M40-22l14 4-4 22-15-2-4-16z"/>
        <path d="M-40-22l-14 4 4 22 15-2 4-16z"/>
        <path d="M22 34l10 14-14 10-12-12 4-14z"/>
        <path d="M-22 34l-10 14 14 10 12-12-4-14z"/>
      </g>
      <g stroke="${ink}" stroke-width="2" fill="none" clip-path="url(#bc${opts.id || ''})">
        <path d="M0-14V-28M13.3-4.3L31-14M8.2 11.3L17 30M-8.2 11.3L-17 30M-13.3-4.3L-31-14"/>
      </g>
      ${opts.shade ? `<defs><radialGradient id="bs${opts.id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs><circle r="48" fill="url(#bs${opts.id})"/>` : ''}
    </svg>`;
  };

  /* ============================================================
     Figures (duotone "cutout" players, line doodles)
     viewBox 0 0 100 170 — fill = body colour, accent = shorts / hair / shoes
     ============================================================ */
  const limb = (d, w, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  A.player = (pose = 'dribble', body = '#edff71', accent = '#1f6b35', shade = null) => {
    shade = shade || accent;
    let s = '';
    if (pose === 'dribble') {
      s += limb('M40 98 L38 121 L37 140', 13, body);
      s += limb('M60 98 L64 117 L60 137', 13, body);
      s += limb('M38 110 L37 121', 3, accent);
      s += limb('M62 110 L63 119', 3, accent);
      s += `<path d="M30 139 L45 139 L46 149 L28 150 Q26 144 30 139z" fill="${body}" stroke="${accent}" stroke-width="1.5"/>`;
      s += `<path d="M53 136 L66 135 L69 145 L52 146z" fill="${body}" stroke="${accent}" stroke-width="1.5"/>`;
      s += limb('M30 31 Q22 52 21 76', 14, body);
      s += limb('M70 31 Q78 52 78 74', 14, body);
      s += `<circle cx="21" cy="80" r="5.5" fill="${body}"/><circle cx="78" cy="78" r="5.5" fill="${body}"/>`;
      s += `<path d="M28 27 Q50 20 72 27 L76 78 Q50 84 24 78 Z" fill="${body}"/>`;
      s += `<path d="M58 30 Q67 50 68 76 M38 34 Q34 52 35 72 M27 60 Q30 66 28 74" stroke="${accent}" stroke-width="1.8" fill="none" opacity=".85"/>`;
      s += `<path d="M31 77 L69 77 L71 100 L53 101 L50 94 L47 101 L29 100 Z" fill="${accent}"/>`;
      s += `<path d="M45 19 L55 19 L55 25 L45 25 Z" fill="${shade}"/>`;
      s += `<ellipse cx="50" cy="11.5" rx="9.5" ry="11" fill="${body}"/><path d="M40.5 10 Q41 0 50 0 Q59.5 0 59.5 10 Q55.5 4.5 50 5 Q44.5 4.5 40.5 10z" fill="${shade}"/><path d="M53.5 8 Q57 14 53.5 21 Q58 16.5 59 10z" fill="${shade}" opacity=".9"/>`;
      s += `<circle cx="62" cy="153" r="10" fill="${body}" stroke="${accent}" stroke-width="1.6"/><path d="M57 149 l5 2 1 5 M66 150 l-3 1 M56 157 l3 -1" stroke="${accent}" stroke-width="1.8" fill="none"/>`;
    } else if (pose === 'kick') {
      s += limb('M46 100 L40 126 L32 150', 10, body);
      s += limb('M56 98 L72 116 L92 118', 10, body);
      s += limb('M32 149 L29 157 L38 159', 8, accent);
      s += limb('M91 117 L99 112', 8, accent);
      s += limb('M36 42 L20 56 L10 52', 9, body);
      s += limb('M64 40 L78 30 L88 22', 9, body);
      s += `<path d="M34 38 Q50 31 66 37 L62 84 L38 86 Z" fill="${body}"/>`;
      s += `<path d="M38 82 L62 80 L66 100 L54 104 L50 94 L45 104 L35 100 Z" fill="${accent}"/>`;
      s += `<circle cx="52" cy="20" r="10.5" fill="${body}"/><path d="M41 18 Q43 7 53 8 Q63 9 62 19 Q57 12 51 13 Q45 13 41 18z" fill="${shade}"/>`;
    } else if (pose === 'run') {
      s += limb('M44 100 L32 122 L18 134', 10, body);
      s += limb('M56 100 L66 124 L64 150', 10, body);
      s += limb('M18 133 L12 140', 8, accent);
      s += limb('M64 149 L73 152', 8, accent);
      s += limb('M37 42 L24 60 L30 76', 9, body);
      s += limb('M63 40 L76 54 L88 50', 9, body);
      s += `<path d="M34 38 Q50 30 66 38 L63 84 L37 84 Z" fill="${body}"/>`;
      s += `<path d="M37 82 L63 82 L66 102 L53 104 L50 94 L47 104 L34 102 Z" fill="${accent}"/>`;
      s += `<circle cx="52" cy="20" r="10.5" fill="${body}"/><path d="M41 18 Q43 7 53 8 Q63 9 62 19 Q57 12 51 13 Q45 13 41 18z" fill="${shade}"/>`;
    }
    const vb = pose === 'dribble' ? '12 -3 76 168' : '0 0 100 170';
    return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${s}</svg>`;
  };

  /* hand-drawn stick figure kicking a ball */
  A.doodleKick = (c = '#1d1d1d') =>
    `<svg viewBox="0 0 120 100" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="74" cy="18" r="7"/><path d="M70 26 Q60 38 50 50 M58 36 Q70 40 84 34 M58 36 Q46 30 36 34 M50 50 Q60 60 62 74 L70 80 M50 50 Q38 58 26 56 L18 64"/>
      <circle cx="98" cy="22" r="4"/></svg>`;

  A.arrowDoodle = (c = '#1d1d1d', flip = false) =>
    `<svg viewBox="0 0 200 120" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="${flip ? 'transform:scaleX(-1)' : ''}">
      <path d="M190 20 C 130 0, 60 20, 22 98"/><path d="M14 78 L22 100 L42 86"/></svg>`;

  A.xMark = (c = '#1d1d1d') =>
    `<svg viewBox="0 0 40 50" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"><path d="M8 6 Q20 26 33 45M32 5 Q20 26 7 46"/></svg>`;

  /* ============================================================
     Merch (flat vector product shots)
     ============================================================ */
  A.jersey = (c1 = '#1f9a4c', c2 = '#f2f6f1') => {
    let stripes = '';
    for (let i = 0; i < 12; i++) stripes += `<rect x="${i * 10 + 6}" y="0" width="3.6" height="140" fill="${c2}"/>`;
    return `<svg viewBox="0 0 120 130"><defs><clipPath id="jc"><path d="M38 6 L50 10 Q60 16 70 10 L82 6 L116 22 L106 50 L94 46 L94 126 L26 126 L26 46 L14 50 L4 22 Z"/></clipPath></defs>
      <g clip-path="url(#jc)"><rect width="120" height="130" fill="${c1}"/>${stripes}</g>
      <path d="M50 10 Q60 22 70 10" fill="none" stroke="#1d5a32" stroke-width="3"/>
      <text x="60" y="78" text-anchor="middle" font-family="Young Serif" font-size="15" fill="#fff" opacity=".95">Open Fields</text></svg>`;
  };
  A.tshirt = (c = '#e3262f') =>
    `<svg viewBox="0 0 120 120"><path d="M40 8 Q60 20 80 8 L114 26 L102 50 L90 44 L90 114 L30 114 L30 44 L18 50 L6 26 Z" fill="${c}"/><path d="M48 50 l10 6 -6 10 12 -4 4 12 4 -14" stroke="#fff" stroke-width="2.5" fill="none" opacity=".85"/></svg>`;
  A.cap = (c = '#2c5bd6') =>
    `<svg viewBox="0 0 120 90"><path d="M18 62 Q16 18 60 14 Q104 18 102 62 Z" fill="${c}"/><path d="M60 14 L60 62" stroke="#1d45a8" stroke-width="2"/><path d="M14 60 Q60 52 106 60 L108 70 Q60 64 12 72 Z" fill="#1d45a8"/><text x="60" y="44" text-anchor="middle" font-family="Young Serif" font-size="14" fill="#fff">OF</text></svg>`;
  A.bottle = (c = '#5d7a45') =>
    `<svg viewBox="0 0 60 130"><rect x="20" y="4" width="20" height="12" rx="3" fill="#43562f"/><path d="M38 8 q14 0 14 12 q0 8 -10 8" fill="none" stroke="#43562f" stroke-width="4"/><rect x="10" y="16" width="40" height="110" rx="10" fill="${c}"/><text x="30" y="80" text-anchor="middle" font-family="Young Serif" font-size="11" fill="#d9e8c4" transform="rotate(-90 30 80)">Open Fields</text></svg>`;
})();
