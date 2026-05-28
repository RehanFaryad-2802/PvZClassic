/* plants/voltlotus.js
   Volt Lotus: chain lightning hitting all demons in row.
   Every 5th shot = overcharge (3x damage + screen flash).
*/

PlantRegistry.register({
  id: "voltlotus",
  name: "Volt Lotus",
  image: "assets/plants/voltlotus/voltlotus.png",
  cost: 50,
  fireDistance: 9,
  cooldown: 7000,
  hp: 320,
  hitCount: 99,
  fireRate: 2000,
  description: "Chain lightning that hits all demons in its lane.",

  levelStats: {
    1: { hp: 320, fireRate: 2000, damage: 22, chainDamage: 11 },
    2: { hp: 390, fireRate: 1850, damage: 28, chainDamage: 14 },
    3: { hp: 470, fireRate: 1700, damage: 35, chainDamage: 17 },
    4: { hp: 560, fireRate: 1560, damage: 43, chainDamage: 21 },
    5: { hp: 660, fireRate: 1430, damage: 52, chainDamage: 26 },
    6: { hp: 770, fireRate: 1310, damage: 63, chainDamage: 31 },
    7: { hp: 890, fireRate: 1200, damage: 76, chainDamage: 38 },
    8: { hp: 1020, fireRate: 1100, damage: 91, chainDamage: 45 },
    9: { hp: 1160, fireRate: 1010, damage: 108, chainDamage: 54 },
    10: { hp: 1320, fireRate: 930, damage: 128, chainDamage: 64 },
    11: { hp: 1490, fireRate: 860, damage: 150, chainDamage: 75 },
    12: { hp: 1680, fireRate: 790, damage: 175, chainDamage: 87 },
    13: { hp: 1880, fireRate: 730, damage: 203, chainDamage: 101 },
    14: { hp: 2100, fireRate: 670, damage: 234, chainDamage: 117 },
    15: { hp: 2350, fireRate: 620, damage: 270, chainDamage: 135 },
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
    plantData.shotCount = 0;
  },

  onTick(row, col, plantData) {
    const active = Demons.getActive();
    const cellEl = Grid.getCellEl(row, col);
    if (!cellEl) return;
    const cellRect = cellEl.getBoundingClientRect();
    const gridEl = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;

    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;

    const demonsInRow = active.filter((d) => {
      if (d.dead || d.row !== row) return false;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return false;
      if (gridRect && dRect.left > gridRect.right) return false;
      return true;
    });

    if (demonsInRow.length === 0) return;

    const stats = this.getStats(plantData.level);
    plantData.shotCount = (plantData.shotCount || 0) + 1;
    const isOvercharge = plantData.shotCount % 5 === 0;
    const mult = isOvercharge ? 3 : 1;

    // Hit first demon with full damage, chain to rest with half
    demonsInRow.forEach((d, i) => {
      const dmg = i === 0 ? stats.damage * mult : stats.chainDamage * mult;
      setTimeout(() => {
        if (!d.dead) Demons.damage(d, dmg);
      }, i * 80);
    });

    // Lightning visual
    showLightning(row, col, demonsInRow, isOvercharge);

    if (isOvercharge) showOverchargeFlash();
  },

  onRemove(row, col) {},
});

function showLightning(row, col, targets, overcharge) {
  const layer = document.getElementById("effects-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  const color = overcharge ? "#fff700" : "#67e8f9";
  const glow = overcharge ? "rgba(255,247,0,0.9)" : "rgba(103,232,249,0.7)";
  const width = overcharge ? 5 : 3;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.cssText = `
    position:absolute;inset:0;width:100%;height:100%;
    pointer-events:none;z-index:25;overflow:visible;
  `;
  layer.appendChild(svg);

  let prevX = cellRect.right - layerRect.left;
  let prevY = cellRect.top - layerRect.top + cellRect.height * 0.5;

  targets.forEach((d, i) => {
    const dRect = d.el.getBoundingClientRect();
    const toX = dRect.left - layerRect.left + dRect.width / 2;
    const toY = dRect.top - layerRect.top + dRect.height / 2;

    // Jagged lightning path
    const midX = (prevX + toX) / 2 + (Math.random() - 0.5) * 30;
    const midY = (prevY + toY) / 2 + (Math.random() - 0.5) * 30;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M${prevX},${prevY} Q${midX},${midY} ${toX},${toY}`);
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", width);
    path.setAttribute("fill", "none");
    path.setAttribute("filter", `drop-shadow(0 0 6px ${glow})`);
    svg.appendChild(path);

    // Impact circle at demon
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("cx", toX);
    circle.setAttribute("cy", toY);
    circle.setAttribute("r", overcharge ? 18 : 10);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", color);
    circle.setAttribute("stroke-width", 2);
    circle.setAttribute("opacity", 0.8);
    svg.appendChild(circle);

    prevX = toX;
    prevY = toY;
  });

  setTimeout(() => svg.remove(), overcharge ? 500 : 300);
}

function showOverchargeFlash() {
  const flash = document.createElement("div");
  flash.style.cssText = `
    position:fixed;inset:0;
    background:rgba(255,247,0,0.25);
    pointer-events:none;z-index:9999;
    animation:overchargeFlash 0.4s ease-out forwards;
  `;
  document.body.appendChild(flash);
  if (!document.getElementById("overcharge-kf")) {
    const s = document.createElement("style");
    s.id = "overcharge-kf";
    s.textContent = "@keyframes overchargeFlash{0%{opacity:1}100%{opacity:0}}";
    document.head.appendChild(s);
  }
  setTimeout(() => flash.remove(), 400);
}
