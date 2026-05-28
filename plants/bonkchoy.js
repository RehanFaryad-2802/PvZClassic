/* plants/bonkchoy.js
   Bonk Choy: melee plant that punches demons
   in the same cell or adjacent cells.
   Hits ALL demons in its row within 1 cell range.
   Level scaling: more damage and faster punch rate.
*/

PlantRegistry.register({
  id: "bonkchoy",
  name: "Bonk Choy",
  image: "assets/plants/bonkchoy/bonkchoy.png",
  cost: 150,
  hp: 400,
  hitCount: 1,
  fireDistance: 1,
  cooldown: 4000,
  fireRate: 800,
  description: "Punches demons that get close. Hits all nearby demons.",

  levelStats: {
    1: { hp: 400, fireRate: 800, damage: 40, range: 1.2 },
    2: { hp: 500, fireRate: 720, damage: 52, range: 1.3 },
    3: { hp: 620, fireRate: 640, damage: 66, range: 1.4 },
    4: { hp: 760, fireRate: 560, damage: 84, range: 1.5 },
    5: { hp: 920, fireRate: 480, damage: 105, range: 1.6 },
  },

  getStats(level) {
    return this.levelStats[level] || this.levelStats[1];
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp = stats.hp;
    plantData.hp = stats.hp;
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
  },

  onRemove(row, col) {},
});
function showBonkEffect(row, col, target) {
  const layer = document.getElementById("effects-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl || !target) return;

  const layerRect = layer.getBoundingClientRect();
  const dRect = target.el.getBoundingClientRect();

  // Punch emoji that flies toward demon
  const punch = document.createElement("div");
  punch.textContent = "👊";
  punch.style.cssText = `
    position:absolute;
    font-size:24px;
    left:${dRect.left - layerRect.left - 10}px;
    top:${dRect.top - layerRect.top - 16}px;
    pointer-events:none;
    z-index:30;
    animation:bonkPop 0.4s ease-out forwards;
  `;
  layer.appendChild(punch);

  // BONK! text
  const txt = document.createElement("div");
  txt.textContent = "BONK!";
  txt.style.cssText = `
    position:absolute;
    font-family:var(--font-display);
    font-size:16px;
    font-weight:900;
    color:#fbbf24;
    text-shadow:0 0 8px rgba(251,191,36,0.8);
    left:${dRect.left - layerRect.left}px;
    top:${dRect.top - layerRect.top - 36}px;
    pointer-events:none;
    z-index:30;
    animation:floatUp 0.6s ease-out forwards;
  `;
  layer.appendChild(txt);

  if (!document.getElementById("bonk-kf")) {
    const s = document.createElement("style");
    s.id = "bonk-kf";
    s.textContent = `
      @keyframes bonkPop {
        0%   { transform: scale(0.5); opacity: 1; }
        50%  { transform: scale(1.4); opacity: 1; }
        100% { transform: scale(1);   opacity: 0; }
      }
    `;
    document.head.appendChild(s);
  }

  setTimeout(() => {
    punch.remove();
    txt.remove();
  }, 600);
}
