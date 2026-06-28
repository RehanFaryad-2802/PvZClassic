/* js/grid.js
   Enhanced 5×9 battle grid.
   ─ World-themed tile visuals per world (1-10)
   ─ Ground type system: normal / water / lava / mud / crystal / neon / ice / dark / cloud / sky
   ─ Special cell types: sun_boost, plant_boost, demon_slow, trap, shield
   ─ Per-cell hover glow matching world palette
   ─ Depth overlay (bottom rows darker for perspective)
   ─ Lava cells pulse & damage demons over time
   ─ Ice cells slow demons that walk through
   ─ Mud cells slow all entities
   ─ Crystal cells amplify projectile damage
   ─ Neon cells boost electric plants
   ─ Cloud cells give plants brief invincibility frames
   ─ Dark cells reduce sun generation
   ─ Danger zone flash (col 0-1) warning when demons approach
   ─ Plant placement bounce + sparkle
   ─ Shovel red glow cursor
*/

const Grid = (() => {
  // ── Dimensions ─────────────────────────────────
  const ROWS = 5;
  const COLS = 9;

  // ── Key-Value Config (tune all behaviour here) ──
  const CFG = {
    // Ground effect strengths
    LAVA_TICK_MS:        1200,   // how often lava damages demons (ms)
    LAVA_DAMAGE:         8,      // damage per lava tick
    ICE_SLOW_FACTOR:     0.55,   // demon speed multiplier on ice tiles
    ICE_SLOW_DURATION:   3000,   // ms the slow lasts after leaving ice
    MUD_SLOW_FACTOR:     0.70,   // demon speed on mud
    CRYSTAL_DMG_BONUS:   0.25,   // +25% projectile damage through crystal
    NEON_FIRE_BONUS:     0.30,   // +30% electric plant fire rate on neon
    CLOUD_INVINCIBILITY: 600,    // ms plant is invincible after being placed on cloud
    DARK_SUN_PENALTY:    0.5,    // sun drops worth 50% on dark tiles

    // Visual
    DANGER_COLS:         [0, 1], // columns that flash when demons are close
    DEPTH_ROWS:          [3, 4], // bottom rows get a dark overlay for perspective
    DEPTH_OPACITY:       0.18,   // how dark the depth overlay is
    HOVER_ALPHA:         0.22,   // cell hover highlight alpha
    PLACE_SPARKLE_COUNT: 8,      // sparkle particles on plant placement
    PLACE_SPARKLE_MS:    500,    // sparkle lifetime

    // Special cell spawn rates (per-world) — probability out of 1
    SPECIAL_CELL_CHANCE: 0.08,   // 8% of cells get a special type per battle
  };

  // ── World Themes ────────────────────────────────
  // Each world defines: tileA, tileB (checkerboard colours),
  // borderColor, groundType, hoverColor, depthColor
  const WORLD_THEMES = {
    1:  { // Inferno Fields
      tileA:      'rgba(44,120,44,0.50)',
      tileB:      'rgba(22,78,22,0.50)',
      border:     'rgba(0,0,0,0.18)',
      groundType: 'normal',
      hover:      'rgba(34,197,94,CFG_ALPHA)',
      depthColor: 'rgba(0,30,0,CFG_DEPTH)',
      accent:     '#22c55e',
    },
    2:  { // Frozen Wastes
      tileA:      'rgba(120,180,240,0.40)',
      tileB:      'rgba(60,110,190,0.40)',
      border:     'rgba(180,230,255,0.15)',
      groundType: 'ice',
      hover:      'rgba(103,232,249,CFG_ALPHA)',
      depthColor: 'rgba(0,10,40,CFG_DEPTH)',
      accent:     '#67e8f9',
    },
    3:  { // Iron Fortress
      tileA:      'rgba(90,90,100,0.50)',
      tileB:      'rgba(50,50,60,0.50)',
      border:     'rgba(160,160,180,0.12)',
      groundType: 'normal',
      hover:      'rgba(200,200,220,CFG_ALPHA)',
      depthColor: 'rgba(0,0,10,CFG_DEPTH)',
      accent:     '#94a3b8',
    },
    4:  { // Shadow Realm
      tileA:      'rgba(70,0,90,0.55)',
      tileB:      'rgba(25,0,35,0.55)',
      border:     'rgba(168,85,247,0.12)',
      groundType: 'dark',
      hover:      'rgba(168,85,247,CFG_ALPHA)',
      depthColor: 'rgba(10,0,20,CFG_DEPTH)',
      accent:     '#a855f7',
    },
    5:  { // Cyber Neon
      tileA:      'rgba(0,30,60,0.55)',
      tileB:      'rgba(0,10,30,0.55)',
      border:     'rgba(0,255,200,0.15)',
      groundType: 'neon',
      hover:      'rgba(0,255,180,CFG_ALPHA)',
      depthColor: 'rgba(0,5,20,CFG_DEPTH)',
      accent:     '#00ffb4',
    },
    6:  { // Jungle Abyss
      tileA:      'rgba(10,60,20,0.55)',
      tileB:      'rgba(5,30,10,0.55)',
      border:     'rgba(34,197,94,0.10)',
      groundType: 'mud',
      hover:      'rgba(74,222,128,CFG_ALPHA)',
      depthColor: 'rgba(0,20,5,CFG_DEPTH)',
      accent:     '#4ade80',
    },
    7:  { // Ice Age
      tileA:      'rgba(180,220,255,0.35)',
      tileB:      'rgba(100,160,230,0.35)',
      border:     'rgba(200,240,255,0.20)',
      groundType: 'ice',
      hover:      'rgba(224,242,254,CFG_ALPHA)',
      depthColor: 'rgba(0,20,50,CFG_DEPTH)',
      accent:     '#e0f2fe',
    },
    8:  { // Spooky Mansion
      tileA:      'rgba(30,20,40,0.60)',
      tileB:      'rgba(15,10,20,0.60)',
      border:     'rgba(255,200,0,0.10)',
      groundType: 'dark',
      hover:      'rgba(251,191,36,CFG_ALPHA)',
      depthColor: 'rgba(5,0,10,CFG_DEPTH)',
      accent:     '#fbbf24',
    },
    9:  { // Crystal Caverns
      tileA:      'rgba(140,200,255,0.38)',
      tileB:      'rgba(80,140,220,0.38)',
      border:     'rgba(200,240,255,0.18)',
      groundType: 'crystal',
      hover:      'rgba(186,230,253,CFG_ALPHA)',
      depthColor: 'rgba(10,30,60,CFG_DEPTH)',
      accent:     '#bae6fd',
    },
    10: { // Sky Castle
      tileA:      'rgba(200,220,255,0.30)',
      tileB:      'rgba(150,180,240,0.30)',
      border:     'rgba(255,255,255,0.14)',
      groundType: 'cloud',
      hover:      'rgba(255,255,255,CFG_ALPHA)',
      depthColor: 'rgba(100,120,200,CFG_DEPTH)',
      accent:     '#ffffff',
    },
  };

  // ── Special Cell Types ──────────────────────────
  // Each type has a visual badge and gameplay effect

  // ── State ───────────────────────────────────────
  let grid         = [];       // grid[r][c] = null | plantData
  let cellMeta     = [];       // cellMeta[r][c] = { groundType, specialType, el }
  let gridContainer = null;
  let shovelActive  = false;
  let currentWorld  = 1;
  let dangerActive  = false;   // true when demons are in danger cols
  let lavaTimer     = 0;

  // ── Init ────────────────────────────────────────
  function init(containerEl, worldId = 1) {
    gridContainer = containerEl;
    gridContainer.innerHTML = '';
    grid     = [];
    cellMeta = [];
    currentWorld = worldId || currentWorld;

    const theme = getTheme();

    // World class on container for CSS hooks
    gridContainer.className = gridContainer.className
      .replace(/\bworld-grid-\d+\b/g, '');
    gridContainer.classList.add('world-grid-' + currentWorld);

    for (let r = 0; r < ROWS; r++) {
      grid[r]     = [];
      cellMeta[r] = [];

      const rowEl = document.createElement('div');
      rowEl.className = 'grid-row';
      rowEl.dataset.row = r;

      for (let c = 0; c < COLS; c++) {
        grid[r][c]     = null;
        const isAlt    = (r + c) % 2 === 0;
        const isDepth  = CFG.DEPTH_ROWS.includes(r);

        // Decide ground type & special for this cell
        const groundType = resolveGroundType(r, c, theme.groundType);

        const cell = document.createElement('div');
        cell.className   = 'grid-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        // ── Base tile colour (checkerboard) ──
        cell.style.background = isAlt ? theme.tileA : theme.tileB;
        cell.style.borderColor = theme.border;

        // ── Ground type overlay ──
        applyGroundStyle(cell, groundType, r, c, theme);

        // ── Depth overlay (perspective shading) ──
        if (isDepth) {
          const depthEl = document.createElement('div');
          depthEl.className = 'cell-depth-overlay';
          depthEl.style.cssText = `
            position:absolute;inset:0;pointer-events:none;z-index:1;
            background:${theme.depthColor.replace('CFG_DEPTH', CFG.DEPTH_OPACITY + (r === 4 ? 0.10 : 0))};
          `;
          cell.appendChild(depthEl);
        }

       

        // ── Hover events ──
        cell.addEventListener('mouseenter', () => onCellHover(cell, r, c, theme, true));
        cell.addEventListener('mouseleave', () => onCellHover(cell, r, c, theme, false));
        cell.addEventListener('click',      () => onCellClick(r, c));
        cell.addEventListener('touchstart', (e) => { onCellClick(r, c); }, { passive: true });

        rowEl.appendChild(cell);

      }

      gridContainer.appendChild(rowEl);
    }

    lavaTimer = 0;
  }

  // ── Theme helpers ───────────────────────────────
  function getTheme(worldId) {
    const id = worldId || currentWorld;
    return WORLD_THEMES[id] || WORLD_THEMES[1];
  }

  function resolveGroundType(r, c, base) {
    // Special column overrides for dramatic effect
    if (c <= 1 && base === 'lava')    return 'lava';   // front lava crack
    if (c >= 7 && base === 'ice')     return 'ice';    // back ice wall
    return base;
  }

  function rollSpecialCell(r, c) {
    // Column 0 never has specials (lawnmower zone)
    if (c === 0) return null;
    // Seeded random so it's consistent per battle but varied
    const seed = (r * 31 + c * 17 + currentWorld * 7) % 100;
    const chance = CFG.SPECIAL_CELL_CHANCE * 100;
    if (seed >= chance) return null;
    // Pick a special type based on seed
    return types[seed % types.length];
  }

  function applyGroundStyle(cell, groundType, r, c, theme) {
    let overlay = '';
    switch (groundType) {
      case 'lava':
        overlay = 'linear-gradient(180deg,rgba(180,30,0,0.28) 0%,rgba(255,80,0,0.18) 100%)';
        cell.classList.add('ground-lava');
        break;
      case 'ice':
        overlay = 'linear-gradient(180deg,rgba(180,240,255,0.22) 0%,rgba(100,200,255,0.12) 100%)';
        cell.classList.add('ground-ice');
        break;
      case 'mud':
        overlay = 'linear-gradient(180deg,rgba(80,50,20,0.30) 0%,rgba(50,30,10,0.20) 100%)';
        cell.classList.add('ground-mud');
        break;
      case 'crystal':
        overlay = 'linear-gradient(135deg,rgba(180,220,255,0.25) 0%,rgba(100,180,255,0.15) 100%)';
        cell.classList.add('ground-crystal');
        break;
      case 'neon':
        overlay = 'linear-gradient(180deg,rgba(0,200,160,0.18) 0%,rgba(0,100,80,0.10) 100%)';
        cell.classList.add('ground-neon');
        break;
      case 'dark':
        overlay = 'linear-gradient(180deg,rgba(20,0,40,0.35) 0%,rgba(5,0,10,0.25) 100%)';
        cell.classList.add('ground-dark');
        break;
      case 'cloud':
        overlay = 'linear-gradient(180deg,rgba(255,255,255,0.20) 0%,rgba(200,210,255,0.10) 100%)';
        cell.classList.add('ground-cloud');
        break;
      default:
        overlay = '';
    }

    if (overlay) {
      // Stack on top of base tile colour
      cell.style.backgroundImage = overlay;
    }
  }


  // ── Hover glow ──────────────────────────────────
  function onCellHover(cell, r, c, theme, entering) {
    if (grid[r][c]) return; // occupied — no hover
    const accentRaw = theme.accent || '#22c55e';
    if (entering) {
      cell.style.boxShadow = `inset 0 0 0 2px ${accentRaw}55, 0 0 10px ${accentRaw}33`;
      cell.style.transition = 'box-shadow 0.12s';
    } else {
      cell.style.boxShadow = '';
    }
  }

  // ── Cell click ──────────────────────────────────
  function onCellClick(row, col) {
    if (shovelActive) {
      removePlant(row, col);
      return;
    }
    if (typeof Core !== 'undefined') {
      Core.onCellClick(row, col);
    }
  }

  // ── getCellEl ───────────────────────────────────
  function getCellEl(row, col) {
    if (!gridContainer) return null;
    return gridContainer.querySelector(
      `.grid-cell[data-row="${row}"][data-col="${col}"]`
    );
  }

  // ── Place plant ─────────────────────────────────
  function placePlant(row, col, plantDef) {
    if (grid[row][col]) return false;

    const cell = getCellEl(row, col);
    if (!cell) return false;

    let img;
    if (plantDef.video) {
      img = document.createElement('video');
      img.src          = plantDef.video;
      img.autoplay     = true;
      img.loop         = true;
      img.muted        = true;
      img.playsInline  = true;
      img.className    = 'plant-entity plant-video';
      img.style.mixBlendMode = 'normal';
    } else {
      img = document.createElement('img');
      img.className   = 'plant-entity';
      img.src         = plantDef.image;
      img.alt         = plantDef.name;
      img.draggable   = false;
    }

    // HP bar
    const hpBarWrap = document.createElement('div');
    hpBarWrap.className = 'plant-hp-bar';
    const hpFill = document.createElement('div');
    hpFill.className    = 'plant-hp-fill';
    hpFill.style.width  = '100%';
    hpBarWrap.appendChild(hpFill);

    cell.classList.add('occupied');
    cell.appendChild(img);
    cell.appendChild(hpBarWrap);

    const meta = cellMeta[row] && cellMeta[row][col];
    const special = meta ? meta.special : null;

    const plantData = {
      plantId:     plantDef.id,
      element:     img,
      hpBar:       hpFill,
      hp:          plantDef.hp,
      maxHp:       plantDef.hp,
      level:       plantDef.level || 1,
      frozen:      false,
      frozenTimer: 0,
      shaking:     false,
      row, col,
      videoIdle:   plantDef.video       || null,
      videoAttack: plantDef.videoAttack || null,
      videoDamage: plantDef.videoDamage || null,
      // Special cell effects
      cellSpecial:    special,
      groundType:     meta ? meta.groundType : 'normal',
      damageBonus:    special === 'plant_boost' ? 0.20
                    : special === 'crystal'     ? CFG.CRYSTAL_DMG_BONUS
                    : 0,
      invincible:     false,
      invincibleTimer: 0,
      shieldHit:      special === 'shield' ? 1 : 0, // absorb hits
    };

    grid[row][col] = plantData;

    // Cloud: brief invincibility on placement
    if (plantData.groundType === 'cloud' || special === 'cloud') {
      plantData.invincible      = true;
      plantData.invincibleTimer = CFG.CLOUD_INVINCIBILITY;
      img.classList.add('plant-invincible');
    }

    // Sparkle effect
    spawnPlacementSparkle(cell, getTheme().accent);

    if (typeof PlantRegistry !== 'undefined') {
      PlantRegistry.onPlace(plantDef.id, row, col, plantData);
    }

    return true;
  }

  // ── Placement sparkle ───────────────────────────
  function spawnPlacementSparkle(cell, color) {
    const rect = cell.getBoundingClientRect();
    const effectsEl = document.getElementById('effects-layer');
    if (!effectsEl) return;

    const eRect = effectsEl.getBoundingClientRect();
    const cx    = rect.left - eRect.left + rect.width  / 2;
    const cy    = rect.top  - eRect.top  + rect.height / 2;

    for (let i = 0; i < CFG.PLACE_SPARKLE_COUNT; i++) {
      const spark = document.createElement('div');
      spark.style.cssText = `
        position:absolute;
        width:5px;height:5px;border-radius:50%;
        background:${color || '#22c55e'};
        left:${cx}px;top:${cy}px;
        pointer-events:none;z-index:60;
        box-shadow:0 0 6px ${color || '#22c55e'};
        transition:transform ${CFG.PLACE_SPARKLE_MS}ms ease-out,opacity ${CFG.PLACE_SPARKLE_MS}ms ease-out;
      `;
      effectsEl.appendChild(spark);

      const angle = (i / CFG.PLACE_SPARKLE_COUNT) * Math.PI * 2;
      const dist  = 28 + Math.random() * 22;
      const dx    = Math.cos(angle) * dist;
      const dy    = Math.sin(angle) * dist;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          spark.style.transform = `translate(${dx}px,${dy}px) scale(0)`;
          spark.style.opacity   = '0';
        });
      });

      setTimeout(() => spark.remove(), CFG.PLACE_SPARKLE_MS + 50);
    }
  }

  // ── Remove plant ────────────────────────────────
  function removePlant(row, col) {
    const p = grid[row][col];
    if (!p) return;

    if (shovelActive && typeof SoundFX !== 'undefined') {
      SoundFX.play('plant_remove');
    }

    if (typeof PlantRegistry !== 'undefined') {
      PlantRegistry.onRemove(p.plantId, row, col);
    }

    const cell = getCellEl(row, col);
    if (cell) {
      cell.classList.remove('occupied','selected','plant-selected','active','highlighted');
      cell.innerHTML = '';
      // Re-add ground overlays & special badge (they were in innerHTML)
      const meta = cellMeta[row] && cellMeta[row][col];
      if (meta) {
        applyGroundStyle(cell, meta.groundType, row, col, getTheme());
        if (meta.special) addSpecialBadge(cell, meta.special);
      }
    }

    grid[row][col] = null;

    if (shovelActive) {
      setShovel(false);
      if (typeof UI !== 'undefined') {
        UI.setShovelActive(false);
        UI.setSelectedTrayCard(null);
      }
    }
  }

  // ── Accessors ───────────────────────────────────
  function getPlant(row, col) {
    return (row >= 0 && row < ROWS && col >= 0 && col < COLS)
      ? grid[row][col] : null;
  }

  function getFirstPlantInRow(row, fromCol) {
    if (!grid[row]) return null;
    const safeCol = Math.min(Math.max(0, fromCol), COLS - 1);
    for (let c = safeCol; c >= 0; c--) {
      if (grid[row][c]) return { col: c, plant: grid[row][c] };
    }
    return null;
  }

  function getPlantsInRow(row) {
    const plants = [];
    if (!grid[row]) return plants;
    for (let c = 0; c < COLS; c++) {
      if (grid[row][c]) plants.push({ col: c, plant: grid[row][c] });
    }
    return plants;
  }

  // ── Damage plant ────────────────────────────────
  function damagePlant(row, col, amount) {
    if (!grid[row]) return false;
    const p = grid[row][col];
    if (!p) return false;

    // Shield absorbs 1 hit completely
    if (p.shieldHit > 0) {
      p.shieldHit--;
      // Visual shield pop
      if (p.element) {
        p.element.classList.add('plant-shield-pop');
        setTimeout(() => p.element && p.element.classList.remove('plant-shield-pop'), 400);
      }
      return false;
    }

    // Invincibility (cloud tiles)
    if (p.invincible) return false;

    p.hp = Math.max(0, p.hp - amount);
    const pct = p.hp / p.maxHp;

    if (p.hpBar) {
      p.hpBar.style.width     = (pct * 100) + '%';
      p.hpBar.className = 'plant-hp-fill' +
        (pct <= 0.25 ? ' low' : pct <= 0.5 ? ' mid' : '');
    }

    if (typeof PlantRegistry !== 'undefined') {
      PlantRegistry.onDamage(p.plantId, row, col, p);
    }
    if (typeof SoundFX !== 'undefined') SoundFX.play('plant_hurt');

    if (!p.shaking && p.element) {
      p.shaking = true;
      p.element.classList.add('shaking');
      if (p.element.tagName === 'VIDEO' && p.videoDamage) {
        p.element.src = p.videoDamage;
        p.element.play();
      }
    }

    if (p.hp <= 0) {
      if (p.shaking && p.element) {
        p.shaking = false;
        p.element.classList.remove('shaking');
      }
      removePlant(row, col);
      return true;
    }
    return false;
  }

  function stopShaking(row, col) {
    const p = grid[row][col];
    if (p && p.shaking && p.element) {
      p.shaking = false;
      p.element.classList.remove('shaking');
      if (p.element.tagName === 'VIDEO' && p.videoIdle) {
        p.element.src = p.videoIdle;
        p.element.play();
      }
    }
  }

  // ── Freeze / slow ───────────────────────────────
  function freezePlant(row, col, duration) {
    const p = grid[row][col];
    if (!p) return;
    p.frozen      = true;
    p.frozenTimer = duration;
  }

  function updateFreezeTimers(dt) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = grid[r][c];
        if (!p) continue;

        // Freeze timer
        if (p.frozen) {
          p.frozenTimer -= dt * 1000;
          if (p.frozenTimer <= 0) {
            p.frozen      = false;
            p.frozenTimer = 0;
          }
        }

        // Invincibility timer (cloud)
        if (p.invincible) {
          p.invincibleTimer -= dt * 1000;
          if (p.invincibleTimer <= 0) {
            p.invincible = false;
            if (p.element) p.element.classList.remove('plant-invincible');
          }
        }
      }
    }
  }

  // ── Ground effects tick ─────────────────────────
  // Called from Core game loop each frame
  function updateGroundEffects(dt, demons) {
    lavaTimer += dt * 1000;

    if (lavaTimer >= CFG.LAVA_TICK_MS) {
      lavaTimer = 0;
      // Damage demons standing on lava cells
      if (demons && typeof demons.getAll === 'function') {
        demons.getAll().forEach(demon => {
          const col = demonToCol(demon);
          const r   = demon.row;
          if (col < 0 || col >= COLS) return;
          const meta = cellMeta[r] && cellMeta[r][col];
          if (meta && (meta.groundType === 'lava' || meta.special === 'lava')) {
            demons.applyDirectDamage(demon, CFG.LAVA_DAMAGE, 'fire');
          }
        });
      }
    }

    // Ice / mud / demon_slow cell effects applied in Demons.update via getGroundModifier
  }

  // ── Ground modifier for a demon at pixel X ──────
  // Called by Demons module each tick
  function getGroundModifier(row, pixelX, arenaWidth) {
    if (!arenaWidth) return { speedMult: 1 };
    const col = Math.floor((pixelX / arenaWidth) * COLS);
    if (col < 0 || col >= COLS) return { speedMult: 1 };
    const meta = cellMeta[row] && cellMeta[row][col];
    if (!meta) return { speedMult: 1 };

    if (meta.groundType === 'ice')         return { speedMult: CFG.ICE_SLOW_FACTOR };
    if (meta.groundType === 'mud')         return { speedMult: CFG.MUD_SLOW_FACTOR };
    if (meta.special    === 'demon_slow')  return { speedMult: 0.70 };
    return { speedMult: 1 };
  }

  // ── Projectile damage bonus from crystal cells ──
  function getProjectileBonus(row, fromCol) {
    // Check all cells the projectile will fly through
    let bonus = 0;
    for (let c = fromCol; c < COLS; c++) {
      const meta = cellMeta[row] && cellMeta[row][c];
      if (meta && (meta.groundType === 'crystal' || meta.special === 'crystal')) {
        bonus = Math.max(bonus, CFG.CRYSTAL_DMG_BONUS);
      }
    }
    return bonus;
  }

  // ── Neon boost for electric plants ─────────────
  function getNeonFireBonus(row, col) {
    const meta = cellMeta[row] && cellMeta[row][col];
    if (!meta) return 0;
    if (meta.groundType === 'neon' || meta.special === 'neon') {
      return CFG.NEON_FIRE_BONUS;
    }
    return 0;
  }

  // ── Sun boost multiplier for sky drops ──────────
  function getSunBoostAt(row, col) {
    const meta = cellMeta[row] && cellMeta[row][col];
    if (!meta) return 1;
    if (meta.special === 'sun_boost') return 1.5;
    if (meta.groundType === 'dark')   return CFG.DARK_SUN_PENALTY;
    return 1;
  }

  // ── Danger zone flash ───────────────────────────
  function setDangerZone(active) {
    if (dangerActive === active) return;
    dangerActive = active;
    if (!gridContainer) return;
    CFG.DANGER_COLS.forEach(c => {
      for (let r = 0; r < ROWS; r++) {
        const cell = getCellEl(r, c);
        if (cell) {
          if (active) cell.classList.add('grid-cell-danger');
          else        cell.classList.remove('grid-cell-danger');
        }
      }
    });
  }

  // ── Utility ─────────────────────────────────────
  function demonToCol(demon) {
    // Approximate column from demon pixel x position
    // This requires arenaWidth; falls back to 0 if not available
    if (!demon || demon.x === undefined) return -1;
    const arena = document.getElementById('grid-container');
    if (!arena) return -1;
    const w = arena.getBoundingClientRect().width;
    return Math.floor((demon.x / w) * COLS);
  }

  function isOccupied(row, col) {
    if (!grid[row]) return false;
    return grid[row][col] !== null;
  }

  function setShovel(active) {
    shovelActive = active;
    if (!gridContainer) return;
    gridContainer.querySelectorAll('.grid-cell').forEach(cell => {
      if (active) cell.classList.add('shovel-hover');
      else        cell.classList.remove('shovel-hover');
    });
  }

  function isShovelActive() { return shovelActive; }

  function setWorld(worldId) {
    currentWorld = worldId;
  }

  function clear() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r] && grid[r][c]) removePlant(r, c);
      }
    }
    shovelActive = false;
    dangerActive = false;
    lavaTimer    = 0;
  }

  function getGrid()  { return grid; }
  function getRows()  { return ROWS; }
  function getCols()  { return COLS; }
  function getCellMeta(r, c) { return (cellMeta[r] && cellMeta[r][c]) || null; }

  // ── Public API ──────────────────────────────────
  return {
    init,
    setWorld,
    placePlant,
    removePlant,
    getPlant,
    getFirstPlantInRow,
    getPlantsInRow,
    damagePlant,
    stopShaking,
    freezePlant,
    updateFreezeTimers,
    updateGroundEffects,
    getGroundModifier,
    getProjectileBonus,
    getNeonFireBonus,
    getSunBoostAt,
    setDangerZone,
    isOccupied,
    setShovel,
    isShovelActive,
    clear,
    getGrid,
    getRows,
    getCols,
    getCellEl,
    getCellMeta,
    CFG,
    WORLD_THEMES,
  };
})();
