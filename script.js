let groups = {};
let selectedTiles = [];
let solvedGroups = [];
let wrongGuesses = 0;
let remaining = [];
let previousGuesses = [];
const maxWrongGuesses = 4;
let shuffled = false;

function getCurrentISOWeek() {
  const now = new Date();
  const dayNum = now.getUTCDay() || 7;
  now.setUTCDate(now.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((now - yearStart) / 86400000) + 1) / 7);
  return week;
}

const week = getCurrentISOWeek();

// 📦 Load JSON file for current week
async function loadPuzzleForWeek(week) {
  const url = `data/week${week}.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Game not found.");
    groups = await response.json();
    console.log("Loaded groups:", groups); 
    resetGame();
  } catch (err) {
    document.getElementById("feedback").textContent =
      "❌ No game found for this week. Please check back later.";
    document.getElementById("shuffle-btn").disabled = true;
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function handleTileClick(tile) {
  const word = tile.dataset.word;
  if (tile.classList.contains("disabled") || tile.classList.contains("solved")) return;

  if (tile.classList.contains("selected")) {
    tile.classList.remove("selected");
    selectedTiles = selectedTiles.filter(w => w !== word);
  } else {
    if (selectedTiles.length >= 4) return;
    tile.classList.add("selected");
    selectedTiles.push(word);
  }
}

function checkSelection() {
  const currentGuess = [...selectedTiles].sort().join(",");

  if (previousGuesses.includes(currentGuess)) {
    showFeedback("⚠️ You've already tried this combination.");
    return;
  }

  previousGuesses.push(currentGuess);

  const match = Object.entries(groups).find(([groupName, words]) =>
    words.every(w => selectedTiles.includes(w)) &&
    selectedTiles.every(w => words.includes(w))
  );

  if (match) {
    markGroupAsSolved(match[1], match[0]);
  } else {
    // 3. Check if 3 out of 4 are correct
    const closeMatch = Object.values(groups).some(words => {
      const intersection = words.filter(w => selectedTiles.includes(w));
      return intersection.length === 3;
    });

    wrongGuesses++;
    updateGuessDisplay();

    if (closeMatch) {
      showFeedback("🟡 So close! You're one away from a correct group.");
    } else {
      showFeedback("❌ Incorrect group.");
    }

    if (wrongGuesses >= maxWrongGuesses) {
      endGame("💥 Game over. You've used all your guesses.");
    }

    selectedTiles = [];
    renderTiles();
  }
}


function markGroupAsSolved(words, groupName) {
  solvedGroups.push({ name: groupName, words });
  // Remove solved words from remaining
  remaining = remaining.filter(word => !words.includes(word));
  
  selectedTiles = [];
  showFeedback(`✅ Correct! Group: ${groupName}`);
  renderTiles();

  if (solvedGroups.length === Object.keys(groups).length) {
    endGame("🎉 Congratulations! You solved all groups.");
  }
}

function endGame(message) {
  showFeedback(message);
  document.querySelectorAll(".tile").forEach(t => t.classList.add("disabled"));
  document.getElementById("shuffle-btn").disabled = true;

  // Show unsolved groups
  const unsolved = Object.entries(groups).filter(([groupName]) =>
    !solvedGroups.some(s => s.name === groupName)
  );

  unsolved.forEach(([groupName, words]) => {
    solvedGroups.push({ name: groupName + " (Unsolved)", words });
  });

  renderTiles();
  onGameComplete();


localStorage.setItem("completedWeek", week);

}

function showFeedback(msg) {
  document.getElementById("feedback").textContent = msg;
}

function updateGuessDisplay() {
  const remaining = maxWrongGuesses - wrongGuesses;
  document.getElementById("guesses-left").textContent = `Wrong guesses left: ${remaining}`;
}

function resetGame() {
  selectedTiles = [];
  solvedGroups = [];
  wrongGuesses = 0;
  document.getElementById("shuffle-btn").disabled = false;
  updateGuessDisplay();
    remaining = Object.values(groups).flat();
  shuffleArray(remaining);
  renderTiles();
}

function renderTiles() {
  const tileContainer = document.getElementById("tile-container");
  tileContainer.innerHTML = "";

  // Solved Groups at the top
  solvedGroups.forEach(group => {
    const groupWrapper = document.createElement("div");
    groupWrapper.className = "group-wrapper";

    const label = document.createElement("div");
    label.className = "group-label";
    label.textContent = group.name;
    groupWrapper.appendChild(label);

    const row = document.createElement("div");
    row.className = "solved-row";

    group.words.forEach(word => {
      const tile = createTile(word, true);
      row.appendChild(tile);
    });

    groupWrapper.appendChild(row);
    tileContainer.appendChild(groupWrapper);
  });


  const grid = document.createElement("div");
  grid.className = "unsolved-grid";

  remaining.forEach(word => {
    const tile = createTile(word, false);
    grid.appendChild(tile);
  });

  tileContainer.appendChild(grid);
}

function createTile(word, solved = false) {
  const tile = document.createElement("div");
  tile.className = "tile";
  if (solved) tile.classList.add("solved", "disabled");
  tile.textContent = word;
  tile.dataset.word = word;

  if (!solved) {
    tile.addEventListener("click", () => handleTileClick(tile));
  }

  return tile;
}

function shuffleRemainingTiles() {
  shuffleArray(remaining);
  renderTiles();
}



import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";

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

function saveWinStreak(name, streak) {
  const newRef = push(ref(db, 'leaderboard'));
  set(newRef, {
    name: name,
    streak: streak,
    timestamp: Date.now()
  });
}

function onGameComplete() {
  
const isPerfect = wrongGuesses === 0 && solvedGroups.length === Object.keys(groups).length;
  if (isPerfect) {
    const playerName = localStorage.getItem("playerName") || prompt("Enter your name:") || "Anonymous";
    localStorage.setItem("playerName", playerName);

    const currentStreak = parseInt(localStorage.getItem("winStreak") || "0") + 1;
    localStorage.setItem("winStreak", currentStreak);

    const dbRef = ref(db, "leaderboard/" + playerName);
    set(dbRef, {
      name: playerName,
      streak: currentStreak,
      timestamp: Date.now()
    });
  } else {
    localStorage.setItem("winStreak", 0);
  }
}

// Call onGameComplete() at the end of endGame() if all groups solved
const leaderboardBtn = document.getElementById("leaderboard-button");
if (leaderboardBtn) {
  leaderboardBtn.addEventListener("click", () => {
    window.location.href = "leaderboard.html";
  });
}


// ✅ Only one window.onload
window.onload = () => {
    console.log(`Attempting to load: data/week${week}.json`);
  const completed = parseInt(localStorage.getItem("completedWeek"));
if (completed === week) {
  document.getElementById("feedback").textContent = "✅ You've already completed this week's puzzle.";
  document.getElementById("submit-button").disabled = true;
  document.getElementById("shuffle-btn").disabled = true;
  return;
}

  loadPuzzleForWeek(week);
  document.getElementById("submit-button").addEventListener("click", checkSelection);
  document.getElementById("shuffle-btn").addEventListener("click", shuffleRemainingTiles);
  document.getElementById("leaderboard-button").addEventListener("click", () => {
    window.location.href = "leaderboard.html";
  });
};
