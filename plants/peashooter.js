/* plants/peashooter.js
   Peashooter: fires green peas at demons in its row.
   Only fires when a demon is present in the same row.
   Level scaling: more damage and fire rate.
*/

PlantRegistry.register({
  id: "peashooter",
  name: "Peashooter",
  image: "assets/plants/peashooter/peashooter.png",
  cost: 100,
  fireDistance: 9,
  hp: 300,
  hitCount: 1,
  fireRate: 1500,
  cooldown: 5000,
  description: "Fires peas at demons in its lane.",

  levelStats: {
    1: { hp: 300, fireRate: 1500, damage: 20 },
    2: { hp: 360, fireRate: 1350, damage: 26 },
    3: { hp: 440, fireRate: 1200, damage: 33 },
    4: { hp: 540, fireRate: 1050, damage: 42 },
    5: { hp: 660, fireRate: 900, damage: 52 },
  },

  getStats(level) {
    return this.levelStats[level] || this.levelStats[1];
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp = stats.hp;
    plantData.hp = stats.hp;
    plantData.damage = stats.damage;
  },

  onTick(row, col, plantData) {
    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;
    const stats = this.getStats(plantData.level);
    Projectiles.spawn("pea", row, col, stats.damage);
  },

  onRemove(row, col) {},
});
