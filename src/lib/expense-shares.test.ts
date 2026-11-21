import { describe, expect, it } from "vitest";
import { allocateExpenseShares, requireCompleteExpenseShares } from "./expense-shares";

describe("custom expense share allocation", () => {
  const participants = ["a", "b", "c", "d"];

  it("redistributes the fixed total without changing previously edited shares", () => {
    expect(allocateExpenseShares(40_000, participants, { a: "70" })).toEqual({
      status: "ready",
      shares: new Map([["a", 7_000], ["b", 11_000], ["c", 11_000], ["d", 11_000]]),
    });
    expect(allocateExpenseShares(40_000, participants, { a: "70", b: "130" })).toEqual({
      status: "ready",
      shares: new Map([["a", 7_000], ["b", 13_000], ["c", 10_000], ["d", 10_000]]),
    });
  });

  it("keeps zero manual shares and distributes odd cents only among selected automatic participants", () => {
    expect(allocateExpenseShares(101, participants.slice(0, 3), { a: "0", d: "50" })).toEqual({
      status: "ready",
      shares: new Map([["a", 0], ["b", 51], ["c", 50]]),
    });
  });

  it("requires valid manual shares and a full allocation before saving", () => {
    expect(allocateExpenseShares(40_000, participants, { a: "70," })).toEqual({ status: "invalid-share" });
    expect(allocateExpenseShares(40_000, participants, { a: "70", b: "331" })).toEqual({ status: "over-total" });
    expect(allocateExpenseShares(40_000, participants, { a: "70", b: "130", c: "100", d: "90" })).toEqual({ status: "unallocated" });
    expect(allocateExpenseShares(40_000, participants, { a: "70", b: "130", c: "100", d: "100" }).status).toBe("ready");
  });
});

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
