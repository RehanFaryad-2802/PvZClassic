/* plants/cosmbloom.js
   Cosmbloom — Cosmic Ghost Witch Mushroom.
   Hurls glowing soul orbs that leave spectral damage.

   Level 1–4  : Soul Orb — floating ghost orb hits first demon, leaves short DoT wisp
   Level 5–9  : Spectral Haunt — every 3rd orb splits into 3 homing wisps on impact,
                applies Ghost Mark (+20% dmg taken for 4s)
   Level 10–15: Void Bloom — every 5th shot erupts a dark void flower on ALL lane demons,
                applies Soul Drain (3% current HP/s for 5s)
*/

// ── Tunable config ──────────────────────────────────────────────
const COSMBLOOM_CFG = {
  DOT_TICK_MS:        500,   // ms between DoT ticks
  DOT_DURATION_MS:    1000,  // basic soul wisp DoT duration
  HAUNT_EVERY:        3,     // every Nth shot = spectral haunt (tier 2)
  VOID_EVERY:         5,     // every Nth shot = void bloom (tier 3)
  GHOST_MARK_BONUS:   0.20,  // +20% damage taken
  SOUL_DRAIN_PCT:     0.03,  // 3% current HP per tick
  SOUL_DRAIN_TICK_MS: 1000,  // soul drain tick interval
  SOUL_DRAIN_DUR_MS:  5000,  // soul drain total duration
  ORB_TRAVEL_MS:      600,   // ms for basic orb to travel
  WISP_SEEK_MS:       500,   // ms for homing wisps
  VOID_DELAY_MS:      100,   // stagger between void blooms on each demon
  FLOAT_WOBBLE_AMP:   6,     // px vertical wobble on orb flight
};
// ───────────────────────────────────────────────────────────────

// Global ghost mark tracker: demonId -> { expiry, bonus }
const _cbGhostMarks = new Map();

// Apply ghost mark to a demon element reference
function _applyGhostMark(d, duration) {
  const key = d.el;
  _cbGhostMarks.set(key, { expiry: Date.now() + duration, bonus: COSMBLOOM_CFG.GHOST_MARK_BONUS });
  // Visual mark indicator
  showGhostMarkEffect(d);
}

// Check if a demon has ghost mark (returns bonus or 0)
function _getGhostMarkBonus(d) {
  const entry = _cbGhostMarks.get(d.el);
  if (!entry) return 0;
  if (Date.now() > entry.expiry) { _cbGhostMarks.delete(d.el); return 0; }
  return entry.bonus;
}

// Damage with ghost mark amplification
function _ghostDamage(d, base, type) {
  const bonus = _getGhostMarkBonus(d);
  const total = Math.round(base * (1 + bonus));
  Demons.damage(d, total, type);
  return total;
}

