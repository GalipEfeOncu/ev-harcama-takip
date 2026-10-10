# Mobil oturum kaybı incelemesi

Tarih: 2 Ekim 2026. İncelenen sürüm: `011ba0bdd8d3f1a08d018b9b6bd47b3e77c5666e`.

## Sonuç ve kanıt sınırı

İlk incelemeden sonra canlı OAuth dönüşünde somut bir adres hatası doğrulandı: `evhesap.vercel.app/auth/callback` kabul edilmiyor ve akış eski `ev-harcama-takip.vercel.app` ana sayfasına dönüyor. Eski adresin callback'i doğru korunuyor. Bu, kısa adresi kullanan tarayıcı/PWA ile Google sonrası açılan adres arasında oturum depolamasını ayırabilecek canlı bir yapılandırma kusurudur. Telefonlarda kullanılan tam adres henüz kullanıcı tarafından doğrulanmadığından bütün bildirilen vakaların tek nedeninin bu olduğu iddia edilmemeli.

Kullanıcı Samsung A16, A35, S25 FE ve Xiaomi cihazlarda, Chrome/Brave ile tarayıcı ve PWA'da aynı sonucu bildirdi. Paylaşılan ekran görüntüsü yeniden açılışta tanıtım sayfasını gösteriyor; adres çubuğu görünmüyor. Bulgular tek cihaz/tarayıcı davranışından çok ortak uygulama/konfigürasyon akışına öncelik verilmesini gerektiriyor.

İki somut kod kusuru belirlendi. İlki sentetik depolama ve gerçek kurulu Supabase SDK'sı ile yeniden üretildi: eksik/bozuk çerez parçaları sağlam localStorage yedeğini bozabiliyor. İkincisi statik kod incelemesiyle doğrulandı: ana sayfanın oturum geri yüklemesi bir doğrulama hatasını sessizce yutuyor ve tekrar denemiyor. Bu kusurların telefondaki vakaya neden olduğu henüz kanıtlanmadı.

Bu incelemede uygulama kodu, üretim ayarları veya dağıtım değiştirilmedi. Çerez bütünlüğü deneyleri gerçek kullanıcı tokenları kullanmadan, auth ağ yanıtları taklit edilerek yapıldı. Aşağıdaki OAuth dönüş testi ise canlı public authorize/callback uç noktalarında kontrollü giriş iptaliyle yapıldı; Google'a giriş yapılmadı ve gerçek kullanıcı oturumu oluşturulmadı. Bu işlem geçici OAuth flow state oluşturur; mevcut kullanıcı hesaplarını/oturumlarını değiştirmez.

## Öncelikli canlı bulgu — Kısa adres OAuth dönüşünde korunmuyor

Yöntem: public publishable key ile Google authorize akışı başlatıldı. Dönen Google adresinden yalnız testin kendi `state` değeri bellekte alındı. Google'a gitmeden Supabase callback'ine bu state ve `error=access_denied` gönderilerek kontrollü iptal yapıldı. HTTP 302 Location başlığının yalnız hedef origin/path kısmı kaydedildi; state, token veya anahtar rapora yazılmadı.

Canlı sonuçlar:

- İstenen dönüş `https://evhesap.vercel.app/auth/callback`; gerçekleşen dönüş `https://ev-harcama-takip.vercel.app`.
- İstenen dönüş `https://ev-harcama-takip.vercel.app/auth/callback`; gerçekleşen dönüş aynı eski adresin `/auth/callback` yolu.
- Uygulamanın oluşturduğu `?next=%2Fstart%3Fmode%3Dcreate` parametreli callback'lerde de aynı adres farkı gözlendi. Kısa adresin yolu ve next parametresi korunmadı; eski adresinki korundu.

Supabase'in resmi kaynak kodunda authorize aşamasında `GetReferrer` dönüş hedefini seçip OAuth flow state'e kaydediyor. Kabul edilmeyen `redirect_to` ve referrer için Site URL'e düşüyor. Başarılı OAuth ve hata/iptal dönüşleri aynı `getExternalRedirectURL` mekanizmasını kullanıyor. Bu nedenle iptal testi, canlı dönüş hedefi seçimindeki hatayı gerçek kullanıcı girişine ihtiyaç duymadan gösteriyor. Başarılı Google girişinin telefonda tamamlanması ayrıca gözlenmedi.

