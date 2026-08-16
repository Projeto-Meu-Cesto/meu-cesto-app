import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:demo',
};

export const missingFirebaseVars = [
  ['EXPO_PUBLIC_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['EXPO_PUBLIC_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', firebaseConfig.storageBucket],
  ['EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', firebaseConfig.messagingSenderId],
  ['EXPO_PUBLIC_FIREBASE_APP_ID', firebaseConfig.appId],
]
  .filter(([, value]) => !value || String(value).startsWith('demo'))
  .map(([key]) => key);

export const isFirebaseConfigured = missingFirebaseVars.length === 0;

if (!isFirebaseConfigured) {
  console.warn(`Firebase não configurado. Variáveis ausentes: ${missingFirebaseVars.join(', ')}`);
}

const app = initializeApp(firebaseConfig);

const appCheckSiteKey = process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
export const isAppCheckConfigured = Boolean(appCheckSiteKey);
export const isFirebaseAiConfigured = isFirebaseConfigured && isAppCheckConfigured;

if (typeof window !== 'undefined' && appCheckSiteKey) {
  try {
    if (__DEV__ && process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG === 'true') {
      (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    // Fast Refresh can evaluate this module more than once; the existing instance remains active.
    if (!(error instanceof Error) || !error.message.includes('already been initialized')) {
      console.warn('[App Check] Não foi possível iniciar a proteção desta sessão.', error);
    }
  }
}

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);

export default app;
