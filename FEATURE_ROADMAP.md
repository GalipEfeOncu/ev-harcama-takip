# PWA, Google hesabı ve doğrudan borç ödemeleri

Bu çalışma mevcut ev/davet kodu akışını ve ev başına veri erişimi kurallarını koruyarak üç özelliği sırayla tamamlar.

## Kararlar

- Uygulamada manifest, ikon ve service worker zaten var. İlk aşama kurulabilirlik ayrıntılarını tamamlar; ortak ev verisinin çevrimdışı yazılabildiği izlenimi vermez.
- Yeni hesap ve ev oluşturma/katılma işlemleri yalnızca Google hesabıyla açılan Supabase oturumunda yapılır. Mevcut anonim oturumu olan kullanıcıya aynı Supabase kullanıcı kimliğini koruyarak Google kimliği bağlama yolu sunulur.
- Giriş yapmış kullanıcının aktif bir evi varsa ana sayfaya uğratmadan son katıldığı eve yönlendirilir. Ev kodu hash olarak kalır; başka cihazda kod yoksa ev sahibi yeni kod üretebilir.
- Doğrudan borç ödemesi, bir hesap kapatma işlemi değildir. Ödeyen, alıcı, tutar, tarih ve not ayrı kaydedilir; açık dönem bakiyesini azaltır. Tutar, ödeyenin borcu ve alıcının alacağı sınırını aşamaz.
- Dönem kapatılırken açık harcamalar ile doğrudan ödemeler birlikte arşivlenir. Böylece eski ödemeler yeni dönemin bakiyesini değiştirmez.

## Aşamalar

### 1. Kurulabilir PWA

- Manifest için 192/512 piksel ve maskable ikonlar; iOS ana ekran ikonu ve uygulama metadata'sı.
- Çevrimdışı durumda veri yazılabildiğini iddia etmeyen açık bir uygulama kabuğu/fallback.
- Kabul ölçütü: ikonlar ve manifest üretim derlemesinde bulunur; service worker kurulumda eksik asset nedeniyle hata vermez.

### 2. Google hesabı ve eve doğrudan dönüş

- Google OAuth başlatma ve PKCE callback; Supabase oturumunun cookie ile yenilenmesi.
- Yeni ev oluşturma/katılma için Google hesabı zorunluluğu; anonim Supabase oturumlarının yeni üyelik açması engellenir.
- Mevcut anonim ev üyeleri için Google kimliğini aynı kullanıcıya bağlama akışı.
- Ev oluşturma veya katılma sonrası doğrudan pano; kök URL'de aktif ev varsa doğrudan panoya yönlendirme.
- Ev oturumu bu cihazda yoksa üyelikten yeniden kurulur; davet kodu hash'ten geri alınmaz, gerekirse ev sahibi yeniler.
- Kabul ölçütü: oturum yokken Google girişi istenir; üyeliği olan kullanıcı `/` üzerinden panoya, yeni kullanıcı ev kurulumuna gider; Supabase RLS üyelik sınırları korunur.

### 3. Doğrudan borç ödemesi

- RLS korumalı ödeme tablosu ve tutarı açık net bakiyeye göre doğrulayan atomik kayıt RPC'si.
- Panoda ödeyen/alıcı/tutar/not/tarih formu ve ödeme geçmişi.
- Bakiyeler, sadeleştirilmiş ödeme önerileri ve dönem kapatma hesabı doğrudan ödemeleri hesaba katar.
- Kabul ölçütü: örneğin X'in B'ye yaptığı kısmi ödeme kayda geçer, açık bakiye düşer ve dönemi kapatmadan da görülebilir; yeni dönemde eski ödeme tekrar hesaba katılmaz.

## Dış kurulum gereksinimi

Google OAuth'un canlı çalışması için Supabase Auth'ta Google sağlayıcısının etkinleştirilmesi, Google OAuth Client ID/Secret girilmesi ve uygulama callback adreslerinin redirect allow-list'e eklenmesi gerekir. Bu sırlar repoya veya sohbete yazılmaz. Kod tarafı tamamlanınca gereken adresleri ayrıca belirt.
