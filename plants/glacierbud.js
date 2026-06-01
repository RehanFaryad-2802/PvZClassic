/* plants/glacierbud.js
   Glacier Bud: one-use freeze trap.
   Freezes the first demon that enters its cell,
   then destroys itself.
   Category: trap, one-use, ice
*/

PlantRegistry.register({
  id: "glacierbud",
  name: "Glacier Bud",
  image: "assets/plants/glacierbud.png",
  cost: 75,
  cooldown: 5000,
  fireDistance: 0.1, // trigger range in cells
  hitCount: 1,
  hp: 50,
  fireRate: 100, // check frequently — it's a trap
  description: "Freezes the first demon that gets close, then vanishes.",
  category: ["trap", "one-use", "ice"],

  // ── Tunable values ──────────────────────────────
  CONFIG: {
    FREEZE_DURATION: 6000, // ms demon stays frozen
    TRIGGER_DISTANCE: 3, // cell range to trigger (adjacent)
    SELF_DESTRUCT_DELAY: 400, // ms after freeze before plant disappears
  },

  levelStats: {
    1: { hp: 5, freezeDuration: 6000, cost: 75 },
    2: { hp: 5, freezeDuration: 6500, cost: 75 },
    3: { hp: 5, freezeDuration: 7000, cost: 70 },
    4: { hp: 5, freezeDuration: 7500, cost: 70 },
    5: { hp: 5, freezeDuration: 8000, cost: 65 },
    6: { hp: 5, freezeDuration: 8500, cost: 65 },
    7: { hp: 5, freezeDuration: 9000, cost: 60 },
    8: { hp: 5, freezeDuration: 9500, cost: 60 },
    9: { hp: 5, freezeDuration: 10000, cost: 55 },
    10: { hp: 5, freezeDuration: 10400, cost: 55 },
    11: { hp: 5, freezeDuration: 11400, cost: 50 },
    12: { hp: 5, freezeDuration: 12500, cost: 50 },
    13: { hp: 5, freezeDuration: 13700, cost: 45 },
    14: { hp: 5, freezeDuration: 15000, cost: 40 },
    15: { hp: 5, freezeDuration: 16500, cost: 35 },
  },

  getStats(level) {
    const capped = Math.min(Math.max(1, level), 15);
    return this.levelStats[capped] || this.levelStats[1];
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp = stats.hp;
    plantData.hp = stats.hp;
    plantData.triggered = false; // only fires once

    // Ice crystal ambient glow ring
    const cell = Grid.getCellEl(row, col);
    if (cell) {
      const aura = document.createElement("div");
      aura.className = "gb-aura";
      cell.appendChild(aura);
    }

    requestAnimationFrame(() => {
      const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
      if (img) img.classList.add("gb-idle");
    });
  },

  onTick(row, col, plantData) {
    // Hard guard — once triggered never fire again
    if (plantData.triggered) return;

    // Also check grid cell still exists
    const currentCell = Grid.getPlant(row, col);
    if (!currentCell) return;

    // Use registry range check — same as all other plants
    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;

    const stats = this.getStats(plantData.level);

    // Get closest demon in range
    const targets = PlantRegistry.getDemonsInRange(
      row,
      col,
      this.fireDistance,
      1,
    );
    if (targets.length === 0) return;

    const target = targets[0];

    // TRIGGERED — freeze demon and self-destruct
    plantData.triggered = true;

    // Freeze the demon
    Demons.freeze(target, stats.freezeDuration);
    Demons.damage(target, 1, "ice");

    // Trigger animation
    const cellEl2 = Grid.getCellEl(row, col);
    const img = cellEl2?.querySelector(".plant-entity");
    if (img) {
      img.classList.remove("gb-idle");
      img.classList.add("gb-burst");
    }

    // Visual burst effect
    showGlacierBurst(row, col, target);

    // Self-destruct — use Core's safe removal if available
    const destroyDelay = this.CONFIG.SELF_DESTRUCT_DELAY;
    setTimeout(() => {
      // Double check cell still has this plant before removing
      const stillThere = Grid.getPlant(row, col);
      if (stillThere && stillThere.plantId === "glacierbud") {
        Grid.removePlant(row, col);
      }
    }, destroyDelay);
  },

  onRemove(row, col) {
    const cell = Grid.getCellEl(row, col);
    if (cell) {
      cell.querySelector(".gb-aura")?.remove();
    }
  },

  onDamage(row, col, plantData) {
    if (plantData.triggered) return;
    const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
    if (!img) return;
    img.classList.remove("gb-idle");
    img.classList.add("gb-damaged");
    setTimeout(() => {
      if (img.isConnected && !plantData.triggered) {
        img.classList.remove("gb-damaged");
        img.classList.add("gb-idle");
      }
    }, 400);
  },
});

