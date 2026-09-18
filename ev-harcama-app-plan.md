# Ev Harcama Takip Uygulaması — Ürün ve Teknik Plan

## 1. Amaç

Bu uygulamanın amacı aynı evde yaşayan kişilerin ortak harcamalarını mümkün olduğunca basit şekilde takip etmek ve kullanıcı istediği anda kimin kime ne kadar ödeme yapması gerektiğini hesaplamaktır.

Temel kullanım:

- Bir kişi ortak bir harcama yaptığında uygulamaya ekler.
- Sistem kişinin toplam harcamasını günceller.
- Harcama geçmişi kalıcı olarak tutulur.
- Borç hesabı otomatik veya ay sonuna bağlı değildir; kullanıcı istediği anda **Borçları Hesapla** butonuna basar.
- Sistem yalnızca henüz kapatılmamış (açık) harcamaları kullanarak kişi başına düşen payları ve net bakiyeleri hesaplar.
- Fazla harcayanlar **alacaklı**, az harcayanlar **borçlu** olur.
- Sistem gereksiz karşılıklı ödemeleri kaldırarak sade bir ödeme listesi üretir.

Bu yapı Splitwise mantığının çok daha sade ve sadece ev arkadaşları kullanımına göre optimize edilmiş bir versiyonudur.

---

## 2. Temel Hesap Mantığı

Örnek olarak evde 4 kişi olduğunu düşünelim:

- A: 2.000 TL harcadı
- B: 3.000 TL harcadı
- C: 1.000 TL harcadı
- D: 1.000 TL harcadı

Toplam harcama:

```text
2.000 + 3.000 + 1.000 + 1.000 = 7.000 TL
```

Kişi başına düşmesi gereken tutar:

```text
7.000 / 4 = 1.750 TL
```

Her kişinin net bakiyesi:

```text
netBakiye = kişininToplamHarcamasi - kişiBaşıOrtalama
```

Sonuç:

| Kişi | Toplam Harcama | Olması Gereken | Net Bakiye |
|---|---:|---:|---:|
| A | 2.000 TL | 1.750 TL | +250 TL |
| B | 3.000 TL | 1.750 TL | +1.250 TL |
| C | 1.000 TL | 1.750 TL | -750 TL |
| D | 1.000 TL | 1.750 TL | -750 TL |

- Pozitif bakiye = alacaklı
- Negatif bakiye = borçlu
- Sıfır = hesabı dengede

---

## 3. Kullanıcının İlk Düşündüğü Sistem

4 kişi için birisi 1.000 TL harcadığında kendi payı 250 TL olduğundan diğer kişilerden toplam:

```text
1.000 × 3 / 4 = 750 TL
```

alacaklı hale gelir.

Bu düşünce matematiksel olarak doğrudur.

Ancak uygulamanın veri modelinde sürekli `alacak` değerleri tutmak yerine gerçek harcamaları kaydetmek ve istenen anda net bakiyeyi hesaplamak daha güvenlidir.

Bunun avantajları:

- Harcamalar silinebilir veya düzenlenebilir.
- Geçmiş görülebilir.
- Hesaplama gerektiğinde baştan üretilebilir.
- Bir hata olduğunda verinin kaynağı bellidir.
- Sonradan 3 kişilik / 2 kişilik özel harcamalar desteklenebilir.

Yani kullanıcı arayüzünde sistem yine “A 750 TL alacaklı” gibi gösterilebilir; fakat asıl veri kaynağı harcama kayıtları olmalıdır.

---

## 4. Borçları Sadeleştirme Algoritması

Kullanıcı **Borçları Hesapla** butonuna bastığında, son kapatılan hesaptan sonra oluşan açık harcamalar üzerinden net bakiyeler hesaplanır ve iki liste oluşturulur:

```text
Alacaklılar:
B +1250
A +250

Borçlular:
C -750
D -750
```

Algoritma:

1. En yüksek alacaklıyı bul.
2. En yüksek borçluyu bul.
3. Ödenecek tutarı hesapla:

```text
ödeme = min(alacak, abs(borç))
```

4. Bu ödemeyi iki kişinin bakiyesinden düş.
5. Bakiyesi sıfırlanan kişiyi listeden çıkar.
6. Herkes sıfırlanana kadar devam et.

Örneğin:

```text
C → B: 750 TL
```

Kalan:

```text
B +500
A +250
D -750
```

Ardından:

```text
D → B: 500 TL
```

Kalan:

```text
A +250
D -250
```

Son olarak:

```text
D → A: 250 TL
```

Nihai ödeme listesi:

