/* js/boss.js
   Boss battle system for PvZ Classic.
   Handles: entry animation, conveyor belt plants,
   3-phase boss AI, laser, demon waves, victory.

   HOW TO USE:
   In core.js startBattle(), detect boss level:
     if (levelData.isBossLevel) {
       Boss.start(worldId, levelIdx, levelData);
       return; // skip normal battle setup
     }
*/

const Boss = (() => {

  // ── Config ─────────────────────────────────────
  const CFG = {
    BOSS_HP: 15000,
    BOSS_SIZE_ROWS: 2,           // occupies 2 rows height
    ENTRY_COL: 8,                // 0-based, rightmost col (col 9 = idx 8)
    PHASE2_HP_PCT: 0.60,         // moves at 60% HP
    PHASE3_HP_PCT: 0.30,         // enrages at 30% HP
    LASER_INTERVAL_MIN: 8000,    // ms between laser attacks (min)
    LASER_INTERVAL_MAX: 18000,   // ms between laser attacks (max)
    LASER_DURATION: 1200,        // ms laser beam visible
    WAVE_INTERVAL_MIN: 12000,    // ms between demon waves boss sends
    WAVE_INTERVAL_MAX: 22000,
    DEMONS_PER_WAVE_MIN: 3,
    DEMONS_PER_WAVE_MAX: 8,
    PHASE2_MOVE_SPEED: 40,       // px/s walking to plant side
    PHASE3_SLAM_INTERVAL: 4000,
    PHASE3_IMP_INTERVAL: 8000,
    PHASE3_LEAP_INTERVAL: 6000,
    CONVEYOR_SPEED: 2500,        // ms per plant slide
    CONVEYOR_PLANTS_VISIBLE: 5,  // plants shown on belt at once
    ENTRY_CHARGE_DURATION: 3000, // ms for power charge anim
    BOSS_IMAGE: "assets/demons/boss_w1.png",
    BOSS_NAME: "Inferno Warlord",
    COIN_REWARD: 500,
  };

  // ── State ──────────────────────────────────────
  let bossEl = null;
  let pendingPlantId = null;
  let pendingCardEl = null;
  let bossHp = CFG.BOSS_HP;
  let bossMaxHp = CFG.BOSS_HP;
  let bossPhase = 1;
  let bossRow = 1;          // center row (0-based)
  let bossCol = CFG.ENTRY_COL;
  let bossX = 0;
  let bossY = 0;
  let worldId = 1;
  let levelIdx = 30;
  let levelData = null;
  let worldDemons = [];

  let running = false;
  let paused = false;

  let laserTimer = null;
  let waveTimer = null;
  let slamTimer = null;
  let impTimer = null;
  let leapTimer = null;
  let phase2MoveInterval = null;

  let conveyorPlants = [];   // plant ids for conveyor
  let conveyorQueue = [];    // infinite shuffled queue
  let conveyorEl = null;
  let conveyorInterval = null;

  let bossHpBarEl = null;
  let bossHpFillEl = null;
  let bossHpTextEl = null;
  let bossPhaseEl = null;

  let gridRows = 5;
  let gridCols = 9;
  let cellW = 0;
  let cellH = 0;
  let arenaRect = null;

  // ── Entry Point ────────────────────────────────
  function start(wId, lvlIdx, lvlData, plantIds) {
    worldId = wId;
    levelIdx = lvlIdx;
    levelData = lvlData;
    conveyorPlants = plantIds || [];

    // Get world demon types
    const world = Levels.getWorld(worldId);
    worldDemons = world ? world.demons : ["imp"];

    running = true;
    paused = false;
    bossHp = CFG.BOSS_HP;
    bossMaxHp = CFG.BOSS_HP;
    bossPhase = 1;

    // Setup arena
    const arenaEl = document.getElementById("grid-container");
    const demonsLayer = document.getElementById("demons-layer");
    const effectsLayer = document.getElementById("effects-layer");
    const projLayer = document.getElementById("projectiles-layer");

    Demons.clear();
    Grid.clear();
    if (demonsLayer) demonsLayer.innerHTML = "";
    if (effectsLayer) {
      effectsLayer.querySelectorAll(".demon-hp-wrap,.float-text,.sun-token,.sky-sun").forEach(e => e.remove());
    }

    Grid.init(arenaEl);

    requestAnimationFrame(() => {
      arenaRect = arenaEl.getBoundingClientRect();
      gridRows = Grid.getRows();
      gridCols = Grid.getCols ? Grid.getCols() : 9;
      cellW = arenaRect.width / gridCols;
      cellH = arenaRect.height / gridRows;

      Demons.init(demonsLayer, effectsLayer, arenaRect, {
        onReachedEnd: onDemonReachedEnd,
        onAllDefeated: () => {}, // boss handles victory
      });
      Projectiles.init(projLayer);
      Projectiles.setArenaRect(arenaRect);
      Demons.setArenaRect(arenaRect);

      // Show battle screen
      UI.setArenaBg(worldId);
      document.getElementById("hud-world").textContent = `W${worldId}`;
      document.getElementById("hud-level").textContent = `Boss`;
      UI.showScreen("screen-battle");

      // Build boss HP bar
      buildBossHpBar();

      // Build conveyor belt instead of normal tray
      buildConveyorBelt(plantIds);

      // Hide wave display
      const waveEl = document.getElementById("hud-wave");
      if (waveEl) waveEl.style.display = "none";

      // Start entry sequence
      entrySequence();
    });
  }

  // ── Entry Sequence ─────────────────────────────
  function entrySequence() {
    // Disable plant placement during entry
    setPlacementEnabled(false);

    // Show entry overlay
    const overlay = document.createElement("div");
    overlay.id = "boss-entry-overlay";
    overlay.innerHTML = `
      <div class="boss-entry-title">⚠️ BOSS APPROACHING ⚠️</div>
      <div class="boss-entry-name">${CFG.BOSS_NAME}</div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => overlay.classList.add("visible"), 100);

    // Spawn boss off-screen right
    spawnBossElement();

    // Walk boss in from right
    setTimeout(() => {
      overlay.classList.remove("visible");
      setTimeout(() => overlay.remove(), 500);
      walkBossToEntryCol(() => {
        // Boss arrived — do charge animation
        bossPowerCharge(() => {
          // Enable plant placement
          setPlacementEnabled(true);
          // Start music
          if (typeof SoundFX !== "undefined") SoundFX.playMusic(worldId);
          // Start phase 1 AI
          startPhase1();
          // Start conveyor
          startConveyor();
          // Start plant AI ticking
          startGameLoop();
        });
      });
    }, 1500);
  }

  // ── Boss DOM Element ───────────────────────────
  function spawnBossElement() {
    const demonsLayer = document.getElementById("demons-layer");
    if (!demonsLayer || !arenaRect) return;

    bossEl = document.createElement("div");
    bossEl.id = "boss-entity";
    bossEl.className = "boss-entity";

    const img = document.createElement("img");
    img.src = CFG.BOSS_IMAGE;
    img.alt = CFG.BOSS_NAME;
    bossEl.appendChild(img);

    // Position off-screen right
    bossRow = Math.floor(gridRows / 2) - 1; // rows 2-3 (0-based: 1-2)
    const startX = arenaRect.width + 20;
    const y = bossRow * cellH;

    bossEl.style.left = startX + "px";
    bossEl.style.top = y + "px";
    bossEl.style.width = (cellW * 1.8) + "px";
    bossEl.style.height = (cellH * 2) + "px";

    demonsLayer.appendChild(bossEl);
    bossX = startX;
    bossY = y;
  }

  function walkBossToEntryCol(onDone) {
    if (!bossEl) return onDone();
    const targetX = bossCol * cellW;
    bossEl.classList.add("boss-walking");
    bossEl.style.transition = `left 2.5s linear`;
    bossEl.style.left = targetX + "px";
    bossX = targetX;
    setTimeout(() => {
      bossEl.classList.remove("boss-walking");
      bossEl.style.transition = "";
      onDone();
    }, 2600);
  }

  function bossPowerCharge(onDone) {
    if (!bossEl) return onDone();

    // Show charge bar
    const chargeEl = document.createElement("div");
    chargeEl.id = "boss-charge-wrap";
    chargeEl.innerHTML = `
      <div class="boss-charge-label">POWER CHARGING</div>
      <div class="boss-charge-bar-bg">
        <div class="boss-charge-bar-fill" id="boss-charge-fill"></div>
      </div>
      <div class="boss-charge-pct" id="boss-charge-pct">0%</div>
    `;
    document.body.appendChild(chargeEl);
    setTimeout(() => chargeEl.classList.add("visible"), 100);

    bossEl.classList.add("boss-charging");

    const fillEl = document.getElementById("boss-charge-fill");
    const pctEl = document.getElementById("boss-charge-pct");
    let pct = 0;
    const interval = setInterval(() => {
      pct += 2;
      if (fillEl) fillEl.style.width = pct + "%";
      if (pctEl) pctEl.textContent = pct + "%";
      if (pct >= 100) {
        clearInterval(interval);
        bossEl.classList.remove("boss-charging");
        bossEl.classList.add("boss-roar");
        // Screen shake
        document.getElementById("screen-battle")?.classList.add("screen-shake");
        setTimeout(() => {
          document.getElementById("screen-battle")?.classList.remove("screen-shake");
          bossEl.classList.remove("boss-roar");
          chargeEl.classList.remove("visible");
          setTimeout(() => chargeEl.remove(), 400);
          onDone();
        }, 800);
      }
    }, CFG.ENTRY_CHARGE_DURATION / 50);
  }

  // ── Game Loop (plant AI only) ──────────────────
  let lastTime = 0;
  let rafId = null;

  function startGameLoop() {
    lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  }

  function gameLoop(now) {
    if (!running) return;
    if (paused) { rafId = requestAnimationFrame(gameLoop); return; }

    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    Demons.update(dt);
    Projectiles.update(dt);
    PlantRegistry.tick(dt);
    Grid.updateFreezeTimers(dt);

    rafId = requestAnimationFrame(gameLoop);
  }

  // ── Phase 1 AI ─────────────────────────────────
  function startPhase1() {
    bossPhase = 1;
    updateBossPhaseLabel("Phase 1");
    scheduleLaser();
    scheduleDemonWave();
  }

  // ── Phase 2 ────────────────────────────────────
  function enterPhase2() {
    if (bossPhase >= 2) return;
    bossPhase = 2;
    updateBossPhaseLabel("Phase 2 — ADVANCING");
    bossEl?.classList.add("boss-phase2");

    // Flash boss
    flashBoss("#ff6600");

    // Boss starts walking left toward plants
    moveBossToPlantSide();
  }

  function moveBossToPlantSide() {
    if (!bossEl || !arenaRect) return;
    const targetX = 0; // leftmost column
    bossEl.style.transition = `left 4s linear`;
    bossEl.style.left = targetX + "px";
    bossX = targetX;
    bossCol = 0;

    // While moving, damage plants in his 2 rows
    phase2MoveInterval = setInterval(() => {
      if (!running) { clearInterval(phase2MoveInterval); return; }
      killPlantsInBossRows();
    }, 800);

    setTimeout(() => {
      bossEl.style.transition = "";
      clearInterval(phase2MoveInterval);
      // Keep killing plants continuously at position
      phase2MoveInterval = setInterval(() => {
        if (!running) { clearInterval(phase2MoveInterval); return; }
        killPlantsInBossRows();
      }, 500);
    }, 4100);
  }

  function killPlantsInBossRows() {
    // Use Grid's cell elements directly to find and remove plants
    const col = Math.round(bossX / cellW);
    for (let r = bossRow; r <= bossRow + 1; r++) {
      for (let c = Math.max(0, col - 1); c <= col; c++) {
        const cellEl = document.querySelector(
          `[data-row="${r}"][data-col="${c}"]`
        );
        if (cellEl && cellEl.dataset.occupied === "true") {
          cellEl.click(); // trigger removal via grid click or find plant entity
        }
        // Also remove plant entity DOM directly
        const plantEl = document.querySelector(
          `.plant-entity[data-row="${r}"][data-col="${c}"]`
        );
        if (plantEl) plantEl.remove();
      }
    }
  }

  // ── Phase 3 ────────────────────────────────────
  function enterPhase3() {
    if (bossPhase >= 3) return;
    bossPhase = 3;
    updateBossPhaseLabel("⚠️ ENRAGED");
    bossEl?.classList.add("boss-phase3");
    flashBoss("#ff0000");

    // Ground Slam every 4s
    slamTimer = setInterval(() => {
      if (!running) return;
      groundSlam();
    }, CFG.PHASE3_SLAM_INTERVAL);

    // Spawn imps every 8s
    impTimer = setInterval(() => {
      if (!running) return;
      spawnImp();
    }, CFG.PHASE3_IMP_INTERVAL);

    // Wing Leap every 6s
    leapTimer = setInterval(() => {
      if (!running) return;
      wingLeap();
    }, CFG.PHASE3_LEAP_INTERVAL);
  }

  function groundSlam() {
    if (!bossEl) return;
    bossEl.classList.add("boss-slam");
    showBossEffect("💥 GROUND SLAM!", "#ff4400");
    // Stun all plants in boss rows for 2s
    for (let r = bossRow; r <= bossRow + 1; r++) {
      for (let c = 0; c < gridCols; c++) {
        const plant = Grid.getPlantAt(r, c);
        if (plant && plant.stunTimer !== undefined) {
          plant.stunTimer = 2000;
        }
      }
    }
    document.getElementById("screen-battle")?.classList.add("screen-shake");
    setTimeout(() => {
      bossEl?.classList.remove("boss-slam");
      document.getElementById("screen-battle")?.classList.remove("screen-shake");
    }, 600);
  }

  function wingLeap() {
    if (!bossEl) return;
    showBossEffect("🦇 WING LEAP!", "#9900ff");
    bossEl.classList.add("boss-leap");
    // Jump over first plant blocking
    const col = Math.round(bossX / cellW);
    let targetCol = Math.max(0, col - 2);
    const targetX = targetCol * cellW;
    bossEl.style.transition = "left 0.4s ease-in, top 0.2s ease-out";
    bossEl.style.left = targetX + "px";
    bossX = targetX;
    bossCol = targetCol;
    setTimeout(() => {
      bossEl?.classList.remove("boss-leap");
      bossEl.style.transition = "";
    }, 500);
  }

  function spawnImp() {
    const row = Math.floor(Math.random() * gridRows);
    Demons.spawn({ type: "imp", row, spawnDelay: 0 });
  }

  // ── Laser Attack ───────────────────────────────
  function scheduleLaser() {
    if (!running) return;
    const delay = CFG.LASER_INTERVAL_MIN +
      Math.random() * (CFG.LASER_INTERVAL_MAX - CFG.LASER_INTERVAL_MIN);
    laserTimer = setTimeout(() => {
      if (!running) return;
      fireLaser();
      scheduleLaser(); // reschedule
    }, delay);
  }

  function fireLaser() {
    // Pick 2-3 random plants to kill — find via DOM
    const allPlants = [];
    document.querySelectorAll(".plant-entity").forEach(el => {
      const r = parseInt(el.dataset.row);
      const c = parseInt(el.dataset.col);
      if (!isNaN(r) && !isNaN(c)) allPlants.push({ r, c, el });
    });
    if (allPlants.length === 0) return;

    const count = Math.min(allPlants.length, 2 + Math.floor(Math.random() * 2));
    const picks = allPlants.sort(() => Math.random() - 0.5).slice(0, count);

    showBossEffect("☄️ LASER!", "#ff0066");

    picks.forEach((pos, i) => {
      setTimeout(() => {
        if (!running) return;
        showLaserBeam(pos.r, pos.c);
        setTimeout(() => {
          // Remove plant via DOM
          const plantEl = document.querySelector(
            `.plant-entity[data-row="${pos.r}"][data-col="${pos.c}"]`
          );
          if (plantEl) plantEl.remove();
        }, CFG.LASER_DURATION - 100);
      }, i * 400);
    });
  }

  function showLaserBeam(row, col) {
    const effectsLayer = document.getElementById("effects-layer");
    if (!effectsLayer || !arenaRect) return;

    const effectsRect = effectsLayer.getBoundingClientRect();
    const targetX = arenaRect.left - effectsRect.left + col * cellW + cellW / 2;
    const targetY = arenaRect.top - effectsRect.top + row * cellH + cellH / 2;
    const startX = arenaRect.left - effectsRect.left + bossX + cellW;
    const startY = arenaRect.top - effectsRect.top + bossY + cellH;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    const beam = document.createElement("div");
    beam.className = "boss-laser-beam";
    beam.style.left = startX + "px";
    beam.style.top = (startY - 3) + "px";
    beam.style.width = length + "px";
    beam.style.transform = `rotate(${angle}deg)`;
    effectsLayer.appendChild(beam);

    // Impact flash at target
    const flash = document.createElement("div");
    flash.className = "boss-laser-impact";
    flash.style.left = (targetX - 20) + "px";
    flash.style.top = (targetY - 20) + "px";
    effectsLayer.appendChild(flash);

    setTimeout(() => {
      beam.remove();
      flash.remove();
    }, CFG.LASER_DURATION);
  }

  // ── Demon Wave Sending ─────────────────────────
  function scheduleDemonWave() {
    if (!running) return;
    const delay = CFG.WAVE_INTERVAL_MIN +
      Math.random() * (CFG.WAVE_INTERVAL_MAX - CFG.WAVE_INTERVAL_MIN);
    waveTimer = setTimeout(() => {
      if (!running) return;
      sendDemonWave();
      scheduleDemonWave();
    }, delay);
  }

  function sendDemonWave() {
    const count = CFG.DEMONS_PER_WAVE_MIN +
      Math.floor(Math.random() * (CFG.DEMONS_PER_WAVE_MAX - CFG.DEMONS_PER_WAVE_MIN));

    showBossEffect("💀 SENDING MINIONS!", "#cc0000");

    // Available demons based on world unlock by level
    const world = Levels.getWorld(worldId);
    const available = world ? world.demons : ["imp"];

    for (let i = 0; i < count; i++) {
      const type = available[Math.floor(Math.random() * available.length)];
      const row = Math.floor(Math.random() * gridRows);
      setTimeout(() => {
        if (!running) return;
        Demons.spawn({ type, row, spawnDelay: 0 });
      }, i * 300);
    }
  }

  // ── Boss HP ────────────────────────────────────
  function damageBoss(amount) {
    if (!running) return;
    bossHp = Math.max(0, bossHp - amount);
    updateBossHpBar();

    // Phase transitions
    const pct = bossHp / bossMaxHp;
    if (pct <= CFG.PHASE3_HP_PCT && bossPhase < 3) enterPhase3();
    else if (pct <= CFG.PHASE2_HP_PCT && bossPhase < 2) enterPhase2();

    if (bossHp <= 0) bossDeath();
  }

  function bossDeath() {
    running = false;
    cancelAnimationFrame(rafId);
    clearAllTimers();

    bossEl?.classList.add("boss-death");
    showBossEffect("💀 DEFEATED!", "#ffff00");

    // Screen shake
    document.getElementById("screen-battle")?.classList.add("screen-shake");

    setTimeout(() => {
      bossEl?.remove();
      document.getElementById("screen-battle")?.classList.remove("screen-shake");
      removeBossHpBar();
      restoreNormalTray();

      // Rewards
      Player.addCoins(CFG.COIN_REWARD);
      Player.setLevelStars(worldId, levelIdx, 3);
      Levels.checkWorldUnlocks();

      const contents = Levels.generatePacketContents(worldId);
      const packetId = "minipacket_boss_" + Date.now();
      Player.addInventoryItem(packetId, 1, {
        type: "minipacket",
        worldId,
        contents,
      });

      UI.showBattleResult(true, CFG.COIN_REWARD, null, null, null, {
        packetId, contents,
      });

      if (typeof SoundFX !== "undefined") SoundFX.stopMusic();
      Grid.clear();
      Demons.clear();
      Projectiles.clear();
      PlantRegistry.clearTimers();
    }, 1800);
  }

  // ── Boss HP Bar ────────────────────────────────
  function buildBossHpBar() {
    removeBossHpBar();
    const bar = document.createElement("div");
    bar.id = "boss-hp-bar";
    bar.innerHTML = `
      <div class="boss-hp-name">${CFG.BOSS_NAME}</div>
      <div class="boss-hp-phase" id="boss-phase-label">Phase 1</div>
      <div class="boss-hp-bar-bg">
        <div class="boss-hp-bar-fill" id="boss-hp-fill"></div>
        <div class="boss-hp-bar-phase2" id="boss-hp-phase2-marker"></div>
        <div class="boss-hp-bar-phase3" id="boss-hp-phase3-marker"></div>
      </div>
      <div class="boss-hp-text" id="boss-hp-text">${CFG.BOSS_HP} / ${CFG.BOSS_HP}</div>
    `;
    document.getElementById("screen-battle")?.appendChild(bar);
    bossHpBarEl = document.getElementById("boss-hp-fill");
    bossHpTextEl = document.getElementById("boss-hp-text");
    bossPhaseEl = document.getElementById("boss-phase-label");

    // Phase markers at 60% and 30%
    const m2 = document.getElementById("boss-hp-phase2-marker");
    const m3 = document.getElementById("boss-hp-phase3-marker");
    if (m2) m2.style.left = (CFG.PHASE2_HP_PCT * 100) + "%";
    if (m3) m3.style.left = (CFG.PHASE3_HP_PCT * 100) + "%";
  }

  function updateBossHpBar() {
    const pct = (bossHp / bossMaxHp) * 100;
    if (bossHpBarEl) bossHpBarEl.style.width = pct + "%";
    if (bossHpTextEl) bossHpTextEl.textContent = `${bossHp} / ${bossMaxHp}`;
    // Color by phase
    if (bossHpBarEl) {
      if (bossPhase === 3) bossHpBarEl.style.background = "linear-gradient(90deg, #ff0000, #ff6600)";
      else if (bossPhase === 2) bossHpBarEl.style.background = "linear-gradient(90deg, #ff6600, #ffaa00)";
    }
  }

  function updateBossPhaseLabel(text) {
    if (bossPhaseEl) bossPhaseEl.textContent = text;
  }

  function removeBossHpBar() {
    document.getElementById("boss-hp-bar")?.remove();
  }

  // ── Conveyor Belt ──────────────────────────────
  function buildConveyorBelt(plantIds) {
    // Hide normal tray
    const tray = document.getElementById("plant-tray");
    if (tray) tray.style.display = "none";

    conveyorPlants = plantIds && plantIds.length > 0 ? plantIds : [];
    if (conveyorPlants.length === 0) return;

    // Build infinite queue
    rebuildConveyorQueue();

    // Build conveyor DOM
    const belt = document.createElement("div");
    belt.id = "boss-conveyor";
    belt.innerHTML = `
      <div class="conveyor-label">🎯 BOSS BATTLE — Pick your plants!</div>
      <div class="conveyor-track" id="conveyor-track"></div>
    `;
    document.getElementById("screen-battle")?.appendChild(belt);
    conveyorEl = document.getElementById("conveyor-track");

    // Pre-fill visible slots
    for (let i = 0; i < CFG.CONVEYOR_PLANTS_VISIBLE; i++) {
      addConveyorCard();
    }
  }

  function rebuildConveyorQueue() {
    // Shuffle and repeat for infinite feel
    const shuffled = [...conveyorPlants].sort(() => Math.random() - 0.5);
    conveyorQueue = [...shuffled, ...shuffled, ...shuffled];
  }

  function addConveyorCard() {
    if (!conveyorEl) return;
    if (conveyorQueue.length === 0) rebuildConveyorQueue();
    const plantId = conveyorQueue.shift();
    const def = PlantRegistry.get(plantId);
    if (!def) return;

    const card = document.createElement("div");
    card.className = "conveyor-card";
    card.dataset.plantId = plantId;
    card.innerHTML = `
      <img src="${def.image}" alt="${def.name}"/>
      <div class="conveyor-card-name">${def.name}</div>
    `;
    card.addEventListener("click", () => {
      selectConveyorPlant(plantId, card);
    });
    conveyorEl.appendChild(card);

    // Animate in
    setTimeout(() => card.classList.add("visible"), 50);
  }

  function startConveyor() {
    // Only add new cards periodically — don't remove existing ones
    // Player picks from visible cards; picked card stays until used
    conveyorInterval = setInterval(() => {
      if (!running || paused) return;
      if (!conveyorEl) return;
      const cards = conveyorEl.querySelectorAll(".conveyor-card");
      // Keep max CONVEYOR_PLANTS_VISIBLE cards, add if below
      if (cards.length < CFG.CONVEYOR_PLANTS_VISIBLE) {
        addConveyorCard();
      }
    }, CFG.CONVEYOR_SPEED);
  }

  function selectConveyorPlant(plantId, cardEl) {
    conveyorEl?.querySelectorAll(".conveyor-card").forEach(c => c.classList.remove("selected"));
    cardEl.classList.add("selected");
    pendingPlantId = plantId;
    pendingCardEl = cardEl;
    // Tell Core which plant is selected so onCellClick works
    Core.selectPlantFree(plantId);
  }

  function restoreNormalTray() {
    document.getElementById("boss-conveyor")?.remove();
    const tray = document.getElementById("plant-tray");
    if (tray) tray.style.display = "";
    clearInterval(conveyorInterval);
  }

  // ── Helpers ────────────────────────────────────
  function flashBoss(color) {
    if (!bossEl) return;
    bossEl.style.filter = `drop-shadow(0 0 20px ${color})`;
    setTimeout(() => {
      if (bossEl) bossEl.style.filter = "";
    }, 600);
  }

  function showBossEffect(text, color) {
    const el = document.createElement("div");
    el.className = "boss-effect-text";
    el.textContent = text;
    el.style.color = color;
    document.getElementById("screen-battle")?.appendChild(el);
    setTimeout(() => el.classList.add("visible"), 50);
    setTimeout(() => {
      el.classList.remove("visible");
      setTimeout(() => el.remove(), 400);
    }, 1800);
  }

  function onPlantPlaced(plantId) {
    // Remove selected card from conveyor and add new one
    if (pendingCardEl) {
      pendingCardEl.classList.add("slide-out");
      const card = pendingCardEl;
      setTimeout(() => {
        card.remove();
        addConveyorCard();
      }, 350);
      pendingCardEl = null;
      pendingPlantId = null;
    }
  }

  function setPlacementEnabled(enabled) {
    const arena = document.getElementById("grid-container");
    if (arena) arena.style.pointerEvents = enabled ? "" : "none";
  }

  function onDemonReachedEnd(row) {
    // Boss level has no lawnmowers — demon reaching end = lose a life
    // For now just end battle
    if (running) endBossBattle(false);
  }

  function endBossBattle(won) {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    clearAllTimers();
    if (!won) {
      restoreNormalTray();
      UI.showBattleResult(false, 0, null);
      if (typeof SoundFX !== "undefined") SoundFX.stopMusic();
      Grid.clear();
      Demons.clear();
      Projectiles.clear();
      PlantRegistry.clearTimers();
    }
  }

  function clearAllTimers() {
    clearTimeout(laserTimer);
    clearTimeout(waveTimer);
    clearInterval(slamTimer);
    clearInterval(impTimer);
    clearInterval(leapTimer);
    clearInterval(phase2MoveInterval);
    clearInterval(conveyorInterval);
  }

  function pause() {
    paused = true;
  }

  function resume() {
    paused = false;
    lastTime = performance.now();
  }

  // ── Public API ─────────────────────────────────
  return {
    start,
    damageBoss,
    pause,
    resume,
    onPlantPlaced,
    isBossRunning: () => running,
  };
})();
