const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const progressLabelEl = document.getElementById("progressLabel");
const progressTextEl = document.getElementById("progressText");
const progressFillEl = document.getElementById("progressFill");
const tierDots = Array.from(document.querySelectorAll("#tierDots .tier-dot"));
const panelEl = document.getElementById("panel");
const panelIconEl = document.getElementById("panelIcon");
const panelTitleEl = document.getElementById("panelTitle");
const panelTextEl = document.getElementById("panelText");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const WORLD = {
  width: 4200,
  height: 2600,
};

const TIERS = [
  {
    label: "1 / 5",
    size: 26,
    speed: 405,
    zoom: 1,
    goal: 105,
    colors: ["#ffd166", "#f77f00"],
    burst: ["#fff1a6", "#ffd166", "#ff8c42"],
  },
  {
    label: "2 / 5",
    size: 34,
    speed: 390,
    zoom: 0.82,
    goal: 150,
    colors: ["#92f67c", "#1ba46c"],
    burst: ["#dfffd0", "#92f67c", "#35c37d"],
  },
  {
    label: "3 / 5",
    size: 44,
    speed: 374,
    zoom: 0.68,
    goal: 220,
    colors: ["#8ad7ff", "#177dd2"],
    burst: ["#eef9ff", "#8ad7ff", "#43a3ff"],
  },
  {
    label: "4 / 5",
    size: 56,
    speed: 352,
    zoom: 0.56,
    goal: 340,
    colors: ["#d8b4fe", "#7c3aed"],
    burst: ["#f8edff", "#d8b4fe", "#9f67ff"],
  },
  {
    label: "5 / 5",
    size: 72,
    speed: 328,
    zoom: 0.46,
    goal: 0,
    colors: ["#ffafcc", "#d6336c"],
    burst: ["#fff0f7", "#ffafcc", "#ff5c8d"],
  },
];

const FISH_TYPES = {
  sardine: {
    label: "小沙丁鱼",
    size: 11,
    edibleTier: 1,
    growth: 14,
    score: 4,
    speedMin: 72,
    speedMax: 116,
    turnRate: 4.8,
    colors: ["#b7f1ff", "#4db6e5"],
    body: "sardine",
  },
  clown: {
    label: "小丑鱼",
    size: 16,
    edibleTier: 3,
    growth: 28,
    score: 11,
    speedMin: 58,
    speedMax: 84,
    turnRate: 3.4,
    colors: ["#ffd67d", "#ff7b39"],
    body: "clown",
  },
  puffer: {
    label: "河豚",
    size: 18,
    edibleTier: 2,
    growth: -95,
    score: -6,
    speedMin: 44,
    speedMax: 66,
    turnRate: 2.8,
    colors: ["#fff1a6", "#f2ae00"],
    body: "puffer",
  },
  tuna: {
    label: "金枪鱼",
    size: 28,
    edibleTier: 3,
    growth: 68,
    score: 28,
    speedMin: 188,
    speedMax: 268,
    turnRate: 1.34,
    colors: ["#dff7ff", "#4d9cff"],
    body: "tuna",
  },
  shark: {
    label: "大鲨鱼",
    size: 68,
    edibleTier: 5,
    growth: 0,
    score: 200,
    speedMin: 196,
    speedMax: 226,
    turnRate: 2.7,
    colors: ["#d7e6ef", "#597181"],
    body: "shark",
  },
};

const ITEM_TYPES = {
  magnet: {
    label: "吸铁石",
    colors: ["#ffd166", "#ff7b39"],
  },
  shield: {
    label: "盾牌",
    colors: ["#c7f0ff", "#43a3ff"],
  },
};

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  running: false,
  gameOver: false,
  victory: false,
  score: 0,
  fish: [],
  items: [],
  particles: [],
  decorations: [],
  pointer: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 },
  input: { boosting: false },
  player: null,
  lastTime: 0,
  camera: { x: WORLD.width * 0.5, y: WORLD.height * 0.5, zoom: 1 },
  spawnTimer: 0,
  itemTimer: 10,
  nextFishId: 1,
  warningTimer: 0,
  warningFlashTimer: 0,
  warningText: "",
};

const audio = {
  context: null,
  master: null,
  bgm: {
    playing: false,
    step: 0,
    nextTime: 0,
    mode: "calm",
  },
};

let animationFrameId = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function shortestAngleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return delta;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomItem(items) {
  return items[(Math.random() * items.length) | 0];
}

function getTierConfig(tier = state.player?.tier || 1) {
  return TIERS[tier - 1];
}

function ensureAudio() {
  const AudioContextRef = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextRef) {
    return;
  }

  if (!audio.context) {
    audio.context = new AudioContextRef();
    audio.master = audio.context.createGain();
    audio.master.gain.value = 0.16;
    audio.master.connect(audio.context.destination);
  }

  if (audio.context.state === "suspended") {
    audio.context.resume().catch(() => {});
  }
}

function playTone({ frequency, duration = 0.12, type = "sine", volume = 0.12, slideTo = null }) {
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
  oscillator.stop(now + duration + 0.03);
}

function scheduleToneAt(startTime, { frequency, duration = 0.12, type = "square", volume = 0.04, slideTo = null }) {
  if (!audio.context || !audio.master) {
    return;
  }

  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, startTime + duration);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(audio.master);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function startBgm() {
  ensureAudio();
  if (!audio.context || audio.bgm.playing) {
    return;
  }

  audio.bgm.playing = true;
  audio.bgm.step = 0;
  audio.bgm.mode = "calm";
  audio.bgm.nextTime = audio.context.currentTime + 0.04;
}

function stopBgm() {
  audio.bgm.playing = false;
}

