# Dissolve — pixel character ⇄ colourful crowd

A real-time **Three.js** experience. A pixel-art character is scanned from head to feet, dissolves into a
flowing field of tens of thousands of particles, and condenses into a soft-focus crowd of colourful human
silhouettes — then the crowd can collapse back into the character. Everything is GPU particles driven by a
single `progress` value; nothing is a video, GIF or faded image.

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Three.js** (native, no R3F) · custom **GLSL**
- **Tailwind CSS 4** for the interface, **Framer Motion** for HTML overlay animation only
- 17 k – 57 k particles in **one draw call**, adaptive to the device
- Static output: deploys to Vercel with no environment variables and no server runtime

## Run it

```bash
cd particle-dissolution
npm install
npm run dev          # http://localhost:3000
```

Production build: `npm run build && npm start`. Requires Node ≥ 20.9.

Useful scripts: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run check` (all three).

## Controls

| Input | Action |
| --- | --- |
| **Click / tap**, **Space** | Dissolve to the crowd; again to reform the character. Interruptible: pressing mid-flight turns around from the current progress, it never restarts. |
| **Drag the line** (HUD) | Scrub the single `progress` parameter directly. |
| **Auto** | The 19-second cinematic loop (default on load). Any click/Space takes over; Auto resumes it from where it is. |
| **Scroll** | While on, the mouse wheel (or a vertical swipe) scrubs progress. |
| **Calm** | Reduced motion: no autoplay, gentler flow, shorter transitions. Follows `prefers-reduced-motion` automatically. |
| Pointer | Moving over the particles leaves a soft wake; the camera parallaxes subtly (mostly in the crowd). |

### The cinematic timeline (`src/engine/config.ts`)

| Time | Progress | Stage |
| --- | --- | --- |
| 0–2 s | 0 | **A** stable character: breathing, shoulder movement, faint shimmer |
| 2–3 s | 0 → 0.11 | **B** scan band sweeps head → feet; scanned cells loosen into a mosaic |
| 3–4 s | → 0.22 | **C** surface breakup in small pixel-cluster groups |
| 4–6 s | → 0.44 | **D** holographic disintegration: curl-noise stream, sparse blue-white sparks |
| 6–8 s | → 0.67 | **E** particle field; colours shift from charcoal/white to the crowd palette |
| 8–11 s | → 1 | crowd reconstruction: columns → heads → torsos → limbs, depth separation |
| 11–14 s | 1 | crowd animation (walking, bobbing, drifting, occasional gestures) |
| 14–19 s | 1 → 0 | reverse: crowd peels apart, funnels inward, head locks in first, shoes last |

`progress = 0` is the reconstructed character, `0.5` the transitional stream, `1` the crowd. The last frame of
the loop equals the first (same camera pose), so it repeats seamlessly.

## Using your own character art

The pixel-art reference was not available when this was built, so the experience ships with a hand-authored
fallback sprite written from the brief (black messy hair, small tan face, charcoal tee with a tiny white chest
detail, dark-grey trousers, black shoes, side-facing). **To use the real art, drop it here and rebuild:**

```
public/assets/character.png      (also accepted: .webp, .jpg, .jpeg)
```

Create the `public/assets/` folder if it does not exist. The file is picked up at build time (`src/app/page.tsx`),
so a missing file never causes a 404. The loader (`src/engine/sprite/`) handles the usual cases automatically:

- **Transparent PNG** → the alpha channel is the silhouette.
- **Opaque image with a muted-grey background** → the backdrop is removed by a tolerant flood fill from the
  border (it follows soft gradients and noise, and never eats into interior pixels of a similar colour).
- **Up-scaled pixel art** (each art pixel is an N×N block) → the block size and grid offset are detected from
  where colour edges fall, and one colour per cell is sampled. Smooth / non-blocky images are area-averaged
  down to ≤ 72 rows so they still read as chunky pixels.

Each visible cell becomes a cluster of k × k particles (`k` chosen from the quality tier), so the particle count
adapts to the art. The HUD shows `custom art` when the image was used. Anything that fails to load falls back to
the built-in sprite, and the console says why.

The crowd is procedural: the supplied crowd image is used only as a reference for palette, composition and
softness (`PALETTE` and `GLOW` in `config.ts`; rows in `crowd.ts`).

## Deploy to Vercel

The app lives in a sub-folder of the repository (the repo root hosts an unrelated static site), so tell Vercel
where it is.

**Dashboard**

1. *Add New… → Project*, import this repository.
2. **Root Directory:** `particle-dissolution`. Framework preset: **Next.js** (auto-detected).
3. Build/Install/Output settings: leave the defaults. No environment variables are needed.
4. *Deploy.*

**CLI**

```bash
cd particle-dissolution
npx vercel          # preview
npx vercel --prod   # production
```

The route is fully static (`○ prerendered as static content`), so it is served from the CDN. There is no
server runtime, database, or secret.

## How it works

```
src/
  app/                      Next.js App Router: layout, page (finds the optional art), styles
  components/
    ExperienceLoader.tsx    client-only dynamic import (keeps three.js out of the server bundle)
    ExperienceView.tsx      mounts the engine, error / unsupported states
    Hud.tsx                 Tailwind + Framer Motion overlay (state, scrubber, toggles)
  engine/                   framework-agnostic; React only mounts it
    Experience.ts           renderer, camera rig, HDR composer, input, resize, quality governor
    controller.ts           the single `progress` state machine: auto loop, manual, scrub, reversal
    camera.ts               camera pose, scan band and look as pure functions of progress
    particleData.ts         builds every GPU attribute as typed arrays; pairs character ↔ crowd slots
    crowd.ts                procedural crowd: perspective rows, figures, parts, palette, depth haze
    ParticleSystem.ts       one BufferGeometry, one ShaderMaterial, backdrop quad, scan quad
    shaders/                particle (vertex + fragment), noise/curl, background, scan band, grade
    sprite/                 supplied-image → pixel grid pipeline, plus the procedural sprite
    config.ts quality.ts rng.ts color.ts
