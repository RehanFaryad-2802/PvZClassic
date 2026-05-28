/* plants/icepea.js
   Ice Peashooter: fires ice balls that slow demons.
   Slowed demons move at 40% speed for a duration.
   Level scaling: more damage, longer slow, faster fire.
*/

PlantRegistry.register({
  id: "icepea",
  name: "Ice Peashooter",
  image: "assets/plants/icepea/icepea.png",
  fireDistance: 9,
  cost: 175,
  cooldown: 6000,
  hitCount: 1,
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
    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;
    const stats = this.getStats(plantData.level);
    Projectiles.spawn("ice-pea", row, col, stats.damage, {
      slow: true,
      slowDuration: stats.slowDuration,
    });
  },
  onRemove(row, col) {},
});
