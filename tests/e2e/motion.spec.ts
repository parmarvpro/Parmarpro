import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * Motion contract for the home page: the outer two blocks move together and
 * the middle one moves the opposite way; reduced motion and the pause control
 * stop everything; the page still works without WebGL.
 */

const STAGE = ".cf-stage";

/** Vertical translation (px) of each element, read from its computed transform. */
async function translateY(page: Page, selector: string): Promise<number[]> {
  return page.evaluate((sel) => {
    return Array.from(document.querySelectorAll<HTMLElement>(sel)).map((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
  }, selector);
}

async function runningAnimations(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return -1;
    return root.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length;
  }, selector);
}

function appErrors(page: Page): string[] {
  const errors: string[] = [];
  // Clerk's script cannot load from a placeholder instance in local runs; that is not an app error.
  const ignorable = /clerk|Content Security Policy|net::ERR/i;
  page.on("pageerror", (error) => {
    if (!ignorable.test(String(error))) errors.push(String(error));
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !ignorable.test(message.text())) errors.push(message.text());
  });
  return errors;
}

test.describe("counter-flow stage", () => {
  test("outer blocks move together and the middle block moves the opposite way", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(STAGE)).toBeAttached();

    const columns = page.locator(`${STAGE} .cf-column`);
    await expect(columns).toHaveCount(3);
    expect(await columns.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.direction))).toEqual([
      "normal",
      "reverse",
      "normal",
    ]);

    const before = await translateY(page, `${STAGE} .cf-column`);
    await page.waitForTimeout(1500);
    const after = await translateY(page, `${STAGE} .cf-column`);
    const [left, middle, right] = after.map((value, index) => value - before[index]!);

    expect(Math.abs(left!)).toBeGreaterThan(5);
    expect(Math.sign(left!)).toBe(Math.sign(right!));
    expect(Math.sign(middle!)).toBe(-Math.sign(left!));
    // Same speed in both directions (within a few pixels of timing jitter).
    expect(Math.abs(Math.abs(middle!) - Math.abs(left!))).toBeLessThan(4);
    expect(Math.abs(Math.abs(right!) - Math.abs(left!))).toBeLessThan(2);
  });

  test("the 01 / 02 / 03 cards cross in opposite directions as the row scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const cards = page.locator("[data-step]");
    await expect(cards).toHaveCount(3);

    const rowTop = await page.evaluate(() => {
      const first = document.querySelector("[data-step='1']") as HTMLElement;
      return first.getBoundingClientRect().top + window.scrollY;
    });

    const sample = async (scrollY: number) => {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(1400); // scrub smoothing settles
      return translateY(page, "[data-step]");
    };
    const early = await sample(rowTop - 700);
    const late = await sample(rowTop - 100);
    const [outerLeft, middle, outerRight] = late.map((value, index) => value - early[index]!);

    expect(Math.abs(outerLeft!)).toBeGreaterThan(10);
    expect(Math.sign(outerLeft!)).toBe(Math.sign(outerRight!));
    expect(Math.sign(middle!)).toBe(-Math.sign(outerLeft!));
  });

  test("the halftone tide inside the 01 / 02 / 03 cards follows the same rule", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const layers = page.locator("[data-step] .flow-tide-layer");
    // Two tones per card, three cards.
    await expect(layers).toHaveCount(6);
    const directions = await layers.evaluateAll((nodes) => nodes.map((node) => (node as unknown as SVGElement).dataset.direction));
    expect(directions).toEqual(["normal", "normal", "reverse", "reverse", "normal", "normal"]);

    const before = await translateY(page, "[data-step] .flow-tide-layer");
    await page.waitForTimeout(1500);
    const after = await translateY(page, "[data-step] .flow-tide-layer");
    const [leftA, leftB, middleA, middleB, rightA, rightB] = after.map((value, index) => value - before[index]!);

    expect(Math.abs(leftA!)).toBeGreaterThan(10);
    // Both tones of one card move together; outer cards match each other; the middle is the opposite.
    expect(leftB).toBeCloseTo(leftA!, 0);
    expect(middleB).toBeCloseTo(middleA!, 0);
    expect(rightA).toBeCloseTo(leftA!, 0);
    expect(rightB).toBeCloseTo(leftA!, 0);
    expect(Math.sign(middleA!)).toBe(-Math.sign(leftA!));
    expect(Math.abs(Math.abs(middleA!) - Math.abs(leftA!))).toBeLessThan(3);
  });

  test("the pause control stops every running animation on the stage and is remembered", async ({ page }) => {
    await page.goto("/");
    expect(await runningAnimations(page, STAGE)).toBeGreaterThan(0);

    const pause = page.getByRole("button", { name: "Pause motion" });
    await pause.click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await expect(page.getByRole("button", { name: "Play motion" })).toHaveAttribute("aria-pressed", "true");
    expect(await runningAnimations(page, STAGE)).toBe(0);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    expect(await runningAnimations(page, STAGE)).toBe(0);

    await page.getByRole("button", { name: "Play motion" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
    expect(await runningAnimations(page, STAGE)).toBeGreaterThan(0);
  });

  test("without WebGL the CSS fallback shows and nothing errors", async ({ page }) => {
    const errors = appErrors(page);
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (/webgl/i.test(type)) return null;
        return (original as (...args: unknown[]) => unknown).call(this, type, ...rest) as never;
      } as typeof original;
    });
    await page.goto("/");
    await page.waitForTimeout(800);

    await expect(page.locator(STAGE)).not.toHaveAttribute("data-live", "true");
    // The fallback wrapper has no box of its own; its three panels carry the frames.
    const panels = page.locator(`${STAGE} .cf-fallback .cf-panel`);
    await expect(panels).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) await expect(panels.nth(index)).toBeVisible();
    await expect(page.locator(`${STAGE} canvas`)).toHaveCount(0);
    // The sample cards still move.
    expect(await runningAnimations(page, STAGE)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("the stage is labelled as illustration with sample data, exactly once", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Illustration · sample data", { exact: true })).toHaveCount(1);
    await expect(page.locator(STAGE)).toHaveAttribute("role", "img");
    const label = await page.locator(STAGE).getAttribute("aria-label");
    expect(label).toMatch(/sample data/i);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing loops, the pause control is hidden and the content is all there", async ({ page }) => {
    const errors = appErrors(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Stop losing patients/i);
    await expect(page.getByRole("button", { name: /Pause motion|Play motion/ })).toHaveCount(0);
    await page.waitForTimeout(600);
    expect(await runningAnimations(page, STAGE)).toBe(0);

    // Page-wide: no infinite animation may still be running anywhere.
    const looping = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running" && animation.effect?.getComputedTiming().iterations === Infinity).length,
    );
    expect(looping).toBe(0);
    expect(errors).toEqual([]);
  });

  test("the intro curtain does not cover the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".curtain")).toBeHidden();
    await expect(page.getByRole("link", { name: /Start your 14-day trial/ })).toBeVisible();
  });
});

test.describe("layout", () => {
  for (const width of [390, 768, 1024, 1440]) {
    test(`home page has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the intro curtain never blocks input", async ({ page }) => {
    await page.goto("/");
    const pointerEvents = await page.evaluate(() => {
      const curtain = document.querySelector<HTMLElement>(".curtain");
      return curtain ? getComputedStyle(curtain).pointerEvents : "none";
    });
    expect(pointerEvents).toBe("none");
  });
});
