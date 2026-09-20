"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Home,
  KeyRound,
  LockKeyhole,
  Users,
} from "lucide-react";
import Link from "next/link";
import ThemeControl from "@/components/theme-control";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { beginGoogleSignIn, getAccountSnapshot } from "@/lib/auth";
import GoogleMark from "@/components/google-mark";
import { createRemoteHousehold, joinRemoteHousehold } from "@/lib/data-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { saveLocalSession, type LocalSession } from "@/lib/local-store";

type Mode = "create" | "join";
type AuthState = "checking" | "unavailable" | "signed-out" | "anonymous" | "unlinked" | "account";

export default function StartPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabaseConfigured = isSupabaseConfigured();
  const authFailed = searchParams.get("auth") === "failed";
  const requestedMode = searchParams.get("mode");
  const [mode, setMode] = useState<Mode>(requestedMode === "join" ? "join" : "create");
  const [householdName, setHouseholdName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [authState, setAuthState] = useState<AuthState>(supabaseConfigured ? "checking" : "unavailable");
  const [authBusy, setAuthBusy] = useState(false);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;

    let active = true;
    void getAccountSnapshot().then((account) => {
      if (!active) return;
      setAuthState(!account ? "signed-out" : account.hasGoogleIdentity ? "account" : account.isAnonymous ? "anonymous" : "unlinked");
      if (account?.displayName) setMemberName((current) => current || account.displayName);
    }).catch(() => {
      if (active) setAuthState("signed-out");
    });

    return () => { active = false; };
  }, [supabaseConfigured]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setSession(null);
    router.replace(`/start?mode=${nextMode}`, { scroll: false });
  }

  async function continueWithGoogle() {
    setError("");
    setAuthBusy(true);
    try {
      const linkCurrentAccount = authState === "anonymous" || authState === "unlinked";
      const nextPath = linkCurrentAccount ? "/" : `/start?mode=${mode}`;
      await beginGoogleSignIn(nextPath, linkCurrentAccount);
    } catch (signInFailure) {
      setError(signInFailure instanceof Error ? signInFailure.message : "Google girişi başlatılamadı.");
      setAuthBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (authState !== "account") {
      setError("Ev oluşturmak veya katılmak için önce Google hesabıyla giriş yap.");
      return;
    }

    if (memberName.trim().length < 2) {
      setError("Görünen adın en az 2 karakter olmalı.");
      return;
    }

    if (mode === "create" && householdName.trim().length < 2) {
      setError("Ev adı en az 2 karakter olmalı.");
      return;
    }

    if (mode === "join" && !/^EV-[A-Z0-9]{8}$/.test(joinCode.trim().toUpperCase())) {
      setError("Geçerli bir ev kodu gir: EV-XXXXXXXX.");
      return;
    }

    setSubmitting(true);
    try {
      const nextSession = mode === "create"
        ? await createRemoteHousehold(householdName.trim(), memberName.trim())
        : await joinRemoteHousehold(joinCode.trim().toUpperCase(), memberName.trim());

      saveLocalSession(nextSession);
      if (mode === "join") {
        router.replace(`/dashboard?household=${encodeURIComponent(nextSession.householdId)}`);
        return;
      }
      setSession(nextSession);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Ev işlemi tamamlanamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode() {
    if (!session) return;
    await navigator.clipboard.writeText(session.joinCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="onboarding-shell">
      <header className="public-header onboarding-header">
        <Link className="public-wordmark" href="/" aria-label="Ev Hesap ana sayfa">
          <span className="wordmark-symbol" aria-hidden="true"><Home /></span>
          <span>Ev Hesap</span>
        </Link>
        <div className="header-tools">
          <ThemeControl />
          <Link className="header-back" href="/"><ArrowLeft aria-hidden="true" size={16} /> Ana sayfa</Link>
        </div>
      </header>

      <section className="onboarding-layout" aria-label="Ev hesabı kurulumu">
        <div className="onboarding-intro">
          <h1>Önce aynı evde buluşun.</h1>
          <p className="onboarding-lede">
            Google hesabınla giriş yap; yeni bir ev hesabı açabilir veya ev koduyla
            katılabilirsin. Harcama eklerken ödeyeni ve katılımcı paylarını seçebilirsin.
          </p>
          <ul className="onboarding-points">
            <li><KeyRound aria-hidden="true" size={18} /><span><strong>Ev kodu</strong><small>Katılmak için ev sahibinin kodunu kullan.</small></span></li>
            <li><Users aria-hidden="true" size={18} /><span><strong>Kişi ve pay</strong><small>Harcamanın kimleri ilgilendirdiğini seç.</small></span></li>
            <li><ArrowRight aria-hidden="true" size={18} /><span><strong>Google hesabıyla devam et</strong><small>Girişten sonra yeni bir ev açabilir veya kodla katılabilirsin.</small></span></li>
          </ul>
        </div>

        <section className="onboarding-panel" aria-label="Ev oluştur veya katıl">
          {!session ? (
            <>
              {authState === "checking" ? (
                <p className="form-footnote" role="status">Hesap kontrol ediliyor…</p>
              ) : authState !== "account" ? (
                <div className="google-sign-in">
                  <div className="form-heading">
                    <span className="form-heading__icon" aria-hidden="true"><LockKeyhole size={20} /></span>
                    <h2>{authState === "anonymous" || authState === "unlinked" ? "Mevcut evini koru." : "Google hesabınla devam et."}</h2>
                  </div>
                  {authState === "anonymous" || authState === "unlinked" ? (
                    <p className="google-sign-in__copy">Bu cihazdaki mevcut ev üyeliğini ve kayıtlarını korumak için Google hesabını aynı oturuma bağla.</p>
                  ) : authState === "unavailable" ? (
                    <p className="google-sign-in__copy">Google girişi için Supabase bağlantısı yapılandırılmalı.</p>
                  ) : (
                    <p className="google-sign-in__copy">Ev oluşturmak, davet koduyla katılmak ve hesabına yeniden dönmek için Google ile giriş yap.</p>
                  )}
                  {(error || authFailed) && <p className="form-error" role="alert">{error || "Giriş bu kez tamamlanmadı. Bağlantını kontrol edip yeniden deneyebilirsin."}</p>}
                  <button className="secondary-action google-action" disabled={authBusy || authState === "unavailable"} onClick={() => void continueWithGoogle()} type="button">
                    <GoogleMark />
                    {authBusy ? "Google açılıyor…" : authState === "anonymous" || authState === "unlinked" ? "Google hesabını bağla" : "Google ile devam et"}
                  </button>
                  <p className="form-footnote"><ArrowRight aria-hidden="true" size={14} /> Girişten sonra ev açma ya da davet koduyla katılma seçeneği sunulur.</p>
                </div>
              ) : (
                <>
                  <div className="mode-switch" role="group" aria-label="Ev işlemi">
                    <button aria-pressed={mode === "create"} className={mode === "create" ? "active" : ""} onClick={() => switchMode("create")} type="button">Yeni ev oluştur</button>
                    <button aria-pressed={mode === "join"} className={mode === "join" ? "active" : ""} onClick={() => switchMode("join")} type="button">Ev koduyla katıl</button>
                  </div>
                  <div className="form-heading">
                    <span className="form-heading__icon" aria-hidden="true">{mode === "create" ? <Home size={20} /> : <KeyRound size={20} />}</span>
                    <h2 id="setup-title">{mode === "create" ? "Yeni bir ev hesabı aç." : "Arkadaşının evine katıl."}</h2>
                  </div>

                  <div className="setup-panel">
                    <form onSubmit={handleSubmit} noValidate>
                  {mode === "create" && (
                    <label className="field-label">
                      Ev adı
                      <input autoComplete="organization" onChange={(event) => setHouseholdName(event.target.value)} placeholder="Örn. Çamlık Ev" value={householdName} />
                    </label>
                  )}
                  {mode === "join" && (
                    <label className="field-label">
                      Ev kodu
                      <input autoCapitalize="characters" autoComplete="off" maxLength={11} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="EV-7K4P2M9Q" spellCheck={false} value={joinCode} />
                      <small>Ev sahibinin paylaştığı EV-XXXXXXXX kodunu gir.</small>
                    </label>
                  )}
                  <label className="field-label">
                    Görünen adın
                    <input autoComplete="name" onChange={(event) => setMemberName(event.target.value)} placeholder="Örn. Ece" value={memberName} />
                    <small>Ev arkadaşların harcama kayıtlarında bu adı görür.</small>
                  </label>

                      {error && <p className="form-error" role="alert">{error}</p>}
                      <button className="primary-action form-submit" disabled={submitting} type="submit">
                        {submitting ? "Hazırlanıyor…" : mode === "create" ? "Ev kodumu oluştur" : "Eve katıl"}
                        <ArrowRight aria-hidden="true" size={17} />
                      </button>
                    </form>
                    <p className="form-footnote"><ArrowRight aria-hidden="true" size={14} /> Giriş tamamlandı. Ev hesabına geçip açık giderleri inceleyebilirsin.</p>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="success-state" aria-live="polite">
              <span className="success-icon"><CheckCircle2 aria-hidden="true" size={24} /></span>
              <h2>{session.role === "owner" ? "Evin hazır." : "Eve katıldın."}</h2>
              <p className="success-copy">
                {session.role === "owner" ? "Bu kodu ev arkadaşlarınla paylaş:" : `${session.householdName} için oturumun hazır.`}
              </p>
              <div className="code-box">
                <strong>{session.joinCode}</strong>
                <button aria-label={copied ? "Ev kodu kopyalandı" : "Ev kodunu kopyala"} onClick={copyCode} type="button">
                  {copied ? <Check aria-hidden="true" size={18} /> : <Clipboard aria-hidden="true" size={18} />}
                </button>
              </div>
              <p className="code-caption">Bu evin açık harcamalarını ve bakiyelerini görmek için devam et.</p>
              <Link className="primary-action form-submit" href="/dashboard">Ev hesabına dön <ArrowRight aria-hidden="true" size={17} /></Link>
              <button className="text-action" onClick={() => setSession(null)} type="button">Başka bir ev seç</button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
