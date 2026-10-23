import { FONT_OPTIONS, getTheme, THEMES } from "./appearance-catalog";

export type AppearancePreferences = {
  themeId: string;
  fontId: string;
  fontSize: "small" | "default" | "large";
  density: "comfortable" | "standard" | "compact";
  reducedMotion: boolean;
  favoriteThemes: string[];
};
export type PreferenceScope = "account" | "device";
export type PreferenceStatus = "loading" | "saved" | "saving" | "local" | "error";
export const DEFAULT_PREFERENCES: AppearancePreferences = {
  themeId: "system", fontId: "mada", fontSize: "default", density: "standard",
  reducedMotion: false, favoriteThemes: [],
};
export const PREFERENCES_KEY = "ev-hesap-appearance-v1";
const fields = Object.keys(DEFAULT_PREFERENCES) as (keyof AppearancePreferences)[];

export function normalizePreferences(value: unknown): AppearancePreferences {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const themeIds = new Set(["system", ...THEMES.map((theme) => theme.id)]);
  const fontIds = new Set(FONT_OPTIONS.map((font) => font.id));
  return {
    themeId: typeof source.themeId === "string" && themeIds.has(source.themeId) ? source.themeId : "system",
    fontId: typeof source.fontId === "string" && fontIds.has(source.fontId) ? source.fontId : "mada",
    fontSize: source.fontSize === "small" || source.fontSize === "large" ? source.fontSize : "default",
    density: source.density === "compact" || source.density === "comfortable" ? source.density : "standard",
    reducedMotion: source.reducedMotion === true,
    favoriteThemes: Array.isArray(source.favoriteThemes)
      ? [...new Set(source.favoriteThemes.filter((id): id is string => typeof id === "string" && themeIds.has(id) && id !== "system"))].slice(0, THEMES.length)
      : [],
  };
}

export function mergePreferences(base: AppearancePreferences, patch: Partial<AppearancePreferences>): AppearancePreferences {
  return normalizePreferences({ ...base, ...Object.fromEntries(Object.entries(patch).filter(([key, value]) => fields.includes(key as keyof AppearancePreferences) && value !== undefined)) });
}

type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Cache = { account: AppearancePreferences; device: AppearancePreferences | null; pending: boolean; dirtyFields: (keyof AppearancePreferences)[] };
const cacheKey = (id: string | null) => `${PREFERENCES_KEY}:${id ?? "guest"}`;

export function readPreferenceCache(storage: StorageAccess, userId: string | null): Cache {
  try {
    const saved = JSON.parse(storage.getItem(cacheKey(userId)) ?? "null");
    if (saved && typeof saved === "object") return {
      account: normalizePreferences(saved.account),
      device: saved.device && typeof saved.device === "object" ? normalizePreferences(saved.device) : null,
      pending: saved.pending === true,
      dirtyFields: saved.pending === true
        ? Array.isArray(saved.dirtyFields) ? saved.dirtyFields.filter((key: unknown) => fields.includes(key as keyof AppearancePreferences)) : [...fields]
        : [],
    };
    const legacy = storage.getItem("ev-hesap-theme");
    // The old browser-only choice belongs to the guest, never another account.
    return { account: normalizePreferences(!userId && (legacy === "light" || legacy === "dark") ? { themeId: `ev-hesap-${legacy}` } : null), device: null, pending: false, dirtyFields: [] };
  } catch {
    return { account: normalizePreferences(null), device: null, pending: false, dirtyFields: [] };
  }
}

export type PreferenceSnapshot = {
  preferences: AppearancePreferences;
  scope: PreferenceScope;
  status: PreferenceStatus;
  error: string | null;
  userId: string | null;
  canUndo: boolean;
};
type RemotePreferences = {
  load(userId: string): Promise<unknown | null>;
  save(userId: string, preferences: AppearancePreferences, signal: AbortSignal): Promise<void>;
};
type StoreOptions = {
  storage: StorageAccess;
  remote: RemotePreferences | null;
  initialUserId?: string | null;
  debounceMs?: number;
};
type UndoEntry = { target: "account" | "device" | "scope"; account: AppearancePreferences; device: AppearancePreferences | null; changedFields: (keyof AppearancePreferences)[] };

