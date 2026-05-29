/* plants/lavaburst.js
   Lava Burst: slams ground creating lava pool (DoT).
   Rage mode when HP < 50% — damage doubles.
*/

PlantRegistry.register({
  id: "lavaburst",
  name: "Lava Burst",
  image: "assets/plants/lavaburst/lavaburst.png",
  cost: 350,
  fireDistance: 2,
  hitCount: 3,
  cooldown: 5000,
  hp: 100,
  fireRate: 4000,
  description: "Creates lava pools that burn demons. Rages at low HP.",

  levelStats: {
    1: {
      hp: 100,
      fireRate: 4000,
      damage: 15,
      dotDamage: 5,
      dotDuration: 2500,
      dotInterval: 2000,
      cooldown: 6000,
    },

    2: {
      hp: 100,
      fireRate: 3850,
      damage: 19,
      dotDamage: 8,
      dotDuration: 2450,
      dotInterval: 1920,
    },

    3: {
      hp: 100,
      fireRate: 3700,
      damage: 24,
      dotDamage: 10,
      dotDuration: 2400,
      dotInterval: 1840,
    },

    4: {
      hp: 100,
      fireRate: 3550,
      damage: 28,
      dotDamage: 13,
      dotDuration: 2350,
      dotInterval: 1760,
    },

    5: {
      hp: 100,
      fireRate: 3400,
      damage: 33,
      dotDamage: 15,
      dotDuration: 2300,
      dotInterval: 1680,
    },

    6: {
      hp: 100,
      fireRate: 3250,
      damage: 37,
      dotDamage: 18,
      dotDuration: 2250,
      dotInterval: 1600,
    },

    7: {
      hp: 100,
      fireRate: 3100,
      damage: 42,
      dotDamage: 20,
      dotDuration: 2200,
      dotInterval: 1520,
    },

    8: {
      hp: 100,
      fireRate: 2950,
      damage: 46,
      dotDamage: 23,
      dotDuration: 2150,
      dotInterval: 1440,
    },

    9: {
      hp: 100,
      fireRate: 2800,
      damage: 51,
      dotDamage: 25,
      dotDuration: 2100,
      dotInterval: 1360,
    },

    10: {
      hp: 100,
      fireRate: 2650,
      damage: 55,
      dotDamage: 28,
      dotDuration: 2050,
      dotInterval: 1280,
    },

    11: {
      hp: 100,
      fireRate: 2500,
      damage: 60,
      dotDamage: 30,
      dotDuration: 2000,
      dotInterval: 1200,
    },

    12: {
      hp: 100,
      fireRate: 2350,
      damage: 64,
      dotDamage: 33,
      dotDuration: 2000,
      dotInterval: 1140,
    },

    13: {
      hp: 100,
      fireRate: 2200,
      damage: 69,
      dotDamage: 35,
      dotDuration: 2000,
      dotInterval: 1080,
    },

    14: {
      hp: 100,
      fireRate: 2100,
      damage: 72,
      dotDamage: 38,
      dotDuration: 2000,
      dotInterval: 1040,
    },

    15: {
      hp: 100,
      fireRate: 2000,
      damage: 75,
      dotDamage: 40,
      dotDuration: 2000,
      dotInterval: 1000,
    },
  },

  getStats(level) {
    return (
      this.levelStats[Math.min(Math.max(1, level), 15)] || this.levelStats[1]
    );
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp = stats.hp;
    plantData.hp = stats.hp;
    plantData.raging = false;
    plantData.lastAttackTime = 0; // Allow immediate first attack when placed
  },

  onTick(row, col, plantData) {
    const active = Demons.getActive();
    const cellEl = Grid.getCellEl(row, col);
    if (!cellEl) return;
    const cellRect = cellEl.getBoundingClientRect();
    const gridEl = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;

    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;

    const demonsAhead = active.filter((d) => {
      if (d.dead || d.row !== row) return false;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return false;
      if (gridRect && dRect.left > gridRect.right) return false;
      return true;
    });

    if (demonsAhead.length === 0) return;

    const stats = this.getStats(plantData.level);

    // === Attack Timing Logic (First shot immediate, then fireRate) ===
    const now = Date.now();
    if (!plantData.lastAttackTime) {
      plantData.lastAttackTime = 0; // Allow immediate first attack
    }

    if (now - plantData.lastAttackTime < stats.fireRate) {
      return; // Still on cooldown
    }

    // Update last attack time
    plantData.lastAttackTime = now;

    // Check rage mode
    const hpPct = plantData.hp / plantData.maxHp;
    const isRage = hpPct < 0.5;
    if (isRage && !plantData.raging) {
      plantData.raging = true;
      showRageEffect(row, col);
    } else if (!isRage && plantData.raging) {
      plantData.raging = false;
    }

    const rageMult = plantData.raging ? 2 : 1;

    // Slam damage to closest demon
    const target = demonsAhead[0];
    Demons.damage(target, stats.damage * rageMult);

    // Lava pool DoT on all demons in cell range
    showLavaSlam(row, col);
    applyLavaDot(demonsAhead, stats, rageMult);
  },

  onRemove(row, col) {
    // Remove lava pool visuals
    const cell = Grid.getCellEl(row, col);
    if (cell) cell.querySelector(".lava-pool")?.remove();
  },
});

