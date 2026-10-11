# STAR // DİJİTAL ODA — tek tıkla yayınla
# Kullanım: yayinla.bat dosyasına çift tıkla.
# Seçenekler (terminalden): .\yayinla.ps1 -Mesaj "not" | -Kuru (hiçbir şey göndermeden ne olacağını gösterir) | -Sessiz (soru sormaz)
#                           | -Damga (sadece sürüm damgasını yeniler; commit / push yok)
param(
  [string]$Mesaj = '',
  [switch]$Kuru,
  [switch]$Sessiz,
  [switch]$Damga
)

$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$SITE = 'https://starwww.dev'

function Yaz([string]$metin, [string]$renk = 'Gray') { Write-Host $metin -ForegroundColor $renk }
function Sor([string]$soru) { if ($Sessiz) { return '' } return Read-Host $soru }
function Bitir([int]$kod) {
  Write-Host ''
  if (-not $Sessiz) { Read-Host 'Kapatmak için Enter' | Out-Null }
  exit $kod
}

$UTF8 = New-Object System.Text.UTF8Encoding $false
$SHA = [System.Security.Cryptography.SHA256]::Create()
function Oku([string]$yol) { return [IO.File]::ReadAllText((Join-Path $PSScriptRoot $yol), [Text.Encoding]::UTF8) }
function Yazdir([string]$yol, [string]$metin) { [IO.File]::WriteAllText((Join-Path $PSScriptRoot $yol), $metin, $UTF8) }

# ---------- JS sözdizimi kontrolü ----------
# Bozuk tek bir JS dosyası yayına çıkarsa site açılmaz. Node.js varsa göndermeden önce hepsi derlenir.
function JsKontrol {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Yaz 'Node.js bulunamadı; JS sözdizimi kontrolü atlandı (https://nodejs.org).' DarkYellow
    return $true
  }
  $hatali = @()
  Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'js'), (Join-Path $PSScriptRoot '2048') -Recurse -File -Filter '*.js' |
    Where-Object { $_.FullName -notmatch '[\\/]vendor[\\/]' } |
    ForEach-Object {
      $cikti = (& node --check $_.FullName 2>&1 | ForEach-Object { "$_" } |
        Where-Object { $_.Trim() -and $_ -notmatch '^System\.Management\.Automation\.' -and $_ -notmatch '^\s+at ' }) -join "`n"
      if ($LASTEXITCODE -ne 0) { $hatali += "$($_.FullName.Substring($PSScriptRoot.Length + 1))`n$cikti" }
    }
  if ($hatali) {
    Yaz 'DUR! Şu JS dosyalarında sözdizimi hatası var, hiçbir şey gönderilmedi:' Red
    $hatali | ForEach-Object { Yaz $_ Red }
    return $false
  }
  return $true
}

