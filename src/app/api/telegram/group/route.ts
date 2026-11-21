import { createClient } from "@/lib/supabase/server";
import { confirmationCode, problem, secretMatches, telegram, telegramDb, telegramReady, telegramUsername, uuidPattern } from "@/lib/telegram";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return problem("İstek doğrulanamadı.", 403);
  if (!telegramReady()) return problem("Telegram hizmeti henüz etkinleştirilmedi.", 503);
  const input = await request.json().catch(() => null);
  if (!input || typeof input.household !== "string" || !uuidPattern.test(input.household)) return problem("Ev seçimi geçersiz.");
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user?.app_metadata.providers?.includes("google")) return problem("Google hesabınla giriş yap.", 401);
    const db = telegramDb();
    const { data: member } = await session.from("members").select("role").eq("household_id", input.household)
      .eq("user_id", user.id).eq("active", true).maybeSingle().throwOnError();
    if (!member) return problem("Bu evde aktif üyelik gerekiyor.", 403);
    const owner = member.role === "owner";
    if (!owner && !["status", "invite"].includes(input.action)) return problem("Bu işlemi ev sahibi yapabilir.", 403);
    const groups = () => db.from("telegram_groups");
    const now = new Date().toISOString();
    const { data: row } = await groups().select("*").eq("household_id", input.household).maybeSingle().throwOnError();
    const current = row && (row.active || row.expires_at > now && row.owner_id === user.id) ? row : null;
    if (input.action === "status") {
      if (!current || (!owner && !current.active)) return Response.json({ state: "off" });
      const { count } = owner && current.active
        ? await db.from("telegram_outbox").select("id", { count: "exact", head: true })
          .eq("group_id", current.id).eq("failed", true).throwOnError()
        : { count: 0 };
      return Response.json({
        failed: Boolean(count),
        state: current.active ? "active" : current.chat_id ? "confirm" : "pending",
        title: current.title, id: owner ? current.id : undefined,
        link: owner && !current.active && !current.chat_id ? groupLink(current.id) : undefined,
        command: owner && !current.active && !current.chat_id ? "/start@" + telegramUsername() + " " + current.id : undefined,
      });
    }
    if (input.action === "invite") {
      if (!current?.active) return problem("Ev sahibi önce bir grup bağlamalı.", 409);
      try {
        const invite = await telegram<{ invite_link: string }>("createChatInviteLink", {
          chat_id: current.chat_id, expire_date: Math.floor(Date.now() / 1000) + 300, member_limit: 1,
        });
        return Response.json({ invite: invite.invite_link });
      } catch {
        return problem("Davet oluşturulamadı. Ev sahibi botun grupta yönetici olduğunu ve kullanıcı davet etme iznini kontrol edebilir.", 502);
      }
    }
    if (!["begin", "confirm", "disconnect"].includes(input.action)) return problem("İşlem tanınmadı.");
    if (input.action !== "begin" && (!current || input.id !== current.id)) {
      return problem("Bağlantı değişti veya süresi doldu. Durumu yenile.", 409);
    }
    if (input.action === "confirm" && current) {
      if (!current.chat_id || current.active || typeof input.code !== "string" ||
        !secretMatches(input.code.trim().toUpperCase(), confirmationCode(current.id, current.chat_id))) {
        return problem("Kod eşleşmedi. Seçtiğin gruptaki son kodu kontrol et.");
      }
    }
    const { data: changed } = await db.rpc("change_telegram_binding_as_owner", {
      p_household_id: input.household,
      p_actor_user_id: user.id,
      p_action: input.action,
      p_binding_id: current?.id ?? null,
    }).throwOnError();
    if (!changed) return problem("Bağlantı değişti veya süresi doldu. Durumu yenile.", 409);
    return Response.json({ ok: true });
  } catch {
    return problem("Ev bağlantısına ulaşılamadı. Biraz sonra tekrar dene.", 503);
  }
}

function groupLink(id: string) {
  return "https://t.me/" + telegramUsername() + "?startgroup=" + id + "&admin=invite_users";
}
