import { initializeApp } from "firebase/app";
// @ts-expect-error getReactNativePersistence is available in React Native build of firebase/auth
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:000000000000:web:demo",
};

export const missingFirebaseVars = [
    ["EXPO_PUBLIC_FIREBASE_API_KEY", firebaseConfig.apiKey],
    ["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
    ["EXPO_PUBLIC_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
    ["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", firebaseConfig.storageBucket],
    ["EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", firebaseConfig.messagingSenderId],
    ["EXPO_PUBLIC_FIREBASE_APP_ID", firebaseConfig.appId],
]
    .filter(([, value]) => !value || String(value).startsWith("demo"))
    .map(([key]) => key);
export const isFirebaseConfigured = missingFirebaseVars.length === 0;
export const isFirebaseAiConfigured = isFirebaseConfigured;

if (!isFirebaseConfigured) {
    console.warn(
        `Firebase não configurado. Variáveis ausentes: ${missingFirebaseVars.join(", ")}`
    );
}

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});
export const storage = getStorage(app);

export default app;
