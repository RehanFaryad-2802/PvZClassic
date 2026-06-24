/* ══════════════════════════════════════════════════
   js/comp/BattleTray.js — PvZClassic
   Battle plant tray component.
   Renders wooden tray cards + shovel button.
   Wraps buildPlantTray in ui.js — NO logic change.
   All click handlers still call Core.selectPlant
   and Core.toggleShovel exactly as before.
══════════════════════════════════════════════════ */

const BattleTray = (() => {

  /* Build one wooden tray card element */
  function _makeCard(def, cost) {
    const card = document.createElement('div');
    card.className = 'bt-card';
    card.dataset.plantId = def.id;

    /* Nail pin */
    const pin = document.createElement('div');
    pin.className = 'bt-pin';

    /* Image recess */
    const recess = document.createElement('div');
    recess.className = 'bt-recess';

    const img = document.createElement('img');
    img.src = def.image;
    img.alt = def.name;
    img.className = 'bt-img';
    recess.appendChild(img);

    /* Cooldown overlay — appended dynamically by updateTrayCard */
    /* Cost strip */
    const strip = document.createElement('div');
    strip.className = 'bt-strip';
    strip.innerHTML = `<span class="bt-cost">☀️${cost}</span>`;

    card.appendChild(pin);
    card.appendChild(recess);
    card.appendChild(strip);

    return card;
  }

  /* Build shovel button */
  function _makeShovel() {
    const btn = document.createElement('button');
    btn.className = 'bt-shovel';
    btn.id = 'shovel-btn';
    btn.innerHTML = `<span class="bt-shovel-icon">🪣</span><span class="bt-shovel-label">SHOVEL</span>`;
    return btn;
  }

  return { makeCard: _makeCard, makeShovel: _makeShovel };
})();
