import { getFirebase } from './firebase.js';
import { stateName } from '../data/states.js';
import { normalize } from '../core/utils.js';
import { specName } from '../data/categories.js';

const cache = new Map();
const TTL = 60_000;

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function invalidateCache() {
  cache.clear();
}

function peek(key) {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < TTL ? hit.value : null;
}

export const peekRecent = (max = 60) => peek(`recent:${max}`);
export const peekBySpec = (specId) => peek(`spec:${specId}`);

function fromDoc(snap) {
  const d = snap.data();
  return {
    id: snap.id,
    ...d,
    updatedAt: d.updatedAt?.toMillis?.() ?? 0,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

const byRecent = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

async function query(buildQuery) {
  const fb = await getFirebase();
  if (!fb) return [];
  return (await fb.fs.getDocs(buildQuery(fb))).docs.map(fromDoc);
}

export function listBySpec(specId) {
  return cached(`spec:${specId}`, async () => {
    const pros = await query(({ db, fs }) => fs.query(
      fs.collection(db, 'professionals'),
      fs.where('published', '==', true),
      fs.where('active', '==', true),
      fs.where('specs', 'array-contains', specId),
      fs.orderBy('updatedAt', 'desc'),
      fs.limit(100),
    ));
    return pros.sort(byRecent);
  });
}

export function listRecent(max = 60) {
  return cached(`recent:${max}`, async () => {
    const pros = await query(({ db, fs }) => fs.query(
      fs.collection(db, 'professionals'),
      fs.where('published', '==', true),
      fs.where('active', '==', true),
      fs.orderBy('updatedAt', 'desc'),
      fs.limit(max),
    ));
    return pros.sort(byRecent).slice(0, max);
  });
}

export async function getProfessional(id) {
  const fb = await getFirebase();
  if (!fb) return null;
  const { db, fs } = fb;
  try {
    const snap = await fs.getDoc(fs.doc(db, 'professionals', id));
    return snap.exists() ? fromDoc(snap) : null;
  } catch (err) {
    if (err.code === 'permission-denied') return null;
    throw err;
  }
}

export async function searchProfessionals(term) {
  const q = normalize(term);
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  const pool = await listRecent(300);
  return pool.filter((p) => {
    const hay = normalize([p.name, p.city, p.state, stateName(p.state), p.neighborhood, ...p.specs.map(specName)].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

export function primarySpecialty(pro, preferSpecId) {
  const id = preferSpecId && pro.specs?.includes(preferSpecId) ? preferSpecId : pro.specs?.[0];
  return id ? specName(id) : 'Profissional';
}
