import { describe, expect, it } from "vitest";
import { requireCompleteExpenseShares } from "./expense-shares";

describe("remote expense share integrity", () => {
  it("accepts a complete split with more than 1,000 participant rows", () => {
    const shares = Array.from({ length: 1_205 }, () => "100");
    expect(requireCompleteExpenseShares("expense", 120_500, shares)).toHaveLength(1_205);
  });

  it("rejects truncated or unsafe splits instead of calculating a wrong balance", () => {
    expect(() => requireCompleteExpenseShares("expense", 120_500, Array.from({ length: 1_000 }, () => "100"))).toThrow("Harcama payları eksik");
    expect(() => requireCompleteExpenseShares("expense", 100, [])).toThrow("Harcama payları eksik");
    expect(() => requireCompleteExpenseShares("expense", 100, [Number.MAX_SAFE_INTEGER + 1])).toThrow("Harcama payları eksik");
  });
});
