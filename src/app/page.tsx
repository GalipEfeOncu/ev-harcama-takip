import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  ClipboardList,
  House,
  HousePlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import ThemeControl from "@/components/theme-control";
import { createClient as createServerClient, hasSupabaseConfiguration } from "@/lib/supabase/server";

const sampleMembers = [
  { name: "Ece", amount: "+₺1.100", state: "alacaklı" },
  { name: "Mert", amount: "−₺25", state: "borçlu" },
  { name: "Deniz", amount: "−₺150", state: "borçlu" },
  { name: "Ayşe", amount: "−₺525", state: "borçlu" },
  { name: "Can", amount: "−₺400", state: "borçlu" },
];

const sampleExpenses = [
  { description: "Pazar alışverişi", payer: "Ece ödedi", participants: "3 kişi", amount: "₺900" },
  { description: "Su faturası", payer: "Mert ödedi", participants: "2 kişi", amount: "₺600" },
  { description: "Temizlik malzemesi", payer: "Deniz ödedi", participants: "3 kişi", amount: "₺300" },
];

function SampleMember({ member }: { member: (typeof sampleMembers)[number] }) {
  return (
    <li className="sample-person">
      <span className="sample-person__name">{member.name}</span>
      <span className="sample-person__state">{member.state}</span>
      <strong>{member.amount}</strong>
    </li>
  );
}

export default async function HomePage() {
  if (hasSupabaseConfiguration()) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: membership, error } = await supabase
        .from("members")
        .select("household_id")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membership) redirect(`/dashboard?household=${encodeURIComponent(membership.household_id)}`);
      if (error) redirect("/dashboard");
      redirect("/start");
    }
  }

  return (
    <main className="marketing-shell" id="top">
      <a className="skip-link" href="#main-content">İçeriğe geç</a>
      <header className="public-header">
        <Link className="public-wordmark" href="/" aria-label="Ev Hesap ana sayfa">
          <span className="wordmark-symbol" aria-hidden="true"><House /></span>
          <span>Ev Hesap</span>
        </Link>
        <nav className="public-nav" aria-label="Sayfa bölümleri">
          <a href="#nasil-calisir">Nasıl çalışır?</a>
          <a href="#hesaplama">Hesaplama</a>
        </nav>
        <div className="header-tools">
          <ThemeControl />
          <Link aria-label="Ev oluştur" className="header-action" href="/start?mode=create">
            Ev oluştur <HousePlus aria-hidden="true" size={16} />
          </Link>
        </div>
      </header>

      <section className="landing-hero" id="main-content" aria-labelledby="landing-title">
        <div className="landing-copy">
          <h1 id="landing-title">Ortak ev harcamaları <span>aynı hesapta.</span></h1>
          <p>
            Ev kodunu paylaşın; kimin ne ödediğini, harcamaya kimlerin katıldığını
            ve açık bakiyeleri birlikte görün.
          </p>
          <div className="landing-actions">
            <Link className="primary-action landing-primary" href="/start?mode=create">
              <House aria-hidden="true" size={18} /> Ev oluştur <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className="text-link" href="/start?mode=join">
              Ev kodum var <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </div>
          <p className="landing-note"><Users aria-hidden="true" size={17} /> Bir ev hesabında gideri, ödeyeni ve payları kaydedin.</p>
        </div>

        <section className="sample-panel" aria-label="Örnek ev hesabı">
          <div className="sample-panel__header">
            <div>
              <h2>Bu evin açık giderleri</h2>
            </div>
            <span className="sample-panel__tag">Temsili görünüm</span>
          </div>
          <div className="sample-total">
            <span>Açık gider toplamı</span>
            <strong>₺3.250</strong>
          </div>
          <div className="sample-balances" aria-label="Örnek kişi bakiyeleri">
            <p className="sample-section-title">Kişi bakiyeleri</p>
            <ul>{sampleMembers.map((member) => <SampleMember key={member.name} member={member} />)}</ul>
          </div>
          <div className="sample-expenses">
            <div className="sample-expenses__heading">
              <h3>Son hareketler</h3>
            </div>
            {sampleExpenses.map((expense) => (
              <div className="sample-expense" key={expense.description}>
                <div>
                  <strong>{expense.description}</strong>
                  <span>{expense.payer} · {expense.participants}</span>
                </div>
                <b>{expense.amount}</b>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="how-section" id="nasil-calisir" aria-labelledby="how-title">
        <div className="section-intro">
          <h2 id="how-title">Harcama ortaksa, kayıt da ortak.</h2>
          <p>Açık hesapta gider, ödeyen kişi ve katılımcı payları birlikte izlenir.</p>
        </div>
        <ol className="process-list">
          <li>
            <span className="process-step" aria-hidden="true">1</span>
            <div><h3>Ev kodunu paylaş</h3><p>Bir ev oluştur, kodla ev arkadaşlarını davet et.</p></div>
            <ArrowRight aria-hidden="true" size={18} />
          </li>
          <li>
            <span className="process-step" aria-hidden="true">2</span>
            <div><h3>Gideri kaydet</h3><p>Tutarı, ödeyeni ve harcamaya katılanları ekle.</p></div>
            <ArrowRight aria-hidden="true" size={18} />
          </li>
          <li>
            <span className="process-step" aria-hidden="true">3</span>
            <div><h3>Bakiyeyi birlikte gör</h3><p>Açık giderlerden çıkan net bakiyeleri ve önerilen ödemeleri incele.</p></div>
            <Check aria-hidden="true" size={18} />
          </li>
        </ol>
      </section>

      <section className="calculation-note" id="hesaplama" aria-labelledby="calculation-title">
        <div className="calculation-note__icon"><CircleHelp aria-hidden="true" size={20} /></div>
        <div>
          <h2 id="calculation-title">Kapanış kararı ev arkadaşlarında.</h2>
          <p>Ev Hesap açık harcamalardan ödeme listesini çıkarır. Dönemi ne zaman kapatacağınıza siz karar verirsiniz; uygulama para transferi yapmaz.</p>
        </div>
        <ClipboardList aria-hidden="true" className="calculation-note__mark" size={28} />
      </section>

      <footer className="public-footer">
        <Link className="public-wordmark" href="#top">
          <span className="wordmark-symbol" aria-hidden="true"><House /></span>
          <span>Ev Hesap</span>
        </Link>
        <p>Ev arkadaşlarının ortak gider hesabı.</p>
        <Link href="/start">Başla <ArrowUpRight aria-hidden="true" size={15} /></Link>
      </footer>
    </main>
  );
}
