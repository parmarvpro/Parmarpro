import { inspect } from "node:util";

import { describe, expect, it } from "vitest";

import { AppError } from "@/server/auth/errors";
import { mapDbError } from "@/server/db/errors";

describe("AppError never carries raw causes", () => {
  it("keeps only the cause's name and code", () => {
    const dbError = { code: "23514", message: "new row violates check", details: "Failing row contains (Synthetic Patient, +919812345678)" };
    const error = mapDbError(dbError);
    expect(error).toMatchObject({ code: "invalid_input", status: 422 });
    expect(error.cause).toEqual({ name: "Error", code: "23514" });
    const printed = inspect(error, { depth: 5 });
    expect(printed).not.toContain("Synthetic Patient");
    expect(printed).not.toContain("+919812345678");
  });

  it("summarises provider errors without their messages", () => {
    const providerError = Object.assign(new Error("invitation for synthetic.user@example.com already exists"), { status: 422 });
    const error = new AppError("internal", { cause: providerError });
    expect(inspect(error, { depth: 5 })).not.toContain("synthetic.user@example.com");
    expect(error.cause).toEqual({ name: "Error", code: "422" });
  });

  it("maps codes to safe statuses", () => {
    expect(mapDbError({ code: "42501" }).status).toBe(403);
    expect(mapDbError({ code: "PGRST116" }).status).toBe(404);
    expect(mapDbError({ code: "23505" }).status).toBe(409);
    expect(mapDbError({ code: "XX000" }).status).toBe(500);
    expect(mapDbError({ code: "XX000" }).message).toBe("Something went wrong. Please try again.");
  });
});
