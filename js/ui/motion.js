let activeVT = null;

const settle = (promise, ms) => Promise.race([promise, new Promise((r) => setTimeout(() => r('timeout'), ms))]);

export async function swapView(root, view, transition, afterSwap) {
  let swapped = false;
  const swap = () => {
    if (swapped) return;
    swapped = true;
    root.replaceChildren(view);
    afterSwap?.();
  };
  const first = !root.querySelector('.view');
  if (first) { swap(); return false; }

  if (document.startViewTransition && !document.hidden) {
    const html = document.documentElement;
    activeVT?.skipTransition();
    html.dataset.nav = transition;
    try {
      const vt = document.startViewTransition(swap);
      activeVT = vt;
      if (await settle(vt.updateCallbackDone, 600) === 'timeout') {
        vt.skipTransition();
        swap();
      }
      vt.finished.catch(() => {}).finally(() => { if (activeVT === vt) { delete html.dataset.nav; activeVT = null; } });
      return true;
    } catch {
      delete html.dataset.nav;
      swap();
      return true;
    }
  }
  view.classList.add(`is-${transition}`);
  swap();
  return true;
}

const STAGGER_SELECTORS = [
  '.list > li', '.cat-cell', '.carousel > .card', '.chips > .chip',
  '.gallery__item', '.plan', '.stat', '.contact-btn',
];

export function animateIn(scope) {
  const groups = new Map();
  scope.querySelectorAll(STAGGER_SELECTORS.join(',')).forEach((el) => {
    const parent = el.parentElement;
    const i = groups.get(parent) ?? 0;
    groups.set(parent, i + 1);
    if (i > 14) return;
    el.style.setProperty('--i', i);
    el.classList.add('rise');
    el.addEventListener('animationend', () => el.classList.remove('rise'), { once: true });
  });
}

export function initImageFades() {
  const mark = (img) => img.classList.add('is-loaded');
  document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') mark(e.target); }, true);
  document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') { e.target.classList.add('is-broken'); mark(e.target); } }, true);
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        (n.tagName === 'IMG' ? [n] : n.querySelectorAll('img')).forEach((img) => { if (img.complete) mark(img); });
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}
