import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Expense, Member, SettlementRun, Transfer } from "@/lib/types";
import type { LocalSession } from "@/lib/local-store";

type HouseholdRpcResult = {
  household_id: string;
  household_name: string;
  member_id: string;
  join_code: string;
  role: "owner" | "member";
};

type RemoteMember = {
  id: string;
  household_id: string;
  user_id: string;
  name: string;
  role: "owner" | "member";
  active: boolean;
  joined_at: string;
};

type RemoteExpense = {
  id: string;
  household_id: string;
  payer_member_id: string;
  amount_cents: number;
  description: string;
  category: string;
  expense_date: string;
  settlement_run_id: string | null;
  created_at: string;
  updated_at: string;
};

type RemoteParticipant = { expense_id: string; member_id: string };

export type ExpenseInput = {
  payerId: string;
  amountCents: number;
  description: string;
  category: string;
  expenseDate: string;
  participantIds: string[];
};

function toMember(member: RemoteMember): Member {
  return {
    id: member.id,
    householdId: member.household_id,
    name: member.name,
    role: member.role,
    active: member.active,
    joinedAt: member.joined_at,
  };
}

function toExpense(expense: RemoteExpense, participants: RemoteParticipant[]): Expense {
  return {
    id: expense.id,
    householdId: expense.household_id,
    payerId: expense.payer_member_id,
    amountCents: expense.amount_cents,
    description: expense.description,
    category: expense.category,
    expenseDate: expense.expense_date,
    participantIds: participants.filter((participant) => participant.expense_id === expense.id).map((participant) => participant.member_id),
    settlementRunId: expense.settlement_run_id ?? undefined,
    createdAt: expense.created_at,
    updatedAt: expense.updated_at,
  };
}

function toRpcResult(value: unknown): HouseholdRpcResult {
  if (!value || typeof value !== "object") throw new Error("Supabase household response is invalid.");
  const result = value as Record<string, unknown>;
  if (typeof result.household_id !== "string" || typeof result.member_id !== "string" || typeof result.join_code !== "string") {
    throw new Error("Supabase household response is incomplete.");
  }
  return {
    household_id: result.household_id,
    household_name: typeof result.household_name === "string" ? result.household_name : "Ev hesabı",
    member_id: result.member_id,
    join_code: result.join_code,
    role: result.role === "owner" ? "owner" : "member",
  };
}

export function sessionFromRpc(result: HouseholdRpcResult, memberName: string): LocalSession {
  return {
    householdId: result.household_id,
    householdName: result.household_name,
    memberId: result.member_id,
    memberName,
    joinCode: result.join_code,
    role: result.role,
  };
}

async function ensureAuthenticated() {
  const supabase = createClient();
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user) return supabase;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return supabase;
}

export async function createRemoteHousehold(householdName: string, memberName: string) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  const supabase = await ensureAuthenticated();
  const { data, error } = await supabase.rpc("create_household", {
    household_name: householdName,
    member_name: memberName,
  });
  if (error) throw error;
  return sessionFromRpc(toRpcResult(data), memberName);
}

export async function joinRemoteHousehold(joinCode: string, memberName: string) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  const supabase = await ensureAuthenticated();
  const { data, error } = await supabase.rpc("join_household", {
    join_code: joinCode,
    member_name: memberName,
  });
  if (error) throw error;
  return sessionFromRpc(toRpcResult(data), memberName);
}

export async function loadRemoteHousehold(session: LocalSession) {
  const supabase = await ensureAuthenticated();
  const [{ data: members, error: membersError }, { data: expenses, error: expensesError }] = await Promise.all([
    supabase.from("members").select("id, household_id, user_id, name, role, active, joined_at").eq("household_id", session.householdId).order("joined_at"),
    supabase.from("expenses").select("id, household_id, payer_member_id, amount_cents, description, category, expense_date, settlement_run_id, created_at, updated_at").eq("household_id", session.householdId).order("expense_date", { ascending: false }),
  ]);
  if (membersError) throw membersError;
  if (expensesError) throw expensesError;

  const expenseRows = (expenses ?? []) as RemoteExpense[];
  const { data: participants, error: participantsError } = expenseRows.length === 0
    ? { data: [], error: null }
    : await supabase.from("expense_participants").select("expense_id, member_id").in("expense_id", expenseRows.map((expense) => expense.id));
  if (participantsError) throw participantsError;

  return {
    members: (members ?? []).map((member) => toMember(member as RemoteMember)),
    expenses: expenseRows.map((expense) => toExpense(expense, (participants ?? []) as RemoteParticipant[])),
  };
}

