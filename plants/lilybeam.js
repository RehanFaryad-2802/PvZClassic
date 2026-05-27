/* plants/lilybeam.js
   Lily Beam: fires ice beam that freezes ALL demons in row.
   Crystal shield absorbs 1 hit every 8 seconds.
*/

PlantRegistry.register({
  id: "lilybeam",
  name: "Lily Beam",
  image: "assets/plants/lilybeam.jpg",
  cost: 200,
  cooldown: 6000,
  hp: 350,
  fireRate: 2500,
  description: "Freezes all demons in its lane with an ice beam.",

  levelStats: {
    1: {
      hp: 350,
      fireRate: 2500,
      damage: 18,
      freezeDuration: 2000,
      shieldCooldown: 8000,
    },
    2: {
      hp: 420,
      fireRate: 2300,
      damage: 23,
      freezeDuration: 2300,
      shieldCooldown: 7500,
    },
    3: {
      hp: 500,
      fireRate: 2100,
      damage: 29,
      freezeDuration: 2600,
      shieldCooldown: 7000,
    },
    4: {
      hp: 600,
      fireRate: 1900,
      damage: 36,
      freezeDuration: 3000,
      shieldCooldown: 6500,
    },
    5: {
      hp: 720,
      fireRate: 1700,
      damage: 44,
      freezeDuration: 3400,
      shieldCooldown: 6000,
    },
    6: {
      hp: 860,
      fireRate: 1500,
      damage: 54,
      freezeDuration: 3800,
      shieldCooldown: 5500,
    },
    7: {
      hp: 1000,
      fireRate: 1400,
      damage: 65,
      freezeDuration: 4200,
      shieldCooldown: 5000,
    },
    8: {
      hp: 1150,
      fireRate: 1300,
      damage: 78,
      freezeDuration: 4600,
      shieldCooldown: 4500,
    },
    9: {
      hp: 1300,
      fireRate: 1200,
      damage: 92,
      freezeDuration: 5000,
      shieldCooldown: 4000,
    },
    10: {
      hp: 1500,
      fireRate: 1100,
      damage: 108,
      freezeDuration: 5500,
      shieldCooldown: 3500,
    },
    11: {
      hp: 1700,
      fireRate: 1000,
      damage: 125,
      freezeDuration: 6000,
      shieldCooldown: 3000,
    },
    12: {
      hp: 1900,
      fireRate: 900,
      damage: 144,
      freezeDuration: 6500,
      shieldCooldown: 2800,
    },
    13: {
      hp: 2100,
      fireRate: 820,
      damage: 165,
      freezeDuration: 7000,
      shieldCooldown: 2600,
    },
    14: {
      hp: 2350,
      fireRate: 750,
      damage: 188,
      freezeDuration: 7500,
      shieldCooldown: 2400,
    },
    15: {
      hp: 2600,
      fireRate: 680,
      damage: 215,
      freezeDuration: 8000,
      shieldCooldown: 2000,
    },
  },

  getStats(level) {
    const capped = Math.min(Math.max(1, level), 15);
    return this.levelStats[capped] || this.levelStats[1];
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp = stats.hp;
    plantData.hp = stats.hp;
    plantData.shieldReady = true;
    plantData.shieldTimer = 0;
    plantData.shieldCooldown = stats.shieldCooldown;
    // Show shield ring
    showShieldEffect(row, col, true);
  },

  onTick(row, col, plantData) {
    const active = Demons.getActive();
    const cellEl = Grid.getCellEl(row, col);
    if (!cellEl) return;
    const cellRect = cellEl.getBoundingClientRect();
    const arenaEl = document.getElementById("screen-battle");
    const arenaRect = arenaEl ? arenaEl.getBoundingClientRect() : null;
    const gridEl = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;

    const demonAhead = active.some((d) => {
      if (d.dead || d.row !== row) return false;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return false;
      if (gridRect && dRect.left > gridRect.right) return false;
      return true;
    });

    if (!demonAhead) return;

    const stats = this.getStats(plantData.level);

    // Freeze ALL demons in row
    active.forEach((d) => {
      if (d.dead || d.row !== row) return;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return;
      Demons.damage(d, stats.damage);
      Demons.freeze(d, stats.freezeDuration);
    });

    // Visual beam effect
    showBeamEffect(row, col);
  },

  onRemove(row, col) {},

  // Called from grid.js when plant takes damage
  onDamage(row, col, plantData) {
    if (plantData.shieldReady) {
      // Absorb hit
      plantData.shieldReady = false;
      plantData.shieldTimer = 0;
      showShieldEffect(row, col, false);
      showShieldBreak(row, col);
      return true; // absorbed
    }
    return false;
  },
});

function showBeamEffect(row, col) {
  const cell = Grid.getCellEl(row, col);
  const layer = document.getElementById("effects-layer");
  if (!cell || !layer) return;

  const cellRect = cell.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  const arenaEl = document.getElementById("screen-battle");
  const arenaRect = arenaEl ? arenaEl.getBoundingClientRect() : null;

  const beam = document.createElement("div");
  beam.style.cssText = `
    position:absolute;
    left:${cellRect.right - layerRect.left}px;
    top:${cellRect.top - layerRect.top + cellRect.height * 0.5 - 5}px;
    width:${arenaRect ? arenaRect.right - cellRect.right : 800}px;
    height:10px;
    background:linear-gradient(90deg, rgba(103,232,249,0.9), rgba(103,232,249,0.2));
    border-radius:5px;
    box-shadow:0 0 16px rgba(103,232,249,0.8);
    pointer-events:none;
    z-index:20;
    animation:beamFade 0.4s ease-out forwards;
  `;
  layer.appendChild(beam);
  if (!document.getElementById("beam-keyframe")) {
    const style = document.createElement("style");
    style.id = "beam-keyframe";
    style.textContent = "@keyframes beamFade{from{opacity:1}to{opacity:0}}";
    document.head.appendChild(style);
  }
  setTimeout(() => beam.remove(), 400);
}

function showShieldEffect(row, col, active) {
  const cell = Grid.getCellEl(row, col);
  if (!cell) return;
  let shield = cell.querySelector(".lily-shield");
  if (active) {
    if (!shield) {
      shield = document.createElement("div");
      shield.className = "lily-shield";
      shield.style.cssText = `
        position:absolute;inset:-4px;
        border-radius:50%;
        border:3px solid rgba(103,232,249,0.8);
        box-shadow:0 0 12px rgba(103,232,249,0.6);
        pointer-events:none;z-index:10;
        animation:shieldPulse 2s ease-in-out infinite;
      `;
      cell.appendChild(shield);
    }
  } else {
    if (shield) shield.remove();
  }
}

function showShieldBreak(row, col) {
  const cell = Grid.getCellEl(row, col);
  const layer = document.getElementById("effects-layer");
  if (!cell || !layer) return;
  const r = cell.getBoundingClientRect();
  const lr = layer.getBoundingClientRect();
  const el = document.createElement("div");
  el.textContent = "🛡️💥";
  el.style.cssText = `
    position:absolute;
    left:${r.left - lr.left}px;
    top:${r.top - lr.top - 20}px;
    font-size:20px;pointer-events:none;z-index:30;
    animation:floatUp 0.8s ease-out forwards;
  `;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 800);
}
