/* plants/glaciespore.js
   Glacie Spore — Ice-fist mushroom brawler.
   Fires straight frost projectiles with chill/slow/freeze tiers.

   Level 1–4  : Frost Punch  — straight frost ball, chill (30% slow 1.5s)
   Level 5–9  : Crystal Spike — every 3rd shot pierces ALL demons in lane, 50% slow
   Level 10–15: Blizzard Core — every 5th shot freezes ALL demons in lane simultaneously
*/

// ── Tunable config ──────────────────────────────────────────────
const GLACIESPORE_CFG = {
  CHILL_SLOW:        0.7,    // speed multiplier for chill (0.7 = 30% slow)
  CHILL_DURATION:    1500,   // ms for basic chill
  SLOW_MULTIPLIER:   0.5,    // speed multiplier for crystal spike slow
  SPIKE_EVERY:       3,      // every Nth shot = crystal spike (tier 2)
  BLIZZARD_EVERY:    5,      // every Nth shot = blizzard core (tier 3)
  PROJ_SPEED_MS:     320,    // ms for projectile to travel one cell worth
  BLIZZARD_DELAY_MS: 120,    // stagger delay between freezing each demon
};
// ───────────────────────────────────────────────────────────────

PlantRegistry.register({
  id: "glaciespore",
  name: "Glacie Spore",
  image: "assets/plants/glaciespore.png",
  cost: 175,
  cooldown: 7500,
  fireDistance: 8,
  hitCount: 1,
  hp: 300,
  fireRate: 3500,
  description: `Slams its <b style="color:#67e8f9">ice fists</b> to fire frost projectiles at demons. Each hit chills the target, slowing it briefly.
<div style="margin-top:8px;display:flex;flex-direction:column;gap:5px">
  <div style="background:rgba(103,232,249,0.08);border-left:3px solid rgba(103,232,249,0.5);border-radius:4px;padding:5px 8px;font-size:10px;color:var(--white)">
    🔵 <b style="color:#7dd3fc">Lv 1–4:</b> Straight frost ball hits first demon. Applies a <b style="color:#7dd3fc">30% Chill</b> for 1.5s.
  </div>
  <div style="background:rgba(147,210,255,0.08);border-left:3px solid rgba(147,210,255,0.5);border-radius:4px;padding:5px 8px;font-size:10px;color:var(--white)">
    🔷 <b style="color:#bae6fd">Lv 5–9:</b> Every ${GLACIESPORE_CFG.SPIKE_EVERY}rd shot fires a <b style="color:#bae6fd">Crystal Spike</b> that pierces ALL demons in the lane with a 50% slow.
  </div>
  <div style="background:rgba(186,230,253,0.08);border-left:3px solid rgba(186,230,253,0.6);border-radius:4px;padding:5px 8px;font-size:10px;color:var(--white)">
    ❄️ <b style="color:#67e8f9">Lv 10–15:</b> Every ${GLACIESPORE_CFG.BLIZZARD_EVERY}th shot unleashes <b style="color:#67e8f9">Blizzard Core</b> — a full-lane frost shockwave that freezes ALL demons simultaneously.
  </div>
</div>`,

  // ── Level stats ──────────────────────────────────────────────
  levelStats: {
    1:  { hp: 300,  fireRate: 3500, damage: 20, chillDur: 1500, effectDur: 0    },
    2:  { hp: 370,  fireRate: 3300, damage: 25, chillDur: 1600, effectDur: 0    },
    3:  { hp: 450,  fireRate: 3100, damage: 31, chillDur: 1700, effectDur: 0    },
    4:  { hp: 540,  fireRate: 2900, damage: 38, chillDur: 1800, effectDur: 0    },
    5:  { hp: 650,  fireRate: 2700, damage: 42, chillDur: 2000, effectDur: 2000 },
    6:  { hp: 770,  fireRate: 2500, damage: 50, chillDur: 2100, effectDur: 2200 },
    7:  { hp: 900,  fireRate: 2300, damage: 59, chillDur: 2200, effectDur: 2500 },
    8:  { hp: 1040, fireRate: 2100, damage: 69, chillDur: 2300, effectDur: 2800 },
    9:  { hp: 1190, fireRate: 1900, damage: 75, chillDur: 2400, effectDur: 3000 },
    10: { hp: 1360, fireRate: 1750, damage: 85, chillDur: 2500, effectDur: 3000 },
    11: { hp: 1540, fireRate: 1620, damage: 97, chillDur: 2600, effectDur: 3500 },
    12: { hp: 1730, fireRate: 1500, damage: 110,chillDur: 2700, effectDur: 4000 },
    13: { hp: 1930, fireRate: 1400, damage: 112,chillDur: 2800, effectDur: 4500 },
    14: { hp: 2150, fireRate: 1300, damage: 116,chillDur: 2900, effectDur: 5000 },
    15: { hp: 2400, fireRate: 1200, damage: 120,chillDur: 3000, effectDur: 5500 },
  },

  getStats(level) {
    const capped = Math.min(Math.max(1, level), 15);
    return this.levelStats[capped] || this.levelStats[1];
  },

  // Returns "basic" | "spike" | "blizzard"
  _getTier(level) {
    if (level >= 10) return "blizzard";
    if (level >= 5)  return "spike";
    return "basic";
  },

  // ── onPlace ──────────────────────────────────────────────────
  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp       = stats.hp;
    plantData.hp          = stats.hp;
    plantData.lastFireTime = 0;
    plantData.shotCount   = 0;
    plantData.punching    = false;

    const cell = Grid.getCellEl(row, col);
    if (cell) {
      // Ice crack lines on the body
      const cracks = document.createElement("div");
      cracks.className = "gs-cracks";
      cell.appendChild(cracks);

      // Crystal shards on cap (3 positions)
      for (let i = 0; i < 3; i++) {
        const crystal = document.createElement("div");
        crystal.className = `gs-crystal gs-crystal-${i}`;
        cell.appendChild(crystal);
      }

      // Cyan eye glow
      const eyes = document.createElement("div");
      eyes.className = "gs-eyes";
      const eyeL = document.createElement("div"); eyeL.className = "gs-eye";
      const eyeR = document.createElement("div"); eyeR.className = "gs-eye";
      eyes.appendChild(eyeL); eyes.appendChild(eyeR);
      cell.appendChild(eyes);

      // Fist glow elements
      const fistL = document.createElement("div");
      fistL.className = "gs-fist-glow gs-fist-l";
      cell.appendChild(fistL);

      const fistR = document.createElement("div");
      fistR.className = "gs-fist-glow gs-fist-r";
      cell.appendChild(fistR);

      // Aura ring
      const aura = document.createElement("div");
      aura.className = "gs-aura";
      cell.appendChild(aura);
    }

    requestAnimationFrame(() => {
      const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
      if (img) img.classList.add("gs-idle");
    });
  },

  // ── onTick ───────────────────────────────────────────────────
  onTick(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    const now   = Date.now();

    if (!plantData.lastFireTime) plantData.lastFireTime = 0;
    if (now - plantData.lastFireTime < stats.fireRate) return;
    if (!PlantRegistry.isDemonInRange(row, col, this.fireDistance)) return;

    const active  = Demons.getActive();
    const cellEl  = Grid.getCellEl(row, col);
    if (!cellEl) return;

    const cellRect = cellEl.getBoundingClientRect();
    const gridEl   = document.getElementById("grid-container");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;

    // Find closest demon in lane
    let target = null, closestDist = Infinity;
    active.forEach((d) => {
      if (d.dead || d.row !== row) return;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return;
      if (gridRect && dRect.left > gridRect.right) return;
      const dist = dRect.left - cellRect.right;
      if (dist < closestDist) { closestDist = dist; target = d; }
    });
    if (!target) return;

    plantData.lastFireTime = now;
    plantData.shotCount    = (plantData.shotCount || 0) + 1;

    const tier       = this._getTier(plantData.level);
    const isSpike    = (tier === "spike" || tier === "blizzard") &&
                       (plantData.shotCount % GLACIESPORE_CFG.SPIKE_EVERY === 0);
    const isBlizzard = tier === "blizzard" &&
                       (plantData.shotCount % GLACIESPORE_CFG.BLIZZARD_EVERY === 0);
    const shotKind   = isBlizzard ? "blizzard" : isSpike ? "spike" : "basic";

    SoundFX.play("beam_shoot");

    // ── Punch animation ──
    const img = cellEl.querySelector(".plant-entity");
    if (img && !plantData.punching) {
      plantData.punching = true;
      img.classList.remove("gs-idle");
      img.classList.add(
        isBlizzard ? "gs-punch-blizzard" :
        isSpike    ? "gs-punch-spike"    : "gs-punch"
      );
      setTimeout(() => {
        if (img.isConnected) {
          img.classList.remove("gs-punch", "gs-punch-spike", "gs-punch-blizzard");
          img.classList.add("gs-idle");
          plantData.punching = false;
        }
      }, isBlizzard ? 700 : isSpike ? 580 : 450);
    }

    // ── Fire after short windup delay ──
    setTimeout(() => {
      if (isBlizzard) {
        fireBlizzardCore(row, col, active, cellRect, gridRect, stats);
      } else if (isSpike) {
        fireCrystalSpike(row, col, active, cellRect, gridRect, stats);
      } else {
        fireFrostPunch(row, col, target, cellRect, stats);
      }
    }, 160);
  },

  // ── onRemove ─────────────────────────────────────────────────
  onRemove(row, col) {
    const cell = Grid.getCellEl(row, col);
    if (cell) {
      cell.querySelectorAll(
        ".gs-cracks,.gs-crystal,.gs-eyes,.gs-fist-glow,.gs-aura"
      ).forEach(el => el.remove());
    }
  },

  // ── onDamage ─────────────────────────────────────────────────
  onDamage(row, col, plantData) {
    const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
    if (!img) return;
    img.classList.remove("gs-idle", "gs-punch", "gs-punch-spike", "gs-punch-blizzard");
    img.classList.add("gs-damaged");
    setTimeout(() => {
      if (img.isConnected) {
        img.classList.remove("gs-damaged");
        img.classList.add("gs-idle");
        plantData.punching = false;
      }
    }, 480);
  },
});

