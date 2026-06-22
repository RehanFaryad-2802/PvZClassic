/* js/coins.js
   Coin drop logic, level reward calculation,
   in-battle coin token spawning.
*/

const Coins = (() => {
  // Coin reward ranges per world
  const WORLD_COIN_RANGE = {
    1: { min: 15, max: 35 },
    2: { min: 25, max: 55 },
    3: { min: 40, max: 80 },
    4: { min: 60, max: 120 },
  };

  // Coins dropped by demon on death (in battle)
  const DEMON_COIN_DROP = {
    imp: { min: 1, max: 3, chance: 0.4 },
    bat: { min: 1, max: 2, chance: 0.3 },
    armored: { min: 3, max: 6, chance: 0.5 },
    ice: { min: 2, max: 4, chance: 0.4 },
    brute: { min: 4, max: 8, chance: 0.6 },
  };

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getLevelReward(worldId) {
    const range = WORLD_COIN_RANGE[worldId] || WORLD_COIN_RANGE[1];
    return randInt(range.min, range.max);
  }

  function getDemonCoinDrop(demonType) {
    const cfg = DEMON_COIN_DROP[demonType];
    if (!cfg) return 0;
    if (Math.random() > cfg.chance) return 0;
    return randInt(cfg.min, cfg.max);
  }

  // Spawn a coin token element at a position in the arena
  function spawnCoinToken(parentEl, x, y, amount) {
    const el = document.createElement("div");
    el.className = "coin-token";
    el.innerHTML = '<img src="assets/icons/gold.png" alt="gold" class="icon-gold-inline">';
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.title = `+${amount}`;
    el.dataset.amount = amount;
    function collectCoin() {
      Player.addCoins(amount);
      UI.updateCoinDisplays();
      el.remove();
      UI.showFloatingText(`+${amount}<img src="assets/icons/gold.png" alt="gold" class="icon-gold-inline">`, x, y, "coin");
    }
    el.addEventListener("click", collectCoin, { once: true });
    el.addEventListener("pointerenter", collectCoin, { once: true });
    el.addEventListener("mouseover", collectCoin, { once: true });

    parentEl.appendChild(el);

    // Auto-collect after 8 seconds
    setTimeout(() => {
      if (el.parentNode) {
        Player.addCoins(amount);
        UI.updateCoinDisplays();
        el.remove();
      }
    }, 1000);

    return el;
  }

  return {
    getLevelReward,
    getDemonCoinDrop,
    spawnCoinToken,
  };
})();
