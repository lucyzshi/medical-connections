let groups = {};
let selectedTiles = [];
let solvedGroups = [];
let wrongGuesses = 0;
const maxWrongGuesses = 4;
let shuffled = false;

// 🗓 Get current ISO week number
function getCurrentISOWeek() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - jan1) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + jan1.getDay() + 1) / 7);
}

// 📦 Load JSON file for current week
async function loadPuzzleForWeek(weekNumber) {
  const url = `data/week${weekNumber}.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Game not found.");
    groups = await response.json();
    resetGame();
  } catch (err) {
    document.getElementById("feedback").textContent =
      "❌ No game found for this week. Please check back later.";
    document.getElementById("shuffle-btn").disabled = true;
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
  const match = Object.entries(groups).find(([groupName, words]) =>
    words.every(w => selectedTiles.includes(w)) &&
    selectedTiles.every(w => words.includes(w))
  );

  if (match) {
    markGroupAsSolved(match[1], match[0]);
  } else {
    wrongGuesses++;
    updateGuessDisplay();
    showFeedback("❌ Incorrect group.");
    if (wrongGuesses >= maxWrongGuesses) {
      endGame("💥 Game over. You've used all your guesses.");
    }
    selectedTiles = [];
    renderTiles();
  }
}

function markGroupAsSolved(words, groupName) {
  solvedGroups.push({ name: groupName, words });
  selectedTiles = [];
  showFeedback(`✅ Correct! Group: ${groupName}`);
  renderTiles();

  if (solvedGroups.length === Object.keys(groups).length) {
    endGame("🎉 Congratulations! You solved all groups.");
  }
}

function endGame(message) {
  showFeedback(message);
  document.querySelectorAll(".tile").forEach(t => t.classList.add("disabled"));
  document.getElementById("shuffle-btn").disabled = true;
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
  shuffled = false;
  document.getElementById("shuffle-btn").disabled = false;
  updateGuessDisplay();
  renderTiles();
}

function renderTiles() {
  const tileContainer = document.getElementById("tile-container");
  tileContainer.innerHTML = "";

  // ➤ Solved Groups at the top
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

  // ➤ Remaining tiles (keep 4x4 grid)
  const allSolvedWords = solvedGroups.flatMap(g => g.words);
  const remaining = Object.values(groups).flat().filter(w => !allSolvedWords.includes(w));

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

  if (!solved) {
    tile.addEventListener("click", () => handleTileClick(tile));
  }

  return tile;
}

function shuffleRemainingTiles() {
  const allSolvedWords = solvedGroups.flatMap(g => g.words);
  const remaining = Object.values(groups).flat().filter(w => !allSolvedWords.includes(w));
  shuffleArray(remaining);
  renderTilesWithCustomOrder(remaining);
}
function renderTilesWithCustomOrder(customOrder) {
  const tileContainer = document.getElementById("tile-container");
  tileContainer.innerHTML = "";

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

  customOrder.forEach(word => {
    const tile = createTile(word, false);
    grid.appendChild(tile);
  });

  tileContainer.appendChild(grid);
}


document.getElementById("submit-button").addEventListener("click", checkSelection);
document.getElementById("shuffle-btn").addEventListener("click", shuffleRemainingTiles);

// 🚀 Load the current week's puzzle on page load
window.onload = () => {
  const week = getCurrentISOWeek();
  loadPuzzleForWeek(week);
};


