import { describe, expect, it } from "vitest";
import {
  calculateBalances,
  formatCurrency,
  parseAmountToCents,
  simplifyDebts,
  splitAmount,
} from "./calculations";
import type { Expense, Member } from "./types";

const members: Member[] = [
  { id: "a", householdId: "home", name: "A", role: "owner", active: true, joinedAt: "2026-09-01" },
  { id: "b", householdId: "home", name: "B", role: "member", active: true, joinedAt: "2026-09-01" },
  { id: "c", householdId: "home", name: "C", role: "member", active: true, joinedAt: "2026-09-01" },
  { id: "d", householdId: "home", name: "D", role: "member", active: true, joinedAt: "2026-09-01" },
];

const expense = (payerId: string, amountCents: number, participantIds = members.map((member) => member.id)): Expense => ({
  id: `${payerId}-${amountCents}`,
  householdId: "home",
  payerId,
  amountCents,
  description: "Test expense",
  expenseDate: "2026-09-18",
  participantIds,
  createdAt: "2026-09-18T10:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
});

describe("splitAmount", () => {
  it("keeps the total exact when cents do not divide evenly", () => {
    expect([...splitAmount(10000, ["a", "b", "c"])]).toEqual([
      ["a", 3334],
      ["b", 3333],
      ["c", 3333],
    ]);
  });
});

describe("calculateBalances", () => {
  it("calculates the four-person example from the product plan", () => {
    const balances = calculateBalances(members, [
      expense("a", 200000),
      expense("b", 300000),
      expense("c", 100000),
      expense("d", 100000),
    ]);

    expect(balances).toEqual([
      { memberId: "a", amountCents: 25000 },
      { memberId: "b", amountCents: 125000 },
      { memberId: "c", amountCents: -75000 },
      { memberId: "d", amountCents: -75000 },
    ]);
  });

  it("only charges selected participants", () => {
    const balances = calculateBalances(members, [expense("a", 60000, ["a", "b", "c"])]);

    expect(balances).toEqual([
      { memberId: "a", amountCents: 40000 },
      { memberId: "b", amountCents: -20000 },
      { memberId: "c", amountCents: -20000 },
      { memberId: "d", amountCents: 0 },
    ]);
  });
});

describe("simplifyDebts", () => {
  it("produces the smallest direct transfer list for the example", () => {
    expect(simplifyDebts([
      { memberId: "a", amountCents: 25000 },
      { memberId: "b", amountCents: 125000 },
      { memberId: "c", amountCents: -75000 },
      { memberId: "d", amountCents: -75000 },
    ])).toEqual([
      { fromMemberId: "c", toMemberId: "b", amountCents: 75000 },
      { fromMemberId: "d", toMemberId: "b", amountCents: 50000 },
      { fromMemberId: "d", toMemberId: "a", amountCents: 25000 },
    ]);
  });
});

describe("money helpers", () => {
  it("parses Turkish amounts and formats cents", () => {
    expect(parseAmountToCents("1.250,50")).toBe(125050);
    expect(parseAmountToCents("0")).toBeNull();
    expect(formatCurrency(125050)).toContain("1.250,50");
  });
});
