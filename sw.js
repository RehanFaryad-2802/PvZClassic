const CACHE = "pvz3-v1";

const PRECACHE = [
  "./index.html",
  "./manifest.json",
  "./css/main.css",
  "./css/game.css",
  "./css/inventory.css",
  "./css/minigames.css",
  "./css/minigames_additions.css",
  "./css/plantsanimation/bonkchoy.css",
  "./css/plantsanimation/demon.css",
  "./css/plantsanimation/glacierbud.css",
  "./css/plantsanimation/icepea.css",
  "./css/plantsanimation/lavaburst.css",
  "./css/plantsanimation/lilybeam.css",
  "./css/plantsanimation/peashooter.css",
  "./css/plantsanimation/sporepuff.css",
  "./css/plantsanimation/sunflower.css",
  "./css/plantsanimation/voltlotus.css",
  "./js/coins.js",
  "./js/core.js",
  "./js/demons.js",
  "./js/effects.js",
  "./js/grid.js",
  "./js/levels.js",
  "./js/plant_registry.js",
  "./js/player.js",
  "./js/projectiles.js",
  "./js/seeds.js",
  "./js/shop.js",
  "./js/ui.js",
  "./js/minigames/block_hunt.js",
  "./js/minigames/bomb_ball.js",
  "./js/minigames/sharp_shooters.js",
  "./plants/bonkchoy.js",
  "./plants/glacierbud.js",
  "./plants/icepea.js",
  "./plants/lavaburst.js",
  "./plants/lilybeam.js",
  "./plants/peashooter.js",
  "./plants/sporepuff.js",
  "./plants/sunflower.js",
  "./plants/voltlotus.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          if (!res || res.status !== 200) return res;
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match("./index.html"));
    }),
  );
});
