import { expect, test } from "./fixtures";

/** One self-hosted family (Archivo): wide heavy display, normal-width text, light-weight accent, no italics. */

test("the display, text and accent voices all come from Archivo", async ({ page }) => {
  await page.goto("/");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveText(/Stop losing patients/i);

  const styles = await page.evaluate(() => {
    const read = (el: Element) => {
      const s = getComputedStyle(el);
      return { family: s.fontFamily, weight: s.fontWeight, stretch: s.fontStretch, style: s.fontStyle, transform: s.textTransform };
    };
    return {
      body: read(document.body),
      h1: read(document.querySelector("h1")!),
      accent: read(document.querySelector("h1 .accent")!),
      lead: read(document.querySelector("main p")!),
    };
  });

  for (const voice of [styles.body, styles.h1, styles.accent]) expect(voice.family.toLowerCase()).toContain("archivo");
  expect(styles.h1).toMatchObject({ weight: "800", stretch: "112%", transform: "uppercase" });
  expect(styles.accent).toMatchObject({ weight: "300", style: "normal" });
  expect(styles.lead).toMatchObject({ weight: "400", stretch: "100%", style: "normal" });
});

test("only one font file is downloaded for the home page", async ({ page }) => {
  const fonts: string[] = [];
  page.on("response", (response) => {
    if (/\.woff2?(\?|$)/.test(response.url())) fonts.push(response.url());
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  expect(fonts).toHaveLength(1);
  expect(fonts[0]).toContain("/_next/static/");
});

test("no italics anywhere on the marketing pages", async ({ page }) => {
  for (const path of ["/", "/features", "/contact"]) {
    await page.goto(path);
    const italics = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => getComputedStyle(el).fontStyle !== "normal").length);
    expect(italics, path).toBe(0);
  }
});
