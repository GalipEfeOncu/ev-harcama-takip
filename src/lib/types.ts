export type MemberRole = "owner" | "member";

export type Member = {
  id: string;
  householdId: string;
  name: string;
  role: MemberRole;
  active: boolean;
  joinedAt: string;
};

export type Expense = {
  id: string;
  householdId: string;
  payerId: string;
  amountCents: number;
  description: string;
  category?: string;
  expenseDate: string;
  participantIds: string[];
  createdAt: string;
  updatedAt: string;
  settlementRunId?: string;
};

export type Household = {
  id: string;
  name: string;
  ownerMemberId: string;
  createdAt: string;
};

export type Balance = {
  memberId: string;
  amountCents: number;
};

export type Transfer = {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
};

export type SettlementRun = {
  id: string;
  householdId: string;
  createdAt: string;
  expenseIds: string[];
  transfers: Transfer[];
};