```text
C → B: 750 TL
D → B: 500 TL
D → A: 250 TL
```

Bu sayede gereksiz karşılıklı transferler oluşmaz.

---

## 5. Harcamanın Herkese Ait Olmadığı Durumlar

Her harcama bütün ev halkına ait olmayabilir.

Örneğin:

- A, B ve C birlikte 600 TL yemek söyledi.
- D evde değildi.

Bu durumda harcama 4'e değil 3'e bölünmelidir.

Bu nedenle her harcamada şu alan bulunmalıdır:

```text
Kimler için?
[x] A
[x] B
[x] C
[ ] D
```

Bu senaryoda kişi başı pay:

```text
600 / 3 = 200 TL
```

Hesaplama artık sadece seçilen katılımcılar arasında yapılır.

Bu özellik MVP'de bile bulunması faydalıdır çünkü gerçek kullanımda sık karşılaşılır.

---

# 6. Manuel Borç Hesabı — Temel Kural

Borç hesabı **ay sonunda otomatik çalışmaz**. Kullanıcı ne zaman isterse çalıştırır.

Sistem iki farklı veri kavramını ayırır:

1. **Harcama istatistikleri:** aylık, yıllık ve tüm zamanlar boyunca kalıcıdır.
2. **Açık borç dönemi:** son kapatılmış settlement işleminden sonra oluşan ve henüz kapatılmamış harcamalardır.

Örnek akış:

```text
1 Eylül   500 TL harcama
3 Eylül   800 TL harcama
7 Eylül   300 TL harcama

8 Eylül → Borçları Hesapla
         → ödeme listesi göster
         → Hesabı Kapat

10 Eylül  900 TL harcama
12 Eylül  250 TL harcama

13 Eylül → Borçları Hesapla
```

13 Eylül'deki hesaplamada **1–7 Eylül harcamaları tekrar kullanılmaz**. Yalnızca 8 Eylül'deki kapanıştan sonra oluşan 900 TL ve 250 TL'lik açık harcamalar hesaba girer.

Buna karşılık Eylül ayı istatistiği yine tüm Eylül harcamalarını içerir. Yani settlement geçmiş harcamaları silmez veya istatistiklerden çıkarmaz.

---

# 7. Önerilen Tech Stack

## Frontend

### Next.js

Öneri:

```text
Next.js + TypeScript
```

Neden:

- Tek proje içinde frontend ve backend işlemleri yapılabilir.
- Vercel'e çok kolay deploy edilir.
- Mobil uyumlu web app geliştirmek kolaydır.
- PWA desteği eklenebilir.
- Küçük proje olarak başlayıp sonradan büyütülebilir.

### UI

```text
Tailwind CSS
shadcn/ui
```

Amaç sade, hızlı ve mobil öncelikli bir arayüz kurmak.

Uygulamanın görsel olarak karmaşık olmasına gerek yoktur.

---

## Backend ve Veritabanı

### Supabase

Önerilen servis:

```text
Supabase
```

Kullanılacak parçalar:

- PostgreSQL veritabanı
- Auth
- Row Level Security
- Realtime — gerekirse

Bu proje için Firebase yerine PostgreSQL tabanlı Supabase daha uygun olur çünkü harcama, kullanıcı, katılımcı ve ödeme ilişkileri SQL ile çok doğal modellenebilir.

---

## Hosting

```text
Vercel
```

Next.js uygulaması GitHub'a push edilir ve Vercel üzerinden otomatik deploy edilir.

Örnek:

```text
evhesap.vercel.app
```

İleride özel domain bağlanabilir.

---

# 8. PWA — Telefona İndirilebilir Web App

Bu proje için native Android/iOS uygulaması geliştirmeye gerek yoktur.

En mantıklı başlangıç yöntemi **PWA — Progressive Web App** kullanmaktır.

Kullanıcı siteyi tarayıcıdan açar ve:

```text
Ana Ekrana Ekle
```

seçeneğiyle telefona yükler.

Sonrasında uygulama:

- Ana ekranda ikonla görünür.
- Tam ekran açılabilir.
- Tarayıcı hissi büyük ölçüde kaybolur.
- Android'de uygulama gibi kullanılabilir.
- App Store / Play Store yayınlama zorunluluğu olmaz.

Gerekli temel parçalar:

```text
manifest.webmanifest
service worker
app icons
mobile responsive UI
```

İlk sürüm için PWA bu projenin en mantıklı dağıtım yöntemidir.

---

# 9. Önerilen Veri Modeli

## households

Evi temsil eder.

```text
id
name
owner_member_id
join_code_hash
join_code_created_at
created_at
```

