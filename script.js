import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getDatabase, ref, push, set, runTransaction, get } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-analytics.js";  // 👈 separate import

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

const analytics = getAnalytics(app);


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
  
  words.forEach(word => {
    const tileEl = document.querySelector(`.tile[data-word="${word}"]`);
    if (tileEl) {
      tileEl.classList.add("solved");
    }
  });
  
  selectedTiles = [];
  showFeedback(`✅ Correct! Group: ${groupName}`);
  renderTiles();

if (solvedGroups.length === Object.keys(groups).length) {
  endGame("🎉 Congratulations! You solved all groups.");
}

}
function showEndPrompt() {
  document.getElementById("endPrompt").classList.remove("hidden");
  launchConfetti();
}

function closePrompt() {
  document.getElementById("endPrompt").classList.add("hidden");
}

function endGame(message, year = currentYear, wk = currentWeek) {
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


  if (year === currentYear && wk === currentWeek) {
    localStorage.setItem("completedWeek", `${currentYear}-${currentWeek}`);
    localStorage.setItem("solvedGroups", JSON.stringify(solvedGroups));
  }
  onGameComplete();
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

  // Reset selected tiles
  selectedTiles = [];

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


// Save a comment to Firebase
function saveComment(text) {
  const commentsRef = ref(db, "comments");
  const newComment = push(commentsRef);
  set(newComment, {
    text: text,
    timestamp: Date.now()
  }).then(() => {
    console.log("Comment saved!");
  }).catch(err => {
    console.error("Error saving comment:", err);
  });
}

// Initialize the comment box
function initCommentBox() {
  const commentInput = document.getElementById("comment-input");
  const submitBtn = document.getElementById("submit-comment");

  if (!commentInput || !submitBtn) return; // Safety check

  // Auto-resize textarea as user types
  commentInput.addEventListener("input", () => {
    commentInput.style.height = "auto"; // Reset height
    commentInput.style.height = commentInput.scrollHeight + "px"; // Adjust to content
  });

  // Submit comment on button click
  submitBtn.addEventListener("click", () => {
    const text = commentInput.value.trim();
    if (!text) return; // Don't submit empty comments

    saveComment(text);
    commentInput.value = "";
    commentInput.style.height = "auto";
    alert("✅ Thanks! Your comment was submitted.");
  });

  // Optional: Submit comment on Enter key (mobile-friendly)
  commentInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitBtn.click();
    }
  });
}

// Call init after DOM loads
window.addEventListener("DOMContentLoaded", initCommentBox);

function launchConfetti() {
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.6 }
  });
}

function onGameComplete(year = currentYear, wk = currentWeek) {
  const isCurrentWeek = year === currentYear && wk === currentWeek;

  const isPerfect =
    isCurrentWeek &&
    wrongGuesses === 0 &&
    solvedGroups.length === Object.keys(groups).length;

  let currentStreak = 0;

  if (isCurrentWeek) {
    if (isPerfect) {
      const playerName =
        localStorage.getItem("playerName") ||
        prompt("Enter your name:") ||
        "Anonymous";
      localStorage.setItem("playerName", playerName);

      currentStreak =
        parseInt(localStorage.getItem("winStreak") || "0") + 1;
      localStorage.setItem("winStreak", currentStreak);

      // ✅ Only update leaderboard for current week
      const dbRef = ref(db, "leaderboard/" + playerName);
      set(dbRef, {
        name: playerName,
        streak: currentStreak,
        timestamp: Date.now(),
      });
    } else {
      // Reset streak only for current week
      currentStreak = 0;
      localStorage.setItem("winStreak", 0);
    }

    // Confetti only for current week
    launchConfetti();

    // Update messages
    const streakMessage = document.getElementById("streakMessage");
    const performanceMessage = document.getElementById("performanceMessage");
    const endPromptTitle = document.getElementById("endPromptTitle");

    if (currentStreak > 1) {
      streakMessage.textContent = `🔥 Current streak: ${currentStreak} perfect weeks!`;
    } else if (currentStreak === 1) {
      streakMessage.textContent = `🔥 Current streak: 1 perfect week!`;
    } else {
      streakMessage.textContent = `❌ Streak broken — try again next week!`;
    }

    if (isPerfect) {
      performanceMessage.textContent = "🎉 Amazing! You solved all groups perfectly!";
      endPromptTitle.textContent = "🎉 Perfect Solve!";
    } else {
      performanceMessage.textContent = `You solved ${solvedGroups.length} of ${Object.keys(groups).length} groups. Great effort!`;
      endPromptTitle.textContent = "Puzzle Complete!";
    }

    showEndPrompt();
  } else {
    // Past week: no leaderboard, no confetti, no streak update
    console.log("Past week completed — leaderboard not updated.");
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
// ---------------------------
// WINDOW ONLOAD
// ---------------------------
window.addEventListener("DOMContentLoaded", () => {
  console.log(`Loading current week: data/${currentYear}-${currentWeek}.json`);

  // Populate past weeks dropdown
  populatePastWeeksDropdown(currentWeekInfo);

  // Tile click delegation
  const tileContainer = document.getElementById("tile-container");
  tileContainer.addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (!tile || tile.classList.contains("disabled") || tile.classList.contains("solved")) return;
    handleTileClick(tile);
  });

  // Past week selection
  const weekPicker = document.getElementById("week-picker");
  weekPicker.addEventListener("change", () => {
    const [year, wk] = weekPicker.value.split("-").map(Number);
    startGameForWeek(year, wk, false); // false = don't enforce current-week lockout
  });

  // Buttons
  document.getElementById("submit-button").addEventListener("click", checkSelection);
  document.getElementById("shuffle-button").addEventListener("click", shuffleRemainingTiles);

  // Leaderboard button
  const leaderboardBtn = document.getElementById("leaderboard-button");
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener("click", () => window.location.href = "leaderboard.html");
  }

  // Instructions modal (single initialization)
  const modal = document.getElementById("instructionsModal");
  const btn = document.getElementById("howToPlayBtn");
  const closeBtn = modal.querySelector(".close");

  btn.onclick = () => modal.style.display = "block";
  closeBtn.onclick = () => modal.style.display = "none";
  window.onclick = (event) => {
    if (event.target === modal) modal.style.display = "none";
  };

  // ✅ Load current week by default
  const completedWeek = localStorage.getItem("completedWeek");
  if (completedWeek === `${currentYear}-${currentWeek}`) {
    // Already completed current week: load saved state
    solvedGroups = JSON.parse(localStorage.getItem("solvedGroups") || "[]");
    remaining = [];
    renderTiles();

    document.getElementById("feedback").textContent = "✅ You've already completed this week's puzzle.";
    document.getElementById("submit-button").disabled = true;
    document.getElementById("shuffle-button").disabled = true;
  }

  // Load the current week puzzle fresh
  startGameForWeek(currentYear, currentWeek, true); // true = enforce current week lockout
});

