import { formatCurrency } from "./calculations";

export type ExpenseDetails = { creator: string; amount: number; description: string; category: string; payer: string | null; participants?: string[] };

export function expenseMessage(expense: ExpenseDetails) {
  const lines = [
    expense.creator + " bir harcama ekledi.",
    expense.description + " · " + formatCurrency(expense.amount),
    "Kategori: " + expense.category.slice(0, 120),
  ];
  if (expense.payer) lines.push("Ödeyen: " + expense.payer);
  const names = expense.participants ?? [];
  if (names.length) {
    let list = "Paya dahil olanlar: ";
    for (const [index, name] of names.entries()) {
      if (list.length + name.length > 3100) {
        list += "… (+" + (names.length - index) + " kişi)";
        break;
      }
      list += (index ? ", " : "") + name;
    }
    lines.push(list);
  }
  return lines.join("\n");
}

export function retryDelay(attempt: number, status?: number, retryAfter = 0) {
  const needsRepair = status === 400 || status === 403;
  const backoff = needsRepair ? 3600 : Math.min(3600, 5 * 2 ** Math.min(attempt - 1, 10));
  return Math.max(retryAfter, backoff);
}
