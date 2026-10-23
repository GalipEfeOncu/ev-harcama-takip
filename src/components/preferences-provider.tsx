"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  applyPreferences, DEFAULT_PREFERENCES, getAuthSessionKey, getBootstrapUserId,
  PreferencesStore, type AppearancePreferences, type PreferenceScope, type PreferenceSnapshot,
} from "@/lib/preferences";

type PreferencesContextValue = PreferenceSnapshot & {
  setScope(scope: PreferenceScope): void;
  updatePreferences(patch: Partial<AppearancePreferences>): void;
  resetPreferences(): void;
  undo(): void;
  retry(): void;
};
const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const serverSnapshot: PreferenceSnapshot = {
  preferences: DEFAULT_PREFERENCES, scope: "account", status: "loading", error: null, userId: null, canUndo: false,
};
const emptyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function browserStorage() {
  // Access can throw in privacy mode, even before a getItem call.
  return {
    getItem: (key: string) => window.localStorage.getItem(key),
    setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
    removeItem: (key: string) => window.localStorage.removeItem(key),
  };
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [runtime] = useState(() => {
    const supabase = typeof window !== "undefined" && isSupabaseConfigured() ? createClient() : null;
    const store = new PreferencesStore({
      storage: typeof window === "undefined" ? emptyStorage : browserStorage(),
      initialUserId: typeof window === "undefined" ? null : getBootstrapUserId(getAuthSessionKey()),
      remote: supabase ? {
        async load(userId) {
          const { data, error } = await supabase.from("user_preferences").select("appearance").eq("user_id", userId).maybeSingle();
          if (error) throw error;
          return data?.appearance ?? null;
        },
        async save(userId, preferences, signal) {
          const { error } = await supabase.from("user_preferences").upsert({ user_id: userId, appearance: preferences }, { onConflict: "user_id" }).abortSignal(signal);
          if (error) throw error;
        },
      } : null,
    });
    return { store, supabase };
  });
  const { store, supabase } = runtime;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverSnapshot);

  useEffect(() => {
    let alive = true;
    let authEvents = 0;
    if (!supabase) {
      void store.activate(null);
      return () => store.dispose();
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEvents++;
      // Never await another Supabase operation inside its auth event callback.
      queueMicrotask(() => { if (alive) void store.activate(session?.user.id ?? null); });
    });
    const version = authEvents;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive || version !== authEvents) return;
      if (error) store.failAuth();
      else void store.activate(data.session?.user.id ?? null);
    }).catch(() => { if (alive && version === authEvents) store.failAuth(); });
    return () => {
      alive = false;
      subscription.unsubscribe();
      store.dispose();
    };
  }, [store, supabase]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyPreferences(store.getSnapshot().preferences, media.matches);
    apply();
    const unsubscribe = store.subscribe(apply);
    media.addEventListener("change", apply);
    return () => { unsubscribe(); media.removeEventListener("change", apply); };
  }, [store]);

  function retry() {
    if (supabase && snapshot.status === "error") {
      void supabase.auth.getSession().then(({ data, error }) => {
        if (error) { store.failAuth(); return; }
        void store.activate(data.session?.user.id ?? null).then(store.retry);
      }).catch(store.failAuth);
    } else store.retry();
  }

  return <PreferencesContext.Provider value={{ ...snapshot, setScope: store.setScope, updatePreferences: store.updatePreferences, resetPreferences: store.resetPreferences, undo: store.undo, retry }}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
