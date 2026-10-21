export const firebaseConfig = {
  apiKey: 'AIzaSyDYSd0ZoBVtXuw5bR_Ps6LkGZa3qGhInCk',
  authDomain: 'guiadamaodeobra.firebaseapp.com',
  projectId: 'guiadamaodeobra',
  storageBucket: 'guiadamaodeobra.firebasestorage.app',
  messagingSenderId: '735810487374',
  appId: '1:735810487374:web:f66b1ec7028346157daf1f',
  measurementId: 'G-XZ69F491PJ',
};

export const appConfig = {
  sdkVersion: '10.12.2',
  functionsRegion: 'southamerica-east1',
  mercadoPagoPublicKey: 'YOUR_MP_PUBLIC_KEY',
  contact: { email: '', whatsapp: '' },
};

export const isPaymentsConfigured = !appConfig.mercadoPagoPublicKey.startsWith('YOUR_');

const EMU_KEY = 'gmo:emulators';
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
let emu = false;
try {
  if (isLocal && new URLSearchParams(location.search).has('emulators')) sessionStorage.setItem(EMU_KEY, '1');
  emu = isLocal && sessionStorage.getItem(EMU_KEY) === '1';
} catch {  }
export const useEmulators = emu;

if (useEmulators) {
  Object.assign(firebaseConfig, {
    apiKey: 'demo-key',
    authDomain: 'demo-guia.firebaseapp.com',
    projectId: 'demo-guia',
    storageBucket: 'demo-guia.appspot.com',
    appId: 'demo-app',
  });
}

export const isFirebaseConfigured = !String(firebaseConfig.apiKey).startsWith('YOUR_');
