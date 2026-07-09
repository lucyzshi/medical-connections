// ---------------------------
// FIREBASE IMPORTS & INIT
// ---------------------------
import {  initializeApp,  getApps,  getApp} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getDatabase, ref, push, set, runTransaction, onValue } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
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

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);
const db = getDatabase(app);
let analytics;

try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Analytics unavailable:", e);
}

let rounds = [];
let currentRoundIndex = 0;
let currentClueIndex = 0;
let totalScore = 0;
let history = [];
let currentPuzzleId = "";
let awaitingNextRound = false;

// DOM
const eventEl = document.getElementById("event");
const guessInput = document.getElementById("guess");
const feedbackEl = document.getElementById("feedback");
const progressEl = document.getElementById("progress");
const submitBtn = document.getElementById("submitBtn");
const finalEl = document.getElementById("final");
const url = window.location.href;

// ------------------ TWICE-WEEKLY LOGIC ------------------

function getCurrentPuzzleInfo() {
  const now = new Date();

  // ISO week calculation
  const temp = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));

  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));

  const week = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);

  // Monday–Wednesday = A
  // Thursday–Sunday = B
  const currentDay = now.getUTCDay() || 7;

  const half = currentDay <= 3 ? "A" : "B";

  return {
    year: temp.getUTCFullYear(),
    week,
    half
  };
}

const currentPuzzleInfo = getCurrentPuzzleInfo();

const currentWeek = currentPuzzleInfo.week;
const currentYear = currentPuzzleInfo.year;
const currentHalf = currentPuzzleInfo.half;

function getISOWeeksInYear(year) {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const day = dec28.getUTCDay() || 7;

  dec28.setUTCDate(dec28.getUTCDate() + 4 - day);

  const startOfYear = new Date(Date.UTC(dec28.getUTCFullYear(), 0, 1));

  return Math.ceil((((dec28 - startOfYear) / 86400000) + 1) / 7);
}

function getPuzzleDate(year, week, half) {

  // Find Monday of the ISO week
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;

  const monday = new Date(jan4);

  monday.setUTCDate(
    jan4.getUTCDate() - day + 1 + (week - 1) * 7
  );

  // B puzzle is Thursday
  if (half === "B") {
    monday.setUTCDate(monday.getUTCDate() + 3);
  }

  return monday;
}

function getRecentPuzzles(count = 5) {

  let year = currentYear;
  let week = currentWeek;
  let half = currentHalf;

  const puzzles = [];

  for (let i = 0; i < count; i++) {

    puzzles.push({
      year,
      week,
      half
    });

    // move backwards

    if (half === "B") {

      half = "A";

    } else {

      half = "B";
      week--;

      if (week <= 0) {
        year--;
        week = getISOWeeksInYear(year);
      }

    }

  }

  return puzzles;

}

// ------------------ LOAD PUZZLE ------------------
async function loadPuzzle(year = currentYear, week = currentWeek, half = currentHalf) {

  const Week = String(week).padStart(2, "0");

  const filePath = `Discovery/${year}-${Week}-${half}.json`;

  try {
    const res = await fetch(filePath);

    if (!res.ok) throw new Error("File not found");

    const data = await res.json();

    rounds = data.rounds;
    currentPuzzleId = `${year}-${Week}-${half}`;
    loadRound();

  } catch (err) {
  console.error("Error loading puzzle:", err);
  loadPreviousPuzzle(year, week, half);
}
}

function loadPreviousPuzzle(year, week, half) {

  // If current puzzle is B, fall back to A of same week
  if (half === "B") {
    half = "A";
  }

  // If current puzzle is A, go to previous week's B
  else {
    week -= 1;

    if (week <= 0) {
      year -= 1;
      week = getISOWeeksInYear(year);
    }

    half = "B";
  }

  loadPuzzle(year, week, half);
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

awaitingNextRound = false;

submitBtn.classList.remove("hidden");
submitBtn.textContent = "Submit";

}

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

  const answerArray = Array.isArray(answers)
    ? answers
    : [answers];

  return answerArray.some(ans => {
    const normAns = normalize(ans);

    // Exact match
    if (normGuess === normAns) return true;

    return (
      levenshtein(normGuess, normAns) <= 1 &&
      normGuess[0] === normAns[0] &&
      Math.abs(normGuess.length - normAns.length) <= 1
    );
  });
}

