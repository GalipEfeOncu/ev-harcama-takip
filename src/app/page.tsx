import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  ClipboardList,
  House,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
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
      <span className="sample-person__node" aria-hidden="true" />
      <span className="sample-person__name">{member.name}</span>
      <strong>{member.amount}</strong>
      <span className="sample-person__state">{member.state}</span>
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
      <header className="public-header">
        <Link className="public-wordmark" href="/" aria-label="Ev Hesap ana sayfa">
          <span className="wordmark-symbol" aria-hidden="true">EH</span>
          <span>EV HESAP</span>
        </Link>
        <nav className="public-nav" aria-label="Sayfa bölümleri">
          <a href="#nasil-calisir">Nasıl çalışır?</a>
          <a href="#hesaplama">Hesaplama</a>
        </nav>
        <Link className="header-action" href="/start?mode=create">
          Evini oluştur <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <h1 id="landing-title">Ortak evin hesabı <span>tek panoda.</span></h1>
          <p>
            Ev kodunu paylaşın; marketi, faturayı ve herkesin payını birlikte
            görün. Ev Hesap açık giderlerden kimin kime ödeme yapacağını çıkarır.
          </p>
          <div className="landing-actions">
            <Link className="primary-action landing-primary" href="/start?mode=create">
              <House aria-hidden="true" size={17} /> Ev oluştur <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link className="text-link" href="/start?mode=join">
              Ev kodum var <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </div>
          <p className="landing-note"><Users aria-hidden="true" size={15} /> Aynı evde yaşayanlar için ortak gider hesabı.</p>
        </div>

        <section className="sample-panel" aria-label="Örnek ev hesabı panosu">
          <div className="sample-panel__header">
            <div>
              <span className="sample-panel__house">ÇAMLIK EV</span>
              <h2>Açık hesap</h2>
            </div>
            <span className="sample-panel__tag">Örnek pano</span>
          </div>
          <div className="sample-total">
            <span>Açık gider toplamı</span>
            <strong>₺3.250</strong>
          </div>
          <ul className="sample-rail" aria-label="Beş ev arkadaşının örnek bakiyesi">
            <li className="sample-rail__row sample-rail__row--three">
              <ul className="sample-rail__members">
                {sampleMembers.slice(0, 3).map((member) => <SampleMember key={member.name} member={member} />)}
              </ul>
            </li>
            <li className="sample-rail__row sample-rail__row--two">
              <ul className="sample-rail__members">
                {sampleMembers.slice(3).map((member) => <SampleMember key={member.name} member={member} />)}
              </ul>
            </li>
          </ul>
          <div className="sample-expenses">
            <div className="sample-expenses__heading">
              <h3>Son eklenenler</h3>
              <span>temsili kayıtlar</span>
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
          <p>Evdeki herkes aynı açık hesabı görür. Kimin ödediği ve kimlerin paylaştığı kayıtta kalır.</p>
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
          <span className="wordmark-symbol" aria-hidden="true">EH</span>
          <span>EV HESAP</span>
        </Link>
        <p>Ev arkadaşlarının ortak gider hesabı.</p>
        <Link href="/start">Başla <ArrowUpRight aria-hidden="true" size={15} /></Link>
      </footer>
    </main>
  );
}
