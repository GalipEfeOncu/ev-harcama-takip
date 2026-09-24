import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_AUTH_OPTIONS, SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createBrowserClient(url, key, {
    auth: SUPABASE_AUTH_OPTIONS,
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
  });
}
