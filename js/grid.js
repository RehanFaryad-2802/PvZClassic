/* js/grid.js
   Manages the 5×9 battle grid.
   Handles cell creation, plant placement,
   plant removal (shovel), and cell state.
*/

const Grid = (() => {
  const ROWS = 5;
  const COLS = 9;

  // grid[row][col] = null | { plantId, element, hpBar, hp, maxHp, level, frozen, shaking, ... }
  let grid = [];
  let gridContainer = null;
  let shovelActive = false;

  // Called once per battle to build the DOM grid
  function init(containerEl) {
    gridContainer = containerEl;
    gridContainer.innerHTML = "";
    grid = [];

    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      const rowEl = document.createElement("div");
      rowEl.className = "grid-row";
      rowEl.dataset.row = r;

      for (let c = 0; c < COLS; c++) {
        grid[r][c] = null;
        const cell = document.createElement("div");
        cell.className = "grid-cell";
        cell.dataset.row = r;
        cell.dataset.col = c;

        cell.addEventListener("click", () => onCellClick(r, c));
        rowEl.appendChild(cell);
      }
      gridContainer.appendChild(rowEl);
    }
  }

  function getCellEl(row, col) {
    return gridContainer.querySelector(
      `.grid-cell[data-row="${row}"][data-col="${col}"]`,
    );
  }

  function onCellClick(row, col) {
    if (shovelActive) {
      removePlant(row, col);
      return;
    }
    // Delegate to Core for plant placement
    if (typeof Core !== "undefined") {
      Core.onCellClick(row, col);
    }
  }

  // Place a plant on the grid
  function placePlant(row, col, plantDef) {
    if (grid[row][col]) return false; // already occupied

    const cell = getCellEl(row, col);
    if (!cell) return false;

    // Use video for animated plants, img for static
    let img;
    if (plantDef.video) {
      img = document.createElement("video");
      img.src = plantDef.video;
      img.autoplay = true;
      img.loop = true;
      img.muted = true;
      img.playsInline = true;
      img.className = "plant-entity plant-video";
      img.style.mixBlendMode = "normal"; // removes black background
    } else {
      img = document.createElement("img");
      img.className = "plant-entity";
      img.src = plantDef.image;
      img.alt = plantDef.name;
      img.draggable = false;
    }

    // HP bar
    const hpBarWrap = document.createElement("div");
    hpBarWrap.className = "plant-hp-bar";
    const hpFill = document.createElement("div");
    hpFill.className = "plant-hp-fill";
    hpFill.style.width = "100%";
    hpBarWrap.appendChild(hpFill);

    cell.classList.add("occupied");
    cell.appendChild(img);
    cell.appendChild(hpBarWrap);

    const plantData = {
      plantId: plantDef.id,
      element: img,
      hpBar: hpFill,
      hp: plantDef.hp,
      maxHp: plantDef.hp,
      level: plantDef.level || 1,
      frozen: false,
      frozenTimer: 0,
      shaking: false,
      row,
      col,
      videoIdle: plantDef.video || null,
      videoAttack: plantDef.videoAttack || null,
      videoDamage: plantDef.videoDamage || null,
    };

    grid[row][col] = plantData;

    // Trigger plant's onPlace callback
    if (typeof PlantRegistry !== "undefined") {
      PlantRegistry.onPlace(plantDef.id, row, col, plantData);
    }

    return true;
  }

  function removePlant(row, col) {
    const p = grid[row][col];
    if (!p) return;

    // Trigger onRemove
    if (typeof PlantRegistry !== "undefined") {
      PlantRegistry.onRemove(p.plantId, row, col);
    }

    const cell = getCellEl(row, col);
    if (cell) {
      // Remove all state classes including selected ring
      cell.classList.remove(
        "occupied",
        "selected",
        "plant-selected",
        "active",
        "highlighted",
      );
      // Remove all child elements (plant image/video + hp bar + any overlays)
      cell.innerHTML = "";
    }

    grid[row][col] = null;

    // Deactivate shovel after use and reset tray selection
    if (shovelActive) {
      setShovel(false);
      if (typeof UI !== "undefined") {
        UI.setShovelActive(false);
        UI.setSelectedTrayCard(null);
      }
    }
  }

  function getPlant(row, col) {
    return row >= 0 && row < ROWS && col >= 0 && col < COLS
      ? grid[row][col]
      : null;
  }

  // Returns first plant in a row (leftmost, for demons to target)
  function getFirstPlantInRow(row, fromCol) {
    if (!grid[row]) return null;
    const safeCol = Math.min(Math.max(0, fromCol), COLS - 1);
    for (let c = safeCol; c >= 0; c--) {
      if (grid[row] && grid[row][c]) return { col: c, plant: grid[row][c] };
    }
    return null;
  }

  // Returns all plants in a row
  function getPlantsInRow(row) {
    const plants = [];
    if (!grid[row]) return plants;
    for (let c = 0; c < COLS; c++) {
      if (grid[row][c]) plants.push({ col: c, plant: grid[row][c] });
    }
    return plants;
  }

  // Damage a plant; returns true if plant died
  function damagePlant(row, col, amount) {
    if (!grid[row]) return false;
    const p = grid[row][col];
    if (!p) return false;

    p.hp = Math.max(0, p.hp - amount);
    const pct = p.hp / p.maxHp;

    // Update HP bar
    if (p.hpBar) {
      p.hpBar.style.width = pct * 100 + "%";
      p.hpBar.className =
        "plant-hp-fill" + (pct <= 0.25 ? " low" : pct <= 0.5 ? " mid" : "");
    }
    // Forward damage to plant def for custom animations
    if (typeof PlantRegistry !== "undefined") {
      PlantRegistry.onDamage(p.plantId, row, col, p);
    }

    // Shake animation while being eaten
    if (!p.shaking && p.element) {
      p.shaking = true;
      p.element.classList.add("shaking");
      // Play damage video if available
      if (p.element.tagName === "VIDEO" && p.videoDamage) {
        p.element.src = p.videoDamage;
        p.element.playbackRate = 1;
        p.element.play();
      }
    }

    if (p.hp <= 0) {
      removePlant(row, col);
      return true; // plant died
    }
    return false;
  }

  function stopShaking(row, col) {
    const p = grid[row][col];
    if (p && p.shaking && p.element) {
      p.shaking = false;
      p.element.classList.remove("shaking");
      // Restore idle video
      if (p.element.tagName === "VIDEO" && p.videoIdle) {
        p.element.src = p.videoIdle;
        p.element.playbackRate = 1;
        p.element.play();
      }
    }
  }

  function freezePlant(row, col, duration) {
    const p = grid[row][col];
    if (!p) return;
    p.frozen = true;
    p.frozenTimer = duration;
  }

  function updateFreezeTimers(dt) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = grid[r][c];
        if (p && p.frozen) {
          p.frozenTimer -= dt;
          if (p.frozenTimer <= 0) {
            p.frozen = false;
            p.frozenTimer = 0;
          }
        }
      }
    }
  }

  function isOccupied(row, col) {
    if (!grid[row]) return false;
    return grid[row][col] !== null;
  }

  function setShovel(active) {
    shovelActive = active;
    if (gridContainer) {
      gridContainer.querySelectorAll(".grid-cell").forEach((cell) => {
        if (active) cell.classList.add("shovel-hover");
        else cell.classList.remove("shovel-hover");
      });
    }
  }

  function isShovelActive() {
    return shovelActive;
  }

  function clear() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r] && grid[r][c]) removePlant(r, c);
      }
    }
    shovelActive = false;
  }

  function getGrid() {
    return grid;
  }
  function getRows() {
    return ROWS;
  }
  function getCols() {
    return COLS;
  }

  return {
    init,
    placePlant,
    removePlant,
    getPlant,
    getFirstPlantInRow,
    getPlantsInRow,
    damagePlant,
    stopShaking,
    freezePlant,
    updateFreezeTimers,
    isOccupied,
    setShovel,
    isShovelActive,
    clear,
    getGrid,
    getRows,
    getCols,
    getCellEl,
  };
})();
