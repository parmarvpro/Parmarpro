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
| `success` / `warning` / `destructive` | `#0e7a43` / `#9a4a08` / `#c4261a` | Status only (completed/converted, no-show warnings, lost/cancelled/errors) |

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

One family: **Archivo**, a single self-hosted variable file (`src/fonts/archivo-var.woff2`, about 49 KB, weights 300 to 800, widths 100 to 125%, Latin plus the rupee sign), loaded with `next/font/local`. No external font request and no CSP change. The full rationale, rejected options, scale and rules are in [`typography.md`](typography.md); the short version:

- **Display voice (`headline` utility):** weight 800, width 112%, uppercase, leading 0.95, tracking -0.03em. Marketing and auth headlines, step-card words, the price. Uppercase is CSS only; the DOM text stays sentence case for screen readers and tests.
- **Text voice:** width 100%, weights 400 to 700. Body, UI, dashboard, tables, forms.
- **Accent (`accent` utility):** one word per headline in weight 300 of the same face. No serif, no italics.
- **`eyebrow` utility:** 12px, weight 700, uppercase, tracking 0.1em, in `brand-600`. Above titles, table headers, stat labels.
- **Dashboard titles:** sentence case, `text-2xl font-bold`. The app is calmer than the marketing site.
- **Numerals:** lining by default; `tabular-nums` only in tables, stat numbers, step numbers and the animated count-up, never on a static display price.
- **Monospace:** system stack, only for record IDs.

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

## Rules

1. **Blue is the only accent.** Green, amber and red are for status, never decoration.
2. **One highlight per group.** In a row of step cards, only one is solid blue.
3. **No stock photos or fake product shots.** Any product illustration that shows sample data must be labelled "Illustration · sample data".
4. **No invented metrics, logos or testimonials.** An E2E test enforces this on the home page.
5. **Visible focus everywhere.** Never remove the focus ring from interactive elements.
6. **No new external origins** for fonts, images or scripts. The CSP stays strict.
