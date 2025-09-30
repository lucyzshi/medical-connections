// ---------------------------
// FIREBASE IMPORTS & INIT
// ---------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getDatabase, ref, push, set, runTransaction, get } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-analytics.js";

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

// ---------------------------
// GLOBAL VARIABLES
// ---------------------------
let groups = {};
let selectedTiles = [];
let solvedGroups = [];
let wrongGuesses = 0;
let remaining = [];
let previousGuesses = [];
const maxWrongGuesses = 4;

// ---------------------------
// HELPER FUNCTIONS (WEEKS, SHUFFLE, TILES, FEEDBACK)
// ---------------------------

// Get current ISO week and year
function getCurrentISOWeekInfo() {
  const now = new Date();
  const dayNum = now.getUTCDay() || 7;
  now.setUTCDate(now.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((now - yearStart) / 86400000) + 1) / 7);
  return { year: now.getUTCFullYear(), week };
}
const currentWeekInfo = getCurrentISOWeekInfo();
const currentWeek = currentWeekInfo.week;
const currentYear = currentWeekInfo.year;

// ISO week helpers
function getISOWeeksInYear(year) {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const day = dec28.getUTCDay() || 7;
  dec28.setUTCDate(dec28.getUTCDate() + 4 - day);
  const startOfYear = new Date(Date.UTC(dec28.getUTCFullYear(), 0, 1));
  return Math.ceil((((dec28 - startOfYear) / 86400000) + 1) / 7);
}

function getStartOfISOWeek(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
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
function populatePastWeeksDropdown(currentWeekInfo) {
  const weekPicker = document.getElementById("week-picker");
  if (!weekPicker) return; // Exit if the dropdown doesn't exist

  weekPicker.innerHTML = ""; // Clear existing options

  const { week: currentWeek, year: currentYear } = currentWeekInfo;

  for (let i = 1; i < 6; i++) {
    let week = currentWeek - i;
    let year = currentYear;

    // Handle previous year wrap-around
    if (week <= 0) {
      year -= 1;
      week += getISOWeeksInYear(year);
    }

    const option = document.createElement("option");
    option.value = `${year}-${week}`;
    option.textContent = `${formatWeekRange(year, week)}`;
    weekPicker.appendChild(option);
  }

  weekPicker.value = "";
}

// Shuffle helper
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ---------------------------
// GAME LOGIC FUNCTIONS
// ---------------------------
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
    const closeMatch = Object.values(groups).some(words => {
      const intersection = words.filter(w => selectedTiles.includes(w));
      return intersection.length === 3;
    });

    wrongGuesses++;
    updateGuessDisplay();

    if (closeMatch) showFeedback("🟡 So close! You're one away from a correct group.");
    else showFeedback("❌ Incorrect group.");

    if (wrongGuesses >= maxWrongGuesses) endGame("💥 Game over. You've used all your guesses.");

    selectedTiles = [];
    renderTiles();
  }
}

function markGroupAsSolved(words, groupName) {
  solvedGroups.push({ name: groupName, words });
  remaining = remaining.filter(word => !words.includes(word));

  words.forEach(word => {
    const tileEl = document.querySelector(`.tile[data-word="${word}"]`);
    if (tileEl) tileEl.classList.add("solved");
  });

  selectedTiles = [];
  showFeedback(`✅ Correct! Group: ${groupName}`);
  renderTiles();

  if (solvedGroups.length === Object.keys(groups).length) {
    endGame("🎉 Congratulations! You solved all groups.");
  }
}

function showFeedback(msg) {
  document.getElementById("feedback").textContent = msg;
}


function updateGuessDisplay() {
  document.getElementById("guesses-left").textContent = `Wrong guesses left: ${maxWrongGuesses - wrongGuesses}`;
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

function renderTiles(readOnly = false) {
  const tileContainer = document.getElementById("tile-container");
  tileContainer.innerHTML = "";

  if (!readOnly) selectedTiles = [];

  // Solved Groups at top
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
      if (readOnly) tile.classList.add("disabled");
      row.appendChild(tile);
    });

    groupWrapper.appendChild(row);
    tileContainer.appendChild(groupWrapper);
  });

  const grid = document.createElement("div");
  grid.className = "unsolved-grid";

  remaining.forEach(word => {
    const tile = createTile(word, false);
    if (readOnly) tile.classList.add("disabled");
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

// ---------------------------
// FIREBASE VISITOR COUNTER
// ---------------------------
function initVisitorCounter() {
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
    get(visitRef).then(snapshot => {
      document.getElementById("visit-count").textContent = snapshot.val();
    });
  }
}

// ---------------------------
// COMMENTS
// ---------------------------
function saveComment(text) {
  const commentsRef = ref(db, "comments");
  const newComment = push(commentsRef);
  set(newComment, { text, timestamp: Date.now() })
    .then(() => console.log("Comment saved!"))
    .catch(err => console.error("Error saving comment:", err));
}

function initCommentBox() {
  const commentInput = document.getElementById("comment-input");
  const submitBtn = document.getElementById("submit-comment");
  if (!commentInput || !submitBtn) return;

  commentInput.addEventListener("input", () => {
    commentInput.style.height = "auto";
    commentInput.style.height = commentInput.scrollHeight + "px";
  });

  submitBtn.addEventListener("click", () => {
    const text = commentInput.value.trim();
    if (!text) return;
    saveComment(text);
    commentInput.value = "";
    commentInput.style.height = "auto";
    alert("✅ Thanks! Your comment was submitted.");
  });

  commentInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitBtn.click();
    }
  });
}

