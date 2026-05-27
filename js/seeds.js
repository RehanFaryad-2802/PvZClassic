/* js/seeds.js
   Seed inventory helpers and level-up thresholds.
   Actual seed storage is in Player; this file
   exposes config and UI helpers.
*/

const Seeds = (() => {
  const LEVEL_UP_COST = {
    1: 20,
    2: 35,
    3: 50,
    4: 70,
    5: 90,
    6: 110,
    7: 135,
    8: 160,
    9: 190,
    10: 220,
    11: 260,
    12: 300,
    13: 350,
    14: 400,
  };

  // Seeds needed to unlock (first time getting) a plant
  const UNLOCK_COST = 10;

  // Seed rewards per minigame score bracket
  const MINIGAME_SEED_TABLE = {
    blockhunt: [
      { minScore: 0, seeds: 1 },
      { minScore: 3, seeds: 2 },
      { minScore: 6, seeds: 3 },
      { minScore: 10, seeds: 5 },
    ],
  };

  function getSeedsForMinigame(gameId, score) {
    const table = MINIGAME_SEED_TABLE[gameId];
    if (!table) return 1;
    let reward = table[0].seeds;
    for (const row of table) {
      if (score >= row.minScore) reward = row.seeds;
    }
    return reward;
  }

  function getLevelUpCost(currentLevel) {
    return LEVEL_UP_COST[currentLevel] || null;
  }

  function getUnlockCost() {
    return UNLOCK_COST;
  }

  // Returns 0–1 progress toward next level
  function getLevelProgress(plantId) {
    const p = Player.getPlant(plantId);
    if (!p || p.level >= 5) return 1;
    const cost = LEVEL_UP_COST[p.level];
    if (!cost) return 1;
    return Math.min(p.seeds / cost, 1);
  }

  function tryLevelUp(plantId) {
    return Player.levelUpPlant(plantId);
  }

  // Give seeds to a random owned plant (used as level drop reward)
  function giveRandomSeeds(amount) {
    const owned = Player.getOwnedPlants();
    if (owned.length === 0) return null;
    const pick = owned[Math.floor(Math.random() * owned.length)];
    Player.addSeeds(pick.id, amount);
    return { plantId: pick.id, amount };
  }

  // Give seeds to a specific plant
  function giveSeeds(plantId, amount) {
    Player.addSeeds(plantId, amount);
    return { plantId, amount };
  }

  return {
    getSeedsForMinigame,
    getLevelUpCost,
    getUnlockCost,
    getLevelProgress,
    tryLevelUp,
    giveRandomSeeds,
    giveSeeds,
    UNLOCK_COST,
    LEVEL_UP_COST,
  };
})();
