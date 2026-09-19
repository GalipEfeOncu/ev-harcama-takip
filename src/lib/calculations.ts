import type { Balance, Expense, Member, Transfer } from "@/lib/types";

export function splitAmount(amountCents: number, participantIds: string[]) {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error("Amount must be a non-negative integer in cents.");
  }

  if (participantIds.length === 0) {
    throw new Error("An expense needs at least one participant.");
  }

  const uniqueParticipantIds = new Set(participantIds);
  if (uniqueParticipantIds.size !== participantIds.length) {
    throw new Error("An expense cannot contain duplicate participants.");
  }

  const baseShare = Math.floor(amountCents / participantIds.length);
  const remainder = amountCents % participantIds.length;

  return new Map(
    participantIds.map((memberId, index) => [
      memberId,
      baseShare + (index < remainder ? 1 : 0),
    ]),
  );
}

export function calculateBalances(
  members: Member[],
  expenses: Expense[],
): Balance[] {
  const balances = new Map(members.map((member) => [member.id, 0]));

  for (const expense of expenses) {
    if (!balances.has(expense.payerId)) {
      throw new Error(`Unknown payer: ${expense.payerId}`);
    }

    balances.set(
      expense.payerId,
      (balances.get(expense.payerId) ?? 0) + expense.amountCents,
    );

    for (const [memberId, shareCents] of splitAmount(
      expense.amountCents,
      expense.participantIds,
    )) {
      if (!balances.has(memberId)) {
        throw new Error(`Unknown participant: ${memberId}`);
      }

      balances.set(memberId, (balances.get(memberId) ?? 0) - shareCents);
    }
  }

  return members.map((member) => ({
    memberId: member.id,
    amountCents: balances.get(member.id) ?? 0,
  }));
}

export function simplifyDebts(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((balance) => balance.amountCents > 0)
    .map((balance) => ({ ...balance }))
    .sort((a, b) => b.amountCents - a.amountCents);
  const debtors = balances
    .filter((balance) => balance.amountCents < 0)
    .map((balance) => ({ ...balance, amountCents: Math.abs(balance.amountCents) }))
    .sort((a, b) => b.amountCents - a.amountCents);

  const transfers: Transfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amountCents = Math.min(creditor.amountCents, debtor.amountCents);

    if (amountCents > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountCents,
      });
    }

    creditor.amountCents -= amountCents;
    debtor.amountCents -= amountCents;

    if (creditor.amountCents === 0) creditorIndex += 1;
    if (debtor.amountCents === 0) debtorIndex += 1;
  }

  return transfers;
}

export function formatCurrency(amountCents: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function parseAmountToCents(value: string) {
  const normalized = value.trim().replace(/[₺\s]/g, "");
  if (!normalized || !/^\d+(?:[.,]\d+)*$/.test(normalized)) return null;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  let decimalSeparator: "," | "." | null = null;
  let groupingSeparator: "," | "." | null = null;

  if (hasComma && hasDot) {
    decimalSeparator = normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? "," : ".";
    groupingSeparator = decimalSeparator === "," ? "." : ",";
  } else if (hasComma) {
    decimalSeparator = ",";
  } else if (hasDot) {
    const dotCount = normalized.length - normalized.replace(/\./g, "").length;
    if (dotCount > 1) {
      groupingSeparator = ".";
    } else {
      const [whole, fraction = ""] = normalized.split(".");
      const looksLikeTurkishThousands = fraction.length === 3 && /^[1-9]\d{0,2}$/.test(whole);
      if (looksLikeTurkishThousands) groupingSeparator = ".";
      else if (fraction.length <= 2) decimalSeparator = ".";
      else return null;
    }
  }

  let whole = normalized;
  let fraction = "";

  if (decimalSeparator) {
    const decimalParts = normalized.split(decimalSeparator);
    if (decimalParts.length !== 2) return null;
    [whole, fraction] = decimalParts;
    if (fraction.length < 1 || fraction.length > 2) return null;
  }

  if (groupingSeparator) {
    const groups = whole.split(groupingSeparator);
    if (groups.length < 2 || !/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some((group) => !/^\d{3}$/.test(group))) {
      return null;
    }
    whole = groups.join("");
  } else if (!/^\d+$/.test(whole)) {
    return null;
  }

  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}
