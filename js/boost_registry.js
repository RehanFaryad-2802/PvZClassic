/* js/boost_registry.js
   All boost definitions in one place.
   Edit values here to tune any boost without touching game logic.
*/

const BoostRegistry = (() => {

  // ── Master Boost Definitions ──────────────────────────────────────────
  // type: "battle"    = consumed on use, lasts one battle
  // type: "timed"     = lasts real-world seconds after activation
  // type: "permanent" = applied forever to a specific plant
  //
  // effect keys are read by Boosts.js to apply the buff
  // ─────────────────────────────────────────────────────────────────────

  const BOOSTS = {

    // ── SUN RUSH ────────────────────────────────────────────────────────
    // Level 1-5. Sun value added per sky drop increases with level.
    // dropInterval: ms between forced sky-drop spawns (lower = faster)
    sun_rush_1: {
      id: "sun_rush_1",
      name: "Sun Rush I",
      type: "battle",
      icon: "assets/boosts/sun_rush_1.png",
      fallbackIcon: "☀️",
      description: "Faster sun drops worth +300 sun during battle.",
      level: 1,
      maxLevel: 5,
      nextId: "sun_rush_2",
      effect: {
        sunRush: true,
        sunDropValue: 300,       // sun added per drop
        dropInterval: 8000,      // ms between auto drops (8s)
        dropDuration: 0,         // 0 = whole battle
      },
      obtainedFrom: "merge_minigame",
    },
    sun_rush_2: {
      id: "sun_rush_2",
      name: "Sun Rush II",
      type: "battle",
      icon: "assets/boosts/sun_rush_2.png",
      fallbackIcon: "☀️",
      description: "Faster sun drops worth +375 sun during battle.",
      level: 2,
      maxLevel: 5,
      nextId: "sun_rush_3",
      effect: {
        sunRush: true,
        sunDropValue: 375,
        dropInterval: 7000,
        dropDuration: 0,
      },
      obtainedFrom: "merge_minigame",
    },
    sun_rush_3: {
      id: "sun_rush_3",
      name: "Sun Rush III",
      type: "battle",
      icon: "assets/boosts/sun_rush_3.png",
      fallbackIcon: "☀️",
      description: "Faster sun drops worth +450 sun during battle.",
      level: 3,
      maxLevel: 5,
      nextId: "sun_rush_4",
      effect: {
        sunRush: true,
        sunDropValue: 450,
        dropInterval: 6000,
        dropDuration: 0,
      },
      obtainedFrom: "merge_minigame",
    },
    sun_rush_4: {
      id: "sun_rush_4",
      name: "Sun Rush IV",
      type: "battle",
      icon: "assets/boosts/sun_rush_4.png",
      fallbackIcon: "☀️",
      description: "Faster sun drops worth +525 sun during battle.",
      level: 4,
      maxLevel: 5,
      nextId: "sun_rush_5",
      effect: {
        sunRush: true,
        sunDropValue: 525,
        dropInterval: 5000,
        dropDuration: 0,
      },
      obtainedFrom: "merge_minigame",
    },
    sun_rush_5: {
      id: "sun_rush_5",
      name: "Sun Rush V",
      type: "battle",
      icon: "assets/boosts/sun_rush_5.png",
      fallbackIcon: "☀️",
      description: "Fastest sun drops worth +600 sun during battle.",
      level: 5,
      maxLevel: 5,
      nextId: null,
      effect: {
        sunRush: true,
        sunDropValue: 600,
        dropInterval: 4000,
        dropDuration: 0,
      },
      obtainedFrom: "merge_minigame",
    },

    // ── PLANT FURY ──────────────────────────────────────────────────────
    plant_fury: {
      id: "plant_fury",
      name: "Plant Fury",
      type: "battle",
      icon: "assets/boosts/plant_fury.png",
      fallbackIcon: "⚔️",
      description: "All plants deal 2× damage for 30 seconds.",
      level: 1,
      maxLevel: 1,
      nextId: null,
      effect: {
        damageMult: 2.0,         // multiplier applied to all plant damage
        duration: 30,            // seconds
      },
      obtainedFrom: "minigame",
    },

    // ── IRON BARK ───────────────────────────────────────────────────────
    iron_bark: {
      id: "iron_bark",
      name: "Iron Bark",
      type: "battle",
      icon: "assets/boosts/iron_bark.png",
      fallbackIcon: "🛡️",
      description: "All plants gain +50% HP for this battle.",
      level: 1,
      maxLevel: 1,
      nextId: null,
      effect: {
        hpMult: 1.5,             // multiplier applied to all plant max HP at battle start
      },
      obtainedFrom: "minigame",
    },

    // ── FREEZE WAVE ─────────────────────────────────────────────────────
    freeze_wave: {
      id: "freeze_wave",
      name: "Freeze Wave",
      type: "battle",
      icon: "assets/boosts/freeze_wave.png",
      fallbackIcon: "❄️",
      description: "All demons move at half speed for 20 seconds.",
      level: 1,
      maxLevel: 1,
      nextId: null,
      effect: {
        demonSpeedMult: 0.5,     // speed multiplier applied to all active + future demons
        duration: 20,            // seconds
      },
      obtainedFrom: "minigame",
    },

    // ── DOUBLE HARVEST ──────────────────────────────────────────────────
    double_harvest: {
      id: "double_harvest",
      name: "Double Harvest",
      type: "battle",
      icon: "assets/boosts/double_harvest.png",
      fallbackIcon: "🪙",
      description: "All coins earned this battle are doubled.",
      level: 1,
      maxLevel: 1,
      nextId: null,
      effect: {
        coinMult: 2.0,           // multiplier applied to all coin rewards
      },
      obtainedFrom: "minigame",
    },

  };

  // ── Sun Rush group helper ────────────────────────────────────────────
  // Returns all sun_rush levels as an array sorted by level
  function getSunRushLevels() {
    return Object.values(BOOSTS)
      .filter(b => b.id.startsWith("sun_rush"))
      .sort((a, b) => a.level - b.level);
  }

  function get(id) {
    return BOOSTS[id] || null;
  }

  function getAll() {
    return Object.values(BOOSTS);
  }

  return { BOOSTS, get, getAll, getSunRushLevels };
})();
