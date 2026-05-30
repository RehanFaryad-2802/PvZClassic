/* plants/bonkchoy.js
   Bonk Choy: melee plant that punches demons
   in the same cell or adjacent cells.
   Hits ALL demons in its row within 1 cell range.
   Level scaling: more damage and faster punch rate.
*/

PlantRegistry.register({
  id: "bonkchoy",
  name: "Bonk Choy",
  image: "assets/plants/bonkchoy.png",
  cost: 150,
  hp: 400,
  hitCount: 1,
  fireDistance: 1,
  cooldown: 4000,
  fireRate: 800,
  description: "Punches demons that get close. Hits all nearby demons.",

  levelStats: {
    1:  { hp: 400,  fireRate: 800, damage: 40,  range: 1.2, cost: 150 },
    2:  { hp: 500,  fireRate: 750, damage: 54,  range: 1.2, cost: 150 },
    3:  { hp: 620,  fireRate: 700, damage: 72,  range: 1.3, cost: 150 },
    4:  { hp: 760,  fireRate: 650, damage: 95,  range: 1.3, cost: 150 },
    5:  { hp: 920,  fireRate: 600, damage: 124, range: 1.4, cost: 150 },
    6:  { hp: 1110, fireRate: 560, damage: 160, range: 1.4, cost: 150 },
    7:  { hp: 1330, fireRate: 520, damage: 205, range: 1.5, cost: 150 },
    8:  { hp: 1590, fireRate: 480, damage: 262, range: 1.5, cost: 150 },
    9:  { hp: 1890, fireRate: 445, damage: 332, range: 1.6, cost: 150 },
    10: { hp: 2240, fireRate: 410, damage: 420, range: 1.6, cost: 150 },
    11: { hp: 2640, fireRate: 380, damage: 528, range: 1.7, cost: 150 },
    12: { hp: 3100, fireRate: 350, damage: 662, range: 1.7, cost: 150 },
    13: { hp: 3620, fireRate: 320, damage: 825, range: 1.8, cost: 150 },
    14: { hp: 4220, fireRate: 295, damage: 1020, range: 1.8, cost: 150 },
    15: { hp: 4900, fireRate: 270, damage: 1260, range: 2.0, cost: 150 },
  },

  getStats(level) {
    const capped = Math.min(Math.max(1, level), 15);
    return this.levelStats[capped] || this.levelStats[1];
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp = stats.hp;
    plantData.hp = stats.hp;

    requestAnimationFrame(() => {
      const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
      if (img) img.classList.add("bc-idle");
    });
  },

  onTick(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    const targets = PlantRegistry.getDemonsInRange(
      row,
      col,
      this.fireDistance,
      this.hitCount,
    );
    if (targets.length === 0) return;

    targets.forEach((d) => Demons.damage(d, stats.damage));
    showBonkEffect(row, col, targets[0]);

    // Punch animation
    const cell = Grid.getCellEl(row, col);
    const img = cell?.querySelector(".plant-entity");
    if (img && !plantData.punching) {
      plantData.punching = true;
      img.classList.remove("bc-idle");
      img.classList.add("bc-punch");
      setTimeout(() => {
        if (img.isConnected) {
          img.classList.remove("bc-punch");
          img.classList.add("bc-idle");
          plantData.punching = false;
        }
      }, 350);
    }
  },

  onRemove(row, col) {},

  onDamage(row, col, plantData) {
    const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
    if (!img) return;
    img.classList.remove("bc-idle", "bc-punch");
    img.classList.add("bc-damaged");
    setTimeout(() => {
      if (img.isConnected) {
        img.classList.remove("bc-damaged");
        img.classList.add(plantData.punching ? "bc-punch" : "bc-idle");
      }
    }, 500);
  },
});
function showBonkEffect(row, col, target) {
  const layer = document.getElementById("effects-layer");
  if (!layer || !target) return;

  const layerRect = layer.getBoundingClientRect();
  const dRect = target.el.getBoundingClientRect();

  const cx = dRect.left - layerRect.left + dRect.width / 2 - 14;
  const cy = dRect.top  - layerRect.top  + dRect.height / 2 - 14;

  // Impact burst at demon center
  const impact = document.createElement("div");
  impact.className = "bc-impact";
  impact.style.left = cx + "px";
  impact.style.top  = cy + "px";
  layer.appendChild(impact);

  // Shockwave ring
  const wave = document.createElement("div");
  wave.className = "bc-shockwave";
  wave.style.cssText = `left:${cx}px;top:${cy}px;width:28px;height:28px;`;
  layer.appendChild(wave);

  // BONK! floating text
  const txt = document.createElement("div");
  txt.textContent = "BONK!";
  txt.style.cssText = `
    position:absolute;
    font-family:var(--font-display);
    font-size:16px;font-weight:900;
    color:#fbbf24;
    text-shadow:0 0 8px rgba(251,191,36,0.8);
    left:${cx - 10}px;
    top:${cy - 28}px;
    pointer-events:none;z-index:30;
    animation:floatUp 0.6s ease-out forwards;
  `;
  layer.appendChild(txt);

  setTimeout(() => { impact.remove(); wave.remove(); txt.remove(); }, 600);
}
