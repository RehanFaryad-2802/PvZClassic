/* plants/emberdoze.js
   Ember Doze — Drowsy Prairie Guardian
   World 1 plant (plain/grassland theme)

   ── Ability Tiers ────────────────────────────────────────────────
   Level  1–5  : Ground Spikes only (3-tile range, spike damage scales)
   Level  6–10 : + Sticky Spikes (DoT 2s, range → 4 tiles)
   Level 11–15 : + Thorn Shot (shoots thorn like peashooter, low damage)
   ─────────────────────────────────────────────────────────────────
*/

// ── Config ────────────────────────────────────────────────────────
const EMBERDOZE_CFG = {
  SUN_COST: 150,
  RECHARGE: 7500,

  HP: {
    1:200,2:210,3:220,4:230,5:240,
    6:255,7:265,8:280,9:295,10:310,
    11:325,12:340,13:355,14:370,15:390,
  },

  SPIKE_DAMAGE: {
    1:20,2:26,3:32,4:38,5:45,
    6:52,7:60,8:68,9:76,10:85,
    11:94,12:104,13:114,14:125,15:136,
  },

  SPIKE_INTERVAL: {
    1:1800,2:1750,3:1700,4:1650,5:1600,
    6:1550,7:1500,8:1450,9:1400,10:1350,
    11:1300,12:1260,13:1220,14:1180,15:1140,
  },

  SPIKE_RANGE: {
    1:3,2:3,3:3,4:3,5:3,
    6:4,7:4,8:4,9:4,10:4,
    11:5,12:5,13:5,14:5,15:5,
  },

  // Spike wave travel time in ms (how fast it crosses one tile)
  SPIKE_TRAVEL_MS: 300,

  DOT_DAMAGE_PER_TICK: {
    6:8,7:10,8:12,9:14,10:16,
    11:18,12:21,13:24,14:27,15:30,
  },
  DOT_TICK_INTERVAL: 500,
  DOT_DURATION: 2000,

  THORN_DAMAGE: {
    11:10,12:13,13:16,14:19,15:22,
  },
  THORN_FIRE_RATE: {
    11:2800,12:2600,13:2400,14:2200,15:2000,
  },
};

// ── Active DoT map ────────────────────────────────────────────────
const _edDotMap = {};

// ── Register ──────────────────────────────────────────────────────
PlantRegistry.register({
  id:           "emberdoze",
  name:         "Ember Doze",
  description:  "A drowsy cactus that erupts ground spikes. Gets stickier, then learns to shoot thorns.",
  image:        "assets/plants/emberdoze.png",
  cost:         EMBERDOZE_CFG.SUN_COST,
  cooldown:     EMBERDOZE_CFG.RECHARGE,
  hp:           EMBERDOZE_CFG.HP[1],
  fireRate:     EMBERDOZE_CFG.SPIKE_INTERVAL[1],
  fireDistance: 9,
  hitCount:     99,
  world:        1,

  levelStats: (() => {
    const s = {};
    for (let lv = 1; lv <= 15; lv++) {
      s[lv] = {
        hp:       EMBERDOZE_CFG.HP[lv],
        damage:   EMBERDOZE_CFG.SPIKE_DAMAGE[lv],
        fireRate: EMBERDOZE_CFG.SPIKE_INTERVAL[lv],
        range:    EMBERDOZE_CFG.SPIKE_RANGE[lv],
        cost:     EMBERDOZE_CFG.SUN_COST,
        cooldown: EMBERDOZE_CFG.RECHARGE,
      };
    }
    return s;
  })(),

  onPlace(row, col, plantData) {
    if (plantData.element) plantData.element.classList.add("ed-idle");
    plantData._thornElapsed = 0;
  },

  onRemove(row, col) {},

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

  onTick(row, col, plantData) {
    const pp    = Player.getPlant("emberdoze");
    const level = pp ? pp.level : 1;
    // Visual state: show unlock badges on the plant entity
    if (plantData.element) {
      if (level >= 6) plantData.element.classList.add('ed-has-dot'); else plantData.element.classList.remove('ed-has-dot');
      if (level >= 11) plantData.element.classList.add('ed-has-thorn'); else plantData.element.classList.remove('ed-has-thorn');
    }

    if (level >= 11) _thornShot(row, col, plantData, level);
    _triggerSpikes(row, col, plantData, level);
  },
});

// ── Ground Spike Logic ────────────────────────────────────────────
function _triggerSpikes(row, col, plantData, level) {
  const range  = EMBERDOZE_CFG.SPIKE_RANGE[level]  || 3;
  const damage = EMBERDOZE_CFG.SPIKE_DAMAGE[level] || 20;
  const hasDot = level >= 6;
  const dotDmg = EMBERDOZE_CFG.DOT_DAMAGE_PER_TICK[level] || 0;

  // Check if any demon is in range
  const gridEl   = document.getElementById("grid-container");
  const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
  if (!gridRect) return;

  const cellEl   = Grid.getCellEl(row, col);
  if (!cellEl) return;
  const cellRect = cellEl.getBoundingClientRect();
  const cellW    = gridRect.width / Grid.getCols();
  const maxDist  = range * cellW;

  const demonsInRange = Demons.getActive().filter(d => {
    if (d.dead || d.row !== row) return false;
    const dRect = d.el.getBoundingClientRect();
    return dRect.left > cellRect.left && (dRect.left - cellRect.right) <= maxDist;
  });

  if (demonsInRange.length === 0) return;

  // Plant squeeze animation
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

  // Launch spike wave
  _launchSpikeWave(row, col, range, damage, hasDot, dotDmg);
}

