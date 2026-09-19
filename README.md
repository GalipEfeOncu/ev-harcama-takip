# Ev Harcama Takip

Aynı evde yaşayan kişilerin ortak harcamalarını kaydetmesini, geçmiş harcamaları takip etmesini ve borç/alacak durumunu sade biçimde hesaplamasını amaçlayan mobil öncelikli bir PWA projesi.

Ürün ve teknik plan için [ev-harcama-app-plan.md](./ev-harcama-app-plan.md) dosyasına göz atabilirsiniz.

## Planlanan teknoloji

- Next.js ve TypeScript
- Tailwind CSS ve shadcn/ui
- Supabase PostgreSQL ve Auth
- Vercel üzerinde responsive PWA

## Geliştirme

```bash
npm install
npm run dev
```

Supabase bağlantısı eklemek için `.env.example` dosyasını `.env.local` olarak kopyalayıp proje URL’si ile publishable key değerlerini doldurun. `supabase/migrations` altındaki migration dosyalarını sırayla Supabase’e uygulayın.

Hesap açma ve ev oluşturma/katılma için Google ile giriş gerekir. Supabase Auth > Providers bölümünde Google’ı etkinleştirin, diğer giriş sağlayıcılarını ve Anonymous Sign-Ins’i kapatın. Google Cloud OAuth istemcisinde yetkili yönlendirme URI’si olarak `https://ovszyjdpmxkmgujrayvl.supabase.co/auth/v1/callback` adresini ekleyin. Supabase’in URL Configuration > Redirect URLs listesine `http://localhost:3000/auth/callback` ve `https://ev-harcama-takip.vercel.app/auth/callback` adreslerini ekleyin. Google Client ID ve Secret yalnızca Supabase paneline girilmeli; repoya veya sohbete yazılmamalıdır. Google sağlayıcısını etkinleştirip bu adresleri ekledikten sonra yeni auth ve borç ödemesi migration’larını sırayla uygulayın; auth migration’ı anonim oturumların veri değiştirmesini veritabanında da engeller.

Supabase değişkenleri yokken Google girişi ve yeni ev işlemleri kullanılamaz. Daha önce bu cihazda açılmış yerel oturumlar prototip amaçlı okunabilir; evler arası paylaşım Supabase Auth/RLS gerektirir. Doğrudan borç ödemeleri açık bakiyeye eklenir; dönem kapatma harcamalarla ödemeleri birlikte arşivler.

```bash
npm run test
npm run lint
npm run build
```
