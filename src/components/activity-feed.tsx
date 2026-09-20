"use client";

import { ArrowRightLeft, Check, Edit2, History, ReceiptText, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency, splitAmount } from "@/lib/calculations";
import type { DebtPayment, Expense } from "@/lib/types";

type ActivityFilter = "open" | "month" | "all" | string;

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`));
}

function sharesForExpense(expense: Expense) {
  return expense.participantShares
    ?? [...splitAmount(expense.amountCents, expense.participantIds)].map(([memberId, amountCents]) => ({ memberId, amountCents }));
}

export default function ActivityFeed({
  expenses,
  payments,
  memberNames,
  canEdit,
  onEditExpense,
  onDeleteExpense,
}: {
  expenses: Expense[];
  payments: DebtPayment[];
  memberNames: Record<string, string>;
  canEdit: boolean;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("open");
  const availableYears = useMemo(() => [...new Set([
    ...expenses.map((expense) => expense.expenseDate.slice(0, 4)),
    ...payments.map((payment) => payment.paidAt.slice(0, 4)),
  ])].sort((a, b) => b.localeCompare(a)), [expenses, payments]);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const expenseItems = expenses
    .filter((expense) => filter === "all"
      || (filter === "open" ? !expense.settlementRunId : filter === "month"
        ? expense.expenseDate.startsWith(monthKey)
        : expense.expenseDate.startsWith(filter)))
    .map((expense) => ({ kind: "expense" as const, date: expense.expenseDate, createdAt: expense.createdAt, expense }));
  const paymentItems = payments
    .filter((payment) => filter === "all"
      || (filter === "open" ? !payment.settlementRunId : filter === "month"
        ? payment.paidAt.startsWith(monthKey)
        : payment.paidAt.startsWith(filter)))
    .map((payment) => ({ kind: "payment" as const, date: payment.paidAt, createdAt: payment.createdAt, payment }));
  const items = [...expenseItems, ...paymentItems].sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );

  const emptyText = filter === "open"
    ? "Açık hareket yok. Yeni bir gider veya ödeme eklendiğinde burada görünür."
    : filter === "month"
      ? "Bu ay henüz hareket yok. Yeni bir kayıt eklediğinde burada görünür."
      : "Bu dönemde kayıtlı hareket yok.";
  const showStatus = filter !== "open";

  return (
    <section className="activity-section" aria-labelledby="activity-title">
      <header className="activity-heading">
        <div>
        <h2 id="activity-title" tabIndex={-1}>Hareketler</h2>
          <p>Harcamalar ve yapılan ödemeler aynı ev hesabında.</p>
        </div>
        <span className="activity-count">{items.length} hareket</span>
      </header>

      <div className="activity-filters" role="group" aria-label="Hareketleri filtrele">
        {([
          ["open", "Açık"],
          ["month", "Bu ay"],
          ["all", "Tümü"],
        ] as const).map(([value, label]) => (
          <button
            aria-pressed={filter === value}
            className={filter === value ? "is-selected" : ""}
            key={value}
            onClick={() => setFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
        {availableYears.length > 0 && (
          <label className="activity-year-filter">
            <span className="visually-hidden">Yıla göre filtrele</span>
            <select aria-label="Yıla göre filtrele" onChange={(event) => setFilter(event.target.value || "month")} value={availableYears.includes(filter) ? filter : ""}>
              <option value="">Yıl seç</option>
              {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        )}
      </div>

      {items.length === 0 ? (
        <div className="activity-empty">
          <ReceiptText aria-hidden="true" size={21} />
          <p>{emptyText}</p>
        </div>
      ) : (
        <ul className="activity-list">
          {items.map((item) => item.kind === "expense" ? (
            <li className="activity-item" key={`expense-${item.expense.id}`}>
              <article>
                <div className="activity-item-main">
                  <span className="activity-kind"><ReceiptText aria-hidden="true" size={15} /> Harcama</span>
                  {showStatus && (
                    <span className={`activity-status ${item.expense.settlementRunId ? "is-settled" : "is-open"}`}>
                      {item.expense.settlementRunId ? <><History aria-hidden="true" size={14} /> Geçmişte</> : <><Check aria-hidden="true" size={14} /> Açık</>}
                    </span>
                  )}
                  <h3>{item.expense.description}</h3>
                  <p className="activity-meta">
                    {dateLabel(item.expense.expenseDate)} · {item.expense.category || "Genel"} · {memberNames[item.expense.payerId] ?? "Bilinmeyen"} ödedi · {item.expense.participantIds.length} kişi paylaştı
                  </p>
                  {item.expense.participantShares && (
                    <details className="activity-shares">
                      <summary>Pay dağılımını gör</summary>
                      <ul>
                        {sharesForExpense(item.expense).map((share) => (
                          <li key={share.memberId}>
                            <span>{memberNames[share.memberId] ?? "Bilinmeyen"}</span>
                            <strong>{formatCurrency(share.amountCents)}</strong>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                <strong className="activity-amount">{formatCurrency(item.expense.amountCents)}</strong>
                {canEdit && (
                  <div className="activity-actions" aria-label={`${item.expense.description} harcama işlemleri`}>
                    <button className="activity-action-edit" aria-label={`${item.expense.description} harcamasını düzenle`} onClick={() => onEditExpense(item.expense)} type="button"><Edit2 aria-hidden="true" size={17} /><span>Düzenle</span></button>
                    <button className="activity-action-delete" aria-label={`${item.expense.description} harcamasını sil`} onClick={() => onDeleteExpense(item.expense)} type="button"><Trash2 aria-hidden="true" size={17} /><span>Sil</span></button>
                  </div>
                )}
              </article>
            </li>
          ) : (
            <li className="activity-item" key={`payment-${item.payment.id}`}>
              <article>
                <div className="activity-item-main">
                  <span className="activity-kind"><ArrowRightLeft aria-hidden="true" size={15} /> Yapılan ödeme</span>
                  {showStatus && (
                    <span className={`activity-status ${item.payment.settlementRunId ? "is-settled" : "is-open"}`}>
                      {item.payment.settlementRunId ? <><History aria-hidden="true" size={14} /> Geçmişte</> : <><Check aria-hidden="true" size={14} /> Açık</>}
                    </span>
                  )}
                  <h3>{memberNames[item.payment.fromMemberId] ?? "Bilinmeyen"} ödedi <span>· {memberNames[item.payment.toMemberId] ?? "Bilinmeyen"} aldı</span></h3>
                  <p className="activity-meta">{dateLabel(item.payment.paidAt)} · {item.payment.note || "Yapılan ödeme"}</p>
                </div>
                <strong className="activity-amount">{formatCurrency(item.payment.amountCents)}</strong>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
