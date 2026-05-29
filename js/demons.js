/* js/demons.js
   Manages all active demons in the battle arena.
   Handles spawning, movement, attacking plants,
   death, and special abilities.

   ── Special abilities (set in levels.js DEMON_STATS) ──────────────────────
   Can be a single string OR an array of strings:
     special: "charge"
     special: ["armor", "regen"]

   Available specials:
     dodge     — 15% chance to ignore a projectile hit
     armor     — 40% damage reduction from all hits
     charge    — doubles speed when HP < 30%
     flying    — skips the first plant in its row, targets the second
     freeze    — slows plant fire rate while biting it
     regen     — regenerates 3% maxHp every 2 seconds
     shield    — one-time absorb of any single hit, then shield breaks
     explode   — on death, damages all plants in row within 2 cells
     split     — on death, spawns 2 small imps in same row
     lifesteal — heals 30% of damage dealt to plants
     berserk   — speed AND biteRate scale up as HP drops
     ghost     — randomly turns invisible 2s; projectiles pass through
     tank      — near-stops below 20% HP then suddenly full-speed charges
*/

const Demons = (() => {
  // ── Config — all tunable values in one place ──────────────────────────────
  const CFG = {
    DEMON_WIDTH: 120,
    DEMON_HEIGHT: 120,
    DODGE_CHANCE: 0.15, // 15%
    ARMOR_REDUCTION: 0.4, // 40% dmg reduction
    REGEN_INTERVAL: 2000, // ms between regen ticks
    REGEN_PERCENT: 0.03, // 3% maxHp per tick
    EXPLODE_RANGE: 2, // cells either side
    EXPLODE_DAMAGE: 60,
    SPLIT_COUNT: 2, // imps spawned on split-death
    SPLIT_HP_MULT: 0.3, // split imps have 30% of parent hp
    LIFESTEAL_PCT: 0.3, // heal 30% of damage dealt
    BERSERK_MAX_MULT: 2.5, // max speed/biteRate multiplier at 1hp
    GHOST_ON_TIME: 2000, // ms invisible
    GHOST_OFF_TIME: 3500, // ms visible
    TANK_SLOW_THRESH: 0.2, // HP% threshold to slow
    TANK_SLOW_SPEED: 4, // px/s when tanking
    TANK_CHARGE_MULT: 3.5, // speed burst after tank
    FREEZE_PLANT_DUR: 3000, // ms plant fire-rate is halved
    CHARGE_THRESH: 0.3,
    CHARGE_MULT: 2.0,
  };

  let demons = [];
  let layer = null;
  let effectsLayer = null;
  let arenaRect = null;
  let onDemonReachedEnd = null;
  let onAllDefeated = null;

  // ── Helper: normalise special to array ────────────────────────────────────
  function specials(demon) {
    if (!demon.special) return [];
    return Array.isArray(demon.special) ? demon.special : [demon.special];
  }
  function hasSpecial(demon, key) {
    return specials(demon).includes(key);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
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

  // ── Spawn ─────────────────────────────────────────────────────────────────
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
    const gridOffX =
      gridRect && layerRect ? gridRect.left - layerRect.left : 72;

    const stats = Levels.getDemonStats(cfg.type);
    if (!stats) return;

    const y =
      gridRect && layerRect
        ? gridRect.top -
          layerRect.top +
          cfg.row * cellH +
          (cellH - demonSize) / 2
        : cfg.row * cellH + (CFG.DEMON_HEIGHT - demonSize) / 2;
    const x = arenaRect.width + demonSize;

    // ── DOM ──
    const wrap = document.createElement("div");
    wrap.className = "demon-entity";
    wrap.style.left = x + "px";
    wrap.style.top = y + "px";
    wrap.style.width = CFG.DEMON_WIDTH + "px";
    wrap.style.height = CFG.DEMON_HEIGHT + "px";

    // Sprite: video if animation exists, else img
    let sprite;
    if (stats.animation) {
      sprite = document.createElement("video");
      sprite.src = stats.animation;
      sprite.autoplay = true;
      sprite.loop = true;
      sprite.muted = true;
      sprite.playsInline = true;
      sprite.setAttribute("playsinline", "");
      sprite.poster = stats.image;
    } else {
      sprite = document.createElement("img");
      sprite.src = stats.image;
      sprite.alt = stats.name;
      sprite.draggable = false;
    }
    sprite.style.cssText = "width:100%;height:100%;object-fit:contain;";

    // HP bar
    const hpWrap = document.createElement("div");
    hpWrap.className = "demon-hp-bar";
    const hpFill = document.createElement("div");
    hpFill.className = "demon-hp-fill";
    hpFill.style.width = "100%";
    hpWrap.appendChild(hpFill);

    // Shield indicator (only if shield special)
    let shieldEl = null;
    const sp = Array.isArray(cfg.special)
      ? cfg.special
      : cfg.special
        ? [cfg.special]
        : [];
    if (sp.includes("shield")) {
      shieldEl = document.createElement("div");
      shieldEl.className = "demon-shield";
      shieldEl.textContent = "🛡️";
      wrap.appendChild(shieldEl);
    }

    wrap.appendChild(sprite);
    wrap.appendChild(hpWrap);
    layer.appendChild(wrap);

    const demon = {
      id: Date.now() + Math.random(),
      type: cfg.type,
      name: stats.name,
      el: wrap,
      imgEl: sprite,
      video: sprite, // reference for switching animation
      hpFill,
      shieldEl,
      hp: cfg.hp,
      maxHp: cfg.hp,
      speed: cfg.speed,
      currentSpeed: cfg.speed,
      damage: cfg.damage,
      biteRate: cfg.biteRate,
      currentBiteRate: cfg.biteRate,
      special: cfg.special,
      row: cfg.row,
      x,
      y,
      width: demonSize,
      height: demonSize,
      gridOffsetX: gridOffX,
      dead: false,
      // state flags
      frozen: false,
      frozenTimer: 0,
      biteTimer: 0,
      targeting: null,
      hitFlashTimer: 0,
      eating: false, // ← NEW
      // shield
      shieldActive: sp.includes("shield"),
      // regen
      regenTimer: 0,
      // ghost
      ghostVisible: true,
      ghostTimer: sp.includes("ghost") ? CFG.GHOST_OFF_TIME : 0,
      // tank
      tankSlowed: false,
      tankCharged: false,
      // charge
      charging: false,
      // berserk (recalculated each frame)
      // lifesteal (applied in bite)
      // split / explode (applied in kill)
    };
    demons.push(demon);
    return demon;
  }

  // ── Update loop ───────────────────────────────────────────────────────────
  function update(dt) {
    if (!arenaRect) return;

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

      const dtMs = dt * 1000;

      // ── Hit flash ──
      if (d.hitFlashTimer > 0) {
        d.hitFlashTimer -= dtMs;
        if (d.hitFlashTimer <= 0) d.el.classList.remove("hit");
      }

      // ── Freeze timer ──
      if (d.frozen) {
        d.frozenTimer -= dtMs;
        if (d.frozenTimer <= 0) {
          d.frozen = false;
          d.frozenTimer = 0;
          d.currentSpeed = d.speed;
          d.el.classList.remove("frozen");
        }
      }

      // ── REGEN ──
      if (hasSpecial(d, "regen") && d.hp < d.maxHp) {
        d.regenTimer += dtMs;
        if (d.regenTimer >= CFG.REGEN_INTERVAL) {
          d.regenTimer = 0;
          d.hp = Math.min(
            d.maxHp,
            d.hp + Math.floor(d.maxHp * CFG.REGEN_PERCENT),
          );
          updateHpBar(d);
        }
      }

      // ── GHOST ──
      if (hasSpecial(d, "ghost")) {
        d.ghostTimer -= dtMs;
        if (d.ghostTimer <= 0) {
          d.ghostVisible = !d.ghostVisible;
          d.ghostTimer = d.ghostVisible
            ? CFG.GHOST_OFF_TIME
            : CFG.GHOST_ON_TIME;
          d.el.style.opacity = d.ghostVisible ? "1" : "0.18";
        }
      }

      // ── CHARGE ──
      if (
        hasSpecial(d, "charge") &&
        !d.charging &&
        d.hp / d.maxHp < CFG.CHARGE_THRESH
      ) {
        d.charging = true;
        d.currentSpeed = d.speed * CFG.CHARGE_MULT;
      }

      // ── BERSERK — recalc speed & biteRate based on missing HP ──
      if (hasSpecial(d, "berserk") && !d.frozen) {
        const missingPct = 1 - d.hp / d.maxHp; // 0 at full, 1 at dead
        const mult = 1 + missingPct * (CFG.BERSERK_MAX_MULT - 1);
        d.currentSpeed = d.speed * mult;
        d.currentBiteRate = Math.max(200, d.biteRate / mult);
      }

      // ── TANK ──
      if (hasSpecial(d, "tank") && !d.tankCharged) {
        const hpPct = d.hp / d.maxHp;
        if (!d.tankSlowed && hpPct < CFG.TANK_SLOW_THRESH) {
          d.tankSlowed = true;
          d.currentSpeed = CFG.TANK_SLOW_SPEED;
          // after 2s, burst
          setTimeout(() => {
            if (!d.dead) {
              d.tankCharged = true;
              d.tankSlowed = false;
              d.currentSpeed = d.speed * CFG.TANK_CHARGE_MULT;
              d.el.classList.add("tank-charge");
              setTimeout(() => d.el.classList.remove("tank-charge"), 800);
            }
          }, 2000);
        }
      }

      // ── Resize demon to current cell size ──
      const demonSize = Math.min(cellH * 0.9, cellW * 0.9);
      d.el.style.width = demonSize + "px";
      d.el.style.height = demonSize + "px";
      d.width = demonSize;
      d.height = demonSize;

      // ── Update Y from live row position ──
      const rowEl = document.querySelector(`.grid-row[data-row="${d.row}"]`);
      if (rowEl && arenaLayerRect) {
        const rowRect = rowEl.getBoundingClientRect();
        const liveY =
          rowRect.top - arenaLayerRect.top + (rowRect.height - demonSize) / 2;
        d.y = liveY;
        d.el.style.top = liveY + "px";
      }

      // ── Find plant to eat ──
      // ── Find plant to eat ──
      let eating = false;
      const plantsInRow = Grid.getPlantsInRow(d.row);

      // FLYING: skip the first (rightmost) plant, target the second
      let plantsFiltered = plantsInRow;
      if (hasSpecial(d, "flying") && plantsInRow.length > 1) {
        const sorted = [...plantsInRow].sort((a, b) => b.col - a.col);
        plantsFiltered = sorted.slice(1);
      }

      for (const { col, plant } of plantsFiltered) {
        const cellEl = Grid.getCellEl(d.row, col);
        if (!cellEl) continue;

        const cellRect = cellEl.getBoundingClientRect();
        const demonRect = d.el.getBoundingClientRect();

        const demonCenterY = demonRect.top + demonRect.height / 2;
        const cellCenterY = cellRect.top + cellRect.height / 2;
        if (Math.abs(demonCenterY - cellCenterY) > cellRect.height * 0.6)
          continue;
        if (cellRect.left > demonRect.right) continue;

        if (
          demonRect.right >= cellRect.left &&
          demonRect.left <= cellRect.right + 10
        ) {
          d.targeting = { row: d.row, col };
          d.biteTimer += dtMs;

          const effectiveBiteRate = d.currentBiteRate || d.biteRate;
          if (d.biteTimer >= effectiveBiteRate) {
            d.biteTimer = 0;
            const healAmt = hasSpecial(d, "lifesteal")
              ? Math.floor(d.damage * CFG.LIFESTEAL_PCT)
              : 0;

            const died = Grid.damagePlant(d.row, col, d.damage);

            // LIFESTEAL
            if (healAmt > 0) {
              d.hp = Math.min(d.maxHp, d.hp + healAmt);
              updateHpBar(d);
            }

            // FREEZE plant (slow its fire rate)
            if (hasSpecial(d, "freeze")) {
              Grid.freezePlant &&
                Grid.freezePlant(d.row, col, CFG.FREEZE_PLANT_DUR);
            }

            if (died) {
              d.targeting = null;
              d.biteTimer = 0;
              stopEating(d); // Stop eating when plant is destroyed
            }
          }

          // Start eating animation
          if (!d.eating) {
            startEating(d);
          }

          eating = true;
          break;
        }
      }

      // ← NEW: If no longer eating anything, stop animation
      if (!eating && d.eating) {
        stopEating(d);
      }

      if (eating) continue;

      if (d.targeting) {
        Grid.stopShaking(d.targeting.row, d.targeting.col);
        d.targeting = null;
        d.biteTimer = 0;
        stopEating(d); // ← Stop eating animation
      }

      // Move left
      if (!d.frozen) {
        d.x -= d.currentSpeed * dt;
        d.el.style.left = d.x + "px";
      }

      if (d.x + d.width <= lawnmowerX) {
        triggerLawnmower(d);
        continue;
      }
      if (d.x <= 0) {
        d.dead = true;
        if (onDemonReachedEnd) onDemonReachedEnd(d);
      }
    }

    if (demons.length === 0 && onAllDefeated) onAllDefeated();
  }

  function updateHpBar(d) {
    if (d.hpFill) d.hpFill.style.width = (d.hp / d.maxHp) * 100 + "%";
  }

  function triggerLawnmower(demon) {
    if (typeof Core !== "undefined") Core.triggerLawnmower(demon.row, demon);
  }

  // ── Damage ────────────────────────────────────────────────────────────────
  function damage(demon, amount) {
    if (demon.dead) return;

    // GHOST: if invisible, projectile passes through
    if (hasSpecial(demon, "ghost") && !demon.ghostVisible) return;

    // DODGE: 15% chance to ignore hit entirely
    if (hasSpecial(demon, "dodge") && Math.random() < CFG.DODGE_CHANCE) {
      showDodgeText(demon);
      return;
    }

    // SHIELD: absorb first hit
    if (hasSpecial(demon, "shield") && demon.shieldActive) {
      demon.shieldActive = false;
      if (demon.shieldEl) {
        demon.shieldEl.textContent = "💥";
        setTimeout(() => demon.shieldEl && demon.shieldEl.remove(), 500);
        demon.shieldEl = null;
      }
      return; // absorb the hit
    }

    // ARMOR: reduce damage
    let finalDmg = amount;
    if (hasSpecial(demon, "armor")) {
      finalDmg = Math.max(1, Math.floor(amount * (1 - CFG.ARMOR_REDUCTION)));
    }

    demon.hp = Math.max(0, demon.hp - finalDmg);
    updateHpBar(demon);

    // Hit flash
    demon.el.classList.remove("hit");
    void demon.el.offsetWidth;
    demon.el.classList.add("hit");
    demon.hitFlashTimer = 120;

    if (demon.hp <= 0) kill(demon);
  }

  // ── Kill ──────────────────────────────────────────────────────────────────
  function kill(demon) {
    if (demon.dead) return;
    demon.dead = true;

    if (demon.targeting) {
      Grid.stopShaking(demon.targeting.row, demon.targeting.col);
      demon.targeting = null;
    }
    if (demon.eating) {
      stopEating(demon);
    }

    // EXPLODE: damage all plants in row within range
    if (hasSpecial(demon, "explode")) {
      triggerExplode(demon);
    }

    // SPLIT: spawn 2 mini imps
    if (hasSpecial(demon, "split")) {
      triggerSplit(demon);
    }

    // Coin drop
    const coinAmt = Coins.getDemonCoinDrop(demon.type);
    if (coinAmt > 0) {
      const effectsEl = document.getElementById("effects-layer");
      if (effectsEl) Coins.spawnCoinToken(effectsEl, demon.x, demon.y, coinAmt);
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

  // ── Special effects ───────────────────────────────────────────────────────
  function triggerExplode(demon) {
    const plantsInRow = Grid.getPlantsInRow(demon.row);
    const demonCol = Math.round(demon.x / (arenaRect.width / Grid.getCols()));

    // Flash effect on demon
    const flash = document.createElement("div");
    flash.style.cssText = `
      position:absolute;left:${demon.x}px;top:${demon.y}px;
      width:${demon.width * 3}px;height:${demon.height * 3}px;
      margin-left:-${demon.width}px;margin-top:-${demon.height}px;
      background:radial-gradient(circle,rgba(255,120,0,0.8),transparent 70%);
      border-radius:50%;pointer-events:none;
      animation:explodeFX 0.5s ease-out forwards;
    `;
    const effectsEl = document.getElementById("effects-layer");
    if (effectsEl) {
      effectsEl.appendChild(flash);
      setTimeout(() => flash.remove(), 500);
    }

    for (const { col } of plantsInRow) {
      if (Math.abs(col - demonCol) <= CFG.EXPLODE_RANGE) {
        Grid.damagePlant(demon.row, col, CFG.EXPLODE_DAMAGE);
      }
    }
  }

  function triggerSplit(demon) {
    const impStats = Levels.getDemonStats("imp");
    if (!impStats) return;

    for (let i = 0; i < CFG.SPLIT_COUNT; i++) {
      setTimeout(() => {
        if (!layer) return;
        const miniCfg = {
          type: "imp",
          hp: Math.max(1, Math.floor(demon.maxHp * CFG.SPLIT_HP_MULT)),
          speed: (impStats.speed || 50) * 1.2,
          damage: impStats.damage,
          biteRate: impStats.biteRate,
          special: [], // splits don't inherit specials
          row: demon.row,
        };
        spawn(miniCfg);
      }, i * 200);
    }
  }

  function showDodgeText(demon) {
    const el = document.createElement("div");
    el.textContent = "DODGE!";
    el.style.cssText = `
      position:absolute;
      left:${demon.x + demon.width / 2}px;
      top:${demon.y - 20}px;
      transform:translateX(-50%);
      color:#fbbf24;font-weight:900;font-size:13px;
      pointer-events:none;
      animation:floatUp 0.8s ease-out forwards;
    `;
    const effectsEl = document.getElementById("effects-layer");
    if (effectsEl) {
      effectsEl.appendChild(el);
      setTimeout(() => el.remove(), 800);
    }
  }

  // ── Freeze (from projectile/plant) ───────────────────────────────────────
  function freeze(demon, duration) {
    if (demon.dead) return;
    demon.frozen = true;
    demon.frozenTimer = duration;
    demon.currentSpeed = demon.speed * 0.3;
    demon.el.classList.add("frozen");
  }

  // ── Getters ───────────────────────────────────────────────────────────────
  function getActive() {
    return demons.filter((d) => !d.dead);
  }
  function getAll() {
    return demons;
  }
  function getCount() {
    return demons.filter((d) => !d.dead).length;
  }
  function isDemonInRow(row) {
    return demons.some((d) => !d.dead && d.row === row);
  }

  function clear() {
    demons.forEach((d) => d.el && d.el.remove());
    demons = [];
  }

  function startEating(demon) {
    if (demon.eating || !demon.video || demon.video.tagName !== "VIDEO") return;

    demon.eating = true;

    const eatSrc = `assets/demons/demon1_imp/eat.webm`;

    demon.video.pause();
    demon.video.src = eatSrc;
    demon.video.loop = true;
    demon.video.currentTime = 0; // Restart animation from beginning
    demon.video.play().catch(() => {});
  }
  function stopEating(demon) {
    if (!demon.eating || !demon.video) return;

    demon.eating = false;

    // Switch back to normal walking animation
    const walkSrc =
      Levels.getDemonStats(demon.type)?.animation ||
      `assets/demons/${demon.type}.webm`;

    demon.video.pause();
    demon.video.src = walkSrc;
    demon.video.loop = true;
    demon.video.play().catch(() => {});
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
