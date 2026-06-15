/* plants/lilybeam.js
   Lily Beam — tiered ice beam.

   Level 1–4  : damage only (no status)
   Level 5–9  : damage + 50% slow (respects slowImmune / slowResist)
   Level 10–15: damage + full freeze (respects freezeImmune)

   Crystal shield absorbs 1 hit every N seconds (all levels).
*/

// ── Tunable config ──────────────────────────────────────────────
const LILYBEAM_CFG = {
  SLOW_MULTIPLIER: 0.5,      // speed multiplier while slowed (0.5 = half speed)
  SLOW_BASE_DURATION: 2500,  // ms of slow at level 5 (scales up per levelStats)
  BEAM_FADE_MS: 400,         // how long the beam visual lasts
  MUZZLE_FADE_MS: 250,
  CHARGE_DELAY_MS: 400,
  FIRE_ANIM_MS: 350,
  BLOCKED_FLOAT_MS: 800,
};
// ───────────────────────────────────────────────────────────────

PlantRegistry.register({
  id: "lilybeam",
  name: "Lily Beam",
  image: "assets/plants/lilybeam.png",
  cost: 200,
  cooldown: 6000,
  fireDistance: 7,
  hitCount: 99,
  hp: 350,
  fireRate: 2500,
  description: `Fires a piercing <b style="color:#22d3ee">Ice Beam</b> at all demons in its lane. Also has a <b style="color:#22d3ee">Crystal Shield</b> that absorbs 1 hit automatically, then recharges.
<div style="margin-top:8px;display:flex;flex-direction:column;gap:5px">
  <div style="background:rgba(34,211,238,0.08);border-left:3px solid rgba(34,211,238,0.5);border-radius:4px;padding:5px 8px;font-size:10px;color:var(--white)">
    🔵 <b style="color:#7dd3fc">Lv 1–4:</b> Beam deals damage only. No status effect. Shield absorbs 1 hit then recharges.
  </div>
  <div style="background:rgba(147,210,255,0.08);border-left:3px solid rgba(147,210,255,0.5);border-radius:4px;padding:5px 8px;font-size:10px;color:var(--white)">
    🧊 <b style="color:#bae6fd">Lv 5–9:</b> Beam now applies a <b style="color:#bae6fd">50% Slow</b> to First demon it hits. Slow-immune demons are unaffected.
  </div>
  <div style="background:rgba(103,232,249,0.08);border-left:3px solid rgba(103,232,249,0.6);border-radius:4px;padding:5px 8px;font-size:10px;color:var(--white)">
    ❄️ <b style="color:#67e8f9">Lv 10–15:</b> Beam now fully <b style="color:#67e8f9">Freezes</b> First demon it hits. Freeze-immune demons are unaffected.
  </div>
</div>`,

  levelStats: {
    1:  { hp: 350,  damage: 18,  effectDuration: 0,    shieldCooldown: 8000 },
    2:  { hp: 420,  damage: 23,  effectDuration: 0,    shieldCooldown: 7500 },
    3:  { hp: 500,  damage: 29,  effectDuration: 0,    shieldCooldown: 7000 },
    4:  { hp: 600,  damage: 36,  effectDuration: 0,    shieldCooldown: 6500 },
    5:  { hp: 720,  damage: 44,  effectDuration: 2500, shieldCooldown: 6000 },
    6:  { hp: 860,  damage: 54,  effectDuration: 2800, shieldCooldown: 5500 },
    7:  { hp: 1000, damage: 65,  effectDuration: 3200, shieldCooldown: 5000 },
    8:  { hp: 1150, damage: 78,  effectDuration: 3600, shieldCooldown: 4500 },
    9:  { hp: 1300, damage: 92,  effectDuration: 4000, shieldCooldown: 4000 },
    10: { hp: 1500, damage: 108, effectDuration: 4000, shieldCooldown: 3500 },
    11: { hp: 1700, damage: 125, effectDuration: 4500, shieldCooldown: 3000 },
    12: { hp: 1900, damage: 144, effectDuration: 5000, shieldCooldown: 2800 },
    13: { hp: 2100, damage: 165, effectDuration: 5500, shieldCooldown: 2600 },
    14: { hp: 2350, damage: 188, effectDuration: 6000, shieldCooldown: 2400 },
    15: { hp: 2600, damage: 215, effectDuration: 6500, shieldCooldown: 2000 },
  },

  getStats(level) {
    const capped = Math.min(Math.max(1, level), 15);
    return this.levelStats[capped] || this.levelStats[1];
  },

  // Returns "none" | "slow" | "freeze" based on level
  _getTier(level) {
    if (level >= 10) return "freeze";
    if (level >= 5)  return "slow";
    return "none";
  },

  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp = stats.hp;
    plantData.hp = stats.hp;
    plantData.shieldReady = true;
    plantData.shieldTimer = 0;
    plantData.shieldCooldown = stats.shieldCooldown;

    const cell = Grid.getCellEl(row, col);
    if (cell) {
      const antDot = document.createElement("div");
      antDot.className = "lb-antenna-dot";
      cell.appendChild(antDot);

      const eyes = document.createElement("div");
      eyes.className = "lb-eyes";
      const eyeL = document.createElement("div"); eyeL.className = "lb-eye";
      const eyeR = document.createElement("div"); eyeR.className = "lb-eye";
      eyes.appendChild(eyeL); eyes.appendChild(eyeR);
      cell.appendChild(eyes);

      const circuit = document.createElement("div");
      circuit.className = "lb-circuit";
      cell.appendChild(circuit);
    }

    requestAnimationFrame(() => {
      const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
      if (img) img.classList.add("lb-idle");
    });

    showShieldEffect(row, col, true);
  },

  onTick(row, col, plantData) {
    const active = Demons.getActive();
    const cellEl = Grid.getCellEl(row, col);
    if (!cellEl) return;
    const cellRect = cellEl.getBoundingClientRect();
    const gridEl = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;

    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;

    const stats = this.getStats(plantData.level);
    const tier = this._getTier(plantData.level);

    SoundFX.play("beam_shoot");

    // Find closest demon in row for status effect
    let closestDemon = null, closestDist = Infinity;
    active.forEach((d) => {
      if (d.dead || d.row !== row) return;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return;
      const dist = dRect.left - cellRect.left;
      if (dist < closestDist) { closestDist = dist; closestDemon = d; }
    });

    active.forEach((d) => {
      if (d.dead || d.row !== row) return;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return;

      // Always deal damage to all demons in row
      Demons.damage(d, stats.damage, "beam");

      // Apply status only to the closest demon
      if (d !== closestDemon) return;

      if (tier === "freeze") {
        const dStats = Levels.getDemonStats(d.type);
        if (dStats && dStats.freezeImmune) return;
        Demons.freeze(d, stats.effectDuration);

      } else if (tier === "slow") {
        const dStats = Levels.getDemonStats(d.type);
        if (dStats && dStats.slowImmune) return;
        let duration = stats.effectDuration;
        if (dStats && dStats.slowResist) {
          duration = Math.floor(duration * (1 - dStats.slowResist));
        }
        if (duration > 0) {
          Demons.slow(d, duration, LILYBEAM_CFG.SLOW_MULTIPLIER);
        }
      }
    });

    // Charge → fire animation
    const img = cellEl.querySelector(".plant-entity");
    if (img && !plantData.firing) {
      plantData.firing = true;
      img.classList.remove("lb-idle");
      img.classList.add("lb-charge");

      setTimeout(() => {
        if (!img.isConnected) return;
        img.classList.remove("lb-charge");
        img.classList.add("lb-fire");

        const projLayer = document.getElementById("projectiles-layer");
        if (projLayer) {
          const layerRect = projLayer.getBoundingClientRect();
          const muzzle = document.createElement("div");
          muzzle.className = "lb-muzzle";
          muzzle.style.cssText = `
            left:${cellRect.right - layerRect.left}px;
            top:${cellRect.top - layerRect.top + cellRect.height * 0.5 - 7}px;
            width:${(gridRect ? gridRect.right : cellRect.right + 400) - cellRect.right}px;
          `;
          projLayer.appendChild(muzzle);
          setTimeout(() => muzzle.remove(), LILYBEAM_CFG.MUZZLE_FADE_MS);
        }

        setTimeout(() => {
          if (img.isConnected) {
            img.classList.remove("lb-fire");
            img.classList.add("lb-idle");
            plantData.firing = false;
          }
        }, LILYBEAM_CFG.FIRE_ANIM_MS);
      }, LILYBEAM_CFG.CHARGE_DELAY_MS);
    }

    showBeamEffect(row, col, tier);
  },

  onRemove(row, col) {
    const cell = Grid.getCellEl(row, col);
    if (cell) {
      cell.querySelector(".lb-antenna-dot")?.remove();
      cell.querySelector(".lb-eyes")?.remove();
      cell.querySelector(".lb-circuit")?.remove();
      cell.querySelector(".lb-shield-ring")?.remove();
    }
  },

  onDamage(row, col, plantData) {
    if (plantData.shieldReady) {
      plantData.shieldReady = false;
      plantData.shieldTimer = 0;
      showShieldEffect(row, col, false);
      showShieldBreak(row, col);
      return true; // absorbed
    }
    const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
    if (!img) return false;
    img.classList.remove("lb-idle", "lb-charge", "lb-fire");
    img.classList.add("lb-damaged");
    setTimeout(() => {
      if (img.isConnected) {
        img.classList.remove("lb-damaged");
        img.classList.add("lb-idle");
        plantData.firing = false;
      }
    }, 500);
    return false;
  },
});

