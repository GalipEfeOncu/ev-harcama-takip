// Keep browser and server Supabase clients aligned so refreshed auth cookies
// remain available when the user returns to the app later.
export const SUPABASE_COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};

export const SUPABASE_AUTH_OPTIONS = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: "pkce" as const,
};