/** Per-account cache plus a serial write queue. No React or authenticated global state. */
export class PreferencesStore {
  private options: StoreOptions;
  private account: AppearancePreferences;
  private device: AppearancePreferences | null;
  private pending: boolean;
  private listeners = new Set<() => void>();
  private snapshot: PreferenceSnapshot;
  private history: UndoEntry[] = [];
  private epoch = 0;
  private revision = 0;
  private edited = new Set<keyof AppearancePreferences>();
  private loaded = false;
  private activated = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request: AbortController | undefined;
  private writingEpoch: number | null = null;
  private loadSequence = 0;
  private syncError: string | null = null;
  private storageError: string | null = null;

  constructor(options: StoreOptions) {
    this.options = options;
    const userId = options.initialUserId ?? null;
    const cache = readPreferenceCache(options.storage, userId);
    this.account = cache.account;
    this.device = cache.device;
    this.pending = cache.pending;
    this.edited = new Set(cache.dirtyFields);
    this.snapshot = { preferences: this.device ?? this.account, scope: this.device ? "device" : "account", status: options.remote ? "loading" : "local", error: null, userId, canUndo: false };
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private emit(status?: PreferenceStatus) {
    const error = this.syncError && this.storageError ? `${this.syncError} ${this.storageError}` : this.syncError ?? this.storageError;
    this.snapshot = {
      ...this.snapshot, preferences: this.device ?? this.account, scope: this.device ? "device" : "account",
      status: error ? "error" : status ?? (this.device || !this.snapshot.userId ? "local" : !this.loaded ? "loading" : this.pending ? "saving" : "saved"),
      error, canUndo: this.history.length > 0,
    };
    this.listeners.forEach((listener) => listener());
  }

  private persist() {
    try {
      this.options.storage.setItem(cacheKey(this.snapshot.userId), JSON.stringify({ account: this.account, device: this.device, pending: this.pending, dirtyFields: [...this.edited] }));
      this.storageError = null;
    } catch {
      this.storageError = "Bu tarayıcı tercihleri kaydedemedi. Ayarların bu ziyaret boyunca uygulanıyor.";
    }
  }

  private remember(target: UndoEntry["target"], changedFields: (keyof AppearancePreferences)[] = []) {
    this.history.push({ target, account: this.account, device: this.device, changedFields });
    if (this.history.length > 30) this.history.shift();
  }

  async activate(userId: string | null) {
    // Token refresh and repeated INITIAL_SESSION events must not restart a load.
    if (this.activated && userId === this.snapshot.userId) return;
    const firstActivation = !this.activated;
    this.activated = true;
    const previousId = this.snapshot.userId;
    const carry = firstActivation && !previousId && this.revision > 0 ? this.account : null;
    const carryDevice = firstActivation && !previousId ? this.device : null;
    const carryFields = carry ? [...this.edited] : [];
    const epoch = ++this.epoch;
    clearTimeout(this.timer);
    this.request?.abort();
    this.request = undefined;
    this.syncError = null;
    this.storageError = null;
    this.loaded = false;
    if (previousId !== userId) {
      // Retain this account's device setup and unsent edits for its next visit.
      // Only the current identity's key is read; no last-account fallback exists.
      const cache = readPreferenceCache(this.options.storage, userId);
      this.account = carry ? mergePreferences(cache.account, Object.fromEntries(carryFields.map((key) => [key, carry[key]]))) : cache.account;
      this.device = carryDevice ?? cache.device;
      this.pending = Boolean(carry) || cache.pending;
      this.revision = carry ? 1 : 0;
      this.edited = new Set([...cache.dirtyFields, ...carryFields]);
    }
    this.history = [];
    this.snapshot = { ...this.snapshot, userId };
    this.emit();
    if (!userId || !this.options.remote) {
      this.loaded = true;
      this.pending = false;
      this.persist();
      this.emit("local");
      return;
    }
    await this.load(epoch, userId);
  }

  private async load(epoch: number, userId: string) {
    const remote = this.options.remote;
    if (!remote) return;
    const sequence = ++this.loadSequence;
    try {
      const value = await remote.load(userId);
      if (epoch !== this.epoch || sequence !== this.loadSequence) return;
      // Merge unsent fields onto the latest server baseline, even after offline reload.
      const baseline = normalizePreferences(value);
      const editedValues = Object.fromEntries([...this.edited].map((key) => [key, this.account[key]]));
      this.account = mergePreferences(baseline, editedValues);
      this.loaded = true;
      this.syncError = null;
      this.persist();
      this.emit();
      this.schedule();
    } catch {
      if (epoch !== this.epoch || sequence !== this.loadSequence) return;
      this.syncError = "Hesap tercihleri eşitlenemedi. Seçimlerin uygulanıyor; yeniden deneyebilirsin.";
      this.persist();
      this.emit();
    }
  }

  private schedule() {
    clearTimeout(this.timer);
    if (!this.loaded || !this.pending || !this.snapshot.userId || !this.options.remote || this.syncError) return;
    this.timer = setTimeout(() => { void this.flush(); }, this.options.debounceMs ?? 450);
  }

  private async flush() {
    const epoch = this.epoch;
    const userId = this.snapshot.userId;
    const remote = this.options.remote;
    if (this.writingEpoch === epoch || !this.pending || !userId || !remote || !this.loaded) return;
    this.writingEpoch = epoch;
    const revision = this.revision;
    const preferences = this.account;
    const request = new AbortController();
    this.request = request;
    try {
      await remote.save(userId, preferences, request.signal);
      if (epoch !== this.epoch) return;
      if (revision === this.revision) {
        this.pending = false;
        this.edited.clear();
      }
      this.syncError = null;
      this.persist();
    } catch {
      if (epoch !== this.epoch) return;
      this.syncError = "Hesap tercihleri kaydedilemedi. Seçimlerin uygulanıyor; yeniden deneyebilirsin.";
    } finally {
      if (this.writingEpoch === epoch) this.writingEpoch = null;
      if (epoch === this.epoch) {
        this.request = undefined;
        this.emit();
        this.schedule();
      }
    }
  }

  updatePreferences = (patch: Partial<AppearancePreferences>) => {
    const next = mergePreferences(this.device ?? this.account, patch);
    if (JSON.stringify(next) === JSON.stringify(this.snapshot.preferences)) return;
    const changedFields = fields.filter((key) => JSON.stringify(next[key]) !== JSON.stringify(this.snapshot.preferences[key]));
    this.remember(this.device ? "device" : "account", changedFields);
    if (this.device) this.device = next;
    else {
      for (const key of fields) if (JSON.stringify(next[key]) !== JSON.stringify(this.account[key])) this.edited.add(key);
      this.account = next;
      this.revision++;
      this.pending = Boolean(this.snapshot.userId && this.options.remote) || !this.activated;
    }
    this.persist();
    this.emit();
    this.schedule();
  };

  setScope = (scope: PreferenceScope) => {
    if (scope === this.snapshot.scope) return;
    this.remember("scope");
    this.device = scope === "device" ? normalizePreferences(this.account) : null;
    this.persist();
    this.emit();
  };

  resetPreferences = () => this.updatePreferences(normalizePreferences(null));

  undo = () => {
    const previous = this.history.pop();
    if (!previous) return;
    if (previous.target === "account") {
      this.account = mergePreferences(this.account, Object.fromEntries(previous.changedFields.map((key) => [key, previous.account[key]])));
      this.revision++;
      previous.changedFields.forEach((key) => this.edited.add(key));
      this.pending = Boolean(this.snapshot.userId && this.options.remote) || !this.activated;
    }
    if (previous.target !== "account") this.device = previous.device;
    this.persist();
    this.emit();
    this.schedule();
  };

  retry = () => {
    this.syncError = null;
    this.persist();
    this.emit();
    if (this.snapshot.userId && !this.loaded) void this.load(this.epoch, this.snapshot.userId);
    else this.schedule();
  };

  failAuth = () => {
    this.syncError = "Hesap oturumu doğrulanamadı. Tercihlerin bu cihazda uygulanıyor; yeniden deneyebilirsin.";
    this.emit();
  };

  dispose = () => {
    ++this.epoch;
    clearTimeout(this.timer);
    this.request?.abort();
    // Strict Mode may reconnect the same provider instance.
    this.activated = false;
  };
}

export function applyPreferences(preferences: AppearancePreferences, systemDark: boolean) {
  const root = document.documentElement;
  const theme = getTheme(preferences.themeId, systemDark);
  for (const [token, value] of Object.entries(theme.tokens)) root.style.setProperty(token, value);
  root.dataset.theme = theme.mode;
  root.dataset.themeChoice = preferences.themeId;
  root.dataset.fontId = preferences.fontId;
  root.dataset.fontSize = preferences.fontSize;
  root.dataset.density = preferences.density;
  root.dataset.reducedMotion = String(preferences.reducedMotion);
  const font = FONT_OPTIONS.find((entry) => entry.id === preferences.fontId) ?? FONT_OPTIONS[0];
  root.style.setProperty("--font-selected", font.family);
  root.style.colorScheme = theme.mode;
  if (font.url && !document.getElementById(`appearance-font-${font.id}`)) {
    const link = document.createElement("link");
    link.id = `appearance-font-${font.id}`;
    link.rel = "stylesheet";
    link.href = font.url;
    document.head.appendChild(link);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.tokens["--background"] ?? theme.tokens["--bg"] ?? (theme.mode === "dark" ? "#121412" : "#F6F5F2"));
}

/** Read only the current session's identity; never a remembered last account. */
export function getBootstrapUserId(sessionKey: string | null): string | null {
  if (!sessionKey) return null;
  try {
    const parts = document.cookie.split(";").map((entry) => {
      const at = entry.indexOf("=");
      return { name: entry.slice(0, at).trim(), value: decodeURIComponent(entry.slice(at + 1)) };
    }).filter(({ name }) => name === sessionKey || new RegExp(`^${sessionKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d+$`).test(name));
    let encoded = parts.find(({ name }) => name === sessionKey)?.value;
    if (!encoded) encoded = parts.sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop())).map(({ value }) => value).join("");
    if (!encoded) return null;
    const session = JSON.parse(encoded.startsWith("base64-") ? atob(encoded.slice(7).replace(/-/g, "+").replace(/_/g, "/")) : encoded);
    if (typeof session.expires_at !== "number" || session.expires_at * 1000 <= Date.now()) return null;
    return typeof session.user?.id === "string" ? session.user.id : null;
  } catch { return null; }
}

