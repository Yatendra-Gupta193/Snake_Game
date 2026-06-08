const playBoard = document.querySelector(".play-board");
const scoreElement = document.querySelector(".score");
const highScoreElement = document.querySelector(".high-score");
const controls = document.querySelectorAll(".controls i");

const pauseBtn = document.getElementById("pauseBtn");
const diffButtons = document.querySelectorAll(".diff-btn");
const levelLabel = document.querySelector(".level-label");

const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const restartBtn = document.getElementById("restartBtn");
const startHighScoreEl = startOverlay.querySelector(".high-score");

const finalScoreEl = gameOverOverlay.querySelector(".final-score");
const finalHighScoreEl = gameOverOverlay.querySelector(".final-high-score");

const gridSize = 30;
let gameState = "idle"; // idle | running | paused | over

let foodX, foodY;
let snakeX = 5, snakeY = 5;
let velocityX = 0, velocityY = 0;
let snakeBody = [];
let timerId = null;

let score = 0;
let highScore = Number(localStorage.getItem("high-score") || 0);
let difficulty = "easy";

// Speed handling
const SPEEDS = {
  easy: { baseInterval: 115, speedStepPoints: 5, speedMultiplierPerStep: 0.9 }, // ~ -10%
  medium: { baseInterval: 95, speedStepPoints: 5, speedMultiplierPerStep: 0.88 },
  hard: { baseInterval: 75, speedStepPoints: 5, speedMultiplierPerStep: 0.86 }
};

function getCurrentInterval() {
  const cfg = SPEEDS[difficulty];
  const steps = Math.floor(score / cfg.speedStepPoints);
  const interval = cfg.baseInterval * Math.pow(cfg.speedMultiplierPerStep, steps);
  return Math.max(35, Math.floor(interval));
}

let lastScoreStep = 0;

function updateHighScoreUI() {
  highScoreElement.innerText = `High Score: ${highScore}`;
  if (startHighScoreEl) startHighScoreEl.innerText = String(highScore);
}

updateHighScoreUI();

function updateFoodPosition() {
  foodX = Math.floor(Math.random() * gridSize) + 1;
  foodY = Math.floor(Math.random() * gridSize) + 1;
}

function renderScoreAnimation(x, y, text) {
  const el = document.createElement("div");
  el.className = "score-float";
  el.textContent = text;
  // Convert board cell to percentage-ish placement
  el.style.left = `${(x / gridSize) * 100}%`;
  el.style.top = `${(y / gridSize) * 100}%`;
  playBoard.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

function ensureScoreAnimationStyles() {
  if (document.getElementById("score-float-styles")) return;
  const style = document.createElement("style");
  style.id = "score-float-styles";
  style.textContent = `
    .score-float {
      position: absolute;
      transform: translate(-50%, -50%);
      color: #FDE68A;
      font-weight: 900;
      text-shadow: 0 0 18px rgba(250, 204, 21, 0.45);
      animation: floatUp 650ms ease-out forwards;
      pointer-events: none;
      font-size: 1.05rem;
      z-index: 3;
      background: rgba(0,0,0,0);
    }
    @keyframes floatUp {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      15% { opacity: 1; }
      100% { opacity: 0; transform: translate(-50%, -110%) scale(1.05); }
    }
  `;
  document.head.appendChild(style);
}

function setGameState(next) {
  gameState = next;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }

  if (next === "running") {
    pauseBtn.textContent = "⏸ Pause";
    startOverlay.style.display = "none";
    gameOverOverlay.style.display = "none";
    timerId = setInterval(tick, getCurrentInterval());
  } else if (next === "paused") {
    pauseBtn.textContent = "▶ Resume";
  } else if (next === "over") {
    pauseBtn.textContent = "⏸ Pause";
  } else {
    // idle
    pauseBtn.textContent = "⏸ Pause";
    startOverlay.style.display = "flex";
    gameOverOverlay.style.display = "none";
  }
}

function handleGameOver() {
  setGameState("over");
  finalScoreEl.textContent = String(score);
  finalHighScoreEl.textContent = String(highScore);
  gameOverOverlay.style.display = "flex";
}

function changeDirectionFromKey(key) {
  // Prevent 180-degree turns
  if (key === "ArrowUp" || key === "w" || key === "W") {
    if (velocityY !== 1) { velocityX = 0; velocityY = -1; }
  } else if (key === "ArrowDown" || key === "s" || key === "S") {
    if (velocityY !== -1) { velocityX = 0; velocityY = 1; }
  } else if (key === "ArrowLeft" || key === "a" || key === "A") {
    if (velocityX !== 1) { velocityX = -1; velocityY = 0; }
  } else if (key === "ArrowRight" || key === "d" || key === "D") {
    if (velocityX !== -1) { velocityX = 1; velocityY = 0; }
  }
}

