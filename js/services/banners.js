import { getFirebase } from './firebase.js';

const last = new Map();

const toItems = (snap) => snap.docs
  .map((d) => ({ id: d.id, link: d.data().link || '', img: d.data().img || '' }))
  .filter((b) => b.img)
  .sort((a, b) => a.id.localeCompare(b.id));

function watch(collection, onChange) {
  let unsub = null;
  let stopped = false;
  const emit = (items) => { last.set(collection, items); if (!stopped) onChange(items); };
  if (last.has(collection)) onChange(last.get(collection));

  getFirebase()
    .then((fb) => {
      if (stopped) return;
      if (!fb) { emit([]); return; }
      const { db, fs } = fb;
      unsub = fs.onSnapshot(fs.collection(db, collection), (snap) => emit(toItems(snap)), (err) => {
        console.warn(`${collection} unavailable`, err);
        if (!last.has(collection)) emit([]);
      });
    })
    .catch((err) => {
      console.warn(`${collection} unavailable`, err);
      if (!last.has(collection)) emit([]);
    });

  return () => { stopped = true; unsub?.(); };
}

export const watchBanners = (onChange) => watch('banners', onChange);
export const watchAds = (onChange) => watch('ads', onChange);
