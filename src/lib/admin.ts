import "server-only";

import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export type AdminAccount = {
  id: string;
  email: string | null;
  name: string;
  providerLabel: string;
  lastSignInAt: string | null;
  households: Array<{ id: string; name: string; active: boolean; role: string }>;
};

export type AdminHousehold = {
  id: string;
  name: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string | null;
  createdAt: string;
  members: Array<{ id: string; name: string; email: string | null; active: boolean; role: string }>;
};

export type AdminDashboardData = {
  adminUserId: string;
  adminEmail: string;
  accounts: AdminAccount[];
  households: AdminHousehold[];
  activeMemberships: number;
  expenseCount: number;
};

type HouseholdRow = { id: string; name: string; owner_user_id: string; created_at: string };
type MemberRow = {
  id: string;
  household_id: string;
  user_id: string;
  name: string;
  role: string;
  active: boolean;
  joined_at: string;
};

export async function requireAdmin() {
  const sessionClient = await createSessionClient();
  const { data, error } = await sessionClient.auth.getUser();

  if (error || !data.user) redirect("/");

  const allowlist = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const providers = data.user.app_metadata.providers;
  const hasGoogleIdentity = Array.isArray(providers) && providers.includes("google");

  if (
    !data.user.email ||
    !hasGoogleIdentity ||
    !allowlist.has(data.user.email.trim().toLowerCase())
  ) {
    notFound();
  }

  return data.user;
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function accountName(user: {
  user_metadata?: Record<string, unknown>;
  email?: string;
}) {
  const metadata = user.user_metadata ?? {};
  const name = [metadata.full_name, metadata.name, metadata.preferred_username].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return name?.trim() || user.email?.trim() || "İsimsiz kullanıcı";
}

async function listAllAuthUsers(client: NonNullable<ReturnType<typeof createAdminClient>>) {
  const users: User[] = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("Kullanıcı hesapları alınamadı.");
    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
}

async function listAllHouseholds(client: NonNullable<ReturnType<typeof createAdminClient>>) {
  const households: HouseholdRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("households")
      .select("id, name, owner_user_id, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Ev kayıtları alınamadı.");
    households.push(...data);
    if (data.length < pageSize) return households;
  }
}

async function listAllMembers(client: NonNullable<ReturnType<typeof createAdminClient>>) {
  const members: MemberRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("members")
      .select("id, household_id, user_id, name, role, active, joined_at")
      .order("joined_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Üyelik kayıtları alınamadı.");
    members.push(...data);
    if (data.length < pageSize) return members;
  }
}

export async function getAdminDashboardData(
  adminUserId: string,
  adminEmail: string,
): Promise<AdminDashboardData | null> {
  const client = createAdminClient();
  if (!client) return null;

  const [users, households, members, expensesResult] = await Promise.all([
    listAllAuthUsers(client),
    listAllHouseholds(client),
    listAllMembers(client),
    client.from("expenses").select("id", { count: "exact", head: true }),
  ]);

  if (expensesResult.error) throw new Error("Harcama kayıtları alınamadı.");
  const userById = new Map(users.map((user) => [user.id, user]));
  const householdById = new Map(households.map((household) => [household.id, household]));

  const accounts: AdminAccount[] = users
    .map((user) => {
      const accountMemberships = members.filter((member) => member.user_id === user.id);
      const memberName = accountMemberships.find((member) => member.name.trim())?.name;
      const metadataName = accountName(user);
      return {
        id: user.id,
        email: user.email?.trim() || null,
        name: metadataName === "İsimsiz kullanıcı" ? memberName ?? metadataName : metadataName,
        providerLabel: user.is_anonymous ? "Misafir hesabı" : "Google hesabı",
        lastSignInAt: user.last_sign_in_at ?? null,
        households: accountMemberships.flatMap((member) => {
          const household = householdById.get(member.household_id);
          return household
            ? [{ id: household.id, name: household.name, active: member.active, role: member.role }]
            : [];
        }),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "tr"));

  const admin = userById.get(adminUserId);
  const adminAccount = accounts.find((account) => account.id === adminUserId);

  const adminHouseholds: AdminHousehold[] = households.map((household) => {
    const owner = userById.get(household.owner_user_id);
    return {
      id: household.id,
      name: household.name,
      ownerUserId: household.owner_user_id,
      ownerName: owner ? accountName(owner) : "Hesabı bulunamadı",
      ownerEmail: owner?.email?.trim() || null,
      createdAt: household.created_at,
      members: members
        .filter((member) => member.household_id === household.id)
        .map((member) => ({
          id: member.id,
          name: member.name.trim() || accountName(userById.get(member.user_id) ?? {}) || "İsimsiz üye",
          email: userById.get(member.user_id)?.email?.trim() || null,
          active: member.active,
          role: member.role,
        })),
    };
  });

  return {
    adminUserId,
    adminEmail: adminAccount?.email ?? admin?.email ?? adminEmail,
    accounts,
    households: adminHouseholds,
    activeMemberships: members.filter((member) => member.active).length,
    expenseCount: expensesResult.count ?? 0,
  };
}
