import { describe, expect, it } from "vitest";
import { safeNextUrl } from "./safe-next-url";

const origin = "https://app.example";

describe("safeNextUrl", () => {
  it("keeps a valid in-app destination", () => {
    expect(safeNextUrl("/dashboard?household=one#activity", origin).href)
      .toBe("https://app.example/dashboard?household=one#activity");
  });

  it.each(["//evil.example", "/\\evil.example", "/dashboard\\evil.example", "/\tevil.example", "/dashboard\nevil.example", "https://evil.example", "dashboard"])(
    "falls back to the app root for unsafe next=%s",
    (value) => {
      expect(safeNextUrl(value, origin).href).toBe("https://app.example/");
    },
  );
});
