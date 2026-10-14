const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");
const healthText = document.getElementById("healthText");
const healthBar = document.getElementById("healthBar");
const scoreText = document.getElementById("scoreText");
const timeText = document.getElementById("timeText");
const waveText = document.getElementById("waveText");

const overlayTitle = startScreen.querySelector("h2");
const overlayDescription = startScreen.querySelector(
  ".overlay-card > p:not(.eyebrow)"
);
const overlayEyebrow = startScreen.querySelector(".eyebrow");

const xpPanel = document.createElement("section");
xpPanel.className = "xp-panel";
xpPanel.innerHTML = `
  <div class="xp-label">
    <strong id="levelText">LEVEL 1</strong>
    <span id="xpText">0 / 5 XP</span>
  </div>
  <div class="xp-track">
    <div id="xpFill" class="xp-fill"></div>
  </div>
`;
document.querySelector(".arena").before(xpPanel);

const levelText = document.getElementById("levelText");
const xpText = document.getElementById("xpText");
const xpFill = document.getElementById("xpFill");

const upgradeScreen = document.createElement("div");
upgradeScreen.className = "overlay hidden";
upgradeScreen.setAttribute("role", "dialog");
upgradeScreen.setAttribute("aria-modal", "true");
upgradeScreen.setAttribute("aria-labelledby", "upgradeTitle");
upgradeScreen.innerHTML = `
  <div class="upgrade-card">
    <p class="eyebrow">LEVEL UP</p>
    <h2 id="upgradeTitle">Choose your upgrade</h2>
    <p>The arena is paused. Pick one to continue.</p>
    <div id="upgradeOptions" class="upgrade-options"></div>
  </div>
`;
document.querySelector(".arena").append(upgradeScreen);

const upgradeOptions = document.getElementById("upgradeOptions");

overlayDescription.textContent =
  "Defeat enemies, collect purple gems, and upgrade your abilities.";
startButton.textContent = "Start Survival →";
document.querySelector(".game-footer p:last-child").textContent =
  "Auto-fire · Collect gems to level up";

const keys = new Set();
const movementKeys = new Set([
  "w", "a", "s", "d",
  "arrowup", "arrowleft", "arrowdown", "arrowright",
]);

const player = {
  x: 500,
  y: 300,
  radius: 16,
  speed: 260,
  angle: -Math.PI / 2,
  health: 100,
  maxHealth: 100,
  invincibleTime: 0,
  damage: 1,
 fireInterval: 0.7,
  magnetRadius: 75,
};

let enemies = [];
let bullets = [];
let particles = [];
let gems = [];

let running = false;
let upgrading = false;
let elapsedTime = 0;
let previousTime = null;
let score = 0;
let wave = 1;
let level = 1;
let xp = 0;
let xpNeeded = 5;
let spawnTimer = 0;
let shootTimer = 0;