// Submit guess
// Submit guess
submitBtn.addEventListener("click", () => {

  // -----------------------
  // NEXT / FINISH BUTTON MODE
  // -----------------------
  if (awaitingNextRound) {
    if (currentRoundIndex === rounds.length - 1) {
      showFinal();
    } else {
      currentRoundIndex++;
      loadRound();
    }
    return;
  }

  const guessRaw = guessInput.value.trim();
  const round = rounds[currentRoundIndex];

  // -----------------------
  // BLANK SUBMISSION
  // -----------------------
  if (!guessRaw) {

    const isLastClue =
      currentClueIndex >= round.clues.length - 1;

    // Reveal another clue
    if (!isLastClue) {
      currentClueIndex++;
      addClue(currentClueIndex);

feedbackEl.textContent =
  "";
      
      return;
    }

    // No guess on final clue
    const correctAnswer = Array.isArray(round.answer)
      ? round.answer[0]
      : round.answer;

    feedbackEl.textContent =
      `Answer: ${correctAnswer}`;

history.push({
  cluesUsed: currentClueIndex + 1,
  guess: guessRaw,
  correct: correctAnswer,
  score: 0,
  clues: [...round.clues]
});

    endRound();
    return;
  }

  // -----------------------
  // CHECK ANSWER
  // -----------------------
  const isCorrect =
    isCloseMatch(guessRaw, round.answer);

  // -----------------------
  // CORRECT
  // -----------------------
  if (isCorrect) {

    const score =
      calculateScore(true, currentClueIndex);

    totalScore += score;

    feedbackEl.textContent =
      `Correct! +${score} point${score === 1 ? "" : "s"}`;

    // Reveal remaining clues
    if (currentClueIndex < round.clues.length - 1) {
      for (
        let i = currentClueIndex + 1;
        i < round.clues.length;
        i++
      ) {
        addClue(i);
      }
    }

    celebrateRound(currentClueIndex + 1);

    const correctAnswer = Array.isArray(round.answer)
      ? round.answer[0]
      : round.answer;

history.push({
  cluesUsed: currentClueIndex + 1,
  guess: guessRaw,
  correct: correctAnswer,
  score,
  clues: [...round.clues]
});

    endRound();
    return;
  }

  // -----------------------
  // WRONG ANSWER
  // -----------------------
  const isLastClue =
    currentClueIndex >= round.clues.length - 1;

  if (!isLastClue) {

    currentClueIndex++;
    addClue(currentClueIndex);

    feedbackEl.textContent =
      "❌ Not quite—here's another clue.";

    guessInput.value = "";

    return;
  }

  // -----------------------
  // WRONG ON FINAL CLUE
  // -----------------------
  const correctAnswer = Array.isArray(round.answer)
    ? round.answer[0]
    : round.answer;

  feedbackEl.textContent =
    `❌ Incorrect. Answer: ${correctAnswer}`;

history.push({
  cluesUsed: currentClueIndex + 1,
  guess: guessRaw,
  correct: correctAnswer,
  score,
  clues: [...round.clues]
});

  endRound();

});

//  key submit
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  e.preventDefault();
  submitBtn.click();
});

function endRound() {
  guessInput.disabled = true;

  awaitingNextRound = true;

  submitBtn.textContent =
    currentRoundIndex === rounds.length - 1
      ? "Finish"
      : "Next";
}
  
