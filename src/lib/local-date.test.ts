import { afterEach, describe, expect, it } from "vitest";
import { localDateInputValue } from "./local-date";

const originalTimeZone = process.env.TZ;

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe("localDateInputValue", () => {
  it("uses the Istanbul calendar day just after midnight", () => {
    process.env.TZ = "Europe/Istanbul";
    expect(localDateInputValue(new Date("2026-09-24T21:30:00.000Z"))).toBe("2026-09-25");
  });

  it("uses the user's local day in a negative UTC offset", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(localDateInputValue(new Date("2026-09-25T02:30:00.000Z"))).toBe("2026-09-24");
  });
});