const upgrades = [
  {
    icon: "⚡",
    name: "Rapid Fire",
    description: "Shoot 15% faster.",
    available: () => player.fireInterval > 0.1,
    apply: () => {
      player.fireInterval = Math.max(0.1, player.fireInterval * 0.85);
    },
  },
  {
    icon: "✦",
    name: "Power Shot",
    description: "Add 1 bullet damage.",
    available: () => true,
    apply: () => {
      player.damage += 1;
    },
  },
  {
    icon: "➜",
    name: "Quick Steps",
    description: "Add 25 movement speed.",
    available: () => player.speed < 460,
    apply: () => {
      player.speed = Math.min(460, player.speed + 25);
    },
  },
  {
    icon: "♥",
    name: "Recovery",
    description: "Restore 30 health.",
    available: () => player.health < player.maxHealth,
    apply: () => {
      player.health = Math.min(player.maxHealth, player.health + 30);
    },
  },
  {
    icon: "◈",
    name: "Vitality",
    description: "Add 20 maximum health and heal 20.",
    available: () => true,
    apply: () => {
      player.maxHealth += 20;
      player.health += 20;
    },
  },
  {
    icon: "◎",
    name: "Gem Magnet",
    description: "Collect gems from farther away.",
    available: () => player.magnetRadius < 250,
    apply: () => {
      player.magnetRadius = Math.min(250, player.magnetRadius + 35);
    },
  },
];

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (running && !upgrading && movementKeys.has(key)) {
    event.preventDefault();
    keys.add(key);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

function clearInput() {
  keys.clear();
  touchDirections.clear();
  updateTouchAppearance();
  previousTime = null;
}

window.addEventListener("blur", clearInput);
document.addEventListener("visibilitychange", clearInput);
startButton.addEventListener("click", startGame);

function startGame() {
  Object.assign(player, {
    x: canvas.width / 2,
    y: canvas.height / 2,
    speed: 260,
    angle: -Math.PI / 2,
    health: 100,
    maxHealth: 100,
    invincibleTime: 0,
    damage: 1,
   fireInterval: 0.7,
    magnetRadius: 75,
  });

  enemies = [];
  bullets = [];
  particles = [];
  gems = [];

  elapsedTime = 0;
  score = 0;
  wave = 1;
  level = 1;
  xp = 0;
  xpNeeded = 5;
  spawnTimer = 0.8;
  shootTimer = 0;
  upgrading = false;
  running = true;

  setPaused(false);
  clearInput();
  startScreen.classList.add("hidden");
  upgradeScreen.classList.add("hidden");
  startButton.blur();
  updateHUD();
}

function endGame() {
  running = false;
  playSound("gameOver");
  setPaused(false);
  clearInput();

  const newRecord = saveRecord();

  overlayEyebrow.textContent = newRecord
    ? "NEW PERSONAL BEST"
    : "MISSION ENDED";

  overlayTitle.textContent = newRecord
    ? "You set a new record!"
    : "You made your last stand.";

  overlayDescription.textContent =
    `Survived ${formatTime(elapsedTime)} · Wave ${wave} · ` +
    `Level ${level} · ${score.toLocaleString()} points · ` +
    `Best: ${bestScore.toLocaleString()}`;

  startButton.textContent = "Play Again →";
  startScreen.classList.remove("hidden");
  startButton.focus();
}

function formatTime(time) {
  const seconds = Math.floor(time);
  return (
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0")
  );
}

function updateHUD() {
  healthText.textContent = `${player.health} / ${player.maxHealth}`;
  const healthPercent = player.health / player.maxHealth * 100;

  healthBar.style.width = `${healthPercent}%`;
  healthBar.style.background = healthPercent <= 30
    ? "linear-gradient(90deg, #ef4444, #fb7185)"
    : "linear-gradient(90deg, #23c995, #70f5b9)";

  scoreText.textContent = score;
  timeText.textContent = formatTime(elapsedTime);
  waveText.textContent = wave;
  levelText.textContent = `LEVEL ${level}`;
  xpText.textContent = `${xp} / ${xpNeeded} XP`;
  xpFill.style.width = `${Math.min(100, xp / xpNeeded * 100)}%`;
}

function showUpgrade() {
  xp -= xpNeeded;
  level += 1;
  playSound("level");
  xpNeeded = 5 + (level - 1) * 3;
  upgrading = true;
  clearInput();

  // Shuffle available upgrades, then offer three distinct choices.
  const choices = upgrades.filter((upgrade) => upgrade.available());

  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  upgradeOptions.replaceChildren();
  document.getElementById("upgradeTitle").textContent =
    `Level ${level} — choose an upgrade`;

  for (const upgrade of choices.slice(0, 3)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "upgrade-option";
    button.innerHTML = `
      <span class="upgrade-icon" aria-hidden="true">${upgrade.icon}</span>
      <strong>${upgrade.name}</strong>
      <small>${upgrade.description}</small>
    `;

    button.addEventListener("click", () => {
      upgrade.apply();
      upgrading = false;
      upgradeScreen.classList.add("hidden");
      clearInput();
      updateHUD();

      // Preserve extra XP if several gems were collected together.
      if (xp >= xpNeeded) {
        showUpgrade();
      }
    });

    upgradeOptions.append(button);
  }

  upgradeScreen.classList.remove("hidden");
  updateHUD();
  upgradeOptions.querySelector("button").focus();
}

// Keep keyboard focus inside the upgrade dialog.
upgradeScreen.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;

  const buttons = [...upgradeOptions.querySelectorAll("button")];
  const first = buttons[0];
  const last = buttons[buttons.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

function updatePlayer(dt) {
  let dx = 0;
  let dy = 0;

  // Keyboard controls
  if (keys.has("w") || keys.has("arrowup")) dy--;
  if (keys.has("s") || keys.has("arrowdown")) dy++;
  if (keys.has("a") || keys.has("arrowleft")) dx--;
  if (keys.has("d") || keys.has("arrowright")) dx++;

  // Touch controls
  for (const direction of touchDirections.values()) {
    dx += direction.x;
    dy += direction.y;
  }

  const length = Math.hypot(dx, dy);

  if (length > 0) {
    // Maintain the same speed for diagonal movement.
    dx /= length;
    dy /= length;

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    player.angle = Math.atan2(dy, dx);
  }

  const padding = player.radius + 8;

  player.x = Math.max(
    padding,
    Math.min(canvas.width - padding, player.x)
  );

  player.y = Math.max(
    padding,
    Math.min(canvas.height - padding, player.y)
  );

  player.invincibleTime = Math.max(
    0,
    player.invincibleTime - dt
  );
}

function spawnEnemy() {
  const roll = Math.random();
  let type = "chaser";

  if (wave >= 3 && roll < 0.2) {
    type = "tank";
  } else if (wave >= 2 && roll < 0.5) {
    type = "runner";
  }

  const difficulty = Math.floor((wave - 1) / 3);

  const enemyTypes = {
    chaser: {
      radius: 14,
      speed: Math.min(190, 70 + wave * 7),
      health: 1 + difficulty,
      damage: 10,
      points: 10,
      xp: 1,
      color: "#ff557e",
    },

    runner: {
      radius: 11,
      speed: Math.min(235, 125 + wave * 8),
      health: 1 + Math.floor(difficulty / 2),
      damage: 8,
      points: 15,
      xp: 1,
      color: "#ffad55",
    },

    tank: {
      radius: 24,
      speed: Math.min(110, 45 + wave * 4),
      health: 5 + difficulty * 2,
      damage: 20,
      points: 30,
      xp: 3,
      color: "#b48aff",
    },
  };

  const stats = enemyTypes[type];
  const side = Math.floor(Math.random() * 4);

  let x;
  let y;

  if (side === 0) {
    x = Math.random() * canvas.width;
    y = -stats.radius;
  } else if (side === 1) {
    x = canvas.width + stats.radius;
    y = Math.random() * canvas.height;
  } else if (side === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + stats.radius;
  } else {
    x = -stats.radius;
    y = Math.random() * canvas.height;
  }

  enemies.push({
    ...stats,
    type,
    x,
    y,
    maxHealth: stats.health,
  });
}
function updateSpawning(dt) {
  wave = 1 + Math.floor(elapsedTime / 20);
  spawnTimer -= dt;

  if (spawnTimer <= 0) {
    if (enemies.length < 100) spawnEnemy();
    spawnTimer = Math.max(0.25, 1.1 - wave * 0.08);
  }
}

function updateShooting(dt) {
  shootTimer = Math.max(0, shootTimer - dt);

  // Wait until the cooldown finishes.
  if (shootTimer > 0 || enemies.length === 0) {
    return;
  }

  let nearest = null;
  let closestDistance = Infinity;

  for (const enemy of enemies) {
    const distance = Math.hypot(
      enemy.x - player.x,
      enemy.y - player.y
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      nearest = enemy;
    }
  }

  if (!nearest) return;

  const angle = Math.atan2(
    nearest.y - player.y,
    nearest.x - player.x
  );

  player.angle = angle;

  // Reset the cooldown before creating the bullet.
  shootTimer = player.fireInterval;

  bullets.push({
    x: player.x + Math.cos(angle) * 24,
    y: player.y + Math.sin(angle) * 24,
    vx: Math.cos(angle) * 580,
    vy: Math.sin(angle) * 580,
    radius: 4,
    damage: player.damage,
    life: 2,
  });

  playSound("shoot");
}

function createParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 150;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 3,
      life: 0.45,
      color,
    });
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];

    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.life <= 0 ||
      bullet.x < -20 ||
      bullet.x > canvas.width + 20 ||
      bullet.y < -20 ||
      bullet.y > canvas.height + 20
    ) {
      bullets.splice(i, 1);
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];

      const distance = Math.hypot(
        bullet.x - enemy.x,
        bullet.y - enemy.y
      );

      if (distance < bullet.radius + enemy.radius) {
        bullets.splice(i, 1);
        enemy.health -= bullet.damage;

        createParticles(enemy.x, enemy.y, enemy.color, 5);

        if (enemy.health <= 0) {
          createParticles(enemy.x, enemy.y, enemy.color, 12);

          gems.push({
            x: Math.max(24, Math.min(canvas.width - 24, enemy.x)),
            y: Math.max(24, Math.min(canvas.height - 24, enemy.y)),
            value: enemy.xp,
          });

          score += enemy.points;
          enemies.splice(j, 1);
        }

        break;
      }
    }
  }
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 0) {
      enemy.x += dx / distance * enemy.speed * dt;
      enemy.y += dy / distance * enemy.speed * dt;
    }

    if (
      Math.hypot(player.x - enemy.x, player.y - enemy.y) <
      player.radius + enemy.radius &&
      player.invincibleTime <= 0
      
    ) {
      if (player.health > 0) playSound("damage");
      player.health = Math.max(0, player.health - enemy.damage);
      player.invincibleTime = 0.8;
      createParticles(player.x, player.y, "#65dbff", 8);

      const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      enemy.x = player.x + Math.cos(angle) * 65;
      enemy.y = player.y + Math.sin(angle) * 65;

      if (player.health <= 0) {
        endGame();
        return;
      }
    }
  }
}