function scheduleBgm() {
  if (!audio.context || !audio.bgm.playing) {
    return;
  }

  const hasSharks = state.running && countByKind("shark") > 0;
  const nextMode = hasSharks ? "danger" : "calm";
  if (audio.bgm.mode !== nextMode) {
    audio.bgm.mode = nextMode;
    audio.bgm.step = 0;
    audio.bgm.nextTime = audio.context.currentTime + 0.04;
  }

  const patterns =
    audio.bgm.mode === "danger"
      ? {
          bassLine: [82, 82, 92, 92, 87, 87, 73, 73, 82, 82, 98, 98, 92, 92, 87, 87],
          leadLine: [165, 196, 185, 220, 196, 247, 220, 196, 185, 220, 247, 262, 247, 220, 196, 185],
          harmony: [123, 147, 139, 165, 147, 185, 165, 147, 139, 165, 185, 196, 185, 165, 147, 139],
          beat: 0.142,
          bassVolume: state.running ? 0.04 : 0.02,
          leadVolume: state.running ? 0.028 : 0.014,
          stabVolume: 0.022,
        }
      : {
          bassLine: [110, 110, 147, 147, 123, 123, 98, 98, 110, 110, 165, 165, 147, 147, 123, 123],
          leadLine: [220, 247, 294, 247, 220, 247, 330, 294, 262, 294, 349, 294, 262, 247, 220, 196],
          harmony: [165, 196, 220, 196, 165, 196, 247, 220, 196, 220, 262, 220, 196, 185, 165, 147],
          beat: 0.165,
          bassVolume: state.running ? 0.034 : 0.018,
          leadVolume: state.running ? 0.024 : 0.012,
          stabVolume: 0.018,
        };

  const lookAhead = 0.72;

  while (audio.bgm.nextTime < audio.context.currentTime + lookAhead) {
    const step = audio.bgm.step % patterns.bassLine.length;
    const startTime = audio.bgm.nextTime;

    scheduleToneAt(startTime, {
      frequency: patterns.bassLine[step],
      duration: patterns.beat * 0.92,
      type: audio.bgm.mode === "danger" ? "sawtooth" : "square",
      volume: patterns.bassVolume,
    });

    if (step % 2 === 0) {
      scheduleToneAt(startTime, {
        frequency: patterns.leadLine[step],
        duration: patterns.beat * 0.78,
        type: audio.bgm.mode === "danger" ? "square" : "triangle",
        volume: patterns.leadVolume,
      });
    }

    if (step % 4 === 2) {
      scheduleToneAt(startTime, {
        frequency: patterns.harmony[step],
        duration: patterns.beat * 0.56,
        type: "sine",
        volume: 0.016,
      });
    }

    if (step % 4 === 0) {
      scheduleToneAt(startTime, {
        frequency: audio.bgm.mode === "danger" ? 73 : 82,
        duration: patterns.beat * 0.12,
        type: "square",
        volume: patterns.stabVolume,
        slideTo: audio.bgm.mode === "danger" ? 55 : 62,
      });
    }

    if (audio.bgm.mode === "danger" && step % 8 === 4) {
      scheduleToneAt(startTime, {
        frequency: 294,
        duration: patterns.beat * 0.22,
        type: "triangle",
        volume: 0.02,
        slideTo: 330,
      });
    }

    audio.bgm.step += 1;
    audio.bgm.nextTime += patterns.beat;
  }
}

function playEatSound(kind) {
  ensureAudio();
  const frequency =
    kind === "tuna" ? 520 : kind === "clown" ? 460 : kind === "puffer" ? 160 : kind === "shark" ? 680 : 410;
  playTone({
    frequency,
    slideTo: frequency * 1.22,
    duration: kind === "shark" ? 0.22 : 0.12,
    type: kind === "puffer" ? "square" : "triangle",
    volume: kind === "shark" ? 0.16 : 0.11,
  });
}

function playLevelUpSound() {
  ensureAudio();
  playTone({ frequency: 380, slideTo: 620, duration: 0.14, type: "triangle", volume: 0.1 });
  playTone({ frequency: 580, slideTo: 920, duration: 0.18, type: "sine", volume: 0.1 });
}

function playShieldSound() {
  ensureAudio();
  playTone({ frequency: 320, slideTo: 690, duration: 0.2, type: "triangle", volume: 0.11 });
}

function playMagnetSound() {
  ensureAudio();
  playTone({ frequency: 220, slideTo: 120, duration: 0.14, type: "square", volume: 0.1 });
  playTone({ frequency: 260, slideTo: 780, duration: 0.22, type: "sawtooth", volume: 0.11 });
}

function playSharkAlertSound() {
  ensureAudio();
  playTone({ frequency: 180, slideTo: 240, duration: 0.16, type: "square", volume: 0.13 });
  playTone({ frequency: 260, slideTo: 180, duration: 0.16, type: "square", volume: 0.11 });
  playTone({ frequency: 180, slideTo: 240, duration: 0.16, type: "square", volume: 0.13 });
}

function playGameOverSound() {
  ensureAudio();
  playTone({ frequency: 210, slideTo: 90, duration: 0.4, type: "sawtooth", volume: 0.16 });
}

function playVictorySound() {
  ensureAudio();
  playTone({ frequency: 520, slideTo: 820, duration: 0.16, type: "triangle", volume: 0.12 });
  playTone({ frequency: 660, slideTo: 1040, duration: 0.28, type: "sine", volume: 0.11 });
}

function resizeCanvas() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(state.width * ratio);
  canvas.height = Math.floor(state.height * ratio);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function createDecorations() {
  state.decorations = [];
  for (let i = 0; i < 34; i += 1) {
    const kind = i % 4 === 0 ? "rock" : i % 4 === 1 ? "coral" : "reef";
    const size = kind === "rock" ? randomBetween(42, 92) : kind === "coral" ? randomBetween(34, 76) : randomBetween(30, 66);
    state.decorations.push({
      kind,
      x: randomBetween(180, WORLD.width - 180),
      y: randomBetween(260, WORLD.height - 150),
      size,
      solid: kind !== "reef",
      radius: kind === "rock" ? size * 0.82 : size * 0.56,
      hue:
        kind === "rock"
          ? "rgba(142, 162, 176, 0.22)"
          : kind === "coral"
            ? "rgba(255, 176, 147, 0.24)"
            : "rgba(102, 248, 203, 0.16)",
    });
  }
}

function createPlayer() {
  const tier = 1;
  const tierConfig = getTierConfig(tier);
  return {
    x: WORLD.width * 0.24,
    y: WORLD.height * 0.52,
    vx: 0,
    vy: 0,
    angle: 0,
    tier,
    size: tierConfig.size,
    colors: tierConfig.colors.slice(),
    progress: 0,
    shield: 0,
    invincibleTimer: 0,
    magnetTimer: 0,
    slowTimer: 0,
    slowPulse: 0,
    levelFlash: 0,
    magnetFlash: 0,
  };
}

function applyPlayerTierVisuals() {
  const tierConfig = getTierConfig(state.player.tier);
  state.player.size = tierConfig.size;
  state.player.colors = tierConfig.colors.slice();
}

function showWarning(text, duration = 3) {
  state.warningText = text;
  state.warningTimer = duration;
  state.warningFlashTimer = duration;
  playSharkAlertSound();
}

function getPlayerVisualLength() {
  return state.player.size * 1.56;
}

function getFishVisualLength(fish) {
  if (fish.kind === "sardine") {
    return fish.size * 1.32;
  }
  if (fish.kind === "clown") {
    return fish.size * 1.08;
  }
  if (fish.kind === "puffer") {
    return fish.size * fish.expand * 0.98;
  }
  if (fish.kind === "tuna") {
    return fish.size * 1.56;
  }
  if (fish.kind === "shark") {
    return fish.size * 1.45;
  }
  return fish.size;
}

