"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Home, LockKeyhole, MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculateBalances, formatCurrency, simplifyDebts } from "@/lib/calculations";
import { closeRemoteSettlement, loadRemoteHousehold, loadRemoteHouseholdSession, loadRemoteSettlementRuns } from "@/lib/data-service";
import {
  readLocalExpenses,
  readLocalDebtPayments,
  readLocalMembers,
  readLocalSettlementRuns,
  readLocalSession,
  saveLocalSession,
  saveLocalExpenses,
  saveLocalDebtPayments,
  saveLocalSettlementRuns,
  type LocalSession,
} from "@/lib/local-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { DebtPayment, Expense, Member, SettlementRun } from "@/lib/types";
import ThemeControl from "@/components/theme-control";
import "./settle.css";

type SettlementData = {
  session: LocalSession;
  account: { isAnonymous: boolean; hasGoogleIdentity: boolean; email: string | null };
  members: Member[];
  expenses: Expense[];
  debtPayments: DebtPayment[];
  runs: SettlementRun[];
};

export default function SettlePage() {
  const [data, setData] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [closed, setClosed] = useState(false);
  const [closeArmed, setCloseArmed] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [closing, setClosing] = useState(false);
  const openConfirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasCloseArmedRef = useRef(false);

  useEffect(() => {
    if (closeArmed) confirmButtonRef.current?.focus();
    else if (wasCloseArmedRef.current) openConfirmButtonRef.current?.focus();
    wasCloseArmedRef.current = closeArmed;
  }, [closeArmed]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const storedSession = readLocalSession();
          if (isSupabaseConfigured()) {
            const requestedHousehold = new URLSearchParams(window.location.search).get("household");
            const resolved = await loadRemoteHouseholdSession(requestedHousehold || storedSession?.householdId, storedSession);
            saveLocalSession(resolved.session);
            const [remoteData, runs] = await Promise.all([loadRemoteHousehold(resolved.session), loadRemoteSettlementRuns(resolved.session)]);
            setData({ session: resolved.session, account: resolved.account, ...remoteData, runs });
          } else if (storedSession) {
            setData({ session: storedSession, account: { isAnonymous: false, hasGoogleIdentity: false, email: null }, members: readLocalMembers(storedSession), expenses: readLocalExpenses(storedSession), debtPayments: readLocalDebtPayments(storedSession), runs: readLocalSettlementRuns(storedSession) });
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
  const openPayments = data?.debtPayments.filter((payment) => !payment.settlementRunId) ?? [];
  const balances = useMemo(() => {
    if (!data) return [];
    const active = data.members.filter((member) => member.active);
    const open = data.expenses.filter((expense) => !expense.settlementRunId);
    const payments = data.debtPayments.filter((payment) => !payment.settlementRunId);
    return calculateBalances(active, open, payments);
  }, [data]);
  const transfers = useMemo(() => simplifyDebts(balances), [balances]);
  const memberById = new Map((data?.members ?? []).map((member) => [member.id, member]));
  const canWrite = Boolean(data && (!isSupabaseConfigured() || data.account.hasGoogleIdentity));
  const hasOpenItems = openExpenses.length > 0 || openPayments.length > 0;

  async function closeCurrentPeriod() {
    if (!data || !canWrite || !hasOpenItems) return;
    setClosing(true);
    try {
      if (isSupabaseConfigured()) {
        const remoteData = await closeRemoteSettlement(data.session, openExpenses.map((expense) => expense.id));
        const runs = await loadRemoteSettlementRuns(data.session);
        setData({ ...data, ...remoteData, runs });
      } else {
        const run: SettlementRun = { id: `settlement-${crypto.randomUUID()}`, householdId: data.session.householdId, createdAt: new Date().toISOString(), expenseIds: openExpenses.map((expense) => expense.id), paymentIds: openPayments.map((payment) => payment.id), transfers };
        const expenses = data.expenses.map((expense) => openExpenses.some((openExpense) => openExpense.id === expense.id) ? { ...expense, settlementRunId: run.id } : expense);
        const debtPayments = data.debtPayments.map((payment) => openPayments.some((openPayment) => openPayment.id === payment.id) ? { ...payment, settlementRunId: run.id } : payment);
        const runs = [run, ...data.runs];
        saveLocalExpenses(data.session, expenses);
        saveLocalDebtPayments(data.session, debtPayments);
        saveLocalSettlementRuns(data.session, runs);
        setData({ ...data, expenses, debtPayments, runs });
      }
      setClosed(true);
    } catch (closeFailure) {
      setLoadError(closeFailure instanceof Error ? closeFailure.message : "Hesap kapatılamadı.");
      setCloseArmed(false);
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <main className="dashboard-shell"><div className="dashboard-loading">Ev hesabı yükleniyor…</div></main>;

  if (!data) {
    if (loadError) {
      const message = loadError === "Auth session missing!"
        ? "Bu cihazda açık bir oturum bulunamadı. Google hesabınla giriş yapıp üyesi olduğun eve dönebilirsin."
        : loadError;
      return <main className="dashboard-shell"><div className="empty-dashboard"><span className="empty-dashboard-icon"><Home size={25} /></span><h1>Açık hesap yüklenemedi.</h1><p>{message}</p><p className="recovery-hint">Bağlantını kontrol edip yeniden deneyebilirsin.</p><Link className="primary-action" href="/start">Google ile devam et <ArrowRight size={17} /></Link><button className="secondary-action" onClick={() => window.location.reload()} type="button">Tekrar dene</button></div></main>;
    }
    return <main className="dashboard-shell"><div className="empty-dashboard"><span className="empty-dashboard-icon"><Home size={25} /></span><h1>Önce evini aç.</h1><p>Google hesabınla giriş yapınca üyesi olduğun evin açık hesabı görünür.</p><Link className="primary-action" href="/start">Google ile devam et <ArrowRight size={17} /></Link></div></main>;
  }

  return (
    <main className="settle-shell dashboard-shell">
      <header className="account-header">
        <Link className="dashboard-wordmark" href="/" aria-label="Ev Hesap ana sayfa">Ev Hesap</Link>
        <div className="account-household">
          <span className="account-household__name" title={data.session.householdName}>{data.session.householdName}</span>
          <span className="account-member-count">{data.members.filter((member) => member.active).length} kişi</span>
        </div>
        <div className="settle-header-tools">
          <div className="desktop-theme-control"><ThemeControl /></div>
          <details className="account-menu settle-theme-menu">
            <summary aria-label="Görünüm seçenekleri"><MoreHorizontal aria-hidden="true" size={21} /></summary>
            <div className="account-menu-popover">
              <div className="account-menu-theme"><span>Görünüm teması</span><ThemeControl full /></div>
            </div>
          </details>
          <Link className="header-back" href="/dashboard" aria-label="Ev hesabına dön"><ArrowLeft aria-hidden="true" size={16} /> Ev hesabı</Link>
        </div>
      </header>

      {isSupabaseConfigured() && !data.account.hasGoogleIdentity && (
        <aside className="account-upgrade">
          <p>{data.account.isAnonymous ? "Bu ev anonim oturumda açık." : "Bu hesap Google kimliğine bağlı değil."} Dönemi kapatmak için Google hesabını bağla.</p>
          <Link className="secondary-action google-action" href="/start?mode=create">Google hesabını bağla</Link>
        </aside>
      )}

      <section className="settle-main" aria-labelledby="settle-title">
        <div className="settle-heading">
          <div>
            <h1 id="settle-title">Hesabı birlikte gözden geçirin</h1>
            <p>Açık gider ve ödemelerden çıkan öneriye bakın. Dönemi ne zaman kapatacağınıza ev arkadaşlarınızla birlikte karar verin.</p>
          </div>
          <p className="settle-rule"><LockKeyhole aria-hidden="true" size={17} /> Kapatınca açık giderler ve ödemeler geçmişe eklenir. Para gönderilmez.</p>
        </div>

        {loadError && <p className="inline-error" role="alert">{loadError}</p>}

        {closed ? (
          <section className="settle-success" aria-labelledby="settle-success-title" aria-live="polite">
            <span className="success-icon"><CheckCircle2 aria-hidden="true" size={25} /></span>
            <h2 id="settle-success-title">Dönem kapandı.</h2>
            <p>{data.runs[0]?.expenseIds.length ?? 0} gider ve {data.runs[0]?.paymentIds?.length ?? 0} ödeme bu evin hesap geçmişine taşındı. Yeni giderler açık hesapta görünür.</p>
            <p className="settle-success-reassurance">Bu işlem para göndermez; yalnızca kayıtları geçmişe taşır.</p>
            <Link className="primary-action" href="/dashboard">Ev hesabına dön <ArrowRight aria-hidden="true" size={17} /></Link>
          </section>
        ) : (
          <>
            <section className="transfer-card" aria-labelledby="transfer-title">
              <div className="transfer-card-head">
                <div><h2 id="transfer-title">Kim kime ödeyecek?</h2><p>{openExpenses.length} açık gider · {openPayments.length} yapılan ödeme · güncel bakiye</p></div>
                <span className="transfer-count">{transfers.length} öneri</span>
              </div>
              {!hasOpenItems ? (
                <div className="settle-empty">
                  <CheckCircle2 aria-hidden="true" size={24} />
                  <h3>Açık hesap yok.</h3>
                  <p>Yeni bir gider veya ödeme kaydedildiğinde öneri burada görünür.</p>
                  <Link className="text-action" href="/dashboard">Ev hesabına dön <ArrowRight aria-hidden="true" size={15} /></Link>
                </div>
              ) : transfers.length === 0 ? (
                <div className="settle-empty">
                  <CheckCircle2 aria-hidden="true" size={24} />
                  <h3>Herkes dengede.</h3>
                  <p>Şu anki açık gider ve ödemelere göre kimsenin birbirine ödeme yapması gerekmiyor.</p>
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

              {hasOpenItems && (
                <div className="settle-card-foot">
                  <p>Bu işlem {openExpenses.length} gider ve {openPayments.length} yapılan ödemeyi geçmişe taşır; para göndermez.</p>
                  {!canWrite ? (
                    <Link className="primary-action" href="/start?mode=create">Google hesabını bağla <ArrowRight aria-hidden="true" size={17} /></Link>
                  ) : !closeArmed ? (
                    <button className="primary-action" disabled={closing} onClick={() => setCloseArmed(true)} ref={openConfirmButtonRef} type="button">Dönemi kapat <CheckCircle2 aria-hidden="true" size={17} /></button>
                  ) : (
                    <div className="settle-confirm" role="group" aria-label="Dönemi kapatma onayı">
                      <p>{openExpenses.length} gider ve {openPayments.length} ödeme geçmişe taşınacak. Para transferi yapılmayacak.</p>
                      <div>
                        <button className="primary-action" disabled={closing} onClick={() => void closeCurrentPeriod()} ref={confirmButtonRef} type="button">{closing ? "Kayıtlar taşınıyor…" : "Evet, dönemi kapat"}</button>
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
                    <b>{run.expenseIds.length} harcama · {run.paymentIds?.length ?? 0} yapılan ödeme</b>
                    <strong>{run.transfers.length} önerilen ödeme</strong>
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
