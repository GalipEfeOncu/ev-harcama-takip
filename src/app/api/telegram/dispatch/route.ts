import { secretMatches, telegram, telegramDb, TelegramError } from "@/lib/telegram";
import { expenseMessage, retryDelay, type ExpenseDetails } from "@/lib/telegram-delivery";

export const maxDuration = 60;

const messages: Record<string, string> = {
  expenses: "Ev hesabına yeni bir harcama eklendi.",
  debt_payments: "Ev hesabına bir ödeme kaydedildi.",
  settlement_runs: "Hesaplaşma dönemi kapatıldı.",
};

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_DISPATCH_SECRET;
  if (!secret || !secretMatches(request.headers.get("authorization"), "Bearer " + secret)) return new Response(null, { status: 403 });
  const db = telegramDb();
  const deadline = Date.now() + 40_000;
  let sent = 0;
  try {
    await db.from("telegram_groups").delete().eq("active", false).lt("expires_at", new Date().toISOString()).throwOnError();
    for (let count = 0; count < 12 && Date.now() < deadline; count++) {
      const { data: job } = await db.rpc("claim_telegram_delivery").maybeSingle<{
        details: ExpenseDetails | null;
        job_id: number; lease_id: string; attempt: number; group_id: string; chat_id: string; household_id: string; kind: string;
      }>().throwOnError();
      if (!job) break;
      try {
        const url = new URL("/dashboard", process.env.TELEGRAM_APP_URL);
        url.searchParams.set("household", job.household_id);
        const text = job.kind === "expenses" && job.details ? expenseMessage(job.details) : messages[job.kind];
        await telegram("sendMessage", { chat_id: job.chat_id, text, link_preview_options: { is_disabled: true },
          reply_markup: { inline_keyboard: [[{ text: "Ev panosunu aç", url: url.href }]] } });
      } catch (error) {
        const api = error instanceof TelegramError ? error : null;
        if (api?.migrateTo) {
          await db.from("telegram_groups").update({ chat_id: String(api.migrateTo) })
            .eq("id", job.group_id).eq("chat_id", job.chat_id).throwOnError();
        }
        const permanent = !api?.migrateTo && (api?.status === 403 || api?.status === 400);
        const delay = retryDelay(job.attempt, api?.migrateTo ? undefined : api?.status, api?.retryAfter);
        await db.from("telegram_outbox").update({ failed: permanent || job.attempt >= 12,
          lease: null, available_at: new Date(Date.now() + delay * 1000).toISOString() })
          .eq("id", job.job_id).eq("lease", job.lease_id).throwOnError();
        if (api?.status === 429) break;
        continue;
      }
      await db.from("telegram_outbox").delete().eq("id", job.job_id).eq("lease", job.lease_id).throwOnError();
      sent++;
    }
    return Response.json({ sent });
  } catch {
    return Response.json({ error: "dispatch_failed" }, { status: 503 });
  }
}