Örnek:

```text
1 | Bizim Ev
```

---

## members

Evde yaşayan kullanıcılar.

```text
id
household_id
name
user_id (opsiyonel)
created_at
```

Örnek:

```text
1 | A
2 | B
3 | C
4 | D
```

Üyeler ilgili `household_id` altında tutulur. Bir evdeki üye sayısı sabit 4 kişiyle sınırlı olmamalıdır.

---

## expenses

Her gerçek harcama ayrı kayıt olarak saklanır.

```text
id
household_id
payer_member_id
amount_cents
description
expense_date
created_at
updated_at
settlement_run_id (nullable) // henüz kapatılmadıysa NULL
```

Örnek:

```text
payer: A
amount: 125000
// 1.250,00 TL

description: Migros
```

### Önemli

Para değerleri veritabanında `float` olarak tutulmamalıdır.

Örneğin:

```text
12,50 TL → 1250 kuruş
```

Yani integer kullanılmalıdır.

Bu şekilde floating-point para hataları engellenir.

---

## expense_participants

Harcamaya kimlerin dahil olduğunu tutar.

```text
id
expense_id
member_id
share_weight
```

Basit kullanımda herkes eşit ağırlıkta olur:

```text
share_weight = 1
```

Bu tablo sayesinde bir harcamanın sadece 2 veya 3 kişiye ait olması desteklenir.

İleride farklı oranlar da desteklenebilir.

Örneğin:

```text
A = 2 pay
B = 1 pay
C = 1 pay
```

Ancak ilk sürümde buna ihtiyaç yoktur.

---

## settlement_runs ve settlements

Borç hesabının manuel çalışması ve aynı harcamaların tekrar tekrar borç hesabına girmemesi için hesaplama dönemleri kalıcı olarak kaydedilmelidir.

### settlement_runs

Her manuel hesap kapatma işlemini temsil eder.

```text
id
household_id
calculated_at
closed_at
status // preview | closed
created_by_member_id
```

Bir kullanıcı **Borçları Hesapla** dediğinde önce bir önizleme üretilebilir. Kullanıcı sonuçları onaylayıp **Hesabı Kapat** dediğinde `status = closed` olur.

### settlements

Bir settlement run içinde oluşan ödeme talimatlarını tutar.

```text
id
household_id
from_member_id
to_member_id
amount_cents
created_at
```

Örneğin:

```text
D → B
500 TL
```

Kullanıcı ödeme yaptıktan sonra:

```text
Ödendi
```

butonuna basabilir.

Bu yapı MVP için de önerilir; çünkü manuel borç hesabının sınırını güvenilir biçimde belirler.

---

# 10. MVP Ekranları

## 9.1 Dashboard

Ana ekran mümkün olduğunca sade olmalıdır.

Örnek:

```text
EV HARCAMALARI

Eylül toplamı
7.000 TL

A
2.000 TL harcadı
+250 TL alacaklı

B
3.000 TL harcadı
+1.250 TL alacaklı

C
1.000 TL harcadı
-750 TL borçlu

D
1.000 TL harcadı
-750 TL borçlu

[ + Harcama Ekle ]
```

---

## 9.2 Harcama Ekle

Form:

```text
Tutar
[ 850 TL ]

Açıklama
[ Market ]

Kim ödedi?
[ A ]

Kimler için?
[x] A
[x] B
[x] C
[x] D

[ Harcamayı Ekle ]
```

Mümkün olduğunca az tıklama gerektirmelidir.

---

## 9.3 Harcama Geçmişi

Örnek:

```text
18 Eylül
A — Migros — 850 TL

17 Eylül
B — Yemek — 600 TL

16 Eylül
C — Temizlik malzemesi — 320 TL
```

Her kayıt için:

```text
Düzenle
Sil
```

seçenekleri olmalıdır.

---

## 9.4 Manuel Borç Hesabı

Borç hesabı hiçbir takvime bağlı değildir. Ana ekranda sürekli erişilebilir bir buton bulunur:

```text
[ Borçları Hesapla ]
```

Kullanıcı bu butona ne zaman basarsa sistem yalnızca **son kapatılmış hesaptan sonra eklenen açık harcamaları** dikkate alır.

Örnek sonuç:

```text
C → B: 750 TL
D → B: 500 TL
D → A: 250 TL
```

Bu ekran ilk aşamada bir **önizlemedir**. Hiçbir veri kapanmış sayılmaz.

Altında iki aksiyon bulunur:

```text
[ Geri Dön ]
[ Hesabı Kapat ]
```