function updateGems(dt) {
  for (let i = gems.length - 1; i >= 0; i--) {
    const gem = gems[i];
    const dx = player.x - gem.x;
    const dy = player.y - gem.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= player.radius + 7) {
      xp += gem.value;
      playSound("collect");
      gems.splice(i, 1);
      createParticles(gem.x, gem.y, "#c4a0ff", 4);
    } else if (distance < player.magnetRadius) {
      const step = Math.min(distance, 380 * dt);
      gem.x += dx / distance * step;
      gem.y += dy / distance * step;
    }
  }

  if (xp >= xpNeeded) showUpgrade();
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;

    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function drawArena() {
  ctx.fillStyle = "#0b1120";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#182338";
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = 0; x <= canvas.width; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }

  for (let y = 0; y <= canvas.height; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }

  ctx.stroke();

  const glow = ctx.createRadialGradient(500, 300, 0, 500, 300, 420);
  glow.addColorStop(0, "#536bce12");
  glow.addColorStop(1, "#536bce00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#53658d";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  if (
    player.invincibleTime > 0 &&
    Math.floor(player.invincibleTime * 15) % 2 === 0
  ) {
    ctx.globalAlpha = 0.4;
  }

  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 9, 0, Math.PI * 2);
  ctx.strokeStyle = "#65dbff35";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.shadowColor = "#65dbff";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#65dbff";
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#e5faff";
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(player.angle);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(player.radius + 10, 0);
  ctx.lineTo(player.radius + 1, -5);
  ctx.lineTo(player.radius + 1, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDiamond(x, y, radius, color, glow = 12) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius, 0);
  ctx.lineTo(0, radius);
  ctx.lineTo(-radius, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawObjects() {
  // Experience gems
  for (const gem of gems) {
    drawDiamond(
      gem.x,
      gem.y,
      gem.value >= 3 ? 9 : 6,
      gem.value >= 3 ? "#e0b3ff" : "#b78aff"
    );
  }

  // Enemies
  for (const enemy of enemies) {
    if (enemy.type === "runner") {
      const angle = Math.atan2(
        player.y - enemy.y,
        player.x - enemy.x
      );

      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(angle);

      ctx.fillStyle = enemy.color;
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(enemy.radius, 0);
      ctx.lineTo(-enemy.radius, -enemy.radius * 0.8);
      ctx.lineTo(-enemy.radius, enemy.radius * 0.8);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#753909";
      ctx.fillRect(-5, -3, 6, 6);

      ctx.restore();
    } else if (enemy.type === "tank") {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);

      ctx.fillStyle = enemy.color;
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 18;

      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#43236e";
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius - 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#43236e";
      ctx.fillRect(-5, -5, 10, 10);

      ctx.restore();
    } else {
      drawDiamond(
        enemy.x,
        enemy.y,
        enemy.radius,
        enemy.color
      );

      ctx.fillStyle = "#5c142d";
      ctx.fillRect(enemy.x - 4, enemy.y - 4, 8, 8);
    }

    // Show remaining health on tougher enemies.
    if (enemy.maxHealth > 1) {
      const barWidth = enemy.radius * 2;
      const barX = enemy.x - barWidth / 2;
      const barY = enemy.y - enemy.radius - 10;

      ctx.fillStyle = "#293249";
      ctx.fillRect(barX, barY, barWidth, 4);

      ctx.fillStyle = enemy.color;
      ctx.fillRect(
        barX,
        barY,
        barWidth * Math.max(0, enemy.health / enemy.maxHealth),
        4
      );
    }
  }

  // Bullets
  ctx.save();
  ctx.fillStyle = "#fff0a6";
  ctx.shadowColor = "#ffe27a";
  ctx.shadowBlur = 12;

  for (const bullet of bullets) {
    ctx.beginPath();
    ctx.arc(
      bullet.x,
      bullet.y,
      bullet.radius,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();

  // Hit and collection particles
  ctx.save();

  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / 0.45);
    ctx.fillStyle = particle.color;

    ctx.beginPath();
    ctx.arc(
      particle.x,
      particle.y,
      particle.radius,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();
}

function gameLoop(timestamp) {
  const dt = previousTime === null
    ? 0
    : Math.min((timestamp - previousTime) / 1000, 0.05);

  previousTime = timestamp;

  if (running && !upgrading && !paused && !document.hidden) {
    elapsedTime += dt;

    updatePlayer(dt);
    updateSpawning(dt);
    updateShooting(dt);
    updateBullets(dt);
    updateEnemies(dt);

    if (running) {
      updateGems(dt);
    }

    updateParticles(dt);
    updateHUD();
  }

  drawArena();
  drawObjects();
  drawPlayer();

  requestAnimationFrame(gameLoop);
}

updateHUD();
requestAnimationFrame(gameLoop);

// Saved personal record
const recordKey = "last-stand-best-score";

function loadBestScore() {
  try {
    const value = Number(localStorage.getItem(recordKey));

    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

let bestScore = loadBestScore();

const recordPanel = document.createElement("div");
recordPanel.className = "record-panel";

const recordLabel = document.createElement("span");
recordLabel.textContent = "PERSONAL BEST";

const recordValue = document.createElement("strong");
recordValue.textContent = `${bestScore.toLocaleString()} points`;

recordPanel.append(recordLabel, recordValue);
document.querySelector(".game-header").after(recordPanel);

function saveRecord() {
  if (score <= bestScore) return false;

  bestScore = score;
  recordValue.textContent = `${bestScore.toLocaleString()} points`;

  try {
    localStorage.setItem(recordKey, String(bestScore));
  } catch {
    // The record still works for this session if storage is unavailable.
  }

  return true;
}

let paused = false;

const gameControls = document.createElement("div");
gameControls.className = "game-controls";

const pauseButton = document.createElement("button");
pauseButton.type = "button";
pauseButton.className = "control-button";
pauseButton.textContent = "Pause · P";
pauseButton.disabled = true;

gameControls.append(pauseButton);
document.querySelector(".arena").before(gameControls);

const pauseScreen = document.createElement("div");
pauseScreen.className = "overlay hidden";
pauseScreen.setAttribute("role", "dialog");
pauseScreen.setAttribute("aria-modal", "true");
pauseScreen.setAttribute("aria-labelledby", "pauseTitle");

pauseScreen.innerHTML = `
  <div class="overlay-card">
    <span class="game-icon" aria-hidden="true">Ⅱ</span>
    <p class="eyebrow">TAKE A BREATHER</p>
    <h2 id="pauseTitle">Game paused</h2>
    <p>Your run is waiting. Resume when you're ready.</p>
    <button id="resumeButton" type="button">Resume Game →</button>
    <small>Press P or Escape to continue</small>
  </div>
`;

document.querySelector(".arena").append(pauseScreen);

const resumeButton = document.getElementById("resumeButton");

function setPaused(value) {
  paused = value;
  clearInput();

  pauseScreen.classList.toggle("hidden", !paused);
  pauseButton.textContent = paused ? "Resume · P" : "Pause · P";
  pauseButton.disabled = !running;

  if (paused) {
    resumeButton.focus();
  } else {
    // Return keyboard control to the game.
    if (pauseScreen.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    pauseButton.blur();
  }
}

function togglePause() {
  // Upgrade selection already pauses the game.
  if (!running || upgrading) return;

  setPaused(!paused);
}

pauseButton.addEventListener("click", togglePause);
resumeButton.addEventListener("click", () => setPaused(false));

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (
    running &&
    !upgrading &&
    (key === "p" || key === "escape")
  ) {
    event.preventDefault();

    if (!event.repeat) togglePause();
  }
});

// Keep Tab focus on the resume button while paused.
pauseScreen.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    resumeButton.focus();
  }
});

