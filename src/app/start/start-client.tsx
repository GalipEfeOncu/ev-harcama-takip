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

type Mode = "create" | "join";

type LocalSession = {
  householdId: string;
  householdName: string;
  memberId: string;
  memberName: string;
  joinCode: string;
  role: "owner" | "member";
};

const SESSION_KEY = "ev-hesap-session";

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
  const requestedMode = searchParams.get("mode");
  const [mode, setMode] = useState<Mode>(requestedMode === "join" ? "join" : "create");
  const [householdName, setHouseholdName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<LocalSession | null>(null);
  const [copied, setCopied] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setSession(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    const code = mode === "create" ? createJoinCode() : joinCode.trim().toUpperCase();
    const nextSession: LocalSession = {
      householdId: mode === "create" ? createId("household") : `household-${code}`,
      householdName: mode === "create" ? householdName.trim() : "Katıldığın ev",
      memberId: createId("member"),
      memberName: memberName.trim(),
      joinCode: code,
      role: mode === "create" ? "owner" : "member",
    };

    window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  async function copyCode() {
    if (!session) return;
    await navigator.clipboard.writeText(session.joinCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="onboarding-shell">
      <nav className="topbar onboarding-topbar" aria-label="Ana navigasyon">
        <Link className="brand" href="/" aria-label="Ev Hesap ana sayfa">
          <span className="brand-mark">eh</span>
          <span>ev hesap</span>
        </Link>
        <Link className="back-link" href="/"><ArrowLeft size={15} /> Ana sayfa</Link>
      </nav>

      <section className="onboarding-layout section-wrap">
        <div className="onboarding-intro">
          <p className="eyebrow"><Home size={15} /> evini seç, birlikte yaşa</p>
          <h1>Ortak hesap için ilk adım, <em>kendi evin.</em></h1>
          <p className="onboarding-lede">
            Yeni bir ev kurabilir veya arkadaşından aldığın kodla mevcut bir eve
            katılabilirsin. Her evin harcamaları birbirinden ayrı tutulur.
          </p>

          <div className="onboarding-points">
            <div><span><KeyRound size={16} /></span><p><strong>Tek kod</strong><br />Arkadaşlarınla kolayca paylaş.</p></div>
            <div><span><Users size={16} /></span><p><strong>Kişi bazlı</strong><br />Herkes kendi adını ve payını görür.</p></div>
            <div><span><LockKeyhole size={16} /></span><p><strong>Evine özel</strong><br />Kodunu bilmeyen veriye ulaşamaz.</p></div>
          </div>
        </div>

        <div className="onboarding-card">
          {!session ? (
            <>
              <div className="mode-switch" role="tablist" aria-label="Ev işlemi">
                <button className={mode === "create" ? "active" : ""} onClick={() => switchMode("create")} role="tab" aria-selected={mode === "create"} type="button">Yeni ev oluştur</button>
                <button className={mode === "join" ? "active" : ""} onClick={() => switchMode("join")} role="tab" aria-selected={mode === "join"} type="button">Koda katıl</button>
              </div>

              <div className="form-heading">
                <span className="form-icon">{mode === "create" ? <Home size={21} /> : <KeyRound size={21} />}</span>
                <div>
                  <p className="micro-label">{mode === "create" ? "YENİ EV" : "DAVETLİ ÜYE"}</p>
                  <h2>{mode === "create" ? "Evinizi birlikte kurun." : "Ev kodunu gir."}</h2>
                </div>
              </div>

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
                    <small>Ev sahibinin paylaştığı 11 karakterli kodu gir.</small>
                  </label>
                )}
                <label className="field-label">
                  Görünen adın
                  <input autoComplete="name" onChange={(event) => setMemberName(event.target.value)} placeholder="Örn. Ece" value={memberName} />
                  <small>Evde harcamaları kimin eklediğini anlamak için kullanılır.</small>
                </label>

                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="button button-primary form-submit" type="submit">
                  {mode === "create" ? "Ev kodumu oluştur" : "Eve katıl"}
                  <ArrowRight size={17} />
                </button>
              </form>
              <p className="form-footnote"><LockKeyhole size={13} /> Bu cihazda geçici bir prototip oturumu açılır.</p>
            </>
          ) : (
            <div className="success-state">
              <div className="success-icon"><CheckCircle2 size={25} /></div>
              <p className="eyebrow">hazırsın</p>
              <h2>{session.role === "owner" ? "Evin hazır." : "Eve katıldın."}</h2>
              <p className="success-copy">
                {session.role === "owner" ? "Bu kodu ev arkadaşlarınla paylaş:" : `${session.householdName} için oturumun hazır.`}
              </p>
              <div className="code-box">
                <strong>{session.joinCode}</strong>
                <button aria-label="Ev kodunu kopyala" onClick={copyCode} type="button">
                  {copied ? <Check size={17} /> : <Clipboard size={17} />}
                </button>
              </div>
              <p className="code-caption">Kodu bilen kişiler bu eve katılabilir. Bir sonraki adımda dashboard açılacak.</p>
              <button className="text-action" onClick={() => setSession(null)} type="button">Başka bir ev seç <ArrowRight size={15} /></button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
