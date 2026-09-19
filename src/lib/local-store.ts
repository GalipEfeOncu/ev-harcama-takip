import type { DebtPayment, Expense, Member, SettlementRun } from "@/lib/types";

export const SESSION_KEY = "ev-hesap-session";

export type LocalSession = {
  householdId: string;
  householdName: string;
  memberId: string;
  memberName: string;
  joinCode: string;
  role: "owner" | "member";
};

function keyFor(householdId: string, resource: string) {
  return `ev-hesap-${resource}-${householdId}`;
}

export function readLocalSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LocalSession;
  } catch {
    return null;
  }
}

export function saveLocalSession(session: LocalSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function readLocalMembers(session: LocalSession): Member[] {
  const raw = window.localStorage.getItem(keyFor(session.householdId, "members"));
  if (!raw) {
    return [{
      id: session.memberId,
      householdId: session.householdId,
      name: session.memberName,
      role: session.role,
      active: true,
      joinedAt: new Date().toISOString(),
    }];
  }

  try {
    return JSON.parse(raw) as Member[];
  } catch {
    return [];
  }
}

export function saveLocalMembers(session: LocalSession, members: Member[]) {
  window.localStorage.setItem(keyFor(session.householdId, "members"), JSON.stringify(members));
}

export function readLocalExpenses(session: LocalSession): Expense[] {
  const raw = window.localStorage.getItem(keyFor(session.householdId, "expenses"));
  if (!raw) return [];

  try {
    return JSON.parse(raw) as Expense[];
  } catch {
    return [];
  }
}

export function saveLocalExpenses(session: LocalSession, expenses: Expense[]) {
  window.localStorage.setItem(keyFor(session.householdId, "expenses"), JSON.stringify(expenses));
}

export function readLocalDebtPayments(session: LocalSession): DebtPayment[] {
  const raw = window.localStorage.getItem(keyFor(session.householdId, "debt-payments"));
  if (!raw) return [];

  try {
    return JSON.parse(raw) as DebtPayment[];
  } catch {
    return [];
  }
}

export function saveLocalDebtPayments(session: LocalSession, payments: DebtPayment[]) {
  window.localStorage.setItem(keyFor(session.householdId, "debt-payments"), JSON.stringify(payments));
}

export function readLocalSettlementRuns(session: LocalSession): SettlementRun[] {
  const raw = window.localStorage.getItem(keyFor(session.householdId, "settlements"));
  if (!raw) return [];

  try {
    return JSON.parse(raw) as SettlementRun[];
  } catch {
    return [];
  }
}

export function saveLocalSettlementRuns(session: LocalSession, runs: SettlementRun[]) {
  window.localStorage.setItem(keyFor(session.householdId, "settlements"), JSON.stringify(runs));
}
