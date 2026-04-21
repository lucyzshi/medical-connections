{
  "week1": [
    { "text": "World War II ends", "year": 1945 },
    { "text": "First man lands on the moon", "year": 1969 },
    { "text": "Fall of the Berlin Wall", "year": 1989 },
    { "text": "Launch of the iPhone", "year": 2007 },
    { "text": "COVID-19 declared a pandemic", "year": 2020 }
  ]
}


// app.js
let events = [];
let currentIndex = 0;
let totalScore = 0;
let history = [];

const eventEl = document.getElementById("event");
const guessInput = document.getElementById("guess");
const feedbackEl = document.getElementById("feedback");
const progressEl = document.getElementById("progress");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const finalEl = document.getElementById("final");

async function loadPuzzle() {
  const res = await fetch("puzzles.json");
  const data = await res.json();

  // simple weekly selection (can expand later)
  events = data.week1;

  loadEvent();
}

function loadEvent() {
  const e = events[currentIndex];
  eventEl.textContent = e.text;
  progressEl.textContent = `Event ${currentIndex + 1} of ${events.length}`;

  guessInput.value = "";
  guessInput.disabled = false;

  feedbackEl.textContent = "";

  submitBtn.classList.remove("hidden");
  nextBtn.classList.add("hidden");
}

function getFeedback(diff) {
  if (diff === 0) return "Perfect!";
  if (diff <= 5) return "Very close";
  if (diff <= 15) return "Close";
  if (diff <= 30) return "Not bad";
  return "Way off";
}

submitBtn.addEventListener("click", () => {
  const guess = parseInt(guessInput.value);
  if (isNaN(guess)) return;

  const correct = events[currentIndex].year;
  const diff = Math.abs(guess - correct);
  const score = Math.max(0, 100 - diff);

  totalScore += score;

  const textFeedback = getFeedback(diff);

  feedbackEl.textContent = `${textFeedback} | Correct: ${correct} | Score: ${score}`;

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
  currentIndex++;

  if (currentIndex < events.length) {
    loadEvent();
  } else {
    showFinal();
  }
});

function showFinal() {
  document.getElementById("game").classList.add("hidden");
  finalEl.classList.remove("hidden");

  let html = `<h2>Final Score: ${totalScore} / ${events.length * 100}</h2>`;
  html += `<div class="summary">`;

  history.forEach((h, i) => {
    html += `
      <p>
        <strong>${i + 1}. ${h.event}</strong><br>
        Your guess: ${h.guess} | Correct: ${h.correct} | Score: ${h.score}
      </p>
    `;
  });

  html += `</div><button onclick="location.reload()">Play Again</button>`;

  finalEl.innerHTML = html;
}

loadPuzzle();
