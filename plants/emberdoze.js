/* plants/emberdoze.js
   Ember Doze — Drowsy Prairie Guardian
   World 1 plant (plain/grassland theme)

   ── Ability Tiers ────────────────────────────────────────────────
   Level  1–5  : Ground Spikes only (2-tile range, spike damage scales)
   Level  5–10 : + Sticky Spikes (spikes stick → DoT 2s, range → 3 tiles)
   Level 10–15 : + Thorn Shot (shoots thorn like peashooter, low damage)
   ─────────────────────────────────────────────────────────────────
*/

// ── Config (change values here to rebalance) ─────────────────────
const EMBERDOZE_CFG = {
  // Sun cost
  SUN_COST: 150,

  // HP per level
  HP: {
    1: 200, 2: 210, 3: 220, 4: 230, 5: 240,
    6: 255, 7: 265, 8: 280, 9: 295, 10: 310,
    11: 325, 12: 340, 13: 355, 14: 370, 15: 390,
  },

  // Ground spike damage per level
  SPIKE_DAMAGE: {
    1: 20,  2: 26,  3: 32,  4: 38,  5: 45,
    6: 52,  7: 60,  8: 68,  9: 76,  10: 85,
    11: 94, 12: 104,13: 114,14: 125,15: 136,
  },

  // Spike check interval (ms) — how often it scans for demons in range
  SPIKE_INTERVAL: {
    1: 1800, 2: 1750, 3: 1700, 4: 1650, 5: 1600,
    6: 1550, 7: 1500, 8: 1450, 9: 1400, 10: 1350,
    11: 1300,12: 1260,13: 1220,14: 1180,15: 1140,
  },

  // Spike tile range per level
  SPIKE_RANGE: {
    1: 2, 2: 2, 3: 2, 4: 2, 5: 2,
    6: 3, 7: 3, 8: 3, 9: 3, 10: 3,
    11: 3,12: 3,13: 3,14: 3,15: 3,
  },

  // Sticky DoT — unlocks at level 6
  // Damage per tick, tick interval, total duration
  DOT_DAMAGE_PER_TICK: {
    6: 8,  7: 10, 8: 12, 9: 14, 10: 16,
    11: 18,12: 21,13: 24,14: 27,15: 30,
  },
  DOT_TICK_INTERVAL: 500,   // ms between each DoT tick
  DOT_DURATION: 2000,        // total DoT duration (ms)

  // Thorn shot — unlocks at level 11
  THORN_DAMAGE: {
    11: 10, 12: 13, 13: 16, 14: 19, 15: 22,
  },
  THORN_FIRE_RATE: {
    11: 2800, 12: 2600, 13: 2400, 14: 2200, 15: 2000,
  },

  // Tray cooldown after placing (ms)
  RECHARGE: 7500,
};

// ── Active DoT timers: key = demonId, value = { ticks, interval } ─
const _edDotMap = {};

// ── Register ──────────────────────────────────────────────────────
PlantRegistry.register({
  id: "emberdoze",
  name: "Ember Doze",
  description: "A drowsy cactus that pops spikes from the ground. Gets stickier and then learns to shoot thorns.",
  image: "assets/plants/emberdoze.png",
  sunCost: EMBERDOZE_CFG.SUN_COST,
  hp: EMBERDOZE_CFG.HP[1],
  fireRate: EMBERDOZE_CFG.SPIKE_INTERVAL[1],
  fireDistance: EMBERDOZE_CFG.SPIKE_RANGE[1],
  hitCount: 99, // hits all demons in range
  recharge: EMBERDOZE_CFG.RECHARGE,
  world: 1,

  // Per-level stats used by PlantRegistry for display
  levelStats: (() => {
    const stats = {};
    for (let lv = 1; lv <= 15; lv++) {
      stats[lv] = {
        hp:        EMBERDOZE_CFG.HP[lv],
        damage:    EMBERDOZE_CFG.SPIKE_DAMAGE[lv],
        fireRate:  EMBERDOZE_CFG.SPIKE_INTERVAL[lv],
        range:     EMBERDOZE_CFG.SPIKE_RANGE[lv],
      };
    }
    return stats;
  })(),

  // ── onPlace: add CSS classes for idle animation ────────────────
  onPlace(row, col, plantData) {
    if (plantData.element) {
      plantData.element.classList.add("ed-idle");
    }
    // Store per-instance thorn timer separately
    plantData._thornElapsed = 0;
  },

  // ── onRemove: clean up any running DoTs ───────────────────────
  onRemove(row, col) {
    // DoT entries are keyed by demon id, cleaned up in tick
  },

  // ── onDamage ──────────────────────────────────────────────────
  onDamage(row, col, plantData) {
    if (!plantData.element) return;
    plantData.element.classList.remove("ed-idle", "ed-spike");
    plantData.element.classList.add("ed-damaged");
    clearTimeout(plantData._dmgTimer);
    plantData._dmgTimer = setTimeout(() => {
      if (plantData.element) {
        plantData.element.classList.remove("ed-damaged");
        plantData.element.classList.add("ed-idle");
      }
    }, 600);
  },

  // ── onTick: main logic every SPIKE_INTERVAL ms ────────────────
  onTick(row, col, plantData) {
    const pp = Player.getPlant("emberdoze");
    const level = pp ? pp.level : 1;

    // ── Thorn shot (level 11+) ────────────────────────────────
    if (level >= 11) {
      _thornShot(row, col, plantData, level);
    }

    // ── Ground spikes ─────────────────────────────────────────
    _triggerSpikes(row, col, plantData, level);
  },
});

