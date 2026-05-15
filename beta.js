// ---------------------------
// FIREBASE IMPORTS & INIT
// ---------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const analytics = getAnalytics(app);

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

    // Allow only tiny edits AND same starting letter
    return (
      levenshtein(normGuess, normAns) <= 1 &&
      normGuess[0] === normAns[0] &&
      Math.abs(normGuess.length - normAns.length) <= 1
    );
  });
}

// Submit guess
submitBtn.addEventListener("click", () => {
  const guessRaw = guessInput.value;
  if (!guessRaw) return;

  const round = rounds[currentRoundIndex];

const isCorrect = isCloseMatch(guessRaw, round.answer);
  
 // -----------------------
// ✅ CORRECT
// -----------------------
if (isCorrect) {
  const score = calculateScore(true, currentClueIndex);
  totalScore += score;

  feedbackEl.textContent =
    `Correct! +${score} point${score === 1 ? "" : "s"}`;

  // Reveal any remaining clues
  if (currentClueIndex < round.clues.length - 1) {
    for (let i = currentClueIndex + 1; i < round.clues.length; i++) {
      addClue(i);
    }
  }

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

//  key submit
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  // prevent form / browser weirdness
  e.preventDefault();

  // PRIORITY 1: submitting a guess
  if (!submitBtn.classList.contains("hidden")) {
    submitBtn.click();
    return;
  }

  // PRIORITY 2: advancing round
  if (!nextBtn.classList.contains("hidden")) {
    nextBtn.click();
    return;
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

  const totalPossible = rounds.length * 3;

  let rankTitle = "";
let rankMessage = "";
let celebrationHTML = "";

// PERFECT SCORE
if (totalScore === 15) {
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

  // ---------------------------
  // Build results HTML
  // ---------------------------
let html = `
  ${celebrationHTML}

  <div class="final-banner">
    <h2>${rankTitle}</h2>
    <h3>Final Score: ${totalScore} / ${totalPossible}</h3>
    <p>${rankMessage}</p>
  </div>

  <div class="summary">
`;

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

  html += `
    </div>

    <button id="shareBtn">Share Score</button>

    <div id="shareOptions">
      <button id="copyBtn">Copy</button>
      <button id="twitterBtn">Twitter</button>
      <button id="linkedinBtn">LinkedIn</button>
      <button id="textBtn">Text</button>
    </div>

    <button onclick="location.reload()">Play Again</button>
  `;

  finalEl.innerHTML = html;

  if (totalScore === 15) {
  launchConfetti();
}
  function launchConfetti() {
  for (let i = 0; i < 120; i++) {
    const confetti = document.createElement("div");

    confetti.className = "confetti";
    confetti.style.left = Math.random() * 100 + "vw";
    confetti.style.animationDuration = (Math.random() * 2 + 2) + "s";
confetti.style.opacity = Math.random();
confetti.style.backgroundColor =
  `hsl(${Math.random() * 360}, 90%, 60%)`;
    document.body.appendChild(confetti);

    setTimeout(() => confetti.remove(), 4000);
  }
}


  // ---------------------------
  // DOM bindings (safe)
  // ---------------------------
  const shareBtn = document.getElementById("shareBtn");
  const copyBtn = document.getElementById("copyBtn");
  const twitterBtn = document.getElementById("twitterBtn");
  const linkedinBtn = document.getElementById("linkedinBtn");
  const textBtn = document.getElementById("textBtn");
const shareText = buildShareText();
  
  // Initialize comment box
  initCommentBox();

  
  // ---------------------------
  // Native share (mobile-first)
  // ---------------------------
  shareBtn?.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Discovery Rounds Score",
          text: shareText + "\n" + url
        });
      } catch (err) {
  console.error("Share failed:", err);
  alert("Share not supported on this browser—copying instead.");
}
    } else {
      await navigator.clipboard.writeText(shareText);
      alert("📋 Copied!");
    }
  });

  // ---------------------------
  // Copy
  // ---------------------------
  copyBtn?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(shareText);
    alert("📋 Copied!");
  });

  // ---------------------------
  // Twitter
  // ---------------------------
  twitterBtn?.addEventListener("click", () => {
    const tweet = encodeURIComponent(shareText);
    window.open(`https://twitter.com/intent/tweet?text=${tweet}`, "_blank");
  });

  // ---------------------------
  // LinkedIn
  // ---------------------------
  linkedinBtn?.addEventListener("click", () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      "_blank"
    );
  });

  // ---------------------------
  // SMS
  // ---------------------------
  textBtn?.addEventListener("click", () => {
    window.location.href = `sms:?&body=${encodeURIComponent(shareText)}`;
  });

  // ---------------------------
  // Optional: hide fallback if native share exists
  // ---------------------------
  if (navigator.share) {
    document.getElementById("shareOptions")?.classList.add("hidden");
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
  function buildShareText() {
  const url = window.location.href;
  const totalPossible = rounds.length * 3;

  // Emoji mapping like NYT-style results
  function scoreEmoji(score) {
    if (score === 3) return "🟩";
    if (score === 2) return "🟨";
    if (score === 1) return "🟧";
    return "⬜";
  }

  const grid = history.map(h => scoreEmoji(h.score)).join(" ");

  return `🧠 Discovery Rounds ${currentPuzzleId}

${grid}
Score: ${totalScore}/${totalPossible}

Can you beat me? 🎯
${url}`;
}
  const shareText = buildShareText();
  const url = window.location.href;

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
// FIREBASE VISITOR COUNTER
// ---------------------------
function initVisitorCounter(pageName) {
  const visitRef = ref(db, `visits/${pageName}`);
  const visitEl = document.getElementById("visit-count");

  if (!visitEl) return;

  // live listener
  onValue(visitRef, (snapshot) => {
    visitEl.textContent = snapshot.val() || 0;
  });

  const key = `visited-${pageName}`;

  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "true");

    runTransaction(visitRef, (current) => {
      return (current || 0) + 1;
    }).catch((err) => {
      console.error("Visitor counter failed:", err);
    });
  }
}
// ------------------ INIT ------------------

loadPuzzle();
