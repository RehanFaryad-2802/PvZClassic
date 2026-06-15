/* plants/mushpuff.js
   Mush Puff: lobs curved arc spore balls (like PvZ2 Melon-pult).
   Applies poison DoT on all hits.

   Level 1–4  : Poison Spore Lob — single arc projectile, poison DoT
   Level 5–9  : Mycelium Cloud   — every 4th shot drops a lingering poison cloud
   Level 10–15: Spore Burst      — every 6th shot splashes all demons within 1.5 cells

   Poison DoT ticks every 500 ms. Does not stack — refreshes on re-hit.
*/

// ── Tunable config ──────────────────────────────────────────────
const MUSHPUFF_CFG = {
  POISON_TICK_INTERVAL: 500,   // ms between poison ticks
  ARC_HEIGHT_MULT: 0.4,        // multiplier on arc peak height
  CLOUD_DURATION: 3000,        // ms the lingering cloud stays on ground
  CLOUD_TICK_INTERVAL: 600,    // ms between cloud damage ticks
  SPLASH_RADIUS_PX: 90,        // px radius for tier-3 splash
  LAUNCH_DELAY_MS: 180,        // ms from attack anim start to projectile spawn
  IMPACT_DELAY_MS: 700,        // ms arc travel time (matches CSS transition)
  CLOUD_SHOT_EVERY: 4,         // every Nth shot becomes a cloud (tier 2)
  BURST_SHOT_EVERY: 6,         // every Nth shot becomes a burst (tier 3)
};
// ───────────────────────────────────────────────────────────────

