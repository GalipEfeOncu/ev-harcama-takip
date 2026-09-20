# Ev Hesap UI/UX Denetimi ve Yeniden Yapım Şartnamesi

**Tarih:** 20 Eylül 2026
**İncelenen temel sürüm:** `3c24684` — `feat: support custom expense shares and delete dialog`
**Önceki karşılaştırma noktası:** `c8642ac`
**Öncelik:** Mobil kullanılabilirlik ve görsel kalite
**Durum:** Uygulama için onaylı çalışma şartnamesi

## 1. Yönetici özeti

Mevcut arayüzün temel problemi tek tek kötü bileşenler değil, bütün ekranlara yayılan görsel dil ve bilgi mimarisidir. Çok sayıdaki ayırıcı çizgi, küçük yazılar, dar aralıklar ve masaüstü düzeninin mobilde sıkıştırılması arayüzü “hafif” değil, bitmemiş ve yorucu gösteriyor. Koyu tema hiç bulunmuyor. Masaüstünde ise kullanılabilir genişlik etkin değerlendirilmediği için içerik hem seyrek hem de gereksiz yatay çizgilerle parçalı hissediliyor.

Son sürüm işlevsel açıdan iki değerli geliştirme getirdi:

- Harcamalarda eşit veya kişiye özel pay dağılımı yapılabiliyor.
- `window.confirm` yerine odak yönetimi ve klavye davranışı olan gerçek bir silme diyaloğu kullanılıyor.

Ancak özel pay alanları, zaten yoğun olan harcama formunun mobilde daha da uzun ve bilişsel olarak ağır hale gelmesine neden oldu. Bu nedenle çözüm mevcut CSS'e birkaç rötuş yapmak değil; davranışı koruyarak mobil öncelikli yerleşim, yüzey, tipografi, tema ve işlem akışını birlikte yeniden kurmaktır.

Onaylı görsel yön **“Sıcak Ortak Ev Defteri”**dir: gündelik ortak giderleri güvenle takip ettiren, açık ve sıcak bir ev hesabı. Açık tema mevcut fildişi/kırık beyaz/evergreen/coral ailesini korur; koyu tema espresso ve karartılmış zeytin tabanına geçer.

## 2. İnceleme kapsamı ve yöntem

İnceleme aşağıdaki kanıtlara dayanır:

- `3c24684` ile gelen kaynak kod farkları ve mevcut çalışma ağacı
- Ana kullanıcı yüzeyleri: açılış, giriş/kayıt, ev oluşturma/katılma, dashboard, harcama ekleme/düzenleme, ödeme, hesaplaşma ve silme diyaloğu
- `src/app/globals.css`, `src/app/page.tsx`, `src/app/start/page.tsx`, `src/app/dashboard/page.tsx`, bileşenler ve veri tipleri
- Mevcut tasarım notları ve ekran görüntüleri
- `npm test`, `npm run lint`, `npm run build` çıktıları
- Impeccable ve UI/UX Pro Max kural kümeleriyle statik tasarım denetimi
- Next.js 16.3.5'in projedeki yerel dokümantasyonu: CSS, fontlar, metadata ve hydration öncesi tema uygulama yaklaşımı

### 2.1 Doğrulanmış teknik taban

- Test: **1 dosya / 5 test geçti**.
- Lint: **başarılı**.
- Üretim derlemesi: **başarılı**.
- Tasarım sistemi taraması: `globals.css` içinde **121 uyarı**; 115'i dağınık font boyutu, 6'sı doğrudan renk kullanımıyla ilgili.
- CSS içinde `border` kullanan **102 bildirim** bulunuyor. Her kullanım hatalı değildir; sayı, çizgiye dayalı dilin sistemik olduğunu gösteren nicel bir işarettir.
- Mevcut tema bildirimi açık temayla sınırlı; çalışan bir koyu tema seçeneği yoktur.

### 2.2 İncelemenin sınırı

Üretim Supabase hesabıyla gerçek kullanıcı verisi üzerinde işlem yapılmadı. Bu belge kaynak kod, yerel derleme, mevcut görsel kanıt ve güvenli yerel kontroller üzerine kuruludur. Uygulama tamamlandıktan sonra hem anonim ekranlar hem de kontrollü dashboard durumu gerçek tarayıcı boyutlarında yeniden görüntülenecektir.

