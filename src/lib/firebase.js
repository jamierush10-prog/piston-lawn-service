import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your exact verified Firebase configuration block
const firebaseConfig = {
  apiKey: "AIzaSyARDR7B4uoG1wnwpkJ5gikNjdualC5KU4w",
  authDomain: "jamie-rush.firebaseapp.com",
  projectId: "jamie-rush",
  storageBucket: "jamie-rush.firebasestorage.app",
  messagingSenderId: "685708587804",
  appId: "1:685708587804:web:55cc1b3faef741a2cb80d9"
};

// Initialize Firebase safely for Next.js
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { db };