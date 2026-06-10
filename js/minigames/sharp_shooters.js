/* js/minigames/sharp_shooters.js */
const SharpShooters = (() => {
  const CONFIG = {
    LANES: 5,
    DEMON_SIZE: 64,
    MARCH_SPEED_BASE: 90,
    MARCH_SPEED_MAX: 280,
    SPAWN_INTERVAL_BASE: 1100,
    SPAWN_INTERVAL_MIN: 300,
    GAME_DURATION: 30,
    MAX_ESCAPES: 5,
    BOSS_HP: 2,
    POWERUP_CHANCE: 0.1,
    FREEZE_DURATION: 2500,
    FRENZY_DURATION: 5000,
    FRENZY_MULTIPLIER: 2,
    DEMON_TYPES: {
      imp: { emoji: "👿", hp: 1, points: 1, speed: 1.0, color: "#ef4444" },
      armored: { emoji: "🤺", hp: 1, points: 2, speed: 0.7, color: "#94a3b8" },
      bat: { emoji: "🦇", hp: 1, points: 2, speed: 1.6, color: "#a855f7" },
      ice: { emoji: "🧊", hp: 1, points: 2, speed: 0.85, color: "#38bdf8" },
      brute: { emoji: "👹", hp: 2, points: 4, speed: 0.55, color: "#f97316" },
    },
    POWERUP_TYPES: {
      freeze: { emoji: "❄️", label: "Freeze!" },
      frenzy: { emoji: "⚡", label: "Frenzy!" },
      nuke: { emoji: "💥", label: "NUKE!" },
    },
  };

  const DIFFICULTIES = [
    {
      name: "Easy",
      pips: 1,
      speedMult: 1.0,
      spawnMult: 1.0,
      bossChance: 0,
      batChance: 0,
      reward: { seeds: 1, coins: 6 },
    },
    {
      name: "Medium",
      pips: 2,
      speedMult: 1.35,
      spawnMult: 0.72,
      bossChance: 0.08,
      batChance: 0.12,
      reward: { seeds: 2, coins: 14 },
    },
    {
      name: "Hard",
      pips: 3,
      speedMult: 1.75,
      spawnMult: 0.52,
      bossChance: 0.15,
      batChance: 0.2,
      reward: { seeds: 4, coins: 26 },
    },
    {
      name: "Expert",
      pips: 4,
      speedMult: 2.2,
      spawnMult: 0.38,
      bossChance: 0.22,
      batChance: 0.28,
      reward: { seeds: 7, coins: 42 },
    },
    {
      name: "Insane",
      pips: 5,
      speedMult: 2.8,
      spawnMult: 0.27,
      bossChance: 0.3,
      batChance: 0.35,
      reward: { seeds: 11, coins: 65, looms: 5 },
    },
  ];

  let screen = null;
  let arena = null;
  let state = null;
  let spawnTimer = null;
  let gameTimer = null;
  let rafId = null;
  let lastTs = null;
  let currentDiff = 0;
  let activeDemons = [];
  let frenzyActive = false;
  let freezeActive = false;
  let frenzyTimeout = null;
  let freezeTimeout = null;
  let _devMode = false;

  // ── Init ─────────────────────────────────────────
  // Normal:   SharpShooters.init()
  // Dev test: SharpShooters.init(container, diffIdx, callbacks)
  function init(container, diffIdx, callbacks) {
    if (container) {
      _devMode = true;
      screen = container;
    } else {
      _devMode = false;
      screen = document.getElementById("screen-sharpshooters");
    }
    buildUI();
    if (_devMode) startGame(diffIdx || 0);
  }

  function buildUI() {
    screen.innerHTML = `
      <div class="ss-container" id="ss-container">
        <div class="bb-header">
          <button class="btn-back" id="ss-back">↶</button>
          <h2>🎯 Sharp Shooters</h2>
          <div class="bh-stats">
            <div class="bh-stat"><span class="stat-val" id="ss-score">0</span><span class="stat-lbl">Score</span></div>
            <div class="bh-stat"><span class="stat-val" id="ss-combo">x1</span><span class="stat-lbl">Combo</span></div>
            <div class="bh-stat"><span class="stat-val" id="ss-time">${CONFIG.GAME_DURATION}</span><span class="stat-lbl">Time</span></div>
          </div>
        </div>
        <div class="bh-timer-bar">
          <div class="bh-timer-fill" id="ss-timer-fill" style="background:linear-gradient(90deg,#ef4444,#f97316,#fbbf24)"></div>
        </div>
        <div class="bb-meta">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:var(--gray,#6b7280);letter-spacing:1px">DIFF</span>
            <div class="bh-diff-badge" id="ss-diff-badge"></div>
            <span id="ss-diff-name" style="font-family:var(--font-display,sans-serif);font-size:16px;color:var(--orange,#f97316)"></span>
          </div>
          <div id="ss-escapes" style="font-size:18px;letter-spacing:3px">🔴🔴🔴🔴🔴</div>
          <div id="ss-powerup-label" class="bb-powerup-label" style="visibility:hidden">—</div>
        </div>
        <div class="bb-legend">
          <span>👿 +1</span><span>🤺 +2</span><span>🦇 +2</span>
          <span>🧊 +2</span><span style="color:#f97316">👹 +4 (2hp)</span>
          <span>❄️ Freeze</span><span>⚡ Frenzy</span><span>💥 Nuke</span>
        </div>
        <div class="ss-arena" id="ss-arena"></div>
        <div class="ss-cursor" id="ss-cursor"></div>
      </div>
    `;

    arena = document.getElementById("ss-arena");

    document.getElementById("ss-back").addEventListener("click", () => {
      stopGame();
      if (!_devMode && typeof UI !== "undefined")
        UI.showScreen("screen-minigames");
    });

    arena.addEventListener("click", onShoot);
    arena.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        const t = e.touches[0];
        onShoot({ clientX: t.clientX, clientY: t.clientY });
      },
      { passive: false },
    );
  }

  function showDifficultyPicker() {
    const container = document.getElementById("ss-container");
    const picker = document.createElement("div");
    picker.className = "bh-result";
    picker.id = "ss-diff-picker";
    picker.innerHTML = `
      <button class="btn-back" style="align-self:flex-start;margin-bottom:8px" id="ss-pick-back">↶</button>
      <h2 style="font-size:32px">🎯 Choose Difficulty</h2>
      ${DIFFICULTIES.map(
        (d, i) => `
        <button class="btn-menu" data-diff="${i}" style="width:290px;text-align:center">
          ${"🔥".repeat(d.pips)} ${d.name}
          <span style="font-size:13px;color:var(--gold,#fbbf24);display:block">
            Speed ×${d.speedMult} · Boss ${Math.round(d.bossChance * 100)}% · 🌱${d.reward.seeds} 🪙${d.reward.coins}${d.reward.looms ? ` <img src="assets/shop/loom.png" style="width:14px;height:14px;vertical-align:middle">+${d.reward.looms}` : ""}
        </button>`,
      ).join("")}
    `;
    picker.querySelector("#ss-pick-back").addEventListener("click", () => {
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
    state = {
      score: 0,
      combo: 1,
      escapes: 0,
      timeLeft: CONFIG.GAME_DURATION,
      running: false,
    };
    activeDemons = [];
    frenzyActive = false;
    freezeActive = false;

    const badge = document.getElementById("ss-diff-badge");
    if (badge)
      badge.innerHTML = DIFFICULTIES.map(
        (_, i) =>
          `<div class="bh-diff-pip${i <= currentDiff ? " active" : ""}"></div>`,
      ).join("");
    const nameEl = document.getElementById("ss-diff-name");
    if (nameEl) nameEl.textContent = DIFFICULTIES[currentDiff].name;

updateHUD();
    clearInterval(gameTimer);
    const gameStart = Date.now();
    gameTimer = setInterval(() => {
      state.timeLeft = Math.max(
        0,
        CONFIG.GAME_DURATION - (Date.now() - gameStart) / 1000,
      );
      const tEl = document.getElementById("ss-time");
      const fEl = document.getElementById("ss-timer-fill");
      if (tEl) tEl.textContent = Math.ceil(state.timeLeft);
      if (fEl)
        fEl.style.width = (state.timeLeft / CONFIG.GAME_DURATION) * 100 + "%";
      if (state.timeLeft <= 0) {
        clearInterval(gameTimer);
        clearInterval(spawnTimer);
        state.running = false;
        cancelAnimationFrame(rafId);
        setTimeout(() => endGame(), 500);
      }
    }, 80);

    clearInterval(spawnTimer);
    const spawnMs = Math.max(
      CONFIG.SPAWN_INTERVAL_MIN,
      Math.round(
        CONFIG.SPAWN_INTERVAL_BASE * DIFFICULTIES[currentDiff].spawnMult,
      ),
    );
    spawnTimer = setInterval(() => {
      if (state.running) spawnDemon(DIFFICULTIES[currentDiff]);
    }, spawnMs);

    const actuallyStart = () => {
      state.running = true;
      lastTs = null;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    };

    state.running = false;

    if (typeof MgCountdown !== "undefined") {
      MgCountdown.show(screen, 3, actuallyStart);
    } else {
      actuallyStart();
    }}
  

  function tick(ts) {
    if (!state || !state.running) return;
    const dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;

    for (let i = activeDemons.length - 1; i >= 0; i--) {
      const d = activeDemons[i];
      if (d.frozen) continue;
      d.x -= d.speed * dt;
      d.el.style.left = d.x + "px";

      if (d.x + CONFIG.DEMON_SIZE < 0) {
        d.el.remove();
        activeDemons.splice(i, 1);
        state.escapes++;
        state.combo = 1;
        updateHUD();
        if (state.escapes >= CONFIG.MAX_ESCAPES) {
          clearInterval(gameTimer);
          clearInterval(spawnTimer);
          state.running = false;
          cancelAnimationFrame(rafId);
          setTimeout(() => endGame(), 400);
          return;
        }
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function spawnDemon(diff) {
    const lane = Math.floor(Math.random() * CONFIG.LANES);
    const arenaH = arena.offsetHeight;
    const laneH = arenaH / CONFIG.LANES;
    const y = lane * laneH + (laneH - CONFIG.DEMON_SIZE) / 2;
    const arenaW = arena.offsetWidth;

    let type;
    const r = Math.random();
    if (r < CONFIG.POWERUP_CHANCE)
      type =
        "pu_" +
        Object.keys(CONFIG.POWERUP_TYPES)[Math.floor(Math.random() * 3)];
    else if (r < CONFIG.POWERUP_CHANCE + diff.bossChance) type = "brute";
    else if (r < CONFIG.POWERUP_CHANCE + diff.bossChance + diff.batChance)
      type = "bat";
    else {
      const base = ["imp", "armored", "ice"];
      type = base[Math.floor(Math.random() * base.length)];
    }

    const isPU = type.startsWith("pu_");
    const puKey = isPU ? type.replace("pu_", "") : null;
    const cfg = isPU ? CONFIG.POWERUP_TYPES[puKey] : CONFIG.DEMON_TYPES[type];
    const speedPx = isPU
      ? 70
      : Math.min(
          CONFIG.MARCH_SPEED_MAX,
          CONFIG.MARCH_SPEED_BASE * diff.speedMult * cfg.speed,
        );

    const el = document.createElement("div");
    el.className = "ss-demon" + (isPU ? " ss-powerup" : "");
    el.style.cssText = `top:${y}px;left:${arenaW}px;font-size:${isPU ? 40 : CONFIG.DEMON_SIZE * 0.7}px;width:${CONFIG.DEMON_SIZE}px;height:${CONFIG.DEMON_SIZE}px;--demon-color:${isPU ? "#22c55e" : cfg.color};`;

    if (!isPU && cfg.hp > 1) {
      el.innerHTML = `<span class="ss-demon-emoji">${cfg.emoji}</span><div class="ss-hp-bar"><div class="ss-hp-fill" style="width:100%"></div></div>`;
    } else {
      el.textContent = cfg.emoji;
    }

    arena.appendChild(el);
    const demon = {
      el,
      x: arenaW,
      speed: speedPx,
      type,
      hp: cfg.hp || 1,
      lane,
      frozen: false,
    };
    activeDemons.push(demon);

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      shootDemon(demon);
    });
    el.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        shootDemon(demon);
      },
      { passive: false },
    );
  }

  function onShoot(e) {
    if (!state || !state.running) return;
    const arenaRect = arena.getBoundingClientRect();
    const cx = e.clientX - arenaRect.left;
    const cy = e.clientY - arenaRect.top;
    let nearest = null,
      nearestDist = 80;
    activeDemons.forEach((d) => {
      const dr = d.el.getBoundingClientRect();
      const dist = Math.sqrt(
        Math.pow(dr.left + dr.width / 2 - arenaRect.left - cx, 2) +
          Math.pow(dr.top + dr.height / 2 - arenaRect.top - cy, 2),
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = d;
      }
    });
    if (nearest) shootDemon(nearest);
  }

  function shootDemon(demon) {
    if (!state || !state.running || demon.dead) return;
    const isPU = demon.type.startsWith("pu_");
    const puKey = isPU ? demon.type.replace("pu_", "") : null;

    if (isPU) {
      activatePowerup(puKey, demon);
      removeDemon(demon);
      return;
    }

    demon.hp--;
    if (demon.hp > 0) {
      demon.el.classList.add("ss-hit");
      setTimeout(() => demon.el.classList.remove("ss-hit"), 200);
      const fill = demon.el.querySelector(".ss-hp-fill");
      if (fill)
        fill.style.width =
          (demon.hp / CONFIG.DEMON_TYPES[demon.type].hp) * 100 + "%";
      return;
    }

    demon.dead = true;
    let pts = CONFIG.DEMON_TYPES[demon.type].points * state.combo;
    if (frenzyActive) pts *= CONFIG.FRENZY_MULTIPLIER;
    state.score += pts;
    state.combo = Math.min(state.combo + 1, 8);
    updateHUD();
    showShootFX(demon.el, `+${pts}`);
    removeDemon(demon);
  }

  function removeDemon(demon) {
    demon.el.classList.add("ss-die");
    setTimeout(() => demon.el.remove(), 350);
    activeDemons = activeDemons.filter((d) => d !== demon);
  }

  function activatePowerup(key, demon) {
    showShootFX(demon.el, CONFIG.POWERUP_TYPES[key].label);
    showPowerupLabel(
      CONFIG.POWERUP_TYPES[key].emoji + " " + CONFIG.POWERUP_TYPES[key].label,
    );

    if (key === "freeze") {
      activeDemons.forEach((d) => (d.frozen = true));
      clearTimeout(freezeTimeout);
      freezeActive = true;
      arena.classList.add("ss-frozen");
      freezeTimeout = setTimeout(() => {
        activeDemons.forEach((d) => (d.frozen = false));
        freezeActive = false;
        arena.classList.remove("ss-frozen");
        showPowerupLabel("");
      }, CONFIG.FREEZE_DURATION);
    } else if (key === "frenzy") {
      frenzyActive = true;
      arena.classList.add("ss-frenzy");
      clearTimeout(frenzyTimeout);
      frenzyTimeout = setTimeout(() => {
        frenzyActive = false;
        arena.classList.remove("ss-frenzy");
        showPowerupLabel("");
      }, CONFIG.FRENZY_DURATION);
    } else if (key === "nuke") {
      const toKill = [...activeDemons];
      toKill.forEach((d) => {
        if (!d.type.startsWith("pu_")) {
          const pts = (CONFIG.DEMON_TYPES[d.type]?.points || 1) * state.combo;
          state.score += pts;
          showShootFX(d.el, `+${pts}`);
          d.dead = true;
          d.el.classList.add("ss-die");
          setTimeout(() => d.el.remove(), 350);
        }
      });
      activeDemons = [];
      updateHUD();
    }
  }

  function showPowerupLabel(text) {
    const el = document.getElementById("ss-powerup-label");
    if (!el) return;
    el.style.visibility = text ? "visible" : "hidden";
    el.textContent = text;
  }

  function showShootFX(refEl, label) {
    const rect = refEl.getBoundingClientRect();
    const arenaRect = arena.getBoundingClientRect();
    const fx = document.createElement("div");
    fx.className = "bb-catch-fx";
    fx.textContent = label;
    fx.style.cssText = `left:${rect.left - arenaRect.left + rect.width / 2}px;top:${rect.top - arenaRect.top}px;color:#fbbf24;font-size:20px;`;
    arena.appendChild(fx);
    setTimeout(() => fx.remove(), 700);
  }

  function updateHUD() {
    const sc = document.getElementById("ss-score");
    const co = document.getElementById("ss-combo");
    const es = document.getElementById("ss-escapes");
    if (sc) sc.textContent = state.score;
    if (co) co.textContent = `x${state.combo}`;
    if (es) {
      const esc = Math.min(state.escapes, CONFIG.MAX_ESCAPES);
      es.textContent = "🔴".repeat(esc) + "⚪".repeat(CONFIG.MAX_ESCAPES - esc);
    }
  }

  function endGame() {
    clearInterval(gameTimer);
    clearInterval(spawnTimer);
    cancelAnimationFrame(rafId);
    clearTimeout(frenzyTimeout);
    clearTimeout(freezeTimeout);
    if (state) state.running = false;
    activeDemons.forEach((d) => d.el.remove());
    activeDemons = [];

    const diff = DIFFICULTIES[currentDiff];
    const reward = diff.reward;
    const won = state && state.score > 0;
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
      if (reward.looms && typeof Player !== "undefined") Player.addLooms(reward.looms);
      if (typeof UI !== "undefined") UI.updateCoinDisplays();
    }

    const container = document.getElementById("ss-container");
    const overlay = document.createElement("div");
    overlay.className = "bh-result";
    overlay.innerHTML = `
      <h2>${state && state.score >= 20 ? "🏆 Sharpshooter!" : won ? "⭐ Good Shot!" : "💀 Too Slow!"}</h2>
      <div class="bh-score-final">Score: ${state ? state.score : 0} pts</div>
      ${
        won
          ? `<div class="bh-seeds-earned">🌱 +${reward.seeds} seeds${plantName ? " → " + plantName : ""}</div>
             <div class="bh-seeds-earned" style="color:var(--gold,#fbbf24)">🪙 +${reward.coins} coins</div>
             ${reward.looms ? `<div class="bh-seeds-earned" style="color:#c084fc"><img src="assets/shop/loom.png" style="width:20px;height:20px;vertical-align:middle;margin-right:4px"> +${reward.looms} Looms</div>` : ""}`
          : ""
      }
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px">
        ${currentDiff < DIFFICULTIES.length - 1 ? `<button class="btn-primary" id="ss-harder" style="max-width:200px">Harder: ${DIFFICULTIES[currentDiff + 1].name} 🔥</button>` : ""}
        <button class="btn-primary"   id="ss-replay" style="max-width:200px">🔄 Replay</button>
        <button class="btn-secondary" id="ss-change" style="max-width:200px">📋 Change Diff</button>
        <button class="btn-secondary" id="ss-exit"   style="max-width:200px">🏠 Menu</button>
      </div>
    `;
    container.appendChild(overlay);

    const harderBtn = document.getElementById("ss-harder");
    if (harderBtn)
      harderBtn.addEventListener("click", () => {
        overlay.remove();
        startGame(currentDiff + 1);
      });
    document.getElementById("ss-replay").addEventListener("click", () => {
      overlay.remove();
      startGame(currentDiff);
    });
    document.getElementById("ss-change").addEventListener("click", () => {
      overlay.remove();
      showDifficultyPicker();
    });
    document.getElementById("ss-exit").addEventListener("click", () => {
      stopGame();
      if (!_devMode && typeof UI !== "undefined")
        UI.showScreen("screen-minigames");
    });
  }

  function stopGame() {
    clearInterval(gameTimer);
    clearInterval(spawnTimer);
    cancelAnimationFrame(rafId);
    clearTimeout(frenzyTimeout);
    clearTimeout(freezeTimeout);
    state = null;
    activeDemons = [];
    if (arena) arena.innerHTML = "";
    // Rebuild UI so re-entering the game works
    buildUI();
  }

  return { init, startGame: showDifficultyPicker, stop: stopGame, stopGame };
})();