// ---------------------------
// CONFETTI
// ---------------------------
function launchConfetti() {
  confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
}

// ---------------------------
// ON GAME COMPLETE
// ---------------------------
function onGameComplete(year = currentYear, wk = currentWeek) {
  const isCurrentWeek = year === currentYear && wk === currentWeek;

  // Perfect means NO wrong guesses and all groups solved
  const isPerfect = wrongGuesses === 0 && solvedGroups.filter(g => !g.name.includes("(Unsolved)")).length === Object.keys(groups).length;

  let currentStreak = parseInt(localStorage.getItem("winStreak") || "0");

  if (isCurrentWeek) {
    if (isPerfect) {
      const playerName = localStorage.getItem("playerName") || prompt("Enter your name:") || "Anonymous";
      localStorage.setItem("playerName", playerName);

      currentStreak += 1;
      localStorage.setItem("winStreak", currentStreak);

      const dbRef = ref(db, "leaderboard/" + playerName);
      set(dbRef, { name: playerName, streak: currentStreak, timestamp: Date.now() });
    } else {
      currentStreak = 0;
      localStorage.setItem("winStreak", 0);
    }

    launchConfetti();
  }

  // ✅ Always show end prompt, even for past weeks
  const endPrompt = document.getElementById("endPrompt");
  const streakMessage = document.getElementById("streakMessage");
  const performanceMessage = document.getElementById("performanceMessage");
  const endPromptTitle = document.getElementById("endPromptTitle");
  const endPromptClose = document.getElementById("endPromptClose");
  

  const solvedCount = solvedGroups.filter(g => !g.name.includes("(Unsolved)")).length;

  if (isCurrentWeek) {
    if (currentStreak > 1) {
      streakMessage.textContent = `🔥 Current streak: ${currentStreak} perfect weeks!`;
    } else if (currentStreak === 1) {
      streakMessage.textContent = `🔥 Current streak: 1 perfect week!`;
    } else {
      streakMessage.textContent = `❌ Streak broken — try again next week!`;
    }
  } else {
    streakMessage.textContent = "📅 Archive week — streak not affected.";
  }

  if (isPerfect) {
    performanceMessage.textContent = "🎉 Amazing! You solved all groups perfectly!";
    endPromptTitle.textContent = "🎉 Perfect Solve!";
  } else {
    performanceMessage.textContent = `You solved ${solvedCount} of ${Object.keys(groups).length} groups. Great effort!`;
    endPromptTitle.textContent = "Puzzle Complete!";
  }

  // Show the modal
  endPrompt?.classList.remove("hidden");

  // Attach one-time modal close events
  endPromptClose?.addEventListener("click", () => endPrompt.classList.add("hidden"), { once: true });
  window.addEventListener("click", function handleOutsideClick(event) {
    if (event.target === endPrompt) {
      endPrompt.classList.add("hidden");
      window.removeEventListener("click", handleOutsideClick);
    }
  });
}

// ---------------------------
// END / START GAME FUNCTIONS
// ---------------------------
function endGame(message, year = currentYear, wk = currentWeek) {
  showFeedback(message);
  document.querySelectorAll(".tile").forEach(t => t.classList.add("disabled"));
  document.getElementById("shuffle-button").disabled = true;

  // Add unsolved groups
  const unsolved = Object.entries(groups).filter(([groupName]) =>
    !solvedGroups.some(s => s.name === groupName)
  );

  unsolved.forEach(([groupName, words]) => {
    solvedGroups.push({ name: groupName + " (Unsolved)", words });
  });

  // Save solved groups only for the week actually being played
  const weekKey = `${year}-${wk}`;
  if (!(year < currentYear || (year === currentYear && wk < currentWeek))) {
    // Only save for current week or future weeks (never save past weeks)
    localStorage.setItem("completedWeek", weekKey);
    localStorage.setItem(`solvedGroups-${weekKey}`, JSON.stringify(solvedGroups));
  }

  renderTiles();
  onGameComplete(year, wk);
}


