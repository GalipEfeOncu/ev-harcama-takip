# Ev Harcama Takip

Aynı evde yaşayan kişilerin ortak harcamalarını kaydetmesini, geçmiş harcamaları takip etmesini ve borç/alacak durumunu sade biçimde hesaplamasını amaçlayan mobil öncelikli bir PWA projesi.

Ürün ve teknik plan için [ev-harcama-app-plan.md](./ev-harcama-app-plan.md) dosyasına göz atabilirsiniz.

## Planlanan teknoloji

- Next.js ve TypeScript
- Tailwind CSS ve shadcn/ui
- Supabase PostgreSQL ve Auth
- Vercel üzerinde responsive PWA

## Ayarlar ve kişiselleştirme

`/settings` altında Görünüm, Arayüz, Ev ve üyeler, Hesap bölümleri bulunur.
Pano ve hesap inceleme ekranındaki tek Ayarlar bağlantısı bu alana açılır.

- 24 uyumlu açık/koyu palet; arama, favoriler ve örnek hesap önizlemesi.
- Birbirinden bağımsız beş yazı tipi seçeneği, üç yazı boyutu ve üç arayüz yoğunluğu.
- Sistem temasını izleme, hareketleri azaltma, varsayılana dönme ve geri alma.
- Hesaba bağlı tercihler ve bu cihaz için ayrı görünüm; girişsiz kullanımda tarayıcıda saklama.
- Ev üyeleri, davet kodunu kopyalama, ev sahibi için kod yenileme ve hesap işlemleri.

Hesap eşitlemesi için `20261023120000_user_appearance_preferences.sql` migration'ı
23 Ekim 2026'da canlı `ev-harcama-takip` Supabase projesine uygulanmıştır. Her
kullanıcı yalnızca kendi tercih satırına erişebilir; tablo için RLS politikaları
ve güncelleme zaman damgası tetikleyicisi doğrulanmıştır. Canlı OAuth ve gerçek
hesaplar arası tercih eşitlemesi henüz doğrulanmamıştır.

Varsayılan Mada yazı tipi `@fontsource-variable/mada` paketinden uygulamayla
birlikte sunulur; derleme sırasında Google Fonts bağlantısı gerektirmez. Diğer
yazı tipi seçenekleri cihazdaki mevcut yazı tiplerini kullanır.

## Yerel çalıştırma

```bash
npm install
npm run dev
```

Supabase bağlantısı eklemek için `.env.example` dosyasını `.env.local` olarak kopyalayıp proje URL’si ile publishable key değerlerini doldurun. `supabase/migrations` altındaki migration dosyalarını sırayla Supabase’e uygulayın.

Production giriş ve PWA kurulumu için tek adres `https://ev-harcama-takip.vercel.app` kullanılır. `https://evhesap.vercel.app` bu adrese, yol ve sorgu parametrelerini koruyan geçici 307 yönlendirmesi yapar. Böylece Google girişindeki PKCE doğrulayıcısı, oturum çerezleri ve localStorage yedeği aynı origin'de kalır. Daha önce kısa adresten kurulan PWA'nın kapsamı eski origin'e bağlı olabilir; uygulamayı hedef adresten yeniden kurun. Resmi adres ileride değiştirilirse önce Supabase Site URL ve Redirect URLs ayarlarını güncelleyip OAuth dönüşünü doğrulayın, ardından bu yönlendirmeyi değiştirin.

Hesap açma ve ev oluşturma/katılma için Google ile giriş gerekir. Google Auth Platform > Data Access bölümünde `openid` kapsamını ekleyin (`userinfo.email` ve `userinfo.profile` varsayılan kapsamlar arasındadır). Uygulama test modundayken Google hesaplarını Test users listesine ekleyin. Web OAuth istemcisinde `https://ev-harcama-takip.vercel.app` ve `http://localhost:3000` JavaScript origin’lerini; `https://ovszyjdpmxkmgujrayvl.supabase.co/auth/v1/callback` yönlendirme URI’sini kullanın.

Supabase Authentication > Sign In / Providers bölümünde Google’ı etkinleştirip OAuth Client ID ve Secret’ı girin. Eski anonim ev oturumlarının aynı kullanıcı kimliği ve verilerle Google’a bağlanabilmesi için Authentication ayarlarında **Allow manual linking** seçeneğini açın. Google bağlantısı tamamlanana kadar **Anonymous Sign-Ins** açık kalmalıdır; tüm eski oturumlar Google’a bağlandıktan sonra yeni anonim kayıtları kapatabilirsiniz. Diğer giriş sağlayıcılarını kapalı tutun. Supabase URL Configuration > Site URL değeri `https://ev-harcama-takip.vercel.app` olmalı; Redirect URLs listesine `http://localhost:3000/auth/callback` ve `https://ev-harcama-takip.vercel.app/auth/callback` ekleyin. Google Client ID ve Secret yalnızca Supabase paneline girilmeli; repoya veya sohbete yazılmamalıdır. Google ayarlarını tamamladıktan sonra `supabase/migrations` altındaki migration’ları sırayla uygulayın; auth migration’ı Google kimliği olmayan oturumların veriyi değiştirmesini veritabanı seviyesinde engeller.

Supabase değişkenleri yokken Google girişi ve yeni ev işlemleri kullanılamaz. Daha önce bu cihazda açılmış yerel oturumlar prototip amaçlı okunabilir; evler arası paylaşım Supabase Auth/RLS gerektirir. Doğrudan borç ödemeleri açık bakiyeye eklenir; dönem kapatma harcamalarla ödemeleri birlikte arşivler.

Admin paneli `/admin` adresinde açılır. Kullanıcı ve ev listeleri için sunucuda `ADMIN_EMAILS` ile `SUPABASE_SECRET_KEY` ayarlarının yapılması gerekir. Kurulum ve erişim modeli için [docs/admin-panel.md](./docs/admin-panel.md) dosyasına bakın.

```bash
npm run test
npm run lint
npm run build
```
