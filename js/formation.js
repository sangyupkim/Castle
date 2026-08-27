'use strict';

// ─── 대형 · 자동/수동 이동 ────────────────────────────────────────────────────
// 플레이어는 개별 유닛을 조작하지 않는다. 집결 지점 하나를 찍으면
// 부대가 역할에 따라 스스로 자리를 잡는다.
//   방패병 — 진행 방향 앞 24px (먼저 닿아서 맞는 것이 역할)
//   영웅 · 검사 — 중앙
//   궁수 · 마법사 · 치유사 — 뒤 22px, 좌우로 분산

const FORM_TANK_AHEAD = 24;
const FORM_BACK_DIST  = 22;

function formationRole(u) {
  if (u.isTank) return 'front';
  if (u.isHero || !u.ranged) return 'mid';
  return 'back';
}

// 집결 지점을 중심으로 각 유닛의 목표 좌표(slotX/slotY)를 계산한다
function assignFormationSlots(arena, allies) {
  const rally = arena.rally;
  if (!rally) return;

  const fx = arena.facing.x, fy = arena.facing.y;   // 진행 방향 단위 벡터
  const px = -fy, py = fx;                          // 그 수직 (좌우 분산용)

  const front = [], mid = [], back = [];
  for (const u of allies) {
    const r = formationRole(u);
    (r === 'front' ? front : r === 'back' ? back : mid).push(u);
  }

  const place = (list, along, spread) => {
    list.forEach((u, i) => {
      // 좌우로 -1, 0, +1 … 순서로 흩는다
      const k = list.length === 1 ? 0 : (i - (list.length - 1) / 2);
      u.slotX = rally.x + fx * along + px * k * spread;
      u.slotY = rally.y + fy * along + py * k * spread;
      const c = clampToArena({ x: u.slotX, y: u.slotY }, u.radius);
      u.slotX = c.x; u.slotY = c.y;
    });
  };

  place(front,  FORM_TANK_AHEAD, 26);
  place(mid,    0,               24);
  place(back,  -FORM_BACK_DIST,  26);
}

// 매 프레임 호출 — 수동이면 집결 지점 기준 대형, 자동이면 슬롯을 쓰지 않는다
function updateFormation(gs, allies, dt) {
  const a = gs.arena;
  if (a.mode !== 'manual' || !a.rally) return;

  // 진행 방향: 부대 중심 → 집결 지점. 거의 도착했으면 최근접 적 쪽을 본다.
  const cx = allies.reduce((s, u) => s + u.x, 0) / Math.max(1, allies.length);
  const cy = allies.reduce((s, u) => s + u.y, 0) / Math.max(1, allies.length);
  let dx = a.rally.x - cx, dy = a.rally.y - cy;
  let d  = Math.hypot(dx, dy);
  if (d < 12) {
    const near = nearestOf(a.mobs, { x: cx, y: cy });
    if (near) { dx = near.x - cx; dy = near.y - cy; d = Math.hypot(dx, dy) || 1; }
  }
  if (d > 0.5) {
    // 방향은 부드럽게 돌린다 — 대형이 매 프레임 요동치지 않도록
    const nx = dx / d, ny = dy / d;
    a.facing.x += (nx - a.facing.x) * Math.min(1, dt * 6);
    a.facing.y += (ny - a.facing.y) * Math.min(1, dt * 6);
    const fl = Math.hypot(a.facing.x, a.facing.y) || 1;
    a.facing.x /= fl; a.facing.y /= fl;
  }

  assignFormationSlots(a, allies);
}

// ─── 입력 ────────────────────────────────────────────────────────────────────
// 아레나를 탭하면 곧 수동 모드다 — 조작하려는 의도가 곧 모드 선택이다.
function setRally(gs, x, y) {
  const a = gs.arena;
  a.mode = 'manual';
  a.rally = clampToArena({ x, y }, 16);
  clampManualSpeed();
}

function nudgeRally(gs, dx, dy) {
  const a = gs.arena;
  const b = gs.battle;
  if (!a.rally) {
    const allies = b.ourTeam.filter(u => !u.dead);
    const cx = allies.length ? allies.reduce((s, u) => s + u.x, 0) / allies.length : arenaCenter().x;
    const cy = allies.length ? allies.reduce((s, u) => s + u.y, 0) / allies.length : arenaCenter().y;
    a.rally = { x: cx, y: cy };
  }
  a.mode = 'manual';
  a.rally = clampToArena({ x: a.rally.x + dx, y: a.rally.y + dy }, 16);
  clampManualSpeed();
}

function toggleArenaMode(gs) {
  const a = gs.arena;
  a.mode = a.mode === 'auto' ? 'manual' : 'auto';
  if (a.mode === 'auto') { a.rally = null; releaseManualSpeed(); }
  else clampManualSpeed();
  if (typeof SFX !== 'undefined') SFX.click();
  return a.mode;
}

// 3배속에서 실시간 조작은 사실상 불가능하다 — 수동으로 바꾸면 2배속으로 강등한다.
// 원래 고른 배속(_speedPref)은 건드리지 않는다.
function clampManualSpeed() {
  if (typeof _speedIdx === 'undefined') return;
  const max = SPEED_STEPS.indexOf(2);
  if (max >= 0 && _speedIdx > max) _speedIdx = max;
}

// 자동으로 돌아오면 강등을 푼다
function releaseManualSpeed() {
  if (typeof _speedIdx === 'undefined') return;
  if (typeof _speedPref === 'number') _speedIdx = _speedPref;
}
