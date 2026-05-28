/* plants/lavaburst.js
   Lava Burst: slams ground creating lava pool (DoT).
   Rage mode when HP < 50% — damage doubles.
*/

PlantRegistry.register({
  id: "lavaburst",
  name: "Lava Burst",
  image: "assets/plants/lavaburst/lavaburst.png",
  cost: 50,
  // cost: 175,
  fireDistance: 9,
  hitCount: 3,
  cooldown: 1800,
  hp: 500,
  fireRate: 7000,
  description: "Creates lava pools that burn demons. Rages at low HP.",

  levelStats: {
    1: {
      hp: 300,
      fireRate: 6500,
      damage: 1,
      dotDamage: 5,
      dotDuration: 2500,
      dotInterval: 700,
      cooldown: 6000,
    },
    2: {
      hp: 600,
      fireRate: 1680,
      damage: 31,
      dotDamage: 10,
      dotDuration: 3200,
      dotInterval: 580,
    },
    3: {
      hp: 720,
      fireRate: 1560,
      damage: 38,
      dotDamage: 13,
      dotDuration: 3400,
      dotInterval: 560,
    },
    4: {
      hp: 860,
      fireRate: 1450,
      damage: 47,
      dotDamage: 16,
      dotDuration: 3600,
      dotInterval: 540,
    },
    5: {
      hp: 1020,
      fireRate: 1340,
      damage: 57,
      dotDamage: 20,
      dotDuration: 3800,
      dotInterval: 520,
    },
    6: {
      hp: 1200,
      fireRate: 1240,
      damage: 69,
      dotDamage: 25,
      dotDuration: 4000,
      dotInterval: 500,
    },
    7: {
      hp: 1400,
      fireRate: 1150,
      damage: 83,
      dotDamage: 31,
      dotDuration: 4200,
      dotInterval: 480,
    },
    8: {
      hp: 1620,
      fireRate: 1060,
      damage: 99,
      dotDamage: 38,
      dotDuration: 4400,
      dotInterval: 460,
    },
    9: {
      hp: 1860,
      fireRate: 980,
      damage: 118,
      dotDamage: 46,
      dotDuration: 4600,
      dotInterval: 440,
    },
    10: {
      hp: 2120,
      fireRate: 900,
      damage: 140,
      dotDamage: 56,
      dotDuration: 4800,
      dotInterval: 420,
    },
    11: {
      hp: 2400,
      fireRate: 830,
      damage: 165,
      dotDamage: 67,
      dotDuration: 5000,
      dotInterval: 400,
    },
    12: {
      hp: 2700,
      fireRate: 760,
      damage: 193,
      dotDamage: 80,
      dotDuration: 5200,
      dotInterval: 380,
    },
    13: {
      hp: 3020,
      fireRate: 700,
      damage: 225,
      dotDamage: 95,
      dotDuration: 5400,
      dotInterval: 360,
    },
    14: {
      hp: 3380,
      fireRate: 645,
      damage: 261,
      dotDamage: 113,
      dotDuration: 5600,
      dotInterval: 340,
    },
    15: {
      hp: 3800,
      fireRate: 590,
      damage: 302,
      dotDamage: 134,
      dotDuration: 6000,
      dotInterval: 320,
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