```

**One parameter, per-particle schedules.** The vertex shader receives a global `progress` and a per-particle
schedule `(relFwd, durFwd, relRev, durRev)`; each particle's local progress is
`tau = clamp((progress - rel) / dur)`. Stages therefore overlap organically: scan order and 3 × 3-cell clusters
decide when each pixel leaves; the head locks in first on the way back. Heading (`uDir`) is eased so reversing
mid-flight cannot pop, and selects the scan on the way out versus the funnel/spiral on the way back.

**Continuity.** A particle's position is `mix(character, crowd, ease(tau))` plus a displacement field that is
zero at both ends: outward push, upward drift, sideways wind, curl noise and a mild move toward the camera. Both
endpoints are exact, and nothing ever disappears and reappears.

**Pixel-perfect rest state.** At rest a sprite cell's k² particles are stacked on its centre and one "leader"
draws the whole pixel at exactly cell size (crisp edges, no seams, ~k² less overdraw). The scan unfolds them to
their sub-lattice; on the return they converge onto the centre and snap to the full pixel.

**Crowd.** Rows are specified in screen space and unprojected through the final camera, so framing holds for any
aspect ratio (it re-lays-out after a rotate). Figures come in three archetypes (full, coat, smear), get particle
counts proportional to screen area, and are drawn far → near so alpha blending paints like a painter.
Crowd motion (drift, bobbing, step cycle, arm gestures, colour drift) is derived on the GPU from each figure's
seed, so no two figures share phase or tempo.

**Soft focus is rendered, not blurred.** Per-particle circle of confusion from the view-space depth, Gaussian
particle profiles, additive halo particles, depth haze and a luminous backdrop. A restrained HDR bloom (high and
ultra tiers) only catches emissive scan/spark light; a final pass adds vignette, grain and highlight roll-off.

**Determinism.** All procedural data is seeded (`SEED` in `config.ts`) and shader randomness uses an integer PCG
hash, so the same time and progress give the same pixels on any GPU.

## Quality, performance, accessibility

- Tiers: `low` ≈ 17 k, `medium` ≈ 30 k, `high` ≈ 47 k, `ultra` ≈ 57 k particles. Detected from the device;
  override with `?q=low|medium|high|ultra`, or pin a budget with `?n=40000`.
- DPR is capped per tier and lowered automatically if frames run long. The particle count is never reduced at
  runtime (the pixels must tile).
- Draw calls: particles ×1, backdrop ×1, scan band ×1, plus the composer passes on medium and above.
- Reduced motion, `aria-live` state announcements, keyboard-operable controls, a labelled scrubber, and a clear
  message when WebGL 2 is unavailable or the shaders cannot compile.

## Debugging and testing

Open with `?debug` to get `window.__dissolve`:

```js
__dissolve.freeze(0.5, 0, 6.5)   // progress, heading (0 → crowd, 1 → character), scene time
__dissolve.status()
__dissolve.release()
```

`npm test` covers the image pipeline (alpha / grey-backdrop / up-scaled / smooth inputs), crowd generation,
particle pairing and scheduling, the timeline and controller (including reversal continuity) and the camera path.
The rendering was checked in headless Chromium on a software WebGL 2 renderer (SwiftShader): frames at every
stage in both directions, portrait / landscape / ultra-wide layouts, the supplied-image path, and 25 scripted
interaction checks (autoplay, click, space, mid-flight reversal, scrubber, scroll, pointer wake, reduced motion,
single-canvas guarantee) against both `next dev` and the production build. Software rendering gives no GPU
frame-rate numbers, so profile on target hardware.

## Tuning

| Want to change | Where |
| --- | --- |
| Timeline, palette, world scale, quality tiers | `src/engine/config.ts` |
| Crowd rows, spacing, archetypes, part shapes | `src/engine/crowd.ts` |
| Stream direction/strength, softness, spark rate, rig motion | `src/engine/shaders/particle.ts` |
| Camera path, focus plane | `src/engine/camera.ts` |
| Backdrop colours | `GLOW` in `config.ts`, `shaders/background.ts` |
