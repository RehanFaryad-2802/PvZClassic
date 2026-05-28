/* plants/sporepuff.js
   Spore Puff: launches spore balls that confuse demons
   making them walk backward. Passive aura slows nearby demons.
*/

PlantRegistry.register({
  id: "sporepuff",
  name: "Spore Puff",
  image: "assets/plants/sporepuff/sporepuff.png",
  cost: 50,
  // cost: 150,
  fireDistance: 9,
  cooldown: 5000,
  hp: 280,
  fireRate: 3000,
  hitCount: 99, // beam hits ALL demons in row
  description: "Confuses demons, making them walk backward.",

  levelStats: {
    1: {
      hp: 280,
      fireRate: 3000,
      damage: 12,
      confuseDuration: 2000,
      auraCells: 2,
    },
    2: {
      hp: 340,
      fireRate: 2800,
      damage: 16,
      confuseDuration: 2300,
      auraCells: 2,
    },
    3: {
      hp: 410,
      fireRate: 2600,
      damage: 20,
      confuseDuration: 2600,
      auraCells: 2,
    },
    4: {
      hp: 490,
      fireRate: 2400,
      damage: 25,
      confuseDuration: 3000,
      auraCells: 3,
    },
    5: {
      hp: 580,
      fireRate: 2200,
      damage: 31,
      confuseDuration: 3400,
      auraCells: 3,
    },
    6: {
      hp: 680,
      fireRate: 2000,
      damage: 38,
      confuseDuration: 3800,
      auraCells: 3,
    },
    7: {
      hp: 790,
      fireRate: 1800,
      damage: 46,
      confuseDuration: 4200,
      auraCells: 4,
    },
    8: {
      hp: 910,
      fireRate: 1650,
      damage: 55,
      confuseDuration: 4600,
      auraCells: 4,
    },
    9: {
      hp: 1040,
      fireRate: 1500,
      damage: 65,
      confuseDuration: 5000,
      auraCells: 4,
    },
    10: {
      hp: 1200,
      fireRate: 1380,
      damage: 77,
      confuseDuration: 5500,
      auraCells: 5,
    },
    11: {
      hp: 1370,
      fireRate: 1260,
      damage: 90,
      confuseDuration: 6000,
      auraCells: 5,
    },
    12: {
      hp: 1550,
      fireRate: 1150,
      damage: 105,
      confuseDuration: 6500,
      auraCells: 5,
    },
    13: {
      hp: 1740,
      fireRate: 1050,
      damage: 122,
      confuseDuration: 7000,
      auraCells: 6,
    },
    14: {
      hp: 1950,
      fireRate: 960,
      damage: 141,
      confuseDuration: 7500,
      auraCells: 6,
    },
    15: {
      hp: 2200,
      fireRate: 880,
      damage: 163,
      confuseDuration: 8000,
      auraCells: 6,
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
  },

  onTick(row, col, plantData) {
    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;

    const active = Demons.getActive();
    const cellEl = Grid.getCellEl(row, col);
    if (!cellEl) return;
    const cellRect = cellEl.getBoundingClientRect();
    const gridEl = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
    const stats = this.getStats(plantData.level);

    let target = null,
      closestDist = Infinity;
    active.forEach((d) => {
      if (d.dead || d.row !== row) return;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return;
      if (gridRect && dRect.left > gridRect.right) return;
      const dist = dRect.left - cellRect.right;
      if (dist < closestDist) {
        closestDist = dist;
        target = d;
      }
    });
    if (!target) return;

    // Damage + confuse (reverse direction)
    Demons.damage(target, stats.damage);
    confuseDemon(target, stats.confuseDuration);

    // Spore visual
    spawnSpore(row, col, target);
  },

  onRemove(row, col) {},
});

function confuseDemon(demon, duration) {
  if (demon.confused) return;
  demon.confused = true;
  demon.confuseTimer = duration;
  demon.originalSpeed = demon.currentSpeed;
  demon.currentSpeed = -demon.speed * 0.6; // walk backward at 60% speed
  if (demon.el) {
    demon.el.style.transform = "scaleX(-1)"; // flip direction
    demon.el.style.filter = "hue-rotate(200deg) brightness(1.2)";
  }

  // Clear confusion after duration
  setTimeout(() => {
    if (!demon.dead) {
      demon.confused = false;
      demon.confuseTimer = 0;
      demon.currentSpeed = demon.speed;
      if (demon.el) {
        demon.el.style.transform = "";
        demon.el.style.filter = "";
      }
    }
  }, duration);
}

function spawnSpore(row, col, target) {
  const layer = document.getElementById("projectiles-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  const spore = document.createElement("div");
  spore.style.cssText = `
    position:absolute;
    width:16px;height:16px;
    background:radial-gradient(circle,#d8b4fe,#7c3aed);
    border-radius:50%;
    box-shadow:0 0 10px rgba(139,92,246,0.8);
    pointer-events:none;
    left:${cellRect.right - layerRect.left}px;
    top:${cellRect.top - layerRect.top + cellRect.height * 0.5 - 8}px;
    z-index:15;
    transition:left 0.4s linear,top 0.4s linear;
  `;
  layer.appendChild(spore);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const dRect = target.el.getBoundingClientRect();
      spore.style.left =
        dRect.left - layerRect.left + dRect.width / 2 - 8 + "px";
      spore.style.top = dRect.top - layerRect.top + dRect.height / 2 - 8 + "px";
    });
  });

  setTimeout(() => {
    spore.remove();
    // Confusion puff effect at demon
    const dRect = target.el.getBoundingClientRect();
    const puff = document.createElement("div");
    puff.textContent = "😵💫";
    puff.style.cssText = `
      position:absolute;
      font-size:22px;
      left:${dRect.left - layerRect.left}px;
      top:${dRect.top - layerRect.top - 20}px;
      pointer-events:none;z-index:30;
      animation:floatUp 1s ease-out forwards;
    `;
    layer.appendChild(puff);
    setTimeout(() => puff.remove(), 1000);
  }, 400);
}