# ---------- sürüm damgası ----------
# GitHub Pages dosyaları 10 dk önbellekte tutar; yayından hemen sonra tarayıcı eski ve yeni dosyaları karıştırabilir.
# Her JS/CSS dosyasının içerik özeti adrese ?v=... olarak eklenir: değişen dosya taze iner, değişmeyen önbellekten gelir.
# Modüller birbirini import map üzerinden aynı sürümle çağırır. Satır içi import map'e CSP izin vermez, o yüzden
# haritanın SHA-256 parmak izi script-src'ye yazılır (harita tek satır: Windows satır sonları parmak izini bozmasın).
$KLASIK = @('js/head.js', 'js/notfound.js', 'js/vendor/gsap.min.js', 'js/vendor/ScrollTrigger.min.js', 'js/vendor/SplitText.min.js', 'js/vendor/lenis.min.js')
function Ozet([string]$yol) {
  $b = $SHA.ComputeHash($UTF8.GetBytes((Oku $yol).Replace("`r`n", "`n")))
  return (($b[0..3] | ForEach-Object { $_.ToString('x2') }) -join '')
}
function Damgala([bool]$yaz) {
  $ozet = @{}
  Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'js'), (Join-Path $PSScriptRoot 'css'), (Join-Path $PSScriptRoot '2048/js'), (Join-Path $PSScriptRoot '2048/css') -Recurse -File |
    Where-Object { $_.Extension -eq '.js' -or $_.Extension -eq '.css' } |
    ForEach-Object {
      $rel = $_.FullName.Substring($PSScriptRoot.Length + 1).Replace('\', '/')
      $ozet[$rel] = Ozet $rel
    }
  $girdi = $ozet.Keys | Where-Object { $KLASIK -notcontains $_ } | Sort-Object -CaseSensitive |
    ForEach-Object { '"/' + $_ + '":"/' + $_ + '?v=' + $ozet[$_] + '"' }
  $harita = '{"imports":{' + ($girdi -join ',') + '}}'
  $iz = "'sha256-" + [Convert]::ToBase64String($SHA.ComputeHash($UTF8.GetBytes($harita))) + "'"
  $adres = [System.Text.RegularExpressions.MatchEvaluator] {
    param($m)
    $f = $m.Groups[3].Value
    if ($ozet.ContainsKey($f)) { return $m.Groups[1].Value + $m.Groups[2].Value + $f + '?v=' + $ozet[$f] + '"' }
    return $m.Value
  }.GetNewClosure()
  $degisen = @()
  foreach ($sayfa in @('index.html', 'gizlilik.html', '404.html', '2048/index.html')) {
    $eski = Oku $sayfa
    $yeni = [regex]::Replace($eski, '(\s(?:src|href)=")(/?)((?:2048/)?(?:js|css)/[^"?#]+\.(?:js|css))(?:\?v=[0-9a-f]+)?"', $adres)
    if ($yeni -match '<script type="importmap">') {
      $yeni = [regex]::Replace($yeni, '<script type="importmap">[^<]*</script>', { param($m) '<script type="importmap">' + $harita + '</script>' }.GetNewClosure())
      $yeni = [regex]::Replace($yeni, "script-src 'self'( 'sha256-[A-Za-z0-9+/=]+')?", { param($m) "script-src 'self' $iz" }.GetNewClosure())
    }
    if ($yeni -cne $eski) {
      $degisen += $sayfa
      if ($yaz) { Yazdir $sayfa $yeni }
    }
  }
  return $degisen
}

# ---------- sitemap tarihi ----------
# Değişen sayfanın <lastmod>'u bugünün tarihi olur
function SitemapGuncelle([bool]$yaz) {
  $sayfalar = @{ "$SITE/" = 'index.html'; "$SITE/gizlilik.html" = 'gizlilik.html'; "$SITE/2048/" = '2048/index.html' }
  $degisenler = @(git -c core.quotepath=off diff --name-only HEAD 2>$null)
  $bugun = Get-Date -Format 'yyyy-MM-dd'
  $eski = Oku 'sitemap.xml'
  $yeni = [regex]::Replace($eski, '(<loc>([^<]+)</loc>\s*<lastmod>)[^<]*(</lastmod>)', {
    param($m)
    $dosya = $sayfalar[$m.Groups[2].Value]
    if ($dosya -and ($degisenler -contains $dosya)) { return $m.Groups[1].Value + $bugun + $m.Groups[3].Value }
    return $m.Value
  }.GetNewClosure())
  if ($yeni -cne $eski -and $yaz) { Yazdir 'sitemap.xml' $yeni }
  return ($yeni -cne $eski)
}

Write-Host ''
Yaz '  ███ STAR // DİJİTAL ODA — YAYINLA ███' Green
if ($Kuru) { Yaz '  (kuru çalışma: hiçbir şey commit edilmeyecek ya da gönderilmeyecek)' DarkYellow }
Write-Host ''

