# Design system

The ParmarPro identity uses electric cobalt on white and warm paper, halftone dot screens, bold uppercase display type, numbered step cards, pill controls and hairline blue frames. The app is **light only**.

Tokens live in `src/app/globals.css`. Brand components live in `src/components/brand/`. Shared primitives live in `src/components/ui/`.

## Colour

| Token | Value | Use |
|---|---|---|
| `brand-500` | `#1f5bff` | Primary actions, display headlines, the logo. **The only accent colour** |
| `brand-600` | `#0d47e6` | Button hover, eyebrow labels |
| `brand-50` … `brand-200` | `#eef3ff` … `#bacdff` | Tints: secondary buttons, badges, active nav, table headers |
| `brand-700` … `brand-950` | `#0b38b4` … `#050e2b` | Text on tints; navy depth in illustrations |
| `ink-*` | `#f6f7f9` … `#0a0c10` | Neutral text and surfaces. Body `ink-900`, muted `ink-500` |
| `paper` | `#f4f3ef` | Warm off-white section surface |
| `hairline` | `#d3ddf5` | Card and divider borders |
| `success` / `warning` / `destructive` | `#0e7a43` / `#9a4a08` / `#c4261a` | Status only (completed/converted, no-show/trial warnings, lost/cancelled/errors) |

### Contrast

Checked with a WCAG 2.x script; every pair passes.

| Pair | Ratio |
|---|---|
| Body text (`ink-900`) on white | 18.3:1 |
| Muted text (`ink-500`) on white / paper / dashboard background | 5.8 / 5.3 / 5.6 |
| `brand-500` on white / paper | 5.3 / 4.7 |
| White on `brand-500` (primary button) | 5.3 |
| `brand-700` on `brand-50` (secondary) | 8.4 |
| Status text on its 10% tint: success / warning / destructive | 4.7 / 5.4 / 4.9 |
| Input border (`#8a94ad`) and focus ring (`brand-400`) on white | 3.0 / 3.3 (non-text, minimum 3:1) |
| White display text on `brand-400` (bottom of step cards) | 3.3 (large text only) |

Re-run the check whenever a token changes.

## Type

Geist, self-hosted by `next/font`, so there is no external font request and no CSP change.

- **`headline` utility:** uppercase, weight 800, leading 0.95, tight tracking. Use it for marketing and auth headlines and step-card words. Uppercase is CSS only; the DOM text stays sentence case for screen readers and tests.
- **`eyebrow` utility:** 11px uppercase label in `brand-600`. Use it above titles, for table headers and for stat labels.
- **Dashboard titles:** sentence case, `text-2xl font-bold`. The app is calmer than the marketing site.

## Shape

- Buttons, badges and tags are pills (`rounded-full`).
- Cards are `rounded-2xl` with a hairline border and no heavy shadow.
- Feature panels are `rounded-3xl` with a `border-brand-500/30` frame.
- Inputs are `rounded-lg`, 40px high, with a blue focus ring.

## Brand components

| Component | Purpose |
|---|---|
| `Halftone` | Variable-size dot screen. Maps: `radial`, `sweep`, `edge`, `corner`, `band`. `inverse` gives white dots on blue |
| `Sparkle` | Four-point star with a dotted halo, the "clean smile" motif |
| `Portal` | Door illustration on the sign-in panel |
| `StepCard` | 01 / 02 / 03 cards. `highlight` is the inverted, solid-blue card |
| `EyebrowTag` | Small pill label: `solid`, `soft`, `inverse` |
| `BrowserFrame` | Browser chrome around product illustrations |
| `BrandPanel` | Blue panel beside sign-in and sign-up |
| `LogoMark` / `Logo` | App-icon tile with the tooth glyph. `inverse` is for blue backgrounds |

All illustrations are SVG or CSS. They render on the server, ship no JavaScript, and are `aria-hidden`.

Halftone works by thresholding a soft dot grid multiplied by a grayscale map with `filter: contrast()`, then screening it over brand blue. Keep text off dense dot areas; choose a map that leaves the text region white.

## Motion

The marketing site moves; the dashboard does not (only a button press scale and a one-time stat count-up). Everything below is for the marketing pages, auth and onboarding panels.

### The counter-flow rule

Three separate blocks in a line. **The outer two move together, the middle one moves the opposite way**, at the same speed, with inverted tones (blue base with light dots, paper base with blue dots). The rule lives in one file, `src/lib/motion/counter-flow.ts` (`FLOW_DIRECTIONS = [1, -1, 1]`), and every layer reads it, so the directions cannot drift apart. It is used on:

- the hero stage (dot field, sample cards, scroll parallax);
- the 01 / 02 / 03 step cards (dot drift, and the cards cross each other as the row scrolls on screens from 768 px up);
- smaller echoes: the `DotDrift` panels on the page headers, call to action and sign-in panel.

### Layers of the hero stage

| Layer | How | Cost |
|---|---|---|
| Dot field | One WebGL canvas, one draw call. A fragment shader written for this project draws all three rounded blocks, a flowing wave field, round halftone dots and a 4×4 ordered dither in three tones | GPU. Resolution adapts between 0.5 and 1.0 of a 1.5 device-pixel-ratio cap |
| CSS fallback | Same colours, same directions, dots drifting by exactly one tile so the loop is seamless | Compositor only |
| Sample cards | DOM columns on a 40 s linear loop, the middle one reversed. Solid white cards, no backdrop blur | Compositor only |
| Scroll parallax | GSAP ScrollTrigger on the card layers, opposite signs for outer and middle. Not pinned | Main thread, scrubbed |

