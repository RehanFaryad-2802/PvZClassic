/* js/minigames/tutorial.js
   Shared tutorial engine for all minigames.
   Each minigame registers its own steps here.
   Auto-shows on first play, re-playable via button.
*/

const MiniTutorial = (() => {

  // ── Tutorial definitions ──────────────────────────
  // Each step: { title, body, highlight? (CSS selector relative to screen) }
  const TUTORIALS = {

    blockhunt: [
      {
        title: "🎯 Block Hunt",
        body:  "Find the TARGET block hidden among dozens of look-alikes. The target is shown at the top — find it fast!",
        img:   "🎯",
      },
      {
        title: "⏱️ Beat the Timer",
        body:  "Each round has a countdown. Run out of time or tap the wrong block and you lose a ❤️ life. Lose all lives and the game ends.",
        img:   "⏱️",
      },
      {
        title: "🔥 Streaks = Bonus",
        body:  "Find 3 blocks in a row correctly for a streak bonus! Harder difficulties have more blocks and less time — but bigger seed rewards.",
        img:   "🔥",
      },
      {
        title: "🌱 Rewards",
        body:  "Win a round to earn Seeds & Coins. Seeds level up your plants. Higher difficulty = more seeds!",
        img:   "🌱",
      },
    ],

    bombball: [
      {
        title: "💣 Bomb Ball",
        body:  "Bombs fall from the sky. Catch the good ones, dodge the bad ones — tap bombs to catch or swipe them away!",
        img:   "💣",
      },
      {
        title: "🎯 What to Catch",
        body:  "Green glowing bombs = CATCH for points. Red bombs = DANGER, let them fall or you lose a life. Watch the colour!",
        img:   "🎯",
      },
      {
        title: "⚡ Power-ups",
        body:  "Special bombs grant temporary powers: slow time, double points, extra lives. Tap them quickly before they fall past!",
        img:   "⚡",
      },
      {
        title: "🌱 Rewards",
        body:  "Every bomb you catch earns coins. Survive the full round to earn bonus Seeds for your plants!",
        img:   "🌱",
      },
    ],

    sharpshooters: [
      {
        title: "🎯 Sharp Shooters",
        body:  "Demons march across the screen. Tap them to shoot! Miss too many and they'll escape — costing you a life.",
        img:   "🎯",
      },
      {
        title: "👹 Demon Types",
        body:  "Normal demons die in one shot. Boss demons (with HP bars) need multiple hits. Armoured demons take extra damage to break through!",
        img:   "👹",
      },
      {
        title: "💚 Power-up Demons",
        body:  "Green-glowing demons are power-ups — shoot them for bonus effects like freeze all, frenzy mode (double score), or extra lives.",
        img:   "💚",
      },
      {
        title: "🌱 Rewards",
        body:  "Each demon you defeat earns points. Complete the round to earn Seeds and Coins based on your difficulty level.",
        img:   "🌱",
      },
    ],

    discofdoom: [
      {
        title: "💿 Disc of Doom",
        body:  "Demons march from the right. Your job: fire attack discs to stop them before they reach the left side!",
        img:   "💿",
      },
      {
        title: "📋 The Queue Rail",
        body:  "Attack discs queue up on the LEFT panel, sliding down like a conveyor belt. The bottom disc is always loaded and ready to fire.",
        img:   "📋",
        highlight: ".dod-rail-panel",
      },
      {
        title: "🔫 The Fire Zone",
        body:  "Tap anywhere inside the FIRE ZONE (the highlighted left strip of the arena) to launch the loaded disc at that row of demons.",
        img:   "🔫",
        highlight: ".dod-fire-zone",
      },
      {
        title: "🔄 Swap & Reorder",
        body:  "Tap any disc in the queue to instantly swap it into the loaded slot. The previously loaded disc goes back into the queue.",
        img:   "🔄",
      },
      {
        title: "🔥 Disc Types",
        body:  "💿 Normal — steady damage\n🔥 Fire — instant hit + burn damage over time\n❄️ Ice — hits and freezes the demon\n⭐ Star — RARE! Hits ALL demons on screen at once!",
        img:   "🔥",
      },
      {
        title: "❤️ Lives",
        body:  "If a demon reaches the left wall, you lose a ❤️ life. Lose all 3 lives and the game ends. Keep firing!",
        img:   "❤️",
      },
    ],

  };

  // ── Storage helpers ───────────────────────────────
  const STORAGE_KEY = "pvz3_mg_tutorial_seen";

  function getSeenSet() {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); }
    catch { return new Set(); }
  }

  function markSeen(mgId) {
    const s = getSeenSet();
    s.add(mgId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  }

  function hasSeen(mgId) {
    return getSeenSet().has(mgId);
  }

  // ── Public: show tutorial ─────────────────────────
  // screenEl  : the screen DOM element to attach the overlay to
  // mgId      : key in TUTORIALS
  // onDone    : callback when tutorial finishes or is cancelled
  function show(screenEl, mgId, onDone) {
    const steps = TUTORIALS[mgId];
    if (!steps || steps.length === 0) { onDone && onDone(); return; }

    markSeen(mgId);

    let step = 0;

    const overlay = document.createElement("div");
    overlay.className = "tut-overlay";
    screenEl.appendChild(overlay);

    function render() {
      const s = steps[step];
      const isLast = step === steps.length - 1;

      overlay.innerHTML = `
        <div class="tut-box">
          <div class="tut-progress">
            ${steps.map((_,i) => `<div class="tut-pip${i===step?" active":""}"></div>`).join("")}
          </div>
          <div class="tut-img">${s.img}</div>
          <div class="tut-title">${s.title}</div>
          <div class="tut-body">${s.body.replace(/\n/g,"<br>")}</div>
          <div class="tut-btns">
            <button class="tut-btn-cancel" id="tut-cancel">✕ Cancel</button>
            ${step > 0 ? `<button class="tut-btn-prev" id="tut-prev">← Back</button>` : ""}
            <button class="tut-btn-next" id="tut-next">
              ${isLast ? "✅ Let's Play!" : "Next →"}
            </button>
          </div>
          <div class="tut-step-label">${step+1} / ${steps.length}</div>
        </div>
      `;

      overlay.querySelector("#tut-cancel").addEventListener("click", () => {
        overlay.remove();
        onDone && onDone();
      });

      const prev = overlay.querySelector("#tut-prev");
      if (prev) prev.addEventListener("click", () => { step--; render(); });

      overlay.querySelector("#tut-next").addEventListener("click", () => {
        if (isLast) {
          overlay.remove();
          onDone && onDone();
        } else {
          step++;
          render();
        }
      });

      // Highlight element if specified
      document.querySelectorAll(".tut-highlight").forEach(e => e.classList.remove("tut-highlight"));
      if (s.highlight) {
        const target = screenEl.querySelector(s.highlight);
        if (target) target.classList.add("tut-highlight");
      }
    }

    render();
  }

  // ── Public: should auto-show? ─────────────────────
  function shouldAutoShow(mgId) {
    return !hasSeen(mgId) && !!TUTORIALS[mgId];
  }

  // ── Public: has tutorial? ─────────────────────────
  function hasTutorial(mgId) {
    return !!TUTORIALS[mgId];
  }

  // Reset (for testing)
  function reset(mgId) {
    if (mgId) {
      const s = getSeenSet(); s.delete(mgId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return { show, shouldAutoShow, hasTutorial, reset };
})();

/* ── Shared countdown used by ALL minigames ──────────
   MgCountdown.show(screenEl, 3, callback)
   Only the number animates — the dark overlay is static.
*/
const MgCountdown = (() => {
  function show(screenEl, n, cb) {
    const overlay = document.createElement("div");
    overlay.className = "mg-countdown";
    screenEl.appendChild(overlay);
    let count = n;
    function tick() {
      overlay.innerHTML = `<span class="mg-countdown-num">${count}</span>`;
      count--;
      if (count < 0) { overlay.remove(); cb(); return; }
      setTimeout(tick, 900);
    }
    tick();
  }
  return { show };
})();

/* ── Shared countdown used by ALL minigames ─────────
   Call: MgCountdown.show(screenEl, 3, callback)
   The number pops with animation; background stays still.
*/
const MgCountdown = (() => {
  function show(screenEl, n, cb) {
    const overlay = document.createElement("div");
    overlay.className = "mg-countdown";
    screenEl.appendChild(overlay);

    let count = n;

    function tick() {
      // Re-create the number element each tick so animation re-fires
      overlay.innerHTML = `<span class="mg-countdown-num">${count}</span>`;
      count--;
      if (count < 0) {
        overlay.remove();
        cb();
        return;
      }
      setTimeout(tick, 900);
    }
    tick();
  }

  return { show };
})();