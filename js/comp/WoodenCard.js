/* ══════════════════════════════════════════════════
   js/comp/WoodenCard.js  — PvZClassic
   Reusable wooden plank card component.
   Used by inventory grid for plant/item cards.
   Zero core logic — pure UI rendering only.

   Usage:
     WoodenCard.create({ img, name, sublabel, badge, locked, onClick, extra })
     Returns a DOM element ready to appendChild.
══════════════════════════════════════════════════ */

const WoodenCard = (() => {

  /* Grain lines — pure CSS, no image needed */
  const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`;

  /*
   * create(opts) → HTMLElement
   * opts = {
   *   img       : string (src),
   *   name      : string,
   *   sublabel  : string (e.g. "Lv.1"),
   *   badge     : string|null (e.g. "🔒", "+15", rarity),
   *   locked    : bool,
   *   selected  : bool,
   *   seedBar   : { current, max } | null,
   *   pinColor  : string (css color, default brass),
   *   onClick   : function,
   *   extraClass: string,
   * }
   */
  function create(opts = {}) {
    const {
      img, name, sublabel, badge, locked, selected,
      seedBar, pinColor = '#b8922a', onClick, extraClass = ''
    } = opts;

    const card = document.createElement('div');
    card.className = [
      'wc-card',
      locked   ? 'wc-locked'   : '',
      selected ? 'wc-selected' : '',
      extraClass,
    ].filter(Boolean).join(' ');

    /* ── Nail pin at top ── */
    const pin = document.createElement('div');
    pin.className = 'wc-pin';
    pin.style.background = `radial-gradient(circle at 35% 30%, #e8d090, ${pinColor} 60%, #6a4800)`;

    /* ── Image recess (carved inset area) ── */
    const recess = document.createElement('div');
    recess.className = 'wc-recess';

    const imgEl = document.createElement('img');
    imgEl.src = img || '';
    imgEl.alt = name || '';
    imgEl.className = 'wc-img';
    if (locked) imgEl.style.filter = 'grayscale(0.7) brightness(0.6)';
    recess.appendChild(imgEl);

    /* Lock icon overlay */
    if (locked) {
      const lockEl = document.createElement('div');
      lockEl.className = 'wc-lock-icon';
      lockEl.textContent = '🔒';
      recess.appendChild(lockEl);
    }

    /* Badge (top-right corner of recess) */
    if (badge) {
      const badgeEl = document.createElement('div');
      badgeEl.className = 'wc-badge';
      badgeEl.innerHTML = badge;
      recess.appendChild(badgeEl);
    }

    /* ── Nameplate strip (darker wood at bottom) ── */
    const plate = document.createElement('div');
    plate.className = 'wc-plate';

    const nameEl = document.createElement('div');
    nameEl.className = 'wc-name';
    nameEl.textContent = name || '';
    plate.appendChild(nameEl);

    if (sublabel) {
      const subEl = document.createElement('div');
      subEl.className = 'wc-sub';
      subEl.innerHTML = sublabel;
      plate.appendChild(subEl);
    }

    /* Seed progress bar inside nameplate */
    if (seedBar) {
      const barWrap = document.createElement('div');
      barWrap.className = 'wc-bar-wrap';
      const bar = document.createElement('div');
      bar.className = 'wc-bar';
      const pct = seedBar.max > 0 ? Math.min(100, (seedBar.current / seedBar.max) * 100) : 0;
      bar.style.width = pct + '%';
      /* colour by fill level */
      bar.style.background = pct >= 100
        ? 'linear-gradient(90deg, #16a34a, #4ade80)'
        : pct >= 60
          ? 'linear-gradient(90deg, #ca8a04, #fbbf24)'
          : 'linear-gradient(90deg, #b45309, #f97316)';
      barWrap.appendChild(bar);
      plate.appendChild(barWrap);
    }

    /* ── Assemble ── */
    card.appendChild(pin);
    card.appendChild(recess);
    card.appendChild(plate);

    /* Click */
    if (!locked && onClick) {
      card.addEventListener('click', onClick);
    }

    return card;
  }

  /* Helper: update selected state without re-render */
  function setSelected(card, isSelected) {
    card.classList.toggle('wc-selected', isSelected);
  }

  return { create, setSelected };
})();
