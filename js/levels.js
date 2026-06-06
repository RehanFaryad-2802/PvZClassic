const Levels = (() => {
  // ── World Definitions ──────────────────────────
  const WORLDS = [
    {
      id: 1,
      name: "Inferno Fields",
      bossLevelIdx: 30, // level 31 (0-based = 30) is the boss
      sub: "Where it all begins",
      emoji: "🔥",
      bgClass: "world-1",
      unlocked: true,
      levelCount: 31,
      demons: [
        "imp",
        "bat",
        "imp_axe",
        "imp_shield",
        "imp_heavy",
        "imp_king",
        "ice",
        "armored",
        "brute",
      ],
      demonUnlockByLevel: {
        imp: 1, // from level 1
        bat: 3, // from level 3
        imp_axe: 5,
        imp_shield: 8,
        imp_heavy: 12,
        imp_king: 14,
        ice: 14,
        armored: 14,
        brute: 14,
      },
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
      sub: "Shadow Realm awaits",
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
      sub: "Beyond the Frozen!",
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
      sub: "Keep going you'll find!",
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
      sub: "Found the secret world!",
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
      sub: "The ultimate challenge",
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
      hp: 100,
      speed: 30,
      damage: 40,
      biteRate: 800,
      special: "dodge",
      reward: "imp",
    },
    imp_axe: {
      id: "imp_axe",
      name: "Axe Imp",
      image: "assets/demons/var2.png",
      hp: 120,
      speed: 35,
      damage: 80,
      biteRate: 800,
      special: "dodge",
      reward: "imp",
      damageModifiers: {
        physical: 0,
        ice: 1.0,
        fire: 1.0,
        electric: 1.0,
        psychic: 1.0,
        beam: 1.0,
      },
    },
    imp_shield: {
      id: "imp_shield",
      name: "Shield Imp",
      image: "assets/demons/var1.png",
      hp: 150, // 20% more than base (80 * 1.2)
      speed: 35,
      damage: 60,
      biteRate: 800,
      special: "dodge",
      reward: "imp",
      damageModifiers: {
        physical: 1, // 30% less from everything
        ice: 0,
        fire: 0,
        electric: 1,
        psychic: 1.4, // BUT psychic deals 40% MORE
        beam: 0.5,
      },
    },
    imp_heavy: {
      id: "imp_heavy",
      name: "Heavy Imp",
      image: "assets/demons/var3.png",
      hp: 250, // 100% more than base (80 * 2)
      speed: 35,
      damage: 40,
      biteRate: 800,
      special: "dodge",
      reward: "imp",
      damageModifiers: {
        physical: 1.4, // 40% MORE from physical
        ice: 1.0, // ice-pea is physical+ice so BOTH apply — handled in damage()
        fire: 1.0,
        electric: 1.0,
        psychic: 1.0,
        beam: 1.0,
      },
    },
    imp_king: {
      id: "imp_king",
      name: "Imp King",
      image: "assets/demons/var4.png",
      hp: 200,
      speed: 35,
      damage: 0,
      biteRate: 99999,
      special: ["spawn"], // spawns other demons instead of attacking
      reward: "imp",
      // King config — all tunable
      kingConfig: {
        STOP_COL: 8, // stops at column index 1
        SPAWN_INTERVAL: 10000, // ms between spawns
        SPAWN_TYPES: ["bat", "bat", "imp", "imp_axe"], // what spawns
        // positions relative to king: up, down, front1, front2
        SPAWN_OFFSETS: [
          { rowDelta: -1, colDelta: 0 }, // one row up
          { rowDelta: 1, colDelta: 0 }, // one row down
          { rowDelta: 0, colDelta: -1 }, // one col ahead (left)
          { rowDelta: 0, colDelta: -2 }, // two cols ahead
        ],
      },
      damageModifiers: {},
    },
    bat: {
      id: "bat",
      name: "Shadow Bat",
      image: "assets/demons/demon3_bat.png",
      hp: 60,
      speed: 80,
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
      speed: 50,
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
      speed: 50,
      damage: 100,
      biteRate: 1500,
      special: "armor", // 40% dmg reduction
      reward: "armored",
    },
    brute: {
      id: "brute",
      name: "Brute Demon",
      image: "assets/demons/demon5_brute.png",
      hp: 400,
      speed: 40,
      damage: 150,
      biteRate: 1100,
      special: "charge", // doubles speed when HP < 30%
      reward: "brute",
    },
  };

  // ── World Plant Pools (for seed packets) ───────
  // These are the plants that can appear in seed packets for each world
  const WORLD_PLANTS = {
    1: ["sunflower", "peashooter", "icepea", "bonkchoy", "lilybeam", "sporepuff", "voltlotus", "lavaburst", "glacierbud"],
    2: ["icepea", "glacierbud", "sporepuff", "lilybeam", "voltlotus"],
    3: ["bonkchoy", "peashooter", "lavaburst", "voltlotus", "sporepuff"],
    4: ["shadowspore", "sporepuff", "lavaburst", "bonkchoy", "glacierbud"],
    5: ["voltlotus", "lilybeam", "peashooter", "icepea", "sporepuff"],
    6: ["mossmellow", "sporepuff", "bonkchoy", "lilybeam", "lavaburst"],
    7: ["glacierbud", "icepea", "voltlotus", "sporepuff", "lilybeam"],
    8: ["shadowspore", "sporepuff", "lavaburst", "glacierbud", "bonkchoy"],
    9: ["voltlotus", "lilybeam", "lavaburst", "icepea", "glacierbud"],
    10: ["peashooter", "bonkchoy", "sporepuff", "voltlotus", "lavaburst"],
  };

  // ── Packet Reward Table ────────────────────────
  // Add entries here to give a mini seed packet on level completion
  // levelIdx is 0-based (level 5 = idx 4)
  const PACKET_REWARDS = [
    { worldId: 1, levelIdx: 0  }, // W1 Level 1
    { worldId: 1, levelIdx: 9  }, // W1 Level 10
    { worldId: 1, levelIdx: 14 }, // W1 Level 15
    { worldId: 1, levelIdx: 19 }, // W1 Level 20
    { worldId: 1, levelIdx: 24 }, // W1 Level 25
    { worldId: 1, levelIdx: 29 }, // W1 Level 30
    // Add more worlds here as you build them:
    // { worldId: 2, levelIdx: 4 },
  ];

  // ── Plant Unlock Table ─────────────────────────
  // levelIdx is 0-based: level 1 = idx 0, level 2 = idx 1
  const PLANT_UNLOCKS = [
    { worldId: 1, levelIdx: 0,plantId: "peashooter" },
    { worldId: 1, levelIdx: 0,plantId: "sunflower" },
    { worldId: 1, levelIdx: 0,plantId: "icepea" },
    { worldId: 1, levelIdx: 0,plantId: "bonkchoy" },
    { worldId: 1, levelIdx: 0,plantId: "glacierbud" },
    { worldId: 1, levelIdx: 0,plantId: "lilybeam" },
    { worldId: 1, levelIdx: 0,plantId: "sporepuff" },
    { worldId: 1, levelIdx: 0,plantId: "lavaburst" },
    { worldId: 1, levelIdx: 0,plantId: "voltlotus" },
  ];

  // ── Minigame Unlock Table ──────────────────────
  const MINIGAME_UNLOCKS = [
    { worldId: 1, levelIdx: 3, minigameId: "blockhunt" }, // W1 Level 4
    { worldId: 1, levelIdx: 3, minigameId: "bombball" }, // W1 Level 4
    { worldId: 1, levelIdx: 3, minigameId: "sharpshooters" }, // W1 Level 4
    { worldId: 1, levelIdx: 0, minigameId: "discofdoom" }, // W1 Level 1
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

    const LEVEL_CFG = {
      // Waves per level
      MIN_WAVES: 3, // minimum waves any level has
      MAX_WAVES: 8, // cap — never more than this
      WAVES_PER_LEVELS: 3, // every N levels = +1 wave

      // Demons per wave (normal waves)
      BASE_DEMONS_PER_WAVE: 1, // wave 1 starts with this many
      DEMONS_PER_DIFFICULTY: 3, // every N difficulty = +1 demon per wave
      MAX_DEMONS_PER_WAVE: 8, // cap per normal wave

      // Last wave (final wave of each level)
      LAST_WAVE_ROWS: 5, // always fills all 5 rows minimum
      LAST_WAVE_EXTRA_PER: 3, // every N difficulty = +1 extra demon on last wave
      LAST_WAVE_HP_MULT: 1.3, // last wave demons are tougher
      LAST_WAVE_EXTRA_HP_MULT: 1.5, // extra demons even tougher

      // HP scaling per level
      HP_SCALE_PER_LEVEL: 0.18, // each level adds 18% more HP

      // Speed
      ELITE_SPEED_MULT: 1.0, // elite level speed
      NORMAL_SPEED_MULT: 0.55, // normal level speed
      LAST_WAVE_SPEED_MULT: 0.6, // last wave speed

      // Wave pool progression (which demons appear per wave)
      // wave 0 = only first demon type
      // wave 1+ = first 2 types
      // wave 2+ = all available
      POOL_EXPAND_WAVE_1: 1,
      POOL_EXPAND_WAVE_2: 2,

      // Spawn delay between demons in same wave (ms)
      SPAWN_DELAY_NORMAL: 2000, // ms between each demon in normal wave
      SPAWN_DELAY_LAST: 800, // ms between each demon in last wave
      SPAWN_DELAY_EXTRA: 1500, // ms between extra demons in last wave

      // Wave trigger delay (ms before next wave starts)
      WAVE_DELAY: 3000,
    };
    const C = LEVEL_CFG; // shorthand
    const hpMult = 1 + (difficulty - 1) * C.HP_SCALE_PER_LEVEL;
    const waves = [];
    const totalWaves = Math.min(
      C.MIN_WAVES + Math.floor(difficulty / C.WAVES_PER_LEVELS),
      C.MAX_WAVES,
    );
    const waveCount = totalWaves;

    // Filter demons available at this difficulty
    const unlockMap = world.demonUnlockByLevel || {};
    const available = (world.demons || []).filter((dType) => {
      const minLevel = unlockMap[dType];
      return minLevel === undefined || difficulty >= minLevel;
    });
    const safeAvailable = available.length > 0 ? available : [world.demons[0]];

    // Track rows used across early waves so wave 2 can avoid them
    const wave0UsedRows = [];
    const wave1UsedRows = [];

    // Only base/normal demons for early waves (no variants, no specials)
    const BASE_TYPES = ["imp", "bat"];
    const basePool = safeAvailable.filter((t) => BASE_TYPES.includes(t));
    const safeBasePool = basePool.length > 0 ? basePool : [safeAvailable[0]];

    for (let w = 0; w < totalWaves; w++) {
      const demons = [];
      const isLastWave = w === totalWaves - 1;

      // ── Pool: which demon types can appear this wave ──
      let pool = [safeAvailable[0]];
      if (w >= C.POOL_EXPAND_WAVE_1 && safeAvailable.length > 1)
        pool = safeAvailable.slice(0, 2);
      if (w >= C.POOL_EXPAND_WAVE_2) pool = safeAvailable;
      if (isElite) pool = safeAvailable;

      // ══════════════════════════════════════════════
      // WAVE 0 — exactly 1 demon, random row, base type only
      // ══════════════════════════════════════════════
      if (w === 0 && !isLastWave) {
        const type = safeBasePool[0]; // always first base type (imp)
        const base = DEMON_STATS[type];
        if (base) {
          const row = Math.floor(Math.random() * 5);
          wave0UsedRows.push(row);
          demons.push({
            type,
            hp: Math.floor(base.hp * hpMult),
            speed: base.speed * C.NORMAL_SPEED_MULT,
            damage: base.damage,
            biteRate: base.biteRate,
            special: base.special,
            row,
            spawnDelay: 0,
          });
        }

        // ══════════════════════════════════════════════
        // WAVE 1 — exactly 2 demons, different rows from wave 0, base types only
        // ══════════════════════════════════════════════
      } else if (w === 1 && !isLastWave) {
        // Pick 2 rows that were NOT used in wave 0
        const availRows = [0, 1, 2, 3, 4].filter(
          (r) => !wave0UsedRows.includes(r),
        );
        // Shuffle available rows
        for (let i = availRows.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [availRows[i], availRows[j]] = [availRows[j], availRows[i]];
        }
        const pickedRows = availRows.slice(0, 2);

        pickedRows.forEach((row, i) => {
          // Alternate between available base types
          const type = safeBasePool[i % safeBasePool.length];
          const base = DEMON_STATS[type];
          if (!base) return;
          wave1UsedRows.push(row);
          demons.push({
            type,
            hp: Math.floor(base.hp * hpMult),
            speed: base.speed * C.NORMAL_SPEED_MULT,
            damage: base.damage,
            biteRate: base.biteRate,
            special: base.special,
            row,
            spawnDelay: i * C.SPAWN_DELAY_NORMAL,
          });
        });

        // ══════════════════════════════════════════════
        // WAVE 2 — exactly 3 demons: 2 in new rows + 1 repeat row, base types
        // ══════════════════════════════════════════════
      } else if (w === 2 && !isLastWave) {
        const usedSoFar = [...wave0UsedRows, ...wave1UsedRows];
        const freshRows = [0, 1, 2, 3, 4].filter((r) => !usedSoFar.includes(r));

        // Shuffle fresh rows
        for (let i = freshRows.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [freshRows[i], freshRows[j]] = [freshRows[j], freshRows[i]];
        }

        // 2 fresh rows + 1 repeat from wave 0 or 1
        const repeatRow =
          usedSoFar[Math.floor(Math.random() * usedSoFar.length)];
        const wave2Rows = [
          ...(freshRows.length >= 2 ? freshRows.slice(0, 2) : freshRows),
          repeatRow,
        ];

        wave2Rows.forEach((row, i) => {
          const type = safeBasePool[i % safeBasePool.length];
          const base = DEMON_STATS[type];
          if (!base) return;
          demons.push({
            type,
            hp: Math.floor(base.hp * hpMult),
            speed: base.speed * C.NORMAL_SPEED_MULT,
            damage: base.damage,
            biteRate: base.biteRate,
            special: base.special,
            row,
            spawnDelay: i * C.SPAWN_DELAY_NORMAL,
          });
        });

        // ══════════════════════════════════════════════
        // WAVE 3+ — original logic, no change
        // ══════════════════════════════════════════════
      } else if (isLastWave) {
        // ── Last wave: one demon per row guaranteed ──
        for (let r = 0; r < C.LAST_WAVE_ROWS; r++) {
          const type = pool[Math.floor(Math.random() * pool.length)];
          const base = DEMON_STATS[type];
          if (!base) continue;
          demons.push({
            type,
            hp: Math.floor(base.hp * hpMult * C.LAST_WAVE_HP_MULT),
            speed:
              base.speed *
              (isElite ? C.ELITE_SPEED_MULT : C.LAST_WAVE_SPEED_MULT),
            damage: base.damage,
            biteRate: base.biteRate,
            special: base.special,
            row: r,
            spawnDelay: r * C.SPAWN_DELAY_LAST,
          });
        }

        // Extra demons for higher difficulties
        const extras = Math.floor(difficulty / C.LAST_WAVE_EXTRA_PER);
        for (let e = 0; e < extras; e++) {
          const type = pool[Math.floor(Math.random() * pool.length)];
          const base = DEMON_STATS[type];
          if (!base) continue;
          demons.push({
            type,
            hp: Math.floor(base.hp * hpMult * C.LAST_WAVE_EXTRA_HP_MULT),
            speed: base.speed * C.LAST_WAVE_SPEED_MULT,
            damage: base.damage,
            biteRate: base.biteRate,
            special: base.special,
            row: Math.floor(Math.random() * 5),
            spawnDelay: 5000 + e * C.SPAWN_DELAY_EXTRA,
          });
        }
      } else {
        // ── Normal wave (w >= 3) ──
        const demonCount = Math.min(
          C.BASE_DEMONS_PER_WAVE +
            w +
            Math.floor(difficulty / C.DEMONS_PER_DIFFICULTY),
          C.MAX_DEMONS_PER_WAVE,
        );

        const usedRows = [];
        for (let d = 0; d < demonCount; d++) {
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
          if (!base) continue;
          demons.push({
            type,
            hp: Math.floor(base.hp * hpMult),
            speed:
              base.speed * (isElite ? C.ELITE_SPEED_MULT : C.NORMAL_SPEED_MULT),
            damage: base.damage,
            biteRate: base.biteRate,
            special: base.special,
            row,
            spawnDelay: d * C.SPAWN_DELAY_NORMAL,
          });
        }
      }

      waves.push({ demons, waveDelay: C.WAVE_DELAY, triggerOnKill: w > 0 });
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

  // ── Packet Reward Logic ────────────────────────
  function checkPacketReward(worldId, levelIdx) {
    return PACKET_REWARDS.find(
      (p) => p.worldId === worldId && p.levelIdx === levelIdx
    ) || null;
  }

  function generatePacketContents(worldId) {
    const pool = WORLD_PLANTS[worldId] || WORLD_PLANTS[1];
    // Pick 3 unique plants
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, Math.min(3, shuffled.length));

    // Build 3 slots: each is seeds, but 1% chance = looms
    const slots = picks.map((plantId) => {
      const isLoom = Math.random() < 0.01; // 1% chance
      if (isLoom) {
        return { type: "looms", amount: 10 };
      }
      return { type: "seeds", plantId, amount: 10 };
    });

    return slots;
  }

  function getWorldPlants(worldId) {
    return WORLD_PLANTS[worldId] || [];
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
    checkPacketReward,
    generatePacketContents,
    getWorldPlants,
    DEMON_STATS,
    PLANT_UNLOCKS,
    MINIGAME_UNLOCKS,
  };
})();
