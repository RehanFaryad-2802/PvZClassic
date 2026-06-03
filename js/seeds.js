/* js/seeds.js
   Seed inventory helpers and level-up thresholds.
   Actual seed storage is in Player; this file
   exposes config and UI helpers.
*/

const Seeds = (() => {
  // Coin cost to level up (levels 1–13)
  const LEVEL_UP_COIN_COST = {
    1: 50,
    2: 500,
    3: 830,
    4: 1090,
    5: 1560,
    6: 1910,
    7: 2500,
    8: 2940,
    9: 3550,
    10: 4500,
    11: 5500,
    12: 6700,
    13: 8000,
  };

  // SeedCoin cost for levels 14 and 15
  const LEVEL_UP_SEEDCOIN_COST = {
    14: { coins: 9000, seedCoins: 200 },
    15: { coins: 10000, seedCoins: 350 },
  };

  // Seeds needed to unlock (first time getting) a plant
  const UNLOCK_COST = 100;

  // Legacy alias (kept so nothing else breaks)
  const LEVEL_UP_COST = { ...LEVEL_UP_COIN_COST };

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
    if (currentLevel >= 14) return LEVEL_UP_SEEDCOIN_COST[currentLevel] || null;
    return LEVEL_UP_COIN_COST[currentLevel] || null;
  }

  function getLevelUpCoinCost(currentLevel) {
    if (currentLevel >= 14) return LEVEL_UP_SEEDCOIN_COST[currentLevel]?.coins || null;
    return LEVEL_UP_COIN_COST[currentLevel] || null;
  }

  function getLevelUpSeedCoinCost(currentLevel) {
    return LEVEL_UP_SEEDCOIN_COST[currentLevel]?.seedCoins || 0;
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
    getLevelUpCoinCost,
    getLevelUpSeedCoinCost,
    getUnlockCost,
    getLevelProgress,
    tryLevelUp,
    giveRandomSeeds,
    giveSeeds,
    UNLOCK_COST,
    LEVEL_UP_COST,
    LEVEL_UP_COIN_COST,
    LEVEL_UP_SEEDCOIN_COST,
  };
})();
