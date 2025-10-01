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
function handleTileClick(tile, state) {
  const word = tile.dataset.word;
  if (!tile || tile.classList.contains("disabled") || tile.classList.contains("solved")) return;

  if (tile.classList.contains("selected")) {
    tile.classList.remove("selected");
    state.selectedTiles = state.selectedTiles.filter(w => w !== word);
  } else {
    if (state.selectedTiles.length >= 4) return;
    tile.classList.add("selected");
    state.selectedTiles.push(word);
  }
}


function checkSelection() {
  const state = getActiveWeekState();
  if (!state) return;

  const currentGuess = [...state.selectedTiles].sort().join(",");

  if (state.previousGuesses.includes(currentGuess)) {
    showFeedback("⚠️ You've already tried this combination.");
    return;
  }

  state.previousGuesses.push(currentGuess);

  const match = Object.entries(state.groups).find(([groupName, words]) =>
    words.every(w => state.selectedTiles.includes(w)) &&
    state.selectedTiles.every(w => words.includes(w))
  );

  if (match) {
    markGroupAsSolved(match[1], match[0], state);
  } else {
    const closeMatch = Object.values(state.groups).some(words => {
      const intersection = words.filter(w => state.selectedTiles.includes(w));
      return intersection.length === 3;
    });

    state.wrongGuesses++;
    updateGuessDisplayForState(state);

    if (closeMatch) showFeedback("🟡 So close! You're one away from a correct group.");
    else showFeedback("❌ Incorrect group.");

if (state.wrongGuesses >= maxWrongGuesses) {
  endGame(
    "💥 Game over. You've used all your guesses.",
    state.year,
    state.week
  );
}

    state.selectedTiles = [];
    renderTiles(false, state);
  }
}

function markGroupAsSolved(words, groupName, state) {
  state.solvedGroups.push({ name: groupName, words, revealed: true });
  state.remaining = state.remaining.filter(word => !words.includes(word));

  shuffleArray(state.remaining);

  words.forEach(word => {
    const tileEl = document.querySelector(`.tile[data-word="${word}"]`);
    if (tileEl) tileEl.classList.add("solved");
  });

  state.selectedTiles = [];
  showFeedback(`✅ Correct! Group: ${groupName}`);
  renderTiles(false, state);

if (state.solvedGroups.length === Object.keys(state.groups).length) {
  endGame(
    "🎉 Congratulations! You solved all groups.",
    state.year,
    state.week
  );
}

}


function renderTiles(readOnly = false, state) {
  const { solvedGroups, remaining } = state;
  const tileContainer = document.getElementById("tile-container");
  tileContainer.innerHTML = "";

  if (!readOnly) state.selectedTiles = [];

  solvedGroups.forEach((group, index) => {
    const groupWrapper = document.createElement("div");
    groupWrapper.className = "group-wrapper";

    const label = document.createElement("div");
    label.className = "group-label";
    label.textContent = group.name;
    groupWrapper.appendChild(label);

    const row = document.createElement("div");
    row.className = "solved-row";

    group.words.forEach(word => {
      const tile = createTile(word, true, !!group.revealed);
      if (readOnly) tile.classList.add("disabled");
      tile.style.animationDelay = `${index * 0.2}s`;
      row.appendChild(tile);
    });

    groupWrapper.appendChild(row);
    tileContainer.appendChild(groupWrapper);
  });

  const grid = document.createElement("div");
  grid.className = "unsolved-grid";

  remaining.forEach(word => {
    const tile = createTile(word, false, false);
    if (readOnly) tile.classList.add("disabled");
    grid.appendChild(tile);
  });

  tileContainer.appendChild(grid);
}

function shuffleRemainingTiles(state) {
  shuffleArray(state.remaining);
  renderTiles(false, state);
}

function updateGuessDisplayForState(state) {
  document.getElementById("guesses-left").textContent = `Wrong guesses left: ${maxWrongGuesses - state.wrongGuesses}`;
}


function showFeedback(msg) {
  document.getElementById("feedback").textContent = msg;
}


function resetGame(state) {
  state.selectedTiles = [];
  state.solvedGroups = [];
  state.wrongGuesses = 0;
  document.getElementById("shuffle-button").disabled = false;
  updateGuessDisplayForState(state);

  state.remaining = Object.values(state.groups).flat();
  shuffleArray(state.remaining);

  renderTiles(false, state);
}