function getSpawnMinDistance(kind) {
  if (!state.player) {
    return 0;
  }

  if (kind === "shark") {
    return 920;
  }

  if (kind === "tuna") {
    return 340;
  }

  if (kind === "puffer") {
    return 280;
  }

  if (kind === "clown") {
    return 240;
  }

  return 110;
}

function findSpawnPosition(minDistance, padding = 140) {
  if (!state.player || minDistance <= 0) {
    return {
      x: randomBetween(padding, WORLD.width - padding),
      y: randomBetween(padding, WORLD.height - padding),
    };
  }

  let fallback = {
    x: randomBetween(padding, WORLD.width - padding),
    y: randomBetween(padding, WORLD.height - padding),
  };

  for (let i = 0; i < 24; i += 1) {
    const candidate = {
      x: randomBetween(padding, WORLD.width - padding),
      y: randomBetween(padding, WORLD.height - padding),
    };
    fallback = candidate;
    if (Math.hypot(candidate.x - state.player.x, candidate.y - state.player.y) >= minDistance) {
      return candidate;
    }
  }

  return fallback;
}

function resolveEntityAgainstDecorations(entity, pushStrength = 1) {
  for (const deco of state.decorations) {
    if (!deco.solid) {
      continue;
    }

    const dx = entity.x - deco.x;
    const dy = entity.y - deco.y;
    const distance = Math.hypot(dx, dy) || 0.0001;
    const minDistance = deco.radius + entity.size * 0.56;
    if (distance < minDistance) {
      const overlap = minDistance - distance;
      const nx = dx / distance;
      const ny = dy / distance;
      entity.x = clamp(entity.x + nx * overlap * pushStrength, entity.size, WORLD.width - entity.size);
      entity.y = clamp(entity.y + ny * overlap * pushStrength, entity.size, WORLD.height - entity.size);
      entity.vx *= 0.76;
      entity.vy *= 0.76;
    }
  }
}

function resetWorld() {
  state.score = 0;
  state.running = false;
  state.gameOver = false;
  state.victory = false;
  state.fish = [];
  state.items = [];
  state.particles = [];
  state.player = createPlayer();
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.camera.zoom = getTierConfig(1).zoom;
  state.pointer.x = state.width * 0.5;
  state.pointer.y = state.height * 0.5;
  state.input.boosting = false;
  state.spawnTimer = 0;
  state.itemTimer = randomBetween(8, 12);
  state.nextFishId = 1;

  if (state.decorations.length === 0) {
    createDecorations();
  }

  fillInitialPopulation();
  updateHud();
}

function startGame() {
  ensureAudio();
  resetWorld();
  startBgm();
  state.running = true;
  panelEl.classList.add("hidden");
}

function openPanel({ icon, title, text }) {
  panelIconEl.textContent = icon;
  panelTitleEl.textContent = title;
  panelTextEl.textContent = text;
  panelEl.classList.remove("hidden");
}

function gameOver() {
  if (state.gameOver || state.victory) {
    return;
  }

  state.running = false;
  state.gameOver = true;
  state.input.boosting = false;
  stopBgm();
  playGameOverSound();
  emitBurst(state.player.x, state.player.y, state.player.size * 1.6, ["#ffffff", "#ffd3a8", "#ff8f6b"]);
  openPanel({
    icon: "💥",
    title: "你被吃掉了",
    text: `你冲到了 ${state.player.tier} 档，拿到了 ${state.score} 分。再试一次，把成长槽吃满后去反杀大鲨鱼。`,
  });
}

function winGame() {
  if (state.victory) {
    return;
  }

  state.running = false;
  state.victory = true;
  state.input.boosting = false;
  stopBgm();
  playVictorySound();
  for (let i = 0; i < 18; i += 1) {
    emitBurst(state.player.x, state.player.y, state.player.size * 1.8, ["#fff6b7", "#ffd166", "#ff89b5"]);
  }
  openPanel({
    icon: "🏆",
    title: "你赢了",
    text: `你已经升到 5 档，并成功反杀大鲨鱼。最终得分 ${state.score}，这片海域现在归你了。`,
  });
}

function updateHud() {
  const player = state.player;
  const tierConfig = getTierConfig();

  scoreEl.textContent = state.score;

  if (player.tier < 5) {
    const ratio = clamp(player.progress / tierConfig.goal, 0, 1);
    progressTextEl.textContent = `${Math.round(player.progress)} / ${tierConfig.goal}`;
    progressFillEl.style.width = `${ratio * 100}%`;
  } else {
    progressTextEl.textContent = "终极形态";
    progressFillEl.style.width = "100%";
  }

  progressLabelEl.textContent = "成长槽";
  progressFillEl.style.background = `linear-gradient(135deg, ${tierConfig.colors[0]} 0%, ${tierConfig.colors[1]} 100%)`;
  progressFillEl.style.boxShadow = `0 0 18px ${tierConfig.colors[0]}55`;

  for (let i = 0; i < tierDots.length; i += 1) {
    tierDots[i].classList.toggle("active", i === player.tier - 1);
    tierDots[i].classList.toggle("reached", i < player.tier - 1);
  }
}

function emitBurst(x, y, scale, colors) {
  for (let i = 0; i < 14; i += 1) {
    const angle = (Math.PI * 2 * i) / 14 + randomBetween(-0.12, 0.12);
    const speed = randomBetween(60, 150);
    state.particles.push({
      kind: "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomBetween(0.3, 0.55),
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
    age: 0,
    life: 0.42,
    radius: scale,
    color: colors[0],
  });
}

function emitBubbles(x, y, count, color = "rgba(255,255,255,0.9)") {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      kind: "bubble",
      x,
      y,
      vx: randomBetween(-36, 36),
      vy: randomBetween(-68, -14),
      life: randomBetween(0.55, 1.1),
      age: 0,
      radius: randomBetween(2, 6),
      color,
    });
  }
}

function emitToast(x, y, text, color) {
  state.particles.push({
    kind: "text",
    text,
    x,
    y,
    vx: 0,
    vy: -30,
    life: 0.9,
    age: 0,
    radius: 0,
    color,
  });
}

