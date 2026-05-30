/* js/levels.js
   World and level definitions.
   Each level defines: waves, demons per wave,
   available sun, grid rows, unlock conditions.
*/

const Levels = (() => {
  // ── World Definitions ──────────────────────────
  const WORLDS = [
    {
      id: 1,
      name: "Inferno Fields",
      sub: "Where it all begins",
      emoji: "🔥",
      bgClass: "world-1",
      unlocked: true,
      levelCount: 30,
      demons: ["imp", "bat"],
    },
    {
      id: 2,
      name: "Frozen Wastes",
      sub: "Chill to the bone",
      emoji: "❄️",
      bgClass: "world-2",
      unlocked: false,
      unlockAfterWorld: 1,
      levelCount: 30,
      demons: ["imp", "bat", "ice"],
    },
    {
      id: 3,
      name: "Iron Fortress",
      sub: "Steel walls, demon halls",
      emoji: "⚔️",
      bgClass: "world-3",
      unlocked: false,
      unlockAfterWorld: 2,
      levelCount: 30,
      demons: ["armored", "brute", "imp"],
    },
    {
      id: 4,
      name: "Shadow Realm",
      sub: "Tthe final darkness",
      emoji: "🌑",
      bgClass: "world-4",
      unlocked: false,
      unlockAfterWorld: 2,
      levelCount: 30,
      demons: ["imp", "bat", "ice", "armored", "brute"],
    },
    {
      id: 5,
      name: "Cyber Neon",
      sub: "The Cyber Neon Night",
      emoji: "🤖",
      bgClass: "world-5",
      unlocked: false,
      unlockAfterWorld: 4,
      levelCount: 30,
      demons: ["imp", "bat", "ice", "armored", "brute"],
    },
    {
      id: 6,
      name: "Jungle Abyss",
      sub: "To the right of the Shadow Realm, a new world awaits",
      emoji: "🌴",
      bgClass: "world-6",
      unlocked: false,
      unlockAfterWorld: 5,
      levelCount: 30,
      demons: ["imp", "bat", "ice", "armored", "brute"],
    },
    {
      id: 7,
      name: "Ice Age",
      sub: "Beyond the Frozen Wastes, a new world emerges",
      emoji: "❄️",
      bgClass: "world-7",
      unlocked: false,
      unlockAfterWorld: 6,
      levelCount: 30,
      demons: ["imp", "bat", "ice", "armored", "brute"],
    },
    {
      id: 8,
      name: "Spooky Mansion",
      sub: "Keep going right and you'll find it",
      emoji: "👻",
      bgClass: "world-8",
      unlocked: false,
      unlockAfterWorld: 7,
      levelCount: 30,
      demons: ["imp", "bat", "ice", "armored", "brute"],
    },
    {
      id: 9,
      name: "Crystal Caverns",
      sub: "You found the secret world! But can you beat it?",
      emoji: "💎",
      bgClass: "world-9",
      unlocked: false,
      unlockAfterWorld: 8,
      levelCount: 30,
      demons: ["imp", "bat", "ice", "armored", "brute"],
    },
    {
      id: 10,
      name: "Sky Castle",
      sub: "The ultimate challenge awaits in the skies",
      emoji: "🏰",
      bgClass: "world-10",
      unlocked: false,
      unlockAfterWorld: 9,
      levelCount: 30,
      demons: ["imp", "bat", "ice", "armored", "brute"],
    },
  ];

  // ── Demon stats (base) ─────────────────────────
  const DEMON_STATS = {
    imp: {
      id: "imp",
      name: "Imp",
      image: "assets/demons/demon1_imp.png",
      hp: 80,
      speed: 50, // px per second
      damage: 40, // damage per bite tick
      biteRate: 800, // ms between bites
      special: "dodge", // 15% chance to dodge projectile
      reward: "imp",
    },
    bat: {
      id: "bat",
      name: "Shadow Bat",
      image: "assets/demons/demon3_bat.png",
      hp: 60,
      speed: 65,
      damage: 8,
      biteRate: 800,
      special: "flying", // skips row 1 plant (front row)
      reward: "bat",
    },
    ice: {
      id: "ice",
      name: "Frost Gargoyle",
      image: "assets/demons/demon4_ice.png",
      hp: 140,
      speed: 28,
      damage: 12,
      biteRate: 1200,
      special: "freeze", // freezes plants it attacks (slows their fire rate)
      reward: "ice",
    },
    armored: {
      id: "armored",
      name: "Iron Warlord",
      image: "assets/demons/demon2_armored.png",
      hp: 400,
      speed: 16,
      damage: 20,
      biteRate: 1500,
      special: "armor", // 40% dmg reduction
      reward: "armored",
    },
    brute: {
      id: "brute",
      name: "Brute Demon",
      image: "assets/demons/demon5_brute.png",
      hp: 280,
      speed: 22,
      damage: 25,
      biteRate: 1100,
      special: "charge", // doubles speed when HP < 30%
      reward: "brute",
    },
  };

  // ── Plant Unlock Table ─────────────────────────
  // levelIdx is 0-based: level 1 = idx 0, level 2 = idx 1
  const PLANT_UNLOCKS = [
    { worldId: 1, levelIdx: 0, plantId: "peashooter" }, // W1 Level 1
    { worldId: 1, levelIdx: 1, plantId: "sunflower" }, // W1 Level 2
    { worldId: 1, levelIdx: 6, plantId: "icepea" }, // W1 Level 7
    { worldId: 1, levelIdx: 12, plantId: "bonkchoy" }, // W1 Level 13
    { worldId: 1, levelIdx: 0, plantId: "peashooter" },
    { worldId: 1, levelIdx: 1, plantId: "sunflower" },
    { worldId: 1, levelIdx: 2, plantId: "lilybeam" },
    { worldId: 1, levelIdx: 3, plantId: "sporepuff" },
    { worldId: 1, levelIdx: 4, plantId: "voltlotus" },
    { worldId: 1, levelIdx: 5, plantId: "lavaburst" },
    { worldId: 1, levelIdx: 6, plantId: "icepea" },
    { worldId: 1, levelIdx: 12, plantId: "bonkchoy" },
    // Future plants added here
  ];

  // ── Minigame Unlock Table ──────────────────────
  const MINIGAME_UNLOCKS = [
    { worldId: 1, levelIdx: 3, minigameId: "blockhunt" }, // W1 Level 4
    { worldId: 1, levelIdx: 3, minigameId: "bombball" }, // W1 Level 4
    { worldId: 1, levelIdx: 3, minigameId: "sharpshooters" }, // W1 Level 4
    // Future minigames added here
  ];

  const LEVEL_TEMP_PLANTS = {
    "1-0": ["peashooter"],
    "1-1": ["sunflower"],
    "1-2": ["lilybeam"],
    "1-3": ["sporepuff"],
    "1-4": ["voltlotus"],
    "1-5": ["lavaburst"],
    "1-6": ["icepea"],
    "1-12": ["bonkchoy"],
  };

  // ── Starting sun per level ─────────────────────
  function getStartingSun(worldId, levelIdx) {
    if (worldId === 1 && levelIdx === 0) return 500; // Level 1
    if (worldId === 1 && levelIdx === 1) return 250; // Level 2
    return 100 + Math.min(levelIdx * 5, 50); // Rest normal
  }

  // ── Level Generator ────────────────────────────
  // Builds level config dynamically from world + index
  function getLevel(worldId, levelIdx) {
    const world = WORLDS.find((w) => w.id === worldId);
    if (!world) return null;

    const difficulty = levelIdx + 1; // 1-based difficulty
    const isElite = (levelIdx + 1) % 5 === 0; // every 5th level is elite

    // Scale HP and count with difficulty
    const hpMult = 1 + (difficulty - 1) * 0.18;
    const waves = [];
    const totalWaves = Math.min(3 + Math.floor(difficulty / 2), 8);
    const waveCount = totalWaves;

    for (let w = 0; w < totalWaves; w++) {
      const demons = [];
      const available = world.demons;

      // Last wave of every level = one demon per row (5 rows)
      const isLastWave = w === totalWaves - 1;

      // Demon count: w+1 normally, but last wave fills all 5 rows
      // Higher difficulty = more demons per wave
      const baseCount = isLastWave ? 5 : w + 1 + Math.floor(difficulty / 3);
      const demonCount = Math.min(
        baseCount,
        isLastWave ? 5 + Math.floor(difficulty / 2) : 8,
      );

      // Pool gets harder each wave
      let pool = [available[0]];
      if (w >= 1 && available.length > 1) pool = available.slice(0, 2);
      if (w >= 2) pool = available;
      if (isElite) pool = available;

      if (isLastWave) {
        // Fill every row — guaranteed one demon per row minimum
        const rowsToFill = 5 + Math.floor(difficulty / 3); // higher level = multiple per row
        const usedRows = [];

        for (let r = 0; r < 5; r++) {
          usedRows.push(r);
          const type = pool[Math.floor(Math.random() * pool.length)];
          const base = DEMON_STATS[type];
          demons.push({
            type,
            hp: Math.floor(base.hp * hpMult * 1.3), // last wave demons are tougher
            speed: base.speed * (isElite ? 1.0 : 0.6),
            damage: base.damage,
            biteRate: base.biteRate,
            special: base.special,
            row: r,
            spawnDelay: r * 800, // stagger per row
          });
        }

        // Higher levels add extra demons on top of the 5
        const extras = Math.floor(difficulty / 3);
        for (let e = 0; e < extras; e++) {
          const type = pool[Math.floor(Math.random() * pool.length)];
          const base = DEMON_STATS[type];
          demons.push({
            type,
            hp: Math.floor(base.hp * hpMult * 1.5),
            speed: base.speed * 0.65,
            damage: base.damage,
            biteRate: base.biteRate,
            special: base.special,
            row: Math.floor(Math.random() * 5),
            spawnDelay: 5000 + e * 1500, // come after first wave
          });
        }
      } else {
        // Normal wave — random rows, no row guarantee
        const usedRows = [];
        for (let d = 0; d < demonCount; d++) {
          // Try to avoid same row twice in early waves
          let row;
          if (d < 5 && usedRows.length < 5) {
            do {
              row = Math.floor(Math.random() * 5);
            } while (usedRows.includes(row) && usedRows.length < 5);
          } else {
            row = Math.floor(Math.random() * 5);
          }
          usedRows.push(row);

          const type = pool[Math.floor(Math.random() * pool.length)];
          const base = DEMON_STATS[type];
          demons.push({
            type,
            hp: Math.floor(base.hp * hpMult),
            speed: base.speed * (isElite ? 0.9 : 0.55),
            damage: base.damage,
            biteRate: base.biteRate,
            special: base.special,
            row,
            spawnDelay: d * 2000,
          });
        }
      }

      waves.push({ demons, waveDelay: 3000, triggerOnKill: w > 0 });
    }

    // Sky drops sun for all levels by default
    // Can be set to false per level in future
    const skyDropSun = true;

    return {
      worldId,
      levelIdx,
      isElite,
      difficulty,
      waveCount,
      waves,
      startingSun: isElite ? 125 : getStartingSun(worldId, levelIdx),
      coinReward: Coins.getLevelReward(worldId),
      skyDropSun,
      rows: 5,
      cols: 9,
    };
  }

  function getWorld(worldId) {
    return WORLDS.find((w) => w.id === worldId) || null;
  }

  function getAllWorlds() {
    return WORLDS;
  }

  function getDemonStats(type) {
    return DEMON_STATS[type] || null;
  }

  function checkPlantUnlocks(worldId, levelIdx) {
    const unlocked = [];
    for (const unlock of PLANT_UNLOCKS) {
      if (unlock.worldId === worldId && unlock.levelIdx === levelIdx) {
        const p = Player.getPlant(unlock.plantId);
        if (p && !p.owned) {
          Player.unlockPlantByLevel(unlock.plantId);
          unlocked.push(unlock.plantId);
        }
      }
    }
    return unlocked.length > 0 ? unlocked : null;
  }

  function checkMinigameUnlocks(worldId, levelIdx) {
    const unlocked = [];
    for (const mg of MINIGAME_UNLOCKS) {
      if (mg.worldId === worldId && mg.levelIdx === levelIdx) {
        Player.unlockMinigame(mg.minigameId);
        unlocked.push(mg.minigameId);
      }
    }
    return unlocked;
  }

  function getTempPlants(worldId, levelIdx) {
    return LEVEL_TEMP_PLANTS[`${worldId}-${levelIdx}`] || [];
  }

  // Check and unlock next world based on progress
  function checkWorldUnlocks() {
    for (const world of WORLDS) {
      if (world.unlockAfterWorld) {
        const prevProg = Player.getWorldProgress()[world.unlockAfterWorld];
        const prevWorld = WORLDS.find((w) => w.id === world.unlockAfterWorld);
        if (prevWorld && prevProg >= prevWorld.levelCount) {
          Player.unlockWorld(world.id);
        }
      }
    }
  }

  return {
    getAllWorlds,
    getWorld,
    getLevel,
    getDemonStats,
    checkWorldUnlocks,
    checkPlantUnlocks,
    checkMinigameUnlocks,
    getTempPlants,
    DEMON_STATS,
    PLANT_UNLOCKS,
    MINIGAME_UNLOCKS,
  };
})();
