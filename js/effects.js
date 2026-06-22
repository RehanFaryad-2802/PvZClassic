/* js/effects.js
   Visual effects helpers: damage numbers,
   floating text, freeze/explosion particles.
*/

const Effects = (() => {
  function getLayer() {
    return document.getElementById("effects-layer");
  }

  function showDamageNumber(amount, x, y) {
    // Disabled — damage numbers hidden
  }

  function showFloatText(text, x, y, type = "") {
    const layer = getLayer();
    if (!layer) return;
    const el = document.createElement("div");
    el.className = `effect-hit ${type}`;
    // allow passing small HTML (e.g. coin icon img)
    el.innerHTML = text;
    el.style.left = x + "px";
    el.style.top = y + "px";
    layer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function spawnFreezeEffect(x, y) {
    const layer = getLayer();
    if (!layer) return;
    const el = document.createElement("div");
    el.className = "effect-freeze";
    el.style.left = x - 25 + "px";
    el.style.top = y - 25 + "px";
    layer.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  function spawnExplosion(x, y) {
    const layer = getLayer();
    if (!layer) return;
    const el = document.createElement("div");
    el.className = "effect-explosion";
    el.style.left = x - 30 + "px";
    el.style.top = y - 30 + "px";
    layer.appendChild(el);
    setTimeout(() => el.remove(), 400);
  }

  return { showDamageNumber, showFloatText, spawnFreezeEffect, spawnExplosion };
})();