function createFish(kind, x = null, y = null) {
  const config = FISH_TYPES[kind];
  const spawn =
    x !== null && y !== null
      ? { x, y }
      : findSpawnPosition(getSpawnMinDistance(kind), kind === "shark" ? 220 : 140);
  const fish = {
    id: state.nextFishId++,
    kind,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    size: config.size,
    angle: randomBetween(0, Math.PI * 2),
    speed: randomBetween(config.speedMin, config.speedMax),
    thinkTimer: randomBetween(0.3, 1.4),
    expand: 1,
    dashTimer: randomBetween(0.5, 2.4),
    rushTimer: 0,
    huntStyle: kind === "shark" ? (state.nextFishId % 2 === 0 ? "cutter" : "chaser") : "wander",
    removed: false,
  };
  fish.vx = Math.cos(fish.angle) * fish.speed;
  fish.vy = Math.sin(fish.angle) * fish.speed;
  return fish;
}

function createItem(type) {
  const spawn = findSpawnPosition(260, 220);
  return {
    type,
    x: spawn.x,
    y: spawn.y,
    size: 20,
    phase: randomBetween(0, Math.PI * 2),
    removed: false,
  };
}

function spawnSardineSchool() {
  const schoolCenter = findSpawnPosition(150, 180);
  const centerX = schoolCenter.x;
  const centerY = schoolCenter.y;
  const count = 4 + ((Math.random() * 4) | 0);
  for (let i = 0; i < count; i += 1) {
    state.fish.push(
      createFish(
        "sardine",
        centerX + randomBetween(-55, 55),
        centerY + randomBetween(-42, 42),
      ),
    );
  }
}

function fillInitialPopulation() {
  for (let i = 0; i < 8; i += 1) {
    spawnSardineSchool();
  }

  for (let i = 0; i < 2; i += 1) {
    state.fish.push(createFish("puffer"));
  }
}

function countByKind(kind) {
  let total = 0;
  for (const fish of state.fish) {
    if (!fish.removed && fish.kind === kind) {
      total += 1;
    }
  }
  return total;
}

function desiredSharkCount() {
  return state.player.tier >= 3 ? 2 : 0;
}

function spawnNeededEntities() {
  const tier = state.player.tier;
  const currentSharks = countByKind("shark");
  const targetSharks = desiredSharkCount();

  if (currentSharks < targetSharks) {
    const side = currentSharks % 2 === 0 ? 1 : -1;
    const shark = createFish(
      "shark",
      clamp(state.player.x + randomBetween(980, 1280) * side, 220, WORLD.width - 220),
      clamp(state.player.y + randomBetween(-420, 420), 220, WORLD.height - 220),
    );
    state.fish.push(shark);
    showWarning("警报：鲨鱼出现");
    return;
  }

  if (countByKind("sardine") < 26 + tier * 3) {
    spawnSardineSchool();
    return;
  }

  if (tier >= 2 && countByKind("clown") < 4 + Math.max(0, tier - 2)) {
    state.fish.push(createFish("clown"));
    return;
  }

  if (countByKind("puffer") < 4 + Math.max(0, tier - 1)) {
    state.fish.push(createFish("puffer"));
    return;
  }

  if (tier >= 3 && countByKind("tuna") < 3 + (tier - 3) * 2) {
    state.fish.push(createFish("tuna"));
  }
}

function spawnItem() {
  if (state.items.some((item) => !item.removed)) {
    return;
  }

  const type = Math.random() > 0.5 ? "shield" : "magnet";
  state.items.push(createItem(type));
}

function playerCanEat(fish) {
  return getPlayerVisualLength() >= getFishVisualLength(fish) * 1.01;
}

function gainGrowth(amount) {
  if (amount === 0) {
    return;
  }

  if (amount < 0) {
    let remainingLoss = -amount;

    while (remainingLoss > 0) {
      if (state.player.progress >= remainingLoss) {
        state.player.progress -= remainingLoss;
        remainingLoss = 0;
        break;
      }

      remainingLoss -= state.player.progress;
      if (state.player.tier === 1) {
        state.player.progress = 0;
        break;
      }

      state.player.tier -= 1;
      applyPlayerTierVisuals();
      state.player.progress = getTierConfig().goal;
      state.player.levelFlash = 0.45;
      emitToast(state.player.x, state.player.y - state.player.size, `跌回 ${state.player.tier} 档`, "#ffd8a8");
    }

    updateHud();
    return;
  }

  let remaining = amount;
  while (remaining > 0 && state.player.tier < 5) {
    const goal = getTierConfig().goal;
    const needed = goal - state.player.progress;
    if (remaining >= needed) {
      state.player.progress = goal;
      remaining -= needed;
      levelUpPlayer();
    } else {
      state.player.progress += remaining;
      remaining = 0;
    }
  }

  if (state.player.tier >= 5) {
    state.player.progress = getTierConfig().goal;
  }

  updateHud();
}

function levelUpPlayer() {
  if (state.player.tier >= 5) {
    return;
  }

  state.player.tier += 1;
  state.player.progress = 0;
  const next = getTierConfig();
  applyPlayerTierVisuals();
  state.player.levelFlash = 0.85;
  emitBurst(state.player.x, state.player.y, state.player.size * 1.3, next.burst);
  emitBubbles(state.player.x, state.player.y, 14, `${next.colors[0]}dd`);
  emitToast(state.player.x, state.player.y - state.player.size, `进化到 ${state.player.tier} 档`, "#fff6c9");
  if (state.player.tier >= 5) {
    showWarning("去吃掉鲨鱼吧", 2.8);
  }
  playLevelUpSound();
  updateHud();
}

function consumeFish(fish, { force = false } = {}) {
  if (!fish || fish.removed) {
    return;
  }

  fish.removed = true;
  emitBurst(fish.x, fish.y, fish.size * 1.05, [FISH_TYPES[fish.kind].colors[0], "#ffffff", FISH_TYPES[fish.kind].colors[1]]);
  emitBubbles(fish.x, fish.y, fish.kind === "shark" ? 18 : 8);

  if (fish.kind === "puffer" && !force) {
    state.score = Math.max(0, state.score + FISH_TYPES.puffer.score);
    state.player.slowTimer = 2.3;
    state.player.slowPulse = 0.9;
    gainGrowth(FISH_TYPES.puffer.growth);
    emitToast(fish.x, fish.y, "河豚反击", "#fff1a6");
    playEatSound("puffer");
    return;
  }

  if (fish.kind === "shark") {
    state.score += FISH_TYPES.shark.score;
    playEatSound("shark");
    winGame();
    return;
  }

  state.score = Math.max(0, state.score + FISH_TYPES[fish.kind].score);
  gainGrowth(FISH_TYPES[fish.kind].growth);
  playEatSound(fish.kind);
}

