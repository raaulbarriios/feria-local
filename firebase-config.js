
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

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

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