## 3. Son değişikliklerin değerlendirmesi

### 3.1 İyi yöndeki değişiklikler

#### Kişiye özel pay dağılımı

- `splitMode`, `shareAmounts`, `participantShares` ve `splitAmount` alanları davranışı açık biçimde modelliyor.
- Eşit paylaşım varsayılan olarak korunuyor.
- Toplam pay kontrolü veri doğruluğu açısından gerekli.
- Hesaplama testlerinin güncellenmesi regresyon riskini azaltıyor.

#### Silme diyaloğu

- Tarayıcıya ait `window.confirm` kaldırılmış.
- `role="alertdialog"`, başlık/açıklama ilişkisi, Escape desteği, ilk odak ve odak tuzağı eklenmiş.
- Bu davranış yeniden tasarım sırasında korunmalı; yalnızca görsel sunumu tasarım sistemine uyarlanmalıdır.

### 3.2 Oluşan yeni UX riski

Tek bir mobil diyaloğun içine şu kararların tümü art arda yığılmış durumda:

1. Paylaşım modu
2. Tutar
3. Açıklama
4. Kategori
5. Tarih
6. Ödeyen kişi
7. Katılımcılar
8. Kişiye özel tutarlar
9. Dağıtılan toplam ve yardım metni
10. Kaydetme eylemi

Bu yapı işlevsel olsa da küçük ekranda uzun kaydırma, bağlam kaybı ve doğrulama hatasını geç fark etme riski yaratıyor. Çözüm özelliği kaldırmak değil; alanları anlamlı gruplara ayırmak, özel modu yalnızca seçildiğinde açmak ve üst/alt eylemleri görünür tutmaktır.

## 4. Önceliklendirilmiş bulgular

### P1 — Yeniden yapımın zorunlu sorunları

#### P1.1 Çizgiye dayalı görsel dil

Kartlar, satırlar, sekmeler, paneller ve özet alanları çoğunlukla kenarlıklarla birbirinden ayrılıyor. Aynı ağırlıktaki çok sayıda çizgi görsel hiyerarşiyi güçlendirmiyor; tersine her şeyi eşit derecede önemli gösteriyor.

**Etkisi:** Arayüz kalabalık, teknik bir wireframe veya tablo gibi görünüyor. Kullanıcının bakışı “önce bakiye, sonra açık işlem, sonra eylem” sırasını doğal olarak takip edemiyor.

**Karar:** Ayırımı öncelikle boşluk, yüzey tonu, tipografi ve gruplayarak kur. Kenarlığı yalnızca gerçekten sınır gerektiren form kontrolü, odak durumu, tablo benzeri veri veya kritik durumlarda kullan.

#### P1.2 Mobil, masaüstünün küçültülmüş hali

Mevcut mobil düzen; büyük başlıkları, küçük yardımcı metinleri, yatay ilişkileri ve negatif marjlı bakiye rayını dar alana taşımaya çalışıyor. Bazı metin ve kontroller 10–14 px bandına düşüyor; dokunma hedefleri de yer yer güvenli sınırın altında kalıyor.

**Etkisi:** Okunabilirlik, parmakla kullanım, taranabilirlik ve kullanıcı güveni azalıyor.

**Karar:** Mobil için ayrı bilgi sırası tanımlanacak. Temel kontroller en az 44 px, tercihen 48 px olacak. Ana metin 16 px tabanın altına düşmeyecek; küçük yardımcı metin istisnai ve yüksek kontrastlı olacak.

#### P1.3 Harcama formunda bilişsel yük

Özel paylaşım özelliği, formu bir iş akışından çok uzun bir ayar sayfasına dönüştürüyor.

**Karar:**

- Eşit paylaşım ilk ve varsayılan seçenek olarak kalacak.
- Özel tutar alanları yalnızca özel mod etkin olduğunda gösterilecek.
- Form üç görsel gruba ayrılacak: **Harcama**, **Kimler**, **Paylaşım**.
- Mobilde tam yükseklikte sheet/route hissi veren diyalog kullanılacak.
- Başlık/kapatma üstte, ana eylem altta sabit kalacak; içerik ikisinin arasında kayacak.
- Yalnızca seçili katılımcılar için tutar alanı üretilecek.
- Girilen toplam ve kalan/fazla tutar anlık, açık ve erişilebilir biçimde gösterilecek.
- Hata mesajı ilgili alanın yanında gösterilecek; yalnızca toast'a bırakılmayacak.

