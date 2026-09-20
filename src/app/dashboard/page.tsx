"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Copy,
  Home,
  LogOut,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import GoogleMark from "@/components/google-mark";
import ThemeControl from "@/components/theme-control";
import ActivityFeed from "@/components/activity-feed";
import MemberBalances from "@/components/member-balances";
import { beginGoogleSignIn } from "@/lib/auth";
import { calculateBalances, formatCurrency, parseAmountToCents, splitAmount } from "@/lib/calculations";
import { createRemoteDebtPayment, createRemoteExpense, deleteRemoteExpense, loadRemoteHousehold, loadRemoteHouseholdSession, loadRemoteSettlementRuns, rotateRemoteHouseholdJoinCode, updateRemoteExpense } from "@/lib/data-service";
import {
  readLocalExpenses,
  readLocalDebtPayments,
  readLocalMembers,
  readLocalSettlementRuns,
  readLocalSession,
  saveLocalSession,
  saveLocalExpenses,
  saveLocalDebtPayments,
  type LocalSession,
} from "@/lib/local-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { DebtPayment, Expense, ExpenseShare, Member, SettlementRun } from "@/lib/types";
import "./dashboard.css";

type DashboardData = {
  session: LocalSession;
  account: { isAnonymous: boolean; hasGoogleIdentity: boolean; email: string | null };
  members: Member[];
  expenses: Expense[];
  debtPayments: DebtPayment[];
  runs: SettlementRun[];
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function balanceState(amountCents: number) {
  return amountCents > 0 ? "alacaklı" : amountCents < 0 ? "borçlu" : "dengede";
}

function signedCurrency(amountCents: number) {
  const sign = amountCents > 0 ? "+" : amountCents < 0 ? "−" : "";
  return `${sign}${formatCurrency(Math.abs(amountCents))}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isExpenseFormOpen, setExpenseFormOpen] = useState(false);
  const [isPaymentFormOpen, setPaymentFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [shareAmounts, setShareAmounts] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Genel");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [pendingDeleteExpense, setPendingDeleteExpense] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [paymentFromId, setPaymentFromId] = useState("");
  const [paymentToId, setPaymentToId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [rotatingCode, setRotatingCode] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const isBlockingDialogOpen = isExpenseFormOpen || isPaymentFormOpen || pendingDeleteExpense !== null;

  useEffect(() => {
    if (!isBlockingDialogOpen) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [isBlockingDialogOpen]);

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
            setPayerId(resolved.session.memberId);
            setParticipantIds(remoteData.members.filter((member) => member.active).map((member) => member.id));
            setPaymentFromId(resolved.session.memberId);
            setData({ session: resolved.session, account: resolved.account, ...remoteData, runs });
          } else if (storedSession) {
            const localData = { members: readLocalMembers(storedSession), expenses: readLocalExpenses(storedSession), debtPayments: readLocalDebtPayments(storedSession), runs: readLocalSettlementRuns(storedSession) };
            setPayerId(storedSession.memberId);
            setParticipantIds(localData.members.filter((member) => member.active).map((member) => member.id));
            setPaymentFromId(storedSession.memberId);
            setData({ session: storedSession, account: { isAnonymous: false, hasGoogleIdentity: false, email: null }, ...localData });
          }
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
    const activeDialog = dialog;
    dialog.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    )?.focus();

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setFormError("");
        setExpenseFormOpen(false);
        window.requestAnimationFrame(() => dialogReturnFocusRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const currentFocusable = Array.from(activeDialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (currentFocusable.length === 0) return;
      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
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

  useEffect(() => {
    if (!isPaymentFormOpen) return;
    const dialog = document.querySelector<HTMLElement>(".payment-modal");
    if (!dialog) return;
    const activeDialog = dialog;
    dialog.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    )?.focus();

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePaymentForm();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(activeDialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
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
  }, [isPaymentFormOpen]);

  useEffect(() => {
    if (!pendingDeleteExpense) return;
    const dialog = document.querySelector<HTMLElement>(".delete-modal");
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === "Escape" && !deletingExpense) {
        event.preventDefault();
        setPendingDeleteExpense(null);
        setDeleteError("");
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
  }, [pendingDeleteExpense, deletingExpense]);

  useEffect(() => {
    if (pendingDeleteExpense) cancelDeleteButtonRef.current?.focus();
  }, [pendingDeleteExpense]);

  const activeMembers = data?.members.filter((member) => member.active) ?? [];
  const parsedShares = participantIds.map((memberId) => ({
    memberId,
    amountCents: parseAmountToCents(shareAmounts[memberId] ?? "", true),
  }));
  const customSharesComplete = parsedShares.length > 0 && parsedShares.every((share) => share.amountCents !== null);
  const customAmountCents = customSharesComplete
    ? parsedShares.reduce((sum, share) => sum + (share.amountCents ?? 0), 0)
    : 0;
  const openExpenses = (data?.expenses.filter((expense) => !expense.settlementRunId) ?? [])
    .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const openPayments = (data?.debtPayments.filter((payment) => !payment.settlementRunId) ?? [])
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt));
  const openTotal = openExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const balances = data ? calculateBalances(activeMembers, openExpenses, openPayments) : [];
  const debtors = balances.filter((balance) => balance.amountCents < 0);
  const creditors = balances.filter((balance) => balance.amountCents > 0);
  const selectedPaymentFromId = debtors.some((balance) => balance.memberId === paymentFromId)
    ? paymentFromId
    : debtors[0]?.memberId ?? "";
  const availablePaymentRecipients = creditors.filter((balance) => balance.memberId !== selectedPaymentFromId);
  const selectedPaymentToId = availablePaymentRecipients.some((balance) => balance.memberId === paymentToId)
    ? paymentToId
    : availablePaymentRecipients[0]?.memberId ?? "";
  const maxPaymentCents = Math.min(
    Math.abs(balances.find((balance) => balance.memberId === selectedPaymentFromId)?.amountCents ?? 0),
    balances.find((balance) => balance.memberId === selectedPaymentToId)?.amountCents ?? 0,
  );
  const canWrite = Boolean(data && (!isSupabaseConfigured() || data.account.hasGoogleIdentity));
  const memberById = new Map((data?.members ?? []).map((member) => [member.id, member]));
  const currentBalance = balances.find((balance) => balance.memberId === data?.session.memberId)?.amountCents ?? 0;
  const memberNames = Object.fromEntries((data?.members ?? []).map((member) => [member.id, member.name]));

  function openExpenseForm() {
    dialogReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFormError("");
    setEditingExpenseId(null);
    setAmount("");
    setSplitMode("equal");
    setShareAmounts({});
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
    const shares = expense.participantShares ?? [...splitAmount(expense.amountCents, expense.participantIds)].map(([memberId, amountCents]) => ({ memberId, amountCents }));
    const sharesByMember = new Map(shares.map((share) => [share.memberId, share.amountCents]));
    const equalShares = splitAmount(expense.amountCents, expense.participantIds);
    const wasEqualSplit = equalShares.size === sharesByMember.size
      && [...equalShares].every(([memberId, amountCents]) => sharesByMember.get(memberId) === amountCents);
    setShareAmounts(Object.fromEntries(shares.map((share) => [share.memberId, formatAmountInput(share.amountCents)])));
    setSplitMode(wasEqualSplit ? "equal" : "custom");
    setFormError("");
    setExpenseFormOpen(true);
  }

  function closeExpenseForm() {
    setFormError("");
    setExpenseFormOpen(false);
    window.requestAnimationFrame(() => dialogReturnFocusRef.current?.focus());
  }

  function openPaymentForm() {
    dialogReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaymentError("");
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentFormOpen(true);
  }

  function closePaymentForm() {
    setPaymentError("");
    setPaymentFormOpen(false);
    window.requestAnimationFrame(() => dialogReturnFocusRef.current?.focus());
  }

  function toggleParticipant(memberId: string) {
    if (participantIds.includes(memberId)) {
      setParticipantIds((current) => current.filter((id) => id !== memberId));
      setShareAmounts((current) => {
        const next = { ...current };
        delete next[memberId];
        return next;
      });
    } else {
      setParticipantIds((current) => [...current, memberId]);
      setShareAmounts((current) => ({ ...current, [memberId]: "" }));
    }
    setFormError("");
  }

  function formatAmountInput(amountCents: number) {
    return (amountCents / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function changeSplitMode(nextMode: "equal" | "custom") {
    if (nextMode === splitMode) return;
    if (nextMode === "custom") {
      const totalCents = parseAmountToCents(amount);
      const hasExistingShares = participantIds.some((memberId) => Object.hasOwn(shareAmounts, memberId));
      if (!hasExistingShares && totalCents && participantIds.length > 0) {
        const initialShares = splitAmount(totalCents, participantIds);
        setShareAmounts(Object.fromEntries([...initialShares].map(([memberId, shareCents]) => [memberId, formatAmountInput(shareCents)])));
      }
    } else if (customSharesComplete) {
      setAmount(formatAmountInput(customAmountCents));
    }
    setSplitMode(nextMode);
    setFormError("");
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;

    if (!payerId || participantIds.length === 0) {
      setFormError("Ödeyen kişiyi ve en az bir katılımcıyı seç.");
      return;
    }
    if (description.trim().length < 2) {
      setFormError("Harcamaya kısa bir açıklama ekle.");
      return;
    }
    if (splitMode === "custom" && !customSharesComplete) {
      setFormError("Seçili her kişi için payı gir. Pay almayacak kişiye 0 yazabilirsin.");
      return;
    }
    const amountCents = splitMode === "equal" ? parseAmountToCents(amount) : customAmountCents;
    if (!amountCents) {
      setFormError(splitMode === "equal" ? "Geçerli bir toplam tutar gir." : "Kişi paylarının toplamı sıfırdan büyük olmalı.");
      return;
    }
    const participantShares: ExpenseShare[] = splitMode === "equal"
      ? [...splitAmount(amountCents, participantIds)].map(([memberId, shareCents]) => ({ memberId, amountCents: shareCents }))
      : parsedShares.map((share) => ({ memberId: share.memberId, amountCents: share.amountCents ?? 0 }));
    setSavingExpense(true);
    try {
      const input = { payerId, amountCents, description: description.trim(), category, expenseDate, participantIds, participantShares };
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
            return { members: data.members, expenses, debtPayments: data.debtPayments };
          })();
      setData({ ...data, ...nextData });
      setActionStatus(editingExpenseId ? "Harcama güncellendi." : "Harcama eklendi.");
      setAmount("");
      setShareAmounts({});
      setSplitMode("equal");
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

  async function signOut() {
    if (isSupabaseConfigured()) await createClient().auth.signOut();
    window.localStorage.removeItem("ev-hesap-session");
    router.replace("/");
  }

  async function copyJoinCode() {
    if (!data?.session.joinCode) return;
    try {
      await navigator.clipboard.writeText(data.session.joinCode);
      setCopyStatus("Ev kodu kopyalandı.");
    } catch {
      setCopyStatus("Kod kopyalanamadı. Kodu seçip kopyala.");
    }
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  async function rotateJoinCode() {
    if (!data || data.session.role !== "owner") return;
    setRotatingCode(true);
    setLoadError("");
    try {
      const joinCode = await rotateRemoteHouseholdJoinCode(data.session);
      const session = { ...data.session, joinCode };
      saveLocalSession(session);
      setData({ ...data, session });
    } catch (rotateFailure) {
      setLoadError(rotateFailure instanceof Error ? rotateFailure.message : "Yeni davet kodu oluşturulamadı.");
    } finally {
      setRotatingCode(false);
    }
  }

  async function linkGoogleAccount() {
    if (!data || data.account.hasGoogleIdentity) return;
    setLinkingGoogle(true);
    setLoadError("");
    try {
      await beginGoogleSignIn(`/dashboard?household=${encodeURIComponent(data.session.householdId)}`, true);
    } catch (linkFailure) {
      setLoadError(linkFailure instanceof Error ? linkFailure.message : "Google hesabı bağlanamadı.");
      setLinkingGoogle(false);
    }
  }

  function requestDeleteExpense(expense: Expense) {
    dialogReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDeleteError("");
    setPendingDeleteExpense(expense);
  }

  function closeDeleteDialog() {
    if (deletingExpense) return;
    setPendingDeleteExpense(null);
    setDeleteError("");
    window.requestAnimationFrame(() => dialogReturnFocusRef.current?.focus());
  }

  async function confirmDeleteExpense() {
    if (!data || !pendingDeleteExpense) return;

    setDeletingExpense(true);
    setDeleteError("");
    try {
      const nextData = isSupabaseConfigured()
        ? await deleteRemoteExpense(data.session, pendingDeleteExpense.id)
        : (() => {
            const expenses = data.expenses.filter((item) => item.id !== pendingDeleteExpense.id);
            saveLocalExpenses(data.session, expenses);
            return { members: data.members, expenses, debtPayments: data.debtPayments };
          })();
      setData({ ...data, ...nextData });
      setPendingDeleteExpense(null);
      setActionStatus("Harcama silindi.");
      window.requestAnimationFrame(() => document.getElementById("activity-title")?.focus());
    } catch (deleteFailure) {
      setDeleteError(deleteFailure instanceof Error ? deleteFailure.message : "Harcama silinemedi.");
    } finally {
      setDeletingExpense(false);
    }
  }

  async function handleDebtPaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const amountCents = parseAmountToCents(paymentAmount);
    if (!amountCents) {
      setPaymentError("Geçerli bir tutar gir.");
      return;
    }
    if (!selectedPaymentFromId || !selectedPaymentToId || maxPaymentCents <= 0) {
      setPaymentError("Bu açık hesapta kaydedilebilecek bir ödeme yok.");
      return;
    }
    if (amountCents > maxPaymentCents) {
      setPaymentError(`Bu kişiler arasında en fazla ${formatCurrency(maxPaymentCents)} kaydedebilirsin.`);
      return;
    }

    setSavingPayment(true);
    setPaymentError("");
    try {
      const input = {
        fromMemberId: selectedPaymentFromId,
        toMemberId: selectedPaymentToId,
        amountCents,
        paidAt: paymentDate,
        note: paymentNote.trim(),
      };
      const nextData = isSupabaseConfigured()
        ? await createRemoteDebtPayment(data.session, input)
        : (() => {
            const payment: DebtPayment = {
              id: createId("payment"),
              householdId: data.session.householdId,
              ...input,
              createdAt: new Date().toISOString(),
            };
            const debtPayments = [payment, ...data.debtPayments];
            saveLocalDebtPayments(data.session, debtPayments);
            return { members: data.members, expenses: data.expenses, debtPayments };
          })();
      setData({ ...data, ...nextData });
      setActionStatus("Yapılan ödeme kaydedildi.");
      setPaymentAmount("");
      setPaymentNote("");
      closePaymentForm();
    } catch (saveFailure) {
      setPaymentError(saveFailure instanceof Error ? saveFailure.message : "Ödeme kaydedilemedi.");
    } finally {
      setSavingPayment(false);
    }
  }

  if (loading) {
    return <main className="dashboard-shell"><div className="dashboard-loading" role="status">Ev hesabı hazırlanıyor…</div></main>;
  }

  if (!data) {
    if (loadError) {
      const message = loadError === "Auth session missing!"
        ? "Bu cihazda açık bir oturum bulunamadı. Google hesabınla giriş yapıp üyesi olduğun eve dönebilirsin."
        : loadError;
      return <main className="dashboard-shell"><div className="empty-dashboard"><span className="empty-dashboard-icon"><Home size={25} /></span><h1>Ev hesabı açılamadı.</h1><p>{message}</p><p className="recovery-hint">Bağlantını kontrol edip yeniden deneyebilirsin.</p><Link className="primary-action" href="/start">Google ile devam et</Link><button className="secondary-action" onClick={() => window.location.reload()} type="button">Tekrar dene</button></div></main>;
    }
    return (
      <main className="dashboard-shell">
        <div className="empty-dashboard">
          <span className="empty-dashboard-icon"><Home size={25} /></span>
          <h1>Ev hesabına giriş yap.</h1>
          <p>Google hesabınla giriş yapınca üyesi olduğun ev doğrudan açılır. Henüz bir evin yoksa oluşturabilir veya kodla katılabilirsin.</p>
          <Link className="primary-action" href="/start">Google ile devam et</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell dashboard-shell--with-actionbar" id="main-content" tabIndex={-1}>
      <a className="skip-link" href="#main-content">İçeriğe geç</a>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{actionStatus}</p>
      <header className="account-header">
        <Link className="dashboard-wordmark" href="/" aria-label="Ev Hesap ana sayfa">Ev Hesap</Link>
        <div className="account-household">
          <span className="account-household__name" title={data.session.householdName}>{data.session.householdName}</span>
          <span className="account-member-count">{activeMembers.length} kişi</span>
        </div>
        <div className="account-tools">
          <details className="invite-menu">
            <summary className="secondary-action"><Copy aria-hidden="true" size={16} /> Davet et</summary>
            <div className="invite-popover">
              <strong>Ev arkadaşını davet et</strong>
              <p>Kodu yalnızca katılmasını istediğin kişilerle paylaş.</p>
              {data.session.joinCode ? (
                <div className="invite-code">
                  <code>{data.session.joinCode}</code>
                  <button aria-label="Ev kodunu kopyala" onClick={() => void copyJoinCode()} type="button"><Copy aria-hidden="true" size={17} /></button>
                </div>
              ) : data.session.role === "owner" ? (
                <button className="primary-action invite-create" disabled={rotatingCode} onClick={() => void rotateJoinCode()} type="button">
                  {rotatingCode ? "Hazırlanıyor…" : "Davet kodu oluştur"}
                </button>
              ) : <p className="invite-no-code">Davet kodunu ev sahibinden iste.</p>}
              <span className="visually-hidden" aria-live="polite">{copyStatus}</span>
            </div>
          </details>
          <ThemeControl />
          <details className="account-menu">
            <summary aria-label="Hesap seçenekleri"><MoreHorizontal aria-hidden="true" size={21} /></summary>
            <div className="account-menu-popover">
              <div className="account-menu-theme">
                <span>Görünüm teması</span>
                <ThemeControl full />
              </div>
              <Link href="/settle">Kim kime ödeyecek?</Link>
              <button onClick={() => void signOut()} type="button"><LogOut aria-hidden="true" size={16} /> Oturumu kapat</button>
            </div>
          </details>
        </div>
      </header>

      {isSupabaseConfigured() && !data.account.hasGoogleIdentity && (
        <aside className="account-upgrade" aria-label="Google hesabını bağla">
          <p>{data.account.isAnonymous ? "Bu ev anonim oturumda açık." : "Bu hesap Google kimliğine bağlı değil."} Kayıtları ve üyeliği korumak için Google hesabını bağla.</p>
          <button className="secondary-action google-action" disabled={linkingGoogle} onClick={() => void linkGoogleAccount()} type="button">
            <GoogleMark />{linkingGoogle ? "Google açılıyor…" : "Google hesabını bağla"}
          </button>
        </aside>
      )}

      {loadError && <p className="inline-error" role="alert">{loadError}</p>}

      <section className="dashboard-main">
        <aside className="dashboard-sidebar">
          <section className="account-overview" aria-labelledby="account-title">
            <div className="account-heading">
              <h1 id="account-title">Ev hesabı</h1>
              <p className="account-period">Bu evin açık giderleri</p>
            </div>
            <div className="account-total">
              <span>Açık gider toplamı</span>
              <strong>{formatCurrency(openTotal)}</strong>
              <small>{openExpenses.length} harcama · {openPayments.length} yapılan ödeme</small>
            </div>
            <div className="account-net">
              <span>Senin net bakiyen · {balanceState(currentBalance)}</span>
              <strong className={currentBalance > 0 ? "balance-positive" : currentBalance < 0 ? "balance-negative" : "balance-even"}>{signedCurrency(currentBalance)}</strong>
            </div>
          </section>

          <section className="member-balances-section" aria-labelledby="member-balances-title">
            <header><h2 id="member-balances-title">Ev arkadaşları</h2><span>{activeMembers.length} kişi</span></header>
            <MemberBalances members={activeMembers} balances={balances} currentMemberId={data.session.memberId} />
          </section>

          <div className="desktop-dashboard-actions">
            {canWrite ? (
              <button className="primary-action" onClick={openExpenseForm} type="button"><Plus aria-hidden="true" size={18} /> Harcama ekle</button>
            ) : <Link className="primary-action" href="/start?mode=create">Google hesabını bağla</Link>}
            {canWrite ? <button className="secondary-action" onClick={openPaymentForm} type="button"><ArrowUpRight aria-hidden="true" size={17} /> Ödeme kaydet</button> : <Link className="secondary-action" href="/settle">Kim kime ödeyecek?</Link>}
          </div>
        </aside>

        <div className="dashboard-content">

        <ActivityFeed
          canEdit={canWrite}
          expenses={data.expenses}
          memberNames={memberNames}
          onDeleteExpense={requestDeleteExpense}
          onEditExpense={openEditExpense}
          payments={data.debtPayments}
          runs={data.runs}
        />

        </div>
      </section>

      <div className="mobile-actionbar" aria-label="Ana işlemler">
        {canWrite ? <button className="primary-action" onClick={openExpenseForm} type="button"><Plus aria-hidden="true" size={18} /> Harcama ekle</button> : <Link className="primary-action" href="/start?mode=create">Google hesabını bağla</Link>}
        {canWrite ? <button className="secondary-action" onClick={openPaymentForm} type="button"><ArrowUpRight aria-hidden="true" size={17} /> Ödeme kaydet</button> : <Link className="secondary-action" href="/settle">Ödeme listesine bak</Link>}
      </div>

      {pendingDeleteExpense && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteDialog(); }}>
          <section className="delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-modal-title" aria-describedby="delete-modal-description">
            <div className="delete-modal-mark" aria-hidden="true"><Trash2 size={21} /></div>
            <h2 id="delete-modal-title">Harcamayı sil?</h2>
            <p id="delete-modal-description"><strong>“{pendingDeleteExpense.description}”</strong> kaydı ev hesabından kaldırılacak. Bu kayda bağlı açık bakiyeler yeniden hesaplanır.</p>
            {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
            <div className="delete-modal-actions">
              <button className="secondary-action" disabled={deletingExpense} onClick={closeDeleteDialog} ref={cancelDeleteButtonRef} type="button">Vazgeç</button>
              <button className="delete-confirm-action" disabled={deletingExpense} onClick={() => void confirmDeleteExpense()} type="button">
                {deletingExpense ? "Siliniyor…" : "Harcamayı sil"}
              </button>
            </div>
          </section>
        </div>
      )}

      {isPaymentFormOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePaymentForm(); }}>
          <section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" aria-describedby={paymentError ? "payment-form-error" : undefined}>
            <header className="modal-header">
              <div><h2 id="payment-modal-title">Yapılan ödeme kaydet</h2><p>Kısmi ödemeyi açık bakiyeden düş.</p></div>
              <button className="icon-button" aria-label="Formu kapat" onClick={closePaymentForm} type="button"><X aria-hidden="true" size={20} /></button>
            </header>
            <form className="payment-modal__body" onSubmit={handleDebtPaymentSubmit}>
              {debtors.length === 0 || creditors.length === 0 ? (
                <p className="debt-payment-empty">Şu anda kaydedilecek açık bir ödeme eşleşmesi yok.</p>
              ) : (
                <>
                  <div className="form-two-col">
                    <label className="field-label">Kim ödedi?
                      <select onChange={(event) => { setPaymentFromId(event.target.value); setPaymentToId(""); setPaymentError(""); }} value={selectedPaymentFromId}>
                        {debtors.map((balance) => <option key={balance.memberId} value={balance.memberId}>{memberById.get(balance.memberId)?.name} · borçlu</option>)}
                      </select>
                    </label>
                    <label className="field-label">Kime ödedi?
                      <select onChange={(event) => setPaymentToId(event.target.value)} value={selectedPaymentToId}>
                        {availablePaymentRecipients.map((balance) => <option key={balance.memberId} value={balance.memberId}>{memberById.get(balance.memberId)?.name} · alacaklı</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="form-two-col">
                    <label className="field-label">Tutar
                      <input inputMode="decimal" onChange={(event) => setPaymentAmount(event.target.value)} placeholder="100,00" required value={paymentAmount} />
                    </label>
                    <label className="field-label">Tarih
                      <input onChange={(event) => setPaymentDate(event.target.value)} required type="date" value={paymentDate} />
                    </label>
                  </div>
                  <label className="field-label">Not <span>(isteğe bağlı)</span>
                    <input maxLength={160} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Örn. Borcun bir kısmını ödedi" value={paymentNote} />
                  </label>
                  <p className="debt-payment-hint">Bu ödeme için en fazla {formatCurrency(maxPaymentCents)} kaydedebilirsin.</p>
                  {paymentError && <p className="form-error" id="payment-form-error" role="alert">{paymentError}</p>}
                  <button className="primary-action form-submit" disabled={savingPayment || maxPaymentCents <= 0} type="submit">{savingPayment ? "Kaydediliyor…" : "Ödemeyi kaydet"}</button>
                </>
              )}
            </form>
          </section>
        </div>
      )}

      {isExpenseFormOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeExpenseForm(); }}>
          <section className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title" aria-describedby={formError ? "expense-form-error" : undefined}>
            <header className="modal-header">
              <div><h2 id="expense-modal-title">{editingExpenseId ? "Harcamayı düzenle" : "Harcama ekle"}</h2><p>Ev hesabına yeni bir kayıt ekle.</p></div>
              <button className="icon-button" aria-label="Formu kapat" onClick={closeExpenseForm} type="button"><X aria-hidden="true" size={20} /></button>
            </header>

            <form id="expense-form" className="expense-modal__body" onSubmit={handleExpenseSubmit}>
              <section className="expense-form-group" aria-labelledby="expense-group-title">
                <h3 id="expense-group-title">Harcama</h3>
                {splitMode === "equal" ? (
                  <label className="field-label">Toplam tutar
                    <input autoComplete="off" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="1.000,00" required value={amount} />
                  </label>
                ) : (
                  <div className="derived-total" aria-live="polite">
                    <span>Payların toplamı</span>
                    <strong>{customSharesComplete ? formatCurrency(customAmountCents) : "Payları tamamla"}</strong>
                  </div>
                )}
                <label className="field-label">Açıklama
                  <input onChange={(event) => setDescription(event.target.value)} placeholder="Örn. Market alışverişi" required value={description} />
                </label>
                <div className="form-two-col">
                  <label className="field-label">Kategori
                    <select onChange={(event) => setCategory(event.target.value)} value={category}><option>Genel</option><option>Market</option><option>Fatura</option><option>Ev</option><option>Ulaşım</option><option>Dışarıda yemek</option></select>
                  </label>
                  <label className="field-label">Tarih
                    <input onChange={(event) => setExpenseDate(event.target.value)} required type="date" value={expenseDate} />
                  </label>
                </div>
              </section>

              <section className="expense-form-group" aria-labelledby="people-group-title">
                <h3 id="people-group-title">Kimler</h3>
                <label className="field-label">Toplamı kim ödedi?
                  <select onChange={(event) => setPayerId(event.target.value)} value={payerId}>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
                </label>
                <fieldset className="participants-field">
                  <legend>Harcamaya kimler katılıyor?</legend>
                  {activeMembers.map((member) => <label className="participant-option" key={member.id}><input checked={participantIds.includes(member.id)} onChange={() => toggleParticipant(member.id)} type="checkbox" /><span>{member.name}</span><small>{participantIds.includes(member.id) ? "Dahil" : "Hariç"}</small></label>)}
                </fieldset>
              </section>

              <section className="expense-form-group" aria-labelledby="split-group-title">
                <h3 id="split-group-title">Paylaşım</h3>
                <fieldset className="share-mode-fieldset">
                  <legend>Paylaşım şekli</legend>
                  <div className="share-mode-switch" role="group" aria-label="Harcama paylaşım şekli">
                    <button aria-pressed={splitMode === "equal"} className={splitMode === "equal" ? "is-selected" : ""} onClick={() => changeSplitMode("equal")} type="button">Eşit paylaş</button>
                    <button aria-pressed={splitMode === "custom"} className={splitMode === "custom" ? "is-selected" : ""} onClick={() => changeSplitMode("custom")} type="button">Kişi başı tutar</button>
                  </div>
                </fieldset>
                {splitMode === "custom" && (
                  <section className="share-amount-section" aria-labelledby="share-amount-title">
                    <h4 id="share-amount-title">Kişi payları</h4>
                    {participantIds.length === 0 ? (
                      <p className="share-amount-hint">Önce harcamaya katılacak kişileri seç.</p>
                    ) : (
                      <div className="share-amount-list">
                        {activeMembers.filter((member) => participantIds.includes(member.id)).map((member) => (
                          <label className="share-amount-row" key={member.id}>
                            <span>{member.name}<small>kişisel payı</small></span>
                            <span className="share-input-wrap">
                              <input
                                aria-label={`${member.name} kişinin payı`}
                                inputMode="decimal"
                                onChange={(event) => setShareAmounts((current) => ({ ...current, [member.id]: event.target.value }))}
                                placeholder="0,00"
                                required
                                value={shareAmounts[member.id] ?? ""}
                              />
                              <span aria-hidden="true">₺</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="share-total" aria-live="polite">
                      <span>Harcama toplamı</span>
                      <strong>{customSharesComplete ? formatCurrency(customAmountCents) : "Payları tamamla"}</strong>
                    </div>
                    <p className="share-amount-hint">Toplam, seçili kişilerin paylarından oluşur. Ödeyen kişinin kendi payını da ekleyebilirsin; pay almıyorsa 0 yaz.</p>
                  </section>
                )}
              </section>
            </form>

            <footer className="expense-modal__footer">
              {formError && <p className="form-error" id="expense-form-error" role="alert">{formError}</p>}
              <div className="expense-modal__actions">
                <button className="secondary-action" disabled={savingExpense} onClick={closeExpenseForm} type="button">Vazgeç</button>
                <button className="primary-action" disabled={savingExpense} form="expense-form" type="submit" aria-busy={savingExpense}>
                  {savingExpense ? "Kaydediliyor…" : editingExpenseId ? "Değişiklikleri kaydet" : "Harcamayı kaydet"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
