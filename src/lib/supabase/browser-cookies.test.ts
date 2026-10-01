import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserClient, parseCookieHeader, stringToBase64URL } from "@supabase/ssr";
import { createPersistentBrowserCookies } from "./browser-cookies";

const url = "https://project.supabase.co";
const sessionKey = "sb-project-auth-token";
const backupKey = `ev-hesap-auth-v1:${sessionKey}`;
let cookies: Map<string, string>;
let local: Map<string, string>;

beforeEach(() => {
  cookies = new Map();
  local = new Map();
  const document = {
    get cookie() { return Array.from(cookies, ([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; "); },
    set cookie(header: string) {
      const { name, value } = parseCookieHeader(header.split(";")[0])[0];
      if (/Max-Age=0/i.test(header)) cookies.delete(name);
      else cookies.set(name, value);
    },
  };
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", {
    document,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    localStorage: {
      getItem: (key: string) => local.get(key) ?? null,
      setItem: (key: string, value: string) => local.set(key, value),
      removeItem: (key: string) => local.delete(key),
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

function seedSession(expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  const session = {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${stringToBase64URL(JSON.stringify({ exp: expiresAt, sub: "user-1" }))}.signature`,
    refresh_token: "refresh-old",
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "user-1", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-01-01" },
  };
  cookies.set(sessionKey, `base64-${stringToBase64URL(JSON.stringify(session))}`);
  createPersistentBrowserCookies(url).getAll!();
  return session;
}

describe("persistent browser auth cookies", () => {
  it("restores all chunks after cookies disappear on a subsequent app launch", () => {
    cookies.set(`${sessionKey}.0`, "first");
    cookies.set(`${sessionKey}.1`, "second");
    cookies.set(`${sessionKey}-code-verifier`, "private-pkce");
    createPersistentBrowserCookies(url).getAll!();
    cookies.clear();
    expect(createPersistentBrowserCookies(url).getAll!()).toEqual([
      { name: `${sessionKey}.0`, value: "first" },
      { name: `${sessionKey}.1`, value: "second" },
    ]);
    expect(cookies.size).toBe(2);
    expect(local.get(backupKey)).not.toContain("private-pkce");
  });

  it("replaces the backup with server-refreshed cookies without mixing old chunks", () => {
    cookies.set(`${sessionKey}.0`, "old-first");
    cookies.set(`${sessionKey}.1`, "old-second");
    createPersistentBrowserCookies(url).getAll!();
    cookies.clear();
    cookies.set(sessionKey, "new-session");
    createPersistentBrowserCookies(url).getAll!();
    cookies.clear();
    expect(createPersistentBrowserCookies(url).getAll!()).toEqual([{ name: sessionKey, value: "new-session" }]);
  });

  it("lets the real Supabase client validate a recovered session and clears it on sign-out", async () => {
    const session = seedSession();
    cookies.clear();
    const fetch = vi.fn(async () => Response.json(session.user));
    const client = createBrowserClient(url, "test-key", {
      isSingleton: false,
      cookies: createPersistentBrowserCookies(url),
      auth: { autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch },
    });
    expect((await client.auth.getUser()).data.user?.id).toBe("user-1");
    expect(fetch).toHaveBeenCalled();
    await client.auth.signOut({ scope: "local" });
    expect(local.has(backupKey)).toBe(false);
    cookies.clear();
    expect(createPersistentBrowserCookies(url).getAll!()).toEqual([]);
  });

  it("refreshes an expired recovered session and stores the rotated tokens", async () => {
    const expired = seedSession(Math.floor(Date.now() / 1000) - 3600);
    cookies.clear();
    const fresh = { ...expired, refresh_token: "refresh-new", expires_in: 3600 };
    const fetch = vi.fn(async () => Response.json(fresh));
    const client = createBrowserClient(url, "test-key", {
      isSingleton: false,
      cookies: createPersistentBrowserCookies(url),
      auth: { autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch },
    });
    const { data, error } = await client.auth.getSession();
    expect(error).toBeNull();
    expect(data.session?.refresh_token).toBe("refresh-new");
    expect(fetch.mock.calls.length).toBeGreaterThan(0);
    const backup = JSON.parse(local.get(backupKey)!);
    expect(backup).toEqual(Array.from(cookies, ([name, value]) => ({ name, value })));
    await client.auth.signOut({ scope: "local" });
  });

  it("ignores malformed or foreign-project backups and tolerates blocked storage", () => {
    local.set(backupKey, JSON.stringify([{ name: "sb-other-auth-token", value: "foreign" }]));
    expect(createPersistentBrowserCookies(url).getAll!()).toEqual([]);
    local.set(backupKey, "invalid-json");
    expect(createPersistentBrowserCookies(url).getAll!()).toEqual([]);
    window.localStorage.getItem = () => { throw new Error("blocked"); };
    expect(createPersistentBrowserCookies(url).getAll!()).toEqual([]);
  });

  it("discards a recovered session when Supabase rejects its refresh token", async () => {
    seedSession(Math.floor(Date.now() / 1000) - 3600);
    cookies.clear();
    const fetch = vi.fn(async () => Response.json(
      { code: "refresh_token_not_found", message: "Invalid Refresh Token" }, { status: 400 },
    ));
    const client = createBrowserClient(url, "test-key", {
      isSingleton: false,
      cookies: createPersistentBrowserCookies(url),
      auth: { autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch },
    });
    expect((await client.auth.getSession()).data.session).toBeNull();
    expect(local.has(backupKey)).toBe(false);
    expect(cookies.size).toBe(0);
  });
});
