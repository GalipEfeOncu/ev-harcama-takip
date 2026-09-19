"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  Edit2,
  Home,
  LogOut,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { calculateBalances, formatCurrency, parseAmountToCents } from "@/lib/calculations";
import { createRemoteExpense, deleteRemoteExpense, loadRemoteHousehold, updateRemoteExpense } from "@/lib/data-service";
import {
  readLocalExpenses,
  readLocalMembers,
  readLocalSession,
  saveLocalExpenses,
  type LocalSession,
} from "@/lib/local-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Expense, Member } from "@/lib/types";

type DashboardData = {
  session: LocalSession;
  members: Member[];
  expenses: Expense[];
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`));
}

function splitIntoRows<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

function signedCurrency(amountCents: number) {
  const sign = amountCents > 0 ? "+" : amountCents < 0 ? "−" : "";
  return `${sign}${formatCurrency(Math.abs(amountCents))}`;
}

function balanceState(amountCents: number) {
  return amountCents > 0 ? "alacaklı" : amountCents < 0 ? "borçlu" : "dengede";
}

function MemberTerminal({
  member,
  balanceCents,
  isCurrentMember,
  placement,
}: {
  member: Member;
  balanceCents: number;
  isCurrentMember: boolean;
  placement: "upper" | "lower";
}) {
  const state = balanceState(balanceCents);

  return (
    <div
      className={`balance-terminal balance-terminal--${placement}`}
      role="group"
      aria-label={`${member.name}${isCurrentMember ? ", sen" : ""}: ${signedCurrency(balanceCents)}, ${state}`}
    >
      <span className="balance-terminal__node" aria-hidden="true" />
      <span className="balance-terminal__name">{member.name}</span>
      <strong className="balance-terminal__amount">{signedCurrency(balanceCents)}</strong>
      <span className="balance-terminal__state">{state}</span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isExpenseFormOpen, setExpenseFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Genel");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [copyStatus, setCopyStatus] = useState("");
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = readLocalSession();
        if (!session) {
          setLoading(false);
          return;
        }

        try {
          const remoteData = isSupabaseConfigured()
            ? await loadRemoteHousehold(session)
            : { members: readLocalMembers(session), expenses: readLocalExpenses(session) };
          setPayerId(session.memberId);
          setParticipantIds(remoteData.members.filter((member) => member.active).map((member) => member.id));
          setData({ session, ...remoteData });
        } catch (loadFailure) {
          setLoadError(loadFailure instanceof Error ? loadFailure.message : "Ev verileri yüklenemedi.");
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isExpenseFormOpen) return;
    const dialog = document.querySelector<HTMLElement>(".expense-modal");
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    dialog.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    )?.focus();

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFormError("");
        setExpenseFormOpen(false);
        window.requestAnimationFrame(() => dialogReturnFocusRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeys);
    return () => document.removeEventListener("keydown", handleDialogKeys);
  }, [isExpenseFormOpen]);

  const activeMembers = data?.members.filter((member) => member.active) ?? [];
  const monthExpenses = useMemo(
    () => data?.expenses.filter((expense) => expense.expenseDate.startsWith(currentMonthKey())) ?? [],
    [data],
  );
  const openExpenses = (data?.expenses.filter((expense) => !expense.settlementRunId) ?? [])
    .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const openTotal = openExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const allTimeTotal = (data?.expenses ?? []).reduce((sum, expense) => sum + expense.amountCents, 0);
  const balances = data ? calculateBalances(activeMembers, openExpenses) : [];
  const memberById = new Map((data?.members ?? []).map((member) => [member.id, member]));
  const balanceByMemberId = new Map(balances.map((balance) => [balance.memberId, balance.amountCents]));
  const topMembers = activeMembers.slice(0, 3);
  const lowerMemberRows = splitIntoRows(activeMembers.slice(3), 2);
  const availableYears = [...new Set((data?.expenses ?? []).map((expense) => expense.expenseDate.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const periodExpenses = selectedPeriod === "month"
    ? monthExpenses
    : selectedPeriod === "all"
      ? (data?.expenses ?? [])
      : (data?.expenses ?? []).filter((expense) => expense.expenseDate.startsWith(selectedPeriod));

  function openExpenseForm() {
    dialogReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFormError("");
    setEditingExpenseId(null);
    setAmount("");
    setDescription("");
    setCategory("Genel");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setPayerId(data?.session.memberId ?? "");
    setParticipantIds(activeMembers.map((member) => member.id));
    setExpenseFormOpen(true);
  }

  function openEditExpense(expense: Expense) {
    dialogReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingExpenseId(expense.id);
    setAmount(formatAmountInput(expense.amountCents));
    setDescription(expense.description);
    setCategory(expense.category ?? "Genel");
    setExpenseDate(expense.expenseDate);
    setPayerId(expense.payerId);
    setParticipantIds(expense.participantIds);
    setFormError("");
    setExpenseFormOpen(true);
  }

  function closeExpenseForm() {
    setFormError("");
    setExpenseFormOpen(false);
    window.requestAnimationFrame(() => dialogReturnFocusRef.current?.focus());
  }

  function toggleParticipant(memberId: string) {
    setParticipantIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
  }

  function formatAmountInput(amountCents: number) {
    return (amountCents / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;

    const amountCents = parseAmountToCents(amount);
    if (!amountCents) {
      setFormError("Geçerli bir tutar gir.");
      return;
    }
    if (description.trim().length < 2) {
      setFormError("Harcamaya kısa bir açıklama ekle.");
      return;
    }
    if (!payerId || participantIds.length === 0) {
      setFormError("Ödeyen kişiyi ve en az bir katılımcıyı seç.");
      return;
    }

    setSavingExpense(true);
    try {
      const input = { payerId, amountCents, description: description.trim(), category, expenseDate, participantIds };
      const nextData = isSupabaseConfigured()
        ? editingExpenseId
          ? await updateRemoteExpense(data.session, editingExpenseId, input)
          : await createRemoteExpense(data.session, input)
        : (() => {
            const now = new Date().toISOString();
            const expenses = editingExpenseId
              ? data.expenses.map((expense) => expense.id === editingExpenseId ? { ...expense, ...input, updatedAt: now } : expense)
              : [{ id: createId("expense"), householdId: data.session.householdId, ...input, createdAt: now, updatedAt: now }, ...data.expenses];
            saveLocalExpenses(data.session, expenses);
            return { members: data.members, expenses };
          })();
      setData({ session: data.session, ...nextData });
      setAmount("");
      setDescription("");
      setCategory("Genel");
      setExpenseDate(new Date().toISOString().slice(0, 10));
      closeExpenseForm();
    } catch (saveFailure) {
      setFormError(saveFailure instanceof Error ? saveFailure.message : "Harcama kaydedilemedi.");
    } finally {
      setSavingExpense(false);
    }
  }

  async function leaveHousehold() {
    if (isSupabaseConfigured()) await createClient().auth.signOut();
    window.localStorage.removeItem("ev-hesap-session");
    router.push("/start");
  }

  async function copyJoinCode() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.session.joinCode);
      setCopyStatus("Ev kodu kopyalandı.");
    } catch {
      setCopyStatus("Kod kopyalanamadı. Kodu seçip kopyala.");
    }
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  async function deleteExpense(expense: Expense) {
    if (!data || !window.confirm(`“${expense.description}” harcamasını silmek istediğine emin misin?`)) return;

    try {
      const nextData = isSupabaseConfigured()
        ? await deleteRemoteExpense(data.session, expense.id)
        : (() => {
            const expenses = data.expenses.filter((item) => item.id !== expense.id);
            saveLocalExpenses(data.session, expenses);
            return { members: data.members, expenses };
          })();
      setData({ session: data.session, ...nextData });
    } catch (deleteFailure) {
      setLoadError(deleteFailure instanceof Error ? deleteFailure.message : "Harcama silinemedi.");
    }
  }

  if (loading) {
    return <main className="dashboard-shell"><div className="dashboard-loading" role="status">Ev hesabı hazırlanıyor…</div></main>;
  }

  if (!data) {
    if (loadError) {
      return <main className="dashboard-shell"><div className="empty-dashboard"><span className="empty-dashboard-icon"><Home size={25} /></span><h1>Ev verisi yüklenemedi.</h1><p>{loadError}</p><button className="primary-action" onClick={() => window.location.reload()} type="button">Tekrar dene</button></div></main>;
    }
    return (
      <main className="dashboard-shell">
        <div className="empty-dashboard">
          <span className="empty-dashboard-icon"><Home size={25} /></span>
          <h1>Önce kendi evini seç.</h1>
          <p>Dashboard&apos;a ulaşmak için yeni bir ev oluştur veya davet koduyla katıl.</p>
          <Link className="primary-action" href="/start">Ev hesabına git</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="account-header">
        <Link className="dashboard-wordmark" href="/" aria-label="Ev Hesap ana sayfa">EV HESAP</Link>
        <div className="account-household">
          <span className="account-household__name" title={data.session.householdName}>{data.session.householdName}</span>
          <span className="account-household__divider" aria-hidden="true" />
          <button className="account-household__code" onClick={() => void copyJoinCode()} type="button" aria-label={`Ev kodunu kopyala: ${data.session.joinCode}`} title="Ev kodunu kopyala">
            {data.session.joinCode}<Copy aria-hidden="true" size={13} />
          </button>
        </div>
        <span className="visually-hidden" aria-live="polite">{copyStatus}</span>
      </header>

      <section className="dashboard-main">
        <section className="account-overview" aria-labelledby="account-title">
          <div className="account-heading">
            <h1 id="account-title">Açık hesap</h1>
            <p className="account-period">Açık dönem · {openExpenses.length} harcama</p>
          </div>
          <div className="account-total">
            <span>Açık gider toplamı</span>
            <strong>{formatCurrency(openTotal)}</strong>
          </div>
        </section>

        {loadError && <p className="inline-error" role="alert">{loadError}</p>}

        <section className="balance-network" aria-label="Ev arkadaşlarının net bakiyeleri">
          {activeMembers.length === 0 ? (
            <p className="balance-empty">Henüz aktif üye yok.</p>
          ) : (
            <>
              <div className={`balance-rail-upper balance-rail-upper--${topMembers.length}`}>
                {topMembers.map((member) => (
                  <MemberTerminal
                    key={member.id}
                    member={member}
                    balanceCents={balanceByMemberId.get(member.id) ?? 0}
                    isCurrentMember={member.id === data.session.memberId}
                    placement="upper"
                  />
                ))}
              </div>
              {lowerMemberRows.map((row, index) => (
                <div
                  className={`balance-rail-lower${index > 0 ? " balance-rail-lower--continuation" : ""}${row.length === 1 ? " balance-rail-lower--single" : ""}`}
                  key={row[0].id}
                >
                  {row.map((member) => (
                    <MemberTerminal
                      key={member.id}
                      member={member}
                      balanceCents={balanceByMemberId.get(member.id) ?? 0}
                      isCurrentMember={member.id === data.session.memberId}
                      placement="lower"
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </section>

        <div className="dashboard-actions">
          <button className="primary-action" onClick={openExpenseForm} type="button">Harcama ekle</button>
          <Link className="secondary-action" href="/settle">Borçları hesapla</Link>
        </div>

        <section className="open-ledger" aria-labelledby="open-ledger-title">
          <div className="ledger-heading">
            <h2 id="open-ledger-title">Açık harcamalar</h2>
          </div>
          {openExpenses.length === 0 ? (
            <div className="ledger-empty">
              <ReceiptText aria-hidden="true" size={19} />
              <p>Açık harcama yok. Yeni bir kayıt eklediğinde bakiye burada görünür.</p>
            </div>
          ) : (
            <div className="open-expense-list">
              {openExpenses.slice(0, 3).map((expense) => (
                <button
                  className="open-expense-row"
                  key={expense.id}
                  onClick={() => openEditExpense(expense)}
                  type="button"
                  aria-label={`${expense.description}, ${formatCurrency(expense.amountCents)}. Düzenlemek için aç.`}
                  title="Harcamayı düzenle"
                >
                  <span className="open-expense-primary">
                    <span className="open-expense-title">{expense.description}</span>
                    <strong>{formatCurrency(expense.amountCents)}</strong>
                  </span>
                  <span className="open-expense-meta">
                    <span>{memberById.get(expense.payerId)?.name ?? "Bilinmeyen"} ödedi</span>
                    <span>{expense.participantIds.length} kişi</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="history-section" id="gecmis" aria-labelledby="history-title">
          <div className="history-heading">
            <h2 id="history-title">Harcama geçmişi</h2>
            <span>{data.expenses.length} kayıt · {formatCurrency(allTimeTotal)} toplam</span>
          </div>
          <div className="period-switch" role="tablist" aria-label="Harcama dönemi">
            <button className={selectedPeriod === "month" ? "active" : ""} onClick={() => setSelectedPeriod("month")} role="tab" aria-selected={selectedPeriod === "month"} type="button">Bu ay</button>
            {availableYears.map((year) => <button className={selectedPeriod === year ? "active" : ""} key={year} onClick={() => setSelectedPeriod(year)} role="tab" aria-selected={selectedPeriod === year} type="button">{year}</button>)}
            <button className={selectedPeriod === "all" ? "active" : ""} onClick={() => setSelectedPeriod("all")} role="tab" aria-selected={selectedPeriod === "all"} type="button">Tümü</button>
          </div>
          {data.expenses.length === 0 ? (
            <p className="history-empty">Harcama eklendiğinde geçmiş burada tutulacak.</p>
          ) : periodExpenses.length === 0 ? (
            <p className="history-empty">Bu dönemde kayıtlı harcama yok.</p>
          ) : (
            <div className="history-list">
              {periodExpenses.map((expense) => (
                <div className="history-row" key={expense.id}>
                  <div className="history-details">
                    <strong>{expense.description}</strong>
                    <small>{dateLabel(expense.expenseDate)} · {expense.category} · {memberById.get(expense.payerId)?.name ?? "Bilinmeyen"} ödedi · {expense.participantIds.length} kişi</small>
                  </div>
                  <b>{formatCurrency(expense.amountCents)}</b>
                  <div className="history-actions">
                    <button aria-label={`${expense.description} harcamasını düzenle`} onClick={() => openEditExpense(expense)} type="button"><Edit2 aria-hidden="true" size={15} /></button>
                    <button aria-label={`${expense.description} harcamasını sil`} onClick={() => void deleteExpense(expense)} type="button"><Trash2 aria-hidden="true" size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <button className="dashboard-exit" onClick={() => void leaveHousehold()} type="button">
            <LogOut aria-hidden="true" size={15} />
            <span>Ev hesabından ayrıl</span>
          </button>
        </footer>
      </section>

      {isExpenseFormOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeExpenseForm(); }}><section className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title"><div className="modal-header"><h2 id="expense-modal-title">{editingExpenseId ? "Harcamayı düzenle" : "Harcama ekle"}</h2><button className="icon-button" aria-label="Formu kapat" onClick={closeExpenseForm} type="button"><X aria-hidden="true" size={19} /></button></div><form onSubmit={handleExpenseSubmit}><label className="field-label">Tutar<input inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="850,00" required value={amount} /></label><label className="field-label">Açıklama<input onChange={(event) => setDescription(event.target.value)} placeholder="Örn. Market alışverişi" required value={description} /></label><div className="form-two-col"><label className="field-label">Kategori<select onChange={(event) => setCategory(event.target.value)} value={category}><option>Genel</option><option>Market</option><option>Fatura</option><option>Ev</option><option>Ulaşım</option><option>Dışarıda yemek</option></select></label><label className="field-label">Tarih<input onChange={(event) => setExpenseDate(event.target.value)} required type="date" value={expenseDate} /></label></div><label className="field-label">Kim ödedi?<select onChange={(event) => setPayerId(event.target.value)} value={payerId}>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><fieldset className="participants-field"><legend>Kimler için?</legend>{activeMembers.map((member) => <label className="participant-option" key={member.id}><input checked={participantIds.includes(member.id)} onChange={() => toggleParticipant(member.id)} type="checkbox" /><span>{member.name}</span><small>{participantIds.includes(member.id) ? "dahil" : "hariç"}</small></label>)}</fieldset>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="primary-action form-submit" disabled={savingExpense} type="submit">{savingExpense ? "Kaydediliyor…" : editingExpenseId ? "Değişiklikleri kaydet" : "Harcamayı kaydet"}</button></form></section></div>}
    </main>
  );
}
