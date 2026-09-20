# Admin paneli

Panel `/admin` adresinde bulunur. Kullanıcı hesaplarını, ev üyeliklerini ve ev sahiplerini listeler; toplam kullanıcı, ev, aktif üyelik ve harcama sayılarını gösterir. Admin, ev adını değiştirebilir veya evi bağlı tüm üyelik, harcama ve ödeme kayıtlarıyla silebilir.

## Sunucu ayarları

Panelin çalışması için uygulama sunucusunda şu iki değişken gerekir:

```env
ADMIN_EMAILS=admin-google-hesabi@example.com
SUPABASE_SECRET_KEY=<Supabase Dashboard > Project Settings > API Keys içindeki secret key>
```

Birden fazla yönetici e-postası `ADMIN_EMAILS` içinde virgülle ayrılır. E-postalar, Google ile giriş yapan hesabın e-postasıyla eşleşmelidir. Supabase'in önerdiği yeni `secret` anahtarı `SUPABASE_SECRET_KEY` değişkenine verilir. Eski anahtar kullanan projelerde `SUPABASE_SERVICE_ROLE_KEY` de desteklenir. Her iki anahtar da yalnızca sunucu ortamında tutulmalı; `NEXT_PUBLIC_` ile başlayan bir değişken adı kullanılmamalı ve tarayıcı koduna aktarılmamalıdır.

Migration'ları dağıtımdan önce Supabase projesine uygulayın. `20260920213000_admin_household_management.sql`, ev adı düzenleme ve evin ilişkili mali kayıtlarla silinmesi için `service_role` ile sınırlı iki RPC ekler. Normal kullanıcı rolleri bu RPC'leri çağıramaz.

## Erişim modeli

- `/admin` sayfası ve her Server Action, Supabase oturumunu sunucuda doğrular.
- Google kimliği olmayan veya `ADMIN_EMAILS` içinde olmayan kullanıcılar paneli açamaz.
- Tüm hesap ve ev listeleri yalnızca sunucudaki secret/service-role istemcisiyle okunur.
- Yazma işlemleri, doğrulanmış admin hesabının kimliğini taşıyan ve `service_role` dışında hiçbir role çalıştırma izni verilmeyen RPC'lerden geçer.
- Ev silme kalıcıdır; önce ev adı tekrar yazılarak onaylanır.

`ADMIN_EMAILS` veya service-role anahtarı ayarlanmamışsa admin hesabı yetkilendirilemez ya da yönetim verisi yüklenemez.
