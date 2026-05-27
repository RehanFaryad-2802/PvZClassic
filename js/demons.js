/* js/demons.js
   Manages all active demons in the battle arena.
   Handles spawning, movement, attacking plants,
   death, and special abilities.
*/

const Demons = (() => {
  let demons = [];
  let layer = null;
  let effectsLayer = null;
  let arenaRect = null;
  let onDemonReachedEnd = null; // callback
  let onAllDefeated = null;

  const DEMON_WIDTH = 120;
  const DEMON_HEIGHT = 120;

  function init(layerEl, effectsEl, rect, callbacks = {}) {
    layer = layerEl;
    effectsLayer = effectsEl;
    arenaRect = rect;
    demons = [];
    onDemonReachedEnd = callbacks.onReachedEnd || null;
    onAllDefeated = callbacks.onAllDefeated || null;
  }

  function setArenaRect(rect) {
    arenaRect = rect;
  }

  // Spawn a demon from level wave config
  function spawn(cfg) {
    if (!layer || !arenaRect) return;

    const gridEl = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
    const layerEl = document.getElementById("demons-layer");
    const layerRect = layerEl ? layerEl.getBoundingClientRect() : null;

    const cellH = gridRect
      ? gridRect.height / Grid.getRows()
      : arenaRect.height / Grid.getRows();
    const cellW = gridRect
      ? gridRect.width / Grid.getCols()
      : (arenaRect.width - 72) / Grid.getCols();
    const demonSize = Math.min(cellH * 0.9, cellW * 0.9);

    const gridOffsetX =
      gridRect && layerRect ? gridRect.left - layerRect.left : 72;

    const stats = Levels.getDemonStats(cfg.type);
    if (!stats) return;

    const y =
      gridRect && layerRect
        ? gridRect.top -
          layerRect.top +
          cfg.row * cellH +
          (cellH - demonSize) / 2
        : cfg.row * cellH + (cellH - DEMON_HEIGHT) / 2;
    const x = arenaRect.width + demonSize;

    // DOM
    const wrap = document.createElement("div");
    wrap.className = "demon-entity";
    wrap.style.left = x + "px";
    wrap.style.top = y + "px";
    wrap.style.width = DEMON_WIDTH + "px";
    wrap.style.height = DEMON_HEIGHT + "px";

    const img = document.createElement("img");
    img.src = stats.image;
    img.alt = stats.name;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.draggable = false;

    const hpWrap = document.createElement("div");
    hpWrap.className = "demon-hp-bar";
    const hpFill = document.createElement("div");
    hpFill.className = "demon-hp-fill";
    hpFill.style.width = "100%";
    hpWrap.appendChild(hpFill);

    wrap.appendChild(img);
    wrap.appendChild(hpWrap);
    layer.appendChild(wrap);

    const demon = {
      id: Date.now() + Math.random(),
      type: cfg.type,
      name: stats.name,
      el: wrap,
      imgEl: img,
      hpFill,
      hp: cfg.hp,
      maxHp: cfg.hp,
      speed: cfg.speed, // px/sec base
      currentSpeed: cfg.speed,
      damage: cfg.damage,
      biteRate: cfg.biteRate,
      special: cfg.special,
      row: cfg.row,
      x,
      y,
      width: demonSize,
      height: demonSize,
      gridOffsetX,
      dead: false,
      frozen: false,
      frozenTimer: 0,
      biteTimer: 0,
      targeting: null, // { row, col } of plant being attacked
      charging: false,
      hitFlashTimer: 0,
    };

    demons.push(demon);
    return demon;
  }

  function update(dt) {
    if (!arenaRect) return;

    // Recalculate live from DOM every frame so resize works
    const gridEl = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
    const arenaEl = document.getElementById("demons-layer");
    const arenaLayerRect = arenaEl ? arenaEl.getBoundingClientRect() : null;

    const GRID_OFFSET =
      gridRect && arenaLayerRect ? gridRect.left - arenaLayerRect.left : 72;
    const gridWidth = gridRect ? gridRect.width : arenaRect.width - 72;
    const cellW = gridWidth / Grid.getCols();
    const cellH = gridRect
      ? gridRect.height / Grid.getRows()
      : arenaRect.height / Grid.getRows();
    const lawnmowerX = GRID_OFFSET - 28;

    for (let i = demons.length - 1; i >= 0; i--) {
      const d = demons[i];
      if (d.dead) {
        d.el.remove();
        demons.splice(i, 1);
        continue;
      }

      // Hit flash
      if (d.hitFlashTimer > 0) {
        d.hitFlashTimer -= dt * 1000;
        if (d.hitFlashTimer <= 0) d.el.classList.remove("hit");
      }

      // Freeze timer
      if (d.frozen) {
        d.frozenTimer -= dt * 1000;
        if (d.frozenTimer <= 0) {
          d.frozen = false;
          d.frozenTimer = 0;
          d.currentSpeed = d.speed;
          d.el.classList.remove("frozen");
        }
      }

      // Brute charge
      if (d.special === "charge" && !d.charging && d.hp / d.maxHp < 0.3) {
        d.charging = true;
        d.currentSpeed = d.speed * 2;
      }

      // Resize demon relative to current cell size every frame
      const demonSize = Math.min(cellH * 0.9, cellW * 0.9);
      d.el.style.width  = demonSize + 'px';
      d.el.style.height = demonSize + 'px';
      d.width  = demonSize;
      d.height = demonSize;

      // Update Y every frame relative to live grid row position
      const rowEl = document.querySelector(`.grid-row[data-row="${d.row}"]`);
      if (rowEl && arenaLayerRect) {
        const rowRect = rowEl.getBoundingClientRect();
        const liveY = rowRect.top - arenaLayerRect.top + (rowRect.height - demonSize) / 2;
        d.y = liveY;
        d.el.style.top = liveY + 'px';
      }

      // ── Find plant using DOM positions directly ──
      let eating = false;
      const allRows = Grid.getRows();
      const plantsInRow = Grid.getPlantsInRow(d.row);

      for (const { col, plant } of plantsInRow) {
        const cellEl = Grid.getCellEl(d.row, col);
        if (!cellEl) continue;

        const cellRect = cellEl.getBoundingClientRect();
        const demonRect = d.el.getBoundingClientRect();

        // Check Y overlap — demon must be in same row vertically
        const demonCenterY = demonRect.top + demonRect.height / 2;
        const cellCenterY = cellRect.top + cellRect.height / 2;
        const rowHeight = cellRect.height;
        if (Math.abs(demonCenterY - cellCenterY) > rowHeight * 0.6) continue;

        // Plant is to the RIGHT of demon = demon already passed it = skip
        if (cellRect.left > demonRect.right) continue;

        // Plant is to the LEFT of demon = demon has reached or passed into it
        // Only eat if demon's LEFT edge hasn't gone past plant's LEFT edge by too much
        if (
          demonRect.right >= cellRect.left &&
          demonRect.left <= cellRect.right + 10
        ) {
          // Bite the plant
          d.targeting = { row: d.row, col };
          d.biteTimer += dt * 1000;
          if (d.biteTimer >= d.biteRate) {
            d.biteTimer = 0;
            const died = Grid.damagePlant(d.row, col, d.damage);
            if (died) {
              d.targeting = null;
              d.biteTimer = 0;
            }
          }
          eating = true;
          break;
        }
      }

      if (eating) continue;

      // No plant — clear targeting and keep moving
      if (d.targeting) {
        Grid.stopShaking(d.targeting.row, d.targeting.col);
        d.targeting = null;
        d.biteTimer = 0;
      }

      d.x -= d.currentSpeed * dt;
      d.el.style.left = d.x + "px";

      if (d.x + d.width <= lawnmowerX) {
        triggerLawnmower(d);
        continue;
      }

      if (d.x <= 0) {
        d.dead = true;
        if (onDemonReachedEnd) onDemonReachedEnd(d);
      }
    }

    if (demons.length === 0 && onAllDefeated) {
      onAllDefeated();
    }
  }
  function triggerLawnmower(demon) {
    if (typeof Core !== "undefined") {
      Core.triggerLawnmower(demon.row, demon);
    }
  }

  function damage(demon, amount) {
    if (demon.dead) return;
    demon.hp = Math.max(0, demon.hp - amount);
    const pct = demon.hp / demon.maxHp;
    if (demon.hpFill) demon.hpFill.style.width = pct * 100 + "%";

    // Hit flash
    demon.el.classList.remove("hit");
    void demon.el.offsetWidth; // reflow
    demon.el.classList.add("hit");
    demon.hitFlashTimer = 120;

    if (demon.hp <= 0) kill(demon);
  }

  function kill(demon) {
    if (demon.dead) return;
    demon.dead = true;

    // Stop shaking any plant it was eating
    if (demon.targeting) {
      Grid.stopShaking(demon.targeting.row, demon.targeting.col);
      demon.targeting = null;
    }

    // Coin drop
    const coinAmt = Coins.getDemonCoinDrop(demon.type);
    if (coinAmt > 0) {
      const effectsEl = document.getElementById("effects-layer");
      if (effectsEl) {
        Coins.spawnCoinToken(effectsEl, demon.x, demon.y, coinAmt);
      }
    }

    // Death animation
    if (demon.imgEl) {
      demon.imgEl.style.transition = "opacity 0.3s, transform 0.3s";
      demon.imgEl.style.opacity = "0";
      demon.imgEl.style.transform = "scale(0.5) rotate(20deg)";
    }
    setTimeout(() => {
      if (demon.el.parentNode) demon.el.remove();
    }, 350);
  }

  function freeze(demon, duration) {
    if (demon.dead) return;
    demon.frozen = true;
    demon.frozenTimer = duration;
    demon.currentSpeed = demon.speed * 0.3; // 30% speed = slowed not stopped
    demon.el.classList.add("frozen");
  }

  function getActive() {
    return demons.filter((d) => !d.dead);
  }
  function getAll() {
    return demons;
  }
  function getCount() {
    return demons.filter((d) => !d.dead).length;
  }

  function clear() {
    demons.forEach((d) => d.el && d.el.remove());
    demons = [];
  }

  // Returns true if any demon in a row is at/past a column (for plant targeting)
  function isDemonInRow(row) {
    return demons.some((d) => !d.dead && d.row === row);
  }

  return {
    init,
    spawn,
    update,
    damage,
    kill,
    freeze,
    getActive,
    getAll,
    getCount,
    isDemonInRow,
    clear,
    setArenaRect,
  };
})();