function useShield(fish) {
  if (state.player.shield <= 0) {
    return false;
  }

  state.player.shield = 0;
  state.player.invincibleTimer = 1;
  state.player.slowPulse = 0.55;
  emitBurst(state.player.x, state.player.y, state.player.size * 1.45, ["#d7f4ff", "#7ec8ff", "#ffffff"]);
  emitToast(state.player.x, state.player.y - state.player.size, "护盾触发", "#d7f4ff");
  playShieldSound();

  if (fish) {
    const angle = Math.atan2(fish.y - state.player.y, fish.x - state.player.x);
    fish.vx = Math.cos(angle) * 220;
    fish.vy = Math.sin(angle) * 220;
    fish.x = clamp(state.player.x + Math.cos(angle) * (state.player.size + fish.size + 22), fish.size, WORLD.width - fish.size);
    fish.y = clamp(state.player.y + Math.sin(angle) * (state.player.size + fish.size + 22), fish.size, WORLD.height - fish.size);
  }

  updateHud();
  return true;
}

function activateMagnet() {
  state.player.magnetTimer = 5;
  state.player.magnetFlash = 0.85;
  emitBurst(state.player.x, state.player.y, state.player.size * 1.8, ["#fff0a7", "#ffd166", "#ff8f42"]);
  emitToast(state.player.x, state.player.y - state.player.size, "吸铁石生效 5 秒", "#fff1a6");
  playMagnetSound();
}

function collectItem(item) {
  if (item.removed) {
    return;
  }

  item.removed = true;
  emitBurst(item.x, item.y, item.size * 1.25, [ITEM_TYPES[item.type].colors[0], "#ffffff", ITEM_TYPES[item.type].colors[1]]);

  if (item.type === "shield") {
    state.player.shield = 1;
    emitToast(item.x, item.y, "获得护盾", "#d7f4ff");
    playShieldSound();
  } else {
    activateMagnet();
  }

  updateHud();
}

function updatePlayer(dt) {
  const tier = getTierConfig();
  const player = state.player;
  const dx = state.pointer.x - state.width * 0.5;
  const dy = state.pointer.y - state.height * 0.5;
  const distance = Math.hypot(dx, dy) || 1;
  const targetAngle = distance > 8 ? Math.atan2(dy, dx) : player.angle;
  const turnSpeed = state.input.boosting ? 8.5 : 10.5;
  player.angle += shortestAngleDelta(player.angle, targetAngle) * Math.min(1, dt * turnSpeed);

  const throttle = clamp(distance / Math.min(state.width, state.height) / 0.22, 0.22, 1);
  let speed = tier.speed * (state.input.boosting ? 1.24 : 1);

  if (player.slowTimer > 0) {
    player.slowTimer = Math.max(0, player.slowTimer - dt);
    speed *= 0.62;
  }

  const targetVx = Math.cos(player.angle) * speed * throttle;
  const targetVy = Math.sin(player.angle) * speed * throttle;
  player.vx = lerp(player.vx, targetVx, dt * 7.4);
  player.vy = lerp(player.vy, targetVy, dt * 7.4);

  player.x = clamp(player.x + player.vx * dt, player.size, WORLD.width - player.size);
  player.y = clamp(player.y + player.vy * dt, player.size, WORLD.height - player.size);
  resolveEntityAgainstDecorations(player, 1.08);

  player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);
  player.levelFlash = Math.max(0, player.levelFlash - dt);
  player.slowPulse = Math.max(0, player.slowPulse - dt);
  player.magnetTimer = Math.max(0, player.magnetTimer - dt);
  player.magnetFlash = Math.max(0, player.magnetFlash - dt * (player.magnetTimer > 0 ? 0.35 : 1));
}

function chooseWanderAngle(fish, playerDistance) {
  if (fish.kind === "sardine") {
    if (playerDistance < 180) {
      return Math.atan2(fish.y - state.player.y, fish.x - state.player.x) + randomBetween(-0.32, 0.32);
    }
    return fish.angle + randomBetween(-0.5, 0.5);
  }

  if (fish.kind === "clown") {
    return fish.angle + randomBetween(-0.28, 0.28);
  }

  if (fish.kind === "puffer") {
    return fish.angle + randomBetween(-0.18, 0.18);
  }

  if (fish.kind === "tuna") {
    if (playerDistance < 320) {
      return Math.atan2(fish.y - state.player.y, fish.x - state.player.x) + randomBetween(-0.14, 0.14);
    }
    return fish.angle + randomBetween(-0.05, 0.05);
  }

  if (state.player.tier >= 5) {
    const fleeOffset = (fish.id % 2 === 0 ? 1 : -1) * 140;
    return (
      Math.atan2(fish.y - state.player.y + fleeOffset, fish.x - state.player.x - fleeOffset * 0.3)
      + randomBetween(-0.12, 0.12)
    );
  }

  const playerSpeed = Math.hypot(state.player.vx, state.player.vy) || 1;
  const leadFactor = fish.huntStyle === "cutter" ? clamp(playerDistance / 260, 1.05, 2.05) : clamp(playerDistance / 420, 0.7, 1.3);
  const perpendicularX = -state.player.vy / playerSpeed;
  const perpendicularY = state.player.vx / playerSpeed;
  const interceptOffset =
    fish.huntStyle === "cutter"
      ? (fish.id % 2 === 0 ? 1 : -1) * Math.min(260, 120 + playerDistance * 0.22)
      : (fish.id % 2 === 0 ? 1 : -1) * Math.min(90, 20 + playerDistance * 0.08);
  const targetX = state.player.x + state.player.vx * leadFactor + perpendicularX * interceptOffset;
  const targetY = state.player.y + state.player.vy * leadFactor + perpendicularY * interceptOffset;
  return Math.atan2(targetY - fish.y, targetX - fish.x) + randomBetween(-0.04, 0.04);
}

function getPlayerCollisionRadius() {
  return state.player.size * 0.98;
}

function getFishCollisionRadius(fish) {
  if (fish.kind === "sardine") {
    return fish.size * 0.9;
  }
  if (fish.kind === "puffer") {
    return fish.size * fish.expand * 0.96;
  }
  if (fish.kind === "shark") {
    return fish.size * 0.88;
  }
  return fish.size * fish.expand * 0.84;
}

function updateMagnetField() {
  if (state.player.magnetTimer <= 0) {
    return;
  }

  const radius = 190 + state.player.tier * 46;
  for (const fish of state.fish) {
    if (fish.removed || fish.kind === "shark" || fish.kind === "puffer") {
      continue;
    }

    const distance = Math.hypot(fish.x - state.player.x, fish.y - state.player.y);
    if (distance <= radius) {
      consumeFish(fish, { force: true });
    }
  }
}

