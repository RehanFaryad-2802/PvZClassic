/* js/player.js
   Handles player name, coins, progress, save/load.
   All data stored in localStorage under key "pvz3_save"
*/

const Player = (() => {
  const SAVE_KEY = "pvz3_save";

  const DEFAULT_SAVE = {
    name: "",
    coins: 0,
    worldProgress: {
      1: 0,
      2: -1,
      3: -1,
      4: -1,
      5: -1,
      6: -1,
      7: -1,
      8: -1,
      9: -1,
      10: -1,
    },
    levelStars: {
      1: {},
      2: {},
      3: {},
      4: {},
      5: {},
      6: {},
      7: {},
      8: {},
      9: {},
      10: {},
    },
    plants: {
      sunflower: { owned: false, level: 1, seeds: 0, unlockedByLevel: false },
      peashooter: { owned: false, level: 1, seeds: 0, unlockedByLevel: false },
      icepea: { owned: false, level: 1, seeds: 0, unlockedByLevel: false },
      bonkchoy: { owned: false, level: 1, seeds: 0 },
      emberdoze: { owned: false, level: 1, seeds: 0 },
      lilybeam: { owned: false, level: 1, seeds: 0 },
      sporepuff: { owned: false, level: 1, seeds: 0 },
      voltlotus: { owned: false, level: 1, seeds: 0 },
      lavaburst: { owned: false, level: 1, seeds: 0 },
      glacierbud: { owned: false, level: 1, seeds: 0, unlockedByLevel: false },
      acornblast: { owned: false, level: 1, seeds: 0 },
      berryburst: { owned: false, level: 1, seeds: 0 },
      cactusneedle: { owned: false, level: 1, seeds: 0 },
      emberdoze: { owned: false, level: 1, seeds: 0 },
      fightblossom: { owned: false, level: 1, seeds: 0 },
      gumball: { owned: false, level: 1, seeds: 0 },
      mossmellow: { owned: false, level: 1, seeds: 0 },
      mushpuff: { owned: false, level: 1, seeds: 0 },
      orchidart: { owned: false, level: 1, seeds: 0 },
      rootboom: { owned: false, level: 1, seeds: 0 },
      shadowspore: { owned: false, level: 1, seeds: 0 },
    },
    unlockedMinigames: [],
    totalLevelsBeaten: 0,
  };

  let data = null;

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        // Try decode (new format)
        let parsed;
        try {
          const decoded = decodeURIComponent(escape(atob(raw)));
          parsed = JSON.parse(decoded);
        } catch (e) {
          // Fallback: old plain JSON format
          parsed = JSON.parse(raw);
        }

        // Verify checksum
        if (parsed._cs) {
          const { _cs, ...saveData } = parsed;
          const expected = generateChecksum(saveData);
          if (_cs !== expected) {
            console.warn("PvZ3: Save tampered — resetting");
            data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
            save();
            return;
          }
          parsed = saveData;
        }

        data = deepMerge(DEFAULT_SAVE, parsed);

        // Patch: add any plants from DEFAULT_SAVE missing from saved data
        for (const plantId in DEFAULT_SAVE.plants) {
          if (!data.plants[plantId]) {
            data.plants[plantId] = JSON.parse(
              JSON.stringify(DEFAULT_SAVE.plants[plantId]),
            );
          }
        }
        // Patch: add looms and inventory if missing
        if (data.looms === undefined) data.looms = 0;
        if (!data.inventory) data.inventory = [];
      } else {
        data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
      }
    } catch (e) {
      data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    }
  }

  function save() {
    try {
      const saveObj = { ...data, _cs: generateChecksum(data) };
      const encoded = btoa(
        unescape(encodeURIComponent(JSON.stringify(saveObj))),
      );
      localStorage.setItem(SAVE_KEY, encoded);
    } catch (e) {
      console.warn("PvZ3: Could not save game", e);
    }
  }

  function deepMerge(target, source) {
    const out = Object.assign({}, target);
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        out[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        out[key] = source[key];
      }
    }
    return out;
  }

  function hasName() {
    return data && data.name && data.name.trim().length > 0;
  }

  function setName(name) {
    data.name = name.trim().slice(0, 16);
    save();
  }

  function getName() {
    return data.name || "Hero";
  }

  function getCoins() {
    return data.coins || 0;
  }

  function addCoins(amount) {
    data.coins = (data.coins || 0) + Math.floor(amount);
    save();
  }

  function spendCoins(amount) {
    if (data.coins < amount) return false;
    data.coins -= amount;
    save();
    return true;
  }

  function getLooms() {
    return data.looms || 0;
  }

  function addLooms(amount) {
    data.looms = (data.looms || 0) + Math.floor(amount);
    save();
  }

  function spendLooms(amount) {
    if ((data.looms || 0) < amount) return false;
    data.looms -= amount;
    save();
    return true;
  }

  function getInventory() {
    if (!data.inventory) data.inventory = [];
    return data.inventory;
  }

  function getFullInventory() {
    const result = {};
    getInventory().forEach(item => {
      result[item.id] = { qty: item.quantity || 0, meta: item.meta || null };
    });
    return result;
  }

  function addInventoryItem(itemId, quantity = 1, meta = null) {
    if (!data.inventory) data.inventory = [];
    // Packets are unique items (never stacked), stored with metadata
    if (meta && meta.type === "minipacket") {
      data.inventory.push({ id: itemId, quantity: 1, meta });
      save();
      return;
    }
    const existing = data.inventory.find((i) => i.id === itemId && !i.meta);
    if (existing) {
      existing.quantity += quantity;
    } else {
      data.inventory.push({ id: itemId, quantity });
    }
    save();
  }

  function openPacket(packetId) {
    if (!data.inventory) return null;
    const idx = data.inventory.findIndex((i) => i.id === packetId);
    if (idx === -1) return null;
    const packet = data.inventory[idx];
    if (!packet.meta || packet.meta.type !== "minipacket") return null;
    const contents = packet.meta.contents;
    // Apply rewards
    contents.forEach((slot) => {
      if (slot.type === "looms") {
        data.looms = (data.looms || 0) + slot.amount;
      } else if (slot.type === "seeds" && slot.plantId) {
        if (!data.plants[slot.plantId]) return;
        data.plants[slot.plantId].seeds = (data.plants[slot.plantId].seeds || 0) + slot.amount;
        // Auto-unlock if threshold met
        const UNLOCK_SEEDS = 10;
        if (!data.plants[slot.plantId].owned && data.plants[slot.plantId].seeds >= UNLOCK_SEEDS) {
          data.plants[slot.plantId].owned = true;
          data.plants[slot.plantId].seeds -= UNLOCK_SEEDS;
        }
      }
    });
    // Remove packet from inventory
    data.inventory.splice(idx, 1);
    save();
    return contents;
  }

  function removeInventoryItem(itemId, quantity = 1) {
    if (!data.inventory) return false;
    const existing = data.inventory.find((i) => i.id === itemId);
    if (!existing || existing.quantity < quantity) return false;
    existing.quantity -= quantity;
    if (existing.quantity <= 0) {
      data.inventory = data.inventory.filter((i) => i.id !== itemId);
    }
    save();
    return true;
  }

  function getPlants() {
    return data.plants;
  }

  function getPlant(id) {
    return data.plants[id] || null;
  }

  function getOwnedPlants() {
    return Object.entries(data.plants)
      .filter(([, p]) => p.owned)
      .map(([id, p]) => ({ id, ...p }));
  }

  function addSeeds(plantId, amount) {
    if (!data.plants[plantId]) return;
    data.plants[plantId].seeds = (data.plants[plantId].seeds || 0) + amount;
    // Auto-unlock if not owned and seeds >= threshold
    const UNLOCK_SEEDS = 10;
    if (
      !data.plants[plantId].owned &&
      data.plants[plantId].seeds >= UNLOCK_SEEDS
    ) {
      data.plants[plantId].owned = true;
      data.plants[plantId].seeds -= UNLOCK_SEEDS;
    }
    save();
  }

  function unlockPlantByLevel(plantId) {
    if (!data.plants[plantId]) return false;
    data.plants[plantId].owned = true;
    data.plants[plantId].unlockedByLevel = true;
    save();
    return true;
  }

  function unlockMinigame(id) {
    if (!data.unlockedMinigames) data.unlockedMinigames = [];
    if (!data.unlockedMinigames.includes(id)) {
      data.unlockedMinigames.push(id);
      save();
    }
  }

  function isMinigameUnlocked(id) {
    if (!data.unlockedMinigames) return false;
    return data.unlockedMinigames.includes(id);
  }

  function levelUpPlant(plantId) {
    const p = data.plants[plantId];
    if (!p || !p.owned) return false;
    if (p.level >= 15) return false;

    const currentLevel = p.level;

    if (currentLevel >= 14) {
      // Levels 14–15: cost coins + seedCoins
      const cost = Seeds.getLevelUpCost(currentLevel);
      if (!cost) return false;
      if (data.coins < cost.coins) return false;
      const seedCoinItem = (data.inventory || []).find(i => i.id === "seedCoin");
      const ownedSeedCoins = seedCoinItem ? seedCoinItem.quantity : 0;
      if (ownedSeedCoins < cost.seedCoins) return false;
      // Deduct
      data.coins -= cost.coins;
      removeInventoryItem("seedCoin", cost.seedCoins);
    } else {
      // Levels 1–13: cost coins only
      const coinCost = Seeds.getLevelUpCoinCost(currentLevel);
      if (!coinCost) return false;
      if (data.coins < coinCost) return false;
      data.coins -= coinCost;
    }

    p.level += 1;
    save();
    return true;
  }

  function getWorldProgress() {
    return data.worldProgress;
  }

  function isWorldUnlocked(worldId) {
    return data.worldProgress[worldId] !== -1;
  }

  function unlockWorld(worldId) {
    if (data.worldProgress[worldId] === -1) {
      data.worldProgress[worldId] = 0;
      save();
    }
  }

  function getLevelStars(worldId, levelIdx) {
    return (
      (data.levelStars[worldId] && data.levelStars[worldId][levelIdx]) || 0
    );
  }

  function setLevelStars(worldId, levelIdx, stars) {
    if (!data.levelStars[worldId]) data.levelStars[worldId] = {};
    const current = data.levelStars[worldId][levelIdx] || 0;
    if (stars > current) {
      data.levelStars[worldId][levelIdx] = stars;
    }
    // Update world progress
    const currentProg = data.worldProgress[worldId] || 0;
    if (levelIdx + 1 > currentProg) {
      data.worldProgress[worldId] = levelIdx + 1;
    }
    data.totalLevelsBeaten =
      (data.totalLevelsBeaten || 0) +
      (stars > current && current === 0 ? 1 : 0);
    save();
  }

  function isLevelUnlocked(worldId, levelIdx) {
    if (!isWorldUnlocked(worldId)) return false;
    if (levelIdx === 0) return true;
    // Previous level must be completed (stars > 0)
    return getLevelStars(worldId, levelIdx - 1) > 0;
  }

  function getTotalLevelsBeaten() {
    return data.totalLevelsBeaten || 0;
  }

  function reset() {
    data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    save();
  }

  function enableAllContent() {
    // If already called with empty save (e.g., before PlantRegistry/Levels load), no crash.

    // Open all worlds
    data.worldProgress = Object.keys(data.worldProgress || {}).reduce(
      (acc, k) => {
        acc[k] = 9999;
        return acc;
      },
      {},
    );

    // Mark all plants as owned and max them
    const allPlants =
      typeof PlantRegistry !== "undefined" && PlantRegistry.getAll
        ? PlantRegistry.getAll()
        : [];

    // Fallback: ensure known ids exist in save
    const ids = allPlants.length
      ? allPlants.map((p) => p.id)
      : Object.keys(data.plants || {});

    ids.forEach((id) => {
      if (!data.plants[id]) {
        data.plants[id] = {
          owned: false,
          level: 1,
          seeds: 0,
          unlockedByLevel: false,
        };
      }
      data.plants[id].owned = true;
      data.plants[id].unlockedByLevel = true;
      data.plants[id].level = 15;
      data.plants[id].seeds = 999999;
    });

    // Ensure minigames are unlocked (all known ones)
    // MINIGAME_UNLOCKS is defined in Levels; use it if available.
    const allMgs =
      typeof Levels !== "undefined" && Array.isArray(Levels.MINIGAME_UNLOCKS)
        ? Levels.MINIGAME_UNLOCKS.map((x) => x.minigameId)
        : [];
    data.unlockedMinigames = Array.from(new Set(allMgs));

    // Beat all levels
    if (typeof Levels !== "undefined" && Levels.getAllWorlds) {
      const allWorlds = Levels.getAllWorlds();
      allWorlds.forEach((w) => {
        const lvlCount = w.levelCount || 0;
        if (!data.levelStars[w.id]) data.levelStars[w.id] = {};
        for (let i = 0; i < lvlCount; i++) {
          data.levelStars[w.id][i] = 3; // 3 stars for completed
        }
        data.worldProgress[w.id] = Math.max(
          data.worldProgress[w.id] || 0,
          lvlCount,
        );
      });
    }

    data.totalLevelsBeaten = 99999;

    save();
  }

  // ── Save Protection ────────────────────────
  function generateChecksum(obj) {
    const str = JSON.stringify(obj);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  // Initialize immediately
  load();

  return {
    load,
    save,
    hasName,
    setName,
    getName,
    getCoins,
    addCoins,
    spendCoins,
    getLooms,
    addLooms,
    spendLooms,
    getInventory,
    getFullInventory,
    addInventoryItem,
    removeInventoryItem,
    openPacket,
    getPlants,
    getPlant,
    getOwnedPlants,
    addSeeds,
    levelUpPlant,
    getWorldProgress,
    isWorldUnlocked,
    unlockWorld,
    getLevelStars,
    setLevelStars,
    isLevelUnlocked,
    getTotalLevelsBeaten,
    reset,
    enableAllContent,
    unlockPlantByLevel,
    unlockMinigame,
    isMinigameUnlocked,
  };
})();

