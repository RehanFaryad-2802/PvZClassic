/* js/core.js
   Main game loop, battle orchestration,
   sun management, plant placement, lawnmowers,
   win/lose conditions.
*/

const Core = (() => {
  // ── Battle State ───────────────────────────────
  let running = false;
  let paused = false;
  let sun = 100;
  let lastTime = 0;
  let rafId = null;

  let currentWorld = 1;
  let currentLevel = 0;
  let levelData = null;

  let selectedPlantId = null;
  let spawnQueue = [];
  let currentWaveIdx = 0;
  let waveStartTimes = {};
  let elapsed = 0;
  let allWavesSpawned = false;
  let demonsDead = 0;
  let totalDemons = 0;
  let currentTempPlants = [];

  // Lawnmower states: [row] = 'ready' | 'used' | 'gone'
  let lawnmowers = [];

  // Per-plant tray cooldown timers
  let trayCooldowns = {}; // plantId -> ms remaining

  // ── Public: Start Battle ───────────────────────
  function startBattle(worldId, levelIdx, plantIds, tempPlants = []) {
    currentWorld = worldId;
    currentLevel = levelIdx;
    levelData = Levels.getLevel(worldId, levelIdx);
    if (!levelData) return;

    // Reset state
    // Reset state
    sun = levelData.startingSun;
    running = true;
    paused = false;
    document.getElementById("pause-overlay")?.classList.add("hidden");
    elapsed = 0;
    currentWaveIdx = 0;
    waveStartTimes = { 0: 8000 }; // first wave starts after 8s
    allWavesSpawned = false;
    demonsDead = 0;
    totalDemons = 0;
    selectedPlantId = null;
    trayCooldowns = {};

    // Count total demons
    levelData.waves.forEach((w) => (totalDemons += w.demons.length));

    spawnQueue = [];
    levelData.waves.forEach((wave, wIdx) => {
      wave.demons.forEach((d) => {
        spawnQueue.push({
          ...d,
          waveIndex: wIdx,
          spawned: false,
        });
      });
    });

    // Init lawnmowers
    lawnmowers = Array(Grid.getRows()).fill("ready");
    buildLawnmowerDOM();

    // Init arena
    UI.setArenaBg(worldId);
    document.getElementById("hud-world").textContent = `W${worldId}`;
    document.getElementById("hud-level").textContent = `L${levelIdx + 1}`;

    // Init sub-systems
    const arenaEl = document.getElementById("grid-container");
    const demonsLayer = document.getElementById("demons-layer");
    const projLayer = document.getElementById("projectiles-layer");
    const effectsLayer = document.getElementById("effects-layer");

    Grid.init(arenaEl);
    Grid.clear();

    // Get arena rect after rendering
    requestAnimationFrame(() => {
      const rect = arenaEl.getBoundingClientRect();
      Demons.init(demonsLayer, effectsLayer, rect, {
        onReachedEnd: onDemonReachedEnd,
        onAllDefeated: checkVictory,
      });
      Projectiles.init(projLayer);
      Projectiles.setArenaRect(rect);
      Demons.setArenaRect(rect);
    });

    PlantRegistry.clearTimers();

    // Merge owned plants + temp plants for this level
    const allBattlePlants = [...new Set([...plantIds, ...tempPlants])];
    currentTempPlants = tempPlants;

    // Build plant tray
    UI.buildPlantTray(allBattlePlants);
    allBattlePlants.forEach((id) => {
      trayCooldowns[id] = 0;
    });

    // Show battle screen
    UI.showScreen("screen-battle");
    UI.updateSunDisplay();
    const firstWaveTypes = spawnQueue
      .filter((e) => e.waveIndex === 0)
      .map((e) => e.type);
    UI.updateWaveDisplay(1, levelData.waveCount, firstWaveTypes);
    UI.setWaveProgress(0);

    // Show demon preview before starting
    showDemonPreview(() => {
      // Start sky sun drops if level has them
      if (levelData.skyDropSun) startSkyDrops();
      // Initial wave banner
      setTimeout(() => {
        UI.showWaveBanner("Wave 1");
        startGameLoop();
      }, 800);
    });
  }

  // ── Game Loop ──────────────────────────────────
  function startGameLoop() {
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!running) return;
    if (paused) {
      rafId = requestAnimationFrame(loop);
      return;
    }

    const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = now;
    elapsed += dt * 1000;

    // Spawn demons from queue
    processSpawnQueue(elapsed);

    // Update systems
    Demons.update(dt);
    Projectiles.update(dt);
    PlantRegistry.tick(dt);
    Grid.updateFreezeTimers(dt);

    // Check victory every frame
    if (allWavesSpawned && running && Demons.getCount() === 0) {
      setTimeout(() => endBattle(true), 1200);
      allWavesSpawned = false; // prevent multiple triggers
    }

    // Update tray cooldowns
    updateTrayCooldowns(dt);

    rafId = requestAnimationFrame(loop);
  }

  function processSpawnQueue(ms) {
    // Find current active wave
    const currentWaveEntries = spawnQueue.filter(
      (e) => e.waveIndex === currentWaveIdx,
    );
    const allCurrentSpawned = currentWaveEntries.every((e) => e.spawned);

    // If current wave not fully spawned yet, spawn them by delay
    if (!allCurrentSpawned) {
      const waveStartTime = waveStartTimes[currentWaveIdx] || 0;
      for (const entry of currentWaveEntries) {
        if (entry.spawned) continue;
        if (ms >= waveStartTime + entry.spawnDelay) {
          Demons.spawn(entry);
          entry.spawned = true;
        }
      }
      return;
    }

    // Current wave fully spawned — wait for all to die before next wave
    if (Demons.getCount() > 0) return;

    // All dead, move to next wave
    const nextWaveIdx = currentWaveIdx + 1;
    if (nextWaveIdx >= levelData.waveCount) {
      if (!allWavesSpawned) {
        allWavesSpawned = true;
      }
      return;
    }

    // Start next wave after short delay
    if (!waveStartTimes[nextWaveIdx]) {
      waveStartTimes[nextWaveIdx] = ms + 3000;
      const waveNum = nextWaveIdx + 1;
      // Get demon types for next wave preview
      const nextWaveDemonTypes = spawnQueue
        .filter((e) => e.waveIndex === nextWaveIdx)
        .map((e) => e.type);
      setTimeout(() => {
        UI.showWaveBanner(`Wave ${waveNum}`);
        UI.updateWaveDisplay(waveNum, levelData.waveCount, nextWaveDemonTypes);
      }, 2800);
    }

    if (ms >= waveStartTimes[nextWaveIdx]) {
      currentWaveIdx = nextWaveIdx;
    }
  }

  function updateTrayCooldowns(dt) {
    for (const id in trayCooldowns) {
      if (trayCooldowns[id] > 0) {
        trayCooldowns[id] -= dt * 1000;
        const cdSec = Math.ceil(trayCooldowns[id] / 1000);
        UI.updateTrayCard(id, sun, trayCooldowns[id] > 0, trayCooldowns[id]);
      } else {
        UI.updateTrayCard(id, sun, false, 0);
      }
    }
  }

  // ── Plant Placement ────────────────────────────
  function selectPlant(plantId) {
    if (Grid.isShovelActive()) {
      Grid.setShovel(false);
      UI.setShovelActive(false);
    }
    if (selectedPlantId === plantId) {
      selectedPlantId = null;
      UI.setSelectedTrayCard(null);
      return;
    }
    const def = PlantRegistry.get(plantId);
    if (!def) return;
    if (sun < def.cost) {
      UI.showToast(`Need ☀️${def.cost} sun!`);
      return;
    }
    selectedPlantId = plantId;
    UI.setSelectedTrayCard(plantId);
  }

  function onCellClick(row, col) {
    if (!running || paused) return;

    if (!selectedPlantId) return;
    if (Grid.isOccupied(row, col)) {
      UI.showToast("Cell occupied!");
      return;
    }

    const def = PlantRegistry.get(selectedPlantId);
    if (!def) return;
    if (sun < def.cost) {
      UI.showToast(`Need ☀️${def.cost} sun!`);
      return;
    }

    const pp = Player.getPlant(selectedPlantId);
    const level = pp ? pp.level : 1;
    const stats = def.getStats ? def.getStats(level) : { hp: def.hp };

    const placed = Grid.placePlant(row, col, {
      ...def,
      hp: stats.hp,
      level,
    });

    if (placed) {
      spendSun(def.cost);
      // Use plant's own cooldown
      trayCooldowns[selectedPlantId] = (def.getCooldown ? def.getCooldown() : def.cooldown) || 3000;
      selectedPlantId = null;
      UI.setSelectedTrayCard(null);
    }
  }

  // ── Shovel ─────────────────────────────────────
  function toggleShovel() {
    const active = !Grid.isShovelActive();
    Grid.setShovel(active);
    UI.setShovelActive(active);
    if (active) {
      selectedPlantId = null;
      UI.setSelectedTrayCard(null);
    }
  }

  // ── Sun ────────────────────────────────────────
  function addSun(amount) {
    sun = Math.min(sun + amount, 9999);
    UI.updateSunDisplay();
  }

  function spendSun(amount) {
    sun = Math.max(0, sun - amount);
    UI.updateSunDisplay();
  }

  function getSun() {
    return sun;
  }

  // ── Lawnmowers ─────────────────────────────────
  function buildLawnmowerDOM() {
    const layer = document.getElementById("lawnmowers-layer");
    layer.innerHTML = "";
    for (let r = 0; r < Grid.getRows(); r++) {
      const el = document.createElement("div");
      el.className = "lawnmower";
      el.id = `lawnmower-${r}`;
      el.textContent = "🌿";
      layer.appendChild(el);
    }
  }

  function triggerLawnmower(row, triggerDemon) {
    if (lawnmowers[row] !== "ready") {
      // No lawnmower — game over for this row, check all rows
      if (lawnmowers.every((l) => l !== "ready")) {
        endBattle(false);
      }
      return;
    }

    lawnmowers[row] = "used";
    const el = document.getElementById(`lawnmower-${row}`);
    if (el) el.classList.add("active");

    // Kill all demons in this row
    const active = Demons.getActive();
    active.forEach((d) => {
      if (d.row === row) Demons.kill(d);
    });

    setTimeout(() => {
      lawnmowers[row] = "gone";
      if (el) {
        el.classList.remove("active");
        el.classList.add("gone");
      }
    }, 500);
  }

  // ── Win / Lose ─────────────────────────────────
  function onDemonReachedEnd(demon) {
    // Demon reached absolute left edge past lawnmowers
    triggerLawnmower(demon.row, demon);
  }

  function checkVictory() {
    if (!allWavesSpawned) return;
    if (Demons.getCount() === 0) {
      setTimeout(() => endBattle(true), 1200);
    }
  }

  // Called every frame to catch victory condition
  function checkVictoryTick() {
    if (!allWavesSpawned) return;
    if (Demons.getCount() === 0) {
      endBattle(true);
    }
  }

  function endBattle(won) {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);

    if (won) {
      const coinReward = Coins.getLevelReward(currentWorld);
      Player.addCoins(coinReward);
      Player.setLevelStars(currentWorld, currentLevel, 3);
      Levels.checkWorldUnlocks();

      // Unlock plants earned by this level
      const unlockedPlants = Levels.checkPlantUnlocks(
        currentWorld,
        currentLevel,
      );

      // Unlock minigames earned by this level
      const unlockedMinigames = Levels.checkMinigameUnlocks(
        currentWorld,
        currentLevel,
      );

      // Seed reward only to owned plants
      const seedReward = Seeds.giveRandomSeeds(2);

      UI.showBattleResult(
        true,
        coinReward,
        seedReward,
        unlockedPlants,
        unlockedMinigames,
      );
    } else {
      UI.showBattleResult(false, 0, null);
    }

    // Cleanup
    stopSkyDrops();
    // Remove any leftover sun tokens still floating on screen
    document
      .querySelectorAll(".sun-token, .sky-sun, .sun-coin, .sun-orb")
      .forEach((el) => el.remove());
    const effectsLayer = document.getElementById("effects-layer");
    if (effectsLayer) {
      effectsLayer
        .querySelectorAll(".sun-token, .sky-sun, .float-text")
        .forEach((el) => el.remove());
    }
    Grid.clear();
    Demons.clear();
    Projectiles.clear();
    PlantRegistry.clearTimers();
  }

  // ── Pause ──────────────────────────────────────
  function pause() {
    paused = true;
    document.getElementById("pause-overlay").classList.remove("hidden");
  }

  function resume() {
    paused = false;
    lastTime = performance.now();
    document.getElementById("pause-overlay").classList.add("hidden");
  }

  // ── Sky Sun Drops ──────────────────────────────
  // ── Demon Preview ──────────────────────────────
  function showDemonPreview(onDone) {
    const overlay = document.getElementById("demon-preview-overlay");
    const list = document.getElementById("dp-demons-list");
    const cdEl = document.getElementById("dp-countdown");
    const skipBtn = document.getElementById("dp-skip");
    if (!overlay || !list) {
      onDone();
      return;
    }

    // Collect all unique demon types in this level
    const typeCounts = {};
    levelData.waves.forEach((wave) => {
      wave.demons.forEach((d) => {
        typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
      });
    });

    // Build display list — minimum 5 icons total (repeat if needed)
    const types = Object.keys(typeCounts);
    let icons = types.map((t) => ({ type: t, count: typeCounts[t] }));

    // If fewer than 5 unique types, repeat to fill minimum 5 slots
    while (icons.length < 5) {
      icons = [...icons, ...icons].slice(0, Math.max(5, icons.length * 2));
    }

    // Build icons with staggered animation
    list.innerHTML = "";
    icons.forEach((entry, i) => {
      const stats = Levels.getDemonStats(entry.type);
      if (!stats) return;
      const icon = document.createElement("div");
      icon.className = "dp-demon-icon";
      icon.style.animationDelay = i * 0.08 + "s";
      icon.innerHTML = `
        <img src="${stats.image}" alt="${stats.name}" />
        <div class="dp-demon-name">${stats.name}</div>
        ${entry.count > 1 ? `<div class="dp-demon-count">×${entry.count}</div>` : ""}
      `;
      list.appendChild(icon);
    });

    overlay.classList.remove("hidden");

    // Countdown 5..1
    let count = 5;
    cdEl.textContent = count;
    const cdTimer = setInterval(() => {
      count--;
      cdEl.textContent = count;
      if (count <= 0) finish();
    }, 1000);

    function finish() {
      clearInterval(cdTimer);
      overlay.classList.add("hidden");
      skipBtn.removeEventListener("click", finish);
      onDone();
    }

    skipBtn.addEventListener("click", finish, { once: true });
  }

  // ── Sky Sun Drops ──────────────────────────────
  let skyDropTimer = null;

  function startSkyDrops() {
    // Pause drops when tab hidden, resume when visible
    document.addEventListener("visibilitychange", onVisibilityChange);
    scheduleDrop();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      clearTimeout(skyDropTimer);
      skyDropTimer = null;
    } else {
      if (running && !paused && !skyDropTimer) {
        scheduleDrop();
      }
    }
  }

  function scheduleDrop() {
    if (document.hidden) return;
    const delay = (10 + Math.random() * 9) * 1000;
    skyDropTimer = setTimeout(() => {
      if (!running || paused || document.hidden) {
        if (!document.hidden) scheduleDrop();
        return;
      }
      spawnSkySun();
      scheduleDrop();
    }, delay);
  }

  function spawnSkySun() {
    const arena = document.getElementById("grid-container");
    const effectsEl = document.getElementById("effects-layer");
    if (!arena || !effectsEl) return;

    const aRect = arena.getBoundingClientRect();
    const arenaParentRect = effectsEl.getBoundingClientRect();

    const x =
      Math.random() * (aRect.width - 40) + (aRect.left - arenaParentRect.left);
    const endY = Math.random() * (aRect.height - 60) + 20;

    const token = document.createElement("div");
    token.className = "sun-token sky-sun";
    token.textContent = "☀️";
    token.style.left = x + "px";
    token.style.top = "-40px";
    token.style.transition = "top 2s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    token.style.position = "absolute";
    token.style.zIndex = "100";
    token.style.pointerEvents = "all";
    effectsEl.appendChild(token);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        token.style.top = endY + "px";
      });
    });

    let collected = false;
    function collectSun() {
      if (collected) return;
      collected = true;

      // Fly to sun display in top left HUD
      const sunEl = document.getElementById("hud-sun");
      const effectsEl = document.getElementById("effects-layer");
      const effectsRect = effectsEl
        ? effectsEl.getBoundingClientRect()
        : { left: 0, top: 0 };
      const sunRect = sunEl ? sunEl.getBoundingClientRect() : null;

      const targetX = sunRect
        ? sunRect.left - effectsRect.left + sunRect.width / 2 - 28
        : 0;
      const targetY = sunRect
        ? sunRect.top - effectsRect.top + sunRect.height / 2 - 28
        : 0;

      token.style.transition =
        "left 0.5s cubic-bezier(0.4,0,0.2,1), top 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s, opacity 0.5s";
      token.style.left = targetX + "px";
      token.style.top = targetY + "px";
      token.style.transform = "scale(0.3)";
      token.style.opacity = "0.6";

      setTimeout(() => {
        Core.addSun(25);
        UI.updateSunDisplay();
        // Flash sun display
        if (sunEl) {
          sunEl.style.transition = "transform 0.15s";
          sunEl.style.transform = "scale(1.4)";
          setTimeout(() => {
            sunEl.style.transform = "scale(1)";
          }, 150);
        }
        if (token.parentNode) token.remove();
      }, 500);
    }

    token.addEventListener("pointerdown", collectSun, { once: true });
    token.addEventListener("pointerenter", collectSun, { once: true });
    token.addEventListener("mouseover", collectSun, { once: true });
    setTimeout(() => {
      if (!collected) collectSun();
    }, 9000);
  }

  function stopSkyDrops() {
    clearTimeout(skyDropTimer);
    skyDropTimer = null;
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  return {
    startBattle,
    endBattle,
    onCellClick,
    selectPlant,
    toggleShovel,
    addSun,
    spendSun,
    getSun,
    triggerLawnmower,
    pause,
    resume,
  };
})();
