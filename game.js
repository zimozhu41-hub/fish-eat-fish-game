const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const sizeEl = document.getElementById("size");
const statusEl = document.getElementById("status");
const difficultyMeterEl = document.getElementById("difficultyMeter");
const panelEl = document.getElementById("panel");
const panelTitleEl = document.getElementById("panelTitle");
const panelTextEl = document.getElementById("panelText");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const difficultyButtons = Array.from(document.querySelectorAll(".difficulty-button"));

const palette = [
  ["#ff8f59", "#ff5d5d"],
  ["#ffd75e", "#ff9f43"],
  ["#3fe0d0", "#177dd2"],
  ["#89f57a", "#36b37e"],
  ["#ffa8f0", "#d26cf0"],
];

const difficultyConfig = {
  easy: {
    label: "休闲",
    spawnRate: 1,
    predatorBias: 0.82,
    speedBias: 0.92,
  },
  normal: {
    label: "标准",
    spawnRate: 1.16,
    predatorBias: 1,
    speedBias: 1,
  },
  hard: {
    label: "凶险",
    spawnRate: 1.34,
    predatorBias: 1.2,
    speedBias: 1.12,
  },
};

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  running: false,
  gameOver: false,
  score: 0,
  elapsed: 0,
  difficulty: "easy",
  level: 1,
  fish: [],
  particles: [],
  nextSpawnIn: 0,
  pointer: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5, active: false },
  input: { boosting: false },
  lastTime: 0,
  player: null,
};

const audio = {
  context: null,
  master: null,
  boostLastTone: 0,
};

function resizeCanvas() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(state.width * ratio);
  canvas.height = Math.floor(state.height * ratio);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (state.player) {
    state.player.x = clamp(state.player.x, state.player.size, state.width - state.player.size);
    state.player.y = clamp(state.player.y, state.player.size, state.height - state.player.size);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getDifficultyInfo() {
  return difficultyConfig[state.difficulty];
}

function getDangerLevel() {
  const minutes = state.elapsed / 60;
  return 1 + Math.floor(minutes * 1.4);
}

function setDifficulty(mode) {
  state.difficulty = mode in difficultyConfig ? mode : "easy";
  for (const button of difficultyButtons) {
    button.classList.toggle("active", button.dataset.difficulty === state.difficulty);
  }
  const info = getDifficultyInfo();
  difficultyMeterEl.textContent = `${info.label} · ${state.level}级`;
}

function ensureAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  if (!audio.context) {
    audio.context = new AudioCtx();
    audio.master = audio.context.createGain();
    audio.master.gain.value = 0.18;
    audio.master.connect(audio.context.destination);
  }

  if (audio.context.state === "suspended") {
    audio.context.resume().catch(() => {});
  }
}

