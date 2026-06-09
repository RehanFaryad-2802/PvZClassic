/* js/boosts.js
   Core boost engine.
   Handles: inventory, pre-battle popup, applying effects,
   sun rush sky drops, timed expiry, and cleanup.

   Dependencies: BoostRegistry, Player, Core, UI, Effects
   Hooked into: Core.startBattle (via Boosts.showPreBattlePopup)
                Core.endBattle  (via Boosts.clearBattle)
                Core.addSun     (no change needed — Boosts patches internally)
*/

const Boosts = (() => {

  // ── Active battle state ───────────────────────────────────────────────
  let activeBattleBoosts = [];   // [{ def, timeLeft }]  timeLeft = Infinity for whole-battle
  let sunRushTimer   = null;     // setInterval handle
  let battleCoinMult = 1;        // set by double_harvest
  let battleDamageMult = 1;      // set by plant_fury
  let pendingWorldId = 1;
  let pendingLevelIdx = 0;
  let pendingPlantIds = [];
  let pendingTempPlants = [];

  // ── Inventory helpers ─────────────────────────────────────────────────
  // Boosts are stored in player inventory as items with type "boost"
  // key: boostId,  value: quantity

  function getInventory() {
    // Returns { boostId: count, ... } for all boosts the player owns
    const inv = Player.getFullInventory ? Player.getFullInventory() : {};
    const result = {};
    for (const key in inv) {
      const item = inv[key];
      if (item && item.meta && item.meta.type === "boost") {
        result[key] = item.qty || 0;
      }
    }
    return result;
  }

  function getCount(boostId) {
    const inv = getInventory();
    return inv[boostId] || 0;
  }

  function addBoost(boostId, qty = 1) {
    Player.addInventoryItem(boostId, qty, { type: "boost" });
  }

  function consumeBoost(boostId) {
    return Player.removeInventoryItem(boostId, 1);
  }

  // ── Pre-battle Popup ──────────────────────────────────────────────────
  // Called from UI.openPlantPicker just before Core.startBattle
  function showPreBattlePopup(worldId, levelIdx, plantIds, tempPlants) {
    pendingWorldId   = worldId;
    pendingLevelIdx  = levelIdx;
    pendingPlantIds  = plantIds;
    pendingTempPlants = tempPlants;

    _buildPopup();
  }

  function _buildPopup() {
    // Remove old popup if exists
    document.getElementById("boost-popup")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "boost-popup";
    overlay.className = "boost-popup-overlay";

    // All available boost types (excluding sun_rush levels — handled separately)
    const nonSunBoosts = ["plant_fury", "iron_bark", "freeze_wave", "double_harvest"];

    // Build sun rush section — show highest level bottle the player owns
    const sunRushLevels = BoostRegistry.getSunRushLevels();
    let ownedSunRush = null;
    for (let i = sunRushLevels.length - 1; i >= 0; i--) {
      if (getCount(sunRushLevels[i].id) > 0) {
        ownedSunRush = sunRushLevels[i];
        break;
      }
    }

    // Build other boost cards
    const otherCards = nonSunBoosts.map(id => {
      const def = BoostRegistry.get(id);
      if (!def) return "";
      const qty = getCount(id);
      return `
        <div class="boost-card ${qty === 0 ? "boost-empty" : ""}" data-boost-id="${id}">
          <div class="boost-icon">${_iconHtml(def)}</div>
          <div class="boost-name">${def.name}</div>
          <div class="boost-qty">×${qty}</div>
          <div class="boost-desc">${def.description}</div>
          ${qty > 0 ? `<button class="boost-use-btn" data-id="${id}">Use</button>` : `<div class="boost-none-label">None</div>`}
        </div>
      `;
    }).join("");

    // Sun rush section
    const sunSection = `
      <div class="boost-sun-section">
        <div class="boost-section-title">☀️ Sun Rush Bottle</div>
        ${ownedSunRush ? `
          <div class="boost-card boost-sun-card" data-boost-id="${ownedSunRush.id}">
            <div class="boost-icon">${_iconHtml(ownedSunRush)}</div>
            <div class="boost-name">${ownedSunRush.name}</div>
            <div class="boost-qty">×${getCount(ownedSunRush.id)}</div>
            <div class="boost-desc">${ownedSunRush.description}</div>
            <div class="boost-sun-levels">
              ${sunRushLevels.map(s => `
                <div class="sun-lvl-pip ${s.id === ownedSunRush.id ? "active" : ""}" title="${s.name}">
                  ${s.level}
                </div>`).join("")}
            </div>
            <button class="boost-use-btn" data-id="${ownedSunRush.id}">Use</button>
          </div>
        ` : `<div class="boost-card boost-empty"><div class="boost-none-label">No Sun Rush bottles</div></div>`}
      </div>
    `;

    overlay.innerHTML = `
      <div class="boost-popup-box">
        <div class="boost-popup-title">⚡ Battle Boosts</div>
        <div class="boost-popup-sub">Select one boost to use this battle</div>
        <div class="boost-selected-display" id="bp-selected-display">None selected</div>

        ${sunSection}

        <div class="boost-section-title">Battle Boosts</div>
        <div class="boost-cards-row" id="bp-cards-row">
          ${otherCards}
        </div>

        <div class="boost-popup-actions">
          <button class="bp-btn bp-btn-skip" id="bp-skip">Skip</button>
          <button class="bp-btn bp-btn-start" id="bp-start">Start Battle</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Track selected boost
    let selectedBoostId = null;

    overlay.querySelectorAll(".boost-card[data-boost-id]").forEach(card => {
      if (card.classList.contains("boost-empty")) return;
      card.addEventListener("click", () => {
        const id = card.dataset.boostId;
        overlay.querySelectorAll(".boost-card").forEach(c => c.classList.remove("boost-selected"));
        if (selectedBoostId === id) {
          selectedBoostId = null;
          document.getElementById("bp-selected-display").textContent = "None selected";
        } else {
          selectedBoostId = id;
          card.classList.add("boost-selected");
          const def = BoostRegistry.get(id);
          document.getElementById("bp-selected-display").innerHTML =
            `<span class="bp-sel-icon">${_iconHtml(def)}</span> <b>${def.name}</b> — ${def.description}`;
        }
      });
    });

    document.getElementById("bp-skip").addEventListener("click", () => {
      overlay.remove();
      _launchBattle(null);
    });

    document.getElementById("bp-start").addEventListener("click", () => {
      overlay.remove();
      _launchBattle(selectedBoostId);
    });
  }

  function _iconHtml(def) {
    // Use image if asset exists, fall back to emoji
    return `<span class="boost-fallback-icon">${def.fallbackIcon || "⚡"}</span>`;
  }

  // ── Launch Battle with optional boost ────────────────────────────────
  function _launchBattle(boostId) {
    activeBattleBoosts = [];
    battleCoinMult   = 1;
    battleDamageMult = 1;

    if (boostId) {
      const def = BoostRegistry.get(boostId);
      if (def && consumeBoost(boostId)) {
        _applyBoost(def);
      }
    }

    Core.startBattle(pendingWorldId, pendingLevelIdx, pendingPlantIds, pendingTempPlants);
  }

  // ── Apply a boost effect ──────────────────────────────────────────────
  function _applyBoost(def) {
    const eff = def.effect;

    // Sun Rush — start interval drops
    if (eff.sunRush) {
      _startSunRushDrops(eff.sunDropValue, eff.dropInterval);
      activeBattleBoosts.push({ def, timeLeft: Infinity });
      _showBoostBanner(def);
      return;
    }

    // Plant Fury — stored, read by getDamageMult()
    if (eff.damageMult) {
      battleDamageMult = eff.damageMult;
      activeBattleBoosts.push({ def, timeLeft: eff.duration });
      _startBoostHUD(def, eff.duration);
      _showBoostBanner(def);
    }

    // Iron Bark — apply HP mult to all plants currently on grid at battle start
    // (called after startBattle places initial grid — so we hook via a small delay)
    if (eff.hpMult) {
      activeBattleBoosts.push({ def, timeLeft: Infinity });
      _showBoostBanner(def);
      // Applied in applyIronBarkToGrid() called from Core hook
    }

    // Freeze Wave
    if (eff.demonSpeedMult) {
      activeBattleBoosts.push({ def, timeLeft: eff.duration });
      _startBoostHUD(def, eff.duration);
      _showBoostBanner(def);
      // Applied continuously via getDemonSpeedMult()
    }

    // Double Harvest
    if (eff.coinMult) {
      battleCoinMult = eff.coinMult;
      activeBattleBoosts.push({ def, timeLeft: Infinity });
      _showBoostBanner(def);
    }
  }

  // ── Sun Rush sky drops ────────────────────────────────────────────────
  function _startSunRushDrops(sunValue, intervalMs) {
    if (sunRushTimer) clearInterval(sunRushTimer);
    sunRushTimer = setInterval(() => {
      if (!Core.isRunning || !Core.isRunning()) return;
      _spawnSunRushDrop(sunValue);
    }, intervalMs);
  }

  function _spawnSunRushDrop(value) {
    const arena = document.getElementById("grid-container");
    const effectsEl = document.getElementById("effects-layer");
    if (!arena || !effectsEl) return;

    const aRect = arena.getBoundingClientRect();
    const parentRect = effectsEl.getBoundingClientRect();

    const x = Math.random() * (aRect.width - 50) + (aRect.left - parentRect.left);
    const endY = Math.random() * (aRect.height - 80) + 20;

    const token = document.createElement("div");
    token.className = "sun-token sky-sun sun-rush-drop";
    token.innerHTML = `<span class="sun-rush-glow">☀️</span><span class="sun-rush-value">+${value}</span>`;
    token.style.left = x + "px";
    token.style.top  = "-50px";
    token.style.transition = "top 2s cubic-bezier(0.25,0.46,0.45,0.94)";
    token.style.position = "absolute";
    token.style.zIndex   = "110";
    token.style.pointerEvents = "all";
    effectsEl.appendChild(token);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      token.style.top = endY + "px";
    }));

    let collected = false;
    function collect() {
      if (collected) return;
      collected = true;
      const sunEl = document.getElementById("hud-sun");
      const eRect = effectsEl.getBoundingClientRect();
      const sRect = sunEl ? sunEl.getBoundingClientRect() : null;
      const tx = sRect ? sRect.left - eRect.left + sRect.width / 2 - 28 : 0;
      const ty = sRect ? sRect.top  - eRect.top  + sRect.height / 2 - 28 : 0;

      token.style.transition = "left .5s, top .5s, transform .5s, opacity .5s";
      token.style.left = tx + "px";
      token.style.top  = ty + "px";
      token.style.transform = "scale(0.3)";
      token.style.opacity = "0.5";

      setTimeout(() => {
        Core.addSun(value);
        UI.updateSunDisplay();
        if (sunEl) {
          sunEl.style.transition = "transform .15s";
          sunEl.style.transform  = "scale(1.5)";
          setTimeout(() => { sunEl.style.transform = "scale(1)"; }, 150);
        }
        token.remove();
      }, 500);
    }

    ["pointerdown","pointerenter","mouseover"].forEach(ev =>
      token.addEventListener(ev, collect, { once: true })
    );
    setTimeout(() => { if (!collected) collect(); }, 9000);
  }

  // ── Timed boost HUD (countdown bar) ──────────────────────────────────
  function _startBoostHUD(def, totalSecs) {
    const hud = document.getElementById("boost-active-hud");
    if (!hud) return;

    const row = document.createElement("div");
    row.className = "boost-hud-row";
    row.dataset.boostId = def.id;
    row.innerHTML = `
      <span class="boost-hud-icon">${def.fallbackIcon}</span>
      <div class="boost-hud-bar-wrap">
        <div class="boost-hud-bar" style="width:100%"></div>
      </div>
      <span class="boost-hud-timer">${totalSecs}s</span>
    `;
    hud.appendChild(row);
  }

  function _updateBoostHUD(def, timeLeft, totalSecs) {
    const hud = document.getElementById("boost-active-hud");
    if (!hud) return;
    const row = hud.querySelector(`[data-boost-id="${def.id}"]`);
    if (!row) return;
    const bar   = row.querySelector(".boost-hud-bar");
    const timer = row.querySelector(".boost-hud-timer");
    const pct   = Math.max(0, timeLeft / totalSecs);
    if (bar)   bar.style.width = (pct * 100) + "%";
    if (timer) timer.textContent = Math.ceil(timeLeft) + "s";
  }

  function _removeBoostHUD(def) {
    const hud = document.getElementById("boost-active-hud");
    if (!hud) return;
    hud.querySelector(`[data-boost-id="${def.id}"]`)?.remove();
  }

  // ── Banner shown at battle start ──────────────────────────────────────
  function _showBoostBanner(def) {
    const banner = document.createElement("div");
    banner.className = "boost-activate-banner";
    banner.innerHTML = `${def.fallbackIcon} <b>${def.name}</b> activated!`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2800);
  }

  // ── Game loop tick (called from Core.loop) ─────────────────────────────
  function tick(dt) {
    for (let i = activeBattleBoosts.length - 1; i >= 0; i--) {
      const entry = activeBattleBoosts[i];
      if (entry.timeLeft === Infinity) continue;

      const totalSecs = entry.def.effect.duration || 30;
      entry.timeLeft -= dt;
      _updateBoostHUD(entry.def, entry.timeLeft, totalSecs);

      if (entry.timeLeft <= 0) {
        _expireBoost(entry.def);
        activeBattleBoosts.splice(i, 1);
      }
    }
  }

  function _expireBoost(def) {
    const eff = def.effect;
    _removeBoostHUD(def);

    if (eff.damageMult)     battleDamageMult = 1;
    if (eff.demonSpeedMult) { /* speed multiplier removed — Demons reads getDemonSpeedMult() */ }

    const banner = document.createElement("div");
    banner.className = "boost-activate-banner boost-expire-banner";
    banner.innerHTML = `${def.fallbackIcon} <b>${def.name}</b> ended`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2000);
  }

  // ── Public getters used by other systems ─────────────────────────────
  // Called by plant files before dealing damage
  function getDamageMult() {
    return battleDamageMult;
  }

  // Called by Demons.spawn / Demons.update
  function getDemonSpeedMult() {
    const fw = activeBattleBoosts.find(e => e.def.effect.demonSpeedMult);
    return fw ? fw.def.effect.demonSpeedMult : 1;
  }

  // Called by Core.endBattle to multiply coin reward
  function getCoinMult() {
    return battleCoinMult;
  }

  // Called by Core.startBattle after grid is ready (iron bark)
  function applyIronBarkToGrid() {
    const fw = activeBattleBoosts.find(e => e.def.effect.hpMult);
    if (!fw) return;
    const mult = fw.def.effect.hpMult;
    const grid = Grid.getGrid();
    for (let r = 0; r < Grid.getRows(); r++) {
      for (let c = 0; c < Grid.getCols(); c++) {
        const p = grid[r][c];
        if (!p) continue;
        p.maxHp = Math.floor(p.maxHp * mult);
        p.hp    = Math.floor(p.hp    * mult);
        if (p.hpBar) p.hpBar.style.width = "100%";
      }
    }
  }

  // ── Cleanup on battle end ─────────────────────────────────────────────
  function clearBattle() {
    if (sunRushTimer) { clearInterval(sunRushTimer); sunRushTimer = null; }
    activeBattleBoosts = [];
    battleCoinMult   = 1;
    battleDamageMult = 1;
    document.querySelectorAll(".boost-hud-row").forEach(el => el.remove());
    document.querySelectorAll(".sun-rush-drop").forEach(el => el.remove());
  }

  // ── isRunning hook (Core needs to expose this) ────────────────────────
  // Add to Core's return: isRunning: () => running
  // Then sunRushDrops check Core.isRunning() before spawning.

  return {
    showPreBattlePopup,
    addBoost,
    getCount,
    tick,
    getDamageMult,
    getDemonSpeedMult,
    getCoinMult,
    applyIronBarkToGrid,
    clearBattle,
  };
})();
