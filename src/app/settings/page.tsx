"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Bell, Check, ChevronRight, Copy, Home, LayoutList, LogOut, Monitor, Palette, RefreshCw, RotateCcw, Search, SlidersHorizontal, Star, UserRound, Users, X } from "lucide-react";
import { THEMES, getTheme, FONT_OPTIONS, FONT_SIZES, DENSITIES } from "@/lib/appearance-catalog";
import { usePreferences } from "@/components/preferences-provider";
import { beginGoogleSignIn, getAccountSnapshot, type AccountSnapshot } from "@/lib/auth";
import { loadRemoteMembers, loadRemoteHouseholdSession, rotateRemoteHouseholdJoinCode } from "@/lib/data-service";
import { readLocalSession, readLocalMembers, saveLocalSession, SESSION_KEY, type LocalSession } from "@/lib/local-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Member } from "@/lib/types";
import { TelegramSettings } from "@/components/telegram-settings";
import "./settings.css";

const SECTIONS = [
  { id: "appearance", label: "Görünüm", description: "Tema, yazı tipi ve yazı boyutu", icon: Palette },
  { id: "interface", label: "Arayüz", description: "Yoğunluk ve hareket tercihleri", icon: SlidersHorizontal },
  { id: "household", label: "Ev ve üyeler", description: "Ev arkadaşların ve davet kodu", icon: Users },
  { id: "telegram", label: "Telegram bildirimleri", description: "Ev grubunu bağla veya gruba katıl", icon: Bell },
  { id: "account", label: "Hesap", description: "Google hesabın ve oturumun", icon: UserRound },
] as const;
type SectionId = typeof SECTIONS[number]["id"];
type ThemeFilter = "all" | "light" | "dark" | "favorites";

function isSection(value: string | null): value is SectionId {
  return SECTIONS.some((section) => section.id === value);
}

function failureMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function subscribeSystemTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function SettingsPage() {
  const router = useRouter();
  const { preferences, scope, setScope, updatePreferences, resetPreferences, undo, canUndo, status, error, retry, userId } = usePreferences();
  const [section, setSection] = useState<SectionId | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ThemeFilter>("all");
  const [notice, setNotice] = useState("");
  const [session, setSession] = useState<LocalSession | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [homeStatus, setHomeStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [homeError, setHomeError] = useState("");
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [accountStatus, setAccountStatus] = useState<"loading" | "ready" | "error">("loading");
  const [accountError, setAccountError] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [codeNotice, setCodeNotice] = useState("");
  const rotateDialog = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const activeSection = section ?? "appearance";
  const remote = isSupabaseConfigured();
  const systemDark = useSyncExternalStore(subscribeSystemTheme, getSystemDark, () => false);
  const selectedTheme = getTheme(preferences.themeId, systemDark);
  const dashboardHref = session ? `/dashboard?household=${encodeURIComponent(session.householdId)}` : "/dashboard";

  const loadAccountAndHome = useCallback(async () => {
    setHomeStatus("loading");
    setSession(null);
    setHomeError("");
    setAccountStatus("loading");
    setAccountError("");
    try {
      const stored = readLocalSession();
      if (!remote) {
        setSession(stored);
        setMembers(stored ? readLocalMembers(stored) : []);
        setHomeStatus(stored ? "ready" : "empty");
        setAccount(null);
        setAccountStatus("ready");
        return;
      }
      let currentAccount: AccountSnapshot | null;
      try {
        currentAccount = await getAccountSnapshot();
        setAccount(currentAccount);
        setAccountStatus("ready");
      } catch (accountFailure) {
        setAccountStatus("error");
        setAccountError(failureMessage(accountFailure, "Hesap bilgilerin alınamadı."));
        setHomeStatus("error");
        setHomeError("Ev bilgilerini almak için önce hesabına erişmemiz gerekiyor.");
        return;
      }
      if (!currentAccount) {
        setSession(null);
        setMembers([]);
        setHomeStatus("empty");
        return;
      }
      const requested = new URLSearchParams(window.location.search).get("household");
      const resolved = await loadRemoteHouseholdSession(requested || stored?.householdId, stored);
      saveLocalSession(resolved.session);
      setSession(resolved.session);
      setMembers(await loadRemoteMembers(resolved.session));
      setHomeStatus("ready");
    } catch (homeFailure) {
      if (homeFailure instanceof Error && homeFailure.message === "Bu hesapla açılmış bir ev üyeliği bulunamadı.") {
        setSession(null);
        setMembers([]);
        setHomeStatus("empty");
        return;
      }
      setHomeStatus("error");
      setHomeError(failureMessage(homeFailure, "Ev bilgileri yüklenemedi."));
    }
  }, [remote]);

  useEffect(() => {
    let cancelled = false;
    const readSection = () => {
      const value = new URLSearchParams(window.location.search).get("section");
      setSection(isSection(value) ? value : null);
    };
    queueMicrotask(() => {
      if (cancelled) return;
      readSection();
      void loadAccountAndHome();
    });
    window.addEventListener("popstate", readSection);
    return () => { cancelled = true; window.removeEventListener("popstate", readSection); };
  }, [loadAccountAndHome]);

  function navigateSection(next: SectionId | null) {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("section", next);
    else url.searchParams.delete("section");
    window.history.pushState(null, "", url);
    setSection(next);
    setNotice("");
    if (window.matchMedia("(max-width: 760px)").matches) {
      window.scrollTo({ top: 0, behavior: "instant" });
      requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
    }
  }

  function toggleFavorite(id: string) {
    const favorites = preferences.favoriteThemes;
    updatePreferences({ favoriteThemes: favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id] });
  }

  async function copyCode() {
    if (!session?.joinCode) return;
    try {
      await navigator.clipboard.writeText(session.joinCode);
      setCodeNotice("Davet kodu kopyalandı. Ev arkadaşınla paylaşabilirsin.");
    } catch {
      setCodeNotice("Kopyalama izni alınamadı. Aşağıdaki kodu seçip kopyalayabilirsin.");
    }
  }

  async function rotateCode() {
    if (!remote || session?.role !== "owner") return;
    rotateDialog.current?.close();
    setRotating(true);
    setCodeNotice("");
    try {
      const joinCode = await rotateRemoteHouseholdJoinCode(session);
      const next = { ...session, joinCode };
      saveLocalSession(next);
      setSession(next);
      setCodeNotice("Yeni davet kodun hazır. Bundan sonra bu kodu paylaş.");
    } catch (rotateFailure) {
      setCodeNotice(failureMessage(rotateFailure, "Davet kodu oluşturulamadı. Tekrar dene."));
    } finally {
      setRotating(false);
    }
  }

  async function googleSignIn() {
    setAccountBusy(true);
    setAccountError("");
    try {
      const next = new URL("/settings", window.location.origin);
      next.searchParams.set("section", activeSection === "telegram" ? "telegram" : "account");
      if (session) next.searchParams.set("household", session.householdId);
      await beginGoogleSignIn(`${next.pathname}${next.search}`, account?.isAnonymous === true);
    } catch (signInFailure) {
      setAccountError(failureMessage(signInFailure, "Google ile bağlantı kurulamadı. Tekrar dene."));
      setAccountBusy(false);
    }
  }

  async function signOut() {
    setAccountBusy(true);
    setAccountError("");
    try {
      if (remote) {
        const result = await createClient().auth.signOut();
        if (result.error) throw result.error;
      }
      window.localStorage.removeItem(SESSION_KEY);
      router.replace("/");
    } catch (signOutFailure) {
      setAccountError(failureMessage(signOutFailure, "Oturum kapatılamadı. Tekrar dene."));
      setAccountBusy(false);
    }
  }

  const filteredThemes = THEMES.filter((theme) => {
    const matchesSearch = `${theme.label} ${theme.description}`.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr").trim());
    const matchesFilter = filter === "all" || (filter === "favorites" ? preferences.favoriteThemes.includes(theme.id) : theme.mode === filter);
    return matchesSearch && matchesFilter;
  });
  const statusText = {
    loading: "Tercihler yükleniyor…",
    saving: "Kaydediliyor…",
    saved: scope === "device" ? "Bu cihaza kaydedildi" : "Hesabınla eşitlendi",
    local: "Bu tarayıcıya kaydedildi",
    error: "Eşitleme tamamlanamadı",
  }[status];

  return (
    <main className={`settings-page${section ? " settings-page--detail" : ""}`} id="main-content">
      <header className="settings-header">
        <Link className="settings-wordmark" href={dashboardHref} aria-label="Ev Hesap, panoya dön"><span><Home size={20} aria-hidden="true" /></span>EV HESAP</Link>
        <Link className="settings-back-link" href={dashboardHref}><ArrowLeft size={17} aria-hidden="true" />Panoya dön</Link>
      </header>

      <div className="settings-layout">
        <aside className="settings-sidebar" aria-label="Ayarlar bölümleri">
          <h1>Ayarlar</h1>
          <p>Kendine göre bir Ev Hesap.</p>
          <nav>
            {SECTIONS.map(({ id, label, description, icon: Icon }) => (
              <button key={id} type="button" className={`settings-nav-item${activeSection === id ? " is-active" : ""}`} aria-current={activeSection === id ? "page" : undefined} onClick={() => navigateSection(id)}>
                <Icon size={20} aria-hidden="true" /><span><strong>{label}</strong><small>{description}</small></span><ChevronRight className="settings-nav-chevron" size={18} aria-hidden="true" />
              </button>
            ))}
          </nav>
          <div className="settings-sidebar-note"><Monitor size={17} aria-hidden="true" /><span>Değişikliklerin anında uygulanır ve otomatik kaydedilir.</span></div>
        </aside>

        <div className="settings-content">
          <button className="settings-mobile-back" type="button" onClick={() => navigateSection(null)}><ArrowLeft size={18} aria-hidden="true" />Tüm ayarlar</button>
          <div className="settings-content-heading">
            <div><h2 ref={titleRef} tabIndex={-1}>{SECTIONS.find((item) => item.id === activeSection)?.label}</h2><p>{activeSection === "appearance" ? "Bir palet seç. Ev hesabın senin renginde olsun." : activeSection === "interface" ? "Sana rahat gelen düzeni ve hareketi seç." : activeSection === "household" ? "Aynı evi, aynı hesabı paylaştığın kişiler." : activeSection === "telegram" ? "Ev hesabındaki hareketleri özel Telegram grubunda takip et." : "Hesabın, bağlantın ve oturum bilgilerin."}</p></div>
            {(activeSection === "appearance" || activeSection === "interface") && <span className={`settings-save-status${status === "error" ? " is-error" : ""}`} role="status">{status === "saved" || status === "local" ? <Check size={15} aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}{statusText}</span>}
          </div>

          {(activeSection === "appearance" || activeSection === "interface") && (
            <div className="settings-scope">
              <div><strong>{scope === "device" ? "Bu cihaza özel görünüm" : "Hesap görünümün"}</strong><p>{!userId ? "Giriş yapana kadar tercihlerin bu tarayıcıda saklanır." : scope === "device" ? "Buradaki tercihler diğer cihazlarındaki görünümü değiştirmez." : account?.isAnonymous ? "Tercihlerin misafir hesabına kaydedilir. Diğer cihazlardan erişmek için Google hesabını bağla." : "Tercihlerin hesabınla eşitlenir. İstersen bu cihazı ayrı ayarlayabilirsin."}</p></div>
              <label className="settings-switch-label"><span>Bu cihaza özel kullan</span><input type="checkbox" role="switch" checked={scope === "device"} disabled={!userId || status === "loading"} onChange={(event) => { setScope(event.target.checked ? "device" : "account"); setNotice(event.target.checked ? "Bu cihazın görünümünü ayrı ayarlıyorsun." : "Hesabındaki görünüm tercihleri uygulanıyor."); }} /><span className="settings-switch" aria-hidden="true" /></label>
            </div>
          )}
          {(activeSection === "appearance" || activeSection === "interface") && status === "error" && <div className="settings-error" role="alert"><div><strong>Tercihlerin henüz eşitlenmedi.</strong><p>{error || "Bağlantını kontrol edip tekrar dene. Görünümün bu cihazda uygulanmaya devam eder."}</p></div><button className="settings-button" type="button" onClick={retry}><RefreshCw size={16} aria-hidden="true" />Tekrar dene</button></div>}

          {activeSection === "appearance" && <>
            <section className="settings-preview" aria-label="Seçtiğin görünümün örneği">
              <div className="settings-preview-heading"><span>Canlı önizleme</span><span>{selectedTheme.label} · Örnek veriler</span></div>
              <div className="settings-preview-body">
                <div className="settings-preview-balance"><span>Açık hesap</span><strong>₺1.250,00</strong><span>Toplam ortak gider</span></div>
                <div className="settings-preview-ledger"><div><span className="settings-preview-avatar">E</span><div><strong>Ece</strong><small>Alacaklı</small></div><b>+₺625,00</b></div><div><span className="settings-preview-avatar">D</span><div><strong>Deniz</strong><small>Borçlu</small></div><b className="is-negative">−₺625,00</b></div><div className="settings-preview-expense"><div><strong>Haftalık alışveriş</strong><small>Ece ödedi · 2 kişi</small></div><strong>₺1.250,00</strong></div></div>
              </div>
            </section>

            <section className="settings-block" aria-labelledby="themes-heading">
              <div className="settings-block-heading"><div><h3 id="themes-heading">Temalar</h3><p>Birbirine yakışan renkler, okumaya uygun kontrast.</p></div><span className="settings-count">{THEMES.length} palet</span></div>
              <button className="settings-system-theme" type="button" aria-pressed={preferences.themeId === "system"} onClick={() => { updatePreferences({ themeId: "system" }); setNotice("Açık ve koyu görünüm cihazınla birlikte değişecek."); }}><Monitor size={17} aria-hidden="true" /><span><strong>Cihaz temasını izle</strong><small>Açık ve koyu Ev Hesap temaları arasında otomatik geçiş.</small></span>{preferences.themeId === "system" && <Check size={17} aria-hidden="true" />}</button>
              <label className="settings-search"><Search size={18} aria-hidden="true" /><span className="visually-hidden">Tema ara</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bir tema ara…" /></label>
              <div className="settings-theme-tools"><div className="settings-filter-group" role="group" aria-label="Temaları filtrele">{([{ id: "all", label: "Tümü" }, { id: "light", label: "Açık" }, { id: "dark", label: "Koyu" }, { id: "favorites", label: "Favoriler" }] as const).map((item) => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.id === "favorites" && <Star size={14} aria-hidden="true" />}{item.label}</button>)}</div><span className="settings-result-count" role="status">{filteredThemes.length} tema</span></div>
              <div className="settings-theme-grid" role="group" aria-label="Tema seçimi">
                {filteredThemes.map((theme) => {
                  const selected = preferences.themeId === theme.id;
                  const favorite = preferences.favoriteThemes.includes(theme.id);
                  return <div className={`settings-theme-tile${selected ? " is-selected" : ""}`} key={theme.id} style={{ "--tile-bg": theme.tokens["--bg"], "--tile-text": theme.tokens["--text"], "--tile-muted": theme.tokens["--text-muted"], "--tile-accent": theme.tokens["--accent"], "--tile-surface": theme.tokens["--surface"] } as CSSProperties}>
                    <button className="settings-theme-pick" type="button" aria-pressed={selected} aria-label={`${theme.label}, ${theme.mode === "dark" ? "koyu" : "açık"} tema${selected ? ", seçili" : ""}`} title={theme.description} onClick={() => { updatePreferences({ themeId: theme.id }); setNotice(`${theme.label} teması uygulandı.`); }}><span className="settings-theme-art" aria-hidden="true"><span className="settings-theme-text">Aa</span><span className="settings-theme-swatches"><i /><i /><i /></span></span><span className="settings-theme-name">{theme.label}{selected && <Check size={15} aria-hidden="true" />}</span></button>
                    <button className="settings-theme-favorite" type="button" aria-label={`${theme.label} temasını ${favorite ? "favorilerden çıkar" : "favorilere ekle"}`} aria-pressed={favorite} onClick={() => toggleFavorite(theme.id)}><Star size={16} fill={favorite ? "currentColor" : "none"} aria-hidden="true" /></button>
                  </div>;
                })}
              </div>
              {filteredThemes.length === 0 && <div className="settings-empty"><Search size={22} aria-hidden="true" /><strong>{filter === "favorites" && !search ? "Henüz favori teman yok." : "Bu aramaya uygun bir tema bulunamadı."}</strong><p>{filter === "favorites" && !search ? "Beğendiğin temadaki yıldızı seç; burada toplansın." : "Başka bir isim dene veya filtreyi değiştir."}</p><button type="button" className="settings-text-button" onClick={() => { setSearch(""); setFilter("all"); }}>Tüm temaları göster<ArrowRight size={16} aria-hidden="true" /></button></div>}
            </section>

            <section className="settings-block" aria-labelledby="font-heading"><div className="settings-block-heading"><div><h3 id="font-heading">Yazı tipi</h3><p>Teman değişse de yazı tipi seçimin korunur.</p></div></div><div className="settings-font-grid" role="group" aria-label="Yazı tipi seçimi">{FONT_OPTIONS.map((font) => <button type="button" key={font.id} className="settings-font-option" aria-pressed={preferences.fontId === font.id} onClick={() => updatePreferences({ fontId: font.id })}><span className="settings-font-sample" style={{ fontFamily: font.family }}>Aa</span><span>{font.label}</span>{preferences.fontId === font.id && <Check size={16} aria-hidden="true" />}</button>)}</div></section>

            <section className="settings-block" aria-labelledby="size-heading"><div className="settings-block-heading"><div><h3 id="size-heading">Yazı boyutu</h3><p>Hesaplar, isimler ve ayrıntılar rahatça okunsun.</p></div></div><div className="settings-choice-group" role="group" aria-label="Yazı boyutu">{FONT_SIZES.map((size) => <button type="button" key={size.id} aria-pressed={preferences.fontSize === size.id} onClick={() => updatePreferences({ fontSize: size.id })}><span>{size.label}</span>{preferences.fontSize === size.id && <Check size={16} aria-hidden="true" />}</button>)}</div></section>
          </>}

          {activeSection === "interface" && <>
            <section className="settings-block" aria-labelledby="density-heading">
              <div className="settings-block-heading"><div><h3 id="density-heading">Arayüz yoğunluğu</h3><p>Liste aralıklarını ve bölüm boşluklarını seç. Değişiklik ayarlarda ve panoda hemen uygulanır.</p></div></div>
              <div className="settings-density-grid" role="group" aria-label="Arayüz yoğunluğu">{DENSITIES.map((density) => <button type="button" className={`settings-density-option settings-density-option--${density.id}`} key={density.id} aria-pressed={preferences.density === density.id} onClick={() => updatePreferences({ density: density.id })}><span className="settings-density-sample" aria-hidden="true"><i /><i /><i /></span><span>{density.label}{preferences.density === density.id && <Check size={16} aria-hidden="true" />}</span></button>)}</div>
              <div className="settings-density-preview" aria-label="Yoğunluğun canlı önizlemesi">
                <div className="settings-density-preview-heading"><span><LayoutList size={18} aria-hidden="true" /><strong>Canlı önizleme</strong></span><span>{DENSITIES.find((density) => density.id === preferences.density)?.label} · Örnek veriler</span></div>
                <ul>
                  <li><div><strong>Market alışverişi</strong><span>Ece ödedi · 3 kişi</span></div><b>₺420,00</b></li>
                  <li><div><strong>İnternet faturası</strong><span>Deniz ödedi · 5 kişi</span></div><b>₺650,00</b></li>
                  <li><div><strong>Ev ihtiyaçları</strong><span>Ayşe ödedi · 2 kişi</span></div><b>₺185,00</b></li>
                </ul>
                <Link href={dashboardHref}>Panoda gör<ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            </section>
            <section className="settings-block"><div className="settings-control-row"><div><h3>Hareketleri azalt</h3><p>Geçişleri ve animasyonları azaltarak daha sakin bir arayüz kullan.</p></div><label className="settings-switch-label"><span className="visually-hidden">Hareketleri azalt</span><input type="checkbox" role="switch" checked={preferences.reducedMotion} onChange={(event) => updatePreferences({ reducedMotion: event.target.checked })} /><span className="settings-switch" aria-hidden="true" /></label></div><p className="settings-footnote">Cihazında hareket azaltma açıksa bu tercih de dikkate alınır.</p></section>
          </>}

          {activeSection === "household" && <>
            <button className="settings-text-button" type="button" onClick={() => navigateSection("telegram")}><Bell size={16} aria-hidden="true" />Telegram bildirimlerini aç</button>
            {homeStatus === "loading" && <div className="settings-loading" role="status">Ev bilgileri yükleniyor…</div>}
            {homeStatus === "error" && <div className="settings-error" role="alert"><div><strong>Ev bilgileri yüklenemedi.</strong><p>{homeError}</p></div><button type="button" className="settings-button" onClick={() => void loadAccountAndHome()}><RefreshCw size={16} aria-hidden="true" />Tekrar dene</button></div>}
            {homeStatus === "empty" && <div className="settings-empty"><Home size={28} aria-hidden="true" /><h3>Henüz açık bir ev hesabın yok.</h3><p>Evini oluşturduğunda veya bir eve katıldığında üyeleri ve davet kodunu burada görebilirsin.</p><Link className="settings-button settings-button--primary" href="/start">Ev hesabına git<ArrowRight size={17} aria-hidden="true" /></Link></div>}
            {homeStatus === "ready" && session && <>
              <section className="settings-block settings-block--first"><div className="settings-home-heading"><span className="settings-home-icon"><Home size={24} aria-hidden="true" /></span><div><h3>{session.householdName}</h3><p>{members.filter((member) => member.active).length} aktif üye{!remote ? " · Bu cihazdaki örnek oturum" : ""}</p></div></div><ul className="settings-member-list">{members.filter((member) => member.active).map((member) => <li key={member.id}><span className="settings-member-avatar" aria-hidden="true">{member.name.charAt(0).toLocaleUpperCase("tr")}</span><div><strong>{member.name}{member.id === session.memberId && <span className="settings-you">Sen</span>}</strong><span>{member.role === "owner" ? "Ev sahibi" : "Ev üyesi"}</span></div></li>)}</ul>{!members.some((member) => member.active) && <p className="settings-muted">Bu evde gösterilecek aktif üye bulunamadı.</p>}</section>
              <section className="settings-block" aria-labelledby="invite-heading"><div className="settings-block-heading"><div><h3 id="invite-heading">Ev arkadaşını davet et</h3><p>Davet kodunu paylaş. Ev arkadaşın bu kodla aynı hesaba katılabilir.</p></div></div>{session.joinCode ? <div className="settings-code-box"><label><span>Davet kodu</span><input aria-label="Davet kodu, seçip kopyalayabilirsin" value={session.joinCode} readOnly onFocus={(event) => event.target.select()} /></label><button className="settings-button" type="button" onClick={() => void copyCode()}><Copy size={17} aria-hidden="true" /><span>Kopyala</span></button></div> : <p className="settings-muted">{session.role === "owner" ? "Bu oturumda kayıtlı bir davet kodu yok. Yeni bir kod oluşturabilirsin." : "Davet kodu bu oturumda kayıtlı değil. Ev sahibinden güncel kodu iste."}</p>}
              <p className="settings-inline-notice" role="status">{codeNotice}</p>
              {session.role === "owner" && remote && <button className="settings-text-button" type="button" disabled={rotating || !account?.hasGoogleIdentity} onClick={() => session.joinCode ? rotateDialog.current?.showModal() : void rotateCode()}><RefreshCw size={16} aria-hidden="true" />{rotating ? "Kod oluşturuluyor…" : session.joinCode ? "Davet kodunu yenile" : "Davet kodu oluştur"}</button>}
              {session.role === "owner" && remote && !account?.hasGoogleIdentity && <p className="settings-footnote">Kod oluşturmak için Hesap bölümünden Google hesabını bağla.</p>}
              {!remote && <p className="settings-footnote">Bu yerel oturumdan ortak ev oluşturulamaz veya davet kodu yenilenemez.</p>}
              {session.role !== "owner" && <p className="settings-footnote">Davet kodunu yalnızca ev sahibi yenileyebilir.</p>}</section>
            </>}
          </>}

          {activeSection === "telegram" && <>
            {!remote ? <p>Telegram bildirimleri çevrimiçi ev hesaplarında kullanılabilir.</p>
              : session && account?.hasGoogleIdentity ? <TelegramSettings key={session.householdId + session.memberId} household={session.householdId} owner={session.role === "owner"} />
              : homeStatus === "loading" ? <p role="status">Ev üyeliğin kontrol ediliyor…</p>
              : homeStatus === "error" ? <div className="settings-error" role="alert"><p>{homeError}</p><button className="settings-button" onClick={() => void loadAccountAndHome()}>Tekrar dene</button></div>
              : !account?.hasGoogleIdentity ? <section className="settings-block"><p>Ev grubuna erişmek için Google hesabınla giriş yap.</p><button className="settings-button settings-button--primary" disabled={accountBusy} onClick={() => void googleSignIn()}>{accountBusy ? "Google’a yönlendiriliyor…" : "Google hesabıyla devam et"}</button>{accountError && <p role="alert">{accountError}</p>}</section>
              : <section className="settings-block"><p>Telegram grubunu kullanabilmek için önce bir ev oluştur veya mevcut evine katıl.</p><Link className="settings-button" href="/start">Ev hesabına git</Link></section>}
          </>}

          {activeSection === "account" && <>
            {accountStatus === "loading" ? <div className="settings-loading" role="status">Hesap bilgilerin yükleniyor…</div> : <>
              {accountStatus === "error" && <div className="settings-error" role="alert"><div><strong>Hesabına erişemedik.</strong><p>{accountError}</p></div><button className="settings-button" type="button" onClick={() => void loadAccountAndHome()}>Tekrar dene</button></div>}
              {accountStatus === "ready" && <section className="settings-block settings-block--first"><div className="settings-account-identity"><span className="settings-account-avatar"><UserRound size={26} aria-hidden="true" /></span><div><h3>{account?.displayName || session?.memberName || "Hesabın"}</h3><p>{account?.email || (account?.isAnonymous ? "Google hesabı henüz bağlı değil" : !remote ? "Bu cihazdaki yerel oturum" : "Oturum açık değil")}</p></div></div><div className="settings-account-detail"><span>Hesap türü</span><strong>{account?.hasGoogleIdentity ? "Google hesabı" : account?.isAnonymous ? "Misafir oturumu" : !remote ? "Yerel prototip" : "Giriş yapılmadı"}</strong></div>{session && <div className="settings-account-detail"><span>Ev hesabı</span><strong>{session.householdName}</strong></div>}</section>}
              {remote && accountStatus === "ready" && !account?.hasGoogleIdentity && <section className="settings-block"><h3>{account?.isAnonymous ? "Google hesabını bağla" : "Google ile giriş yap"}</h3><p className="settings-muted">{account?.isAnonymous ? "Mevcut ev üyeliğin korunur. Ortak hesaptaki işlemler ve cihazlar arası eşitleme için Google hesabını bağla." : "Ev hesabına eriş ve görünüm tercihlerini cihazların arasında eşitle."}</p><button className="settings-button settings-button--primary" disabled={accountBusy} type="button" onClick={() => void googleSignIn()}><UserRound size={17} aria-hidden="true" />{accountBusy ? "Google'a yönlendiriliyor…" : account?.isAnonymous ? "Google hesabını bağla" : "Google ile giriş yap"}</button></section>}
              {(account || session) && <section className="settings-block"><h3>Oturum</h3><p className="settings-muted">Bu tarayıcıdaki oturumunu kapatır. Ortak ev hesabındaki kayıtlar silinmez.</p><button className="settings-button settings-button--danger" disabled={accountBusy} type="button" onClick={() => void signOut()}><LogOut size={17} aria-hidden="true" />{accountBusy ? "İşlem sürüyor…" : "Oturumu kapat"}</button></section>}
              {accountError && accountStatus !== "error" && <div className="settings-error" role="alert">{accountError}</div>}
            </>}
          </>}

          {(activeSection === "appearance" || activeSection === "interface") && <footer className="settings-reset-row"><div><strong>Yeni bir başlangıç</strong><p>Bu kapsamdaki görünüm tercihlerini varsayılana döndür.</p></div><div><button className="settings-text-button" type="button" disabled={!canUndo} onClick={() => { undo(); setNotice("Son görünüm değişikliğin geri alındı."); }}><RotateCcw size={16} aria-hidden="true" />Geri al</button><button className="settings-button" type="button" disabled={status === "loading"} onClick={() => { resetPreferences(); setNotice("Bu kapsamdaki görünüm tercihlerin varsayılana döndürüldü. Geri alabilirsin."); }}>Varsayılana dön</button></div></footer>}
          <p className="settings-feedback" role="status" aria-live="polite">{notice}</p>
        </div>
      </div>
      <dialog className="settings-dialog" ref={rotateDialog} aria-labelledby="rotate-title" aria-describedby="rotate-description"><div className="settings-dialog-heading"><h2 id="rotate-title">Davet kodu yenilensin mi?</h2><button className="settings-icon-button" type="button" aria-label="Kapat" onClick={() => rotateDialog.current?.close()}><X size={20} aria-hidden="true" /></button></div><p id="rotate-description">Eski kod artık çalışmayacak. Henüz katılmamış ev arkadaşlarınla yeni kodu paylaşman gerekir. Mevcut üyeler etkilenmez.</p><div className="settings-dialog-actions"><button className="settings-button" type="button" autoFocus onClick={() => rotateDialog.current?.close()}>Vazgeç</button><button className="settings-button settings-button--primary" type="button" onClick={() => void rotateCode()}>Yeni kod oluştur</button></div></dialog>
    </main>
  );
}
