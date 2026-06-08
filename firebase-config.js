// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCt9VYQN-M6wl7174y-XCHwmAs9TNAQYVg",
  authDomain: "eventos-ayuntamiento.firebaseapp.com",
  databaseURL: "https://eventos-ayuntamiento-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "eventos-ayuntamiento",
  storageBucket: "eventos-ayuntamiento.firebasestorage.app",
  messagingSenderId: "375769854696",
  appId: "1:375769854696:web:f6e13c750a99fc66f24f5d",
  measurementId: "G-NV58CQT7BT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
