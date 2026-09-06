'use strict';

// ─── 🧭 아레나 길찾기 ─────────────────────────────────────────────────────────
// 지금까지 아레나의 이동은 "적을 향해 직선으로 걷고, 막히면 옆으로 미끄러진다"가
// 전부였다. 바위 몇 개가 흩어진 돌밭에서는 그걸로 충분했다 — 미끄러지다 보면
// 결국 돌아간다. 미로에서는 아니었다.
//
// 미로는 가로 벽 네 줄이고 줄마다 통로가 하나씩, 그 위치가 서로 어긋나 있다.
// 아군은 벽 이쪽에, 몹은 벽 저쪽에 붙어 선다. 둘 다 상대 쪽으로 걷고 있지만
// 벽에 막혀 제자리고, 근접은 사거리(14px)가 벽 두께(12px)+반지름 둘(12px)에
// 못 미쳐 닿지 않고, 원거리는 시야가 끊겨 표적을 고르지 못한다.
// **아무도 아무것도 못 하는 상태로 판이 끝나지 않는다.** 테스터가 83층에서
// 걸린 것이 이것이다.
//
// 미끄러지기를 더 똑똑하게 만드는 길도 있었지만, 벽이 길면 어느 쪽으로 미끄러져야
// 통로가 나오는지를 국소 정보로는 알 수 없다. 지도를 봐야 한다.
//
// 그래서 격자를 깔고 목적지에서 BFS를 돌려 **흐름장**을 만든다. 각 칸에 "목적지까지
// 몇 칸"이 적히고, 유닛은 값이 낮아지는 쪽으로 내려가기만 하면 된다.
// 같은 적을 쫓는 유닛끼리 흐름장을 공유하므로 열 명이 쫓아도 계산은 한 번이다.

const NAV_CELL      = 8;    // 칸 크기 — 미로 통로가 68px, 문이 92px이라 넉넉하다
const NAV_PAD       = 4;    // 벽을 이만큼 부풀려 막는다 (유닛 반지름 6의 2/3)
const NAV_CACHE_MAX = 24;   // 흐름장 보관 개수 — 목적지 칸마다 하나
const NAV_LOOKAHEAD = 8;    // 흐름을 몇 칸 앞까지 내다보고 지름길을 잡을지
const NAV_REPLAN    = 0.12; // 유닛이 길을 다시 재는 주기(초)
const NAV_GOAL_SLOP = 16;   // 목적지가 이만큼 움직이면 주기와 무관하게 다시 잰다

// 8방향 — 대각선은 옆 두 칸이 모두 열렸을 때만 쓴다(벽 모서리를 뚫지 않게)
const NAV_DX = [1, -1, 0, 0, 1, 1, -1, -1];
const NAV_DY = [0, 0, 1, -1, 1, -1, 1, -1];

let _navGrid  = null;
let _navKey   = '';
let _navSeq   = 0;
const _navFlows = new Map();   // 목적지 칸 → Int16Array(칸마다 남은 거리)

