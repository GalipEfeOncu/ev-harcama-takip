# Testler

`npm test`, `npm run lint` ve `npm run build` uygulama kapılarıdır. GitHub Actions
ayrıca **ayrı, geçici yerel Supabase** örneğine tüm migration dosyalarını uygular ve
`supabase/tests/settlement_history.sql` testini çalıştırır.

Görünüm tercihleri için JavaScript testleri 24 paletin metin, vurgu ve durum
renklerinin kontrastını; eski tema seçiminin taşınmasını; ilk boyama betiğini;
hesap/cihaz kapsamını; geç dönen yanıtları; sıraya alınmış kayıtları; hesap
değişimini ve eşitleme hatası sonrası tekrar denemeyi kapsar.

CI ayrıca `supabase/tests/user_preferences.sql` dosyasını aynı atılabilir
veritabanında çalıştırır. Test kendi tercihlerini okuma/yazma/silme ve diğer
hesaplardan erişimi engelleme kurallarını doğrular. Yerelde migration'lardan
sonra aynı `psql` komutunu bu dosya yolu ile çalıştırabilirsiniz. Bu SQL testi
de bir transaction sonunda geri alınır; canlı veritabanı testi değildir.

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
