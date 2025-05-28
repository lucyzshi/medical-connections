const words = [
  "Heart Failure", "Syncope", "Pulsus Parvus", "Paradoxical Split S2",
  "Wide Pulse Pressure", "Water Hammer", "Heave", "Austin Flint",
  "Kussmaul's", "Rub", "JVD", "Pulsus Paradoxus",
  "S3", "Orthopnea", "Paroxysmal Nocturnal Dyspnea", "Displaced PMI"
];

const groups = {
  "Signs of severe aortic stenosis": ["Heart Failure", "Syncope", "Pulsus Parvus", "Paradoxical Split S2"],
  "Signs of aortic insufficiency": ["Wide Pulse Pressure", "Water Hammer", "Heave", "Austin Flint"],
  "Signs of Cardiac Tamponade": ["Kussmaul's", "Rub", "JVD", "Pulsus Paradoxus"],
  "Signs of Heart Failure": ["S3", "Orthopnea", "Paroxysmal Nocturnal Dyspnea", "Displaced PMI"]
};

let selected = [];
let solvedGroups = [];
let remainingWords = [...words];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderTiles() {
  const board = document.getElementById("game-board");
  board.innerHTML = "";
  
  // Render solved groups first
  solvedGroups.forEach(groupName => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "solved-group";
    groupDiv.innerHTML = `<h3>${groupName}</h3><div class="solved-tiles">${groups[groupName].map(word => `<span class="solved-tile">${word}</span>`).join('')}</div>`;
    board.appendChild(groupDiv);
  });
  
  // Render remaining tiles
  shuffle(remainingWords).forEach(word => {
    const tile = document.createElement("div");
    tile.textContent = word;
    tile.className = "tile";
    tile.onclick = () => toggleTile(tile, word);
    board.appendChild(tile);
  });
}

function toggleTile(tile, word) {
  if (selected.includes(word)) {
    selected = selected.filter(w => w !== word);
    tile.classList.remove("selected");
  } else if (selected.length < 4) {
    selected.push(word);
    tile.classList.add("selected");
  } else {
    document.getElementById("feedback").textContent = "⚠️ You can only select 4 tiles at a time.";
  }
}

function checkWinCondition() {
  if (solvedGroups.length === Object.keys(groups).length) {
    document.getElementById("feedback").textContent = "🎉 Congratulations! You solved all groups!";
    document.getElementById("submit-button").textContent = "Play Again";
    document.getElementById("submit-button").onclick = resetGame;
  }
}

function resetGame() {
  selected = [];
  solvedGroups = [];
  remainingWords = [...words];
  document.getElementById("feedback").textContent = "";
  document.getElementById("submit-button").textContent = "Submit Group";
  document.getElementById("submit-button").onclick = submitGroup;
  renderTiles();
}

function submitGroup() {
  let feedback = document.getElementById("feedback");
  
  if (selected.length !== 4) {
    feedback.textContent = "⚠️ Please select exactly 4 tiles.";
    return;
  }
  
  let correctGroupName = Object.keys(groups).find(groupName =>
    groups[groupName].every(word => selected.includes(word)) &&
    selected.every(word => groups[groupName].includes(word))
  );
  
  if (correctGroupName) {
    feedback.textContent = `✅ Correct! You found: ${correctGroupName}`;
    solvedGroups.push(correctGroupName);
    remainingWords = remainingWords.filter(word => !selected.includes(word));
    selected = [];
    renderTiles();
    checkWinCondition();
  } else {
    feedback.textContent = "❌ Try Again.";
    selected = [];
    document.querySelectorAll(".tile").forEach(tile => tile.classList.remove("selected"));
  }
}

document.getElementById("submit-button").onclick = submitGroup;

renderTiles();