function pauseWhenAway() {
  if (running && !upgrading && !paused) {
    setPaused(true);
  }
}

window.addEventListener("blur", pauseWhenAway);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseWhenAway();
});

// Tracks each held touch separately for diagonal movement.
const touchDirections = new Map();

const touchControls = document.createElement("section");
touchControls.className = "touch-controls";
touchControls.setAttribute("aria-label", "Touch movement controls");

touchControls.innerHTML = `
  <div class="direction-pad">
    <button
      type="button"
      class="direction-button"
      data-direction="up"
      aria-label="Move up"
    >↑</button>

    <button
      type="button"
      class="direction-button"
      data-direction="left"
      aria-label="Move left"
    >←</button>

    <button
      type="button"
      class="direction-button"
      data-direction="right"
      aria-label="Move right"
    >→</button>

    <button
      type="button"
      class="direction-button"
      data-direction="down"
      aria-label="Move down"
    >↓</button>
  </div>
  <p>Hold to move · Hold two arrows to move diagonally</p>
`;

document.querySelector(".arena").after(touchControls);

const directionVectors = {
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
};

function updateTouchAppearance() {
  for (const button of touchControls.querySelectorAll("button")) {
    const active = [...touchDirections.values()].some(
      (touch) => touch.button === button
    );

    button.classList.toggle("active", active);
  }
}