PlantRegistry.register({
  id: "cosmbloom",
  name: "Cosmbloom",
  image: "assets/plants/cosmbloom.png",
  cost: 225,
  cooldown: 7000,
  fireDistance: 8,
  hitCount: 1,
  hp: 320,
  fireRate: 3000,
  description: `Channels <b style="color:#2dd4bf">cosmic soul energy</b> into a dark rift that pushes demons back to the row start and tears one into a random lane.
<div style="margin-top:8px;display:flex;flex-direction:column;gap:5px">
  <div style="background:rgba(45,212,191,0.08);border-left:3px solid rgba(45,212,191,0.5);border-radius:4px;padding:5px 8px;font-size:10px;color:var(--white)">
    👻 <b style="color:#5eead4">Lv 1–4:</b> Every shot sends demons in the row back to the nearest spawn edge while firing a spectral soul orb.
  </div>
  <div style="background:rgba(167,139,250,0.08);border-left:3px solid rgba(167,139,250,0.5);border-radius:4px;padding:5px 8px;font-size:10px;color:var(--white)">
    🌀 <b style="color:#c4b5fd">Lv 5–9:</b> Every 3–4 shots also rips a random demon into another row, disrupting enemy paths.
  </div>
  <div style="background:rgba(45,212,191,0.06);border-left:3px solid rgba(45,212,191,0.7);border-radius:4px;padding:5px 8px;font-size:10px;color:var(--white)">
    🌌 <b style="color:#2dd4bf">Lv 10–15:</b> Adds a <b style="color:#2dd4bf">Void Shard Barrage</b> — dark cosmic shards streak from the plant and strike multiple demons.
  </div>
</div>`,

  levelStats: {
    1:  { hp: 320,  fireRate: 3000, damage: 22,  dotDmg: 8,   effectDur: 4000 },
    2:  { hp: 390,  fireRate: 2800, damage: 28,  dotDmg: 10,  effectDur: 4000 },
    3:  { hp: 470,  fireRate: 2600, damage: 35,  dotDmg: 13,  effectDur: 4000 },
    4:  { hp: 560,  fireRate: 2400, damage: 43,  dotDmg: 16,  effectDur: 4000 },
    5:  { hp: 660,  fireRate: 2200, damage: 48,  dotDmg: 18,  effectDur: 4000 },
    6:  { hp: 780,  fireRate: 2050, damage: 56,  dotDmg: 21,  effectDur: 4200 },
    7:  { hp: 910,  fireRate: 1900, damage: 65,  dotDmg: 25,  effectDur: 4400 },
    8:  { hp: 1050, fireRate: 1750, damage: 75,  dotDmg: 29,  effectDur: 4600 },
    9:  { hp: 1200, fireRate: 1620, damage: 86,  dotDmg: 33,  effectDur: 4800 },
    10: { hp: 1380, fireRate: 1500, damage: 98,  dotDmg: 38,  effectDur: 5000 },
    11: { hp: 1570, fireRate: 1400, damage: 112, dotDmg: 43,  effectDur: 5000 },
    12: { hp: 1760, fireRate: 1300, damage: 128, dotDmg: 49,  effectDur: 5000 },
    13: { hp: 1960, fireRate: 1200, damage: 146, dotDmg: 56,  effectDur: 5000 },
    14: { hp: 2180, fireRate: 1120, damage: 166, dotDmg: 63,  effectDur: 5000 },
    15: { hp: 2420, fireRate: 1050, damage: 188, dotDmg: 72,  effectDur: 5000 },
  },

  getStats(level) {
    const capped = Math.min(Math.max(1, level), 15);
    return this.levelStats[capped] || this.levelStats[1];
  },

  _getTier(level) {
    if (level >= 10) return "void";
    if (level >= 5)  return "haunt";
    return "basic";
  },

  // ── onPlace ──────────────────────────────────────────────────
  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp     = stats.hp;
    plantData.hp        = stats.hp;
    plantData.shotCount = 0;
    plantData.casting   = false;
    plantData.nextRowTeleport = 3 + Math.floor(Math.random() * 2);

    const cell = Grid.getCellEl(row, col);
    if (cell) {
      // Cosmic core ring and aura
      const core = document.createElement("div");
      core.className = "cb-core-ring";
      cell.appendChild(core);

      const aura = document.createElement("div");
      aura.className = "cb-aura";
      cell.appendChild(aura);
    }

    requestAnimationFrame(() => {
      const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
      if (img) img.classList.add("cb-idle");
    });
  },

  // ── onTick ───────────────────────────────────────────────────
  onTick(row, col, plantData) {
    const stats = this.getStats(plantData.level);
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
      const dist = dRect.left - cellRect.left;
      if (dist < closestDist) { closestDist = dist; target = d; }
    });
    if (!target) return;

    plantData.shotCount = (plantData.shotCount || 0) + 1;
    if (!plantData.nextRowTeleport) {
      plantData.nextRowTeleport = 3 + Math.floor(Math.random() * 2);
    }

    const isRandomRowTeleport = plantData.level >= 5 &&
      plantData.shotCount >= plantData.nextRowTeleport;
    if (isRandomRowTeleport) {
      plantData.nextRowTeleport += 3 + Math.floor(Math.random() * 2);
    }
    const doShardBarrage = plantData.level >= 10 && isRandomRowTeleport;

    const tier       = this._getTier(plantData.level);
    const isHaunt    = (tier === "haunt" || tier === "void") &&
                       (plantData.shotCount % COSMBLOOM_CFG.HAUNT_EVERY === 0);
    const isVoid     = tier === "void" &&
                       (plantData.shotCount % COSMBLOOM_CFG.VOID_EVERY === 0);
    const shotKind   = isVoid ? "void" : isHaunt ? "haunt" : "basic";

    SoundFX.play("beam_shoot");

    // ── Cast animation ──
    const img = cellEl.querySelector(".plant-entity");
    if (img && !plantData.casting) {
      plantData.casting = true;
      img.classList.remove("cb-idle");
      img.classList.add(
        isVoid  ? "cb-cast-void"  :
        isHaunt ? "cb-cast-haunt" : "cb-cast"
      );
      setTimeout(() => {
        if (img.isConnected) {
          img.classList.remove("cb-cast", "cb-cast-haunt", "cb-cast-void");
          img.classList.add("cb-idle");
          plantData.casting = false;
        }
      }, isVoid ? 750 : isHaunt ? 600 : 450);
    }

    // ── Fire after windup ──
    setTimeout(() => {
      if (isVoid) {
        fireVoidBloom(row, col, active, cellRect, gridRect, stats, doShardBarrage, isRandomRowTeleport);
      } else if (isHaunt) {
        fireHauntOrb(row, col, target, active, cellRect, gridRect, stats, doShardBarrage, isRandomRowTeleport);
      } else {
        fireSoulOrb(row, col, target, active, cellRect, gridRect, stats, doShardBarrage, isRandomRowTeleport);
      }
    }, 180);
  },

  // ── onRemove ─────────────────────────────────────────────────
  onRemove(row, col) {
    const cell = Grid.getCellEl(row, col);
    if (cell) {
      cell.querySelectorAll(
        ".cb-core-ring,.cb-aura"
      ).forEach(el => el.remove());
    }
  },

  // ── onDamage ─────────────────────────────────────────────────
  onDamage(row, col, plantData) {
    const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
    if (!img) return;
    img.classList.remove("cb-idle", "cb-cast", "cb-cast-haunt", "cb-cast-void");
    img.classList.add("cb-damaged");
    setTimeout(() => {
      if (img.isConnected) {
        img.classList.remove("cb-damaged");
        img.classList.add("cb-idle");
        plantData.casting = false;
      }
    }, 480);
  },
});

