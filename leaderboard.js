import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

// Firebase config
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const leaderboardRef = ref(db, "leaderboard");

// Get current player info from localStorage
const playerName = localStorage.getItem("playerName") || "Anonymous";
const currentStreak = localStorage.getItem("winStreak") || 0;

// Show current streak above the table
document.getElementById("player-streak").textContent =
  `${playerName}'s current streak: ${currentStreak}`;

get(leaderboardRef)
  .then(snapshot => {
    if (!snapshot.exists()) {
      document.getElementById("leaderboard").innerHTML = "<tr><td colspan='3'>No data available.</td></tr>";
      return;
    }

    const data = snapshot.val();
    let leaderboardArray = Object.values(data);

    // Sort by streak descending
    leaderboardArray.sort((a, b) => b.streak - a.streak);

    // Find current player's entry
    const currentPlayerEntry = leaderboardArray.find(entry => entry.name === playerName);

    // Get top 10
    const topTen = leaderboardArray.slice(0, 10);

    // Include current player if not in top 10
    const isInTopTen = topTen.some(entry => entry.name === playerName);
    if (!isInTopTen && currentPlayerEntry) {
      topTen.push(currentPlayerEntry);
    }

    const tbody = document.getElementById("leaderboard");
    tbody.innerHTML = ""; // Clear previous entries

    topTen.forEach((entry, index) => {
      const tr = document.createElement("tr");

      // Determine rank: show "…" if not in top 10
      const isExtraRow = !isInTopTen && index === 10;
      const rank = isExtraRow ? "…" : (index + 1);

      // Apply current-player class if matched
      if (entry.name === playerName) {
        tr.classList.add("current-player");
      }

tr.innerHTML = `
  <td data-label="Rank">${rank}</td>
  <td data-label="Name">${entry.name}</td>
  <td data-label="Streak">${entry.streak}</td>
`;


      tbody.appendChild(tr);
    });
  })
  .catch(error => {
    console.error("Error loading leaderboard:", error);
    document.getElementById("leaderboard").innerHTML =
      "<tr><td colspan='3'>Error loading leaderboard.</td></tr>";
  });
