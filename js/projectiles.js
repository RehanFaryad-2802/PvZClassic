/* js/projectiles.js
   Manages all projectiles in the battle arena.
   Projectiles move right→left and hit demons.
*/

const Projectiles = (() => {
  let projectiles = []; // active projectile objects
  let layer = null; // DOM layer element
  let arenaRect = null; // cached arena bounding rect

  const SPEED = {
    pea: 320, // px/sec
    thorn: 260,
    "ice-pea": 280,
    bonk: 0, // melee, instant
  };

  function init(layerEl) {
    layer = layerEl;
    projectiles = [];
  }

  function setArenaRect(rect) {
    arenaRect = rect;
  }

  function spawn(type, row, fromCol, damage, extra = {}) {
    if (!layer || !arenaRect) return;

    const cellEl = Grid.getCellEl(row, fromCol);
    const layerEl = document.getElementById("projectiles-layer");
    if (!cellEl || !layerEl) return;

    const cellRect = cellEl.getBoundingClientRect();
    const layerRect = layerEl.getBoundingClientRect();

    // Fire from right edge of cell, centered vertically in that cell
    const x = cellRect.right - layerRect.left;
    const y = cellRect.top - layerRect.top + cellRect.height * 0.5 - 7;

    const el = document.createElement("div");
    el.className = `projectile ${type}`;
    el.style.left = x + "px";
    el.style.top = y + "px";
    layer.appendChild(el);

    const proj = {
      el,
      type,
      row,
      x,
      y,
      fromCol,
      speed: SPEED[type] || 300,
      damage,
      extra,
      dead: false,
    };
    projectiles.push(proj);
    return proj;
  }

  // Called every frame from Core
  function update(dt) {
    if (!arenaRect) return;

    const layerEl = document.getElementById("projectiles-layer");
    const layerRect = layerEl ? layerEl.getBoundingClientRect() : null;

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (p.dead) {
        p.el.remove();
        projectiles.splice(i, 1);
        continue;
      }

      // Update Y every frame from live row DOM position
      if (layerRect) {
        const rowEl = document.querySelector(`.grid-row[data-row="${p.row}"]`);
        if (rowEl) {
          const rowRect = rowEl.getBoundingClientRect();
          const liveY = rowRect.top - layerRect.top + rowRect.height * 0.5 - 7;
          p.y = liveY;
          p.el.style.top = liveY + "px";
        }
      }

      // Move left (toward demons coming from right)
      p.x += p.speed * dt;
      p.el.style.left = p.x + "px";

      // Off-screen right? Remove
      if (p.x > arenaRect.width + 20) {
        p.el.remove();
        projectiles.splice(i, 1);
        continue;
      }

      // Check demon collision
      checkDemonHit(p, i);
    }
  }
  function checkDemonHit(proj, projIdx) {
    const demons = Demons.getActive();
    for (const demon of demons) {
      if (demon.dead) continue;
      if (demon.row !== proj.row) continue;

      // Simple AABB: projectile x vs demon x range
      const dLeft = demon.x;
      const dRight = demon.x + demon.width;
      const pLeft = proj.x;
      const pRight = proj.x + 14;

      if (pRight >= dLeft && pLeft <= dRight) {
        // HIT
        hitDemon(demon, proj);
        proj.dead = true;
        return;
      }
    }
  }

  function hitDemon(demon, proj) {
    // Dodge check (imp special)
    if (demon.special === "dodge" && Math.random() < 0.15) {
      Effects.showFloatText("Miss!", demon.x, demon.y - 10, "miss");
      return;
    }

    let dmg = proj.damage;

    // Armor reduction (Iron Warlord)
    if (demon.special === "armor") dmg = Math.floor(dmg * 0.6);

    Demons.damage(demon, dmg, proj.type === "ice-pea" ? "ice" : (proj.extra?.damageType || proj.damageType || "physical"));
    Effects.showDamageNumber(dmg, demon.x + demon.width / 2, demon.y);

    // Ice slow
    if (proj.type === "ice-pea" && proj.extra.slow) {
      Demons.freeze(demon, proj.extra.slowDuration || 3000);
      Effects.spawnFreezeEffect(
        demon.x + demon.width / 2,
        demon.y + demon.height / 2,
      );
    }
  }

  function clear() {
    projectiles.forEach((p) => p.el && p.el.remove());
    projectiles = [];
  }

  return { init, setArenaRect, spawn, update, clear };
})();
