# Typography: proposed system

**Status: applied.** Everything below was rendered and measured on ParmarPro's real copy (hero, step cards, price, dashboard table) before being written down. The "Type" section of `design-system.md` summarises it.

## 1. What is wrong today

| Today | Why it reads as "vibe coded" |
|---|---|
| **Geist** for everything (headlines, body, UI) | It is the default of `create-next-app`, v0 and shadcn starters. A heavy uppercase headline in Geist is a stock look. |
| **Instrument Serif italic** for one accent word per headline | The most repeated trope in AI-generated landing pages in 2025–26. |
| **Geist Mono** for IDs | A third webfont for one table cell. |
| Arbitrary sizes (`text-[9px]`, `[10px]`, `[11px]`, `[12px]`, `[15px]`) next to the Tailwind scale | Sizes that nobody chose. Looks unfinished up close. |

Evidence for the perception (blog, forum and press sources, so this is about how sites are read, not proof):
- aiskill.market, "Banning Inter: why font defaults are the slop tell": defaults are the tell; the "committed alternative" it suggests is Geist plus Instrument Serif, which is what ParmarPro uses now.
- r/branding, "Why every AI is obsessed with Instrument Serif?".
- WIRED, "AI Has Come for Serif Fonts": serifs now signal "AI-built" in vibe-coded boilerplates.

The reference site (Veylora) self-hosts **Newsreader + Manrope**: an editorial, serif-led pairing for a consumer product. ParmarPro is a B2B operations tool whose brand board is a heavy uppercase grotesk, so it needs a grotesk-led system, not a copy of that pairing.

## 2. Decision

**One family: Archivo (variable), self-hosted, trimmed.** No serif, no italics, no second webfont.

| Role | Setting |
|---|---|
| Display (marketing and auth headlines, card words, price) | Archivo **800, width 112%**, uppercase |
| Everything else (body, UI, dashboard, tables, forms) | Archivo **400–700, width 100%** |
| Accent word | Archivo **300**, same width, same blue, same case. Weight contrast, not a different typeface |
| Monospace (IDs only) | System stack, no webfont |

Why Archivo: it has a width axis, so one file gives a wide, confident display voice and a normal-width text voice. It has a large x-height (0.77 of cap height), which keeps 12–14px dashboard text legible. It is not one of the defaults above. It contains `₹` (U+20B9), lining and tabular numerals, and has no slashed zeros.

### Rejected, with the reason seen in the renders
| Candidate | Reason |
|---|---|
| Geist (current) | Default look. |
| Mona Sans Wide | Letters collide at tight tracking; zeros are slashed in tabular mode. |
| Schibsted Grotesk | Good, but no width axis, so no display/text split from one file. |
| Bricolage Grotesque condensed | Unreadable at heading size. |
| Hanken, Funnel, Instrument Sans | **No `₹` glyph.** Not acceptable for a rupee-priced product. |
| Newsreader or Fraunces italic accent | Elegant, but it is the serif-accent trope. Fraunces' descender also collides with the line below ("p" touching "FIRST"). |
| Width-contrast accent (condensed word) | Looks like a rendering bug. |
| Outlined accent word | Overlapping contours show inside letters in variable fonts. |

## 3. Font file

Built once from Google's OFL release of Archivo and committed, so builds no longer fetch Google Fonts and the CSP stays unchanged (same-origin `/_next/static/media`).

| | Today | Proposed |
|---|---|---|
| Preloaded fonts | Three files totalling 66.5 KB (22.6 + 28.6 + 15.3 KB, read from the production build), 3 requests | `archivo-var.woff2` **49 KB, 1 request** |
| `₹` | Fetched later from a separate `latin-ext` file (small late swap) | In the main file |
| Build | Needs network access to Google Fonts | Needs nothing |

Untrimmed Archivo from Google would be 88 KB (latin) plus 84 KB (latin-ext just for `₹`), which is why it is trimmed.

**Axes kept:** `wght` 300–800, `wdth` 100–125. **Coverage:** Basic Latin, Latin-1, typographic quotes, dashes, `•`, `…`, `→ ← ↑ ↓`, `−`, `×`, `™`, **`₹`**. **Features kept:** `kern liga calt tnum lnum pnum case ccmp locl mark mkmk`.

`scripts/fonts/build-archivo.py` (run by hand when the font changes; needs `pip install fonttools brotli`):

