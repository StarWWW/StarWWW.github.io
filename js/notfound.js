// 404: istenen yolu terminal satırına yaz (textContent → HTML olarak yorumlanmaz)
(function () {
  var el = document.getElementById('nfPath');
  if (!el) return;
  var p = location.pathname;
  try { p = decodeURIComponent(p); } catch (e) { /* bozuk adres: ham hali */ }
  el.textContent = p.slice(0, 80) || '/';
}());
