/* ══════════════════════════════════════════════════
   js/comp/LevelSelectMap.js  — PvZClassic
   Floating-island level select map.
   Island image fills screen height, scrolls horizontally.
   Nodes positioned as % of the RENDERED image size.
══════════════════════════════════════════════════ */

const LevelSelectMap = (() => {

  /* ── Node positions as % of the island image's rendered size ──
     Traced from the actual screenshot with numbered slabs.
     x=0 is left edge of image, x=100 is right edge.
     y=0 is top edge of image,  y=100 is bottom edge.        */
  const PATH_POINTS = [
    { x: 24.5, y: 44,  w: 32 },  //  1
    { x: 27.4, y: 51,  w: 30 },  //  2
    { x: 24.3, y: 56,  w: 28 },  //  3
    { x: 22,   y: 62,  w: 28 },  //  4
    { x: 24,   y: 72,  w: 30 },  //  5
    { x: 30,   y: 78,  w: 30 },  //  6
    { x: 36,   y: 78,  w: 32 },  //  7
    { x: 41.2, y: 73,  w: 34 },  //  8
    { x: 45.8, y: 64,  w: 30 },  //  9
    { x: 47,   y: 54,  w: 28 },  // 10
    { x: 45,   y: 77,  w: 36 },  // 11
    { x: 50.4, y: 77,  w: 32 },  // 12
    { x: 54.6, y: 75,  w: 30 },  // 13
    { x: 59.2, y: 71,  w: 36 },  // 14
    { x: 63,   y: 62,  w: 30 },  // 15
    { x: 60,   y: 57,  w: 28 },  // 16
    { x: 56.5, y: 53,  w: 30 },  // 17
    { x: 66.7, y: 77,  w: 35 },  // 18
    { x: 72.5, y: 81,  w: 30 },  // 19
    { x: 79,   y: 77,  w: 30 },  // 20
    { x: 82,   y: 66,  w: 30 },  // 21
    { x: 76.7, y: 61,  w: 29 },  // 22
    { x: 70.6, y: 54,  w: 30 },  // 23
    { x: 63.4, y: 51,  w: 30 },  // 24
    { x: 72,   y: 46,  w: 32 },  // 25
    { x: 75,   y: 41,  w: 30 },  // 26
    { x: 40.2, y: 52,  w: 31 },  // 27
    { x: 38,   y: 41,  w: 28 },  // 28
    { x: 46,   y: 36,  w: 28 },  // 29
    { x: 78.2, y: 33,  w: 42 },  // 30
  ];

  /* Island image natural aspect ratio (width / height).
     Your image is landscape — adjust if different.
     1782×742 ≈ 2.4 — measure your actual image if needed. */
  const ISLAND_ASPECT = 2.4;

  let _container = null;
  let _worldId   = 1;
  let _onOpen    = null;

  /* ── Public ── */
  function init(containerId, onLevelOpen) {
    _container = document.getElementById(containerId);
    _onOpen    = onLevelOpen;
  }

  function render(worldId) {
    if (!_container) return;
    _worldId = worldId;

    const world = Levels.getWorld(worldId);
    if (!world) return;

    _container.innerHTML = '';
    _container.className = `lsm-container world-theme-${worldId}`;

    /* Current level */
    let currentIdx = -1;
    for (let i = 0; i < world.levelCount; i++) {
      const unlocked = Player.isLevelUnlocked(worldId, i) || (worldId === 1 && i === 0);
      if (unlocked && Player.getLevelStars(worldId, i) === 0) { currentIdx = i; break; }
    }
    if (currentIdx === -1) currentIdx = world.levelCount - 1;

    /* ── Sky background (fills screen, stays fixed) ── */
    const sky = document.createElement('div');
    sky.className = 'lsm-sky';
    _container.appendChild(sky);

    /* ── Horizontal scroll wrapper ── */
    const scroll = document.createElement('div');
    scroll.className = 'lsm-scroll';
    _container.appendChild(scroll);

    /* ── Island wrapper: height = container height, width = height * aspect ──
       This makes the island fill the full vertical space and scroll horizontally */
    const island = document.createElement('div');
    island.className = 'lsm-island';
    scroll.appendChild(island);

    /* ── Island bg image ── */
    const bg = document.createElement('div');
    bg.className = 'lsm-island-img';
    bg.style.backgroundImage =
      `url('assets/worlds/world${worldId}/map_island.png'),` +
      `url('assets/worlds/world1/map_island.png')`;
    island.appendChild(bg);

    /* ── SVG for path lines (positioned over island) ── */
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.className = 'lsm-svg';
    island.appendChild(svg);

    const count = Math.min(world.levelCount, PATH_POINTS.length);

    /* Draw path lines */
    for (let i = 1; i < count; i++) {
      const prev = PATH_POINTS[i - 1];
      const curr = PATH_POINTS[i];
      const prevDone = Player.getLevelStars(worldId, i - 1) > 0;
      const currDone = Player.getLevelStars(worldId, i) > 0;
      const isCurr   = i === currentIdx;

      let stroke = 'rgba(255,255,255,0.25)';
      if (prevDone && currDone)      stroke = '#22c55e';
      else if (prevDone && isCurr)   stroke = '#60a5fa';

      const mx = (prev.x + curr.x) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d',
        `M${prev.x},${prev.y} C${mx},${prev.y} ${mx},${curr.y} ${curr.x},${curr.y}`);
      path.setAttribute('stroke', stroke);
      path.setAttribute('stroke-width', '1.2');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      if (!prevDone && !isCurr) path.setAttribute('stroke-dasharray', '2 1.5');
      svg.appendChild(path);
    }

    /* ── Level nodes ── */
    for (let i = 0; i < count; i++) {
      const pt       = PATH_POINTS[i];
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

      /* % positioning — CSS will translate(-50%,-50%) to centre */
      node.style.left = pt.x + '%';
      node.style.top  = pt.y + '%';
      if (pt.w) node.style.setProperty('--slab-w', pt.w + 'px');

      node.innerHTML = _nodeHTML(i, { isDone, isCurrent, isLocked, isElite, stars, worldId });

      if (!isLocked) {
        node.addEventListener('click', e => {
          e.stopPropagation();
          if (_onOpen) _onOpen(worldId, i);
        });
      }

      island.appendChild(node);
    }

    /* Auto-scroll to current level */
    setTimeout(() => {
      if (currentIdx >= 0 && currentIdx < PATH_POINTS.length) {
        const pt = PATH_POINTS[currentIdx];
        /* island.offsetWidth set by CSS (height * aspect) */
        const islandW = scroll.clientHeight * ISLAND_ASPECT;
        const nodeX   = (pt.x / 100) * islandW;
        scroll.scrollTo({ left: Math.max(0, nodeX - scroll.clientWidth / 2), behavior: 'smooth' });
      }
    }, 400);

    _attachDrag(scroll);
  }

  function _nodeHTML(i, { isDone, isCurrent, isLocked, isElite, stars, worldId }) {
    let starsRow = '';
    if (isDone) {
      starsRow = '<div class="lsm-stars">' +
        '⭐'.repeat(stars) + '☆'.repeat(3 - stars) + '</div>';
    } else if (isCurrent) {
      starsRow = '<div class="lsm-arrow">▼</div>';
    }

    let label;
    if (isLocked)     label = '🔒';
    else if (isElite) label = '⚔️';
    else              label = String(i + 1);

    const plantRew = Levels.PLANT_UNLOCKS.find(u => u.worldId === worldId && u.levelIdx === i);
    const mgRew    = Levels.MINIGAME_UNLOCKS.find(u => u.worldId === worldId && u.levelIdx === i);
    const badge    = plantRew ? '<div class="lsm-badge">🌿</div>'
                   : mgRew   ? '<div class="lsm-badge">🎮</div>' : '';

    return `${badge}<div class="lsm-slab"><span class="lsm-num">${label}</span></div>${starsRow}`;
  }

  function _attachDrag(el) {
    let dragging = false, startX = 0, scrollX = 0;
    el.addEventListener('mousedown', e => {
      dragging = true; startX = e.clientX; scrollX = el.scrollLeft;
      el.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      el.scrollLeft = scrollX - (e.clientX - startX);
    });
    window.addEventListener('mouseup', () => { dragging = false; el.style.cursor = 'grab'; });
    el.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX; scrollX = el.scrollLeft;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      el.scrollLeft = scrollX - (e.touches[0].clientX - startX);
    }, { passive: true });
  }

  return { init, render };
})();
