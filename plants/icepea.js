/* plants/icepea.js
   Ice Peashooter: fires ice balls that slow demons.
   Slowed demons move at 40% speed for a duration.
   Level scaling: more damage, longer slow, faster fire.
*/

PlantRegistry.register({
  id: "icepea",
  name: "Ice Peashooter",
  image: "assets/plants/icepea.png",
  cost: 175,
  cooldown: 6000,
  hp: 300,
  fireRate: 2000,
  description: "Fires icy balls that freeze demons completely.",

  levelStats: {
    1: { hp: 300, fireRate: 2000, damage: 16, slowDuration: 2500 },
    2: { hp: 360, fireRate: 1800, damage: 21, slowDuration: 3000 },
    3: { hp: 440, fireRate: 1600, damage: 27, slowDuration: 3600 },
    4: { hp: 540, fireRate: 1400, damage: 34, slowDuration: 4200 },
    5: { hp: 660, fireRate: 1200, damage: 43, slowDuration: 5000 },
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
    const active  = Demons.getActive();
    const cellEl  = Grid.getCellEl(row, col);
    if (!cellEl) return;

    const cellRect  = cellEl.getBoundingClientRect();
    const arenaEl   = document.getElementById('screen-battle');
    const arenaRect = arenaEl ? arenaEl.getBoundingClientRect() : null;

    const gridEl   = document.getElementById('grid-container');
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;

    const demonAhead = active.some(d => {
      if (d.dead || d.row !== row) return false;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return false;
      if (gridRect && dRect.left > gridRect.right) return false;
      return true;
    });

    if (!demonAhead) return;

    const stats = this.getStats(plantData.level);
    Projectiles.spawn("ice-pea", row, col, stats.damage, {
      slow: true,
      slowDuration: stats.slowDuration,
    });
  },

  onRemove(row, col) {},
});
