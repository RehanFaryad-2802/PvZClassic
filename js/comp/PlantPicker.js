/* js/comp/PlantPicker.js
   PvZClassic — Combined Plant Picker + Demon Preview Modal
   Shows as a bottom-sheet when a level is tapped.
   Top section: demon preview for this level's waves
   Bottom section: plant selection grid
   Start button: launches battle
*/

const PlantPicker = (() => {

  let _worldId = 1;
  let _levelIdx = 0;
  let _selectedPlants = [];
  let _tempPlants = [];
  let _overlay = null;

  function getMaxPicks() {
    return typeof TraySlots !== 'undefined' ? TraySlots.getUnlockedCount() : 6;
  }

  function open(worldId, levelIdx) {
    _worldId   = worldId;
    _levelIdx  = levelIdx;
    _tempPlants = Levels.getTempPlants(worldId, levelIdx);

    // Pre-select all owned plants (up to max)
    const owned = Player.getOwnedPlants().map(p => p.id);
    if (owned.length === 0) {
      Player.unlockPlantByLevel('sunflower');
      Player.unlockPlantByLevel('peashooter');
      owned.push('sunflower', 'peashooter');
    }
    _selectedPlants = owned.slice(0, getMaxPicks());

    _buildOverlay();
  }

  function _buildOverlay() {
    // Remove existing
    if (_overlay) _overlay.remove();

    const levelDef  = Levels.getLevel(_worldId, _levelIdx);
    const worldDef  = Levels.getWorld(_worldId);

    // Collect demon types across all waves
    // waves is array of arrays of demon objects { type, hp, ... }
    const demonTypes = [];
    if (levelDef && Array.isArray(levelDef.waves)) {
      levelDef.waves.forEach(wave => {
        if (!Array.isArray(wave)) return;
        wave.forEach(entry => {
          const type = entry?.type ?? (typeof entry === 'string' ? entry : null);
          if (type && !demonTypes.includes(type)) demonTypes.push(type);
        });
      });
    }

    _overlay = document.createElement('div');
    _overlay.className = 'pp-overlay';
    _overlay.innerHTML = `
      <div class="pp-sheet">

        <!-- Handle bar -->
        <div class="pp-handle"></div>

        <!-- Header -->
        <div class="pp-header">
          <div class="pp-title">${worldDef?.emoji || ''} ${worldDef?.name || ''} · Level ${_levelIdx + 1}</div>
          <button class="pp-close-btn" id="pp-close">✕</button>
        </div>

        <!-- Demon preview -->
        <div class="pp-demon-section">
          <div class="pp-section-label">⚔️ ENEMIES THIS LEVEL</div>
          <div class="pp-demon-row" id="pp-demon-row"></div>
        </div>

        <!-- Divider -->
        <div class="pp-divider"></div>

        <!-- Selected strip -->
        <div class="pp-section-label">🌿 SELECTED <span id="pp-count">0</span>/${getMaxPicks()}</div>
        <div class="pp-selected-strip" id="pp-selected-strip"></div>

        <!-- Plant grid -->
        <div class="pp-plant-grid" id="pp-plant-grid"></div>

        <!-- Start button -->
        <button class="pp-start-btn" id="pp-start-btn">⚔️ START BATTLE</button>

      </div>
    `;

    document.body.appendChild(_overlay);

    // Animate in
    requestAnimationFrame(() => _overlay.classList.add('pp-visible'));

    // Demon preview
    const demonRow = _overlay.querySelector('#pp-demon-row');
    if (demonTypes.length === 0) {
      demonRow.innerHTML = '<span class="pp-no-demons">No preview available</span>';
    } else {
      demonTypes.slice(0, 8).forEach(type => {
        const stats = Levels.getDemonStats(type);
        if (!stats) return;
        const el = document.createElement('div');
        el.className = 'pp-demon-chip';
        el.innerHTML = `
          <img src="${stats.image}" alt="${stats.name}" />
          <span>${stats.name}</span>
        `;
        demonRow.appendChild(el);
      });
    }

    // Plant grid
    _buildPlantGrid();
    _refreshSelected();

    // Events
    _overlay.querySelector('#pp-close').addEventListener('click', close);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) close(); });
    _overlay.querySelector('#pp-start-btn').addEventListener('click', _startBattle);

    // Touch close via drag down on handle
    const sheet = _overlay.querySelector('.pp-sheet');
    let startY = 0;
    sheet.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener('touchend', e => {
      if (e.changedTouches[0].clientY - startY > 80) close();
    }, { passive: true });
  }

  function _buildPlantGrid() {
    const grid = _overlay.querySelector('#pp-plant-grid');
    grid.innerHTML = '';

    PlantRegistry.getAll().forEach(def => {
      const playerPlant = Player.getPlant(def.id);
      const owned = (playerPlant && playerPlant.owned) || _tempPlants.includes(def.id);
      const isTemp = _tempPlants.includes(def.id) && !(playerPlant && playerPlant.owned);
      const level = playerPlant ? playerPlant.level : 1;
      const cost  = def.levelStats?.[level]?.cost ?? def.cost;
      const selected = _selectedPlants.includes(def.id);

      const card = document.createElement('div');
      card.className = 'pp-plant-card' +
        (owned ? '' : ' pp-locked') +
        (selected ? ' pp-selected' : '');
      card.dataset.plantId = def.id;
      card.innerHTML = `
        <img src="${def.image}" alt="${def.name}" />
        <div class="pp-plant-name">${def.name}</div>
        <div class="pp-plant-meta">☀️${cost}${isTemp ? ' 🔒' : ''}</div>
      `;

      if (owned) {
        card.addEventListener('click', () => _toggle(def.id, card));
      }
      grid.appendChild(card);
    });
  }

  function _toggle(plantId, cardEl) {
    const idx = _selectedPlants.indexOf(plantId);
    if (idx >= 0) {
      _selectedPlants.splice(idx, 1);
      cardEl.classList.remove('pp-selected');
    } else {
      const max = getMaxPicks();
      if (_selectedPlants.length >= max) {
        if (typeof UI !== 'undefined') UI.showToast(`Max ${max} plants!`);
        return;
      }
      _selectedPlants.push(plantId);
      cardEl.classList.add('pp-selected');
    }
    _refreshSelected();
  }

  function _refreshSelected() {
    const strip = _overlay.querySelector('#pp-selected-strip');
    const count = _overlay.querySelector('#pp-count');
    count.textContent = _selectedPlants.length;

    strip.innerHTML = '';
    const max = getMaxPicks();

    // Filled slots
    _selectedPlants.forEach(id => {
      const def = PlantRegistry.get(id);
      if (!def) return;
      const el = document.createElement('div');
      el.className = 'pp-sel-slot pp-sel-filled';
      el.innerHTML = `<img src="${def.image}" alt="${def.name}" />`;
      el.addEventListener('click', () => {
        // Deselect on tap
        const card = _overlay.querySelector(`.pp-plant-card[data-plant-id="${id}"]`);
        _toggle(id, card || el);
      });
      strip.appendChild(el);
    });

    // Empty slots
    for (let i = _selectedPlants.length; i < max; i++) {
      const el = document.createElement('div');
      el.className = 'pp-sel-slot pp-sel-empty';
      strip.appendChild(el);
    }

    // Locked slot buttons (7 & 8)
    if (typeof TraySlots !== 'undefined') {
      const unlocked = TraySlots.getUnlockedCount();
      for (let slot = 7; slot <= 8; slot++) {
        if (unlocked >= slot) continue;
        const cost = TraySlots.SLOT_COSTS[slot];
        const prevUnlocked = unlocked >= slot - 1;
        const el = document.createElement('div');
        el.className = 'pp-sel-slot pp-sel-locked';
        el.title = prevUnlocked
          ? `Unlock slot ${slot}: ${cost.coins}🪙${cost.looms ? ` +${cost.looms} Looms` : ''}`
          : `Unlock slot ${slot - 1} first`;
        el.innerHTML = prevUnlocked ? `<span>🔓</span><small>${cost.coins}🪙</small>` : `<span>🔒</span>`;
        if (prevUnlocked) {
          el.addEventListener('click', () => {
            const res = TraySlots.unlockSlot(slot);
            if (!res.ok) { if (typeof UI !== 'undefined') UI.showToast(res.msg); return; }
            _refreshSelected();
          });
        }
        strip.appendChild(el);
      }
    }
  }

  function _startBattle() {
    if (_selectedPlants.length === 0) {
      if (typeof UI !== 'undefined') UI.showToast('Select at least 1 plant!');
      return;
    }
    close();
    // Hand off to core
    if (typeof UI !== 'undefined') {
      UI._pendingBattleWorld = _worldId;
      UI._pendingBattleLevel = _levelIdx;
    }
    Core.startBattle(_worldId, _levelIdx, _selectedPlants, _tempPlants);
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.remove('pp-visible');
    setTimeout(() => { if (_overlay) { _overlay.remove(); _overlay = null; } }, 300);
  }

  return { open, close };
})();