#### P1.4 Koyu tema yok

Koyu tema yalnızca renkleri ters çevirmek değildir; yüzey katmanları, metin kontrastı, form durumu, odak halkası, gölge ve tarayıcı üst çubuğu birlikte ele alınmalıdır.

**Karar:** `system`, `light`, `dark` seçenekleri olan kalıcı tema sistemi kurulacak. İlk boya öncesinde tema uygulanarak parlama önlenecek.

### P2 — Kaliteyi belirgin biçimde düşüren sorunlar

#### P2.1 Masaüstü alanı verimsiz kullanılıyor

Geniş ekranda içerik ya fazla uzuyor ya da boşluk içinde tek kolon kalıyor. Uzun çizgiler içerikten daha baskın hale geliyor.

**Karar:** Dashboard 1180–1240 px civarında sınırlı, iki kolonlu bir çalışma alanına dönüşecek. Sol kolon 360–420 px; özet, kişi bakiyeleri ve ikincil eylemleri taşıyacak. Sağ kolon esnek olacak ve hareket akışını taşıyacak.

#### P2.2 Aynı verinin iki ayrı listede tekrarlanması

“Açık harcamalar” ve “Harcama geçmişi” benzer satırları tekrar ediyor. Kullanıcı hangi listenin esas olduğunu anlamak ve iki alanı taramak zorunda kalıyor.

**Karar:** Tek bir **Hareketler** akışı oluşturulacak. `Açık`, `Bu ay`, `Tümü` gibi filtreler kullanılacak. Düzenleme, silme ve durum bilgisi aynı öğe içinde korunacak. Doğrudan borç ödemeleri açıkça farklı bir hareket türü olarak gösterilecek veya ikincil, açılır bir bölümde tutulacak.

#### P2.3 Tipografi ve token dağınıklığı

115 font boyutu uyarısı, bileşenlerin ortak bir ölçek yerine yerel değerlerle şekillendiğini gösteriyor. Bu durum benzer içeriğin farklı önem düzeylerinde görünmesine neden oluyor.

**Karar:** Sınırlı tipografi ölçeği ve semantik tokenlar kullanılacak. Ürün arayüzünde tek bir okunaklı aile tercih edilecek; mevcut `Mada` uygun adaydır. `Barrio` gibi dekoratif font, uygulama içi işlemsel yüzeylerden çıkarılacak. Açılış sayfasında bile kullanımı ölçülü olmalıdır.

#### P2.4 Onboarding sırasında erken ve gereksiz karar

Kullanıcı giriş yapmadan önce oluştur/katıl seçimine zorlanırsa seçimin etkisini henüz göremez ve akış parçalanır.

**Karar:** Açılış CTA'sı niyeti taşıyabilir; ancak kimlik doğrulama ekranında gerçek tab davranışı taklit eden gereksiz seçimler kaldırılmalı. Hesap adımından sonra “Ev oluştur” ve “Eve katıl” açık seçenekler olarak sunulmalı.

#### P2.5 Eski tasarım yönergesi problemi yeniden üretiyor

Mevcut tasarım notlarında raylar, kesintisiz kurallar ve sert ayırıcılar yönlendirici motif olarak kullanılıyor. Kullanıcı geri bildirimi tam olarak bu dilin başarısız olduğunu gösterdi.

**Karar:** Eski motif bağlayıcı kabul edilmeyecek. Bu belge yeni kaynak olacaktır; uygulama bittiğinde eski `DESIGN.md` yeni sistemle uyumlu hale getirilmeli veya bu belgeye yönlendirilmelidir.

#### P2.6 Büyük, tek parça ekran ve CSS dosyaları

Dashboard sayfasının ve global CSS'in büyümesi görsel regresyonları ve tema bakımını zorlaştırıyor.

**Karar:** Davranışı değiştirmeden anlamlı UI parçaları çıkarılacak. Global CSS reset, token ve paylaşılan primitive'lerle sınırlanmalı; sayfa/bileşen stilleri uygun ölçüde ayrılmalıdır. Büyük bir framework veya yeni bağımlılık eklenmeyecek.

## 5. Erişilebilirlik değerlendirmesi

### Korunacak güçlü yönler

