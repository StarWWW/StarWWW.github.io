// 2048 laboratuvarı ile sitenin ortak parçaları: çerez onayı (banner + tercih penceresi) ve yıl
import { initConsent } from '/js/consent.js';

initConsent();
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
