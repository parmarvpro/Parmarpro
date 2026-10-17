/* Reusable UI fragments (HTML strings) — the "Open Fields" product the agency builds. */
(function () {
  const F = window.F;
  const A = F.A;
  const C = (F.C = {});
  const I = A.icon;

  C.iconSpan = (svg, size, color = 'currentColor', extra = '') =>
    `<span style="display:inline-block;width:${size}px;height:${size}px;color:${color};flex:none;${extra}">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</span>`;

  /* ---------- isometric field map (SVG) ---------- */
  C.THEMES = {
    sand: { ground: '#efeacf', path: '#f7f4e3', pathEdge: '#e2dbb4', field: '#b8e85c', field2: '#a6d94e', line: '#e8f7c4', stand: '#e2c23a', standL: '#c9a82a', standR: '#f0d659', goal: '#ffffff', court: '#fbfaf2', accent: '#d9c6ea' },
    dark: { ground: '#2a2b28', path: '#3a3b37', pathEdge: '#1f201d', field: '#3d4a33', field2: '#36432d', line: '#6b7a5c', stand: '#1c1c1a', standL: '#121211', standR: '#26261f', goal: '#9aa38e', court: '#33342f', accent: '#555' },
    blue: { ground: '#1d3557', path: '#284a74', pathEdge: '#152a46', field: '#2c5a96', field2: '#28538b', line: '#86aee0', stand: '#16233a', standL: '#0f192b', standR: '#1f3150', goal: '#c8dbf5', court: '#22426d', accent: '#5d7fb3' },
    night: { ground: '#1f3a22', path: '#2b4a2d', pathEdge: '#16301a', field: '#2f7a37', field2: '#2a6e31', line: '#7fc28a', stand: '#183019', standL: '#10240f', standR: '#22401f', goal: '#cfe8d2', court: '#244a28', accent: '#5f9a63' },
    map: { ground: '#eef0e8', path: '#ffffff', pathEdge: '#e2e5da', field: '#cfe3b6', field2: '#c5dbab', line: '#eaf3de', stand: '#e4e7de', standL: '#cfd3c7', standR: '#f1f3ec', goal: '#ffffff', court: '#f7f8f3', accent: '#dfe6f2' },
    earth: { ground: '#e4dccb', path: '#efe9dc', pathEdge: '#d2c8b2', field: '#c9d6a3', field2: '#bccb93', line: '#eef3df', stand: '#cdbf9c', standL: '#b5a783', standR: '#ddd1b1', goal: '#fff', court: '#f3efe4', accent: '#d8cbb7' },
  };

  /* iso projection helpers (world units → svg units) */
  const ISO_X = Math.cos(Math.PI / 6), ISO_Y = Math.sin(Math.PI / 6);
  const P = (x, y, z = 0) => [(x - y) * ISO_X, (x + y) * ISO_Y - z];
  const poly = (pts, fill, extra = '') =>
    `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${fill}" ${extra}/>`;
  const quad = (x, y, w, d, z = 0) => [P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)];
  const box = (x, y, w, d, hgt, th) =>
    poly([P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, hgt), P(x, y + d, hgt)], th.standL) +
    poly([P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, hgt), P(x + w, y, hgt)], th.standR) +
    poly(quad(x, y, w, d, hgt), th.stand);
  const line = (a, b, c, w = 1.4) =>
    `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}"/>`;

  function isoPitch(x, y, w, d, th) {
    let s = poly(quad(x, y, w, d), th.field);
    for (let i = 1; i < 6; i += 2) s += poly(quad(x + (w / 6) * i, y, w / 6, d), th.field2);
    const L = th.line;
    const pts = quad(x + 4, y + 4, w - 8, d - 8);
    s += `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${L}" stroke-width="1.4"/>`;
    s += line(P(x + w / 2, y + 4), P(x + w / 2, y + d - 4), L);
    // centre circle as projected ellipse
    let circ = '';
    for (let a = 0; a <= 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      const p = P(x + w / 2 + Math.cos(t) * d * 0.16, y + d / 2 + Math.sin(t) * d * 0.16);
      circ += (a ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }
    s += `<path d="${circ}" fill="none" stroke="${L}" stroke-width="1.3"/>`;
    // boxes
    for (const side of [0, 1]) {
      const bx = side ? x + w - 4 - w * 0.14 : x + 4;
      const b = quad(bx, y + d * 0.3, w * 0.14, d * 0.4);
      s += `<polygon points="${b.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${L}" stroke-width="1.2"/>`;
      // goal frame (wireframe box)
      const gx = side ? x + w - 4 : x + 4 - 6;
      const g0 = [P(gx, y + d * 0.42), P(gx + 6, y + d * 0.42), P(gx + 6, y + d * 0.58), P(gx, y + d * 0.58)];
      const g1 = [P(gx, y + d * 0.42, 6), P(gx + 6, y + d * 0.42, 6), P(gx + 6, y + d * 0.58, 6), P(gx, y + d * 0.58, 6)];
      s += `<polygon points="${g1.map((p) => p.join(',')).join(' ')}" fill="rgba(255,255,255,.35)" stroke="${th.goal}" stroke-width="1.3"/>`;
      for (let i = 0; i < 4; i++) s += line(g0[i], g1[i], th.goal, 1.2);
    }
    return s;
  }

  /* layout: 5 pitches, paths, stands, a court and a pavilion */
  C.isoMap = (theme = 'sand', opts = {}) => {
    const th = C.THEMES[theme];
    let s = '';
    s += poly(quad(-40, -40, 420, 420), th.ground);
    // paths (lighter strips with edge)
    for (const p of [[-40, 112, 420, 16], [-40, 252, 420, 16], [128, -40, 16, 420], [268, -40, 16, 420]]) {
      s += poly(quad(p[0], p[1], p[2], p[3]), th.pathEdge);
      s += poly(quad(p[0] + 1.5, p[1] + 1.5, p[2] - 3, p[3] - 3), th.path);
    }
    const pitches = [[-20, -20, 140, 120], [152, -20, 108, 120], [-20, 136, 140, 108], [152, 136, 108, 108], [292, 136, 80, 108]];
    pitches.forEach((p) => (s += isoPitch(p[0], p[1], p[2], p[3], th)));
    // stands along some pitches
    s += box(-20, 104, 140, 6, 7, th) + box(152, 104, 108, 6, 7, th) + box(-20, 246, 140, 6, 7, th);
    s += box(292, -20, 80, 24, 12, th) + box(292, 10, 80, 24, 12, th);
    // courts
    s += poly(quad(292, 286, 36, 70), th.court) + poly(quad(334, 286, 36, 70), th.court);
    s += poly(quad(152, 286, 50, 40), th.accent);
    s += box(212, 290, 40, 26, 10, { stand: th.accent, standL: th.pathEdge, standR: th.path });
    const vb = opts.viewBox || '-380 -60 760 470';
    return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">${s}</svg>`;
  };

  /* ---------- small cards ---------- */
  C.totalCard = (n, label = 'Total Players', dark = true) =>
    `<div class="tcard ${dark ? 'dark' : ''}"><i></i><small>${label}</small><b>${n}</b></div>`;

  C.availableFields = (opts = {}) => `
    <div class="avf">
      <div class="avf-h"><b>Available Fields</b><small>Central Stadium</small></div>
      <div class="avf-row hl"><span>⠿ Field A</span><em class="tag-y">Under Maintenance</em></div>
      <div class="avf-kv"><span>Cap</span><span>5-a-side</span></div>
      <div class="avf-kv"><span>Match Duration</span><span>90 Minutes</span></div>
      <div class="avf-kv"><span>Turf</span><span>Artificial turf</span></div>
      <div class="avf-note">Turf Wear</div>
      ${opts.more ? ['B', 'C', 'D', 'E'].map((f) => `<div class="avf-row"><span>Field ${f}</span><em class="tag-g">Available</em></div>`).join('') : ''}
    </div>`;

  C.chip = (text, cls = '') => `<span class="chip ${cls}">${text}</span>`;

  C.sticky = (color, text, initials, opts = {}) => `
    <div class="sticky" style="background:${color}">
      <span class="sticky-tag">${C.iconSpan(I.chevron, 14)} Status</span>
      <p>${text}</p>
      ${initials ? `<span class="sticky-av">${initials}</span>` : ''}
    </div>`;

  C.searchBar = (text = 'Search team ...') =>
    `<div class="searchbar"><span>${text}</span>${C.iconSpan(I.search, 30, '#222')}</div>`;

  C.productCard = (art, name, sub, opts = {}) => `
    <div class="pcard">
      <div class="pcard-art" style="background:${opts.bg || '#dfe7ea'}">${art}</div>
      <div class="pcard-meta">${opts.badge ? `<em>${opts.badge}</em>` : ''}<b>${name}</b><small>${sub}</small></div>
    </div>`;

  /* big-cell month view, cropped (cells are 150px) */
  C.calendar = (ox = -570, oy = -30) => {
    let s = `<div class="calbig" style="transform:translate(${ox}px,${oy}px)">`;
    const marks = { 5: 1, 6: 1, 10: 1, 11: 1, 12: 1, 19: 1, 20: 1 };
    const days = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    for (const d of days) s += `<span class="${marks[d] ? 'on' : ''}">${d}</span>`;
    return s + '</div>';
  };

  C.posterRed = () => `
    <div class="poster-red">
      <div class="pr-figs">${A.player('run', 'rgba(255,255,255,.18)', 'rgba(255,255,255,.12)')}${A.player('kick', 'rgba(255,255,255,.14)', 'rgba(255,255,255,.1)')}</div>
      <span class="pr-t1">your game</span><span class="pr-t2">starts here</span><span class="pr-ok">OK</span><i></i>
    </div>`;

  C.codeFigures = () => `
    <div class="codefig">
      <pre>w.d.ready(f
$w("#sw1")
⇒ {
  const darkM
$w("#mo_switch
  if (darkMod</pre>
      <div class="cf-figs">
        <span style="left:-6%;top:-6%;width:52%">${A.player('dribble', '#edff71', '#1f6b35')}</span>
        <span style="left:30%;top:20%;width:52%">${A.player('run', '#edff71', '#1f6b35')}</span>
        <span style="left:-4%;top:52%;width:52%">${A.player('dribble', '#edff71', '#1f6b35')}</span>
      </div>
    </div>`;

  C.chartPaper = (w = 480, h = 300) => {
    let g = '';
    for (let x = 0; x <= w; x += 12) g += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="rgba(0,0,0,${x % 60 ? 0.12 : 0.28})" stroke-width="1"/>`;
    for (let y = 0; y <= h; y += 12) g += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="rgba(0,0,0,${y % 60 ? 0.12 : 0.28})" stroke-width="1"/>`;
    const pts = [[18, 250], [40, 238], [70, 214], [100, 200], [130, 185], [165, 168], [190, 150], [230, 120], [260, 104], [300, 80], [340, 72], [380, 56], [430, 40]];
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join('');
    const dots = pts.filter((_, i) => i % 3 === 0).map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#1d1d1d"/>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${g}<path d="${d}" stroke="#1d1d1d" stroke-width="2" fill="none"/>${dots}</svg>`;
  };

  C.tileIcon = (bg, glyph, fg = '#1d1d1d') =>
    `<div class="tile-ic" style="background:${bg};color:${fg}">${glyph}</div>`;

  /* chunky black glyphs used on orange tiles / icon rows */
  C.glyph = {
    meeple: '<svg viewBox="0 0 100 100"><path d="M50 8c9 0 15 7 15 15 0 5-2 9-5 12 9 3 30 9 30 21 0 6-6 8-14 8h-6l12 28H66L50 70 34 94H18l12-28h-6C16 66 10 64 10 58c0-12 21-18 30-21-3-3-5-7-5-12 0-8 6-17 15-17z" fill="currentColor"/></svg>',
    arrow: '<svg viewBox="0 0 100 100"><path d="M10 40h44V16l38 34-38 34V60H10z" fill="currentColor"/></svg>',
    swirl: '<svg viewBox="0 0 100 100"><path d="M64 10c14 0 22 10 18 22-3 9-13 14-24 15l-8 1c-6 1-9 4-9 8 0 5 6 7 13 6l12-2-6 30-22 0c-16 0-26-10-22-24 3-10 13-15 25-16l8-1c5-1 8-3 8-7 0-5-5-7-12-6l-12 2 6-28z" fill="currentColor"/></svg>',
    puzzle: '<svg viewBox="0 0 100 100"><path d="M40 6h20v22h14l6-8 14 14-8 6v14l8 6-14 14-6-8H60v28H40V72H26l-6 8L6 66l8-6V46l-8-6 14-14 6 8h14z" fill="currentColor"/></svg>',
    flower: '<svg viewBox="0 0 100 100"><g fill="currentColor"><circle cx="50" cy="24" r="20"/><circle cx="50" cy="76" r="20"/><circle cx="24" cy="50" r="20"/><circle cx="76" cy="50" r="20"/><rect x="30" y="30" width="40" height="40"/></g><g fill="var(--hole,#efede9)"><circle cx="50" cy="22" r="5"/><circle cx="50" cy="78" r="5"/><circle cx="22" cy="50" r="5"/><circle cx="78" cy="50" r="5"/><rect x="45" y="45" width="10" height="10"/></g></svg>',
    castle: '<svg viewBox="0 0 100 100"><path fill="currentColor" d="M12 8h20v10h10V8h16v10h10V8h20v20H78v10h10v24H78v10h10v20H68V82H58v10H42V82H32v10H12V72h10V62H12V38h10V28H12z"/><rect x="38" y="38" width="24" height="24" fill="var(--hole,#ee6a12)"/></svg>',
    star4: '<svg viewBox="0 0 100 100"><path fill="currentColor" d="M50 4c4 16 12 26 30 28l16 2v32l-16 2c-18 2-26 12-30 28-4-16-12-26-30-28L4 66V34l16-2C38 30 46 20 50 4z"/><circle cx="50" cy="50" r="6" fill="var(--hole,#efede9)"/></svg>',
    checker: '<svg viewBox="0 0 100 100" fill="currentColor"><rect x="4" y="4" width="20" height="20"/><rect x="40" y="4" width="20" height="20"/><rect x="76" y="4" width="20" height="20"/><rect x="22" y="22" width="20" height="20"/><rect x="58" y="22" width="20" height="20"/><rect x="4" y="40" width="20" height="20"/><rect x="40" y="40" width="20" height="20"/><rect x="76" y="40" width="20" height="20"/><rect x="22" y="58" width="20" height="20"/><rect x="58" y="58" width="20" height="20"/><rect x="4" y="76" width="20" height="20"/><rect x="40" y="76" width="20" height="20"/><rect x="76" y="76" width="20" height="20"/></svg>',
    gearBold: '<svg viewBox="0 0 100 100"><path fill="currentColor" d="M42 4h16l3 13 9 4 11-7 11 11-7 11 4 9 13 3v16l-13 3-4 9 7 11-11 11-11-7-9 4-3 13H42l-3-13-9-4-11 7L8 81l7-11-4-9-13-3V42l13-3 4-9-7-11L19 8l11 7 9-4z"/><circle cx="50" cy="50" r="13" fill="var(--hole,#efede9)"/></svg>',
    plusBold: '<svg viewBox="0 0 100 100"><path fill="currentColor" d="M36 4h28v32h32v28H64v32H36V64H4V36h32z"/><circle cx="50" cy="50" r="7" fill="var(--hole,#efede9)"/></svg>',
    cc: '<svg viewBox="0 0 100 100"><path fill="currentColor" d="M50 20a30 30 0 1 0 0 60V62a12 12 0 1 1 0-24zM84 20a30 30 0 1 0 0 60V62a12 12 0 1 1 0-24z" transform="translate(-12 0)"/></svg>',
    eye: '<svg viewBox="0 0 100 100"><path fill="currentColor" d="M50 22C28 22 12 38 4 50c8 12 24 28 46 28s38-16 46-28C88 38 72 22 50 22z"/><circle cx="50" cy="50" r="14" fill="var(--hole,#efede9)"/><circle cx="50" cy="50" r="6" fill="currentColor"/></svg>',
    globeBold: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="currentColor"/><path d="M50 12v76M12 50h76M50 12c-14 12-20 24-20 38s6 26 20 38M50 12c14 12 20 24 20 38s-6 26-20 38" stroke="var(--hole,#efede9)" stroke-width="7" fill="none"/></svg>',
  };
})();
