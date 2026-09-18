"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CirclePlus,
  Home,
  LogOut,
  ReceiptText,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { calculateBalances, formatCurrency, parseAmountToCents } from "@/lib/calculations";
import {
  readLocalExpenses,
  readLocalMembers,
  readLocalSession,
  saveLocalExpenses,
  type LocalSession,
} from "@/lib/local-store";
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

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpenseFormOpen, setExpenseFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Genel");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const session = readLocalSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const members = readLocalMembers(session);
      const expenses = readLocalExpenses(session);
      setPayerId(session.memberId);
      setParticipantIds(members.filter((member) => member.active).map((member) => member.id));
      setData({ session, members, expenses });
      setLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const activeMembers = data?.members.filter((member) => member.active) ?? [];
  const monthExpenses = useMemo(
    () => data?.expenses.filter((expense) => expense.expenseDate.startsWith(currentMonthKey())) ?? [],
    [data],
  );
  const openExpenses = data?.expenses.filter((expense) => !expense.settlementRunId) ?? [];
  const monthTotal = monthExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const allTimeTotal = (data?.expenses ?? []).reduce((sum, expense) => sum + expense.amountCents, 0);
  const balances = data ? calculateBalances(activeMembers, openExpenses) : [];
  const memberById = new Map((data?.members ?? []).map((member) => [member.id, member]));
  const recentExpenses = [...(data?.expenses ?? [])].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)).slice(0, 6);
  const netBalance = balances.find((balance) => balance.memberId === data?.session.memberId)?.amountCents ?? 0;

  function openExpenseForm() {
    setFormError("");
    setExpenseFormOpen(true);
  }

  function closeExpenseForm() {
    setFormError("");
    setExpenseFormOpen(false);
  }

  function toggleParticipant(memberId: string) {
    setParticipantIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
  }

  function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
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

    const now = new Date().toISOString();
    const expense: Expense = {
      id: createId("expense"),
      householdId: data.session.householdId,
      payerId,
      amountCents,
      description: description.trim(),
      category,
      expenseDate,
      participantIds,
      createdAt: now,
      updatedAt: now,
    };
    const expenses = [expense, ...data.expenses];
    saveLocalExpenses(data.session, expenses);
    setData({ ...data, expenses });
    setAmount("");
    setDescription("");
    setCategory("Genel");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    closeExpenseForm();
  }

  function leaveHousehold() {
    window.localStorage.removeItem("ev-hesap-session");
    router.push("/start");
  }

  if (loading) {
    return <main className="dashboard-shell"><div className="dashboard-loading">Ev hesabı hazırlanıyor…</div></main>;
  }

  if (!data) {
    return (
      <main className="dashboard-shell">
        <div className="empty-dashboard">
          <span className="empty-dashboard-icon"><Home size={25} /></span>
          <p className="eyebrow">henüz bir ev yok</p>
          <h1>Önce kendi evini seç.</h1>
          <p>Dashboard&apos;a ulaşmak için yeni bir ev oluştur veya davet koduyla katıl.</p>
          <Link className="button button-primary" href="/start">Ev hesabına git <ArrowRight size={17} /></Link>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/">
          <span className="brand-mark">eh</span>
          <span>ev hesap</span>
        </Link>
        <div className="household-header">
          <span className="household-avatar"><Home size={15} /></span>
          <div><strong>{data.session.householdName}</strong><small>{data.session.joinCode}</small></div>
          <ChevronDown size={15} />
        </div>
        <div className="dashboard-user">
          <span>{data.session.memberName.slice(0, 1).toUpperCase()}</span>
          <button aria-label="Hesaptan çık" onClick={leaveHousehold} type="button"><LogOut size={15} /></button>
        </div>
      </header>

      <section className="dashboard-main">
        <div className="dashboard-welcome">
          <div>
            <p className="eyebrow"><CalendarDays size={15} /> {new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date())}</p>
            <h1>Günün hesabı, <em>yerli yerinde.</em></h1>
            <p>Merhaba {data.session.memberName}. Ortak evin bugün nasıl gidiyor?</p>
          </div>
          <div className="dashboard-actions"><Link className="button button-quiet" href="/settle">Borçları hesapla <ArrowRight size={17} /></Link><button className="button button-primary" onClick={openExpenseForm} type="button"><CirclePlus size={18} /> Harcama ekle</button></div>
        </div>

        <div className="stats-grid">
          <article className="stat-card stat-card-main"><p>Bu ay</p><strong>{formatCurrency(monthTotal)}</strong><span>{monthExpenses.length} ortak harcama</span></article>
          <article className="stat-card"><p>Tüm zamanlar</p><strong>{formatCurrency(allTimeTotal)}</strong><span>{data.expenses.length} kayıt</span></article>
          <article className="stat-card stat-card-balance"><p>Senin net durumun</p><strong className={netBalance >= 0 ? "positive" : "negative"}>{netBalance >= 0 ? "+" : "−"}{formatCurrency(Math.abs(netBalance))}</strong><span>{netBalance >= 0 ? "alacaklı" : "borçlu"}</span></article>
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-panel balance-panel">
            <div className="panel-heading"><div><p className="eyebrow">ev arkadaşların</p><h2>Bu ay kim nerede?</h2></div><button className="icon-button" aria-label="Üye ayarları" type="button"><Settings2 size={17} /></button></div>
            {activeMembers.length === 0 ? <p className="panel-empty">Henüz aktif üye yok.</p> : activeMembers.map((member) => {
              const balance = balances.find((item) => item.memberId === member.id)?.amountCents ?? 0;
              const paid = monthExpenses.filter((expense) => expense.payerId === member.id).reduce((sum, expense) => sum + expense.amountCents, 0);
              return <div className="member-balance" key={member.id}><span className="member-avatar">{member.name.slice(0, 1).toUpperCase()}</span><div className="member-details"><strong>{member.name}{member.id === data.session.memberId ? " (sen)" : ""}</strong><small>{formatCurrency(paid)} ödedi</small></div><div className={`member-net ${balance >= 0 ? "positive" : "negative"}`}><strong>{balance >= 0 ? "+" : "−"}{formatCurrency(Math.abs(balance))}</strong><small>{balance >= 0 ? "alacaklı" : "borçlu"}</small></div></div>;
            })}
            <div className="share-house"><Users size={16} /><span>Ev kodunu paylaşarak arkadaşlarını davet et.</span><button type="button" onClick={() => navigator.clipboard.writeText(data.session.joinCode)}>Kodu kopyala</button></div>
          </section>

          <section className="dashboard-panel recent-panel">
            <div className="panel-heading"><div><p className="eyebrow">son kayıtlar</p><h2>Harcama geçmişi</h2></div><Link className="text-action" href="#gecmis">Tümünü gör <ArrowRight size={15} /></Link></div>
            {recentExpenses.length === 0 ? <div className="panel-empty expense-empty"><ReceiptText size={25} /><p>İlk ortak harcamanızı ekleyin.</p><button className="text-action" onClick={openExpenseForm} type="button">Harcama ekle <ArrowRight size={15} /></button></div> : recentExpenses.map((expense) => <div className="expense-list-row" key={expense.id}><span className="expense-list-icon"><ReceiptText size={16} /></span><div><strong>{expense.description}</strong><small>{dateLabel(expense.expenseDate)} · {memberById.get(expense.payerId)?.name ?? "Bilinmeyen"} ödedi</small></div><b>{formatCurrency(expense.amountCents)}</b></div>)}
          </section>
        </div>

        <section className="dashboard-panel history-panel" id="gecmis">
          <div className="panel-heading"><div><p className="eyebrow">kalıcı geçmiş</p><h2>Tüm harcamalar</h2></div><span className="date-chip">{data.expenses.length} kayıt</span></div>
          {data.expenses.length === 0 ? <p className="panel-empty">Harcama eklendiğinde geçmiş burada tutulacak.</p> : <div className="history-table">{data.expenses.map((expense) => <div className="history-row" key={expense.id}><span>{dateLabel(expense.expenseDate)}</span><div><strong>{expense.description}</strong><small>{expense.category} · {expense.participantIds.length} kişi</small></div><span>{memberById.get(expense.payerId)?.name}</span><b>{formatCurrency(expense.amountCents)}</b></div>)}</div>}
        </section>
      </section>

      {isExpenseFormOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeExpenseForm(); }}><section className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title"><div className="modal-header"><div><p className="eyebrow">yeni kayıt</p><h2 id="expense-modal-title">Harcama ekle</h2></div><button className="icon-button" aria-label="Formu kapat" onClick={closeExpenseForm} type="button"><X size={19} /></button></div><form onSubmit={handleExpenseSubmit}><label className="field-label">Tutar<input inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="850,00" value={amount} /></label><label className="field-label">Açıklama<input onChange={(event) => setDescription(event.target.value)} placeholder="Örn. Market alışverişi" value={description} /></label><div className="form-two-col"><label className="field-label">Kategori<select onChange={(event) => setCategory(event.target.value)} value={category}><option>Genel</option><option>Market</option><option>Fatura</option><option>Ev</option><option>Ulaşım</option><option>Dışarıda yemek</option></select></label><label className="field-label">Tarih<input onChange={(event) => setExpenseDate(event.target.value)} type="date" value={expenseDate} /></label></div><label className="field-label">Kim ödedi?<select onChange={(event) => setPayerId(event.target.value)} value={payerId}>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><fieldset className="participants-field"><legend>Kimler için?</legend>{activeMembers.map((member) => <label className="participant-option" key={member.id}><input checked={participantIds.includes(member.id)} onChange={() => toggleParticipant(member.id)} type="checkbox" /><span>{member.name}</span><small>{participantIds.includes(member.id) ? "dahil" : "hariç"}</small></label>)}</fieldset>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="button button-primary form-submit" type="submit">Harcamayı kaydet <ArrowRight size={17} /></button></form></section></div>}
    </main>
  );
}