### Guards

- **Reduced motion and save-data:** all loops stop, the shader draws one still frame, smooth scrolling and scrub effects are off, the intro curtain is hidden.
- **Pause motion:** a visible control on the stage (WCAG 2.2.2), remembered in `localStorage` under `parmarpro.motion.paused`. `html[data-motion="on|off"]` reflects the combined state, and every loop in `globals.css` is tied to it.
- **No GPU acceleration:** if the browser reports a software renderer (SwiftShader, llvmpipe, Basic Render Driver) or no WebGL, the canvas is never shown and the CSS fallback stays. A full-viewport shader on the CPU would block the page.
- **When the GPU work starts:** after hydration and first paint (browser idle), then cross-fades in over 0.7 s. It pauses when off screen or in a hidden tab and releases the context on teardown.
- **Lazy libraries:** GSAP and ScrollTrigger load after hydration, Lenis only on fine pointers. Nothing motion-related loads in the dashboard.
- **No text on dots.** Cards and copy never sit on the dot field; decorative layers are `aria-hidden`.
- **Honesty:** the stage carries exactly one "Illustration · sample data" label, and the cards show only features that exist today.

### Verification (measured, with misses)

Measured on 2026-10-28 against a production build, headless Chromium in a CPU-only sandbox.

| Check | Result |
|---|---|
| Direction of card columns over 1.5 s | -26.6 / +26.6 / -26.6 px (left / middle / right). Enforced by `tests/e2e/motion.spec.ts`, which fails if the middle column is not reversed (checked by forcing it) |
| Direction of the dot field (WebGL, real canvas) | +127 / -147 / +141 px over 3.70 s (positive is up), correlation 0.94 / 0.81 / 0.96. The sandbox's software renderer was let through for this check only, by a test-side script |
| Step cards cross in opposite directions on scroll | Enforced by the E2E spec |
| Reduced motion | 0 running animations on the stage; no looping animation anywhere on the page |
| Pause motion | 0 running animations, survives reload |
| No WebGL | CSS fallback panels shown, cards still move, no console errors |
| No horizontal scroll | 390, 768, 1024, 1440 px |
| JS added by the home route | 59.9 kB gzipped (GSAP 27.4, ScrollTrigger 17.6, Lenis 5.6, our renderer and motion code 9.3). Budget 60 kB. Only the 9.3 kB renderer is on the first load |
| WebGL contexts per page | 1 (budget 2) |
| CLS | 0 to 0.004 (budget 0.02) |
| Accessibility (Lighthouse) | 100 |

**Performance targets that were not met.** Lighthouse mobile preset (simulated slow 4G, 4× CPU), staging-like build, placeholder Clerk keys:

| Page | Score | LCP | TBT |
|---|---|---|---|
| Home, first version (shader on a software renderer) | 46-48 | 5.3-5.5 s | 2.3-2.7 s |
| Home, current | 56-59 | 4.9-5.0 s | 0.9-1.2 s |
| Home, GPU disabled (what the fallback path costs) | 80-82 | 3.5-4.1 s | 0.27-0.34 s |
| Pricing (no motion code), for comparison | 79-82 | 4.5-4.6 s | 0.15-0.24 s |

Targets were LCP ≤ 2.5 s and TBT ≤ 200 ms. **Neither is met in this setup**, and LCP is already about 4.5 s on a page with no motion, so most of that gap is the shared bundle (Next.js, Clerk, Sentry), not the animation. Reading these numbers:

- A direct run (Chromium, 4× CPU throttle, no network shaping) shows home TBT of 341 ms with the software-GL guard, the same as with WebGL switched off (343 ms). Before the guard it was 543 ms.
- The Lighthouse TBT stays higher because creating any WebGL context in this CPU-only container starts a software GPU process on the main thread. Devices with a real GPU do not pay that. This is **not verified on real hardware**: no GPU, Safari or Firefox was available here.
- Clerk's script cannot load from the placeholder instance, so every run includes failed requests and retries that a real deployment will not have. SEO scores 60 only because staging builds are `noindex` by design.
- Next steps to actually hit the targets: lazy-load Sentry and Clerk on marketing routes after idle, trim the shared bundle, and re-measure on a real Vercel preview with PageSpeed Insights or WebPageTest on a mid-range Android phone.

## Rules

1. **Blue is the only accent.** Green, amber and red are for status, never decoration.
2. **One highlight per group.** In a row of step cards, only one is solid blue.
3. **No stock photos or fake product shots.** Product illustrations show sample data and are labelled "Illustration · sample data".
4. **No invented metrics, logos or testimonials.** An E2E test enforces this on the home page.
5. **Visible focus everywhere.** Never remove the focus ring from interactive elements.
6. **No new external origins** for fonts, images or scripts. The CSP stays strict.
7. **One counter-flow rule.** Outer blocks move together, the middle one opposite. Change `FLOW_DIRECTIONS` in `src/lib/motion/counter-flow.ts`, never a single layer.
8. **Every loop has an off switch.** New ambient animations must stop under `html[data-motion="off"]` and `prefers-reduced-motion`, and must not run on the dashboard.
9. **Compositor-first.** Loop with `transform` or `opacity` only. Anything that needs the main thread or the GPU waits for idle, pauses off screen and has a CSS fallback.
