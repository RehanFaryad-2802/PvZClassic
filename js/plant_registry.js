/* js/plant_registry.js
   Central registry. Each plant file calls
   PlantRegistry.register(def) to add itself.
   Core uses this to look up plant stats and callbacks.
   Auto-created before plants are loaded.
*/

const PlantRegistry = (() => {
  const plants = {}; // id -> full definition
  const timers = {}; // id -> per-instance timers { 'row,col': timerData }

  function register(def) {
    plants[def.id] = def;
    timers[def.id] = {};
    // console.log(`[PlantRegistry] Registered: ${def.id}`);
  }

  function get(id) {
    return plants[id] || null;
  }
  function getAll() {
    return Object.values(plants);
  }

  // Called when a plant is placed on the grid
  function onPlace(id, row, col, plantData) {
    const def = plants[id];
    if (def && def.onPlace) def.onPlace(row, col, plantData);
    // Start per-instance timer — use level stats if available
    if (!timers[id]) timers[id] = {};
    const pp = typeof Player !== "undefined" ? Player.getPlant(id) : null;
    const level = pp ? pp.level : 1;
    let fireRate = def ? def.fireRate || 2000 : 2000;
    if (def && def.levelStats && def.levelStats[level]) {
      fireRate = def.levelStats[level].fireRate || fireRate;
    }
    timers[id][`${row},${col}`] = {
      cooldown: fireRate,
      elapsed: 0,
    };
  }

  // Called when a plant is removed
  function onRemove(id, row, col) {
    const def = plants[id];
    if (def && def.onRemove) def.onRemove(row, col);
    if (timers[id]) delete timers[id][`${row},${col}`];
  }

  // Called when a plant takes damage — forwards to plant def
  function onDamage(id, row, col, plantData) {
    const def = plants[id];
    if (def && def.onDamage) def.onDamage(row, col, plantData);
  }

  // Main tick — called every frame for all planted plants
  function tick(dt) {
    const grid = Grid.getGrid();
    const rows = Grid.getRows();
    const cols = Grid.getCols();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (!cell) continue;

        const def = plants[cell.plantId];
        if (!def || !def.onTick) continue;

        if (
          def.hitCount === 0 &&
          def.fireDistance === 0 &&
          def.id !== "sunflower"
        )
          continue;

        // Skip if frozen
        if (cell.frozen) continue;

        const key = `${r},${c}`;
        if (!timers[cell.plantId]) timers[cell.plantId] = {};
        if (!timers[cell.plantId][key]) {
          timers[cell.plantId][key] = {
            elapsed: 0,
            // fireRate:0 means check every frame (use 100ms minimum)
            cooldown: def.fireRate > 0 ? def.fireRate : 100,
          };
        }
        const t = timers[cell.plantId][key];
        t.elapsed += dt * 1000;

        if (t.elapsed >= t.cooldown) {
          t.elapsed = 0;
          def.onTick(r, c, cell);
        }
      }
    }
  }

  function clearTimers() {
    for (const id in timers) timers[id] = {};
  }

  function isDemonInRange(row, col, fireDistance) {
    const active = Demons.getActive();
    const cellEl = Grid.getCellEl(row, col);
    if (!cellEl) return false;

    const cellRect = cellEl.getBoundingClientRect();
    const gridEl = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
    if (!gridRect) return false;

    const cellW = gridRect.width / Grid.getCols();
    const maxDist = fireDistance * cellW;

    return active.some((d) => {
      if (d.dead || d.row !== row) return false;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return false;
      // Demon must have entered the arena (left edge must be within grid bounds)
      if (dRect.left > gridRect.right) return false;
      // Extra: demon center must be inside or touching the grid right edge
      const dCenter = dRect.left + dRect.width / 2;
      if (dCenter > gridRect.right + cellW * 0.5) return false;
      return dRect.left - cellRect.right <= maxDist;
    });
  }

  // Get demons in range sorted by closest first, capped by hitCount
  function getDemonsInRange(row, col, fireDistance, hitCount) {
    const active = Demons.getActive();
    const cellEl = Grid.getCellEl(row, col);
    if (!cellEl) return [];

    const cellRect = cellEl.getBoundingClientRect();
    const gridEl = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
    if (!gridRect) return [];

    const cellW = gridRect.width / Grid.getCols();
    const maxDist = fireDistance * cellW;

    const inRange = active.filter((d) => {
      if (d.dead || d.row !== row) return false;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return false;
      if (dRect.left > gridRect.right) return false;
      // Demon must be meaningfully inside the arena, not just barely crossing the edge
      const dCenter = dRect.left + dRect.width / 2;
      if (dCenter > gridRect.right + cellW * 0.5) return false;
      return dRect.left - cellRect.right <= maxDist;
    });

    // Sort by closest first
    inRange.sort((a, b) => {
      const aRect = a.el.getBoundingClientRect();
      const bRect = b.el.getBoundingClientRect();
      return aRect.left - bRect.left;
    });

    // Cap by hitCount (99 = unlimited)
    return hitCount >= 99 ? inRange : inRange.slice(0, hitCount);
  }

  return {
    register,
    get,
    getAll,
    onPlace,
    onRemove,
    onDamage,
    tick,
    clearTimers,
    isDemonInRange,
    getDemonsInRange,
  };
})();