// ─── 격자 ────────────────────────────────────────────────────────────────────
// 지형은 층 안에서 바뀌지 않으므로 한 층에 한 번만 만든다. 아레나 세로는
// 하단 레이드에서 통째로 달라지므로(ARENA_Y·ARENA_H) 열쇠에 같이 넣는다.
function navGridFor(terrain) {
  const ter = terrain || [];
  if (ter.__navId === undefined) {
    try { Object.defineProperty(ter, '__navId', { value: ++_navSeq, enumerable: false, writable: true }); }
    catch (e) { return null; }
  }
  const key = ter.__navId + '|' + ARENA_Y + '|' + ARENA_H + '|' + ARENA_W;
  if (_navGrid && _navKey === key) return _navGrid;

  const cols = Math.max(1, Math.ceil(ARENA_W / NAV_CELL));
  const rows = Math.max(1, Math.ceil(ARENA_H / NAV_CELL));
  const blocked = new Uint8Array(cols * rows);
  for (const t of ter) {
    if (!t.blocksMove) continue;
    // 칸의 **중심**이 부풀린 사각형 안이면 막힌 칸으로 친다.
    // 사각형에 조금이라도 닿는 칸을 전부 막으면 돌밭의 좁은 틈이 통째로 사라진다.
    const x0 = t.x - NAV_PAD, x1 = t.x + t.w + NAV_PAD;
    const y0 = t.y - NAV_PAD, y1 = t.y + t.h + NAV_PAD;
    const c0 = Math.max(0, Math.ceil((x0 - ARENA_X) / NAV_CELL - 0.5));
    const c1 = Math.min(cols - 1, Math.floor((x1 - ARENA_X) / NAV_CELL - 0.5));
    const r0 = Math.max(0, Math.ceil((y0 - ARENA_Y) / NAV_CELL - 0.5));
    const r1 = Math.min(rows - 1, Math.floor((y1 - ARENA_Y) / NAV_CELL - 0.5));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) blocked[r * cols + c] = 1;
  }

  _navGrid = { cols, rows, blocked };
  _navKey  = key;
  _navFlows.clear();
  return _navGrid;
}

function navIndexAt(g, x, y) {
  const c = Math.max(0, Math.min(g.cols - 1, Math.floor((x - ARENA_X) / NAV_CELL)));
  const r = Math.max(0, Math.min(g.rows - 1, Math.floor((y - ARENA_Y) / NAV_CELL)));
  return r * g.cols + c;
}

function navCenter(g, i) {
  const c = i % g.cols, r = (i / g.cols) | 0;
  return { x: ARENA_X + (c + 0.5) * NAV_CELL, y: ARENA_Y + (r + 0.5) * NAV_CELL };
}

// 막힌 칸이면 가까운 빈 칸으로 옮긴다. 유닛이 벽에 어깨를 붙이고 있거나
// 표적이 물가에 서 있으면 그 칸이 막혀 있는데, 그렇다고 길찾기를 포기하면
// 바로 그 순간이 교착이다.
function navNearestFree(g, i) {
  if (!g.blocked[i]) return i;
  const c0 = i % g.cols, r0 = (i / g.cols) | 0;
  for (let rad = 1; rad <= 6; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const c = c0 + dc, r = r0 + dr;
        if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue;
        const j = r * g.cols + c;
        if (!g.blocked[j]) return j;
      }
    }
  }
  return -1;
}

// ─── 흐름장 ──────────────────────────────────────────────────────────────────
// 목적지 칸에서 BFS. 같은 칸을 노리는 유닛은 전부 이 하나를 나눠 쓴다.
function navFlow(g, goal) {
  let f = _navFlows.get(goal);
  if (f) return f;

  const n = g.cols * g.rows;
  f = new Int16Array(n).fill(-1);
  const q = new Int32Array(n);
  let head = 0, tail = 0;
  f[goal] = 0; q[tail++] = goal;
  while (head < tail) {
    const cur = q[head++];
    const cd  = f[cur];
    const cx  = cur % g.cols, cy = (cur / g.cols) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = cx + NAV_DX[k], ny = cy + NAV_DY[k];
      if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
      const ni = ny * g.cols + nx;
      if (g.blocked[ni] || f[ni] >= 0) continue;
      if (NAV_DX[k] && NAV_DY[k] &&
          (g.blocked[cy * g.cols + nx] || g.blocked[ny * g.cols + cx])) continue;
      f[ni] = cd + 1;
      q[tail++] = ni;
    }
  }

  // 가장 오래된 것부터 버린다 — 통째로 비우면 다음 프레임에 전부 다시 계산한다
  if (_navFlows.size >= NAV_CACHE_MAX) {
    const oldest = _navFlows.keys().next();
    if (!oldest.done) _navFlows.delete(oldest.value);
  }
  _navFlows.set(goal, f);
  return f;
}