# ---------- ön kontroller ----------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Yaz 'Git bulunamadı. https://git-scm.com/download/win adresinden kurup tekrar dene.' Red
  Bitir 1
}
if (-not (Test-Path -LiteralPath '.git')) {
  Yaz 'Bu klasör bir git deposu değil. Betik, sitenin ana klasöründe durmalı.' Red
  Bitir 1
}

$dal = (git rev-parse --abbrev-ref HEAD).Trim()
if ($dal -eq 'HEAD') { Yaz 'Git şu an bir dalda değil (detached HEAD). Önce: git checkout main' Red; Bitir 1 }

# Yarım kalmış bir rebase/merge varsa dokunma
if ((Test-Path '.git/rebase-merge') -or (Test-Path '.git/rebase-apply') -or (Test-Path '.git/MERGE_HEAD')) {
  Yaz 'Yarım kalmış bir birleştirme var. Önce onu bitir ya da iptal et (git rebase --abort / git merge --abort).' Red
  Bitir 1
}

# Bozuk JS yayına çıkmasın, sonra dosya adreslerine sürüm damgası
if (-not (JsKontrol)) { Bitir 1 }
$damgali = @(Damgala (-not $Kuru))
if ($damgali) {
  if ($Kuru) { Yaz "[kuru] sürüm damgası yenilenecek: $($damgali -join ', ')" DarkYellow }
  else { Yaz "Sürüm damgası yenilendi: $($damgali -join ', ')" DarkGray }
}
if ($Damga) { Yaz 'Sürüm damgası güncel. (Commit / push yapılmadı.)' Green; Bitir 0 }
if (SitemapGuncelle (-not $Kuru)) {
  if ($Kuru) { Yaz '[kuru] sitemap.xml tarihi güncellenecek' DarkYellow } else { Yaz 'sitemap.xml tarihi güncellendi' DarkGray }
}

# Güvenlik: gönderilecek dosyalarda gizli anahtar olmasın
# (Supabase service_role / sb_secret anahtarı, özel anahtar dosyası, GitHub token'ı)
$adaylar = @(git -c core.quotepath=off diff --name-only HEAD 2>$null) + @(git -c core.quotepath=off ls-files --others --exclude-standard)
$sizinti = @()
foreach ($dosya in ($adaylar | Where-Object { $_ } | Sort-Object -Unique)) {
  if ($dosya -match '^(assets/|js/vendor/)' -or -not (Test-Path -LiteralPath $dosya -PathType Leaf)) { continue }
  if ((Get-Item -LiteralPath $dosya).Length -gt 2MB) { continue }
  $icerik = Get-Content -LiteralPath $dosya -Raw -Encoding UTF8
  if (-not $icerik) { continue }
  if ($icerik -cmatch 'sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}') { $sizinti += $dosya; continue }
  foreach ($m in [regex]::Matches($icerik, 'eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+')) {
    $p = $m.Groups[1].Value.Replace('-', '+').Replace('_', '/')
    while ($p.Length % 4) { $p += '=' }
    try {
      $json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p))
      if ($json -cmatch '"role"\s*:\s*"service_role"') { $sizinti += $dosya; break }
    } catch {}
  }
}
if ($sizinti) {
  Yaz 'DUR! Şu dosyalarda GİZLİ bir anahtar var, hiçbir şey gönderilmedi:' Red
  $sizinti | ForEach-Object { Yaz "  $_" Red }
  Yaz 'Bunu yayınlarsan herkes görür. Sitede sadece Supabase > Project Settings > API kısmındaki "anon public" anahtarı olabilir.' Red
  Bitir 1
}

# Gizli dosyalar yanlışlıkla eklenmesin
$tehlikeli = git status --porcelain --untracked-files=all | Where-Object { $_ -match '(\.env($|\.)|service[_-]?role|\.pem$|\.key$|secrets?/)' }
if ($tehlikeli) {
  Yaz 'Şu dosyalar gizli bilgi içeriyor olabilir, gönderilmedi:' Red
  $tehlikeli | ForEach-Object { Yaz "  $_" Red }
  Yaz 'Gerçekten gerekiyorsa .gitignore''u kontrol et.' Red
  Bitir 1
}

