---
target: Projede UI/UX review; light/dark renk uyumu ve sıcak ev ortamı
total_score: 28
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 3
target_identity: "file:/home/knover/Documents/GitHub/ev-harcama-takip/src/app/dashboard/page.tsx"
target_fingerprint: "sha256:65bef41c2199f4b6072cb159c90c4fd7d46d8170ad5b1f930a78f8e4c428ff28"
target_path: /home/knover/Documents/GitHub/ev-harcama-takip/src/app/dashboard/page.tsx
timestamp: 2026-09-20T15-42-56Z
slug: src-app-dashboard-page-tsx
---
# Ev Hesap UI/UX Critique — sıcak ev hissi

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Sistem durumunun görünürlüğü | 3/4 | Geri bildirimler güçlü; bazı durumlar yalnızca ARIA live ile görsel olarak sessiz. |
| 2 | Gerçek dünyayla eşleşme | 2/4 | Muhasebe dili evsel tonu soğutuyor. |
| 3 | Kullanıcı kontrolü | 3/4 | İptal ve iki aşamalı onay var; tekrar eden harcama girişi uzun. |
| 4 | Tutarlılık ve standartlar | 3/4 | Bileşenler tutarlı; hesaplaşma adları değişken. |
| 5 | Hata önleme | 4/4 | Doğrulama, limitler ve destructive confirmation güçlü. |
| 6 | Hatırlama yerine tanıma | 3/4 | Açık etiketler iyi; bakiye/ödeme/dönem ilişkisi öğrenme gerektiriyor. |
| 7 | Esneklik ve verimlilik | 2/4 | Mobil aksiyonlar iyi; sık kullanılan harcama girişinde hızlandırıcı yok. |
| 8 | Estetik ve minimal tasarım | 2/4 | Temiz ancak yüzey katmanları düz ve ürün karakteri zayıf. |
| 9 | Hata kurtarma | 3/4 | Retry ve aksiyonlu hata durumları var; oturum hataları akışı geriye itiyor. |
| 10 | Yardım ve dokümantasyon | 3/4 | Açıklamalar mevcut; temel kavramlar jargonlu. |
| **Toplam** |  | **28/40** | **Güçlü temel, zayıf duygusal uyum** |

## Design Specificity Verdict

Arayüz kısmen bu ürüne özel, fakat tonal olarak bölünmüş durumda. “Sakin Ev Defteri” sıcak ve evsel bir dünya kurarken “Daire Dağıtım Panosu” teknik ve endüstriyel bir dünya tarif ediyor. Mevcut uygulama güçlü bir rail/panel metaforunu da taşımadığı için sonuç çoğunlukla ölçülü bir finans/SaaS arayüzüne yaklaşıyor.

Deterministik tarama `src/app/dashboard/page.tsx` için 0 bulgu verdi (`[]`). Bu mekanik temizlik erişilebilirlik ve kod kalitesi açısından olumlu, fakat renk uyumu, sıcaklık veya yüzey hiyerarşisini doğrulamaz.

Tarayıcı overlay enjeksiyonu kullanılamadı; mevcut tarayıcı yüzeyi yalnızca read-only değerlendirme sağladı. Kanıt olarak gerçek light/dark ekran görüntüleri, DOM/AX yapısı ve token kontrast ölçümleri kullanıldı.

## Overall Impression

Açık tema hedefe yakın; koyu tema okunaklı fakat soğuk. En büyük fırsat yeni bir palet seçmek değil, ev defteri metaforunu tek yön olarak sabitlemek ve üç katmanlı yüzey hiyerarşisini iki temada da kurmak.

## What's Working

- Açık temanın fildişi, kırık beyaz, evergreen ve persimmon birlikteliği sıcak ve ayırt edici.
- Ana/muted metin ve semantik durum renkleri iki temada da güçlü kontrast veriyor; durumlar renk yanında yazıyla da açıklanıyor.
- Mobil alt aksiyon çubuğu, 44–48 px hedefler ve iki aşamalı kapatma akışı görev ergonomisini güçlendiriyor.

## Priority Issues

### [P1] Ev defteri ile teknik pano yönleri çakışıyor

**Neden:** Ürün doğru çalışıyor ama ortak yaşam aracından çok finans paneli gibi algılanıyor.

**Düzeltme:** Ana metaforu sıcak ortak ev defteri olarak sabitle; teknik pano dilini yalnızca hesapların netliğinde tut. Endüstriyel yön referanslarını ve kurumsal kimlik işaretlerini yumuşat.

