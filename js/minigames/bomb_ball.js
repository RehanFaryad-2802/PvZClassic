/* js/minigames/bomb_ball.js */
const BombBall = (() => {
  const CONFIG = {
    COLS: 6,
    FALL_DURATION_BASE: 2200,
    FALL_DURATION_MIN: 700,
    SPAWN_INTERVAL_BASE: 900,
    SPAWN_INTERVAL_MIN: 280,
    MAX_LIVES: 3,
    TOTAL_ROUNDS: 5,
    ROUND_DURATION: 18,
    POWERUP_CHANCE: 0.12,
    SLOWMO_DURATION: 3000,
    SHIELD_HITS: 1,
    BOMB_TYPES: {
      normal: { emoji: "💣", points: 1, color: "#ff6a00" },
      gold: { emoji: "✨", points: 3, color: "#fbbf24" },
      ice: { emoji: "❄️", points: 2, color: "#38bdf8" },
      poison: { emoji: "☠️", points: -1, color: "#a855f7" },
    },
    POWERUP_TYPES: {
      slowmo: { emoji: "⏱️", label: "Slow-Mo!" },
      shield: { emoji: "🛡️", label: "Shield!" },
      double: { emoji: "×2", label: "2× Points!" },
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
      fallMult: 0.3,
      spawnMult: 0.28,
      poisonChance: 0.3,
      reward: { seeds: 10, coins: 60 },
    },
  ];

  let screen = null;
  let arena = null;
  let state = null;
  let spawnTimer = null;
  let roundTimer = null;
  let slowmoTimer = null;
  let currentDiff = 0;
  let activeBombs = [];
  let doubleActive = false;
  let _devMode = false;

  // ── Init ─────────────────────────────────────────
  // Normal:   BombBall.init()
  // Dev test: BombBall.init(container, diffIdx, callbacks)
  function init(container, diffIdx, callbacks) {
    if (container) {
      _devMode = true;
      screen = container;
    } else {
      _devMode = false;
      screen = document.getElementById("screen-bombball");
    }
    buildUI();
    if (_devMode) startGame(diffIdx || 0);
  }

  function buildUI() {
    screen.innerHTML = `
      <div class="bb-container" id="bb-container">
        <div class="bb-header">
          <button class="btn-back" id="bb-back">↶</button>
          <h2>💣 Bomb Ball</h2>
          <div class="bh-stats">
            <div class="bh-stat"><span class="stat-val" id="bb-score">0</span><span class="stat-lbl">Score</span></div>
            <div class="bh-stat"><span class="stat-val" id="bb-round">1/${CONFIG.TOTAL_ROUNDS}</span><span class="stat-lbl">Round</span></div>
            <div class="bh-stat"><span class="stat-val" id="bb-time">${CONFIG.ROUND_DURATION}</span><span class="stat-lbl">Time</span></div>
          </div>
        </div>
        <div class="bh-timer-bar">
          <div class="bh-timer-fill" id="bb-timer-fill" style="background:linear-gradient(90deg,#06b6d4,#8b5cf6,#ec4899)"></div>
        </div>
        <div class="bb-meta">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:var(--gray,#6b7280);letter-spacing:1px">DIFF</span>
            <div class="bh-diff-badge" id="bb-diff-badge"></div>
            <span id="bb-diff-name" style="font-family:var(--font-display,sans-serif);font-size:16px;color:var(--orange,#f97316)"></span>
          </div>
          <div class="bh-lives" id="bb-lives">❤️❤️❤️</div>
          <div id="bb-powerup-label" class="bb-powerup-label" style="visibility:hidden">—</div>
        </div>
        <div class="bb-legend">
          <span>💣 +1</span><span>✨ +3</span><span>❄️ +2</span>
          <span style="color:#a855f7">☠️ −1</span>
          <span>⏱️ Slow</span><span>🛡️ Shield</span><span>×2 Dbl</span>
        </div>
        <div class="bb-arena" id="bb-arena"></div>
        <div class="bb-catch-zone" id="bb-catch-zone">
          <div class="bb-catch-glow"></div>
          <span class="bb-catch-hint">TAP BOMBS HERE ↓</span>
        </div>
      </div>
    `;

    arena = document.getElementById("bb-arena");

    document.getElementById("bb-back").addEventListener("click", () => {
      stopGame();
      if (!_devMode && typeof UI !== "undefined")
        UI.showScreen("screen-minigames");
    });

    document.getElementById("bb-catch-zone").addEventListener("click", (e) => {
      tryAutoNearestCatch(e);
    });
  }

  function showDifficultyPicker() {
    const container = document.getElementById("bb-container");
    const picker = document.createElement("div");
    picker.className = "bh-result";
    picker.id = "bb-diff-picker";
    picker.innerHTML = `
      <button class="btn-back" style="align-self:flex-start;margin-bottom:8px" id="bb-pick-back">↶</button>
      <h2 style="font-size:32px">💣 Choose Difficulty</h2>
      ${DIFFICULTIES.map(
        (d, i) => `
        <button class="btn-menu" data-diff="${i}" style="width:290px;text-align:center">
          ${"🔥".repeat(d.pips)} ${d.name}
          <span style="font-size:13px;color:var(--gold,#fbbf24);display:block">
            ${d.fallMult < 0.5 ? "Fast" : d.fallMult < 0.8 ? "Medium" : "Slow"} bombs ·
            ☠️ ${Math.round(d.poisonChance * 100)}% · 🌱${d.reward.seeds} 🪙${d.reward.coins}
          </span>
        </button>`,
      ).join("")}
    `;
    picker.querySelector("#bb-pick-back").addEventListener("click", () => {
      picker.remove();
      if (!_devMode && typeof UI !== "undefined")
        UI.showScreen("screen-minigames");
    });
    container.appendChild(picker);
    picker.querySelectorAll("[data-diff]").forEach((btn) => {
      btn.addEventListener("click", () => {
        picker.remove();
        startGame(parseInt(btn.dataset.diff));
      });
    });
  }

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

    const badge = document.getElementById("bb-diff-badge");
    if (badge)
      badge.innerHTML = DIFFICULTIES.map(
        (_, i) =>
          `<div class="bh-diff-pip${i <= currentDiff ? " active" : ""}"></div>`,
      ).join("");
    const nameEl = document.getElementById("bb-diff-name");
    if (nameEl) nameEl.textContent = diff.name;

    updateHUD();
    startRound();
  }

  let rafId = null;
  let lastTs = null;

  function tick(ts) {
    if (!state || !state.running) return;
    const dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;
    const arenaH = arena.clientHeight;

    for (let i = activeBombs.length - 1; i >= 0; i--) {
      const b = activeBombs[i];
      if (b.frozen) continue;
      b.y += b.speed * dt;
      b.el.style.top = b.y + "px";
      if (b.y > arenaH) {
        b.el.remove();
        activeBombs.splice(i, 1);
        const isPU = b.type.startsWith("pu_");
        if (!isPU && b.type !== "poison") onMiss();
      }
    }
    rafId = requestAnimationFrame(tick);
  }

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
    lastTs = null;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
    updateHUD();

    const diff = DIFFICULTIES[currentDiff];
    const fallDur = Math.max(
      CONFIG.FALL_DURATION_MIN,
      Math.round(CONFIG.FALL_DURATION_BASE * diff.fallMult),
    );
    const spawnMs = Math.max(
      CONFIG.SPAWN_INTERVAL_MIN,
      Math.round(CONFIG.SPAWN_INTERVAL_BASE * diff.spawnMult),
    );

    clearInterval(roundTimer);
    const roundStart = Date.now();
    roundTimer = setInterval(() => {
      const elapsed = (Date.now() - roundStart) / 1000;
      state.timeLeft = Math.max(0, CONFIG.ROUND_DURATION - elapsed);
      const tEl = document.getElementById("bb-time");
      const fEl = document.getElementById("bb-timer-fill");
      if (tEl) tEl.textContent = Math.ceil(state.timeLeft);
      if (fEl)
        fEl.style.width = (state.timeLeft / CONFIG.ROUND_DURATION) * 100 + "%";

      if (state.timeLeft <= 0) {
        clearInterval(roundTimer);
        clearInterval(spawnTimer);
        activeBombs.forEach((b) => {
          clearTimeout(b.timeoutId);
          b.el.remove();
        });
        activeBombs = [];
        state.running = false;
        state.round++;
        setTimeout(() => startRound(), 600);
      }
    }, 80);

    clearInterval(spawnTimer);
    spawnTimer = setInterval(() => {
      if (state.running) spawnBomb(fallDur, diff);
    }, spawnMs);
  }

  function spawnBomb(fallDur, diff) {
    const arenaHeight = arena.clientHeight || 400;
    const cols = CONFIG.COLS;
    const col = Math.floor(Math.random() * cols);
    const xPct = (col / cols) * 100 + 100 / cols / 2;

    let type;
    const r = Math.random();
    if (r < CONFIG.POWERUP_CHANCE) {
      const puTypes = Object.keys(CONFIG.POWERUP_TYPES);
      type = "pu_" + puTypes[Math.floor(Math.random() * puTypes.length)];
    } else if (r < CONFIG.POWERUP_CHANCE + diff.poisonChance) {
      type = "poison";
    } else {
      const rr = Math.random();
      type = rr < 0.6 ? "normal" : rr < 0.85 ? "ice" : "gold";
    }

    const isPU = type.startsWith("pu_");
    const puKey = isPU ? type.replace("pu_", "") : null;
    const cfg = isPU ? CONFIG.POWERUP_TYPES[puKey] : CONFIG.BOMB_TYPES[type];
    const color = isPU ? "#22c55e" : cfg.color;

    const el = document.createElement("div");
    el.className = "bb-bomb";
    el.textContent = cfg.emoji;
    el.style.cssText = `left:${xPct}%;top:-60px;position:absolute;font-size:44px;width:72px;height:72px;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;filter:drop-shadow(0 0 8px ${color});padding:12px;box-sizing:border-box;transform:translate(-50%,0);`;
    el.dataset.type = type;

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      catchBomb(el, type);
    });
    el.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        catchBomb(el, type);
      },
      { passive: false },
    );
    arena.appendChild(el);

    activeBombs.push({
      el,
      col,
      type,
      y: -60,
      speed: arenaHeight / (fallDur / 1000),
    });
  }

  function catchBomb(el, type) {
    if (!state.running) return;
    clearTimeout(activeBombs.find((b) => b.el === el)?.timeoutId);
    activeBombs = activeBombs.filter((b) => b.el !== el);

    const isPU = type.startsWith("pu_");
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
      showCatchFX(
        el,
        pts > 0 ? `+${pts}` : `${pts}`,
        pts > 0 ? (type === "gold" ? "#fbbf24" : "#22c55e") : "#ef4444",
      );
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
      activeBombs.forEach((b) => {
        b.speed *= 0.3;
        b.frozen = false;
      });
      clearTimeout(slowmoTimer);
      showPowerupLabel("⏱️ Slow-Mo!");
      slowmoTimer = setTimeout(
        () => showPowerupLabel(""),
        CONFIG.SLOWMO_DURATION,
      );
    } else if (key === "shield") {
      state.shield += CONFIG.SHIELD_HITS;
      showPowerupLabel(`🛡️ Shield x${state.shield}!`);
      updateHUD();
    } else if (key === "double") {
      doubleActive = true;
      showPowerupLabel("×2 Points!");
      setTimeout(() => {
        doubleActive = false;
      }, 5000);
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
    fx.style.cssText = `left:${rect.left - arenaRect.left + rect.width / 2}px;top:${rect.top - arenaRect.top}px;color:${color};`;
    arena.appendChild(fx);
    setTimeout(() => fx.remove(), 700);
  }

  function tryAutoNearestCatch(e) {
    if (!state.running) return;
    const arenaRect = arena.getBoundingClientRect();
    const threshold = arenaRect.height * 0.35;
    let nearest = null,
      nearestDist = Infinity;
    activeBombs.forEach((b) => {
      const rect = b.el.getBoundingClientRect();
      if (rect.bottom - arenaRect.top >= 0) {
        const dist = Math.abs(
          rect.left +
            rect.width / 2 -
            arenaRect.left -
            (e.clientX - arenaRect.left),
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = b;
        }
      }
    });
    if (nearest) catchBomb(nearest.el, nearest.type);
  }

  function updateHUD() {
    const s = document.getElementById("bb-score");
    const r = document.getElementById("bb-round");
    const l = document.getElementById("bb-lives");
    if (s) s.textContent = state.score;
    if (r)
      r.textContent = `${Math.min(state.round, CONFIG.TOTAL_ROUNDS)}/${CONFIG.TOTAL_ROUNDS}`;
    if (l)
      l.textContent =
        "❤️".repeat(Math.max(0, state.lives)) +
        "🖤".repeat(Math.max(0, CONFIG.MAX_LIVES - state.lives)) +
        (state.shield > 0 ? " 🛡️".repeat(state.shield) : "");
  }

  function endGame() {
    clearInterval(roundTimer);
    clearInterval(spawnTimer);
    clearTimeout(slowmoTimer);
    cancelAnimationFrame(rafId);
    state.running = false;

    const diff = DIFFICULTIES[currentDiff];
    const reward = diff.reward;
    const won = state.score > 0;
    let plantName = "";

    if (won) {
      if (typeof Seeds !== "undefined") {
        const sr = Seeds.giveRandomSeeds(reward.seeds);
        plantName = sr
          ? typeof PlantRegistry !== "undefined"
            ? PlantRegistry.get(sr.plantId)?.name || ""
            : ""
          : "";
      }
      if (typeof Player !== "undefined") Player.addCoins(reward.coins);
      if (typeof UI !== "undefined") UI.updateCoinDisplays();
    }

    const container = document.getElementById("bb-container");
    const overlay = document.createElement("div");
    overlay.className = "bh-result";
    overlay.innerHTML = `
      <h2>${state.score >= CONFIG.TOTAL_ROUNDS * 3 ? "🏆 Perfect!" : won ? "⭐ Nice Catch!" : "💀 All Missed!"}</h2>
      <div class="bh-score-final">Score: ${state.score} pts</div>
      ${
        won
          ? `<div class="bh-seeds-earned">🌱 +${reward.seeds} seeds${plantName ? " → " + plantName : ""}</div>
             <div class="bh-seeds-earned" style="color:var(--gold,#fbbf24)">🪙 +${reward.coins} coins</div>`
          : ""
      }
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px">
        ${currentDiff < DIFFICULTIES.length - 1 ? `<button class="btn-primary" id="bb-harder" style="max-width:200px">Harder: ${DIFFICULTIES[currentDiff + 1].name} 🔥</button>` : ""}
        <button class="btn-primary"   id="bb-replay" style="max-width:200px">🔄 Replay</button>
        <button class="btn-secondary" id="bb-change" style="max-width:200px">📋 Change Diff</button>
        <button class="btn-secondary" id="bb-exit"   style="max-width:200px">🏠 Menu</button>
      </div>
    `;
    container.appendChild(overlay);

    const harderBtn = overlay.querySelector("#bb-harder");
    if (harderBtn)
      harderBtn.addEventListener("click", () => {
        overlay.remove();
        startGame(currentDiff + 1);
      });
    overlay.querySelector("#bb-replay").addEventListener("click", () => {
      overlay.remove();
      startGame(currentDiff);
    });
    overlay.querySelector("#bb-change").addEventListener("click", () => {
      overlay.remove();
      showDifficultyPicker();
    });
    overlay.querySelector("#bb-exit").addEventListener("click", () => {
      stopGame();
      if (!_devMode && typeof UI !== "undefined")
        UI.showScreen("screen-minigames");
    });
  }

  function stopGame() {
    clearInterval(roundTimer);
    clearInterval(spawnTimer);
    clearTimeout(slowmoTimer);
    cancelAnimationFrame(rafId);
    state = null;
    activeBombs = [];
    if (arena) arena.innerHTML = "";
    buildUI();
  }

  return { init, startGame: showDifficultyPicker, stop: stopGame, stopGame };
})();
