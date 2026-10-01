import { parseCookieHeader, serializeCookieHeader, type CookieMethodsBrowser } from "@supabase/ssr";
import { SUPABASE_COOKIE_OPTIONS } from "./cookie-options";

type StoredCookie = { name: string; value: string };

// Keep SSR cookies as the primary store. The backup lets a returning browser
// recover if its cookies were discarded; Supabase still validates/refreshes it.
export function createPersistentBrowserCookies(url: string): CookieMethodsBrowser {
  const sessionKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const backupKey = `ev-hesap-auth-v1:${sessionKey}`;
  const isSessionCookie = (name: string) => name === sessionKey ||
    (name.startsWith(`${sessionKey}.`) && /^\d+$/.test(name.slice(sessionKey.length + 1)));

  function saveBackup(cookies: StoredCookie[]) {
    try {
      const sessionCookies = cookies.filter(({ name }) => isSessionCookie(name));
      if (sessionCookies.length) window.localStorage.setItem(backupKey, JSON.stringify(sessionCookies));
      else window.localStorage.removeItem(backupKey);
    } catch {
      // Cookie persistence continues when localStorage is unavailable.
    }
  }

  return {
    getAll() {
      const cookies = parseCookieHeader(document.cookie);
      if (cookies.some(({ name }) => isSessionCookie(name))) {
        // Includes tokens refreshed by the server since the previous visit.
        saveBackup(cookies);
        return cookies;
      }
      try {
        const saved: unknown = JSON.parse(window.localStorage.getItem(backupKey) ?? "null");
        if (!Array.isArray(saved) || !saved.length || !saved.every((cookie) =>
          cookie && typeof cookie.name === "string" && isSessionCookie(cookie.name) &&
          typeof cookie.value === "string" && cookie.value.length > 0,
        )) return cookies;
        for (const { name, value } of saved as StoredCookie[]) {
          document.cookie = serializeCookieHeader(name, value, SUPABASE_COOKIE_OPTIONS);
        }
        return [...cookies, ...saved as StoredCookie[]];
      } catch {
        return cookies;
      }
    },
    setAll(cookiesToSet) {
      // Read without restoring: deletion must never resurrect the backup.
      const current = new Map(parseCookieHeader(document.cookie).map(({ name, value }) => [name, value]));
      for (const { name, value, options } of cookiesToSet) {
        document.cookie = serializeCookieHeader(name, value, options);
        if (options.maxAge === 0 || !value) current.delete(name);
        else current.set(name, value);
      }
      saveBackup(Array.from(current, ([name, value]) => ({ name, value })));
    },
  };
}
