/* js/comp/PlantPicker.js
   PvZClassic — Plant Picker + Demon Preview Modal
   Layout: [ left: selected slots vertical ] | [ right: enemies + plant grid ]
*/

const PlantPicker = (() => {

  let _worldId        = 1;
  let _levelIdx       = 0;
  let _selectedPlants = [];
  let _lockedPlants   = [];
  let _tempPlants     = [];
  let _overlay        = null;

  function getMaxPicks() {
    return typeof TraySlots !== 'undefined' ? TraySlots.getUnlockedCount() : 6;
  }

  // Define level-forced plants here: key = "worldId-levelIdx"
  const LEVEL_LOCKED_PLANTS = {
    // '1-2': ['sunflower'],
  };

  function open(worldId, levelIdx) {
    _worldId      = worldId;
    _levelIdx     = levelIdx;
    _tempPlants   = Levels.getTempPlants(worldId, levelIdx);
    _lockedPlants = LEVEL_LOCKED_PLANTS[`${worldId}-${levelIdx}`] || [];
    _selectedPlants = [..._lockedPlants];
    _buildOverlay();
  }

  // waves = [{ demons:[{type,...}], waveDelay, triggerOnKill }, ...]
  function _getDemonTypes(levelDef) {
    const types = [];
    if (!levelDef || !Array.isArray(levelDef.waves)) return types;
    levelDef.waves.forEach(wave => {
      const list = Array.isArray(wave) ? wave : (wave?.demons || []);
      list.forEach(entry => {
        const type = entry?.type ?? (typeof entry === 'string' ? entry : null);
        if (type && !types.includes(type)) types.push(type);
      });
    });
    return types;
  }

  function _buildOverlay() {
    if (_overlay) _overlay.remove();

    const levelDef   = Levels.getLevel(_worldId, _levelIdx);
    const worldDef   = Levels.getWorld(_worldId);
    const demonTypes = _getDemonTypes(levelDef);
    const max        = getMaxPicks();

    _overlay = document.createElement('div');
    _overlay.className = 'pp-overlay';
    _overlay.innerHTML = `
      <div class="pp-sheet">
        <div class="pp-handle"></div>

        <div class="pp-header">
          <div class="pp-title">${worldDef?.emoji || ''} <strong>${worldDef?.name?.toUpperCase() || ''}</strong> · LEVEL ${_levelIdx + 1}</div>
          <button class="pp-close-btn" id="pp-close">✕</button>
        </div>

        <div class="pp-body">

          <!-- LEFT COL: selected slots -->
          <div class="pp-left-col">
            <div class="pp-selected-col" id="pp-selected-col"></div>
            <div class="pp-slot-unlocks" id="pp-slot-unlocks"></div>
          </div>

          <!-- RIGHT COL: enemies + plant grid -->
          <div class="pp-right-col">
            <div class="pp-demon-section">
              <div class="pp-section-label">⚔ ENEMIES THIS LEVEL</div>
              <div class="pp-demon-row" id="pp-demon-row"></div>
            </div>
            <div class="pp-divider"></div>
            <div class="pp-plant-grid" id="pp-plant-grid"></div>
          </div>

        </div>

        <button class="pp-start-btn" id="pp-start-btn">⚔️ START BATTLE</button>
      </div>
    `;

    document.body.appendChild(_overlay);
    requestAnimationFrame(() => _overlay.classList.add('pp-visible'));

    // Populate demon row
    const demonRow = _overlay.querySelector('#pp-demon-row');
    if (demonTypes.length === 0) {
      demonRow.innerHTML = '<span class="pp-no-demons">No enemies preview available</span>';
    } else {
      demonTypes.slice(0, 8).forEach(type => {
        const stats = Levels.getDemonStats(type);
        if (!stats) return;
        const el = document.createElement('div');
        el.className = 'pp-demon-chip';
        el.innerHTML = `
          <img src="${stats.image}" alt="${stats.name}" onerror="this.style.opacity='0.3'" />
          <span>${stats.name}</span>
        `;
        demonRow.appendChild(el);
      });
    }

    _buildPlantGrid();
    _refreshSelected();

    _overlay.querySelector('#pp-close').addEventListener('click', close);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) close(); });
    _overlay.querySelector('#pp-start-btn').addEventListener('click', _startBattle);

    // Swipe down to close
    let _startY = 0;
    const sheet = _overlay.querySelector('.pp-sheet');
    sheet.addEventListener('touchstart', e => { _startY = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener('touchend',   e => { if (e.changedTouches[0].clientY - _startY > 90) close(); }, { passive: true });
  }

  function _buildPlantGrid() {
    const grid = _overlay.querySelector('#pp-plant-grid');
    grid.innerHTML = '';

    PlantRegistry.getAll().forEach(def => {
      const pp       = Player.getPlant(def.id);
      const owned    = (pp && pp.owned) || _tempPlants.includes(def.id);
      const isTemp   = _tempPlants.includes(def.id) && !(pp && pp.owned);
      const isLocked = _lockedPlants.includes(def.id);
      const level    = pp ? pp.level : 1;
      const cost     = def.levelStats?.[level]?.cost ?? def.cost;
      const selected = _selectedPlants.includes(def.id);

      const card = document.createElement('div');
      card.className = 'pp-plant-card'
        + (owned    ? ''           : ' pp-card-locked')
        + (selected ? ' pp-card-selected' : '')
        + (isLocked ? ' pp-card-forced'   : '');
      card.dataset.plantId = def.id;
      card.innerHTML = `
        <img src="${def.image}" alt="${def.name}" />
        <div class="pp-plant-name">${def.name}</div>
        <div class="pp-plant-cost">☀️${cost}${isTemp ? ' 🔒' : ''}</div>
        ${isLocked ? '<div class="pp-forced-badge">🔒</div>' : ''}
        ${selected && !isLocked ? '<div class="pp-check">✓</div>' : ''}
      `;

      if (owned && !isLocked) {
        card.addEventListener('click', () => _toggle(def.id, card));
      }
      grid.appendChild(card);
    });
  }

  function _toggle(plantId, cardEl) {
    const idx = _selectedPlants.indexOf(plantId);
    if (idx >= 0) {
      if (_lockedPlants.includes(plantId)) return;
      _selectedPlants.splice(idx, 1);
      cardEl.classList.remove('pp-card-selected');
      cardEl.querySelector('.pp-check')?.remove();
    } else {
      const max = getMaxPicks();
      if (_selectedPlants.length >= max) {
        if (typeof UI !== 'undefined') UI.showToast(`Max ${max} plants!`);
        return;
      }
      _selectedPlants.push(plantId);
      cardEl.classList.add('pp-card-selected');
      if (!cardEl.querySelector('.pp-check')) {
        const chk = document.createElement('div');
        chk.className = 'pp-check';
        chk.textContent = '✓';
        cardEl.appendChild(chk);
      }
    }
    _refreshSelected();
  }

  function _refreshSelected() {
    const col       = _overlay.querySelector('#pp-selected-col');
    const countEl   = _overlay.querySelector('#pp-count');
    const unlockCol = _overlay.querySelector('#pp-slot-unlocks');
    if (countEl) countEl.textContent = _selectedPlants.length;

    col.innerHTML = '';
    const max = getMaxPicks();

    // Filled slots
    _selectedPlants.forEach(id => {
      const def = PlantRegistry.get(id);
      if (!def) return;
      const isLocked = _lockedPlants.includes(id);
      const el = document.createElement('div');
      el.className = 'pp-sel-slot pp-sel-filled' + (isLocked ? ' pp-sel-forced' : '');
      el.innerHTML = `
        <img src="${def.image}" alt="${def.name}" />
        ${isLocked ? '<span class="pp-sel-lock">🔒</span>' : ''}
      `;
      if (!isLocked) {
        el.addEventListener('click', () => {
          const card = _overlay.querySelector(`.pp-plant-card[data-plant-id="${id}"]`);
          _toggle(id, card || el);
        });
      }
      col.appendChild(el);
    });

    // Empty slots
    for (let i = _selectedPlants.length; i < max; i++) {
      const el = document.createElement('div');
      el.className = 'pp-sel-slot pp-sel-empty';
      el.innerHTML = '<span class="pp-sel-plus">+</span>';
      col.appendChild(el);
    }

    // Unlock slot buttons (7 & 8)
    unlockCol.innerHTML = '';
    if (typeof TraySlots !== 'undefined') {
      const unlocked = TraySlots.getUnlockedCount();
      for (let slot = 7; slot <= 8; slot++) {
        if (unlocked >= slot) continue;
        const slotCost     = TraySlots.SLOT_COSTS[slot];
        const prevUnlocked = unlocked >= slot - 1;
        const el = document.createElement('div');
        el.className = 'pp-unlock-slot' + (prevUnlocked ? ' pp-unlock-available' : ' pp-unlock-blocked');
        if (prevUnlocked) {
          el.innerHTML = `
            <span class="pp-unlock-icon">🔓</span>
            <span class="pp-unlock-label">${slotCost.coins}🪙${slotCost.looms ? `+${slotCost.looms}💜` : ''}</span>
          `;
          el.addEventListener('click', () => _promptUnlockSlot(slot, slotCost));
        } else {
          el.innerHTML = `
            <span class="pp-unlock-icon">🔒</span>
            <span class="pp-unlock-label" style="opacity:0.35;font-size:7px">Unlock ${slot-1} first</span>
          `;
        }
        unlockCol.appendChild(el);
      }
    }
  }

  function _promptUnlockSlot(slot, slotCost) {
    const costs = [{ icon: '🪙', amount: slotCost.coins, label: 'Coins' }];
    if (slotCost.looms > 0) costs.push({ icon: '💜', amount: slotCost.looms, label: 'Looms', type: 'loom' });
    ConfirmPopup.show({
      icon: '🔓',
      title: `Unlock Slot ${slot}`,
      body: `Permanently adds 1 extra plant slot to your battle tray.`,
      costs,
      confirmText: 'Unlock!',
      cancelText: 'Cancel',
      type: 'purchase',
      onConfirm: () => {
        const res = TraySlots.unlockSlot(slot);
        if (!res.ok) { if (typeof UI !== 'undefined') UI.showToast(res.msg); return; }
        const max = getMaxPicks();
        _refreshSelected();
      },
    });
  }

  function _startBattle() {
    if (_selectedPlants.length === 0) {
      if (typeof UI !== 'undefined') UI.showToast('Select at least 1 plant!');
      return;
    }
    close();
    Core.startBattle(_worldId, _levelIdx, _selectedPlants, _tempPlants);
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.remove('pp-visible');
    setTimeout(() => { if (_overlay) { _overlay.remove(); _overlay = null; } }, 280);
  }

  function setLockedPlantsForLevel(worldId, levelIdx, plantIds) {
    LEVEL_LOCKED_PLANTS[`${worldId}-${levelIdx}`] = plantIds;
  }

  return { open, close, setLockedPlantsForLevel };
})();
