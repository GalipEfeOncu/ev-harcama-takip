"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  House,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteHousehold, updateHouseholdName, type AdminActionResult } from "./actions";
import type { AdminDashboardData, AdminHousehold } from "@/lib/admin";

type AdminPanelProps = {
  data: AdminDashboardData | null;
  setupIncomplete: boolean;
  error: string | null;
};

type EditingHousehold = { id: string; name: string };

function formatDate(value: string | null) {
  if (!value) return "Henüz giriş yok";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(value));
}

function HouseholdNames({ households }: { households: AdminDashboardData["accounts"][number]["households"] }) {
  if (households.length === 0) return <span className="admin-muted">Bir eve bağlı değil</span>;

  return (
    <ul className="admin-household-chips" aria-label="Üye olduğu evler">
      {households.map((household) => (
        <li key={household.id} className={household.active ? "" : "is-inactive"}>
          <House size={14} aria-hidden="true" />
          <span>{household.name}</span>
          {household.role === "owner" ? (
            <span className="admin-chip-status">sahibi</span>
          ) : !household.active ? (
            <span className="admin-chip-status">pasif</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function HouseholdRow({
  household,
  editing,
  busy,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  household: AdminHousehold;
  editing: boolean;
  busy: boolean;
  onEdit: (household: AdminHousehold) => void;
  onCancelEdit: () => void;
  onSave: (householdId: string, name: string) => void;
  onDelete: (household: AdminHousehold, trigger: HTMLButtonElement) => void;
}) {
  const [name, setName] = useState(household.name);
  const activeMembers = household.members.filter((member) => member.active).length;

  return (
    <article className="admin-house-row">
      <div className="admin-house-primary">
        <div className="admin-house-mark" aria-hidden="true"><House size={19} /></div>
        <div className="admin-house-copy">
          {editing ? (
            <form
              className="admin-inline-edit"
              onSubmit={(event) => {
                event.preventDefault();
                onSave(household.id, name);
              }}
            >
              <label className="visually-hidden" htmlFor={`house-name-${household.id}`}>Ev adı</label>
              <input
                id={`house-name-${household.id}`}
                autoFocus
                maxLength={80}
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <button type="submit" className="admin-icon-action" aria-label="Ev adını kaydet" disabled={busy || name.trim().length < 2}>
                <Check size={17} aria-hidden="true" />
              </button>
              <button type="button" className="admin-icon-action" aria-label="Düzenlemeyi iptal et" onClick={onCancelEdit} disabled={busy}>
                <X size={17} aria-hidden="true" />
              </button>
            </form>
          ) : (
            <>
              <h3>{household.name}</h3>
              <p>{activeMembers} aktif üye · {household.members.length} toplam üyelik</p>
            </>
          )}
        </div>
      </div>
      <div className="admin-house-owner">
        <span className="admin-mobile-label">Ev sahibi</span>
        <strong>{household.ownerName}</strong>
        <span>{household.ownerEmail ?? "E-posta yok"}</span>
      </div>
      <div className="admin-house-created">
        <span className="admin-mobile-label">Oluşturulma</span>
        <span>{formatDate(household.createdAt)}</span>
      </div>
      <div className="admin-house-actions" aria-label={`${household.name} evi işlemleri`}>
        {!editing && (
          <button type="button" className="admin-row-action" onClick={() => onEdit(household)}>
            <Pencil size={16} aria-hidden="true" /> <span>Adı düzenle</span>
          </button>
        )}
        <button
          type="button"
          className="admin-row-action admin-row-action--danger"
          onClick={(event) => onDelete(household, event.currentTarget)}
          disabled={busy}
        >
          <Trash2 size={16} aria-hidden="true" /> <span>Evi sil</span>
        </button>
      </div>
    </article>
  );
}

export default function AdminPanel({ data, setupIncomplete, error }: AdminPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"households" | "users">("households");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EditingHousehold | null>(null);
  const [deleting, setDeleting] = useState<AdminHousehold | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const householdsTabRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const wasDialogOpenRef = useRef(false);
  const isDialogOpen = deleting !== null;

  useEffect(() => {
    if (wasDialogOpenRef.current && !isDialogOpen) {
      window.requestAnimationFrame(() => {
        if (deleteTriggerRef.current?.isConnected) deleteTriggerRef.current.focus();
        else householdsTabRef.current?.focus();
      });
    }
    wasDialogOpenRef.current = isDialogOpen;
  }, [isDialogOpen]);

  useEffect(() => {
    if (!isDialogOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    cancelRef.current?.focus();

    function handleKeys(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        event.preventDefault();
        setDeleting(null);
        setConfirmation("");
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

    document.addEventListener("keydown", handleKeys);
    return () => document.removeEventListener("keydown", handleKeys);
  }, [isDialogOpen, isPending]);

  useEffect(() => {
    if (!isDialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isDialogOpen]);

  if (setupIncomplete || !data) {
    return (
      <main className="admin-shell">
        <AdminHeader email="" />
        <section className="admin-setup-note" aria-labelledby="admin-setup-title">
          <ShieldCheck size={23} aria-hidden="true" />
          <h1 id="admin-setup-title">{error ? "Veritabanı bağlantısı kurulamadı" : "Yönetim ayarları tamamlanmalı"}</h1>
          {error ? (
            <p>{error}</p>
          ) : (
            <p>Veritabanı görünümü için sunucuda <code>SUPABASE_SECRET_KEY</code> tanımlanmalı. Admin Google e-postası da <code>ADMIN_EMAILS</code> listesine eklenmeli.</p>
          )}
          <Link href="/dashboard" className="admin-back-link"><ArrowLeft size={17} aria-hidden="true" /> Uygulamaya dön</Link>
        </section>
      </main>
    );
  }

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const visibleHouseholds = data.households.filter((household) =>
    [household.name, household.ownerName, household.ownerEmail ?? ""]
      .join(" ")
      .toLocaleLowerCase("tr-TR")
      .includes(normalizedQuery),
  );
  const visibleAccounts = data.accounts.filter((account) =>
    [account.name, account.email ?? "", ...account.households.map((household) => household.name)]
      .join(" ")
      .toLocaleLowerCase("tr-TR")
      .includes(normalizedQuery),
  );

  function handleEdit(householdId: string, name: string) {
    if (isPending) return;
    const formData = new FormData();
    formData.set("householdId", householdId);
    formData.set("name", name.trim());
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await updateHouseholdName(formData);
        setFeedback(result);
        if (result.ok) setEditing(null);
      } catch {
        setFeedback({ ok: false, message: "Ev adı güncellenemedi. Bağlantıyı kontrol edip tekrar deneyin." });
      } finally {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!deleting || isPending) return;
    const formData = new FormData();
    formData.set("householdId", deleting.id);
    formData.set("confirmation", confirmation.trim());
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await deleteHousehold(formData);
        setFeedback(result);
        if (result.ok) {
          setDeleting(null);
          setConfirmation("");
        }
      } catch {
        setFeedback({ ok: false, message: "Ev silinemedi. Bağlantıyı kontrol edip tekrar deneyin." });
      } finally {
        router.refresh();
      }
    });
  }

  return (
    <main className="admin-shell">
      <AdminHeader email={data.adminEmail} />

      <section className="admin-heading">
        <div>
          <h1>Veri yönetimi</h1>
          <p>Kullanıcı hesaplarını, evleri ve üyelikleri buradan yönetin.</p>
        </div>
        <div className="admin-database-status"><span aria-hidden="true" /> Supabase bağlantısı etkin</div>
      </section>

      <section className="admin-summary" aria-label="Veritabanı özeti">
        <span><strong>{data.accounts.length}</strong> kayıtlı kullanıcı</span>
        <span><strong>{data.households.length}</strong> ev</span>
        <span><strong>{data.activeMemberships}</strong> aktif üyelik</span>
        <span><strong>{data.expenseCount}</strong> harcama</span>
      </section>

      <section className="admin-workspace" aria-label="Yönetim kayıtları">
        <div className="admin-toolbar">
          <div className="admin-tabs" role="group" aria-label="Kayıt türü">
            <button
              type="button"
              ref={householdsTabRef}
              aria-pressed={activeTab === "households"}
              onClick={() => setActiveTab("households")}
            >
              Evler <span>{data.households.length}</span>
            </button>
            <button
              type="button"
              aria-pressed={activeTab === "users"}
              onClick={() => setActiveTab("users")}
            >
              Kullanıcılar <span>{data.accounts.length}</span>
            </button>
          </div>
          <label className="admin-search">
            <Search size={18} aria-hidden="true" />
            <span className="visually-hidden">{activeTab === "households" ? "Evlerde ara" : "Kullanıcılarda ara"}</span>
            <input
              type="search"
              placeholder={activeTab === "households" ? "Ev, ev sahibi ara" : "Ad, e-posta veya ev ara"}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && <button type="button" aria-label="Aramayı temizle" onClick={() => setQuery("")}><X size={16} /></button>}
          </label>
        </div>

        {feedback && <p className={`admin-feedback ${feedback.ok ? "is-success" : "is-error"}`} role={feedback.ok ? "status" : "alert"}>{feedback.message}</p>}
        {error && <p className="admin-feedback is-error" role="alert">{error}</p>}

        {activeTab === "households" ? (
          <div className="admin-record-list">
            {visibleHouseholds.length > 0 ? visibleHouseholds.map((household) => (
              <HouseholdRow
                key={`${household.id}-${editing?.id === household.id ? "editing" : "viewing"}`}
                household={household}
                editing={editing?.id === household.id}
                busy={isPending}
                onEdit={(item) => { setFeedback(null); setEditing({ id: item.id, name: item.name }); }}
                onCancelEdit={() => setEditing(null)}
                onSave={handleEdit}
                onDelete={(item, trigger) => { deleteTriggerRef.current = trigger; setEditing(null); setDeleting(item); setConfirmation(""); }}
              />
            )) : <EmptyState label={query ? "Aramayla eşleşen ev yok." : "Henüz ev oluşturulmamış."} />}
          </div>
        ) : (
          <div className="admin-user-list">
            {visibleAccounts.length > 0 ? visibleAccounts.map((account) => (
              <article className="admin-user-row" key={account.id}>
                <div className="admin-user-primary">
                  <div className="admin-user-mark" aria-hidden="true">{account.name.trim().slice(0, 1).toLocaleUpperCase("tr-TR")}</div>
                  <div className="admin-user-copy">
                    <div className="admin-user-name"><h3>{account.name}</h3><span>{account.providerLabel}</span></div>
                    <p>{account.email ?? "E-posta hesabı yok"}</p>
                  </div>
                </div>
                <div className="admin-user-homes"><span className="admin-mobile-label">Üye olduğu evler</span><HouseholdNames households={account.households} /></div>
                <div className="admin-user-seen"><span className="admin-mobile-label">Son giriş</span><span>{formatDate(account.lastSignInAt)}</span></div>
              </article>
            )) : <EmptyState label={query ? "Aramayla eşleşen kullanıcı yok." : "Henüz kullanıcı hesabı yok."} />}
          </div>
        )}
      </section>

      <footer className="admin-footer">
        <span><ShieldCheck size={16} aria-hidden="true" /> Yalnızca izin listesindeki Google hesabı bu sayfayı açabilir.</span>
        <Link href="/dashboard">Uygulamaya dön <ChevronRight size={16} aria-hidden="true" /></Link>
      </footer>

      {deleting && (
        <div className="admin-dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) setDeleting(null); }}>
          <div className="admin-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title" aria-describedby="admin-delete-description" ref={dialogRef}>
            <div className="admin-delete-mark"><Trash2 size={21} aria-hidden="true" /></div>
            <h2 id="admin-delete-title">Bu evi kalıcı olarak sil?</h2>
            <p id="admin-delete-description"><strong>{deleting.name}</strong> evi, tüm üyelikleri, harcamaları ve ödeme kayıtlarıyla birlikte silinecek. Bu işlem geri alınamaz.</p>
            <label htmlFor="admin-delete-confirm">Onaylamak için ev adını yazın</label>
            <input
              id="admin-delete-confirm"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && confirmation.trim() === deleting.name) handleDelete(); }}
            />
            {feedback && !feedback.ok && <p className="admin-dialog-error" role="alert">{feedback.message}</p>}
            <div className="admin-dialog-actions">
              <button type="button" className="admin-secondary-button" ref={cancelRef} onClick={() => { setDeleting(null); setConfirmation(""); }} disabled={isPending}>Vazgeç</button>
              <button type="button" className="admin-delete-button" onClick={handleDelete} disabled={isPending || confirmation.trim() !== deleting.name}>
                <Trash2 size={17} aria-hidden="true" /> {isPending ? "Siliniyor…" : "Evi ve kayıtları sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function AdminHeader({ email }: { email: string }) {
  return (
    <header className="admin-topbar">
      <Link href="/dashboard" className="admin-brand">
        <span className="admin-brand-mark"><House size={20} aria-hidden="true" /></span>
        <span>Ev Hesap</span>
        <span className="admin-brand-divider" aria-hidden="true" />
        <span className="admin-brand-label">Yönetim</span>
      </Link>
      <div className="admin-header-actions">
        {email && <span className="admin-identity"><ShieldCheck size={16} aria-hidden="true" /> {email}</span>}
        <Link href="/dashboard" className="admin-back-link"><ArrowLeft size={16} aria-hidden="true" /><span>Uygulamaya dön</span></Link>
      </div>
    </header>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="admin-empty-state"><Users size={20} aria-hidden="true" /><p>{label}</p></div>;
}
