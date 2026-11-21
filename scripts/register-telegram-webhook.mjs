const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_BOT_USERNAME: username,
  TELEGRAM_WEBHOOK_SECRET: secret, TELEGRAM_APP_URL: origin } = process.env;

async function register() {
  if (!token || !username || !/^[A-Za-z0-9_-]{32,256}$/.test(secret ?? "")) {
    throw new Error("Bot bilgilerini ve en az 32 karakterlik webhook anahtarını kontrol et.");
  }
  const url = new URL("/api/telegram/webhook", origin);
  if (url.protocol !== "https:") throw new Error("Webhook için herkese erişilebilir bir HTTPS adresi gir.");
  async function call(method, payload) {
    const response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json();
    if (!result.ok) throw new Error("Telegram " + method + " isteğini kabul etmedi (" + result.error_code + ").");
    return result.result;
  }
  const bot = await call("getMe", {});
  if (bot.username.toLowerCase() !== username.replace(/^@/, "").toLowerCase() || !bot.can_join_groups) {
    throw new Error("Bot kullanıcı adı ve BotFather grup izinlerini kontrol et.");
  }
  await call("setWebhook", { url: url.href, secret_token: secret, allowed_updates: ["message"] });
  const state = await call("getWebhookInfo", {});
  if (state.url !== url.href) throw new Error("Kayıtlı webhook adresi doğrulanamadı.");
  console.log("Telegram webhook kaydı doğrulandı.");
}

register().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