**Hesabı Kapat** seçildiğinde bu hesaplamaya dahil edilen açık harcamalar settlement dönemine bağlanır ve bir sonraki borç hesabına tekrar dahil edilmez.

Böylece kullanıcı ister 3 günde bir, ister 2 haftada bir, ister ayda bir borç hesabı yapabilir.

### Önemli

Aylık/yıllık/tüm zamanlar harcama istatistikleri settlement ile sıfırlanmaz. Settlement yalnızca **borç hesabının başlangıç noktasını** ilerletir. Harcama geçmişi kalıcı olarak korunur.

---

# 11. Ay Sistemi

Harcama kayıtlarında tarih olduğu için aylık toplamlar sorgu ile hesaplanabilir.

Örneğin:

```text
2026-09-01 <= expense_date < 2026-10-01
```

Böylece:

- Bu ay
- Geçen ay
- Tüm zamanlar

filtreleri yapılabilir.

Ayrı bir `monthly_total` alanı tutmak zorunlu değildir.

Veritabanında kaynak veri harcamalar olmalıdır.

---

# 12. Authentication

## İlk sürüm

Site public olacağı için URL'ye sahip olan herkes uygulamaya girebilir; ancak ev verileri public olmamalıdır. Kullanıcı uygulamaya girdiğinde iki seçenek görmelidir:

```text
[ Yeni Ev Oluştur ]
[ Koda Sahip Bir Eve Katıl ]
```

Ev oluşturma akışı:

1. Kullanıcı ev adını ve kendi görünen adını girer.
2. Sistem yeni bir `household` ve ilk üyeyi oluşturur.
3. Sistem tahmin edilmesi zor, benzersiz bir davet kodu üretir.
4. Kod kullanıcıya kopyalanabilir şekilde gösterilir.

Eve katılma akışı:

1. Kullanıcı davet kodunu girer.
2. Kod geçerliyse ev adı gösterilir ve kullanıcıdan görünen adı istenir.
3. Kullanıcı ilgili `household` içine yeni üye olarak eklenir.
4. Kullanıcı yalnızca üyesi olduğu evin dashboard ve harcamalarını görebilir.

Davet kodu basit ve kolay tahmin edilebilir bir PIN olmamalıdır. Örneğin:

```text
EV-7K4P2M9Q
```

Kod veritabanında hash'lenmiş olarak saklanmalı, arayüzde yalnızca ev üyelerine gösterilmeli ve ev sahibi istediğinde yenileyebilmelidir. Kod yenilendiğinde eski kod geçersiz olmalıdır.

## Sonraki sürüm

Supabase Auth ile:

- Google login
- Magic link
- E-mail login

eklenebilir.

---

# 13. Güvenlik

Supabase kullanılırsa Row Level Security kullanılmalıdır.

Temel kural:

```text
Bir kullanıcı sadece üyesi olduğu household içindeki verileri okuyabilir/değiştirebilir.
```

Public siteye herkes girebilse de database tabloları public bırakılmamalıdır. Davet kodu denemelerine rate limit uygulanmalı, household verileri yalnızca üyelik kontrolü başarılı olan kullanıcılara açılmalıdır.

---

# 14. Edge Case'ler

## Harcamanın silinmesi

Bir harcama silindiğinde eski bakiyeyi manuel olarak düzeltmeye gerek olmamalıdır.

Bakiye harcamalardan yeniden hesaplandığı için sonuç otomatik düzelir.

---

## Harcamanın düzenlenmesi

Örneğin:

```text
500 TL
```

yanlışlıkla girildiyse ve gerçek tutar:

```text
550 TL
```

ise expense kaydı güncellenir.

Tüm sonuçlar otomatik yeniden hesaplanır.

---

## Küsurat

Örneğin:

```text
100 TL / 3 = 33,333...
```

oluşabilir.

Para kuruş olarak tutulduğu için dağıtım algoritması kalan 1 kuruşu katılımcılardan birine deterministik şekilde verebilir.

Örneğin:

```text
33,34
33,33
33,33
```

Toplam yine tam olarak:

```text
100,00 TL
```

olur.

---

## Bir kişinin eve sonradan katılması

Üyelik başlangıç tarihi tutulabilir.

Eski harcamalara otomatik dahil edilmemelidir.

İlk sürümde buna ihtiyaç yoksa ertelenebilir.

---

## Manuel settlement / hesap kapatma

Borç hesabı ay kapanışına bağlı değildir. Kullanıcı istediği anda hesaplama yapar.

