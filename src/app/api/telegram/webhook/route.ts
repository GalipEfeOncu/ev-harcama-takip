import { confirmationCode, secretMatches, telegram, telegramDb, TelegramError, telegramUsername, uuidPattern } from "@/lib/telegram";

type ChatMember = { status: string; can_invite_users?: boolean };

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response(null, { status: 403 });
  }
  const update = await request.json().catch(() => null);
  const message = update?.message;
  if (!["group", "supergroup"].includes(message?.chat?.type)) return new Response(null);
  const chat = String(message.chat.id);
  const db = telegramDb();
  try {
    if (message.migrate_to_chat_id) {
      await db.from("telegram_groups").update({ chat_id: String(message.migrate_to_chat_id) }).eq("chat_id", chat).throwOnError();
      return new Response(null);
    }
    const match = typeof message.text === "string" && /^\/start(?:@(\w+))? ([a-f0-9-]{36})$/i.exec(message.text);
    if (!match || !uuidPattern.test(match[2]) || (match[1] && match[1].toLowerCase() !== telegramUsername()?.toLowerCase())) return new Response(null);
    const id = match[2];
    const now = new Date().toISOString();
    const { data: row } = await db.from("telegram_groups").select("chat_id").eq("id", id)
      .eq("active", false).gt("expires_at", now).maybeSingle().throwOnError();
    if (!row || (row.chat_id && row.chat_id !== chat)) return new Response(null);
    const reply = (text: string) => telegram("sendMessage", { chat_id: chat, text });
    if (message.chat.username || message.chat.active_usernames?.length) {
      await reply("Ev Hesap için özel bir grup seç. Grubun herkese açık kullanıcı adını grup ayarlarından kaldırabilirsin.");
      return new Response(null);
    }
    const botId = Number(process.env.TELEGRAM_BOT_TOKEN?.split(":")[0]);
    const bot = await telegram<ChatMember>("getChatMember", { chat_id: chat, user_id: botId });
    if (bot.status !== "administrator" || !bot.can_invite_users) {
      await reply("Grup ayarlarından Ev Hesap botuna yönetici ve kullanıcı davet etme izni verip kurulum bağlantısını yeniden aç.");
      return new Response(null);
    }
    if (message.sender_chat || !message.from?.id) {
      await reply("Kurulumu tamamlamak için Telegram’da kendi hesabınla işlem yap. Anonim yönetici modunu kapatıp bağlantıyı yeniden aç.");
      return new Response(null);
    }
    const sender = await telegram<ChatMember>("getChatMember", { chat_id: chat, user_id: message.from.id });
    if (!["administrator", "creator"].includes(sender.status)) return new Response(null);
    if (!row.chat_id) {
      const { data, error } = await db.from("telegram_groups").update({ chat_id: chat, title: message.chat.title })
        .eq("id", id).is("chat_id", null).eq("active", false).gt("expires_at", now).select("id").maybeSingle();
      if (error?.code === "23505") {
        await reply("Bu grup başka bir kurulumda kullanılıyor. Önce eski bağlantıyı kaldır veya farklı bir özel grup seç.");
        return new Response(null);
      }
      if (error) throw error;
      if (!data) return new Response(null);
    }
    await reply("Ev sahibi, Ev Hesap’ta Ayarlar → Telegram bildirimleri bölümünü açıp bu grubu onaylamak için şu kodu girsin: " + confirmationCode(id, chat));
    return new Response(null);
  } catch (error) {
    // Telegram retries temporary webhook failures. An inaccessible chat cannot receive a reply.
    if (error instanceof TelegramError && [400, 403].includes(error.status)) return new Response(null);
    return new Response(null, { status: 503 });
  }
}
