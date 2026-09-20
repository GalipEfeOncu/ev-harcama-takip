import type { Metadata } from "next";
import { getAdminDashboardData, requireAdmin, type AdminDashboardData } from "@/lib/admin";
import AdminPanel from "./panel";
import "./admin.css";

export const metadata: Metadata = {
  title: "Yönetim — Ev Hesap",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const admin = await requireAdmin();
  let data: AdminDashboardData | null = null;
  let error: string | null = null;

  try {
    data = await getAdminDashboardData(admin.id, admin.email ?? "");
  } catch (loadError) {
    console.error("Admin dashboard data load failed:", loadError);
    error = "Veritabanı verileri alınamadı. Supabase bağlantısını ve gerekli migration'ları kontrol edin.";
  }

  return (
    <AdminPanel
      data={data}
      setupIncomplete={!data && !error}
      error={error}
    />
  );
}