- **Borçları Hesapla:** açık harcamalardan ödeme önerisi üretir, hiçbir şeyi kapatmaz.
- **Hesabı Kapat:** hesaplamayı kalıcı bir settlement run olarak kaydeder.
- Sonraki hesaplamada yalnızca bu kapanıştan sonra oluşan açık harcamalar kullanılır.

Geçmiş settlement kayıtları ve hangi tarihte kimden kime ne kadar ödeme çıktığı ayrıca görüntülenebilmelidir.

---

# 15. Hesaplama İçin Basit Pseudocode

## Net bakiyeler

```ts
for (const expense of expenses) {
  const participants = expense.participants;
  const share = expense.amount / participants.length;

  balances[expense.payer] += expense.amount;

  for (const participant of participants) {
    balances[participant] -= share;
  }
}
```

Bu yöntem sonucunda:

```text
pozitif = alacaklı
negatif = borçlu
```

elde edilir.

Not: Gerçek implementasyonda kuruş bölüşümü integer aritmetik ile yapılmalıdır.

---

## Ödeme sadeleştirme

```ts
while (creditors.length > 0 && debtors.length > 0) {
  const creditor = getLargestCreditor();
  const debtor = getLargestDebtor();

  const payment = Math.min(
    creditor.balance,
    Math.abs(debtor.balance)
  );

  transfers.push({
    from: debtor.id,
    to: creditor.id,
    amount: payment
  });

  creditor.balance -= payment;
  debtor.balance += payment;

  if (creditor.balance === 0) removeCreditor(creditor);
  if (debtor.balance === 0) removeDebtor(debtor);
}
```

---

# 16. Önerilen Proje Yapısı

```text
app/
  page.tsx
  expenses/
  history/
  settle/

components/
  ExpenseForm.tsx
  MemberBalanceCard.tsx
  ExpenseList.tsx
  SettlementList.tsx

lib/
  supabase.ts
  calculations.ts
  money.ts

types/
  database.ts

public/
  manifest.webmanifest
  icons/
```

Özellikle bütün finansal hesaplamalar:

```text
lib/calculations.ts
```

içinde merkezi şekilde tutulmalıdır.

---

# 17. MVP İçin Gereksiz Özellikler

İlk sürümde aşağıdakilere ihtiyaç yoktur:

- Bildirim sistemi
- App Store / Play Store uygulaması
- Çok gelişmiş kullanıcı profilleri
- Grafikler
- Bütçe sistemi
- AI özellikleri
- Banka entegrasyonu
- Fatura OCR
- Çoklu para birimi
- Karmaşık admin paneli

Amaç önce gerçek hayatta kullanılan küçük ve sağlam bir araç çıkarmaktır.

---

# 18. İlk Sürüm İçin Önerilen Scope

V1 için yeterli özellikler:

1. Ev oluşturma veya mevcut eve davet koduyla katılma
2. Ev üyeliği ve üye yönetimi
3. Harcama ekleme
4. Harcamaya dahil kişileri seçme
5. Harcama geçmişi
6. Harcama silme / düzenleme
7. Kişi bazlı toplam harcama
8. Açık harcamalar için anlık net bakiye
9. Manuel **Borçları Hesapla** butonu
10. Sadeleştirilmiş ödeme önerileri + **Hesabı Kapat** akışı
11. Settlement geçmişi
12. Aylık filtre
13. Mobil uyumlu tasarım
14. PWA kurulumu
15. Supabase kalıcı veritabanı
16. Vercel deployment

Bu scope proje için yeterlidir.

---

# 19. Nihai Stack

```text
Frontend / Full-stack framework
Next.js

Language
TypeScript

Styling
Tailwind CSS

UI Components
shadcn/ui

Database
Supabase PostgreSQL

Authentication
İlk sürüm: Supabase Auth oturumu + ev davet kodu
Sonrasında: Google login / magic link / e-mail login

Hosting
Vercel

Installable App
PWA

Source Control
GitHub
```

---

# 20. Sonuç

Bu proje için web app + PWA yaklaşımı oldukça uygundur.

Native mobil uygulama geliştirmek ilk aşamada gereksiz maliyet ve karmaşıklık yaratır. Kullanıcı sayısı birkaç kişi olduğu için Next.js + Supabase + Vercel kombinasyonu hem geliştirme hem bakım açısından fazlasıyla yeterlidir.

Temel tasarım prensibi şu olmalıdır:

> **Veritabanında gerçek harcamaları sakla, bakiyeleri bu harcamalardan hesapla.**

Böylece uygulamanın matematiksel yapısı güvenilir kalır ve ileride özellik eklemek kolaylaşır.

