import { initNav } from './modules/nav.js';
import { initModals } from './modules/modal.js';
import { initSlider } from './modules/slider.js';
import { initSiteSearch } from './modules/search.js';
import { initFavorites } from './modules/favorites.js';
import { initContactForm } from './modules/form.js';

function setCurrentYear(doc) {
  var y = new Date().getFullYear();
  doc.querySelectorAll('[data-current-year]').forEach(function (el) {
    el.textContent = String(y);
  });
}

try {
  setCurrentYear(document);
  initNav(document);
  initModals(document);
  initSlider(document);
  initSiteSearch(document);
  initFavorites(document);
  initContactForm(document);
} catch (e) {
  /* fail-safe: static site remains usable */
}
