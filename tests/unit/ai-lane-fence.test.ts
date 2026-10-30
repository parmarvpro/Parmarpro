import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

// Lints import statements against eslint.config.mjs, so the AI lane fence is proven
// by the real config. The files named here need not exist: only the rule is checked.
let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd: process.cwd() });
}, 60_000);

/** The no-restricted-imports messages that `import "<specifier>"` would raise in `filePath`. */
async function restrictedImports(filePath: string, specifier: string): Promise<string[]> {
  const [result] = await eslint.lintText(`import "${specifier}";\n`, { filePath });
  if (!result) throw new Error(`no lint result for ${filePath}`);
  const fatal = result.messages.filter((message) => message.fatal);
  if (fatal.length > 0) throw new Error(`fatal lint error in ${filePath}: ${fatal[0]?.message}`);
  return result.messages.filter((message) => message.ruleId === "no-restricted-imports").map((message) => message.message);
}

describe("free AI lane fence", () => {
  it.each([
    ["src/server/dal/x.ts", "@/server/ai/free-lane"],
    ["src/server/ai/features/enquiry-sort.ts", "@/server/ai/free-lane"],
    ["src/server/ai/features/reply-draft.ts", "@/server/ai/free-lane"],
    ["src/server/ai/paid-lane.ts", "@/server/ai/free-lane"],
    ["src/server/dal/x.ts", "../ai/free-lane"],
    ["src/server/ai/features/enquiry-sort.ts", "../free-lane"],
  ])("%s may not import %s", async (filePath, specifier) => {
    expect(await restrictedImports(filePath, specifier)).not.toEqual([]);
  }, 30_000);

  it("ops-note may import it", async () => {
    expect(await restrictedImports("src/server/ai/features/ops-note.ts", "@/server/ai/free-lane")).toEqual([]);
    expect(await restrictedImports("src/server/ai/features/ops-note.ts", "../free-lane")).toEqual([]);
  }, 30_000);
});

describe("paid AI lane fence", () => {
  it("ops-note may not import it, by alias or by relative path", async () => {
    expect(await restrictedImports("src/server/ai/features/ops-note.ts", "@/server/ai/paid-lane")).not.toEqual([]);
    expect(await restrictedImports("src/server/ai/features/ops-note.ts", "../paid-lane")).not.toEqual([]);
  }, 30_000);

  it("enquiry-sort and reply-draft may import it", async () => {
    expect(await restrictedImports("src/server/ai/features/enquiry-sort.ts", "@/server/ai/paid-lane")).toEqual([]);
    expect(await restrictedImports("src/server/ai/features/reply-draft.ts", "@/server/ai/paid-lane")).toEqual([]);
  }, 30_000);

  it("the free lane may not import it", async () => {
    expect(await restrictedImports("src/server/ai/free-lane.ts", "@/server/ai/paid-lane")).not.toEqual([]);
  }, 30_000);
});

describe("privileged files", () => {
  it("may import the privileged client", async () => {
    expect(await restrictedImports("src/server/privileged/x.ts", "@/server/privileged/client")).toEqual([]);
  }, 30_000);

  it.each(["@/server/ai/free-lane", "@/server/ai/paid-lane", "@/server/ai/transport"])(
    "may not import %s",
    async (specifier) => {
      expect(await restrictedImports("src/server/privileged/x.ts", specifier)).not.toEqual([]);
    },
    30_000,
  );
});

describe("transport fence", () => {
  it("run.ts may not import the transport, by alias or by relative path", async () => {
    expect(await restrictedImports("src/server/ai/run.ts", "@/server/ai/transport")).not.toEqual([]);
    expect(await restrictedImports("src/server/ai/run.ts", "./transport")).not.toEqual([]);
  }, 30_000);

  it("the free lane and the paid lane may import it", async () => {
    expect(await restrictedImports("src/server/ai/free-lane.ts", "@/server/ai/transport")).toEqual([]);
    expect(await restrictedImports("src/server/ai/free-lane.ts", "./transport")).toEqual([]);
    expect(await restrictedImports("src/server/ai/paid-lane.ts", "@/server/ai/transport")).toEqual([]);
  }, 30_000);

  it("components and shared lib code may not import it", async () => {
    expect(await restrictedImports("src/lib/x.ts", "@/server/ai/transport")).not.toEqual([]);
    expect(await restrictedImports("src/components/x.tsx", "@/server/ai/transport")).not.toEqual([]);
  }, 30_000);
});

describe("privileged client fence", () => {
  it("enquiry-sort may not import the privileged client", async () => {
    expect(await restrictedImports("src/server/ai/features/enquiry-sort.ts", "@/server/privileged/client")).not.toEqual([]);
  }, 30_000);

  it("a relative import of the privileged client is restricted too", async () => {
    expect(await restrictedImports("src/server/dal/x.ts", "../privileged/client")).not.toEqual([]);
  }, 30_000);

  it("components and shared lib code keep their server-module restrictions", async () => {
    expect(await restrictedImports("src/lib/x.ts", "@/server/privileged/client")).not.toEqual([]);
  }, 30_000);

  it("the privileged directory is exempt, so privileged modules can use the client", async () => {
    expect(await restrictedImports("src/server/privileged/ai-usage.ts", "@/server/privileged/client")).toEqual([]);
  }, 30_000);
});

describe("tests may import every AI module", () => {
  it("allows the free lane, the paid lane and the transport in tests", async () => {
    expect(await restrictedImports("tests/unit/x.test.ts", "@/server/ai/free-lane")).toEqual([]);
    expect(await restrictedImports("tests/unit/x.test.ts", "@/server/ai/paid-lane")).toEqual([]);
    expect(await restrictedImports("tests/unit/x.test.ts", "@/server/ai/transport")).toEqual([]);
  }, 30_000);
});
