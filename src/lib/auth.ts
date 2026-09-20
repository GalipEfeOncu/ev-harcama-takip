import { createClient } from "@/lib/supabase/client";

export type AccountSnapshot = {
  isAnonymous: boolean;
  hasGoogleIdentity: boolean;
  email: string | null;
  displayName: string;
};

export async function getAccountSnapshot(): Promise<AccountSnapshot | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) return null;

  const metadata = data.user.user_metadata;
  const displayName = [metadata.full_name, metadata.name, metadata.preferred_username]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
  const providers = data.user.app_metadata.providers;

  return {
    isAnonymous: data.user.is_anonymous === true,
    hasGoogleIdentity: Array.isArray(providers) && providers.includes("google"),
    email: data.user.email ?? null,
    displayName,
  };
}

export async function beginGoogleSignIn(nextPath: string, linkCurrentAccount = false) {
  const supabase = createClient();
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", nextPath);

  if (linkCurrentAccount) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) {
      throw new Error("Ev oturumun sona ermiş. Eski ev hesabını korumak için Google hesabını aynı oturum açıkken bağla.");
    }

    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });
  if (error) throw error;
}
