import { NextResponse } from "next/server";
import { createClient, hasSupabaseConfiguration } from "@/lib/supabase/server";
import { safeNextUrl } from "@/lib/safe-next-url";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!hasSupabaseConfiguration() || !code) {
    return NextResponse.redirect(new URL("/start?auth=failed", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/start?auth=failed", requestUrl.origin));

  return NextResponse.redirect(safeNextUrl(requestUrl.searchParams.get("next"), requestUrl.origin));
}