- Form alanlarının etiketlenmesi
- Silme diyaloğunun `alertdialog` semantiği
- Escape ve odak yönetimi
- Dinamik sonuçlar için `aria-live` yaklaşımı
- Yerel HTML kontrollerinden yararlanılması

### Düzeltilmesi gerekenler

- 44 px altındaki dokunma hedefleri büyütülmeli.
- 16 px altındaki ana form yazıları mobilde kullanılmamalı.
- `role="tablist"` kullanılacaksa ok tuşu klavye modeli tamamlanmalı; değilse semantik olarak normal segmented button grubu tercih edilmeli.
- Odak halkası hem açık hem koyu temada belirgin olmalı.
- Koyu temada normal metin için WCAG AA 4.5:1 hedefi sağlanmalı.
- Sabit alt eylem çubuğu içeriği örtmemeli; `env(safe-area-inset-bottom)` ve yeterli içerik dolgusu kullanılmalı.
- Hareket azaltma tercihi, bütün animasyonları yapay olarak `0.01ms` değerine zorlamak yerine gerçek hareketli bileşenlerde anlamlı biçimde uygulanmalı.
- İkon düğmelerinde görünür veya erişilebilir ad bulunmalı; emoji uygulama ikonu yerine mevcut SVG ikon seti kullanılmalı.

## 6. Onaylı tasarım yönü: Sıcak Ortak Ev Defteri

### 6.1 Ürün kişiliği

- Sıcak ama çocukça değil
- Güvenilir ama banka kadar soğuk değil
- Yoğun veri sunabilen ama dashboard klişesine düşmeyen
- Ev arkadaşları ve aile için gündelik dil kullanan
- Ana eylemi her ekranda açık olan

### 6.2 Kaçınılacak kalıplar

- Her içeriği kenarlıklı karta koymak
- Uzun yatay çizgilerle sayfayı dilimlemek
- Cam efekti, neon gradyan veya jenerik mor/mavi SaaS görünümü
- Pazarlama sayfasına sahte testimonial, logo duvarı veya kanıtsız metrik eklemek
- Kırmızı/yeşili tek anlam taşıyıcısı yapmak
- Dashboard'da dekoratif display font kullanmak
- Mobilde yatay kaydırılan temel işlem grupları oluşturmak
- İçeriği kapatan floating CTA

UI/UX Pro Max aramasının önerdiği pazarlama odaklı kırmızı/yeşil palet ve testimonial kalıbı bu ürün için uygun bulunmamıştır. Araçtan yalnızca mobil öncelik, form girdileri, hedef boyutu, odak görünürlüğü ve kontrast gibi genel UX doğrulamaları alınmıştır.

### 6.3 Renk sistemi

Yüzeyler üç sakin katmanda gruplanır: oda/sayfa, çalışma yüzeyi ve odak defteri. Açık tema fildişi-kırık beyaz/evergreen/coral ailesini korur. Koyu tema espresso ve karartılmış zeytin alt tonları kullanır; önemli toplamın sıcak kâğıt yüzeyi koyu temada da kalır. Coral birincil eylemi, berry tonu ise negatif bakiyeyi işaretler.

#### Açık tema

- `--bg`: `#EFE5D4`
- `--surface`: `#FFFCF5`
- `--surface-raised`: `#FFFFFF`
- `--surface-soft`: `#E9DFD0`
- `--text`: `#17211B`
- `--text-muted`: `#59635D`
- `--accent`: `#E66E45`
- `--accent-text`: `#A44729`
- `--on-accent`: `#17211B`
- `--negative`: `#78364E`
- `--ledger-surface`: `#E5D3B8`

Ölçülen kontrast örnekleri: ana metin/sayfa **13.25:1**, yardımcı metin/sayfa **5.00:1**, placeholder/yükseltilmiş alan **6.24:1**, küçük accent metni/sayfa **4.79:1**, aksiyon metni/accent **5.26:1** (hover **4.78:1**). Defter metni ve yardımcı metni sıcak kâğıt üzerinde **10.76:1 / 4.64:1** kontrast sağlar.

#### Koyu tema