İlk hedef, harcama girmeyi birkaç saniyelik bir işlem haline getiren sade bir mobil arayüz ve kullanıcı ne zaman isterse **Borçları Hesapla** butonuyla anlaşılır ödeme listesi üretmek olmalıdır.

---

# 7. Harcama İstatistikleri ve Kalıcı Geçmiş

Uygulama yalnızca mevcut ayın borç/alacak durumunu değil, kullanıldığı tüm dönemlerin harcama geçmişini de saklamalıdır.

Temel prensip:

> Asıl kaynak `expenses` tablosundaki gerçek harcama kayıtlarıdır. Aylık, yıllık ve tüm zamanlar toplamları bu kayıtlardan hesaplanır.

Bu sayede uygulama 2 ay da kullanılsa 3 yıl da kullanılsa geçmiş veriler kaybolmaz.

## Ev Bazında Gösterilecek Veriler

### Bu Ay

```text
Bu ay toplam harcama: 12.450 TL
```

Ayrıca kişi bazında:

```text
A: 3.200 TL
B: 4.100 TL
C: 2.850 TL
D: 2.300 TL
```

### Önceki Aylar

Uygulamanın kullanıldığı her ay ayrı görülebilmelidir.

Örnek:

```text
Eylül 2026
Toplam: 12.450 TL
A: 3.200 TL
B: 4.100 TL
C: 2.850 TL
D: 2.300 TL

Ağustos 2026
Toplam: 9.870 TL
A: 2.400 TL
B: 2.950 TL
C: 1.920 TL
D: 2.600 TL
```

Bir ay içinde hiç harcama yoksa o ayı göstermeye gerek yoktur.

### Yıllık

Her takvim yılı için:

```text
2026 toplam harcama: 74.500 TL
```

Kişi bazında:

```text
A: 19.200 TL
B: 21.750 TL
C: 16.350 TL
D: 17.200 TL
```

Uygulama birden fazla yıl kullanılırsa yıllar ayrı ayrı listelenir:

```text
2026: 74.500 TL
2027: 103.250 TL
2028: 118.900 TL
```

### Tüm Zamanlar

Ev kurulduğundan / uygulama kullanılmaya başlandığından beri:

```text
Tüm zamanlar toplam harcama: 296.650 TL
```

Kişi bazında:

```text
A toplam: 76.400 TL
B toplam: 82.300 TL
C toplam: 68.150 TL
D toplam: 69.800 TL
```

Bu değerler hiçbir ay kapandığında sıfırlanmaz.

---

# 8. İstatistik Hesaplama Mantığı

Her harcama şu temel bilgileri taşımalıdır:

```text
amount
payer_id
expense_date
household_id
```

Böylece istenen dönem kolayca filtrelenebilir.

## Bu Ay

```sql
SUM(amount)
WHERE expense_date >= month_start
  AND expense_date < next_month_start
```

## Kişinin Bu Ayki Harcaması

```sql
SUM(amount)
WHERE payer_id = member_id
  AND expense_date >= month_start
  AND expense_date < next_month_start
```

## Yıllık Toplam

```sql
SUM(amount)
WHERE expense_date >= year_start
  AND expense_date < next_year_start
```

## Tüm Zamanlar Toplamı

```sql
SUM(amount)
WHERE household_id = household_id
```

Kişi bazında tüm zamanlar:

```sql
SUM(amount)
WHERE household_id = household_id
  AND payer_id = member_id
```

---

# 9. Neden Ayrı Bir Kalıcı `totalSpent` Değişkeni Ana Kaynak Olmamalı?

İstenirse performans amacıyla aşağıdaki gibi özet değerler cache edilebilir:

```text
household.total_spent
member.total_spent
```

Ancak bunlar sistemin tek doğruluk kaynağı olmamalıdır.

Örneğin 800 TL'lik bir harcama yanlış girilip sonra silinirse yalnızca `totalSpent += 800` yaklaşımı kullanmak veri tutarsızlığı oluşturabilir.

Bu nedenle:

```text
Gerçek kaynak = expenses kayıtları
Özet değer = hesaplanan / cache edilen istatistik
```

olmalıdır.

İlk sürüm için doğrudan SQL `SUM()` sorguları yeterlidir. Kullanıcı sayısı ve harcama sayısı çok düşük olacağı için performans problemi yaratmaz.

---

# 10. Önerilen Dashboard Yapısı

Ana ekran mobil odaklı olmalıdır.

Örnek:

```text
EV HESAP

Bu Ay
12.450 TL

Tüm Zamanlar
296.650 TL

2026
74.500 TL

--------------------

Bu Ay Kişiler

A       3.200 TL
B       4.100 TL
C       2.850 TL
D       2.300 TL

--------------------

Güncel Hesap

A       +350 TL
B       +120 TL
C       -170 TL
D       -300 TL

[ Borçları Göster ]
[ + Harcama Ekle ]
```