PlantRegistry.register({
  id: "mushpuff",
  name: "Mush Puff",
  image: "assets/plants/mushpuff.png",
  cost: 125,
  cooldown: 7000,
  fireDistance: 8,
  hitCount: 1,
  hp: 250,
  fireRate: 4000,
  description: "Lobs poison spore balls in a high arc. Higher levels add toxic clouds and splash.",

  // ── Level stats ──────────────────────────────────────────────
levelStats: {
  1:  { hp: 100, fireRate: 4000, damage: 8,  poisonDmg: 4,  poisonDur: 3000, cloudDmg: 0,  splashDmg: 0  },
  2:  { hp: 120, fireRate: 3800, damage: 9,  poisonDmg: 5,  poisonDur: 3200, cloudDmg: 0,  splashDmg: 0  },
  3:  { hp: 140, fireRate: 3600, damage: 11, poisonDmg: 5,  poisonDur: 3400, cloudDmg: 0,  splashDmg: 0  },
  4:  { hp: 165, fireRate: 3400, damage: 14, poisonDmg: 6,  poisonDur: 3600, cloudDmg: 0,  splashDmg: 0  },
  5:  { hp: 190, fireRate: 3200, damage: 15, poisonDmg: 7,  poisonDur: 3800, cloudDmg: 6,  splashDmg: 0  },
  6:  { hp: 220, fireRate: 3000, damage: 17, poisonDmg: 7,  poisonDur: 4000, cloudDmg: 7,  splashDmg: 0  },
  7:  { hp: 250, fireRate: 2800, damage: 20, poisonDmg: 8,  poisonDur: 4200, cloudDmg: 8,  splashDmg: 0  },
  8:  { hp: 285, fireRate: 2600, damage: 23, poisonDmg: 9,  poisonDur: 4400, cloudDmg: 9,  splashDmg: 0  },
  9:  { hp: 320, fireRate: 2400, damage: 26, poisonDmg: 10, poisonDur: 4600, cloudDmg: 10, splashDmg: 0  },
  10: { hp: 355, fireRate: 2200, damage: 28, poisonDmg: 11, poisonDur: 5000, cloudDmg: 11, splashDmg: 15 },
  11: { hp: 390, fireRate: 2000, damage: 32, poisonDmg: 13, poisonDur: 5200, cloudDmg: 13, splashDmg: 18 },
  12: { hp: 425, fireRate: 1900, damage: 36, poisonDmg: 14, poisonDur: 5400, cloudDmg: 14, splashDmg: 20 },
  13: { hp: 455, fireRate: 1850, damage: 41, poisonDmg: 16, poisonDur: 5800, cloudDmg: 16, splashDmg: 23 },
  14: { hp: 480, fireRate: 1800, damage: 43, poisonDmg: 17, poisonDur: 6200, cloudDmg: 17, splashDmg: 26 },
  15: { hp: 500, fireRate: 1800, damage: 45, poisonDmg: 18, poisonDur: 6500, cloudDmg: 18, splashDmg: 30 },
},

  getStats(level) {
    const capped = Math.min(Math.max(1, level), 15);
    return this.levelStats[capped] || this.levelStats[1];
  },

  // Returns "basic" | "cloud" | "burst"
  _getTier(level) {
    if (level >= 10) return "burst";
    if (level >= 5)  return "cloud";
    return "basic";
  },

  // ── onPlace ──────────────────────────────────────────────────
  onPlace(row, col, plantData) {
    const stats = this.getStats(plantData.level);
    plantData.maxHp      = stats.hp;
    plantData.hp         = stats.hp;
    plantData.lastFireTime = 0;
    plantData.shotCount  = 0;
    plantData.throwing   = false;

    const cell = Grid.getCellEl(row, col);
    if (cell) {
      // Spore wisps floating off the cap (3 wisps, staggered)
      for (let i = 0; i < 3; i++) {
        const wisp = document.createElement("div");
        wisp.className = `mp-wisp mp-wisp-${i}`;
        cell.appendChild(wisp);
      }
      // Ambient glow under the cap
      const glow = document.createElement("div");
      glow.className = "mp-cap-glow";
      cell.appendChild(glow);
      // Purple aura ring on ground
      const aura = document.createElement("div");
      aura.className = "mp-aura";
      cell.appendChild(aura);
    }

    requestAnimationFrame(() => {
      const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
      if (img) img.classList.add("mp-idle");
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

    // Find farthest demon in lane (Melon-pult targets farthest, not closest)
    let target = null, farthestDist = -Infinity;
    active.forEach((d) => {
      if (d.dead || d.row !== row) return;
      const dRect = d.el.getBoundingClientRect();
      if (dRect.left <= cellRect.left) return;
      if (gridRect && dRect.left > gridRect.right) return;
      const dist = dRect.left - cellRect.right;
      if (dist > farthestDist) { farthestDist = dist; target = d; }
    });
    if (!target) return;

    plantData.lastFireTime = now;
    plantData.shotCount    = (plantData.shotCount || 0) + 1;

    const tier      = this._getTier(plantData.level);
    const isCloud   = (tier === "cloud" || tier === "burst") &&
                      (plantData.shotCount % MUSHPUFF_CFG.CLOUD_SHOT_EVERY === 0);
    const isBurst   = tier === "burst" &&
                      (plantData.shotCount % MUSHPUFF_CFG.BURST_SHOT_EVERY === 0);
    const shotKind  = isBurst ? "burst" : isCloud ? "cloud" : "basic";

    SoundFX.play("pea_shoot");

    // ── Throw animation ──
    const img = cellEl.querySelector(".plant-entity");
    if (img && !plantData.throwing) {
      plantData.throwing = true;
      img.classList.remove("mp-idle");
      img.classList.add(isBurst ? "mp-throw-burst" : isCloud ? "mp-throw-cloud" : "mp-throw");
      setTimeout(() => {
        if (img.isConnected) {
          img.classList.remove("mp-throw", "mp-throw-cloud", "mp-throw-burst");
          img.classList.add("mp-idle");
          plantData.throwing = false;
        }
      }, 600);
    }

    // ── Launch arc projectile after short delay ──
    setTimeout(() => {
      if (target.dead) return;
      spawnMushArc(row, col, target, stats, shotKind);
    }, MUSHPUFF_CFG.LAUNCH_DELAY_MS);
  },

  // ── onRemove ─────────────────────────────────────────────────
  onRemove(row, col) {
    const cell = Grid.getCellEl(row, col);
    if (cell) {
      cell.querySelectorAll(".mp-wisp, .mp-cap-glow, .mp-aura").forEach(el => el.remove());
    }
  },

  // ── onDamage ─────────────────────────────────────────────────
  onDamage(row, col, plantData) {
    const img = Grid.getCellEl(row, col)?.querySelector(".plant-entity");
    if (!img) return;
    img.classList.remove("mp-idle", "mp-throw", "mp-throw-cloud", "mp-throw-burst");
    img.classList.add("mp-damaged");
    setTimeout(() => {
      if (img.isConnected) {
        img.classList.remove("mp-damaged");
        img.classList.add("mp-idle");
        plantData.throwing = false;
      }
    }, 480);
  },
});

// ══════════════════════════════════════════════════════════════
//  ARC PROJECTILE  (parabolic, like PvZ2 Melon-pult)
// ══════════════════════════════════════════════════════════════
function spawnMushArc(row, col, target, stats, shotKind) {
  const layer  = document.getElementById("projectiles-layer");
  const cellEl = Grid.getCellEl(row, col);
  if (!layer || !cellEl) return;

  const layerRect = layer.getBoundingClientRect();
  const cellRect  = cellEl.getBoundingClientRect();

  // Start position: right-centre of plant cell
  const startX = cellRect.right  - layerRect.left - 8;
  const startY = cellRect.top    - layerRect.top  + cellRect.height * 0.4 - 8;

  // End position: centre of target demon
  const dRect  = target.el.getBoundingClientRect();
  const endX   = dRect.left - layerRect.left + dRect.width  * 0.5 - 8;
  const endY   = dRect.top  - layerRect.top  + dRect.height * 0.5 - 8;

  // Arc peak — halfway horizontally, high above both points
  const peakY  = Math.min(startY, endY) - (Math.abs(endX - startX) * MUSHPUFF_CFG.ARC_HEIGHT_MULT * 0.5);

  // Build projectile element
  const proj = document.createElement("div");
  proj.className = shotKind === "burst" ? "mp-proj mp-proj-burst"
                 : shotKind === "cloud" ? "mp-proj mp-proj-cloud"
                 : "mp-proj";

  proj.style.cssText = `
    position:absolute;
    left:${startX}px;
    top:${startY}px;
    pointer-events:none;
    z-index:15;
  `;
  layer.appendChild(proj);

  // ── Animate along quadratic bezier using requestAnimationFrame ──
  const TRAVEL = MUSHPUFF_CFG.IMPACT_DELAY_MS;
  const startTime = performance.now();

  function animArc(now) {
    const t = Math.min((now - startTime) / TRAVEL, 1);

    // Quadratic bezier: B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
    const mt  = 1 - t;
    // Control point for arc peak
    const cpX = (startX + endX) / 2;
    const cpY = peakY;

    const x   = mt * mt * startX + 2 * mt * t * cpX + t * t * endX;
    const y   = mt * mt * startY + 2 * mt * t * cpY + t * t * endY;

    proj.style.left = x + "px";
    proj.style.top  = y + "px";

    // Rotate projectile to follow arc tangent
    const dx = 2 * (t * (endX - cpX) + (1 - t) * (cpX - startX));
    const dy = 2 * (t * (endY - cpY) + (1 - t) * (cpY - startY));
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    proj.style.transform = `rotate(${angle}deg)`;

    if (t < 1) {
      requestAnimationFrame(animArc);
    } else {
      // ── Impact ──
      proj.remove();
      onMushImpact(endX + 8, endY + 8, target, stats, shotKind, layer, layerRect);
    }
  }

  requestAnimationFrame(animArc);
}

// ══════════════════════════════════════════════════════════════
//  IMPACT HANDLER
// ══════════════════════════════════════════════════════════════
function onMushImpact(cx, cy, target, stats, shotKind, layer, layerRect) {
  if (!target.dead) {
    // Direct hit damage
    Demons.damage(target, stats.damage, "psychic");
    // Apply poison
    applyMushPoison(target, stats.poisonDmg, stats.poisonDur);
  }

  // ── Tier 3: splash to nearby demons ──
  if (shotKind === "burst" && stats.splashDmg > 0) {
    const effectsLayer = document.getElementById("effects-layer");
    const eRect = effectsLayer ? effectsLayer.getBoundingClientRect() : layerRect;
    Demons.getActive().forEach((d) => {
      if (d.dead || d === target) return;
      if (d.row !== target.row) return;
      const dRect = d.el.getBoundingClientRect();
      const dCx   = dRect.left - eRect.left + dRect.width  * 0.5;
      const dCy   = dRect.top  - eRect.top  + dRect.height * 0.5;
      const dist  = Math.hypot(dCx - cx, dCy - cy);
      if (dist <= MUSHPUFF_CFG.SPLASH_RADIUS_PX) {
        Demons.damage(d, stats.splashDmg, "psychic");
        applyMushPoison(d, stats.poisonDmg, stats.poisonDur);
        // small secondary splat
        showMushSplashSplat(dCx, dCy, layer, layerRect);
      }
    });
  }

  // ── Tier 2 + 3: drop lingering poison cloud ──
  if ((shotKind === "cloud" || shotKind === "burst") && stats.cloudDmg > 0) {
    spawnPoisonCloud(cx, cy, target.row, stats.cloudDmg, stats.poisonDmg, layer, layerRect);
  }

  // ── Visual impact ──
  showMushImpact(cx, cy, shotKind, layer, layerRect);
}

// ══════════════════════════════════════════════════════════════
//  POISON DoT
// ══════════════════════════════════════════════════════════════
function applyMushPoison(demon, dmgPerTick, duration) {
  if (demon.dead) return;
  // Refresh if already poisoned
  demon.mushPoisoned    = true;
  demon.mushPoisonDmg   = dmgPerTick;
  demon.mushPoisonEnd   = Date.now() + duration;

  // Only start one ticker per demon
  if (demon.mushPoisonTicking) return;
  demon.mushPoisonTicking = true;

  // Visual: green tint on demon
  if (demon.el) {
    demon.el.style.filter = "sepia(0.4) hue-rotate(60deg) brightness(1.1)";
  }

  function tick() {
    if (demon.dead || !demon.mushPoisoned) {
      demon.mushPoisonTicking = false;
      if (demon.el) demon.el.style.filter = "";
      return;
    }
    if (Date.now() >= demon.mushPoisonEnd) {
      demon.mushPoisoned      = false;
      demon.mushPoisonTicking = false;
      if (demon.el) demon.el.style.filter = "";
      return;
    }
    Demons.damage(demon, demon.mushPoisonDmg, "psychic");
    // poison tick float text
    showPoisonTick(demon);
    setTimeout(tick, MUSHPUFF_CFG.POISON_TICK_INTERVAL);
  }
  setTimeout(tick, MUSHPUFF_CFG.POISON_TICK_INTERVAL);
}

function showPoisonTick(demon) {
  if (!demon.el) return;
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl) return;
  const eRect = effectsEl.getBoundingClientRect();
  const dRect = demon.el.getBoundingClientRect();

  const txt = document.createElement("div");
  txt.textContent = "-☠";
  txt.style.cssText = `
    position:absolute;
    left:${dRect.left - eRect.left + dRect.width * 0.3 + (Math.random() - 0.5) * 20}px;
    top:${dRect.top  - eRect.top  - 10}px;
    font-family:var(--font-display);
    font-size:11px; font-weight:900;
    color:#86efac;
    text-shadow:0 0 6px rgba(74,222,128,0.9);
    pointer-events:none; z-index:42;
    animation:floatUp 0.8s ease-out forwards;
  `;
  effectsEl.appendChild(txt);
  setTimeout(() => txt.remove(), 800);
}

// ══════════════════════════════════════════════════════════════
//  LINGERING POISON CLOUD (Tier 2+)
// ══════════════════════════════════════════════════════════════
function spawnPoisonCloud(cx, cy, demonRow, cloudDmg, poisonDmg, layer, layerRect) {
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl) return;
  const eRect = effectsEl.getBoundingClientRect();

  // Recompute cx/cy relative to effects layer
  const ecx = cx + layerRect.left - eRect.left;
  const ecy = cy + layerRect.top  - eRect.top;

  const cloud = document.createElement("div");
  cloud.className = "mp-poison-cloud";
  cloud.style.cssText = `
    left:${ecx - 40}px;
    top:${ecy - 40}px;
  `;
  effectsEl.appendChild(cloud);

  // Tick damage to any demon walking through it
  const endTime = Date.now() + MUSHPUFF_CFG.CLOUD_DURATION;
  function cloudTick() {
    if (Date.now() >= endTime) {
      cloud.classList.add("mp-cloud-fade");
      setTimeout(() => cloud.remove(), 600);
      return;
    }
    Demons.getActive().forEach((d) => {
      if (d.dead || d.row !== demonRow) return;
      const dRect = d.el.getBoundingClientRect();
      const dCx   = dRect.left - eRect.left + dRect.width  * 0.5;
      const dCy   = dRect.top  - eRect.top  + dRect.height * 0.5;
      if (Math.hypot(dCx - ecx, dCy - ecy) <= 55) {
        Demons.damage(d, cloudDmg, "psychic");
        applyMushPoison(d, poisonDmg, 2000);
      }
    });
    setTimeout(cloudTick, MUSHPUFF_CFG.CLOUD_TICK_INTERVAL);
  }
  setTimeout(cloudTick, MUSHPUFF_CFG.CLOUD_TICK_INTERVAL);
}

