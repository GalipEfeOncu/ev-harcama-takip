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