function releaseTouch(event) {
  touchDirections.delete(event.pointerId);
  updateTouchAppearance();
}

for (const button of touchControls.querySelectorAll("button")) {
  button.addEventListener("pointerdown", (event) => {
    if (
      !running ||
      paused ||
      upgrading ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    event.preventDefault();
    button.setPointerCapture(event.pointerId);

    const vector = directionVectors[button.dataset.direction];

    touchDirections.set(event.pointerId, {
      x: vector.x,
      y: vector.y,
      button,
    });

    updateTouchAppearance();
  });

  button.addEventListener("pointerup", releaseTouch);
  button.addEventListener("pointercancel", releaseTouch);
  button.addEventListener("lostpointercapture", releaseTouch);

  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

let audioContext = null;
let soundEnabled = true;

const soundButton = document.createElement("button");
soundButton.type = "button";
soundButton.className = "control-button";
soundButton.textContent = "Sound: On";
soundButton.setAttribute("aria-pressed", "true");

gameControls.prepend(soundButton);

function unlockAudio() {
  if (!soundEnabled) return;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
  } catch {
    // Gameplay continues if audio is unavailable.
  }
}

// Browsers enable audio after a user interaction.
startButton.addEventListener("click", unlockAudio);
resumeButton.addEventListener("click", unlockAudio);
pauseButton.addEventListener("click", unlockAudio);

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;

  soundButton.textContent = soundEnabled
    ? "Sound: On"
    : "Sound: Off";

  soundButton.setAttribute("aria-pressed", String(soundEnabled));

  if (soundEnabled) {
    unlockAudio();
  } else if (audioContext) {
    audioContext.suspend().catch(() => {});
  }

  soundButton.blur();
});

function playSound(type) {
  if (
    !soundEnabled ||
    !audioContext ||
    audioContext.state !== "running"
  ) {
    return;
  }

  const sounds = {
    shoot: {
      start: 700,
      end: 250,
      duration: 0.07,
      volume: 0.025,
      wave: "triangle",
    },
    collect: {
      start: 950,
      end: 1500,
      duration: 0.09,
      volume: 0.035,
      wave: "sine",
    },
    level: {
      start: 440,
      end: 1100,
      duration: 0.4,
      volume: 0.06,
      wave: "sine",
    },
    damage: {
      start: 160,
      end: 60,
      duration: 0.15,
      volume: 0.05,
      wave: "triangle",
    },
    gameOver: {
      start: 350,
      end: 45,
      duration: 0.65,
      volume: 0.07,
      wave: "triangle",
    },
  };

  const sound = sounds[type];
  if (!sound) return;

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = sound.wave;
  oscillator.frequency.setValueAtTime(sound.start, now);
  oscillator.frequency.exponentialRampToValueAtTime(
    sound.end,
    now + sound.duration
  );

  // Fade in and out to avoid clicks.
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(sound.volume, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    now + sound.duration
  );

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + sound.duration);

  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}