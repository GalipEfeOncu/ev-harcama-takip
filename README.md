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

Supabase bağlantısı eklemek için `.env.example` dosyasını `.env.local` olarak kopyalayın ve proje URL’si ile publishable key değerlerini doldurun. Ardından `supabase/migrations/20260918180000_initial_schema.sql` dosyasını Supabase SQL Editor üzerinden çalıştırın ve Anonymous Auth’u etkinleştirin.

Supabase değişkenleri yokken uygulama localStorage tabanlı prototip fallback’iyle çalışır; değişkenler tanımlandığında onboarding, dashboard ve settlement akışları Supabase Auth/RLS üzerinden gerçek veriye geçer.

```bash
npm run test
npm run lint
npm run build
```
