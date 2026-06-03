/* plants/peashooter.js
   Peashooter: fires green peas at demons in its row.
   Only fires when a demon is present in the same row.
   Level scaling: more damage and fire rate.
*/

PlantRegistry.register({
  id: "peashooter",
  name: "Peashooter",
  image: "assets/plants/peashooter.png",
  cost: 100,
  fireDistance: 9,
  hp: 300,
  hitCount: 1,
  fireRate: 1500,
  cooldown: 5000,
  description: "Fires peas at demons in its lane.",

  levelStats: {
    1:  { hp: 300,  fireRate: 1500, damage: 20,  cost: 100 },
    2:  { hp: 370,  fireRate: 1400, damage: 27,  cost: 100 },
    3:  { hp: 450,  fireRate: 1300, damage: 35,  cost: 100 },
    4:  { hp: 550,  fireRate: 1200, damage: 45,  cost: 100 },
    5:  { hp: 660,  fireRate: 1100, damage: 57,  cost: 100 },
    6:  { hp: 790,  fireRate: 1000, damage: 72,  cost: 100 },
    7:  { hp: 940,  fireRate:  920, damage: 90,  cost: 100 },
    8:  { hp: 1110, fireRate:  840, damage: 112, cost: 100 },
    9:  { hp: 1300, fireRate:  770, damage: 138, cost: 100 },
    10: { hp: 1510, fireRate:  700, damage: 170, cost: 100 },
    11: { hp: 1750, fireRate:  640, damage: 208, cost: 100 },
    12: { hp: 2020, fireRate:  580, damage: 252, cost: 100 },
    13: { hp: 2320, fireRate:  530, damage: 304, cost: 100 },
    14: { hp: 2660, fireRate:  480, damage: 365, cost: 100 },
    15: { hp: 3040, fireRate:  430, damage: 438, cost: 100 },
  },

  getStats(level) {
    const capped = Math.min(Math.max(1, level), 15);
    return this.levelStats[capped] || this.levelStats[1];
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp = stats.hp;
    plantData.hp = stats.hp;
    plantData.damage = stats.damage;

    requestAnimationFrame(() => {
      const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
      if (img) img.classList.add("ps-idle");
    });
  },

  onTick(row, col, plantData) {
    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;
    const stats = this.getStats(plantData.level);
    SoundFX.play("pea_shoot");
    Projectiles.spawn("pea", row, col, stats.damage, { damageType: "physical" });

    // Shoot animation
    const cell = Grid.getCellEl(row, col);
    const img = cell?.querySelector(".plant-entity");
    if (img && !plantData.shooting) {
      plantData.shooting = true;
      img.classList.remove("ps-idle");
      img.classList.add("ps-shoot");

      // Muzzle flash — same coordinate space as projectiles
      const projLayer = document.getElementById("projectiles-layer");
      if (projLayer) {
        const cellRect = cell.getBoundingClientRect();
        const layerRect = projLayer.getBoundingClientRect();
        const mx = cellRect.right - layerRect.left - 9;
        const my = cellRect.top - layerRect.top + cellRect.height * 0.5 - 9;

        const muzzle = document.createElement("div");
        muzzle.className = "ps-muzzle";
        muzzle.style.left = mx + "px";
        muzzle.style.top  = my + "px";
        projLayer.appendChild(muzzle);
        setTimeout(() => muzzle.remove(), 180);
      }

      setTimeout(() => {
        if (img.isConnected) {
          img.classList.remove("ps-shoot");
          img.classList.add("ps-idle");
          plantData.shooting = false;
        }
      }, 300);
    }
  },

  onRemove(row, col) {},

  onDamage(row, col, plantData) {
    const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
    if (!img) return;
    img.classList.remove("ps-idle", "ps-shoot");
    img.classList.add("ps-damaged");
    setTimeout(() => {
      if (img.isConnected) {
        img.classList.remove("ps-damaged");
        img.classList.add(plantData.shooting ? "ps-shoot" : "ps-idle");
      }
    }, 450);
  },
});