export async function createRemoteExpense(session: LocalSession, input: ExpenseInput) {
  const supabase = await ensureAuthenticated();
  const { error } = await supabase.rpc("create_expense_atomic", {
    p_household_id: session.householdId,
    p_payer_member_id: input.payerId,
    p_amount_cents: input.amountCents,
    p_description: input.description,
    p_category: input.category,
    p_expense_date: input.expenseDate,
    p_participant_member_ids: input.participantIds,
  });
  if (error) throw error;
  return loadRemoteHousehold(session);
}

export async function updateRemoteExpense(session: LocalSession, expenseId: string, input: ExpenseInput) {
  const supabase = await ensureAuthenticated();
  const { error } = await supabase.rpc("update_expense_atomic", {
    p_household_id: session.householdId,
    p_expense_id: expenseId,
    p_payer_member_id: input.payerId,
    p_amount_cents: input.amountCents,
    p_description: input.description,
    p_category: input.category,
    p_expense_date: input.expenseDate,
    p_participant_member_ids: input.participantIds,
  });
  if (error) throw error;
  return loadRemoteHousehold(session);
}

export async function deleteRemoteExpense(session: LocalSession, expenseId: string) {
  const supabase = await ensureAuthenticated();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId).eq("household_id", session.householdId);
  if (error) throw error;
  return loadRemoteHousehold(session);
}

export async function loadRemoteSettlementRuns(session: LocalSession) {
  const supabase = await ensureAuthenticated();
  const { data: runs, error: runsError } = await supabase.from("settlement_runs").select("id, household_id, created_by_user_id, created_at").eq("household_id", session.householdId).order("created_at", { ascending: false });
  if (runsError) throw runsError;
  const runRows = (runs ?? []) as Array<{ id: string; household_id: string; created_at: string }>;
  if (runRows.length === 0) return [];

  const { data: settlements, error: settlementsError } = await supabase.from("settlements").select("settlement_run_id, from_member_id, to_member_id, amount_cents").in("settlement_run_id", runRows.map((run) => run.id));
  if (settlementsError) throw settlementsError;
  const settlementRows = (settlements ?? []) as Array<{ settlement_run_id: string; from_member_id: string; to_member_id: string; amount_cents: number }>;
  const { data: settledExpenses, error: settledExpensesError } = await supabase.from("expenses").select("id, settlement_run_id").in("settlement_run_id", runRows.map((run) => run.id));
  if (settledExpensesError) throw settledExpensesError;
  const settledExpenseRows = (settledExpenses ?? []) as Array<{ id: string; settlement_run_id: string | null }>;
  return runRows.map((run) => ({
    id: run.id,
    householdId: run.household_id,
    createdAt: run.created_at,
    expenseIds: settledExpenseRows.filter((expense) => expense.settlement_run_id === run.id).map((expense) => expense.id),
    transfers: settlementRows.filter((settlement) => settlement.settlement_run_id === run.id).map((settlement): Transfer => ({ fromMemberId: settlement.from_member_id, toMemberId: settlement.to_member_id, amountCents: settlement.amount_cents })),
  } satisfies SettlementRun));
}

export async function closeRemoteSettlement(session: LocalSession, expenseIds: string[]) {
  const supabase = await ensureAuthenticated();
  const { error } = await supabase.rpc("close_settlement_atomic", {
    p_household_id: session.householdId,
    p_expense_ids: expenseIds,
  });
  if (error) throw error;
  return loadRemoteHousehold(session);
}
