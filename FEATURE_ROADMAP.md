# PWA, Google hesabı ve doğrudan borç ödemeleri

Bu çalışma mevcut ev/davet kodu akışını ve ev başına veri erişimi kurallarını koruyarak üç özelliği sırayla tamamlar.

## Kararlar

- Uygulamada manifest, ikon ve service worker zaten var. İlk aşama kurulabilirlik ayrıntılarını tamamlar; ortak ev verisinin çevrimdışı yazılabildiği izlenimi vermez.
- Yeni hesap ve ev oluşturma/katılma işlemleri yalnızca Google hesabıyla açılan Supabase oturumunda yapılır. Mevcut anonim oturumu olan kullanıcıya aynı Supabase kullanıcı kimliğini koruyarak Google kimliği bağlama yolu sunulur.
- Giriş yapmış kullanıcının aktif bir evi varsa ana sayfaya uğratmadan son katıldığı eve yönlendirilir. Ev kodu hash olarak kalır; başka cihazda kod yoksa ev sahibi yeni kod üretebilir.
- Doğrudan borç ödemesi, bir hesap kapatma işlemi değildir. Ödeyen, alıcı, tutar, tarih ve not ayrı kaydedilir; açık dönem bakiyesini azaltır. Tutar, ödeyenin borcu ve alıcının alacağı sınırını aşamaz.
- Dönem kapatılırken açık harcamalar ile doğrudan ödemeler birlikte arşivlenir. Böylece eski ödemeler yeni dönemin bakiyesini değiştirmez.

## Aşamalar

### 1. Kurulabilir PWA — tamamlandı

- Manifest için 192/512 piksel ve maskable ikonlar; iOS ana ekran ikonu ve uygulama metadata'sı.
- Çevrimdışı durumda veri yazılabildiğini iddia etmeyen açık bir uygulama kabuğu/fallback.
- Kabul ölçütü: ikonlar ve manifest üretim derlemesinde bulunur; service worker kurulumda eksik asset nedeniyle hata vermez.

Uygulandı: 192/512 ikonlar, maskable ikon, iOS ikonu, `offline.html` fallback'i ve v2 service worker. Lint/build ve masaüstü/390 px ekran kontrolü geçti.

### 2. Google hesabı ve eve doğrudan dönüş

- Google OAuth başlatma ve PKCE callback; Supabase oturumunun cookie ile yenilenmesi.
- Yeni ev oluşturma/katılma için Google hesabı zorunluluğu; anonim Supabase oturumlarının yeni üyelik açması engellenir.
- Mevcut anonim ev üyeleri için Google kimliğini aynı kullanıcıya bağlama akışı.
- Ev oluşturma veya katılma sonrası doğrudan pano; kök URL'de aktif ev varsa doğrudan panoya yönlendirme.
- Ev oturumu bu cihazda yoksa üyelikten yeniden kurulur; davet kodu hash'ten geri alınmaz, gerekirse ev sahibi yeniler.
- Kabul ölçütü: oturum yokken Google girişi istenir; üyeliği olan kullanıcı `/` üzerinden panoya, yeni kullanıcı ev kurulumuna gider; Supabase RLS üyelik sınırları korunur.

Kodlandı: Google OAuth/PKCE callback, Google kimliği kontrolü, eski oturum için identity-link akışı, ana sayfadan son aktif eve yönlendirme ve kayıp davet kodunu ev sahibi için yenileme RPC'si. Veritabanı tetikleyicileri anonim değişiklikleri engelleyecek migration'da hazır; migration henüz uygulanmadı. Lint/build geçti. Canlı OAuth ve veritabanı geçişi Google sağlayıcı kimlik bilgileri girilene kadar bekliyor.

### 3. Doğrudan borç ödemesi

- RLS korumalı ödeme tablosu ve tutarı açık net bakiyeye göre doğrulayan atomik kayıt RPC'si.
- Panoda ödeyen/alıcı/tutar/not/tarih formu ve ödeme geçmişi.
- Bakiyeler, sadeleştirilmiş ödeme önerileri ve dönem kapatma hesabı doğrudan ödemeleri hesaba katar.
- Kabul ölçütü: örneğin X'in B'ye yaptığı kısmi ödeme kayda geçer, açık bakiye düşer ve dönemi kapatmadan da görülebilir; yeni dönemde eski ödeme tekrar hesaba katılmaz.

Kodlandı: yerel ve Supabase veri akışında doğrudan ödeme modeli, bakiye hesabı, pano formu, ödeme listesi ve dönem arşivi eklendi. Atomik RPC ile RLS migration'ı hazır; Google Auth migration'ından sonra uygulanmalı. Lint/build geçti. Google sağlayıcısı kapalı olduğu için imzalı pano ve canlı RPC akışı henüz doğrulanamadı.

## Dış kurulum gereksinimi

Google OAuth'un canlı çalışması için Supabase Auth'ta Google sağlayıcısının etkinleştirilmesi, Google OAuth Client ID/Secret girilmesi ve uygulama callback adreslerinin redirect allow-list'e eklenmesi gerekir. Bu sırlar repoya veya sohbete yazılmaz. Sağlayıcı şu an kapalı olduğu için iki yeni auth/ödeme migration'ı canlı veritabanına uygulanmadı ve auth değişiklikleri henüz push edilmedi.
