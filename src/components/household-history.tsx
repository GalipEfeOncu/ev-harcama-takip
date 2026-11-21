"use client";

import { useEffect, useState } from "react";
import { ChevronDown, History, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { loadHouseholdAuditPage, type HouseholdAuditAction, type HouseholdAuditEntry } from "@/lib/data-service";

const ACTIONS = {
  insert: "eklendi",
  update: "düzenlendi",
  delete: "silindi",
};

const ENTITIES: Record<string, string> = {
  households: "Ev",
  members: "Üyelik",
  expenses: "Harcama",
  expense_participants: "Harcama payı",
  debt_payments: "Borç ödemesi",
  settlement_runs: "Hesaplaşma dönemi",
  settlements: "Hesaplaşma transferi",
  telegram_groups: "Telegram bağlantısı",
};

const FIELDS: Record<string, string> = {
  name: "Ad",
  description: "Açıklama",
  amount_cents: "Tutar",
  share_cents: "Pay",
  category: "Kategori",
  expense_date: "Harcama tarihi",
  paid_at: "Ödeme tarihi",
  payer_member_id: "Ödeyen",
  from_member_id: "Gönderen",
  to_member_id: "Alıcı",
  member_id: "Üye",
  participants: "Harcama payları",
  role: "Rol",
  active: "Durum",
  settlement_run_id: "Hesaplaşma dönemi",
  created_at: "Oluşturulma zamanı",
  joined_at: "Katılım zamanı",
  join_code_created_at: "Davet kodunun oluşturulma zamanı",
  join_code_changed: "Davet kodu",
  title: "Telegram grubu",
  expires_at: "Kurulumun geçerlilik süresi",
  telegram_group_selected: "Grup seçimi",
  telegram_group_changed: "Telegram grubu",
  id: "Kayıt kimliği",
  household_id: "Ev kimliği",
  owner_id: "Bağlantıyı kuran hesabın kimliği",
  owner_user_id: "Ev sahibinin hesap kimliği",
  user_id: "Hesap kimliği",
  created_by_user_id: "Oluşturan hesabın kimliği",
  expense_id: "Harcama kimliği",
};

const TIMESTAMP = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "medium" });
const CALENDAR_DATE = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "UTC" });
const SNAPSHOT_METADATA = new Set(["id", "household_id", "owner_id", "owner_user_id", "user_id", "created_by_user_id", "expense_id"]);

type ShareSnapshot = { member_id: string; name: string; share_cents: number };

