import { afterEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import {
  DEFAULT_PREFERENCES, getBootstrapUserId, getPreferencesBootstrapScript, mergePreferences, normalizePreferences,
  PREFERENCES_KEY, PreferencesStore,
} from "./preferences";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("appearance sanitation", () => {
  it("ignores unrecognized values, strips extra fields and deduplicates known favorites", () => {
    expect(normalizePreferences({ themeId: "javascript:bad", fontId: "unknown", fontSize: 50, density: "tiny", reducedMotion: "true", favoriteThemes: ["ev-hesap-dark", "ev-hesap-dark", "invalid", "system", 1], extra: "ignored" })).toEqual({ ...DEFAULT_PREFERENCES, favoriteThemes: ["ev-hesap-dark"] });
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });
  it("retains independent font and layout choices when changing themes", () => {
    const base = normalizePreferences({ fontSize: "large", density: "compact", reducedMotion: true });
    expect(mergePreferences(base, { themeId: "ev-hesap-dark", fontSize: undefined })).toEqual({ ...base, themeId: "ev-hesap-dark" });
  });
});

describe("account and device preferences", () => {
  it("keeps device edits local and restores the unchanged account baseline", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load: async () => ({ themeId: "ev-hesap-dark", fontSize: "large" }), save } });
    await store.activate("alice");
    store.setScope("device");
    store.updatePreferences({ density: "compact", themeId: "ev-hesap-light" });
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
    expect(store.getSnapshot().scope).toBe("device");
    store.setScope("account");
    expect(store.getSnapshot().preferences).toEqual({ ...DEFAULT_PREFERENCES, themeId: "ev-hesap-dark", fontSize: "large" });
    store.undo();
    expect(store.getSnapshot().preferences.density).toBe("compact");
    store.dispose();
  });
  it("merges late remote data with only the fields edited during initial loading", async () => {
    vi.useFakeTimers();
    const load = deferred<unknown>();
    const save = vi.fn(async () => {});
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load: () => load.promise, save } });
    const activation = store.activate("alice");
    store.updatePreferences({ themeId: "ev-hesap-dark" });
    load.resolve({ themeId: "ev-hesap-light", fontSize: "large", density: "compact" });
    await activation;
    expect(store.getSnapshot().preferences).toMatchObject({ themeId: "ev-hesap-dark", fontSize: "large", density: "compact" });
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledWith("alice", expect.objectContaining({ themeId: "ev-hesap-dark", fontSize: "large" }), expect.any(AbortSignal));
    expect(store.getSnapshot().status).toBe("saved");
    store.dispose();
  });
  it("preserves a change made before the initial session resolves", async () => {
    vi.useFakeTimers();
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load: async () => ({ fontSize: "large" }), save: async () => {} } });
    store.updatePreferences({ themeId: "ev-hesap-dark" });
    await store.activate("alice");
    expect(store.getSnapshot().preferences.themeId).toBe("ev-hesap-dark");
    store.dispose();
  });
  it("does not let undoing a scope switch revert a late remote account baseline", async () => {
    const load = deferred<unknown>();
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load: () => load.promise, save: async () => {} } });
    const activation = store.activate("alice");
    store.setScope("device");
    load.resolve({ themeId: "ev-hesap-dark", fontSize: "large" });
    await activation;
    store.undo();
    expect(store.getSnapshot().scope).toBe("account");
    expect(store.getSnapshot().preferences).toMatchObject({ themeId: "ev-hesap-dark", fontSize: "large" });
    store.dispose();
  });
  it("undoes only edited fields when remote baseline arrives after the edit", async () => {
    const load = deferred<unknown>();
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load: () => load.promise, save: async () => {} } });
    const activation = store.activate("alice");
    store.updatePreferences({ themeId: "carbon" });
    load.resolve({ fontSize: "large", density: "compact" });
    await activation;
    store.undo();
    expect(store.getSnapshot().preferences).toMatchObject({ themeId: "system", fontSize: "large", density: "compact" });
    store.dispose();
  });
  it("can reconnect the store after Strict Mode effect cleanup", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load: async () => null, save } });
    await store.activate("alice");
    store.updatePreferences({ themeId: "carbon" });
    store.dispose();
    await store.activate("alice");
    await vi.runAllTimersAsync();
    expect(store.getSnapshot()).toMatchObject({ status: "saved", preferences: { themeId: "carbon" } });
    expect(save).toHaveBeenCalledTimes(1);
    store.dispose();
  });
  it("serializes saves, so a slow response cannot overwrite a newer selection", async () => {
    vi.useFakeTimers();
    const firstSave = deferred<void>();
    const save = vi.fn().mockImplementationOnce(() => firstSave.promise).mockResolvedValue(undefined);
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load: async () => null, save } });
    await store.activate("alice");
    store.updatePreferences({ themeId: "ev-hesap-dark" });
    await vi.advanceTimersByTimeAsync(500);
    store.updatePreferences({ fontSize: "large" });
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().preferences.fontSize).toBe("large");
    firstSave.resolve();
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][1]).toMatchObject({ themeId: "ev-hesap-dark", fontSize: "large" });
    expect(store.getSnapshot().status).toBe("saved");
    store.dispose();
  });
  it("cancels outgoing queued writes and ignores late loads after switching accounts", async () => {
    vi.useFakeTimers();
    const aliceLoad = deferred<unknown>();
    const save = vi.fn(async () => {});
    const storage = memoryStorage();
    const store = new PreferencesStore({ storage, remote: { load: (id) => id === "alice" ? aliceLoad.promise : Promise.resolve({ themeId: "ev-hesap-light" }), save } });
    const first = store.activate("alice");
    store.updatePreferences({ themeId: "ev-hesap-dark" });
    await store.activate("bob");
    aliceLoad.resolve({ themeId: "ev-hesap-dark" });
    await first;
    await vi.runAllTimersAsync();
    expect(store.getSnapshot()).toMatchObject({ userId: "bob", preferences: { themeId: "ev-hesap-light" }, canUndo: false });
    expect(save).not.toHaveBeenCalled();
    expect(JSON.parse(storage.getItem(`${PREFERENCES_KEY}:alice`)!).account.themeId).toBe("ev-hesap-dark");
    store.dispose();
  });
  it("restores Alice's device override after signout without showing it to Bob", async () => {
    const store = new PreferencesStore({ storage: memoryStorage(), remote: {
      load: async (id) => ({ themeId: id === "alice" ? "ev-hesap-dark" : "sage" }),
      save: async () => {},
    } });
    await store.activate("alice");
    store.setScope("device");
    store.updatePreferences({ themeId: "carbon", density: "compact", fontSize: "large" });
    await store.activate(null);
    expect(store.getSnapshot()).toMatchObject({ userId: null, scope: "account", preferences: DEFAULT_PREFERENCES });
    await store.activate("bob");
    expect(store.getSnapshot()).toMatchObject({ userId: "bob", scope: "account", preferences: { themeId: "sage", density: "standard", fontSize: "default" } });
    await store.activate("alice");
    expect(store.getSnapshot()).toMatchObject({ userId: "alice", scope: "device", preferences: { themeId: "carbon", density: "compact", fontSize: "large" } });
    store.setScope("account");
    expect(store.getSnapshot().preferences.themeId).toBe("ev-hesap-dark");
    store.dispose();
  });
  it("retains Alice's pending edit across switching accounts and retries only under Alice", async () => {
    vi.useFakeTimers();
    const first = deferred<void>();
    const save = vi.fn().mockImplementationOnce(() => first.promise).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load: async (id) => ({ themeId: id === "alice" ? "ev-hesap-light" : "sage", fontSize: "large" }), save } });
    await store.activate("alice");
    store.updatePreferences({ themeId: "carbon" });
    await vi.advanceTimersByTimeAsync(500);
    const outgoingSignal = save.mock.calls[0][2] as AbortSignal;
    await store.activate(null);
    await store.activate("bob");
    expect(outgoingSignal.aborted).toBe(true);
    first.resolve();
    await vi.runAllTimersAsync();
    expect(store.getSnapshot()).toMatchObject({ userId: "bob", status: "saved", preferences: { themeId: "sage" } });
    expect(save).toHaveBeenCalledTimes(1);
    await store.activate("alice");
    expect(store.getSnapshot().preferences).toMatchObject({ themeId: "carbon", fontSize: "large" });
    await vi.runAllTimersAsync();
    expect(store.getSnapshot().status).toBe("error");
    store.retry();
    await vi.runAllTimersAsync();
    expect(store.getSnapshot()).toMatchObject({ userId: "alice", status: "saved", preferences: { themeId: "carbon", fontSize: "large" } });
    expect(save.mock.calls.map(([id]) => id)).toEqual(["alice", "alice", "alice"]);
    store.dispose();
  });
  it("aborts in-flight writes on signout and never adopts their completion", async () => {
    vi.useFakeTimers();
    const saving = deferred<void>();
    const save = vi.fn(() => saving.promise);
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load: async () => null, save } });
    await store.activate("alice");
    store.updatePreferences({ themeId: "ev-hesap-dark" });
    await vi.advanceTimersByTimeAsync(500);
    await store.activate(null);
    expect((save.mock.calls[0] as unknown as [string, unknown, AbortSignal])[2].aborted).toBe(true);
    saving.resolve();
    await vi.runAllTimersAsync();
    expect(store.getSnapshot()).toMatchObject({ userId: null, status: "local", preferences: DEFAULT_PREFERENCES });
    store.dispose();
  });
  it("keeps local selections on missing migration and retries loading before saving", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValueOnce(new Error("missing table")).mockResolvedValue({ fontSize: "large" });
    const save = vi.fn(async () => {});
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load, save } });
    await store.activate("alice");
    store.updatePreferences({ themeId: "ev-hesap-dark" });
    expect(store.getSnapshot()).toMatchObject({ status: "error", preferences: { themeId: "ev-hesap-dark" } });
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
    store.retry();
    await vi.runAllTimersAsync();
    expect(load).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().status).toBe("saved");
    store.dispose();
  });
  it("ignores an older load failure after a newer retry succeeds", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const load = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const store = new PreferencesStore({ storage: memoryStorage(), remote: { load, save: async () => {} } });
    const initial = store.activate("alice");
    store.retry();
    second.resolve({ themeId: "carbon" });
    await Promise.resolve();
    first.reject(new Error("stale failure"));
    await initial;
    expect(store.getSnapshot()).toMatchObject({ status: "saved", error: null, preferences: { themeId: "carbon" } });
    store.dispose();
  });
  it("keeps a failed save pending across reload and retries explicitly", async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const remote = { load: async () => ({ themeId: "ev-hesap-light" }), save };
    const store = new PreferencesStore({ storage, remote });
    await store.activate("alice");
    store.updatePreferences({ themeId: "ev-hesap-dark" });
    await vi.runAllTimersAsync();
    expect(store.getSnapshot()).toMatchObject({ status: "error", preferences: { themeId: "ev-hesap-dark" } });
    expect(JSON.parse(storage.getItem(`${PREFERENCES_KEY}:alice`)!).pending).toBe(true);
    store.retry();
    await vi.runAllTimersAsync();
    expect(store.getSnapshot().status).toBe("saved");
    store.dispose();
  });
  it("reports storage failure while retaining this visit's chosen appearance", async () => {
    const store = new PreferencesStore({ storage: { getItem: () => null, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} }, remote: null });
    await store.activate(null);
    store.updatePreferences({ themeId: "ev-hesap-dark" });
    expect(store.getSnapshot()).toMatchObject({ status: "error", preferences: { themeId: "ev-hesap-dark" } });
    store.dispose();
  });
  it("migrates the old theme for guests without copying it into another account", async () => {
    const storage = memoryStorage();
    storage.setItem("ev-hesap-theme", "dark");
    const store = new PreferencesStore({ storage, remote: { load: async () => null, save: async () => {} } });
    expect(store.getSnapshot().preferences.themeId).toBe("ev-hesap-dark");
    await store.activate("alice");
    expect(store.getSnapshot().preferences.themeId).toBe("system");
    store.dispose();
  });
});