```python
import os, sys, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

SRC = "https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf"
OFL = "https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/OFL.txt"
OUT = "src/fonts"
os.makedirs(OUT, exist_ok=True)
ttf = os.path.join(OUT, "Archivo-VF.ttf")
urllib.request.urlretrieve(SRC, ttf)
urllib.request.urlretrieve(OFL, os.path.join(OUT, "OFL.txt"))

UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100))
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026,
       0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x00D7, 0x2122, 0x20B9]
)
FEATURES = ["kern", "liga", "calt", "tnum", "lnum", "pnum", "case", "ccmp", "locl", "mark", "mkmk"]

font = TTFont(ttf)
assert 0x20B9 in font.getBestCmap(), "source font has no rupee sign"
font = instancer.instantiateVariableFont(font, {"wght": (300, 800), "wdth": (100, 125)})
opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = FEATURES
opts.notdef_outline = True
opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
opts.hinting = False
opts.desubroutinize = True
sub = subset.Subsetter(opts)
sub.populate(unicodes=UNICODES)
sub.subset(font)
assert 0x20B9 in font.getBestCmap(), "rupee sign lost while subsetting"
font.flavor = "woff2"
font.save(os.path.join(OUT, "archivo-var.woff2"))
os.remove(ttf)
size = os.path.getsize(os.path.join(OUT, "archivo-var.woff2"))
print(f"archivo-var.woff2: {size / 1024:.1f} KB")
assert size < 60 * 1024, "font grew past the 60 KB budget"
```

Measured result of exactly this recipe: **49.4 KB**, `₹` present. Files committed: `src/fonts/archivo-var.woff2`, `src/fonts/OFL.txt` (license must ship with the font).

## 4. Code

`src/app/layout.tsx`:

```tsx
import localFont from "next/font/local";

const archivo = localFont({
  src: "../fonts/archivo-var.woff2",
  variable: "--font-archivo",
  weight: "300 800",
  display: "swap",
  adjustFontFallback: "Arial",
  declarations: [{ prop: "font-stretch", value: "100% 125%" }],
});
// <html className={`${archivo.variable} h-full`}>
// Clerk appearance: fontFamily and fontFamilyButtons -> "var(--font-archivo), Arial, ui-sans-serif, system-ui, sans-serif"
```

Remove `Geist`, `Geist_Mono`, `Instrument_Serif` and `--font-instrument-serif`.

`src/app/globals.css`:

```css
@theme inline {
  --font-sans: var(--font-archivo), Arial, ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
}
/* remove: --font-accent */

@layer base {
  body {
    font-variant-numeric: lining-nums;
    font-kerning: normal;
    font-synthesis: none;            /* never fake bold or italic */
  }
}

@utility headline {                  /* display voice: marketing and auth only */
  text-transform: uppercase;
  font-weight: 800;
  font-stretch: 112%;
  line-height: 0.95;
  letter-spacing: -0.03em;
  text-wrap: balance;
}
@utility accent {                    /* one word per headline, weight contrast only */
  font-weight: 300;
}
@utility eyebrow {
  text-transform: uppercase;
  font-size: 0.75rem;                /* 12px; was 11px */
  line-height: 1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--color-brand-600);
}
```

Outlined text (`.outline-text`, `.outline-text-soft`) keeps its 1.5px stroke. Rule: any outlined word set at display size uses `font-kerning: none` and tracking `+0.03em` (the scrolling ribbon that first needed this was removed with the motion system); with kerning and the display `-0.03em`, and even at `-0.01em` or `0`, the outlines of pairs such as T and Y touch or overlap (seen in zoomed renders of "ACTIVITY"). The footer wordmark may use `-0.04em` only because none of the pairs in "PARMARPRO" collide (checked zoomed).

## 5. Scale and rules

### Roles (marketing)
| Role | Size (mobile to desktop) | Weight | Width | Case | Tracking | Line height |
|---|---|---|---|---|---|---|
| Hero H1 | `clamp(1.9rem, 6.1vw + 0.2rem, 4.5rem)` (30px at 390, 72px max) | 800 | 112% | upper | -0.03em | 0.95 |
| Inner-page H1 (`PageHero`) | `clamp(1.75rem, 4.2vw + 0.4rem, 3.75rem)` | 800 | 112% | upper | -0.03em | 0.95 |
| H2 (section) | `clamp(1.6rem, 3.4vw, 3rem)` | 800 | 112% | upper | -0.028em | 1.0 |
| Card word (Capture, Follow up, Book) | `clamp(1.6rem, 2.6vw, 2.25rem)` | 800 | 112% | upper | -0.03em | 0.95 |
| Price | `clamp(2rem, 5vw, 3.5rem)` | 800 | 112% | upper | -0.03em | 1.0 |
| Footer wordmark | `clamp(2.5rem, 12.8vw, 14rem)` (measured: "PARMARPRO" is about 7.2 times the font size wide, so 12.8vw fills about 92% of the screen) | 800 | 112% | upper | -0.04em | 0.9 |
| Lead paragraph | `clamp(1.0625rem, 0.6vw + 0.95rem, 1.25rem)` | 400 | 100% | sentence | 0 | 1.55 |
| Body | 1rem | 400 | 100% | sentence | 0 | 1.6 |
| Card body, small print | 0.875rem | 400 | 100% | sentence | 0 | 1.55 |
| Eyebrow | 0.75rem | 700 | 100% | upper | +0.1em | 1.33 |
| Button, nav | 0.9375rem / 0.875rem | 600 / 500 | 100% | sentence | 0 | 1.2 |

