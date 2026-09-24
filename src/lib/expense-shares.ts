export function requireCompleteExpenseShares(expenseId: string, amountCents: number, shares: Array<number | string>): number[] {
  const amounts = shares.map(Number);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amounts.length === 0
    || amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0)
    || amounts.reduce((sum, amount) => sum + amount, 0) !== amountCents) {
    throw new Error(`Harcama payları eksik veya geçersiz: ${expenseId}`);
  }
  return amounts;
}
