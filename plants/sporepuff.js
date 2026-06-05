/* plants/sporepuff.js
   Spore Puff: launches spore balls that confuse demons
   making them walk backward. Passive aura slows nearby demons.
*/

PlantRegistry.register({
  id: "sporepuff",
  name: "Spore Puff",
  image: "assets/plants/sporepuff.png",
  cost: 50,
  // cost: 150,
  fireDistance: 9,
  cooldown: 1000,
  hp: 280,
  fireRate: 1000,
  hitCount: 99,
  description: "Confuses demons, making them walk backward.",

  levelStats: {
    1: {
      hp: 280,
      fireRate: 4000,
      damage: 5,
      confuseDuration: 2000,
      auraCells: 6,
    },
    2: {
      hp: 340,
      fireRate: 3800,
      damage: 6,
      confuseDuration: 2200,
      auraCells: 2,
    },
    3: {
      hp: 410,
      fireRate: 3600,
      damage: 7,
      confuseDuration: 2400,
      auraCells: 2,
    },
    4: {
      hp: 490,
      fireRate: 3400,
      damage: 8,
      confuseDuration: 2600,
      auraCells: 3,
    },
    5: {
      hp: 580,
      fireRate: 3200,
      damage: 9,
      confuseDuration: 2800,
      auraCells: 3,
    },
    6: {
      hp: 680,
      fireRate: 3000,
      damage: 10,
      confuseDuration: 3000,
      auraCells: 3,
    },
    7: {
      hp: 790,
      fireRate: 2800,
      damage: 11,
      confuseDuration: 3300,
      auraCells: 4,
    },
    8: {
      hp: 910,
      fireRate: 2500,
      damage: 12,
      confuseDuration: 3500,
      auraCells: 4,
    },
    9: {
      hp: 1040,
      fireRate: 2200,
      damage: 13,
      confuseDuration: 3800,
      auraCells: 4,
    },
    10: {
      hp: 1200,
      fireRate: 1900,
      damage: 15,
      confuseDuration: 4150,
      auraCells: 5,
    },
    11: {
      hp: 1370,
      fireRate: 1900,
      damage: 17,
      confuseDuration: 4150,
      auraCells: 5,
    },
    12: {
      hp: 1550,
      fireRate: 1900,
      damage: 19,
      confuseDuration: 4150,
      auraCells: 5,
    },
    13: {
      hp: 1740,
      fireRate: 1900,
      damage: 21,
      confuseDuration: 4150,
      auraCells: 6,
    },
    14: {
      hp: 1950,
      fireRate: 1900,
      damage: 23,
      confuseDuration: 4150,
      auraCells: 6,
    },
    15: {
      hp: 2200,
      fireRate: 1900,
      damage: 26,
      confuseDuration: 4150,
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
    plantData.lastFireTime = 0;

    // Smoke wisps + orb glows on hands
    const cell = Grid.getCellEl(row, col);
    if (cell) {
      const smokeL = document.createElement("div");
      smokeL.className = "sp-smoke left";
      cell.appendChild(smokeL);

      const smokeR = document.createElement("div");
      smokeR.className = "sp-smoke right";
      cell.appendChild(smokeR);

      const orbL = document.createElement("div");
      orbL.className = "sp-orb-glow left";
      cell.appendChild(orbL);

      const orbR = document.createElement("div");
      orbR.className = "sp-orb-glow right";
      cell.appendChild(orbR);
    }

    requestAnimationFrame(() => {
      const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
      if (img) img.classList.add("sp-idle");
    });
  },

  onTick(row, col, plantData) {
    const stats = this.getStats(plantData.level);

    const now = Date.now();

    if (!plantData.lastFireTime) plantData.lastFireTime = 0;

    // fire rate control
    if (now - plantData.lastFireTime < stats.fireRate) return;

    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;

    const active = Demons.getActive();
    const cellEl = Grid.getCellEl(row, col);
    if (!cellEl) return;

    const cellRect = cellEl.getBoundingClientRect();
    const gridEl = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;

    let target = null,
      closestDist = Infinity;
SoundFX.play("pea_shoot");
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

    Demons.damage(target, stats.damage, "psychic");
    setTimeout(() => {
      confuseDemon(target, stats.confuseDuration);
    }, 400);
    spawnSpore(row, col, target);

    // Throw animation
    const cell = Grid.getCellEl(row, col);
    const img = cell?.querySelector(".plant-entity");
    if (img && !plantData.throwing) {
      plantData.throwing = true;
      img.classList.remove("sp-idle");
      img.classList.add("sp-throw");
      setTimeout(() => {
        if (img.isConnected) {
          img.classList.remove("sp-throw");
          img.classList.add("sp-idle");
          plantData.throwing = false;
        }
      }, 500);
    }

    // update fire time AFTER attack
    plantData.lastFireTime = now;
  },

  onRemove(row, col) {
    const cell = Grid.getCellEl(row, col);
    if (cell) {
      cell.querySelector(".sp-smoke.left")?.remove();
      cell.querySelector(".sp-smoke.right")?.remove();
      cell.querySelector(".sp-orb-glow.left")?.remove();
      cell.querySelector(".sp-orb-glow.right")?.remove();
    }
  },

  onDamage(row, col, plantData) {
    const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
    if (!img) return;
    img.classList.remove("sp-idle", "sp-throw");
    img.classList.add("sp-damaged");
    setTimeout(() => {
      if (img.isConnected) {
        img.classList.remove("sp-damaged");
        img.classList.add(plantData.throwing ? "sp-throw" : "sp-idle");
      }
    }, 480);
  },
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
  spore.className = "sp-orb-proj";
  spore.style.cssText = `
    left:${cellRect.right - layerRect.left}px;
    top:${cellRect.top - layerRect.top + cellRect.height * 0.5 - 7}px;
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
    // Confusion ring burst at demon
    const ring = document.createElement("div");
    ring.className = "sp-confuse-ring";
    const dCx = dRect.left - layerRect.left + dRect.width / 2;
    const dCy = dRect.top  - layerRect.top  + dRect.height / 2;
    ring.style.cssText = `
      left:${dCx - 16}px;top:${dCy - 16}px;
      width:32px;height:32px;
    `;
    layer.appendChild(ring);

    // Dizzy spiral text
    const puff = document.createElement("div");
    puff.textContent = "?!";
    puff.style.cssText = `
      position:absolute;
      font-family:var(--font-display);
      font-size:18px;font-weight:900;
      color:#d8b4fe;
      text-shadow:0 0 8px rgba(168,85,247,0.9);
      left:${dRect.left - layerRect.left}px;
      top:${dRect.top - layerRect.top - 20}px;
      pointer-events:none;z-index:30;
      animation:floatUp 1s ease-out forwards;
    `;
    layer.appendChild(puff);
    setTimeout(() => { ring.remove(); puff.remove(); }, 1000);
  }, 400);
}
