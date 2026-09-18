"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDollarSign, Home, LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { calculateBalances, formatCurrency, simplifyDebts } from "@/lib/calculations";
import { closeRemoteSettlement, loadRemoteHousehold, loadRemoteSettlementRuns } from "@/lib/data-service";
import {
  readLocalExpenses,
  readLocalMembers,
  readLocalSettlementRuns,
  readLocalSession,
  saveLocalExpenses,
  saveLocalSettlementRuns,
  type LocalSession,
} from "@/lib/local-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Expense, Member, SettlementRun } from "@/lib/types";

type SettlementData = {
  session: LocalSession;
  members: Member[];
  expenses: Expense[];
  runs: SettlementRun[];
};

export default function SettlePage() {
  const [data, setData] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [closed, setClosed] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = readLocalSession();
        if (!session) {
          setLoading(false);
          return;
        }

        try {
          if (isSupabaseConfigured()) {
            const [remoteData, runs] = await Promise.all([loadRemoteHousehold(session), loadRemoteSettlementRuns(session)]);
            setData({ session, ...remoteData, runs });
          } else {
            setData({ session, members: readLocalMembers(session), expenses: readLocalExpenses(session), runs: readLocalSettlementRuns(session) });
          }
        } catch (loadFailure) {
          setLoadError(loadFailure instanceof Error ? loadFailure.message : "Açık hesap yüklenemedi.");
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const openExpenses = data?.expenses.filter((expense) => !expense.settlementRunId) ?? [];
  const balances = useMemo(() => {
    if (!data) return [];
    const active = data.members.filter((member) => member.active);
    const open = data.expenses.filter((expense) => !expense.settlementRunId);
    return calculateBalances(active, open);
  }, [data]);
  const transfers = useMemo(() => simplifyDebts(balances), [balances]);
  const memberById = new Map((data?.members ?? []).map((member) => [member.id, member]));

  async function closeCurrentPeriod() {
    if (!data || openExpenses.length === 0) return;
    setClosing(true);
    try {
      if (isSupabaseConfigured()) {
        const remoteData = await closeRemoteSettlement(data.session, openExpenses.map((expense) => expense.id), transfers);
        const runs = await loadRemoteSettlementRuns(data.session);
        setData({ ...data, ...remoteData, runs });
      } else {
        const run: SettlementRun = { id: `settlement-${crypto.randomUUID()}`, householdId: data.session.householdId, createdAt: new Date().toISOString(), expenseIds: openExpenses.map((expense) => expense.id), transfers };
        const expenses = data.expenses.map((expense) => openExpenses.some((openExpense) => openExpense.id === expense.id) ? { ...expense, settlementRunId: run.id } : expense);
        const runs = [run, ...data.runs];
        saveLocalExpenses(data.session, expenses);
        saveLocalSettlementRuns(data.session, runs);
        setData({ ...data, expenses, runs });
      }
      setClosed(true);
    } catch (closeFailure) {
      setLoadError(closeFailure instanceof Error ? closeFailure.message : "Hesap kapatılamadı.");
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <main className="dashboard-shell"><div className="dashboard-loading">Açık hesap hazırlanıyor…</div></main>;

  if (!data) {
    if (loadError) return <main className="dashboard-shell"><div className="empty-dashboard"><span className="empty-dashboard-icon"><Home size={25} /></span><p className="eyebrow">bağlantı hatası</p><h1>Açık hesap yüklenemedi.</h1><p>{loadError}</p><button className="button button-primary" onClick={() => window.location.reload()} type="button">Tekrar dene <ArrowRight size={17} /></button></div></main>;
    return <main className="dashboard-shell"><div className="empty-dashboard"><span className="empty-dashboard-icon"><Home size={25} /></span><p className="eyebrow">henüz bir ev yok</p><h1>Önce kendi evini seç.</h1><p>Borç hesabını görmek için bir ev oluştur veya davet koduyla katıl.</p><Link className="button button-primary" href="/start">Ev hesabına git <ArrowRight size={17} /></Link></div></main>;
  }

  return (
    <main className="settle-shell dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/dashboard"><span className="brand-mark">eh</span><span>ev hesap</span></Link>
        <div className="household-header"><span className="household-avatar"><Home size={15} /></span><div><strong>{data.session.householdName}</strong><small>{data.session.joinCode}</small></div></div>
        <Link className="back-link" href="/dashboard"><ArrowLeft size={15} /> Dashboard</Link>
      </header>

      <section className="settle-main">
        <div className="settle-heading"><div><p className="eyebrow"><CircleDollarSign size={15} /> açık hesap · {openExpenses.length} harcama</p><h1>Borçlar <em>net olsun.</em></h1><p>Son hesap kapatıldıktan sonra eklenen açık harcamaları kullanarak sade bir ödeme listesi çıkarıyoruz.</p></div><div className="settle-rule"><LockKeyhole size={16} /><span>Hesabı kapatınca bu dönem tekrar hesaba girmez.</span></div></div>

        {closed ? (
          <section className="settle-success"><span className="success-icon"><CheckCircle2 size={25} /></span><p className="eyebrow">dönem kapandı</p><h2>Hesap temiz.</h2><p>Bu döneme ait {data.runs[0]?.expenseIds.length ?? 0} harcama settlement geçmişine taşındı. Yeni harcamalar bir sonraki açık dönemde görünecek.</p><Link className="button button-primary" href="/dashboard">Dashboard&apos;a dön <ArrowRight size={17} /></Link></section>
        ) : (
          <>
            <section className="transfer-card">
              <div className="transfer-card-head"><div><p className="eyebrow">önerilen ödemeler</p><h2>Kim kime gönderecek?</h2></div><span className="date-chip">önizleme</span></div>
              {openExpenses.length === 0 ? <div className="settle-empty"><CheckCircle2 size={27} /><h3>Açık harcama yok.</h3><p>Yeni bir harcama eklendiğinde burada sade bir ödeme listesi göreceksin.</p><Link className="text-action" href="/dashboard">Harcama ekle <ArrowRight size={15} /></Link></div> : transfers.length === 0 ? <div className="settle-empty"><CheckCircle2 size={27} /><h3>Herkes dengede.</h3><p>Bu açık dönemde kimsenin birbirine ödeme yapması gerekmiyor.</p></div> : <div className="transfer-list">{transfers.map((transfer) => <div className="transfer-row" key={`${transfer.fromMemberId}-${transfer.toMemberId}`}><div className="transfer-person"><span className="member-avatar">{memberById.get(transfer.fromMemberId)?.name.slice(0, 1).toUpperCase()}</span><strong>{memberById.get(transfer.fromMemberId)?.name}</strong></div><span className="transfer-arrow"><ArrowRight size={17} /></span><div className="transfer-person"><span className="member-avatar member-avatar-to">{memberById.get(transfer.toMemberId)?.name.slice(0, 1).toUpperCase()}</span><strong>{memberById.get(transfer.toMemberId)?.name}</strong></div><b>{formatCurrency(transfer.amountCents)}</b></div>)}</div>}
              {openExpenses.length > 0 && <div className="settle-card-foot"><p>Bu işlem {openExpenses.length} açık harcamayı kapsıyor. Hesabı kapattığında bu harcamalar bir sonraki hesaplamadan çıkarılır.</p><button className="button button-primary" disabled={closing} onClick={() => void closeCurrentPeriod()} type="button">{closing ? "Kapatılıyor…" : "Hesabı kapat"} <CheckCircle2 size={17} /></button></div>}
            </section>

            <section className="settlement-history"><div className="panel-heading"><div><p className="eyebrow">geçmiş dönemler</p><h2>Settlement geçmişi</h2></div></div>{data.runs.length === 0 ? <p className="panel-empty">Henüz kapatılmış bir dönem yok.</p> : data.runs.map((run) => <div className="settlement-history-row" key={run.id}><span><CheckCircle2 size={15} /> {new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(run.createdAt))}</span><b>{run.expenseIds.length} harcama</b><strong>{run.transfers.length} ödeme</strong></div>)}</section>
          </>
        )}
      </section>
    </main>
  );
}