async function loadPuzzleForWeek(year, week) {
  const url = `data/${year}-${week}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Game not found.");
    groups = await response.json();
    resetGame();
  } catch {
    document.getElementById("feedback").textContent =
      "❌ No game found for this week. Please check back later.";
    document.getElementById("shuffle-button").disabled = true;
  }
}

function startGameForWeek(year, wk, enforceLockout = true) {
  const isCurrentWeek = year === currentYear && wk === currentWeek;
  const completedWeek = localStorage.getItem("completedWeek");
  const weekKey = `${year}-${wk}`;
  const alreadyCompleted = enforceLockout && isCurrentWeek && completedWeek === weekKey;

  // Reset state
  selectedTiles = [];
  solvedGroups = [];
  wrongGuesses = 0;
  previousGuesses = [];
  remaining = [];

  // Load puzzle
  loadPuzzleForWeek(year, wk).then(() => {
    if (alreadyCompleted) {
      // Disable interactions only for already completed current week
      document.getElementById("submit-button").disabled = true;
      document.getElementById("shuffle-button").disabled = true;

      renderTiles(true); // read-only
      showFeedback("✅ You've already completed this week's puzzle.");
    } else {
      // Normal play for current week or any past week
      renderTiles(false); // interactive
      document.getElementById("submit-button").disabled = false;
      document.getElementById("shuffle-button").disabled = false;
    }
  });
}


// ---------------------------
// DOM CONTENT LOADED: INIT
// ---------------------------

window.addEventListener("DOMContentLoaded", () => {
  const endPrompt = document.getElementById("endPrompt");
  const endPromptClose = document.getElementById("endPromptClose");
  const modal = document.getElementById("instructionsModal");
  const btn = document.getElementById("howToPlayBtn");
  const closeBtn = modal?.querySelector(".close");

  // Close endPrompt
  endPromptClose?.addEventListener("click", () => {
    endPrompt.classList.add("hidden");
  });

  // Click outside to close
  window.addEventListener("click", (event) => {
    if (event.target === endPrompt) endPrompt.classList.add("hidden");
    if (event.target === modal) modal.style.display = "none";
  });

  // Instructions modal
  btn?.addEventListener("click", () => modal.style.display = "block");
  closeBtn?.addEventListener("click", () => modal.style.display = "none");

  // Populate past weeks dropdown
  populatePastWeeksDropdown(currentWeekInfo);

  // Initialize visitor counter
  initVisitorCounter();

  // Initialize comment box
  initCommentBox();

  // Tile click delegation
  const tileContainer = document.getElementById("tile-container");
  tileContainer.addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (!tile || tile.classList.contains("disabled") || tile.classList.contains("solved")) return;
    handleTileClick(tile);
  });

  // Past week selection
  const weekPicker = document.getElementById("week-picker");
  if (weekPicker) {
    weekPicker.addEventListener("change", () => {
      const [year, wk] = weekPicker.value.split("-").map(Number);
      startGameForWeek(year, wk, false);
    });
  }

  // Buttons
  document.getElementById("submit-button").addEventListener("click", checkSelection);
  document.getElementById("shuffle-button").addEventListener("click", shuffleRemainingTiles);

  // Leaderboard button
  const leaderboardBtn = document.getElementById("leaderboard-button");
  if (leaderboardBtn) leaderboardBtn.addEventListener("click", () => window.location.href = "leaderboard.html");

  // Social share buttons
  const gameURL = encodeURIComponent("https://lucyzshi.github.io/medical-connections/");
  const message = encodeURIComponent("Check out this fun game with a medical twist. I just completed this week's puzzle! Can you beat me? 🎉");
  document.getElementById("twitter-share")?.setAttribute("href", `https://twitter.com/intent/tweet?text=${message}&url=${gameURL}`);
  document.getElementById("bluesky-share")?.setAttribute("href", `https://bsky.app/intent/post?text=${message} ${gameURL}`);
  document.getElementById("linkedin-share")?.setAttribute("href", `https://www.linkedin.com/sharing/share-offsite/?url=${gameURL}`);
  document.getElementById("reddit-share")?.setAttribute("href", `https://www.reddit.com/submit?url=${gameURL}&title=${message}`);
  document.getElementById("instagram-share")?.addEventListener("click", (e) => {
    e.preventDefault();
    alert("📸 To share on Instagram, take a screenshot of your score and post it on your feed or story!");
  });


  // Start current week
  startGameForWeek(currentYear, currentWeek, true);
});