// Mobile arrow icons (already present in HTML)
controls.forEach((button) =>
  button.addEventListener("click", () => {
    const key = button.dataset.key;
    changeDirectionFromKey(key);
    if (gameState === "idle") setGameState("running");
  })
);

// Keyboard controls
document.addEventListener("keyup", (e) => {
  // Start with any movement key
  if (gameState === "idle") {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(e.key)) {
      setGameState("running");
    } else {
      return;
    }
  }
  if (e.key === " ") {
    // ignore space
    return;
  }
  if (gameState === "running") changeDirectionFromKey(e.key);
  if (gameState === "paused" && (e.key === "p" || e.key === "P")) setGameState("running");
});

// Swipe controls
let swipeStart = null;
playBoard.addEventListener("touchstart", (e) => {
  if (!e.touches || e.touches.length === 0) return;
  swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
});
playBoard.addEventListener("touchend", (e) => {
  if (!swipeStart) return;
  const touch = e.changedTouches && e.changedTouches[0];
  if (!touch) return;

  const dx = touch.clientX - swipeStart.x;
  const dy = touch.clientY - swipeStart.y;
  const dt = Date.now() - swipeStart.t;

  // Basic threshold + avoid accidental tiny moves
  if (dt > 800) return;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < 25) return;

  if (absX > absY) {
    changeDirectionFromKey(dx > 0 ? "ArrowRight" : "ArrowLeft");
  } else {
    changeDirectionFromKey(dy > 0 ? "ArrowDown" : "ArrowUp");
  }

  if (gameState === "idle") setGameState("running");
});

// Difficulty selection
diffButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    diffButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    difficulty = btn.dataset.level;
    levelLabel.textContent = btn.textContent.trim();

    // Restart cleanly only if game running/paused
    if (gameState !== "idle") {
      resetGame();
      setGameState("idle");
    }
  });
});

function resetGame() {
  score = 0;
  velocityX = 0;
  velocityY = 0;
  snakeX = 5;
  snakeY = 5;
  snakeBody = [];
  lastScoreStep = 0;
  scoreElement.innerText = `Score: ${score}`;
  updateFoodPosition();
  ensureScoreAnimationStyles();
}

function startGame() {
  if (gameState === "running") return;
  resetGame();
  // give initial direction so snake starts moving
  velocityX = 1;
  velocityY = 0;
  setGameState("running");
}

pauseBtn.addEventListener("click", () => {
  if (gameState === "running") {
    setGameState("paused");
    return;
  }
  if (gameState === "paused") {
    setGameState("running");
  }
});

startBtn.addEventListener("click", () => startGame());
restartBtn.addEventListener("click", () => startGame());

function tick() {
  if (gameState !== "running") return;

  // Recompute interval when score grows (every 5 pts)
  const cfg = SPEEDS[difficulty];
  const steps = Math.floor(score / cfg.speedStepPoints);
  if (steps !== lastScoreStep) {
    lastScoreStep = steps;
    clearInterval(timerId);
    timerId = setInterval(tick, getCurrentInterval());
  }

  let html = `<div class="food" style="grid-area: ${foodY} / ${foodX}"></div>`;

  // Food eaten
  if (snakeX === foodX && snakeY === foodY) {
    updateFoodPosition();
    // Extend body
    snakeBody.push([snakeY, snakeX]);
    score += 1;

    if (score > highScore) {
      highScore = score;
      localStorage.setItem("high-score", String(highScore));
    }

    scoreElement.innerText = `Score: ${score}`;
    updateHighScoreUI();
    renderScoreAnimation(foodX, foodY, `+${1}`);
  }

  // Advance snake
  snakeX += velocityX;
  snakeY += velocityY;

  // Shift body forward
  for (let i = snakeBody.length - 1; i > 0; i--) {
    snakeBody[i] = snakeBody[i - 1];
  }
  // Current head position in body index 0
  snakeBody[0] = [snakeY, snakeX];

  // Wall collision
  if (snakeX <= 0 || snakeX > gridSize || snakeY <= 0 || snakeY > gridSize) {
    return handleGameOver();
  }

  // Render and self collision
  for (let i = 0; i < snakeBody.length; i++) {
    // Using existing indexing approach: [y, x]
    html += `<div class="head" style="grid-area: ${snakeBody[i][0]} / ${snakeBody[i][1]}"></div>`;

    if (
      i !== 0 &&
      snakeBody[0][0] === snakeBody[i][0] &&
      snakeBody[0][1] === snakeBody[i][1]
    ) {
      return handleGameOver();
    }
  }

  playBoard.innerHTML = html;
}

// Init
resetGame();
setGameState("idle");

