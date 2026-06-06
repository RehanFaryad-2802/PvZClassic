/* js/minigames/disc_of_doom.js
   Disc of Doom — Minigame 4
   Tap flying discs to redirect them into marching demons.
*/

const DiscOfDoom = (() => {

  // ── CONFIG (all tunable values) ──────────────────
  const CFG = {
    ROWS: 5,
    DURATION_MS: 60000,           // 60s game
    DISC_SPAWN_INTERVAL_START: 1400, // ms between disc spawns (start)
    DISC_SPAWN_INTERVAL_MIN: 600,    // minimum interval at max difficulty
    DEMON_SPAWN_INTERVAL_START: 3500, // ms between demon spawns
    DEMON_SPAWN_INTERVAL_MIN: 1500,
    DISC_SPEED_PX_S: 380,         // disc move speed px/s (right to left)
    DEMON_SPEED_PX_S: 60,         // demon walk speed px/s
    DEFLECTED_SPEED_PX_S: 680,    // speed after tap-deflection
    DISC_RADIUS: 30,              // px
    DEMON_WIDTH: 54,
    DEMON_HEIGHT: 54,
    LIVES: 3,
    SEEDS_PER_HIT: 2,
    SEEDS_PER_KILL: 5,
    COINS_PER_KILL: 3,
    SCORE_PER_HIT: 10,
    SCORE_PER_KILL: 25,
    SCORE_PER_MISS_PENALTY: -5,   // disc exits without hitting
    DIFFICULTY_RAMP_EVERY_MS: 8000, // every N ms, difficulty increases
    DISC_TYPES: [
      { id: "normal",  emoji: "💿", color: "#a78bfa", points: 1, speedMult: 1.0 },
      { id: "fire",    emoji: "🔥", color: "#f97316", points: 2, speedMult: 1.2 },
      { id: "ice",     emoji: "❄️",  color: "#38bdf8", points: 1, speedMult: 0.8, freeze: true },
      { id: "gold",    emoji: "⭐", color: "#fbbf24", points: 3, speedMult: 1.4 },
    ],
    DEMON_TYPES: [
      { id: "imp",     emoji: "😈", color: "#ef4444", hp: 1, reward: 1 },
      { id: "bat",     emoji: "🦇", color: "#8b5cf6", hp: 1, reward: 1 },
      { id: "armored", emoji: "🛡️",  color: "#6b7280", hp: 3, reward: 3, armor: true },
      { id: "brute",   emoji: "👹", color: "#dc2626", hp: 2, reward: 2 },
    ],
  };

  // ── State ─────────────────────────────────────────
  let running = false;
  let discs = [];
  let demons = [];
  let score = 0;
  let lives = CFG.LIVES;
  let seedsEarned = 0;
  let coinsEarned = 0;
  let timeLeft = CFG.DURATION_MS;
  let lastTimestamp = 0;
  let animId = null;
  let discSpawnTimer = 0;
  let demonSpawnTimer = 0;
  let difficultyLevel = 0;
  let difficultyTimer = 0;
  let nextDiscId = 0;
  let nextDemonId = 0;

  // DOM refs
  let arena = null;
  let timerFill = null;
  let scorEl = null;
  let livesEl = null;
  let seedsEl = null;

  // ── Difficulties ─────────────────────────────────
  const DIFFICULTIES = [
    {
      name: "Easy",    pips: 1,
      discSpeedMult: 0.7,  spawnMult: 1.0,  demonSpeedMult: 0.7,
      reward: { seeds: 1, coins: 5 },
    },
    {
      name: "Medium",  pips: 2,
      discSpeedMult: 0.9,  spawnMult: 0.82, demonSpeedMult: 0.9,
      reward: { seeds: 2, coins: 12 },
    },
    {
      name: "Hard",    pips: 3,
      discSpeedMult: 1.1,  spawnMult: 0.65, demonSpeedMult: 1.15,
      reward: { seeds: 4, coins: 22 },
    },
    {
      name: "Expert",  pips: 4,
      discSpeedMult: 1.35, spawnMult: 0.48, demonSpeedMult: 1.4,
      reward: { seeds: 7, coins: 38 },
    },
    {
      name: "Insane",  pips: 5,
      discSpeedMult: 1.65, spawnMult: 0.32, demonSpeedMult: 1.8,
      reward: { seeds: 11, coins: 58 },
    },
  ];

  let currentDiff = 0;

  // ── Init ──────────────────────────────────────────
  function startGame(diffIdx) {
    if (diffIdx === undefined) {
      // No diff given — show picker first
      const screen = document.getElementById("screen-discofdoom");
      if (screen) { buildUI(screen); showDifficultyPicker(screen); }
      return;
    }
    currentDiff = Math.min(diffIdx, DIFFICULTIES.length - 1);

    // Reset state
    running = false;
    discs = [];
    demons = [];
    score = 0;
    lives = CFG.LIVES;
    seedsEarned = 0;
    coinsEarned = 0;
    timeLeft = CFG.DURATION_MS;
    lastTimestamp = 0;
    discSpawnTimer = 0;
    demonSpawnTimer = 0;
    difficultyLevel = 0;
    difficultyTimer = 0;
    nextDiscId = 0;
    nextDemonId = 0;

    const screen = document.getElementById("screen-discofdoom");
    if (!screen) return;
    buildUI(screen);

    // Show diff badge
    const badge = screen.querySelector("#dod-diff-badge");
    if (badge) badge.innerHTML = DIFFICULTIES.map((_,i) =>
      `<div class="bh-diff-pip${i <= currentDiff ? " active" : ""}"></div>`
    ).join("");
    const nameEl = screen.querySelector("#dod-diff-name");
    if (nameEl) nameEl.textContent = DIFFICULTIES[currentDiff].name;

    showCountdown(screen, 3, () => {
      running = true;
      lastTimestamp = performance.now();
      animId = requestAnimationFrame(loop);
    });
  }

  // ── Build DOM ─────────────────────────────────────
  function buildUI(screen) {
    screen.innerHTML = `
      <div class="dod-container" id="dod-container">
        <div class="dod-header">
          <button class="btn-back" id="dod-back">↶</button>
          <h2>💿 DISC OF DOOM</h2>
          <div class="dod-stats">
            <div class="dod-stat"><span class="stat-val" id="dod-score">0</span><span class="stat-lbl">SCORE</span></div>
            <div class="dod-stat"><span class="stat-val" id="dod-seeds">0</span><span class="stat-lbl">SEEDS</span></div>
            <div class="dod-lives" id="dod-lives">❤️❤️❤️</div>
          </div>
        </div>
        <div class="dod-timer-bar"><div class="dod-timer-fill" id="dod-timer-fill"></div></div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="font-size:12px;color:var(--gray);letter-spacing:1px">DIFF</span>
          <div class="bh-diff-badge" id="dod-diff-badge"></div>
          <span id="dod-diff-name" style="font-family:var(--font-display);font-size:16px;color:#a78bfa"></span>
        </div>
        <div class="dod-arena" id="dod-arena"></div>
        <div class="dod-hint">Tap 💿 discs to deflect them into demons!</div>
      </div>
    `;

    document.getElementById("dod-back").addEventListener("click", () => {
      running = false;
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      discs.forEach(d => d.el && d.el.remove()); discs = [];
      demons.forEach(d => d.el && d.el.remove()); demons = [];
      if (typeof UI !== "undefined") UI.showScreen("screen-minigames");
    });

    arena     = screen.querySelector("#dod-arena");
    timerFill = screen.querySelector("#dod-timer-fill");
    scorEl    = screen.querySelector("#dod-score");
    livesEl   = screen.querySelector("#dod-lives");
    seedsEl   = screen.querySelector("#dod-seeds");

    // Touch/click on arena for disc tapping is handled per-element
  }

  // ── Countdown ────────────────────────────────────
  function showCountdown(screen, n, cb) {
    const el = document.createElement("div");
    el.className = "mg-countdown";
    el.textContent = n;
    screen.appendChild(el);
    let count = n;
    const tick = () => {
      count--;
      if (count <= 0) {
        el.remove();
        cb();
        return;
      }
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "";
      el.textContent = count;
      setTimeout(tick, 900);
    };
    setTimeout(tick, 900);
  }

  // ── Game Loop ─────────────────────────────────────
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(ts - lastTimestamp, 100); // cap dt at 100ms
    lastTimestamp = ts;

    timeLeft -= dt;
    difficultyTimer += dt;
    discSpawnTimer += dt;
    demonSpawnTimer += dt;

    // Difficulty ramp
    if (difficultyTimer >= CFG.DIFFICULTY_RAMP_EVERY_MS) {
      difficultyTimer = 0;
      difficultyLevel++;
    }

    const diff = DIFFICULTIES[currentDiff];

    // Spawn discs
    const discInterval = Math.max(
      CFG.DISC_SPAWN_INTERVAL_MIN,
      (CFG.DISC_SPAWN_INTERVAL_START - difficultyLevel * 120) * diff.spawnMult
    );
    if (discSpawnTimer >= discInterval) {
      discSpawnTimer = 0;
      spawnDisc();
    }

    // Spawn demons
    const demonInterval = Math.max(
      CFG.DEMON_SPAWN_INTERVAL_MIN,
      (CFG.DEMON_SPAWN_INTERVAL_START - difficultyLevel * 200) * diff.spawnMult
    );
    if (demonSpawnTimer >= demonInterval) {
      demonSpawnTimer = 0;
      spawnDemon();
    }

    updateDiscs(dt);
    updateDemons(dt);
    checkCollisions();
    render();
    updateHUD();

    if (timeLeft <= 0 || lives <= 0) {
      endGame();
      return;
    }

    animId = requestAnimationFrame(loop);
  }

  // ── Spawn ─────────────────────────────────────────
  function spawnDisc() {
    if (!arena) return;
    const arenaH = arena.clientHeight;
    const arenaW = arena.clientWidth;
    const rowH = arenaH / CFG.ROWS;

    const rand = Math.random();
    let type;
    if (rand < 0.05)      type = CFG.DISC_TYPES[3];
    else if (rand < 0.20) type = CFG.DISC_TYPES[2];
    else if (rand < 0.40) type = CFG.DISC_TYPES[1];
    else                  type = CFG.DISC_TYPES[0];

    const row = Math.floor(Math.random() * CFG.ROWS);
    const y = row * rowH + rowH / 2;
    const diff = DIFFICULTIES[currentDiff];

    discs.push({
      id: nextDiscId++,
      x: arenaW + CFG.DISC_RADIUS,
      y,
      row,
      type,
      deflected: false,
      dir: -1,
      speed: CFG.DISC_SPEED_PX_S * type.speedMult * diff.discSpeedMult,
      el: null,
      frozen: false,
    });
  }

  function spawnDemon() {
    if (!arena) return;
    const arenaH = arena.clientHeight;
    const arenaW = arena.clientWidth;
    const rowH = arenaH / CFG.ROWS;

    // Pick demon type based on difficulty
    let pool = [CFG.DEMON_TYPES[0], CFG.DEMON_TYPES[1]];
    if (difficultyLevel >= 2) pool.push(CFG.DEMON_TYPES[3]);
    if (difficultyLevel >= 4) pool.push(CFG.DEMON_TYPES[2]);
    const dType = pool[Math.floor(Math.random() * pool.length)];

    const row = Math.floor(Math.random() * CFG.ROWS);
    const rowH_ = arenaH / CFG.ROWS;
    const y = row * rowH_ + rowH_ / 2;

    const diff = DIFFICULTIES[currentDiff];
    demons.push({
      id: nextDemonId++,
      x: arenaW + CFG.DEMON_WIDTH / 2,
      y,
      row,
      type: dType,
      hp: dType.hp,
      maxHp: dType.hp,
      speed: CFG.DEMON_SPEED_PX_S * diff.demonSpeedMult,
      el: null,
      hit: false,
      dead: false,
      frozenUntil: 0,
    });
  }

  // ── Update ────────────────────────────────────────
  function updateDiscs(dt) {
    const dtS = dt / 1000;
    const arenaW = arena ? arena.clientWidth : 400;

    for (let i = discs.length - 1; i >= 0; i--) {
      const d = discs[i];
      if (d.frozen) continue;

      d.x += d.dir * d.speed * dtS;

      // Left exit: original discs that weren't deflected
      if (!d.deflected && d.x < -CFG.DISC_RADIUS * 2) {
        score = Math.max(0, score + CFG.SCORE_PER_MISS_PENALTY);
        removeDisc(i);
        continue;
      }
      // Right exit: deflected discs that missed everything
      if (d.deflected && d.x > arenaW + CFG.DISC_RADIUS * 2) {
        removeDisc(i);
        continue;
      }
    }
  }

  function updateDemons(dt) {
    const dtS = dt / 1000;
    const now = performance.now();

    for (let i = demons.length - 1; i >= 0; i--) {
      const d = demons[i];
      if (d.dead) { removeDemons(i); continue; }
      if (now < d.frozenUntil) continue; // frozen

      d.x -= d.speed * dtS;

      // Reached left side → lose a life
      if (d.x < -CFG.DEMON_WIDTH) {
        lives = Math.max(0, lives - 1);
        flashArena();
        removeDemons(i);
        continue;
      }
    }
  }

  function checkCollisions() {
    for (let di = discs.length - 1; di >= 0; di--) {
      const disc = discs[di];
      if (!disc.deflected) continue; // only deflected discs can hit demons

      for (let dmi = demons.length - 1; dmi >= 0; dmi--) {
        const demon = demons[dmi];
        if (demon.dead) continue;

        const dx = disc.x - demon.x;
        const dy = disc.y - demon.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CFG.DISC_RADIUS + CFG.DEMON_WIDTH / 2 - 8) {
          // Hit!
          demon.hp -= disc.type.points;
          score += CFG.SCORE_PER_HIT;
          seedsEarned += CFG.SEEDS_PER_HIT;
          showHitFX(disc.x, disc.y, disc.type.color);

          // Ice disc: freeze demon
          if (disc.type.freeze) {
            demon.frozenUntil = performance.now() + 2000;
            showHitFX(disc.x, disc.y, "#38bdf8", "❄️");
          }

          if (demon.hp <= 0) {
            demon.dead = true;
            score += CFG.SCORE_PER_KILL;
            seedsEarned += CFG.SEEDS_PER_KILL;
            coinsEarned += CFG.COINS_PER_KILL;
            showKillFX(demon.x, demon.y);
          }

          // Disc is consumed on hit
          removeDisc(di);
          break;
        }
      }
    }
  }

  function removeDisc(i) {
    const d = discs[i];
    if (d.el) d.el.remove();
    discs.splice(i, 1);
  }

  function removeDemons(i) {
    const d = demons[i];
    if (d.el) d.el.remove();
    demons.splice(i, 1);
  }

  // ── Render ───────────────────────────────────────
  function render() {
    if (!arena) return;

    // Discs
    discs.forEach((d) => {
      if (!d.el) {
        d.el = document.createElement("div");
        d.el.className = "dod-disc" + (d.deflected ? " deflected" : "");
        d.el.textContent = d.type.emoji;
        d.el.style.setProperty("--disc-color", d.type.color);
        d.el.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          deflectDisc(d);
        });
        arena.appendChild(d.el);
      }
      d.el.style.left = d.x - CFG.DISC_RADIUS + "px";
      d.el.style.top  = d.y - CFG.DISC_RADIUS + "px";
      if (d.deflected) d.el.classList.add("deflected");
    });

    // Demons
    demons.forEach((d) => {
      if (!d.el) {
        d.el = document.createElement("div");
        d.el.className = "dod-demon";
        d.el.style.setProperty("--demon-color", d.type.color);
        d.el.innerHTML = `
          <span class="dod-demon-emoji">${d.type.emoji}</span>
          ${d.maxHp > 1 ? `<div class="dod-hp-bar"><div class="dod-hp-fill" style="width:100%"></div></div>` : ""}
        `;
        arena.appendChild(d.el);
      }
      d.el.style.left = d.x - CFG.DEMON_WIDTH / 2 + "px";
      d.el.style.top  = d.y - CFG.DEMON_HEIGHT / 2 + "px";

      // HP bar
      if (d.maxHp > 1) {
        const fill = d.el.querySelector(".dod-hp-fill");
        if (fill) fill.style.width = (d.hp / d.maxHp * 100) + "%";
      }

      // Frozen tint
      const now = performance.now();
      d.el.classList.toggle("frozen", now < d.frozenUntil);
    });
  }

  function deflectDisc(d) {
    if (d.deflected) return;
    d.deflected = true;
    d.dir = 1;
    d.speed = CFG.DEFLECTED_SPEED_PX_S;
    if (d.el) {
      d.el.classList.add("deflected");
      d.el.style.animation = "none";
      void d.el.offsetWidth;
      d.el.style.animation = "";
    }
    // Show tap feedback
    showHitFX(d.x, d.y, d.type.color, "✦");
  }

  // ── FX ───────────────────────────────────────────
  function showHitFX(x, y, color, text = "💥") {
    if (!arena) return;
    const fx = document.createElement("div");
    fx.className = "dod-fx";
    fx.textContent = text;
    fx.style.left = x + "px";
    fx.style.top  = y + "px";
    fx.style.color = color;
    arena.appendChild(fx);
    setTimeout(() => fx.remove(), 700);
  }

  function showKillFX(x, y) {
    if (!arena) return;
    const fx = document.createElement("div");
    fx.className = "dod-fx dod-kill-fx";
    fx.textContent = "💀";
    fx.style.left = x + "px";
    fx.style.top  = y + "px";
    arena.appendChild(fx);
    setTimeout(() => fx.remove(), 700);
  }

  function flashArena() {
    if (!arena) return;
    arena.classList.add("dod-flash");
    setTimeout(() => arena.classList.remove("dod-flash"), 400);
  }

  // ── HUD ───────────────────────────────────────────
  function updateHUD() {
    if (scorEl) scorEl.textContent = score;
    if (seedsEl) seedsEl.textContent = seedsEarned;
    if (livesEl) livesEl.textContent = "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, CFG.LIVES - lives));
    if (timerFill) timerFill.style.width = (timeLeft / CFG.DURATION_MS * 100) + "%";
  }

  // ── Difficulty Picker ─────────────────────────────
  function showDifficultyPicker(screen) {
    const container = screen.querySelector("#dod-container");
    const picker = document.createElement("div");
    picker.className = "bh-result";
    picker.id = "dod-diff-picker";
    picker.innerHTML = `
      <button class="btn-back" style="align-self:flex-start;margin-bottom:8px" id="dod-pick-back">↶</button>
      <h2 style="font-size:32px">💿 Choose Difficulty</h2>
      ${DIFFICULTIES.map((d, i) => `
        <button class="btn-menu" data-diff="${i}" style="width:290px;text-align:center">
          ${"🔥".repeat(d.pips)} ${d.name}
          <span style="font-size:13px;color:var(--gold,#fbbf24);display:block">
            Speed ×${d.discSpeedMult} · 🌱${d.reward.seeds} 🪙${d.reward.coins}
          </span>
        </button>`).join("")}
    `;
    picker.querySelector("#dod-pick-back").addEventListener("click", () => {
      picker.remove();
      if (typeof UI !== "undefined") UI.showScreen("screen-minigames");
    });
    container.appendChild(picker);
    picker.querySelectorAll("[data-diff]").forEach(btn => {
      btn.addEventListener("click", () => {
        picker.remove();
        startGame(parseInt(btn.dataset.diff));
      });
    });
  }

  // ── End ───────────────────────────────────────────
  function endGame() {
    running = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }

    discs.forEach(d => d.el && d.el.remove());
    demons.forEach(d => d.el && d.el.remove());
    discs = []; demons = [];

    const diff = DIFFICULTIES[currentDiff];
    const reward = diff.reward;
    const won = score > 0;
    let plantName = "";

    if (won) {
      if (typeof Seeds !== "undefined") {
        const sr = Seeds.giveRandomSeeds(reward.seeds);
        plantName = sr
          ? typeof PlantRegistry !== "undefined"
            ? PlantRegistry.get(sr.plantId)?.name || "" : ""
          : "";
      }
      if (typeof Player !== "undefined") Player.addCoins(reward.coins);
      if (typeof UI !== "undefined") UI.updateCoinDisplays();
    }

    const screen = document.getElementById("screen-discofdoom");
    if (!screen) return;
    const container = screen.querySelector("#dod-container");

    const overlay = document.createElement("div");
    overlay.className = "bh-result";
    overlay.innerHTML = `
      <h2>${lives > 0 ? "🏆 Time's Up!" : "💀 Defeated!"}</h2>
      <div class="bh-score-final">Score: ${score} pts</div>
      ${won
        ? `<div class="bh-seeds-earned">🌱 +${reward.seeds} seeds${plantName ? " → " + plantName : ""}</div>
           <div class="bh-seeds-earned" style="color:var(--gold)">🪙 +${reward.coins} coins</div>`
        : ""}
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px">
        ${currentDiff < DIFFICULTIES.length - 1
          ? `<button class="btn-primary" id="dod-harder" style="max-width:200px">Harder: ${DIFFICULTIES[currentDiff + 1].name} 🔥</button>`
          : ""}
        <button class="btn-primary"   id="dod-replay" style="max-width:200px">🔄 Replay</button>
        <button class="btn-secondary" id="dod-change" style="max-width:200px">📋 Change Diff</button>
        <button class="btn-secondary" id="dod-exit"   style="max-width:200px">🏠 Menu</button>
      </div>
    `;
    container.appendChild(overlay);

    const harderBtn = overlay.querySelector("#dod-harder");
    if (harderBtn) harderBtn.addEventListener("click", () => { overlay.remove(); startGame(currentDiff + 1); });
    overlay.querySelector("#dod-replay").addEventListener("click", () => { overlay.remove(); startGame(currentDiff); });
    overlay.querySelector("#dod-change").addEventListener("click", () => {
      overlay.remove();
      buildUI(screen);
      showDifficultyPicker(screen);
    });
    overlay.querySelector("#dod-exit").addEventListener("click", () => {
      if (typeof UI !== "undefined") UI.showScreen("screen-minigames");
    });
  }

  return { startGame };
})();