import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { DebtPayment, Expense, Member, SettlementRun, Transfer } from "@/lib/types";
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

type RemoteMembership = RemoteMember & {
  household: { name: string } | Array<{ name: string }> | null;
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

type RemoteDebtPayment = {
  id: string;
  household_id: string;
  from_member_id: string;
  to_member_id: string;
  amount_cents: number;
  paid_at: string;
  description: string;
  settlement_run_id: string | null;
  created_at: string;
};

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

function toDebtPayment(payment: RemoteDebtPayment): DebtPayment {
  return {
    id: payment.id,
    householdId: payment.household_id,
    fromMemberId: payment.from_member_id,
    toMemberId: payment.to_member_id,
    amountCents: payment.amount_cents,
    paidAt: payment.paid_at,
    note: payment.description,
    settlementRunId: payment.settlement_run_id ?? undefined,
    createdAt: payment.created_at,
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

async function getAuthenticatedClient(requireGoogleAccount = false) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Ev hesabına erişmek için Google ile giriş yapmalısın.");
  const providers = user.app_metadata.providers;
  const hasGoogleIdentity = Array.isArray(providers) && providers.includes("google");
  if (requireGoogleAccount && !hasGoogleIdentity) {
    throw new Error("Bu işlem için Google hesabıyla giriş yapmalısın.");
  }
  return { supabase, user };
}

export async function loadRemoteHouseholdSession(
  preferredHouseholdId?: string | null,
  existingSession?: LocalSession | null,
) {
  const { supabase, user } = await getAuthenticatedClient();

  let query = supabase
    .from("members")
    .select("id, household_id, user_id, name, role, active, joined_at, household:households(name)")
    .eq("user_id", user.id)
    .eq("active", true);
  if (preferredHouseholdId) query = query.eq("household_id", preferredHouseholdId);

  const { data, error } = await query
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Bu hesapla açılmış bir ev üyeliği bulunamadı.");

  const membership = data as unknown as RemoteMembership;
  const household = Array.isArray(membership.household) ? membership.household[0] : membership.household;
  const session: LocalSession = {
    householdId: membership.household_id,
    householdName: household?.name ?? "Ev hesabı",
    memberId: membership.id,
    memberName: membership.name,
    joinCode: existingSession?.householdId === membership.household_id && existingSession.memberId === membership.id
      ? existingSession.joinCode
      : "",
    role: membership.role,
  };

  return {
    session,
    account: {
      isAnonymous: user.is_anonymous === true,
      hasGoogleIdentity: Array.isArray(user.app_metadata.providers) && user.app_metadata.providers.includes("google"),
      email: user.email ?? null,
    },
  };
}

export async function createRemoteHousehold(householdName: string, memberName: string) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  const { supabase } = await getAuthenticatedClient(true);
  const { data, error } = await supabase.rpc("create_household", {
    household_name: householdName,
    member_name: memberName,
  });
  if (error) throw error;
  return sessionFromRpc(toRpcResult(data), memberName);
}

export async function joinRemoteHousehold(joinCode: string, memberName: string) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  const { supabase } = await getAuthenticatedClient(true);
  const { data, error } = await supabase.rpc("join_household", {
    join_code: joinCode,
    member_name: memberName,
  });
  if (error) throw error;
  return sessionFromRpc(toRpcResult(data), memberName);
}

export async function loadRemoteHousehold(session: LocalSession) {
  const { supabase } = await getAuthenticatedClient();
  const [{ data: members, error: membersError }, { data: expenses, error: expensesError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from("members").select("id, household_id, user_id, name, role, active, joined_at").eq("household_id", session.householdId).order("joined_at"),
    supabase.from("expenses").select("id, household_id, payer_member_id, amount_cents, description, category, expense_date, settlement_run_id, created_at, updated_at").eq("household_id", session.householdId).order("expense_date", { ascending: false }),
    supabase.from("debt_payments").select("id, household_id, from_member_id, to_member_id, amount_cents, paid_at, description, settlement_run_id, created_at").eq("household_id", session.householdId).order("paid_at", { ascending: false }),
  ]);
  if (membersError) throw membersError;
  if (expensesError) throw expensesError;
  if (paymentsError) throw paymentsError;

  const expenseRows = (expenses ?? []) as RemoteExpense[];
  const { data: participants, error: participantsError } = expenseRows.length === 0
    ? { data: [], error: null }
    : await supabase.from("expense_participants").select("expense_id, member_id").in("expense_id", expenseRows.map((expense) => expense.id));
  if (participantsError) throw participantsError;

  return {
    members: (members ?? []).map((member) => toMember(member as RemoteMember)),
    expenses: expenseRows.map((expense) => toExpense(expense, (participants ?? []) as RemoteParticipant[])),
    debtPayments: ((payments ?? []) as RemoteDebtPayment[]).map(toDebtPayment),
  };
}

export async function createRemoteDebtPayment(
  session: LocalSession,
  input: { fromMemberId: string; toMemberId: string; amountCents: number; paidAt: string; note: string },
) {
  const { supabase } = await getAuthenticatedClient(true);
  const { error } = await supabase.rpc("record_debt_payment_atomic", {
    p_household_id: session.householdId,
    p_from_member_id: input.fromMemberId,
    p_to_member_id: input.toMemberId,
    p_amount_cents: input.amountCents,
    p_paid_at: input.paidAt,
    p_description: input.note,
  });
  if (error) throw error;
  return loadRemoteHousehold(session);
}

export async function createRemoteExpense(session: LocalSession, input: ExpenseInput) {
  const { supabase } = await getAuthenticatedClient(true);
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
  const { supabase } = await getAuthenticatedClient(true);
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
  const { supabase } = await getAuthenticatedClient(true);
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId).eq("household_id", session.householdId);
  if (error) throw error;
  return loadRemoteHousehold(session);
}

export async function loadRemoteSettlementRuns(session: LocalSession) {
  const { supabase } = await getAuthenticatedClient();
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
  const { data: settledPayments, error: settledPaymentsError } = await supabase.from("debt_payments").select("id, settlement_run_id").in("settlement_run_id", runRows.map((run) => run.id));
  if (settledPaymentsError) throw settledPaymentsError;
  const settledPaymentRows = (settledPayments ?? []) as Array<{ id: string; settlement_run_id: string | null }>;
  return runRows.map((run) => ({
    id: run.id,
    householdId: run.household_id,
    createdAt: run.created_at,
    expenseIds: settledExpenseRows.filter((expense) => expense.settlement_run_id === run.id).map((expense) => expense.id),
    paymentIds: settledPaymentRows.filter((payment) => payment.settlement_run_id === run.id).map((payment) => payment.id),
    transfers: settlementRows.filter((settlement) => settlement.settlement_run_id === run.id).map((settlement): Transfer => ({ fromMemberId: settlement.from_member_id, toMemberId: settlement.to_member_id, amountCents: settlement.amount_cents })),
  } satisfies SettlementRun));
}

export async function closeRemoteSettlement(session: LocalSession, expenseIds: string[]) {
  const { supabase } = await getAuthenticatedClient(true);
  const { error } = await supabase.rpc("close_settlement_atomic", {
    p_household_id: session.householdId,
    p_expense_ids: expenseIds,
  });
  if (error) throw error;
  return loadRemoteHousehold(session);
}

export async function rotateRemoteHouseholdJoinCode(session: LocalSession) {
  const { supabase } = await getAuthenticatedClient(true);
  const { data, error } = await supabase.rpc("rotate_household_join_code", {
    p_household_id: session.householdId,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("Yeni ev kodu alınamadı.");
  return data;
}
