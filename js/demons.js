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
  const CFG = {
    DEMON_WIDTH: 120,
    DEMON_HEIGHT: 120,
    DODGE_CHANCE: 0.15,
    ARMOR_REDUCTION: 0.4,
    REGEN_INTERVAL: 2000,
    REGEN_PERCENT: 0.03,
    EXPLODE_RANGE: 2,
    EXPLODE_DAMAGE: 60,
    SPLIT_COUNT: 2,
    SPLIT_HP_MULT: 0.3,
    LIFESTEAL_PCT: 0.3,
    BERSERK_MAX_MULT: 2.5,
    GHOST_ON_TIME: 2000,
    GHOST_OFF_TIME: 3500,
    TANK_SLOW_THRESH: 0.2,
    TANK_SLOW_SPEED: 4,
    TANK_CHARGE_MULT: 3.5,
    FREEZE_PLANT_DUR: 3000,
    CHARGE_THRESH: 0.3,
    CHARGE_MULT: 2.0,

    // ── Variant damage modifiers (change these to rebalance) ──
    IMP_AXE_PHYS_IMMUNITY: 0, // 0 = full immune to physical
    IMP_SHIELD_ALL_REDUCTION: 0.7, // takes 70% of all damage (30% less)
    IMP_SHIELD_PSYCHIC_MULT: 1.4, // psychic deals 40% more
    IMP_HEAVY_PHYS_MULT: 1.4, // physical deals 40% more
    IMP_KING_STOP_COL: 1, // column index king stops at
    IMP_KING_SPAWN_INTERVAL: 7000, // ms between king spawns
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

    const resolvedImage = stats.image;

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
      sprite.src = resolvedImage || stats.image;
      sprite.alt = stats.name;
      sprite.draggable = false;
    }
    sprite.style.cssText = "width:100%;height:100%;object-fit:contain;";

    // HP bar
    // HP bar
    const hpWrap = document.createElement("div");
    hpWrap.className = "demon-hp-wrap";
    const hpFill = document.createElement("div");
    hpFill.className = "demon-hp-fill";
    hpFill.style.width = "100%";
    hpWrap.appendChild(hpFill);

    const hpLabel = null; // HP number hidden — bar only

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
    layer.appendChild(wrap);
    const effectsEl = document.getElementById("effects-layer");
    if (effectsEl) effectsEl.appendChild(hpWrap);

    // CSS idle animation per type
    wrap.classList.add(`type-${cfg.type}`);

    if (cfg.type === "imp" || cfg.type.startsWith("imp_")) {
      wrap.classList.add("imp-walk");
      if (cfg.type === "imp_heavy") wrap.style.transform = "scale(1.15)";
      if (cfg.type === "imp_king") wrap.style.transform = "scale(1.25)";
    } else if (cfg.type === "bat") {
      wrap.classList.add("bat-idle");
    } else if (cfg.type === "ice") {
      wrap.classList.add("ice-idle");
    } else if (cfg.type === "armored") {
      wrap.classList.add("armored-idle");
    } else if (cfg.type === "brute") {
      wrap.classList.add("brute-idle");
    }

    if (cfg.type === "imp_king") {
      wrap.classList.add("king-aura");
    }

    const demon = {
      id: Date.now() + Math.random(),
      type: cfg.type,
      name: stats.name,
      el: wrap,
      imgEl: sprite,
      video: sprite, // reference for switching animation
      hpFill,
      hpLabel,
      hpWrap,
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
    if (cfg.type === "imp_king") SoundFX.play("king_roar");
    else SoundFX.play("demon_spawn");
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
        if (d.hpWrap) d.hpWrap.remove();
        demons.splice(i, 1);
        continue;
      }

      const dtMs = dt * 1000;
      // ── King special logic ──
      if (d.type === "imp_king") {
        updateKing(d, dt, gridRect, arenaLayerRect, cellW);
      }
      // ── Hit flash ──
      if (d.hitFlashTimer > 0) {
        d.hitFlashTimer -= dtMs;
        if (d.hitFlashTimer <= 0) d.el.classList.remove("hit");
      }

      // ── Slow timer ──
      if (d.slowed && !d.frozen) {
        d.slowTimer -= dtMs;
        if (d.slowTimer <= 0) {
          d.slowed = false;
          d.slowTimer = 0;
          d.currentSpeed = d.speed;
          d.el.classList.remove("slowed");
          d.el.style.animationDuration = "";
          if (d.imgEl) d.imgEl.style.animationDuration = "";
        }
      }

      // ── Freeze timer ──
      if (d.frozen) {
        d.frozenTimer -= dtMs;
        if (d.frozenTimer <= 0) {
          d.frozen = false;
          d.frozenTimer = 0;
          d.currentSpeed = d.speed;
          d.el.classList.remove("frozen");
          // Resume all animations
          d.el.style.animationPlayState = "";
          if (d.imgEl) d.imgEl.style.animationPlayState = "";
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

      // CHARGE special — only triggers for demons that have it, only when HP low
      if (
        hasSpecial(d, "charge") &&
        !d.charging &&
        d.hp / d.maxHp < CFG.CHARGE_THRESH
      ) {
        d.charging = true;
        d.currentSpeed = d.speed * CFG.CHARGE_MULT;
        if (d.type === "imp" || d.type.startsWith("imp_")) {
          d.el.classList.remove("imp-walk", "imp-eat");
          d.el.classList.add("imp-charging");
        } else if (d.type === "brute") {
          d.el.classList.remove("brute-idle", "brute-eat");
          d.el.classList.add("brute-charging");
        }
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

      // ── Sync HP bar — pinned to bottom edge of the row, tracks X only ──
      if (d.hpWrap) {
        const effectsEl = document.getElementById("effects-layer");
        const eRect = effectsEl ? effectsEl.getBoundingClientRect() : null;
        const rowEl = document.querySelector(`.grid-row[data-row="${d.row}"]`);
        const dRect = d.el.getBoundingClientRect();
        if (eRect && rowEl) {
          const rowRect = rowEl.getBoundingClientRect();
          // X follows demon, Y is pinned to bottom of row
          const barLeft = dRect.left - eRect.left + dRect.width * 0.1;
          const barTop = rowRect.bottom - eRect.top - 7;
          const barW = dRect.width * 0.8;
          d.hpWrap.style.left = barLeft + "px";
          d.hpWrap.style.top = barTop + "px";
          d.hpWrap.style.width = barW + "px";
        }
      }

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
        if (!plant || plant.hp <= 0) {
          if (d.targeting && d.targeting.col === col) {
            d.targeting = null;
            d.biteTimer = 0;
            d.eating = false;
            stopEating(d);
          }
          continue;
        }
        const cellEl = Grid.getCellEl(d.row, col);
        if (!cellEl) continue;

        const cellRect = cellEl.getBoundingClientRect();
        const demonRect = d.el.getBoundingClientRect();

        const demonCenterY = demonRect.top + demonRect.height / 2;
        const cellCenterY = cellRect.top + cellRect.height / 2;
        if (Math.abs(demonCenterY - cellCenterY) > cellRect.height * 0.6)
          continue;
        if (cellRect.left > demonRect.right) continue;

        const overlapX =
          demonRect.right > cellRect.left + 4 &&
          demonRect.left < cellRect.right - 4;
        if (overlapX) {
          d.targeting = { row: d.row, col };
          d.biteTimer += dtMs;

          const effectiveBiteRate = d.currentBiteRate || d.biteRate;
          if (d.biteTimer >= effectiveBiteRate) {
            d.biteTimer = 0;
            const healAmt = hasSpecial(d, "lifesteal")
              ? Math.floor(d.damage * CFG.LIFESTEAL_PCT)
              : 0;

            SoundFX.play("demon_chomp");
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
              // Plant already removed by damagePlant — just reset demon state
              d.targeting = null;
              d.biteTimer = 0;
              eating = false;
              d.eating = false; // force-clear regardless of stopEating guard
              stopEating(d);
              // Clear all row shaking as a safety net
              for (let sc = 0; sc < Grid.getCols(); sc++) {
                Grid.stopShaking(d.row, sc);
              }
              break;
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
    if (!d.hpFill || !d.hpWrap) return;
    // Re-attach if detached
    const effectsEl = document.getElementById("effects-layer");
    if (effectsEl && !d.hpWrap.parentNode) {
      effectsEl.appendChild(d.hpWrap);
    }
    const pct = d.hp / d.maxHp;
    d.hpFill.style.width = pct * 100 + "%";
    d.hpFill.style.background =
      pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#f59e0b" : "#ef4444";
  }

  function triggerLawnmower(demon) {
    if (typeof Core !== "undefined") Core.triggerLawnmower(demon.row, demon);
  }

  // ── Damage ────────────────────────────────────────────────────────────────
  function damage(demon, amount, damageType = "physical") {
    if (demon.dead) return;
    demon.lastDamageType = damageType; // track for death animation

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

    // VARIANT DAMAGE MODIFIERS
    const stats = Levels.getDemonStats(demon.type);
    if (stats && stats.damageModifiers) {
      const mod = stats.damageModifiers[damageType];
      if (mod !== undefined) {
        if (mod === 0) {
          // Full immunity — show immune text and return
          showImmuneText(demon);
          return;
        }
        finalDmg = Math.floor(finalDmg * mod);
      }
    }

    // ice-pea is BOTH physical and ice — apply physical modifier too if different type
    if (damageType === "ice" && stats && stats.damageModifiers) {
      const physMod = stats.damageModifiers["physical"];
      if (physMod !== undefined && physMod !== 1.0) {
        if (physMod === 0) {
          showImmuneText(demon);
          return;
        }
        finalDmg = Math.floor(finalDmg * physMod);
      }
    }

    demon.hp = Math.max(0, demon.hp - finalDmg);
    updateHpBar(demon);

    // HIT FLASH
    demon.el.classList.add("hit");
    setTimeout(() => demon.el.classList.remove("hit"), 120);

    // Armored gets gold sparks on hit
    if (demon.type === "armored") showArmorSparks(demon);

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
    // KING: kill all spawned minions
    if (demon.type === "imp_king") {
      killKingMinions(demon);
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

    // Death animation — style based on last damage type
    const _dtype = demon.lastDamageType || "physical";
    if (_dtype === "ice") SoundFX.play("demon_die_ice");
    else if (_dtype === "fire") SoundFX.play("demon_die_fire");
    else SoundFX.play("demon_die");
    playDeathAnimation(demon);
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
  function showImmuneText(demon) {
    const effectsEl = document.getElementById("effects-layer");
    if (!effectsEl) return;
    const el = document.createElement("div");
    el.textContent = "IMMUNE!";
    el.style.cssText = `
      position:absolute;
      left:${demon.x + demon.width / 2}px;
      top:${demon.y - 20}px;
      transform:translateX(-50%);
      color:#a78bfa;font-weight:900;font-size:13px;
      font-family:var(--font-display);
      text-shadow:0 0 8px rgba(167,139,250,0.8);
      pointer-events:none;
      animation:floatUp 0.8s ease-out forwards;
    `;
    effectsEl.appendChild(el);
    setTimeout(() => {
      el.remove();
      if (demon.hpWrap) demon.hpWrap.remove();
    }, 500);
  }

  function showArmorSparks(demon) {
    const effectsEl = document.getElementById("effects-layer");
    if (!effectsEl) return;
    const dRect = demon.el.getBoundingClientRect();
    const eRect = effectsEl.getBoundingClientRect();
    const cx = dRect.left - eRect.left + dRect.width / 2;
    const cy = dRect.top - eRect.top + dRect.height / 2;

    for (let i = 0; i < 6; i++) {
      const spark = document.createElement("div");
      spark.className = "armor-spark";
      const angle = (i / 6) * Math.PI * 2;
      const dist = 20 + Math.random() * 20;
      spark.style.cssText = `
        left:${cx}px; top:${cy}px;
        --sx:${Math.cos(angle) * dist}px;
        --sy:${Math.sin(angle) * dist}px;
        animation-delay:${i * 0.03}s;
      `;
      effectsEl.appendChild(spark);
      setTimeout(() => spark.remove(), 350);
    }
  }
  function spawnIceBreathCloud(demon) {
    const effectsEl = document.getElementById("effects-layer");
    if (!effectsEl || !demon.el) return;
    const dRect = demon.el.getBoundingClientRect();
    const eRect = effectsEl.getBoundingClientRect();

    const cloud = document.createElement("div");
    cloud.className = "ice-breath-cloud";
    cloud.style.cssText = `
      position:absolute;
      left:${dRect.left - eRect.left - 10}px;
      top:${dRect.top - eRect.top + dRect.height * 0.4}px;
      width:40px; height:40px;
    `;
    effectsEl.appendChild(cloud);
    setTimeout(() => cloud.remove(), 600);
  }

  function showDodgeText(demon) {
    // Dodge sidestep animation on the demon
    if (demon.type === "imp") {
      demon.el.classList.add("imp-dodge");
      setTimeout(() => demon.el.classList.remove("imp-dodge"), 300);
    }

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
      setTimeout(() => {
        el.remove();
        if (demon.hpWrap) demon.hpWrap.remove();
      }, 500);
    }
  }

  function freeze(demon, duration) {
    if (demon.dead) return;
    demon.frozen = true;
    demon.frozenTimer = duration;
    demon.currentSpeed = 0;
    demon.el.classList.remove("slowed");
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
    if (demon.eating) return;
    demon.eating = true;

    if (demon.type === "imp" || demon.type.startsWith("imp_")) {
      demon.el.classList.remove("imp-walk", "imp-charging");
      demon.el.classList.add("imp-eat");
    } else if (demon.type === "bat") {
      demon.el.classList.remove("bat-idle");
      demon.el.classList.add("bat-eat");
    } else if (demon.type === "ice") {
      demon.el.classList.remove("ice-idle");
      demon.el.classList.add("ice-eat");
      spawnIceBreathCloud(demon);
    } else if (demon.type === "armored") {
      demon.el.classList.remove("armored-idle");
      demon.el.classList.add("armored-eat");
    } else if (demon.type === "brute") {
      demon.el.classList.remove("brute-idle", "brute-charging");
      demon.el.classList.add("brute-eat");
    }

    // Video eating animation if available
    if (demon.video && demon.video.tagName === "VIDEO") {
      const eatSrc = `assets/demons/demon1_imp/eat.webm`;
      demon.video.pause();
      demon.video.src = eatSrc;
      demon.video.loop = true;
      demon.video.currentTime = 0;
      demon.video.play().catch(() => {});
    }
  }

  function stopEating(demon) {
    if (!demon.eating) return;
    demon.eating = false;

    // Restore idle animation per type
    if (demon.type === "imp" || demon.type.startsWith("imp_")) {
      demon.el.classList.remove("imp-eat");
      demon.el.classList.add(demon.charging ? "imp-charging" : "imp-walk");
    } else if (demon.type === "bat") {
      demon.el.classList.remove("bat-eat");
      demon.el.classList.add("bat-idle");
    } else if (demon.type === "ice") {
      demon.el.classList.remove("ice-eat");
      demon.el.classList.add("ice-idle");
    } else if (demon.type === "armored") {
      demon.el.classList.remove("armored-eat");
      demon.el.classList.add("armored-idle");
    } else if (demon.type === "brute") {
      demon.el.classList.remove("brute-eat");
      demon.el.classList.add(demon.charging ? "brute-charging" : "brute-idle");
    }

    if (demon.video && demon.video.tagName === "VIDEO") {
      const walkSrc = Levels.getDemonStats(demon.type)?.animation || "";
      if (walkSrc) {
        demon.video.pause();
        demon.video.src = walkSrc;
        demon.video.loop = true;
        demon.video.play().catch(() => {});
      }
    }
  }

  function playDeathAnimation(demon) {
    const type = demon.lastDamageType || "physical";
    const el = demon.el;
    if (demon.hpWrap) {
      demon.hpWrap.remove();
      demon.hpWrap = null;
    }
    const imgEl = demon.imgEl;
    const effectsEl = document.getElementById("effects-layer");
    const demonLayerEl = document.getElementById("demons-layer");

    // Get position relative to effects layer
    const dRect = el.getBoundingClientRect();
    const eRect = effectsEl ? effectsEl.getBoundingClientRect() : dRect;
    const cx = dRect.left - eRect.left + dRect.width / 2;
    const cy = dRect.top - eRect.top + dRect.height / 2;
    const sz = dRect.width;

    if (type === "physical") {
      // ── Shatter: image cracks apart into 4 pieces ──
      if (imgEl) {
        imgEl.style.transition = "none";
        imgEl.style.animation = "impShatter 0.5s ease-out forwards";
      }

      // 4 shard divs flying outward
      const directions = [
        { tx: -40, ty: -40, r: -45 },
        { tx: 40, ty: -30, r: 30 },
        { tx: -30, ty: 40, r: -20 },
        { tx: 50, ty: 30, r: 60 },
      ];
      if (effectsEl) {
        directions.forEach((d, i) => {
          const shard = document.createElement("div");
          shard.style.cssText = `
            position:absolute;
            left:${cx - sz * 0.2}px; top:${cy - sz * 0.2}px;
            width:${sz * 0.4}px; height:${sz * 0.4}px;
            background:rgba(220,38,38,0.85);
            clip-path:polygon(50% 0%,100% 100%,0% 100%);
            box-shadow:0 0 8px rgba(239,68,68,0.6);
            pointer-events:none; z-index:40;
            animation:shardFly 0.55s ease-out ${i * 0.04}s forwards;
            --tx:${d.tx}px; --ty:${d.ty}px; --r:${d.r}deg;
          `;
          effectsEl.appendChild(shard);
          setTimeout(() => shard.remove(), 600);
        });
      }
      setTimeout(() => {
        el.remove();
        if (demon.hpWrap) demon.hpWrap.remove();
      }, 500);
    } else if (type === "ice") {
      // ── Freeze solid then shatter in blue ──
      if (imgEl) {
        imgEl.style.transition = "none";
        imgEl.style.animation = "impFreezeKill 0.8s ease-out forwards";
      }

      // Ice crystal burst
      if (effectsEl) {
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const crystal = document.createElement("div");
          crystal.style.cssText = `
            position:absolute;
            left:${cx}px; top:${cy}px;
            width:8px; height:22px;
            background:linear-gradient(to top, #67e8f9, #e0f2fe);
            border-radius:3px 3px 0 0;
            box-shadow:0 0 8px rgba(103,232,249,0.9);
            pointer-events:none; z-index:40;
            transform-origin:bottom center;
            --tx:${Math.cos(angle) * 45}px;
            --ty:${Math.sin(angle) * 45}px;
            --r:${(angle * 180) / Math.PI + 90}deg;
            animation:crystalBurst 0.6s ease-out ${i * 0.05}s forwards;
          `;
          effectsEl.appendChild(crystal);
          setTimeout(() => crystal.remove(), 700);
        }

        // Freeze ring
        const ring = document.createElement("div");
        ring.style.cssText = `
          position:absolute;
          left:${cx - sz * 0.5}px; top:${cy - sz * 0.5}px;
          width:${sz}px; height:${sz}px;
          border-radius:50%;
          border:3px solid rgba(103,232,249,0.9);
          box-shadow:0 0 20px rgba(103,232,249,0.6);
          pointer-events:none; z-index:39;
          animation:iceBurstRing 0.6s ease-out forwards;
        `;
        effectsEl.appendChild(ring);
        setTimeout(() => ring.remove(), 600);
      }
      setTimeout(() => {
        el.remove();
        if (demon.hpWrap) demon.hpWrap.remove();
      }, 500);
    } else if (type === "fire") {
      // ── Burns up — rises and dissolves in flames ──
      if (imgEl) {
        imgEl.style.transition = "none";
        imgEl.style.animation = "impBurnKill 0.7s ease-out forwards";
      }

      // Flame particles rising
      if (effectsEl) {
        for (let i = 0; i < 8; i++) {
          const flame = document.createElement("div");
          const offX = (Math.random() - 0.5) * sz;
          flame.style.cssText = `
            position:absolute;
            left:${cx + offX - 10}px;
            top:${cy - 10}px;
            width:${12 + Math.random() * 14}px;
            height:${18 + Math.random() * 20}px;
            background:radial-gradient(ellipse at bottom, #fbbf24, #f97316, #dc2626, transparent);
            border-radius:50% 50% 30% 30%;
            pointer-events:none; z-index:40;
            animation:flameDie 0.7s ease-out ${i * 0.06}s forwards;
            --offX:${offX}px;
          `;
          effectsEl.appendChild(flame);
          setTimeout(() => flame.remove(), 800);
        }

        // Scorch mark
        const scorch = document.createElement("div");
        scorch.style.cssText = `
          position:absolute;
          left:${cx - 24}px; top:${cy + sz * 0.3}px;
          width:48px; height:16px;
          border-radius:50%;
          background:radial-gradient(ellipse, rgba(0,0,0,0.6), transparent);
          pointer-events:none; z-index:38;
          animation:scorchFade 1.2s ease-out forwards;
        `;
        effectsEl.appendChild(scorch);
        setTimeout(() => scorch.remove(), 1200);
      }
      setTimeout(() => {
        el.remove();
        if (demon.hpWrap) demon.hpWrap.remove();
      }, 500);
    } else if (type === "electric") {
      // ── Electrocuted — stiff jolt then disintegrates ──
      if (imgEl) {
        imgEl.style.transition = "none";
        imgEl.style.animation = "impElectroKill 0.6s ease-out forwards";
      }

      // Lightning arcs bursting outward
      if (effectsEl) {
        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        svg.style.cssText = `
          position:absolute; left:0; top:0;
          width:100%; height:100%;
          pointer-events:none; z-index:40; overflow:visible;
        `;
        effectsEl.appendChild(svg);

        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const len = 40 + Math.random() * 30;
          const ex = cx + Math.cos(angle) * len;
          const ey = cy + Math.sin(angle) * len;
          const mx =
            cx + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 20;
          const my =
            cy + Math.sin(angle) * len * 0.5 + (Math.random() - 0.5) * 20;

          const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
          );
          path.setAttribute("d", `M${cx},${cy} Q${mx},${my} ${ex},${ey}`);
          path.setAttribute("stroke", i % 2 === 0 ? "#fde047" : "#fff");
          path.setAttribute("stroke-width", "2.5");
          path.setAttribute("fill", "none");
          path.setAttribute("opacity", "0.9");
          path.style.animation = `arcFade 0.5s ease-out ${i * 0.04}s forwards`;
          svg.appendChild(path);
        }
        setTimeout(() => svg.remove(), 600);

        // Yellow burst circle
        const burst = document.createElement("div");
        burst.style.cssText = `
          position:absolute;
          left:${cx - sz * 0.5}px; top:${cy - sz * 0.5}px;
          width:${sz}px; height:${sz}px;
          border-radius:50%;
          background:radial-gradient(circle, rgba(254,240,138,0.8) 0%, rgba(250,204,21,0.5) 40%, transparent 70%);
          box-shadow:0 0 30px rgba(250,204,21,0.7);
          pointer-events:none; z-index:39;
          animation:electroBurst 0.5s ease-out forwards;
        `;
        effectsEl.appendChild(burst);
        setTimeout(() => burst.remove(), 500);
      }
      setTimeout(() => {
        el.remove();
        if (demon.hpWrap) demon.hpWrap.remove();
      }, 500);
    } else if (type === "psychic") {
      // ── Confused spin then dissolve in purple ──
      if (imgEl) {
        imgEl.style.transition = "none";
        imgEl.style.animation = "impPsychicKill 0.7s ease-out forwards";
      }

      if (effectsEl) {
        // Spiral rings
        for (let i = 0; i < 3; i++) {
          const ring = document.createElement("div");
          const rs = sz * (0.4 + i * 0.3);
          ring.style.cssText = `
            position:absolute;
            left:${cx - rs / 2}px; top:${cy - rs / 2}px;
            width:${rs}px; height:${rs}px;
            border-radius:50%;
            border:2px solid rgba(168,85,247,${0.9 - i * 0.2});
            box-shadow:0 0 10px rgba(168,85,247,0.6);
            pointer-events:none; z-index:40;
            animation:psychicRing 0.7s ease-out ${i * 0.1}s forwards;
          `;
          effectsEl.appendChild(ring);
          setTimeout(() => ring.remove(), 800);
        }
      }
      setTimeout(() => {
        el.remove();
        if (demon.hpWrap) demon.hpWrap.remove();
      }, 500);
    } else if (type === "beam") {
      // ── Flash white then vaporizes ──
      if (imgEl) {
        imgEl.style.transition = "none";
        imgEl.style.animation = "impBeamKill 0.5s ease-out forwards";
      }

      if (effectsEl) {
        const flash = document.createElement("div");
        flash.style.cssText = `
          position:absolute;
          left:${cx - sz}px; top:${cy - sz}px;
          width:${sz * 2}px; height:${sz * 2}px;
          border-radius:50%;
          background:radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(34,211,238,0.7) 40%, transparent 70%);
          pointer-events:none; z-index:40;
          animation:beamVaporize 0.5s ease-out forwards;
        `;
        effectsEl.appendChild(flash);
        setTimeout(() => flash.remove(), 500);
      }
      setTimeout(() => {
        el.remove();
        if (demon.hpWrap) demon.hpWrap.remove();
      }, 500);
    } else {
      // ── Default fallback ──
      if (imgEl) {
        imgEl.style.transition = "opacity 0.3s, transform 0.3s";
        imgEl.style.opacity = "0";
        imgEl.style.transform = "scale(0.5) rotate(20deg)";
      }
      setTimeout(() => {
        el.remove();
        if (demon.hpWrap) demon.hpWrap.remove();
      }, 500);
    }
  }
  // ── Imp King logic ────────────────────────────────────────────────────────
  function updateKing(king, dt, gridRect, layerRect, cellW) {
    if (king.dead || king.type !== "imp_king") return;

    const cfg = Levels.getDemonStats("imp_king")?.kingConfig;
    if (!cfg) return;

    // Calculate x position of stop column
    const gridOffX =
      gridRect && layerRect ? gridRect.left - layerRect.left : 72;
    const stopX = gridOffX + cfg.STOP_COL * cellW;

    // Stop when reaching stop column
    if (!king.kingStopped && king.x <= stopX) {
      king.kingStopped = true;
      king.currentSpeed = 0;
      king.x = stopX;
      king.el.style.left = king.x + "px";
      king.kingSpawnTimer = 0;
      // Crown glow effect
      king.el.classList.add("king-stopped");
    }

    if (!king.kingStopped) return;

    // Spawn timer
    king.kingSpawnTimer = (king.kingSpawnTimer || 0) + dt * 1000;
    if (king.kingSpawnTimer >= cfg.SPAWN_INTERVAL) {
      king.kingSpawnTimer = 0;
      // Roar effect before spawning
      SoundFX.play("king_roar");
      king.el.classList.add("king-roaring");
      king.el.style.animation = "kingRoarPulse 0.5s ease-out, kingRoarShake 0.5s ease-in-out";
      setTimeout(() => {
        king.el.classList.remove("king-roaring");
        king.el.style.animation = "";
        king.el.classList.add("king-aura");
        if (!king.dead) spawnKingMinions(king, cfg, cellW, gridOffX);
      }, 600);
    }
  }

  function spawnKingMinions(king, cfg, cellW, gridOffX) {
    if (!king.kingMinions) king.kingMinions = [];

    // Remove dead minions from tracking
    king.kingMinions = king.kingMinions.filter((m) => !m.dead);

    const kingCol = Math.round((king.x - gridOffX) / cellW);
    const kingRow = king.row;

    cfg.SPAWN_OFFSETS.forEach((offset, i) => {
      const targetRow = kingRow + offset.rowDelta;
      const targetCol = kingCol + offset.colDelta;

      // Bounds check
      if (targetRow < 0 || targetRow >= Grid.getRows()) return;
      if (targetCol < 0 || targetCol >= Grid.getCols()) return;

      const spawnType = cfg.SPAWN_TYPES[i] || "imp";
      const baseStats = Levels.getDemonStats(spawnType);
      if (!baseStats) return;

      setTimeout(() => {
        if (king.dead) return;

        const minionCfg = {
          type: spawnType,
          hp: Math.floor(baseStats.hp * 0.5), // minions are weaker
          speed: baseStats.speed,
          damage: baseStats.damage,
          biteRate: baseStats.biteRate,
          special: [],
          row: targetRow,
          isKingMinion: true,
        };

        const minion = spawn(minionCfg);
        if (minion) {
          minion.kingParent = king;
          king.kingMinions.push(minion);

          // Override x position FIRST, then run effect with correct coords
          const gridEl = document.getElementById("grid-container");
          const layerEl = document.getElementById("demons-layer");
          if (gridEl && layerEl) {
            const gRect = gridEl.getBoundingClientRect();
            const lRect = layerEl.getBoundingClientRect();
            const spawnX =
              gRect.left - lRect.left + targetCol * cellW + cellW / 2;
            minion.x = spawnX;
            minion.el.style.left = spawnX + "px";

            // Now compute cell-accurate screen coords for the effect
            const rowEl = document.querySelector(
              `.grid-row[data-row="${targetRow}"]`,
            );
            const eEl = document.getElementById("effects-layer");
            if (rowEl && eEl) {
              const rRect = rowEl.getBoundingClientRect();
              const eRect = eEl.getBoundingClientRect();
              const cx =
                gRect.left - eRect.left + targetCol * cellW + cellW / 2;
              const cy = rRect.bottom - eRect.top;
              const sz = Math.min(cellW, rRect.height) * 0.85;
              showMinionSpawnEffect(minion, cx, cy, sz);
            } else {
              showMinionSpawnEffect(minion, null, null, null);
            }
          }
        }
      }, i * 300); // stagger spawns slightly
    });
  }

  function showMinionSpawnEffect(minion, cx, cy, sz) {
    if (!minion || !minion.el) return;

    const effectsEl = document.getElementById("effects-layer");
    if (!effectsEl) return;

    // Use passed-in coords (cell-accurate); fallback to DOM read if null
    if (cx === null || cy === null || sz === null) {
      const mRect = minion.el.getBoundingClientRect();
      const eRect = effectsEl.getBoundingClientRect();
      cx = mRect.left - eRect.left + mRect.width / 2;
      cy = mRect.bottom - eRect.top;
      sz = mRect.width;
    }

    // Shadow pool on ground
    const shadow = document.createElement("div");
    shadow.style.cssText = `
      position:absolute;
      left:${cx - sz * 0.6}px; top:${cy - sz * 0.1}px;
      width:${sz * 1.2}px; height:${sz * 0.25}px;
      border-radius:50%;
      background:radial-gradient(ellipse, rgba(120,0,200,0.85) 0%, rgba(80,0,0,0.5) 50%, transparent 80%);
      pointer-events:none; z-index:30;
      animation:shadowPool 0.9s ease-out forwards;
    `;
    effectsEl.appendChild(shadow);

    // Warning flash "!" above spawn point
    const warn = document.createElement("div");
    warn.textContent = "!";
    warn.style.cssText = `
      position:absolute;
      left:${cx - 10}px; top:${cy - sz * 1.2}px;
      font-size:${sz * 0.5}px; font-weight:900; line-height:1;
      color:#ff3300; text-shadow:0 0 10px #ff6600, 0 0 20px #ff0000;
      pointer-events:none; z-index:50;
      animation:warningFlash 0.25s ease-in-out 3;
    `;
    effectsEl.appendChild(warn);

    // ── Phase 2 (t=200ms): Portal opens ──
    setTimeout(() => {
      if (minion.dead) return;

      // Rotating dark portal disc
      const portal = document.createElement("div");
      portal.style.cssText = `
        position:absolute;
        left:${cx - sz * 0.55}px; top:${cy - sz * 0.55}px;
        width:${sz * 1.1}px; height:${sz * 1.1}px;
        border-radius:50%;
        background:conic-gradient(
          rgba(180,0,255,0.9) 0deg,
          rgba(255,30,0,0.7) 90deg,
          rgba(0,0,0,1) 180deg,
          rgba(180,0,255,0.9) 270deg,
          rgba(255,30,0,0.7) 360deg
        );
        pointer-events:none; z-index:33;
        animation:portalExpand 0.7s ease-out forwards;
      `;
      effectsEl.appendChild(portal);

      // Expanding rings x3
      for (let r = 0; r < 3; r++) {
        const ring = document.createElement("div");
        ring.style.cssText = `
          position:absolute;
          left:${cx - sz * 0.5}px; top:${cy - sz * 0.5}px;
          width:${sz}px; height:${sz}px;
          border-radius:50%;
          border:4px solid rgba(${r === 0 ? "255,60,0" : r === 1 ? "200,0,255" : "255,180,0"},0.9);
          box-shadow:0 0 12px rgba(255,60,0,0.6);
          pointer-events:none; z-index:34;
          animation:portalRing 0.6s ease-out ${r * 0.12}s forwards;
        `;
        effectsEl.appendChild(ring);
        setTimeout(() => ring.remove(), 800);
      }

      // Hellfire pillar rising from ground
      const fire = document.createElement("div");
      fire.style.cssText = `
        position:absolute;
        left:${cx - sz * 0.25}px; top:${cy - sz * 1.1}px;
        width:${sz * 0.5}px; height:${sz * 1.1}px;
        border-radius:50% 50% 20% 20%;
        background:linear-gradient(to top,
          rgba(255,50,0,1) 0%,
          rgba(255,140,0,0.9) 40%,
          rgba(255,220,50,0.6) 70%,
          transparent 100%
        );
        filter:blur(6px);
        pointer-events:none; z-index:32;
        animation:hellfire 0.7s ease-out forwards;
      `;
      effectsEl.appendChild(fire);

      // Floating embers (6 particles)
      for (let e = 0; e < 6; e++) {
        const angle = (e / 6) * Math.PI * 2;
        const dist = sz * (0.5 + Math.random() * 0.5);
        const ex = Math.cos(angle) * dist;
        const ey = -(Math.random() * sz * 1.2 + sz * 0.3);
        const ember = document.createElement("div");
        ember.style.cssText = `
          position:absolute;
          left:${cx - 4}px; top:${cy - sz * 0.3}px;
          width:${4 + Math.random() * 5}px;
          height:${4 + Math.random() * 5}px;
          border-radius:50%;
          background:radial-gradient(circle, #fff 0%, #ff8800 50%, #ff2200 100%);
          box-shadow:0 0 6px #ff4400;
          pointer-events:none; z-index:36;
          --ex:${ex}px; --ey:${ey}px;
          animation:emberFloat ${0.5 + Math.random() * 0.4}s ease-out forwards;
        `;
        effectsEl.appendChild(ember);
        setTimeout(() => ember.remove(), 900);
      }

      setTimeout(() => {
        portal.remove();
        fire.remove();
      }, 700);
    }, 200);

    // ── Phase 3 (t=600ms): Minion bursts out ──
    minion.el.style.opacity = "0";
    minion.el.style.transform = "translateY(50px) scaleY(0.2) scaleX(1.3)";
    minion.el.style.transition = "none";
    minion.el.style.filter = "brightness(3) saturate(2)";

    setTimeout(() => {
      if (minion.dead) return;
      minion.el.style.transition = "none";
      minion.el.style.animation =
        "minionRise 0.55s cubic-bezier(0.22,1,0.36,1) forwards";
      minion.el.style.opacity = "1";

      // Ground crack lines
      for (let c = 0; c < 3; c++) {
        const angle = -30 + c * 30;
        const crack = document.createElement("div");
        crack.style.cssText = `
          position:absolute;
          left:${cx - sz * 0.4}px; top:${cy - 4}px;
          width:${sz * 0.8}px; height:8px;
          background:linear-gradient(90deg, transparent, rgba(255,80,0,0.9), rgba(255,200,50,0.7), transparent);
          border-radius:4px;
          transform:rotate(${angle}deg);
          transform-origin:center;
          pointer-events:none; z-index:35;
          animation:crackFade 0.7s ease-out forwards;
        `;
        effectsEl.appendChild(crack);
        setTimeout(() => crack.remove(), 700);
      }

      // Reset filter after rise
      setTimeout(() => {
        if (minion.el) minion.el.style.filter = "";
      }, 550);
    }, 600);

    // Cleanup shadow + warning
    setTimeout(() => {
      shadow.remove();
      warn.remove();
    }, 900);
  }

  function killKingMinions(king) {
    if (!king.kingMinions) return;
    king.kingMinions.forEach((minion) => {
      if (!minion.dead) {
        minion.dead = true;
        // Vanish animation for minions
        if (minion.el) {
          minion.el.style.transition =
            "transform 0.4s ease-in, opacity 0.4s ease-in";
          minion.el.style.transform = "translateY(-30px) scale(0)";
          minion.el.style.opacity = "0";
          setTimeout(() => {
            if (minion.el) minion.el.remove();
            if (minion.hpWrap) minion.hpWrap.remove();
          }, 400);
        }
      }
    });
    king.kingMinions = [];
  }

  function slow(demon, duration, speedMult = 0.4) {
    if (demon.dead || demon.frozen) return; // frozen already stops fully
    demon.slowed = true;
    demon.slowTimer = duration;
    demon.slowedSpeed = demon.speed * speedMult;
    demon.currentSpeed = demon.slowedSpeed;
    demon.el.classList.add("slowed");
  }
  return {
    init,
    spawn,
    update,
    damage,
    kill,
    freeze,
    slow,
    getActive,
    getAll,
    getCount,
    isDemonInRow,
    clear,
    setArenaRect,
  };
})();