function updateFish(dt) {
  for (let i = state.fish.length - 1; i >= 0; i -= 1) {
    const fish = state.fish[i];

    if (fish.removed) {
      state.fish.splice(i, 1);
      continue;
    }

    const config = FISH_TYPES[fish.kind];
    const distanceToPlayer = Math.hypot(fish.x - state.player.x, fish.y - state.player.y);

    fish.thinkTimer -= dt;
    if (fish.kind === "tuna") {
      fish.dashTimer -= dt;
      fish.rushTimer = Math.max(0, fish.rushTimer - dt);
      if (fish.dashTimer <= 0) {
        fish.rushTimer = randomBetween(0.55, 0.9);
        fish.speed = randomBetween(config.speedMin, config.speedMax) * 1.42;
        fish.angle = Math.atan2(fish.y - state.player.y, fish.x - state.player.x) + randomBetween(-0.1, 0.1);
        fish.dashTimer = randomBetween(1.1, 2.1);
      }
    } else if (fish.kind === "shark") {
      fish.rushTimer = Math.max(0, fish.rushTimer - dt);
      if (fish.rushTimer <= 0 && distanceToPlayer < 620) {
        fish.rushTimer = randomBetween(0.7, 1.1);
      }
      const rushFactor = state.player.tier >= 5 ? 1.28 : fish.rushTimer > 0 ? 1.34 : distanceToPlayer < 360 ? 1.14 : 1;
      fish.speed = lerp(fish.speed, randomBetween(config.speedMin, config.speedMax) * rushFactor, dt * 1.45);
    } else if (fish.kind !== "shark") {
      fish.speed = lerp(fish.speed, randomBetween(config.speedMin, config.speedMax), dt * 0.35);
    }

    if (fish.thinkTimer <= 0 || fish.kind === "shark") {
      fish.angle = chooseWanderAngle(fish, distanceToPlayer);
      fish.thinkTimer =
        fish.kind === "sardine"
          ? randomBetween(0.6, 1.2)
          : fish.kind === "shark"
            ? randomBetween(0.14, 0.28)
            : fish.kind === "tuna"
              ? randomBetween(0.26, 0.58)
              : randomBetween(0.8, 1.8);
    }

    if (fish.kind === "puffer") {
      const targetExpand = distanceToPlayer < 180 ? 1.65 : 1;
      fish.expand = lerp(fish.expand, targetExpand, dt * 5.2);
    } else {
      fish.expand = lerp(fish.expand, 1, dt * 5.2);
    }

    const desiredVx = Math.cos(fish.angle) * fish.speed;
    const desiredVy = Math.sin(fish.angle) * fish.speed;
    const turnRate =
      fish.kind === "shark"
        ? (fish.huntStyle === "cutter" ? 2.55 : 3.2)
        : fish.kind === "tuna" && fish.rushTimer > 0
          ? 0.78
          : config.turnRate;

    fish.vx = lerp(fish.vx, desiredVx, dt * turnRate);
    fish.vy = lerp(fish.vy, desiredVy, dt * turnRate);
    fish.x += fish.vx * dt;
    fish.y += fish.vy * dt;
    resolveEntityAgainstDecorations(fish, fish.kind === "shark" ? 0.75 : 0.55);

    if (fish.x < fish.size || fish.x > WORLD.width - fish.size) {
      fish.x = clamp(fish.x, fish.size, WORLD.width - fish.size);
      fish.vx *= -1;
      fish.angle = Math.atan2(fish.vy, fish.vx);
    }
    if (fish.y < fish.size || fish.y > WORLD.height - fish.size) {
      fish.y = clamp(fish.y, fish.size, WORLD.height - fish.size);
      fish.vy *= -1;
      fish.angle = Math.atan2(fish.vy, fish.vx);
    }

    const updatedDistance = Math.hypot(fish.x - state.player.x, fish.y - state.player.y);
    const collisionDistance = getPlayerCollisionRadius() + getFishCollisionRadius(fish);
    if (updatedDistance < collisionDistance) {
      if (playerCanEat(fish)) {
        consumeFish(fish);
      } else if (state.player.invincibleTimer > 0) {
        continue;
      } else if (!useShield(fish)) {
        gameOver();
        return;
      }
    }
  }
}

function updateItems(dt) {
  state.itemTimer -= dt;
  if (state.itemTimer <= 0) {
    spawnItem();
    state.itemTimer = randomBetween(10, 16);
  }

  for (let i = state.items.length - 1; i >= 0; i -= 1) {
    const item = state.items[i];
    if (item.removed) {
      state.items.splice(i, 1);
      continue;
    }

    item.phase += dt * 2.1;
    const bobY = Math.sin(item.phase) * 6;
    const distance = Math.hypot(item.x - state.player.x, item.y + bobY - state.player.y);
    if (distance < state.player.size * 0.7 + item.size) {
      collectItem(item);
    }
  }
}

function updateSpawn(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnNeededEntities();
    state.spawnTimer = 0.24;
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.age += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;

    if (particle.kind === "spark") {
      particle.vx *= 0.94;
      particle.vy *= 0.94;
    }

    if (particle.kind === "bubble") {
      particle.vy -= 8 * dt;
      particle.vx *= 0.98;
    }

    if (particle.age >= particle.life) {
      state.particles.splice(i, 1);
    }
  }

  state.warningTimer = Math.max(0, state.warningTimer - dt);
  state.warningFlashTimer = Math.max(0, state.warningFlashTimer - dt);
}

function updateCamera(dt) {
  const targetZoom = getTierConfig().zoom;
  state.camera.zoom = lerp(state.camera.zoom, targetZoom, dt * 2.6);

  const halfViewWidth = state.width / (2 * state.camera.zoom);
  const halfViewHeight = state.height / (2 * state.camera.zoom);
  state.camera.x = clamp(state.player.x, halfViewWidth, WORLD.width - halfViewWidth);
  state.camera.y = clamp(state.player.y, halfViewHeight, WORLD.height - halfViewHeight);
}

function worldToScreen(x, y) {
  return {
    x: (x - state.camera.x) * state.camera.zoom + state.width * 0.5,
    y: (y - state.camera.y) * state.camera.zoom + state.height * 0.5,
  };
}

