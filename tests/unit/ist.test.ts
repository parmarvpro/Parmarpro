import { describe, expect, it } from "vitest";

import { formatIstDate, formatIstDateTime, istDateKey, istDayStart } from "@/lib/ist";

describe("istDayStart", () => {
  it("is 00:00 IST of the IST day, which is still the previous UTC day", () => {
    // 20:00Z is 01:30 on 30 Oct in IST, so the IST day began at 18:30Z on 29 Oct.
    expect(istDayStart(new Date("2026-10-29T20:00:00Z")).toISOString()).toBe("2026-10-29T18:30:00.000Z");
  });

  it("assigns the last millisecond before IST midnight to the day that is ending", () => {
    expect(istDayStart(new Date("2026-10-29T18:29:59.999Z")).toISOString()).toBe("2026-10-28T18:30:00.000Z");
  });

  it("maps the first millisecond of an IST day to that day's start", () => {
    expect(istDayStart(new Date("2026-10-29T18:30:00.000Z")).toISOString()).toBe("2026-10-29T18:30:00.000Z");
  });

  it("returns the same instant when applied to a day start", () => {
    const start = istDayStart(new Date("2026-10-29T20:00:00Z"));
    expect(istDayStart(start).getTime()).toBe(start.getTime());
  });
});

describe("istDateKey", () => {
  it("changes at IST midnight, not at UTC midnight", () => {
    expect(istDateKey(new Date("2026-10-29T18:29:59Z"))).toBe("2026-10-29"); // 23:59:59 IST
    expect(istDateKey(new Date("2026-10-29T18:30:00Z"))).toBe("2026-10-30"); // 00:00 IST
    expect(istDateKey(new Date("2026-10-29T20:00:00Z"))).toBe("2026-10-30"); // 01:30 IST
  });

  it("rolls over month and year boundaries in IST", () => {
    expect(istDateKey(new Date("2026-10-31T19:00:00Z"))).toBe("2026-11-01"); // 00:30 IST on 1 Nov
    expect(istDateKey(new Date("2026-12-31T18:45:00Z"))).toBe("2027-01-01");
  });
});

describe("IST formatting", () => {
  // 05:00Z on 30 Oct 2026 is 10:30 on Friday 30 Oct in IST.
  const instant = new Date("2026-10-30T05:00:00Z");

  it("formats the IST date and time with weekday", () => {
    const text = formatIstDateTime(instant);
    expect(text).toContain("Fri");
    expect(text).toContain("30 Oct");
    expect(text).toContain("2026");
    expect(text).toMatch(/10:30 am$/);
  });

  it("formats the IST date without a time", () => {
    expect(formatIstDate(instant)).toBe("30 Oct 2026");
  });

  it("uses the IST day, not the UTC day, for the date", () => {
    // 20:00Z on 29 Oct is already 30 Oct in IST.
    expect(formatIstDate(new Date("2026-10-29T20:00:00Z"))).toBe("30 Oct 2026");
  });
});