function playTone({ frequency, duration = 0.12, type = "sine", volume = 0.18, slideTo = null }) {
  if (!audio.context || !audio.master) {
    return;
  }

  const now = audio.context.currentTime;
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(audio.master);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playEatSound(size) {
  ensureAudio();
  playTone({
    frequency: clamp(520 - size * 2.2, 180, 520),
    slideTo: clamp(760 - size, 240, 760),
    duration: 0.12,
    type: "triangle",
    volume: 0.11,
  });
}

function playGameOverSound() {
  ensureAudio();
  playTone({ frequency: 210, slideTo: 96, duration: 0.42, type: "sawtooth", volume: 0.16 });
}

function playBoostPulse() {
  ensureAudio();
  if (!audio.context) {
    return;
  }

  const now = audio.context.currentTime;
  if (now - audio.boostLastTone < 0.09) {
    return;
  }

  audio.boostLastTone = now;
  playTone({ frequency: 180, slideTo: 130, duration: 0.08, type: "square", volume: 0.04 });
}

function resetGame() {
  state.score = 0;
  state.gameOver = false;
  state.elapsed = 0;
  state.level = 1;
  state.fish = [];
  state.particles = [];
  state.nextSpawnIn = 0;
  state.input.boosting = false;
  state.pointer.x = state.width * 0.5;
  state.pointer.y = state.height * 0.5;
  state.player = {
    x: state.width * 0.5,
    y: state.height * 0.5,
    vx: 0,
    vy: 0,
    mass: 26 * 26,
    size: 26,
    hue: ["#ffd166", "#f77f00"],
  };
  updateHud();
}

function startGame() {
  ensureAudio();
  resetGame();
  state.running = true;
  panelEl.classList.add("hidden");
  statusEl.textContent = "寻找小鱼";
}

function stopGame() {
  state.running = false;
  state.gameOver = true;
  state.input.boosting = false;
  panelTitleEl.textContent = "你被大鱼吃掉了";
  panelTextEl.textContent = `本次得分 ${state.score}，你的体型长到了 ${(
    state.player.size / 26
  ).toFixed(1)}x，最高难度来到 ${state.level} 级。再来一次，先稳扎稳打吃小鱼。`;
  startButton.textContent = "再玩一局";
  panelEl.classList.remove("hidden");
  statusEl.textContent = "被大鱼吃掉";
  playGameOverSound();
}

function updateHud() {
  scoreEl.textContent = state.score;
  sizeEl.textContent = `${(state.player.size / 26).toFixed(1)}x`;
  difficultyMeterEl.textContent = `${getDifficultyInfo().label} · ${state.level}级`;
}

function chooseFishSize() {
  const base = state.player.size;
  const info = getDifficultyInfo();
  const pressure = 1 + Math.min(state.elapsed / 70, 1.7);
  const roll = Math.random();

  if (roll < 0.56 / info.predatorBias) {
    return randomBetween(Math.max(10, base * 0.3), Math.max(18, base * (0.9 / pressure)));
  }
  if (roll < 0.88) {
    return randomBetween(Math.max(18, base * 0.92), Math.max(26, base * (1.18 + pressure * 0.08)));
  }
  return randomBetween(
    Math.max(30, base * (1.22 + pressure * 0.12 * info.predatorBias)),
    Math.max(42, base * (1.74 + pressure * 0.16 * info.predatorBias)),
  );
}

function spawnFish() {
  const size = chooseFishSize();
  const fromLeft = Math.random() > 0.5;
  const colors = palette[(Math.random() * palette.length) | 0];
  const info = getDifficultyInfo();
  const pressure = 1 + Math.min(state.elapsed / 55, 1.55);
  const speed = clamp((240 - size * 2 + randomBetween(-16, 18)) * info.speedBias * pressure, 48, 280);
  const x = fromLeft ? -size * 3 : state.width + size * 3;
  const y = randomBetween(size * 1.5, state.height - size * 1.5);

  state.fish.push({
    x,
    y,
    size,
    speed,
    dir: fromLeft ? 1 : -1,
    wobble: randomBetween(0, Math.PI * 2),
    wobbleSpeed: randomBetween(1.4, 2.6),
    hue: colors,
  });
}

function emitBubbles(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      kind: "bubble",
      x,
      y,
      vx: randomBetween(-45, 45),
      vy: randomBetween(-60, -10),
      life: randomBetween(0.4, 0.9),
      age: 0,
      radius: randomBetween(2, 6),
      color,
    });
  }
}

function emitBurst(x, y, size, colors) {
  for (let i = 0; i < 14; i += 1) {
    const angle = (Math.PI * 2 * i) / 14 + randomBetween(-0.18, 0.18);
    const speed = randomBetween(50, 120) + size;
    state.particles.push({
      kind: "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomBetween(0.24, 0.42),
      age: 0,
      radius: randomBetween(2, 5),
      color: colors[i % colors.length],
    });
  }

  state.particles.push({
    kind: "ring",
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0.35,
    age: 0,
    radius: Math.max(18, size * 0.6),
    color: colors[0],
  });
}

function growPlayer(preySize) {
  state.player.mass += preySize * preySize * 0.4;
  state.player.size = Math.sqrt(state.player.mass);
  state.score += Math.max(1, Math.round(preySize * 2));
  updateHud();
  playEatSound(preySize);

  if (state.player.size < 40) {
    statusEl.textContent = "继续吃小鱼";
  } else if (state.player.size < 70) {
    statusEl.textContent = "你已经能挑战中鱼了";
  } else {
    statusEl.textContent = "现在可以吃更大的鱼";
  }
}