// ── Spike Wave ────────────────────────────────────────────────────
// One block wide, travels left→right, damages demon when it reaches them
function _launchSpikeWave(row, col, range, damage, hasDot, dotDmg) {
  const layer = document.getElementById("effects-layer");
  if (!layer) return;

  // We need at least col+1 cell to start from
  const startCellEl = Grid.getCellEl(row, col + 1);
  if (!startCellEl) return;

  const layerRect = layer.getBoundingClientRect();
  const startRect = startCellEl.getBoundingClientRect();

  // One block width
  const cellW      = startRect.width;
  const blockH     = 44; // spike height area
  const tileTop    = startRect.bottom - layerRect.top - blockH;

  // Total travel distance = range tiles
  const totalDist  = cellW * range;
  const TRAVEL_MS  = EMBERDOZE_CFG.SPIKE_TRAVEL_MS * range;

  // Tooth count to fill exactly one block width
  const toothCount = Math.max(3, Math.floor(cellW / 10));

  // ── Build the spike block (1 cell wide) ──────────────────────
  const block = document.createElement("div");
  block.className = "ed-spike-effect";
  block.style.cssText = `
    position: absolute;
    left: ${startRect.left - layerRect.left}px;
    top: ${tileTop}px;
    width: ${cellW}px;
    height: ${blockH}px;
    pointer-events: none;
    z-index: 85;
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    overflow: visible;
  `;

  for (let i = 0; i < toothCount; i++) {
    const tooth = document.createElement("div");
    tooth.className = "ed-spike-tooth";
    const height = 30 + Math.round(Math.random() * 20) + Math.round(Math.sin((i / Math.max(1, toothCount - 1)) * Math.PI) * 10);
    const width = 8 + Math.round(Math.random() * 6);
    tooth.style.width = `${width}px`;
    tooth.style.setProperty("--target-height", `${height}px`);
    tooth.style.animationDelay = (i * 0.02) + "s";
    block.appendChild(tooth);
  }

  // If this level provides DoT/sticky spikes, mark block for different styling
  if (hasDot) block.classList.add('ed-spike-dot');

  layer.appendChild(block);

  // ── Animate block moving right after initial spike pop ───────
  const hitDemons = new Set();
  const startX = startRect.left - layerRect.left;
  const animationDelay = 560;
  const holdAfterEnd = 220;
  let startTime;

  function tick(now) {
    if (!startTime) startTime = now;
    const elapsed = now - startTime;

    if (elapsed < animationDelay) {
      requestAnimationFrame(tick);
      return;
    }

    const moveElapsed = elapsed - animationDelay;
    const progress = Math.min(moveElapsed / TRAVEL_MS, 1);
    const currentX = startX + progress * totalDist;

    // Move block
    block.style.left = currentX + "px";

    // Hit detection — spike block center X
    const blockCenterX = currentX + cellW / 2;
    const layerRectNow = layer.getBoundingClientRect();

    Demons.getActive().forEach(d => {
      if (d.dead || d.row !== row || hitDemons.has(d)) return;
      const dRect  = d.el.getBoundingClientRect();
      const dLeft  = dRect.left  - layerRectNow.left;
      const dRight = dRect.right - layerRectNow.left;

      // Hit when block center overlaps demon
      if (blockCenterX >= dLeft && blockCenterX <= dRight + cellW * 0.5) {
        hitDemons.add(d);
        Demons.damage(d, damage, "physical");
        if (typeof Effects !== "undefined") {
          Effects.showDamageNumber(damage, d.x + d.width / 2, d.y);
        }
        if (hasDot && dotDmg > 0) _applyDot(d, dotDmg);
      }
    });

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      setTimeout(() => {
        block.style.opacity = "0";
        block.style.transition = "opacity 0.18s";
        setTimeout(() => block.remove(), 180);
      }, holdAfterEnd);
    }
  }

  requestAnimationFrame(tick);
}

// ── Sticky DoT ───────────────────────────────────────────────────
function _applyDot(demon, dmgPerTick) {
  const id = demon.id || (demon.id = Math.random().toString(36).slice(2));

  if (_edDotMap[id]) clearInterval(_edDotMap[id].interval);

  let ticks = Math.floor(EMBERDOZE_CFG.DOT_DURATION / EMBERDOZE_CFG.DOT_TICK_INTERVAL);

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

// ── Thorn Shot ───────────────────────────────────────────────────
function _thornShot(row, col, plantData, level) {
  const inRange = PlantRegistry.isDemonInRange(row, col, 9);
  if (!inRange) return;

  const now      = performance.now();
  const fireRate = EMBERDOZE_CFG.THORN_FIRE_RATE[level] || 2800;
  if (!plantData._lastThornShot) plantData._lastThornShot = 0;
  if (now - plantData._lastThornShot < fireRate) return;
  plantData._lastThornShot = now;

  const damage = EMBERDOZE_CFG.THORN_DAMAGE[level] || 10;

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

  Projectiles.spawn("thorn", row, col, damage, { damageType: "physical" });
}