# ---------- GitHub'daki son durum ----------
Yaz 'GitHub kontrol ediliyor...' DarkGray
git fetch --quiet origin $dal
$fetchOk = ($LASTEXITCODE -eq 0)
if (-not $fetchOk) { Yaz 'GitHub''a ulaşılamadı (internet bağlantını kontrol et). Yine de yerel commit yapılabilir.' DarkYellow }

# ---------- değişiklikler ----------
$degisiklik = git status --porcelain
if ($degisiklik) {
  Yaz 'Değişen dosyalar:' Yellow
  git status --short
  Write-Host ''
  if (-not $Mesaj) {
    $varsayilan = 'güncelleme ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
    $Mesaj = Sor "Ne değişti? Kısa bir not yaz (boş bırakırsan: '$varsayilan')"
    if ([string]::IsNullOrWhiteSpace($Mesaj)) { $Mesaj = $varsayilan }
  }
  if ($Kuru) {
    Yaz "[kuru] git add -A && git commit -m `"$Mesaj`"" DarkYellow
  } else {
    git add -A
    git commit --quiet -m $Mesaj
    if ($LASTEXITCODE -ne 0) { Yaz 'Commit yapılamadı (yukarıdaki hataya bak).' Red; Bitir 1 }
    Yaz "Commit: $Mesaj" Green
  }
} else {
  Yaz 'Yeni değişiklik yok.' DarkGray
}

if (-not $fetchOk) { Yaz 'GitHub''a ulaşılamadığı için gönderilmedi. İnternet gelince betiği tekrar çalıştır.' DarkYellow; Bitir 1 }

# ---------- GitHub'da senin bilgisayarında olmayan bir şey varsa önce al ----------
$geride = [int]((git rev-list --count "HEAD..origin/$dal" 2>$null) | Select-Object -First 1)
if ($geride -gt 0) {
  Yaz "GitHub'da $geride yeni commit var, önce onlar alınıyor..." Yellow
  if ($Kuru) {
    Yaz "[kuru] git pull --rebase origin $dal" DarkYellow
  } else {
    git pull --rebase --quiet origin $dal
    if ($LASTEXITCODE -ne 0) {
      git rebase --abort
      Yaz 'GitHub''daki değişikliklerle seninkiler aynı satırlarda çakışıyor; hiçbir şey kaybolmadı ama gönderilmedi.' Red
      Yaz 'Çözmek için Claude''a "push çakışması var" diyebilirsin.' Red
      Bitir 1
    }
  }
}

# ---------- gönder ----------
$ileride = [int]((git rev-list --count "origin/$dal..HEAD" 2>$null) | Select-Object -First 1)
if ($ileride -eq 0 -and -not ($Kuru -and $degisiklik)) {
  Yaz 'GitHub zaten güncel, gönderilecek bir şey yok.' Green
  Bitir 0
}

if ($Kuru) {
  $hazir = $ileride + $(if ($degisiklik) { 1 } else { 0 })
  Yaz "[kuru] git push origin $dal  ($hazir commit gönderilecek)" DarkYellow
  Bitir 0
}

Yaz "GitHub'a gönderiliyor ($ileride commit)..." DarkGray
git push --quiet origin $dal
if ($LASTEXITCODE -ne 0) {
  Yaz 'Gönderilemedi. GitHub girişi istendiyse açılan pencereden giriş yapıp betiği tekrar çalıştır.' Red
  Bitir 1
}

Write-Host ''
Yaz 'GÖNDERİLDİ ✓  Site 1-2 dakika içinde güncellenir:' Green
Yaz "  $SITE" Cyan
$ac = Sor 'Siteyi tarayıcıda açayım mı? (E/h)'
if (-not $Sessiz -and $ac -notmatch '^[hHnN]') { Start-Process $SITE }
Bitir 0
