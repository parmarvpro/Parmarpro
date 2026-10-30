import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, HEAD } from "@/app/api/health/route";
import { publicEnv } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("GET /api/health", () => {
  it("answers ok with the environment name, uncached, as JSON", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok", env: publicEnv.NEXT_PUBLIC_APP_ENV });
  });

  it("reports the configured environment and nothing else", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    // publicEnv is read when its module loads, so load a fresh copy after the stub.
    vi.resetModules();
    const route = await import("@/app/api/health/route");
    const body = await route.GET().json();
    expect(body).toEqual({ status: "ok", env: "staging" });
  });
});

describe("HEAD /api/health", () => {
  it("answers 200 with no body and no-store caching", async () => {
    const response = HEAD();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.body).toBeNull();
    expect(await response.text()).toBe("");
  });
});
