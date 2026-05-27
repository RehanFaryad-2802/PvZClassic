/* js/plant_registry.js
   Central registry. Each plant file calls
   PlantRegistry.register(def) to add itself.
   Core uses this to look up plant stats and callbacks.
   Auto-created before plants are loaded.
*/

const PlantRegistry = (() => {

  const plants = {};       // id -> full definition
  const timers  = {};      // id -> per-instance timers { 'row,col': timerData }

  function register(def) {
    plants[def.id] = def;
    timers[def.id] = {};
    // console.log(`[PlantRegistry] Registered: ${def.id}`);
  }

  function get(id) { return plants[id] || null; }
  function getAll() { return Object.values(plants); }

  // Called when a plant is placed on the grid
  function onPlace(id, row, col, plantData) {
    const def = plants[id];
    if (def && def.onPlace) def.onPlace(row, col, plantData);
    // Start per-instance timer — use level stats if available
    if (!timers[id]) timers[id] = {};
    const pp = typeof Player !== 'undefined' ? Player.getPlant(id) : null;
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

        // Skip if frozen
        if (cell.frozen) continue;

        const key = `${r},${c}`;
        if (!timers[cell.plantId]) timers[cell.plantId] = {};
        if (!timers[cell.plantId][key]) {
          timers[cell.plantId][key] = { elapsed: 0, cooldown: def.fireRate || 2000 };
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

  return { register, get, getAll, onPlace, onRemove, tick, clearTimers };
})();