// ── Ground Spike Logic ────────────────────────────────────────────
function _triggerSpikes(row, col, plantData, level) {
  const range   = EMBERDOZE_CFG.SPIKE_RANGE[level]  || 2;
  const damage  = EMBERDOZE_CFG.SPIKE_DAMAGE[level] || 20;
  const hasDot  = level >= 6;
  const dotDmg  = EMBERDOZE_CFG.DOT_DAMAGE_PER_TICK[level] || 0;

  // Find demons in this row within range (to the right of plant)
  const demons = Demons.getActive().filter(d => {
    if (d.dead || d.row !== row) return false;
    const cellEl  = Grid.getCellEl(row, col);
    if (!cellEl) return false;
    const cellRect = cellEl.getBoundingClientRect();
    const gridEl   = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
    if (!gridRect) return false;
    const cellW   = gridRect.width / Grid.getCols();
    const maxDist = range * cellW;
    const dRect   = d.el.getBoundingClientRect();
    // Demon must be to the right and within range tiles
    return dRect.left > cellRect.left && (dRect.left - cellRect.right) <= maxDist;
  });

  if (demons.length === 0) return;

  // Play spike animation on plant
  if (plantData.element) {
    plantData.element.classList.remove("ed-idle", "ed-damaged");
    plantData.element.classList.add("ed-spike");
    clearTimeout(plantData._spikeTimer);
    plantData._spikeTimer = setTimeout(() => {
      if (plantData.element) {
        plantData.element.classList.remove("ed-spike");
        plantData.element.classList.add("ed-idle");
      }
    }, 500);
  }

  // Spawn spike visual at each demon position
  demons.forEach(demon => {
    _spawnSpikeEffect(demon);

    // Instant spike damage
    Demons.damage(demon, damage, "physical");
    if (typeof Effects !== "undefined") {
      Effects.showDamageNumber(damage, demon.x + demon.width / 2, demon.y);
    }

    // Sticky DoT (level 6+)
    if (hasDot && dotDmg > 0) {
      _applyDot(demon, dotDmg);
    }
  });
}

// ── Spawn spike ground effect ─────────────────────────────────────
function _spawnSpikeEffect(demon) {
  const arenaEl = document.getElementById("grid-container");
  if (!arenaEl) return;

  const arenaRect = arenaEl.getBoundingClientRect();
  const x = demon.x - arenaRect.left + demon.width / 2;
  const y = demon.y - arenaRect.top  + demon.height * 0.7;

  // Create spike container relative to arena
  const spike = document.createElement("div");
  spike.className = "ed-spike-effect";
  spike.style.left = (x - 20) + "px";
  spike.style.top  = (y - 30) + "px";

  // 3 spike teeth
  for (let i = 0; i < 3; i++) {
    const tooth = document.createElement("div");
    tooth.className = "ed-spike-tooth";
    tooth.style.animationDelay = (i * 0.06) + "s";
    spike.appendChild(tooth);
  }

  arenaEl.appendChild(spike);
  setTimeout(() => spike.remove(), 600);
}

// ── Apply sticky DoT to a demon ───────────────────────────────────
function _applyDot(demon, dmgPerTick) {
  const id = demon.id || (demon.id = Math.random().toString(36).slice(2));

  // If already dotted, refresh
  if (_edDotMap[id]) {
    clearInterval(_edDotMap[id].interval);
  }

  let ticks = Math.floor(EMBERDOZE_CFG.DOT_DURATION / EMBERDOZE_CFG.DOT_TICK_INTERVAL);

  // Visual: thorn stuck indicator on demon
  if (demon.el) demon.el.classList.add("ed-dotted");

  const interval = setInterval(() => {
    if (demon.dead || ticks <= 0) {
      clearInterval(interval);
      delete _edDotMap[id];
      if (demon.el) demon.el.classList.remove("ed-dotted");
      return;
    }
    Demons.damage(demon, dmgPerTick, "physical");
    if (typeof Effects !== "undefined") {
      Effects.showDamageNumber(dmgPerTick, demon.x + demon.width / 2, demon.y - 10, "dot");
    }
    ticks--;
  }, EMBERDOZE_CFG.DOT_TICK_INTERVAL);

  _edDotMap[id] = { interval };
}

// ── Thorn Shot (level 11+) ────────────────────────────────────────
function _thornShot(row, col, plantData, level) {
  // Uses PlantRegistry.isDemonInRange for standard peashooter-style check
  const inRange = PlantRegistry.isDemonInRange(row, col, 9); // full row
  if (!inRange) return;

  // Rate-limit thorn shots independently from spikes
  const now = performance.now();
  if (!plantData._lastThornShot) plantData._lastThornShot = 0;
  const fireRate = EMBERDOZE_CFG.THORN_FIRE_RATE[level] || 2800;
  if (now - plantData._lastThornShot < fireRate) return;
  plantData._lastThornShot = now;

  const damage = EMBERDOZE_CFG.THORN_DAMAGE[level] || 10;

  // Shoot animation
  if (plantData.element) {
    plantData.element.classList.remove("ed-idle", "ed-spike");
    plantData.element.classList.add("ed-shoot");
    clearTimeout(plantData._shootTimer);
    plantData._shootTimer = setTimeout(() => {
      if (plantData.element) {
        plantData.element.classList.remove("ed-shoot");
        plantData.element.classList.add("ed-idle");
      }
    }, 400);
  }

  // Spawn thorn projectile (reuse existing projectile system)
  Projectiles.spawn("thorn", row, col, damage, { damageType: "physical" });
}
