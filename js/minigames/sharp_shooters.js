/* js/minigames/sharp_shooters.js
   ── Sharp Shooters ────────────────────────────────
   Demons march across the screen from right to left.
   Tap/click them before they escape. Pure reflex game.
   Special demons give bonus points. Boss demons take 2 hits.
*/

const SharpShooters = (() => {

  // ── Config key-value pairs (easy to tune) ─────────
  const CONFIG = {
    LANES: 5,                        // horizontal rows
    DEMON_SIZE: 64,                  // px
    MARCH_SPEED_BASE: 90,            // px/s (easy)
    MARCH_SPEED_MAX: 280,            // px/s (insane)
    SPAWN_INTERVAL_BASE: 1100,       // ms between spawns (easy)
    SPAWN_INTERVAL_MIN: 300,         // ms floor (insane)
    GAME_DURATION: 30,               // seconds per game
    MAX_ESCAPES: 5,                  // misses before game over
    BOSS_HP: 2,                      // boss needs 2 taps
    POWERUP_CHANCE: 0.10,            // 10% chance spawn is a powerup
    FREEZE_DURATION: 2500,           // ms all demons freeze
    FRENZY_DURATION: 5000,           // ms multiplier active
    FRENZY_MULTIPLIER: 2,

    DEMON_TYPES: {
      imp:     { emoji: "👿", hp: 1, points: 1,  speed: 1.0,  color: "#ef4444" },
      armored: { emoji: "🤺", hp: 1, points: 2,  speed: 0.7,  color: "#94a3b8" },
      bat:     { emoji: "🦇", hp: 1, points: 2,  speed: 1.6,  color: "#a855f7" },
      ice:     { emoji: "🧊", hp: 1, points: 2,  speed: 0.85, color: "#38bdf8" },
      brute:   { emoji: "👹", hp: 2, points: 4,  speed: 0.55, color: "#f97316" }, // boss
    },
    POWERUP_TYPES: {
      freeze:  { emoji: "❄️",  label: "Freeze!", points: 0 },
      frenzy:  { emoji: "⚡",  label: "Frenzy!", points: 0 },
      nuke:    { emoji: "💥",  label: "NUKE!",   points: 0 },
    },
  };

  const DIFFICULTIES = [
    {
      name: "Easy",
      pips: 1,
      speedMult: 1.0,
      spawnMult: 1.0,
      bossChance: 0,
      batChance:  0,
      reward: { seeds: 1, coins: 6 },
    },
    {
      name: "Medium",
      pips: 2,
      speedMult: 1.35,
      spawnMult: 0.72,
      bossChance: 0.08,
      batChance:  0.12,
      reward: { seeds: 2, coins: 14 },
    },
    {
      name: "Hard",
      pips: 3,
      speedMult: 1.75,
      spawnMult: 0.52,
      bossChance: 0.15,
      batChance:  0.20,
      reward: { seeds: 4, coins: 26 },
    },
    {
      name: "Expert",
      pips: 4,
      speedMult: 2.2,
      spawnMult: 0.38,
      bossChance: 0.22,
      batChance:  0.28,
      reward: { seeds: 7, coins: 42 },
    },
    {
      name: "Insane",
      pips: 5,
      speedMult: 2.8,
      spawnMult: 0.27,
      bossChance: 0.30,
      batChance:  0.35,
      reward: { seeds: 11, coins: 65 },
    },
  ];

  let screen       = null;
  let arena        = null;
  let state        = null;
  let spawnTimer   = null;
  let gameTimer    = null;
  let rafId        = null;
  let lastTs       = null;
  let currentDiff  = 0;
  let activeDemons = [];   // { el, x, speed, type, hp, lane, frozen }
  let frenzyActive = false;
  let freezeActive = false;
  let frenzyTimeout = null;
  let freezeTimeout = null;

  // ── Init ───────────────────────────────────────────
  function init() {
    screen = document.getElementById("screen-sharpshooters");
    buildUI();
  }

  function buildUI() {
    screen.innerHTML = `
      <div class="ss-container" id="ss-container">

        <!-- Header -->
        <div class="bb-header">
          <button class="btn-back" id="ss-back">← Back</button>
          <h2>🎯 Sharp Shooters</h2>
          <div class="bh-stats">
            <div class="bh-stat">
              <span class="stat-val" id="ss-score">0</span>
              <span class="stat-lbl">Score</span>
            </div>
            <div class="bh-stat">
              <span class="stat-val" id="ss-combo">x1</span>
              <span class="stat-lbl">Combo</span>
            </div>
            <div class="bh-stat">
              <span class="stat-val" id="ss-time">${CONFIG.GAME_DURATION}</span>
              <span class="stat-lbl">Time</span>
            </div>
          </div>
        </div>

        <!-- Timer bar -->
        <div class="bh-timer-bar">
          <div class="bh-timer-fill" id="ss-timer-fill"
            style="background:linear-gradient(90deg,#ef4444,#f97316,#fbbf24)">
          </div>
        </div>

        <!-- Meta row -->
        <div class="bb-meta">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:var(--gray);letter-spacing:1px">DIFF</span>
            <div class="bh-diff-badge" id="ss-diff-badge"></div>
            <span id="ss-diff-name" style="font-family:var(--font-display);font-size:16px;color:var(--orange)"></span>
          </div>
          <!-- Escape counter -->
          <div id="ss-escapes" style="font-size:18px;letter-spacing:3px">🔴🔴🔴🔴🔴</div>
          <!-- Powerup label -->
          <div id="ss-powerup-label" class="bb-powerup-label" style="visibility:hidden">—</div>
        </div>

        <!-- Legend -->
        <div class="bb-legend">
          <span>👿 +1</span><span>🤺 +2</span><span>🦇 +2</span>
          <span>🧊 +2</span><span style="color:#f97316">👹 +4 (2hp)</span>
          <span>❄️ Freeze</span><span>⚡ Frenzy</span><span>💥 Nuke</span>
        </div>

        <!-- Shooting arena (relative, demons move inside) -->
        <div class="ss-arena" id="ss-arena">
          <!-- Lane dividers drawn by CSS -->
        </div>

        <!-- Aim cursor (follows mouse/touch) -->
        <div class="ss-cursor" id="ss-cursor">🎯</div>

      </div>
    `;

    arena = document.getElementById("ss-arena");

    document.getElementById("ss-back").addEventListener("click", () => {
      stopGame();
      UI.showScreen("screen-minigames");
    });

    // Shooting click
    arena.addEventListener("click", onShoot);
    arena.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.touches[0];
      onShoot({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });

    // Cursor follow
    screen.addEventListener("mousemove", (e) => {
      const cursor = document.getElementById("ss-cursor");
      if (cursor) {
        cursor.style.left = e.clientX + "px";
        cursor.style.top  = e.clientY + "px";
      }
    });
  }

  // ── Difficulty picker ──────────────────────────────
  function showDifficultyPicker() {
    const container = document.getElementById("ss-container");
    const picker = document.createElement("div");
    picker.className = "bh-result";
    picker.id = "ss-diff-picker";
    picker.innerHTML = `
      <h2 style="font-size:32px">🎯 Choose Difficulty</h2>
      ${DIFFICULTIES.map((d, i) => `
        <button class="btn-menu" data-diff="${i}" style="width:290px;text-align:center">
          ${"🔥".repeat(d.pips)} ${d.name}
          <span style="font-size:13px;color:var(--gold);display:block">
            Speed ×${d.speedMult} · Boss ${Math.round(d.bossChance * 100)}% · 🌱${d.reward.seeds} 🪙${d.reward.coins}
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
    currentDiff  = Math.min(diffIdx, DIFFICULTIES.length - 1);
    const diff   = DIFFICULTIES[currentDiff];

    state = {
      score:   0,
      combo:   1,
      escapes: 0,
      timeLeft: CONFIG.GAME_DURATION,
      running: false,
    };
    activeDemons = [];
    frenzyActive = false;
    freezeActive = false;

    // Diff pips
    const badge = document.getElementById("ss-diff-badge");
    if (badge) badge.innerHTML = DIFFICULTIES.map((_, i) =>
      `<div class="bh-diff-pip${i <= currentDiff ? " active" : ""}"></div>`
    ).join("");
    const nameEl = document.getElementById("ss-diff-name");
    if (nameEl) nameEl.textContent = diff.name;

    updateHUD();
    state.running = true;

    // Main countdown
    clearInterval(gameTimer);
    const gameStart = Date.now();
    gameTimer = setInterval(() => {
      state.timeLeft = Math.max(0, CONFIG.GAME_DURATION - (Date.now() - gameStart) / 1000);
      document.getElementById("ss-time").textContent = Math.ceil(state.timeLeft);
      document.getElementById("ss-timer-fill").style.width =
        (state.timeLeft / CONFIG.GAME_DURATION) * 100 + "%";

      if (state.timeLeft <= 0) {
        clearInterval(gameTimer);
        clearInterval(spawnTimer);
        state.running = false;
        cancelAnimationFrame(rafId);
        setTimeout(() => endGame(), 500);
      }
    }, 80);

    // Spawn demons
    clearInterval(spawnTimer);
    const spawnMs = Math.max(
      CONFIG.SPAWN_INTERVAL_MIN,
      Math.round(CONFIG.SPAWN_INTERVAL_BASE * diff.spawnMult)
    );
    spawnTimer = setInterval(() => {
      if (state.running) spawnDemon(diff);
    }, spawnMs);

    // Animation loop
    lastTs = null;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  // ── Animation tick ─────────────────────────────────
  function tick(ts) {
    if (!state || !state.running) return;
    const dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;

    const arenaW = arena.offsetWidth;

    for (let i = activeDemons.length - 1; i >= 0; i--) {
      const d = activeDemons[i];
      if (d.frozen) continue;

      d.x -= d.speed * dt;
      d.el.style.left = d.x + "px";

      // Escaped!
      if (d.x + CONFIG.DEMON_SIZE < 0) {
        d.el.remove();
        activeDemons.splice(i, 1);
        state.escapes++;
        state.combo = 1; // reset combo on escape
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

  // ── Spawn demon ────────────────────────────────────
  function spawnDemon(diff) {
    const lane  = Math.floor(Math.random() * CONFIG.LANES);
    const arenaH = arena.offsetHeight;
    const laneH  = arenaH / CONFIG.LANES;
    const y      = lane * laneH + (laneH - CONFIG.DEMON_SIZE) / 2;
    const arenaW = arena.offsetWidth;

    // Choose type
    let type;
    const r = Math.random();
    if (r < CONFIG.POWERUP_CHANCE) {
      const puKeys = Object.keys(CONFIG.POWERUP_TYPES);
      type = "pu_" + puKeys[Math.floor(Math.random() * puKeys.length)];
    } else if (r < CONFIG.POWERUP_CHANCE + diff.bossChance) {
      type = "brute";
    } else if (r < CONFIG.POWERUP_CHANCE + diff.bossChance + diff.batChance) {
      type = "bat";
    } else {
      const base = ["imp", "armored", "ice"];
      type = base[Math.floor(Math.random() * base.length)];
    }

    const isPU   = type.startsWith("pu_");
    const puKey  = isPU ? type.replace("pu_", "") : null;
    const cfg    = isPU ? CONFIG.POWERUP_TYPES[puKey] : CONFIG.DEMON_TYPES[type];

    const speedPx = isPU ? 70 : Math.min(
      CONFIG.MARCH_SPEED_MAX,
      CONFIG.MARCH_SPEED_BASE * DIFFICULTIES[currentDiff].speedMult * cfg.speed
    );

    const el = document.createElement("div");
    el.className = "ss-demon" + (isPU ? " ss-powerup" : "");
    el.textContent = cfg.emoji;
    el.style.cssText = `
      top:${y}px;
      left:${arenaW}px;
      font-size:${isPU ? 40 : CONFIG.DEMON_SIZE * 0.7}px;
      width:${CONFIG.DEMON_SIZE}px;
      height:${CONFIG.DEMON_SIZE}px;
      --demon-color:${isPU ? "#22c55e" : cfg.color};
    `;
    if (!isPU && cfg.hp > 1) {
      // HP bar for bosses
      el.innerHTML = `
        <span class="ss-demon-emoji">${cfg.emoji}</span>
        <div class="ss-hp-bar"><div class="ss-hp-fill" style="width:100%"></div></div>
      `;
    }

    arena.appendChild(el);

    const demon = { el, x: arenaW, speed: speedPx, type, hp: cfg.hp || 1, lane, frozen: false };
    activeDemons.push(demon);

    // Click to shoot
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      shootDemon(demon);
    });
    el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      shootDemon(demon);
    }, { passive: false });
  }

  // ── Shoot a demon ──────────────────────────────────
  function onShoot(e) {
    // Fallback: if user clicks arena background, find nearest demon in click area
    if (!state || !state.running) return;
    const arenaRect = arena.getBoundingClientRect();
    const cx = e.clientX - arenaRect.left;
    const cy = e.clientY - arenaRect.top;
    let nearest = null;
    let nearestDist = 80; // px threshold

    activeDemons.forEach(d => {
      const dRect = d.el.getBoundingClientRect();
      const dx = (dRect.left + dRect.width / 2) - arenaRect.left - cx;
      const dy = (dRect.top  + dRect.height / 2) - arenaRect.top  - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) { nearestDist = dist; nearest = d; }
    });

    if (nearest) shootDemon(nearest);
  }

  function shootDemon(demon) {
    if (!state || !state.running) return;
    if (demon.dead) return;

    const isPU  = demon.type.startsWith("pu_");
    const puKey = isPU ? demon.type.replace("pu_", "") : null;

    if (isPU) {
      activatePowerup(puKey, demon);
      removeDemon(demon);
      return;
    }

    demon.hp--;
    if (demon.hp > 0) {
      // Boss hit — flash & update HP bar
      demon.el.classList.add("ss-hit");
      setTimeout(() => demon.el.classList.remove("ss-hit"), 200);
      const fill = demon.el.querySelector(".ss-hp-fill");
      if (fill) fill.style.width = (demon.hp / CONFIG.DEMON_TYPES[demon.type].hp * 100) + "%";
      return;
    }

    // Killed
    demon.dead = true;
    const cfg = CONFIG.DEMON_TYPES[demon.type];
    let pts = cfg.points * state.combo;
    if (frenzyActive) pts *= CONFIG.FRENZY_MULTIPLIER;
    state.score += pts;
    state.combo  = Math.min(state.combo + 1, 8);
    updateHUD();

    // Kill FX
    showShootFX(demon.el, `+${pts}`);
    removeDemon(demon);
  }

  function removeDemon(demon) {
    demon.el.classList.add("ss-die");
    setTimeout(() => { demon.el.remove(); }, 350);
    activeDemons = activeDemons.filter(d => d !== demon);
  }

  // ── Powerups ───────────────────────────────────────
  function activatePowerup(key, demon) {
    showShootFX(demon.el, CONFIG.POWERUP_TYPES[key].label);
    showPowerupLabel(CONFIG.POWERUP_TYPES[key].emoji + " " + CONFIG.POWERUP_TYPES[key].label);

    if (key === "freeze") {
      activeDemons.forEach(d => d.frozen = true);
      clearTimeout(freezeTimeout);
      freezeActive = true;
      arena.classList.add("ss-frozen");
      freezeTimeout = setTimeout(() => {
        activeDemons.forEach(d => d.frozen = false);
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
      // Kill all visible demons for points
      const toKill = [...activeDemons];
      toKill.forEach(d => {
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
    const rect     = refEl.getBoundingClientRect();
    const arenaRect = arena.getBoundingClientRect();
    const fx = document.createElement("div");
    fx.className = "bb-catch-fx";
    fx.textContent = label;
    fx.style.cssText = `
      left:${rect.left - arenaRect.left + rect.width / 2}px;
      top:${rect.top  - arenaRect.top}px;
      color:#fbbf24;font-size:20px;
    `;
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
      const escaped = Math.min(state.escapes, CONFIG.MAX_ESCAPES);
      es.textContent =
        "🔴".repeat(escaped) + "⚪".repeat(CONFIG.MAX_ESCAPES - escaped);
    }
  }

  function endGame() {
    clearInterval(gameTimer);
    clearInterval(spawnTimer);
    cancelAnimationFrame(rafId);
    clearTimeout(frenzyTimeout);
    clearTimeout(freezeTimeout);
    if (state) state.running = false;
    activeDemons.forEach(d => d.el.remove());
    activeDemons = [];

    const diff   = DIFFICULTIES[currentDiff];
    const reward = diff.reward;
    const won    = state && state.score > 0;

    let plantName = "";
    if (won) {
      const seedReward = Seeds.giveRandomSeeds(reward.seeds);
      Player.addCoins(reward.coins);
      UI.updateCoinDisplays();
      plantName = seedReward ? PlantRegistry.get(seedReward.plantId)?.name || "" : "";
    }

    const container = document.getElementById("ss-container");
    const overlay   = document.createElement("div");
    overlay.className = "bh-result";
    overlay.innerHTML = `
      <h2>${state && state.score >= 20 ? "🏆 Sharpshooter!" : won ? "⭐ Good Shot!" : "💀 Too Slow!"}</h2>
      <div class="bh-score-final">Score: ${state ? state.score : 0} pts</div>
      ${won ? `
        <div class="bh-seeds-earned">🌱 +${reward.seeds} seeds → ${plantName}</div>
        <div class="bh-seeds-earned" style="color:var(--gold)">🪙 +${reward.coins} coins</div>
      ` : ""}
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px">
        ${currentDiff < DIFFICULTIES.length - 1 ? `
          <button class="btn-primary" id="ss-harder" style="max-width:200px">
            Harder: ${DIFFICULTIES[currentDiff + 1].name} 🔥
          </button>` : ""}
        <button class="btn-primary"   id="ss-replay"  style="max-width:200px">🔄 Replay</button>
        <button class="btn-secondary" id="ss-change"  style="max-width:200px">📋 Change Diff</button>
        <button class="btn-secondary" id="ss-exit"    style="max-width:200px">🏠 Menu</button>
      </div>
    `;
    container.appendChild(overlay);

    const harderBtn = document.getElementById("ss-harder");
    if (harderBtn) harderBtn.addEventListener("click", () => { overlay.remove(); startGame(currentDiff + 1); });
    document.getElementById("ss-replay").addEventListener("click", () => { overlay.remove(); startGame(currentDiff); });
    document.getElementById("ss-change").addEventListener("click", () => { overlay.remove(); showDifficultyPicker(); });
    document.getElementById("ss-exit").addEventListener("click",   () => { stopGame(); UI.showScreen("screen-minigames"); });
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
  }

  return { init, startGame: showDifficultyPicker, stopGame };
})();
