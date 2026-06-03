/* js/shop.js
   Shop system: seed offers, seed packets, inventory.
   Currency: coins (regular) + looms (premium, from minigames/events)
*/

const Shop = (() => {
  // ── Seed Packet Definitions ──────────────────────
  const SEED_PACKETS = {
    packet_small: {
      id: "packet_small",
      name: "Seed Packet",
      description:
        "Contains seeds for 6 different plants (5 seeds each, no repeats).",
      image: "assets/shop/seedpack (1).png",
      loomCost: 10,
      seedCount: 30,
      plantsCount: 6,
      seedsPerPlant: 5,
      allowRepeats: false,
      rarity: "common",
    },
    packet_medium: {
      id: "packet_medium",
      name: "Super Packet",
      description:
        "Contains seeds for 6 different plants (10 seeds each, no repeats).",
      image: "assets/shop/seedpack (2).png",
      loomCost: 18,
      seedCount: 60,
      plantsCount: 6,
      seedsPerPlant: 10,
      allowRepeats: false,
      rarity: "rare",
    },
    packet_large: {
      id: "packet_large",
      name: "Mega Packet",
      description:
        "100 seeds spread across 10 random plants. May contain duplicates.",
      image: "assets/shop/seedpack (2).png",
      loomCost: 30,
      seedCount: 100,
      plantsCount: 10,
      seedsPerPlant: null,
      allowRepeats: true,
      rarity: "epic",
    },
    packet_mega: {
      id: "packet_mega",
      name: "Legendary Packet",
      description:
        "200 seeds across 20 random plants. High chance of rare plants.",
      image: "assets/shop/seedpack (4).png",
      loomCost: 54,
      seedCount: 200,
      plantsCount: 20,
      seedsPerPlant: null,
      allowRepeats: true,
      rarity: "legendary",
    },
  };

  // ── Seed Offer Config ────────────────────────────
  const SEED_OFFER_CONFIG = {
    REFRESH_HOURS: 8,
    // Fixed refresh times (24h): offers refresh at these UTC hours
    REFRESH_TIMES_UTC: [0, 8, 16], // midnight, 8am, 4pm UTC
    SLOTS: [
      { seeds: 15, coinCost: 800 }, // 1 slot — best deal
      { seeds: 10, coinCost: 500 }, // 2 slots
      { seeds: 10, coinCost: 500 },
      { seeds: 5, coinCost: 300 }, // 2 slots
      { seeds: 5, coinCost: 300 },
    ],
  };

  // ── Get next refresh timestamp ───────────────────
  function getNextRefreshTime() {
    const now = new Date();
    const nowUTC = now.getTime();
    const todayUTC = new Date(now);
    todayUTC.setUTCHours(0, 0, 0, 0);

    // Find next refresh time today or tomorrow
    for (const hour of SEED_OFFER_CONFIG.REFRESH_TIMES_UTC) {
      const candidate = new Date(todayUTC);
      candidate.setUTCHours(hour, 0, 0, 0);
      if (candidate.getTime() > nowUTC + 60000) {
        // +1 min buffer
        return candidate.getTime();
      }
    }
    // All today's times passed — next is first slot tomorrow
    const tomorrow = new Date(todayUTC);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(SEED_OFFER_CONFIG.REFRESH_TIMES_UTC[0], 0, 0, 0);
    return tomorrow.getTime();
  }

  // ── Generate seed offers ──────────────────────────
  function generateSeedOffers() {
    const owned = Player.getOwnedPlants();
    if (owned.length < 2) return []; // not enough plants

    // Shuffle owned plants
    const shuffled = [...owned].sort(() => Math.random() - 0.5);

    // Pick 5 unique plants (or as many as available)
    const picks = shuffled.slice(0, Math.min(5, shuffled.length));

    return SEED_OFFER_CONFIG.SLOTS.slice(0, picks.length).map((slot, i) => ({
      plantId: picks[i].id,
      seeds: slot.seeds,
      coinCost: slot.coinCost,
      purchased: false,
    }));
  }

  // ── Load/refresh offers from save ────────────────
  function getSeedOffers() {
    const save = Player.getInventory ? null : null; // just a hook
    const raw = localStorage.getItem("pvz3_seed_offers");
    let stored = null;

    try {
      stored = raw ? JSON.parse(raw) : null;
    } catch (e) {}

    const now = Date.now();

    // Check if we need to refresh (past next refresh time)
    if (stored && stored.nextRefresh && now < stored.nextRefresh) {
      return stored; // still valid
    }

    // Generate fresh offers
    const offers = generateSeedOffers();
    const nextRefresh = getNextRefreshTime();
    const fresh = { offers, nextRefresh, generatedAt: now };
    localStorage.setItem("pvz3_seed_offers", JSON.stringify(fresh));
    return fresh;
  }

  function markOfferPurchased(idx) {
    const raw = localStorage.getItem("pvz3_seed_offers");
    if (!raw) return;
    try {
      const stored = JSON.parse(raw);
      if (stored.offers && stored.offers[idx]) {
        stored.offers[idx].purchased = true;
        localStorage.setItem("pvz3_seed_offers", JSON.stringify(stored));
      }
    } catch (e) {}
  }

  // ── Open a seed packet ────────────────────────────
  function openPacket(packetId) {
    const def = SEED_PACKETS[packetId];
    if (!def) return null;

    // Remove from inventory
    if (!Player.removeInventoryItem(packetId, 1)) return null;

    const allPlants = PlantRegistry.getAll();
    const results = []; // { plantId, plantName, seeds, image }

    if (!def.allowRepeats) {
      // Pick N different plants randomly
      const shuffled = [...allPlants].sort(() => Math.random() - 0.5);
      const picks = shuffled.slice(
        0,
        Math.min(def.plantsCount, shuffled.length),
      );
      picks.forEach((p) => {
        results.push({
          plantId: p.id,
          plantName: p.name,
          seeds: def.seedsPerPlant,
          image: p.image,
        });
      });
    } else {
      // Distribute seeds randomly — plantsCount draws
      const totalSeeds = def.seedCount;
      const draws = def.plantsCount;
      const seedsPerDraw = Math.floor(totalSeeds / draws);
      for (let i = 0; i < draws; i++) {
        const p = allPlants[Math.floor(Math.random() * allPlants.length)];
        results.push({
          plantId: p.id,
          plantName: p.name,
          seeds: seedsPerDraw,
          image: p.image,
        });
      }
    }

    // Apply seeds to player
    results.forEach((r) => {
      Player.addSeeds(r.plantId, r.seeds);
    });

    return results;
  }

  // ── Buy seed packet (spend looms) ─────────────────
  function buyPacket(packetId) {
    const def = SEED_PACKETS[packetId];
    if (!def) return { ok: false, msg: "Unknown packet" };
    if (!Player.spendLooms(def.loomCost)) {
      // show original image of loom as image instead of emoji
      return {
        ok: false,
        msg: `Need ${def.loomCost} <img src="assets/shop/loom.png" class="loom-icon-sm"/> Looms`,
      };
    }
    Player.addInventoryItem(packetId, 1);
    return { ok: true };
  }

  // ── Buy seed offer ────────────────────────────────
  function buySeedOffer(idx) {
    const data = getSeedOffers();
    const offer = data.offers[idx];
    if (!offer || offer.purchased)
      return { ok: false, msg: "Already purchased" };
    if (!Player.spendCoins(offer.coinCost)) {
      return { ok: false, msg: "Not enough coins 🪙" };
    }
    Player.addSeeds(offer.plantId, offer.seeds);
    markOfferPurchased(idx);
    return { ok: true, plantId: offer.plantId, seeds: offer.seeds };
  }

  return {
    SEED_PACKETS,
    SEED_OFFER_CONFIG,
    getSeedOffers,
    buySeedOffer,
    buyPacket,
    openPacket,
    getNextRefreshTime,
  };
})();