- `--bg`: `#18130F`
- `--surface`: `#30231B`
- `--surface-raised`: `#423126`
- `--surface-soft`: `#514031`
- `--text`: `#F5EFE5`
- `--text-muted`: `#C1B19F`
- `--accent`: `#D97850`
- `--accent-text`: `#F0AB8B`
- `--on-accent`: `#24160F`
- `--negative`: `#E9A6BB`
- `--ledger-surface`: `#E8DCC7`

Ölçülen kontrast örnekleri: ana metin/sayfa **16.12:1**, yardımcı metin/sayfa **8.83:1**, placeholder/yükseltilmiş alan **5.92:1**, küçük accent metni/sayfa **9.57:1**, aksiyon metni/accent **5.64:1** (hover **6.57:1**). Defter metni ve yardımcı metni sıcak kâğıt üzerinde **11.62:1 / 5.30:1** kontrast sağlar.

Renk hiçbir durumda bakiye veya hata anlamını tek başına taşımaz; metinsel alacaklı/borçlu durumu ve açık hata açıklaması korunur.

### 6.4 Tipografi ve yoğunluk

- Ürün arayüzünde tek aile; tercihen mevcut `Mada`.
- Gövde ve form tabanı: 16 px.
- Yardımcı metin: 14 px; yalnızca kısa bağlamlarda 13 px kullanılabilir.
- Başlık ölçeği sınırlı ve akışkan olmalı; mobilde hero metni içeriği ezmemeli.
- Sayısal tutarlar `font-variant-numeric: tabular-nums` kullanmalı.
- Satır yüksekliği gövde metninde yaklaşık 1.45–1.6 olmalı.
- Büyük harfli, geniş letter-spacing'li mikro etiketler çok seyrek kullanılmalı.

### 6.5 Yüzey ve derinlik

- Üç ana katman: sayfa, çalışma yüzeyi ve odak defteri. Yükseltilmiş kontrol tokenı yalnızca alanlar ve seçili seçenekler içindir.
- Gölge yalnızca modal/sheet, açılır menü veya gerçekten yükselen yüzeylerde kullanılmalı.
- Varsayılan kart kenarlığı yerine ton ve boşluk tercih edilmeli; dekoratif gradient ve cam efekti kullanılmamalı.
- Köşe yarıçapları sınırlı bir ölçekten gelmeli; her bileşende farklı kapsül kullanılmamalı.

## 7. Bilgi mimarisi ve ekran kararları

### 7.1 Mobil dashboard

Önerilen sıralama:

1. Kompakt uygulama çubuğu: önce ev adı, ardından davet ve hesap menüsü
2. Ana özet yüzeyi: açık toplam, açık işlem sayısı, kullanıcının net durumu
3. Üye bakiyeleri: dikey, kolay taranan liste
4. Hareketler başlığı ve filtreleri
5. Tek hareket akışı
6. Sabit alt eylem alanı

#### Header

- Katılım kodu sürekli header'da yer işgal etmemeli.
- “Davet et / kodu paylaş” eylemi ayrıntıyı açmalı ve kopyalama geri bildirimi vermeli.
- Mobilde tema seçimi ev adının yanında yer kaplamamalı; hesap menüsünde bulunmalı. Masaüstünde görünür seçim korunabilir.
- Çıkış ikincil menüde yer alabilir; ana eylemlerle yarışmamalı.

#### Özet

- İlk bakışta yalnızca kullanıcının karar vermesine yarayan üç bilgi gösterilmeli.
- Büyük dekoratif sayı yerine açıklaması net tutar kullanılmalı.
- Borç/alacak durumu renk, işaret ve metinle birlikte belirtilmeli.

#### Üye bakiyeleri

- Bağlantılı yatay ray kaldırılmalı.
- Beş kişiye kadar tüm üyeler dikey kompakt satırlarla görünür olmalı.
- Her satırda ad, kısa durum ve tutar bulunmalı.

#### Ana eylemler

- Alt çubukta birincil **Harcama ekle**, ikincil **Ödeme listesine bak**.
- Yükseklik en az 48 px; metin ve ikon birlikte kullanılabilir.
- Çubuk safe-area'ya uymalı ve listenin sonunu örtmemeli.

#### Hareket akışı

- `Açık`, `Bu ay`, `Tümü` filtreleri tek satırda, anlaşılır segmented control olarak sunulmalı.
- Her hareket satırı açıklama, tarih/kategori, ödeyen-paylaşım özeti, tutar ve durumu göstermeli.
- Düzenle/sil seçenekleri ana satırı kalabalıklaştırmayan erişilebilir bir menüde olabilir.
- Açık işlem eylemleri hâlâ kolay ulaşılır olmalı; temel işlev gizlenmemeli.

