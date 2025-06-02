import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBnc5HI3Qti60AXXDCpL9B-YfBQNYW4MXM",
  authDomain: "leaderboard-7580a.firebaseapp.com",
  databaseURL: "https://leaderboard-7580a-default-rtdb.firebaseio.com",
  projectId: "leaderboard-7580a",
  storageBucket: "leaderboard-7580a.appspot.com",
  messagingSenderId: "1065369349992",
  appId: "1:1065369349992:web:f8cc82b10ada7d286730dd",
  measurementId: "G-QT1C8X36P8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const leaderboardRef = ref(db, "leaderboard");

const playerName = localStorage.getItem("playerName") || "Anonymous";
const currentStreak = localStorage.getItem("winStreak") || 0;

document.getElementById("player-streak").textContent =
  `${playerName}'s current streak: ${currentStreak}`;

get(leaderboardRef).then(snapshot => {
  if (!snapshot.exists()) {
    document.getElementById("leaderboard").textContent = "No data available.";
    return;
  }

  const data = snapshot.val();
  let leaderboardArray = Object.values(data);

  // Sort by streak descending
  leaderboardArray.sort((a, b) => b.streak - a.streak);

  // Find current player’s entry (even if not in top 10)
  const currentPlayerEntry = leaderboardArray.find(entry => entry.name === playerName);

  // Take top 10
  const topTen = leaderboardArray.slice(0, 10);

  // If current player not in top ten, add them to the bottom
  const isInTopTen = topTen.some(entry => entry.name === playerName);
  if (!isInTopTen && currentPlayerEntry) {
    topTen.push(currentPlayerEntry);
  }

  const container = document.getElementById("leaderboard");
  container.innerHTML = "";

  topTen.forEach((entry, index) => {
    const div = document.createElement("div");
    div.className = "leaderboard-entry";
    if (entry.name === playerName) div.classList.add("current-player");

    // Determine rank (offset if current player added after top 10)
    const rank = index + 1;
    const rankLabel = isInTopTen || index < 10 ? `#${rank}` : "…";

    div.textContent = `${rankLabel} ${entry.name}: ${entry.streak}`;
    container.appendChild(div);
  });

}).catch(error => {
  console.error(error);
  document.getElementById("leaderboard").textContent = "Error loading leaderboard.";
});
