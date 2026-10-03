// Gizlilik sayfası: dil geçişi, çerez tabloları (consent.js'ten) ve çerez tercihleri.
import { API } from './util.js';
import { setLang, getLang } from './i18n.js';
import { initConsent, cookieTablesHTML } from './consent.js';

const T = {
  back: ['ODAYA DÖN', 'BACK TO THE ROOM'],
  cookies: ['ÇEREZ TERCİHLERİ', 'COOKIE SETTINGS'],
  title: ['Gizlilik Politikası — STAR', 'Privacy Policy — STAR'],
};

function apply(lang) {
  const en = lang === 'en';
  document.documentElement.lang = en ? 'en' : 'tr';
  document.querySelectorAll('[data-legal]').forEach((el) => { el.hidden = el.dataset.legal !== (en ? 'en' : 'tr'); });
  document.querySelectorAll('[data-legal-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.legalLang === (en ? 'en' : 'tr'))));
  document.querySelectorAll('[data-legal-t]').forEach((el) => { el.textContent = T[el.dataset.legalT][en ? 1 : 0]; });
  document.title = T.title[en ? 1 : 0];
  const skip = document.querySelector('.skip');
  if (skip) skip.textContent = en ? 'Skip to content' : 'İçeriğe geç';
}
function paintConsent() {
  const txt = API.consent?.summary?.() || '—';
  document.querySelectorAll('.consent-now').forEach((el) => { el.textContent = txt; });
}

document.querySelectorAll('[data-ck-tables]').forEach((el) => { el.innerHTML = cookieTablesHTML(el.dataset.ckTables); });
initConsent();
apply(getLang());
paintConsent();
API.consent?.onChange(paintConsent);
document.querySelectorAll('[data-legal-lang]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.legalLang); apply(b.dataset.legalLang); paintConsent(); }));
