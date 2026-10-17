/* Player: scales the 1920×1080 stage into the frame, drives playback,
   and wires up the chapter timeline. ?mode=film renders the bare stage
   (used by render.mjs); ?mode=capture keeps the chrome but disables autoplay. */
(function () {
  const F = window.F;
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'play';
  if (mode === 'film') document.body.classList.add('mode-film');
  if (mode === 'capture' || mode === 'framed') document.body.classList.add('mode-capture');
  if (mode === 'framed') document.body.classList.add('mode-framed');

  const player = document.getElementById('player');
  const frame = document.getElementById('frame');
  const stage = document.getElementById('stage');
  const timeline = document.getElementById('timeline');
  const chapters = document.getElementById('chapters');
  const playhead = document.getElementById('playhead');
  const soundBtn = document.getElementById('sound');

  const D = F.DURATION;

  /* chapter segments, laid out on the same linear scale as the playhead */
  F.CHAPTERS.forEach((c, i) => {
    const seg = document.createElement('div');
    seg.className = 'chapter';
    seg.textContent = c.name;
    seg.style.left = (c.start / D) * 100 + '%';
    const last = i === F.CHAPTERS.length - 1;
    seg.style.width = `calc(${((c.end - c.start) / D) * 100}% - ${last ? 0 : 4}px)`;
    chapters.appendChild(seg);
  });

  function fit() {
    const s = frame.clientWidth / F.W;
    stage.style.transform = `scale(${s})`;
  }
  new ResizeObserver(fit).observe(frame);
  fit();

  let t = 0;
  let playing = false;
  let last = 0;

  function draw() {
    F.render(t);
    const w = timeline.clientWidth;
    playhead.style.transform = `translateX(${(t / D) * w}px)`;
    timeline.setAttribute('aria-valuenow', t.toFixed(1));
  }

  /* optional soundtrack, kept in sync with the film clock */
  const audio = document.createElement('audio');
  let audioReady = false;
  let soundOn = false;
  audio.preload = 'auto';
  audio.hidden = true;
  document.body.appendChild(audio);
  // AAC where available (Safari/Chrome/Edge), Opus-in-Ogg as the fallback (Firefox/Chromium builds without AAC)
  for (const [src, type] of [['audio/soundtrack.m4a', 'audio/mp4; codecs="mp4a.40.2"'], ['audio/soundtrack.ogg', 'audio/ogg; codecs="opus"']]) {
    if (audio.canPlayType(type)) { audio.src = src; break; }
  }
  if (!audio.src) audio.src = 'audio/soundtrack.m4a';
  audio.addEventListener('canplaythrough', () => {
    audioReady = true;
    if (mode === 'play') soundBtn.hidden = false;
  }, { once: true });
  audio.addEventListener('error', () => { audioReady = false; });

  function syncAudio(force) {
    if (!audioReady || !soundOn) return;
    if (playing) {
      if (force || Math.abs(audio.currentTime - t) > 0.12) audio.currentTime = t;
      if (audio.paused) audio.play().catch(() => {});
    } else if (!audio.paused) audio.pause();
  }

  function tick(now) {
    if (!playing) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    if (t >= D) {
      t = 0;
      syncAudio(true);
    }
    draw();
    syncAudio(false);
    requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    playing = true;
    player.classList.remove('is-paused');
    last = performance.now();
    syncAudio(true);
    requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    player.classList.add('is-paused');
    syncAudio(false);
  }
  function seek(v) {
    t = F.clamp(v, 0, D - 1e-3);
    draw();
    syncAudio(true);
  }

  /* timeline scrubbing */
  let scrubbing = false;
  let wasPlaying = false;
  const toTime = (e) => {
    const r = timeline.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * D;
  };
  timeline.addEventListener('pointerdown', (e) => {
    scrubbing = true;
    wasPlaying = playing;
    pause();
    timeline.setPointerCapture(e.pointerId);
    seek(toTime(e));
  });
  timeline.addEventListener('pointermove', (e) => { if (scrubbing) seek(toTime(e)); });
  const endScrub = () => {
    if (!scrubbing) return;
    scrubbing = false;
    if (wasPlaying) play();
  };
  timeline.addEventListener('pointerup', endScrub);
  timeline.addEventListener('pointercancel', endScrub);
  timeline.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { seek(t + 2); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { seek(t - 2); e.preventDefault(); }
  });

  document.getElementById('frameHit').addEventListener('click', () => (playing ? pause() : play()));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === 'k') {
      e.preventDefault();
      playing ? pause() : play();
    }
  });

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) {
      if (!playing) play();
      syncAudio(true);
    } else audio.pause();
  });

  /* make sure every face is loaded before the first frame */
  const faces = [
    '500 40px "Inter Tight"', '600 40px "Inter Tight"', '700 40px "Inter Tight"',
    '400 40px "Inter"', '500 40px "Inter"', '600 40px "Inter"',
    '400 40px "Young Serif"', '500 40px "JetBrains Mono"', '400 40px "Covered By Your Grace"',
    '400 40px "Anton"', '600 40px "Barlow Condensed"', '700 40px "Barlow Condensed"',
  ];
  const ready = Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {});

  ready.then(async () => {
    F.build(stage);
    await Promise.all(F.pending);
    window.seek = (v) => { seek(v); return true; };
    window.filmReady = true;
    const start = parseFloat(params.get('t') || '0');
    seek(start);
    if (mode === 'play') play();
    else pause();
  });
})();
