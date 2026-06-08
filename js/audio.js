/* js/audio.js
   Synthesized sound effects using Web Audio API.
   No sound files needed — everything is generated in code.
   Works offline and in APK.

   Usage:  SoundFX.play("key")
           SoundFX.setVolume("ui", 0.5)   // categories: ui, demon, plant, music
           SoundFX.muteAll(true/false)
*/

const SoundFX = (() => {
  // ── CONFIG — change values here to tune every sound ──────────────────────
  const CFG = {
    // Volume per category (0.0 – 1.0)
    VOL_UI: 0.45,
    VOL_DEMON: 0.55,
    VOL_PLANT: 0.4,
    VOL_MUSIC: 0.2,

    // Master mute
    MUTED: false,

    // Real audio files — set path to null to fall back to synthesized sound
    FILES: {
      btn_click: "assets/audio/game/click.ogg",
      victory: "assets/audio/battle/win.ogg",
      defeat: "assets/audio/battle/lost.mp3",
      btn_skip: "assets/audio/battle/skip.mp3",
      plant_place: "assets/audio/battle/plant.mp3",
      level_up: "assets/audio/game/levelup.mp3",
      
      pea_shoot: null,   // peashooter + icepea fire sound
      ice_shoot:       null,   // icepea freeze sound
      fire_shoot:      null,   // lavaburst attack sound
      beam_shoot:      "assets/audio/plants/beam.mp3",   // lilybeam fire sound
      electric_shoot:  null,   // voltlotus lightning sound
      bonk_punch:      null,   // bonkchoy punch sound
      plant_hurt:      null,   // any plant taking damage
      plant_die:       null,   // plant death sound
      sun_produce:     null,  
    },

    // World battle music — keyed by worldId (number or string)
    // Set a path to null to silence that world's music.
    WORLD_MUSIC: {
      1: "assets/audio/battle/world1.ogg",
      2: "assets/audio/battle/world2.ogg",
      3: "assets/audio/battle/world3.ogg",
      4: "assets/audio/battle/world4.ogg",
      5: "assets/audio/battle/Inferno-Fields.ogg", // 🔥 Inferno Fields
      6: "assets/audio/battle/world6.ogg",
      7: "assets/audio/battle/world7.ogg",
      8: "assets/audio/battle/world8.ogg",
      9: "assets/audio/battle/world9.ogg",
      10: "assets/audio/battle/world10.ogg",
    },

    // Sounds definition table
    // Each entry: { cat, fn }  — cat = category, fn = function that plays it
    SOUNDS: {
      // ── UI ──────────────────────────────────────────
      btn_click: { cat: "ui" },
      plant_select: { cat: "ui" },
      plant_place: { cat: "ui" },
      plant_remove: { cat: "ui" }, // shovel
      coin_collect: { cat: "ui" },
      sun_collect: { cat: "ui" },
      wave_start: { cat: "ui" },
      no_sun: { cat: "ui" }, // not enough sun

      // ── Demons ──────────────────────────────────────
      demon_spawn: { cat: "demon" },
      king_roar: { cat: "demon" },
      demon_chomp: { cat: "demon" },
      demon_die: { cat: "demon" },
      demon_die_ice: { cat: "demon" },
      demon_die_fire: { cat: "demon" },
      lawnmower: { cat: "demon" },

      // ── Plants ──────────────────────────────────────
      pea_shoot: { cat: "plant" },
      ice_shoot: { cat: "plant" },
      fire_shoot: { cat: "plant" },
      beam_shoot: { cat: "plant" },
      electric_shoot: { cat: "plant" },
      bonk_punch: { cat: "plant" },
      plant_hurt: { cat: "plant" },
      plant_die: { cat: "plant" },
      sun_produce: { cat: "plant" },

      // ── Game state ──────────────────────────────────
      victory: { cat: "music" },
      defeat: { cat: "music" },
    },
  };

  // ── Audio context (lazy init on first user gesture) ───────────────────────
  let ctx = null;
  let masterGain = null;
  const catGains = {};

  function ensureCtx() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = CFG.MUTED ? 0 : 1;
      masterGain.connect(ctx.destination);

      // Category gain nodes
      ["ui", "demon", "plant", "music"].forEach((cat) => {
        const g = ctx.createGain();
        g.gain.value = CFG[`VOL_${cat.toUpperCase()}`] ?? 0.5;
        g.connect(masterGain);
        catGains[cat] = g;
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Resume context if suspended (mobile requirement)
  function resume() {
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  // ── Core helpers ──────────────────────────────────────────────────────────

  // Create oscillator node
  function osc(type, freq, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest);
    return o;
  }

  // Create gain envelope node connected to category
  function env(cat) {
    const g = ctx.createGain();
    g.connect(catGains[cat] || masterGain);
    return g;
  }

  // White noise buffer
  function noiseBuffer(secs) {
    const len = ctx.sampleRate * secs;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function noise(secs, dest) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(secs);
    src.connect(dest);
    return src;
  }

  // Schedule a gain ramp: [[time_offset, value], ...]
  function ramp(gainNode, points, startTime) {
    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(points[0][1], startTime + points[0][0]);
    for (let i = 1; i < points.length; i++) {
      gainNode.gain.linearRampToValueAtTime(
        points[i][1],
        startTime + points[i][0],
      );
    }
  }

  const t = () => ctx.currentTime;

  // ── Plant place — soft satisfying thud + sprout pop ───────────────────────
  function s_plant_place() {
    const now = t();
    // Earthy thud
    const g1 = env("ui");
    const n = noise(0.12, g1);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 280;
    n.connect(f);
    ramp(
      g1,
      [
        [0, 0.4],
        [0.04, 0.2],
        [0.12, 0],
      ],
      now,
    );
    n.start(now);
    n.stop(now + 0.12);
    // Sprout pop
    const g2 = env("ui");
    const o = osc("sine", 320, g2);
    o.frequency.linearRampToValueAtTime(580, now + 0.12);
    ramp(
      g2,
      [
        [0, 0],
        [0.03, 0.28],
        [0.14, 0],
      ],
      now,
    );
    o.start(now);
    o.stop(now + 0.14);
    // Leaf rustle shimmer
    const g3 = env("ui");
    const n2 = noise(0.18, g3);
    const f2 = ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.value = 2200;
    f2.Q.value = 3;
    n2.connect(f2);
    ramp(
      g3,
      [
        [0, 0],
        [0.05, 0.12],
        [0.18, 0],
      ],
      now + 0.05,
    );
    n2.start(now + 0.05);
    n2.stop(now + 0.23);
  }

  // ── Plant delete — shovel dig scrape ─────────────────────────────────────
  function s_plant_remove() {
    const now = t();
    // Scrape
    const g1 = env("ui");
    const n = noise(0.22, g1);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 900;
    f.Q.value = 2;
    f.frequency.linearRampToValueAtTime(300, now + 0.22);
    n.connect(f);
    ramp(
      g1,
      [
        [0, 0.35],
        [0.08, 0.25],
        [0.22, 0],
      ],
      now,
    );
    n.start(now);
    n.stop(now + 0.22);
    // Dull thump at end
    const g2 = env("ui");
    const o = osc("sine", 180, g2);
    o.frequency.linearRampToValueAtTime(60, now + 0.18);
    ramp(
      g2,
      [
        [0, 0],
        [0.12, 0.3],
        [0.28, 0],
      ],
      now + 0.1,
    );
    o.start(now + 0.1);
    o.stop(now + 0.28);
    // Dirt scatter (high noise burst)
    const g3 = env("ui");
    const n2 = noise(0.1, g3);
    const f2 = ctx.createBiquadFilter();
    f2.type = "highpass";
    f2.frequency.value = 1800;
    n2.connect(f2);
    ramp(
      g3,
      [
        [0, 0.2],
        [0.04, 0.1],
        [0.1, 0],
      ],
      now + 0.12,
    );
    n2.start(now + 0.12);
    n2.stop(now + 0.22);
  }

  function s_btn_click() {
    const g = env("ui");
    const o = osc("sine", 520, g);
    ramp(
      g,
      [
        [0, 0.3],
        [0.01, 0.3],
        [0.08, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.08);
  }

  function s_plant_select() {
    const g = env("ui");
    const o = osc("sine", 680, g);
    const o2 = osc("sine", 900, g);
    ramp(
      g,
      [
        [0, 0.2],
        [0.005, 0.2],
        [0.12, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.12);
    o2.start(t() + 0.04);
    o2.stop(t() + 0.12);
  }

  function s_plant_place() {
    // Soft thud + rising pop
    const g1 = env("ui");
    const n = noise(0.1, g1);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 300;
    n.connect(filt);
    filt.connect(g1);
    ramp(
      g1,
      [
        [0, 0.35],
        [0.04, 0.1],
        [0.1, 0],
      ],
      t(),
    );

    const g2 = env("ui");
    const o = osc("sine", 380, g2);
    o.frequency.linearRampToValueAtTime(600, t() + 0.1);
    ramp(
      g2,
      [
        [0, 0.25],
        [0.05, 0.15],
        [0.15, 0],
      ],
      t(),
    );
    n.start(t());
    o.start(t());
    n.stop(t() + 0.1);
    o.stop(t() + 0.15);
  }

  function s_plant_remove() {
    // Descending scrape
    const g = env("ui");
    const o = osc("sawtooth", 400, g);
    o.frequency.linearRampToValueAtTime(150, t() + 0.18);
    ramp(
      g,
      [
        [0, 0.2],
        [0.05, 0.15],
        [0.18, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.18);
  }

  function s_coin_collect() {
    // Two-tone ascending ding
    const times = [0, 0.07, 0.14];
    const freqs = [660, 880, 1100];
    times.forEach((when, i) => {
      const g = env("ui");
      const o = osc("sine", freqs[i], g);
      ramp(
        g,
        [
          [0, 0.22],
          [0.005, 0.22],
          [0.12, 0],
        ],
        t() + when,
      );
      o.start(t() + when);
      o.stop(t() + when + 0.12);
    });
  }

  function s_sun_collect() {
    const g = env("ui");
    const o = osc("sine", 800, g);
    o.frequency.linearRampToValueAtTime(1100, t() + 0.15);
    ramp(
      g,
      [
        [0, 0.18],
        [0.05, 0.18],
        [0.18, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.18);
  }

  function s_wave_start() {
    // Dramatic low-to-high sweep
    const g = env("ui");
    const o = osc("sawtooth", 100, g);
    o.frequency.linearRampToValueAtTime(400, t() + 0.4);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 600;
    filt.Q.value = 2;
    ramp(
      g,
      [
        [0, 0],
        [0.05, 0.4],
        [0.35, 0.3],
        [0.5, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.5);
  }

  function s_no_sun() {
    // Short low buzz — "nope"
    const g = env("ui");
    const o = osc("square", 140, g);
    ramp(
      g,
      [
        [0, 0.15],
        [0.06, 0.1],
        [0.12, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.12);
  }

  function s_demon_spawn() {
    // Low growl burst
    const g = env("demon");
    const n = noise(0.3, g);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 180;
    n.connect(filt);
    const o = osc("sawtooth", 80, g);
    o.frequency.linearRampToValueAtTime(55, t() + 0.3);
    ramp(
      g,
      [
        [0, 0],
        [0.02, 0.45],
        [0.15, 0.3],
        [0.3, 0],
      ],
      t(),
    );
    n.start(t());
    n.stop(t() + 0.3);
    o.start(t());
    o.stop(t() + 0.3);
  }

  function s_king_roar() {
    // Deep bass explosion + distorted growl
    const now = t();

    // Sub bass thump
    const g1 = env("demon");
    const o1 = osc("sine", 60, g1);
    o1.frequency.linearRampToValueAtTime(30, now + 0.5);
    ramp(
      g1,
      [
        [0, 0],
        [0.01, 0.9],
        [0.2, 0.6],
        [0.5, 0],
      ],
      now,
    );
    o1.start(now);
    o1.stop(now + 0.5);

    // Distorted roar (noise through lowpass)
    const g2 = env("demon");
    const n = noise(0.6, g2);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 220;
    filt.Q.value = 3;
    n.connect(filt);
    ramp(
      g2,
      [
        [0, 0],
        [0.03, 0.7],
        [0.3, 0.5],
        [0.6, 0],
      ],
      now,
    );
    n.start(now);
    n.stop(now + 0.6);

    // Rising harmonic screech
    const g3 = env("demon");
    const o3 = osc("sawtooth", 120, g3);
    o3.frequency.linearRampToValueAtTime(280, now + 0.4);
    ramp(
      g3,
      [
        [0, 0],
        [0.1, 0.3],
        [0.4, 0.2],
        [0.6, 0],
      ],
      now,
    );
    o3.start(now);
    o3.stop(now + 0.6);
  }

  function s_demon_chomp() {
    // Soft muffled gnaw — low frequency, quiet
    const now = t();
    const g = env("demon");
    const n = noise(0.14, g);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 200;
    filt.Q.value = 1.5;
    n.connect(filt);
    ramp(
      g,
      [
        [0, 0.08],
        [0.04, 0.05],
        [0.14, 0],
      ],
      now,
    );
    n.start(now);
    n.stop(now + 0.14);
  }
  function s_demon_die() {
    // Splat: descending noise burst
    const g = env("demon");
    const n = noise(0.25, g);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 1200;
    filt.frequency.linearRampToValueAtTime(200, t() + 0.25);
    n.connect(filt);
    ramp(
      g,
      [
        [0, 0.55],
        [0.05, 0.4],
        [0.25, 0],
      ],
      t(),
    );
    n.start(t());
    n.stop(t() + 0.25);
  }

  function s_demon_die_ice() {
    // Crystal shatter: high freq burst
    const g = env("demon");
    const n = noise(0.2, g);
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 2000;
    n.connect(filt);
    ramp(
      g,
      [
        [0, 0.5],
        [0.02, 0.4],
        [0.2, 0],
      ],
      t(),
    );
    n.start(t());
    n.stop(t() + 0.2);

    // Tinkle descend
    [1800, 1400, 1100, 800].forEach((freq, i) => {
      const gg = env("demon");
      const o = osc("sine", freq, gg);
      ramp(
        gg,
        [
          [0, 0.2],
          [0.05, 0],
          [0.08, 0],
        ],
        t() + i * 0.04,
      );
      o.start(t() + i * 0.04);
      o.stop(t() + i * 0.04 + 0.08);
    });
  }

  function s_demon_die_fire() {
    // Whoosh fade
    const g = env("demon");
    const n = noise(0.35, g);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 600;
    filt.Q.value = 1.5;
    filt.frequency.linearRampToValueAtTime(200, t() + 0.35);
    n.connect(filt);
    ramp(
      g,
      [
        [0, 0.5],
        [0.08, 0.35],
        [0.35, 0],
      ],
      t(),
    );
    n.start(t());
    n.stop(t() + 0.35);
  }

  function s_lawnmower() {
    // Engine rev + alarm
    const now = t();
    const g1 = env("demon");
    const o = osc("sawtooth", 90, g1);
    o.frequency.linearRampToValueAtTime(200, now + 0.4);
    ramp(
      g1,
      [
        [0, 0.5],
        [0.2, 0.4],
        [0.4, 0],
      ],
      now,
    );
    o.start(now);
    o.stop(now + 0.4);

    const g2 = env("demon");
    const o2 = osc("square", 880, g2);
    o2.frequency.linearRampToValueAtTime(440, now + 0.3);
    ramp(
      g2,
      [
        [0, 0.3],
        [0.1, 0.2],
        [0.3, 0],
      ],
      now,
    );
    o2.start(now);
    o2.stop(now + 0.3);
  }

  function s_pea_shoot() {
    const g = env("plant");
    const o = osc("sine", 420, g);
    o.frequency.linearRampToValueAtTime(620, t() + 0.08);
    ramp(
      g,
      [
        [0, 0.22],
        [0.02, 0.18],
        [0.1, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.1);
  }

  function s_ice_shoot() {
    // Wobbly cold pew
    const g = env("plant");
    const o = osc("triangle", 600, g);
    o.frequency.setValueAtTime(600, t());
    o.frequency.linearRampToValueAtTime(900, t() + 0.05);
    o.frequency.linearRampToValueAtTime(700, t() + 0.12);
    ramp(
      g,
      [
        [0, 0.2],
        [0.04, 0.15],
        [0.15, 0],
      ],
      t(),
    );

    // Ice shimmer
    const g2 = env("plant");
    const o2 = osc("sine", 1200, g2);
    ramp(
      g2,
      [
        [0, 0.1],
        [0.02, 0.06],
        [0.1, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.15);
    o2.start(t());
    o2.stop(t() + 0.1);
  }

  function s_fire_shoot() {
    const g = env("plant");
    const n = noise(0.15, g);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 400;
    filt.Q.value = 2;
    n.connect(filt);
    ramp(
      g,
      [
        [0, 0.3],
        [0.04, 0.2],
        [0.15, 0],
      ],
      t(),
    );
    n.start(t());
    n.stop(t() + 0.15);
  }

  function s_beam_shoot() {
    // Sustained zap
    const g = env("plant");
    const o = osc("sawtooth", 300, g);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1800;
    filt.Q.value = 8;
    o.connect(filt);
    filt.connect(g);
    ramp(
      g,
      [
        [0, 0.3],
        [0.02, 0.25],
        [0.18, 0.2],
        [0.22, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.22);
  }

  function s_electric_shoot() {
    // Crackle zap
    const g = env("plant");
    const n = noise(0.12, g);
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 1500;
    n.connect(filt);
    ramp(
      g,
      [
        [0, 0.35],
        [0.01, 0.3],
        [0.12, 0],
      ],
      t(),
    );
    n.start(t());
    n.stop(t() + 0.12);
  }

  function s_bonk_punch() {
    // Thwack impact
    const g = env("plant");
    const n = noise(0.1, g);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 600;
    n.connect(filt);
    const o = osc("sine", 200, g);
    o.frequency.linearRampToValueAtTime(80, t() + 0.08);
    ramp(
      g,
      [
        [0, 0.5],
        [0.02, 0.4],
        [0.1, 0],
      ],
      t(),
    );
    n.start(t());
    n.stop(t() + 0.1);
    o.start(t());
    o.stop(t() + 0.1);
  }

  function s_plant_hurt() {
    const g = env("plant");
    const n = noise(0.12, g);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 500;
    filt.Q.value = 3;
    n.connect(filt);
    ramp(
      g,
      [
        [0, 0.25],
        [0.03, 0.15],
        [0.12, 0],
      ],
      t(),
    );
    n.start(t());
    n.stop(t() + 0.12);
  }

  function s_plant_die() {
    // Sad wilt crunch
    const g = env("plant");
    const o = osc("sine", 300, g);
    o.frequency.linearRampToValueAtTime(80, t() + 0.3);
    ramp(
      g,
      [
        [0, 0.3],
        [0.05, 0.25],
        [0.3, 0],
      ],
      t(),
    );
    const g2 = env("plant");
    const n = noise(0.2, g2);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 400;
    n.connect(filt);
    ramp(
      g2,
      [
        [0, 0.2],
        [0.1, 0.1],
        [0.2, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.3);
    n.start(t());
    n.stop(t() + 0.2);
  }

  function s_sun_produce() {
    // Warm sparkle ping
    const g = env("plant");
    const o = osc("sine", 700, g);
    o.frequency.linearRampToValueAtTime(1050, t() + 0.2);
    ramp(
      g,
      [
        [0, 0.18],
        [0.05, 0.18],
        [0.25, 0],
      ],
      t(),
    );
    o.start(t());
    o.stop(t() + 0.25);
  }

  function s_victory() {
    // Ascending happy chord arpeggio
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      const g = env("music");
      const o = osc("sine", freq, g);
      const g2 = env("music");
      const o2 = osc("triangle", freq * 1.5, g2);
      const when = t() + i * 0.13;
      ramp(
        g,
        [
          [0, 0.35],
          [0.08, 0.3],
          [0.5, 0],
        ],
        when,
      );
      ramp(
        g2,
        [
          [0, 0.15],
          [0.08, 0.1],
          [0.5, 0],
        ],
        when,
      );
      o.start(when);
      o.stop(when + 0.5);
      o2.start(when);
      o2.stop(when + 0.5);
    });
  }

  function s_defeat() {
    // Descending sad trombone
    const notes = [311, 277, 233, 196, 164];
    notes.forEach((freq, i) => {
      const g = env("music");
      const o = osc("sawtooth", freq, g);
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 800;
      o.connect(filt);
      filt.connect(g);
      const when = t() + i * 0.22;
      ramp(
        g,
        [
          [0, 0.4],
          [0.15, 0.3],
          [0.28, 0],
        ],
        when,
      );
      o.start(when);
      o.stop(when + 0.28);
    });
  }

  // ── Sound dispatcher ──────────────────────────────────────────────────────
  const FNS = {
    btn_click: s_btn_click,
    plant_select: s_plant_select,
    plant_place: s_plant_place,
    plant_remove: s_plant_remove,
    coin_collect: s_coin_collect,
    sun_collect: s_sun_collect,
    wave_start: s_wave_start,
    no_sun: s_no_sun,
    demon_spawn: s_demon_spawn,
    king_roar: s_king_roar,
    demon_chomp: s_demon_chomp,
    demon_die: s_demon_die,
    demon_die_ice: s_demon_die_ice,
    demon_die_fire: s_demon_die_fire,
    lawnmower: s_lawnmower,
    pea_shoot: s_pea_shoot,
    ice_shoot: s_ice_shoot,
    fire_shoot: s_fire_shoot,
    beam_shoot: s_beam_shoot,
    electric_shoot: s_electric_shoot,
    bonk_punch: s_bonk_punch,
    plant_hurt: s_plant_hurt,
    plant_die: s_plant_die,
    sun_produce: s_sun_produce,
    victory: s_victory,
    defeat: s_defeat,
  };

  // Audio pool — pre-loads N clones per sound so one is always ready
  const POOL_SIZE = 4;
  const _pools = {};

  function _getPool(key, filePath) {
    if (_pools[key]) return _pools[key];
    const vol =
      CFG[`VOL_${(CFG.SOUNDS[key]?.cat || "ui").toUpperCase()}`] ?? 0.5;
    const pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = new window.Audio(filePath);
      a.volume = vol;
      a.preload = "auto";
      // Force browser to load the file now
      a.load();
      pool.push(a);
    }
    _pools[key] = { clips: pool, idx: 0 };
    return _pools[key];
  }

  function play(key) {
    if (CFG.MUTED) return;
    if (!_gestureReceived) return;

    // Always ensure audio context is running before any play attempt
    ensureCtx();
    resume();

    const filePath = CFG.FILES[key];
    if (filePath) {
      try {
        const pool = _getPool(key, filePath);
        // Round-robin: pick next clip that isn't in the middle of playing
        // (or just use next in rotation — instant, no seek needed)
        const clip = pool.clips[pool.idx % POOL_SIZE];
        pool.idx++;
        clip.currentTime = 0;
        clip.play().catch(() => {});
      } catch (e) {}
      return;
    }

    // Fall back to synthesized sound
    if (!ensureCtx()) return;
    resume();
    const fn = FNS[key];
    if (fn) {
      try {
        fn();
      } catch (e) {
        /* silent fail */
      }
    }
  }

  // Pre-warm all pools on first user gesture so files are loaded before needed
  let _gestureReceived = false;
  function _prewarm() {
    _gestureReceived = true;
    ensureCtx();
    resume();
    Object.entries(CFG.FILES).forEach(([key, path]) => {
      if (path) _getPool(key, path);
    });
  }
  // Use mousedown/touchstart — fires BEFORE click, so audio is unlocked
  // by the time the click handler tries to play a sound
  document.addEventListener("mousedown", _prewarm, { once: true });
  document.addEventListener("touchstart", _prewarm, { once: true });

  function setVolume(cat, val) {
    const key = `VOL_${cat.toUpperCase()}`;
    CFG[key] = Math.max(0, Math.min(1, val));
    if (catGains[cat]) catGains[cat].gain.value = CFG[key];
  }

  function muteAll(muted) {
    CFG.MUTED = muted;
    if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  }

  function isMuted() {
    return CFG.MUTED;
  }

  // Unlock audio on first touch (mobile)
  document.addEventListener(
    "click",
    () => {
      _gestureReceived = true;
      ensureCtx();
      resume();
    },
    { once: true },
  );
  document.addEventListener(
    "touchstart",
    () => {
      _gestureReceived = true;
      ensureCtx();
      resume();
    },
    { once: true },
  );

  // ── Battle Music Player ───────────────────────────────────────────────────
  // Lazily created on first playMusic() call — ensures it exists after a user gesture.
  let _music = null;
  let _musicWorld   = null;
  let _musicPending = false;

  function _getMusic() {
    if (_music) return _music;
    _music = new Audio();
    _music.loop    = true;
    _music.preload = "auto";
    _music.volume  = CFG.VOL_MUSIC;
    _music.muted   = CFG.MUTED;
    return _music;
  }

  function _tryPlay() {
    const m = _getMusic();
    m.play().then(() => {
      _musicPending = false;
    }).catch(() => {
      _musicPending = true;
    });
  }

  function _onGesture() {
    if (!_music) return;
    if (_musicPending && _music.src && _music.paused) {
      _music.play().then(() => { _musicPending = false; }).catch(() => {});
    }
  }
  document.addEventListener("click", _onGesture);
  document.addEventListener("touchstart", _onGesture);
  document.addEventListener("keydown", _onGesture);

  /**
   * playMusic(worldId)
   * Load + loop the battle track for this world.
   * Same world already playing → no-op.
   */
  function playMusic(worldId) {
    const path = CFG.WORLD_MUSIC[worldId];
    if (!path) { stopMusic(); return; }

    const m = _getMusic();

    // Same track already playing? Do nothing.
    if (_musicWorld === worldId && !m.paused) return;

    // New track — swap src
    m.pause();
    m.currentTime = 0;
    m.src    = path;
    m.volume = CFG.VOL_MUSIC;
    m.muted  = CFG.MUTED;
    _musicWorld = worldId;
    m.load();
    _tryPlay();
  }

  function pauseMusic() {
    if (_music && !_music.paused) _music.pause();
  }

  function resumeMusic() {
    if (_music && _music.paused && _musicWorld !== null) _tryPlay();
  }

  function stopMusic() {
    if (!_music) return;
    _music.pause();
    _music.currentTime = 0;
    _musicWorld   = null;
    _musicPending = false;
  }

   return {
    play,
    isMuted,
    playMusic,
    pauseMusic,
    resumeMusic,
    stopMusic,
    setVolume(cat, val) {
      setVolume(cat, val);
      if (_music && cat === "music") _music.volume = CFG.VOL_MUSIC;
    },
    muteAll(muted) {
      muteAll(muted);
      if (_music) _music.muted = muted;
    },
  };
})();