// ══════════════════════════════════════════════════════════════
//  VISUAL EFFECTS
// ══════════════════════════════════════════════════════════════
function showMushImpact(cx, cy, shotKind, layer, layerRect) {
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl) return;
  const eRect = effectsEl.getBoundingClientRect();
  const ex = cx + layerRect.left - eRect.left;
  const ey = cy + layerRect.top  - eRect.top;

  // Main splat ring
  const ring = document.createElement("div");
  ring.className = shotKind === "burst" ? "mp-impact-ring mp-ring-burst"
                 : shotKind === "cloud" ? "mp-impact-ring mp-ring-cloud"
                 : "mp-impact-ring";
  ring.style.cssText = `left:${ex - 24}px; top:${ey - 24}px;`;
  effectsEl.appendChild(ring);
  setTimeout(() => ring.remove(), 600);

  // Spore splat particles (5–8 blobs)
  const count = shotKind === "burst" ? 8 : shotKind === "cloud" ? 6 : 5;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist  = 18 + Math.random() * (shotKind === "burst" ? 40 : 24);
    const blob  = document.createElement("div");
    blob.className = "mp-splat-blob";
    blob.style.cssText = `
      left:${ex - 5}px; top:${ey - 5}px;
      --bx:${Math.cos(angle) * dist}px;
      --by:${Math.sin(angle) * dist}px;
      animation-delay:${i * 0.03}s;
    `;
    effectsEl.appendChild(blob);
    setTimeout(() => blob.remove(), 500);
  }

  // Float text
  const label = shotKind === "burst" ? "SPORE BURST!" : shotKind === "cloud" ? "TOXIC CLOUD!" : "POISONED!";
  const color  = shotKind === "burst" ? "#f0abfc" : "#86efac";
  const txt    = document.createElement("div");
  txt.textContent = label;
  txt.style.cssText = `
    position:absolute;
    left:${ex - 30}px; top:${ey - 30}px;
    font-family:var(--font-display);
    font-size:${shotKind === "basic" ? 11 : 13}px; font-weight:900;
    color:${color};
    text-shadow:0 0 8px ${color};
    pointer-events:none; z-index:42;
    animation:floatUp 1s ease-out forwards;
  `;
  effectsEl.appendChild(txt);
  setTimeout(() => txt.remove(), 1000);
}

function showMushSplashSplat(cx, cy, layer, layerRect) {
  const effectsEl = document.getElementById("effects-layer");
  if (!effectsEl) return;
  const eRect = effectsEl.getBoundingClientRect();
  const ex = cx + layerRect.left - eRect.left;
  const ey = cy + layerRect.top  - eRect.top;

  const mini = document.createElement("div");
  mini.className = "mp-impact-ring";
  mini.style.cssText = `
    left:${ex - 14}px; top:${ey - 14}px;
    width:28px; height:28px;
    animation-duration:0.35s;
  `;
  effectsEl.appendChild(mini);
  setTimeout(() => mini.remove(), 380);
}
