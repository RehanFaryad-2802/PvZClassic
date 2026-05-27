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
    if (!Demons.isDemonInRow(row)) return;

    const stats = this.getStats(plantData.level);
    const arena = document.getElementById("grid-container");
    if (!arena) return;

    const cellW = arena.offsetWidth / Grid.getCols();
    const plantX = col * cellW;
    const rangeX = stats.range * cellW;

    // Hit all demons in row within range to the RIGHT of plant
    const active = Demons.getActive();
    let hit = false;
    for (const demon of active) {
      if (demon.dead || demon.row !== row) continue;
      if (demon.x >= plantX && demon.x <= plantX + rangeX) {
        Demons.damage(demon, stats.damage);

        // Show punch effect
        const cell = Grid.getCellEl(row, col);
        if (cell) {
          const ef = document.createElement("div");
          ef.className = "effect-hit crit";
          ef.textContent = "💥";
          ef.style.left =
            demon.x -
            arena.getBoundingClientRect().left +
            arena.getBoundingClientRect().left -
            arena.getBoundingClientRect().left +
            "px";
          ef.style.top = demon.y + "px";
          const effectsEl = document.getElementById("effects-layer");
          if (effectsEl) {
            ef.style.left = demon.x + "px";
            ef.style.top = demon.y - 10 + "px";
            effectsEl.appendChild(ef);
            setTimeout(() => ef.remove(), 700);
          }
        }
        hit = true;
      }
    }
    // Only animate if we actually hit
    if (hit && plantData.element) {
      plantData.element.style.transform = "scale(1.2)";
      setTimeout(() => {
        if (plantData.element) plantData.element.style.transform = "";
      }, 150);
    }
  },

  onRemove(row, col) {},
});
