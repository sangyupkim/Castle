'use strict';

// ─── 서비스 워커 ──────────────────────────────────────────────────────────────
// 설치형(PWA)으로 쓰려면 오프라인에서도 켜져야 한다. 파일이 열몇 개뿐이고 전부 정적이라,
// 설치할 때 통째로 캐시에 넣고 그 뒤로는 캐시에서 바로 준다.
//
// 버전을 올리면 새 캐시를 만들고 옛 캐시를 지운다 — 게임을 고칠 때마다 CACHE만 올리면 된다.
// 스프라이트 목록은 게임과 같은 파일에서 읽는다 — 두 군데에 적으면 반드시 어긋난다
try { importScripts('assets/images/manifest.js'); } catch (e) {}

const CACHE = 'dual-frontier-v0.7.1';

const SHELL = [
  '.', 'index.html', 'manifest.webmanifest',
  'assets/images/manifest.js', 'js/constants.js', 'js/sprites.js', 'js/audio.js', 'js/fx.js', 'js/upgrade.js', 'js/hero.js', 'js/town.js',
  'js/save.js', 'js/lobby.js', 'js/defense.js', 'js/battle.js', 'js/arena.js',
  'js/formation.js', 'js/wave.js', 'js/tutorial.js', 'js/render.js', 'js/game.js',
  'assets/images/mainpage.png',
  'assets/images/icon-192.png', 'assets/images/icon-512.png', 'assets/images/icon-maskable-512.png',
  // 스프라이트 — 매니페스트에 켜둔 것만 담는다.
  // 하나라도 실패하면 설치가 통째로 실패하던 문제가 있어 개별로 담으므로(아래),
  // 여기 없는 파일이 있어도 나머지는 정상 설치된다.
  ...Object.values(self.SPRITE_FILES || {}).map(p => 'assets/images/' + p),
  ...Object.values(self.SPRITE_SHEETS || {}).map(v => 'assets/images/' + v.file),
  // 배우는 <경로><방향>_<동작>.png 로 펼쳐진다 — 게임과 같은 규칙으로 만든다
  ...Object.entries(self.SPRITE_ACTORS || {}).flatMap(([, a]) =>
      (a.anims || ['Walk']).flatMap(an =>
        (a.dirs || ['S','D','U']).map(d => `assets/images/${a.path}${d}_${an}.png`)))
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // 하나라도 실패하면 설치 자체가 실패하므로 개별로 담는다
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 캐시 우선 — 게임 파일은 자주 바뀌지 않고, 오프라인이 기본 동작이어야 한다.
// 캐시에 없으면 받아서 넣어둔다.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
