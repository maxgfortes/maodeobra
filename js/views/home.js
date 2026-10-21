import { CATEGORIES, POPULAR_SPECS, getSpec } from '../data/categories.js';
import { listRecent, peekRecent } from '../services/professionals.js';
import { iconTile, proMini, demoNote } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { esc } from '../core/utils.js';
import { watchBanners } from '../services/banners.js';
import { bannerCarousel } from '../ui/carousel.js';
import { animateIn } from '../ui/motion.js';

function recentHTML(all) {
  const pros = all.slice(0, 12);
  return pros.length
    ? pros.map(proMini).join('')
    : '<p class="muted pad">Seja o primeiro profissional a se cadastrar!</p>';
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function homeView(_params, { root, isStale }) {
  root.innerHTML = `
    <section class="banners" id="banners"><div class="banner-track"><div class="banner skeleton"></div></div></section>

    <header class="page-head">
      <div class="breadcrumb">${esc(greeting())}</div>
      <h1 class="large-title">Do que você precisa hoje?</h1>
    </header>

    <div class="searchbar">
      <a class="search-field search-field--button" href="#/search">
        ${icon('search')}<span>Eletricista, diarista, pintor…</span>
      </a>
    </div>
    ${demoNote()}

    <h2 class="section-title">Categorias <a href="#/explore">Ver todas</a></h2>
    <div class="cat-grid">
      ${CATEGORIES.map((c) => `
        <a class="cat-cell" href="#/c/${c.id}">
          ${iconTile(c, 'icon-tile--lg')}
          <span>${esc(c.short)}</span>
        </a>`).join('')}
    </div>

    <h2 class="section-title">Mais procurados</h2>
    <div class="chips chips--scroll">
      ${POPULAR_SPECS.map((id) => getSpec(id)).filter(Boolean).map(({ spec }) => `
        <a class="chip" href="#/s/${spec.id}"><span class="chip__dot"></span>${esc(spec.name)}</a>`).join('')}
    </div>

    <h2 class="section-title">Novos no Guia</h2>
    <div class="carousel" id="recent">
      ${peekRecent(300) ? recentHTML(peekRecent(300)) : '<div class="card pro-mini"><div class="avatar avatar--md skeleton"></div><div class="skeleton sk-line" style="width:80%"></div><div class="skeleton sk-line sk-line--w60"></div></div>'.repeat(3)}
    </div>

    <section class="promo">
      <h3>Você é profissional?</h3>
      <p>Crie seu perfil grátis, mostre seus trabalhos e receba clientes direto no WhatsApp.</p>
      <a class="btn" href="signup.html">Cadastrar meu serviço</a>
    </section>

  `;

  let stopCarousel = () => {};
  let shown = null;
  const stopWatching = watchBanners((banners) => {
    if (isStale()) return;
    const key = banners.map((b) => `${b.id}|${b.img}|${b.link}`).join(' ');
    if (key === shown) return;
    shown = key;
    stopCarousel();
    stopCarousel = bannerCarousel(root.querySelector('#banners'), banners);
  });

  if (!peekRecent(300)) listRecent(300)
    .then((all) => {
      if (isStale()) return;
      const el = root.querySelector('#recent');
      el.innerHTML = recentHTML(all);
      animateIn(el);
    })
    .catch((err) => {
      console.error(err);
      const el = root.querySelector('#recent');
      if (el) el.innerHTML = '<p class="muted pad">Não foi possível carregar agora.</p>';
    });

  return () => { stopCarousel(); stopWatching(); };
}