**Suggested command:** `$impeccable shape`

### [P1] Koyu tema fazla nötr-siyah

**Neden:** `#131313`, `#1D1D1B` ve `#262622` okunaklı ancak teknik; sayfa-kart ayrımı yaklaşık 1.10:1.

**Düzeltme:** Espresso veya karartılmış zeytin tabanı, daha belirgin sıcak yüzey katmanları ve daha ayrı action/negative hue kullan.

**Suggested command:** `$impeccable colorize`

### [P1] Yüzey hiyerarşisi düz

**Neden:** Açık temada sayfa-kart ayrımı yaklaşık 1.07:1. Geniş boşluklarda sakinlik yerine seyrek ve maddesiz görünüm oluşuyor.

**Düzeltme:** Oda zemini, çalışma yüzeyi ve odak defteri olmak üzere üç katman kur; sıcak gölge/sınırı seçici kullan.

**Suggested command:** `$impeccable layout`

### [P2] Copy muhasebe yazılımı tonuna kayıyor

**Neden:** “Açık dönem hesabı”, “doğrudan ödeme”, “bakiye önerisi” ve değişken hesaplaşma adları zihinsel yükü artırıyor.

**Düzeltme:** Tek bir ev dili kur: “Bu evin açık giderleri”, “Yapılan ödeme”, “Kim kime ödeyecek?” gibi ifadeleri tutarlı kullan.

**Suggested command:** `$impeccable clarify`

### [P2] Mobil chrome ana görevle yarışıyor

**Neden:** Ev kimliği, davet, tema ve hesap menüsü dar başlıkta rekabet ediyor; görünüm seçici kalıcı olarak fazla yer kaplıyor.

**Düzeltme:** Oturumlu mobilde tema seçimini hesap menüsüne taşı; ev kimliğine öncelik ver.

**Suggested command:** `$impeccable adapt`

## Theme Findings

### Light

- Hedef duygu için doğru temel; paleti tamamen değiştirmek gerekmiyor.
- Ana metin/zemin 15.05:1, muted/zemin 5.67:1, CTA 5.26:1.
- `--accent-text`/zemin 4.45:1; büyük hero metninde uygun, küçük metinde AA sınırının hemen altında.
- En büyük ihtiyaç daha belirgin yüzey ayrımı ve daha dolu masaüstü kompozisyonu.

### Dark

- Ana metin/zemin 16.35:1, muted/zemin 7.73:1; okunabilirlik güçlü.
- Nötr siyah geniş alanları domine ediyor; atmosfer evden çok finans aracı.
- Sıcak paper ledger iyi bir odak fikri; tüm temanın sıcak ton sistemi bunun etrafında kurulmalı.
- Action coral ve negative rose birbirine yakın; yoğun listelerde hue ayrımı artırılmalı.

## Persona Red Flags

**İlk kullanıcı:** Ev oluşturmayı anlıyor, ardından açık dönem/doğrudan ödeme/bakiye ve farklı hesaplaşma terimleriyle karşılaşıyor. Paranın otomatik gönderilmediği güvence ancak settlement içinde netleşiyor.

**Sık kullanıcı:** Harcama ekleme erişilebilir, fakat tekrar eden görev hâlâ çok bölümlü tam ekran form. Hızlı tekrar veya son kategori kolaylığı yok.

**Dikkati dağılmış mobil kullanıcı:** Alt aksiyon çubuğu güçlü; üst başlık kalabalık. Beş katılımcı ve özel paylaşım alanları açıldığında kesinti sonrası kaldığı yeri anlama zayıf.

## Minor Observations

- Mada okunaklı ve yeterince yumuşak; korunmalı.
- EH monogramı evselden önce kurumsal algılanıyor.
- Landing, onboarding'den daha güçlü; onboarding masaüstünde fazla boş.
- PWA manifest tema rengi `#e9f0e8`, güncel paletle uyumsuz eski bir değer.
- Yazılı alacaklı/borçlu durumları kesinlikle korunmalı.

## Questions to Consider

- Uygulama açıldığında kullanıcı finans hesabına mı, evde tutulan ortak nota mı bakıyor gibi hissetmeli?
- Koyu tema siyah dashboard yerine gece sıcak ışıklı bir oda hissi verebilir mi?
- Tema seçimi mobil başlıkta kalıcı yer kaplayacak kadar önemli mi?
- Dönem kapandığında hedef duygu yalnızca tamamlanma mı, yoksa rahatlama ve adalet hissi mi?
