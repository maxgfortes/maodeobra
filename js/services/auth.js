import { getFirebase } from './firebase.js';
import { invalidateCache } from './professionals.js';

export async function currentUser() {
  const fb = await getFirebase();
  if (!fb) return null;
  await fb.auth.authStateReady();
  return fb.auth.currentUser;
}

export async function onUser(cb) {
  const fb = await getFirebase();
  if (!fb) { cb(null); return () => {}; }
  return fb.au.onAuthStateChanged(fb.auth, cb);
}

export async function signInWithGoogle() {
  const fb = await getFirebase();
  if (!fb) throw new Error('firebase-not-configured');
  const { au, auth } = fb;
  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await au.signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(err.code)) {
      await au.signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function signOut() {
  const fb = await getFirebase();
  if (fb) await fb.au.signOut(fb.auth);
  invalidateCache();
}

export async function getMyProfile(uid) {
  const fb = await getFirebase();
  if (!fb) return null;
  const { db, fs } = fb;
  const snap = await fs.getDoc(fs.doc(db, 'professionals', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function authErrorMessage(err) {
  const map = {
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/network-request-failed': 'Sem conexão. Tente novamente.',
    'auth/unauthorized-domain': 'Domínio não autorizado no Firebase Auth.',
    'firebase-not-configured': 'Firebase não configurado (modo demonstração).',
  };
  return map[err?.code || err?.message] || 'Não foi possível entrar. Tente novamente.';
}
