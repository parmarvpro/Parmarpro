/* OUTRO  0:45.9 – 0:51.7
   "You don't need to reinvent yourself. It's already done. Base44." */
(function () {
  const F = window.F, A = F.A, C = F.C, E = F.E, I = A.icon;
  const { tw, kf, prog, set, h, clamp, lerp } = F;

  /* ===========================================================
     S26 — a quiet moment, then the whole body of work stacks up
     =========================================================== */
  function lineChart() {
    const pts = [[40, 330], [80, 300], [120, 285], [160, 270], [200, 230], [240, 226], [280, 200], [320, 170], [360, 160], [400, 120], [440, 100], [480, 70], [520, 40]];
    let s = '<svg viewBox="0 0 560 380" width="100%" height="100%">';
    s += '<path d="M40 20 V340 H540" fill="none" stroke="#f2f2f2" stroke-width="2"/>';
    ['4.0', '3.0', '2.0', '1.0'].forEach((v, i) => (s += `<text x="8" y="${60 + i * 80}" font-family="JetBrains Mono" font-size="14" fill="#f2f2f2">${v}</text>`));
    [15, 30, 45, 60, 75, 90].forEach((v, i) => (s += `<text x="${90 + i * 80}" y="368" font-family="JetBrains Mono" font-size="14" fill="#f2f2f2">${v}</text>`));
    s += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join('')}" fill="none" stroke="#fff" stroke-width="2.5"/>`;
    pts.filter((_, i) => i % 3 === 0).forEach((p) => (s += `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="#fff"/>`));
    return s + '</svg>';
  }
  const stripes = () => '<div class="stripes"></div>';

  F.scene({
    id: 'stack',
    start: 45.96,
    end: 49.2,
    build(root) {
      root.style.background = '#c7bba8';
      root.innerHTML = `<div class="abs st-cam"></div><div class="grain" style="background-image:url(${A.grain(21)})"></div><div class="abs st-layer"></div>`;
      const cam = F.$(root, '.st-cam');
      cam.innerHTML = F.officeHTML({ seed: 31, winX: 420, winY: 20, plants: [[-60, 300, 2.6], [1640, 260, 2.4], [1180, 520, 1.2]], desks: [{ x: 0, y: 860, w: 2200, mon: [620, 980] }], people: [] });
      F.$(cam, '.office').style.filter = 'blur(26px) saturate(.9) brightness(.92)';
      const layer = F.$(root, '.st-layer');
      const items = [];
      const add = (x, y, w, hh, html, at, cls = '') => {
        const el = h(`<div class="abs citem ${cls}" style="width:${w}px;height:${hh}px">${html}</div>`);
        layer.appendChild(el);
        items.push({ el, x, y, at });
        return el;
      };
      add(0, -40, 640, 451, '<div class="bignum big43"><small>Total Players</small><b>43</b></div>', 1.22);
      add(240, 474, 369, 531, C.tileIcon('var(--orange)', C.glyph.arrow.replace('<svg ', '<svg style="transform:rotate(90deg)" ')), 1.42);
      add(1170, 534, 585, 366, `<div class="photo" style="background-image:url(${A.sunset(600, 380)})"></div>`, 1.62);
      add(0, 534, 459, 546, `<div class="photo bwcut">${A.player('dribble', '#f2f2f0', '#7a7a76', '#4a4a46')}</div><div class="srch">${C.iconSpan(I.search, 18)} Search team</div>`, 1.6);
      add(297, 426, 780, 680, `<div class="photo" style="background-image:url(${A.grass(800, 700, 61, 1.2, 4)})"></div>`, 1.84);
      add(1041, 740, 140, 340, stripes(), 1.86);
      add(640, -10, 860, 440, `<div class="photo" style="background-image:url(${A.halftone('lime', 860, 440, { bg: '#c6e37a', fg: '#2f5a22', step: 12, cx: 0.1, cy: 0.9 })})"></div>`, 2.04);
      add(1074, 6, 504, 654, `<div class="photo fieldcard"><svg viewBox="0 0 100 130" preserveAspectRatio="none"><circle cx="50" cy="60" r="38" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".6"/><path d="M0 120 L100 10" stroke="rgba(255,255,255,.35)" stroke-width=".6"/></svg></div><span class="chip chip-lime" style="position:absolute;left:14px;top:14px;font-size:26px;padding:8px 16px">Outdoor</span>`, 2.02);
      add(1050, 650, 528, 56, '<div class="fieldc"><b>⠿ FIELD C</b><span><em>Outdoor</em><em>★ 4.8</em></span></div>', 2.08);
      add(459, 435, 600, 555, lineChart(), 2.06);
      add(441, 351, 363, 489, C.productCard(A.ball({ id: 'cb', shade: true }), 'Custom ball', 'Great for every game', { badge: 'Best seller', bg: '#f3f2ee' }), 2.22);
      add(1491, 0, 429, 624, `<div class="photo" style="background:var(--blue)"><div style="position:absolute;left:12%;top:4%;width:76%;height:94%">${A.player('dribble')}</div></div>`, 2.42);
      add(1500, 860, 420, 220, `<div class="blist"><div class="bl0">${A.base44Mark('var(--orange)')} Building...</div><div class="bl1"><i></i>Searching online</div><div class="bl2"><i></i>Gathering Results</div><div class="bl3"><i></i>Compiling list</div></div>`, 2.24);
      add(1689, 600, 231, 160, `<div class="photo" style="background:#e9e9e2">${C.isoMap('sand', { viewBox: '0 140 160 100' })}</div><span class="booknow">Book Now</span>`, 2.62);
      add(1050, 980, 400, 100, '<div class="ofw">Open Fields</div>', 2.4);
      const blist = items[items.length - 3].el;
      const rows = F.$$(blist, '.bl1, .bl2, .bl3');
      const grain = F.$(root, '.grain');
      return (lt) => {
        set(cam, { x: -200 - lt * 26, y: -60 - lt * 6, s: 1.08 + lt * 0.012 });
        for (const it of items) {
          const p = prog(lt, it.at, it.at + 0.14);
          set(it.el, { x: it.x, y: it.y + (1 - E.outCubic(p)) * 18, s: lerp(0.94, 1, E.outCubic(p)), o: p > 0 ? 1 : 0 });
        }
        rows.forEach((r, i) => r.classList.toggle('ok', lt > 2.5 + i * 0.18));
        grain.style.transform = `translate(${(Math.floor(lt * 24) * 37) % 200 - 100}px, ${(Math.floor(lt * 24) * 59) % 200 - 100}px)`;
      };
    },
  });

  /* ===========================================================
     S27 — "It's already done."
     =========================================================== */
  F.scene({
    id: 'done',
    start: 49.2,
    end: 49.96,
    build(root) {
      root.classList.add('bg-paper');
      root.innerHTML = `<div class="abs done-t">It’s already done<i class="done-dot"></i></div>
        <div class="abs" style="left:1491px;top:0;width:429px;height:624px"><div class="photo" style="background:var(--blue)"><div style="position:absolute;left:12%;top:4%;width:76%;height:94%">${A.player('dribble')}</div></div></div>
        <div class="abs done-ball"><div class="photo" style="background:#f07a2c;display:grid;place-items:center"><div style="width:84%">${A.ball({ id: 'db', base: '#e4f56a', ink: '#2f6a2a' })}</div></div></div>`;
      const t = F.$(root, '.done-t');
      const dot = F.$(root, '.done-dot');
      const card = root.children[1];
      const ball = F.$(root, '.done-ball');
      return (lt) => {
        const clear = prog(lt, 0.0, 0.2);
        set(card, { o: 1 - prog(lt, 0.16, 0.22), x: E.inCubic(clear) * 120 });
        set(ball, { x: 1123, y: 366, o: 1 - prog(lt, 0.17, 0.22), s: lerp(1, 0.9, prog(lt, 0.1, 0.22)) });
        set(t, { x: 684, y: 498, o: 1 });
        // the full stop drifts in from the right and docks
        set(dot, { x: tw(lt, 0.25, 0.55, 80, 0, E.outCubic), y: tw(lt, 0.25, 0.55, 12, 0, E.outCubic) });
      };
    },
  });

  /* ===========================================================
     S28 — the mark resolves through a row of glyphs
     =========================================================== */
  F.scene({
    id: 'glyphs',
    start: 49.96,
    end: 50.27,
    build(root) {
      root.classList.add('bg-paper');
      const rowA = ['checker', 'arrow', 'globeBold', 'gearBold', 'castle'];
      const rowB = ['flower', 'castle', 'star4', 'checker'];
      const mk = (names, hi) => `<div class="abs grow">${names.map((n, i) => `<span class="gl ${i === hi ? 'hi' : ''}">${C.glyph[n]}</span>`).join('')}</div>`;
      root.innerHTML = mk(rowA, 4) + mk(rowB, 1) + '<i class="tick"></i><i class="tick"></i><i class="tick"></i><i class="tick"></i>';
      const [a, b] = F.$$(root, '.grow');
      const ticks = F.$$(root, '.tick');
      return (lt) => {
        const second = lt > 0.15;
        a.style.display = second ? 'none' : '';
        b.style.display = second ? '' : 'none';
        set(a, { x: 656, y: 490 });
        set(b, { x: 711, y: 490 });
        const box = second ? [672, 1240] : [612, 1300];
        [[box[0], 452], [box[1], 452], [box[0], 618], [box[1], 618]].forEach((p, i) => set(ticks[i], { x: p[0] + (second ? (i % 2 ? 50 : -50) * prog(lt, 0.15, 0.31) : 0), y: p[1], o: 1 }));
      };
    },
  });

  /* ===========================================================
     S29 — end card
     =========================================================== */
  F.scene({
    id: 'endcard',
    start: 50.27,
    end: 52,
    build(root) {
      root.style.background = '#ec6b0e';
      root.innerHTML = `<div class="abs end-logo" style="font-size:86px">${A.base44Logo('#2a1a10', '#2a1a10')}</div><i class="end-dot l"></i><i class="end-dot r"></i><span class="abs end-glyph">${C.glyph.checker}</span>`;
      const logo = F.$(root, '.end-logo');
      const dots = F.$$(root, '.end-dot');
      const fours = F.$(root, '.b44-44');
      const glyph = F.$(root, '.end-glyph');
      let w = 0;
      return (lt) => {
        // for a beat the second "4" is still a glyph
        const morph = lt < 0.16;
        fours.style.clipPath = morph ? 'inset(0 52% 0 0)' : '';
        glyph.style.display = morph ? '' : 'none';
        if (!w) w = logo.firstElementChild.getBoundingClientRect().width / (F.stage.getBoundingClientRect().width / F.W) || 400;
        const s = tw(lt, 0, 1.24, 1.0, 1.02, E.linear);
        logo.style.transformOrigin = '0 0';
        set(logo, { x: 960 - (w / 2) * s, y: 540 - 45 * s, s });
        dots.forEach((d, i) => set(d, { x: i ? 960 + w / 2 + 40 : 960 - w / 2 - 50, y: 536, o: 1 - prog(lt, 0.3, 0.38) }));
        set(glyph, { x: 960 + (w / 2) * s - 58, y: 540 - 30 });
      };
    },
  });
})();