function createTile(word, solved = false, revealed = false) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.textContent = word;
  tile.dataset.word = word;

  if (solved) tile.classList.add("solved");
  if (revealed) {
    tile.classList.add("revealed", "disabled");
  } else if (solved) {
    tile.classList.add("disabled");
  }

  return tile;
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
// CELEBRATION
// ---------------------------
function launchConfetti() {
  const duration = 5000; // 5 seconds
  const end = Date.now() + duration;

  (function frame() {
    // burst from random x positions
    confetti({
      particleCount: 8,
      startVelocity: 40,
      spread: 90,
      origin: { x: Math.random(), y: Math.random() - 0.2 },
      scalar: 1.5 // larger pieces
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}

function showCompletionBanner() {
  const banner = document.getElementById("completion-banner");
  banner.classList.remove("hidden");

  // trigger unroll
  setTimeout(() => banner.classList.add("show"), 50);

  // hide after 3 seconds
  setTimeout(() => {
    banner.classList.remove("show");
    setTimeout(() => banner.classList.add("hidden"), 600);
  }, 3000);
}


// ---------------------------
// WEEK-ISOLATED STATE
// ---------------------------
const weekStates = {}; // store state by weekKey


function getWeekKey(year, week) {
  return `${year}-${week}`;
}

function getActiveWeekState() {
  const weekPicker = document.getElementById("week-picker");
  if (weekPicker && weekPicker.value) {
    const [year, week] = weekPicker.value.split("-").map(Number);
    return weekStates[getWeekKey(year, week)];
  }
  return weekStates[getWeekKey(currentYear, currentWeek)];
}

// ---------------------------
// INIT WEEK STATE
// ---------------------------
function initWeekState(year, week, groups) {
  const weekKey = `${year}-${week}`;
  if (!weekStates[weekKey]) {
    weekStates[weekKey] = {
      year,
      week,
      groups,             // the puzzle groups from JSON
      selectedTiles: [],
      solvedGroups: [],
      wrongGuesses: 0,
      remaining: Object.values(groups).flat(),
      previousGuesses: [],
    };
    shuffleArray(weekStates[weekKey].remaining);
  }
  return weekStates[weekKey];
}

// ---------------------------
// START GAME FOR WEEK
// ---------------------------
async function startGameForWeek(year, week) {
  const isCurrentWeek = year === currentYear && week === currentWeek;
  const weekKey = getWeekKey(year, week);

  // Fetch puzzle JSON from /data folder
  let weekGroups;
  try {
    const response = await fetch(`data/${year}-${week}.json`);
    if (!response.ok) throw new Error("Puzzle file not found");
    weekGroups = await response.json();
  } catch (err) {
    console.error("Failed to load puzzle:", err);
    showFeedback("❌ Could not load this week's puzzle.");
    return;
  }

  // Initialize or reuse week state
  const state = initWeekState(year, week, weekGroups);

  // Restore solved groups from localStorage if current week
  if (isCurrentWeek) {
    const saved = localStorage.getItem(`solvedGroups-${weekKey}`);
    if (saved) state.solvedGroups = JSON.parse(saved);
  }

  // Remove solved words from remaining
  const solvedWords = state.solvedGroups.flatMap(g => g.words || []);
  state.remaining = Object.values(weekGroups).flat().filter(w => !solvedWords.includes(w));
  shuffleArray(state.remaining);

  // Determine read-only state and button availability
  const completedWeek = localStorage.getItem("completedWeek");
  const isLocked = isCurrentWeek && completedWeek === weekKey;

  renderTiles(isLocked, state);

  showFeedback(
    isLocked
      ? "✅ You've already completed this week's puzzle!"
      : isCurrentWeek
        ? ""
        : "📅 Archive week — progress won’t affect streaks."
  );

  // Buttons: only disable for a completed current week
  document.getElementById("submit-button").disabled = isLocked;
  document.getElementById("shuffle-button").disabled = isLocked;
}


// ---------------------------
// END GAME (PER WEEK STATE)
// ---------------------------
function endGame(message, year, week) {
  const weekKey = getWeekKey(year, week);
  const state = weekStates[weekKey];
  const isCurrentWeek = year === currentYear && week === currentWeek;

  // Disable buttons
  document.getElementById("shuffle-button").disabled = true;
  document.getElementById("submit-button").disabled = true;

  // Build solved + unsolved groups
  state.solvedGroups = Object.entries(state.groups).map(([groupName, words]) => {
    const solved = state.solvedGroups.some(s => s.name === groupName);
    return solved
      ? state.solvedGroups.find(s => s.name === groupName)
      : { name: groupName + " (Unsolved)", words, revealed: true, unsolved: true };
  });

  renderTiles(true, state);

  // Only update streak for current week
  if (isCurrentWeek) {
    localStorage.setItem("completedWeek", weekKey);
    localStorage.setItem(`solvedGroups-${weekKey}`, JSON.stringify(state.solvedGroups));
  }

  // Trigger modal
  onGameComplete(year, week, state);
}

// ---------------------------
// ON GAME COMPLETE (PER WEEK STATE)
// ---------------------------
function onGameComplete(year, week, state) {
  const isCurrentWeek = year === currentYear && week === currentWeek;

  const solvedCount = state.solvedGroups.filter(
    g => !g.name.includes("(Unsolved)")
  ).length;

  const isPerfect =
    state.wrongGuesses === 0 &&
    solvedCount === Object.keys(state.groups).length;

  // 🎊 Confetti only if at least 1 group solved
  if (solvedCount > 0) {
    launchConfetti();
  }

  let currentStreak = parseInt(localStorage.getItem("winStreak") || "0");

  if (isCurrentWeek) {
    if (isPerfect) {
      const playerName =
        localStorage.getItem("playerName") ||
        prompt("Enter your name:") ||
        "Anonymous";
      localStorage.setItem("playerName", playerName);

      currentStreak += 1;
      localStorage.setItem("winStreak", currentStreak);

      const dbRef = ref(db, "leaderboard/" + playerName);
      set(dbRef, {
        name: playerName,
        streak: currentStreak,
        timestamp: Date.now()
      });
    } else {
      currentStreak = 0;
      localStorage.setItem("winStreak", 0);
    }
  }

  // Modal messages
  const streakMessage = document.getElementById("streakMessage");
  const performanceMessage = document.getElementById("performanceMessage");

  if (isCurrentWeek) {
    streakMessage.textContent =
      currentStreak > 1
        ? `🔥 Current streak: ${currentStreak} perfect weeks!`
        : currentStreak === 1
        ? `🔥 Current streak: 1 perfect week!`
        : `❌ Streak broken — try again next week!`;
  } else {
    streakMessage.textContent = `📅 Archive week — progress won’t affect streaks.`;
  }

  performanceMessage.textContent = isPerfect
    ? "🎉 Amazing! You solved all groups perfectly!"
    : solvedCount > 0
      ? `You solved ${solvedCount} of ${Object.keys(state.groups).length} groups. Great effort!`
      : "No groups solved this time — try again tomorrow!";

if (isCurrentWeek && isPerfect) {
  showCompletionBanner(); // 🎯 Banner only on a perfect game
}
  
  const endPrompt = document.getElementById("endPrompt");
if (endPrompt) {
  endPrompt.classList.remove("hidden");
  endPrompt.scrollIntoView({ behavior: "smooth", block: "center" });
}


}


// ---------------------------
// DOM CONTENT LOADED: INIT
// ---------------------------

window.addEventListener("DOMContentLoaded", () => {
const modal = document.getElementById("instructionsModal");
const btn = document.getElementById("howToPlayBtn");
const closeBtn = modal?.querySelector(".close");
const endPrompt = document.getElementById("endPrompt");
const endPromptClose = document.getElementById("endPromptClose");

btn?.addEventListener("click", () => {
  if (modal) modal.style.display = "block";
});
closeBtn?.addEventListener("click", () => {
  if (modal) modal.style.display = "none";
});
endPromptClose?.addEventListener("click", () => {
  if (endPrompt) endPrompt.classList.add("hidden");
});

  // Populate past weeks dropdown
  populatePastWeeksDropdown(currentWeekInfo);

  // Initialize visitor counter
  initVisitorCounter();

  // Initialize comment box
  initCommentBox();

const tileContainer = document.getElementById("tile-container");
tileContainer?.addEventListener("click", (e) => {
  const tile = e.target.closest(".tile");
  if (!tile) return;
  handleTileClick(tile, getActiveWeekState());
});



  // Past week selection
  const weekPicker = document.getElementById("week-picker");
  if (weekPicker) {
    weekPicker.addEventListener("change", () => {
      const [year, wk] = weekPicker.value.split("-").map(Number);
      startGameForWeek(year, wk);
    });
  }

  // Buttons
  document.getElementById("submit-button").addEventListener("click", checkSelection);
document.getElementById("shuffle-button").addEventListener("click", () => {
  const state = getActiveWeekState();
  shuffleRemainingTiles(state);
});

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
  startGameForWeek(currentYear, currentWeek);
});
