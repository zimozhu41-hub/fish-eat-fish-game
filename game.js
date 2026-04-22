const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const sizeEl = document.getElementById("size");
const statusEl = document.getElementById("status");
const difficultyMeterEl = document.getElementById("difficultyMeter");
const powerEl = document.getElementById("powerStatus");
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

const rareEffectLabels = {
  invincible: "无敌 4 秒",
  sweep: "吞掉周围 4 条鱼",
};

const fishSpecies = [
  {
    id: "tadpole",
    label: "蝌蚪",
    rarity: "common",
    unlockLevel: 1,
    weight: 5.4,
    band: "small",
    body: "tadpole",
    speedBias: 1.24,
    palettes: [
      ["#4f7c7a", "#23353b"],
      ["#7bc8a4", "#3c6e5c"],
    ],
  },
  {
    id: "silver-fry",
    label: "银鳞鱼苗",
    rarity: "common",
    unlockLevel: 1,
    weight: 5,
    band: "small",
    body: "slim",
    speedBias: 1.16,
    palettes: [
      ["#d7ecff", "#7ec8ff"],
      ["#c3f5ff", "#4bb5e9"],
    ],
  },
  {
    id: "reef-minnow",
    label: "珊瑚小鱼",
    rarity: "common",
    unlockLevel: 1,
    weight: 4.4,
    band: "medium",
    body: "stripe",
    speedBias: 1.02,
    palettes: [
      ["#ffd56b", "#ff8f5e"],
      ["#fff1a9", "#ff9f68"],
    ],
  },
  {
    id: "river-round",
    label: "圆鳍河鱼",
    rarity: "common",
    unlockLevel: 2,
    weight: 4,
    band: "medium",
    body: "round",
    speedBias: 0.96,
    palettes: [
      ["#8cf5d8", "#1e9f8a"],
      ["#f4ff8d", "#83cf43"],
    ],
  },
  {
    id: "dart-fish",
    label: "飞梭鱼",
    rarity: "uncommon",
    unlockLevel: 3,
    weight: 3.1,
    band: "medium",
    body: "slim",
    speedBias: 1.22,
    palettes: [
      ["#c6f2ff", "#50a9ff"],
      ["#efe9ff", "#7f84ff"],
    ],
  },
  {
    id: "carp",
    label: "锦鳞鲤",
    rarity: "uncommon",
    unlockLevel: 4,
    weight: 2.8,
    band: "large",
    body: "round",
    speedBias: 0.88,
    palettes: [
      ["#ffe8b6", "#ff8e4d"],
      ["#fff1d6", "#f06c48"],
    ],
  },
  {
    id: "puffer",
    label: "鼓肚河豚",
    rarity: "uncommon",
    unlockLevel: 5,
    weight: 2.3,
    band: "medium",
    body: "puffer",
    speedBias: 0.82,
    palettes: [
      ["#ffe77a", "#f2a900"],
      ["#fff8bf", "#ffb703"],
    ],
  },
  {
    id: "angel",
    label: "绸翼神仙鱼",
    rarity: "rare",
    unlockLevel: 6,
    weight: 1.45,
    band: "medium",
    body: "angel",
    speedBias: 1.02,
    palettes: [
      ["#fff6ff", "#d26cf0"],
      ["#d5f7ff", "#62b7ff"],
    ],
  },
  {
    id: "moon-koi",
    label: "月影锦鲤",
    rarity: "rare",
    unlockLevel: 7,
    weight: 1.22,
    band: "large",
    body: "stripe",
    speedBias: 0.95,
    palettes: [
      ["#ffe5f6", "#ff7ab6"],
      ["#d5fff2", "#4fdbb1"],
    ],
  },
  {
    id: "blade-fish",
    label: "霜刃旗鱼",
    rarity: "rare",
    unlockLevel: 8,
    weight: 1.08,
    band: "large",
    body: "blade",
    speedBias: 1.08,
    palettes: [
      ["#dff7ff", "#7dd0ff"],
      ["#f4fbff", "#91b7ff"],
    ],
  },
  {
    id: "nebula",
    label: "星潮灵鱼",
    rarity: "legendary",
    unlockLevel: 10,
    weight: 0.55,
    band: "medium",
    body: "glow",
    speedBias: 1,
    palettes: [
      ["#fef1ff", "#a36cff"],
      ["#d9ffff", "#3fd9ff"],
    ],
  },
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
  nextFishId: 1,
  lastRareAlertAt: -10,
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

function randomItem(items) {
  return items[(Math.random() * items.length) | 0];
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
  updateHud();
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

function playRareSound(effect) {
  ensureAudio();
  if (effect === "invincible") {
    playTone({ frequency: 480, slideTo: 860, duration: 0.2, type: "triangle", volume: 0.12 });
    playTone({ frequency: 660, slideTo: 980, duration: 0.24, type: "sine", volume: 0.08 });
    return;
  }
  playTone({ frequency: 180, slideTo: 120, duration: 0.18, type: "square", volume: 0.1 });
  playTone({ frequency: 230, slideTo: 520, duration: 0.2, type: "sawtooth", volume: 0.09 });
}

function resetGame() {
  state.score = 0;
  state.gameOver = false;
  state.elapsed = 0;
  state.level = 1;
  state.fish = [];
  state.particles = [];
  state.nextSpawnIn = 0;
  state.nextFishId = 1;
  state.lastRareAlertAt = -10;
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
    body: "hero",
    powerMessage: "",
    powerMessageTimer: 0,
    invincibleTimer: 0,
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
  ).toFixed(1)}x，最高难度来到 ${state.level} 级。再来一次，试着抢到稀有鱼的特效。`;
  startButton.textContent = "再玩一局";
  panelEl.classList.remove("hidden");
  statusEl.textContent = "被大鱼吃掉";
  playGameOverSound();
}

function getPowerText() {
  if (state.player.invincibleTimer > 0) {
    return `无敌 ${state.player.invincibleTimer.toFixed(1)}s`;
  }
  if (state.player.powerMessageTimer > 0) {
    return state.player.powerMessage;
  }
  return "无";
}

function updateHud() {
  scoreEl.textContent = state.score;
  sizeEl.textContent = `${(state.player.size / 26).toFixed(1)}x`;
  difficultyMeterEl.textContent = `${getDifficultyInfo().label} · ${state.level}级`;
  powerEl.textContent = getPowerText();
}

function getSizeBand(size) {
  if (size < 18) {
    return "small";
  }
  if (size < 34) {
    return "medium";
  }
  return "large";
}

function getRarityMultiplier(rarity) {
  const pressure = state.level + state.elapsed / 40;
  switch (rarity) {
    case "common":
      return clamp(1.6 - pressure * 0.08, 0.55, 1.6);
    case "uncommon":
      return clamp(0.7 + pressure * 0.09, 0.72, 1.75);
    case "rare":
      return clamp((pressure - 2.5) * 0.18, 0.08, 1.35);
    case "legendary":
      return clamp((pressure - 6) * 0.12, 0, 0.9);
    default:
      return 1;
  }
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

function chooseSpecies(size) {
  const band = getSizeBand(size);
  const available = fishSpecies.filter((species) => species.unlockLevel <= state.level + 1);
  let totalWeight = 0;
  const weighted = [];

  for (const species of available) {
    let affinity = 1;
    if (species.band === band) {
      affinity = 1.35;
    } else if (species.band !== "all") {
      affinity = band === "large" && species.band === "small" ? 0.28 : 0.66;
    }

    const weight = species.weight * getRarityMultiplier(species.rarity) * affinity;
    if (weight <= 0) {
      continue;
    }

    totalWeight += weight;
    weighted.push({ species, threshold: totalWeight });
  }

  if (weighted.length === 0) {
    return fishSpecies[0];
  }

  const roll = Math.random() * totalWeight;
  return weighted.find((entry) => roll <= entry.threshold)?.species ?? weighted[weighted.length - 1].species;
}

function createFish(size) {
  const species = chooseSpecies(size);
  const fromLeft = Math.random() > 0.5;
  const colors = randomItem(species.palettes || palette);
  const info = getDifficultyInfo();
  const pressure = 1 + Math.min(state.elapsed / 55, 1.55);
  const speed = clamp(
    (240 - size * 2 + randomBetween(-16, 18)) * info.speedBias * pressure * species.speedBias,
    48,
    320,
  );
  const x = fromLeft ? -size * 3 : state.width + size * 3;
  const y = randomBetween(size * 1.5, state.height - size * 1.5);
  const isRare = species.rarity === "rare" || species.rarity === "legendary";
  const powerType = isRare ? randomItem(["invincible", "sweep"]) : null;

  return {
    id: state.nextFishId++,
    x,
    y,
    size,
    speed,
    dir: fromLeft ? 1 : -1,
    wobble: randomBetween(0, Math.PI * 2),
    wobbleSpeed: randomBetween(1.4, 2.6),
    hue: colors,
    species,
    body: species.body,
    isRare,
    powerType,
    removed: false,
  };
}

function spawnFish() {
  const fish = createFish(chooseFishSize());
  state.fish.push(fish);

  if (fish.isRare && state.elapsed - state.lastRareAlertAt > 3.2) {
    state.lastRareAlertAt = state.elapsed;
    statusEl.textContent = `稀有${fish.species.label}出现：吃掉可${rareEffectLabels[fish.powerType]}`;
  }
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

function setPowerMessage(text, duration) {
  state.player.powerMessage = text;
  state.player.powerMessageTimer = duration;
  updateHud();
}

function growPlayer(prey, { bonusMultiplier = 1 } = {}) {
  const rareBonus = prey.isRare ? 1.2 : 1;
  state.player.mass += prey.size * prey.size * 0.4 * bonusMultiplier * rareBonus;
  state.player.size = Math.sqrt(state.player.mass);
  state.score += Math.max(1, Math.round(prey.size * 2.2 * rareBonus));
  updateHud();
  playEatSound(prey.size);

  if (state.player.size < 40) {
    statusEl.textContent = "继续吃小鱼";
  } else if (state.player.size < 70) {
    statusEl.textContent = "你已经能挑战中鱼了";
  } else {
    statusEl.textContent = "现在可以吃更大的鱼";
  }
}

function consumeFish(fish, options = {}) {
  if (!fish || fish.removed) {
    return false;
  }

  emitBubbles(fish.x, fish.y, fish.isRare ? 12 : 8, fish.hue[0]);
  emitBurst(fish.x, fish.y, fish.size, fish.isRare ? [fish.hue[0], "#fff7cc", fish.hue[1]] : fish.hue);
  growPlayer(fish, { bonusMultiplier: options.bonusMultiplier ?? 1 });
  fish.removed = true;
  return true;
}

function activateInvincibleEffect(fish) {
  state.player.invincibleTimer = Math.max(state.player.invincibleTimer, 4);
  emitBurst(state.player.x, state.player.y, state.player.size, ["#fff0a8", "#ffffff", "#7de3ff"]);
  emitBubbles(state.player.x, state.player.y, 18, "rgba(255,255,255,0.95)");
  setPowerMessage("无敌 4.0s", 4);
  statusEl.textContent = `吞下${fish.species.label}，4 秒无敌`;
  playRareSound("invincible");
}

function getNearbyTargets(count) {
  const centerX = state.player.x;
  const centerY = state.player.y;
  const radius = clamp(170 + state.player.size * 2.4, 170, 360);
  const entries = state.fish
    .filter((fish) => !fish.removed)
    .map((fish) => ({
      fish,
      distance: Math.hypot(fish.x - centerX, fish.y - centerY),
    }))
    .sort((left, right) => left.distance - right.distance);

  const selected = [];
  for (const entry of entries) {
    if (entry.distance <= radius && selected.length < count) {
      selected.push(entry.fish);
    }
  }

  if (selected.length >= count) {
    return selected;
  }

  for (const entry of entries) {
    if (selected.includes(entry.fish)) {
      continue;
    }
    selected.push(entry.fish);
    if (selected.length >= count) {
      break;
    }
  }

  return selected;
}

function activateSweepEffect(fish) {
  const targets = getNearbyTargets(4);
  let eaten = 0;
  for (const target of targets) {
    if (consumeFish(target, { bonusMultiplier: 0.95 })) {
      eaten += 1;
    }
  }

  emitBurst(state.player.x, state.player.y, state.player.size * 1.1, ["#ffe07a", "#fff7d1", "#ff965c"]);
  emitBubbles(state.player.x, state.player.y, 20, "rgba(255,229,147,0.95)");
  setPowerMessage(`吞噬波 ${eaten}/4`, 1.8);
  statusEl.textContent = `吞下${fish.species.label}，瞬间吞掉附近 ${eaten} 条鱼`;
  playRareSound("sweep");
}

function activateRareEffect(fish) {
  if (fish.powerType === "invincible") {
    activateInvincibleEffect(fish);
    return;
  }
  activateSweepEffect(fish);
}

function canEatFish(fish) {
  return state.player.size >= fish.size * 1.04;
}

function shoveFishAway(fish) {
  const angle = Math.atan2(fish.y - state.player.y, fish.x - state.player.x) || 0;
  const distance = fish.size + state.player.size + 18;
  fish.x = clamp(state.player.x + Math.cos(angle) * distance, fish.size, state.width - fish.size);
  fish.y = clamp(state.player.y + Math.sin(angle) * distance, fish.size, state.height - fish.size);
  fish.dir = Math.cos(angle) >= 0 ? 1 : -1;
  fish.speed = Math.max(fish.speed, 180);
  fish.wobble += Math.PI * 0.5;
  emitBubbles(fish.x, fish.y, 4, "rgba(255,255,255,0.7)");
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
    statusEl.textContent = player.invincibleTimer > 0 ? "无敌冲刺中" : "冲刺中，正在消耗体型";
    playBoostPulse();
    emitBubbles(player.x - player.size * 0.9, player.y, 1, "rgba(255,255,255,0.9)");
  }

  if (player.invincibleTimer > 0) {
    player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);
    if (Math.random() < 0.3) {
      emitBubbles(player.x, player.y, 1, "rgba(255,244,179,0.95)");
    }
  }

  if (player.powerMessageTimer > 0) {
    player.powerMessageTimer = Math.max(0, player.powerMessageTimer - dt);
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
  const targetCount = clamp(
    Math.round((18 + Math.floor(state.player.size / 9) + state.level) * info.spawnRate),
    18,
    48,
  );

  if (state.nextSpawnIn <= 0 && state.fish.length < targetCount) {
    spawnFish();
    state.nextSpawnIn = randomBetween(0.1, 0.28) / intensity / info.spawnRate;
  }

  for (let i = state.fish.length - 1; i >= 0; i -= 1) {
    const fish = state.fish[i];

    if (fish.removed) {
      state.fish.splice(i, 1);
      continue;
    }

    fish.wobble += dt * fish.wobbleSpeed;
    fish.x += fish.dir * fish.speed * dt;
    fish.y += Math.sin(fish.wobble) * 28 * dt;
    fish.y = clamp(fish.y, fish.size, state.height - fish.size);

    const collisionDistance = fish.size * 0.72 + state.player.size * 0.7;
    const distance = Math.hypot(fish.x - state.player.x, fish.y - state.player.y);

    if (distance < collisionDistance) {
      if (canEatFish(fish)) {
        const wasRare = fish.isRare;
        const eatenFish = fish;
        consumeFish(fish);
        state.fish.splice(i, 1);
        if (wasRare) {
          activateRareEffect(eatenFish);
        }
        continue;
      }

      if (state.player.invincibleTimer > 0) {
        shoveFishAway(fish);
        statusEl.textContent = "无敌中，大鱼碰不到你";
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

function createBodyGradient(fish) {
  const body = ctx.createLinearGradient(-fish.size, 0, fish.size, 0);
  body.addColorStop(0, fish.hue[0]);
  body.addColorStop(1, fish.hue[1]);
  return body;
}

function drawTail(size, tailWave, depth = 1.75) {
  ctx.beginPath();
  ctx.moveTo(-size * 1.02, 0);
  ctx.lineTo(-size * depth, -size * 0.56 + tailWave);
  ctx.lineTo(-size * depth, size * 0.56 - tailWave);
  ctx.closePath();
  ctx.fill();
}

function drawEye(size) {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size * 0.68, -size * 0.16, size * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0d1d26";
  ctx.beginPath();
  ctx.arc(size * 0.72, -size * 0.16, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawRareAura(fish) {
  ctx.save();
  ctx.strokeStyle = fish.powerType === "invincible" ? "rgba(255,244,180,0.8)" : "rgba(255,170,106,0.82)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, fish.size * 1.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTadpole(fish, tailWave) {
  ctx.beginPath();
  ctx.arc(fish.size * 0.28, 0, fish.size * 0.68, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = "round";
  ctx.strokeStyle = fish.hue[1];
  ctx.lineWidth = fish.size * 0.34;
  ctx.beginPath();
  ctx.moveTo(-fish.size * 0.1, 0);
  ctx.quadraticCurveTo(-fish.size * 0.92, tailWave * 0.7, -fish.size * 1.8, tailWave * 1.4);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.24)";
  ctx.beginPath();
  ctx.arc(fish.size * 0.45, -fish.size * 0.22, fish.size * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawSlimFish(fish, tailWave, stretch = 1.25) {
  ctx.beginPath();
  ctx.ellipse(0, 0, fish.size * stretch, fish.size * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  drawTail(fish.size, tailWave);
  ctx.fillStyle = "rgba(255,255,255,0.24)";
  ctx.beginPath();
  ctx.ellipse(fish.size * 0.1, -fish.size * 0.18, fish.size * 0.5, fish.size * 0.16, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoundFish(fish, tailWave) {
  ctx.beginPath();
  ctx.ellipse(0, 0, fish.size * 1.08, fish.size * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  drawTail(fish.size, tailWave, 1.52);
  ctx.beginPath();
  ctx.moveTo(-fish.size * 0.05, -fish.size * 0.96);
  ctx.lineTo(fish.size * 0.22, -fish.size * 0.32);
  ctx.lineTo(-fish.size * 0.28, -fish.size * 0.2);
  ctx.closePath();
  ctx.fill();
}

function drawStripeFish(fish, tailWave) {
  drawSlimFish(fish, tailWave);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  for (let i = -1; i <= 1; i += 1) {
    ctx.fillRect(fish.size * (-0.4 + i * 0.34), -fish.size * 0.58, fish.size * 0.12, fish.size * 1.16);
  }
}

function drawPufferFish(fish) {
  ctx.beginPath();
  ctx.arc(0, 0, fish.size * 0.9, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 14; i += 1) {
    const angle = (Math.PI * 2 * i) / 14;
    const inner = fish.size * 0.92;
    const outer = fish.size * 1.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.strokeStyle = fish.hue[1];
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(-fish.size * 0.8, 0);
  ctx.lineTo(-fish.size * 1.42, -fish.size * 0.44);
  ctx.lineTo(-fish.size * 1.42, fish.size * 0.44);
  ctx.closePath();
  ctx.fill();
}

function drawAngelFish(fish, tailWave) {
  ctx.beginPath();
  ctx.ellipse(0, 0, fish.size * 0.95, fish.size * 1.08, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-fish.size * 0.46, 0);
  ctx.lineTo(-fish.size * 1.28, -fish.size * 0.6 + tailWave);
  ctx.lineTo(-fish.size * 1.18, fish.size * 0.62 - tailWave);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-fish.size * 0.15, -fish.size * 1.2);
  ctx.lineTo(fish.size * 0.2, -fish.size * 0.22);
  ctx.lineTo(-fish.size * 0.42, -fish.size * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-fish.size * 0.05, fish.size * 1.16);
  ctx.lineTo(fish.size * 0.24, fish.size * 0.12);
  ctx.lineTo(-fish.size * 0.42, fish.size * 0.02);
  ctx.closePath();
  ctx.fill();
}

function drawBladeFish(fish, tailWave) {
  ctx.beginPath();
  ctx.ellipse(-fish.size * 0.06, 0, fish.size * 1.4, fish.size * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
  drawTail(fish.size, tailWave, 1.9);

  ctx.beginPath();
  ctx.moveTo(fish.size * 1.16, -fish.size * 0.12);
  ctx.lineTo(fish.size * 1.94, -fish.size * 0.04);
  ctx.lineTo(fish.size * 1.16, fish.size * 0.1);
  ctx.closePath();
  ctx.fill();
}

function drawGlowFish(fish, tailWave) {
  ctx.save();
  ctx.shadowBlur = fish.size * 0.9;
  ctx.shadowColor = fish.hue[0];
  ctx.beginPath();
  ctx.ellipse(0, 0, fish.size * 1.08, fish.size * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawTail(fish.size, tailWave, 1.66);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(0, 0, fish.size * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeroFish(fish, tailWave) {
  ctx.beginPath();
  ctx.ellipse(0, 0, fish.size * 1.22, fish.size * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  drawTail(fish.size, tailWave, 1.8);

  ctx.beginPath();
  ctx.moveTo(-fish.size * 0.2, -fish.size * 0.86);
  ctx.lineTo(fish.size * 0.18, -fish.size * 0.18);
  ctx.lineTo(-fish.size * 0.34, -fish.size * 0.04);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(fish.size * 0.12, -fish.size * 0.18, fish.size * 0.54, fish.size * 0.18, -0.18, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillStyle = createBodyGradient(fish);

  if (fish.isRare) {
    drawRareAura(fish);
  }

  switch (fish.body) {
    case "tadpole":
      drawTadpole(fish, tailWave);
      break;
    case "round":
      drawRoundFish(fish, tailWave);
      break;
    case "stripe":
      drawStripeFish(fish, tailWave);
      break;
    case "puffer":
      drawPufferFish(fish, tailWave);
      break;
    case "angel":
      drawAngelFish(fish, tailWave);
      break;
    case "blade":
      drawBladeFish(fish, tailWave);
      break;
    case "glow":
      drawGlowFish(fish, tailWave);
      break;
    case "hero":
      drawHeroFish(fish, tailWave);
      break;
    default:
      drawSlimFish(fish, tailWave);
      break;
  }

  drawEye(fish.size);

  if (fish.isRare) {
    ctx.fillStyle = fish.powerType === "invincible" ? "#fff2a6" : "#ffd1a3";
    ctx.beginPath();
    ctx.arc(-fish.size * 0.15, -fish.size * 0.85, fish.size * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isPlayer) {
    ctx.strokeStyle =
      state.player.invincibleTimer > 0 ? "rgba(255,246,176,0.85)" : "rgba(255,255,255,0.55)";
    ctx.lineWidth = state.player.invincibleTimer > 0 ? 4 : 3;
    ctx.beginPath();
    ctx.arc(0, 0, fish.size * 1.18, 0, Math.PI * 2);
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
      statusEl.textContent = state.player.invincibleTimer > 0 ? "无敌中，继续猎食" : "寻找小鱼";
    }
  }
});

canvas.addEventListener("pointerleave", () => {
  state.input.boosting = false;
  if (state.running) {
    statusEl.textContent = state.player.invincibleTimer > 0 ? "无敌中，继续猎食" : "寻找小鱼";
  }
});

window.addEventListener("pointerup", () => {
  state.input.boosting = false;
  if (state.running) {
    statusEl.textContent = state.player.invincibleTimer > 0 ? "无敌中，继续猎食" : "寻找小鱼";
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