Repo README'si de Site URL ve Redirect URLs için yalnız eski production adresini tarif ediyor (`README.md:23–25`). Kısa adresin Vercel'de yayında olması Supabase'in bu adresi OAuth dönüşü için kabul ettiğini göstermiyordu.

Kısa origin'de açılan PWA, giriş akışı eski origin'e giderse sonraki açılışta eski origin'in çerez/localStorage verisine erişemez. Mevcut yedekleme düzeltmesi de yalnız bulunduğu origin'e yazar; bu adres ayrılığını çözmez. PKCE doğrulayıcısının farklı origin'de kalması ilk girişin kod değişimini de bozabilir. Bunlar mekanizmanın sonuçlarıdır; kullanıcının başarılı girişteki tam adres zinciri yakalanmadı.

Önerilen düzeltme sınırı: Supabase URL Configuration'ın kısa resmi adresle uyumlu hale getirilmesi; Site URL'in `https://evhesap.vercel.app` olması ve gerekli callback adreslerinin (uygulamanın next query'si dahil) kabul edilmesi; uygulamanın production giriş/PWA açılışının tek origin kullanması. Yeni ayar sonrası aynı canlı dönüş testi hedefin değişmediğini doğrulamalı. Panel/yönetim erişimi bu oturumda mevcut değil; ayar değiştirilmedi.

## Canlı ortamda doğrulananlar

- Commit için Vercel durumu `success`. GitHub Quality işinin application ve database adımları da başarılı.
- `https://evhesap.vercel.app/` ve `https://ev-harcama-takip.vercel.app/` HTTP 200 döndürüyor. İki adresin sunduğu JavaScript içinde `ev-hesap-auth-v1:` yedekleme kodu mevcut.
- İki adres de `ovszyjdpmxkmgujrayvl.supabase.co` projesini kullanıyor. Bu iki bilinen adres arasında farklı Supabase projesine bağlanma saptanmadı.
- Oturumsuz ana sayfa yanıtları `private, no-cache, no-store` içeriyor; `Clear-Site-Data` başlığı yok. Bu, tarayıcı verisini bu yanıtlarla temizleyen bir başlık olmadığını doğrular; diğer bütün auth yanıtlarını kapsamaz.
- Supabase'in public auth settings uç noktası HTTP 200 döndürüyor ve Google sağlayıcısı açık. Bu uç nokta inactivity timeout, timebox veya single-session ayarlarını göstermiyor.
- Bağlı masaüstü uygulama tarayıcısındaki oturumsuz ana sayfanın yakalanan hata/uyarı kaydı boş. Bu tarayıcı telefonun tarayıcısı değildir ve burada kullanıcı oturumu bulunmuyor.

## Mevcut oturum akışı

1. Google girişi başlatılırken callback adresi `window.location.origin` üzerinden oluşturuluyor (`src/lib/auth.ts:35`).
2. `/auth/callback` sunucuda kodu `exchangeCodeForSession` ile değiştiriyor; sunucu istemcisi çerezleri yazıyor ve callback yönlendiriyor (`src/app/auth/callback/route.ts:13`).
3. Tarayıcı istemcisi çerezleri okuduğunda aynı oturum çerezlerinin localStorage yedeğini oluşturuyor (`src/lib/supabase/browser-cookies.ts:25`). Callback'in kendisi localStorage yazamaz; bu aşama tarayıcı JavaScript'inin çalışmasına bağlı.
4. Uygulama yeniden açılınca proxy çerezden oturumu doğrulamaya/yenilemeye çalışıyor (`src/proxy.ts:27`). Ana sayfa da sunucuda kullanıcıyı sorguluyor; kullanıcı varsa aktif evine yönlendiriyor (`src/app/page.tsx:41`).
5. Sunucu kullanıcı bulamazsa marketing ana sayfası render ediliyor. `RestoreAccount`, tarayıcıda mevcut çerezi veya yedeği okuyup hesabı doğrulayarak `/dashboard` adresine geçmeyi deniyor (`src/components/restore-account.tsx:11`).
6. Dashboard kullanıcı bulunamazsa ev seçimi önbelleğini temizleyip ana sayfaya dönüyor (`src/app/dashboard/page.tsx:117`). Ev önbelleği kimlik doğrulama kaydı değil.

Kodda `pagehide`, `beforeunload` veya sekme kapanışıyla `signOut` çağıran bir işlem bulunmadı. Uygulamadaki açık çıkış çağrısı dashboard düğmesinde (`src/app/dashboard/page.tsx:443`).

## Bulgu 1 — Bozuk çerez sağlam yedeği ezebiliyor

Konum: `src/lib/supabase/browser-cookies.ts:25–30`.

`getAll`, oturuma ait herhangi bir çerez adı varsa çerezlerin bütünlüğünü kontrol etmeden `saveBackup(cookies)` çağırıyor. Parçalı bir oturumun eksik olması veya yalnızca `.1` gibi artık bir parçanın kalması bu koşulu sağlıyor. Eksiksiz eski yedek eksik çerezlerle değiştiriliyor. Ardından SDK çerezleri birleştirip JSON çözümlerken oturumu yok sayıyor. Yedek geri yükleme dalına girilmiyor.

Yeniden üretim: gerçek `createBrowserClient`, uygulamanın değiştirilmemiş adapter'ı ve taklit `document.cookie`/localStorage ile üç parçalı sentetik oturum oluşturuldu. Auth ağ yanıtları taklit edildi.

- Bütün çerezler silinip sağlam yedek korununca `getSession` oturumu geri buldu.
- Yalnız orta çerez parçası silinince üç parçalı sağlam yedek iki parçaya düştü; `getSession` `session: null, error: null` döndürdü. Hiç auth ağ isteği oluşmadı. SDK bozuk JSON uyarısı verdi.
- Yalnız `.1` artık parçası kalınca yedek tek parçaya düştü ve oturum bulunamadı.

Bu deney uygulamanın veri bütünlüğü hatasını kanıtlar. Telefonda çerezlerin kısmen kaybolduğu, karıştığı veya yazılamadığı henüz gözlenmedi. Dolayısıyla bu bulgu kullanıcının vakasının kesin nedeni diye sunulamaz.

## Bulgu 2 — Geri yükleme hatası girişsiz ekran olarak görünebiliyor

Konum: `src/components/restore-account.tsx:14–18`, `src/app/page.tsx:44`.

Tarayıcıdaki `getAccountSnapshot()` reddedildiğinde catch bloğu hiçbir hata göstermiyor. Yeniden deneme, online olayını dinleme veya görünür bir doğrulama durumu yok. Sunucu ana sayfası da `getUser()` yanıtındaki hata alanını incelemiyor. Sonuç olarak açılışta başarısız doğrulama, kullanıcıya oturumu yokmuş gibi marketing sayfasını gösterebilir.

Bu kusur koddan doğrudan doğrulanıyor. Telefonda açılış sırasında ağ/auth hatası gerçekleştiği kanıtlanmadı. Tek başına bu ekran gerçek logout ile geçici doğrulama hatasını ayırt etmeye yeterli değil.

## Önceki testlerin neden yeterli olmadığı

`src/lib/supabase/browser-cookies.test.ts:14–20` çerezleri bir JavaScript Map içinde tutuyor. Bu model gerçek tarayıcının kalıcılık, gizlilik, origin, HttpOnly, boyut sınırı ve kapatılma davranışlarını uygulamıyor. Testler gerçek Google OAuth yönlendirmesini, production callback yanıtını, telefon tarayıcısının kapanışını veya ana ekran uygulaması depolamasını çalıştırmıyor.

27 testin geçmesi, kapsanan birim/SDK senaryolarının geçtiğini gösteriyordu. Telefon sorununun çözülmüş olduğunu göstermiyordu. Önceki değişiklik, telefondaki kök neden ölçülmeden çerez kaybı varsayımına karşı yapılmıştı.

## Süre ve depolama hakkında kontrol edilenler

Uygulama ayarı `persistSession: true`, `autoRefreshToken: true`, PKCE ve bir yıllık `maxAge` içeriyor (`src/lib/supabase/cookie-options.ts`). Kurulu `@supabase/ssr` yazma yolunda `maxAge` değerini kendi 400 günlük varsayılanıyla değiştiriyor. Gerçek SDK ile taklit sunucu OAuth exchange deneyi `Max-Age=34560000`, `Path=/`, `HttpOnly=false`, `SameSite=lax` üretti. Bu deney canlı telefon callback başlıklarının yakalanması değildir; ancak koddaki normal SDK yolunun kapanınca silinecek session-cookie üretmediğini doğrular. Süreyi tekrar büyütmek için kanıt yok.

localStorage hataları adapter'da sessizce yutuluyor. Depolama engellenirse yedeğin kaydedilemediğini kullanıcı veya geliştirici göremiyor. Taklit deneyde çerezler kaybolmuş ve localStorage erişimi engellenmişken oturum geri gelmedi. Telefonda bu engel olduğu bilinmiyor.

İki Vercel adresi ayrı origin'lerdir. Çerezlerde ortak Domain ayarı yok; tarayıcı yedeği de origin'e bağlı. Bir adreste giriş yapmak diğer adreste otomatik giriş sağlamaz. Kullanıcının kapanış öncesi ve sonrası kullandığı adres henüz doğrulanmadı.

Service worker navigasyonlarda ağı kullanıyor, yalnız ağ hatasında offline sayfasına dönüyor. Auth çerezini veya localStorage'ı temizleyen kod yok (`public/sw.js:18`).

Dashboard'un çıkış çağrısında scope belirtilmiyor. Supabase varsayılanı global logout olduğundan başka cihazdan açıkça çıkış yapmak mobil oturumu da etkileyebilir. Bu, sekme kapatma olayında çalışmaz; kullanıcıda böyle bir çapraz cihaz çıkışı olduğunu gösteren kayıt yok.

## Kesin teşhis için eksik olan kanıt

Telefon modelleri ve tarayıcılar kullanıcı tarafından paylaşıldı. Normal/gizli mod ve özellikle kapanış öncesi/sonrası tam origin henüz doğrulanmadı. Ayrıca aynı oturum için kapatmadan önce ve ilk yeniden açılışta şu güvenli tanı bilgileri gerekir:

- Oturum çerezlerinin yalnız adları, parça sayısı ve birleştirilmiş JSON'un geçerliliği.
- Yedeğin varlığı, parça sayısı ve bütünlüğü; yazma/okuma başarısı.
- Açılış auth sonucunun HTTP durumu ve hata kodu; token veya çerez değerleri kaydedilmeden.
- Olay sırası: callback tamamlandı mı, ilk browser doğrulaması ve yedekleme oldu mu, sonraki açılışta doğrulama mı yokluk mu oluştu?
- Supabase proje yönetiminden oturum sınırlarının okunması. Bu oturumda yönetim erişimi yok; yerel `.env.local` yalnız public URL ve publishable key içeriyor.

Ayırıcı sonuçlar:

- Çerez ve yedek ikisi de kaybolmuşsa uygulamanın içindeki yedek bu durumu kurtaramaz; origin/profil veya tarayıcı depolama davranışı incelenir.
- Yedek sağlam, çerezler eksik/bozuksa Bulgu 1'in bu vakada gerçekleştiği doğrulanır.
- Saklanan oturum sağlam ama doğrulama ağ hatası veriyorsa Bulgu 2'nin bu vakada gerçekleştiği doğrulanır.
- Yenileme isteği `refresh_token_not_found`, `refresh_token_already_used` veya oturum sınırı hatası veriyorsa token geçersizliği/yenileme akışı incelenir. Çerez süresini artırmak çözmez.
- Kapanış sonrası origin farklıysa farklı adreslerin ayrı depolaması sorunu açıklayabilir.

Canlı OAuth adres uyumsuzluğu artık tahmin değildir. Bunun kullanıcının vakasını açıkladığını tam doğrulamak için kullanılan başlangıç ve giriş sonrası adresler eşleştirilmeli. Aynı origin'de de sorun sürüyorsa yukarıdaki çerez/auth kayıtlarıyla ikinci neden araştırılmalı.

## Kaynaklar

- [Üretim dağıtımı](https://vercel.com/galipefeoncu-8204/ev-harcama-takip/7GDPRccDq7ujF4W1wG6hoLs5rTNT)
- [Quality CI](https://github.com/GalipEfeOncu/ev-harcama-takip/actions/runs/36899550855)
- [Supabase oturum ömrü ve refresh token kuralları](https://supabase.com/docs/guides/auth/sessions)
- [Supabase SSR, stale refresh token ve logout kapsamı](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [MDN localStorage: origin, kalıcılık, gizli mod ve engellenme](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Supabase redirect URL kuralları](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Auth GetReferrer ve allowlist kontrolü](https://github.com/supabase/auth/blob/master/internal/utilities/request.go)
- [Supabase Auth ortak OAuth dönüş hedefi ve flow state](https://github.com/supabase/auth/blob/master/internal/api/external.go)
