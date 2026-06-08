import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHAJj-rSSNbywkow7nkGInF171kvdwv_I",
  authDomain: "feria-local-c4ba3.firebaseapp.com",
  projectId: "feria-local-c4ba3",
  storageBucket: "feria-local-c4ba3.firebasestorage.app",
  messagingSenderId: "794529751322",
  appId: "1:794529751322:web:69c26d52f94207093e0ca3",
  measurementId: "G-9L0CNW0D5L"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