// ══════════════════════════════════════════════════════════════
//  TIER 1 — FROST PUNCH (straight projectile, hits first demon)
// ══════════════════════════════════════════════════════════════
function fireFrostPunch(row, col, target, cellRect, stats) {
  const layer = document.getElementById("projectiles-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();

  const startX = cellRect.right - layerRect.left;
  const startY = cellRect.top   - layerRect.top + cellRect.height * 0.5 - 7;

  const proj = document.createElement("div");
  proj.className = "gs-proj-basic";
  proj.style.cssText = `
    position:absolute;
    left:${startX}px;
    top:${startY}px;
    pointer-events:none;
    z-index:15;
  `;
  layer.appendChild(proj);

  // Travel straight toward target using rAF
  const TRAVEL_MS = 380;
  const startTime = performance.now();

  const dRect  = target.el.getBoundingClientRect();
  const endX   = dRect.left - layerRect.left + dRect.width  * 0.5 - 7;
  const endY   = dRect.top  - layerRect.top  + dRect.height * 0.5 - 7;

  function animProj(now) {
    const t = Math.min((now - startTime) / TRAVEL_MS, 1);
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    proj.style.left = x + "px";
    proj.style.top  = y + "px";

    if (t < 1) {
      requestAnimationFrame(animProj);
    } else {
      proj.remove();
      // Impact
      if (!target.dead) {
        Demons.damage(target, stats.damage, "ice");
        // Apply chill (30% slow)
        const dStats = Levels.getDemonStats(target.type);
        if (!dStats?.slowImmune) {
          let dur = stats.chillDur;
          if (dStats?.slowResist) dur = Math.floor(dur * (1 - dStats.slowResist));
          if (dur > 0) Demons.slow(target, dur, GLACIESPORE_CFG.CHILL_SLOW);
        }
        showGsImpact(endX + 7, endY + 7, "basic", layerRect);
      }
    }
  }
  requestAnimationFrame(animProj);
}

// ══════════════════════════════════════════════════════════════
//  TIER 2 — CRYSTAL SPIKE (pierces ALL demons in lane)
// ══════════════════════════════════════════════════════════════
function fireCrystalSpike(row, col, active, cellRect, gridRect, stats) {
  const layer  = document.getElementById("projectiles-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();

  const startX = cellRect.right - layerRect.left;
  const startY = cellRect.top   - layerRect.top + cellRect.height * 0.5 - 9;

  // Collect all demons in row sorted left→right (closest first)
  const targets = active
    .filter(d => {
      if (d.dead || d.row !== row) return false;
      const dr = d.el.getBoundingClientRect();
      if (dr.left <= cellRect.left) return false;
      if (gridRect && dr.left > gridRect.right) return false;
      return true;
    })
    .sort((a, b) => {
      const ar = a.el.getBoundingClientRect();
      const br = b.el.getBoundingClientRect();
      return ar.left - br.left;
    });

  if (targets.length === 0) return;

  // Farthest demon = end of spike travel
  const lastTarget = targets[targets.length - 1];
  const lastRect   = lastTarget.el.getBoundingClientRect();
  const endX = lastRect.right - layerRect.left + 30;
  const endY = startY;

  const spike = document.createElement("div");
  spike.className = "gs-proj-spike";
  spike.style.cssText = `
    position:absolute;
    left:${startX}px;
    top:${startY}px;
    pointer-events:none;
    z-index:15;
  `;
  layer.appendChild(spike);

  const TRAVEL_MS = 420;
  const startTime = performance.now();

  // Track which demons already got hit
  const hit = new Set();

  function animSpike(now) {
    const t = Math.min((now - startTime) / TRAVEL_MS, 1);
    const x = startX + (endX - startX) * t;
    spike.style.left = x + "px";

    // Check each target as spike passes through
    targets.forEach(d => {
      if (hit.has(d) || d.dead) return;
      const dr = d.el.getBoundingClientRect();
      const dCx = dr.left - layerRect.left + dr.width * 0.5;
      if (x >= dCx - 10) {
        hit.add(d);
        Demons.damage(d, stats.damage, "ice");
        // 50% slow
        const dStats = Levels.getDemonStats(d.type);
        if (!dStats?.slowImmune) {
          let dur = stats.effectDur;
          if (dStats?.slowResist) dur = Math.floor(dur * (1 - dStats.slowResist));
          if (dur > 0) Demons.slow(d, dur, GLACIESPORE_CFG.SLOW_MULTIPLIER);
        }
        showGsImpact(dCx, startY + 9, "spike", layerRect);
      }
    });

    if (t < 1) {
      requestAnimationFrame(animSpike);
    } else {
      spike.remove();
    }
  }
  requestAnimationFrame(animSpike);
}

// ══════════════════════════════════════════════════════════════
//  TIER 3 — BLIZZARD CORE (screen shockwave, freezes ALL in lane)
// ══════════════════════════════════════════════════════════════
function fireBlizzardCore(row, col, active, cellRect, gridRect, stats) {
  const layer  = document.getElementById("projectiles-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();

  // Shockwave expanding ring from the plant
  const shockX = cellRect.right - layerRect.left;
  const shockY = cellRect.top   - layerRect.top + cellRect.height * 0.5;

  const wave = document.createElement("div");
  wave.className = "gs-blizzard-wave";
  wave.style.cssText = `
    position:absolute;
    left:${shockX - 20}px;
    top:${shockY - 20}px;
    width:40px; height:40px;
    pointer-events:none;
    z-index:18;
  `;
  layer.appendChild(wave);
  setTimeout(() => wave.remove(), 700);

  // Collect all demons in row
  const targets = active.filter(d => {
    if (d.dead || d.row !== row) return false;
    const dr = d.el.getBoundingClientRect();
    if (dr.left <= cellRect.left) return false;
    if (gridRect && dr.left > gridRect.right) return false;
    return true;
  });

  if (targets.length === 0) return;

  // Show blizzard screen flash
  showBlizzardFlash();

  // Freeze each demon with slight stagger
  targets.forEach((d, i) => {
    setTimeout(() => {
      if (d.dead) return;
      Demons.damage(d, stats.damage, "ice");
      const dStats = Levels.getDemonStats(d.type);
      if (!dStats?.freezeImmune) {
        Demons.freeze(d, stats.effectDur);
      }
      // Ice crystal eruption at demon
      const dr = d.el.getBoundingClientRect();
      const dcx = dr.left - layerRect.left + dr.width  * 0.5;
      const dcy = dr.top  - layerRect.top  + dr.height * 0.5;
      showGsImpact(dcx, dcy, "blizzard", layerRect);
    }, i * GLACIESPORE_CFG.BLIZZARD_DELAY_MS);
  });

  // BLIZZARD! float text at plant
  showBlizzardText(cellRect, layerRect);
}

// ══════════════════════════════════════════════════════════════
//  VISUAL EFFECTS
// ══════════════════════════════════════════════════════════════
function showGsImpact(cx, cy, kind, layerRect) {
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl) return;
  const eRect = effectsEl.getBoundingClientRect();
  const ex = cx + layerRect.left - eRect.left;
  const ey = cy + layerRect.top  - eRect.top;

  // Impact ring
  const ring = document.createElement("div");
  ring.className =
    kind === "blizzard" ? "gs-impact-ring gs-ring-blizzard" :
    kind === "spike"    ? "gs-impact-ring gs-ring-spike"    :
                          "gs-impact-ring";
  ring.style.cssText = `left:${ex - 20}px; top:${ey - 20}px;`;
  effectsEl.appendChild(ring);
  setTimeout(() => ring.remove(), 550);

  // Ice shards bursting outward (4 for basic, 6 for spike, 8 for blizzard)
  const count = kind === "blizzard" ? 8 : kind === "spike" ? 6 : 4;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist  = kind === "blizzard" ? 28 + Math.random() * 20
                : kind === "spike"    ? 20 + Math.random() * 14
                :                        12 + Math.random() * 10;
    const shard = document.createElement("div");
    shard.className = "gs-shard";
    shard.style.cssText = `
      left:${ex - 3}px; top:${ey - 8}px;
      --sx:${Math.cos(angle) * dist}px;
      --sy:${Math.sin(angle) * dist}px;
      --sr:${(angle * 180 / Math.PI).toFixed(0)}deg;
      animation-delay:${i * 0.025}s;
    `;
    effectsEl.appendChild(shard);
    setTimeout(() => shard.remove(), 480);
  }

  // Float text
  const labels = { basic: "CHILLED!", spike: "PIERCED!", blizzard: "FROZEN!" };
  const colors = { basic: "#7dd3fc", spike: "#bae6fd", blizzard: "#67e8f9" };
  const txt = document.createElement("div");
  txt.textContent = labels[kind];
  txt.style.cssText = `
    position:absolute;
    left:${ex - 28}px; top:${ey - 28}px;
    font-family:var(--font-display);
    font-size:${kind === "basic" ? 10 : 12}px; font-weight:900;
    color:${colors[kind]};
    text-shadow:0 0 8px ${colors[kind]};
    pointer-events:none; z-index:42;
    animation:floatUp 0.9s ease-out forwards;
  `;
  effectsEl.appendChild(txt);
  setTimeout(() => txt.remove(), 900);
}

function showBlizzardFlash() {
  const flash = document.createElement("div");
  flash.style.cssText = `
    position:fixed;inset:0;
    background:rgba(103,232,249,0.18);
    pointer-events:none;z-index:9999;
    animation:gsBlizzardFlash 0.5s ease-out forwards;
  `;
  document.body.appendChild(flash);
  if (!document.getElementById("gs-blizzard-kf")) {
    const s = document.createElement("style");
    s.id = "gs-blizzard-kf";
    s.textContent = "@keyframes gsBlizzardFlash{0%{opacity:1}100%{opacity:0}}";
    document.head.appendChild(s);
  }
  setTimeout(() => flash.remove(), 500);
}

function showBlizzardText(cellRect, layerRect) {
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl) return;
  const eRect = effectsEl.getBoundingClientRect();
  const ex = cellRect.right - layerRect.left + cellRect.width * 0.5 + layerRect.left - eRect.left;
  const ey = cellRect.top   - layerRect.top  - 10 + layerRect.top  - eRect.top;

  const txt = document.createElement("div");
  txt.textContent = "BLIZZARD!";
  txt.style.cssText = `
    position:absolute;
    left:${ex - 36}px; top:${ey}px;
    font-family:var(--font-display);
    font-size:15px; font-weight:900;
    color:#67e8f9;
    text-shadow:0 0 12px rgba(103,232,249,1), 0 0 24px rgba(103,232,249,0.6);
    pointer-events:none; z-index:43;
    animation:floatUp 1.1s ease-out forwards;
  `;
  effectsEl.appendChild(txt);
  setTimeout(() => txt.remove(), 1100);
}
