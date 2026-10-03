# STAR // DİJİTAL ODA

star'ın kişisel sitesi: brutalism + eskiz + cybercore + graffiti + 8-bit.
Saf HTML/CSS/JS, derleme adımı yok — GitHub'a push et, yayında.

## İçinde neler var

| Bölüm | Ne yapıyor |
|---|---|
| **REAL ↔ DRUG mod** | Üstteki hap düğmesi. DRUG: siyah zemin, glitch, RGB kayması, renk döngüsü, GIF avatar. |
| **TR / EN** | Tüm metinler iki dilli; seçim tarayıcıda hatırlanır. |
| **Projeler** | UltraTurk + 2048 AI LAB kartları; altında GitHub API'den otomatik repo listesi. |
| **Envanter** | RPG envanteri: karakter kartı + XP, yetenek haritası (radar), "kuşanılanlar" (her sınıfın en iyisi), kategori sekmeleri, LV/A–Z sıralama, nadirlik renkleri (SIRADAN → EFSANEVİ), detay paneli. Puanları Kontrol Odası'ndan verirsin; puanlanmamışlar gri görünür. |
| **Oyun rafı** | Gerçek DVD kutuları: Steam'in dikey kutu kapağı (yoksa tasarlanmış kapak), sırt, parlama, durum etiketi. Üstüne gelince kalkar; tıklayınca kutu dönerek öne gelir, disk dışarı kayar; **ÇEVİR** ile arka kapakta tüm bilgiler ve notun. Sürükleyerek döndürülür; <kbd>Esc</kbd> kapat, <kbd>Boşluk</kbd> çevir, <kbd>←</kbd> <kbd>→</kbd> gez. |
| **Müzik** | Taşınabilir MP3 çalar + kitaplık + spektrum. Her şarkının **Spotify 30 sn önizlemesini** kendi çalarımızla çalar: ses ayarı her cihazda çalışır (VOL / − / + / ses çubuğu, klavyeyle de, iPhone dahil), spektrum gerçek sesten çizilir. Şarkının tamamı için "Spotify'da dinle" linki. | Görselleştirici: albüm kapağıyla dönen plak, frekans halkası, osiloskop dalgası, vuruşta şok dalgası + parçacık, VU metre ve tahmini BPM; renkler kapaktan gelir, plağa tıklayınca çalar.
| **FX** | Açılış ekranı, yumuşak kaydırma, beliren bölümler, harf harf başlıklar, 3B eğilen kartlar, mıknatıslı tuşlar, imleç köşeleri, piksel mod geçişi. Hero'daki **FX: TAM / AZ** anahtarıyla kapatılabilir. |
| **Duvar** | Herkesin ortak sprey duvarı: canlı imleçler, damlayan boya, her pazartesi 00:00'da buff, arşiv. |
| **Defter** | Ziyaretçi notları, gerçek zamanlı. |
| **Gizli terminal** | <kbd>`</kbd> tuşu (1'in solundaki tuş). `help` yaz. |
| **Sayfayı Yok Et** | Gizli. Nasıl açıldığı en alttaki "Gizli şeyler" bölümünde — sitede hiçbir yerde yazmıyor. |
| **Kontrol Odası** | Terminalde `login`. Şarkı/oyun ara-ekle, yetenek puanla, duvar/defter/skor moderasyonu. |
| **Footer** | Veda ekranı: kayan şerit, imlece tepki veren dev BYE, arcade "DEVAM?" geri sayımı (0'da OYUN BİTTİ → JETON AT), piksel piksel çizilen gece odası (lamba, monitör, hoparlör, pencere, kedi, EXIT kapısı tıklanabilir), site haritası, canlı oda durumu (İstanbul saati, çalan şarkı, oyun, duvar, defter). |
| **Gizlilik + çerezler** | `gizlilik.html` (KVKK aydınlatma metni + gizlilik politikası, TR/EN) ve KVKK/GDPR'a uygun çerez onayı: Tümünü kabul et / Sadece zorunlu / Tercihleri yönet; kategoriler Zorunlu · Fonksiyonel · Analitik · Pazarlama. Footer'daki **Çerez Tercihleri** ile her an değiştirilir. |

Supabase ayarlanmadan da site çalışır: içerik `data/*.json`'dan gelir; duvar, defter ve skor tablosu sadece ziyaretçinin kendi tarayıcısında tutulur.

## Klasörler

```
index.html          ana sayfa
gizlilik.html       gizlilik politikası + KVKK aydınlatma metni (TR/EN)
404.html            bulunamayan sayfalar (GitHub Pages gerçek HTTP 404 ile sunar)
robots.txt          arama motorları (her şey açık, yönetim parametreleri kapalı)
sitemap.xml         site haritası
css/style.css       tema + tüm bölümler
css/game.css        oyun katmanı (oyun açılınca yüklenir)
css/admin.css       kontrol odası (açılınca yüklenir)
js/config.js        ← AYARLAR (Supabase adresi/anahtarı burada)
js/head.js          sayfa çizilmeden önce dil/mod/hareket ayarı (CSP yüzünden ayrı dosya)
js/main.js          her şeyi başlatır
js/consent.js       çerez / depolama izni (banner + tercih penceresi)
js/fx.js            animasyon sistemi (GSAP + ScrollTrigger + SplitText + Lenis, CDN)
js/sections/*.js    bölümler
js/game/game.js     Sayfayı Yok Et
js/admin.js         Kontrol Odası
data/*.json         Supabase yokken kullanılan içerik
supabase/           veritabanı şeması, başlangıç verisi, migration'lar, Edge Function'lar
assets/             avatarlar, UltraTurk logosu, favicon
assets/fonts/       yazı tipleri (siteden yüklenir, Google'a istek gitmez; OFL lisanslı)
```

## Yerelde çalıştırma

```bash
python -m http.server 8080
```

Sonra tarayıcıda `http://localhost:8080`. (Dosyayı çift tıklayıp açma: ES modülleri `file://` üzerinde çalışmaz.)

## Güncellemeleri yayınlama (tek tık)

Klasördeki **`yayinla.bat`** dosyasına çift tıkla: değişen dosyaları gösterir, kısa bir not ister, commit edip GitHub'a gönderir; site 1-2 dakikada güncellenir.
- GitHub'da senin bilgisayarında olmayan bir değişiklik varsa önce onu alır.
- `js/config.js` içinde gizli `service_role` anahtarı ya da `.env` gibi gizli dosyalar varsa göndermeyi durdurur.
- Denemek için terminalden: `.\yayinla.ps1 -Kuru` (hiçbir şey göndermeden ne yapacağını gösterir).

## GitHub Pages'e yayınlama (ilk kurulum)

1. GitHub'da **`StarWWW.github.io`** adında public bir repo aç (adı tam olarak bu olmalı).
2. Bu klasörü o repoya push et:
   ```bash
   git init
   git add .
   git commit -m "dijital oda"
   git branch -M main
   git remote add origin https://github.com/StarWWW/StarWWW.github.io.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main` / `(root)`.
4. Bir iki dakika sonra site `https://starwww.github.io` adresinde.

## Supabase kurulumu (duvar, defter, skor, Kontrol Odası)

### 1. Proje
supabase.com → **New project**. Bölge olarak Frankfurt (eu-central-1) Türkiye'ye en yakını.

### 2. Veritabanı
**SQL Editor → New query**:
1. `supabase/schema.sql` dosyasının tamamını yapıştır → **Run**.
2. Yeni bir sorguda `supabase/seed.sql` → **Run** (başlangıç şarkıları, oyunları ve 43 yetenek; sadece bir kez).
3. Yeni bir sorguda `supabase/migrations/002_spotify.sql` → **Run** (Spotify sütunları; mevcut şarkıları Spotify'a bağlar).
4. Yeni bir sorguda `supabase/migrations/003_kutu_kapak.sql` → **Run** (oyunlara `box_url` = DVD kutu kapağı; eski iTunes önizlemelerini temizler, çalar sadece Spotify önizlemesi çalar).

Daha önce kurduysan sadece henüz çalıştırmadığın migration'ları çalıştır (002, 003). İkisi de tekrar çalıştırılabilir, bir şey bozmaz.

### 3. Siteyi bağla
**Project Settings → API**: `Project URL` ve `anon public` anahtarını `js/config.js` içine yaz:

```js
supabaseUrl: 'https://xxxxxxxx.supabase.co',
supabaseAnonKey: 'eyJhbGciOi...',
```

> `anon` anahtarı herkese açık olacak şekilde tasarlanmıştır, repoya koymak sorun değil. Yazma izinlerini veritabanındaki güvenlik kuralları (RLS) korur. **`service_role` anahtarını asla buraya koyma.**

### 4. GitHub ile giriş
1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   - Homepage URL: `https://starwww.github.io`
   - Authorization callback URL: `https://xxxxxxxx.supabase.co/auth/v1/callback`
2. Oluşan **Client ID** ve yeni bir **Client secret**'ı Supabase → **Authentication → Sign In / Providers → GitHub**'a yapıştır, etkinleştir.
3. Supabase → **Authentication → URL Configuration** (bunu atlarsan GitHub'dan sonra `localhost:3000`'e düşersin — Site URL'nin varsayılan değeri o):
   - Site URL: `https://starwww.github.io`
   - Redirect URLs: `https://starwww.github.io/**` ve `http://localhost:8080/**`
   - **Save**'e basmayı unutma.

### 5. Kendini yönetici yap
Sitede terminali aç (<kbd>`</kbd>), `login` yaz, GitHub ile gir. "YETKİN YOK" ekranında sana özel bir SQL satırı çıkar:

```sql
insert into public.admins (user_id) values ('...senin-kimliğin...');
```

Onu SQL Editor'da çalıştır, sayfayı yenile, tekrar `login`. Artık Kontrol Odası açık. Başka hiç kimse içeriği değiştiremez.

### 6. Oyun araması (RAWG + Steam)
1. https://rawg.io/apidocs → ücretsiz hesap → API anahtarını al.
2. Supabase → **Edge Functions → Deploy a new function → Via Editor**
   - İsim: **`game-search`**
   - İçerik: `supabase/functions/game-search/index.ts` dosyasının tamamı → **Deploy**.
3. Supabase → **Edge Functions → Secrets** → `RAWG_KEY` = anahtarın.

(Supabase CLI kullanıyorsan: `supabase functions deploy game-search` ve `supabase secrets set RAWG_KEY=...`)

Fonksiyon sadece yöneticiler tarafından çağrılabilir; anahtar sitede görünmez.

### 7. Spotify (şarkı ekleme)
1. Supabase → **Edge Functions → Deploy a new function → Via Editor**
   - İsim: **`spotify`**
   - İçerik: `supabase/functions/spotify/index.ts` dosyasının tamamı → **Deploy**.
2. Bu kadarıyla Kontrol Odası'nda **Spotify şarkı linkini yapıştırarak** ekleyebilirsin (Spotify uygulamasında şarkı → Paylaş → Şarkı bağlantısını kopyala). Albüm, parça no, yıl, tür, süre ve kapak otomatik gelir. Anahtar gerekmez.
3. **Aramak** için (isteğe bağlı): https://developer.spotify.com/dashboard → **Create app** (Redirect URI: `https://starwww.github.io`, API: *Web API*). Client ID ve Client secret'ı Supabase → **Edge Functions → Secrets**'a `SPOTIFY_CLIENT_ID` ve `SPOTIFY_CLIENT_SECRET` olarak ekle.
   > Spotify, Şubat 2026'dan beri geliştirici uygulamaları için **uygulama sahibinin Premium olmasını** şart koşuyor ve aramaları 10 sonuçla sınırlıyor. Premium yoksa link yapıştırma yolu her zaman çalışır.

**Sitedeki çalar ne çalar?** Spotify'ın gömülü çalarında ses ayarı yoktur ve bir web sayfası başka bir sitenin çalarının sesini değiştiremez. Bu yüzden çalar her şarkının Spotify'daki **30 saniyelik önizlemesini** kendi çalarıyla çalar; ses düğmeleri bu sayede çalışır. Şarkının tamamı için her yerde "Spotify'da dinle" linki var.

**Önizlemeler nereden gelir?** Kontrol Odası'ndan eklerken otomatik kaydedilir. Önizlemesi kayıtlı olmayan eski şarkılar için `spotify` fonksiyonu, şarkı ilk çalındığında (ya da müzik bölümü ilk açıldığında) önizleme adresini bulup veritabanına yazar — her şarkı için bir kez. Bunun için fonksiyonun **son halini** yüklemiş olman yeterli (yukarıdaki adım 1'i güncel dosyayla tekrarla). Kontrol Odası'nda her şarkının yanında **▶ 30SN / 30SN ? / 30SN ✕** görünür; **ÖNİZLEMELERİ GETİR** hepsini birden alır. Spotify'ın önizleme vermediği nadir şarkılarda çalar "önizleme yok" der ve Spotify linkini gösterir.

### 8. Eski duvarları temizle (gizlilik politikası bunu vaat ediyor)
Duvar her pazartesi 00:00'da ya da Kontrol Odası'ndan **ŞİMDİ BUFF'LA** dediğinde boşalır; her buff ayrı bir duvar olarak **arşive** düşer (son 8 hafta). Gizlilik politikası "12 haftadan eski çizimler silinir" diyor, bunu otomatikleştirmek için bir kez:
1. Supabase → **Database → Extensions** → `pg_cron`'u aç.
2. SQL Editor'da çalıştır:
   ```sql
   select cron.schedule('duvar-temizlik', '0 4 * * 1', $$ delete from public.wall_strokes where created_at < now() - interval '12 weeks' $$);
   ```

## İçerik güncelleme

- **Şarkı ekle:** `login` → *Müzik Ekle* → Spotify'da ara (ya da linki yapıştır) → **+ EKLE**. Süre, albüm, parça no, yıl, tür, kapak ve 30 sn önizleme otomatik gelir.
- **Oyun ekle:** *Oyun Ekle* → ara → **SEÇ** → durumu, notu, kutu rengini seç → **RAFA KOY**. Geliştirici, yayıncı, çıkış tarihi, tür, platform, kapak ve DVD kutu kapağı otomatik gelir.
- **Oyun düzenle:** raf listesinde **NOT** (kutunun arkasındaki not), **KAPAK** (kutu kapağı resmi; boş = Steam kapağı ya da tasarlanmış kapak), durum ve "ŞU AN".
- **Yetenek puanla:** *Yetenekler* → kaydırıcılar → **KAYDET**.
- **Moderasyon:** *Duvar + Defter* → duvarda bir çizgiye tıkla → **SEÇİLİYİ SİL**; not ve skor silme; **ŞİMDİ BUFF'LA**.
- **Projeler:** kartlar `index.html` içinde (`<!-- 02 PROJELER -->`). 2048 AI LAB kartında "kaynak kodu ve canlı demo yakında" yazıyor — linkler hazır olunca o satırı (`g2048-soon`) gerçek bağlantılarla değiştir. Repo listesinde gizlemek istediklerini `data/projects.json` → `hideRepos`'a yaz.

## Gizlilik, çerezler ve KVKK

- **Çerez onayı** (`js/consent.js`): ilk ziyarette banner çıkar. İzin verilmeden sadece zorunlu kayıtlar (izin kaydı, animasyon tercihi, spam önleme kimliği) tarayıcıya yazılır; dil, ses seviyesi, sprey rengi, oyun skorları gibi fonksiyonel kayıtlar izin yoksa sadece o sekmede tutulur. İzin geri çekilince bu kayıtlar silinir. Seçim 12 ayda bir yeniden sorulur.
- **Analitik / pazarlama:** şu an yok. İleride eklersen izinsiz çalışmaması için betiği şöyle koy:
  ```html
  <script type="text/plain" data-consent="analytics" data-src="https://analitik-araci.com/script.js"></script>
  ```
  İzin verildiği anda yüklenir. Ekledikten sonra `gizlilik.html` ve CSP'deki adresleri güncellemeyi unutma.
- **Gizlilik politikası** (`gizlilik.html`): sitedeki gerçek veri akışına göre yazıldı (defter, duvar, skor, Kontrol Odası, Supabase/GitHub/jsDelivr/Spotify/Steam). Yeni bir hizmet ya da veri eklersen burayı da güncelle. Çerez tabloları `consent.js`'ten otomatik üretilir.
- Not: metin özenle hazırlandı ama hukuki danışmanlık yerine geçmez. Veri sorumlusu olarak takma adın kullanılıyor; KVKK açısından daha sağlam olsun istersen gerçek adını ve bir iletişim e-postasını `gizlilik.html` → 01. bölüme ekleyebilirsin.

## Güvenlik

- **Content-Security-Policy** her sayfada `<meta>` olarak var: betikler sadece siteden ve jsDelivr'dan, bağlantılar sadece Supabase ve GitHub API'ye, ses sadece Spotify'ın önizleme sunucusundan. Yeni bir dış hizmet eklersen `index.html`'deki CSP satırına adresini ekle, yoksa tarayıcı engeller (konsolda "Refused to..." görürsün).
- CDN betiklerinde **SRI** (integrity) var: GSAP/Lenis sürümünü değiştirirsen hash'leri de güncellemen gerekir.
- `Referrer-Policy: strict-origin-when-cross-origin` (meta). HSTS'yi GitHub Pages kendisi gönderiyor.
- GitHub Pages özel HTTP başlığına izin vermez: `X-Content-Type-Options`, `Permissions-Policy` ve tıklama tuzağı koruması (`frame-ancestors`) meta ile verilemez. Bunları da istersen siteyi Cloudflare gibi bir proxy arkasına alıp başlıkları orada ekleyebilirsin.
- Kullanıcıdan gelen her metin (defter, skor adı) ekrana `esc()` ile basılır; veritabanında uzunluk/biçim kuralları ve hız sınırları var; yazma izinleri RLS ile korunur. Sitede gizli anahtar yok (`yayinla.ps1` `service_role` anahtarını yakalarsa göndermeyi durdurur).
- Test kancaları (`?debug`, `__mount`) sadece `localhost`/`127.0.0.1`'de çalışır.

## SEO ve performans

- `robots.txt` her şeyi açar, `?admin` / `?debug` parametrelerini kapatır; `sitemap.xml`'deki `lastmod` tarihlerini büyük güncellemelerde değiştir.
- Yazı tipleri `assets/fonts/`'tan yüklenir (Latin + Türkçe alt kümeler), ana fontlar önceden yüklenir (preload). DRUG avatarı 384 KB GIF yerine 39 KB animasyonlu WebP ve sadece DRUG moduna geçince indirilir. Kapak görselleri tembel yüklenir (lazy).
- Veri çekmede zaman aşımı var: Supabase ya da GitHub yanıt vermezse bölümler `data/*.json` yedeğine düşer, "yükleniyor"da takılı kalmaz.

## Gizli şeyler

**Terminal komutları:** `help`, `whoami`, `ls`, `ls projects`, `cat about.txt`, `cat cow.txt`, `cat .secret.txt`, `cd duvar`, `games`, `music`, `play 2`, `pause`, `next`, `vol 5`, `vol mute`, `spray`, `drug`, `real`, `lang en`, `cowsay merhaba`, `github`, `discord`, `sudo rm -rf /`, `login`, `logout`. <kbd>Tab</kbd> tamamlar, <kbd>↑</kbd>/<kbd>↓</kbd> geçmiş.

**Sayfayı Yok Et** (sitede hiçbir yerde yazmıyor, `help`'te de yok):
- Açmanın yolları: klavyede <kbd>↑↑↓↓←→←→BA</kbd>, terminalde `destroy` (ya da `yoket`), mobilde hero'daki pembe **LVL 21** çıkartmasına art arda 5 kez dokun. İpucu sadece terminaldeki `.secret.txt` dosyasında.
- <kbd>WASD</kbd> uç, fare nişan, sol tık ateş, <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> (ya da tekerlek) silah, <kbd>Shift</kbd> atıl, <kbd>Esc</kbd> bitir.
- Silahlar: **sprey bombası** (sınırsız, boya sıçratır), **glitch bombası** (3 hak, zincirleme patlar), **piksel çekiç** (yakın dövüş; atılırken çift hasar).
- Kırılan şeylerden **bug**'lar çıkar; **MERGE CONFLICT** öldürülünce ikiye bölünür.
- Sayfanın %80'i yıkılınca **404.html** boss'u uyanır.
- **Stil metresi** (aynı hareketi tekrarlamak daha az puan verir): D DOODLE → C CRASH → B BRUTAL → A ANARŞİ → S SPREY → SS SSEGFAULT → SSS SSSUDO → ???
- 12 başarım, online skor tablosu (3 harfli arcade adı), çıkınca VHS geri sarma.

**DRUG modunun sırları** (`js/drug.js`; sadece hap yutulunca çalışır, terminalde `trip` bulunanları ve ipuçlarını listeler):
- Her zaman: gökkuşağı imleç izi, hızlı kaydırınca eriyen sayfa, kayan şeritte gizli mesajlar, müzik çalarken sayfanın basla nefes alması.
- 14 sır: ekranda gezen halüsinasyon böceklerini yakala (1 ve 5 böcek), klavyede `uyan` (kod yağmuru), `dans`, `ters` (ters dünya), `asit` (bunlar terminalde de çalışır), avatara 3 tık (üçüncü göz), Shift'i 2 sn basılı tut (negatif), logoya 7 tık, 25 sn hiçbir şey yapma (erime), bir bölüm başlığına çift tık (patlama), footer odasında pencereye (UFO) ve kediye (uçan kedi) tıkla, müzik çalarken DRUG'da kal (senkron). Hepsi bulununca başlık kalıcı olarak gökkuşağı olur.

## Animasyonlar (FX)

- İşletim sisteminde "hareketi azalt" açıksa (Windows: *Ayarlar → Erişilebilirlik → Görsel efektler → Animasyon efektleri* kapalı) site **FX: AZ** modunda açılır: süs döngüleri ve büyük hareketler durur, tuş geri bildirimleri kalır. İlk açılışta "TAM HAREKET" düğmeli bir bildirim çıkar.
- Hero'daki **FX** anahtarı, footer'daki **FX** düğmesi ya da terminalde `fx tam` / `fx az` ile değiştirilir; seçim tarayıcıda hatırlanır.
- Açılış ekranı oturum başına bir kez görünür; tıklayınca ya da bir tuşa basınca atlanır.
- Kütüphaneler (GSAP, ScrollTrigger, SplitText, Lenis) jsDelivr'dan gelir; yüklenemezlerse site animasyonsuz ama eksiksiz çalışır.

## Notlar

- Fontlar Google Fonts'tan: Archivo, Silkscreen, VT323, Rubik Wet Paint, Rubik Glitch, Caveat.
- Palet: DawnBringer 32.
- UltraTurk logosu Horyu (@horyu_dub) tasarımıdır.