### Roles (dashboard, calmer, never wide or uppercase except labels)
| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title | 1.5rem | 700 | sentence case, tracking -0.01em, line height 1.2 |
| Section title | 1.125rem | 600 | |
| Body, table cell, input | 0.875rem | 400 | line height 1.5 |
| Table header, stat label | 0.75rem | 700 | uppercase, +0.08em |
| Stat number | 1.75rem | 700 | `tabular-nums` |
| Badge | 0.75rem | 600 | |
| Helper text | 0.75rem | 400 | |

### Fixed rules
1. **Weights allowed:** 300 (accent only), 400, 500, 600, 700, 800 (display only). Nothing else.
2. **Width:** 100% everywhere except display at 112%.
3. **Accent:** at most one word per headline, weight 300, never italic, never a serif.
4. **No italics anywhere.** `font-synthesis: none` backs this up.
5. **Minimum size 12px.** Exception: the aria-hidden sample cards inside the hero illustration may use 11px on phones.
6. **Numerals:** lining by default. `tabular-nums` only in table cells, stat numbers, date/time columns and the 01/02/03 step numbers. **Never on a static display price or any figure with a comma or decimal point** (in testing, Schibsted Grotesk set a price as "75 , 000" with tabular figures; Archivo did not, but the rule keeps this safe if the font ever changes). Phone and date cells get `whitespace-nowrap`.
7. **Uppercase is visual only.** DOM text stays sentence case (tests rely on it).
8. **`₹` always comes from Archivo**, never a fallback. Price text keeps `₹` and digits in one element.
9. **Replace arbitrary sizes** with the scale: `text-[9px]`, `[10px]`, `[11px]` become `text-xs` (12px) except in the hero illustration; `text-[12px]` becomes `text-xs`; `text-[15px]` becomes `text-sm` or `text-base`, whichever the surrounding text uses.

## 6. Files to change when applying

Add: `src/fonts/archivo-var.woff2`, `src/fonts/OFL.txt`, `scripts/fonts/build-archivo.py`, `tests/e2e/typography.spec.ts`.
Edit: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/(marketing)/page.tsx` (hero and H2 sizes), `src/components/marketing/page-hero.tsx`, `src/components/brand/step-card.tsx`, `src/components/marketing/site-footer.tsx`, `src/components/motion/marquee-ribbon.tsx`, `src/components/motion/split-words.tsx` and `page-hero.tsx` (comments that say "italic serif"), the components that use arbitrary pixel sizes, table cells with phone and date values, `docs/design-system.md` (Type section points here).

## 7. How it will be verified

- **E2E (`typography.spec.ts`):** body `font-family` starts with Archivo; hero `h1` computes weight 800 and `font-stretch` 112%; `.accent` computes weight 300 and `font-style` normal; exactly **one** woff2 is requested on `/`; no horizontal scroll at 390, 768, 1024 and 1440 (existing tests).
- **Unit/guard:** no import of `next/font/google` anywhere in `src`, and the build script's own assertions (`₹` present, size under 60 KB).
- **Screenshots** at 390, 768, 1024 and 1440 for `/`, `/features`, `/contact`, `/sign-in`, checking the outlined ribbon and footer wordmark for inner-contour artifacts.
- **Measured before and after:** font bytes and request count, CLS (fallback metrics are adjusted to Arial), Lighthouse mobile.
- Existing checks unchanged: lint, typecheck, unit, build, public-env, no-bypass, E2E, gitleaks, CI.

## 7a. Measured after applying (2026-10-28)

| | Before (Geist, Geist Mono, Instrument Serif) | After (Archivo) |
|---|---|---|
| Font requests on the home page (Lighthouse) | 4 requests, 85.3 KB | **1 request, 50.2 KB** |
| Font files in the production build | 13 files (all subsets) | **1 file, 49.5 KB**, preloaded |
| Lighthouse mobile, home (3 runs, same flags) | perf 56-59, LCP 4.9-5.0 s, TBT 0.92-1.19 s, CLS 0-0.004 | perf 60-66, LCP 4.6-4.7 s, TBT 0.62-0.88 s, CLS 0 |
| Accessibility (Lighthouse) | 100 | 100 |
| Horizontal overflow, clipped headings | none | none (home, features, contact, sign-in at 390, 768, 1024, 1440) |

The LCP and TBT targets (2.5 s and 200 ms) were **still not met** in this sandbox at the time; the font change helped but was not the main cause. These numbers were measured while the motion system was still in place (it has since been removed), so they need re-measuring. Numbers come from a CPU-only container with placeholder Clerk keys and are not real-device results.

Checked in zoomed renders: the outlined ribbon needed `font-kerning: none` and `+0.03em` tracking (section 4) because the T and Y outlines touched; the footer wordmark outline is clean.

## 8. What I could not verify

- Safari and Firefox rendering of `font-stretch` on a self-hosted variable font (supported on paper; only Chromium was available).
- Real phones. Specimens were rendered in desktop Chromium at 390px width.
- Dashboard pages in the browser, because they need a signed-in session. They were checked through a specimen using the same CSS, not the live pages.
- Hindi or Marathi text. Archivo has no Devanagari; it would fall back to a system font. Out of scope while the site is English-only.
- The contrast and wording evidence above comes from blogs, a forum thread and one press article, not from controlled research.
