/* js/comp/TraySlots.js
   PvZClassic — Tray Slot Manager
   ─ 6 base slots always available
   ─ Slot 7: unlock for 500 coins
   ─ Persisted in localStorage
   ─ Renders locked slot UI inside #plant-tray
   ─ Called by ui.js after tray cards are built
*/

const TraySlots = (() => {
  const SAVE_KEY   = 'pvzc_tray_slots';
  const BASE_SLOTS = 6;
  const SLOT_COSTS = {
    7: { coins: 500, looms: 0 },
  };

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const state = raw ? JSON.parse(raw) : { unlocked: BASE_SLOTS };
      state.unlocked = Math.min(7, Math.max(BASE_SLOTS, state.unlocked || BASE_SLOTS));
      return state;
    } catch {
      return { unlocked: BASE_SLOTS };
    }
  }

  function save(state) {
    state.unlocked = Math.min(7, Math.max(BASE_SLOTS, state.unlocked || BASE_SLOTS));
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function getUnlockedCount() {
    return load().unlocked;
  }

  function unlockSlot(slotNum) {
    const cost = SLOT_COSTS[slotNum];
    if (!cost) return { ok: false, msg: 'Invalid slot' };

    const state = load();
    if (state.unlocked >= slotNum) return { ok: false, msg: 'Already unlocked' };
    if (state.unlocked < slotNum - 1) return { ok: false, msg: 'Unlock previous slot first' };

    // Check coins
    if (Player.getCoins() < cost.coins) {
      return { ok: false, msg: `Need ${cost.coins} <img src="assets/icons/gold.png" alt="gold" class="icon-gold"> coins` };
    }
    // Check looms
    if (cost.looms > 0 && Player.getLooms() < cost.looms) {
      return { ok: false, msg: `Need ${cost.looms} Looms` };
    }

    // Spend
    Player.spendCoins(cost.coins);
    if (cost.looms > 0) Player.spendLooms(cost.looms);

    state.unlocked = slotNum;
    save(state);
    return { ok: true };
  }

  function resetToBase() {
    const state = { unlocked: BASE_SLOTS };
    save(state);
  }

  /* renderLockedSlots(trayEl, currentPlantCount)
     Appends locked slot buttons for slots beyond currentPlantCount
     but only up to slot 7. Call after tray cards are rendered. */
  function renderLockedSlots(trayEl, currentPlantCount) {
    const unlocked = getUnlockedCount();

    // Remove any existing locked slots
    trayEl.querySelectorAll('.tray-slot-locked').forEach(el => el.remove());

    for (let slot = BASE_SLOTS + 1; slot <= 7; slot++) {
      const alreadyUnlocked = unlocked >= slot;
      if (alreadyUnlocked) continue; // slot open, plants fill it naturally

      const cost = SLOT_COSTS[slot];
      const prevUnlocked = unlocked >= slot - 1;

      const el = document.createElement('div');
      el.className = 'tray-slot-locked';
      el.dataset.slot = slot;

      if (!prevUnlocked) {
        // Slot 7 unlock only available after base slots
        el.innerHTML = `
          <span class="lock-icon">🔒</span>
          <span class="lock-cost" style="color:rgba(255,255,255,0.3)">Unlock 7 first</span>
        `;
        el.style.opacity = '0.4';
        el.style.cursor  = 'default';
      } else {
          const costLine = cost.looms > 0
            ? `${cost.coins}<img src="assets/icons/gold.png" alt="gold" class="icon-gold">\n+${cost.looms} Looms`
            : `${cost.coins}<img src="assets/icons/gold.png" alt="gold" class="icon-gold">`;
        el.innerHTML = `
          <span class="lock-icon">🔓</span>
          <span class="lock-cost">${costLine}</span>
        `;
        el.addEventListener('click',  () => handleUnlock(slot, trayEl, currentPlantCount));
        el.addEventListener('touchend', (e) => { e.preventDefault(); handleUnlock(slot, trayEl, currentPlantCount); }, { passive: false });
      }

      trayEl.appendChild(el);
    }
  }

  function handleUnlock(slotNum, trayEl, currentPlantCount) {
    const result = unlockSlot(slotNum);
    if (!result.ok) {
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast(result.msg);
      }
      return;
    }
    // Re-render locked slots after unlock
    renderLockedSlots(trayEl, currentPlantCount);
  }
  return {
    getUnlockedCount,
    unlockSlot,
    resetToBase,
    renderLockedSlots,
    SLOT_COSTS,
    BASE_SLOTS,
  };
})();