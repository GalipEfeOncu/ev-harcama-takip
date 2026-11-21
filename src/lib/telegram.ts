import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/admin";

export function telegramDb() {
  const db = createAdminClient();
  if (!db) throw new Error("Missing database configuration");
  return db;
}

export function secretMatches(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}

export function confirmationCode(id: string, chat: string) {
  return createHmac("sha256", process.env.TELEGRAM_WEBHOOK_SECRET!)
    .update(id + "/" + chat).digest("hex").slice(0, 10).toUpperCase();
}

export const telegramUsername = () => process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
export const uuidPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export const telegramReady = () => Boolean(telegramUsername() && process.env.TELEGRAM_BOT_TOKEN &&
  process.env.TELEGRAM_WEBHOOK_SECRET && process.env.TELEGRAM_DISPATCH_SECRET && process.env.TELEGRAM_APP_URL &&
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));

export class TelegramError extends Error {
  constructor(readonly status: number, readonly retryAfter = 0, readonly migrateTo?: number) {
    super("Telegram request failed");
  }
}

export async function telegram<T>(method: string, body: object): Promise<T> {
  const response = await fetch("https://api.telegram.org/bot" + process.env.TELEGRAM_BOT_TOKEN + "/" + method, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(method === "sendMessage" ? 12000 : 6500), cache: "no-store",
  });
  const data = await response.json();
  if (!data.ok) throw new TelegramError(data.error_code || response.status, data.parameters?.retry_after, data.parameters?.migrate_to_chat_id);
  return data.result;
}

export function problem(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
