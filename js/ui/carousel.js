import { esc } from '../core/utils.js';

const INTERVAL = 5000;

function isSafeLink(link) {
  return /^(#\/|signup\.html|https:\/\/)/.test(String(link || ''));
}

export function bannerCarousel(container, banners) {
  container.hidden = !banners.length;
  if (!banners.length) { container.innerHTML = ''; return () => {}; }

  container.innerHTML = `
    <div class="banner-track" role="region" aria-roledescription="carrossel" aria-label="Destaques">
      ${banners.map((b, i) => {
        const href = isSafeLink(b.link) ? b.link : '';
        const ext = href.startsWith('https://');
        const tag = href ? 'a' : 'div';
        return `
          <${tag} class="banner" ${href ? `href="${esc(href)}" ${ext ? 'target="_blank" rel="noopener"' : ''}` : ''}
             aria-label="Destaque ${i + 1} de ${banners.length}">
            <img class="banner__img" src="${esc(b.img)}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">
          </${tag}>`;
      }).join('')}
    </div>
    ${banners.length > 1 ? `<div class="banner-dots" aria-hidden="true">${banners.map((_, i) => `<span class="${i ? '' : 'is-active'}"></span>`).join('')}</div>` : ''}`;

  const track = container.querySelector('.banner-track');
  const dots = [...container.querySelectorAll('.banner-dots span')];
  if (banners.length < 2) return () => {};

  let index = 0;
  let timer = null;
  let paused = false;

  const go = (i) => {
    index = (i + banners.length) % banners.length;
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
  };
  const schedule = () => {
    clearTimeout(timer);
    if (!paused && !document.hidden) timer = setTimeout(() => go(index + 1), INTERVAL);
  };

  let raf = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== index) index = i;
      dots.forEach((d, k) => d.classList.toggle('is-active', k === index));
      schedule();
    });
  }, { passive: true });

  const pause = () => { paused = true; clearTimeout(timer); };
  const resume = () => { paused = false; schedule(); };
  track.addEventListener('touchstart', pause, { passive: true });
  track.addEventListener('touchend', resume, { passive: true });
  const onVisibility = () => schedule();
  document.addEventListener('visibilitychange', onVisibility);

  schedule();
  return () => { clearTimeout(timer); cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVisibility); };
}
