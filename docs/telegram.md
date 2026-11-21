# Telegram grup bildirimleri

## Mimari ve uygulama planı

1. Her ev isteğe bağlı olarak bir özel Telegram grubuna bağlanır. Aynı bot evlere hizmet verir. Veritabanı bir grubun iki eve bağlanmasını engeller.
2. Google hesabıyla oturum açmış aktif ev sahibi süreli bir kurulum bağlantısı alır. Telegram grup yöneticisi grubu seçer. Webhook grubu ve yetkileri doğrulayıp gruba bir onay kodu gönderir. Ev sahibi on dakika içinde kodu uygulamaya girerek gönderimi başlatır.
3. Aktif ev üyeleri Ayarlar üzerinden beş dakikalık tek kişilik Telegram daveti alır. Daveti kullanan Telegram hesabı bağlantıyı elinde tutan kişidir. Uygulama telefon numarası toplamaz.
4. Harcama, doğrudan ödeme ve dönem kapanışı için INSERT tetikleyicileri, ana kayıtla aynı işlemde bağlı gruba bir gönderim işi ekler. Kuyruk kaydı bağlantının kimliğini taşır. Bağlantı silindiğinde bekleyen işler de silinir.
5. Supabase Cron dakikada bir yetkilendirilmiş Next.js gönderim uç noktasını çağırır. İşçi kısa süreli kilit alır, Telegram sonucunu kaydeder ve geçici hataları artan aralıklarla tekrar dener. Sunucu mesajı gönderdikten hemen sonra kapanırsa aynı mesaj ikinci kez gelebilir.
6. Kabul kontrolü iki ayrı ev, yetkisiz üye, süresi dolmuş eşleme, gönderim hatası, bağlantıyı kaldırma ve mobil kullanım akışlarını kapsar.

## Ev sahibi için kurulum

- Telegram’da sohbetler ekranındaki yeni mesaj simgesine dokun ve **Yeni Grup** seç. Ev arkadaşını ekle, gruba tanıyacağın bir ad ver ve grup türünü **Özel** bırak. Zaten kullandığınız özel bir ev grubu varsa onu seçebilirsin.
- Ev Hesap’ta **Ayarlar → Telegram bildirimleri** bölümünü aç. Kurulumu başlat ve Telegram bağlantısını aç. Doğru grubu seç, botu yönetici olarak eklerken **Kullanıcı davet et** iznini aç. Bu adımı Telegram grubunda yönetici ekleyebilen kişi tamamlar.
- Botun gruba gönderdiği onay kodunu Ev Hesap’a gir. Bağlantı etkinleşince yeni kayıtların bildirimleri bu gruba gelir. Daha önceki kayıtlar için toplu mesaj gönderilmez.
- Gruba yönetici olarak eklenen bot grup mesajlarını alabilir. Ev Hesap kurulum komutu ve grup geçişi dışındaki sohbet metinlerini işlemeden geçer. Grup bildiriminde kişi, borç tutarı veya harcama açıklaması paylaşılmaz.

## Üye için kullanım

Google hesabınla Ev Hesap’a girip doğru evi aç. **Ayarlar → Telegram bildirimleri** altında davet oluştur. **Telegram grubuna katıl** bağlantısını açıp Telegram’da **Katıl** seç. Bağlantıyı kendin kullan. Süresi dolarsa uygulamadan yenisini alabilirsin. Gruptaysanız tekrar katılmanız gerekmez. Bildirimin altındaki düğme ilgili evin panosunu açar ve uygulamanın üyelik denetimleri geçerlidir.

Tek bir telefonda bildirimleri sessize almak için Telegram’da grup adına dokunup bildirim ayarını değiştir. Ev sahibi uygulamada bağlantıyı kaldırarak tüm ev için gönderimi durdurabilir. Grup ve geçmiş mesajlar Telegram’da kalır. Evden ayrılan üyeleri grup yöneticisi Telegram’dan ayrıca çıkarır. Daha önce açılmış davetler en geç beş dakika içinde sona erer.

## Hizmeti ilk kez açan uygulama yöneticisi

