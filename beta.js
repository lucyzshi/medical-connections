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

function logVisit(DiscoveryRounds) {
  const sessionKey = `visited-${DiscoveryRounds}`;

  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, "true");

  // increment game-specific counter
  const gameRef = ref(db, `visits/${DiscoveryRounds}`);
  runTransaction(gameRef, current => (current || 0) + 1);

  // increment total counter
  const totalRef = ref(db, `visits/total`);
  runTransaction(totalRef, current => (current || 0) + 1);
}

let rounds = [];
let currentRoundIndex = 0;
let currentClueIndex = 0;
let totalScore = 0;
let history = [];
let currentPuzzleId = "";

// DOM
const eventEl = document.getElementById("event");
const guessInput = document.getElementById("guess");
const feedbackEl = document.getElementById("feedback");
const progressEl = document.getElementById("progress");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const clueBtn = document.getElementById("clueBtn");
const finalEl = document.getElementById("final");

// ------------------ WEEK LOGIC (UNCHANGED) ------------------
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
  const options = { timeZone: "UTC", month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", options)} – ${end.toLocaleDateString("en-US", options)}, ${year}`;
}

// ------------------ LOAD PUZZLE ------------------

async function loadPuzzle(year = currentYear, week = currentWeek) {
  const Week = String(week).padStart(2, "0");
  const filePath = `Discovery/${year}-${Week}.json`;

  try {
    const res = await fetch(filePath);
    if (!res.ok) throw new Error("File not found");

    const data = await res.json();

    rounds = data.rounds;
    currentPuzzleId = `${year}-${Week}`;

    loadRound();
  } catch (err) {
    console.error("Error loading puzzle:", err);
    loadPreviousWeek(year, week);
  }
}

function loadPreviousWeek(year, week) {
  week -= 1;
  if (week <= 0) {
    year -= 1;
    week = getISOWeeksInYear(year);
  }
  loadPuzzle(year, week);
}

// ------------------ GAME LOGIC ------------------

function updateProgressBar() {
  const progressPercent = ((currentRoundIndex + 1) / rounds.length) * 100;
  document.getElementById("progress-bar").style.width = `${progressPercent}%`;
}

function loadRound() {
  const round = rounds[currentRoundIndex];

  currentClueIndex = 0;

  eventEl.innerHTML = "";
  addClue(0);

  progressEl.textContent = `Round ${currentRoundIndex + 1} of ${rounds.length}`;

  updateProgressBar();

  feedbackEl.textContent = "";
  guessInput.value = "";
  guessInput.disabled = false;

  submitBtn.classList.remove("hidden");
  nextBtn.classList.add("hidden");
  clueBtn.classList.remove("hidden");
}
// Reveal next clue
clueBtn?.addEventListener("click", () => {
  const round = rounds[currentRoundIndex];

  if (currentClueIndex < round.clues.length - 1) {
    currentClueIndex++;
    addClue(currentClueIndex);
  }
});

function addClue(index) {
  const round = rounds[currentRoundIndex];

  const clueDiv = document.createElement("div");
  clueDiv.className = "clue";
  clueDiv.textContent = `Clue ${index + 1}: ${round.clues[index]}`;

  eventEl.appendChild(clueDiv);
  
clueDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Score function
function calculateScore(isCorrect, clueIndex) {
  if (!isCorrect) return 0;

  // clueIndex: 0,1,2 → points: 3,2,1
  return 3 - clueIndex;
}

// Normalize answers
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Levenshtein distance (typo tolerance)
function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function isCloseMatch(guess, answers) {
  const normGuess = normalize(guess);

  return answers.some(ans => {
    const normAns = normalize(ans);

    // Exact match
    if (normGuess === normAns) return true;

    // Allow small typos
    const dist = levenshtein(normGuess, normAns);

    return dist <= 2; // tolerance level
  });
}

// Submit guess
submitBtn.addEventListener("click", () => {
  const guessRaw = guessInput.value;
  if (!guessRaw) return;

  const round = rounds[currentRoundIndex];

  const isCorrect = isCloseMatch
    ? isCloseMatch(guessRaw, round.answer)
    : round.answer.map(normalize).includes(normalize(guessRaw));

  // -----------------------
  // ✅ CORRECT
  // -----------------------
  if (isCorrect) {
    const score = calculateScore(true, currentClueIndex);
    totalScore += score;

    feedbackEl.textContent = `Correct! +${score} point${score === 1 ? "" : "s"}`;

    history.push({
      cluesUsed: currentClueIndex + 1,
      guess: guessRaw,
      correct: round.answer[0],
      score
    });

    endRound();
    return;
  }

  // -----------------------
  // ❌ WRONG ANSWER
  // -----------------------
  const isLastClue = currentClueIndex >= round.clues.length - 1;

  if (!isLastClue) {
    // 👉 MOVE TO NEXT CLUE
    currentClueIndex++;
    addClue(currentClueIndex);

    feedbackEl.textContent = "❌ Not quite—here's another clue.";
    guessInput.value = "";
    return;
  }

  // -----------------------
  // ❌ WRONG + LAST CLUE → END ROUND
  // -----------------------
  feedbackEl.textContent = `❌ Incorrect. Answer: ${round.answer[0]}`;

  history.push({
    cluesUsed: currentClueIndex + 1,
    guess: guessRaw,
    correct: round.answer[0],
    score: 0
  });

  endRound();
});

// Next round
nextBtn.addEventListener("click", () => {
  if (!guessInput.disabled) return;

  if (currentRoundIndex === rounds.length - 1) {
    showFinal();
  } else {
    currentRoundIndex++;
    loadRound();
  }
});

// Enter key submit
guessInput.addEventListener("keydown", (e) => {
  if (
    e.key === "Enter" &&
    !guessInput.disabled &&
    !submitBtn.classList.contains("hidden")
  ) {
    submitBtn.click();
  }
});

function endRound() {
  guessInput.disabled = true;
  submitBtn.classList.add("hidden");
  clueBtn.classList.add("hidden");
  nextBtn.classList.remove("hidden");

  nextBtn.textContent =
    currentRoundIndex === rounds.length - 1 ? "Finish" : "Next";
}
// ------------------ FINAL SCREEN ------------------

function showFinal() {
  document.getElementById("game").classList.add("hidden");
  finalEl.classList.remove("hidden");
  document.getElementById("progress-bar").style.width = "100%";

  let html = `<h2>Final Score: ${totalScore} / ${rounds.length * 3}</h2>`;
  html += `<div class="summary">`;

  history.forEach((h, i) => {
    const isCorrect = h.score > 0;

    html += `
      <p>
        <strong>Round ${i + 1}</strong><br>
        Your guess: ${h.guess} | 
        Correct: ${h.correct} | 
        Clues used: ${h.cluesUsed} |
        <span style="color:${isCorrect ? 'green' : 'red'}">
          ${isCorrect ? 'Correct' : 'Incorrect'}
        </span>
      </p>
    `;
  });

  html += `</div><button onclick="location.reload()">Play Again</button>`;

  localStorage.setItem(
    currentPuzzleId,
    JSON.stringify({
      totalScore,
      history
    })
  );

  finalEl.innerHTML = html;
}

// ------------------ INIT ------------------

loadPuzzle();
