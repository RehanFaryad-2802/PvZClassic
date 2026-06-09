/* js/minigames/disc_of_doom.js
   Disc of Doom — Minigame 4
   Queue = left conveyor belt rail.
   Fire zone = left strip of arena only.
   Cooldown between shots.
*/

const DiscOfDoom = (() => {

  // ══════════════════════════════════════════════════
  //  CONFIG
  // ══════════════════════════════════════════════════
  const CFG = {
    ROWS: 5,
    DURATION_MS: 60000,

    // Rail / queue
    QUEUE_MAX: 5,
    SLOT_H: 62,                      // px per slot (item size + gap)
    DISC_FALL_INTERVAL_START: 1300,
    DISC_FALL_INTERVAL_MIN:   480,

    // Conveyor animation
    BELT_SLIDE_MS: 260,              // ms to slide all items down one slot

    // Cooldown after firing (ms)
    FIRE_COOLDOWN_MS: 600,

    // Fire zone: fraction of arena width player can click to fire
    FIRE_ZONE_FRAC: 0.18,            // left 18% of arena

    // Fired disc
    FIRED_SPEED_PX_S: 740,
    DISC_RADIUS: 26,

    // Demons
    DEMON_SPEED_PX_S:         60,
    DEMON_SPAWN_INTERVAL_START: 3200,
    DEMON_SPAWN_INTERVAL_MIN:   1300,
    DEMON_WIDTH:  54,
    DEMON_HEIGHT: 54,
    DEMON_HP: { imp:3, bat:3, brute:6, armored:10 },

    // Scoring
    LIVES: 3,
    SEEDS_PER_HIT:  2,
    SEEDS_PER_KILL: 5,
    COINS_PER_KILL: 3,
    SCORE_PER_HIT:  10,
    SCORE_PER_KILL: 25,

    DIFFICULTY_RAMP_EVERY_MS: 8000,

    DISC_TYPES: [
      { id:"normal", emoji:"💿", color:"#a78bfa", direct_dmg:0.30, burn_dps:0,    burn_dur:0, freeze:false, freeze_dur:0, star:false },
      { id:"fire",   emoji:"🔥", color:"#f97316", direct_dmg:0.25, burn_dps:0.06, burn_dur:5, freeze:false, freeze_dur:0, star:false },
     { id:"ice",    emoji:"❄️",  color:"#38bdf8", direct_dmg:0,    burn_dps:0,    burn_dur:0, freeze:true,  freeze_dur:2.5, star:false },
      { id:"star",   emoji:"⭐", color:"#fbbf24", direct_dmg:0,    burn_dps:0,    burn_dur:0, freeze:false, freeze_dur:0, star:true  },
    ],

    STAR_POWER: {
      dmg_pct:   0.55,
      freeze_dur: 1.5,
      fx_duration: 800,
    },

    DEMON_TYPES: [
      { id:"imp",     emoji:"😈", color:"#ef4444" },
      { id:"bat",     emoji:"🦇", color:"#8b5cf6" },
      { id:"brute",   emoji:"👹", color:"#dc2626" },
      { id:"armored", emoji:"🛡️",  color:"#6b7280" },
    ],
  };

  // ══════════════════════════════════════════════════
  //  DIFFICULTIES
  // ══════════════════════════════════════════════════
  const DIFFICULTIES = [
    { name:"Easy",   pips:1, fallMult:1.00, demonSpeedMult:0.70, hpMult:0.7, spawnMult:1.00, reward:{seeds:1,  coins:5  }},
    { name:"Medium", pips:2, fallMult:0.85, demonSpeedMult:0.90, hpMult:1.0, spawnMult:0.82, reward:{seeds:2,  coins:12 }},
    { name:"Hard",   pips:3, fallMult:0.70, demonSpeedMult:1.15, hpMult:1.4, spawnMult:0.65, reward:{seeds:4,  coins:22 }},
    { name:"Expert", pips:4, fallMult:0.55, demonSpeedMult:1.40, hpMult:1.9, spawnMult:0.48, reward:{seeds:7,  coins:38 }},
    { name:"Insane", pips:5, fallMult:0.38, demonSpeedMult:1.80, hpMult:2.6, spawnMult:0.32, reward:{seeds:11, coins:58 }},
  ];

  let currentDiff = 0;

  // ══════════════════════════════════════════════════
  //  STATE
  // ══════════════════════════════════════════════════
  let running     = false;
  let queue       = [];   // { id, type }  index 0 = top of belt
  let loaded      = null; // disc in fire slot
  let fired       = [];   // flying discs in arena
  let demons      = [];
  let score = 0, lives = CFG.LIVES, seedsEarned = 0, coinsEarned = 0;
  let timeLeft = CFG.DURATION_MS, lastTs = 0, animId = null;
  let fallTimer = 0, demonTimer = 0, diffTimer = 0, diffLevel = 0;
  let nextId = 0;

  // Cooldown
  let cooldownUntil = 0;            // performance.now() timestamp
  let cooldownTimerId = null;

  // Belt animation state
  let beltSliding   = false;        // true while CSS transition is running
  let beltSlideStart= 0;            // performance.now() when slide began
  let beltOffsetPx  = 0;            // current extra Y offset during slide (0→SLOT_H)

  // DOM refs
  let arenaEl = null, railTrackEl = null, loadedSlotEl = null, fireZoneEl = null;
  let cooldownBarEl = null;
  let timerFill = null, scorEl = null, livesEl = null, seedsEl = null;

  // ══════════════════════════════════════════════════
  //  ENTRY
  // ══════════════════════════════════════════════════
  function startGame(diffIdx) {
    if (diffIdx === undefined) {
      const scr = document.getElementById("screen-discofdoom");
      if (scr) { buildUI(scr); showPicker(scr); }
      return;
    }
    currentDiff = Math.min(diffIdx, DIFFICULTIES.length - 1);

    running = false;
    queue = []; loaded = null; fired = []; demons = [];
    score = 0; lives = CFG.LIVES; seedsEarned = 0; coinsEarned = 0;
    timeLeft = CFG.DURATION_MS; lastTs = 0; animId = null;
    fallTimer = 0; demonTimer = 0; diffTimer = 0; diffLevel = 0;
    nextId = 0;
    cooldownUntil = 0; cooldownTimerId = null;
    beltSliding = false; beltSlideStart = 0; beltOffsetPx = 0;

    const scr = document.getElementById("screen-discofdoom");
    if (!scr) return;
    buildUI(scr);

    scr.querySelector("#dod-diff-badge").innerHTML =
      DIFFICULTIES.map((_,i) =>
        `<div class="bh-diff-pip${i<=currentDiff?" active":""}"></div>`).join("");
    scr.querySelector("#dod-diff-name").textContent = DIFFICULTIES[currentDiff].name;

    // Pre-fill queue + auto-load
    for (let i = 0; i < CFG.QUEUE_MAX; i++) pushToQueue(true);
    autoLoad(true);
    renderRail(false);
    renderLoaded();

    const startLoop = () => {
      running = true;
      lastTs = performance.now();
      animId = requestAnimationFrame(loop);
    };
    if (typeof MgCountdown !== "undefined") {
      MgCountdown.show(scr, 3, startLoop);
    } else {
      showCountdown(scr, 3, startLoop);
    }
  }

  // ══════════════════════════════════════════════════
  //  BUILD UI
  // ══════════════════════════════════════════════════
  function buildUI(scr) {
    scr.innerHTML = `
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

          <!-- LEFT: conveyor rail + loaded slot -->
          <div class="dod-rail-panel">
            <div class="dod-rail-label">QUEUE</div>
            <div class="dod-rail-track" id="dod-rail-track"></div>
            <div class="dod-rail-sep"></div>
            <div class="dod-rail-label">LOADED</div>
            <div class="dod-loaded-slot" id="dod-loaded-slot">
              <span class="dod-loaded-empty">—</span>
            </div>
            <div class="dod-cooldown-bar-wrap">
              <div class="dod-cooldown-bar" id="dod-cooldown-bar"></div>
            </div>
          </div>

          <!-- RIGHT: arena with fire-zone overlay on the left -->
          <div class="dod-arena" id="dod-arena">
            <!-- Fire zone: clickable left strip -->
            <div class="dod-fire-zone" id="dod-fire-zone">
              <div class="dod-fire-zone-label">FIRE<br>ZONE</div>
            </div>
          </div>

        </div>

        <div class="dod-hint">Tap FIRE ZONE to shoot · Tap queue item to reorder</div>
      </div>
    `;

    arenaEl      = scr.querySelector("#dod-arena");
    railTrackEl  = scr.querySelector("#dod-rail-track");
    loadedSlotEl = scr.querySelector("#dod-loaded-slot");
    fireZoneEl   = scr.querySelector("#dod-fire-zone");
    cooldownBarEl= scr.querySelector("#dod-cooldown-bar");
    timerFill    = scr.querySelector("#dod-timer-fill");
    scorEl       = scr.querySelector("#dod-score");
    livesEl      = scr.querySelector("#dod-lives");
    seedsEl      = scr.querySelector("#dod-seeds");

    scr.querySelector("#dod-back").addEventListener("click", () => {
      running = false;
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      if (typeof UI !== "undefined") UI.showScreen("screen-minigames");
    });

// ── FIRE ZONE click (ONLY valid fire area) ──────
    fireZoneEl.addEventListener("pointerdown", e => {
      e.stopPropagation();
      if (!loaded || !running) return;
      const now = performance.now();
      if (now < cooldownUntil) return;
      if (beltSliding) return;
      const rect = arenaEl.getBoundingClientRect();
      const tapY = e.clientY - rect.top;
      triggerFire(tapY);
    });

    // ── Loaded slot tap = fire at mid-arena height ──
    // (tap the loaded slot itself to fire at center row)
    loadedSlotEl.addEventListener("pointerdown", e => {
      e.stopPropagation();
      if (!loaded || !running) return;
      const now = performance.now();
      if (now < cooldownUntil) return;
      if (beltSliding) return;
      // Fire at vertical center of arena
      const arenaH = arenaEl ? arenaEl.clientHeight : 300;
      triggerFire(arenaH / 2);
    });

    // ── Block all other arena taps ──────────────────
    arenaEl.addEventListener("pointerdown", e => {
      // Only the fire zone (child element) should fire.
      // Clicks that bubble up to arena from outside fire zone are ignored.
      e.stopPropagation();
    });
  }

  // ══════════════════════════════════════════════════
  //  COUNTDOWN
  // ══════════════════════════════════════════════════
  function showCountdown(scr, n, cb) {
    const el = document.createElement("div");
    el.className = "mg-countdown";
    el.textContent = n;
    scr.appendChild(el);
    let c = n;
    const tick = () => {
      c--;
      if (c <= 0) { el.remove(); cb(); return; }
      el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
      el.textContent = c;
      setTimeout(tick, 900);
    };
    setTimeout(tick, 900);
  }

  // ══════════════════════════════════════════════════
  //  GAME LOOP
  // ══════════════════════════════════════════════════
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(ts - lastTs, 100);
    lastTs = ts;

    timeLeft  -= dt;
    diffTimer += dt;
    fallTimer += dt;
    demonTimer+= dt;

    if (diffTimer >= CFG.DIFFICULTY_RAMP_EVERY_MS) { diffTimer = 0; diffLevel++; }

    const diff = DIFFICULTIES[currentDiff];

    // Spawn disc into queue
    const fallInterval = Math.max(
      CFG.DISC_FALL_INTERVAL_MIN,
      (CFG.DISC_FALL_INTERVAL_START - diffLevel * 100) * diff.fallMult
    );
    if (fallTimer >= fallInterval && queue.length < CFG.QUEUE_MAX) {
      fallTimer = 0;
      pushToQueue(false);
      renderRail(true); // true = animate new item dropping in from top
    }

    // Spawn demon
    const demonInterval = Math.max(
      CFG.DEMON_SPAWN_INTERVAL_MIN,
      (CFG.DEMON_SPAWN_INTERVAL_START - diffLevel * 180) * diff.spawnMult
    );
    if (demonTimer >= demonInterval) { demonTimer = 0; spawnDemon(); }

    // Advance belt slide animation
    if (beltSliding) updateBeltSlide(ts);

    updateFired(dt);
    updateDemons(dt);
    checkCollisions();
    updateHUD();
    updateCooldownBar();

    if (timeLeft <= 0 || lives <= 0) { endGame(); return; }
    animId = requestAnimationFrame(loop);
  }

  // ══════════════════════════════════════════════════
  //  QUEUE MANAGEMENT
  // ══════════════════════════════════════════════════
  function pickDiscType() {
    const r = Math.random();
    if      (r < 0.03) return CFG.DISC_TYPES[3]; // star  3%
    else if (r < 0.18) return CFG.DISC_TYPES[2]; // ice  15%
    else if (r < 0.40) return CFG.DISC_TYPES[1]; // fire 22%
    else               return CFG.DISC_TYPES[0]; // normal
  }

  function pushToQueue(silent) {
    queue.push({ id: nextId++, type: pickDiscType(), isNew: !silent });
  }

  // Pull top item from queue into loaded slot (no animation)
  function autoLoad(silent) {
    if (loaded) return;
    if (queue.length === 0) return;
    loaded = queue.shift();
    if (!silent) renderLoaded();
  }

  // Player taps a queue item — swap it to loaded, put current loaded back
  function swapLoad(idx) {
    if (!running || beltSliding) return;
    const tapped = queue[idx];
    if (loaded) {
      queue.splice(idx, 1, loaded); // replace tapped slot with current loaded
    } else {
      queue.splice(idx, 1);
    }
    loaded = tapped;
    renderLoaded();
    renderRail(false);
  }

  // ══════════════════════════════════════════════════
  //  CONVEYOR BELT ANIMATION
  //  All items smoothly slide down one SLOT_H when
  //  the loaded item is consumed (fire / autoLoad).
  // ══════════════════════════════════════════════════
  function startBeltSlide() {
    beltSliding    = true;
    beltSlideStart = performance.now();
    beltOffsetPx   = 0;
    // Give every existing item element a starting top based on CURRENT positions
    // They will be moved by updateBeltSlide each frame
    const items = railTrackEl ? railTrackEl.querySelectorAll(".dod-rail-item") : [];
    items.forEach((el, i) => {
      // store their logical index so we know target
      el.dataset.slotIdx = i;
      el.style.transition = "none";
      el.style.top = (i * CFG.SLOT_H) + "px"; // reset to clean positions
    });
  }

  function updateBeltSlide(ts) {
    const elapsed = ts - beltSlideStart;
    const t = Math.min(elapsed / CFG.BELT_SLIDE_MS, 1);
    // Ease-out cubic
    const ease = 1 - Math.pow(1 - t, 3);
    beltOffsetPx = ease * CFG.SLOT_H;

    const items = railTrackEl ? railTrackEl.querySelectorAll(".dod-rail-item") : [];
    items.forEach((el, i) => {
      el.style.top = (i * CFG.SLOT_H + beltOffsetPx) + "px";
    });

    if (t >= 1) {
      // Slide complete
      beltSliding  = false;
      beltOffsetPx = 0;
      // Re-render from fresh data (removes the ghost of what was at slot 0)
      autoLoad(false);
      renderRail(false);
      renderLoaded();
      // Ensure queue stays topped up
      if (queue.length < CFG.QUEUE_MAX) {
        pushToQueue(false);
        renderRail(true);
      }
    }
  }

  // ══════════════════════════════════════════════════
  //  RENDER RAIL
  // ══════════════════════════════════════════════════
  function renderRail(animateNewItem) {
    if (!railTrackEl) return;
    // Keep existing elements if mid-slide; otherwise full rebuild
    if (beltSliding) return;

    railTrackEl.innerHTML = "";
    // Track height = enough for all slots
    railTrackEl.style.height = (CFG.QUEUE_MAX * CFG.SLOT_H) + "px";

    queue.forEach((disc, idx) => {
      const el = document.createElement("div");
      el.className = "dod-rail-item";
      el.dataset.id = disc.id;
      el.style.setProperty("--disc-color", disc.type.color);

      // Position: top slot is idx=0
      el.style.top = (idx * CFG.SLOT_H) + "px";

      el.innerHTML = `<span class="dod-rail-emoji">${disc.type.emoji}</span>`;

      // New item drop-in animation from above
      if (disc.isNew && animateNewItem) {
        el.style.opacity = "0";
        el.style.transform = "translateY(-28px) scale(0.6)";
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.transition = "opacity 0.22s ease, transform 0.22s ease";
            el.style.opacity = "1";
            el.style.transform = "translateY(0) scale(1)";
          });
        });
        disc.isNew = false;
      }

      el.addEventListener("pointerdown", e => {
        e.stopPropagation();
        swapLoad(idx);
      });

      railTrackEl.appendChild(el);
    });

    // Ghost empty slots so the rail always looks full-length
    for (let i = queue.length; i < CFG.QUEUE_MAX; i++) {
      const ghost = document.createElement("div");
      ghost.className = "dod-rail-ghost";
      ghost.style.top = (i * CFG.SLOT_H) + "px";
      railTrackEl.appendChild(ghost);
    }
  }

  function renderLoaded() {
    if (!loadedSlotEl) return;
    if (!loaded) {
      loadedSlotEl.innerHTML = `<span class="dod-loaded-empty">—</span>`;
      loadedSlotEl.className = "dod-loaded-slot";
      return;
    }
    loadedSlotEl.innerHTML = `
      <div class="dod-loaded-disc" style="--disc-color:${loaded.type.color}">
        ${loaded.type.emoji}
      </div>
      <div class="dod-loaded-name">${loaded.type.id}</div>
    `;
    loadedSlotEl.className = "dod-loaded-slot dod-loaded-active";
    // Update fire zone colour to match
    if (fireZoneEl) fireZoneEl.style.setProperty("--fz-color", loaded.type.color);
  }

  // ══════════════════════════════════════════════════
  //  COOLDOWN BAR
  // ══════════════════════════════════════════════════
  function updateCooldownBar() {
    if (!cooldownBarEl) return;
    const now = performance.now();
    if (now >= cooldownUntil) {
      cooldownBarEl.style.width = "0%";
      cooldownBarEl.parentElement.classList.remove("active");
      return;
    }
    const pct = ((cooldownUntil - now) / CFG.FIRE_COOLDOWN_MS) * 100;
    cooldownBarEl.style.width = pct + "%";
    cooldownBarEl.parentElement.classList.add("active");
  }

  // ══════════════════════════════════════════════════
  //  FIRE
  // ══════════════════════════════════════════════════
  function triggerFire(tapY) {
    if (!loaded || !arenaEl) return;
    const arenaH = arenaEl.clientHeight;
    const y = Math.max(CFG.DISC_RADIUS, Math.min(arenaH - CFG.DISC_RADIUS, tapY));

    if (loaded.type.star) {
      activateStar();
    } else {
      fired.push({
        id: nextId++,
        type: loaded.type,
        x: CFG.DISC_RADIUS,
        y,
        speed: CFG.FIRED_SPEED_PX_S,
        el: null,
      });
    }

    // Start cooldown
    cooldownUntil = performance.now() + CFG.FIRE_COOLDOWN_MS;

    // Clear loaded slot visually
    loaded = null;
    renderLoaded();
    if (fireZoneEl) fireZoneEl.classList.add("dod-fz-fired");
    setTimeout(() => fireZoneEl && fireZoneEl.classList.remove("dod-fz-fired"), 180);

    // Start belt slide which will auto-load next item when done
    startBeltSlide();
  }

  // ══════════════════════════════════════════════════
  //  STAR POWER
  // ══════════════════════════════════════════════════
  function activateStar() {
    const sp  = CFG.STAR_POWER;
    const now = performance.now();
    demons.forEach(d => {
      if (d.dead) return;
      d.hp -= d.maxHp * sp.dmg_pct;
      d.frozenUntil = now + sp.freeze_dur * 1000;
      showFX(d.x, d.y, "#fbbf24", "⭐");
      if (d.hp <= 0) killDemon(d);
    });
    if (arenaEl) {
      arenaEl.classList.add("dod-star-flash");
      setTimeout(() => arenaEl.classList.remove("dod-star-flash"), sp.fx_duration);
    }
    score += 50;
    showFX(arenaEl ? arenaEl.clientWidth / 2 : 200, 40, "#fbbf24", "✨ STAR!");
  }

  // ══════════════════════════════════════════════════
  //  UPDATE — FIRED DISCS
  // ══════════════════════════════════════════════════
  function updateFired(dt) {
    if (!arenaEl) return;
    const dtS  = dt / 1000;
    const aW   = arenaEl.clientWidth;

    for (let i = fired.length - 1; i >= 0; i--) {
      const d = fired[i];
      d.x += d.speed * dtS;

      if (!d.el) {
        d.el = document.createElement("div");
        d.el.className = "dod-fired-disc";
        d.el.textContent = d.type.emoji;
        d.el.style.setProperty("--disc-color", d.type.color);
        arenaEl.appendChild(d.el);
      }
      d.el.style.left = d.x - CFG.DISC_RADIUS + "px";
      d.el.style.top  = d.y - CFG.DISC_RADIUS + "px";

      if (d.x > aW + CFG.DISC_RADIUS * 2) {
        d.el.remove();
        fired.splice(i, 1);
      }
    }
  }

  // ══════════════════════════════════════════════════
  //  UPDATE — DEMONS
  // ══════════════════════════════════════════════════
  function spawnDemon() {
    if (!arenaEl) return;
    const aH   = arenaEl.clientHeight;
    const aW   = arenaEl.clientWidth;
    const rowH = aH / CFG.ROWS;
    const diff = DIFFICULTIES[currentDiff];

    let pool = [CFG.DEMON_TYPES[0], CFG.DEMON_TYPES[1]];
    if (diffLevel >= 2) pool.push(CFG.DEMON_TYPES[2]);
    if (diffLevel >= 4) pool.push(CFG.DEMON_TYPES[3]);
    const dType = pool[Math.floor(Math.random() * pool.length)];
    const row   = Math.floor(Math.random() * CFG.ROWS);
    const y     = row * rowH + rowH / 2;
    const baseHp = CFG.DEMON_HP[dType.id] * diff.hpMult;

    demons.push({
      id: nextId++,
      x: aW + CFG.DEMON_WIDTH / 2,
      y, row,
      type: dType,
      hp: baseHp, maxHp: baseHp,
      speed: CFG.DEMON_SPEED_PX_S * diff.demonSpeedMult,
      frozenUntil: 0,
      burnEndTime: 0,
      burnDps: 0,
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

      // Burn DoT
      if (now < d.burnEndTime && d.burnDps > 0) {
        d.hp -= d.maxHp * d.burnDps * dtS;
        if (d.el) d.el.classList.add("dod-burning");
        if (d.hp <= 0) { killDemon(d); continue; }
      } else {
        if (d.el) d.el.classList.remove("dod-burning");
      }

      // Movement
      if (now >= d.frozenUntil) d.x -= d.speed * dtS;

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
          <div class="dod-hp-track">
            <div class="dod-hp-fill"></div>
            <div class="dod-burn-fill"></div>
          </div>
        `;
        arenaEl.appendChild(d.el);
      }

      d.el.style.left = d.x - CFG.DEMON_WIDTH / 2 + "px";
      d.el.style.top  = d.y - CFG.DEMON_HEIGHT / 2 + "px";

      const hpFill = d.el.querySelector(".dod-hp-fill");
      if (hpFill) hpFill.style.width = Math.max(0, d.hp / d.maxHp * 100) + "%";

      const burnFill = d.el.querySelector(".dod-burn-fill");
      if (burnFill) {
        if (now < d.burnEndTime && d.burnDps > 0) {
          burnFill.style.width   = Math.min(100, ((d.burnEndTime - now) / 1000) * d.burnDps * 100) + "%";
          burnFill.style.opacity = "1";
        } else {
          burnFill.style.opacity = "0";
        }
      }

      d.el.classList.toggle("frozen",     now < d.frozenUntil);
      d.el.classList.toggle("dod-burning", now < d.burnEndTime && d.burnDps > 0);
    }
  }

  function killDemon(d) {
    d.dead = true; d.hp = 0;
    score += CFG.SCORE_PER_KILL;
    seedsEarned += CFG.SEEDS_PER_KILL;
    coinsEarned += CFG.COINS_PER_KILL;
    showFX(d.x, d.y, "#fbbf24", "💀");
    if (d.el) {
      d.el.style.transition = "transform 0.28s, opacity 0.28s";
      d.el.style.transform  = "scale(1.6)";
      d.el.style.opacity    = "0";
      setTimeout(() => d.el && d.el.remove(), 300);
    }
  }

  // ══════════════════════════════════════════════════
  //  COLLISIONS
  // ══════════════════════════════════════════════════
  function checkCollisions() {
    for (let fi = fired.length - 1; fi >= 0; fi--) {
      const disc = fired[fi];
      for (let di = demons.length - 1; di >= 0; di--) {
        const demon = demons[di];
        if (demon.dead) continue;
        const dx = disc.x - demon.x, dy = disc.y - demon.y;
        if (Math.sqrt(dx*dx + dy*dy) >= CFG.DISC_RADIUS + CFG.DEMON_WIDTH/2 - 8) continue;

        const now = performance.now();
        demon.hp -= demon.maxHp * disc.type.direct_dmg;
        score += CFG.SCORE_PER_HIT;
        seedsEarned += CFG.SEEDS_PER_HIT;
        showFX(disc.x, disc.y, disc.type.color, "💥");

        if (disc.type.burn_dps > 0) {
          demon.burnDps     = disc.type.burn_dps;
          demon.burnEndTime = now + disc.type.burn_dur * 1000;
          showFX(disc.x, disc.y, "#f97316", "🔥");
        }
        if (disc.type.freeze) {
          demon.frozenUntil = now + disc.type.freeze_dur * 1000;
          showFX(disc.x, disc.y, "#38bdf8", "❄️");
        }
        if (demon.hp <= 0) killDemon(demon);

        disc.el && disc.el.remove();
        fired.splice(fi, 1);
        break;
      }
    }
  }

  // ══════════════════════════════════════════════════
  //  FX
  // ══════════════════════════════════════════════════
  function showFX(x, y, color, text) {
    if (!arenaEl) return;
    const el = document.createElement("div");
    el.className  = "dod-fx";
    el.textContent= text;
    el.style.cssText = `left:${x}px;top:${y}px;color:${color}`;
    arenaEl.appendChild(el);
    setTimeout(() => el.remove(), 750);
  }

  function flashArena() {
    if (!arenaEl) return;
    arenaEl.classList.add("dod-flash");
    setTimeout(() => arenaEl.classList.remove("dod-flash"), 400);
  }

  // ══════════════════════════════════════════════════
  //  HUD
  // ══════════════════════════════════════════════════
  function updateHUD() {
    if (scorEl)    scorEl.textContent  = score;
    if (seedsEl)   seedsEl.textContent = seedsEarned;
    if (livesEl)   livesEl.textContent =
      "❤️".repeat(Math.max(0,lives)) + "🖤".repeat(Math.max(0,CFG.LIVES-lives));
    if (timerFill) timerFill.style.width = (timeLeft / CFG.DURATION_MS * 100) + "%";
  }

  // ══════════════════════════════════════════════════
  //  DIFFICULTY PICKER
  // ══════════════════════════════════════════════════
  function showPicker(scr) {
    const container = scr.querySelector("#dod-container");
    const picker = document.createElement("div");
    picker.className = "bh-result";
    picker.innerHTML = `
      <button class="btn-back" style="align-self:flex-start;margin-bottom:8px" id="dod-pick-back">↶</button>
      <h2 style="font-size:28px">💿 Choose Difficulty</h2>
      ${DIFFICULTIES.map((d,i) => `
        <button class="btn-menu" data-diff="${i}">
          ${"🔥".repeat(d.pips)} ${d.name}
          <span>Demon speed ×${d.demonSpeedMult} · 🌱${d.reward.seeds} 🪙${d.reward.coins}</span>
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

  // ══════════════════════════════════════════════════
  //  END GAME
  // ══════════════════════════════════════════════════
  function endGame() {
    running = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    fired.forEach(d => d.el && d.el.remove());
    demons.forEach(d => d.el && d.el.remove());
    fired = []; demons = [];

    const diff   = DIFFICULTIES[currentDiff];
    const reward = diff.reward;
    const won    = score > 0;
    let plantName = "";

    if (won) {
      if (typeof Seeds !== "undefined") {
        const sr = Seeds.giveRandomSeeds(reward.seeds);
        plantName = sr
          ? (typeof PlantRegistry !== "undefined" ? PlantRegistry.get(sr.plantId)?.name || "" : "")
          : "";
      }
      if (typeof Player !== "undefined") Player.addCoins(reward.coins);
      if (typeof UI !== "undefined") UI.updateCoinDisplays();
    }

    const scr = document.getElementById("screen-discofdoom");
    if (!scr) return;
    const container = scr.querySelector("#dod-container");

    const overlay = document.createElement("div");
    overlay.className = "bh-result";
    overlay.innerHTML = `
      <h2>${lives > 0 ? "🏆 Time's Up!" : "💀 Defeated!"}</h2>
      <div class="bh-score-final">Score: ${score} pts</div>
      ${won ? `
        <div class="bh-seeds-earned">🌱 +${reward.seeds} seeds${plantName ? " → "+plantName : ""}</div>
        <div class="bh-seeds-earned" style="color:var(--gold)">🪙 +${reward.coins} coins</div>` : ""}
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px">
        ${currentDiff < DIFFICULTIES.length-1
          ? `<button class="btn-primary" id="dod-harder">Harder: ${DIFFICULTIES[currentDiff+1].name} 🔥</button>` : ""}
        <button class="btn-primary"   id="dod-replay">🔄 Replay</button>
        <button class="btn-secondary" id="dod-change">📋 Change Diff</button>
        <button class="btn-secondary" id="dod-exit">🏠 Menu</button>
      </div>
    `;
    container.appendChild(overlay);

    const hb = overlay.querySelector("#dod-harder");
    if (hb) hb.addEventListener("click", () => { overlay.remove(); startGame(currentDiff+1); });
    overlay.querySelector("#dod-replay").addEventListener("click", () => { overlay.remove(); startGame(currentDiff); });
    overlay.querySelector("#dod-change").addEventListener("click", () => { overlay.remove(); startGame(); });
    overlay.querySelector("#dod-exit").addEventListener("click",   () => {
      if (typeof UI !== "undefined") UI.showScreen("screen-minigames");
    });
  }

  return { startGame };
})();