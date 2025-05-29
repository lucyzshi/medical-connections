function getCurrentWeekFile() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const pastDays = Math.floor((now - firstDay) / 86400000);
  const weekNumber = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
  return `week-${weekNumber}.json`;
}

const puzzleFile = getCurrentWeekFile();

fetch(`./data/${puzzleFile}`)
  .then(res => {
    if (!res.ok) throw new Error("Puzzle not found");
    return res.json();
  })
  .then(json => {
    groups = json;
    resetGame(); // or your game initialization function
  })
  .catch(err => {
    document.getElementById("feedback").textContent = "⚠️ No puzzle found for this week.";
    console.error(err);
  });


let allWords = Object.values(groups).flat().sort(() => Math.random() - 0.5);
let selected = [];
let solvedGroups = [];
let wrongGuesses = 0;
const maxGuesses = 4;

function renderTiles() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  allWords.forEach(word => {
    const tile = document.createElement("div");
    tile.textContent = word;
    tile.className = "tile";

    if (selected.includes(word)) {
      tile.classList.add("selected");
    }

    if (solvedGroups.some(group => group.includes(word))) {
      tile.classList.add("solved");
      tile.onclick = null;
    } else {
      tile.onclick = () => toggleSelect(word);
    }

    if (wrongGuesses >= maxGuesses || isGameWon()) {
      tile.classList.add("disabled");
    }

    board.appendChild(tile);
  });
}

function toggleSelect(word) {
  if (selected.includes(word)) {
    selected = selected.filter(w => w !== word);
  } else if (selected.length < 4) {
    selected.push(word);
  }
  renderTiles();
}

function checkGroup() {
  if (selected.length !== 4) {
    updateFeedback("⚠️ Select exactly 4 tiles.");
    return;
  }

  const isCorrect = Object.values(groups).some(group =>
    group.every(word => selected.includes(word)) &&
    selected.every(word => group.includes(word))
  );

  if (isCorrect) {
    solvedGroups.push([...selected]);
    updateFeedback("✅ Correct group!");
  } else {
    wrongGuesses++;
    updateFeedback(`❌ Incorrect group. ${maxGuesses - wrongGuesses} guesses remaining.`);
  }

  selected = [];
  renderTiles();
  checkWinOrLose();
}

function checkWinOrLose() {
  if (isGameWon()) {
    updateFeedback("🎉 Congratulations! You found all groups!");
  } else if (wrongGuesses >= maxGuesses) {
    updateFeedback("❌ Game Over! You used all your guesses.");
  }

  updateGuessCounter();
}

function isGameWon() {
  return solvedGroups.length === Object.keys(groups).length;
}

function updateFeedback(msg) {
  document.getElementById("feedback").textContent = msg;
}

function updateGuessCounter() {
  const counter = document.getElementById("guess-counter");
  counter.textContent = `Guesses remaining: ${Math.max(0, maxGuesses - wrongGuesses)}`;
}

function resetGame() {
  selected = [];
  solvedGroups = [];
  wrongGuesses = 0;
  allWords = Object.values(groups).flat().sort(() => Math.random() - 0.5);
  updateFeedback("");
  updateGuessCounter();
  renderTiles();
}

// Start the game
renderTiles();
updateGuessCounter();
