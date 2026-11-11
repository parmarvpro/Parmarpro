# Parmarpro

The Parmarpro website at **parmarpro.com**. It does three jobs:

| Page | URL | Who sees it |
|---|---|---|
| Agency homepage | `/` | Anyone. Explains the offer: free preview + growth plan, paid implementation. |
| Clinic preview (their new website) | `/p/<clinic>/` | Only people you send the link to. Hidden from Google. |
| Growth plan (the implementation guide) | `/p/<clinic>/plan/` | Same. What we found, the plan, free scripts, pricing, next step. |
| All work (your internal index) | `/work/` | Unlisted. Not linked from the homepage, hidden from Google. |

Each clinic is **one JSON file**. A small Node script turns those files into plain HTML, which GitHub Pages serves for free. No framework and no database.

```
src/site.json            ← your brand, WhatsApp number, prices, FAQ
src/clinics/<slug>.json  ← one file per dentist
src/clinics/_template.json
src/build.mjs            ← node src/build.mjs  → writes index.html, p/, work/, 404.html
src/og.mjs               ← link-preview images for WhatsApp / email (needs Playwright)
src/export.mjs           ← turns a preview into the clinic's real website for their domain
src/serve.mjs            ← local preview at http://localhost:8080
assets/                  ← CSS, JS, favicon
work/flying-movements-foundation/  ← the FMF site that used to be the homepage
```

> Everything in this repo is public on parmarpro.com, including `src/`. **Never put private notes in a clinic file** (e.g. what the dentist said on a call or their prices). Keep your pipeline in a spreadsheet.

---

## First-time setup (5 minutes)

1. Open `src/site.json` and fill in:
   - `contact.whatsapp`: your number with country code, digits only, e.g. `"919876543210"`. **Until you do this, every WhatsApp button on the site is dead.**
   - `contact.email` (optional).
   - `founder`, `market`, `turnaround`, `offer.packages` (prices), `offer.guarantee`, `faq`. These are all plain text, so change anything.
2. Run `node src/build.mjs`. It prints warnings if something's missing.
3. Merge this branch into `main`. GitHub Pages publishes from `main` with the existing `CNAME` (parmarpro.com).

## Add a dentist

**Easiest:** ask Claude Code:

> Add a new clinic preview for this dentist: `<Google Maps link>`. Here's what I see on their profile: rating, review count, hours, phone, services, 2–3 short review quotes, whether they have a website. The top competitors nearby are: … Then build, make the OG image, commit and push.

**By hand:**

1. Copy `src/clinics/_template.json` to `src/clinics/<slug>.json`. The slug must match the file name: lowercase letters, numbers and dashes, e.g. `smile-care-andheri`. Use a slug that isn't easy to guess if you want it extra private.
2. Fill in the fields (see below). Only `name`, `area`, `city`, `address` and `phone` are required.
3. Run `node src/build.mjs`. To also make the WhatsApp link-preview image, run `node src/og.mjs`.
4. Commit and push. The links are:
   - `https://parmarpro.com/p/<slug>/` → send this one (their new site)
   - `https://parmarpro.com/p/<slug>/plan/` → the plan (linked from the preview)

### Clinic fields

| Field | What it does |
|---|---|
| `name`, `shortName` | Full name (as on Google), and a short one for the logo. |
| `area`, `city`, `address` | Shown in the hero, the visit section and the footer. |
| `phone`, `whatsapp` | `whatsapp` defaults to `phone`. Include `+91`. |
| `mapsUrl` / `mapsQuery` | Their Google Maps link (for "Get directions" and "Read all reviews"). `mapsQuery` sets the embedded map; it defaults to name + address. |
| `rating`, `reviewCount`, `since` | From Google. Used in the hero, the trust strip and the audit. |
| `brandColor` | Their colour, e.g. from their signboard or logo (`#0E7C86`). The whole site re-themes. |
| `headline`, `intro` | Optional. Overrides the default hero text. |
| `doctors[]` | `name`, `credentials`, `bio`, optional `photo` (URL). |
| `hours[]` | `{ "days": "Mon – Sat", "time": "10 am – 2 pm, 5 – 9 pm" }` |
| `services[]` | Plain names like `"Root canal treatment"`. Common treatments get a description and icon automatically. You can also pass `{ "name", "desc", "icon" }`. |
| `reviews[]` | 2–3 **real**, short excerpts with `author` (first name + initial). |
| `faqs[]` | Optional `{ "q", "a" }`. Booking, location and timings are added automatically. |
| `audit.website` | `"none"`, `"outdated"` or `"ok"`. |
| `audit.onlineBooking`, `audit.repliesToReviews` | `true` / `false`. |
| `audit.photoCount` | Number of photos on their Google profile. |
| `audit.competitors[]` | `{ "name", "rating", "reviews", "website": true/false }`. You can write "Clinic A (0.4 km)" instead of real names. |
| `audit.notes[]` | Anything else you noticed: a string, or `{ "title", "detail", "status": "bad"/"warn"/"good" }`. |
| `showcase` | `true` lists them under "Selected work" on the homepage. Only do this for paying clients who said yes. |
| `demo` | Marks fictional sample data (the `demo-dental` clinic). |

## Remove a preview

Delete `src/clinics/<slug>.json`, run `node src/build.mjs` (it deletes `p/<slug>/` for you), then commit and push. The site promises removal within 24 hours, so keep that promise.

## Launch a clinic's real website (after they pay)

```bash
node src/export.mjs <slug> theirclinic.in
```

This writes `export/<slug>/`: the same site without the Parmarpro banners, indexable by Google, with its own favicon and a small "Website by Parmarpro" footer credit. Put it in a **new** GitHub repo (owned by you or the clinic), turn on Pages, and point their domain at it. Register the domain **in the clinic's name**; the FAQ promises they own it.

## Local preview

```bash
node src/build.mjs && node src/serve.mjs   # http://localhost:8080
```

Node 18+ is the only requirement. `og.mjs` also needs Playwright (`npm i -D playwright && npx playwright install chromium`). Claude Code cloud sessions already have it.

## Notes

- `index.html`, `p/`, `work/index.html` and `404.html` are **generated**. Edit `src/`, not those files, or your changes get overwritten on the next build.
- `Index.html2` and `None.1.` are old leftovers (a duplicate of the FMF page and an early placeholder). It's safe to delete them.
