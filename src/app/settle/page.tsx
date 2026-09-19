"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Home, LockKeyhole } from "lucide-react";
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
  const [closeArmed, setCloseArmed] = useState(false);
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
        const remoteData = await closeRemoteSettlement(data.session, openExpenses.map((expense) => expense.id));
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
      setCloseArmed(false);
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <main className="dashboard-shell"><div className="dashboard-loading">Açık hesap hazırlanıyor…</div></main>;

  if (!data) {
    if (loadError) return <main className="dashboard-shell"><div className="empty-dashboard"><span className="empty-dashboard-icon"><Home size={25} /></span><h1>Açık hesap yüklenemedi.</h1><p>{loadError}</p><button className="primary-action" onClick={() => window.location.reload()} type="button">Tekrar dene <ArrowRight size={17} /></button></div></main>;
    return <main className="dashboard-shell"><div className="empty-dashboard"><span className="empty-dashboard-icon"><Home size={25} /></span><h1>Önce kendi evini seç.</h1><p>Borç hesabını görmek için bir ev oluştur veya davet koduyla katıl.</p><Link className="primary-action" href="/start">Ev hesabına git <ArrowRight size={17} /></Link></div></main>;
  }

  return (
    <main className="settle-shell dashboard-shell">
      <header className="account-header">
        <Link className="dashboard-wordmark" href="/" aria-label="Ev Hesap ana sayfa">EV HESAP</Link>
        <div className="account-household">
          <span className="account-household__name" title={data.session.householdName}>{data.session.householdName}</span>
          <span className="account-household__divider" aria-hidden="true" />
          <span className="account-household__code">{data.session.joinCode}</span>
        </div>
        <Link className="header-back" href="/dashboard"><ArrowLeft aria-hidden="true" size={16} /> Pano</Link>
      </header>

      <section className="settle-main" aria-labelledby="settle-title">
        <div className="settle-heading">
          <div>
            <h1 id="settle-title">Ödeme listesi</h1>
            <p>Açık giderlerin bakiyesinden çıkan öneriyi incele. Dönemi kapatma kararını ev arkadaşlarınla birlikte ver.</p>
          </div>
          <p className="settle-rule"><LockKeyhole aria-hidden="true" size={17} /> Kapatınca bu harcamalar açık bakiyeden çıkar ve geçmişe eklenir.</p>
        </div>

        {loadError && <p className="inline-error" role="alert">{loadError}</p>}

        {closed ? (
          <section className="settle-success" aria-labelledby="settle-success-title" aria-live="polite">
            <span className="success-icon"><CheckCircle2 aria-hidden="true" size={25} /></span>
            <h2 id="settle-success-title">Dönem kapandı.</h2>
            <p>{data.runs[0]?.expenseIds.length ?? 0} harcama hesap geçmişine taşındı. Bundan sonra eklenen harcamalar açık hesapta görünür.</p>
            <Link className="primary-action" href="/dashboard">Panoya dön <ArrowRight aria-hidden="true" size={17} /></Link>
          </section>
        ) : (
          <>
            <section className="transfer-card" aria-labelledby="transfer-title">
              <div className="transfer-card-head">
                <div><h2 id="transfer-title">Kim kime ne kadar ödeyecek?</h2><p>{openExpenses.length} açık harcama · ödeme önizlemesi</p></div>
                <span className="transfer-count">{transfers.length} öneri</span>
              </div>
              {openExpenses.length === 0 ? (
                <div className="settle-empty">
                  <CheckCircle2 aria-hidden="true" size={24} />
                  <h3>Açık harcama yok.</h3>
                  <p>Yeni gider eklendiğinde onun bakiyesi burada görünür.</p>
                  <Link className="text-action" href="/dashboard">Panoda harcama ekle <ArrowRight aria-hidden="true" size={15} /></Link>
                </div>
              ) : transfers.length === 0 ? (
                <div className="settle-empty">
                  <CheckCircle2 aria-hidden="true" size={24} />
                  <h3>Herkes dengede.</h3>
                  <p>Bu açık giderlerde kimsenin birbirine ödeme yapması gerekmiyor.</p>
                </div>
              ) : (
                <div className="transfer-list">
                  {transfers.map((transfer) => (
                    <div className="transfer-row" key={`${transfer.fromMemberId}-${transfer.toMemberId}`}>
                      <div className="transfer-person"><span>{memberById.get(transfer.fromMemberId)?.name}</span><small>ödeyecek</small></div>
                      <span className="transfer-arrow" aria-hidden="true"><ArrowRight size={17} /></span>
                      <div className="transfer-person transfer-person--receiver"><span>{memberById.get(transfer.toMemberId)?.name}</span><small>alacak</small></div>
                      <b>{formatCurrency(transfer.amountCents)}</b>
                    </div>
                  ))}
                </div>
              )}

              {openExpenses.length > 0 && (
                <div className="settle-card-foot">
                  <p>Ödeme listesini gözden geçirdikten sonra dönemi kapat. Bu işlem para transferi yapmaz.</p>
                  {!closeArmed ? (
                    <button className="primary-action" disabled={closing} onClick={() => setCloseArmed(true)} type="button">Dönemi kapat <CheckCircle2 aria-hidden="true" size={17} /></button>
                  ) : (
                    <div className="settle-confirm" role="group" aria-label="Dönemi kapatma onayı">
                      <p>{openExpenses.length} açık harcama hesap geçmişine taşınacak.</p>
                      <div>
                        <button className="primary-action" disabled={closing} onClick={() => void closeCurrentPeriod()} type="button">{closing ? "Kapatılıyor…" : "Evet, dönemi kapat"}</button>
                        <button className="secondary-action" disabled={closing} onClick={() => setCloseArmed(false)} type="button">Geri dön</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="settlement-history" aria-labelledby="history-title">
              <div className="history-heading"><h2 id="history-title">Hesap geçmişi</h2><span>{data.runs.length} kapanış</span></div>
              {data.runs.length === 0 ? (
                <p className="history-empty">Kapatılan dönemler burada listelenir.</p>
              ) : (
                data.runs.map((run) => (
                  <div className="settlement-history-row" key={run.id}>
                    <span><CheckCircle2 aria-hidden="true" size={15} /> {new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(run.createdAt))}</span>
                    <b>{run.expenseIds.length} harcama</b>
                    <strong>{run.transfers.length} ödeme</strong>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
