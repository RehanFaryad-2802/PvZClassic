/* plants/icepea.js
   Ice Peashooter: fires ice balls that slow demons.
   Slowed demons move at 40% speed for a duration.
   Level scaling: more damage, longer slow, faster fire.
*/

PlantRegistry.register({
  id: "icepea",
  name: "Ice Peashooter",
  image: "assets/plants/icepea.png",
  fireDistance: 9,
  cost: 175,
  cooldown: 6000,
  hitCount: 1,
  hp: 300,
  fireRate: 2000,
  description: "Fires icy balls that freeze demons completely.",

  levelStats: {
    1:  { hp: 300,  fireRate: 2000, damage: 16,  slowDuration: 2500, cost: 175 },
    2:  { hp: 370,  fireRate: 1870, damage: 22,  slowDuration: 2700, cost: 175 },
    3:  { hp: 450,  fireRate: 1740, damage: 29,  slowDuration: 3000, cost: 175 },
    4:  { hp: 545,  fireRate: 1620, damage: 38,  slowDuration: 3300, cost: 175 },
    5:  { hp: 655,  fireRate: 1500, damage: 49,  slowDuration: 3600, cost: 175 },
    6:  { hp: 780,  fireRate: 1390, damage: 63,  slowDuration: 4000, cost: 175 },
    7:  { hp: 925,  fireRate: 1280, damage: 80,  slowDuration: 4400, cost: 175 },
    8:  { hp: 1090, fireRate: 1180, damage: 101, slowDuration: 4800, cost: 175 },
    9:  { hp: 1280, fireRate: 1080, damage: 128, slowDuration: 5200, cost: 175 },
    10: { hp: 1500, fireRate:  990, damage: 160, slowDuration: 5700, cost: 175 },
    11: { hp: 1750, fireRate:  910, damage: 200, slowDuration: 6200, cost: 175 },
    12: { hp: 2030, fireRate:  830, damage: 248, slowDuration: 6700, cost: 175 },
    13: { hp: 2350, fireRate:  760, damage: 306, slowDuration: 7200, cost: 175 },
    14: { hp: 2710, fireRate:  690, damage: 376, slowDuration: 7700, cost: 175 },
    15: { hp: 3120, fireRate:  620, damage: 460, slowDuration: 8500, cost: 175 },
  },

  getStats(level) {
    const capped = Math.min(Math.max(1, level), 15);
    return this.levelStats[capped] || this.levelStats[1];
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp = stats.hp;
    plantData.hp = stats.hp;

    // Aura ring behind plant
    const cell = Grid.getCellEl(row, col);
    if (cell) {
      const aura = document.createElement("div");
      aura.className = "ip-aura";
      cell.appendChild(aura);
    }

    requestAnimationFrame(() => {
      const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
      if (img) img.classList.add("ip-idle");
    });
  },

  onTick(row, col, plantData) {
    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;
    const stats = this.getStats(plantData.level);
    Projectiles.spawn("ice-pea", row, col, stats.damage, {
      slow: true,
      slowDuration: stats.slowDuration,
    });

    // Shoot animation + crystal muzzle flash
    const cell = Grid.getCellEl(row, col);
    const img = cell?.querySelector(".plant-entity");
    if (img && !plantData.shooting) {
      plantData.shooting = true;
      img.classList.remove("ip-idle");
      img.classList.add("ip-shoot");

      // Crystal muzzle flash in projectiles-layer coordinate space
      const projLayer = document.getElementById("projectiles-layer");
      if (projLayer && cell) {
        const cellRect = cell.getBoundingClientRect();
        const layerRect = projLayer.getBoundingClientRect();
        const mx = cellRect.right - layerRect.left - 10;
        const my = cellRect.top - layerRect.top + cellRect.height * 0.5 - 10;

        const muzzle = document.createElement("div");
        muzzle.className = "ip-muzzle";
        muzzle.style.left = mx + "px";
        muzzle.style.top  = my + "px";
        projLayer.appendChild(muzzle);
        setTimeout(() => muzzle.remove(), 220);
      }

      setTimeout(() => {
        if (img.isConnected) {
          img.classList.remove("ip-shoot");
          img.classList.add("ip-idle");
          plantData.shooting = false;
        }
      }, 380);
    }
  },

  onRemove(row, col) {
    const cell = Grid.getCellEl(row, col);
    if (cell) cell.querySelector(".ip-aura")?.remove();
  },

  onDamage(row, col, plantData) {
    const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
    if (!img) return;
    img.classList.remove("ip-idle", "ip-shoot");
    img.classList.add("ip-damaged");
    setTimeout(() => {
      if (img.isConnected) {
        img.classList.remove("ip-damaged");
        img.classList.add(plantData.shooting ? "ip-shoot" : "ip-idle");
      }
    }, 480);
  },
});
