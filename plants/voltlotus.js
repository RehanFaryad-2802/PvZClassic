/* plants/voltlotus.js
   Volt Lotus: chain lightning hitting all demons in row.
   Every 5th shot = overcharge (3x damage + screen flash).
*/

PlantRegistry.register({
  id: "voltlotus",
  name: "Volt Lotus",
  image: "assets/plants/voltlotus.png",
  cost: 50,
  fireDistance: 9,
  cooldown: 7000,
  hp: 320,
  hitCount: 1,
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

    const cell = Grid.getCellEl(row, col);
    if (cell) {
      // Gem on headband
      const gem = document.createElement("div");
      gem.className = "vl-gem";
      cell.appendChild(gem);

      // Glowing eyes
      const eyes = document.createElement("div");
      eyes.className = "vl-eyes";
      const eyeL = document.createElement("div");
      eyeL.className = "vl-eye";
      const eyeR = document.createElement("div");
      eyeR.className = "vl-eye";
      eyes.appendChild(eyeL);
      eyes.appendChild(eyeR);
      cell.appendChild(eyes);

      // Static sparks — 6 around the cell at different angles
      const sparkConfigs = [
        {
          left: "10%",
          top: "20%",
          height: "14px",
          r: "-30deg",
          delay: "0s",
          dur: "0.9s",
        },
        {
          left: "80%",
          top: "15%",
          height: "18px",
          r: "25deg",
          delay: "0.3s",
          dur: "1.1s",
        },
        {
          left: "5%",
          top: "60%",
          height: "12px",
          r: "-50deg",
          delay: "0.6s",
          dur: "0.8s",
        },
        {
          left: "85%",
          top: "55%",
          height: "16px",
          r: "40deg",
          delay: "0.15s",
          dur: "1.3s",
        },
        {
          left: "40%",
          top: "8%",
          height: "10px",
          r: "10deg",
          delay: "0.45s",
          dur: "1s",
        },
        {
          left: "60%",
          top: "70%",
          height: "13px",
          r: "-15deg",
          delay: "0.75s",
          dur: "1.2s",
        },
      ];

      sparkConfigs.forEach((cfg) => {
        const spark = document.createElement("div");
        spark.className = "vl-spark";
        spark.style.cssText = `
          left:${cfg.left};top:${cfg.top};
          height:${cfg.height};
          --r:${cfg.r};
          animation-duration:${cfg.dur};
          animation-delay:${cfg.delay};
        `;
        cell.appendChild(spark);
      });
    }

    requestAnimationFrame(() => {
      const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
      if (img) img.classList.add("vl-idle");
    });
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

    // Limit chain to hitCount targets
    const chainTargets = demonsInRow.slice(0, this.hitCount);

    // Hit first demon with full damage, chain to rest with half
    chainTargets.forEach((d, i) => {
      const dmg = i === 0 ? stats.damage * mult : stats.chainDamage * mult;
      setTimeout(() => {
        if (!d.dead) Demons.damage(d, dmg, "electric");
      }, i * 80);
    });

    // Lightning visual
    showLightning(row, col, chainTargets, isOvercharge);

    // Discharge animation
    const cell = Grid.getCellEl(row, col);
    const img = cell?.querySelector(".plant-entity");
    if (img && !plantData.discharging) {
      plantData.discharging = true;
      img.classList.remove("vl-idle");
      img.classList.add(isOvercharge ? "vl-overcharge" : "vl-discharge");

      // Origin burst in projectiles-layer space
      const projLayer = document.getElementById("projectiles-layer");
      if (projLayer && cell) {
        const cellRect = cell.getBoundingClientRect();
        const layerRect = projLayer.getBoundingClientRect();
        const burst = document.createElement("div");
        burst.className = "vl-origin-burst";
        const size = isOvercharge ? 40 : 24;
        burst.style.cssText = `
          left:${cellRect.right - layerRect.left - size / 2}px;
          top:${cellRect.top - layerRect.top + cellRect.height * 0.5 - size / 2}px;
          width:${size}px; height:${size}px;
        `;
        projLayer.appendChild(burst);
        setTimeout(() => burst.remove(), 300);
      }

      const dur = isOvercharge ? 500 : 320;
      setTimeout(() => {
        if (img.isConnected) {
          img.classList.remove("vl-discharge", "vl-overcharge");
          img.classList.add("vl-idle");
          plantData.discharging = false;
        }
      }, dur);
    }

    if (isOvercharge) showOverchargeFlash();
  },

  onRemove(row, col) {
    const cell = Grid.getCellEl(row, col);
    if (cell) {
      cell.querySelector(".vl-gem")?.remove();
      cell.querySelector(".vl-eyes")?.remove();
      cell.querySelectorAll(".vl-spark").forEach((s) => s.remove());
    }
  },

  onDamage(row, col, plantData) {
    const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
    if (!img) return;
    img.classList.remove("vl-idle", "vl-discharge", "vl-overcharge");
    img.classList.add("vl-damaged");
    setTimeout(() => {
      if (img.isConnected) {
        img.classList.remove("vl-damaged");
        img.classList.add("vl-idle");
        plantData.discharging = false;
      }
    }, 500);
  },
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
