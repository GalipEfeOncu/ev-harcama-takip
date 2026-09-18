import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Home,
  LockKeyhole,
  ReceiptText,
  Sparkles,
  Users,
} from "lucide-react";

const expenses = [
  { label: "Market alışverişi", person: "Ece ödedi", amount: "₺850" },
  { label: "İnternet faturası", person: "Mert ödedi", amount: "₺420" },
  { label: "Temizlik", person: "Deniz ödedi", amount: "₺280" },
];

export default function HomePage() {
  return (
    <main className="site-shell">
      <div className="grain" aria-hidden="true" />

      <nav className="topbar" aria-label="Ana navigasyon">
        <a className="brand" href="#top" aria-label="Ev Hesap ana sayfa">
          <span className="brand-mark">eh</span>
          <span>ev hesap</span>
        </a>

        <div className="topbar-links">
          <a href="#nasıl-çalışır">Nasıl çalışır?</a>
          <a href="#güvenli">Güvenli ve özel</a>
        </div>

        <a className="nav-action" href="/start">
          Başla <ArrowUpRight size={16} strokeWidth={2.2} />
        </a>
      </nav>

      <section className="hero section-wrap" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            <Sparkles size={15} /> ortak ev bütçesi için sade düzen
          </p>
          <h1>
            Kimin ne kadar ödeyeceği artık <em>mutfak masasını</em> beklemiyor.
          </h1>
          <p className="hero-lede">
            Ev arkadaşlarınla yaptığınız harcamaları tek yerde tutun. Ev kodunu
            paylaşın, fişi ekleyin, borçları birkaç saniyede netleştirin.
          </p>

          <div className="hero-actions" id="başla">
            <a className="button button-primary" href="/start?mode=create">
              <Home size={18} /> Ev oluştur
              <ArrowRight size={17} />
            </a>
            <a className="button button-quiet" href="/start?mode=join">
              Koda katıl <ArrowRight size={17} />
            </a>
          </div>

          <div className="hero-note">
            <span className="note-dot" />
            Üyelik yok, karmaşa yok. Her ev kendi koduyla ayrı.
          </div>
        </div>

        <div className="ledger-wrap" aria-label="Ev Hesap örnek görünümü">
          <div className="ledger-sticker sticker-top">EYLÜL 2026</div>
          <div className="ledger-card">
            <div className="ledger-topline">
              <div>
                <p className="micro-label">EV HESAP</p>
                <h2>Çamlık Ev</h2>
              </div>
              <span className="status-pill"><span /> açık dönem</span>
            </div>

            <div className="total-block">
              <p>Bu ay ortak harcama</p>
              <strong>₺12.450<span>,00</span></strong>
            </div>

            <div className="balance-row">
              <div className="balance-person">
                <span className="avatar avatar-coral">E</span>
                <div><strong>Ece</strong><small>alacaklı</small></div>
              </div>
              <span className="positive">+₺350</span>
            </div>
            <div className="balance-row">
              <div className="balance-person">
                <span className="avatar avatar-sage">M</span>
                <div><strong>Mert</strong><small>alacaklı</small></div>
              </div>
              <span className="positive">+₺120</span>
            </div>
            <div className="balance-row">
              <div className="balance-person">
                <span className="avatar avatar-ink">D</span>
                <div><strong>Deniz</strong><small>borçlu</small></div>
              </div>
              <span className="negative">−₺470</span>
            </div>

            <div className="ledger-divider" />
            <div className="ledger-foot">
              <span><ReceiptText size={15} /> 18 harcama</span>
              <span><Users size={15} /> 3 kişi</span>
            </div>
          </div>
          <div className="ledger-sticker sticker-bottom">AÇIK HESAP</div>
        </div>
      </section>

      <section className="trust-strip section-wrap" id="güvenli">
        <div className="trust-line" />
        <p><LockKeyhole size={15} /> Ev kodu olmayan göremez</p>
        <div className="trust-line" />
        <p><Check size={15} /> Harcamalar silinmez, dönemler korunur</p>
        <div className="trust-line" />
      </section>

      <section className="flow section-wrap" id="nasıl-çalışır">
        <div className="section-heading">
          <p className="eyebrow">üç adımda ortak düzen</p>
          <h2>Hesap kitap, hesap sormaya dönüşmesin.</h2>
          <p>Ev kodunu bilen herkes kendi evine katılır. Gerisini Ev Hesap halleder.</p>
        </div>

        <div className="flow-grid">
          <article className="flow-card flow-card-coral">
            <span className="flow-number">01</span>
            <div className="flow-icon"><Users size={20} /></div>
            <h3>Evini oluştur</h3>
            <p>Bir isim seç, sana özel ev kodunu al ve arkadaşlarınla paylaş.</p>
          </article>
          <article className="flow-card flow-card-sage">
            <span className="flow-number">02</span>
            <div className="flow-icon"><ReceiptText size={20} /></div>
            <h3>Harcamanı ekle</h3>
            <p>Kim ödedi, kimler içindi? Bir fiş gibi hızlıca kaydet.</p>
          </article>
          <article className="flow-card flow-card-ink">
            <span className="flow-number">03</span>
            <div className="flow-icon"><ArrowDownLeft size={20} /></div>
            <h3>Borcu sadeleştir</h3>
            <p>İstediğin zaman hesapla; gereksiz transferleri tek listede azalt.</p>
          </article>
        </div>
      </section>

      <section className="recent section-wrap">
        <div className="recent-header">
          <div>
            <p className="eyebrow">örnek görünüm</p>
            <h2>Günün harcamaları</h2>
          </div>
          <span className="date-chip">18 Eylül 2026</span>
        </div>
        <div className="expense-preview">
          {expenses.map((expense) => (
            <div className="expense-row" key={expense.label}>
              <span className="expense-icon"><ReceiptText size={17} /></span>
              <div><strong>{expense.label}</strong><small>{expense.person}</small></div>
              <b>{expense.amount}</b>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer section-wrap">
        <a className="brand" href="#top">
          <span className="brand-mark">eh</span>
          <span>ev hesap</span>
        </a>
        <p>Ortak yaşamın hesabı, ortak aklın işi.</p>
        <span className="footer-year">2026 · PWA</span>
      </footer>
    </main>
  );
}
