let groups = {};
let solvedGroups = [];
let selectedTiles = [];
let wrongGuesses = 0;
const maxWrongGuesses = 4;

function getCurrentWeekFile() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const pastDays = Math.floor((now - firstDay) / 86400000);
  const weekNumber = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
  return `week-${weekNumber}.json`;
}

const puzzleFile = getCurrentWeekFile();
console.log("Attempting to load:", puzzleFile);

fetch(`./data/${puzzleFile}`)
  .then(res => {
    if (!res.ok) throw new Error("Puzzle not found");
    return res.json();
  })
  .then(json => {
    groups = json;
    resetGame();
  })
  .catch(err => {
    document.getElementById("feedback").textContent = "⚠️ No puzzle found for this week.";
    console.error(err);
  });

function resetGame() {
  solvedGroups = [];
  selectedTiles = [];
  wrongGuesses = 0;

  const tileContainer = document.getElementById("tile-container");
  tileContainer.innerHTML = "";
  document.getElementById("feedback").textContent = "";
  updateGuessDisplay();

  const allWords = Object.values(groups).flat();
  shuffleArray(allWords);

  allWords.forEach(word => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.textContent = word;
    tile.dataset.word = word;
    tile.addEventListener("click", () => handleTileClick(tile));
    tileContainer.appendChild(tile);
  });
}

function handleTileClick(tile) {
  if (tile.classList.contains("solved") || tile.classList.contains("disabled")) return;

  const word = tile.dataset.word;
  if (selectedTiles.includes(word)) {
    tile.classList.remove("selected");
    selectedTiles = selectedTiles.filter(w => w !== word);
  } else {
    if (selectedTiles.length >= 4) return;
    tile.classList.add("selected");
    selectedTiles.push(word);
  }

  if (selectedTiles.length === 4) {
    checkSelection();
  }
}

function checkSelection() {
  const selectedGroup = selectedTiles.slice().sort().join(",");

  for (const [groupName, words] of Object.entries(groups)) {
    const correctGroup = words.slice().sort().join(",");
    if (selectedGroup === correctGroup && !solvedGroups.includes(groupName)) {
      markGroupAsSolved(words, groupName);
      return;
    }
  }

  wrongGuesses++;
  updateGuessDisplay();
  selectedTiles.forEach(word => {
    const tile = document.querySelector(`[data-word="${word}"]`);
    if (tile) tile.classList.remove("selected");
  });
  selectedTiles = [];

  if (wrongGuesses >= maxWrongGuesses) {
    endGame("❌ You've used all your guesses. Game over!");
  } else {
    showFeedback("❌ Incorrect group. Try again.");
  }
}

function markGroupAsSolved(words, groupName) {
  solvedGroups.push(groupName);
  words.forEach(word => {
    const tile = document.querySelector(`[data-word="${word}"]`);
    tile.classList.add("solved");
    tile.classList.remove("selected");
    tile.classList.add("disabled");
  });

  selectedTiles = [];
  showFeedback(`✅ Correct! Group: ${groupName}`);

  if (solvedGroups.length === Object.keys(groups).length) {
    endGame("🎉 Congratulations! You solved all groups.");
  }
}

function showFeedback(message) {
  const feedback = document.getElementById("feedback");
  feedback.textContent = message;
}

function updateGuessDisplay() {
  const guessDisplay = document.getElementById("guesses-left");
  if (guessDisplay) {
    guessDisplay.textContent = `Wrong guesses left: ${maxWrongGuesses - wrongGuesses}`;
  }
}

function endGame(message) {
  showFeedback(message);
  // Optionally disable remaining tiles
  const tiles = document.querySelectorAll(".tile:not(.solved)");
  tiles.forEach(tile => tile.classList.add("disabled"));
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
