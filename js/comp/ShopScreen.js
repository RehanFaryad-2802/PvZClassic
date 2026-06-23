/* ══════════════════════════════════════════════════
   js/comp/ShopScreen.js — PvZClassic
   Shop screen shell + tab rendering component.
   Same wooden theme as InventoryScreen.
   Zero core logic touched — only UI rendering.
══════════════════════════════════════════════════ */

const ShopScreen = (() => {

  /* ── Build the static shell (header + tab bar + scroll area) ── */
  function buildShell(screen, onBack, onTabChange) {
    screen.innerHTML = `
      <div class="sh-header">
        <button class="sh-back-btn" id="btn-back-shop">
          <img src="assets/icons/back.png" alt="back" class="game-icon"/>
        </button>
        <div class="sh-title">🛒 Shop</div>
        <div class="sh-currency-bar">
          <div class="sh-curr-pill">
            <img src="assets/icons/gold.png" class="sh-curr-img" alt="coins"/>
            <span id="shop-coins">0</span>
          </div>
          <div class="sh-curr-pill sh-loom-pill">
            <img src="assets/shop/loom.png" class="sh-curr-img" alt="looms"/>
            <span id="shop-looms">0</span>
          </div>
        </div>
      </div>

      <div class="sh-tabs" id="shop-tab-bar">
        <button class="sh-tab active" data-tab="seeds">🌱 Seeds</button>
        <button class="sh-tab" data-tab="packets">📦 Packets</button>
        <button class="sh-tab" data-tab="plants">🌿 Plants</button>
        <button class="sh-tab" data-tab="event">🎉 Event</button>
      </div>

      <div class="sh-scroll" id="shop-grid"></div>
    `;

    document.getElementById('btn-back-shop')
      ?.addEventListener('click', onBack);

    document.getElementById('shop-tab-bar')
      .addEventListener('click', e => {
        const tab = e.target.closest('.sh-tab')?.dataset.tab;
        if (!tab) return;
        document.querySelectorAll('.sh-tab')
          .forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        onTabChange(tab);
      });
  }

  /* ── Seed card (uses WoodenCard) ── */
  function buildSeedCard(offer, def, level, timeLeft, isExpiringSoon, onBuy) {
    const card = WoodenCard.create({
      img:        def.image,
      name:       def.name,
      sublabel:   `Lv.${level}`,
      badge:      `+${offer.seeds}`,
      locked:     false,
      extraClass: offer.purchased ? 'sh-purchased' : '',
    });
    card.classList.add('sh-seed-card');

    /* Extra info below nameplate */
    const info = document.createElement('div');
    info.className = 'sh-card-footer';
    info.innerHTML = `
      <div class="sh-seed-amount">+${offer.seeds} Seeds</div>
      <div class="sh-timer ${isExpiringSoon ? 'sh-expiring' : ''}"
           data-refresh="${offer._nextRefresh || 0}">
        🔄 ${_formatTime(timeLeft)}
      </div>
      <button class="sh-buy-btn ${offer.purchased ? 'sh-bought' : ''}"
        ${offer.purchased ? 'disabled' : ''}>
        ${offer.purchased
          ? '✓ Bought'
          : `<img src="assets/icons/gold.png" class="icon-gold" alt=""> ${offer.coinCost}`}
      </button>
    `;

    if (!offer.purchased) {
      info.querySelector('.sh-buy-btn').addEventListener('click', e => {
        e.stopPropagation();
        onBuy();
      });
    }

    card.appendChild(info);
    return card;
  }

  /* ── Packet card (uses WoodenCard + rarity tint) ── */
  function buildPacketCard(def, qty, getPacketImg, onBuy) {
    const rarityLabel = { common:'🟢', rare:'🔵', epic:'🟣', legendary:'🟡', world:'🌍' };

    const card = WoodenCard.create({
      img:        def.image,
      name:       def.name,
      sublabel:   def.rarity?.toUpperCase(),
      badge:      rarityLabel[def.rarity] || '',
      locked:     false,
      extraClass: `sh-packet-card sh-rarity-${def.rarity || 'common'}`,
    });

    const info = document.createElement('div');
    info.className = 'sh-card-footer';
    info.innerHTML = `
      <div class="sh-packet-desc">${def.description || ''}</div>
      <div class="sh-packet-seeds">
        <strong>${def.seedCount}</strong> seeds
        ${!def.allowRepeats ? '· No repeats' : '· May repeat'}
      </div>
      ${qty > 0 ? `<div class="sh-owned-badge">In bag: ×${qty}</div>` : ''}
      <button class="sh-buy-btn sh-loom-btn">
        <img src="assets/shop/loom.png" class="sh-loom-sm" alt="loom"/> ${def.loomCost}
      </button>
    `;

    info.querySelector('.sh-buy-btn').addEventListener('click', e => {
      e.stopPropagation();
      onBuy();
    });

    card.appendChild(info);
    return card;
  }

  /* ── Coming soon / empty placeholders ── */
  function buildComingSoon(icon, title, subtitle) {
    const el = document.createElement('div');
    el.className = 'sh-coming-soon';
    el.innerHTML = `
      <div class="sh-coming-icon">${icon}</div>
      <div class="sh-coming-title">${title}</div>
      <div class="sh-coming-sub">${subtitle}</div>
    `;
    return el;
  }

  function buildRefreshTimer(timeLeft) {
    const el = document.createElement('div');
    el.className = 'sh-refresh-bar';
    el.innerHTML = `
      <span>🔄 Refreshes in</span>
      <strong class="sh-refresh-time" data-refresh-target="${Date.now() + timeLeft}">
        ${_formatTime(timeLeft)}
      </strong>
    `;
    return el;
  }

  /* ── Time format helper ── */
  function _formatTime(ms) {
    if (ms <= 0) return 'Refreshing...';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }

  return { buildShell, buildSeedCard, buildPacketCard, buildComingSoon, buildRefreshTimer };
})();
