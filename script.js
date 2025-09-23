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


let groups = {};
let selectedTiles = [];
let solvedGroups = [];
let wrongGuesses = 0;
let remaining = [];
let previousGuesses = [];
const maxWrongGuesses = 4;
let shuffled = false;

function getCurrentISOWeekInfo() {
  const now = new Date();
  const dayNum = now.getUTCDay() || 7;
  now.setUTCDate(now.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((now - yearStart) / 86400000) + 1) / 7);
  return { year: now.getUTCFullYear(), week };
}

const currentWeekInfo = getCurrentISOWeekInfo();  // Get current year + week
const week = currentWeekInfo.week;                // Current week number
const currentWeek = currentWeekInfo.week;         // for backward compatibility
const currentYear = currentWeekInfo.year;

// 🔁 Helper to get number of ISO weeks in a year
function getISOWeeksInYear(year) {
  const dec28 = new Date(Date.UTC(year, 11, 28)); // Dec 28 is always in the last ISO week
  const day = dec28.getUTCDay() || 7;
  dec28.setUTCDate(dec28.getUTCDate() + 4 - day);
  const startOfYear = new Date(Date.UTC(dec28.getUTCFullYear(), 0, 1));
  return Math.ceil((((dec28 - startOfYear) / 86400000) + 1) / 7);
}

function getStartOfISOWeek(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4)); // Jan 4 always in week 1
  const jan4Day = jan4.getUTCDay() || 7;
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const startDate = new Date(startOfWeek1);
  startDate.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7);
  return startDate;
}

function formatWeekRange(year, week) {
  const start = getStartOfISOWeek(year, week);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const options = { timeZone: 'UTC', month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", options)} – ${end.toLocaleDateString("en-US", options)}, ${year}`;
}

function populatePastWeeksDropdown(currentWeekInfo, numWeeks = 5) {
  const select = document.getElementById("week-picker");
  select.innerHTML = "";

  const promptOption = document.createElement("option");
  promptOption.value = "";
  promptOption.textContent = "📆 Play a previous week";
  promptOption.disabled = true;
  promptOption.selected = true;
  select.appendChild(promptOption);

  let week = currentWeekInfo.week;
  let year = currentWeekInfo.year;

  for (let i = 1; i <= numWeeks; i++) {
    week -= 1;
    if (week < 1) {
      year -= 1;
      week = getISOWeeksInYear(year); // ✅ use real ISO week count for the previous year
    }

    const label = formatWeekRange(year, week);
    const option = document.createElement("option");
    option.value = `${year}-${week}`;
    option.textContent = label;
    select.appendChild(option);
  }
}


// 📦 Load JSON file for current week
async function loadPuzzleForWeek(year, week) {
  const url = `data/${year}-${week}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Game not found.");
    groups = await response.json();
    console.log("Loaded groups:", groups); 
    resetGame();
  } catch (err) {
    document.getElementById("feedback").textContent =
      "❌ No game found for this week. Please check back later.";
    document.getElementById("shuffle-button").disabled = true;
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
  onGameComplete();
}

}

function endGame(message) {
  showFeedback(message);
  document.querySelectorAll(".tile").forEach(t => t.classList.add("disabled"));
  document.getElementById("shuffle-button").disabled = true;

  // Show unsolved groups
  const unsolved = Object.entries(groups).filter(([groupName]) =>
    !solvedGroups.some(s => s.name === groupName)
  );

  unsolved.forEach(([groupName, words]) => {
    solvedGroups.push({ name: groupName + " (Unsolved)", words });
  });

  renderTiles();



localStorage.setItem("completedWeek", week);
   localStorage.setItem("solvedGroups", JSON.stringify(solvedGroups));

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
  document.getElementById("shuffle-button").disabled = false;
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



function saveWinStreak(name, streak) {
  const newRef = push(ref(db, 'leaderboard'));
  set(newRef, {
    name: name,
    streak: streak,
    timestamp: Date.now()
  });
}

import { runTransaction, get } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

const visitRef = ref(db, 'visits');

if (!sessionStorage.getItem("visited")) {
  runTransaction(visitRef, current => (current || 0) + 1).then(result => {
    document.getElementById("visit-count").textContent = result.snapshot.val();
    sessionStorage.setItem("visited", "true");
  }).catch(err => {
    console.error("Visitor counter failed:", err);
    document.getElementById("visit-count").textContent = "Error";
  });
} else {
  // Already visited this session, just display the count
  get(visitRef).then(snapshot => {
    document.getElementById("visit-count").textContent = snapshot.val();
  });
}


function saveComment(text) {
  const commentsRef = ref(db, "comments");
  const newComment = push(commentsRef);
  set(newComment, {
    text: text,
    timestamp: Date.now()
  });
}

document.getElementById("submit-comment").addEventListener("click", () => {
  const input = document.getElementById("comment-input");
  const text = input.value.trim();
  if (text) {
    saveComment(text);
    input.value = "";
    alert("✅ Thanks! Your comment was submitted.");
  }
});
const commentInput = document.getElementById("comment-input");

// Auto-resize textarea as user types
commentInput.addEventListener("input", () => {
  commentInput.style.height = "auto"; // reset height
  commentInput.style.height = commentInput.scrollHeight + "px"; // set to content height
});

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
  const modal = document.getElementById("instructionsModal");
  const btn = document.getElementById("howToPlayBtn");
  const closeBtn = document.querySelector(".modal .close");

  btn.onclick = () => modal.style.display = "block";
  closeBtn.onclick = () => modal.style.display = "none";
  window.onclick = (event) => {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };

window.onload = () => {
  console.log(`Attempting to load: data/${currentYear}-${currentWeek}.json`);

  populatePastWeeksDropdown(currentWeekInfo);

  document.getElementById("week-picker").addEventListener("change", () => {
    const selected = document.getElementById("week-picker").value;
    const [year, wk] = selected.split("-").map(Number);
    startGameForWeek(year, wk, false); // false = not forced current-week check
  });

  document.getElementById("submit-button").addEventListener("click", checkSelection);
  document.getElementById("shuffle-button").addEventListener("click", shuffleRemainingTiles);
  document.getElementById("leaderboard-button").addEventListener("click", () => {
    window.location.href = "leaderboard.html";
  });

  // ✅ Only enforce "completed" lockout for current week, not past weeks
  const completed = parseInt(localStorage.getItem("completedWeek"));
  if (completed === currentWeek) {
    document.getElementById("feedback").textContent =
      "✅ You've already completed this week's puzzle.";
    document.getElementById("submit-button").disabled = true;
    document.getElementById("shuffle-button").disabled = true;

    const saved = localStorage.getItem("solvedGroups");
    if (saved) {
      solvedGroups = JSON.parse(saved);
      remaining = [];
      renderTiles();
    }
  } else {
    loadPuzzleForWeek(currentYear, currentWeek);
  }
};

function startGameForWeek(year, wk, checkCompletion = true) {
  console.log(`Loading puzzle for: year ${year}, week ${wk}`);

  // Only check localStorage lockout if it's the current week
  if (checkCompletion && year === currentYear && wk === currentWeek) {
    const completed = parseInt(localStorage.getItem("completedWeek"));
    if (completed === currentWeek) {
      document.getElementById("feedback").textContent =
        "✅ You've already completed this week's puzzle.";
      document.getElementById("submit-button").disabled = true;
      document.getElementById("shuffle-button").disabled = true;
      return;
    }
  }

  // ✅ Allow loading normally for past weeks
  document.getElementById("submit-button").disabled = false;
  document.getElementById("shuffle-button").disabled = false;
  loadPuzzleForWeek(year, wk);
}