Dashboard'dan dönem seçilebilmelidir:

```text
[ Bu Ay ] [ 2026 ] [ Tüm Zamanlar ]
```

Ayrıca geçmiş aylara girmek için:

```text
Geçmiş
- Eylül 2026
- Ağustos 2026
- Temmuz 2026
```

Her ay açıldığında o aya ait:

- toplam harcama,
- kişi bazlı toplamlar,
- harcama listesi,
- dönem sonu net bakiyeler,
- ödeme listesi

görülebilir.

---

# 11. Güncellenmiş Veri Modeli

## households

```text
id
name
created_at
```

## members

```text
id
household_id
name
created_at
active
```

`active` alanı ileride bir ev arkadaşının evden ayrılması durumunda geçmiş kayıtlarını silmeden yeni harcamalardan çıkarabilmek için kullanılır.

## expenses

```text
id
household_id
payer_id
amount_cents
category
note
expense_date
created_at
updated_at
```

Para değerleri floating point olarak tutulmamalıdır.

Örnek:

```text
125,50 TL = 12550 kuruş
```

Bu nedenle:

```text
amount_cents BIGINT
```

kullanılması önerilir.

## expense_participants

```text
id
expense_id
member_id
share_cents
```

Bu tablo sayesinde harcama yalnızca belirli kişiler arasında bölünebilir.

Örneğin 600 TL'lik yemek yalnızca A, B ve C içinse üç katılımcı kaydı oluşturulur.

## settlements

Gerçek para transferleri de uygulamada kaydedilecekse:

```text
id
household_id
from_member_id
to_member_id
amount_cents
settled_at
note
```

İlk MVP'de bu tablo opsiyoneldir.

---

# 12. Ay Kavramı ve Dönemler

Ay için ayrı bir `months` tablosu oluşturmak zorunlu değildir.

Her `expense` kaydındaki:

```text
expense_date
```

değerinden ay ve yıl otomatik belirlenebilir.

Örneğin:

```text
2026-09-18
```

şu döneme aittir:

```text
Eylül 2026
```

Bunun avantajı yeni ay başladığında sistemin özel olarak yeni kayıt oluşturmasına gerek kalmamasıdır.

İlk Ekim harcaması girildiği anda Ekim 2026 otomatik olarak geçmiş/dönem listesinde oluşur.

---

# 13. Dönem Bazlı Borç Hesabı

Borç/alacak hesabı varsayılan olarak aylık yapılmalıdır.

Örneğin kullanıcı Eylül 2026'yı seçerse yalnızca Eylül ayındaki ortak harcamalar kullanılır.

```text
Eylül toplamı
÷ ilgili harcamaların katılımcıları
→ net bakiyeler
→ sade ödeme listesi
```

Ancak istatistik ekranındaki yıllık ve tüm zamanlar değerleri yalnızca bilgi amaçlı toplam harcamaları gösterebilir.

Böylece geçmiş aylarda kapatılmış borçlar tekrar güncel borca dahil edilmez.

Bu ayrım önemlidir:

```text
Harcama istatistiği = aylık / yıllık / tüm zamanlar
Aktif borç hesabı = seçilen açık dönem
```

---

# 14. MVP Ekranları — Güncellenmiş

## 1. Dashboard

Gösterilecekler:

- Bu ay toplam harcama
- Bu yıl toplam harcama
- Tüm zamanlar toplam harcama
- Kişilerin bu ayki harcamaları
- Güncel borç/alacak durumu
- Son harcamalar

## 2. Harcama Ekle

Alanlar:

```text
Tutar
Açıklama
Kategori
Kim ödedi?
Kimler için?
Tarih
```

Varsayılan:

```text
Kim ödedi? = giriş yapan kullanıcı
Kimler için? = tüm aktif ev üyeleri
Tarih = bugün
```

## 3. Harcama Geçmişi

Filtreler:

```text
Ay
Yıl
Kişi
Kategori
```

## 4. İstatistikler

Sekmeler:

```text
Aylık
Yıllık
Tüm Zamanlar
```

Aylık görünümde uygulamanın kullanıldığı bütün aylar listelenir.

## 5. Borçları Kapat

Örneğin:

```text
C → B      750 TL
D → B      500 TL
D → A      250 TL
```

İsteğe bağlı:

```text
[ Ödendi ]
```

butonu ile settlement kaydı oluşturulabilir.

---

# 15. PWA ve Yayına Alma

