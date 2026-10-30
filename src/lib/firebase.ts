import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA0CwjnCPTJ7ND-3e6PaRbd4hbkIMKptMY",
  authDomain: "jahidaccessories.firebaseapp.com",
  projectId: "jahidaccessories",
  storageBucket: "jahidaccessories.firebasestorage.app",
  messagingSenderId: "416689694966",
  appId: "1:416689694966:web:7e623639a93a6e8d9424d7"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