1. Telegram’da doğrulanmış **@BotFather** sohbetini aç. `/newbot` gönder, görünen adı seç, ardından sonu `bot` ile biten kullanılabilir bir kullanıcı adı ver. BotFather’ın verdiği token sunucu parolasıdır. `/setjoingroups` ile botun gruplara eklenmesine izin ver. Her ev bu ortak botu kullanır. [Telegram bot kurulumu](https://core.telegram.org/bots/tutorial#obtain-your-bot-token)
2. Supabase’de bekleyen proje migration’larını sırayla uygula. Telegram migration’ı iki tabloyu, üç tetikleyiciyi ve kuyruktan iş alma fonksiyonunu oluşturur. Bu adım Cron ve webhook kurulumundan önce tamamlanmalı.
3. Vercel’in ilgili ortamında `.env.example` içindeki sunucu değişkenlerini tanımla. `SUPABASE_SECRET_KEY` Supabase sunucu anahtarı, `TELEGRAM_BOT_USERNAME` botun kullanıcı adı, `TELEGRAM_BOT_TOKEN` BotFather token’ı ve `TELEGRAM_APP_URL` uygulamanın kalıcı HTTPS adresidir. `TELEGRAM_WEBHOOK_SECRET` ve `TELEGRAM_DISPATCH_SECRET` için birbirinden bağımsız rastgele değerler kullan. Her biri için yerel terminalinde ayrı ayrı `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` çalıştırabilirsin. Bunları yalnızca sunucu ortamında sakla. Yeni ayarlarla uygulamayı dağıt.
4. Aynı bot ve ortam değerlerini yerel, Git dışında tutulan `.env.local` dosyasına gir. Proje kökünde `node --env-file=.env.local scripts/register-telegram-webhook.mjs` çalıştır. Betik bot kimliğini, grup iznini ve Telegram’a kaydedilen webhook adresini kontrol eder. Her bot aynı anda tek webhook kullanır. Test ortamına ayrı bot tanımla. [Webhook kaydı](https://core.telegram.org/bots/api#setwebhook)
5. Supabase’de **Cron**, **Vault** ve **pg_net** uzantılarını etkinleştir. Vault ekranında `telegram_dispatch_url` adlı sırra uygulamanın tam `https://…/api/telegram/dispatch` adresini, `telegram_dispatch_secret` adlı sırra Vercel’deki aynı gönderim anahtarını gir. SQL Editor’da aşağıdaki görevi kaydet. Aynı adla tekrar çalıştırmak görevi günceller. [Supabase zamanlanmış HTTP çağrıları](https://supabase.com/docs/guides/functions/schedule-functions)

```sql
select cron.schedule('telegram-group-delivery', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_dispatch_url'),
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_dispatch_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 55000
  );
$job$);
```

## Kabul kontrolü ve sorun giderme

- İki deneme evi ve ayrı özel gruplar bağla. İlk eve bir harcama kaydet ve sonraki Cron çalışmasında yalnızca o gruba bildirim geldiğini doğrula. Ödeme ve dönem kapanışını da dene. Mesajdaki düğmenin doğru evin panosunu açtığını kontrol et.
- Üye hesabından davet al. Yönetim düğmelerini yalnızca ev sahibi görür. Yanlış ve süresi dolmuş kodları, kurulumu iptal etmeyi ve bağlantı kaldırıldıktan sonra yeni harcama eklemeyi dene.
- **Kod gelmediğinde** botun grupta yönetici ve kullanıcı davet etme iznine sahip olduğunu kontrol et. Özel grupta kendi yönetici kimliğini kullan. Uygulamada durumu yenile. On dakika geçtiyse kurulumu yeniden başlat. Webhook adresinin dışarıdan erişilebilir olması gerekir.
- **Davet açılmıyorsa** yeni bir bağlantı oluştur. Botun davet iznini kontrol et. Davet bağlantısı beş dakika boyunca taşınabilir. Bağlantıyı alan başka biri de kullanabileceği için paylaşma.
- **Bildirim gelmiyorsa** önce grup sohbetini aç. Mesaj sohbette varsa telefonun sessiz modunu ve Telegram bildirim ayarlarını kontrol et. Mesaj yoksa Cron geçmişini ve `net._http_response` içindeki HTTP durumunu incele. 403 gönderim anahtarını, 503 kuyruk veya veritabanı bağlantısını kontrol etmen gerektiğini gösterir.
- Geçici hatalarda gönderim en çok 12 kez denenir. Kalıcı hatalar veya tükenen denemeler `telegram_outbox.failed` alanına işlenir ve ev sahibi ayarlarda uyarı görür. İzin sorununu giderdikten sonra ilgili evin belirli işi için SQL Editor’da `update public.telegram_outbox set failed=false, attempts=0, available_at=now() where id=<iş_numarası> and failed;` çalıştırabilirsin.
- Hizmeti durdurmak için Cron görevini duraklat. Tek ev için uygulamadaki bağlantıyı kaldır. Bot token’ı yenilendiğinde Vercel ortamını güncelle, tekrar dağıt ve webhook betiğini yeniden çalıştır.
- Başarılı teslimden sonra kuyruk kaydı silinir. Bağlantı kaldırılırken Telegram’a ulaşmış veya gönderimi başlamış bir mesaj grupta görünebilir.
- Tarayıcıdaki **Start Bot** düğmesi grup seçimini açmazsa Ev Hesap’a dön. **Telegram Web ile bağla** bölümünü kullan. Botu özel grubuna ekleyip kullanıcı davet etme izni olan yönetici yap. **Komutu kopyala** düğmesiyle aldığın komutu özel grubunun sohbetine gönder. Kurulum süresi dolmuşsa yeni kurulum başlat.