### 7.2 Masaüstü dashboard

- Maksimum içerik genişliği: yaklaşık 1180–1240 px.
- Sol sabit kolon: 360–420 px.
- Sağ esnek kolon: hareket akışı.
- Sol kolonda özet, üyeler, davet ve ikincil eylemler.
- Sağ kolonda filtreler, arama gerekirse daha sonra, hareket listesi ve sayfa içi eylemler.
- Mobil alt eylem çubuğu masaüstünde panel içi butonlara dönüşmeli.
- Ekran boyunca uzanan ayırıcı çizgi kullanılmamalı.

### 7.3 Açılış sayfası

- Değer önerisi tek cümlede anlaşılmalı.
- Mobil ilk ekranda büyük başlık + CTA + kısa güven açıklaması yeterli olmalı.
- Ürünün tamamını taklit eden yoğun demo paneli ilk ekranı kaplamamalı; basitleştirilmiş gerçekçi örnek aşağıda yer alabilir.
- Kanıtlanmamış kullanıcı sayısı, referans veya başarı iddiası eklenmemeli.
- “Başla” CTA'sı net; ikincil açıklama metin bağlantısı olabilir.

### 7.4 Başlangıç ve kimlik doğrulama

- Giriş/kayıt formu tek amacı desteklemeli.
- Form üstünde işlevsiz veya klavye modeli eksik tab görünümü kullanılmamalı.
- Kimlik doğrulamadan sonra ev oluşturma/katılma seçimi gösterilmeli.
- Hatalar kullanıcı dilinde, ilgili alana yakın ve düzeltme önerisiyle verilmelidir.

## 8. Harcama formu şartnamesi

### Mobil davranış

- Tam ekran veya tam yüksekliğe yakın bottom sheet.
- Üstte sabit: başlık ve kapat.
- Ortada kaydırılabilir içerik.
- Altta sabit: birincil kaydet ve gerekirse iptal.
- Klavye açıldığında aktif alan ve hata görünür kalmalı.
- Sayısal alanlarda doğru `inputMode` kullanılmalı.

### Alan sırası

1. Tutar
2. Açıklama
3. Kategori ve tarih
4. Ödeyen kişi
5. Katılımcılar
6. Paylaşım modu
7. Özel mod seçiliyse kişi tutarları ve toplam kontrolü

### Davranış kuralları

- Mevcut eşit/özel dağılım veri davranışı korunacak.
- Özel dağılımda yalnızca seçili üyeler listelenecek.
- Toplam harcama, dağıtılan tutar ve fark aynı bağlamda görülecek.
- `0`, negatif, boş ve toplamı tutmayan değerler net biçimde engellenecek.
- Düzenleme modunda mevcut değerler eksiksiz geri yüklenmeli.
- Yükleme sırasında tekrar gönderim engellenmeli ve buton durumu açıklanmalı.
- Başarı/hata bildirimi ekran okuyucuya duyurulmalı.

### Masaüstü davranış

- 600–680 px civarı okunabilir modal genişliği.
- Gerekli yerlerde iki kolon kullanılabilir; okuma sırası bozulmamalı.
- Footer modalın içinde görünür kalmalı.

## 9. Tema sistemi şartnamesi

### Kullanıcı deneyimi

- Seçenekler: `Sistem`, `Açık`, `Koyu`.
- Seçim yerel olarak kalıcı tutulmalı; önerilen anahtar: `ev-hesap-theme`.
- İlk ziyarette sistem tercihi kullanılmalı.
- Sistem tercihi seçiliyken işletim sistemi değişikliği canlı yansıtılmalı.
- Tema kontrolünün erişilebilir adı ve seçili durumu olmalı.
- Kimlik doğrulanmış mobil dashboard ve hesaplaşma ekranında tema seçimi ikincil menüde sunulmalı.

### Teknik yaklaşım