Bu proje için PWA yaklaşımı önerilir.

Kullanıcı normal bir URL üzerinden uygulamayı açar:

```text
https://evhesap.vercel.app
```

Sonrasında telefonda:

```text
Ana ekrana ekle
```

seçeneği ile uygulamayı native uygulamaya benzer şekilde kullanabilir.

PWA için:

- Web App Manifest
- uygulama ikonları
- `display: standalone`
- theme/background ayarları
- service worker / uygun PWA çözümü

kullanılmalıdır.

Avantajları:

- Play Store gerekmez.
- App Store gerekmez.
- Tek kod tabanı vardır.
- Telefon ve bilgisayardan aynı veriye ulaşılır.
- Güncelleme yayınlamak kolaydır.
- Vercel üzerinden deploy süreci çok basittir.

Bu proje ölçeğinde native mobil uygulama geliştirmek gereksiz karmaşıklık yaratacaktır.

---

# 16. Nihai Önerilen Stack

```text
Frontend / Full-stack:
Next.js + TypeScript

UI:
Tailwind CSS + shadcn/ui

Database / Auth:
Supabase PostgreSQL + Supabase Auth

Security:
Supabase Row Level Security (RLS)

Hosting:
Vercel

App format:
Responsive PWA

Source control:
GitHub
```

İlk sürümde kullanıcılar public siteye Supabase Auth oturumu ile girer; bir eve katılmak için ayrıca o evin davet kodunu kullanır.

---

# 17. Temel Ürün Kuralı

Uygulamanın en önemli mimari kuralı:

```text
Harcama kayıtları asla dönem sonunda silinmez veya sıfırlanmaz.
```

Yeni ay geldiğinde yalnızca aktif görünüm yeni aya geçer.

Eski kayıtlar sayesinde uygulama her zaman şunları gösterebilir:

```text
Bu ay ne kadar harcadık?
Geçen ay ne kadar harcadık?
Her bir kişi hangi ay ne kadar harcadı?
Bu yıl ne kadar harcadık?
Geçen yıl ne kadar harcadık?
Uygulamayı kullanmaya başladığımızdan beri toplam ne kadar harcadık?
Her kişi toplamda ne kadar ödeme yaptı?
```

Bu yapı ileride grafik, kategori analizi ve aylık karşılaştırma gibi özelliklerin eklenmesini de kolaylaştırır.

---

# Public Site ve Ev Katılım Modeli

Uygulama public bir web sitesi olarak yayınlanacaktır. Bu nedenle siteye herkes girebilir; fakat bir evin harcamaları yalnızca o evin üyelerine açık olmalıdır.

## Ana akış

İlk ekranda iki temel aksiyon bulunur:

```text
[ Yeni Ev Oluştur ]
[ Ev Koduyla Katıl ]
```

### Yeni ev oluşturma

- Kullanıcı ev/oda adını girer.
- Kendi adını girer ve ilk üye olarak eklenir.
- Sistem benzersiz bir davet kodu üretir.
- Ev sahibi bu kodu diğer kişilerle paylaşır.

### Mevcut eve katılma

- Kullanıcı kendisine gönderilen ev kodunu girer.
- Kod doğrulanır.
- Kullanıcı görünen adını belirleyerek eve katılır.
- Bundan sonra eklediği ve görüntülediği bütün veriler ilgili `household_id` ile sınırlandırılır.

## Güvenlik kuralları

- Public site, public veritabanı anlamına gelmez.
- `household_id` olmadan dashboard, üye, harcama veya settlement verisi gösterilmemelidir.
- Supabase Row Level Security ile yalnızca household üyesi olan kullanıcıların verilere erişmesine izin verilmelidir.
- Davet kodları sıralı ID, kısa PIN veya tahmin edilebilir metin olmamalıdır.
- Kod denemelerine rate limit uygulanmalıdır.
- Ev sahibi kodu yenileyebilmeli ve gerektiğinde üyeyi pasif duruma alabilmelidir.
- Harcama ekleme, düzenleme ve silme işlemleri yalnızca ilgili ev üyelerine açık olmalıdır.

## Veri modeli ekleri

```text
households
  id
  name
  owner_member_id
  join_code_hash
  join_code_created_at
  created_at

members
  id
  household_id
  user_id
  name
  role            // owner | member
  active
  joined_at
```

İlk sürümde Supabase Auth oturumu, ev davet kodu ve görünen ad birlikte kullanılmalıdır. Böylece herkes siteye girebilir; ancak rastgele kullanıcılar kodunu bilmedikleri evlerin verilerine ulaşamaz.
