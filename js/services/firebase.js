import { firebaseConfig, appConfig, isFirebaseConfigured, useEmulators } from '../config/firebase-config.js';

const CDN = `https://www.gstatic.com/firebasejs/${appConfig.sdkVersion}`;

let instancePromise = null;

export function getFirebase() {
  if (!isFirebaseConfigured) return Promise.resolve(null);
  if (!instancePromise) {
    instancePromise = (async () => {
      const [appMod, au, fs, st] = await Promise.all([
        import(`${CDN}/firebase-app.js`),
        import(`${CDN}/firebase-auth.js`),
        import(`${CDN}/firebase-firestore.js`),
        import(`${CDN}/firebase-storage.js`),
      ]);
      const app = appMod.initializeApp(firebaseConfig);
      const auth = au.getAuth(app);
      auth.languageCode = 'pt';
      let db;
      try {
        db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
      } catch {
        db = fs.getFirestore(app);
      }
      const storage = st.getStorage(app);
      if (useEmulators) {
        const host = location.hostname;
        au.connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
        fs.connectFirestoreEmulator(db, host, 8080);
        st.connectStorageEmulator(storage, host, 9199);
      }
      return { app, auth, db, storage, fs, st, au };
    })().catch((err) => {
      instancePromise = null;
      throw err;
    });
  }
  return instancePromise;
}

let functionsPromise = null;

function getFunctionsClient() {
  if (!functionsPromise) {
    functionsPromise = (async () => {
      const fb = await getFirebase();
      if (!fb) throw new Error('firebase-not-configured');
      const fn = await import(`${CDN}/firebase-functions.js`);
      const functions = fn.getFunctions(fb.app, appConfig.functionsRegion);
      if (useEmulators) fn.connectFunctionsEmulator(functions, location.hostname, 5001);
      return { functions, fn };
    })().catch((err) => { functionsPromise = null; throw err; });
  }
  return functionsPromise;
}

export async function callFunction(name, payload) {
  const { functions, fn } = await getFunctionsClient();
  const res = await fn.httpsCallable(functions, name, { timeout: 70_000 })(payload);
  return res.data;
}

export { isFirebaseConfigured };