function displayValue(field: string, value: unknown, entry: HouseholdAuditEntry) {
  if (field === "settlement_run_id" && value === null) return "Açık";
  if (value === null || value === undefined || value === "") return "—";
  if (field === "amount_cents" || field === "share_cents") return formatCurrency(Number(value));
  if (field === "participants" && Array.isArray(value)) {
    return value.length ? (
      <ul className="household-history-shares">
        {value.map((share: ShareSnapshot) => (
          <li key={share.member_id}>{share.name} · {formatCurrency(share.share_cents)}</li>
        ))}
      </ul>
    ) : "—";
  }
  if (field.endsWith("_at") && field !== "paid_at") return TIMESTAMP.format(new Date(String(value)));
  if (field === "expense_date" || field === "paid_at") return CALENDAR_DATE.format(new Date(String(value)));
  if (field === "role") return value === "owner" ? "Ev sahibi" : "Ev üyesi";
  if (field === "join_code_changed") return "Yenilendi";
  if (field === "telegram_group_changed") return "Değişti";
  if (field === "telegram_group_selected") return value ? "Seçildi" : "Seçilmedi";
  if (typeof value === "boolean") {
    if (field === "active") return value ? "Aktif" : "Pasif";
    return value ? "Evet" : "Hayır";
  }
  if (field === "member_id" || field.endsWith("_member_id")) return entry.member_names[String(value)] ?? String(value);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function entryTitle(entry: HouseholdAuditEntry) {
  if (entry.entity === "households" && entry.after_values?.join_code_changed) return "Davet kodu yenilendi";
  if (entry.entity === "settlement_runs" && entry.action === "insert") return "Hesaplaşma dönemi kapatıldı";
  if (entry.entity === "members" && entry.action === "insert") return "Eve yeni üye katıldı";
  if (entry.entity === "expense_participants" && Array.isArray(entry.after_values?.participants)) {
    return entry.action === "insert" ? "Harcama payları eklendi" : "Harcama payı güncellendi";
  }
  if (entry.entity === "telegram_groups") {
    if (entry.action === "insert") return "Telegram kurulumu başlatıldı";
    if (entry.action === "delete") return entry.before_values?.active ? "Telegram bağlantısı kaldırıldı" : "Telegram kurulumu kaldırıldı";
    if (entry.after_values?.active) return "Telegram bağlantısı onaylandı";
    if (entry.after_values?.telegram_group_selected) return "Telegram grubu seçildi";
  }
  return `${ENTITIES[entry.entity] ?? "Kayıt"} ${ACTIONS[entry.action]}`;
}

function ShareDetails({ before, after }: { before: ShareSnapshot[] | null; after: ShareSnapshot[] }) {
  const previous = new Map(before?.map((share) => [share.member_id, share.share_cents]));
  const current = new Map(after.map((share) => [share.member_id, share.share_cents]));
  const names = new Map([...(before ?? []), ...after].map((share) => [share.member_id, share.name]));
  const members = [...names].sort(([, left], [, right]) => left.localeCompare(right, "tr"));
  const showShare = (cents: number | undefined) => cents === undefined ? "Pay yok" : formatCurrency(cents);

  return (
    <table className="household-history-values household-history-share-values">
      <thead>
        <tr>
          <th scope="col">Ev üyesi</th>
          {before && <th scope="col">Önceki pay</th>}
          <th scope="col">{before ? "Yeni pay" : "Pay"}</th>
        </tr>
      </thead>
      <tbody>
        {members.map(([id, name]) => (
          <tr key={id}>
            <th scope="row">{name}</th>
            {before && <td>{showShare(previous.get(id))}</td>}
            <td>{showShare(current.get(id))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AuditDetails({ entry }: { entry: HouseholdAuditEntry }) {
  const before = entry.before_values;
  const after = entry.after_values;
  if (entry.entity === "expense_participants" && Array.isArray(after?.participants)) {
    return <ShareDetails before={Array.isArray(before?.participants) ? before.participants : null} after={after.participants} />;
  }
  const fields = Object.keys({ ...before, ...after }).filter(
    (field) => entry.action === "update" || !SNAPSHOT_METADATA.has(field),
  );
  return (
    <table className="household-history-values">
      <thead>
        <tr>
          <th scope="col">Alan</th>
          {before && <th scope="col">{after ? "Önceki değer" : "Silinen değer"}</th>}
          {after && <th scope="col">{before ? "Yeni değer" : "Eklenen değer"}</th>}
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr key={field}>
            <th scope="row">{FIELDS[field] ?? field}</th>
            {before && <td>{displayValue(field, before[field], entry)}</td>}
            {after && <td>{displayValue(field, after[field], entry)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HistoryEntries({ householdId, action }: { householdId: string; action: HouseholdAuditAction | "" }) {
  const [entries, setEntries] = useState<HouseholdAuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const requests = new AbortController();
    loadHouseholdAuditPage(householdId, action, undefined, requests.signal).then((page) => {
      if (requests.signal.aborted) return;
      setEntries(page.entries);
      setHasMore(page.hasMore);
    }).catch(() => {
      if (!requests.signal.aborted) setFailed(true);
    }).finally(() => {
      if (!requests.signal.aborted) setLoading(false);
    });
    return () => requests.abort();
  }, [householdId, action]);

  async function loadMore() {
    setFailed(false);
    setLoading(true);
    try {
      const page = await loadHouseholdAuditPage(householdId, action, entries.at(-1)?.id);
      setEntries((current) => [...current, ...page.entries]);
      setHasMore(page.hasMore);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {entries.length > 0 && <ol className="household-history-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <details>
              <summary>
                <span className="household-history-entry">
                  <strong>{entryTitle(entry)}</strong>
                  {entry.entity_label && <span>{entry.entity_label}</span>}
                </span>
                <span className="household-history-meta">
                  <strong>{entry.actor_name}</strong>
                  <time dateTime={entry.occurred_at}>{TIMESTAMP.format(new Date(entry.occurred_at))}</time>
                </span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <AuditDetails entry={entry} />
            </details>
          </li>
        ))}
      </ol>}
      {failed && <div className="settings-error" role="alert">
        <strong>İşlem geçmişi yüklenemedi.</strong>
        <button className="settings-button" type="button" onClick={() => void loadMore()}>
          <RefreshCw size={16} aria-hidden="true" /> Tekrar dene
        </button>
      </div>}
      {loading && entries.length === 0 && <p className="settings-loading" role="status">Geçmiş yükleniyor…</p>}
      {!loading && !failed && entries.length === 0 && <div className="settings-empty">
        <History size={26} aria-hidden="true" />
        <h3>{action ? "Bu türde işlem bulunamadı." : "Henüz kayıtlı işlem yok."}</h3>
        <p>{action ? "Diğer işlemleri görmek için filtreyi değiştir." : "Evde bir değişiklik yapıldığında burada görünecek."}</p>
      </div>}
      {!failed && hasMore && <button className="settings-button household-history-more" type="button" disabled={loading} onClick={() => void loadMore()}>
        {loading ? "Yükleniyor…" : "Daha eski işlemleri göster"}
      </button>}
    </>
  );
}

export function HouseholdHistory({ householdId, householdName }: { householdId: string; householdName: string }) {
  const [action, setAction] = useState<HouseholdAuditAction | "">("");
  return (
    <section className="settings-block settings-block--first" aria-label={`${householdName} işlem geçmişi`}>
      <div className="household-history-toolbar">
        <h3>{householdName}</h3>
        <select aria-label="İşlem türü" value={action} onChange={(event) => setAction(event.target.value as HouseholdAuditAction | "")}>
          <option value="">Tüm işlemler</option>
          <option value="insert">Eklemeler</option>
          <option value="update">Düzenlemeler</option>
          <option value="delete">Silmeler</option>
        </select>
      </div>
      <HistoryEntries key={action} householdId={householdId} action={action} />
    </section>
  );
}