function showGlacierBurst(row, col, target) {
  const layer = document.getElementById("effects-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const eRect = layer.getBoundingClientRect();
  const cRect = cellEl.getBoundingClientRect();
  const cx = cRect.left - eRect.left + cRect.width / 2;
  const cy = cRect.top - eRect.top + cRect.height / 2;

  // Expanding ice ring
  const ring = document.createElement("div");
  ring.style.cssText = `
    position:absolute;
    left:${cx - 30}px; top:${cy - 30}px;
    width:60px; height:60px;
    border-radius:50%;
    border:3px solid rgba(103,232,249,0.95);
    box-shadow:0 0 20px rgba(103,232,249,0.7), 0 0 40px rgba(103,232,249,0.3);
    pointer-events:none; z-index:40;
    animation:gbRing 0.5s ease-out forwards;
  `;
  layer.appendChild(ring);

  // 6 crystal shards bursting outward
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const shard = document.createElement("div");
    shard.style.cssText = `
      position:absolute;
      left:${cx - 4}px; top:${cy - 12}px;
      width:8px; height:24px;
      background:linear-gradient(to top, #0ea5e9, #e0f2fe);
      border-radius:4px 4px 0 0;
      box-shadow:0 0 8px rgba(103,232,249,0.9);
      pointer-events:none; z-index:41;
      transform-origin:bottom center;
      --tx:${Math.cos(angle) * 50}px;
      --ty:${Math.sin(angle) * 50}px;
      --r:${(angle * 180) / Math.PI}deg;
      animation:gbShard 0.45s ease-out ${i * 0.04}s forwards;
    `;
    layer.appendChild(shard);
    setTimeout(() => shard.remove(), 500);
  }

  // Freeze pulse on the frozen demon
  if (target && target.el) {
    const dRect = target.el.getBoundingClientRect();
    const dcx = dRect.left - eRect.left + dRect.width / 2;
    const dcy = dRect.top - eRect.top + dRect.height / 2;

    const freeze = document.createElement("div");
    freeze.style.cssText = `
      position:absolute;
      left:${dcx - 28}px; top:${dcy - 28}px;
      width:56px; height:56px;
      border-radius:50%;
      background:radial-gradient(circle, rgba(186,230,253,0.7) 0%, rgba(103,232,249,0.3) 50%, transparent 70%);
      box-shadow:0 0 18px rgba(103,232,249,0.8);
      pointer-events:none; z-index:40;
      animation:gbFreezePulse 0.6s ease-out forwards;
    `;
    layer.appendChild(freeze);
    setTimeout(() => freeze.remove(), 600);
  }

  // FROZEN! text
  if (target) {
    const dRect = target.el.getBoundingClientRect();
    const txt = document.createElement("div");
    txt.textContent = "FROZEN!";
    txt.style.cssText = `
      position:absolute;
      left:${dRect.left - eRect.left}px;
      top:${dRect.top - eRect.top - 24}px;
      font-family:var(--font-display);
      font-size:13px; font-weight:900;
      color:#e0f2fe;
      text-shadow:0 0 8px rgba(103,232,249,0.9);
      pointer-events:none; z-index:42;
      animation:floatUp 0.9s ease-out forwards;
    `;
    layer.appendChild(txt);
    setTimeout(() => txt.remove(), 900);
  }

  setTimeout(() => ring.remove(), 500);
}
