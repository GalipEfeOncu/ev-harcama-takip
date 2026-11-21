import { formatCurrency } from "./calculations";

export type ExpenseDetails = { creator: string; amount: number; description: string; category: string; payer: string | null };

export function expenseMessage(expense: ExpenseDetails) {
  return [
    expense.creator + " bir harcama ekledi.",
    expense.description + " · " + formatCurrency(expense.amount),
    "Kategori: " + expense.category.slice(0, 120),
    expense.payer && "Ödeyen: " + expense.payer,
  ].filter(Boolean).join("\n");
}

export function retryDelay(attempt: number, status?: number, retryAfter = 0) {
  const needsRepair = status === 400 || status === 403;
  const backoff = needsRepair ? 3600 : Math.min(3600, 5 * 2 ** Math.min(attempt - 1, 10));
  return Math.max(retryAfter, backoff);
}
