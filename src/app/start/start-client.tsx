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
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createRemoteHousehold, joinRemoteHousehold } from "@/lib/data-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { SESSION_KEY, type LocalSession } from "@/lib/local-store";

type Mode = "create" | "join";

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `EV-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

export default function StartPage() {
  const searchParams = useSearchParams();
  const supabaseConfigured = isSupabaseConfigured();
  const requestedMode = searchParams.get("mode");
  const [mode, setMode] = useState<Mode>(requestedMode === "join" ? "join" : "create");
  const [householdName, setHouseholdName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<LocalSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setSession(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

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

    if (mode === "join" && !supabaseConfigured) {
      setError("Ev koduyla katılmak için Supabase bağlantısı gerekir. Yerel mod yalnızca bu cihazda ev oluşturabilir.");
      return;
    }

    setSubmitting(true);
    try {
      const nextSession = supabaseConfigured
        ? mode === "create"
          ? await createRemoteHousehold(householdName.trim(), memberName.trim())
          : await joinRemoteHousehold(joinCode.trim().toUpperCase(), memberName.trim())
        : (() => {
            const code = mode === "create" ? createJoinCode() : joinCode.trim().toUpperCase();
            return {
              householdId: mode === "create" ? createId("household") : `household-${code}`,
              householdName: mode === "create" ? householdName.trim() : "Katıldığın ev",
              memberId: createId("member"),
              memberName: memberName.trim(),
              joinCode: code,
              role: mode === "create" ? "owner" : "member",
            } satisfies LocalSession;
          })();

      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
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
          <span className="wordmark-symbol" aria-hidden="true">EH</span>
          <span>EV HESAP</span>
        </Link>
        <Link className="header-back" href="/"><ArrowLeft aria-hidden="true" size={16} /> Ana sayfa</Link>
      </header>

      <section className="onboarding-layout" aria-label="Ev hesabı kurulumu">
        <div className="onboarding-intro">
          <h1>Önce aynı evde buluşun.</h1>
          <p className="onboarding-lede">
            Bir ev oluşturup kodunu paylaşabilir ya da ev arkadaşından aldığın
            kodla katılabilirsin. Harcamalar, o evin açık hesabında toplanır.
          </p>
          <ul className="onboarding-points">
            <li><KeyRound aria-hidden="true" size={18} /><span><strong>Ev kodu</strong><small>Katılmak için ev sahibinin kodunu kullan.</small></span></li>
            <li><Users aria-hidden="true" size={18} /><span><strong>Kişi ve pay</strong><small>Harcamanın kimleri ilgilendirdiğini seç.</small></span></li>
            <li><LockKeyhole aria-hidden="true" size={18} /><span><strong>Birlikte görün</strong><small>Özet ve geçmişi ev arkadaşlarınla takip et.</small></span></li>
          </ul>
        </div>

        <section className="onboarding-panel" aria-label="Ev oluştur veya katıl">
          {!session ? (
            <>
              <div className="mode-switch" role="tablist" aria-label="Ev işlemi">
                <button id="create-mode" aria-controls="setup-panel" className={mode === "create" ? "active" : ""} onClick={() => switchMode("create")} role="tab" aria-selected={mode === "create"} type="button">Yeni ev oluştur</button>
                <button id="join-mode" aria-controls="setup-panel" className={mode === "join" ? "active" : ""} onClick={() => switchMode("join")} role="tab" aria-selected={mode === "join"} type="button">Ev koduyla katıl</button>
              </div>

              <div className="form-heading">
                <span className="form-heading__icon" aria-hidden="true">{mode === "create" ? <Home size={20} /> : <KeyRound size={20} />}</span>
                <h2 id="setup-title">{mode === "create" ? "Yeni bir ev hesabı aç." : "Arkadaşının evine katıl."}</h2>
              </div>

              <div id="setup-panel" role="tabpanel" aria-labelledby={mode === "create" ? "create-mode" : "join-mode"}>
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
                <p className="form-footnote"><LockKeyhole aria-hidden="true" size={14} /> {supabaseConfigured ? "Oturumun Supabase Auth ile korunur." : mode === "join" ? "Supabase bağlantısı olmadan ev kodu doğrulanamaz." : "Supabase ayarlanana kadar bu cihazda yerel oturum açılır."}</p>
              </div>
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
              <Link className="primary-action form-submit" href="/dashboard">Dashboard&apos;a git <ArrowRight aria-hidden="true" size={17} /></Link>
              <button className="text-action" onClick={() => setSession(null)} type="button">Başka bir ev seç</button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
