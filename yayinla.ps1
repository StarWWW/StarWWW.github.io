# STAR // DİJİTAL ODA — tek tıkla yayınla
# Kullanım: yayinla.bat dosyasına çift tıkla.
# Seçenekler (terminalden): .\yayinla.ps1 -Mesaj "not" | -Kuru (hiçbir şey göndermeden ne olacağını gösterir) | -Sessiz (soru sormaz)
param(
  [string]$Mesaj = '',
  [switch]$Kuru,
  [switch]$Sessiz
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
