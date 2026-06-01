/* js/ui.js
   Screen navigation, HUD updates, menu building,
   world map, level select, collection, shop.
*/

const UI = (() => {
  let currentScreen = "screen-name";

  // ── Screen Navigation ──────────────────────────
  function showScreen(id) {
    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) {
      target.classList.add("active");
      currentScreen = id;
      onScreenEnter(id);
    }
  }

  function onScreenEnter(id) {
    switch (id) {
      case "screen-menu":
        buildMenu();
        break;
      case "screen-worldmap":
        buildWorldMap();
        break;
      case "screen-collection":
        buildCollection();
        break;
      case "screen-minigames":
        buildMinigames();
        break;
      case "screen-shop":
        buildShop();
        break;
    }
    updateCoinDisplays();
  }

  // ── HUD helpers ────────────────────────────────
  function updateCoinDisplays() {
    const coins = Player.getCoins();
    const looms = Player.getLooms();
    document
      .querySelectorAll(
        "#menu-coins, #wm-coins, #ls-coins, #hud-coins, #mg-coins, #shop-coins",
      )
      .forEach((el) => {
        if (el) el.textContent = coins;
      });
    document
      .querySelectorAll("#menu-looms, #shop-looms, #inv-looms")
      .forEach((el) => {
        if (el) el.textContent = looms;
      });
  }

  function updateSunDisplay() {
    const el = document.getElementById("hud-sun");
    if (el) el.textContent = Core.getSun();
  }

  function updateWaveDisplay(current, total, demonTypes = []) {
    const w = document.getElementById("hud-wave");
    const wt = document.getElementById("hud-wave-total");
    if (w) w.textContent = current;
    if (wt) wt.textContent = total;

    // Show demon preview icons
    const preview = document.getElementById("wave-demon-preview");
    if (preview && demonTypes.length > 0) {
      preview.innerHTML = demonTypes
        .slice(0, 6)
        .map((type) => {
          const stats = Levels.getDemonStats(type);
          return stats
            ? `<img src="${stats.image}" title="${stats.name}"
              style="width:24px;height:24px;object-fit:contain;
              filter:drop-shadow(0 0 4px rgba(255,0,0,0.6))">`
            : "";
        })
        .join("");
    }
  }

  function setWaveProgress(pct) {
    const el = document.getElementById("wave-progress");
    if (el) el.style.width = pct * 100 + "%";
  }

  function showFloatingText(text, x, y, type) {
    Effects.showFloatText(text, x, y, type);
  }

  // ── Menu ───────────────────────────────────────
  function buildMenu() {
    document.getElementById("menu-player-name").textContent = Player.getName();
  }
  function buildWorldMap() {
    Levels.checkWorldUnlocks();
    const container = document.getElementById("worlds-grid");
    container.innerHTML = "";

    const worldImages = {
      1: "assets/worlds/world1/world1.jpg",
      2: "assets/worlds/world2/world2.jpg",
      3: "assets/worlds/world3/world3.jpg",
      4: "assets/worlds/world4/world4.jpg",
      5: "assets/worlds/world5/world5.jpg",
      6: "assets/worlds/world6/world6.jpg",
      7: "assets/worlds/world7/world7.jpg",
      8: "assets/worlds/world8/world8.jpg",
      9: "assets/worlds/world9/world9.jpg",
      10: "assets/worlds/world10/world10.jpg",
    };

    const worldDifficulty = {
      1: "⭐",
      2: "⭐⭐",
      3: "⭐⭐⭐",
      4: "⭐⭐⭐⭐",
      5: "⭐⭐⭐⭐",
      6: "⭐⭐⭐⭐⭐",
      7: "⭐⭐⭐⭐⭐",
      8: "⭐⭐⭐⭐⭐",
      9: "⭐⭐⭐⭐⭐",
      10: "⭐⭐⭐⭐⭐",
    };

    Levels.getAllWorlds().forEach((world) => {
      const unlocked = Player.isWorldUnlocked(world.id);
      const prog = Player.getWorldProgress()[world.id] || 0;

      const card = document.createElement("div");
      card.className = "world-card" + (unlocked ? " unlocked" : " locked");

      card.innerHTML = `
        <div class="world-img-wrap">
          <img src="${worldImages[world.id]}" alt="${world.name}" />
          ${!unlocked ? '<div class="world-lock-overlay">🔒</div>' : ""}
        </div>
        <div class="world-shadow"></div>
        <div class="world-info">
          <div class="world-name">${world.name}</div>
          <div class="world-sub">${world.sub}</div>
          <div class="world-difficulty">${worldDifficulty[world.id]}</div>
          ${
            unlocked
              ? `<div class="world-progress">📋 ${prog}/${world.levelCount}</div>`
              : `<div class="world-progress" style="color:var(--gray)">🔒 Locked</div>`
          }
        </div>
      `;

      if (unlocked) {
        card.addEventListener("click", () => openLevelSelect(world.id));
      }
      container.appendChild(card);
    });

    // Drag to scroll world map — prevent image drag glitch
    let isDragging = false,
      dragStartX = 0,
      scrollStartX = 0,
      moved = false;

    container.addEventListener("mousedown", (e) => {
      isDragging = true;
      moved = false;
      dragStartX = e.clientX;
      scrollStartX = container.scrollLeft;
      container.style.cursor = "grabbing";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 3) moved = true;
      if (moved) container.scrollLeft = scrollStartX - dx;
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
      container.style.cursor = "grab";
    });

    // Block click on cards if we were dragging
    container.addEventListener(
      "click",
      (e) => {
        if (moved) {
          e.stopPropagation();
          e.preventDefault();
          moved = false;
        }
      },
      true,
    );

    // Prevent image native drag
    container.querySelectorAll("img").forEach((img) => {
      img.addEventListener("dragstart", (e) => e.preventDefault());
    });

    container.addEventListener(
      "touchstart",
      (e) => {
        dragStartX = e.touches[0].clientX;
        scrollStartX = container.scrollLeft;
      },
      { passive: true },
    );
    container.addEventListener(
      "touchmove",
      (e) => {
        container.scrollLeft =
          scrollStartX - (e.touches[0].clientX - dragStartX);
      },
      { passive: true },
    );

    container.style.cursor = "grab";
  }

  // ── Level Select ───────────────────────────────
  let selectedWorldId = 1;

  function openLevelSelect(worldId) {
    selectedWorldId = worldId;
    const world = Levels.getWorld(worldId);
    document.getElementById("levelselect-world-name").textContent =
      `${world.emoji} ${world.name}`;
    buildLevelGrid(worldId);
    showScreen("screen-levelselect");
  }

  function buildLevelGrid(worldId) {
    const world = Levels.getWorld(worldId);
    const container = document.getElementById("levels-grid");
    container.innerHTML = "";
    container.className = `levels-grid world-theme-${worldId}`;

    // Set bg image
    const bg = document.querySelector(".levelselect-bg");
    if (bg) {
      bg.className = `levelselect-bg world-${worldId}`;
      const hasBg = {
        1: true,
        2: false,
        3: false,
        4: false,
        5: false,
        6: false,
        7: false,
        8: false,
        9: false,
        10: false,
      };
      const imgPath = hasBg[worldId]
        ? `assets/worlds/world${worldId}/bg.jpg`
        : `assets/worlds/world${worldId}/world${worldId}.jpg`;
      // fallback color if image missing
      bg.style.backgroundColor = "#0a0010";
      bg.style.backgroundImage = `url('${imgPath}')`;
      bg.style.backgroundSize = "cover";
      bg.style.backgroundPosition = "center bottom";
      bg.style.backgroundRepeat = "no-repeat";
    }

    // Find current level
    let currentLevelIdx = -1;
    for (let i = 0; i < world.levelCount; i++) {
      if (
        Player.isLevelUnlocked(worldId, i) &&
        Player.getLevelStars(worldId, i) === 0
      ) {
        currentLevelIdx = i;
        break;
      }
    }

    const zigzag = [0, -55, -90, -55, 0, 55, 90, 55];
    const ORB_SIZE = 64;
    const H_STEP = 100;
    const baseline = 160;

    container.style.position = "relative";
    container.style.height = "320px";
    container.style.display = "block";
    container.style.overflowX = "auto";
    container.style.overflowY = "hidden";
    container.style.scrollbarWidth = "none";
    container.style.cursor = "grab";
    const wmBg = document.querySelector(".worldmap-bg");
    container.addEventListener("scroll", () => {
      if (wmBg) {
        const pct =
          container.scrollLeft /
          (container.scrollWidth - container.clientWidth);
        wmBg.style.backgroundPosition = `${pct * 100}% center`;
      }
    });

    const totalWidth = world.levelCount * H_STEP + 120;
    const canvas = document.createElement("div");
    canvas.style.cssText = `position:relative;width:${totalWidth}px;height:320px;`;
    container.appendChild(canvas);

    // SVG connector lines
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;overflow:visible;z-index:1;pointer-events:none;";
    canvas.appendChild(svg);

    for (let i = 1; i < world.levelCount; i++) {
      const prevY = baseline + zigzag[(i - 1) % zigzag.length];
      const currY = baseline + zigzag[i % zigzag.length];
      const prevX = 50 + (i - 1) * H_STEP + ORB_SIZE / 2;
      const currX = 50 + i * H_STEP + ORB_SIZE / 2;
      const prevDone = Player.getLevelStars(worldId, i - 1) > 0;
      const currDone = Player.getLevelStars(worldId, i) > 0;
      const isCurr = i === currentLevelIdx;

      const color =
        prevDone && currDone
          ? "#22c55e"
          : prevDone && isCurr
            ? "#3b82f6"
            : "rgba(255,255,255,0.15)";

      const mx = (prevX + currX) / 2;
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute(
        "d",
        `M${prevX},${prevY} C${mx},${prevY} ${mx},${currY} ${currX},${currY}`,
      );
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "6");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      if (!prevDone && !isCurr) path.setAttribute("stroke-dasharray", "8 6");
      svg.appendChild(path);
    }

    // Orb nodes
    for (let i = 0; i < world.levelCount; i++) {
      const unlocked = Player.isLevelUnlocked(worldId, i);
      const stars = Player.getLevelStars(worldId, i);
      const isElite = (i + 1) % 5 === 0;
      const isCurrent = i === currentLevelIdx;
      const isDone = stars > 0;

      const x = 50 + i * H_STEP;
      const y = baseline + zigzag[i % zigzag.length] - ORB_SIZE / 2;

      const plantReward = Levels.PLANT_UNLOCKS.find(
        (u) => u.worldId === worldId && u.levelIdx === i,
      );
      const mgReward = Levels.MINIGAME_UNLOCKS.find(
        (u) => u.worldId === worldId && u.levelIdx === i,
      );
      const rewardBadge = plantReward
        ? `<div class="level-reward-badge">🌿 Plant</div>`
        : mgReward
          ? `<div class="level-reward-badge">🎮 Game</div>`
          : "";

      const starsHtml = isDone
        ? `<div class="level-stars-row">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</div>`
        : isCurrent
          ? `<div class="level-arrow">▼</div>`
          : "";

      const btn = document.createElement("div");
      btn.className =
        "level-btn" +
        (isDone ? " completed" : "") +
        (isCurrent ? " current" : "") +
        (!unlocked && !isCurrent ? " locked" : "") +
        (isElite ? " elite" : "");
      btn.style.cssText = `position:absolute;left:${x}px;top:${y}px;z-index:2;`;
      btn.innerHTML = `
        ${rewardBadge}
        <div class="level-orb">
          <span class="level-num">${unlocked || isCurrent ? (isElite ? "🔥" : i + 1) : "🔒"}</span>
        </div>
        ${starsHtml}
      `;

      if (unlocked || isCurrent)
        btn.addEventListener("click", () => openPlantPicker(worldId, i));
      canvas.appendChild(btn);
    }

    // Auto scroll to current
    setTimeout(() => {
      if (currentLevelIdx >= 0) {
        container.scrollTo({
          left: Math.max(0, currentLevelIdx * H_STEP - 200),
          behavior: "smooth",
        });
      }
    }, 300);

    // Drag to scroll
    let isDragging = false,
      dragStartX = 0,
      scrollStartX = 0;
    container.addEventListener("mousedown", (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      scrollStartX = container.scrollLeft;
      container.style.cursor = "grabbing";
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      container.scrollLeft = scrollStartX - (e.clientX - dragStartX);
    });
    window.addEventListener("mouseup", () => {
      isDragging = false;
      container.style.cursor = "grab";
    });
    container.addEventListener(
      "touchstart",
      (e) => {
        dragStartX = e.touches[0].clientX;
        scrollStartX = container.scrollLeft;
      },
      { passive: true },
    );
    container.addEventListener(
      "touchmove",
      (e) => {
        container.scrollLeft =
          scrollStartX - (e.touches[0].clientX - dragStartX);
      },
      { passive: true },
    );
  }

  let pendingBattleWorld = 1;
  let pendingBattleLevel = 0;
  let selectedPlants = [];
  const MAX_PICKS = 5;

  function openPlantPicker(worldId, levelIdx) {
    pendingBattleWorld = worldId;
    pendingBattleLevel = levelIdx;

    const tempPlants = Levels.getTempPlants(worldId, levelIdx);
    const owned = Player.getOwnedPlants();
    const ownedIds = owned.map((p) => p.id);

    // Always skip picker — send ALL owned plants straight to battle
    selectedPlants = [...ownedIds];
    Core.startBattle(worldId, levelIdx, ownedIds, tempPlants);
  }

  function buildPickerAvailable(tempPlants = []) {
    const container = document.getElementById("picker-available");
    container.innerHTML = "";
    const allPlants = PlantRegistry.getAll();

    allPlants.forEach((def) => {
      const playerPlant = Player.getPlant(def.id);
      const owned =
        (playerPlant && playerPlant.owned) || tempPlants.includes(def.id);
      const isTemp =
        tempPlants.includes(def.id) && !(playerPlant && playerPlant.owned);
      const level = playerPlant ? playerPlant.level : 1;

      const card = document.createElement("div");
      card.className = "plant-card" + (owned ? "" : " locked");
      card.dataset.plantId = def.id;
      card.innerHTML = `
        <img src="${def.image}" alt="${def.name}" />
        <div class="plant-card-name">${def.name}</div>
        <div class="plant-card-level">${isTemp ? "🔒 Trial" : `Lv.${level}`} · ☀️${def.cost}</div>
      `;

      if (owned) {
        card.addEventListener("click", () => togglePickerPlant(def.id, card));
      }
      container.appendChild(card);
    });
  }

  function togglePickerPlant(plantId, cardEl) {
    const idx = selectedPlants.indexOf(plantId);
    if (idx >= 0) {
      selectedPlants.splice(idx, 1);
      cardEl.classList.remove("selected");
    } else {
      if (selectedPlants.length >= MAX_PICKS) {
        showToast(`Max ${MAX_PICKS} plants!`);
        return;
      }
      selectedPlants.push(plantId);
      cardEl.classList.add("selected");
    }
    buildPickerSelected();
  }

  function buildPickerSelected() {
    const container = document.getElementById("picker-selected");
    container.innerHTML = "";

    if (selectedPlants.length === 0) {
      container.innerHTML =
        '<span style="color:var(--gray);font-size:13px">Tap plants below to select</span>';
      return;
    }

    selectedPlants.forEach((id) => {
      const def = PlantRegistry.get(id);
      if (!def) return;
      const el = document.createElement("div");
      el.className = "plant-card selected";
      el.style.width = "70px";
      el.innerHTML = `<img src="${def.image}" alt="${def.name}" /><div class="plant-card-name">${def.name}</div>`;
      container.appendChild(el);
    });
  }

  // ── Plant Tray (in-battle) ─────────────────────
  function buildPlantTray(plantIds) {
    const tray = document.getElementById("plant-tray");
    tray.innerHTML = "";

    plantIds.forEach((id) => {
      const def = PlantRegistry.get(id);
      if (!def) return;

      const card = document.createElement("div");
      card.className = "tray-card";
      card.dataset.plantId = id;
      card.innerHTML = `
        <img src="${def.image}" alt="${def.name}" />
        <div class="tray-cost">☀️${def.cost}</div>
      `;
      card.addEventListener("click", () => Core.selectPlant(id));
      tray.appendChild(card);
    });

    // Shovel button
    const shovel = document.createElement("div");
    shovel.className = "shovel-btn";
    shovel.id = "shovel-btn";
    shovel.innerHTML = "🪣<span>Shovel</span>";
    shovel.addEventListener("click", () => Core.toggleShovel());
    tray.appendChild(shovel);
  }

  function updateTrayCard(plantId, sunAvailable, onCooldown, cdSeconds) {
    const card = document.querySelector(
      `.tray-card[data-plant-id="${plantId}"]`,
    );
    if (!card) return;
    const def = PlantRegistry.get(plantId);
    if (!def) return;

    const canAfford = sunAvailable >= def.cost;
    card.classList.toggle("no-sun", !canAfford && !onCooldown);
    card.classList.toggle("cooldown", onCooldown);

    let cdOverlay = card.querySelector(".cooldown-overlay");
    if (onCooldown) {
      if (!cdOverlay) {
        cdOverlay = document.createElement("div");
        cdOverlay.className = "cooldown-overlay";
        card.appendChild(cdOverlay);
      }
      cdOverlay.textContent = cdSeconds > 0 ? cdSeconds : "";
    } else {
      if (cdOverlay) cdOverlay.remove();
    }
  }

  function setSelectedTrayCard(plantId) {
    document.querySelectorAll(".tray-card").forEach((c) => {
      c.classList.toggle("selected", c.dataset.plantId === plantId);
    });
    const shovelBtn = document.getElementById("shovel-btn");
    if (shovelBtn) shovelBtn.classList.remove("active");
  }

  function setShovelActive(active) {
    const btn = document.getElementById("shovel-btn");
    if (btn) btn.classList.toggle("active", active);
    document
      .querySelectorAll(".tray-card")
      .forEach((c) => c.classList.remove("selected"));
  }

  // ── Inventory (replaces Collection) ───────────────
  let inventorySelectedItem = null; // { type: 'plant'|'packet', id }

  function buildCollection() {
    buildInventory();
  }

  function buildInventory() {
    const screen = document.getElementById("screen-collection");
    if (!screen) return;

    // Build inventory layout if not already done
    if (!document.getElementById("inv-layout")) {
      screen.innerHTML = `
        <div class="inv-header">
          <button id="btn-back-collection" class="btn-back">← Back</button>
          <div class="inv-title">📦 Inventory</div>
          <div class="inv-currency">
            <span>🪙 <span id="inv-coins">${Player.getCoins()}</span></span>
            <span class="loom-display">
              <img src="assets/shop/loom.png" class="loom-icon-sm"/>
              <span id="inv-looms">${Player.getLooms()}</span>
            </span>
          </div>
        </div>
        <div class="inv-layout" id="inv-layout">
          <div class="inv-left" id="inv-left">
            <div class="inv-detail-empty">Select an item</div>
          </div>
          <div class="inv-right" id="inv-right">
            <div class="inv-tabs" id="inv-tabs">
              <button class="inv-tab active" data-tab="plants">🌿 Plants</button>
              <button class="inv-tab" data-tab="packets">📦 Packets</button>
            </div>
            <div class="inv-grid" id="inv-grid"></div>
          </div>
        </div>
      `;

      // Re-wire back button
      document
        .getElementById("btn-back-collection")
        .addEventListener("click", () => showScreen("screen-menu"));

      // Tab switching
      document.getElementById("inv-tabs").addEventListener("click", (e) => {
        const tab = e.target.dataset.tab;
        if (!tab) return;
        document
          .querySelectorAll(".inv-tab")
          .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
        buildInventoryGrid(tab);
      });
    }

    buildInventoryGrid("plants");
    updateCoinDisplays();
  }

  function buildInventoryGrid(tab) {
    const grid = document.getElementById("inv-grid");
    if (!grid) return;
    grid.innerHTML = "";

    if (tab === "plants") {
      const allPlants = PlantRegistry.getAll();
      allPlants.forEach((def) => {
        const pp = Player.getPlant(def.id);
        const owned = pp && pp.owned;
        const level = pp ? pp.level : 1;
        const seeds = pp ? pp.seeds : 0;
        const nextCost = Seeds.getLevelUpCost(level);
        const pct = nextCost ? Math.min(seeds / nextCost, 1) : 1;
        const maxLevel = level >= 15;

        const card = document.createElement("div");
        card.className = "inv-item-card" + (owned ? "" : " inv-locked");
        card.innerHTML = `
          <img src="${def.image}" alt="${def.name}"
            style="${owned ? "" : "filter:grayscale(1) brightness(0.3)"}"/>
          <div class="inv-item-name">${def.name}</div>
          <div class="inv-item-level">${owned ? `Lv.${level}` : "🔒"}</div>
          ${
            owned
              ? `
            <div class="inv-seed-bar-wrap">
              <div class="inv-seed-bar" style="width:${maxLevel ? 100 : pct * 100}%;
                background:${maxLevel ? "var(--gold)" : "var(--green)"}"></div>
            </div>
          `
              : ""
          }
        `;
        if (owned) {
          card.addEventListener("click", () =>
            selectInventoryItem("plant", def.id),
          );
        }
        grid.appendChild(card);
      });
    } else if (tab === "packets") {
      const inv = Player.getInventory();
      const packetDefs = Shop.SEED_PACKETS;

      let hasAny = false;
      Object.values(packetDefs).forEach((def) => {
        const owned = inv.find((i) => i.id === def.id);
        const qty = owned ? owned.quantity : 0;
        if (qty === 0) return;
        hasAny = true;

        const card = document.createElement("div");
        card.className = "inv-item-card inv-packet-card";
        card.innerHTML = `
          <div class="inv-packet-img">${getPacketEmoji(def.id)}</div>
          <div class="inv-item-name">${def.name}</div>
          <div class="inv-packet-qty">×${qty}</div>
        `;
        card.addEventListener("click", () =>
          selectInventoryItem("packet", def.id),
        );
        grid.appendChild(card);
      });

      if (!hasAny) {
        grid.innerHTML = `<div class="inv-empty">No packets in inventory.<br>Buy some from the Shop!</div>`;
      }
    }
  }

  function getPacketEmoji(id) {
    const def = Shop.SEED_PACKETS[id];
    if (def && def.image) {
      return `<img src="${def.image}" alt="${def.name}"
        style="width:56px;height:56px;object-fit:contain;
        filter:drop-shadow(0 0 8px rgba(168,85,247,0.5))"/>`;
    }
    return "📦";
  }

  function selectInventoryItem(type, id) {
    inventorySelectedItem = { type, id };
    const left = document.getElementById("inv-left");
    if (!left) return;

    if (type === "plant") {
      const def = PlantRegistry.get(id);
      const pp = Player.getPlant(id);
      if (!def || !pp) return;

      const level = pp.level;
      const seeds = pp.seeds;
      const nextCost = Seeds.getLevelUpCost(level);
      const maxLevel = level >= 15;
      const canUp = !maxLevel && seeds >= (nextCost || 0);
      const pct = nextCost ? Math.min(seeds / nextCost, 1) : 1;

      left.innerHTML = `
        <div class="inv-detail">
          <div class="inv-detail-name">${def.name}</div>
          <div class="inv-detail-img-wrap">
            <img src="${def.image}" alt="${def.name}" class="inv-detail-img"/>
            <div class="inv-detail-level-badge">Lv.${level}</div>
          </div>
          <div class="inv-detail-desc">${def.description || ""}</div>
          <div class="inv-detail-seeds">
            <div class="inv-detail-seeds-row">
              <span>🌱 Seeds</span>
              <span style="color:${maxLevel ? "var(--gold)" : "var(--green)"};font-weight:700">
                ${maxLevel ? "MAX" : `${seeds} / ${nextCost}`}
              </span>
            </div>
            <div class="inv-seed-bar-wrap" style="margin-top:4px">
              <div class="inv-seed-bar" style="width:${maxLevel ? 100 : pct * 100}%;
                background:${maxLevel ? "var(--gold)" : "var(--green)"}"></div>
            </div>
          </div>
          <div class="inv-detail-cost">☀️ ${pp.level ? def.levelStats?.[level]?.cost || def.cost : def.cost} sun cost</div>
          <div class="inv-actions">
            ${
              maxLevel
                ? `<div class="inv-max-badge">🏆 MAX LEVEL</div>`
                : canUp
                  ? `<button class="inv-action-btn inv-levelup-btn" id="inv-lvlup-btn" data-id="${id}">
                    ⬆️ Level Up<br><small>${seeds}/${nextCost} seeds</small>
                   </button>`
                  : `<div class="inv-need-seeds">Need ${(nextCost || 0) - seeds} more 🌱</div>`
            }
          </div>
        </div>
      `;

      const lvlBtn = document.getElementById("inv-lvlup-btn");
      if (lvlBtn) {
        lvlBtn.addEventListener("click", () => {
          const pid = lvlBtn.dataset.id;
          const oldLevel = Player.getPlant(pid).level;
          const oldStats = def.levelStats
            ? { ...(def.levelStats[oldLevel] || {}) }
            : {};

          if (Seeds.tryLevelUp(pid)) {
            const newLevel = Player.getPlant(pid).level;
            const newStats = def.levelStats
              ? { ...(def.levelStats[newLevel] || {}) }
              : {};
            buildInventoryGrid("plants");
            selectInventoryItem("plant", pid);
            showUpgradeCard(def, oldLevel, newLevel, oldStats, newStats);
          }
        });
      }
    } else if (type === "packet") {
      const def = Shop.SEED_PACKETS[id];
      const inv = Player.getInventory();
      const owned = inv.find((i) => i.id === id);
      const qty = owned ? owned.quantity : 0;

      left.innerHTML = `
        <div class="inv-detail">
          <div class="inv-detail-name">${def.name}</div>
          <div class="inv-packet-big-img">${getPacketEmoji(id)}</div>
          <div class="inv-detail-desc">${def.description}</div>
          <div class="inv-packet-qty-big">You have: <strong>×${qty}</strong></div>
          <div class="inv-actions">
            ${
              qty > 0
                ? `<button class="inv-action-btn inv-open-btn" id="inv-open-btn" data-id="${id}">
                  📦 Open Packet
                 </button>`
                : `<div class="inv-need-seeds">No packets of this type</div>`
            }
          </div>
        </div>
      `;

      const openBtn = document.getElementById("inv-open-btn");
      if (openBtn) {
        openBtn.addEventListener("click", () => {
          const pid = openBtn.dataset.id;
          const results = Shop.openPacket(pid);
          if (results) {
            showPacketOpenAnimation(results, pid);
          } else {
            showToast("No packets to open!");
          }
        });
      }
    }
  }

  function openPlantDetail(plantId) {
    const def = PlantRegistry.get(plantId);
    const pp = Player.getPlant(plantId);
    if (!def || !pp) return;

    const level = pp.level;
    const seeds = pp.seeds;
    const nextCost = Seeds.getLevelUpCost(level);
    const prog = nextCost ? Math.min(seeds / nextCost, 1) : 1;
    const maxLevel = level >= 15;
    const canUp = !maxLevel && seeds >= (nextCost || 0);
    const currStats = def.levelStats ? def.levelStats[level] || {} : {};
    const nextStats = def.levelStats
      ? def.levelStats[Math.min(level + 1, 15)] || {}
      : {};
    const stats = getStatDefs(plantId, currStats, nextStats);

    const content = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div style="position:relative;flex-shrink:0">
          <img src="${def.image}" alt="${def.name}"
            style="width:80px;height:80px;object-fit:contain;
            filter:drop-shadow(0 0 14px rgba(168,85,247,0.7))"/>
          <div class="cc-level-badge" style="font-size:12px;padding:3px 10px">Lv.${level}</div>
        </div>
        <div>
          <div style="font-size:13px;color:var(--gray);margin-bottom:4px">${def.description || ""}</div>
          <span class="cc-cost-badge">☀️ ${currStats.cost || def.cost} sun cost</span>
        </div>
      </div>

      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span style="font-size:12px;color:var(--gray)">🌱 Seeds</span>
          <span style="font-size:12px;color:var(--green);font-weight:700">
            ${maxLevel ? "MAX LEVEL" : `${seeds} / ${nextCost}`}
          </span>
        </div>
        <div class="cc-seed-bar" style="height:8px">
          <div class="cc-seed-fill" style="width:${maxLevel ? 100 : prog * 100}%"></div>
        </div>
      </div>

      <div style="font-size:11px;color:var(--gray);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">
        Stats
        ${
          !maxLevel
            ? `<span style="color:var(--purple-light);margin-left:8px;font-size:10px">■ Current</span>
        <span style="color:var(--green);margin-left:6px;font-size:10px">■ Next Lv</span>`
            : ""
        }
      </div>
      ${stats
        .map((s) => {
          const cPct = Math.min(
            100,
            Math.max(
              2,
              s.invert ? (1 - s.curr / s.max) * 100 : (s.curr / s.max) * 100,
            ),
          );
          const nPct = Math.min(
            100,
            Math.max(
              2,
              s.invert ? (1 - s.next / s.max) * 100 : (s.next / s.max) * 100,
            ),
          );
          const up = s.invert ? s.next < s.curr : s.next > s.curr;
          return `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
            <span style="font-size:11px;color:var(--gray);width:82px;flex-shrink:0">${s.label}</span>
            <div class="cc-sbar-bg" style="flex:1;height:10px;border-radius:5px">
              <div class="cc-sbar-curr" style="width:${cPct}%;height:100%;border-radius:5px"></div>
              ${!maxLevel && up ? `<div class="cc-sbar-next" style="width:${nPct}%;height:100%;border-radius:5px"></div>` : ""}
            </div>
            <span style="font-size:11px;color:var(--white);font-weight:700;width:38px;text-align:right">${s.curr}${s.unit}</span>
            ${
              !maxLevel && up
                ? `<span style="font-size:11px;color:var(--green);width:46px">▶${s.next}${s.unit}</span>`
                : `<span style="width:46px"></span>`
            }
          </div>
        `;
        })
        .join("")}

      ${
        maxLevel
          ? `<div class="cc-max-badge" style="text-align:center;font-size:14px;padding:10px;margin-top:10px">🏆 MAX LEVEL</div>`
          : canUp
            ? `<button class="cc-lvlup-btn" id="detail-lvlup" data-id="${plantId}"
            style="margin-top:14px;padding:14px;font-size:18px;border-radius:12px;width:100%">
            ⬆️ Level Up! (${seeds}/${nextCost} seeds)
          </button>`
            : `<div style="text-align:center;color:var(--gray);font-size:12px;margin-top:12px;padding:8px;
            background:rgba(255,255,255,0.04);border-radius:10px">
            Need ${(nextCost || 0) - seeds} more 🌱 seeds to level up
          </div>`
      }
    `;

    const popup = openPopup({
      id: "plant-detail-popup",
      title: `🌿 ${def.name}`,
      content,
    });

    // Wire level up button inside popup
    const lvlBtn = document.getElementById("detail-lvlup");
    if (lvlBtn) {
      lvlBtn.addEventListener("click", () => {
        const id = lvlBtn.dataset.id;
        if (Seeds.tryLevelUp(id)) {
          showToast(`${def.name} → Lv.${Player.getPlant(id).level}! 🎉`);
          popup.close();
          buildCollection();
          setTimeout(() => openPlantDetail(id), 300);
        }
      });
    }
  }

  function getStatDefs(plantId, curr, next) {
    if (plantId === "sunflower")
      return [
        {
          label: "☀️ Sun",
          curr: curr.sunValue || 25,
          next: next.sunValue || 25,
          max: 100,
          unit: "",
          invert: false,
        },
        {
          label: "⏱ Recharge",
          curr: curr.fireRate || 13000,
          next: next.fireRate || 13000,
          max: 13000,
          unit: "ms",
          invert: true,
        },
        {
          label: "💰 Cost",
          curr: curr.cost || 50,
          next: next.cost || 50,
          max: 50,
          unit: "☀️",
          invert: true,
        },
        {
          label: "❤️ HP",
          curr: curr.hp || 300,
          next: next.hp || 300,
          max: 920,
          unit: "",
          invert: false,
        },
      ];
    if (plantId === "peashooter")
      return [
        {
          label: "💥 Damage",
          curr: curr.damage || 20,
          next: next.damage || 20,
          max: 52,
          unit: "",
          invert: false,
        },
        {
          label: "⚡ FireRate",
          curr: curr.fireRate || 1500,
          next: next.fireRate || 1500,
          max: 1500,
          unit: "ms",
          invert: true,
        },
        {
          label: "❤️ HP",
          curr: curr.hp || 300,
          next: next.hp || 300,
          max: 660,
          unit: "",
          invert: false,
        },
      ];
    if (plantId === "icepea")
      return [
        {
          label: "💥 Damage",
          curr: curr.damage || 16,
          next: next.damage || 16,
          max: 43,
          unit: "",
          invert: false,
        },
        {
          label: "❄️ Freeze",
          curr: curr.slowDuration || 3000,
          next: next.slowDuration || 3000,
          max: 5000,
          unit: "ms",
          invert: false,
        },
        {
          label: "⚡ FireRate",
          curr: curr.fireRate || 2000,
          next: next.fireRate || 2000,
          max: 2000,
          unit: "ms",
          invert: true,
        },
        {
          label: "❤️ HP",
          curr: curr.hp || 300,
          next: next.hp || 300,
          max: 660,
          unit: "",
          invert: false,
        },
      ];
    if (plantId === "bonkchoy")
      return [
        {
          label: "💥 Damage",
          curr: curr.damage || 40,
          next: next.damage || 40,
          max: 105,
          unit: "",
          invert: false,
        },
        {
          label: "⚡ Punch",
          curr: curr.fireRate || 800,
          next: next.fireRate || 800,
          max: 800,
          unit: "ms",
          invert: true,
        },
        {
          label: "❤️ HP",
          curr: curr.hp || 400,
          next: next.hp || 400,
          max: 920,
          unit: "",
          invert: false,
        },
      ];
    return [];
  }

  function buildStatBars(plantId, curr, next, level, maxLevel) {
    const stats = [];

    // Define which stats to show per plant
    if (plantId === "sunflower") {
      stats.push({
        label: "☀️ Sun/drop",
        curr: curr.sunValue || 25,
        next: next.sunValue || 25,
        max: 100,
        unit: "",
      });
      stats.push({
        label: "⏱ Recharge",
        curr: curr.fireRate || 13000,
        next: next.fireRate || 13000,
        max: 13000,
        unit: "ms",
        invert: true,
      });
      stats.push({
        label: "💰 Cost",
        curr: curr.cost || 50,
        next: next.cost || 50,
        max: 50,
        unit: "☀️",
        invert: true,
      });
      stats.push({
        label: "❤️ HP",
        curr: curr.hp || 300,
        next: next.hp || 300,
        max: 920,
        unit: "",
      });
    } else if (plantId === "peashooter") {
      stats.push({
        label: "💥 Damage",
        curr: curr.damage || 20,
        next: next.damage || 20,
        max: 52,
        unit: "",
      });
      stats.push({
        label: "⏱ Fire Rate",
        curr: curr.fireRate || 1500,
        next: next.fireRate || 1500,
        max: 1500,
        unit: "ms",
        invert: true,
      });
      stats.push({
        label: "❤️ HP",
        curr: curr.hp || 300,
        next: next.hp || 300,
        max: 660,
        unit: "",
      });
    } else if (plantId === "icepea") {
      stats.push({
        label: "💥 Damage",
        curr: curr.damage || 16,
        next: next.damage || 16,
        max: 43,
        unit: "",
      });
      stats.push({
        label: "❄️ Freeze",
        curr: curr.slowDuration || 3000,
        next: next.slowDuration || 3000,
        max: 5000,
        unit: "ms",
      });
      stats.push({
        label: "⏱ Fire Rate",
        curr: curr.fireRate || 2000,
        next: next.fireRate || 2000,
        max: 2000,
        unit: "ms",
        invert: true,
      });
      stats.push({
        label: "❤️ HP",
        curr: curr.hp || 300,
        next: next.hp || 300,
        max: 660,
        unit: "",
      });
    } else if (plantId === "bonkchoy") {
      stats.push({
        label: "💥 Damage",
        curr: curr.damage || 40,
        next: next.damage || 40,
        max: 105,
        unit: "",
      });
      stats.push({
        label: "⏱ Punch Rate",
        curr: curr.fireRate || 800,
        next: next.fireRate || 800,
        max: 800,
        unit: "ms",
        invert: true,
      });
      stats.push({
        label: "❤️ HP",
        curr: curr.hp || 400,
        next: next.hp || 400,
        max: 920,
        unit: "",
      });
    }

    return stats
      .map((s) => {
        const currPct = s.invert
          ? (1 - (s.curr - s.max * 0.18) / (s.max * 0.82)) * 100
          : (s.curr / s.max) * 100;
        const nextPct = s.invert
          ? (1 - (s.next - s.max * 0.18) / (s.max * 0.82)) * 100
          : (s.next / s.max) * 100;
        const improved = s.invert ? s.next < s.curr : s.next > s.curr;
        const safe = (v) => Math.min(100, Math.max(2, v));

        return `
        <div class="cc-stat-row">
          <span class="cc-stat-label">${s.label}</span>
          <div class="cc-bar-wrap">
            <div class="cc-bar-curr" style="width:${safe(currPct)}%"></div>
            ${!maxLevel && improved ? `<div class="cc-bar-next" style="width:${safe(nextPct)}%;opacity:0.45"></div>` : ""}
          </div>
          <span class="cc-stat-val">${s.curr}${s.unit}</span>
          ${!maxLevel && improved ? `<span class="cc-stat-next">→${s.next}${s.unit}</span>` : ""}
        </div>
      `;
      })
      .join("");
  }
  function buildStatBars(plantId, curr, next, level, maxLevel) {
    const stats = [];

    // Define which stats to show per plant
    if (plantId === "sunflower") {
      stats.push({
        label: "☀️ Sun/drop",
        curr: curr.sunValue || 25,
        next: next.sunValue || 25,
        max: 100,
        unit: "",
      });
      stats.push({
        label: "⏱ Recharge",
        curr: curr.fireRate || 13000,
        next: next.fireRate || 13000,
        max: 13000,
        unit: "ms",
        invert: true,
      });
      stats.push({
        label: "💰 Cost",
        curr: curr.cost || 50,
        next: next.cost || 50,
        max: 50,
        unit: "☀️",
        invert: true,
      });
      stats.push({
        label: "❤️ HP",
        curr: curr.hp || 300,
        next: next.hp || 300,
        max: 920,
        unit: "",
      });
    } else if (plantId === "peashooter") {
      stats.push({
        label: "💥 Damage",
        curr: curr.damage || 20,
        next: next.damage || 20,
        max: 52,
        unit: "",
      });
      stats.push({
        label: "⏱ Fire Rate",
        curr: curr.fireRate || 1500,
        next: next.fireRate || 1500,
        max: 1500,
        unit: "ms",
        invert: true,
      });
      stats.push({
        label: "❤️ HP",
        curr: curr.hp || 300,
        next: next.hp || 300,
        max: 660,
        unit: "",
      });
    } else if (plantId === "icepea") {
      stats.push({
        label: "💥 Damage",
        curr: curr.damage || 16,
        next: next.damage || 16,
        max: 43,
        unit: "",
      });
      stats.push({
        label: "❄️ Freeze",
        curr: curr.slowDuration || 3000,
        next: next.slowDuration || 3000,
        max: 5000,
        unit: "ms",
      });
      stats.push({
        label: "⏱ Fire Rate",
        curr: curr.fireRate || 2000,
        next: next.fireRate || 2000,
        max: 2000,
        unit: "ms",
        invert: true,
      });
      stats.push({
        label: "❤️ HP",
        curr: curr.hp || 300,
        next: next.hp || 300,
        max: 660,
        unit: "",
      });
    } else if (plantId === "bonkchoy") {
      stats.push({
        label: "💥 Damage",
        curr: curr.damage || 40,
        next: next.damage || 40,
        max: 105,
        unit: "",
      });
      stats.push({
        label: "⏱ Punch Rate",
        curr: curr.fireRate || 800,
        next: next.fireRate || 800,
        max: 800,
        unit: "ms",
        invert: true,
      });
      stats.push({
        label: "❤️ HP",
        curr: curr.hp || 400,
        next: next.hp || 400,
        max: 920,
        unit: "",
      });
    }

    return stats
      .map((s) => {
        const currPct = s.invert
          ? (1 - (s.curr - s.max * 0.18) / (s.max * 0.82)) * 100
          : (s.curr / s.max) * 100;
        const nextPct = s.invert
          ? (1 - (s.next - s.max * 0.18) / (s.max * 0.82)) * 100
          : (s.next / s.max) * 100;
        const improved = s.invert ? s.next < s.curr : s.next > s.curr;
        const safe = (v) => Math.min(100, Math.max(2, v));

        return `
        <div class="cc-stat-row">
          <span class="cc-stat-label">${s.label}</span>
          <div class="cc-bar-wrap">
            <div class="cc-bar-curr" style="width:${safe(currPct)}%"></div>
            ${!maxLevel && improved ? `<div class="cc-bar-next" style="width:${safe(nextPct)}%;opacity:0.45"></div>` : ""}
          </div>
          <span class="cc-stat-val">${s.curr}${s.unit}</span>
          ${!maxLevel && improved ? `<span class="cc-stat-next">→${s.next}${s.unit}</span>` : ""}
        </div>
      `;
      })
      .join("");
  }

  // ── Minigames Hub ──────────────────────────────
  const MINIGAMES = [
    {
      id: "blockhunt",
      name: "Block Hunt",
      icon: "🎯",
      image: "assets/minigames/blockhunt.png",
      desc: "Find the matching block before time runs out!",
      reward: "Seeds",
    },
    {
      id: "bombball",
      name: "Bomb Ball",
      icon: "💣",
      image: "assets/minigames/bomball.png",
      desc: "Catch falling bombs, dodge the poison!",
      reward: "Seeds",
    },
    {
      id: "sharpshoot",
      name: "Sharp Shooters",
      icon: "🎯",
      image: "assets/minigames/shartshooter.png",
      desc: "Shoot demons before they escape!",
      reward: "Seeds",
    },
    {
      id: "discofdoom",
      name: "Disc of Doom",
      icon: "💿",
      image: null,
      desc: "Coming soon!",
      reward: "Seeds",
    },
    {
      id: "fleefacility",
      name: "Flee Facility",
      icon: "🏃",
      image: null,
      desc: "Coming soon!",
      reward: "Coins",
    },
    {
      id: "gladiator",
      name: "Gladiator Grounds",
      icon: "⚔️",
      image: null,
      desc: "Coming soon!",
      reward: "Seeds & Coins",
    },
    {
      id: "lasertag",
      name: "Laser Tag",
      icon: "🔫",
      image: null,
      desc: "Coming soon!",
      reward: "Seeds",
    },
    {
      id: "minutewin",
      name: "Minute 2 Win",
      icon: "⏱️",
      image: null,
      desc: "Coming soon!",
      reward: "Coins",
    },
  ];

  function buildMinigames() {
    const container = document.getElementById("minigames-grid");
    container.innerHTML = "";
    MINIGAMES.forEach((mg) => {
      const isUnlocked = Player.isMinigameUnlocked(mg.id);
      const card = document.createElement("div");
      card.className = "mg-card" + (isUnlocked ? "" : " locked");
      card.innerHTML = `
        <div class="mg-thumb">
          ${
            mg.image
              ? `<img src="${mg.image}" alt="${mg.name}" />`
              : `<div class="mg-thumb-placeholder">${mg.icon}</div>`
          }
          ${!isUnlocked ? `<div class="mg-lock-overlay">🔒</div>` : ""}
          ${isUnlocked ? `<div class="mg-play-btn">▶</div>` : ""}
        </div>
        <div class="mg-info">
          <div class="mg-name">${mg.name}</div>
          <div class="mg-desc">${mg.desc}</div>
          <div class="mg-reward">🎁 ${mg.reward}</div>
        </div>
      `;
      if (isUnlocked) {
        card.addEventListener("click", () => launchMinigame(mg.id));
      }
      container.appendChild(card);
    });
  }

  function launchMinigame(id) {
    if (id === "blockhunt") {
      showScreen("screen-blockhunt");
      BlockHunt.startGame();
    } else if (id === "bombball") {
      showScreen("screen-bombball");
      BombBall.startGame();
    } else if (id === "sharpshoot") {
      showScreen("screen-sharpshooters");
      SharpShooters.startGame();
    } else {
      showToast("Coming soon! 🚧");
    }
  }

  // ── Shop ─────────────────────────────────────────
  let shopTab = "seeds";

  function buildShop() {
    const container = document.getElementById("shop-grid");
    if (!container) return;

    // Build shop shell once
    if (!document.getElementById("shop-tab-bar")) {
      const screen = document.getElementById("screen-shop");
      const header =
        screen.querySelector(".shop-header") || screen.querySelector("h2");

      const tabBar = document.createElement("div");
      tabBar.id = "shop-tab-bar";
      tabBar.className = "shop-tab-bar";
      tabBar.innerHTML = `
        <button class="shop-tab active" data-tab="seeds">🌱 Seeds</button>
        <button class="shop-tab" data-tab="packets">📦 Packets</button>
        <button class="shop-tab" data-tab="boosts">⚡ Boosts</button>
        <button class="shop-tab" data-tab="plants">🛒 Plants</button>
        <button class="shop-tab" data-tab="event">🎉 Event</button>
      `;
      container.parentNode.insertBefore(tabBar, container);

      tabBar.addEventListener("click", (e) => {
        const tab = e.target.dataset.tab;
        if (!tab) return;
        document
          .querySelectorAll(".shop-tab")
          .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
        shopTab = tab;
        renderShopTab(tab);
      });
    }

    renderShopTab(shopTab);
  }

  function renderShopTab(tab) {
    const container = document.getElementById("shop-grid");
    if (!container) return;
    container.innerHTML = "";

    if (tab === "seeds") renderSeedsTab(container);
    else if (tab === "packets") renderPacketsTab(container);
    else if (tab === "boosts") renderBoostsTab(container);
    else if (tab === "plants") renderPlantsTab(container);
    else if (tab === "event") renderEventTab(container);
  }

  function formatTimeLeft(ms) {
    if (ms <= 0) return "Refreshing...";
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function renderSeedsTab(container) {
    const data = Shop.getSeedOffers();
    const now = Date.now();
    const timeLeft = data.nextRefresh - now;

    if (!data.offers || data.offers.length === 0) {
      container.innerHTML = `<div class="shop-empty">Complete more levels to unlock plant offers! 🌿</div>`;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "shop-seeds-grid";
    container.appendChild(grid);

    data.offers.forEach((offer, idx) => {
      const def = PlantRegistry.get(offer.plantId);
      if (!def) return;
      const pp = Player.getPlant(offer.plantId);
      const level = pp ? pp.level : 1;

      const isExpiringSoon = timeLeft < 3600000; // under 1 hour
      const badgeColor =
        offer.seeds >= 15
          ? "var(--gold)"
          : offer.seeds >= 10
            ? "var(--purple-light)"
            : "var(--green)";

      const card = document.createElement("div");
      card.className =
        "shop-seed-card" + (offer.purchased ? " shop-purchased" : "");

      card.innerHTML = `
        <div class="shop-seed-badge" style="background:${badgeColor}">
          ${offer.seeds >= 15 ? "⭐ BEST" : offer.seeds >= 10 ? "💜 GREAT" : "🌱 DEAL"}
        </div>
        <img src="${def.image}" alt="${def.name}" class="shop-seed-img"/>
        <div class="shop-seed-name">${def.name}</div>
        <div class="shop-seed-level">Lv.${level}</div>
        <div class="shop-seed-amount">+${offer.seeds} 🌱 Seeds</div>
        <div class="shop-seed-timer ${isExpiringSoon ? "expiring-soon" : ""}"
             data-refresh="${data.nextRefresh}">
          🔄 ${formatTimeLeft(timeLeft)}
        </div>
        <button class="shop-buy-btn ${offer.purchased ? "shop-bought-btn" : ""}"
          ${offer.purchased ? "disabled" : ""}>
          ${offer.purchased ? "✓ Purchased" : `🪙 ${offer.coinCost}`}
        </button>
      `;

      if (!offer.purchased) {
        card.querySelector(".shop-buy-btn").addEventListener("click", () => {
          const result = Shop.buySeedOffer(idx);
          if (result.ok) {
            showToast(`+${offer.seeds} 🌱 seeds for ${def.name}!`);
            updateCoinDisplays();
            renderShopTab("seeds");
          } else {
            showToast(result.msg);
          }
        });
      }

      grid.appendChild(card);
    });

    // Live countdown update every second
    const timerInterval = setInterval(() => {
      document
        .querySelectorAll(".shop-seed-timer[data-refresh]")
        .forEach((el) => {
          const refresh = parseInt(el.dataset.refresh);
          const left = refresh - Date.now();
          el.textContent = `🔄 ${formatTimeLeft(left)}`;
          el.classList.toggle("expiring-soon", left < 3600000);
          if (left <= 0) {
            clearInterval(timerInterval);
            renderShopTab("seeds"); // auto-refresh
          }
        });
    }, 1000);
  }

  function renderPacketsTab(container) {
    const header = document.createElement("div");
    header.className = "shop-packets-header";
    header.innerHTML = `
      <div class="shop-loom-balance">
        <img src="assets/shop/loom.png" class="loom-icon-sm"/> Your Looms: <strong id="shop-looms">${Player.getLooms()}</strong>
        <span style="font-size:11px;color:var(--gray);display:block;margin-top:2px">Earn looms from minigames & events</span>
      </div>
    `;
    container.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "shop-packets-grid";
    container.appendChild(grid);

    const rarityColors = {
      common: "#22c55e",
      rare: "#3b82f6",
      epic: "#a855f7",
      legendary: "#f59e0b",
    };

    Object.values(Shop.SEED_PACKETS).forEach((def) => {
      const inv = Player.getInventory();
      const owned = inv.find((i) => i.id === def.id);
      const qty = owned ? owned.quantity : 0;
      const color = rarityColors[def.rarity] || "#fff";

      const card = document.createElement("div");
      card.className = "shop-packet-card";
      card.style.borderColor = color;
      card.innerHTML = `
        <div class="shop-packet-rarity" style="color:${color}">${def.rarity.toUpperCase()}</div>
        <div class="shop-packet-emoji">${getPacketEmoji(def.id)}</div>
        <div class="shop-packet-name">${def.name}</div>
        <div class="shop-packet-desc">${def.description}</div>
        <div class="shop-packet-seeds">
          <strong>${def.seedCount}</strong> seeds
          ${!def.allowRepeats ? "· No repeats" : "· May repeat"}
        </div>
        <button class="shop-buy-btn shop-loom-btn">
        <img src="assets/shop/loom.png" class="loom-icon-sm"/> ${def.loomCost} Looms
        </button>
        ${qty > 0 ? `<div class="shop-packet-owned">In inventory: ×${qty}</div>` : ""}
      `;

      card.querySelector(".shop-loom-btn").addEventListener("click", () => {
        const result = Shop.buyPacket(def.id);
        if (result.ok) {
          showToast(`${def.name} added to inventory! 📦`);
          updateCoinDisplays();
          renderShopTab("packets");
        } else {
          showToast(result.msg);
        }
      });

      grid.appendChild(card);
    });
  }

  function renderBoostsTab(container) {
    container.innerHTML = `
      <div class="shop-coming-soon">
        <div style="font-size:48px">⚡</div>
        <div style="font-size:18px;font-weight:900;color:var(--gold)">Boosts Coming Soon!</div>
        <div style="color:var(--gray);font-size:13px;margin-top:8px">
          Sun boosts, damage multipliers, XP boosters and more.
        </div>
      </div>
    `;
  }

  function renderPlantsTab(container) {
    container.innerHTML = `
      <div class="shop-coming-soon">
        <div style="font-size:48px">🛒</div>
        <div style="font-size:18px;font-weight:900;color:var(--gold)">Plant Shop Coming Soon!</div>
        <div style="color:var(--gray);font-size:13px;margin-top:8px">
          Exclusive plants available for purchase will appear here.
        </div>
      </div>
    `;
  }

  function renderEventTab(container) {
    container.innerHTML = `
      <div class="shop-coming-soon">
        <div style="font-size:48px">🎉</div>
        <div style="font-size:18px;font-weight:900;color:var(--gold)">No Active Events</div>
        <div style="color:var(--gray);font-size:13px;margin-top:8px">
          Check back during special events for limited-time items!
        </div>
      </div>
    `;
  }

  // ── Battle Result ──────────────────────────────
  function showBattleResult(
    won,
    coinReward,
    seedReward,
    unlockedPlants = null,
    unlockedMinigames = null,
  ) {
    // ── Clean up any leftover sun coins / floating effects ──
    const effectsLayer = document.getElementById("effects-layer");
    if (effectsLayer) {
      // Remove sun coin elements and any floating text
      effectsLayer.querySelectorAll(
        ".sun-coin, .sun-orb, .float-text, .floating-sun, [class*='sun-']"
      ).forEach(el => el.remove());
    }
    // Also clear the coins layer if it exists separately
    const coinsLayer = document.getElementById("coins-layer");
    if (coinsLayer) coinsLayer.innerHTML = "";

    const titleEl = document.getElementById("result-title");
    const rewardsEl = document.getElementById("result-rewards");

    titleEl.textContent = won ? "🏆 Victory!" : "💀 Defeated!";
    titleEl.className = `result-title ${won ? "win" : "lose"}`;

    rewardsEl.innerHTML = "";
    if (won) {
      rewardsEl.innerHTML += `<div class="reward-row"><span>Coins Earned</span><span>🪙 ${coinReward}</span></div>`;
      if (seedReward) {
        const pname =
          PlantRegistry.get(seedReward.plantId)?.name || seedReward.plantId;
        rewardsEl.innerHTML += `<div class="reward-row"><span>Seeds → ${pname}</span><span>🌱 +${seedReward.amount}</span></div>`;
      }
      if (unlockedPlants && unlockedPlants.length > 0) {
        unlockedPlants.forEach((plantId) => {
          const def = PlantRegistry.get(plantId);
          rewardsEl.innerHTML += `
            <div class="reward-row" style="border:2px solid var(--green);background:rgba(34,197,94,0.1);flex-direction:column;gap:8px;padding:12px">
              <span style="color:var(--green);font-size:18px;font-weight:900">🌿 New Plant Unlocked!</span>
              <img src="${def ? def.image : ""}" style="width:80px;height:80px;object-fit:contain;margin:0 auto;filter:drop-shadow(0 0 20px var(--green))" />
              <span style="color:var(--white);font-family:var(--font-display);font-size:20px">${def ? def.name : plantId}</span>
            </div>
          `;
        });
      }
      if (unlockedMinigames && unlockedMinigames.length > 0) {
        unlockedMinigames.forEach((mgId) => {
          rewardsEl.innerHTML += `
            <div class="reward-row" style="border:2px solid var(--orange);background:rgba(255,106,0,0.1)">
              <span>🎮 Minigame Unlocked!</span>
              <span style="color:var(--orange);font-weight:900">${mgId}</span>
            </div>
          `;
        });
      }
    }

    showScreen("screen-result");
  }

  // ── Toast ──────────────────────────────────────
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2500);
  }

  // ── Arena background ───────────────────────────
  function setArenaBg(worldId) {
    const el = document.getElementById("arena-bg");
    if (el) {
      el.className = `arena-bg world-${worldId}`;
    }
  }

  // ── Wave banner ────────────────────────────────
  function showWaveBanner(text) {
    const arena = document.querySelector(".battle-arena");
    if (!arena) return;
    const banner = document.createElement("div");
    banner.className = "wave-banner";
    banner.textContent = text;
    arena.appendChild(banner);
    setTimeout(() => banner.remove(), 2000);
  }

  // ── Wire up static buttons ─────────────────────
  function initButtons() {
    // Name screen
    document.getElementById("btn-start-game").addEventListener("click", () => {
      const input = document.getElementById("player-name-input");
      const name = input.value.trim();
      if (!name) {
        showToast("Enter a name first! ✏️");
        return;
      }
      Player.setName(name);
      showScreen("screen-menu");
    });
    document
      .getElementById("player-name-input")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter")
          document.getElementById("btn-start-game").click();
      });

    // Menu
    document
      .getElementById("btn-play")
      .addEventListener("click", () => showScreen("screen-worldmap"));
    document
      .getElementById("btn-collection")
      .addEventListener("click", () => showScreen("screen-collection"));
    document
      .getElementById("btn-minigames")
      .addEventListener("click", () => showScreen("screen-minigames"));
    document
      .getElementById("btn-shop")
      .addEventListener("click", () => showScreen("screen-shop"));

    // World map back
    document
      .getElementById("btn-back-worldmap")
      .addEventListener("click", () => showScreen("screen-menu"));
    // Level select back
    document
      .getElementById("btn-back-levelselect")
      .addEventListener("click", () => showScreen("screen-worldmap"));
    // Picker back
    const backPickerBtn = document.getElementById("btn-back-picker");
    if (backPickerBtn) {
      backPickerBtn.addEventListener("click", () =>
        openLevelSelect(selectedWorldId),
      );
    }
    // Collection back
    document
      .getElementById("btn-back-collection")
      .addEventListener("click", () => showScreen("screen-menu"));
    // Minigames back
    document
      .getElementById("btn-back-minigames")
      .addEventListener("click", () => showScreen("screen-menu"));
    // Shop back
    document
      .getElementById("btn-back-shop")
      .addEventListener("click", () => showScreen("screen-menu"));

    // Start battle
    // btn-start-battle kept for safety but picker screen is no longer shown
    const startBattleBtn = document.getElementById("btn-start-battle");
    if (startBattleBtn) {
      startBattleBtn.addEventListener("click", () => {
        const tempPlants = Levels.getTempPlants(
          pendingBattleWorld,
          pendingBattleLevel,
        );
        Core.startBattle(
          pendingBattleWorld,
          pendingBattleLevel,
          [...selectedPlants],
          tempPlants,
        );
      });
    }

    // Pause / resume
    document
      .getElementById("btn-pause")
      .addEventListener("click", () => Core.pause());
    document
      .getElementById("btn-resume")
      .addEventListener("click", () => Core.resume());
    document.getElementById("btn-quit-battle").addEventListener("click", () => {
      document.getElementById("pause-overlay").classList.add("hidden");
      Core.endBattle(false);
      showScreen("screen-menu");
    });

    // Result buttons
    document.getElementById("btn-result-next").addEventListener("click", () => {
      const next = pendingBattleLevel + 1;
      const world = Levels.getWorld(pendingBattleWorld);
      if (next < world.levelCount) {
        openPlantPicker(pendingBattleWorld, next);
      } else {
        showScreen("screen-worldmap");
      }
    });
    document
      .getElementById("btn-result-menu")
      .addEventListener("click", () => showScreen("screen-menu"));
  }

  function init() {
    initButtons();
    BlockHunt.init();
    BombBall.init();
    SharpShooters.init();

    // Check if player already has a name → skip name screen
    if (Player.hasName()) {
      showScreen("screen-menu");
    } else {
      showScreen("screen-name");
    }
  }
  function openPopup({
    id = "global-popup",
    title = "",
    content = "",
    buttons = [],
    wide = false,
    onClose = null,
  } = {}) {
    // Remove existing
    document.getElementById(id)?.remove();

    const overlay = document.createElement("div");
    overlay.id = id;
    overlay.className = "popup-overlay";

    overlay.innerHTML = `
      <div class="popup-box${wide ? " popup-wide" : ""}">
        <div class="popup-header">
          ${title ? `<div class="popup-title">${title}</div>` : ""}
          <button class="popup-close" data-close>✕</button>
        </div>
        <div class="popup-body">${content}</div>
        ${
          buttons.length > 0
            ? `
          <div class="popup-footer">
            ${buttons
              .map(
                (b, i) =>
                  `<button class="popup-btn ${b.style || "primary"}" data-btn="${i}">${b.label}</button>`,
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;

    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add("popup-open");
      });
    });

    function closePopup() {
      overlay.classList.remove("popup-open");
      overlay.classList.add("popup-closing");
      setTimeout(() => {
        overlay.remove();
        if (onClose) onClose();
      }, 280);
    }

    // Close on backdrop
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePopup();
    });
    overlay.querySelector("[data-close]").addEventListener("click", closePopup);

    // Wire buttons
    buttons.forEach((b, i) => {
      const btn = overlay.querySelector(`[data-btn="${i}"]`);
      if (btn)
        btn.addEventListener("click", () => {
          if (b.action) b.action(closePopup);
          else closePopup();
        });
    });

    return { close: closePopup, el: overlay };
  }

  function closePopup(id = "global-popup") {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("popup-open");
    el.classList.add("popup-closing");
    setTimeout(() => el.remove(), 280);
  }
  function showPacketOpenAnimation(results, packetId) {
    // Create fullscreen overlay
    const overlay = document.createElement("div");
    overlay.className = "packet-open-overlay";
    overlay.id = "packet-open-overlay";

    overlay.innerHTML = `
      <div class="packet-open-stage">
        <div class="packet-open-title">Opening ${Shop.SEED_PACKETS[packetId]?.name || "Packet"}...</div>
        <div class="packet-cards-area" id="packet-cards-area"></div>
        <div class="packet-summary hidden" id="packet-summary"></div>
        <button class="packet-close-btn hidden" id="packet-close-btn">✓ Done</button>
      </div>
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add("packet-open-active"));

    const cardsArea = document.getElementById("packet-cards-area");
    const summary = document.getElementById("packet-summary");
    const closeBtn = document.getElementById("packet-close-btn");

    // Reveal cards one by one
    let i = 0;
    // Aggregate for summary
    const summaryMap = {};

    function revealNext() {
      if (i >= results.length) {
        // Show summary
        showSummary();
        return;
      }
      const r = results[i];
      i++;

      // Aggregate
      summaryMap[r.plantId] = summaryMap[r.plantId] || {
        name: r.plantName,
        image: r.image,
        seeds: 0,
      };
      summaryMap[r.plantId].seeds += r.seeds;

      const card = document.createElement("div");
      card.className = "packet-reveal-card";
      card.innerHTML = `
        <div class="prc-inner">
          <div class="prc-front">❓</div>
          <div class="prc-back">
            <span class="prc-sparkle prc-sparkle-tl">✦</span>
            <span class="prc-sparkle prc-sparkle-tr">✦</span>
            <span class="prc-sparkle prc-sparkle-bl">✦</span>
            <span class="prc-sparkle prc-sparkle-br">✦</span>
            <img src="${r.image}" alt="${r.plantName}"/>
            <div class="prc-plant-name">${r.plantName}</div>
            <div class="prc-seeds">+${r.seeds} 🌱</div>
          </div>
        </div>
      `;

      // Clear old card if area is full (keep last 3)
      if (cardsArea.children.length >= 3) {
        cardsArea.removeChild(cardsArea.firstChild);
      }
      cardsArea.appendChild(card);

      // Flip after short delay
      setTimeout(() => {
        card.classList.add("flipped");
        // Next card after flip completes
        setTimeout(revealNext, 600);
      }, 300);
    }

    function showSummary() {
      cardsArea.classList.add("hidden");
      summary.classList.remove("hidden");
      closeBtn.classList.remove("hidden");

      const entries = Object.values(summaryMap);
      summary.innerHTML = `
        <div class="packet-summary-title">🎉 You received!</div>
        <div class="packet-summary-grid">
          ${entries
            .map(
              (e) => `
            <div class="packet-summary-row">
              <img src="${e.image}" alt="${e.name}"/>
              <span>${e.name}</span>
              <span class="psr-seeds">+${e.seeds} 🌱</span>
            </div>
          `,
            )
            .join("")}
        </div>
      `;
    }

    closeBtn.addEventListener("click", () => {
      overlay.classList.remove("packet-open-active");
      setTimeout(() => {
        overlay.remove();
        // Refresh inventory
        buildInventoryGrid("packets");
        selectInventoryItem("packet", packetId);
      }, 300);
    });

    // Start reveals
    setTimeout(revealNext, 500);
  }
  function showUpgradeCard(def, oldLevel, newLevel, oldStats, newStats) {
    // Build stat comparison list
    const statDefs = getStatDefs(def.id, oldStats, newStats);
    if (statDefs.length === 0) {
      // Fallback generic stats
      ["hp", "damage", "fireRate"].forEach((k) => {
        if (
          oldStats[k] !== undefined &&
          newStats[k] !== undefined &&
          oldStats[k] !== newStats[k]
        ) {
          statDefs.push({
            label:
              k === "hp" ? "❤️ HP" : k === "damage" ? "💥 Damage" : "⚡ Speed",
            curr: oldStats[k],
            next: newStats[k],
            max: Math.max(oldStats[k], newStats[k]) * 1.2,
            unit: "",
            invert: k === "fireRate",
          });
        }
      });
    }

    const overlay = document.createElement("div");
    overlay.className = "upgrade-card-overlay";
    overlay.innerHTML = `
      <div class="upgrade-card-box">
      <div class="upgrade-orb upgrade-orb-1"></div>
        <div class="upgrade-orb upgrade-orb-2"></div>
        <div class="upgrade-card-title">⬆️ Level Up!</div>
        <div class="upgrade-card-plant">
          <img src="${def.image}" alt="${def.name}"/>
          <div class="upgrade-img-ring"></div>
            <div class="upgrade-img-ring upgrade-img-ring-2"></div>
          <div class="upgrade-card-lvl">
            <div class="upgrade-lvl-from">Lv.${oldLevel}</div>
            <div class="upgrade-lvl-to">Lv.${newLevel} ✨</div>
            <div class="upgrade-lvl-stars"><span>⭐</span><span>⭐</span><span>⭐</span></div>
            <div style="font-size:13px;color:var(--white);font-weight:700">${def.name}</div>
          </div>
        </div>
        <div class="upgrade-stats-list" id="upgrade-stats-list">
          ${statDefs
            .filter((s) => {
              const improved = s.invert ? s.next < s.curr : s.next > s.curr;
              return improved;
            })
            .map((s, i) => {
              const oldPct = Math.min(
                100,
                Math.max(
                  2,
                  s.invert
                    ? (1 - s.curr / s.max) * 100
                    : (s.curr / s.max) * 100,
                ),
              );
              const newPct = Math.min(
                100,
                Math.max(
                  2,
                  s.invert
                    ? (1 - s.next / s.max) * 100
                    : (s.next / s.max) * 100,
                ),
              );
              return `
              <div class="upgrade-stat-row" style="animation-delay:${0.1 + i * 0.12}s">
                <span class="upgrade-stat-label">${s.label}</span>
                <div class="upgrade-stat-bar-wrap">
                  <div class="upgrade-stat-bar-old" style="width:${oldPct}%"></div>
                  <div class="upgrade-stat-bar-new" data-pct="${newPct}" style="width:0%"></div>
                </div>
                <div class="upgrade-stat-vals">
                  <span class="upgrade-stat-old">${s.curr}${s.unit}</span>
                  <span class="upgrade-stat-new">${s.next}${s.unit}</span>
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
        <button class="upgrade-close-btn" id="upgrade-close-btn">🎉 Awesome!</button>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add("active");
        // Animate bars after overlay appears
        setTimeout(() => {
          overlay.querySelectorAll(".upgrade-stat-bar-new").forEach((bar) => {
            bar.style.width = bar.dataset.pct + "%";
          });
        }, 400);
      });
    });

    document
      .getElementById("upgrade-close-btn")
      .addEventListener("click", () => {
        overlay.classList.remove("active");
        setTimeout(() => overlay.remove(), 300);
      });

    // Also close on backdrop tap
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
        setTimeout(() => overlay.remove(), 300);
      }
    });
  }
  return {
    init,
    showScreen,
    updateCoinDisplays,
    updateSunDisplay,
    updateWaveDisplay,
    setWaveProgress,
    showFloatingText,
    buildPlantTray,
    updateTrayCard,
    setSelectedTrayCard,
    setShovelActive,
    showBattleResult,
    showToast,
    setArenaBg,
    showWaveBanner,
    openLevelSelect,
    get selectedPlants() {
      return selectedPlants;
    },
    get pendingBattleWorld() {
      return pendingBattleWorld;
    },
    get pendingBattleLevel() {
      return pendingBattleLevel;
    },
    openPopup,
    closePopup,
  };
})();
