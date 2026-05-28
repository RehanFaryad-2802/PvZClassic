/* js/minigames/bomb_ball.js
   ── Bomb Ball ─────────────────────────────────────
   Bombs fall from the top. Tap/click to catch them
   before they hit the ground. Miss too many = game over.
   Powerups (shields, slow-mo) drop occasionally.
*/

const BombBall = (() => {

  // ── Config key-value pairs (easy to tune) ─────────
  const CONFIG = {
    ROWS: 5,                     // visual lanes
    COLS: 6,                     // horizontal slots per row
    FALL_DURATION_BASE: 2200,    // ms a bomb takes to fall (easy)
    FALL_DURATION_MIN: 700,      // ms floor (insane)
    SPAWN_INTERVAL_BASE: 900,    // ms between spawns (easy)
    SPAWN_INTERVAL_MIN: 280,     // ms floor (insane)
    MAX_LIVES: 3,
    TOTAL_ROUNDS: 5,             // rounds per game session
    ROUND_DURATION: 18,          // seconds per round
    POWERUP_CHANCE: 0.12,        // 12% chance a bomb is a powerup
    SLOWMO_DURATION: 3000,       // ms slow-motion lasts
    SHIELD_HITS: 1,              // shield absorbs N misses
    BOMB_TYPES: {
      normal:  { emoji: "💣", points: 1,  color: "#ff6a00" },
      gold:    { emoji: "✨", points: 3,  color: "#fbbf24" },
      ice:     { emoji: "❄️",  points: 2,  color: "#38bdf8" },
      poison:  { emoji: "☠️",  points: -1, color: "#a855f7" }, // catching this hurts!
    },
    POWERUP_TYPES: {
      slowmo:  { emoji: "⏱️",  label: "Slow-Mo!"   },
      shield:  { emoji: "🛡️",  label: "Shield!"    },
      double:  { emoji: "×2",   label: "2× Points!" },
    },
  };

  const DIFFICULTIES = [
    {
      name: "Easy",
      pips: 1,
      fallMult: 1.0,
      spawnMult: 1.0,
      poisonChance: 0,
      reward: { seeds: 1, coins: 6 },
    },
    {
      name: "Medium",
      pips: 2,
      fallMult: 0.78,
      spawnMult: 0.75,
      poisonChance: 0.08,
      reward: { seeds: 2, coins: 14 },
    },
    {
      name: "Hard",
      pips: 3,
      fallMult: 0.58,
      spawnMult: 0.55,
      poisonChance: 0.15,
      reward: { seeds: 4, coins: 25 },
    },
    {
      name: "Expert",
      pips: 4,
      fallMult: 0.42,
      spawnMult: 0.38,
      poisonChance: 0.22,
      reward: { seeds: 6, coins: 40 },
    },
    {
      name: "Insane",
      pips: 5,
      fallMult: 0.30,
      spawnMult: 0.28,
      poisonChance: 0.30,
      reward: { seeds: 10, coins: 60 },
    },
  ];

  let screen    = null;
  let arena     = null;
  let state     = null;
  let spawnTimer   = null;
  let roundTimer   = null;
  let slowmoTimer  = null;
  let currentDiff  = 0;
  let activeBombs  = [];   // { el, timeoutId, col }
  let doubleActive = false;

  // ── Init (called once from UI.init) ───────────────
  function init() {
    screen = document.getElementById("screen-bombball");
    buildUI();
  }

  function buildUI() {
    screen.innerHTML = `
      <div class="bb-container" id="bb-container">

        <!-- Header -->
        <div class="bb-header">
          <button class="btn-back" id="bb-back">← Back</button>
          <h2>💣 Bomb Ball</h2>
          <div class="bh-stats">
            <div class="bh-stat">
              <span class="stat-val" id="bb-score">0</span>
              <span class="stat-lbl">Score</span>
            </div>
            <div class="bh-stat">
              <span class="stat-val" id="bb-round">1/${CONFIG.TOTAL_ROUNDS}</span>
              <span class="stat-lbl">Round</span>
            </div>
            <div class="bh-stat">
              <span class="stat-val" id="bb-time">${CONFIG.ROUND_DURATION}</span>
              <span class="stat-lbl">Time</span>
            </div>
          </div>
        </div>

        <!-- Timer bar -->
        <div class="bh-timer-bar">
          <div class="bh-timer-fill" id="bb-timer-fill" style="background:linear-gradient(90deg,#06b6d4,#8b5cf6,#ec4899)"></div>
        </div>

        <!-- Difficulty pips + lives + powerup indicator -->
        <div class="bb-meta">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:var(--gray);letter-spacing:1px">DIFF</span>
            <div class="bh-diff-badge" id="bb-diff-badge"></div>
            <span id="bb-diff-name" style="font-family:var(--font-display);font-size:16px;color:var(--orange)"></span>
          </div>
          <div class="bh-lives" id="bb-lives">❤️❤️❤️</div>
          <div id="bb-powerup-label" class="bb-powerup-label" style="visibility:hidden">—</div>
        </div>

        <!-- Legend -->
        <div class="bb-legend">
          <span>💣 +1</span><span>✨ +3</span><span>❄️ +2</span>
          <span style="color:#a855f7">☠️ −1</span>
          <span>⏱️ Slow</span><span>🛡️ Shield</span><span>×2 Dbl</span>
        </div>

        <!-- Drop arena -->
        <div class="bb-arena" id="bb-arena"></div>

        <!-- Catch zone (bottom strip) -->
        <div class="bb-catch-zone" id="bb-catch-zone">
          <div class="bb-catch-glow"></div>
          <span class="bb-catch-hint">TAP BOMBS HERE ↓</span>
        </div>

      </div>
    `;

    arena = document.getElementById("bb-arena");

    document.getElementById("bb-back").addEventListener("click", () => {
      stopGame();
      UI.showScreen("screen-minigames");
    });

    // Catch zone — catch any bomb that reaches the bottom
    document.getElementById("bb-catch-zone").addEventListener("click", (e) => {
      tryAutoNearestCatch(e);
    });
  }

  // ── Difficulty picker (same pattern as BlockHunt) ──
  function showDifficultyPicker() {
    const container = document.getElementById("bb-container");
    const picker = document.createElement("div");
    picker.className = "bh-result";
    picker.id = "bb-diff-picker";
    picker.innerHTML = `
      <h2 style="font-size:32px">💣 Choose Difficulty</h2>
      ${DIFFICULTIES.map((d, i) => `
        <button class="btn-menu" data-diff="${i}" style="width:290px;text-align:center">
          ${"🔥".repeat(d.pips)} ${d.name}
          <span style="font-size:13px;color:var(--gold);display:block">
            ${d.fallMult < 0.5 ? "Fast" : d.fallMult < 0.8 ? "Medium" : "Slow"} bombs ·
            ☠️ ${Math.round(d.poisonChance * 100)}% · 🌱${d.reward.seeds} 🪙${d.reward.coins}
          </span>
        </button>
      `).join("")}
    `;
    container.appendChild(picker);

    picker.querySelectorAll("[data-diff]").forEach(btn => {
      btn.addEventListener("click", () => {
        picker.remove();
        startGame(parseInt(btn.dataset.diff));
      });
    });
  }

  // ── Start game ─────────────────────────────────────
  function startGame(diffIdx = 0) {
    currentDiff = Math.min(diffIdx, DIFFICULTIES.length - 1);
    const diff = DIFFICULTIES[currentDiff];

    state = {
      score: 0,
      round: 1,
      lives: CONFIG.MAX_LIVES,
      shield: 0,
      running: false,
      timeLeft: CONFIG.ROUND_DURATION,
    };
    doubleActive = false;
    activeBombs = [];

    // Difficulty pips
    const badge = document.getElementById("bb-diff-badge");
    if (badge) {
      badge.innerHTML = DIFFICULTIES.map((_, i) =>
        `<div class="bh-diff-pip${i <= currentDiff ? " active" : ""}"></div>`
      ).join("");
    }
    const nameEl = document.getElementById("bb-diff-name");
    if (nameEl) nameEl.textContent = diff.name;

    updateHUD();
    startRound();
  }

  // ── Round loop ─────────────────────────────────────
  function startRound() {
    if (state.round > CONFIG.TOTAL_ROUNDS || state.lives <= 0) {
      endGame();
      return;
    }

    state.running = true;
    state.timeLeft = CONFIG.ROUND_DURATION;
    arena.innerHTML = "";
    activeBombs = [];
    doubleActive = false;

    updateHUD();

    const diff = DIFFICULTIES[currentDiff];
    const fallDur = Math.max(
      CONFIG.FALL_DURATION_MIN,
      Math.round(CONFIG.FALL_DURATION_BASE * diff.fallMult)
    );
    const spawnMs = Math.max(
      CONFIG.SPAWN_INTERVAL_MIN,
      Math.round(CONFIG.SPAWN_INTERVAL_BASE * diff.spawnMult)
    );

    // Round countdown timer
    clearInterval(roundTimer);
    const roundStart = Date.now();
    roundTimer = setInterval(() => {
      const elapsed = (Date.now() - roundStart) / 1000;
      state.timeLeft = Math.max(0, CONFIG.ROUND_DURATION - elapsed);
      document.getElementById("bb-time").textContent = Math.ceil(state.timeLeft);
      document.getElementById("bb-timer-fill").style.width =
        (state.timeLeft / CONFIG.ROUND_DURATION) * 100 + "%";

      if (state.timeLeft <= 0) {
        clearInterval(roundTimer);
        clearInterval(spawnTimer);
        // Remove all active bombs
        activeBombs.forEach(b => { clearTimeout(b.timeoutId); b.el.remove(); });
        activeBombs = [];
        state.running = false;
        state.round++;
        setTimeout(() => startRound(), 600);
      }
    }, 80);

    // Spawn bombs
    clearInterval(spawnTimer);
    spawnTimer = setInterval(() => {
      if (!state.running) return;
      spawnBomb(fallDur, diff);
    }, spawnMs);
  }

  function spawnBomb(fallDur, diff) {
    const arenaRect = arena.getBoundingClientRect();
    const cols = CONFIG.COLS;
    const col = Math.floor(Math.random() * cols);
    const xPct = (col / cols) * 100 + (100 / cols / 2);

    // Decide bomb type
    let type;
    const r = Math.random();
    if (r < CONFIG.POWERUP_CHANCE) {
      // powerup
      const puTypes = Object.keys(CONFIG.POWERUP_TYPES);
      type = "pu_" + puTypes[Math.floor(Math.random() * puTypes.length)];
    } else if (r < CONFIG.POWERUP_CHANCE + diff.poisonChance) {
      type = "poison";
    } else {
      // weighted: 60% normal, 25% ice, 15% gold
      const rr = Math.random();
      type = rr < 0.60 ? "normal" : rr < 0.85 ? "ice" : "gold";
    }

    const isPU   = type.startsWith("pu_");
    const puKey  = isPU ? type.replace("pu_", "") : null;
    const cfg    = isPU ? CONFIG.POWERUP_TYPES[puKey] : CONFIG.BOMB_TYPES[type];
    const emoji  = cfg.emoji;
    const color  = isPU ? "#22c55e" : cfg.color;

    const el = document.createElement("div");
    el.className = "bb-bomb";
    el.textContent = emoji;
    el.style.cssText = `
      left:${xPct}%;
      top:-60px;
      --fall-dur:${fallDur}ms;
      --bomb-color:${color};
      animation: bbFall var(--fall-dur) linear forwards;
    `;
    el.dataset.type = type;
    el.dataset.col  = col;

    // Click to catch
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      catchBomb(el, type);
    });

    arena.appendChild(el);

    // If not caught → miss
    const tid = setTimeout(() => {
      if (el.parentNode) {
        el.remove();
        activeBombs = activeBombs.filter(b => b.el !== el);
        if (!isPU && type !== "poison") {
          onMiss();
        }
        // poison bombs that reach bottom do nothing (player avoided them)
      }
    }, fallDur + 60);

    activeBombs.push({ el, timeoutId: tid, col, type });
  }

  function catchBomb(el, type) {
    if (!state.running) return;
    clearTimeout(activeBombs.find(b => b.el === el)?.timeoutId);
    activeBombs = activeBombs.filter(b => b.el !== el);

    const isPU  = type.startsWith("pu_");
    const puKey = isPU ? type.replace("pu_", "") : null;

    if (isPU) {
      activatePowerup(puKey);
      showCatchFX(el, CONFIG.POWERUP_TYPES[puKey].label, "#22c55e");
    } else {
      const cfg = CONFIG.BOMB_TYPES[type];
      let pts = cfg.points;
      if (doubleActive && pts > 0) pts *= 2;

      state.score = Math.max(0, state.score + pts);
      updateHUD();

      const label = pts > 0 ? `+${pts}` : `${pts}`;
      const color = pts > 0 ? (type === "gold" ? "#fbbf24" : "#22c55e") : "#ef4444";
      showCatchFX(el, label, color);
    }

    el.remove();
  }

  function onMiss() {
    if (state.shield > 0) {
      state.shield--;
      showPowerupLabel("🛡️ Blocked!");
      updateHUD();
      return;
    }
    state.lives--;
    updateHUD();
    // Screen shake
    arena.classList.add("bb-shake");
    setTimeout(() => arena.classList.remove("bb-shake"), 400);

    if (state.lives <= 0) {
      clearInterval(roundTimer);
      clearInterval(spawnTimer);
      state.running = false;
      setTimeout(() => endGame(), 600);
    }
  }

  function activatePowerup(key) {
    if (key === "slowmo") {
      // Slow all current falling bombs
      arena.querySelectorAll(".bb-bomb").forEach(b => {
        b.style.animationDuration = "6000ms";
      });
      clearTimeout(slowmoTimer);
      showPowerupLabel("⏱️ Slow-Mo!");
      slowmoTimer = setTimeout(() => {
        // Restore speed — existing bombs keep slow but new ones are normal
        showPowerupLabel("");
      }, CONFIG.SLOWMO_DURATION);
    } else if (key === "shield") {
      state.shield += CONFIG.SHIELD_HITS;
      showPowerupLabel(`🛡️ Shield x${state.shield}!`);
      updateHUD();
    } else if (key === "double") {
      doubleActive = true;
      showPowerupLabel("×2 Points!");
      setTimeout(() => { doubleActive = false; }, 5000);
    }
  }

  function showPowerupLabel(text) {
    const el = document.getElementById("bb-powerup-label");
    if (!el) return;
    el.style.visibility = text ? "visible" : "hidden";
    el.textContent = text;
  }

  function showCatchFX(bombEl, label, color) {
    const rect = bombEl.getBoundingClientRect();
    const arenaRect = arena.getBoundingClientRect();
    const fx = document.createElement("div");
    fx.className = "bb-catch-fx";
    fx.textContent = label;
    fx.style.cssText = `
      left:${rect.left - arenaRect.left + rect.width / 2}px;
      top:${rect.top - arenaRect.top}px;
      color:${color};
    `;
    arena.appendChild(fx);
    setTimeout(() => fx.remove(), 700);
  }

  // Tap on catch-zone → catch nearest bomb in bottom 30% of arena
  function tryAutoNearestCatch(e) {
    if (!state.running) return;
    const arenaRect = arena.getBoundingClientRect();
    const threshold = arenaRect.height * 0.35;
    let nearest = null;
    let nearestDist = Infinity;

    activeBombs.forEach(b => {
      const rect = b.el.getBoundingClientRect();
      const bombBottom = rect.bottom - arenaRect.top;
      if (bombBottom >= arenaRect.height - threshold) {
        const dist = Math.abs(rect.left + rect.width / 2 - arenaRect.left - (e.clientX - arenaRect.left));
        if (dist < nearestDist) { nearestDist = dist; nearest = b; }
      }
    });

    if (nearest) catchBomb(nearest.el, nearest.type);
  }

  function updateHUD() {
    const s = document.getElementById("bb-score");
    const r = document.getElementById("bb-round");
    const l = document.getElementById("bb-lives");
    if (s) s.textContent = state.score;
    if (r) r.textContent = `${Math.min(state.round, CONFIG.TOTAL_ROUNDS)}/${CONFIG.TOTAL_ROUNDS}`;
    if (l) {
      const hp = Math.max(0, state.lives);
      l.textContent = "❤️".repeat(hp) + "🖤".repeat(Math.max(0, CONFIG.MAX_LIVES - hp)) +
        (state.shield > 0 ? " 🛡️".repeat(state.shield) : "");
    }
  }

  function endGame() {
    clearInterval(roundTimer);
    clearInterval(spawnTimer);
    clearTimeout(slowmoTimer);
    state.running = false;

    const diff   = DIFFICULTIES[currentDiff];
    const reward = diff.reward;
    const won    = state.score > 0;

    let plantName = "";
    if (won) {
      const seedReward = Seeds.giveRandomSeeds(reward.seeds);
      Player.addCoins(reward.coins);
      UI.updateCoinDisplays();
      plantName = seedReward ? PlantRegistry.get(seedReward.plantId)?.name || "" : "";
    }

    const container = document.getElementById("bb-container");
    const overlay   = document.createElement("div");
    overlay.className = "bh-result";
    overlay.innerHTML = `
      <h2>${state.score >= CONFIG.TOTAL_ROUNDS * 3 ? "🏆 Perfect!" : won ? "⭐ Nice Catch!" : "💀 All Missed!"}</h2>
      <div class="bh-score-final">Score: ${state.score} pts</div>
      ${won ? `
        <div class="bh-seeds-earned">🌱 +${reward.seeds} seeds → ${plantName}</div>
        <div class="bh-seeds-earned" style="color:var(--gold)">🪙 +${reward.coins} coins</div>
      ` : ""}
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px">
        ${currentDiff < DIFFICULTIES.length - 1 ? `
          <button class="btn-primary" id="bb-harder" style="max-width:200px">
            Harder: ${DIFFICULTIES[currentDiff + 1].name} 🔥
          </button>` : ""}
        <button class="btn-primary"   id="bb-replay"  style="max-width:200px">🔄 Replay</button>
        <button class="btn-secondary" id="bb-change"  style="max-width:200px">📋 Change Diff</button>
        <button class="btn-secondary" id="bb-exit"    style="max-width:200px">🏠 Menu</button>
      </div>
    `;
    container.appendChild(overlay);

    const harderBtn = document.getElementById("bb-harder");
    if (harderBtn) harderBtn.addEventListener("click", () => { overlay.remove(); startGame(currentDiff + 1); });
    document.getElementById("bb-replay").addEventListener("click", () => { overlay.remove(); startGame(currentDiff); });
    document.getElementById("bb-change").addEventListener("click", () => { overlay.remove(); showDifficultyPicker(); });
    document.getElementById("bb-exit").addEventListener("click",   () => { stopGame(); UI.showScreen("screen-minigames"); });
  }

  function stopGame() {
    clearInterval(roundTimer);
    clearInterval(spawnTimer);
    clearTimeout(slowmoTimer);
    state = null;
    activeBombs = [];
    if (arena) arena.innerHTML = "";
  }

  return { init, startGame: showDifficultyPicker, stopGame };
})();
