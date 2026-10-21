import { route, startRouter, back, currentPath } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { haptic, scroller } from '../core/utils.js';
import { initPWA } from '../core/pwa.js';
import { initNetworkStatus } from '../core/network.js';
import { animateIn, swapView, initImageFades } from '../ui/motion.js';

import { homeView } from '../views/home.js';
import { exploreView, categoryView, groupView } from '../views/explore.js';
import { specListView } from '../views/list.js';
import { profileView } from '../views/profile.js';
import { searchView } from '../views/search.js';
import { meView } from '../views/me.js';
import { notFoundView } from '../views/notfound.js';
import { aboutView, contactView, termsView } from '../views/info.js';

initPWA();
initNetworkStatus();
initImageFades();

route('/', homeView, { tab: 'home', title: 'Início' });
route('/explore', exploreView, { tab: 'explore', title: 'Explorar' });
route('/c/:catId', categoryView, { section: 'explore' });
route('/c/:catId/:groupId', groupView, { section: 'explore' });
route('/s/:specId', specListView, { section: 'explore' });
route('/p/:id', profileView, {});
route('/search', searchView, { tab: 'search', title: 'Buscar' });
route('/me', meView, { tab: 'me', title: 'Perfil' });
route('/sobre', aboutView, { section: 'me', title: 'Sobre' });
route('/contato', contactView, { section: 'me', title: 'Contato' });
route('/termos', termsView, { section: 'me', title: 'Termos de uso' });
route('/404', notFoundView, {});

const TABS = [
  { id: 'home', href: '#/', label: 'Início', icon: 'home' },
  { id: 'explore', href: '#/explore', label: 'Explorar', icon: 'grid' },
  { id: 'search', href: '#/search', label: 'Buscar', icon: 'search' },
  { id: 'me', href: '#/me', label: 'Perfil', icon: 'person' },
];
const tabbar = document.getElementById('tabbar');
tabbar.innerHTML = TABS.map((t) => `
  <a class="tab" href="${t.href}" data-tab="${t.id}">
    ${icon(t.icon, { cls: 'tab__off' })}${icon(`${t.icon}Fill`, { cls: 'tab__on' })}<span>${t.label}</span>
  </a>`).join('');

let lastSection = 'home';
function setActiveTab(id) {
  lastSection = id || lastSection;
  tabbar.querySelectorAll('.tab').forEach((el) => {
    const on = el.dataset.tab === lastSection;
    el.classList.toggle('is-active', on);
    if (on) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

tabbar.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  haptic();
  if (tab.getAttribute('href') === `#${currentPath()}`) {
    e.preventDefault();
    scroller().scrollTo({ top: 0, behavior: 'smooth' });
  }
});

const root = document.getElementById('app');
let cleanup = null;
const scrollMemory = new Map();

startRouter(async ({ found, path, transition, isStale }) => {
  scrollMemory.set(root.dataset.path, scroller().scrollTop);
  setActiveTab(found?.meta.tab || found?.meta.section);
  document.title = found?.meta.title ? `${found.meta.title} · Guia Mão de Obra` : 'Guia Mão de Obra';

  const view = document.createElement('div');
  view.className = 'view';
  try {
    if (cleanup) { cleanup(); cleanup = null; }
    const result = await found.view(found.params, { root: view, isStale });
    if (isStale()) return;
    if (typeof result === 'string') view.innerHTML = result;
    else if (typeof result === 'function') cleanup = result;
  } catch (err) {
    console.error(err);
    if (isStale()) return;
    view.innerHTML = `<div class="empty"><h2 class="empty__title">Algo deu errado</h2><p>Verifique sua conexão e tente novamente.</p><button class="btn btn--sm mt-16" onclick="location.reload()">Tentar de novo</button></div>`;
    toast('Não foi possível carregar.', 'error');
  }

  const animated = await swapView(root, view, transition, () => {
    root.dataset.path = path;
    scroller().scrollTo(0, transition === 'back' ? scrollMemory.get(path) || 0 : 0);
  });
  if (!animated) animateIn(view);
});

document.addEventListener('click', (e) => {
  const backLink = e.target.closest('[data-back]');
  if (backLink) {
    e.preventDefault();
    haptic();
    back(backLink.getAttribute('href').replace(/^#/, ''));
    return;
  }
  const action = e.target.closest('[data-href]');
  if (action) {
    e.preventDefault();
    e.stopPropagation();
    haptic();
    window.open(action.dataset.href, '_blank', 'noopener');
  }
});