function launchConfetti(amount = 80) {

  for (let i = 0; i < amount; i++) {

    const confetti = document.createElement("div");

    confetti.className = "confetti";

    confetti.style.left = Math.random() * 100 + "vw";

    confetti.style.width =
      (Math.random() * 10 + 6) + "px";

    confetti.style.height =
      (Math.random() * 14 + 8) + "px";

    confetti.style.animationDuration =
      (Math.random() * 2 + 2) + "s";

    confetti.style.opacity = Math.random();

    confetti.style.transform =
      `rotate(${Math.random() * 360}deg)`;

    confetti.style.backgroundColor =
      `hsl(${Math.random() * 360}, 90%, 60%)`;

    document.body.appendChild(confetti);

    setTimeout(() => confetti.remove(), 4500);
  }
}
  function celebrateRound(cluesUsed) {

  let amount = 30;
  let message = "Nice!";
  let sizeClass = "small";

  // FIRST CLUE = MASSIVE CELEBRATION
  if (cluesUsed === 1) {
    amount = 500;
    message = "🏆 WOW! You nailed it!";
    sizeClass = "large";

    // extra burst waves (this is the key upgrade)
    setTimeout(() => launchConfetti(200), 0);
    setTimeout(() => launchConfetti(150), 250);
    }

  // SECOND CLUE = GOOD CELEBRATION
  else if (cluesUsed === 2) {
    amount = 90;
    message = "Remarkable!";
    sizeClass = "medium";
  }

  // THIRD CLUE = SMALL CELEBRATION
  else {
    amount = 0;
    message = "Phew! You got it";
    sizeClass = "small";
  }

  launchConfetti(amount);

  const banner = document.createElement("div");

  banner.className = `round-banner ${sizeClass}`;
  banner.textContent = message;

  document.body.appendChild(banner);

const card = document.querySelector(".card");

if (card) {
  card.classList.add("celebrate");

  setTimeout(() => {
    card.classList.remove("celebrate");
  }, 500);
}

  setTimeout(() => {
    banner.remove();
  }, 2200);
}
// ------------------ FINAL SCREEN ------------------
function showFinal() {
  document.getElementById("game").classList.add("hidden");
  finalEl.classList.remove("hidden");
  document.getElementById("progress-bar").style.width = "100%";

  const totalPossible = rounds.length * 3;

  let rankTitle = "";
let rankMessage = "";
let celebrationHTML = "";

// PERFECT SCORE
if (totalScore === totalPossible) {
  rankTitle = "🏆 Diagnostic Legend!";
  rankMessage = "Perfect score! You cracked every round with elite efficiency.";

  celebrationHTML = `
    <div class="celebration perfect">
      🎉 🎊 🧠 🎊 🎉
    </div>
  `;
}

// GREAT SCORE
else if (totalScore >= 13) {
  rankTitle = "🔥 Clinical Sleuth!";
  rankMessage = "Outstanding performance. Your instincts are sharp.";

  celebrationHTML = `
    <div class="celebration great">
      ⭐ ⭐ ⭐
    </div>
  `;
}

// GOOD SCORE
else if (totalScore >= 11) {
  rankTitle = "👏 Strong Detective Work!";
  rankMessage = "Nice job connecting the clues and narrowing the differential.";

  celebrationHTML = `
    <div class="celebration good">
      ✨ 🧠 ✨
    </div>
  `;
}
    const shareText = buildShareText();
  const emojiGrid = buildEmojiGrid();

  // ---------------------------
  // Build results HTML
  // ---------------------------
let html = `
  ${celebrationHTML}

  <div class="final-banner">

    <h2>${rankTitle}</h2>

    <h3>${totalScore}/${totalPossible}</h3>

    <div class="emoji-grid">
      ${emojiGrid}
    </div>

    <p>${rankMessage}</p>

  </div>

  <details class="summary">
    <summary>View Round Details</summary>
`;
history.forEach((h, i) => {

  html += `
    <details class="round-summary">

      <summary>
        Round ${i + 1}
        ${h.score > 0 ? "✅" : "❌"}
      </summary>

      <p><strong>Answer:</strong> ${h.correct}</p>
      <p><strong>Your guess:</strong> ${h.guess}</p>
      <p><strong>Clues used:</strong> ${h.cluesUsed}</p>

      <ol class="clue-review">
       ${h.clues.map((clue, index) => `
  <li class="${index + 1 === h.cluesUsed ? 'solved-clue' : ''}">
    ${clue}
  </li>
`).join("")}
      </ol>

    </details>
  `;
});

html += `
    </details>

    <button id="shareBtn">Share</button>
    <button onclick="location.reload()">Play Again</button>
  `;

  finalEl.innerHTML = html;

if (totalScore === totalPossible) {
  launchConfetti();
}

  // ---------------------------
  // DOM bindings (safe)
  // ---------------------------
  const shareBtn = document.getElementById("shareBtn");

  // ---------------------------
// Copy share text
// ---------------------------

shareBtn?.addEventListener("click", async () => {
  await copyText(shareText);

  shareBtn.textContent = "Copied!";

  setTimeout(() => {
    shareBtn.textContent = "Share";
  }, 2000);
});


async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;

    document.body.appendChild(area);
    area.select();

    document.execCommand("copy");

    document.body.removeChild(area);
  }
}
  // ---------------------------
  // Save results
  // ---------------------------
  localStorage.setItem(
    currentPuzzleId,
    JSON.stringify({
      totalScore,
      history
    })
  );
}
  // ---------------------------
  // Share text builder
  // ---------------------------
