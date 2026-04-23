
let events = [];
let currentIndex = 0;
let totalScore = 0;
let history = [];
let currentPuzzleId = "";

const eventEl = document.getElementById("event");
const guessInput = document.getElementById("guess");
const feedbackEl = document.getElementById("feedback");
const progressEl = document.getElementById("progress");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const finalEl = document.getElementById("final");

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
  
if (!weekPicker) return;

weekPicker?.addEventListener("change", (e) => {
  const value = e.target.value;
  if (!value) return;

  const [year, week] = value.split("-").map(Number);

  currentIndex = 0;
  totalScore = 0;
  history = [];

  document.getElementById("game").classList.remove("hidden");
  finalEl.classList.add("hidden");

  loadPuzzle(year, week);
});
  
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Play a past week";
  placeholderOption.disabled = true;  // Prevent it from being selected as a valid week
  placeholderOption.selected = true;  // Show it by default
  weekPicker.appendChild(placeholderOption);

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
}

async function loadPuzzle(year = currentYear, week = currentWeek) {
  // zero-pad week (01, 02, etc.)
  const Week = String(week).padStart(2, "0");

  const filePath = `Discovery/${year}-${Week}.json`;

  try {
    const res = await fetch(filePath);

    if (!res.ok) throw new Error("File not found");

    const data = await res.json();

    events = data.events;
    currentPuzzleId = `${year}-${Week}`;

    loadEvent();
  } catch (err) {
    console.error("Error loading puzzle:", err);

    // fallback: try previous week
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

function loadEvent() {
  const e = events[currentIndex];
  eventEl.textContent = e.text;
  progressEl.textContent = `Event ${currentIndex + 1} of ${events.length}`;

const progressPercent = ((currentIndex + 1) / events.length) * 100;
  document.getElementById("progress-bar").style.width = `${progressPercent}%`;

  guessInput.value = "";
  guessInput.disabled = false;

  feedbackEl.textContent = "";

  submitBtn.classList.remove("hidden");
  nextBtn.classList.add("hidden");

  if (currentIndex === events.length - 1) {
  nextBtn.textContent = "Finish";
} else {
  nextBtn.textContent = "Next";
}
}
function calculateScore(diff) {
  return Math.round(100 * Math.exp(-diff / 15));
}

function getFeedback(diff, guess, correct) {
  if (diff === 0) return "Perfect!";

  const direction = guess > correct ? "late" : "early";

  if (diff <= 2) return `Almost exact — ${diff} years ${direction}`;
  if (diff <= 5) return `Very close — ${diff} years ${direction}`;
  if (diff <= 10) return `Close — ${diff} years ${direction}`;
  if (diff <= 20) return `Not bad — ${diff} years ${direction}`;
  if (diff <= 40) return `Way off — ${diff} years ${direction}`;
  return `Far off — ${diff} years ${direction}`;
}

submitBtn.addEventListener("click", () => {
  const guess = parseInt(guessInput.value);
  if (isNaN(guess)) return;

  const correct = events[currentIndex].year;
  const diff = Math.abs(guess - correct);

  const score = calculateScore(diff); // ✅ THIS WAS MISSING
  totalScore += score;

  const textFeedback = getFeedback(diff, guess, correct);

  feedbackEl.textContent = `${textFeedback} | Correct: ${correct} | +${score} pts`;

  history.push({
    event: events[currentIndex].text,
    guess,
    correct,
    score
  });

  guessInput.disabled = true;
  submitBtn.classList.add("hidden");
  nextBtn.classList.remove("hidden");
});

nextBtn.addEventListener("click", () => {
  // ✅ If this is the last event → go to final screen
  if (currentIndex === events.length - 1) {
    showFinal();
    return;
  }

  // Otherwise go to next event
  currentIndex++;
  loadEvent();
});

guessInput.addEventListener("keydown", (e) => {
  if (
    e.key === "Enter" &&
    !guessInput.disabled &&
    !submitBtn.classList.contains("hidden")
  ) {
    submitBtn.click();
  }
});

function showFinal() {
  document.getElementById("game").classList.add("hidden");
  finalEl.classList.remove("hidden");
  document.getElementById("progress-bar").style.width = "100%";

  let html = `<h2>Final Score: ${totalScore} / ${events.length * 100}</h2>`;
  html += `<div class="summary">`;

history.forEach((h, i) => {
  const isCorrect = h.guess === h.correct;

  html += `
    <p>
      <strong>${i + 1}. ${h.event}</strong><br>
      Your guess: ${h.guess} | 
      Correct: ${h.correct} | 
      <span style="color:${isCorrect ? 'green' : 'red'}">
        ${isCorrect ? 'Correct' : 'Off'}
      </span>
    </p>
  `;
});
  html += `</div><button onclick="location.reload()">Play Again</button>`;
  
localStorage.setItem(currentPuzzleId, JSON.stringify({
  currentIndex,
  totalScore,
  history
}));
  
  finalEl.innerHTML = html;
}

populatePastWeeksDropdown(currentWeekInfo);
loadPuzzle();
