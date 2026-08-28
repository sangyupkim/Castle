'use strict';

// ─── 🖼 스프라이트 ────────────────────────────────────────────────────────────
// 이 게임은 오랫동안 이모지 글자와 사각형으로만 그려졌다. 그림으로 바꾸려면
// 그림이 다 모일 때까지 기다려야 하는 구조여서는 안 된다 — 한 장씩 받아 붙이는 동안에도
// 게임은 계속 돌아가야 한다.
//
// 그래서 규칙은 하나다: **없으면 없는 대로 지금까지처럼 그린다.**
// 그리기 함수는 이미지가 없으면 아무것도 그리지 않고 false를 돌려주고,
// 호출한 쪽은 그 자리에서 예전 코드로 떨어진다.
//
// 무엇을 읽을지는 assets/images/manifest.js가 정한다. 비어 있으면 요청이 한 건도 안 나간다.
//
// 다루는 것은 셋이다.
//   SPRITE_FILES   — 낱장 그림 (타일 · 타워 · 투사체)
//   SPRITE_SHEETS  — 한 줄로 이어 붙인 프레임 (성 깃발)
//   SPRITE_ACTORS  — 방향 × 동작 × 프레임을 갖춘 캐릭터 (몬스터)

const Sprites = (() => {
  const BASE   = 'assets/images/';
  const imgs   = Object.create(null);   // key → HTMLImageElement
  const meta   = Object.create(null);   // key → {fw,fh,frames,fps}
  const failed = Object.create(null);
  const tints  = Object.create(null);   // `${key}|${color}` → canvas
  let total = 0, done = 0, started = false;

  const cfg = k => (typeof self !== 'undefined' && self[k]) || {};

  // 배우 정의를 낱장 목록으로 펼친다: actor.orc.Walk.S → mobs/orc/S_Walk.png
  function expandActors(map) {
    const out = {};
    for (const [id, a] of Object.entries(cfg('SPRITE_ACTORS'))) {
      for (const anim of (a.anims || ['Walk'])) {
        for (const dir of (a.dirs || ['S', 'D', 'U'])) {
          out[`actor.${id}.${anim}.${dir}`] = {
            file: `${a.path}${dir}_${anim}.png`,
            fw: a.fw, fh: a.fh, frames: a.frames, fps: a.fps
          };
        }
      }
    }
    return out;
  }

  function load(onProgress) {
    if (started) return Promise.resolve();
    started = true;

    const flat   = cfg('SPRITE_FILES');
    const sheets = cfg('SPRITE_SHEETS');
    const actors = expandActors();

    const jobs = [];
    for (const [k, v] of Object.entries(flat))   jobs.push([k, v, null]);
    for (const [k, v] of Object.entries(sheets)) jobs.push([k, v.file, v]);
    for (const [k, v] of Object.entries(actors)) jobs.push([k, v.file, v]);

    total = jobs.length;
    if (!total) return Promise.resolve();

    return Promise.all(jobs.map(([key, path, m]) => new Promise(resolve => {
      const im = new Image();
      const finish = ok => { done++; if (onProgress) onProgress(done, total); resolve(ok); };
      im.onload  = () => {
        if (im.naturalWidth > 0) { imgs[key] = im; if (m) meta[key] = m; }
        else failed[key] = path;
        finish();
      };
      im.onerror = () => { failed[key] = path; finish(); };
      im.src = /^(https?:|data:|\/)/.test(path) ? path : BASE + path;
    })));
  }

  function has(key) { return !!imgs[key]; }
  // 여러 후보 중 있는 것 하나 — 'tower.arrow.3'이 없으면 '.2', '.1'로 내려간다
  function pick(...keys) { for (const k of keys) if (imgs[k]) return k; return null; }
  function size(key) { const im = imgs[key]; return im ? { w: im.naturalWidth, h: im.naturalHeight } : null; }

  // ── 색 입히기 ──────────────────────────────────────────────────────────────
  // 오크 하나로 강철오크 · 보스 · 현상수배를 다 만들어야 한다. 파일을 복사해 두는 대신
  // 처음 쓸 때 한 번만 칠해서 캐시에 남긴다. 곱하기라 명암은 그대로 남는다.
  function tinted(key, color, amount) {
    const im = imgs[key]; if (!im) return null;
    const ck = `${key}|${color}|${amount || 1}`;
    if (tints[ck]) return tints[ck];
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'multiply';
    x.globalAlpha = amount === undefined ? 1 : amount;
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'destination-in';   // 원래 투명도를 되살린다
    x.drawImage(im, 0, 0);
    tints[ck] = c;
    return c;
  }

  // ── 그리기 ────────────────────────────────────────────────────────────────
  // 픽셀 아트라 보간을 끈다. 켜두면 확대할 때 죄다 뭉개진다.
  function blit(ctx, src, sx, sy, sw, sh, dx, dy, dw, dh, flip) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.save();
      ctx.translate(dx + dw, dy); ctx.scale(-1, 1);
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    ctx.imageSmoothingEnabled = sm;
  }

  function draw(ctx, key, x, y, w, h) {
    const im = imgs[key]; if (!im) return false;
    blit(ctx, im, 0, 0, im.naturalWidth, im.naturalHeight, x, y, w, h, false);
    return true;
  }
  function drawC(ctx, key, cx, cy, w, h) { return draw(ctx, key, cx - w / 2, cy - h / 2, w, h); }
  // 발밑 기준 — 캐릭터와 타워는 바닥선이 맞아야 앞뒤가 읽힌다
  function drawFoot(ctx, key, cx, footY, w, h) { return draw(ctx, key, cx - w / 2, footY - h, w, h); }

  // 원본 비율 그대로, 높이만 정해서 발밑에 세운다
  function drawFootH(ctx, key, cx, footY, h) {
    const s = size(key); if (!s) return false;
    const w = h * s.w / s.h;
    return draw(ctx, key, cx - w / 2, footY - h, w, h);
  }

  // 가로로 이어 붙인 프레임 중 한 장
  function frame(ctx, key, idx, x, y, w, h, opts) {
    const im = imgs[key], m = meta[key];
    if (!im || !m) return false;
    const n = m.frames || 1;
    const i = ((idx % n) + n) % n;
    const src = (opts && opts.tint) ? tinted(key, opts.tint, opts.tintAmt) : im;
    blit(ctx, src, i * m.fw, 0, m.fw, m.fh, x, y, w, h, opts && opts.flip);
    return true;
  }
  // 시계에서 프레임 번호를 뽑는다 — 개체마다 상태를 들고 있지 않아도 된다
  function frameAt(key, timeSec, phase) {
    const m = meta[key]; if (!m) return 0;
    return Math.floor(timeSec * (m.fps || 8) + (phase || 0)) % (m.frames || 1);
  }

  // ── 배우 ──────────────────────────────────────────────────────────────────
  // dir은 'S'(옆) · 'D'(아래=이쪽) · 'U'(위=저쪽). 왼쪽으로 갈 때는 S를 뒤집는다.
  // 없는 동작은 Walk으로 떨어진다.
  function actorKey(id, anim, dir) {
    return pick(`actor.${id}.${anim}.${dir}`, `actor.${id}.Walk.${dir}`,
                `actor.${id}.${anim}.S`,      `actor.${id}.Walk.S`);
  }
  // 높이 h로, 발밑을 footY에 맞춰 그린다. 프레임 안에서 발이 어디인지는 배우 정의의 foot.
  function actor(ctx, id, anim, dir, timeSec, cx, footY, h, opts) {
    const key = actorKey(id, anim, dir);
    if (!key) return false;
    const m = meta[key]; if (!m) return false;
    const def = cfg('SPRITE_ACTORS')[id] || {};
    const scale = h / m.fh;
    const w = m.fw * scale;
    const footInFrame = (def.foot === undefined ? m.fh : def.foot) * scale;
    const o = opts || {};
    return frame(ctx, key, frameAt(key, timeSec, o.phase), cx - w / 2, footY - footInFrame, w, h, o);
  }

  // 이 배우를 높이 h로 그렸을 때, 발밑에서 머리 꼭대기까지의 거리
  function actorHeadUp(id, h) {
    const def = cfg('SPRITE_ACTORS')[id]; if (!def) return h;
    const foot = def.foot === undefined ? def.fh : def.foot;
    const head = def.head === undefined ? 0 : def.head;
    return (foot - head) * (h / def.fh);
  }

  function report() {
    const ok = Object.keys(imgs), no = Object.keys(failed);
    return { 불러옴: ok.length, 실패: no.length, 없는파일: failed };
  }

  return { load, has, pick, size, draw, drawC, drawFoot, drawFootH, frame, frameAt, actor, actorKey, actorHeadUp, tinted, report,
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
function towerSpriteKey(typeId, level) {
  const t = towerSpriteTier(level);
  return Sprites.pick(`tower.${typeId}.${t}`, `tower.${typeId}.2`, `tower.${typeId}.1`);
}

// ─── 몬스터 ↔ 배우 ───────────────────────────────────────────────────────────
// 그림은 넷뿐이고 몬스터는 열넷이다. 크기와 색으로 갈라 쓴다 —
// 같은 오크라도 회색으로 크게 그리면 강철오크고, 붉게 더 크게 그리면 보스다.
const MOB_ACTORS = {
  // 상단 방어선
  goblin:  { actor:'slime', h:1.00 },
  runner:  { actor:'wolf',  h:0.95 },
  orc:     { actor:'orc',   h:1.00 },
  brute:   { actor:'orc',   h:1.05, tint:'#9aa6bb' },
  boss:    { actor:'orc',   h:1.15, tint:'#e05555' },
  bat:     { actor:'bee',   h:0.95, tint:'#c58cf5' },
  wyvern:  { actor:'bee',   h:1.10, tint:'#8b5cf6' },
  bounty:  { actor:'orc',   h:1.05, tint:'#f5c542' },
  // 하단 아레나
  hound:   { actor:'wolf',  h:1.00 },
  darkarch:{ actor:'orc',   h:1.00, tint:'#b980f0' },
  ogre:    { actor:'orc',   h:1.10, tint:'#c08a4a' },
};
// 아레나 몹은 상단과 아이디가 겹친다(goblin·orc·boss). 아레나에서는 고블린도 오크 그림을 쓴다 —
// 슬라임은 상단 최약체 자리에 두고, 아레나 최약체는 작은 오크로 읽히게 한다.
const ARENA_MOB_ACTORS = {
  goblin: { actor:'orc', h:0.95, tint:'#8ad17a' },
  boss:   { actor:'orc', h:1.15, tint:'#e05555' },
};
function mobActorDef(typeId, arena) {
  return (arena && ARENA_MOB_ACTORS[typeId]) || MOB_ACTORS[typeId] || null;
}

// 마지막으로 그린 자리와 견줘 어느 쪽을 보는지 정한다.
// 개체에 방향을 따로 들고 있지 않아도 되고, 이동 코드도 건드리지 않는다.
function spriteFacing(e) {
  const dx = e.x - (e._lx === undefined ? e.x : e._lx);
  const dy = e.y - (e._ly === undefined ? e.y : e._ly);
  e._lx = e.x; e._ly = e.y;
  if (Math.abs(dx) > Math.abs(dy) + 0.02) {
    e._dir = 'S'; e._flip = dx < 0;
  } else if (Math.abs(dy) > 0.02) {
    e._dir = dy > 0 ? 'D' : 'U'; e._flip = false;
  }
  return { dir: e._dir || 'D', flip: !!e._flip };
}