function applyLavaDot(demons, stats, rageMult) {
  const ticks = Math.floor(stats.dotDuration / stats.dotInterval);
  demons.forEach((d) => {
    for (let i = 0; i < ticks; i++) {
      setTimeout(() => {
        if (!d.dead) Demons.damage(d, stats.dotDamage * rageMult);
      }, i * stats.dotInterval);
    }
  });
}

function showLavaSlam(row, col) {
  const layer = document.getElementById("effects-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  // Shockwave ring
  const ring = document.createElement("div");
  ring.style.cssText = `
    position:absolute;
    left:${cellRect.right - layerRect.left - 10}px;
    top:${cellRect.top - layerRect.top + cellRect.height * 0.5 - 10}px;
    width:20px;height:20px;
    border-radius:50%;
    border:4px solid #f97316;
    box-shadow:0 0 16px rgba(249,115,22,0.8);
    pointer-events:none;z-index:20;
    animation:lavaRing 0.5s ease-out forwards;
  `;
  layer.appendChild(ring);

  // Lava pool that lingers
  const pool = document.createElement("div");
  pool.style.cssText = `
    position:absolute;
    left:${cellRect.right - layerRect.left}px;
    top:${cellRect.top - layerRect.top + cellRect.height * 0.6}px;
    width:${cellRect.width * 2}px;
    height:${cellRect.height * 0.35}px;
    background:radial-gradient(ellipse,rgba(249,115,22,0.7),rgba(220,38,38,0.4),transparent);
    border-radius:50%;
    pointer-events:none;z-index:18;
    animation:lavaPool 3s ease-out forwards;
  `;
  layer.appendChild(pool);

  if (!document.getElementById("lava-kf")) {
    const s = document.createElement("style");
    s.id = "lava-kf";
    s.textContent = `
      @keyframes lavaRing{
        0%{transform:scale(1);opacity:1}
        100%{transform:scale(6);opacity:0}
      }
      @keyframes lavaPool{
        0%{opacity:0.9}
        70%{opacity:0.6}
        100%{opacity:0}
      }
    `;
    document.head.appendChild(s);
  }

  setTimeout(() => ring.remove(), 500);
  setTimeout(() => pool.remove(), 3000);
}

function showRageEffect(row, col) {
  const layer = document.getElementById("effects-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  const txt = document.createElement("div");
  txt.textContent = "🔥 RAGE!";
  txt.style.cssText = `
    position:absolute;
    left:${cellRect.left - layerRect.left}px;
    top:${cellRect.top - layerRect.top - 30}px;
    font-family:var(--font-display);
    font-size:18px;color:#f97316;
    font-weight:900;
    text-shadow:0 0 10px rgba(249,115,22,0.9);
    pointer-events:none;z-index:30;
    animation:floatUp 1.2s ease-out forwards;
  `;
  layer.appendChild(txt);
  setTimeout(() => txt.remove(), 1200);

  // Red glow on plant cell
  cellEl.style.boxShadow = "inset 0 0 20px rgba(249,115,22,0.6)";
  setTimeout(() => {
    cellEl.style.boxShadow = "";
  }, 3000);
}