function updatePlayer(dt) {
  const player = state.player;
  const dx = state.pointer.x - player.x;
  const dy = state.pointer.y - player.y;
  const distance = Math.hypot(dx, dy) || 1;
  const boosting = state.input.boosting && player.size > 16.5;
  const boostMultiplier = boosting ? 1.85 : 1;
  const speedLimit = clamp((260 - player.size * 1.3) * boostMultiplier, 92, 360);
  const accel = clamp(distance * 3.6, 0, speedLimit);

  player.vx += (dx / distance) * accel * dt;
  player.vy += (dy / distance) * accel * dt;

  player.vx *= boosting ? 0.95 : 0.92;
  player.vy *= boosting ? 0.95 : 0.92;

  const velocity = Math.hypot(player.vx, player.vy);
  if (velocity > speedLimit) {
    player.vx = (player.vx / velocity) * speedLimit;
    player.vy = (player.vy / velocity) * speedLimit;
  }

  if (boosting) {
    const loss = Math.max(14, player.size * 1.3) * dt;
    player.mass = Math.max(15 * 15, player.mass - loss);
    player.size = Math.sqrt(player.mass);
    statusEl.textContent = "冲刺中，正在消耗体型";
    playBoostPulse();
    emitBubbles(player.x - player.size * 0.9, player.y, 1, "rgba(255,255,255,0.9)");
  }

  player.x = clamp(player.x + player.vx * dt, player.size, state.width - player.size);
  player.y = clamp(player.y + player.vy * dt, player.size, state.height - player.size);
  updateHud();
}