// ══════════════════════════════════════════════════════════════
//  TIER 1 — SOUL ORB (floating ghost orb, short DoT wisp)
// ══════════════════════════════════════════════════════════════
function fireSoulOrb(row, col, target, active, cellRect, gridRect, stats, doShardBarrage, randomTeleport) {
  const layer  = document.getElementById("projectiles-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();

  const startX = cellRect.right - layerRect.left - 10;
  const startY = cellRect.top   - layerRect.top  + cellRect.height * 0.52 - 8;

  const orb = document.createElement("div");
  orb.className = "cb-proj-orb";
  orb.style.cssText = `position:absolute;left:${startX}px;top:${startY}px;pointer-events:none;z-index:15;`;
  layer.appendChild(orb);

  const dRect  = target.el.getBoundingClientRect();
  const endX   = dRect.left  - layerRect.left + dRect.width  * 0.5 - 8;
  const endY   = dRect.top   - layerRect.top  + dRect.height * 0.5 - 8;

  const TRAVEL = COSMBLOOM_CFG.ORB_TRAVEL_MS;
  const AMP    = COSMBLOOM_CFG.FLOAT_WOBBLE_AMP;
  const startT = performance.now();

  function animOrb(now) {
    const t = Math.min((now - startT) / TRAVEL, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const x = startX + (endX - startX) * ease;
    const y = startY + (endY - startY) * ease + Math.sin(t * Math.PI * 2) * AMP;
    orb.style.left = x + "px";
    orb.style.top  = y + "px";

    if (t < 1) {
      requestAnimationFrame(animOrb);
    } else {
      orb.remove();
      if (!target.dead) {
        _ghostDamage(target, stats.damage, "soul");
        showCbImpact(endX + 8, endY + 8, "basic", layerRect);
        // Leave soul wisp DoT
        applySoulWisp(target, stats.dotDmg, COSMBLOOM_CFG.DOT_DURATION_MS, COSMBLOOM_CFG.DOT_TICK_MS);
        sendRowDemonsToStart(row, active, gridRect, layerRect);
        if (randomTeleport) teleportOneDemonToRandomRow(row, active, gridRect, layerRect);
        if (doShardBarrage) fireVoidShardBarrage(row, col, active, cellRect, layerRect, stats);
      }
    }
  }
  requestAnimationFrame(animOrb);
}

// ══════════════════════════════════════════════════════════════
//  TIER 2 — HAUNTING ORB (splits into 3 homing wisps + ghost mark)
// ══════════════════════════════════════════════════════════════
function fireHauntOrb(row, col, target, active, cellRect, gridRect, stats, doShardBarrage, randomTeleport) {
  const layer  = document.getElementById("projectiles-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();

  const startX = cellRect.right - layerRect.left - 10;
  const startY = cellRect.top   - layerRect.top  + cellRect.height * 0.52 - 8;

  // Haunting orb (bigger, purple glow)
  const orb = document.createElement("div");
  orb.className = "cb-proj-orb cb-proj-haunt";
  orb.style.cssText = `position:absolute;left:${startX}px;top:${startY}px;pointer-events:none;z-index:15;`;
  layer.appendChild(orb);

  const dRect  = target.el.getBoundingClientRect();
  const endX   = dRect.left  - layerRect.left + dRect.width  * 0.5 - 10;
  const endY   = dRect.top   - layerRect.top  + dRect.height * 0.5 - 10;

  const TRAVEL = COSMBLOOM_CFG.ORB_TRAVEL_MS - 80;
  const startT = performance.now();

  function animHaunt(now) {
    const t = Math.min((now - startT) / TRAVEL, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const wobble = Math.sin(t * Math.PI * 3) * 8;
    orb.style.left = (startX + (endX - startX) * ease) + "px";
    orb.style.top  = (startY + (endY - startY) * ease + wobble) + "px";

    if (t < 1) {
      requestAnimationFrame(animHaunt);
    } else {
      orb.remove();
      if (!target.dead) {
        _ghostDamage(target, stats.damage, "soul");
        showCbImpact(endX + 10, endY + 10, "haunt", layerRect);
        // Spawn 3 homing wisps targeting closest 3 demons in lane
        spawnHomingWisps(row, col, active, endX + 10, endY + 10, layerRect, stats);
        sendRowDemonsToStart(row, active, gridRect, layerRect);
        if (randomTeleport) teleportOneDemonToRandomRow(row, active, gridRect, layerRect);
        if (doShardBarrage) fireVoidShardBarrage(row, col, active, cellRect, layerRect, stats);
      }
    }
  }
  requestAnimationFrame(animHaunt);
}

// Spawn homing wisps after haunt orb impact
function spawnHomingWisps(row, col, active, originX, originY, layerRect, stats) {
  const layer = document.getElementById("projectiles-layer");
  if (!layer) return;

  const cellEl = Grid.getCellEl(row, col);
  const cellRect = cellEl ? cellEl.getBoundingClientRect() : null;

  // Get up to 3 demons in lane (excluding dead)
  const targets = active
    .filter(d => {
      if (d.dead || d.row !== row) return false;
      if (cellRect) {
        const dr = d.el.getBoundingClientRect();
        if (dr.left <= cellRect.left) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ar = a.el.getBoundingClientRect();
      const br = b.el.getBoundingClientRect();
      return ar.left - br.left;
    })
    .slice(0, 3);

  if (targets.length === 0) return;

  targets.forEach((t, i) => {
    setTimeout(() => {
      if (t.dead) return;
      const wisp = document.createElement("div");
      wisp.className = "cb-wisp";
      wisp.style.cssText = `position:absolute;left:${originX - 6}px;top:${originY - 6}px;pointer-events:none;z-index:15;`;
      layer.appendChild(wisp);

      const dRect  = t.el.getBoundingClientRect();
      const tX     = dRect.left - layerRect.left + dRect.width  * 0.5 - 6;
      const tY     = dRect.top  - layerRect.top  + dRect.height * 0.5 - 6;

      const SEEK = COSMBLOOM_CFG.WISP_SEEK_MS;
      const st   = performance.now();

      function animWisp(now) {
        const p = Math.min((now - st) / SEEK, 1);
        // Wobbly homing path
        const dx = tX - originX;
        const dy = tY - originY;
        const cx = originX + dx * p + Math.sin(p * Math.PI * 4) * 12;
        const cy = originY + dy * p + Math.cos(p * Math.PI * 3) * 8;
        wisp.style.left = cx + "px";
        wisp.style.top  = cy + "px";

        if (p < 1) {
          requestAnimationFrame(animWisp);
        } else {
          wisp.remove();
          if (!t.dead) {
            _ghostDamage(t, Math.round(stats.damage * 0.5), "soul");
            _applyGhostMark(t, 4000);
            showCbImpact(tX + 6, tY + 6, "wisp", layerRect);
          }
        }
      }
      requestAnimationFrame(animWisp);
    }, i * 80);
  });
}

// ══════════════════════════════════════════════════════════════
//  TIER 3 — VOID BLOOM (erupts on all demons, soul drain)
// ══════════════════════════════════════════════════════════════
function fireVoidBloom(row, col, active, cellRect, gridRect, stats, doShardBarrage, randomTeleport) {
  const layer  = document.getElementById("projectiles-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();

  // Collect all demons in lane
  const targets = active.filter(d => {
    if (d.dead || d.row !== row) return false;
    const dr = d.el.getBoundingClientRect();
    if (dr.left <= cellRect.left) return false;
    if (gridRect && dr.left > gridRect.right) return false;
    return true;
  });

  if (targets.length === 0) return;

  // Dark void shockwave from plant
  const shockX = cellRect.right - layerRect.left - 10;
  const shockY = cellRect.top   - layerRect.top  + cellRect.height * 0.5;

  const wave = document.createElement("div");
  wave.className = "cb-void-wave";
  wave.style.cssText = `position:absolute;left:${shockX - 25}px;top:${shockY - 25}px;width:50px;height:50px;pointer-events:none;z-index:18;`;
  layer.appendChild(wave);
  setTimeout(() => wave.remove(), 700);

  // Screen dark flash
  showVoidFlash();

  // Bloom erupts on each demon with stagger
  targets.forEach((d, i) => {
    setTimeout(() => {
      if (d.dead) return;
      _ghostDamage(d, stats.damage, "soul");
      // Soul drain DoT
      applySoulDrain(d, stats);
      // Bloom visual
      const dr  = d.el.getBoundingClientRect();
      const dcx = dr.left - layerRect.left + dr.width  * 0.5;
      const dcy = dr.top  - layerRect.top  + dr.height * 0.5;
      showCbImpact(dcx, dcy, "void", layerRect);
      showVoidBloomFlower(dcx, dcy, layerRect);
    }, i * COSMBLOOM_CFG.VOID_DELAY_MS);
  });

  sendRowDemonsToStart(row, active, gridRect, layerRect);
  if (randomTeleport) teleportOneDemonToRandomRow(row, active, gridRect, layerRect);
  if (doShardBarrage) fireVoidShardBarrage(row, col, active, cellRect, layerRect, stats);

  // "VOID BLOOM!" text
  showVoidText(cellRect, layerRect);
}

// ══════════════════════════════════════════════════════════════
//  STATUS EFFECTS
// ══════════════════════════════════════════════════════════════

// Soul wisp: short DoT ticking after basic orb impact
function applySoulWisp(d, dotDmg, duration, tickMs) {
  const ticks = Math.floor(duration / tickMs);
  let count = 0;
  const iv = setInterval(() => {
    if (d.dead || count >= ticks) { clearInterval(iv); return; }
    _ghostDamage(d, dotDmg, "soul");
    count++;
  }, tickMs);
}

// Soul drain: 3% current HP per tick
function applySoulDrain(d, stats) {
  const TICK = COSMBLOOM_CFG.SOUL_DRAIN_TICK_MS;
  const TICKS = Math.floor(COSMBLOOM_CFG.SOUL_DRAIN_DUR_MS / TICK);
  let count = 0;

  const iv = setInterval(() => {
    if (d.dead || count >= TICKS) { clearInterval(iv); return; }
    const hpNow = d.hp || 1;
    const drain = Math.max(1, Math.round(hpNow * COSMBLOOM_CFG.SOUL_DRAIN_PCT));
    _ghostDamage(d, drain, "soul");
    count++;
  }, TICK);
}

// ══════════════════════════════════════════════════════════════
//  VISUAL EFFECTS
// ══════════════════════════════════════════════════════════════
function showCbImpact(cx, cy, kind, layerRect) {
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl) return;
  const eRect = effectsEl.getBoundingClientRect();
  const ex = cx + layerRect.left - eRect.left;
  const ey = cy + layerRect.top  - eRect.top;

  // Impact ring
  const ring = document.createElement("div");
  ring.className = kind === "void"  ? "cb-impact-ring cb-ring-void"  :
                   kind === "haunt" ? "cb-impact-ring cb-ring-haunt" :
                   kind === "wisp"  ? "cb-impact-ring cb-ring-wisp"  :
                                      "cb-impact-ring";
  const rSize = kind === "void" ? 60 : kind === "haunt" ? 50 : 36;
  ring.style.cssText = `left:${ex - rSize/2}px;top:${ey - rSize/2}px;`;
  effectsEl.appendChild(ring);
  setTimeout(() => ring.remove(), 550);

  // Ghost particles burst
  const count = kind === "void" ? 8 : kind === "haunt" ? 6 : 4;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist  = kind === "void"  ? 30 + Math.random() * 20 :
                  kind === "haunt" ? 22 + Math.random() * 14 :
                                     12 + Math.random() * 10;
    const p = document.createElement("div");
    p.className = "cb-ghost-particle";
    p.style.cssText = `
      left:${ex - 4}px;top:${ey - 4}px;
      --sx:${(Math.cos(angle) * dist).toFixed(1)}px;
      --sy:${(Math.sin(angle) * dist).toFixed(1)}px;
      --sr:${((angle * 180 / Math.PI)).toFixed(0)}deg;
      animation-delay:${i * 0.03}s;
    `;
    effectsEl.appendChild(p);
    setTimeout(() => p.remove(), 500);
  }

  // Float label
  const labels = { basic: "HAUNTED!", haunt: "MARKED!", wisp: "MARKED!", void: "DRAINED!" };
  const colors  = { basic: "#5eead4", haunt: "#c4b5fd", wisp: "#c4b5fd", void: "#2dd4bf" };
  const txt = document.createElement("div");
  txt.textContent = labels[kind] || "HIT!";
  txt.style.cssText = `
    position:absolute;
    left:${ex - 30}px;top:${ey - 28}px;
    font-family:var(--font-display);
    font-size:${kind === "void" ? 13 : 10}px;font-weight:900;
    color:${colors[kind] || "#5eead4"};
    text-shadow:0 0 8px ${colors[kind] || "#5eead4"};
    pointer-events:none;z-index:42;
    animation:floatUp 0.9s ease-out forwards;
  `;
  effectsEl.appendChild(txt);
  setTimeout(() => txt.remove(), 900);
}

function showGhostMarkEffect(d) {
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl || !d.el) return;
  const eRect = effectsEl.getBoundingClientRect();
  const dRect = d.el.getBoundingClientRect();
  const ex = dRect.left - eRect.left + dRect.width  * 0.5;
  const ey = dRect.top  - eRect.top;

  const mark = document.createElement("div");
  mark.className = "cb-ghost-mark";
  mark.style.cssText = `left:${ex - 16}px;top:${ey - 20}px;`;
  effectsEl.appendChild(mark);
  setTimeout(() => mark.remove(), 4000);
}

function showVoidBloomFlower(cx, cy, layerRect) {
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl) return;
  const eRect = effectsEl.getBoundingClientRect();
  const ex = cx + layerRect.left - eRect.left;
  const ey = cy + layerRect.top  - eRect.top;

  const flower = document.createElement("div");
  flower.className = "cb-void-flower";
  flower.style.cssText = `left:${ex - 20}px;top:${ey - 20}px;`;
  effectsEl.appendChild(flower);
  setTimeout(() => flower.remove(), 900);
}

function showVoidFlash() {
  const flash = document.createElement("div");
  flash.style.cssText = `
    position:fixed;inset:0;
    background:rgba(15,5,30,0.35);
    pointer-events:none;z-index:9999;
    animation:cbVoidFlash 0.6s ease-out forwards;
  `;
  document.body.appendChild(flash);
  if (!document.getElementById("cb-void-kf")) {
    const s = document.createElement("style");
    s.id = "cb-void-kf";
    s.textContent = "@keyframes cbVoidFlash{0%{opacity:1}100%{opacity:0}}";
    document.head.appendChild(s);
  }
  setTimeout(() => flash.remove(), 600);
}

function showVoidText(cellRect, layerRect) {
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl) return;
  const eRect = effectsEl.getBoundingClientRect();
  const ex = cellRect.right - layerRect.left + layerRect.left - eRect.left;
  const ey = cellRect.top   - layerRect.top  - 12 + layerRect.top - eRect.top;

  const txt = document.createElement("div");
  txt.textContent = "VOID BLOOM!";
  txt.style.cssText = `
    position:absolute;
    left:${ex - 42}px;top:${ey}px;
    font-family:var(--font-display);
    font-size:15px;font-weight:900;
    color:#2dd4bf;
    text-shadow:0 0 12px rgba(45,212,191,1),0 0 24px rgba(45,212,191,0.6),0 0 40px rgba(167,139,250,0.4);
    pointer-events:none;z-index:43;
    animation:floatUp 1.1s ease-out forwards;
  `;
  effectsEl.appendChild(txt);
  setTimeout(() => txt.remove(), 1100);
}

function sendRowDemonsToStart(row, active, gridRect, layerRect) {
  if (!gridRect || !layerRect) return;
  const startX = gridRect.right - layerRect.left - 8;

  active.forEach((d) => {
    if (d.dead || d.row !== row) return;
    d.x = startX;
    d.el.style.left = d.x + "px";
    d.targeting = null;
    d.biteTimer = 0;

    const rowEl = document.querySelector(`.grid-row[data-row="${row}"]`);
    if (rowEl) {
      const rowRect = rowEl.getBoundingClientRect();
      const liveY = rowRect.top - layerRect.top + (rowRect.height - d.height) / 2;
      d.y = liveY;
      d.el.style.top = liveY + "px";
    }
    showTeleportPulse(d, layerRect);
  });
}

function teleportOneDemonToRandomRow(row, active, gridRect, layerRect) {
  const candidates = active.filter((d) => !d.dead && d.row === row);
  if (candidates.length === 0 || !gridRect || !layerRect) return;
  const availableRows = Array.from({ length: Grid.getRows() }, (_, i) => i).filter((r) => r !== row);
  if (availableRows.length === 0) return;

  const demon = candidates[Math.floor(Math.random() * candidates.length)];
  const newRow = availableRows[Math.floor(Math.random() * availableRows.length)];
  demon.row = newRow;
  demon.targeting = null;
  demon.biteTimer = 0;

  const rowEl = document.querySelector(`.grid-row[data-row="${newRow}"]`);
  if (rowEl) {
    const rowRect = rowEl.getBoundingClientRect();
    const liveY = rowRect.top - layerRect.top + (rowRect.height - demon.height) / 2;
    demon.y = liveY;
    demon.el.style.top = liveY + "px";
  }
  showTeleportPulse(demon, layerRect, true);
}

function fireVoidShardBarrage(row, col, active, cellRect, layerRect, stats) {
  const layer = document.getElementById("projectiles-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const targets = active
    .filter((d) => !d.dead && d.row === row)
    .sort((a, b) => {
      const ar = a.el.getBoundingClientRect();
      const br = b.el.getBoundingClientRect();
      return ar.left - br.left;
    })
    .slice(0, 5);

  if (targets.length === 0) return;

  const originX = cellRect.right - layerRect.left - 10;
  const originY = cellRect.top - layerRect.top + cellRect.height * 0.5 - 10;

  targets.forEach((target, index) => {
    setTimeout(() => {
      if (target.dead) return;
      const shard = document.createElement("div");
      shard.className = "cb-shard";
      shard.style.cssText = `position:absolute;left:${originX}px;top:${originY}px;pointer-events:none;z-index:15;`;
      layer.appendChild(shard);

      const dRect = target.el.getBoundingClientRect();
      const endX = dRect.left - layerRect.left + dRect.width * 0.5 - 7;
      const endY = dRect.top - layerRect.top + dRect.height * 0.5 - 7;
      const startT = performance.now();
      const DURATION = 320;

      function animShard(now) {
        const t = Math.min((now - startT) / DURATION, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const x = originX + (endX - originX) * ease;
        const y = originY + (endY - originY) * ease;
        shard.style.left = x + "px";
        shard.style.top = y + "px";
        if (t < 1) {
          requestAnimationFrame(animShard);
        } else {
          shard.remove();
          if (!target.dead) {
            _ghostDamage(target, Math.round(stats.damage * 0.75), "soul");
            showCbImpact(endX + 7, endY + 7, "void", layerRect);
          }
        }
      }
      requestAnimationFrame(animShard);
    }, index * 80);
  });
}

function showTeleportPulse(d, layerRect, brighter = false) {
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl || !d.el) return;
  const eRect = effectsEl.getBoundingClientRect();
  const dRect = d.el.getBoundingClientRect();
  const ex = dRect.left - eRect.left + (dRect.width - 32) / 2;
  const ey = dRect.top - eRect.top + (dRect.height - 32) / 2;

  const pulse = document.createElement("div");
  pulse.className = brighter ? "cb-teleport-arc cb-teleport-arc-bright" : "cb-teleport-arc";
  pulse.style.cssText = `left:${ex}px;top:${ey}px;width:34px;height:34px;`;
  effectsEl.appendChild(pulse);
  setTimeout(() => pulse.remove(), 520);
}
