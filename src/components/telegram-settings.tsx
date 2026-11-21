"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Group = { state: "off" | "pending" | "confirm" | "active"; title?: string; id?: string; link?: string; command?: string; failed?: boolean };

export function TelegramSettings({ household, owner }: { household: string; owner: boolean }) {
  const [group, setGroup] = useState<Group>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState("");
  const [removing, setRemoving] = useState(false);
  const version = useRef(0);

  const request = useCallback(async (action: string, extra: object = {}) => {
    const res = await fetch("/api/telegram/group", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, household, ...extra }), cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
    return data;
  }, [household]);

  const refresh = useCallback(async () => {
    const sequence = ++version.current;
    try {
      const data = await request("status");
      if (sequence === version.current) { setGroup(data); setError(""); }
    } catch (err) {
      if (sequence === version.current) setError(err instanceof Error ? err.message : "Bağlantı durumu alınamadı.");
    }
  }, [request]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("focus", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, [refresh]);

  useEffect(() => {
    if (group?.state !== "pending" && group?.state !== "confirm") return;
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 8000);
    return () => window.clearInterval(timer);
  }, [group?.state, refresh]);

  useEffect(() => {
    if (!invite) return;
    const timer = window.setTimeout(() => setInvite(""), 295000);
    return () => window.clearTimeout(timer);
  }, [invite]);

  async function act(action: string) {
    setBusy(true); setError("");
    try {
      const data = await request(action, { id: group?.id, code });
      if (action === "invite") setInvite(data.invite);
      else { setCode(""); setInvite(""); setRemoving(false); await refresh(); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlantını kontrol edip tekrar dene.");
    } finally { setBusy(false); }
  }

  return <section className="settings-block telegram-settings" aria-labelledby="telegram-heading">
    <h3 id="telegram-heading">Ev grubu</h3>
    <p className="settings-muted">Yeni harcamalar, ödemeler ve kapanan dönemler evin özel Telegram grubuna bildirilir. Tutarları ve kişi bilgilerini ev panosunda görebilirsin.</p>
    {!group && !error && <p role="status">Bağlantı kontrol ediliyor…</p>}
    {group?.state === "off" && (owner ? <>
      <details><summary>Telegram’da nasıl grup açarım?</summary>
        <ol><li>Telegram’da yeni mesaj simgesine dokun, <strong>Yeni Grup</strong> seç.</li>
        <li>Ev arkadaşını seç, grubuna ad ver ve grup türünü <strong>Özel</strong> bırak. Mevcut özel ev grubunu da kullanabilirsin.</li>
        <li>Buraya dönüp kurulumu başlat. Telegram’da grubu seçerken bota <strong>Kullanıcı davet et</strong> yönetici iznini ver.</li></ol>
      </details>
      <button className="settings-button settings-button--primary" disabled={busy} onClick={() => void act("begin")}>Grup kurulumunu başlat</button>
    </> : <p>Ev sahibi bir grup bağladığında katılım bağlantını burada alabilirsin.</p>)}
    {group?.state === "pending" && <>
      <p>Özel ev grubunu seç ve botun kullanıcı davet etme iznini onayla. Bot gruba bir kod gönderecek. Kurulumu 10 dakika içinde tamamla.</p>
      <a className="settings-button settings-button--primary" href={group.link} rel="noreferrer" target="_blank">Telegram’da grup seç</a>
      <p className="settings-footnote">Yönetici olan bot grup mesajlarını alabilir. Kurulumu bitirmek için bu ekrana dön.</p>
      {group.command && <details><summary>Gruba kod gelmedi mi?</summary>
        <p>Gruptaki yönetici listesinde botun kullanıcı davet etme iznini kontrol et. Ardından şu komutu kopyalayıp bağlamak istediğin özel gruba kendi hesabından gönder.</p>
        <code>{group.command}</code>
      </details>}
    </>}
    {group?.state === "confirm" && <form onSubmit={event => { event.preventDefault(); void act("confirm"); }}>
      <label htmlFor="telegram-code"><strong>{group.title}</strong> grubuna gelen onay kodu</label>
      <input id="telegram-code" required maxLength={10} autoComplete="off" spellCheck={false} value={code}
        onChange={event => setCode(event.target.value.trim())} />
      <button className="settings-button settings-button--primary" disabled={busy || code.length !== 10}>Grubu bağla</button>
    </form>}
    {group?.state === "active" && <>
      <p role="status"><strong>{group.title}</strong> bu eve bağlı.</p>
      {group.failed && <p role="alert">Bazı bildirimler gönderilemedi. Botun grupta olduğunu ve mesaj yazabildiğini kontrol et.</p>}
      {invite ? <a className="settings-button settings-button--primary" href={invite} target="_blank" rel="noreferrer">Telegram grubuna katıl</a> :
        <button className="settings-button settings-button--primary" disabled={busy} onClick={() => void act("invite")}>Katılım bağlantımı oluştur</button>}
      <p className="settings-footnote">Davet 5 dakika geçerlidir. Bağlantıyı kendin açıp Telegram’da Katıl’a dokun. Zaten gruptaysan bildirimler aynı sohbete gelir.</p>
    </>}
    {owner && group && group.state !== "off" && (removing ? <div>
      <p>{group.state === "active" ? "Bu eve ait yeni bildirimlerin gönderimi duracak. Bağlantı kaldırılsın mı?" : "Bu kurulum iptal edilsin mi?"}</p>
      <button className="settings-button" disabled={busy} onClick={() => setRemoving(false)}>Vazgeç</button>{" "}
      <button className="settings-button settings-button--danger" disabled={busy} onClick={() => void act("disconnect")}>Evet, kaldır</button>
    </div> : <button className="settings-text-button" disabled={busy} onClick={() => setRemoving(true)}>
      {group.state === "active" ? "Grup bağlantısını kaldır" : "Kurulumu iptal et"}</button>)}
    {error && <p role="alert">{error}</p>}
    {(error || group?.state === "pending") && <button className="settings-text-button" disabled={busy} onClick={() => void refresh()}>Durumu yenile</button>}
  </section>;
}
