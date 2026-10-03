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
| **Müzik** | Taşınabilir MP3 çalar + kitaplık + TV. Şarkının YouTube karşılığı varsa **tamamı herkese çalar ve ses ayarlanır** (VOL / − / + / ses çubuğu, klavyeyle de); yoksa Spotify çalar (Spotify'a giriş yapan ziyaretçiye tam şarkı, yapmayana önizleme). |
| **FX** | Açılış ekranı, yumuşak kaydırma, beliren bölümler, harf harf başlıklar, 3B eğilen kartlar, mıknatıslı tuşlar, imleç köşeleri, piksel mod geçişi. Hero'daki **FX: TAM / AZ** anahtarıyla kapatılabilir. |
| **Duvar** | Herkesin ortak sprey duvarı: canlı imleçler, damlayan boya, her pazartesi 00:00'da buff, arşiv. |
| **Defter** | Ziyaretçi notları, gerçek zamanlı. |
| **Gizli terminal** | <kbd>`</kbd> tuşu (1'in solundaki tuş). `help` yaz. |
| **Sayfayı Yok Et** | Gizli. Nasıl açıldığı en alttaki "Gizli şeyler" bölümünde — sitede hiçbir yerde yazmıyor. |
| **Kontrol Odası** | Terminalde `login`. Şarkı/oyun ara-ekle, yetenek puanla, duvar/defter/skor moderasyonu. |

Supabase ayarlanmadan da site çalışır: içerik `data/*.json`'dan gelir; duvar, defter ve skor tablosu sadece ziyaretçinin kendi tarayıcısında tutulur.

## Klasörler

```
index.html          ana sayfa
404.html            bulunamayan sayfalar (boss'lu)
css/style.css       tema + tüm bölümler
css/game.css        oyun katmanı (oyun açılınca yüklenir)
css/admin.css       kontrol odası (açılınca yüklenir)
js/config.js        ← AYARLAR (Supabase adresi/anahtarı burada)
js/main.js          her şeyi başlatır
js/fx.js            animasyon sistemi (GSAP + ScrollTrigger + SplitText + Lenis, CDN)
js/sections/*.js    bölümler
js/game/game.js     Sayfayı Yok Et
js/admin.js         Kontrol Odası
data/*.json         Supabase yokken kullanılan içerik
supabase/           veritabanı şeması, başlangıç verisi, migration'lar, Edge Function'lar
assets/             avatarlar, UltraTurk logosu, favicon
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
4. Yeni bir sorguda `supabase/migrations/003_youtube_kapak.sql` → **Run** (şarkılara `youtube_id`, oyunlara `box_url` = DVD kutu kapağı).

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

**Tam şarkı kimde çalar?** Spotify'ın kuralı: ziyaretçi aynı tarayıcıda open.spotify.com'a giriş yaptıysa embed şarkının tamamını çalar; giriş yapmadıysa (ya da tarayıcısı üçüncü taraf çerezleri engelliyorsa) Spotify kısa bir önizleme verir. Spotify'ın gömülü çalarında ses ayarı da yoktur. Bu yüzden çalar önce YouTube'u dener (adım 8).

### 8. YouTube eşleştirme (tam şarkı + ses ayarı herkese)
1. Supabase → **Edge Functions → Deploy a new function → Via Editor**
   - İsim: **`youtube-match`**
   - İçerik: `supabase/functions/youtube-match/index.ts` dosyasının tamamı → **Deploy**.
2. Bu kadar. Anahtar gerekmez. Bir şarkının YouTube karşılığı yoksa, ilk çalındığında (ya da müzik bölümü ilk açıldığında) fonksiyon resmi yüklemeyi bulur ("Sanatçı - Topic" kanalı, süre uyumu; canlı/cover/remix/slowed elenir) ve veritabanına kaydeder — her şarkı en fazla bir kez aranır.
3. Kontrol Odası → *Müzik Ekle* → kitaplıkta her şarkının yanında **YT ✓ / YT ? / YT ✕** görünür. **YOUTUBE'U EŞLEŞTİR** hepsini birden arar. **YT** düğmesiyle yanlış eşleşmeyi düzeltebilir (link yapıştır), boş bırakıp yeniden aratabilir ya da `-` yazıp o şarkıda YouTube'u kapatabilirsin.
4. (İsteğe bağlı) Resmi YouTube Data API'yi kullanmak istersen Secrets'a `YOUTUBE_API_KEY` ekle; yoksa fonksiyon YouTube'un arama sayfasını okur.

YouTube videoyu o sitede oynatmayı reddederse çalar sessizce Spotify'a geçer. Not: YouTube müzik videolarını `localhost`/`127.0.0.1` üzerinde çoğu zaman oynatmaz (hata 150) — bunu yayındaki sitede dene.

### 9. (İsteğe bağlı) Eski duvarları temizle
Duvar her pazartesi kendiliğinden boşalır (eski çizgiler arşivde görünür). Veritabanı şişmesin diye 12 haftadan eskileri silmek için `schema.sql`'in en altındaki `pg_cron` satırını kullan.

## İçerik güncelleme

- **Şarkı ekle:** `login` → *Müzik Ekle* → Spotify'da ara (ya da linki yapıştır) → **+ EKLE**. Süre, albüm, parça no, yıl, tür ve kapak otomatik gelir; YouTube karşılığı arka planda bulunur.
- **Oyun ekle:** *Oyun Ekle* → ara → **SEÇ** → durumu, notu, kutu rengini seç → **RAFA KOY**. Geliştirici, yayıncı, çıkış tarihi, tür, platform, kapak ve DVD kutu kapağı otomatik gelir.
- **Oyun düzenle:** raf listesinde **NOT** (kutunun arkasındaki not), **KAPAK** (kutu kapağı resmi; boş = Steam kapağı ya da tasarlanmış kapak), durum ve "ŞU AN".
- **Yetenek puanla:** *Yetenekler* → kaydırıcılar → **KAYDET**.
- **Moderasyon:** *Duvar + Defter* → duvarda bir çizgiye tıkla → **SEÇİLİYİ SİL**; not ve skor silme; **ŞİMDİ BUFF'LA**.
- **Projeler:** kartlar `index.html` içinde (`<!-- 02 PROJELER -->`). 2048 AI LAB kartında "kaynak kodu ve canlı demo yakında" yazıyor — linkler hazır olunca o satırı (`g2048-soon`) gerçek bağlantılarla değiştir. Repo listesinde gizlemek istediklerini `data/projects.json` → `hideRepos`'a yaz.

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

## Animasyonlar (FX)

- İşletim sisteminde "hareketi azalt" açıksa (Windows: *Ayarlar → Erişilebilirlik → Görsel efektler → Animasyon efektleri* kapalı) site **FX: AZ** modunda açılır: süs döngüleri ve büyük hareketler durur, tuş geri bildirimleri kalır. İlk açılışta "TAM HAREKET" düğmeli bir bildirim çıkar.
- Hero'daki **FX** anahtarı, footer'daki **FX** düğmesi ya da terminalde `fx tam` / `fx az` ile değiştirilir; seçim tarayıcıda hatırlanır.
- Açılış ekranı oturum başına bir kez görünür; tıklayınca ya da bir tuşa basınca atlanır.
- Kütüphaneler (GSAP, ScrollTrigger, SplitText, Lenis) jsDelivr'dan gelir; yüklenemezlerse site animasyonsuz ama eksiksiz çalışır.

## Notlar

- Fontlar Google Fonts'tan: Archivo, Silkscreen, VT323, Rubik Wet Paint, Rubik Glitch, Caveat.
- Palet: DawnBringer 32.
- UltraTurk logosu Horyu (@horyu_dub) tasarımıdır.
