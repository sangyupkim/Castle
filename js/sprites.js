'use strict';

// ─── 🖼 스프라이트 ────────────────────────────────────────────────────────────
// 이 게임은 오랫동안 이모지 글자와 사각형으로만 그려졌다. 그림으로 바꾸려면
// 그림이 다 모일 때까지 기다려야 하는 구조여서는 안 된다 — 한 장씩 받아 붙이는 동안에도
// 게임은 계속 돌아가야 한다.
//
// 그래서 규칙은 하나다: **없으면 없는 대로 지금까지처럼 그린다.**
// Sprites.draw()는 이미지가 없으면 아무것도 그리지 않고 false를 돌려주고,
// 호출한 쪽은 그 자리에서 예전 코드로 떨어진다.
//
// 어떤 파일을 읽을지는 assets/images/manifest.js가 정한다. 그 파일이 비어 있으면
// 네트워크 요청이 한 건도 나가지 않는다 — 즉, 아무것도 안 넣은 상태가 기본값이다.

const Sprites = (() => {
  const BASE   = 'assets/images/';
  const imgs   = Object.create(null);   // key → HTMLImageElement (성공한 것만)
  const failed = Object.create(null);   // key → 경로 (실패한 것)
  let total = 0, done = 0, started = false;

  // 매니페스트에 아무 것도 없을 때 SPRITE_AUTOLOAD로 시도해 보는 기본 경로.
  // 파일을 그냥 규칙대로 떨궈놓고 쓰고 싶은 사람을 위한 길이다.
  function defaultPaths() {
    const out = {};
    for (const t of ['ground', 'ground2', 'path', 'path_corner', 'path_cross', 'start', 'base'])
      out[`tile.${t}`] = `tiles/${t}.png`;
    for (const t of TOWER_ORDER)
      for (let tier = 1; tier <= 3; tier++)
        out[`tower.${t}.${tier}`] = `towers/${t}_${tier}.png`;
    return out;
  }

  function fileMap() {
    const declared = (typeof self !== 'undefined' && self.SPRITE_FILES) || {};
    const keys = Object.keys(declared);
    if (keys.length) return declared;
    if (typeof self !== 'undefined' && self.SPRITE_AUTOLOAD) return defaultPaths();
    return {};
  }

  function load(onProgress) {
    if (started) return Promise.resolve();
    started = true;
    const map = fileMap();
    const keys = Object.keys(map);
    total = keys.length;
    if (!total) return Promise.resolve();

    return Promise.all(keys.map(key => new Promise(resolve => {
      const im = new Image();
      im.onload  = () => {
        // 0×0으로 로드되는 깨진 파일은 없는 것으로 친다
        if (im.naturalWidth > 0) imgs[key] = im; else failed[key] = map[key];
        done++; if (onProgress) onProgress(done, total); resolve();
      };
      im.onerror = () => {
        failed[key] = map[key];
        done++; if (onProgress) onProgress(done, total); resolve();
      };
      im.src = /^(https?:|data:|\/)/.test(map[key]) ? map[key] : BASE + map[key];
    })));
  }

  function has(key) { return !!imgs[key]; }

  // 여러 후보 중 있는 것 하나 — 'tower.arrow.3' 이 없으면 '.2', '.1'로 내려간다.
  // 타워 한 종류에 그림 한 장만 넣어도 모든 레벨에서 쓰이게 하려는 것이다.
  function pick(...keys) {
    for (const k of keys) if (imgs[k]) return k;
    return null;
  }

  function draw(ctx, key, x, y, w, h) {
    const im = imgs[key];
    if (!im) return false;
    ctx.drawImage(im, x, y, w, h);
    return true;
  }
  // 중심 기준
  function drawC(ctx, key, cx, cy, w, h) {
    return draw(ctx, key, cx - w / 2, cy - h / 2, w, h);
  }
  // 발밑 기준 — 캐릭터와 타워는 바닥선이 맞아야 앞뒤가 읽힌다
  function drawFoot(ctx, key, cx, footY, w, h) {
    return draw(ctx, key, cx - w / 2, footY - h, w, h);
  }

  // 지금 무엇이 붙었고 무엇이 없는지 — 콘솔에서 바로 확인용
  function report() {
    const ok = Object.keys(imgs), no = Object.keys(failed);
    return { 불러옴: ok.length, 실패: no.length, 목록: ok, 없는파일: failed };
  }

  return { load, has, pick, draw, drawC, drawFoot, report,
           get progress() { return total ? done / total : 1; },
           get total() { return total; },
           get ready() { return !total || done >= total; } };
})();

// ─── 이름 규칙 ───────────────────────────────────────────────────────────────
// 타워는 레벨 5단계를 그림 3티어로 묶는다. Lv1~2 → 1, Lv3~4 → 2, Lv5 → 3.
function towerSpriteTier(level) {
  const lv = level || 1;
  return lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
}
// 그 타워에 쓸 수 있는 그림 키 — 위 티어가 없으면 아래로 내려간다
function towerSpriteKey(typeId, level) {
  const t = towerSpriteTier(level);
  return Sprites.pick(`tower.${typeId}.${t}`, `tower.${typeId}.2`, `tower.${typeId}.1`);
}