// ---------------------------
// START GAME FUNCTION
// ---------------------------
function startGameForWeek(year, wk, enforceLockout = true) {
  console.log(`Starting game for year ${year}, week ${wk}`);
  const isCurrentWeek = year === currentYear && wk === currentWeek;

  // Lockout check for current week
  if (enforceLockout && isCurrentWeek) {
    const completed = localStorage.getItem("completedWeek");
    if (completed === `${currentYear}-${currentWeek}`) {
      document.getElementById("feedback").textContent =
        "✅ You've already completed this week's puzzle.";
      document.getElementById("submit-button").disabled = true;
      document.getElementById("shuffle-button").disabled = true;
      return;
    }
  }

  // Enable buttons
  document.getElementById("submit-button").disabled = false;
  document.getElementById("shuffle-button").disabled = false;

  // Reset state for the week
  selectedTiles = [];
  solvedGroups = [];
  wrongGuesses = 0;
  previousGuesses = [];
  remaining = [];

  // Load puzzle JSON
  loadPuzzleForWeek(year, wk);
}

// ---------------------------
// END GAME FUNCTION
// ---------------------------
function endGame(message, year = currentYear, wk = currentWeek) {
  showFeedback(message);

  // Disable all tiles
  document.querySelectorAll(".tile").forEach(t => t.classList.add("disabled"));
  document.getElementById("shuffle-button").disabled = true;

  const isCurrentWeek = year === currentYear && wk === currentWeek;

  // Only save solved groups / localStorage for current week
  if (isCurrentWeek) {
    localStorage.setItem("completedWeek", `${currentYear}-${currentWeek}`);
    localStorage.setItem("solvedGroups", JSON.stringify(solvedGroups));
  }

  renderTiles(); // Re-render solved/unsolved tiles

  // Call leaderboard/confetti logic only for current week
  if (isCurrentWeek) {
    onGameComplete(year, wk);
  }
}

  const gameURL = encodeURIComponent("https://lucyzshi.github.io/medical-connections/");
const message = encodeURIComponent(`Check out this fun game with a medical twist. I just completed this week's puzzle! Can you beat me? 🎉`);

// Twitter
document.getElementById("twitter-share").href =
  `https://twitter.com/intent/tweet?text=${message}&url=${gameURL}`;

// Bluesky
document.getElementById("bluesky-share").href =
  `https://bsky.app/intent/post?text=${message} ${gameURL}`;

// LinkedIn
document.getElementById("linkedin-share").href =
  `https://www.linkedin.com/sharing/share-offsite/?url=${gameURL}`;

// Reddit
document.getElementById("reddit-share").href =
  `https://www.reddit.com/submit?url=${gameURL}&title=${message}`;

// Instagram (manual share)
document.getElementById("instagram-share").href = "https://www.instagram.com/";
document.getElementById("instagram-share").addEventListener("click", (e) => {
  e.preventDefault();
  alert("📸 To share on Instagram, take a screenshot of your score and post it on your feed or story!");
});


