const BlockHunt = (() => {
  const DIFFICULTIES = [
    {
      name: "Easy",
      pips: 1,
      cols: 6,
      rows: 6,
      time: 8,
      similarCount: 0,
      reward: { seeds: 1, coins: 2 },
    },
    {
      name: "Medium",
      pips: 2,
      cols: 8,
      rows: 6,
      time: 7,
      similarCount: 2,
      reward: { seeds: 2, coins: 9 },
    },
    {
      name: "Hard",
      pips: 3,
      cols: 9,
      rows: 6,
      time: 5,
      similarCount: 4,
      reward: { seeds: 4, coins: 15 },
    },
    {
      name: "Expert",
      pips: 4,
      cols: 10,
      rows: 7,
      time: 4,
      similarCount: 6,
      reward: { seeds: 6, coins: 30 },
    },
    {
      name: "Insane",
      pips: 5,
      cols: 15,
      rows: 8,
      time: 3,
      similarCount: 8,
      reward: { seeds: 9, coins: 45 },
    },
  ];

  const EMOJI_GROUPS = [
    ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣"],
    ["🙂", "😊", "☺️", "😌", "😉", "😇"],
    ["⭐", "🌟", "✨", "💫", "🪄", "🔆"],
    ["❤️", "🩷", "🧡", "💛", "💚", "💙"],
    ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖"],
    ["☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️"],
    ["🌸", "🌺", "🌼", "🌻", "💮", "🏵️"],
    ["🍎", "🍅", "🍟", "🌶️", "🍒", "🍓"],
    ["💎", "🔷", "🔹", "🔶", "🔸", "💠"],
  ];

  let screen = null;
  let state = null;
  let timerInterval = null;
  let currentDiff = 0;
  let _devMode = false; // true when launched from dev_test

  // ── Init ──────────────────────────────────────────────────────────────────
  // Normal game:   BlockHunt.init()            — no args
  // Dev test:      BlockHunt.init(container, diffIdx, callbacks)
  function init(container, diffIdx, callbacks) {
    if (container) {
      _devMode = true;
      screen = container;
    } else {
      _devMode = false;
      screen = document.getElementById("screen-blockhunt");
    }
    buildUI();
    if (_devMode) startGame(diffIdx || 0);
  }

  function buildUI() {
    screen.innerHTML = `
      <div class="bh-container" id="bh-container">
        <div class="bh-header">
          <button class="btn-back" id="bh-back">← Back</button>
          <h2>🎯 Block Hunt</h2>
          <div class="bh-stats">
            <div class="bh-stat"><span class="stat-val" id="bh-score">0</span><span class="stat-lbl">Score</span></div>
            <div class="bh-stat"><span class="stat-val" id="bh-round">1/5</span><span class="stat-lbl">Round</span></div>
            <div class="bh-stat"><span class="stat-val" id="bh-time">12</span><span class="stat-lbl">Time</span></div>
          </div>
        </div>
        <div class="bh-timer-bar"><div class="bh-timer-fill" id="bh-timer-fill"></div></div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:var(--gray);letter-spacing:1px">DIFFICULTY</span>
            <div class="bh-diff-badge" id="bh-diff-badge"></div>
            <span id="bh-diff-name" style="font-family:var(--font-display);font-size:16px;color:var(--orange)"></span>
          </div>
          <div class="bh-lives" id="bh-lives">❤️❤️❤️</div>
        </div>
        <div class="bh-target-area">
          <span class="bh-target-label">FIND</span>
          <span class="bh-target-arrow">➡️</span>
          <div class="bh-target-block" id="bh-target-block">?</div>
          <span class="bh-target-arrow">⬅️</span>
          <span class="bh-target-label">THIS</span>
        </div>
        <div class="bh-grid-wrapper"><div id="bh-grid" class="bh-grid"></div></div>
      </div>
    `;

    document.getElementById("bh-back").addEventListener("click", () => {
      stopGame();
      if (!_devMode && typeof UI !== "undefined")
        UI.showScreen("screen-minigames");
    });
  }

  function showDifficultyPicker() {
    const container = document.getElementById("bh-container");
    if (!container) {
      console.error("Container #bh-container not found");
      return;
    }

    const picker = document.createElement("div");
    picker.className = "bh-result";
    picker.id = "bh-diff-picker";
    picker.innerHTML = `
    <button class="btn-back" style="align-self:flex-start;margin-bottom:8px" id="bh-pick-back">← Back</button>
    <h2 style="font-size:36px">Choose Difficulty</h2>
    ${DIFFICULTIES.map(
      (d, i) => `
      <button class="btn-menu" data-diff="${i}" style="width:480px;text-align:center">
        ${"🔥".repeat(d.pips)} ${d.name}
        <span style="font-size:14px;color:var(--gold);display:block">
          ${d.cols}×${d.rows} grid · ${d.time}s · 🌱${d.reward.seeds} 🪙${d.reward.coins}
        </span>
      </button>`,
    ).join("")}
  `;
    container.appendChild(picker);
    picker.querySelectorAll("[data-diff]").forEach((btn) => {
      btn.addEventListener("click", () => {
        picker.remove();
        startGame(parseInt(btn.dataset.diff));
      });
    });
    picker.querySelector("#bh-pick-back").addEventListener("click", () => {
      picker.remove();
      if (!_devMode && typeof UI !== "undefined")
        UI.showScreen("screen-minigames");
    });
  }

  function startGame(diffIdx = 0) {
    currentDiff = Math.min(diffIdx, DIFFICULTIES.length - 1);
    state = {
      score: 0,
      round: 1,
      totalRounds: 15,
      lives: 4,
      streak: 0,
      running: false,
    };

    const badge = document.getElementById("bh-diff-badge");
    if (badge)
      badge.innerHTML = DIFFICULTIES.map(
        (_, i) =>
          `<div class="bh-diff-pip${i <= currentDiff ? " active" : ""}"></div>`,
      ).join("");
    const nameEl = document.getElementById("bh-diff-name");
    if (nameEl) nameEl.textContent = DIFFICULTIES[currentDiff].name;

    updateHUD();
    startRound();
  }

  function startRound() {
    if (state.round > state.totalRounds || state.lives <= 0) {
      endGame();
      return;
    }

    const diff = DIFFICULTIES[currentDiff];
    state.running = true;

    const group = EMOJI_GROUPS[Math.floor(Math.random() * EMOJI_GROUPS.length)];
    const targetEmoji = group[Math.floor(Math.random() * group.length)];

    const targetBlock = document.getElementById("bh-target-block");
    if (targetBlock) targetBlock.textContent = targetEmoji;

    const gridEl = document.getElementById("bh-grid");
    gridEl.style.gridTemplateColumns = `repeat(${diff.cols}, 70px)`;
    gridEl.innerHTML = "";

    const total = diff.cols * diff.rows;
    const targetIdx = Math.floor(Math.random() * total);
    const otherGroup = group.filter((e) => e !== targetEmoji);
    const allOthers = EMOJI_GROUPS.flat().filter((e) => e !== targetEmoji);

    for (let i = 0; i < total; i++) {
      const block = document.createElement("div");
      block.className = "bh-block";
      if (i === targetIdx) {
        block.textContent = targetEmoji;
        block.dataset.correct = "true";
      } else {
        const useSimilar =
          otherGroup.length > 0 &&
          Math.random() < diff.similarCount / (diff.cols * diff.rows);
        block.textContent = useSimilar
          ? otherGroup[Math.floor(Math.random() * otherGroup.length)]
          : allOthers[Math.floor(Math.random() * allOthers.length)];
      }
      block.addEventListener("click", () => onBlockClick(block));
      gridEl.appendChild(block);
    }

    clearInterval(timerInterval);
    let timeLeft = diff.time;
    document.getElementById("bh-time").textContent = timeLeft;
    document.getElementById("bh-timer-fill").style.width = "100%";

    const startMs = Date.now();
    timerInterval = setInterval(() => {
      const elapsed = (Date.now() - startMs) / 1000;
      timeLeft = Math.max(0, diff.time - elapsed);
      document.getElementById("bh-time").textContent = Math.ceil(timeLeft);
      document.getElementById("bh-timer-fill").style.width =
        (timeLeft / diff.time) * 100 + "%";

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        state.running = false;
        state.streak = 0;
        state.lives--;
        updateHUD();
        if (targetBlock) {
          targetBlock.style.boxShadow = "0 0 30px red";
          setTimeout(() => {
            targetBlock.style.boxShadow = "";
          }, 600);
        }
        gridEl
          .querySelectorAll("[data-correct]")
          .forEach((b) => b.classList.add("revealed"));
        setTimeout(() => {
          state.round++;
          startRound();
        }, 1000);
      }
    }, 100);
  }

  function onBlockClick(blockEl) {
    if (!state.running) return;
    clearInterval(timerInterval);
    state.running = false;

    if (blockEl.dataset.correct === "true") {
      blockEl.classList.add("correct");
      state.streak++;
      state.score += 1 + (state.streak >= 3 ? 1 : 0);
      updateHUD();
      setTimeout(() => {
        state.round++;
        startRound();
      }, 500);
    } else {
      blockEl.classList.add("wrong");
      state.streak = 0;
      state.lives--;
      updateHUD();
      document
        .getElementById("bh-grid")
        .querySelectorAll("[data-correct]")
        .forEach((b) => b.classList.add("revealed"));
      if (state.lives <= 0) {
        setTimeout(() => endGame(), 900);
      } else {
        setTimeout(() => {
          state.round++;
          startRound();
        }, 900);
      }
    }
  }

  function updateHUD() {
    const s = document.getElementById("bh-score");
    const r = document.getElementById("bh-round");
    const l = document.getElementById("bh-lives");
    if (s) s.textContent = state.score;
    if (r)
      r.textContent = `${Math.min(state.round, state.totalRounds)}/${state.totalRounds}`;
    if (l)
      l.textContent =
        "❤️".repeat(Math.max(0, state.lives)) +
        "🖤".repeat(Math.max(0, 3 - state.lives));
  }

  function endGame() {
    clearInterval(timerInterval);
    const diff = DIFFICULTIES[currentDiff];
    const reward = diff.reward;
    const won = state.score > 16;

    let plantName = "";
    if (won) {
      if (typeof Seeds !== "undefined") {
        const seedReward = Seeds.giveRandomSeeds(reward.seeds);
        plantName = seedReward
          ? typeof PlantRegistry !== "undefined"
            ? PlantRegistry.get(seedReward.plantId)?.name || ""
            : ""
          : "";
      }
      if (typeof Player !== "undefined") Player.addCoins(reward.coins);
      if (typeof UI !== "undefined") UI.updateCoinDisplays();
    }

    const container = document.getElementById("bh-container");
    const overlay = document.createElement("div");
    overlay.className = "bh-result";
    overlay.innerHTML = `
      <h2>${won ? "🏆 Perfect!" : "😥"}</h2>
      <div class="bh-score-final">Score: ${state.score} / ${state.totalRounds} rounds</div>
      ${
        won
          ? `
        <div class="bh-seeds-earned">🌱 +${reward.seeds} seeds${plantName ? " → " + plantName : ""}</div>
        <div class="bh-seeds-earned" style="color:var(--gold)">🪙 +${reward.coins} coins</div>`
          : ""
      }
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px">
        ${
          currentDiff < DIFFICULTIES.length - 1
            ? `
          <button class="btn-primary" id="bh-harder" style="max-width:200px">
            Harder: ${DIFFICULTIES[currentDiff + 1].name} 🔥
          </button>`
            : ""
        }
        <button class="btn-primary"   id="bh-replay"  style="max-width:200px">🔄 Replay</button>
        <button class="btn-secondary" id="bh-change"  style="max-width:200px">📋 Change Diff</button>
        <button class="btn-secondary" id="bh-exit"    style="max-width:200px">🏠 Menu</button>
      </div>
    `;
    container.appendChild(overlay);

    const harderBtn = document.getElementById("bh-harder");
    if (harderBtn)
      harderBtn.addEventListener("click", () => {
        overlay.remove();
        startGame(currentDiff + 1);
      });
    document.getElementById("bh-replay").addEventListener("click", () => {
      overlay.remove();
      startGame(currentDiff);
    });
    document.getElementById("bh-change").addEventListener("click", () => {
      overlay.remove();
      showDifficultyPicker();
    });
    document.getElementById("bh-exit").addEventListener("click", () => {
      stopGame();
      if (!_devMode && typeof UI !== "undefined")
        UI.showScreen("screen-minigames");
    });
  }

  function stopGame() {
    clearInterval(timerInterval);
    state = null;
    if (screen) screen.innerHTML = "";
  }

  function initAndPick() {
    if (!_devMode) {
      screen = document.getElementById("screen-blockhunt");
      buildUI();
    }
    showDifficultyPicker();
  }

  return { init, startGame: initAndPick, stop: stopGame, stopGame };
})();