// ── Visual helpers ──────────────────────────────────────────────

// tier colours: none=white, slow=light-blue, freeze=deep-cyan
function _beamColor(tier) {
  if (tier === "freeze") return { main: "rgba(103,232,249,0.9)", tail: "rgba(103,232,249,0.2)", glow: "rgba(103,232,249,0.8)" };
  if (tier === "slow")   return { main: "rgba(147,210,255,0.85)", tail: "rgba(147,210,255,0.15)", glow: "rgba(147,210,255,0.7)" };
  return                        { main: "rgba(220,240,255,0.75)", tail: "rgba(220,240,255,0.1)",  glow: "rgba(200,230,255,0.5)" };
}

function showBeamEffect(row, col, tier) {
  const cell = Grid.getCellEl(row, col);
  const layer = document.getElementById("effects-layer");
  if (!cell || !layer) return;

  const c = _beamColor(tier);
  const cellRect = cell.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  const arenaEl = document.getElementById("screen-battle");
  const arenaRect = arenaEl ? arenaEl.getBoundingClientRect() : null;

  const beam = document.createElement("div");
  beam.style.cssText = `
    position:absolute;
    left:${cellRect.right - layerRect.left}px;
    top:${cellRect.top - layerRect.top + cellRect.height * 0.5 - 5}px;
    width:${arenaRect ? arenaRect.right - cellRect.right : 800}px;
    height:10px;
    background:linear-gradient(90deg,${c.main},${c.tail});
    border-radius:5px;
    box-shadow:0 0 16px ${c.glow};
    pointer-events:none;
    z-index:20;
    animation:beamFade ${LILYBEAM_CFG.BEAM_FADE_MS}ms ease-out forwards;
  `;
  layer.appendChild(beam);

  if (!document.getElementById("beam-keyframe")) {
    const style = document.createElement("style");
    style.id = "beam-keyframe";
    style.textContent = "@keyframes beamFade{from{opacity:1}to{opacity:0}}";
    document.head.appendChild(style);
  }
  setTimeout(() => beam.remove(), LILYBEAM_CFG.BEAM_FADE_MS);
}

