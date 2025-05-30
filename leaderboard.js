// leaderboard.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔐 Replace these with your own Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function loadLeaderboard() {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, "leaderboard"));

  if (snapshot.exists()) {
    const data = snapshot.val();
    const entries = Object.entries(data).map(([name, info]) => ({
      name,
      streak: info.streak || 0,
      lastSolved: info.lastSolved || "N/A"
    }));

    entries.sort((a, b) => b.streak - a.streak);

    const tbody = document.querySelector("#leaderboard-table tbody");
    tbody.innerHTML = "";

    entries.forEach((entry, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${entry.name}</td>
        <td>${entry.streak}</td>
        <td>${entry.lastSolved}</td>
      `;
      tbody.appendChild(row);
    });
  } else {
    document.querySelector("#leaderboard-table tbody").innerHTML = "<tr><td colspan='4'>No data found.</td></tr>";
  }
}

loadLeaderboard();
