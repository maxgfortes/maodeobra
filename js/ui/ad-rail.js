import { esc } from '../core/utils.js';
import { watchAds } from '../services/banners.js';
import { track } from '../services/analytics.js';

const WIDE = '(min-width: 1280px)';
const MAX = 3;

const isSafeLink = (link) => /^(#\/|signup\.html|https:\/\/)/.test(String(link || ''));

export function mountAdRail(el) {
  if (!el) return;
  const wide = matchMedia(WIDE);
  let stop = null;

  const render = (ads) => {
    const list = ads.slice(0, MAX);
    el.hidden = !list.length;
    document.documentElement.classList.toggle('has-ads', list.length > 0);
    el.innerHTML = list.length ? `<span class="ad-rail__label">Publicidade</span>${list.map((a) => {
      const href = isSafeLink(a.link) ? a.link : '';
      const ext = href.startsWith('https://');
      const tag = href ? 'a' : 'div';
      return `<${tag} class="ad" data-ad="${esc(a.id)}" ${href ? `href="${esc(href)}" ${ext ? 'target="_blank" rel="sponsored noopener"' : ''}` : ''}>
        <img src="${esc(a.img)}" alt="Anúncio" loading="lazy" decoding="async"></${tag}>`;
    }).join('')}` : '';
  };

  const sync = () => {
    if (wide.matches && !stop) stop = watchAds(render);
    if (!wide.matches && stop) { stop(); stop = null; render([]); }
  };

  el.addEventListener('click', (e) => {
    const ad = e.target.closest('[data-ad]');
    if (ad) track('ad', { p: ad.dataset.ad });
  });
  wide.addEventListener('change', sync);
  sync();
}