function showShieldEffect(row, col, active) {
  const cell = Grid.getCellEl(row, col);
  if (!cell) return;
  let shield = cell.querySelector(".lb-shield-ring");
  if (active) {
    if (!shield) {
      shield = document.createElement("div");
      shield.className = "lb-shield-ring";
      cell.appendChild(shield);
    }
  } else {
    shield?.remove();
  }
}

function showShieldBreak(row, col) {
  const cell = Grid.getCellEl(row, col);
  const layer = document.getElementById("effects-layer");
  if (!cell || !layer) return;
  const r = cell.getBoundingClientRect();
  const lr = layer.getBoundingClientRect();

  const absorb = document.createElement("div");
  absorb.className = "lb-shield-absorb";
  absorb.style.cssText = `
    position:absolute;
    left:${r.left - lr.left - 10}px;
    top:${r.top - lr.top - 10}px;
    width:${r.width + 20}px;
    height:${r.height + 20}px;
  `;
  layer.appendChild(absorb);

  const txt = document.createElement("div");
  txt.textContent = "BLOCKED!";
  txt.style.cssText = `
    position:absolute;
    font-family:var(--font-display);
    font-size:13px;font-weight:900;
    color:#22d3ee;
    text-shadow:0 0 8px rgba(34,211,238,0.9);
    left:${r.left - lr.left}px;
    top:${r.top - lr.top - 24}px;
    pointer-events:none;z-index:30;
    animation:floatUp 0.8s ease-out forwards;
  `;
  layer.appendChild(txt);
  setTimeout(() => { absorb.remove(); txt.remove(); }, LILYBEAM_CFG.BLOCKED_FLOAT_MS);
}