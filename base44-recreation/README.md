# Base44 spot — code-only recreation

A frame-accurate, code-only recreation of the 52-second "Your clients dream big. Your agency builds bigger."
screen recording, built from scratch as a seekable HTML animation (no footage, no stock media).

- `index.html` — interactive player: click to play/pause, drag the chapter timeline (Intro · Problem · Features · Demo · Outro), `Space` toggles playback.
  Serve the folder (`python3 -m http.server 8765`) and open `http://127.0.0.1:8765/`.
  `?mode=film` shows the bare 1920×1080 stage, `?mode=framed` the 1440×1080 layout of the original recording.
- `js/engine.js` — tiny deterministic timeline engine: every scene is a pure function of time, so playback, scrubbing and rendering are identical.
- `js/scenes-*.js` — the 29 scenes, grouped by chapter. `js/assets.js`, `js/photos.js`, `js/components.js` — vector art, procedural "photography" and UI fragments.
- `fonts/` — Inter / Inter Tight / Young Serif / JetBrains Mono / Anton / Barlow Condensed / Covered By Your Grace (all SIL OFL, bundled so it works offline).
- `audio/` — `vo_build.py` (voiceover from local TTS, placed on the original word timings), `compose.py` (synthesised 117 BPM music bed + mix), `soundtrack.m4a` (the result).
- `tools/render.mjs` — steps the timeline in headless Chromium and muxes frames + audio into an MP4 with ffmpeg:
  `node tools/render.mjs film out.mp4` or `node tools/render.mjs framed out.mp4`.

Live-action shots in the original (office, field, studio) are stood in by coded illustrations; the brand names and
logos are used as in the source video for a personal recreation exercise.
