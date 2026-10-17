/* INTRO  0:00 – 0:12.45
   "Your clients dream big. Your agency builds bigger. Base44.
    Build it all. Give your clients what others don't." */
(function () {
  const F = window.F, A = F.A, C = F.C, E = F.E, I = A.icon;
  const { tw, kf, prog, set, h, clamp, lerp } = F;

  const WORD_FONT = (px) => `500 ${px}px "Inter"`;
  const TRACK = -0.01;

  /* ===========================================================
     S01 + S02 — kinetic words that break into a panning collage
     =========================================================== */
  F.scene({
    id: 'words-collage',
    start: 0,
    end: 4.62,
    build(root) {
      root.classList.add('bg-paper');
      const FS = 87;
      const grid = h('<div class="fill grid-bg"></div>');
      root.appendChild(grid);

      // faint ghost UI layer seen behind the first line
      const ghost = h('<div class="fill ghost-ui"></div>');
      const gr = F.rng(4);
      for (let i = 0; i < 26; i++) {
        const w = 60 + gr() * 220, hh = 20 + gr() * 120;
        ghost.insertAdjacentHTML('beforeend', `<i style="left:${gr() * 1900}px;top:${gr() * 1060}px;width:${w}px;height:${hh}px"></i>`);
      }
      root.appendChild(ghost);

      const cam = h('<div class="abs collage-cam"></div>');
      root.appendChild(cam);
      const wl = h('<div class="abs" style="z-index:5"></div>');
      cam.appendChild(wl);

      // --- sentence 1 ---
      const words1 = ['Your', 'clients', 'dream', 'big'];
      const space = F.measure(' ', WORD_FONT(FS)) + TRACK * FS;
      const widths = words1.map((w) => F.measure(w, WORD_FONT(FS), TRACK, FS));
      const total = widths.reduce((a, b) => a + b, 0) + space * 3;
      let x0 = 960 - total / 2;
      const s1 = words1.map((w, i) => {
        const el = h(`<div class="word inter" style="font-size:${FS}px">${w}</div>`);
        wl.appendChild(el);
        const pos = { x: x0, y: 540 - FS * 0.55 };
        x0 += widths[i] + space;
        return { el, pos };
      });

      // --- sentence 2 words ---
      const mk = (txt) => {
        const el = h(`<div class="word inter" style="font-size:${FS}px">${txt}</div>`);
        wl.appendChild(el);
        return el;
      };
      const agency = mk('agency');
      const builds = mk('builds');
      const bigger = mk('big');
      const mark = h(`<div class="abs" style="width:124px;height:124px">${A.agencyMark()}</div>`);
      wl.appendChild(mark);

      // --- collage items ---
      // Each item is placed by where it sits on screen at an observed time (tobs),
      // so the whip-pan lines up with the reference; d = parallax depth.
      const panX = F.spline([[2.7, 0], [3.0, 100], [3.2, 266], [3.333, 524], [3.467, 830], [3.6, 1304], [3.733, 1850], [3.85, 2500], [4.0, 3350], [4.1, 3930], [4.2, 4400], [4.3, 4800], [4.4, 5050], [4.5, 5230], [4.6, 5380]]);
      const items = [];
      const add = (sx, sy, w, hh, html, pop, opt = {}) => {
        const el = h(`<div class="abs citem ${opt.cls || ''}" style="width:${w}px;height:${hh}px;${opt.style || ''}">${html}</div>`);
        el.style.transformOrigin = '50% 50%';
        if (opt.z) el.style.zIndex = opt.z;
        cam.appendChild(el);
        const d = opt.d || 1;
        const tobs = opt.t != null ? opt.t : 2.8;
        items.push({ el, x: sx + panX(tobs) * d, y: sy, d, pop, r: opt.r || 0 });
        return el;
      };
      const tick = (x, y, pop, t) => add(x, y, 13, 13, '', pop, { style: 'background:var(--orange)', t });
      const circle = (x, y, r, pop, t) => add(x, y, r, r, '', pop, { style: 'border-radius:50%;background:var(--magenta)', t });

      // around the words (all pop in)
      add(175, 115, 183, 181, C.posterRed(), 1.88);
      circle(-45, 670, 90, 2.05);
      add(0, 266, 190, 274, C.codeFigures(), 2.47, { style: 'overflow:visible' });
      add(74, 673, 318, 252, C.availableFields(), 2.4);
      add(796, -12, 424, 283, `<div class="photo" style="overflow:hidden">${C.isoMap('map', { viewBox: '-120 40 300 200' })}</div><span class="chip chip-dark" style="position:absolute;left:50%;top:48%;transform:translate(-50%,-50%)">1.2k reviews</span>`, 2.3);
      add(1216, 271, 265, 408, `<div class="photo" style="background:var(--blue)"><div style="position:absolute;left:6%;top:3%;width:88%;height:96%">${A.player('dribble')}</div></div>`, 2.46);
      add(932, 813, 158, 134, C.totalCard(453), 2.4);
      tick(636, 673, 2.3);
      // revealed as the pan starts (pop = first appearance in the reference)
      add(1168, 118, 488, 296, C.chartPaper(488, 296), 2.9, { t: 3.2 });
      add(1080, 89, 40, 52, A.xMark(), 2.95, { t: 3.2 });
      add(1402, -6, 299, 280, `<div class="photo" style="background-image:url(${A.pitch('bwlegs', 300, 280, { c1: '#6f7a6a', c2: '#808b7a', stripeW: 60, stripeAngle: 0.5, gray: true, vignette: 0.1, players: [[0.5, 0.6, '#eee', 1.4]], ps: 26 })})"></div><div style="position:absolute;left:54%;top:64%;width:22%">${A.ball({ id: 'l' })}</div>`, 3.14, { t: 3.2 });
      add(148, 843, 296, 296, `<div class="sticker-ball">${A.ball({ id: 'st', base: '#efeee8' })}<span class="sb-goal">Goal!!!!</span><span class="sb-of">Open Fields</span></div>`, 2.97, { r: -8, t: 3.2 });
      add(1080, 952, 300, 120, C.sticky('#fbf3a8', 'Looks great! Let\'s tag Dan for a final approval :)', ''), 3.02, { cls: 'sticky-sm', t: 3.067 });
      add(930, 900, 640, 130, '<div class="handwrite hw-intro"><span>your game</span><span>starts here</span></div>', 3.22, { t: 3.267 });
      add(1452, 606, 330, 380, `<div style="position:absolute;inset:0;overflow:hidden">${C.calendar()}</div>`, 3.22, { t: 3.267 });
      // streaming past during the whip-pan
      add(1470, -10, 174, 145, C.tileIcon('var(--orange)', C.glyph.meeple), 3.29, { t: 3.333 });
      add(1340, 40, 170, 80, '<div class="dotbadge sm"><span>Discover</span><span>your Next</span><span>Pitch</span></div>', 3.43, { t: 3.467 });
      add(1227, 450, 219, 52, `<div class="bookchip">${C.iconSpan(I.target, 20)}Book a field</div>`, 3.43, { t: 3.467 });
      tick(1527, 414, 3.43, 3.467);
      add(1464, 228, 315, 40, '<div class="fieldchip"><span>⠿ Field C</span><em class="tag-g">Available</em></div>', 3.49, { t: 3.533 });
      add(1200, -50, 420, 190, `<div class="photo">${C.isoMap('sand', { viewBox: '-60 150 260 110' })}</div>`, 3.56, { t: 3.6 });
      add(1014, 735, 3200, 420, '<div class="of-giant">Open Fields</div>', 3.56, { t: 3.6, z: 0 });
      add(771, 546, 591, 399, `<div class="photo" style="background-image:url(${A.pitch('bwsearch', 600, 400, { c1: '#9aa09a', c2: '#b4b8b2', stripeW: 90, stripeAngle: -0.55, gray: true, vignette: 0.08, players: [[0.15, 0.2, '#ddd'], [0.4, 0.4, '#333'], [0.78, 0.15, '#eee'], [0.2, 0.75, '#eee'], [0.55, 0.72, '#333']], ps: 16, lines: [{ type: 'line', x1: 0.04, y1: 0, x2: 0.04, y2: 1 }, { type: 'arc', x: 1.05, y: 0.95, r: 0.22 }] })})"></div><div style="position:absolute;left:16%;top:40%;width:68%">${C.searchBar()}</div>`, 3.62, { t: 3.667 });
      add(909, 165, 420, 375, `<div class="photo" style="background:#dbe6ea;display:grid;place-items:center"><div style="width:70%;height:94%">${A.jersey()}</div></div>`, 3.69, { t: 3.733, d: 1.1 });
      add(690, 315, 189, 195, A.arrowDoodle(), 3.69, { t: 3.733 });
      add(399, -20, 306, 155, '<div class="minidash"><i class="md-donut"></i><div><small>MORNING SYNC</small><b>7AM</b></div></div>', 3.76, { t: 3.8 });
      circle(645, 225, 125, 3.76, 3.8);
      add(705, 135, 204, 135, C.chartPaper(204, 135), 3.77, { t: 3.8 });
      add(519, 405, 615, 405, '<div class="bignum"><small>Total Players</small><b>15</b></div>', 3.77, { t: 3.8 });
      add(300, -60, 690, 336, `<div class="picnic"><span style="left:0">${A.ball({ id: 'p1', base: '#fff' })}</span><span style="left:30%">${A.ball({ id: 'p2', base: '#fff' })}</span><em>PICNIC ON THE PITCH</em></div>`, 3.84, { t: 3.9 });
      add(735, 426, 195, 99, '<div class="letsplay">Let\'s Play</div>', 3.86, { t: 3.9 });
      add(807, -20, 354, 446, C.productCard(A.bottle(), 'Water Jug', 'Great for hot summer days', { badge: 'Best seller', bg: '#dfe9ee' }), 3.94, { t: 4.0 });
      add(1491, 216, 60, 75, A.xMark(), 3.95, { t: 4.0 });
      add(642, 546, 504, 135, C.tileIcon('var(--orange)', C.glyph.swirl), 3.95, { t: 4.0 });
      add(420, 681, 360, 420, `<div class="photo" style="background:#1d7a3a">${['dribble', 'run', 'kick', 'dribble'].map((p, i) => `<span style="position:absolute;left:${[-10, 40, 6, 52][i]}%;top:${[-6, 4, 46, 52][i]}%;width:56%">${A.player(p, '#edff71', '#2f3fbf')}</span>`).join('')}</div>`, 3.95, { t: 4.0 });
      add(1000, 21, 480, 360, `<div class="photo" style="background-image:url(${A.park('forest', 480, 360, { horizon: 0.74, treeH: 0.72, sky0: '#cfe0c8', sky1: '#e9efe6', goalX: 0.06, f0: '#7fae55', f1: '#5d9a3e', dense: true })})"></div><span class="chip chip-lime" style="position:absolute;right:12px;top:12px;font-size:18px;padding:6px 12px">Outdoor</span>`, 4.04, { t: 4.1 });
      circle(624, 441, 120, 4.05, 4.1);
      add(549, 816, 690, 330, `<div class="photo" style="background:#222">${C.isoMap('dark', { viewBox: '-170 40 340 160' })}</div>`, 4.05, { t: 4.1 });
      add(1155, 219, 195, 195, A.arrowDoodle('#1d1d1d', true), 4.14, { t: 4.2 });
      add(735, 534, 195, 165, A.doodleKick(), 4.14, { t: 4.2 });
      add(1311, 609, 230, 240, `<div style="position:absolute;inset:0 0 36px 0">${A.cap()}</div><small class="capcap">2026 Season Cap</small>`, 4.14, { t: 4.2, d: 1.15 });
      add(990, 474, 324, 129, C.tileIcon('var(--orange)', C.glyph.arrow), 4.34, { t: 4.4, d: 1.1 });
      add(1338, 39, 162, 204, '<div class="shield"><div class="sh-top">◫</div><b>Open Fields</b><small>EST · 2026</small></div>', 4.34, { t: 4.4, d: 1.2 });
      tick(1566, 144, 4.4, 4.5);
      tick(828, 825, 4.4, 4.5);

      const words = [s1[0].el, s1[1].el, s1[2].el, s1[3].el, agency, builds, bigger, mark];
      return (t) => {
        // backgrounds
        set(ghost, { o: tw(t, 0, 1.4, 0.3, 0, E.inOutQuad) });
        set(grid, { o: tw(t, 1.3, 1.9, 0, 1) });

        // camera
        const cx = panX(t);
        set(wl, { x: -cx });

        // after the break the words shrink to ~77% as the camera settles on the collage
        const wk = lerp(1, 0.77, E.inOutCubic(prog(t, 1.38, 1.62)));
        // sentence 1 reveal
        const starts = [-0.2, 0.06, 0.42, 0.8];
        s1.forEach((w, i) => {
          const p = prog(t, starts[i], starts[i] + 0.32);
          let x = w.pos.x, y = w.pos.y + (1 - E.outCubic(p)) * 26 - tw(t, 0, 1.4, -10, 0, E.outQuad);
          let o = p;
          if (i === 0) {
            // "Your" flings left, settles
            const q = prog(t, 1.46, 1.78);
            x = lerp(x, 190, E.outBack(q));
            y = lerp(y, 606 - FS * 0.55, E.outCubic(q));
          } else {
            const q = prog(t, 1.46, 1.62);
            const dx = (990 - s1[2].pos.x);
            x += dx * E.outCubic(q);
            if (i === 1) {
              const qq = prog(t, 1.58, 1.7);
              o = p * (1 - qq);
              set(w.el, { x: x + qq * 30, y, o, s: wk * (1 - qq * 0.4) });
              return;
            }
            if (i === 2) o = p * (1 - prog(t, 2.26, 2.34));
            if (i === 3) {
              o = p * (1 - prog(t, 2.36, 2.4));
              x -= (widths[2] + space) * (1 - wk); // keep "dream big" tight while the pair shrinks
            }
          }
          set(w.el, { x, y, o, s: wk });
        });

        // agency + mark
        const pa = prog(t, 1.57, 1.72);
        set(agency, { x: 471 + (1 - E.outCubic(pa)) * 60, y: 465 - FS * 0.55, o: pa, s: wk });
        const pm = prog(t, 1.58, 1.84);
        set(mark, { x: 825 - 2, y: 546 - 62, s: E.outBack(pm) * 1, r: (1 - E.outCubic(pm)) * -40, o: clamp(pm * 3) });

        // builds / bigger
        const pb = prog(t, 2.28, 2.4);
        set(builds, { x: 957, y: 333 - FS * 0.55 + (1 - E.outCubic(pb)) * -24, o: pb, s: wk });
        const pg = prog(t, 2.38, 2.6);
        const bigX = lerp(s1[3].pos.x + (990 - s1[2].pos.x), 1122, E.outCubic(pg));
        const bigY = lerp(546, 735, E.outCubic(pg)) - FS * 0.55;
        F.text(bigger, t < 2.46 ? 'big' : 'bigger');
        set(bigger, { x: bigX, y: bigY, o: prog(t, 2.36, 2.4), s: wk });

        // collage pops + parallax
        for (const it of items) {
          const x = it.x - cx * it.d;
          if (x > 2100 || x < -1400) { set(it.el, { o: 0 }); continue; }
          if (it.pop) {
            const p = prog(t, it.pop, it.pop + (it.pop > 3 ? 0.16 : 0.3));
            set(it.el, { x, y: it.y + (1 - E.outCubic(p)) * 20, s: lerp(0.86, 1, E.outBack(p)), r: it.r, o: clamp(p * 2.5) });
          } else set(it.el, { x, y: it.y, r: it.r, o: 1 });
        }

        // exit: everything snaps away for the logo
        const pe = prog(t, 4.42, 4.6);
        cam.style.opacity = String(1 - E.inQuad(pe));
      };
    },
  });

  /* ===========================================================
     S03 — Base44 logo
     =========================================================== */
  F.scene({
    id: 'logo-1',
    start: 4.5,
    end: 5.96,
    build(root) {
      root.classList.add('grid-bg');
      const logo = h(`<div class="abs" style="font-size:109px">${A.base44Logo('var(--orange)')}</div>`);
      root.appendChild(logo);
      const parts = [[620, 150], [1370, 420], [470, 820], [1500, 900]].map(([x, y]) => {
        const el = h('<div class="tick"></div>');
        root.appendChild(el);
        return { el, x, y };
      });
      const card = h(`<div class="abs" style="width:150px;height:130px;border-radius:4px;overflow:hidden">${C.posterRed()}</div>`);
      root.appendChild(card);
      let w = 0;
      return (lt) => {
        if (!w) w = logo.firstElementChild.getBoundingClientRect().width / (F.stage.getBoundingClientRect().width / F.W) || 520;
        const s = tw(lt, 0, 1.5, 0.98, 1.02, E.outCubic);
        const slide = tw(lt, 0.02, 0.75, 150, 0, E.outCubic);
        set(logo, { x: 960 - (w / 2) * s + slide, y: 532 - 56 * s, s, o: prog(lt, 0.02, 0.1) });
        logo.style.transformOrigin = '0 0';
        parts.forEach((p, i) => set(p.el, { x: p.x + lt * (i % 2 ? -14 : 12), y: p.y - lt * 10, o: prog(lt, 0, 0.1) * (1 - prog(lt, 1.1, 1.4)) }));
        set(card, { x: 1290 + lt * 900, y: 860 + lt * 420, r: 12 + lt * 40, o: 1 - prog(lt, 0.05, 0.22) });
      };
    },
  });

  /* ===========================================================
     S04 — the agency at work (coded stand-in for the office footage)
     =========================================================== */
  function officeLayer(opts = {}) {
    const r = F.rng(opts.seed || 21);
    let s = '<div class="office">';
    // windows
    for (let i = 0; i < 4; i++) {
      s += `<div class="o-win" style="left:${opts.winX + i * 300}px;top:${opts.winY}px;width:240px;height:420px"></div>`;
    }
    // lamps
    for (let i = 0; i < 4; i++) s += `<div class="o-lamp" style="left:${300 + i * 420}px;top:${80 + (i % 2) * 30}px"></div>`;
    // back wall shelf + brick dado
    s += '<div class="o-dado"></div>';
    // plants
    for (const [x, y, k] of opts.plants || []) {
      s += `<div class="o-plant" style="left:${x}px;top:${y}px;transform:scale(${k})">`;
      for (let i = 0; i < 9; i++) s += `<i style="left:${40 + (r() - 0.5) * 90}px;top:${(r() * 120).toFixed(0)}px;transform:rotate(${(r() - 0.5) * 120}deg)"></i>`;
      s += '<b></b></div>';
    }
    // desks with monitors and people
    for (const d of opts.desks || []) {
      s += `<div class="o-desk" style="left:${d.x}px;top:${d.y}px;width:${d.w}px"></div>`;
      for (const m of d.mon || []) s += `<div class="o-mon" style="left:${d.x + m}px;top:${d.y - 120}px"></div>`;
    }
    for (const p of opts.people || []) {
      s += `<div class="o-person" style="left:${p.x}px;top:${p.y}px;transform:scale(${p.k || 1});--shirt:${p.c};--hair:${p.hair || '#2b1d14'}"><i class="ph"></i><i class="pb"></i></div>`;
    }
    s += '</div>';
    return s;
  }

  F.officeHTML = officeLayer;

  F.scene({
    id: 'office',
    start: 5.96,
    end: 7.5,
    build(root) {
      root.style.background = '#e9e1d3';
      // shot A — wide room with depth: back wall, a long table in perspective, people at several depths
      const shotA = h('<div class="fill"></div>');
      const person = (x, y, k, shirt, hair, blur, stand) =>
        `<div class="o-person ${stand ? 'stand' : ''}" style="left:${x}px;top:${y}px;transform:scale(${k});--shirt:${shirt};--hair:${hair};filter:blur(${blur}px)"><i class="ph"></i><i class="pb"></i></div>`;
      shotA.innerHTML = `<div class="abs office-cam">
          <div class="office wide">${[0, 1, 2, 3].map((i) => `<div class="o-win" style="left:${260 + i * 330}px;top:90px;width:250px;height:430px"></div>`).join('')}
            ${[0, 1, 2].map((i) => `<div class="o-lamp" style="left:${420 + i * 420}px;top:${120 + (i % 2) * 24}px"></div>`).join('')}
            <div class="o-dado"></div>
            <div class="o-plant" style="left:1620px;top:330px;transform:scale(1.25)">${'<i></i>'.repeat(8)}<b></b></div>
            <div class="o-plant" style="left:120px;top:400px;transform:scale(1.1)">${'<i></i>'.repeat(8)}<b></b></div>
          </div>
          ${person(860, 400, 0.72, '#24314a', '#2b1d14', 4, false)}
          ${person(1110, 385, 0.7, '#f1efea', '#1b1b1b', 4, true)}
          <div class="o-table"></div>
          <div class="o-mon" style="left:760px;top:520px;transform:scale(.8)"></div><div class="o-mon" style="left:1000px;top:515px;transform:scale(.75)"></div><div class="o-mon lit" style="left:560px;top:540px;transform:scale(.9)"></div>
          ${person(330, 430, 1.1, '#4a2b20', '#3a2416', 2, false)}
          ${person(1400, 420, 1.2, '#161616', '#e9dfc4', 2.5, false)}
          ${person(-80, 560, 2.3, '#2c2420', '#22160f', 14, false)}
        </div><div class="fg-blur"></div>`;
      root.appendChild(shotA);
      // shot B — the laptop
      const shotB = h('<div class="fill"></div>');
      shotB.innerHTML = `
        <div class="abs office-cam2">${officeLayer({ seed: 5, winX: 820, winY: 60, plants: [[1580, 380, 1.3]], desks: [{ x: 0, y: 760, w: 1920, mon: [1260, 1520] }], people: [{ x: 520, y: 330, c: '#2f3a4f', k: 1.5 }, { x: 760, y: 360, c: '#efefef', hair: '#1b1b1b', k: 1.4 }] })}</div>
        <div class="laptop">
          <div class="lp-screen">
            <div class="lp-chat">
              <div class="lp-brand">${A.base44Mark('var(--orange)')}<b>Base44</b></div>
              <div class="lp-msg">Build a booking site for Open Fields — fields, merch and a match schedule.</div>
              <div class="lp-steps"><span class="s1">${C.iconSpan(I.check, 20)}Planning pages</span><span class="s2">${C.iconSpan(I.check, 20)}Designing the hero</span><span class="s3">${C.iconSpan(I.loader, 20)}Wiring bookings</span></div>
            </div>
            <div class="lp-prev" style="background-image:url(${A.pitch('lp', 900, 560, { c1: '#2c5e2a', c2: '#336a30', stripeW: 70, stripeAngle: 0.3, players: [[0.3, 0.6], [0.5, 0.45, '#1b1b1b'], [0.7, 0.7], [0.42, 0.8, '#1b1b1b']], ps: 13, lines: [{ type: 'line', x1: 0.5, y1: 0, x2: 0.5, y2: 1 }] })})">
              <div class="lp-of">Open Fields</div>
              <div class="lp-bar"></div>
            </div>
          </div>
          <div class="lp-base"></div>
        </div>
        <div class="fg-blur2"></div>`;
      root.appendChild(shotB);
      const grain = h(`<div class="grain" style="background-image:url(${A.grain(3)})"></div>`);
      root.appendChild(grain);
      const camA = F.$(shotA, '.office-cam');
      const camB = F.$(shotB, '.office-cam2');
      const laptop = F.$(shotB, '.laptop');
      const steps = F.$$(shotB, '.lp-steps span');
      const bar = F.$(shotB, '.lp-bar');
      return (lt) => {
        const A_ = lt < 0.52;
        shotA.style.display = A_ ? '' : 'none';
        shotB.style.display = A_ ? 'none' : '';
        if (A_) set(camA, { x: -60 + lt * 60, y: -40 + lt * 8, s: 1.04 + lt * 0.03 });
        else {
          const b = lt - 0.52;
          set(camB, { x: -180 - b * 40, y: -80, s: 1.12 });
          set(laptop, { x: 300 - b * 22, y: 120 + b * 6, s: 1 + b * 0.03 });
          steps.forEach((s, i) => (s.style.opacity = String(prog(b, i * 0.2, i * 0.2 + 0.15))));
          set(bar, { sx: tw(b, 0, 0.9, 0.15, 0.85, E.outCubic) });
        }
        grain.style.transform = `translate(${(Math.floor(lt * 24) * 37) % 200 - 100}px, ${(Math.floor(lt * 24) * 53) % 200 - 100}px)`;
      };
    },
  });

  /* ===========================================================
     S05 — "Build ___" slot machine → "Build it all"
     =========================================================== */
  F.scene({
    id: 'build-slot',
    start: 7.5,
    end: 9.56,
    build(root) {
      root.classList.add('bg-paper');
      const FS = 195, ROW = 174;
      const list = ['Games', 'Notion', 'AI Tools', 'eCom', 'Design', 'Campaigns', 'Products', 'Apps', 'Websites', 'it all', 'Design', 'Notion', 'Automations', 'Apps'];
      const font = `500 ${FS}px "Inter Tight"`;
      const buildW = F.measure('Build ', font, -0.01, FS);
      const rows = list.map((w) => {
        const el = h(`<div class="word slot" style="font-size:${FS}px">${w}</div>`);
        root.appendChild(el);
        return { el, w: F.measure(w, font, -0.01, FS) };
      });
      const build = h(`<div class="word slot" style="font-size:${FS}px;color:var(--ink)">Build</div>`);
      root.appendChild(build);
      const ticks = [0, 1, 2, 3].map(() => {
        const el = h('<div class="tick" style="width:12px;height:12px"></div>');
        root.appendChild(el);
        return el;
      });
      const TARGET = 9;
      return (lt, t) => {
        // continuous scroll that lands on "it all"
        const idx = kf(t, [[7.5, 4], [8.0, 7.4, E.outQuad], [8.42, 9, E.outBack]]);
        const zoomOut = prog(t, 9.36, 9.56);
        const sc = 1 - E.inCubic(zoomOut) * 0.62;
        let activeW = 0;
        rows.forEach((r, i) => {
          const d = i - idx;
          const near = clamp(1 - Math.abs(d));
          activeW += r.w * near;
        });
        rows.forEach((r, i) => {
          const d = i - idx;
          const near = clamp(1 - Math.abs(d));
          const y = 540 + d * ROW;
          const x = 960 - r.w / 2 + (buildW / 2) * near;
          const col = Math.round(lerp(207, 31, E.inQuad(near)));
          r.el.style.color = `rgb(${col},${col - 2},${col - 6})`;
          const sy = (y - 540) * sc + 540 - (540 - 440) * sc;
          const sx = (x - 960) * sc + 960;
          set(r.el, { x: sx, y: sy, s: sc, o: (Math.abs(d) < 4.2 ? 1 : 0) * (1 - zoomOut) });
        });
        const bx = 960 - (activeW + buildW) / 2;
        set(build, { x: (bx - 960) * sc + 960, y: 540 - (540 - 440) * sc, s: sc, o: 1 - zoomOut });
        // selection ticks around "Build it all"
        const pt = prog(t, 8.38, 8.5);
        const w = buildW + rows[TARGET].w;
        const blue = t > 8.86;
        const pts = [[960 - w / 2 - 52, 452], [960 + w / 2 + 40, 452], [960 - w / 2 - 52, 622], [960 + w / 2 + 40, 622]];
        ticks.forEach((tk, i) => {
          tk.style.background = blue ? '#4b63e6' : 'var(--orange)';
          set(tk, { x: (pts[i][0] - 960) * sc + 960, y: (pts[i][1] - 540) * sc + 540, o: pt * (1 - zoomOut) });
        });
      };
    },
  });

  /* ===========================================================
     S06 — feature tasks streaming + phone screens
     =========================================================== */
  function phoneBook() {
    return `<div class="phone ph-book">
      <div class="pb-top">${C.iconSpan(I.menu, 26, '#fff')}<b>Book a field</b><span>${C.iconSpan(I.user, 22, '#fff')}<i></i></span></div>
      <div class="pb-sub"><span>Brooklyn, NY</span><span>4 Locations</span></div>
      <div class="pb-card"><div class="pb-img" style="background-image:url(${A.cityField('a', 420, 300)})"><em class="pb-tag">Outdoor</em></div>
        <div class="pb-meta"><b>North Field, Williamsburg</b><small>Nearby 1.2km</small></div>
        <div class="pb-meta2"><small>50M × 30M  |  16 Players Max</small><small>★ 4.6</small></div>
        <div class="pb-btn">Book Now <span>→</span></div></div>
      <div class="pb-card"><div class="pb-img" style="background-image:url(${A.indoor('a', 420, 260)})"><em class="pb-tag">Indoor</em></div></div>
    </div>`;
  }
  function phoneMerch() {
    const prod = (art, name, price, bg) => `<div class="pm-item"><div class="pm-art" style="background:${bg}">${art}</div><b>${name}</b><small>${price}</small></div>`;
    return `<div class="phone ph-merch">
      <div class="pm-top">${C.iconSpan(I.menu, 26, '#1d1d1d')}<b>Merch</b><span>${C.iconSpan(I.user, 22, '#1d1d1d')}<i></i></span></div>
      <div class="pm-sub"><span>⇅ Filter and sort</span><span>28 Products</span></div>
      <div class="pm-grid">
        ${prod(A.tshirt(), 'The North Pitch t-shirt', '80 USD', '#eef0f2')}
        ${prod(A.jersey(), 'Downtown Jersey', '90 USD', '#eef0f2')}
        ${prod(A.cap(), '2026 Season Cap', '30 USD', '#eef0f2')}
        ${prod(A.bottle(), 'Hydration Bottle', '24 USD', '#eef0f2')}
      </div>
    </div>`;
  }

  F.scene({
    id: 'tasks-phones',
    start: 9.46,
    end: 10.96,
    build(root) {
      root.classList.add('bg-paper');
      const tasks = ['Order/purchase history', 'Indoor/outdoor', 'Booking flow', 'Sizes and variants', 'Availability/calendar', 'Location/distance search', 'Cart/checkout flow', 'Player/capacity limits', 'Notifications/reminders', 'Search', 'Profile', 'Wishlist', 'Reviews', 'Login', 'User roles', 'Orders'];
      const col = h('<div class="abs tasks"></div>');
      let s = '';
      for (let k = 0; k < 3; k++) for (const tsk of tasks) s += `<div class="task"><i class="arc"></i><span>${tsk}</span><em>Writing</em></div>`;
      col.innerHTML = s;
      root.appendChild(col);
      const book = h(`<div class="abs" style="width:388px;height:700px">${phoneBook()}</div>`);
      const merch = h(`<div class="abs" style="width:400px;height:700px">${phoneMerch()}</div>`);
      root.appendChild(book);
      root.appendChild(merch);
      const arts = F.$$(merch, '.pm-art > *');
      const arcs = F.$$(col, '.arc');
      const ticks = [0, 1, 2, 3].map(() => {
        const el = h('<div class="tick"></div>');
        root.appendChild(el);
        return el;
      });
      return (lt) => {
        const zin = prog(lt, 0, 0.14);
        const cs = lerp(1.5, 1, E.outCubic(zin));
        set(col, { x: (606 - 960) * cs + 960, y: (60 - lt * 120 - 540) * cs + 540 - 900, s: cs, o: zin });
        col.style.transformOrigin = '0 0';
        const pb = prog(lt, 0.02, 0.3);
        const slide = prog(lt, 0.42, 0.7);
        set(book, { x: lerp(771, 555, E.inOutCubic(slide)), y: 189 + (1 - E.outCubic(pb)) * 80, s: lerp(0.92, 1, E.outCubic(pb)), o: clamp(pb * 3) });
        const pm = prog(lt, 0.48, 0.74);
        set(merch, { x: 975 + (1 - E.outCubic(pm)) * 60, y: 189, s: lerp(0.94, 1, E.outCubic(pm)), o: clamp(pm * 3) });
        arts.forEach((a, i) => {
          const pa = prog(lt, [0.5, 0.62, 0.67, 0.72][i], [0.5, 0.62, 0.67, 0.72][i] + 0.1);
          set(a, { o: pa, s: lerp(0.9, 1, E.outCubic(pa)) });
        });
        arcs.forEach((a, i) => (a.style.transform = `rotate(${(lt * 540 + i * 37) % 360}deg)`));
        const L = lerp(745, 489, E.inOutCubic(slide)), R = lerp(1190, 1434, E.inOutCubic(slide));
        [[L, 150], [R, 150], [L, 924], [R, 924]].forEach((p, i) => set(ticks[i], { x: p[0], y: p[1], o: prog(lt, 0.2, 0.3) }));
      };
    },
  });

  /* ===========================================================
     S07 — the Open Fields website hero
     =========================================================== */
  F.scene({
    id: 'site-hero',
    start: 10.96,
    end: 11.96,
    build(root) {
      root.classList.add('bg-paper');
      const site = h(`<div class="abs site">
        <div class="photo" style="background-image:url(${A.pitch('hero', 1280, 720, { c1: '#2c6a2b', c2: '#347833', stripeW: 140, stripeAngle: 0.06, players: [[0.3, 0.55], [0.38, 0.42], [0.43, 0.7, '#1d1d1d'], [0.47, 0.5], [0.55, 0.62, '#1d1d1d'], [0.62, 0.45], [0.66, 0.68], [0.75, 0.56, '#1d1d1d'], [0.25, 0.72, '#1d1d1d'], [0.84, 0.66]], ps: 22, vignette: 0.5, lines: [{ type: 'line', x1: 0.35, y1: 0, x2: 0.35, y2: 0.62 }, { type: 'line', x1: 0.35, y1: 0.62, x2: 1, y2: 0.6 }] })})"></div>
        <div class="site-hw"><span>your game</span><span>starts here</span></div>
        <div class="site-of">Open Fields<sup>™</sup></div>
        <div class="site-nav"><span class="sn-book">${C.iconSpan(I.target, 16)}Book a field</span><span>Locations</span><span>Community</span><span>Shop</span><span class="sn-menu">${C.iconSpan(I.menu, 22)}</span></div>
        <div class="site-badge"><svg viewBox="0 0 100 100"><path d="${(() => { let d = ''; for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; const rr = 46 + (i % 2 ? 0 : 3.5); d += (i ? 'L' : 'M') + (50 + Math.cos(a) * rr).toFixed(1) + ' ' + (50 + Math.sin(a) * rr).toFixed(1); } return d + 'z'; })()}" fill="#3e47df"/></svg><span>Discover<br>your Next<br>Pitch</span></div>
        <div class="site-ig">${C.iconSpan(I.camera, 22, '#fff')}</div>
      </div>`);
      root.appendChild(site);
      const ticks = [0, 1, 2, 3].map(() => {
        const el = h('<div class="tick"></div>');
        root.appendChild(el);
        return el;
      });
      return (lt) => {
        const s = tw(lt, 0, 1, 0.985, 1.045, E.outQuad) * lerp(0.9, 1, E.outCubic(prog(lt, 0, 0.2)));
        set(site, { x: 960 - 640 * s, y: 543 - 360 * s, s, o: prog(lt, 0, 0.08) });
        site.style.transformOrigin = '0 0';
        const pad = 66;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b], i) =>
          set(ticks[i], { x: 960 + a * (640 * s + pad) - 4, y: 543 + b * (360 * s + pad) - 4, o: prog(lt, 0.05, 0.15) }));
      };
    },
  });

  /* ===========================================================
     S08 — slit-scan kick (time-sliced strips)
     =========================================================== */
  F.scene({
    id: 'slitscan',
    start: 11.96,
    end: 12.96,
    build(root) {
      const cv = h('<canvas class="fill" width="1920" height="1080"></canvas>');
      root.appendChild(cv);
      const ctx = cv.getContext('2d');
      const bg = F.loadImg(A.park('slit', 1920, 1080, { horizon: 0.62, treeH: 0.2, sky0: '#86b5e3', sky1: '#e3edf2', goal: true, goalX: 0.18, people: 9, dense: true, f0: '#6f9f45', f1: '#3a6f28' }));
      const grain = h(`<div class="grain" style="background-image:url(${A.grain(5)})"></div>`);
      root.appendChild(grain);
      const ballImg = F.loadImg(A.svgUrl(A.ball({ id: 'k', shade: true })));
      const N = 16, D = 0.077;
      let soft = null;
      function drawWorld(tt, x0, w) {
        if (!soft) {
          // shallow depth of field: pre-blur the field once
          soft = document.createElement('canvas');
          soft.width = 2040; soft.height = 1140;
          const sc = soft.getContext('2d');
          sc.filter = 'blur(5px)';
          sc.drawImage(bg, 0, 0, 2040, 1140);
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, 0, w, 1080);
        ctx.clip();
        const camX = tt * 70;
        ctx.drawImage(soft, -40 - camX, -30);
        // ball on a rising arc
        const x = -200 + 1560 * tt;
        const y = 960 - 520 * (tt / 1.6) - 140 * Math.sin((tt / 1.6) * Math.PI);
        ctx.save();
        ctx.translate(x - camX, y);
        ctx.rotate(tt * 8);
        ctx.drawImage(ballImg, -86, -86, 172, 172);
        ctx.restore();
        ctx.restore();
      }
      return (lt) => {
        const sw = 1920 / N;
        for (let i = 0; i < N; i++) {
          // each strip runs D seconds ahead of its left neighbour, so the
          // ball repeats once per strip along its arc
          drawWorld(0.141 + lt * 0.05 + i * D, i * sw, sw + 1);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(Math.round(i * sw), 0, 2, 1080);
        }
        grain.style.transform = `translate(${(Math.floor(lt * 24) * 41) % 200 - 100}px, ${(Math.floor(lt * 24) * 67) % 200 - 100}px)`;
      };
    },
  });
})();
