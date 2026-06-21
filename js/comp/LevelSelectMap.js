/* ══════════════════════════════════════════════════
   js/comp/LevelSelectMap.js  — PvZClassic
   Floating-island winding-path level select map.
   Replaces buildLevelGrid() in ui.js.
   Zero core-logic changes — only reads Player / Levels.
══════════════════════════════════════════════════ */

const LevelSelectMap = (() => {

  /* ── Path shape: percentage positions on the canvas ──
     Each entry = { x: 0-100, y: 0-100 } relative to the
     scrollable canvas so it works at any screen size.
     30 waypoints trace a snake across the floating island. */
  const PATH_POINTS = [
    // Row 1 — left to right (bottom of island)
    { x:  4, y: 78 },
    { x: 12, y: 72 },
    { x: 20, y: 68 },
    { x: 28, y: 64 },
    { x: 36, y: 60 },
    // curve up through centre-left
    { x: 42, y: 52 },
    { x: 38, y: 42 },
    { x: 32, y: 35 },
    { x: 28, y: 27 },
    { x: 34, y: 20 },
    // Row 2 — right across upper island
    { x: 42, y: 16 },
    { x: 50, y: 18 },
    { x: 58, y: 22 },
    { x: 64, y: 28 },
    { x: 68, y: 36 },
    // drop down right side
    { x: 72, y: 44 },
    { x: 76, y: 52 },
    { x: 80, y: 60 },
    { x: 76, y: 68 },
    { x: 70, y: 74 },
    // last cluster — bottom-right
    { x: 64, y: 80 },
    { x: 72, y: 84 },
    { x: 80, y: 80 },
    { x: 86, y: 74 },
    { x: 88, y: 66 },
    { x: 90, y: 58 },
    { x: 88, y: 48 },
    { x: 84, y: 40 },
    { x: 88, y: 30 },
    { x: 93, y: 22 },
  ];

  /* Canvas logical size (px) — wide enough to hold the island.
     We scale this to fill the screen height while keeping aspect. */
  const CANVAS_W = 1400;
  const CANVAS_H = 600;

  /* ── Internal state ── */
  let _container = null;   // #levels-grid element
  let _worldId   = 1;
  let _onOpen    = null;   // callback(worldId, levelIdx)

  /* ── Public: init ──────────────────────────────── */
  function init(containerId, onLevelOpen) {
    _container = document.getElementById(containerId);
    _onOpen    = onLevelOpen;
  }

  /* ── Public: render(worldId) ───────────────────── */
  function render(worldId) {
    if (!_container) return;
    _worldId = worldId;

    const world = Levels.getWorld(worldId);
    if (!world) return;

    /* Clear */
    _container.innerHTML = '';
    _container.className = `lsm-container world-theme-${worldId}`;

    /* Which level is current (first incomplete unlocked) */
    let currentIdx = -1;
    for (let i = 0; i < world.levelCount; i++) {
      const unlocked = Player.isLevelUnlocked(worldId, i) || (worldId === 1 && i === 0);
      if (unlocked && Player.getLevelStars(worldId, i) === 0) {
        currentIdx = i;
        break;
      }
    }
    if (currentIdx === -1) currentIdx = world.levelCount - 1;

    /* ── Outer scroll wrapper ── */
    const scroll = document.createElement('div');
    scroll.className = 'lsm-scroll';
    _container.appendChild(scroll);

    /* ── Canvas div (sized to CANVAS_W × CANVAS_H, scaled via CSS) ── */
    const canvas = document.createElement('div');
    canvas.className = 'lsm-canvas';
    canvas.style.width  = CANVAS_W + 'px';
    canvas.style.height = CANVAS_H + 'px';
    scroll.appendChild(canvas);

    /* ── Background island image ── */
    const bgImg = document.createElement('div');
    bgImg.className = 'lsm-island-bg';
    bgImg.style.backgroundImage =
      "url('assets/worlds/world" + worldId + "/map_island.png')," +
      "url('assets/worlds/world1/map_island.png')";   // fallback to w1
    canvas.appendChild(bgImg);

    /* ── SVG path connector ── */
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${CANVAS_W} ${CANVAS_H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.className = 'lsm-svg';
    canvas.appendChild(svg);

    /* Draw path segments */
    const count = Math.min(world.levelCount, PATH_POINTS.length);
    for (let i = 1; i < count; i++) {
      const prev = _toAbs(PATH_POINTS[i - 1]);
      const curr = _toAbs(PATH_POINTS[i]);

      const prevDone = Player.getLevelStars(worldId, i - 1) > 0;
      const currDone = Player.getLevelStars(worldId, i) > 0;
      const isCurr   = i === currentIdx;

      let stroke = 'rgba(255,255,255,0.18)';
      if (prevDone && currDone) stroke = '#22c55e';
      else if (prevDone && isCurr) stroke = '#3b82f6';

      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d',
        `M${prev.x},${prev.y} C${mx},${prev.y} ${mx},${curr.y} ${curr.x},${curr.y}`);
      path.setAttribute('stroke', stroke);
      path.setAttribute('stroke-width', '8');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      if (!prevDone && !isCurr)
        path.setAttribute('stroke-dasharray', '12 8');

      /* Glow on completed segments */
      if (prevDone) {
        path.style.filter = 'drop-shadow(0 0 4px ' + stroke + ')';
      }

      svg.appendChild(path);
    }

    /* ── Level nodes (stone slabs) ── */
    for (let i = 0; i < count; i++) {
      const pt      = _toAbs(PATH_POINTS[i]);
      const unlocked = Player.isLevelUnlocked(worldId, i) || (worldId === 1 && i === 0);
      const stars    = Player.getLevelStars(worldId, i);
      const isDone   = stars > 0;
      const isCurrent = i === currentIdx;
      const isLocked  = !unlocked && !isCurrent;
      const isElite   = (i + 1) % 5 === 0;

      const node = document.createElement('div');
      node.className = [
        'lsm-node',
        isDone    ? 'lsm-done'    : '',
        isCurrent ? 'lsm-current' : '',
        isLocked  ? 'lsm-locked'  : '',
        isElite   ? 'lsm-elite'   : '',
      ].filter(Boolean).join(' ');

      /* Position: centred on path point */
      node.style.left = pt.x + 'px';
      node.style.top  = pt.y + 'px';

      /* Inner markup */
      node.innerHTML = _nodeHTML(i, { isDone, isCurrent, isLocked, isElite, stars, worldId });

      /* Click */
      if (!isLocked) {
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          if (_onOpen) _onOpen(worldId, i);
        });
      }

      canvas.appendChild(node);
    }

    /* ── Auto-scroll to current level ── */
    setTimeout(() => {
      if (currentIdx >= 0 && currentIdx < PATH_POINTS.length) {
        const pt = _toAbs(PATH_POINTS[currentIdx]);
        const scrollTarget = Math.max(0, pt.x - scroll.clientWidth / 2);
        scroll.scrollTo({ left: scrollTarget, behavior: 'smooth' });
      }
    }, 350);

    /* ── Drag-to-scroll (touch + mouse) ── */
    _attachDrag(scroll);
  }

  /* ── Helper: % → absolute px on canvas ── */
  function _toAbs(pt) {
    return {
      x: (pt.x / 100) * CANVAS_W,
      y: (pt.y / 100) * CANVAS_H,
    };
  }

  /* ── Helper: build node inner HTML ── */
  function _nodeHTML(i, { isDone, isCurrent, isLocked, isElite, stars, worldId }) {
    /* Stars row */
    let starsRow = '';
    if (isDone) {
      starsRow = '<div class="lsm-stars">' +
        '⭐'.repeat(stars) + '☆'.repeat(3 - stars) +
        '</div>';
    } else if (isCurrent) {
      starsRow = '<div class="lsm-arrow">▼</div>';
    }

    /* Label inside slab */
    let label;
    if (isLocked)       label = '🔒';
    else if (isElite)   label = '⚔️';
    else                label = String(i + 1);

    /* Optional reward badge */
    const plantRew = Levels.PLANT_UNLOCKS.find(u => u.worldId === worldId && u.levelIdx === i);
    const mgRew    = Levels.MINIGAME_UNLOCKS.find(u => u.worldId === worldId && u.levelIdx === i);
    const badge    = plantRew ? '<div class="lsm-badge">🌿</div>'
                   : mgRew   ? '<div class="lsm-badge">🎮</div>'
                   : '';

    return `
      ${badge}
      <div class="lsm-slab">
        <span class="lsm-num">${label}</span>
      </div>
      ${starsRow}
    `;
  }

  /* ── Drag scroll ── */
  function _attachDrag(el) {
    let dragging = false, startX = 0, scrollX = 0;

    el.addEventListener('mousedown', e => {
      dragging = true;
      startX   = e.clientX;
      scrollX  = el.scrollLeft;
      el.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      el.scrollLeft = scrollX - (e.clientX - startX);
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
      el.style.cursor = 'grab';
    });
    el.addEventListener('touchstart', e => {
      startX  = e.touches[0].clientX;
      scrollX = el.scrollLeft;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      el.scrollLeft = scrollX - (e.touches[0].clientX - startX);
    }, { passive: true });
  }

  return { init, render };

})();
