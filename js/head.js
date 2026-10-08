// <head>'de, sayfa çizilmeden önce çalışır (CSP satır içi betiğe izin vermediği için ayrı dosya).
// Dil ve REAL/DRUG modu "fonksiyonel" depolamadır: sadece ziyaretçi izin verdiyse hatırlanır.
// Hareket tercihi (erişilebilirlik) zorunlu sayılır.
(function () {
  var d = document.documentElement;
  // Başka bir sitenin çerçevesinde (iframe) açılmasın: görünmez çerçeveyle tıklatma tuzağına (clickjacking) karşı.
  // GitHub Pages X-Frame-Options / frame-ancestors başlığı gönderemediği için bunu betik yapar.
  if (window.top !== window.self) {
    d.style.display = 'none';
    try { window.top.location.replace(window.self.location.href); } catch (e) { /* sandbox: sayfa gizli kalır */ }
    return;
  }
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var consent = null;
  try { consent = JSON.parse(get('star.consent') || 'null'); } catch (e) { consent = null; }
  var functional = Boolean(consent && consent.v === 1 && consent.functional && Date.now() - Date.parse(consent.ts) < 365 * 86400000);
  if (functional && get('star.mode') === 'drug') d.dataset.mode = 'drug';
  if (functional && get('star.lang') === 'en') d.lang = 'en';
  // Hareket: ziyaretçinin seçimi > işletim sistemi tercihi
  var m = get('star.motion') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'full');
  d.dataset.motion = m;
  if (m === 'full' && d.dataset.boot !== 'off') {
    d.classList.add('fx-pending');
    var booted = null;
    try { booted = sessionStorage.getItem('star.booted'); } catch (e) { booted = null; }
    if (!booted) d.classList.add('booting');
    setTimeout(function () { d.classList.remove('fx-pending', 'booting'); }, 6000);
  }
}());