function drawBackground() {
  const time = state.lastTime * 0.00012;
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#c4f0ff");
  gradient.addColorStop(0.22, "#74cfe8");
  gradient.addColorStop(0.56, "#1f78a9");
  gradient.addColorStop(1, "#0a365c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  const light = ctx.createRadialGradient(state.width * 0.16, state.height * 0.12, 40, state.width * 0.16, state.height * 0.12, state.width * 0.5);
  light.addColorStop(0, "rgba(255,255,255,0.28)");
  light.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, state.width, state.height);

  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.03 + i * 0.008})`;
    ctx.beginPath();
    ctx.ellipse(
      state.width * (0.12 + i * 0.16) + Math.sin(time * 2.1 + i) * 36,
      state.height * (0.16 + (i % 3) * 0.08),
      160 + i * 18,
      22 + i * 4,
      Math.sin(time + i * 0.4) * 0.18,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const seabed = ctx.createLinearGradient(0, state.height * 0.72, 0, state.height);
  seabed.addColorStop(0, "rgba(255, 220, 160, 0)");
  seabed.addColorStop(1, "rgba(255, 205, 138, 0.18)");
  ctx.fillStyle = seabed;
  ctx.fillRect(0, state.height * 0.72, state.width, state.height * 0.28);

  const gridSize = 220;
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= WORLD.width; x += gridSize) {
    const screenX = worldToScreen(x, 0).x;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, state.height);
  }
  for (let y = 0; y <= WORLD.height; y += gridSize) {
    const screenY = worldToScreen(0, y).y;
    ctx.moveTo(0, screenY);
    ctx.lineTo(state.width, screenY);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  const topLeft = worldToScreen(0, 0);
  const bottomRight = worldToScreen(WORLD.width, WORLD.height);
  ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
}

function drawDecorations() {
  for (const deco of state.decorations) {
    const screen = worldToScreen(deco.x, deco.y);
    const size = deco.size * state.camera.zoom;
    if (screen.x < -size * 2 || screen.x > state.width + size * 2 || screen.y < -size * 2 || screen.y > state.height + size * 2) {
      continue;
    }

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.fillStyle = deco.hue;

    if (deco.kind === "rock") {
      ctx.fillStyle = "rgba(113, 135, 150, 0.42)";
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.9, size * 0.65, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(186, 203, 214, 0.18)";
      ctx.beginPath();
      ctx.ellipse(-size * 0.18, -size * 0.12, size * 0.26, size * 0.14, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (deco.kind === "coral") {
      for (let i = -1; i <= 1; i += 1) {
        ctx.strokeStyle = i === 0 ? "rgba(255, 162, 132, 0.5)" : "rgba(255, 196, 167, 0.34)";
        ctx.lineWidth = Math.max(3, size * 0.12);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(i * size * 0.12, size * 0.62);
        ctx.quadraticCurveTo(i * size * 0.25, size * 0.06, i * size * 0.12, -size * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i * size * 0.08, size * 0.12);
        ctx.quadraticCurveTo(i * size * 0.34, -size * 0.18, i * size * 0.44, -size * 0.42);
        ctx.stroke();
      }
    } else {
      for (let i = -1; i <= 1; i += 1) {
        ctx.strokeStyle = i === 0 ? "rgba(84, 236, 193, 0.26)" : "rgba(84, 236, 193, 0.18)";
        ctx.lineWidth = Math.max(2, size * 0.1);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(i * size * 0.2, size * 0.55);
        ctx.quadraticCurveTo(i * size * 0.32, -size * 0.1, i * size * 0.1, -size * 0.7);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

function createFishGradient(colors, size) {
  const gradient = ctx.createLinearGradient(-size, 0, size, 0);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  return gradient;
}

function drawTail(size, sway, depth = 1.6) {
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.lineTo(-size * depth, -size * 0.5 + sway);
  ctx.lineTo(-size * depth, size * 0.5 - sway);
  ctx.closePath();
  ctx.fill();
}

function drawFishBody(kind, size, sway, colors) {
  ctx.fillStyle = createFishGradient(colors, size);

  if (kind === "sardine") {
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.32, size * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    drawTail(size, sway);
    return;
  }

  if (kind === "clown") {
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.08, size * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    drawTail(size, sway, 1.45);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    for (let i = -1; i <= 1; i += 1) {
      ctx.fillRect(size * (-0.36 + i * 0.28), -size * 0.62, size * 0.12, size * 1.24);
    }
    return;
  }

  if (kind === "puffer") {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.88, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      ctx.strokeStyle = colors[1];
      ctx.lineWidth = Math.max(1.2, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * size * 0.86, Math.sin(angle) * size * 0.86);
      ctx.lineTo(Math.cos(angle) * size * 1.14, Math.sin(angle) * size * 1.14);
      ctx.stroke();
    }
    return;
  }

  if (kind === "tuna") {
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.56, size * 0.64, 0, 0, Math.PI * 2);
    ctx.fill();
    drawTail(size, sway, 1.84);
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, -size * 0.92);
    ctx.lineTo(size * 0.22, -size * 0.18);
    ctx.lineTo(-size * 0.26, -size * 0.08);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (kind === "shark") {
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.45, size * 0.74, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 1.1, 0);
    ctx.lineTo(-size * 2.02, -size * 0.58 + sway);
    ctx.lineTo(-size * 1.6, 0);
    ctx.lineTo(-size * 2.02, size * 0.58 - sway);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.18, -size * 1.18);
    ctx.lineTo(size * 0.16, -size * 0.18);
    ctx.lineTo(-size * 0.34, -size * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.08, size * 0.16);
    ctx.lineTo(size * 0.56, size * 0.7);
    ctx.lineTo(size * 0.02, size * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(20, 31, 39, 0.35)";
    ctx.fillRect(size * 0.24, size * 0.24, size * 0.62, size * 0.08);
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(size * (0.02 + i * 0.16), -size * 0.12);
      ctx.lineTo(size * (-0.18 + i * 0.16), size * 0.24);
      ctx.strokeStyle = "rgba(20, 31, 39, 0.24)";
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.stroke();
    }
  }
}

function drawEye(size) {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size * 0.68, -size * 0.14, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f1720";
  ctx.beginPath();
  ctx.arc(size * 0.72, -size * 0.14, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawEntityFish(fish, isPlayer = false) {
  const screen = worldToScreen(fish.x, fish.y);
  const size = fish.size * (isPlayer ? 1 : fish.expand) * state.camera.zoom;
  if (screen.x < -size * 2 || screen.x > state.width + size * 2 || screen.y < -size * 2 || screen.y > state.height + size * 2) {
    return;
  }

  const colors = isPlayer ? state.player.colors : FISH_TYPES[fish.kind].colors;
  const swaySeed = fish.id ?? 0;
  const sway = Math.sin((state.lastTime / 130) + swaySeed) * size * 0.14;
  const angle = isPlayer ? fish.angle : Math.atan2(fish.vy || 0.0001, fish.vx || 0.0001);

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(angle);

  if (isPlayer && state.player.levelFlash > 0) {
    ctx.shadowBlur = 22;
    ctx.shadowColor = `${colors[0]}aa`;
  }

  drawFishBody(isPlayer ? "tuna" : fish.kind, size, sway, colors);
  drawEye(size);

  if (isPlayer && state.player.shield > 0) {
    ctx.strokeStyle = "rgba(210, 244, 255, 0.92)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.28, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isPlayer && state.player.slowPulse > 0) {
    ctx.strokeStyle = "rgba(255, 241, 166, 0.72)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.1, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isPlayer && state.player.magnetTimer > 0) {
    ctx.strokeStyle = "rgba(255, 214, 102, 0.82)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, (190 + state.player.tier * 46) * state.camera.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawItems() {
  for (const item of state.items) {
    const bobY = Math.sin(item.phase) * 6;
    const screen = worldToScreen(item.x, item.y + bobY);
    const size = item.size * state.camera.zoom;
    if (screen.x < -size * 2 || screen.x > state.width + size * 2 || screen.y < -size * 2 || screen.y > state.height + size * 2) {
      continue;
    }

    const colors = ITEM_TYPES[item.type].colors;
    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.shadowBlur = 18;
    ctx.shadowColor = `${colors[0]}aa`;
    ctx.fillStyle = createFishGradient(colors, size);
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(2, size * 0.12);

    if (item.type === "shield") {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.7);
      ctx.lineTo(size * 0.48, -size * 0.3);
      ctx.lineTo(size * 0.34, size * 0.36);
      ctx.lineTo(0, size * 0.72);
      ctx.lineTo(-size * 0.34, size * 0.36);
      ctx.lineTo(-size * 0.48, -size * 0.3);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-size * 0.22, 0, size * 0.32, Math.PI * 0.3, Math.PI * 1.7);
      ctx.arc(size * 0.22, 0, size * 0.32, Math.PI * 1.3, Math.PI * 0.7, true);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    const alpha = 1 - particle.age / particle.life;
    const screen = worldToScreen(particle.x, particle.y);
    ctx.globalAlpha = alpha;

    if (particle.kind === "ring") {
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, (particle.radius + particle.age * 70) * state.camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }

    if (particle.kind === "text") {
      ctx.fillStyle = particle.color;
      ctx.font = "700 20px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText(particle.text, screen.x, screen.y);
      ctx.globalAlpha = 1;
      continue;
    }

    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, Math.max(1.5, particle.radius * state.camera.zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawScreenEffects() {
  if (state.player.magnetFlash > 0) {
    ctx.fillStyle = `rgba(255, 214, 102, ${state.player.magnetFlash * 0.12})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  if (state.player.levelFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.player.levelFlash * 0.08})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  const sharkCount = countByKind("shark");
  if (sharkCount > 0 && state.warningTimer <= 0) {
    ctx.fillStyle = "rgba(0, 9, 20, 0.16)";
    ctx.fillRect(0, 0, state.width, state.height);
  }

  if (state.warningTimer > 0) {
    const alpha = Math.min(0.95, state.warningTimer * 0.5);
    const flashAlpha = state.warningFlashTimer > 0 ? (Math.sin(state.lastTime * 0.05) * 0.5 + 0.5) * 0.24 : 0;
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 64, 64, ${flashAlpha})`;
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.34})`;
      ctx.fillRect(0, 0, state.width, state.height);
    }

    ctx.save();
    ctx.translate(state.width * 0.5, 54);
    ctx.fillStyle = `rgba(120, 18, 18, ${0.52 * alpha})`;
    ctx.strokeStyle = `rgba(255, 173, 173, ${0.9 * alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-210, -24, 420, 48, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff4d6";
    ctx.font = "700 20px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(state.warningText, 0, 7);
    ctx.restore();
  }

  if (state.player.invincibleTimer > 0) {
    const invincibleAlpha = (Math.sin(state.lastTime * 0.03) * 0.5 + 0.5) * 0.08;
    ctx.fillStyle = `rgba(210, 244, 255, ${invincibleAlpha})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  if (state.victory) {
    const trophyScale = 1 + Math.sin(state.lastTime * 0.01) * 0.04;
    ctx.save();
    ctx.translate(state.width * 0.5, state.height * 0.48);
    ctx.scale(trophyScale, trophyScale);
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(-80, -70);
    ctx.lineTo(80, -70);
    ctx.lineTo(56, 16);
    ctx.lineTo(22, 34);
    ctx.lineTo(22, 86);
    ctx.lineTo(64, 104);
    ctx.lineTo(64, 124);
    ctx.lineTo(-64, 124);
    ctx.lineTo(-64, 104);
    ctx.lineTo(-22, 86);
    ctx.lineTo(-22, 34);
    ctx.lineTo(-56, 16);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgba(255, 232, 166, 0.28)";
    ctx.beginPath();
    ctx.arc(-90, -10, 42, Math.PI * 0.55, Math.PI * 1.45, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(90, -10, 42, Math.PI * 1.55, Math.PI * 0.45, false);
    ctx.stroke();
    ctx.restore();
  }
}

