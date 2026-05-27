/* plants/sunflower.js
   Sunflower: generates sun tokens every few seconds.
   Level scaling: higher level = faster sun production.
*/

PlantRegistry.register({
  id: "sunflower",
  name: "Sunflower",
  image: "assets/plants/sunflower/sunflower.png",
  video: "assets/plants/sunflower/sunflower.webm",
  videoAttack: "assets/plants/sunflower/produceSunflower.webm",
  videoDamage: "assets/plants/sunflower/damageSunflower.webm",
  cost: 50,
  cooldown: 7000,
  hp: 300,
  fireRate: 13000,
  description: "Produces sun to fund your garden.",
  // Per-level stats
  levelStats: {
    1: { hp: 300, fireRate: 13000, cooldown: 7000, sunValue: 25, cost: 50 },
    2: { hp: 300, fireRate: 12000, cooldown: 6800, sunValue: 25, cost: 50 },
    3: { hp: 300, fireRate: 11000, cooldown: 6500, sunValue: 25, cost: 40 },
    4: { hp: 300, fireRate: 10000, cooldown: 6000, sunValue: 30, cost: 30 },
    5: { hp: 300, fireRate: 9500, cooldown: 5500, sunValue: 35, cost: 30 },
    6: { hp: 300, fireRate: 9000, cooldown: 5000, sunValue: 40, cost: 30 },
    7: { hp: 300, fireRate: 8500, cooldown: 4800, sunValue: 45, cost: 30 },
    8: { hp: 300, fireRate: 8000, cooldown: 4500, sunValue: 50, cost: 30 },
    9: { hp: 300, fireRate: 7500, cooldown: 4200, sunValue: 60, cost: 30 },
    10: { hp: 300, fireRate: 7000, cooldown: 4000, sunValue: 75, cost: 30 },
    11: { hp: 400, fireRate: 6500, cooldown: 3700, sunValue: 75, cost: 30 },
    12: { hp: 500, fireRate: 6000, cooldown: 3400, sunValue: 80, cost: 28 },
    13: { hp: 620, fireRate: 5500, cooldown: 3100, sunValue: 85, cost: 27 },
    14: { hp: 760, fireRate: 5000, cooldown: 2800, sunValue: 90, cost: 26 },
    15: { hp: 920, fireRate: 4500, cooldown: 2500, sunValue: 100, cost: 25 },
  },

  getStats(level) {
    const capped = Math.min(Math.max(1, level), 15);
    return this.levelStats[capped] || this.levelStats[1];
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp = stats.hp;
    plantData.hp = stats.hp;
    plantData.cooldown = stats.cooldown;
    plantData.videoIdle = this.video;
    plantData.videoAttack = this.videoAttack;
    plantData.videoDamage = this.videoDamage;
  },

  onTick(row, col, plantData) {
    const arena = document.getElementById("grid-container");
    if (!arena) return;
    const cell = Grid.getCellEl(row, col);
    if (!cell) return;

    const level = plantData && plantData.level ? plantData.level : 1;
    const stats = this.getStats(level);

    const videoEl = cell.querySelector("video.plant-entity");
    if (videoEl && plantData.videoAttack && !plantData.producing) {
      plantData.producing = true; // lock so it doesn't fire twice

      videoEl.src = plantData.videoAttack;
      videoEl.currentTime = 0;
      videoEl.play().catch(() => {});

      // Switch back to idle after produce animation (~3.5s)
      setTimeout(() => {
        if (videoEl) {
          videoEl.src = plantData.videoIdle;
          videoEl.currentTime = 0;
          videoEl.play().catch(() => {});
          plantData.producing = false; // unlock
        }
      }, 2800);
    }

    setTimeout(() => {
      // Use effects-layer as reference since sun tokens go there
      const effectsEl = document.getElementById("effects-layer");
      if (!effectsEl) return;
      const rect = cell.getBoundingClientRect();
      const eRect = effectsEl.getBoundingClientRect();
      // Exact center of cell relative to effects layer
      const x = rect.left - eRect.left + rect.width * 0.5 - 28;
      const y = rect.top - eRect.top + rect.height * 0.5 - 28;
      spawnSunToken(x, y, stats.sunValue);

      // Pulse ring
      const pulse = document.createElement("div");
      pulse.className = "sun-pulse";
      cell.appendChild(pulse);
      setTimeout(() => pulse.remove(), 1000);
    }, 1700); // 1.7s = when animation shows sun being released
  },

  onRemove(row, col) {},
});

// ── Sun token spawner ─────────────────────────────
function spawnSunToken(x, y, amount = 25) {
  const effectsLayer = document.getElementById("effects-layer");
  if (!effectsLayer) return;

  const token = document.createElement("div");
  token.className = "sun-token";
  token.textContent = "☀️";
  token.title = `+${amount} sun`;
  token.style.left = x + "px";
  token.style.top = y + "px";
  token.style.transition = "none";

  // After pop animation completes, bounce down to bottom of cell
  const bounceTimer1 = setTimeout(() => {
    if (!token.parentNode || collected) return;

    const cellBottom = y + 60;
    token.style.transition = "top 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    token.style.top = cellBottom + "px";

    // Small bounce at landing
    const bounceTimer2 = setTimeout(() => {
      if (!token.parentNode || collected) return;
      token.style.transition = "top 0.15s ease-out";
      token.style.top = cellBottom - 12 + "px";

      const bounceTimer3 = setTimeout(() => {
        if (!token.parentNode || collected) return;
        token.style.transition = "top 0.1s ease-in";
        token.style.top = cellBottom + "px";
      }, 150);
    }, 500);
  }, 600);

  let collected = false;

  function collectSun() {
    if (collected) return;
    collected = true;

    // Find sun display position (top left HUD)
    const sunEl = document.getElementById("hud-sun");
    const effectsRect = effectsLayer.getBoundingClientRect();
    const sunRect = sunEl ? sunEl.getBoundingClientRect() : null;

    const targetX = sunRect
      ? sunRect.left - effectsRect.left + sunRect.width / 2 - 28
      : 0;
    const targetY = sunRect
      ? sunRect.top - effectsRect.top + sunRect.height / 2 - 28
      : 0;

    // Animate token flying to sun display
    token.style.transition =
      "left 0.5s cubic-bezier(0.4, 0, 0.2, 1), top 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s, opacity 0.5s";
    token.style.left = targetX + "px";
    token.style.top = targetY + "px";
    token.style.transform = "scale(0.3)";
    token.style.opacity = "0.6";

    setTimeout(() => {
      Core.addSun(amount);
      UI.updateSunDisplay();
      // Flash the sun display
      if (sunEl) {
        sunEl.style.transition = "transform 0.15s";
        sunEl.style.transform = "scale(1.4)";
        setTimeout(() => {
          sunEl.style.transform = "scale(1)";
        }, 150);
      }
      if (token.parentNode) token.remove();
    }, 500);
  }

  token.addEventListener("pointerdown", collectSun, { once: true });
  token.addEventListener("pointerenter", collectSun, { once: true });
  token.addEventListener("mouseover", collectSun, { once: true });
  effectsLayer.appendChild(token);

  // Auto-collect after 9 seconds
  setTimeout(() => {
    if (!collected) collectSun();
  }, 9000);
}
