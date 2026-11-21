import { parseAmountToCents, splitAmount } from "./calculations";

type ExpenseShareAllocation =
  | { status: "ready"; shares: Map<string, number> }
  | { status: "invalid-share" | "over-total" | "unallocated" };

export function allocateExpenseShares(
  totalCents: number,
  participantIds: string[],
  manualShareAmounts: Record<string, string>,
): ExpenseShareAllocation {
  const shares = new Map<string, number>();
  const automaticParticipantIds: string[] = [];
  let remainingCents = totalCents;

  for (const memberId of participantIds) {
    if (!Object.hasOwn(manualShareAmounts, memberId)) {
      automaticParticipantIds.push(memberId);
      continue;
    }

    const amountCents = parseAmountToCents(manualShareAmounts[memberId], true);
    if (amountCents === null) return { status: "invalid-share" };
    shares.set(memberId, amountCents);
    remainingCents -= amountCents;
    if (remainingCents < 0) return { status: "over-total" };
  }

  if (automaticParticipantIds.length === 0) {
    return remainingCents === 0 ? { status: "ready", shares } : { status: "unallocated" };
  }

  const automaticShares = splitAmount(remainingCents, automaticParticipantIds);
  return { status: "ready", shares: new Map([...shares, ...automaticShares]) };
}

export function requireCompleteExpenseShares(expenseId: string, amountCents: number, shares: Array<number | string>): number[] {
  const amounts = shares.map(Number);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amounts.length === 0
    || amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0)
    || amounts.reduce((sum, amount) => sum + amount, 0) !== amountCents) {
    throw new Error(`Harcama payları eksik veya geçersiz: ${expenseId}`);
  }
  return amounts;
}
