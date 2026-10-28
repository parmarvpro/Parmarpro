import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe("fonts", () => {
  it("are self-hosted: nothing imports next/font/google or a font CDN", () => {
    const offenders = sourceFiles("src").filter((file) => /next\/font\/google|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("ship the font file within the size budget, with its licence", () => {
    expect(statSync("src/fonts/archivo-var.woff2").size).toBeLessThan(60 * 1024);
    expect(readFileSync("src/fonts/OFL.txt", "utf8")).toContain("SIL Open Font License");
  });
});
