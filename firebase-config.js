// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDHAJj-rSSNbywkow7nkGInF171kvdwv_I",
  authDomain: "feria-local-c4ba3.firebaseapp.com",
  projectId: "feria-local-c4ba3",
  storageBucket: "feria-local-c4ba3.firebasestorage.app",
  messagingSenderId: "794529751322",
  appId: "1:794529751322:web:69c26d52f94207093e0ca3",
  measurementId: "G-9L0CNW0D5L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
