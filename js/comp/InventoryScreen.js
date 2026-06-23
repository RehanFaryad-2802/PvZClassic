/* ══════════════════════════════════════════════════
   js/comp/InventoryScreen.js — PvZClassic
   Inventory screen shell component.
   Renders header, tabs, left detail panel layout.
   Grid cards use WoodenCard component.
   Zero core logic touched.
══════════════════════════════════════════════════ */

const InventoryScreen = (() => {

  /* ── Build the static shell HTML ── */
  function buildShell(screen, onBack, onTabChange) {
    screen.innerHTML = `
      <div class="inv-header">
        <button id="btn-back-collection" class="inv-back-btn">
          <img src="assets/icons/back.png" alt="back" class="game-icon"/>
        </button>
        <div class="inv-title">📦 Inventory</div>
        <div class="inv-currency-bar">
          <div class="inv-curr-pill">
            <img src="assets/icons/gold.png" class="inv-curr-img" alt="coins"/>
            <span id="inv-coins">0</span>
          </div>
          <div class="inv-curr-pill">
            <img src="assets/shop/loom.png" class="inv-curr-img" alt="looms"/>
            <span id="inv-looms">0</span>
          </div>
        </div>
      </div>

      <div class="inv-body" id="inv-layout">
        <!-- Left detail panel -->
        <div class="inv-panel" id="inv-left">
          <div class="inv-panel-empty">
            <div class="inv-panel-empty-icon">🌿</div>
            <div class="inv-panel-empty-text">Select an item</div>
          </div>
        </div>

        <!-- Right: tabs + grid -->
        <div class="inv-right" id="inv-right">
          <div class="inv-tabs" id="inv-tabs">
            <button class="inv-tab active" data-tab="plants">🌿 Plants</button>
            <button class="inv-tab" data-tab="packets">📦 Items</button>
            <button class="inv-tab" data-tab="coins">🪙 Coins</button>
          </div>
          <div class="inv-grid" id="inv-grid"></div>
        </div>
      </div>
    `;

    document.getElementById('btn-back-collection')
      .addEventListener('click', onBack);

    document.getElementById('inv-tabs').addEventListener('click', e => {
      const tab = e.target.closest('.inv-tab')?.dataset.tab;
      if (!tab) return;
      document.querySelectorAll('.inv-tab')
        .forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      onTabChange(tab);
    });
  }

  /* ── Render detail panel for a plant ── */
  function renderPlantDetail(left, def, pp, onLevelUp) {
    const level    = pp.level;
    const seeds    = pp.seeds;
    const nextCost = Seeds.getLevelUpCost(level);
    const maxLevel = level >= 15;
    const canUp    = !maxLevel && seeds >= (nextCost || 0);
    const pct      = nextCost ? Math.min(seeds / nextCost, 1) : 1;
    const ls       = def.levelStats?.[level];

    /* Stat row helper */
    const row = (icon, label, val, color) =>
      `<div class="inv-stat-row">
         <span class="inv-stat-icon">${icon}</span>
         <span class="inv-stat-label">${label}</span>
         <span class="inv-stat-val" style="color:${color}">${val}</span>
       </div>`;
    const msToS = ms => (ms / 1000).toFixed(1) + 's';

    let statsHTML = '';
    if (ls) {
      if (ls.cost !== undefined)              statsHTML += row('☀️','Sun Cost',  ls.cost,                    '#fde68a');
      if (ls.hp !== undefined)                statsHTML += row('❤️','HP',        ls.hp,                      '#f87171');
      if (ls.damage !== undefined)            statsHTML += row('⚔️','Damage',    ls.damage,                  '#fb923c');
      if (ls.fireRate !== undefined)          statsHTML += row('⚡','Atk Speed', msToS(ls.fireRate),          '#fbbf24');
      if (ls.cooldown !== undefined)          statsHTML += row('🔄','Cooldown',  msToS(ls.cooldown),          '#c4b5fd');
      if (ls.freezeDuration !== undefined)    statsHTML += row('❄️','Freeze',    msToS(ls.freezeDuration),   '#7dd3fc');
      if (ls.slowDuration !== undefined)      statsHTML += row('🧊','Slow Dur',  msToS(ls.slowDuration),     '#7dd3fc');
      if (ls.sunValue !== undefined)          statsHTML += row('☀️','Sun/Drop',  ls.sunValue,                '#fde68a');
      if (ls.aoeRadius !== undefined)         statsHTML += row('💥','AoE',       ls.aoeRadius + ' cells',    '#fb923c');
      if (ls.burnDamage !== undefined)        statsHTML += row('🔥','Burn Dmg',  ls.burnDamage + '/tick',    '#fb923c');
      if (ls.stunDuration !== undefined)      statsHTML += row('💫','Stun',      msToS(ls.stunDuration),     '#c4b5fd');
    }

    const categoriesHTML = def.category
      ? `<div class="inv-categories">${def.category.map(c =>
          `<span class="inv-cat-tag">${c}</span>`).join('')}</div>`
      : '';

    let actionHTML;
    if (maxLevel) {
      actionHTML = `<div class="inv-max-badge">🏆 MAX LEVEL</div>`;
    } else if (canUp) {
      const costLabel = level >= 14
        ? `🪙 ${nextCost.coins} + 🌀 ${nextCost.seedCoins}`
        : `🪙 ${nextCost} coins`;
      actionHTML = `
        <button class="inv-action-btn inv-levelup-btn" id="inv-lvlup-btn" data-id="${def.id}">
          ⬆️ Level Up
          <span class="inv-btn-sub">${costLabel}</span>
        </button>`;
    } else {
      const needCoins = level >= 14
        ? (nextCost?.coins || 0) - Player.getCoins()
        : (nextCost || 0) - Player.getCoins();
      actionHTML = `<div class="inv-need-seeds">Need 🪙 ${needCoins} more coins</div>`;
    }

    left.innerHTML = `
      <div class="inv-detail">
        <div class="inv-detail-header">
          <div class="inv-detail-img-wrap">
            <img src="${def.image}" alt="${def.name}" class="inv-detail-img"/>
            <div class="inv-detail-lvl-badge">Lv.${level}</div>
          </div>
          <div class="inv-detail-meta">
            <div class="inv-detail-name">${def.name}</div>
            ${categoriesHTML}
          </div>
        </div>

        <div class="inv-detail-desc">${def.description || ''}</div>

        
        ${statsHTML ? `<div class="inv-stats-block">${statsHTML}</div>` : ''}
        <div class="inv-seeds-block">
          <div class="inv-seeds-row">
            <span>🌱 Seeds</span>
            <span style="color:${maxLevel ? '#fde68a' : '#86efac'};font-weight:700">
              ${maxLevel ? 'MAX' : `${seeds} / ${nextCost}`}
            </span>
          </div>
          <div class="inv-seed-bar-wrap">
            <div class="inv-seed-bar" style="
              width:${maxLevel ? 100 : pct * 100}%;
              background:${maxLevel ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#16a34a,#4ade80)'}">
            </div>
          </div>
        </div>

        <div class="inv-actions">${actionHTML}</div>
      </div>
    `;

    const lvlBtn = document.getElementById('inv-lvlup-btn');
    if (lvlBtn) lvlBtn.addEventListener('click', () => onLevelUp(def.id));
  }

  /* ── Render detail panel for a packet ── */
  function renderPacketDetail(left, def, qty) {
    const rarity = { common:'🟢', rare:'🔵', epic:'🟣', legendary:'🟡', world:'🌍' };
    left.innerHTML = `
      <div class="inv-detail">
        <div class="inv-detail-center">
          <img src="${def.image}" alt="${def.name}" class="inv-packet-big-img"/>
          <div class="inv-detail-name">${def.name}</div>
          <div class="inv-packet-rarity">${rarity[def.rarity] || ''} ${def.rarity?.toUpperCase() || ''}</div>
          <div class="inv-detail-desc">${def.description}</div>
          <div class="inv-packet-qty-big">In bag: <strong>×${qty}</strong></div>
        </div>
        <div class="inv-actions">
          <button class="inv-action-btn inv-open-btn" id="btn-open-packet">
            📦 Open Packet
          </button>
        </div>
      </div>
    `;
  }

  /* ── Render detail panel for a minipacket ── */
  function renderMinipacketDetail(left, worldId) {
    left.innerHTML = `
      <div class="inv-detail">
        <div class="inv-detail-center">
          <img src="assets/shop/minipacket.png" alt="World Packet" class="inv-packet-big-img" style="filter:drop-shadow(0 0 16px #a855f7)"/>
          <div class="inv-detail-name">🎁 World ${worldId} Packet</div>
          <div class="inv-detail-desc">
            3 mystery seeds from World ${worldId}.<br>
            <span style="color:#fbbf24;font-weight:700">1% chance</span> of 10 Looms!
          </div>
          <div class="inv-minipacket-slots">
            <div class="inv-slot">❓</div>
            <div class="inv-slot">❓</div>
            <div class="inv-slot">❓</div>
          </div>
        </div>
        <div class="inv-actions">
          <button class="inv-action-btn inv-open-btn" id="btn-open-minipacket">
            📦 Open Packet
          </button>
        </div>
      </div>
    `;
  }

  /* ── Empty panel ── */
  function renderEmptyDetail(left) {
    left.innerHTML = `
      <div class="inv-panel-empty">
        <div class="inv-panel-empty-icon">🌿</div>
        <div class="inv-panel-empty-text">Select an item</div>
      </div>
    `;
  }

  return {
    buildShell,
    renderPlantDetail,
    renderPacketDetail,
    renderMinipacketDetail,
    renderEmptyDetail,
  };
})();