// 값이 가장 많이 낮아지는 이웃
function navDescend(g, f, i) {
  const cd = f[i];
  if (cd <= 0) return -1;
  const cx = i % g.cols, cy = (i / g.cols) | 0;
  let best = -1, bestV = cd;
  for (let k = 0; k < 8; k++) {
    const nx = cx + NAV_DX[k], ny = cy + NAV_DY[k];
    if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
    const ni = ny * g.cols + nx;
    const v = f[ni];
    if (v < 0 || v >= bestV) continue;
    if (NAV_DX[k] && NAV_DY[k] &&
        (g.blocked[cy * g.cols + nx] || g.blocked[ny * g.cols + cx])) continue;
    bestV = v; best = ni;
  }
  return best;
}

// ─── 이동을 막는가 ───────────────────────────────────────────────────────────
// losBlocked()는 **화살**을 막는 것(blocksShot)을 본다. 걷는 것은 다르다 —
// 물은 못 지나가지만 화살은 건너간다. 두 판정을 섞으면 물 건너 적을 향해
// 유닛이 직진하다 물가에 붙어 선다.
function terrainBlocksMove(terrain, x, y) {
  if (!terrain) return false;
  for (const t of terrain) {
    if (!t.blocksMove) continue;
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return true;
  }
  return false;
}

function segBlocksMove(terrain, ax, ay, bx, by) {
  if (!terrain || !terrain.length) return false;
  const dx = bx - ax, dy = by - ay;
  const d  = Math.hypot(dx, dy);
  if (d < 1) return false;
  const n = Math.ceil(d / LOS_STEP);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    if (terrainBlocksMove(terrain, ax + dx * t, ay + dy * t)) return true;
  }
  return false;
}

// ─── 다음에 어디로 발을 디딜까 ───────────────────────────────────────────────
// 흐름을 몇 칸 따라 내려가면서, **직선으로 갈 수 있는 가장 먼 칸**을 고른다.
// 칸을 하나씩 밟으면 격자 무늬대로 계단처럼 걷는다 — 보기에도 이상하고 느리다.
// 첫 칸만은 막혔더라도 받아들인다: 유닛이 벽에 붙어 서 있으면 제 위치에서
// 어디로도 '뚫리지 않은' 선이 없는데, 거기서 포기하면 그게 곧 교착이다.
function navStepToward(terrain, ex, ey, tx, ty) {
  const g = navGridFor(terrain);
  if (!g) return null;

  const goal = navNearestFree(g, navIndexAt(g, tx, ty));
  if (goal < 0) return null;
  const f = navFlow(g, goal);

  const start = navNearestFree(g, navIndexAt(g, ex, ey));
  if (start < 0 || f[start] < 0) return null;   // 갈 수 있는 길이 아예 없다

  let cur = start, best = null;
  for (let s = 0; s < NAV_LOOKAHEAD; s++) {
    const nxt = navDescend(g, f, cur);
    if (nxt < 0) break;
    cur = nxt;
    const p = navCenter(g, cur);
    if (s === 0) { best = p; continue; }
    if (segBlocksMove(terrain, ex, ey, p.x, p.y)) break;
    best = p;
  }
  return best;
}

// 유닛마다 이 함수를 부른다. 매 프레임 새로 재면 배속에서 비용이 그대로 곱해지므로
// 짧게 캐시하고, 목적지가 크게 움직였을 때만 주기를 무시하고 다시 잰다.
function navWaypoint(terrain, e, tx, ty, dt) {
  e._navT = (e._navT || 0) - (dt || 0);
  const moved = !e._navGoal ||
                Math.abs(e._navGoal.x - tx) > NAV_GOAL_SLOP ||
                Math.abs(e._navGoal.y - ty) > NAV_GOAL_SLOP;
  if (e._navT <= 0 || moved || !e._navWp) {
    e._navWp   = navStepToward(terrain, e.x, e.y, tx, ty);
    e._navGoal = { x: tx, y: ty };
    e._navT    = NAV_REPLAN + Math.random() * 0.06;
  }
  // 이미 그 점에 닿았으면 다음 프레임에 새로 잰다
  if (e._navWp && Math.hypot(e._navWp.x - e.x, e._navWp.y - e.y) < NAV_CELL * 0.6) e._navT = 0;
  return e._navWp;
}
