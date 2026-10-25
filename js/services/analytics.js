import { getFirebase, isFirebaseConfigured } from './firebase.js';

const VID_KEY = 'gmo:vid';
const OPT_OUT_KEY = 'gmo:notrack';

const rand = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);

function storage(key, fallback) {
  try {
    let v = localStorage.getItem(key);
    if (!v && fallback) { v = fallback(); localStorage.setItem(key, v); }
    return v;
  } catch {
    return fallback ? fallback() : null;
  }
}

const vid = storage(VID_KEY, rand);
const sid = rand();
const device = matchMedia('(min-width: 1024px)').matches ? 'd' : 'm';
let referrer = (() => {
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    return host && host !== location.hostname ? host.slice(0, 80) : '';
  } catch {
    return '';
  }
})();

const str = (v, max) => (typeof v === 'string' && v ? v.slice(0, max) : undefined);

export function optOutOfTracking() {
  try { localStorage.setItem(OPT_OUT_KEY, '1'); } catch {}
}

export function track(type, data = {}) {
  if (!isFirebaseConfigured || navigator.webdriver || storage(OPT_OUT_KEY)) return;
  const event = {
    t: type, vid, sid, dv: device,
    p: str(data.p, 128), s: str(data.s, 60), c: str(data.c, 60),
    q: str(data.q, 60), path: str(data.path, 80),
    n: Number.isInteger(data.n) ? Math.min(Math.max(data.n, 0), 10000) : undefined,
  };
  if (referrer) { event.ref = referrer; referrer = ''; }
  Object.keys(event).forEach((k) => event[k] === undefined && delete event[k]);
  getFirebase()
    .then((fb) => fb && fb.fs.addDoc(fb.fs.collection(fb.db, 'events'), { ...event, at: fb.fs.serverTimestamp() }))
    .catch(() => {});
}
