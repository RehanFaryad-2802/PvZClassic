/* ══════════════════════════════════════════════════
   js/comp/BattleHud.js — PvZClassic
   Battle screen top HUD bar component.
   Renders: sun counter | wave info + progress | coins + pause
   Zero core logic — pure UI shell only.
   Called once by ui.js; elements updated via DOM ids.
══════════════════════════════════════════════════ */

const BattleHud = (() => {

  function build(container) {
    // container = #screen-battle or a parent el
    // Find or create the .battle-hud element
    let hud = container.querySelector('.battle-hud');
    if (!hud) return; // already exists in HTML, just restyle

    hud.innerHTML = `
      <!-- Sun pill -->
      <div class="bh-left">
        <div class="bh-sun-pill">
          <span class="bh-sun-icon">☀️</span>
          <span id="hud-sun" class="bh-sun-val">50</span>
        </div>
        <div class="bh-level-tag">
          <span id="hud-world">W1</span>·<span id="hud-level">L1</span>
        </div>
      </div>

      <!-- Wave + progress bar -->
      <div class="bh-center">
        <div class="bh-wave-row">
          <span class="bh-wave-label">WAVE</span>
          <span id="hud-wave" class="bh-wave-num">1</span>
          <span class="bh-wave-sep">/</span>
          <span id="hud-wave-total" class="bh-wave-num">3</span>
        </div>
        <div class="bh-progress-track">
          <div class="bh-progress-fill" id="wave-progress"></div>
          <div class="bh-progress-glow" id="wave-progress-glow"></div>
        </div>
      </div>

      <!-- Coins + pause -->
      <div class="bh-right">
        <div class="bh-coin-pill">
          <img src="assets/icons/gold.png" alt="coins" class="bh-coin-icon"/>
          <span id="hud-coins" class="bh-coin-val">0</span>
        </div>
        <button class="bh-pause-btn" id="btn-pause">⏸</button>
      </div>
    `;
  }

  /* Update wave progress bar (0-1 float) */
  function setProgress(pct) {
    const fill = document.getElementById('wave-progress');
    const glow = document.getElementById('wave-progress-glow');
    const p = Math.min(1, Math.max(0, pct)) * 100;
    if (fill) fill.style.width = p + '%';
    if (glow) glow.style.width = p + '%';
  }

  return { build, setProgress };
})();
