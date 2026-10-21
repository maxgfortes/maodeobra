import { getFirebase } from './firebase.js';

let last = null;

const toBanners = (snap) => snap.docs
  .map((d) => ({ id: d.id, link: d.data().link || '', img: d.data().img || '' }))
  .filter((b) => b.img)
  .sort((a, b) => a.id.localeCompare(b.id));

export function watchBanners(onChange) {
  let unsub = null;
  let stopped = false;
  if (last) onChange(last);

  getFirebase()
    .then((fb) => {
      if (stopped) return;
      if (!fb) { last = []; onChange(last); return; }
      const { db, fs } = fb;
      unsub = fs.onSnapshot(fs.collection(db, 'banners'), (snap) => {
        last = toBanners(snap);
        onChange(last);
      }, (err) => {
        console.warn('Banners unavailable', err);
        if (!last) { last = []; onChange(last); }
      });
    })
    .catch((err) => {
      console.warn('Banners unavailable', err);
      if (!stopped && !last) { last = []; onChange(last); }
    });

  return () => { stopped = true; unsub?.(); };
}