function ensureAnimationLoop() {
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(frame);
  }
}

function resumeAfterRestore() {
  state.lastTime = performance.now();
  resizeCanvas();
  if (state.running) {
    startBgm();
  }
  ensureAnimationLoop();
}

function frame(now) {
  animationFrameId = 0;
  const dt = Math.min((now - state.lastTime) / 1000 || 0, 0.033);
  state.lastTime = now;
  scheduleBgm();

  drawBackground();

  if (state.running) {
    updatePlayer(dt);
    updateMagnetField();
    updateFish(dt);
    updateItems(dt);
    updateSpawn(dt);
    updateParticles(dt);
    updateCamera(dt);
  } else {
    updateParticles(dt);
    updateCamera(dt);
  }

  drawDecorations();
  drawItems();

  for (const fish of state.fish) {
    drawEntityFish(fish);
  }

  if (state.player) {
    drawEntityFish(state.player, true);
  }

  drawParticles();
  drawScreenEffects();
  ensureAnimationLoop();
}

function setPointerPosition(clientX, clientY) {
  state.pointer.x = clamp(clientX, 0, state.width);
  state.pointer.y = clamp(clientY, 0, state.height);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("pageshow", resumeAfterRestore);
window.addEventListener("focus", resumeAfterRestore);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    resumeAfterRestore();
  } else {
    stopBgm();
  }
});

canvas.addEventListener("pointermove", (event) => {
  setPointerPosition(event.clientX, event.clientY);
});

canvas.addEventListener("pointerdown", (event) => {
  setPointerPosition(event.clientX, event.clientY);
  ensureAudio();
  if (event.button === 0) {
    state.input.boosting = true;
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (event.button === 0) {
    state.input.boosting = false;
  }
});

canvas.addEventListener("pointerleave", () => {
  state.input.boosting = false;
});

window.addEventListener("pointerup", () => {
  state.input.boosting = false;
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

resizeCanvas();
resetWorld();
ensureAnimationLoop();
