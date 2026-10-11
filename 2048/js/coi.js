// <head>'de çalışır. Sayfa izole değilse /2048/sw.js'i kurar ve sayfayı bir kez yeniler; yenilemeden sonra
// service worker başlıkları eklediği için SharedArrayBuffer açılır ve AI tüm çekirdekleri kullanır.
// Olmazsa (eski tarayıcı, gizli sekme vb.) ikinci kez denemez: AI tek çekirdekle çalışır.
(function () {
  if (window.crossOriginIsolated || !window.isSecureContext || !('serviceWorker' in navigator)) return;
  var KEY = 'star.2048.coi';
  var tried = false;
  try { tried = sessionStorage.getItem(KEY) === '1'; } catch (e) { tried = true; }
  var reload = function () {
    if (tried) return;
    tried = true;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { return; }
    location.reload();
  };
  navigator.serviceWorker.register('/2048/sw.js', { scope: '/2048/' }).then(function (reg) {
    if (navigator.serviceWorker.controller) { reload(); return; }
    navigator.serviceWorker.addEventListener('controllerchange', reload);
    var sw = reg.active;
    if (sw && sw.state === 'activated') reload();
  }).catch(function (err) { console.warn('[2048] service worker kurulamadı:', err); });
}());