export function getAuthSessionKey(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try { return url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : null; } catch { return null; }
}

/** Inline in <head> before first paint. Catalog values are trusted source constants. */
export function getPreferencesBootstrapScript(): string {
  const payload = JSON.stringify({ themes: THEMES, fonts: FONT_OPTIONS, key: PREFERENCES_KEY, sessionKey: getAuthSessionKey(), defaults: DEFAULT_PREFERENCES }).replace(/</g, "\\u003c");
  return `(()=>{try{const config=${payload};const getId=${getBootstrapUserId.toString()};const id=getId(config.sessionKey);let saved=null,legacy=null;try{saved=JSON.parse(localStorage.getItem(config.key+":"+(id||"guest"))||"null");if(!id)legacy=localStorage.getItem("ev-hesap-theme")}catch(_){}let p=saved?.device||saved?.account||config.defaults;if(!saved&&!id){if(legacy==="light"||legacy==="dark")p={...p,themeId:"ev-hesap-"+legacy}}const dark=matchMedia("(prefers-color-scheme: dark)").matches;const choice=p.themeId==="system"?"system":config.themes.some(t=>t.id===p.themeId)?p.themeId:"system";const theme=config.themes.find(t=>t.id===(choice==="system"?(dark?"ev-hesap-dark":"ev-hesap-light"):choice))||config.themes[0];const root=document.documentElement;Object.entries(theme.tokens).forEach(([k,v])=>root.style.setProperty(k,v));root.dataset.theme=theme.mode;root.dataset.themeChoice=choice;const font=config.fonts.find(f=>f.id===p.fontId)||config.fonts[0];root.dataset.fontId=font.id;root.dataset.fontSize=["small","large"].includes(p.fontSize)?p.fontSize:"default";root.dataset.density=["compact","comfortable"].includes(p.density)?p.density:"standard";root.dataset.reducedMotion=String(p.reducedMotion===true);root.style.setProperty("--font-selected",font.family);root.style.colorScheme=theme.mode;if(font.url){const link=document.createElement("link");link.id="appearance-font-"+font.id;link.rel="stylesheet";link.href=font.url;document.head.appendChild(link)}document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme.tokens["--background"]||theme.tokens["--bg"]||(theme.mode==="dark"?"#121412":"#F6F5F2"))}catch(_){}})()`;
}