- Semantik CSS değişkenleri `:root` ve koyu tema seçicisinde tanımlanmalı.
- Tema, React hydration'dan önce küçük bir satır içi script ile `document.documentElement` üzerinde uygulanmalı.
- Bu script yalnızca tema için gerekli minimum işi yapmalı ve hata durumunda sistem tercihine düşmeli.
- `html` üzerinde gerekirse `suppressHydrationWarning` kullanılmalı.
- `color-scheme` aktif temayla uyumlu olmalı.
- Tarayıcı `theme-color` metadata'sı açık/koyu tercihe uygun tanımlanmalı.
- İlk boyada açık tema parlaması olmamalı.
- Tüm hover, active, disabled, focus, error ve success durumları iki temada doğrulanmalı.

## 10. Uygulama mimarisi sınırları

### Korunacak ürün davranışları

- Supabase ve localStorage veri akışı
- Kimlik doğrulama ve session davranışı
- Ev oluşturma/katılma
- Harcama ekleme, düzenleme ve silme
- Eşit ve özel pay dağılımı
- Doğrudan ödeme kaydı ve kullanıcı başlattığı dönem kapatma
- Filtrelenebilir/açık işlem durumu
- Mevcut Türkçe ürün dili

### Değiştirilmeyecekler

- Veri tabanı şeması, RPC veya yetki modeli — UI için zorunlu değilse
- İş hesaplama kuralları
- Yeni CSS framework veya ağır UI kütüphanesi
- Kullanıcıdan istenmeyen yeni ürün özelliği
- Kanıtlanmamış pazarlama içeriği

### Kod organizasyonu

- Dashboard anlamlı görsel/işlevsel bileşenlere ayrılmalı.
- Ortak UI primitive'leri küçük tutulmalı; soyutlama uğruna soyutlama yapılmamalı.
- Global CSS token, reset ve gerçekten ortak sınıfları taşımalı.
- Mobil-first temel kurallar kullanılmalı; masaüstü için `min-width` genişletmeleri yapılmalı.
- Next.js API veya dosya yapısı hakkında varsayım yapılmadan projedeki `node_modules/next/dist/docs/` kılavuzları izlenmeli.
- Server/client sınırları korunmalı; yalnız tema için tüm ağacı client bileşenine çevirmemeli.

## 11. Uygulama aşamaları

### Aşama 1 — Tokenlar, tipografi ve tema

- Semantik renk, boşluk, radius, gölge ve tipografi tokenları
- Açık/koyu/sistem tema altyapısı
- Tema kontrolü ve flash önleme
- Temel buton, input, surface, focus stilleri

### Aşama 2 — Açılış ve başlangıç akışı

- Mobil hero yoğunluğunu azaltma
- Form hiyerarşisi ve onboarding karar sırasını düzeltme
- İki tema ve küçük ekran QA

### Aşama 3 — Dashboard bilgi mimarisi

- Yeni mobil sıra
- Özet yüzeyi
- Dikey üye bakiyeleri
- Tek hareket akışı ve filtreler
- Mobil alt eylem alanı
- Masaüstü iki kolon

### Aşama 4 — Diyaloglar ve karmaşık formlar

- Harcama formunun gruplanması ve responsive sheet/modal davranışı
- Özel dağılımın progressive disclosure sunumu
- Ödeme/hesaplaşma ve silme diyaloğunun sisteme uyarlanması
- Klavye ve odak doğrulaması

### Aşama 5 — Regresyon, görsel QA ve temizlik

- Tüm ana kullanıcı yolları
- Viewport matrisi
- Tema matrisi
- Statik uyarıların azaltılması
- Ölü/eski CSS'in kaldırılması
- Tasarım dokümantasyonunun güncellenmesi

## 12. Kabul kriterleri

### Mobil görünüm

Şu viewportlarda kontrol edilecek:

- 320 × 568
- 360 × 800
- 390 × 844
- 430 × 932
- 768 × 1024

Her viewport için:

- Yatay taşma yok.
- Ana CTA ilk kullanım bağlamında kolay ulaşılır.
- Alt sabit alan içerik ve kontrolleri örtmüyor.
- 44 px altı temel dokunma hedefi yok; ana eylemler 48 px.
- Gövde/form metni rahat okunuyor.
- Harcama formu klavye açıkken kullanılabiliyor.
- Beş üyeye kadar bakiye listesi bozulmuyor.
- Uzun ad, büyük tutar ve uzun açıklama düzeni kırmıyor.

### Masaüstü görünüm

Şu viewportlarda kontrol edilecek:

- 1024 × 768
- 1280 × 800
- 1440 × 900

Kriterler:

- İçerik gereksiz biçimde ekran boyunca uzamıyor.
- İki kolon dengeli ve okunabilir.
- Ana bilgi ve eylem hiyerarşisi ilk bakışta anlaşılır.
- Büyük boşluklar ve uzun ayırıcı çizgiler görünümü domine etmiyor.

### Tema

- Sistem, açık ve koyu seçimleri çalışıyor.
- Yenileme sonrası seçim korunuyor.
- İlk boyada tema parlaması yok.
- Formlar, modallar, menüler, toast, focus, disabled, error ve success durumları iki temada okunaklı.
- Normal metin WCAG AA kontrastını sağlıyor.

### Etkileşim ve erişilebilirlik

- Klavyeyle tüm temel işlemler yapılabiliyor.
- Diyalog açıldığında odak doğru yere gidiyor; kapanınca tetikleyiciye dönüyor.
- Escape beklendiği gibi çalışıyor.
- Görünür odak halkası hiçbir temada kaybolmuyor.
- 200% zoom'da içerik veya eylemler kaybolmuyor.
- Hareket azaltma tercihi anlamlı biçimde uygulanıyor.
- Renk tek başına durum anlatmıyor.

### Teknik kalite

- `npm test` geçiyor.
- `npm run lint` geçiyor.
- `npm run build` geçiyor.
- `git diff --check` temiz.
- Tasarım sistemi taramasındaki 121 uyarı ciddi ölçüde azalıyor; kalan her bilinçli istisna açıklanıyor.
- Konsolda yeni hydration, React key veya erişilebilirlik uyarısı yok.
- Yeni ağır bağımlılık eklenmiyor.
- Veri hesaplama testleri ve özel pay davranışı korunuyor.

## 13. Görsel QA çıktıları

Uygulama tamamlanınca en az şu kanıtlar üretilecek:

- Açılış: 390 × 844 açık ve koyu
- Başlangıç: 390 × 844 açık ve koyu
- Dashboard: 390 × 844 açık ve koyu
- Hesaplaşma: 390 × 844 açık ve koyu (oturum varsa)
- Harcama formu eşit paylaşım: 390 × 844
- Harcama formu özel paylaşım: 390 × 844
- Dashboard: 1440 × 900 açık ve koyu
- Hesaplaşma: 1440 × 900 açık ve koyu (oturum varsa)
- Silme diyaloğu ve odak durumu

Ekran görüntüleri aynı viewportlar arasında karşılaştırılmalıdır. Farklı boyuttaki görseller üzerinden hizalama veya yoğunluk sonucu çıkarılmamalıdır.

## 14. Tamamlanma tanımı

Çalışma yalnızca CSS değiştiğinde tamamlanmış sayılmaz. Tamamlanma için:

1. Mobil dashboard ve ana formlar yeni bilgi mimarisine geçmiş olmalı.
2. Açık/koyu/sistem teması gerçek kullanıcı seçimiyle çalışmalı.
3. Son sürümdeki özel pay ve silme davranışları korunmalı.
4. Açılış ve başlangıç ekranları aynı tasarım sistemine bağlanmalı.
5. Mobil ve masaüstü görsel kanıt üretilmeli.
6. Test, lint, build ve diff kontrolleri geçmeli.
7. Koordinatör incelemesinde bulunan P1/P2 hatalar düzeltilmiş olmalı.
8. Bilinen sınırlamalar açıkça raporlanmalı.

## 15. Uygulayıcı ajan çalışma protokolü

- Bu belge uygulama sözleşmesidir; davranışsal belirsizlikte tahmin yapılmamalı, koordinatöre soru sorulmalıdır.
- Önce mevcut kod ve Next.js yerel dokümanı okunmalıdır.
- Değişiklikler mobil-first ve aşamalı yapılmalıdır.
- Kullanıcı verisi, backend davranışı veya iş kuralları UI adına sessizce değiştirilmemelidir.
- İlgisiz çalışma ağacı değişikliklerine dokunulmamalıdır.
- Commit veya push yapılmamalıdır; koordinatör incelemesinden sonra karar verilecektir.
- Çalışma sonunda değişen dosyalar, doğrulamalar, görsel kanıtlar ve kalan sınırlamalar raporlanmalıdır.