describe("bootstrap account identity", () => {
  it("uses only the current unexpired cookie, including chunked sessions", () => {
    const encoded = "base64-" + btoa(JSON.stringify({ user: { id: "alice" }, expires_at: Math.ceil(Date.now() / 1000) + 3600 }));
    const cut = Math.floor(encoded.length / 2);
    vi.stubGlobal("document", { cookie: `sb-project-auth-token.1=${encoded.slice(cut)}; sb-project-auth-token.0=${encoded.slice(0, cut)}` });
    expect(getBootstrapUserId("sb-project-auth-token")).toBe("alice");
    expect(getBootstrapUserId("sb-other-auth-token")).toBeNull();
  });
  it("fails safely for expired, absent and malformed sessions", () => {
    vi.stubGlobal("document", { cookie: `sb-project-auth-token=${encodeURIComponent(JSON.stringify({ user: { id: "alice" }, expires_at: 1 }))}` });
    expect(getBootstrapUserId("sb-project-auth-token")).toBeNull();
    vi.stubGlobal("document", { cookie: "sb-project-auth-token=broken" });
    expect(getBootstrapUserId("sb-project-auth-token")).toBeNull();
    expect(getBootstrapUserId(null)).toBeNull();
  });
});

describe("first-paint bootstrap", () => {
  function runBootstrap(storage: ReturnType<typeof memoryStorage>, dark: boolean, cookie = "") {
    const dataset: Record<string, string> = {};
    const tokens: Record<string, string> = {};
    const meta: Record<string, string> = {};
    const document = {
      cookie, documentElement: { dataset, style: { setProperty: (key: string, value: string) => { tokens[key] = value; } } },
      querySelector: () => ({ setAttribute: (key: string, value: string) => { meta[key] = value; } }),
      createElement: () => ({}), head: { appendChild: () => {} },
    };
    runInNewContext(getPreferencesBootstrapScript(), { document, localStorage: storage, matchMedia: () => ({ matches: dark }), atob, Date });
    return { dataset, tokens, meta };
  }
  it("resolves system dark using the actual default catalog id", () => {
    const result = runBootstrap(memoryStorage(), true);
    expect(result.dataset).toMatchObject({ theme: "dark", themeChoice: "system", fontId: "mada" });
    expect(result.tokens["--bg"]).toBe("#121412");
    expect(result.meta.content).toBe("#121412");
  });
  it("still applies system appearance before paint when browser storage is blocked", () => {
    const storage = memoryStorage();
    storage.getItem = () => { throw new Error("blocked"); };
    expect(runBootstrap(storage, true).dataset).toMatchObject({ theme: "dark", themeChoice: "system" });
  });
  it("migrates an old light/dark choice to its corresponding preset before paint", () => {
    const storage = memoryStorage();
    storage.setItem("ev-hesap-theme", "dark");
    expect(runBootstrap(storage, false).dataset).toMatchObject({ theme: "dark", themeChoice: "ev-hesap-dark" });
  });
  it("applies the matching account device override without using another account's cache", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const storage = memoryStorage();
    storage.setItem(`${PREFERENCES_KEY}:alice`, JSON.stringify({ account: { themeId: "ev-hesap-light" }, device: { themeId: "carbon", fontSize: "large", density: "compact" } }));
    storage.setItem(`${PREFERENCES_KEY}:bob`, JSON.stringify({ account: { themeId: "ev-hesap-dark" } }));
    const cookie = "sb-project-auth-token=base64-" + btoa(JSON.stringify({ user: { id: "alice" }, expires_at: Math.ceil(Date.now() / 1000) + 3600 }));
    expect(runBootstrap(storage, false, cookie).dataset).toMatchObject({ themeChoice: "carbon", fontSize: "large", density: "compact" });
    expect(runBootstrap(storage, false).dataset.themeChoice).toBe("system");
  });
});
