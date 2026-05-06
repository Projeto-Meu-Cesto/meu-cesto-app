import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCkYPBRFoXs4Vsuf7VRzfJwE3Fpm1sUp3c",
    authDomain: "meu-cesto.firebaseapp.com",
    projectId: "meu-cesto",
    storageBucket: "meu-cesto.firebasestorage.app",
    messagingSenderId: "398891587806",
    appId: "1:398891587806:web:1618765685bb5847024a4f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;