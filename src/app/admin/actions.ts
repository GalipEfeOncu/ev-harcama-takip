"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, requireAdmin } from "@/lib/admin";

export type AdminActionResult = { ok: boolean; message: string };

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function updateHouseholdName(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const householdId = readString(formData, "householdId");
  const name = readString(formData, "name");

  if (!isUuid(householdId) || name.length < 2 || name.length > 80) {
    return { ok: false, message: "Ev adı 2 ile 80 karakter arasında olmalı." };
  }

  const client = createAdminClient();
  if (!client) return { ok: false, message: "Sunucu veritabanı ayarları eksik." };

  const { error } = await client.rpc("admin_update_household_name", {
    p_admin_user_id: admin.id,
    p_household_id: householdId,
    p_name: name,
  });

  if (error) {
    console.error("Admin household rename failed:", error.code ?? "unknown");
    return { ok: false, message: "Ev adı güncellenemedi. Veritabanı migration'ını kontrol edin." };
  }

  revalidatePath("/admin");
  return { ok: true, message: "Ev adı güncellendi." };
}

export async function deleteHousehold(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const householdId = readString(formData, "householdId");
  const confirmation = readString(formData, "confirmation");

  if (!isUuid(householdId) || confirmation.length < 2 || confirmation.length > 80) {
    return { ok: false, message: "Silme onayı geçerli değil." };
  }

  const client = createAdminClient();
  if (!client) return { ok: false, message: "Sunucu veritabanı ayarları eksik." };

  const { data: household, error: lookupError } = await client
    .from("households")
    .select("name")
    .eq("id", householdId)
    .maybeSingle();

  if (lookupError || !household || household.name !== confirmation) {
    return { ok: false, message: "Ev adı eşleşmedi. Listeyi yenileyip tekrar deneyin." };
  }

  const { error } = await client.rpc("admin_delete_household", {
    p_admin_user_id: admin.id,
    p_household_id: householdId,
    p_confirmation: confirmation,
  });

  if (error) {
    console.error("Admin household delete failed:", error.code ?? "unknown");
    if (error.code === "22023") {
      return { ok: false, message: "Ev adı değişmiş; listeyi yenileyip yeni adıyla tekrar onaylayın." };
    }
    return { ok: false, message: "Ev silinemedi. Veritabanı migration'ını kontrol edin." };
  }

  revalidatePath("/admin");
  return { ok: true, message: "Ev ve bu eve bağlı kayıtlar silindi." };
}

export async function deleteUser(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const userId = readString(formData, "userId");
  const confirmation = readString(formData, "confirmation");

  if (!isUuid(userId) || !confirmation) {
    return { ok: false, message: "Kullanıcı silme onayı geçerli değil." };
  }
  if (userId === admin.id) {
    return { ok: false, message: "Kendi yönetici hesabınızı silemezsiniz." };
  }

  const client = createAdminClient();
  if (!client) return { ok: false, message: "Sunucu veritabanı ayarları eksik." };

  const { data: target, error: lookupError } = await client.auth.admin.getUserById(userId);
  if (lookupError || !target.user) {
    return { ok: false, message: "Kullanıcı bulunamadı. Listeyi yenileyin." };
  }

  const targetEmail = target.user.email?.trim() || "";
  if (confirmation !== (targetEmail || target.user.id)) {
    return { ok: false, message: "Onay bilgisi eşleşmedi. Listeyi yenileyip tekrar deneyin." };
  }

  const allowlistedEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase());
  if (targetEmail && allowlistedEmails.includes(targetEmail.toLowerCase())) {
    return { ok: false, message: "Yönetici hesabı silinemez." };
  }

  const [ownership, membership] = await Promise.all([
    client.from("households").select("id", { count: "exact", head: true }).eq("owner_user_id", userId),
    client.from("members").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  if (ownership.error || membership.error || ownership.count === null || membership.count === null) {
    console.error("Admin user relationship lookup failed:", ownership.error?.code ?? membership.error?.code ?? "unknown");
    return { ok: false, message: "Kullanıcının ev bağlantıları kontrol edilemedi." };
  }
  if (ownership.count > 0 || membership.count > 0) {
    return { ok: false, message: "Bir eve sahip veya üye olan kullanıcı silinemez. Pasif üyelikler de buna dahildir." };
  }

  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) {
    console.error("Admin user delete failed:", error.code ?? "unknown");
    return { ok: false, message: "Kullanıcı silinemedi. Hesaba bağlı geçmiş kayıtlar olabilir; listeyi yenileyin." };
  }

  revalidatePath("/admin");
  return { ok: true, message: "Kullanıcı hesabı silindi." };
}
