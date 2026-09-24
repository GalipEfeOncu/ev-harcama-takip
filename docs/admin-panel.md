# Admin paneli

Panel `/admin` adresinde bulunur. Supabase Auth kullanıcılarını, ev üyeliklerini ve ev sahiplerini listeler; toplam kullanıcı, ev, aktif üyelik ve harcama sayılarını gösterir. Ev satırındaki **Önizle** düğmesi aktif ve pasif üyeleri, rollerini ve varsa hesap e-postalarını gösterir. Admin ev adını değiştirebilir, evi silebilir veya hiçbir eve bağlı olmayan kullanıcı hesabını silebilir. Üyelik düzenleme işlemi yoktur.

## Sunucu ayarları

Uygulamanın mevcut Supabase oturum doğrulaması için `.env.example` içindeki `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ayarları da gereklidir. Bunlara ek olarak, admin paneli için uygulama sunucusunda şu iki değişkeni ayarlayın:

```env
ADMIN_EMAILS=admin-google-hesabi@example.com
SUPABASE_SECRET_KEY=<Supabase Dashboard > Project Settings > API Keys içindeki secret key>
```

Birden fazla yönetici e-postası `ADMIN_EMAILS` içinde virgülle ayrılır. E-postalar, Google kimliği bağlı Supabase hesabının e-postasıyla eşleşmelidir. Supabase'in önerdiği yeni `secret` anahtarı `SUPABASE_SECRET_KEY` değişkenine verilir. Eski anahtar kullanan projelerde `SUPABASE_SERVICE_ROLE_KEY` de desteklenir. Bu ayrıcalıklı anahtar yalnızca sunucu ortamında tutulmalı; `NEXT_PUBLIC_` ile başlayan bir değişken adı kullanılmamalı ve tarayıcıya aktarılmamalıdır. Değerleri yerel geliştirme ortamında `.env.local`'a, dağıtılmış uygulamada ise ilgili sunucu ortamının değişkenlerine girin.

`20260920213000_admin_household_management.sql`, ev adı düzenleme ve ev silme için yalnızca `service_role` rolünün çalıştırabildiği iki RPC ekler. Normal kullanıcı rolleri bu RPC'leri çağıramaz. Migration dosyasının repoda bulunması, Supabase veritabanına uygulanmış olduğu anlamına gelmez: panelin bağlandığı her Supabase projesinde migration'ları dağıtımdan önce uygulayın. Yerel uygulama, `.env.local` içindeki URL'nin gösterdiği projeyi; dağıtılmış uygulama da kendi sunucu ortamındaki URL'nin gösterdiği projeyi kullanır.

`20260924223000_protect_household_members_from_user_deletion.sql`, Auth hesabı silinirken üyeliklerin otomatik silinmesini engeller. Kullanıcı silme özelliğini kullanmadan önce bu migration'ı da uygulayın.

## Erişim modeli

- `/admin` sayfası ve her Server Action, Supabase oturumunu sunucuda doğrular. Google kimliği olmayan veya e-postası `ADMIN_EMAILS` içinde olmayan kullanıcılar paneli açamaz.
- Kullanıcı hesapları (Supabase Auth) ve uygulama tabloları, yalnızca sunucudaki secret/service-role istemcisiyle okunur. Görüntülenen kullanıcı/ev sayıları bağlı Supabase projesine aittir; tarayıcıdaki yerel prototip verileri panele dahil değildir.
- Ev adı değiştirme ve silme Server Action'ları oturumdaki yöneticiyi yeniden doğrular, ardından kimliğini RPC'ye iletir. RPC de bu kimliğin Google sağlayıcısına bağlı olduğunu doğrular; çalıştırma izni `service_role` ile sınırlıdır.
- Ev silme kalıcıdır; önce ev adı tekrar yazılarak onaylanır. İşlem evin `members`, `expenses`, `debt_payments`, `settlements` ve `settlement_runs` kayıtlarını, ardından evi siler. Harcama payları (`expense_participants`) silinen harcamalarla birlikte veritabanı cascade kuralıyla silinir. Auth kullanıcı hesapları silinmez.
- Kullanıcı silme kalıcıdır; önce hesabın e-posta adresi, e-postası yoksa tam hesap kimliği tekrar yazılır. Geçerli admin veya izin listesindeki başka bir admin, bir evin sahibi ya da aktif/pasif üyesi olan hesap silinemez. Server Action bağlantıları yeniden kontrol eder; veritabanı kısıtları eşzamanlı değişikliklerde üyelikleri ve finansal geçmişi korur. Bu nedenle görünürde eve bağlı olmayan bazı eski hesaplar da geçmiş kaydı varsa silinemeyebilir.

`ADMIN_EMAILS` ayarlanmamışsa hiçbir hesap admin olarak yetkilendirilmez. Secret/service-role anahtarı eksikse yönetim verisi yüklenemez. Gerekli migration uygulanmamışsa okuma ya da yazma işlemleri hata verir; hosted Supabase veritabanı bu dosyalarla kendiliğinden güncellenmez.
