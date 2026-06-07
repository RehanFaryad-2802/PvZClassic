/* js/boss.js — Boss battle system */

const Boss = (() => {

  const CFG = {
    BOSS_HP: 15000,
    ENTRY_COL: 8,
    PHASE2_HP_PCT: 0.60,
    PHASE3_HP_PCT: 0.30,
    LASER_INTERVAL_MIN: 10000,
    LASER_INTERVAL_MAX: 18000,
    LASER_DURATION: 1200,
    WAVE_INTERVAL_MIN: 8000,
    WAVE_INTERVAL_MAX: 14000,
    DEMONS_PER_WAVE_MIN: 3,
    DEMONS_PER_WAVE_MAX: 7,
    PHASE3_SLAM_INTERVAL: 4000,
    PHASE3_IMP_INTERVAL: 8000,
    PHASE3_LEAP_INTERVAL: 6000,
    CONVEYOR_SPEED: 3000,
    CONVEYOR_MAX_VISIBLE: 10,
    ENTRY_CHARGE_DURATION: 3000,
    BOSS_IMAGE: "assets/demons/boss_w1.png",
    BOSS_NAME: "Inferno Warlord",
    COIN_REWARD: 500,
  };

  let bossEl = null;
  let bossHp = CFG.BOSS_HP;
  let bossMaxHp = CFG.BOSS_HP;
  let bossPhase = 1;
  let bossRow = 1;
  let bossX = 0;
  let bossY = 0;
  let worldId = 1;
  let levelIdx = 30;
  let conveyorPlants = [];
  let conveyorQueue = [];
  let conveyorEl = null;
  let conveyorInterval = null;
  let bossHpFillEl = null;
  let bossHpTextEl = null;
  let bossPhaseEl = null;
  let gridRows = 5;
  let gridCols = 9;
  let cellW = 0;
  let cellH = 0;
  let arenaRect = null;
  let running = false;
  let paused = false;
  let laserTimer = null;
  let waveTimer = null;
  let slamTimer = null;
  let impTimer = null;
  let leapTimer = null;
  let phase2MoveInterval = null;
  let pendingPlantId = null;
  let pendingCardEl = null;
  let lastTime = 0;
  let rafId = null;

  // ── Entry ──────────────────────────────────────
  function start(wId, lvlIdx, lvlData, plantIds) {
    worldId = wId;
    levelIdx = lvlIdx;
    conveyorPlants = plantIds || [];

    running = true;
    paused = false;
    bossHp = CFG.BOSS_HP;
    bossMaxHp = CFG.BOSS_HP;
    bossPhase = 1;

    const arenaEl = document.getElementById("grid-container");
    const demonsLayer = document.getElementById("demons-layer");
    const effectsLayer = document.getElementById("effects-layer");
    const projLayer = document.getElementById("projectiles-layer");

    Demons.clear();
    Grid.clear();
    if (demonsLayer) demonsLayer.innerHTML = "";
    if (effectsLayer) {
      effectsLayer.querySelectorAll(
        ".demon-hp-wrap,.float-text,.sun-token,.sky-sun"
      ).forEach(e => e.remove());
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
        onAllDefeated: () => {
          // Re-register boss so list never truly empties
          if (running) registerBossAsTarget();
        },
      });
      Projectiles.init(projLayer);
      Projectiles.setArenaRect(arenaRect);
      Demons.setArenaRect(arenaRect);

      UI.setArenaBg && UI.setArenaBg(worldId);
      const hudWorld = document.getElementById("hud-world");
      const hudLevel = document.getElementById("hud-level");
      if (hudWorld) hudWorld.textContent = `W${worldId}`;
      if (hudLevel) hudLevel.textContent = `Boss`;
      const waveEl = document.getElementById("hud-wave");
      if (waveEl) waveEl.style.display = "none";

      UI.showScreen("screen-battle");
      buildBossHpBar();

      // Build conveyor but DON'T fill cards yet
      buildConveyorBelt(conveyorPlants);

      setPlacementEnabled(false);
      entrySequence();
    });
  }

  // ── Entry sequence ─────────────────────────────
  function entrySequence() {
    const overlay = document.createElement("div");
    overlay.id = "boss-entry-overlay";
    overlay.innerHTML = `
      <div class="boss-entry-title">⚠️ BOSS APPROACHING ⚠️</div>
      <div class="boss-entry-name">${CFG.BOSS_NAME}</div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("visible"), 100);

    spawnBossElement();

    setTimeout(() => {
      overlay.classList.remove("visible");
      setTimeout(() => overlay.remove(), 500);
      walkBossToEntryCol(() => {
        bossPowerCharge(() => {
          // Now enable placement and start filling conveyor
          setPlacementEnabled(true);
          fillConveyorOneByOne();
          startPhase1();
          startGameLoop();
          if (typeof SoundFX !== "undefined") SoundFX.playMusic && SoundFX.playMusic(worldId);
        });
      });
    }, 1500);
  }

  // ── Boss element ───────────────────────────────
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

    bossRow = Math.floor(gridRows / 2) - 1;
    const startX = arenaRect.width + 20;

    // Get Y from actual row DOM element like demons do
    const demonsLayerEl = document.getElementById("demons-layer");
    const layerRect = demonsLayerEl ? demonsLayerEl.getBoundingClientRect() : null;
    const rowEl = document.querySelector(`.grid-row[data-row="${bossRow}"]`);
    let y = bossRow * cellH;
    if (rowEl && layerRect) {
      const rowRect = rowEl.getBoundingClientRect();
      y = rowRect.top - layerRect.top;
    }

    // Use grid rect for accurate cell size
    const gridEl2 = document.getElementById("grid-container");
    const gridRect2 = gridEl2 ? gridEl2.getBoundingClientRect() : null;
    const realCellH = gridRect2 ? gridRect2.height / gridRows : cellH;
    const realCellW = gridRect2 ? gridRect2.width  / gridCols : cellW;

    const bossH = realCellH * 2;
    const bossW = realCellW * 2;

    bossEl.style.cssText = `
      position:absolute;
      left:${startX}px;
      top:${y}px;
      width:${bossW}px;
      height:${bossH}px;
      z-index:50;
    `;

    bossY = y;

    demonsLayer.appendChild(bossEl);
    bossX = startX;
    bossY = y;
  }

  function walkBossToEntryCol(onDone) {
    if (!bossEl) return onDone();
    const targetX = CFG.ENTRY_COL * cellW;
    bossEl.classList.add("boss-walking");
    bossEl.style.transition = "left 2.5s linear";
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
    const iv = setInterval(() => {
      pct += 2;
      if (fillEl) fillEl.style.width = pct + "%";
      if (pctEl) pctEl.textContent = pct + "%";
      if (pct >= 100) {
        clearInterval(iv);
        bossEl.classList.remove("boss-charging");
        bossEl.classList.add("boss-roar");
        document.getElementById("screen-battle")?.classList.add("screen-shake");
        setTimeout(() => {
          document.getElementById("screen-battle")?.classList.remove("screen-shake");
          bossEl?.classList.remove("boss-roar");
          chargeEl.classList.remove("visible");
          setTimeout(() => chargeEl.remove(), 400);
          onDone();
        }, 800);
      }
    }, CFG.ENTRY_CHARGE_DURATION / 50);
  }

  // ── Game loop ──────────────────────────────────
  function startGameLoop() {
    lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  }

  function gameLoop(now) {
    if (!running) return;
    if (paused) { rafId = requestAnimationFrame(gameLoop); return; }
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    syncBossTarget();
    Demons.update(dt);
    Projectiles.update(dt);
    PlantRegistry.tick(dt);
    Grid.updateFreezeTimers && Grid.updateFreezeTimers(dt);
    rafId = requestAnimationFrame(gameLoop);
  }

  function syncBossTarget() {
    if (!bossEl) return;
    const all = Demons.getAll();
    const target = all.find(d => d.isBoss);
    if (!target) return;
    target.hp = bossHp;
    target.maxHp = bossMaxHp;
    target.x = bossX;
    target.y = bossY;
    target.row = bossRow;
    target.dead = bossHp <= 0;
    target.el = bossEl;
  }

  // ── Register boss as hittable target ──────────
  function registerBossAsTarget() {
    if (!bossEl) return;
    // Remove old entry
    const all = Demons.getAll();
    const existing = all.find(d => d.isBoss);
    if (existing) {
      existing.hp = bossHp;
      existing.dead = bossHp <= 0;
      return;
    }
    const fakeDemon = {
      id: "boss_target",
      isBoss: true,
      el: bossEl,
      hp: bossHp,
      maxHp: bossMaxHp,
      dead: false,
      row: bossRow,
      x: bossX,
      y: bossY,
      currentSpeed: 0,
      type: "boss",
      targeting: null,
      special: [],
      hpWrap: null,
      takeDamage(amount) {
        if (this.dead) return;
        damageBoss(amount);
        this.hp = bossHp;
        if (bossHp <= 0) this.dead = true;
      },
    };
    Demons.registerBossTarget(fakeDemon);
  }

  // ── Phase 1 ────────────────────────────────────
  function startPhase1() {
    bossPhase = 1;
    updateBossPhaseLabel("Phase 1");
    bossEl?.classList.add("boss-idle");
    registerBossAsTarget();
    scheduleLaser();
    sendDemonWave(); // immediate first wave
    scheduleDemonWave();
  }

  // ── Phase 2 ────────────────────────────────────
  function enterPhase2() {
    if (bossPhase >= 2) return;
    bossPhase = 2;
    updateBossPhaseLabel("Phase 2 — ADVANCING");
    bossEl?.classList.remove("boss-idle");
    bossEl?.classList.add("boss-phase2");
    flashBoss("#ff6600");
    moveBossToPlantSide();
  }

  function moveBossToPlantSide() {
    if (!bossEl || !arenaRect) return;
    // Walk step by step so bossX stays accurate
    let targetX = 0;
    const duration = 5000;
    const startX = bossX;
    const startTime = performance.now();

    function step(now) {
      if (!running || bossPhase < 2) return;
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      bossX = startX + (targetX - startX) * t;
      if (bossEl) bossEl.style.left = bossX + "px";
      killPlantsInBossRows();
      if (t < 1) requestAnimationFrame(step);
      else {
        // Stay and keep killing
        phase2MoveInterval = setInterval(() => {
          if (!running) return clearInterval(phase2MoveInterval);
          killPlantsInBossRows();
        }, 400);
      }
    }
    requestAnimationFrame(step);
  }

  function killPlantsInBossRows() {
    const col = Math.round(bossX / cellW);
    for (let r = bossRow; r <= bossRow + 1 && r < gridRows; r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(gridCols - 1, col + 1); c++) {
        const plantEl = document.querySelector(`.plant-entity[data-row="${r}"][data-col="${c}"]`);
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
    slamTimer = setInterval(() => { if (running) groundSlam(); }, CFG.PHASE3_SLAM_INTERVAL);
    impTimer  = setInterval(() => { if (running) spawnImp(); },   CFG.PHASE3_IMP_INTERVAL);
    leapTimer = setInterval(() => { if (running) wingLeap(); },   CFG.PHASE3_LEAP_INTERVAL);
  }

  function groundSlam() {
    if (!bossEl) return;
    bossEl.classList.add("boss-slam");
    showBossEffect("💥 GROUND SLAM!", "#ff4400");
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
    const targetX = Math.max(0, bossX - cellW * 2);
    bossX = targetX;
    bossEl.style.transition = "left 0.4s ease-in";
    bossEl.style.left = targetX + "px";
    setTimeout(() => {
      bossEl?.classList.remove("boss-leap");
      bossEl.style.transition = "";
    }, 500);
  }

  function spawnImp() {
    const row = Math.floor(Math.random() * gridRows);
    Demons.spawn({ type: "imp", row, spawnDelay: 0 });
  }

  // ── Laser ──────────────────────────────────────
  function scheduleLaser() {
    if (!running) return;
    const delay = CFG.LASER_INTERVAL_MIN +
      Math.random() * (CFG.LASER_INTERVAL_MAX - CFG.LASER_INTERVAL_MIN);
    laserTimer = setTimeout(() => {
      if (!running) return;
      fireLaser();
      scheduleLaser();
    }, delay);
  }

  function fireLaser() {
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
        setTimeout(() => pos.el?.remove(), CFG.LASER_DURATION - 100);
      }, i * 400);
    });
  }

  function showLaserBeam(row, col) {
    const effectsLayer = document.getElementById("effects-layer");
    if (!effectsLayer || !arenaRect) return;
    const eRect = effectsLayer.getBoundingClientRect();
    const targetX = arenaRect.left - eRect.left + col * cellW + cellW / 2;
    const targetY = arenaRect.top  - eRect.top  + row * cellH + cellH / 2;
    const startX  = arenaRect.left - eRect.left + bossX + cellW * 0.5;
    const startY  = arenaRect.top  - eRect.top  + bossY + cellH;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle  = Math.atan2(dy, dx) * 180 / Math.PI;

    const beam = document.createElement("div");
    beam.className = "boss-laser-beam";
    beam.style.cssText = `left:${startX}px;top:${startY - 3}px;width:${length}px;transform:rotate(${angle}deg)`;
    effectsLayer.appendChild(beam);

    const flash = document.createElement("div");
    flash.className = "boss-laser-impact";
    flash.style.cssText = `left:${targetX - 20}px;top:${targetY - 20}px`;
    effectsLayer.appendChild(flash);

    setTimeout(() => { beam.remove(); flash.remove(); }, CFG.LASER_DURATION);
  }

  // ── Demon waves ────────────────────────────────
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
    // Refresh layer and rect so spawn() never fails
    const gridEl = document.getElementById("grid-container");
    const demonsLayerEl = document.getElementById("demons-layer");
    const effectsLayerEl = document.getElementById("effects-layer");
    if (gridEl) {
      arenaRect = gridEl.getBoundingClientRect();
      Demons.setArenaRect(arenaRect);
    }
    // Re-init Demons layer reference if needed
    if (demonsLayerEl && effectsLayerEl) {
      Demons.setLayer(demonsLayerEl, effectsLayerEl);
    }

    const world = Levels.getWorld(worldId);
    const available = (world && world.demons) ? world.demons.filter(d => d !== "imp_king") : ["imp"];
    const count = CFG.DEMONS_PER_WAVE_MIN +
      Math.floor(Math.random() * (CFG.DEMONS_PER_WAVE_MAX - CFG.DEMONS_PER_WAVE_MIN));
    showBossEffect("💀 INCOMING!", "#cc0000");
    for (let i = 0; i < count; i++) {
      const type = available[Math.floor(Math.random() * available.length)];
      const row  = Math.floor(Math.random() * gridRows);
      setTimeout(() => {
        if (!running) return;
        Demons.spawn({ type, row, spawnDelay: 0 });
      }, i * 350);
    }
  }

  // ── Boss HP & damage ───────────────────────────
  function damageBoss(amount) {
    if (!running) return;
    bossHp = Math.max(0, bossHp - amount);
    updateBossHpBar();
    const pct = bossHp / bossMaxHp;
    if (pct <= CFG.PHASE3_HP_PCT && bossPhase < 3) enterPhase3();
    else if (pct <= CFG.PHASE2_HP_PCT && bossPhase < 2) enterPhase2();
    if (bossHp <= 0) bossDeath();
  }

  function bossDeath() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    clearAllTimers();
    bossEl?.classList.add("boss-death");
    showBossEffect("💀 DEFEATED!", "#ffff00");
    document.getElementById("screen-battle")?.classList.add("screen-shake");

    setTimeout(() => {
      bossEl?.remove();
      document.getElementById("screen-battle")?.classList.remove("screen-shake");
      removeBossHpBar();
      restoreNormalTray();
      Player.addCoins(CFG.COIN_REWARD);
      Player.setLevelStars(worldId, levelIdx, 3);
      Levels.checkWorldUnlocks();
      const contents = Levels.generatePacketContents(worldId);
      const packetId = "minipacket_boss_" + Date.now();
      Player.addInventoryItem(packetId, 1, { type: "minipacket", worldId, contents });
      UI.showBattleResult(true, CFG.COIN_REWARD, null, null, null, { packetId, contents });
      if (typeof SoundFX !== "undefined" && SoundFX.stopMusic) SoundFX.stopMusic();
      Grid.clear();
      Demons.clear();
      Projectiles.clear();
      PlantRegistry.clearTimers && PlantRegistry.clearTimers();
    }, 1800);
  }

  // ── Boss HP bar ────────────────────────────────
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
    bossHpFillEl = document.getElementById("boss-hp-fill");
    bossHpTextEl = document.getElementById("boss-hp-text");
    bossPhaseEl  = document.getElementById("boss-phase-label");
    const m2 = document.getElementById("boss-hp-phase2-marker");
    const m3 = document.getElementById("boss-hp-phase3-marker");
    if (m2) m2.style.left = (CFG.PHASE2_HP_PCT * 100) + "%";
    if (m3) m3.style.left = (CFG.PHASE3_HP_PCT * 100) + "%";
  }

  function updateBossHpBar() {
    const pct = (bossHp / bossMaxHp) * 100;
    if (bossHpFillEl) bossHpFillEl.style.width = pct + "%";
    if (bossHpTextEl) bossHpTextEl.textContent = `${Math.max(0,bossHp)} / ${bossMaxHp}`;
    if (bossHpFillEl) {
      if (bossPhase === 3) bossHpFillEl.style.background = "linear-gradient(90deg,#ff0000,#ff6600)";
      else if (bossPhase === 2) bossHpFillEl.style.background = "linear-gradient(90deg,#ff6600,#ffaa00)";
    }
  }

  function updateBossPhaseLabel(text) {
    if (bossPhaseEl) bossPhaseEl.textContent = text;
  }

  function removeBossHpBar() {
    document.getElementById("boss-hp-bar")?.remove();
  }
// ── Conveyor belt (PvZ2 style) ─────────────────
  // Plants continuously slide from right to left on a belt.
  // Player clicks/taps a plant card to pick it up.
  // After picking, card slides off left and a new one enters from right.

  let beltCards = [];     // active card elements
  let beltAnimId = null;  // rAF id for belt animation
  let beltOffset = 0;     // current scroll offset in px
  const CARD_W = 72;      // card width + gap
  const CARD_GAP = 10;
  const CARD_TOTAL = CARD_W + CARD_GAP;
  const BELT_SPEED = 30;  // px per second
  const BELT_MAX = 10;    // max cards on belt

  function buildConveyorBelt(plantIds) {
    const tray = document.getElementById("plant-tray");
    if (tray) tray.style.display = "none";

    const filtered = (plantIds || []).filter(id => id !== "sunflower");
    conveyorPlants = filtered.length > 0 ? filtered : (plantIds || []);
    rebuildConveyorQueue();

    const belt = document.createElement("div");
    belt.id = "boss-conveyor";
    belt.innerHTML = `
      <div class="conveyor-label">🎯 BOSS BATTLE</div>
      <div class="conveyor-viewport" id="conveyor-viewport">
        <div class="conveyor-track" id="conveyor-track"></div>
      </div>
    `;
    document.getElementById("screen-battle")?.appendChild(belt);
    conveyorEl = document.getElementById("conveyor-track");
    // Cards added after battle starts
  }

  function fillConveyorOneByOne() {
    let added = 0;
    function addNext() {
      if (!running) return;
      addConveyorCard();
      added++;
      if (added < BELT_MAX) {
        setTimeout(addNext, 3000);
      } else {
        startBeltAnimation();
      }
    }
    setTimeout(addNext, 500);
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
    card.style.transform = "translateX(300px)";
    card.style.opacity = "0";
    card.innerHTML = `
      <img src="${def.image}" alt="${def.name}"/>
      <div class="conveyor-card-name">${def.name}</div>
    `;
    card.addEventListener("click", () => selectConveyorPlant(plantId, card));
    conveyorEl.appendChild(card);
    beltCards.push(card);

    // Slide in from right
    requestAnimationFrame(() => {
      card.style.transition = "transform 0.5s ease-out, opacity 0.3s";
      card.style.transform = "translateX(0)";
      card.style.opacity = "1";
    });
  }

  function startBeltAnimation() {
    let lastT = performance.now();
    function animateBelt(now) {
      if (!running) return;
      const dt = (now - lastT) / 1000;
      lastT = now;

      if (!paused && conveyorEl) {
        beltOffset += BELT_SPEED * dt;

        // Move all cards left by beltOffset
        beltCards.forEach((card, i) => {
          if (!card.parentNode) return;
          const baseX = i * CARD_TOTAL;
          const newX = baseX - beltOffset;
          card.style.transition = "none";
          card.style.transform = `translateX(${newX}px)`;
          card.style.opacity = "1";

          // Card went off left edge — remove and add new from right
          if (newX < -(CARD_TOTAL)) {
            card.remove();
            beltCards.splice(i, 1);
            // Add new card at end
            if (running) addConveyorCard();
            beltOffset = 0; // reset offset after shift
          }
        });
      }
      beltAnimId = requestAnimationFrame(animateBelt);
    }
    beltAnimId = requestAnimationFrame(animateBelt);
  }

  // ── Helpers ────────────────────────────────────
  function flashBoss(color) {
    if (!bossEl) return;
    bossEl.style.filter = `drop-shadow(0 0 20px ${color}) brightness(1.5)`;
    setTimeout(() => { if (bossEl) bossEl.style.filter = ""; }, 600);
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

  function setPlacementEnabled(enabled) {
    const arena = document.getElementById("grid-container");
    if (arena) arena.style.pointerEvents = enabled ? "" : "none";
  }

  function onDemonReachedEnd(row) {
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
      if (typeof SoundFX !== "undefined" && SoundFX.stopMusic) SoundFX.stopMusic();
      Grid.clear();
      Demons.clear();
      Projectiles.clear();
      PlantRegistry.clearTimers && PlantRegistry.clearTimers();
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
    if (beltAnimId) cancelAnimationFrame(beltAnimId);
  }
  function pause()  { paused = true; }
  function resume() { paused = false; lastTime = performance.now(); }

  return {
    start,
    damageBoss,
    pause,
    resume,
    onPlantPlaced,
    isBossRunning: () => running,
  };
})();
