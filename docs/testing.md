# Testler

`npm test`, `npm run lint` ve `npm run build` uygulama kapılarıdır. GitHub Actions
ayrıca **ayrı, geçici yerel Supabase** örneğine tüm migration dosyalarını uygular ve
`supabase/tests/settlement_history.sql` testini çalıştırır.

Veritabanı testini kendi bilgisayarınızda çalıştırmak için Docker, Supabase CLI
ve PostgreSQL `psql` istemcisi gerekir:

```bash
supabase start
supabase db reset --local
PGPASSWORD=postgres psql -X -v ON_ERROR_STOP=1 \
  -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -f supabase/tests/settlement_history.sql
```

`supabase db reset --local` yerel Supabase veritabanını sıfırlar. Bu komutları
yalnızca atılabilir bir yerel örnekte çalıştırın; uzaktaki projeye bağlamayın.
SQL testi bir transaction sonunda `ROLLBACK` yapar. Test iki Google kimliği
fikstürüyle ev oluşturma ve katılma, harcama, dönem kapatma, üye yazma sınırları,
açık harcama değişiklikleri ve admin ev silmeyi doğrular.

Kimlikler SQL testinde JWT claim'leriyle temsil edilir. Google OAuth tarayıcı
yönlendirmesi, gerçek kullanıcı arayüzü, canlı migration durumu ve üretim
ortamı bu CI kapısıyla doğrulanmaz; bunlar için ayrı test ortamında kullanıcı
yolculuğu gerekir.