function buildEmojiGrid() {

  function emoji(score) {
    switch (score) {
      case 3: return "🟩";
      case 2: return "🟨";
      case 1: return "🟧";
      default: return "⬛";
    }
  }

  return history.map(h => emoji(h.score)).join(" ");
}

function buildShareText() {

  const totalPossible = rounds.length * 3;

  const grid = buildEmojiGrid();

  return [
    `🧠 Discovery Rounds`,
    "",
    grid,
    "",
    `Score ${totalScore}/${totalPossible}`,
    "",
    "Can you diagnose them all?",
    url
  ].join("\n");
}

  // ---------------------------
// COMMENTS
// ---------------------------
function saveComment(text) {
  const commentsRef = ref(db, "comments");
  const newComment = push(commentsRef);

  set(newComment, {
    text,
    timestamp: Date.now()
  })
    .then(() => console.log("Comment saved!"))
    .catch(err => console.error("Error saving comment:", err));
}

function initCommentBox() {
  const commentInput = document.getElementById("comment-input");
  const commentSubmitBtn = document.getElementById("submit-comment");

  if (!commentInput || !commentSubmitBtn) return;

  commentInput.addEventListener("input", () => {
    commentInput.style.height = "auto";
    commentInput.style.height = commentInput.scrollHeight + "px";
  });

  commentSubmitBtn.addEventListener("click", () => {
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
      commentSubmitBtn.click();
    }
  });
}
  // ---------------------------
// FIREBASE VISITOR COUNTER
// ---------------------------
function initVisitorCounter(pageName) {
  const visitRef = ref(db, `visits/${pageName}`);
  const visitEl = document.getElementById("visit-count");

  if (!visitEl) return;

  // Live listener
  onValue(visitRef, (snapshot) => {
    if (snapshot.exists()) {
      visitEl.textContent = snapshot.val();
    } else {
      visitEl.textContent = "—";
      console.warn(`Missing counter: ${pageName}`);
    }
  });

  const key = `visited-${pageName}`;

  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "true");

runTransaction(visitRef, (current) => {

  if (current === null) {
    return 1;
  }

  if (typeof current !== "number") {
    console.error("Counter invalid");
    return;
  }

  return current + 1;

}).catch((err) => {

  console.error("Visitor counter failed:", err);

});
  }
}
function initPuzzleSelector() {

  const select = document.getElementById("puzzleSelect");

  if (!select) return;

  const puzzles = getRecentPuzzles(5);

  puzzles.forEach((p, index) => {

    const option = document.createElement("option");

    option.value =
      `${p.year}-${String(p.week).padStart(2, "0")}-${p.half}`;

    const date = getPuzzleDate(
      p.year,
      p.week,
      p.half
    );

    const label = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    option.textContent =
      index === 0
        ? `${label} (Current)`
        : label;

    select.appendChild(option);

  });

  select.addEventListener("change", () => {

    const [year, week, half] =
      select.value.split("-");

    // Reset game

    history = [];
    totalScore = 0;
    currentRoundIndex = 0;

    finalEl.classList.add("hidden");

    document
      .getElementById("game")
      .classList.remove("hidden");

    loadPuzzle(
      Number(year),
      Number(week),
      half
    );

  });

}
// ---------------------------
// ABOUT MODAL
// ---------------------------

const aboutBtn = document.getElementById("aboutBtn");
const aboutModal = document.getElementById("aboutModal");
const closeAbout = document.getElementById("closeAbout");

aboutBtn?.addEventListener("click", () => {
  aboutModal.classList.remove("hidden");
});

closeAbout?.addEventListener("click", () => {
  aboutModal.classList.add("hidden");
});

aboutModal?.addEventListener("click", (e) => {
  if (e.target === aboutModal) {
    aboutModal.classList.add("hidden");
  }
});

// ------------------ INIT ------------------

initVisitorCounter("discovery-rounds");
initCommentBox();
initPuzzleSelector();
loadPuzzle();
