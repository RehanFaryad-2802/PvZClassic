/* plants/peashooter.js
   Peashooter: fires green peas at demons in its row.
   Only fires when a demon is present in the same row.
   Level scaling: more damage and fire rate.
*/

PlantRegistry.register({
  id:       'peashooter',
  name:     'Peashooter',
  image:    'assets/plants/peashooter.png',
  cost:     100,
  hp:       300,
  fireRate: 1500,
  cooldown: 5000,
  description: 'Fires peas at demons in its lane.',

  levelStats: {
    1: { hp: 300, fireRate: 1500, damage: 20 },
    2: { hp: 360, fireRate: 1350, damage: 26 },
    3: { hp: 440, fireRate: 1200, damage: 33 },
    4: { hp: 540, fireRate: 1050, damage: 42 },
    5: { hp: 660, fireRate:  900, damage: 52 },
  },

  getStats(level) {
    return this.levelStats[level] || this.levelStats[1];
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp  = stats.hp;
    plantData.hp     = stats.hp;
    plantData.damage = stats.damage;
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
      // Only fire when demon is inside grid right edge
      if (gridRect && dRect.left > gridRect.right) return false;
      return true;
    });

    if (!demonAhead) return;

    const stats = this.getStats(plantData.level);
    Projectiles.spawn('pea', row, col, stats.damage);
  },

  onRemove(row, col) {},
});
