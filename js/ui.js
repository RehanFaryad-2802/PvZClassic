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
    document
      .querySelectorAll(
        "#menu-coins, #wm-coins, #ls-coins, #hud-coins, #mg-coins, #shop-coins",
      )
      .forEach((el) => {
        if (el) el.textContent = coins;
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
    selectedPlants = [];

    // Get temp plants for this level
    const tempPlants = Levels.getTempPlants(worldId, levelIdx);

    // Get all owned plants
    const owned = Player.getOwnedPlants();
    const totalAvailable = owned.length + tempPlants.length;

    // If 9 or fewer plants total — skip picker, go straight to battle
    if (totalAvailable <= MAX_PICKS) {
      const ownedIds = owned.map((p) => p.id);
      Core.startBattle(worldId, levelIdx, ownedIds, tempPlants);
      return;
    }

    // Otherwise show picker
    document.getElementById("picker-max").textContent = MAX_PICKS;
    buildPickerAvailable(tempPlants);
    buildPickerSelected();
    showScreen("screen-plantpicker");
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

  // ── Collection ─────────────────────────────────
  function buildCollection() {
    const container = document.getElementById("collection-grid");
    container.innerHTML = "";
    const allPlants = PlantRegistry.getAll();

    const grid = document.createElement("div");
    grid.style.cssText =
      "display:grid;grid-template-columns:repeat(10,1fr);gap:14px;";
    container.appendChild(grid);

    allPlants.forEach((def) => {
      const pp = Player.getPlant(def.id);
      const owned = pp && pp.owned;
      const level = pp ? pp.level : 1;

      const card = document.createElement("div");
      card.className = "cc-grid-card" + (owned ? "" : " locked");
      card.style.cssText =
        "cursor:pointer;align-items:center;text-align:center;padding:14px 8px;";
      card.innerHTML = `
        <div style="position:relative;display:inline-block;margin-bottom:8px">
          <img src="${def.image}" alt="${def.name}"
            style="width:80px;height:80px;object-fit:contain;
            ${owned ? "" : "filter:grayscale(1) brightness(0.3)"}"/>
          <div class="cc-level-badge" style="${owned ? "" : "background:#444"}">
            ${owned ? `Lv.${level}` : "🔒"}
          </div>
        </div>
        <div class="cc-grid-name">${def.name}</div>
      `;

      if (owned) {
        card.addEventListener("click", () => openPlantDetail(def.id));
      }
      grid.appendChild(card);
    });
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
      desc: "Find the glowing block!",
      reward: "Seeds",
      unlocked: false, // unlocked by level 4
    },
    {
      id: "bombball",
      name: "Bomb Ball",
      icon: "💣",
      desc: "Catch falling bombs!",
      reward: "Seeds",
      unlocked: false,
    },
    {
      id: "discofdoom",
      name: "Disc of Doom",
      icon: "💿",
      desc: "Coming soon!",
      reward: "Seeds",
      unlocked: false,
    },
    {
      id: "fleefacility",
      name: "Flee Facility",
      icon: "🏃",
      desc: "Coming soon!",
      reward: "Coins",
      unlocked: false,
    },
    {
      id: "gladiator",
      name: "Gladiator",
      icon: "⚔️",
      desc: "Coming soon!",
      reward: "Coins",
      unlocked: false,
    },
    {
      id: "lasertag",
      name: "Laser Tag",
      icon: "🔫",
      desc: "Coming soon!",
      reward: "Seeds",
      unlocked: false,
    },
    {
      id: "minutewin",
      name: "Minute 2 Win",
      icon: "⏱️",
      desc: "Coming soon!",
      reward: "Coins",
      unlocked: false,
    },
    {
      id: "sharpshoot",
      name: "Sharp Shooters",
      icon: "🎯",
      desc: "Shoot demons before they escape!",
      reward: "Seeds",
      unlocked: false,
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
        <div class="mg-icon">${mg.icon}</div>
        <div class="mg-name">${mg.name}</div>
        <div class="mg-reward">Reward: ${mg.reward}</div>
        <div style="font-size:11px;color:var(--gray)">${mg.desc}</div>
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

  // ── Shop ───────────────────────────────────────
  function buildShop() {
    const container = document.getElementById("shop-grid");
    container.innerHTML = "";
    const allPlants = PlantRegistry.getAll();

    allPlants.forEach((def) => {
      const pp = Player.getPlant(def.id);
      if (!pp) return;
      const cost = pp.owned ? 50 : 30;
      const label = pp.owned
        ? `+5 Seeds`
        : `Unlock (${Seeds.UNLOCK_COST} seeds)`;

      const item = document.createElement("div");
      item.className = "shop-item";
      item.innerHTML = `
        <img src="${def.image}" alt="${def.name}" />
        <div class="si-name">${def.name}</div>
        <div class="si-seeds">${label}</div>
        <div class="si-price">🪙 ${cost}</div>
      `;
      item.addEventListener("click", () => {
        if (Player.spendCoins(cost)) {
          Seeds.giveSeeds(def.id, 5);
          updateCoinDisplays();
          showToast(`Bought seeds for ${def.name}! 🌱`);
          buildShop();
        } else {
          showToast("Not enough coins! 🪙");
        }
      });
      container.appendChild(item);
    });
  }

  // ── Battle Result ──────────────────────────────
  function showBattleResult(
    won,
    coinReward,
    seedReward,
    unlockedPlants = null,
    unlockedMinigames = null,
  ) {
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
    document
      .getElementById("btn-back-picker")
      .addEventListener("click", () => openLevelSelect(selectedWorldId));
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
    document
      .getElementById("btn-start-battle")
      .addEventListener("click", () => {
        if (selectedPlants.length === 0) {
          showToast("Select at least 1 plant!");
          return;
        }
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
