/* js/minigames/disc_of_doom.js
   Disc of Doom — Minigame 4
   Discs fall from top into a left-side queue.
   Tap a queued disc to load it into the launcher.
   Tap the arena to aim and fire at marching demons.
*/

const DiscOfDoom = (() => {

  // ── CONFIG ───────────────────────────────────────
  const CFG = {
    ROWS: 5,
    DURATION_MS: 60000,
    DISC_FALL_INTERVAL_START: 1200, // ms between new discs falling into queue
    DISC_FALL_INTERVAL_MIN:   500,
    DEMON_SPAWN_INTERVAL_START: 3200,
    DEMON_SPAWN_INTERVAL_MIN:   1400,
    DEMON_SPEED_PX_S: 62,
    FIRED_SPEED_PX_S: 720,         // speed of a fired disc crossing the arena
    DISC_RADIUS: 26,
    DEMON_WIDTH: 52,
    DEMON_HEIGHT: 52,
    QUEUE_MAX: 5,                  // max discs sitting in the left queue
    LIVES: 3,
    SEEDS_PER_HIT:  2,
    SEEDS_PER_KILL: 5,
    COINS_PER_KILL: 3,
    SCORE_PER_HIT:  10,
    SCORE_PER_KILL: 25,
    DIFFICULTY_RAMP_EVERY_MS: 8000,
    DISC_TYPES: [
      { id: "normal", emoji: "💿", color: "#a78bfa", points: 1, speedMult: 1.0 },
      { id: "fire",   emoji: "🔥", color: "#f97316", points: 2, speedMult: 1.0 },
      { id: "ice",    emoji: "❄️",  color: "#38bdf8", points: 1, speedMult: 1.0, freeze: true },
      { id: "gold",   emoji: "⭐", color: "#fbbf24", points: 3, speedMult: 1.0 },
    ],
    DEMON_TYPES: [
      { id: "imp",     emoji: "😈", color: "#ef4444", hp: 1 },
      { id: "bat",     emoji: "🦇", color: "#8b5cf6", hp: 1 },
      { id: "armored", emoji: "🛡️",  color: "#6b7280", hp: 3 },
      { id: "brute",   emoji: "👹", color: "#dc2626", hp: 2 },
    ],
  };

  // ── Difficulties ─────────────────────────────────
  const DIFFICULTIES = [
    { name: "Easy",   pips: 1, fallMult: 1.0,  demonSpeedMult: 0.7,  spawnMult: 1.0,  reward: { seeds: 1,  coins: 5  } },
    { name: "Medium", pips: 2, fallMult: 0.85, demonSpeedMult: 0.9,  spawnMult: 0.82, reward: { seeds: 2,  coins: 12 } },
    { name: "Hard",   pips: 3, fallMult: 0.70, demonSpeedMult: 1.15, spawnMult: 0.65, reward: { seeds: 4,  coins: 22 } },
    { name: "Expert", pips: 4, fallMult: 0.55, demonSpeedMult: 1.4,  spawnMult: 0.48, reward: { seeds: 7,  coins: 38 } },
    { name: "Insane", pips: 5, fallMult: 0.38, demonSpeedMult: 1.8,  spawnMult: 0.32, reward: { seeds: 11, coins: 58 } },
  ];

  let currentDiff = 0;

  // ── State ─────────────────────────────────────────
  let running = false;
  let queue   = [];    // discs waiting in left panel
  let fired   = [];    // discs currently flying across arena
  let demons  = [];
  let loaded  = null;  // the disc currently loaded in launcher (ready to fire)
  let score = 0, lives = CFG.LIVES, seedsEarned = 0, coinsEarned = 0;
  let timeLeft = CFG.DURATION_MS, lastTs = 0, animId = null;
  let fallTimer = 0, demonTimer = 0, diffTimer = 0, diffLevel = 0;
  let nextDiscId = 0, nextDemonId = 0;

  // DOM refs
  let arenaEl = null, queueEl = null, launcherEl = null;
  let timerFill = null, scorEl = null, livesEl = null, seedsEl = null;

  // ── Entry point ───────────────────────────────────
  function startGame(diffIdx) {
    if (diffIdx === undefined) {
      const screen = document.getElementById("screen-discofdoom");
      if (screen) { buildUI(screen); showPicker(screen); }
      return;
    }
    currentDiff = Math.min(diffIdx, DIFFICULTIES.length - 1);

    // Reset
    running = false;
    queue = []; fired = []; demons = []; loaded = null;
    score = 0; lives = CFG.LIVES; seedsEarned = 0; coinsEarned = 0;
    timeLeft = CFG.DURATION_MS; lastTs = 0; animId = null;
    fallTimer = 0; demonTimer = 0; diffTimer = 0; diffLevel = 0;
    nextDiscId = 0; nextDemonId = 0;

    const screen = document.getElementById("screen-discofdoom");
    if (!screen) return;
    buildUI(screen);

    // Diff badge
    const badge = screen.querySelector("#dod-diff-badge");
    if (badge) badge.innerHTML = DIFFICULTIES.map((_,i) =>
      `<div class="bh-diff-pip${i <= currentDiff ? " active" : ""}"></div>`).join("");
    const nameEl = screen.querySelector("#dod-diff-name");
    if (nameEl) nameEl.textContent = DIFFICULTIES[currentDiff].name;

    showCountdown(screen, 3, () => {
      running = true;
      lastTs = performance.now();
      animId = requestAnimationFrame(loop);
    });
  }

  // ── UI ────────────────────────────────────────────
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

        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;padding:0 2px">
          <span style="font-size:11px;color:var(--gray);letter-spacing:1px">DIFF</span>
          <div class="bh-diff-badge" id="dod-diff-badge"></div>
          <span id="dod-diff-name" style="font-family:var(--font-display);font-size:14px;color:#a78bfa"></span>
        </div>

        <div class="dod-play-area">

          <!-- LEFT: disc queue (falls from top) -->
          <div class="dod-queue-panel" id="dod-queue-panel">
            <div class="dod-queue-label">QUEUE</div>
            <div class="dod-queue-slots" id="dod-queue-slots"></div>
            <!-- launcher slot at bottom of panel -->
            <div class="dod-launcher-wrap">
              <div class="dod-launcher-label">LOADED</div>
              <div class="dod-launcher-slot" id="dod-launcher-slot">
                <span class="dod-launcher-empty">tap↑</span>
              </div>
            </div>
          </div>

          <!-- RIGHT: arena where demons march -->
          <div class="dod-arena" id="dod-arena">
            <div class="dod-fire-hint" id="dod-fire-hint">Load a disc, then tap here to fire →</div>
          </div>

        </div>

        <div class="dod-hint">Tap a disc to load it · Tap the arena to fire at demons</div>
      </div>
    `;

    arenaEl    = screen.querySelector("#dod-arena");
    queueEl    = screen.querySelector("#dod-queue-slots");
    launcherEl = screen.querySelector("#dod-launcher-slot");
    timerFill  = screen.querySelector("#dod-timer-fill");
    scorEl     = screen.querySelector("#dod-score");
    livesEl    = screen.querySelector("#dod-lives");
    seedsEl    = screen.querySelector("#dod-seeds");

    // Back button
    screen.querySelector("#dod-back").addEventListener("click", () => {
      running = false;
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      if (typeof UI !== "undefined") UI.showScreen("screen-minigames");
    });

    // Fire: tap arena to shoot loaded disc toward that row
    arenaEl.addEventListener("pointerdown", (e) => {
      if (!loaded || !running) return;
      const rect = arenaEl.getBoundingClientRect();
      const tapY = e.clientY - rect.top;
      fireDisc(tapY);
    });
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
      if (count <= 0) { el.remove(); cb(); return; }
      el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
      el.textContent = count;
      setTimeout(tick, 900);
    };
    setTimeout(tick, 900);
  }

  // ── Game Loop ─────────────────────────────────────
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(ts - lastTs, 100);
    lastTs = ts;

    timeLeft -= dt;
    diffTimer += dt;
    fallTimer += dt;
    demonTimer += dt;

    if (diffTimer >= CFG.DIFFICULTY_RAMP_EVERY_MS) { diffTimer = 0; diffLevel++; }

    const diff = DIFFICULTIES[currentDiff];

    // Spawn disc into queue
    const fallInterval = Math.max(
      CFG.DISC_FALL_INTERVAL_MIN,
      (CFG.DISC_FALL_INTERVAL_START - diffLevel * 100) * diff.fallMult
    );
    if (fallTimer >= fallInterval && queue.length < CFG.QUEUE_MAX) {
      fallTimer = 0;
      addDiscToQueue();
    }

    // Spawn demon
    const demonInterval = Math.max(
      CFG.DEMON_SPAWN_INTERVAL_MIN,
      (CFG.DEMON_SPAWN_INTERVAL_START - diffLevel * 180) * diff.spawnMult
    );
    if (demonTimer >= demonInterval) { demonTimer = 0; spawnDemon(); }

    updateFired(dt);
    updateDemons(dt);
    checkCollisions();
    updateHUD();

    if (timeLeft <= 0 || lives <= 0) { endGame(); return; }
    animId = requestAnimationFrame(loop);
  }

  // ── Queue ─────────────────────────────────────────
  function addDiscToQueue() {
    const rand = Math.random();
    let type;
    if      (rand < 0.05) type = CFG.DISC_TYPES[3]; // gold
    else if (rand < 0.20) type = CFG.DISC_TYPES[2]; // ice
    else if (rand < 0.40) type = CFG.DISC_TYPES[1]; // fire
    else                  type = CFG.DISC_TYPES[0]; // normal

    const disc = { id: nextDiscId++, type };
    queue.push(disc);
    renderQueue();
  }

  function renderQueue() {
    if (!queueEl) return;
    queueEl.innerHTML = "";
    queue.forEach((disc, idx) => {
      const el = document.createElement("div");
      el.className = "dod-queue-disc";
      el.textContent = disc.type.emoji;
      el.style.setProperty("--disc-color", disc.type.color);
      el.style.animationDelay = (idx * 0.05) + "s";
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        loadDisc(disc, idx);
      });
      queueEl.appendChild(el);
    });
  }

  function loadDisc(disc, idx) {
    if (!running) return;
    // Put previously loaded disc back into queue front if there was one
    if (loaded) queue.unshift(loaded);
    queue.splice(loaded ? idx + 1 : idx, 1);
    loaded = disc;
    renderQueue();
    renderLauncher();
  }

  function renderLauncher() {
    if (!launcherEl) return;
    if (loaded) {
      launcherEl.innerHTML = `
        <div class="dod-launcher-disc" style="--disc-color:${loaded.type.color}">
          ${loaded.type.emoji}
        </div>
        <div class="dod-launcher-name">${loaded.type.id}</div>
      `;
    } else {
      launcherEl.innerHTML = `<span class="dod-launcher-empty">tap↑</span>`;
    }
    // Flash hint
    const hint = document.getElementById("dod-fire-hint");
    if (hint) hint.style.display = loaded ? "none" : "block";
  }

  // ── Fire ──────────────────────────────────────────
  function fireDisc(tapY) {
    if (!loaded || !arenaEl) return;
    const arenaH = arenaEl.clientHeight;

    // Clamp y to arena bounds
    const y = Math.max(CFG.DISC_RADIUS, Math.min(arenaH - CFG.DISC_RADIUS, tapY));

    fired.push({
      id: nextDiscId++,
      type: loaded.type,
      x: CFG.DISC_RADIUS,   // start at left edge of arena
      y,
      speed: CFG.FIRED_SPEED_PX_S,
      el: null,
    });

    loaded = null;
    renderLauncher();

    // Render the new fired disc immediately
    renderFired();
  }

  // ── Update fired discs ────────────────────────────
  function updateFired(dt) {
    if (!arenaEl) return;
    const dtS = dt / 1000;
    const arenaW = arenaEl.clientWidth;

    for (let i = fired.length - 1; i >= 0; i--) {
      const d = fired[i];
      d.x += d.speed * dtS;
      if (d.x > arenaW + CFG.DISC_RADIUS * 2) {
        if (d.el) d.el.remove();
        fired.splice(i, 1);
      }
    }
  }

  function renderFired() {
    if (!arenaEl) return;
    fired.forEach(d => {
      if (!d.el) {
        d.el = document.createElement("div");
        d.el.className = "dod-fired-disc";
        d.el.textContent = d.type.emoji;
        d.el.style.setProperty("--disc-color", d.type.color);
        arenaEl.appendChild(d.el);
      }
      d.el.style.left = d.x - CFG.DISC_RADIUS + "px";
      d.el.style.top  = d.y - CFG.DISC_RADIUS + "px";
    });
  }

  // ── Demons ────────────────────────────────────────
  function spawnDemon() {
    if (!arenaEl) return;
    const arenaH = arenaEl.clientHeight;
    const arenaW = arenaEl.clientWidth;
    const rowH   = arenaH / CFG.ROWS;

    let pool = [CFG.DEMON_TYPES[0], CFG.DEMON_TYPES[1]];
    if (diffLevel >= 2) pool.push(CFG.DEMON_TYPES[3]);
    if (diffLevel >= 4) pool.push(CFG.DEMON_TYPES[2]);
    const dType = pool[Math.floor(Math.random() * pool.length)];
    const row   = Math.floor(Math.random() * CFG.ROWS);
    const y     = row * rowH + rowH / 2;
    const diff  = DIFFICULTIES[currentDiff];

    demons.push({
      id: nextDemonId++,
      x: arenaW + CFG.DEMON_WIDTH / 2,
      y, row,
      type: dType,
      hp: dType.hp, maxHp: dType.hp,
      speed: CFG.DEMON_SPEED_PX_S * diff.demonSpeedMult,
      frozenUntil: 0,
      dead: false,
      el: null,
    });
  }

  function updateDemons(dt) {
    const dtS = dt / 1000;
    const now = performance.now();

    for (let i = demons.length - 1; i >= 0; i--) {
      const d = demons[i];
      if (d.dead) { if (d.el) d.el.remove(); demons.splice(i, 1); continue; }
      if (now < d.frozenUntil) continue;
      d.x -= d.speed * dtS;

      if (!arenaEl) continue;
      if (d.x < -CFG.DEMON_WIDTH) {
        lives = Math.max(0, lives - 1);
        flashArena();
        if (d.el) d.el.remove();
        demons.splice(i, 1);
        continue;
      }

      // Render
      if (!d.el) {
        d.el = document.createElement("div");
        d.el.className = "dod-demon";
        d.el.style.setProperty("--demon-color", d.type.color);
        d.el.innerHTML = `
          <span class="dod-demon-emoji">${d.type.emoji}</span>
          ${d.maxHp > 1 ? `<div class="dod-hp-bar"><div class="dod-hp-fill"></div></div>` : ""}
        `;
        arenaEl.appendChild(d.el);
      }
      d.el.style.left = d.x - CFG.DEMON_WIDTH / 2 + "px";
      d.el.style.top  = d.y - CFG.DEMON_HEIGHT / 2 + "px";
      if (d.maxHp > 1) {
        const fill = d.el.querySelector(".dod-hp-fill");
        if (fill) fill.style.width = (d.hp / d.maxHp * 100) + "%";
      }
      d.el.classList.toggle("frozen", now < d.frozenUntil);
    }
  }

  // ── Collisions ────────────────────────────────────
  function checkCollisions() {
    for (let fi = fired.length - 1; fi >= 0; fi--) {
      const disc = fired[fi];
      for (let di = demons.length - 1; di >= 0; di--) {
        const demon = demons[di];
        if (demon.dead) continue;
        const dx = disc.x - demon.x;
        const dy = disc.y - demon.y;
        if (Math.sqrt(dx*dx + dy*dy) < CFG.DISC_RADIUS + CFG.DEMON_WIDTH / 2 - 8) {
          demon.hp -= disc.type.points;
          score += CFG.SCORE_PER_HIT;
          seedsEarned += CFG.SEEDS_PER_HIT;
          showFX(disc.x, disc.y, disc.type.color, "💥");

          if (disc.type.freeze) {
            demon.frozenUntil = performance.now() + 2000;
            showFX(disc.x, disc.y, "#38bdf8", "❄️");
          }
          if (demon.hp <= 0) {
            demon.dead = true;
            score += CFG.SCORE_PER_KILL;
            seedsEarned += CFG.SEEDS_PER_KILL;
            coinsEarned += CFG.COINS_PER_KILL;
            showFX(demon.x, demon.y, "#fbbf24", "💀");
          }
          if (disc.el) disc.el.remove();
          fired.splice(fi, 1);
          break;
        }
      }
    }
    // Also render fired positions each frame
    renderFired();
  }

  // ── FX ───────────────────────────────────────────
  function showFX(x, y, color, text) {
    if (!arenaEl) return;
    const fx = document.createElement("div");
    fx.className = "dod-fx";
    fx.textContent = text;
    fx.style.cssText = `left:${x}px;top:${y}px;color:${color}`;
    arenaEl.appendChild(fx);
    setTimeout(() => fx.remove(), 700);
  }

  function flashArena() {
    if (!arenaEl) return;
    arenaEl.classList.add("dod-flash");
    setTimeout(() => arenaEl.classList.remove("dod-flash"), 400);
  }

  // ── HUD ──────────────────────────────────────────
  function updateHUD() {
    if (scorEl)    scorEl.textContent  = score;
    if (seedsEl)   seedsEl.textContent = seedsEarned;
    if (livesEl)   livesEl.textContent = "❤️".repeat(Math.max(0,lives)) + "🖤".repeat(Math.max(0,CFG.LIVES-lives));
    if (timerFill) timerFill.style.width = (timeLeft / CFG.DURATION_MS * 100) + "%";
  }

  // ── Difficulty Picker ─────────────────────────────
  function showPicker(screen) {
    const container = screen.querySelector("#dod-container");
    const picker = document.createElement("div");
    picker.className = "bh-result";
    picker.innerHTML = `
      <button class="btn-back" style="align-self:flex-start;margin-bottom:8px" id="dod-pick-back">↶</button>
      <h2 style="font-size:30px">💿 Choose Difficulty</h2>
      ${DIFFICULTIES.map((d,i) => `
        <button class="btn-menu" data-diff="${i}" style="width:min(300px,88vw);text-align:left">
          ${"🔥".repeat(d.pips)} ${d.name}
          <span style="font-size:12px;color:rgba(255,255,255,0.45);display:block;margin-top:3px">
            Speed ×${d.demonSpeedMult} · 🌱${d.reward.seeds} 🪙${d.reward.coins}
          </span>
        </button>`).join("")}
    `;
    picker.querySelector("#dod-pick-back").addEventListener("click", () => {
      picker.remove();
      if (typeof UI !== "undefined") UI.showScreen("screen-minigames");
    });
    picker.querySelectorAll("[data-diff]").forEach(btn =>
      btn.addEventListener("click", () => { picker.remove(); startGame(parseInt(btn.dataset.diff)); })
    );
    container.appendChild(picker);
  }

  // ── End Game ─────────────────────────────────────
  function endGame() {
    running = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    fired.forEach(d => d.el && d.el.remove());
    demons.forEach(d => d.el && d.el.remove());
    fired = []; demons = [];

    const diff = DIFFICULTIES[currentDiff];
    const reward = diff.reward;
    const won = score > 0;
    let plantName = "";

    if (won) {
      if (typeof Seeds !== "undefined") {
        const sr = Seeds.giveRandomSeeds(reward.seeds);
        plantName = sr ? (typeof PlantRegistry !== "undefined" ? PlantRegistry.get(sr.plantId)?.name || "" : "") : "";
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
      ${won ? `
        <div class="bh-seeds-earned">🌱 +${reward.seeds} seeds${plantName ? " → " + plantName : ""}</div>
        <div class="bh-seeds-earned" style="color:var(--gold)">🪙 +${reward.coins} coins</div>` : ""}
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px">
        ${currentDiff < DIFFICULTIES.length-1
          ? `<button class="btn-primary" id="dod-harder" style="max-width:200px">Harder: ${DIFFICULTIES[currentDiff+1].name} 🔥</button>` : ""}
        <button class="btn-primary"   id="dod-replay" style="max-width:200px">🔄 Replay</button>
        <button class="btn-secondary" id="dod-change" style="max-width:200px">📋 Change Diff</button>
        <button class="btn-secondary" id="dod-exit"   style="max-width:200px">🏠 Menu</button>
      </div>
    `;
    container.appendChild(overlay);

    const hb = overlay.querySelector("#dod-harder");
    if (hb) hb.addEventListener("click", () => { overlay.remove(); startGame(currentDiff + 1); });
    overlay.querySelector("#dod-replay").addEventListener("click", () => { overlay.remove(); startGame(currentDiff); });
    overlay.querySelector("#dod-change").addEventListener("click", () => { overlay.remove(); startGame(); });
    overlay.querySelector("#dod-exit").addEventListener("click", () => {
      if (typeof UI !== "undefined") UI.showScreen("screen-minigames");
    });
  }

  return { startGame };
})();