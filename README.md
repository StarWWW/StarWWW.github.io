# STAR // DİJİTAL ODA

star'ın kişisel sitesi: brutalism + eskiz + cybercore + graffiti + 8-bit.
Saf HTML/CSS/JS, derleme adımı yok — GitHub'a push et, yayında.

## İçinde neler var

| Bölüm | Ne yapıyor |
|---|---|
| **REAL ↔ DRUG mod** | Üstteki hap düğmesi. DRUG: siyah zemin, glitch, RGB kayması, renk döngüsü, GIF avatar. |
| **TR / EN** | Tüm metinler iki dilli; seçim tarayıcıda hatırlanır. |
| **Projeler** | UltraTurk + 2048 kartları; altında GitHub API'den otomatik repo listesi. |
| **Envanter** | Yetenekler. Puanı 0 olanlar görünmez — puanları Kontrol Odası'ndan verirsin. |
| **Oyun rafı** | Kartuşlar; kapaklar otomatik 8-bit'e çevrilir, üstüne gelince tüm bilgiler. |
| **Müzik** | Taşınabilir MP3 çalar + kitaplık, **Spotify** ile. Ziyaretçi tarayıcısında Spotify'a giriş yaptıysa şarkının tamamı çalar, yapmadıysa Spotify önizleme verir. |
| **FX** | Açılış ekranı, yumuşak kaydırma, beliren bölümler, harf harf başlıklar, 3B eğilen kartlar, mıknatıslı tuşlar, imleç köşeleri, piksel mod geçişi. Hero'daki **FX: TAM / AZ** anahtarıyla kapatılabilir. |
| **Duvar** | Herkesin ortak sprey duvarı: canlı imleçler, damlayan boya, her pazartesi 00:00'da buff, arşiv. |
| **Defter** | Ziyaretçi notları, gerçek zamanlı. |
| **Gizli terminal** | <kbd>`</kbd> tuşu (1'in solundaki tuş). `help` yaz. |
| **Sayfayı Yok Et** | <kbd>↑↑↓↓←→←→BA</kbd> ya da terminalde `destroy`. Mobilde "YOK ET ?" düğmesi. |
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
supabase/           veritabanı şeması, başlangıç verisi, oyun arama fonksiyonu
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
3. Yeni bir sorguda `supabase/migrations/002_spotify.sql` → **Run** (Spotify sütunları; mevcut şarkıları Spotify'a bağlar). Daha önce kurduysan sadece bunu çalıştırman yeterli.

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

**Tam şarkı kimde çalar?** Spotify'ın kuralı: ziyaretçi aynı tarayıcıda open.spotify.com'a giriş yaptıysa embed şarkının tamamını çalar; giriş yapmadıysa (ya da tarayıcısı üçüncü taraf çerezleri engelliyorsa) Spotify kısa bir önizleme verir. Çalar bunu algılayıp "tamamı için Spotify'a giriş yap" uyarısı gösterir.

### 8. (İsteğe bağlı) Eski duvarları temizle
Duvar her pazartesi kendiliğinden boşalır (eski çizgiler arşivde görünür). Veritabanı şişmesin diye 12 haftadan eskileri silmek için `schema.sql`'in en altındaki `pg_cron` satırını kullan.

## İçerik güncelleme

- **Şarkı ekle:** `login` → *Müzik Ekle* → Spotify'da ara (ya da linki yapıştır) → **+ EKLE**. Süre, albüm, parça no, yıl, tür ve kapak otomatik gelir.
- **Oyun ekle:** *Oyun Ekle* → ara → **SEÇ** → durumu, notu, kartuş rengini seç → **RAFA KOY**. Geliştirici, yayıncı, çıkış tarihi, tür, platform ve kapak otomatik gelir.
- **Yetenek puanla:** *Yetenekler* → kaydırıcılar → **KAYDET**.
- **Moderasyon:** *Duvar + Defter* → duvarda bir çizgiye tıkla → **SEÇİLİYİ SİL**; not ve skor silme; **ŞİMDİ BUFF'LA**.
- **Projeler:** kartlar `index.html` içinde (`<!-- 02 PROJELER -->`). 2048'in linkleri şimdilik `#` — repo/demo adresi belli olunca `link2048play` ve `link2048code` id'li bağlantıları güncelle. Repo listesinde gizlemek istediklerini `data/projects.json` → `hideRepos`'a yaz.

## Gizli şeyler

**Terminal komutları:** `help`, `whoami`, `ls`, `ls projects`, `cat about.txt`, `cat cow.txt`, `cat .secret.txt`, `cd duvar`, `games`, `music`, `play 2`, `pause`, `next`, `spray`, `drug`, `real`, `lang en`, `destroy`, `cowsay merhaba`, `github`, `discord`, `sudo rm -rf /`, `login`, `logout`. <kbd>Tab</kbd> tamamlar, <kbd>↑</kbd>/<kbd>↓</kbd> geçmiş.

**Sayfayı Yok Et:**
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
