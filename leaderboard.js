import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBnc5HI3Qti60AXXDCpL9B-YfBQNYW4MXM",
  authDomain: "leaderboard-7580a.firebaseapp.com",
  databaseURL: "https://leaderboard-7580a-default-rtdb.firebaseio.com",
  projectId: "leaderboard-7580a",
  storageBucket: "leaderboard-7580a.appspot.com",
  messagingSenderId: "1065369349992",
  appId: "1:1065369349992:web:f8cc82b10ada7d286730dd"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const playerName = localStorage.getItem("playerName");
const playerStreak = localStorage.getItem("winStreak");
document.getElementById("player-streak").textContent = `👤 ${playerName}'s streak: ${playerStreak}`;

async function loadLeaderboard() {
  const snapshot = await get(child(ref(db), "leaderboard"));
  if (snapshot.exists()) {
    const data = snapshot.val();
    const entries = Object.values(data);

    entries.sort((a, b) => b.streak - a.streak);

    const tbody = document.getElementById("leaderboard-body");
    entries.forEach((entry, index) => {
      const row = document.createElement("tr");
      if (entry.name === playerName) row.style.backgroundColor = "#fff3cd"; // highlight

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${entry.name}</td>
        <td>${entry.streak}</td>
      `;
      tbody.appendChild(row);
    });
  } else {
    document.getElementById("leaderboard-body").innerHTML = "<tr><td colspan='3'>No entries yet.</td></tr>";
  }
}

loadLeaderboard();