function updateFish(dt) {
  state.elapsed += dt;
  state.level = getDangerLevel();
  state.nextSpawnIn -= dt;
  const info = getDifficultyInfo();
  const intensity = 1 + Math.min(state.elapsed / 65, 1.8);
  const targetCount = clamp(Math.round((18 + Math.floor(state.player.size / 9) + state.level) * info.spawnRate), 18, 46);

  if (state.nextSpawnIn <= 0 && state.fish.length < targetCount) {
    spawnFish();
    state.nextSpawnIn = randomBetween(0.1, 0.28) / intensity / info.spawnRate;
  }

  for (let i = state.fish.length - 1; i >= 0; i -= 1) {
    const fish = state.fish[i];
    fish.wobble += dt * fish.wobbleSpeed;
    fish.x += fish.dir * fish.speed * dt;
    fish.y += Math.sin(fish.wobble) * 28 * dt;
    fish.y = clamp(fish.y, fish.size, state.height - fish.size);

    const collisionDistance = fish.size * 0.72 + state.player.size * 0.7;
    const distance = Math.hypot(fish.x - state.player.x, fish.y - state.player.y);

    if (distance < collisionDistance) {
      if (state.player.size >= fish.size * 1.04) {
        emitBubbles(fish.x, fish.y, 8, fish.hue[0]);
        emitBurst(fish.x, fish.y, fish.size, fish.hue);
        growPlayer(fish.size);
        state.fish.splice(i, 1);
        continue;
      }

      emitBubbles(state.player.x, state.player.y, 14, "#ffffff");
      emitBurst(state.player.x, state.player.y, state.player.size, ["#ffffff", "#ffd6a5"]);
      stopGame();
      return;
    }

    const outOfBounds =
      (fish.dir > 0 && fish.x - fish.size * 4 > state.width) ||
      (fish.dir < 0 && fish.x + fish.size * 4 < 0);

    if (outOfBounds) {
      state.fish.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.age += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= particle.kind === "spark" ? 0.94 : 0.98;
    particle.vy += particle.kind === "spark" ? 14 * dt : -6 * dt;

    if (particle.age >= particle.life) {
      state.particles.splice(i, 1);
    }
  }
}

function drawBackground(now) {
  ctx.clearRect(0, 0, state.width, state.height);

  const glow = ctx.createRadialGradient(
    state.width * 0.75,
    state.height * 0.12,
    40,
    state.width * 0.75,
    state.height * 0.12,
    state.width * 0.55,
  );
  glow.addColorStop(0, "rgba(255,255,255,0.22)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, state.width, state.height);

  for (let i = 0; i < 18; i += 1) {
    const x = ((i * 133) % state.width) + Math.sin(now * 0.0007 + i) * 24;
    const y = ((i * 97) % state.height) + Math.cos(now * 0.0005 + i) * 36;
    const radius = 2 + (i % 3);
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const baseY = state.height - 18;
  for (let i = 0; i < 14; i += 1) {
    const x = (i / 13) * state.width;
    const sway = Math.sin(now * 0.001 + i * 0.8) * 20;
    ctx.strokeStyle = i % 2 === 0 ? "rgba(71, 209, 172, 0.42)" : "rgba(127, 246, 191, 0.28)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + sway, state.height * 0.78, x - sway * 0.5, state.height * 0.62);
    ctx.stroke();
  }
}

function drawFish(fish, isPlayer = false) {
  const angle = isPlayer
    ? Math.atan2(state.player.vy, state.player.vx || 0.0001)
    : fish.dir > 0
      ? 0
      : Math.PI;
  const tailWave = Math.sin((state.lastTime / 120) * (isPlayer ? 1.6 : fish.wobbleSpeed)) * fish.size * 0.18;

  ctx.save();
  ctx.translate(fish.x, fish.y);
  ctx.rotate(angle);

  const body = ctx.createLinearGradient(-fish.size, 0, fish.size, 0);
  body.addColorStop(0, fish.hue[0]);
  body.addColorStop(1, fish.hue[1]);

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, fish.size * 1.25, fish.size * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-fish.size * 1.08, 0);
  ctx.lineTo(-fish.size * 1.75, -fish.size * 0.58 + tailWave);
  ctx.lineTo(-fish.size * 1.75, fish.size * 0.58 - tailWave);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.26)";
  ctx.beginPath();
  ctx.ellipse(fish.size * 0.12, -fish.size * 0.18, fish.size * 0.5, fish.size * 0.16, -0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(fish.size * 0.68, -fish.size * 0.16, fish.size * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0d1d26";
  ctx.beginPath();
  ctx.arc(fish.size * 0.72, -fish.size * 0.16, fish.size * 0.06, 0, Math.PI * 2);
  ctx.fill();

  if (isPlayer) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, fish.size * 1.15, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    const alpha = 1 - particle.age / particle.life;
    ctx.globalAlpha = alpha * 0.8;

    if (particle.kind === "ring") {
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = particle.color;
      ctx.arc(particle.x, particle.y, particle.radius + particle.age * 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }

    ctx.beginPath();
    ctx.fillStyle = particle.color;
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function frame(now) {
  const dt = Math.min((now - state.lastTime) / 1000 || 0, 0.033);
  state.lastTime = now;

  drawBackground(now);

  if (state.running) {
    updatePlayer(dt);
    updateFish(dt);
    updateParticles(dt);
  } else {
    updateParticles(dt);
  }

  for (const fish of state.fish) {
    drawFish(fish);
  }

  if (state.player) {
    drawFish(state.player, true);
  }

  drawParticles();

  requestAnimationFrame(frame);
}

function setPointerPosition(clientX, clientY) {
  state.pointer.x = clamp(clientX, 0, state.width);
  state.pointer.y = clamp(clientY, 0, state.height);
  state.pointer.active = true;
}

window.addEventListener("resize", resizeCanvas);

canvas.addEventListener("pointermove", (event) => {
  setPointerPosition(event.clientX, event.clientY);
});

canvas.addEventListener("pointerdown", (event) => {
  setPointerPosition(event.clientX, event.clientY);
  ensureAudio();
  if (event.button === 0 && state.running) {
    state.input.boosting = true;
  }
  if (!state.running && !state.gameOver) {
    startGame();
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (event.button === 0) {
    state.input.boosting = false;
    if (state.running) {
      statusEl.textContent = "寻找小鱼";
    }
  }
});

canvas.addEventListener("pointerleave", () => {
  state.input.boosting = false;
  if (state.running) {
    statusEl.textContent = "寻找小鱼";
  }
});

window.addEventListener("pointerup", () => {
  state.input.boosting = false;
  if (state.running) {
    statusEl.textContent = "寻找小鱼";
  }
});

for (const button of difficultyButtons) {
  button.addEventListener("click", () => {
    setDifficulty(button.dataset.difficulty);
  });
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

setDifficulty("easy");
resetGame();
resizeCanvas();
requestAnimationFrame(frame);
