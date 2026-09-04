'use strict';

// 타이틀 화면에 표기되는 버전
// 버전은 js/version.js 하나에서만 정의한다 (SW 캐시 키와 같은 값을 써야 하므로)

// 포기하고 정산하면 보석을 깎는다. 한 판이 10~30분이라 접을 길은 있어야 하지만,
// 접는 쪽이 늘 이득이면 아무도 마지막 층을 버티지 않는다.
const GIVE_UP_GEM_MULT = 0.6;

// ─── Canvas / Layout ────────────────────────────────────────────────────────
// 폭도 세로도 고정한다. v0.16.0에서 세로만 기기 비율을 따라가게 했었는데,
// 그게 두 가지를 한꺼번에 망가뜨렸다.
//
//  ① **형평성** — 늘어난 세로를 전부 아레나가 가져가서, 세로로 긴 폰일수록
//     전투 영역이 넓어졌다. 800일 때 330이던 아레나가 1040에서는 562였다.
//     같은 판을 70% 넓은 자리에서 싸우는 셈이라, 기기가 실력을 대신했다.
//  ② **성능** — 화면이 길수록 캔버스 픽셀이 늘어난다. 주소창이 없는 PWA는
//     늘 최대치로 가는데, 갤럭시 폴드 커버 화면(≈23:9)이면 상한 1040에 DPR 3이
//     겹쳐 1440×3120 = 449만 픽셀을 매 프레임 칠했다. 같은 폰이라도
//     브라우저(주소창만큼 짧다)는 멀쩡한데 설치 앱만 렉이 걸린 이유가 이것이다.
//
// 그래서 논리 해상도를 480×978로 못 박는다. 화면은 여백으로 채운다 —
// 여백이 남는 편이 "긴 폰이 유리한 게임"보다 낫다.
const CW = 480;
const CH = 978;
// 예전 기준값. 저장된 수치·밸런스 문서가 이 높이를 전제로 적혀 있어 남겨 둔다.
const CH_BASE = 800;

const DEFENSE_Y  = 0;
// 상단 = 여백(5) + 격자 8줄(각 50) + **성 전용 한 줄**(50).
//
// 격자를 7줄 → 8줄로 늘렸을 때 성도 같이 한 칸 내려왔다(6행 → 7행).
// 그러면 늘어난 줄을 성이 도로 먹는 셈이라, 실제로 지을 수 있는 자리는
// 그대로였다. 성을 격자 **밖** 한 줄로 빼서 8줄을 전부 쓸 수 있게 한다.
//
// 칸 높이는 DEFENSE_H를 줄 수로 나누지 않는다 — 성 줄까지 섞여 들어가
// 칸이 50 → 56으로 부풀었다. 칸이 먼저고 상단 높이가 그 결과다.
// ─── Defense Grid ────────────────────────────────────────────────────────────
// 격자가 먼저다 — 상단 높이는 이 값들에서 나온다.
const GRID_COLS = 9;
const GRID_ROWS = 8;
const CELL_W = Math.floor(CW / GRID_COLS);
const CELL_H = 50;                               // 칸 한 변(세로)
const GRID_OX = Math.floor((CW - GRID_COLS * CELL_W) / 2);
const GRID_OY = 5;                               // 격자 위 여백
const CASTLE_ROW_H = 50;                         // 성이 서는 줄

const DEFENSE_H  = GRID_OY + GRID_ROWS * CELL_H + CASTLE_ROW_H;   // 455
const UIBAR_Y    = DEFENSE_H;
const UIBAR_H    = 55;
const BATTLE_Y   = UIBAR_Y + UIBAR_H;            // 510
const BATTLE_H   = CH - BATTLE_Y;
// 기지(성) 칸. 예전에는 네 파일에 cellCenter(4, 6)으로 흩어져 있어서
// 격자를 한 줄 늘리자 전부 어긋났다. 좌표는 한 군데서만 정한다.
const CASTLE_C = 4;
// 성은 격자 **밖** 한 줄에 선다(행 인덱스 = GRID_ROWS).
// 격자 안에 두면 늘린 줄을 성이 도로 먹어서, 줄을 늘린 값어치가 없어진다.
// 지을 수 있는 칸은 0..GRID_ROWS-1 이므로 이 줄에는 아무것도 못 짓는다.
const CASTLE_R = GRID_ROWS;

// ─── 경로 변형 ───────────────────────────────────────────────────────────────
// 경로가 하나뿐이면 최적 배치도 하나뿐이다 — 몇 판만 지나면 같은 자리에 같은 타워를 놓는다.
// 관문(10층)마다 경로가 바뀌면 그 최적해가 리셋되고, 배치를 다시 생각하게 된다.
// 모든 변형은 [4,0]에서 출발해 [4,8](기지)에서 끝나고 인접 칸으로만 이어진다.
// 격자가 8줄이 되면서 마지막 [4,6]→[4,7] 한 칸이 모든 변형에 붙었다 —
// 마지막 직선이 한 칸 길어지고, 그만큼 기지 앞에 지을 자리가 늘었다.
const PATH_VARIANTS = [
  // 0 — 기본 ∞ (8자). 1~10층은 항상 이것 — 배우는 구간
  [ [4,0],[4,1],
    [3,1],[2,1],[1,1],
    [1,2],[1,3],[1,4],
    [2,4],[3,4],[4,4],
    [4,3],[4,2],[4,1],
    [5,1],[6,1],[7,1],
    [7,2],[7,3],[7,4],
    [6,4],[5,4],[4,4],
    [4,5],[4,6],[4,7],[4,8] ],
  // 1 — 넓은 ∞. 판 바깥을 크게 돌아 안쪽이 넓게 비고, 사거리가 짧은 타워가 불리해진다
  [ [4,0],[4,1],
    [3,1],[2,1],[1,1],[0,1],
    [0,2],[0,3],[0,4],
    [1,4],[2,4],[3,4],[4,4],
    [4,3],[4,2],[4,1],
    [5,1],[6,1],[7,1],[8,1],
    [8,2],[8,3],[8,4],
    [7,4],[6,4],[5,4],[4,4],
    [4,5],[4,6],[4,7],[4,8] ],
  // 2 — 뱀 (S자). 가로로 세 번 훑어서 세로줄 하나에 몰아 지으면 세 번 때린다
  [ [4,0],[4,1],
    [5,1],[6,1],[7,1],
    [7,2],[6,2],[5,2],[4,2],[3,2],[2,2],[1,2],
    [1,3],
    [1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],
    [7,5],[6,5],[5,5],[4,5],
    [4,6],[4,7],[4,8] ],
  // 3 — 나선. 바깥을 한 바퀴 돌고 안으로 감겨 들어온다 — 중앙 타워가 강해진다
  [ [4,0],[4,1],[3,1],[2,1],[1,1],
    [1,2],[1,3],[1,4],[1,5],
    [2,5],[3,5],[4,5],[5,5],[6,5],[7,5],
    [7,4],[7,3],[7,2],
    [6,2],[5,2],[4,2],[3,2],
    [3,3],[4,3],[4,4],
    [4,5],[4,6],[4,7],[4,8] ]
];

// 현재 활성 경로. 층이 바뀔 때 applyPathVariant로 교체된다.
let _activePathIdx = 0;
let THE_PATH   = PATH_VARIANTS[0];
let PATH_CELLS = new Set(THE_PATH.map(([c,r]) => `${c},${r}`));

function applyPathVariant(idx) {
  const i = Math.max(0, Math.min(PATH_VARIANTS.length - 1, idx | 0));
  _activePathIdx = i;
  THE_PATH   = PATH_VARIANTS[i];
  PATH_CELLS = new Set(THE_PATH.map(([c,r]) => `${c},${r}`));
  return i;
}
function activePathIdx() { return _activePathIdx; }

// 경로는 관문 단위(10층)로만 바뀐다. 매 층 바뀌면 배치 계획 자체가 성립하지 않는다.
function pathBandOf(tier) { return Math.floor(Math.max(0, (tier || 1) - 1) / 10); }

function _variantOrder(seed) {
  const n = PATH_VARIANTS.length;
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(endlessRand(8000 + i, 11, seed) * (i + 1)) % (i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
// 1~10층은 기본 ∞, 그 뒤로는 런 시드가 정한 순열대로. 연속으로 같은 경로는 나오지 않는다.
function pathVariantFor(tier, seed) {
  const band = pathBandOf(tier);
  if (band <= 0) return 0;
  const order = _variantOrder(seed);
  const n = order.length;
  let prev = 0, v = 0;
  for (let k = 1; k <= band; k++) {
    v = order[(k - 1) % n];
    if (v === prev) v = order[k % n];
    prev = v;
  }
  return v;
}

// 새 경로에 깔린 타워를 옮길 가장 가까운 빈 칸 (링 탐색)
function nearestFreeCell(col, row, occupied) {
  for (let ring = 1; ring <= 8; ring++) {
    let best = null, bestD = Infinity;
    for (let dc = -ring; dc <= ring; dc++) {
      for (let dr = -ring; dr <= ring; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        const c = col + dc, r = row + dr;
        if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) continue;
        if (isBlockedCell(c, r)) continue;
        if (occupied.has(`${c},${r}`)) continue;
        const d = dc * dc + dr * dr;
        if (d < bestD) { bestD = d; best = { c, r }; }
      }
    }
    if (best) return best;
  }
  return null;
}

// ─── 비행 항로 ───────────────────────────────────────────────────────────────
// 비행은 ∞ 경로를 따르지 않는다. 판 전체를 대각선으로 가로질러 기지로 온다 —
// 경로 루프에 딱 붙여 지은 타워는 하늘을 못 잡는다는 뜻이고,
// 그래서 "어디에 짓는가"가 물량이 아니라 배치의 문제가 된다.
// 좌우 두 항로를 번갈아 쓴다.
// 처음엔 판을 가로지르는 대각선으로 잡았는데, 그 대각선이 하필 판 중앙 —
// ∞ 경로에 붙여 지은 타워가 이미 덮고 있는 자리 — 를 지나가서 위협이 되지 않았다.
// 바깥을 크게 도는 경로로 바꿨다. 경로 루프만 촘촘히 막은 배치는 하늘을 놓친다.
// v0.14.0 — 항로가 지상 경로의 절반 길이(603px vs 1236~1448px)였다. 거기에 박쥐가
// 게임에서 가장 빠른 유닛이라, 35층 기준 박쥐는 타워 사거리 안에 26타워·초만 머물렀다
// (오크 147). 상성까지 겹치면 대포탑이 박쥐에게 내는 실효 화력은 오크의 1/21이다.
// 플레이어 눈에는 그냥 "공중은 안 맞는다"로 보인다. 항로를 판 바깥으로 크게 돌려 길이를
// 603 → 845px로 늘렸다. 여전히 지상보다 짧다 — 하늘은 미로를 건너뛰는 길이 맞다.
const AIR_PATH_L = [[4,0],[1,0],[0,2],[2,3],[0,4],[1,6],[3,7],[4,8]];
const AIR_PATH_R = [[4,0],[7,0],[8,2],[6,3],[8,4],[7,6],[5,7],[4,8]];
function airPathFor(n) { return (n % 2 === 0) ? AIR_PATH_L : AIR_PATH_R; }

// ─── 도보 시간 ───────────────────────────────────────────────────────────────
// 스폰 시각을 "언제 나오나"가 아니라 "언제 기지에 닿나"로 잡기 위해 필요하다.
// 상단이 20초 만에 비고 남은 40초를 아레나만 돌던 문제가 여기서 시작됐다.
function pathPixelLength(path) {
  let len = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = cellCenter(path[i][0], path[i][1]);
    const b = cellCenter(path[i + 1][0], path[i + 1][1]);
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

// 경로가 층마다 바뀌므로 캐시는 경로 배열을 키로 잡는다
let _pathLenCache = new WeakMap();
function currentPathLength(flying) {
  const path = flying ? AIR_PATH_L : THE_PATH;
  let v = _pathLenCache.get(path);
  if (v === undefined) { v = pathPixelLength(path); _pathLenCache.set(path, v); }
  return v;
}

// 이 웨이브에서 이 종류가 시작점에서 기지까지 걷는 데 걸리는 시간(초).
// makeDefenseEnemy의 속도 계산과 같은 배율을 써야 예측이 맞는다.
function pathTravelTime(typeId, waveIndex) {
  const tpl = ENEMY_TYPES[typeId] || ENEMY_TYPES.goblin;
  const mods = (typeof endlessMods === 'function') ? endlessMods(waveIndex) : null;
  const spd = tpl.spd * ENEMY_CELL_SPD
            * (BONUSES.pactEnemySpdMult || 1)
            * endlessSpdMult(waveIndex)
            * (mods ? (mods.spdBonus || 1) : 1)
            * fev('enemySpdMult', 1);
  return currentPathLength(!!tpl.flying) / Math.max(1, spd);
}

// ─── 영웅 경험치 · 전선별 수입 ───────────────────────────────────────────────
// 예전에는 상단에 세워야만 EXP가 들어왔다 — 하단에 세우면 레벨이 아예 안 올랐다.
// 그래서 배치가 "이번 층에 어디가 급한가"가 아니라 "영웅을 키울 거냐 말 거냐"가 됐고,
// 답이 하나뿐인 선택은 선택이 아니다.
// 이제 어느 쪽에 서든 양쪽에서 들어온다. 서 있는 쪽이 많고, 반대쪽은 소량이다.
const HERO_EXP_DIRECT = 1.00;  // 배치된 전선에서 영웅이 직접 처치
const HERO_EXP_ASSIST = 0.40;  // 배치된 전선에서 타워·병력이 처치
const HERO_EXP_AWAY   = 0.15;  // 반대쪽 전선 — 여기 서지 않아도 받는 몫
const ARENA_EXP_BASE  = 0.70;  // 아레나 한 마리의 EXP 기준값 (처치 수가 많아 낮게 잡는다)

// 상단 처치 골드는 극소량만 준다.
// 골드는 하단에서 버는 것이 원칙이다 — 상단은 막는 곳이지 버는 곳이 아니다.
// (조정 전 실측: 상단이 전체 수입의 23%. 이 배율로 7% 안팎이 된다)
// 현상수배는 예외다. 플레이어가 스스로 부른 도박이라 값이 따로 계산된다.
const DEFENSE_GOLD_SCALE = 0.25;

// ─── 스폰 편성 ───────────────────────────────────────────────────────────────
const SPAWN_FIRST_AT   = 0.6;   // 첫 마리가 나오는 시각
const SPAWN_MIN_GAP    = 0.28;  // 아무리 많아도 이보다 촘촘히는 안 나온다
// 2.2초로도 "띄엄띄엄해서 긴장감이 없다"는 보고가 왔다.
// 상단은 60초 내내 손이 바쁠 이유가 있어야 하는 곳이라, 도착 간격을 1.3초까지 좁힌다.
// 마릿수가 늘어난 만큼 마리당 보상은 buildSpawnPlan의 rewardMult가 자동으로 낮춘다.
const SPAWN_TARGET_GAP = 1.3;   // 이보다 뜸하면 상단이 비어 보인다 — 마릿수를 채운다

// 다만 훈련 첫 웨이브까지 1.3초로 채우면 화살탑 한 기로는 손도 못 댄다 —
// 1-1은 타워 한 기로 막을 수 있어야 하는 곳이다. 처음 세 웨이브만 성기게 잡고
// 그 뒤로는 곧장 기본값으로 붙인다.
const OPENING_TARGET_GAPS = [4.5, 3.2, 2.2];

// ── 층이 깊어질수록 도착 간격을 좁힌다 ──────────────────────────────────────
// 1.3초를 끝까지 유지하면 상단은 층이 깊어져도 **같은 밀도**로만 온다. 적이
// 세지긴 해도 손이 바빠지지는 않아서, 타워를 다 세우고 나면 남는 것은 구경뿐이다
// ("상단이 여전히 쉽다"는 보고가 이것이다). 마릿수를 늘리는 쪽이 체감이 크다 —
// 사거리 밖으로 새는 적이 생기고, 과부하를 언제 쓸지가 실제 판단이 된다.
// 마리당 보상은 buildSpawnPlan의 rewardMult가 자동으로 낮추므로 골드는 그대로다.
const SPAWN_TARGET_GAP_DEEP = 0.70;   // 이 아래로는 좁히지 않는다
const SPAWN_GAP_TIGHTEN_BY  = 45;     // 이 층에 걸쳐 서서히
function spawnTargetGap(waveIndex) {
  const t = waveIndex || 0;
  const k = Math.min(1, Math.max(0, t) / SPAWN_GAP_TIGHTEN_BY);
  const deep = SPAWN_TARGET_GAP + (SPAWN_TARGET_GAP_DEEP - SPAWN_TARGET_GAP) * k;
  if (isEndlessRun()) return deep;               // 심연은 첫 층부터 본편이다
  // 훈련도 뒤로 갈수록 조인다. 다만 처음 세 웨이브는 손에 익히는 자리로 남긴다.
  return t < OPENING_TARGET_GAPS.length ? OPENING_TARGET_GAPS[t] : deep;
}
// 마지막 스폰 시각 (웨이브 길이 대비).
// 기본은 "마지막 한 마리가 웨이브가 끝날 때 기지에 닿도록" 역산한 시각이지만,
// 그대로 두면 고블린 웨이브는 39초에 스폰이 끊기고 타워가 남은 것을 다 잡아버려
// 마지막 15초가 텅 빈다. 실측에서 상단이 비어 있는 시간이 31%였다.
//   FILL — 빠른 적(도보가 웨이브의 절반 미만)은 여기까지 계속 내보낸다.
//          늦게 나온 놈은 60초 안에 못 닿지만, 그건 다음 층으로 넘어간다.
//   MIN  — 느린 대형이 전부 초반 2초에 쏟아지는 벽이 되지 않게 한다.
//   CAP  — 아무리 그래도 웨이브가 끝나기 직전에 새로 내보내지는 않는다.
const SPAWN_LAST_FILL  = 0.80;
const SPAWN_LAST_MIN   = 0.55;
const SPAWN_LAST_CAP   = 0.92;

// 웨이브 하나의 상단 스폰 일정을 짠다.
// 원칙: 마지막 한 마리가 웨이브가 끝나는 순간 기지에 닿는다.
// 그래야 상단과 하단(60초 고정)이 같은 길이로 굴러간다.
function buildSpawnPlan(defenseEnemies, waveIndex, opts) {
  const o        = opts || {};
  const dur      = o.duration || WAVE_DURATION;
  const countMul = o.countMult || 1;
  const extraMul = o.extraMult || 1;   // 밀도·스폰속도 보정 — 간격이 아니라 마릿수로 받는다

  const groups = defenseEnemies.map(d => ({
    type: d.type,
    count: Math.max(1, Math.round(d.count * countMul * extraMul)),
    walk: pathTravelTime(d.type, waveIndex)
  }));
  if (!groups.length) return [];

  // 가장 빠른(=가장 늦게까지 내보낼 수 있는) 종류를 기준으로 이 웨이브의 스폰 창을 잡는다
  const window = Math.max(1, dur - Math.min.apply(null, groups.map(g => g.walk)) - SPAWN_FIRST_AT);
  const total  = groups.reduce((a, g) => a + g.count, 0);
  // 창은 넓은데 마릿수가 적으면 뜸해서 비어 보인다 — 구성 비율은 지키고 전체를 늘린다
  const target = spawnTargetGap(waveIndex);
  const gap = window / Math.max(1, total);
  // 마릿수를 늘렸으면 마리당 보상을 그만큼 낮춘다.
  // 바꾼 것은 "어떻게 보이는가"이지 "얼마를 버는가"가 아니다 —
  // 이 보정이 없으면 1-1 웨이브 하나가 4배를 벌어들여 골드 조이기가 통째로 풀린다.
  let fill = 1;
  if (gap > target) {
    fill = gap / target;
    for (const g of groups) g.count = Math.max(1, Math.round(g.count * fill));
  }
  const rewardMult = 1 / fill;

  return groups.map(g => {
    // 원칙은 "마지막 한 마리가 웨이브가 끝날 때 기지에 닿는다".
    // 빠른 적은 거기서 더 늘려 후반 공백을 메우고, 느린 적은 초반 몰림만 막는다.
    let lastSpawn = Math.max(SPAWN_FIRST_AT, dur - g.walk);
    lastSpawn = Math.max(lastSpawn, dur * (g.walk < dur * 0.5 ? SPAWN_LAST_FILL : SPAWN_LAST_MIN));
    lastSpawn = Math.min(lastSpawn, dur * SPAWN_LAST_CAP);
    // ── 마릿수가 창을 넘치면 '늘어뜨리지' 말고 '뭉쳐서' 내보낸다 ──────────
    // 예전에는 간격에만 하한(SPAWN_MIN_GAP)을 걸었다. 마릿수가 창보다 많아지면
    // 간격이 더 못 줄어드니 **일정 자체가 뒤로 늘어났다** — 91층은 60초짜리
    // 웨이브에 118초치 스폰 일정이 잡혔다. 웨이브는 큐가 빌 때까지 끝나지 않으므로
    // 타이머가 0이 된 뒤에도 몹이 계속 걸어 나왔다(53층 보고가 이것이다).
    // 이제 창의 길이는 고정하고, 한 번에 여러 마리씩 내보내 마릿수를 채운다.
    // 압력은 그대로 늘면서 웨이브의 길이는 약속대로 남는다.
    const span   = Math.max(0, lastSpawn - SPAWN_FIRST_AT);
    const maxTicks = Math.max(1, Math.floor(span / SPAWN_MIN_GAP) + 1);
    const batch  = Math.max(1, Math.ceil(g.count / maxTicks));
    const ticks  = Math.max(1, Math.ceil(g.count / batch));
    const interval = ticks > 1 ? span / (ticks - 1) : 0;
    return { type: g.type, remaining: g.count, interval, batch,
             nextSpawn: SPAWN_FIRST_AT, rewardMult };
  });
}

function cellCenter(col, row) {
  return {
    x: GRID_OX + col * CELL_W + CELL_W / 2,
    y: GRID_OY + row * CELL_H + CELL_H / 2
  };
}

// 타워를 세울 수 없는 칸 (경로 + 출발/기지)
function isBlockedCell(c, r) {
  if (PATH_CELLS.has(`${c},${r}`)) return true;
  if (c === CASTLE_C && (r === 0 || r === CASTLE_R)) return true;
  return false;
}

// ─── 몬스터 등급 ─────────────────────────────────────────────────────────────
// 타워마다 잘 잡는 등급이 달라, 물량으로 도배하는 대신 조합을 짜야 한다.
const MOB_CLASSES = {
  small:  { id:'small',  name:'소형', tag:'S', color:'#4ade80', desc:'빠르고 약하다 · 물량으로 온다' },
  medium: { id:'medium', name:'중형', tag:'M', color:'#818cf8', desc:'균형 잡힌 주력' },
  large:  { id:'large',  name:'대형', tag:'L', color:'#f59e0b', desc:'느리지만 단단하다' },
  air:    { id:'air',    name:'비행', tag:'A', color:'#c084fc', desc:'다른 항로로 가로질러 온다' }
};
const MOB_CLASS_ORDER = ['small', 'medium', 'large', 'air'];

// 타워 × 등급 피해 배율. 행 합이 비슷하도록 잡아 "무조건 좋은 타워"가 없게 했다.
// 대공 배율의 바닥을 올렸다(v0.14.0). 0.30은 "약하다"가 아니라 "안 통한다"였다 —
// 방어력은 상성을 곱한 뒤에 빼기 때문에 배율이 낮을수록 방어력 벽이 같이 두꺼워진다.
// 저격·번개가 대공 특화라는 관계는 그대로 두고, 나머지가 0이 되는 것만 막는다.
const TOWER_AFFINITY = {
  arrow:  { small:1.25, medium:1.00, large:0.60, air:0.85 },
  frost:  { small:1.10, medium:1.25, large:0.70, air:0.65 },
  cannon: { small:0.65, medium:1.10, large:1.50, air:0.55 },
  sniper: { small:0.70, medium:1.05, large:1.45, air:1.30 },
  tesla:  { small:1.40, medium:0.90, large:0.55, air:1.60 },
  // 장판은 오래 밟을수록 아프다 — 느린 대형에게 가장 세고 비행은 스쳐 지나간다
  poison: { small:0.80, medium:1.20, large:1.55, air:0.50 }
};
const HERO_AFFINITY = { small:1.00, medium:1.00, large:0.85, air:0.70 };

// branchId를 주면 ★5 분기가 상성 행을 다시 쓴다 (곱한다)
function affinityOf(towerTypeId, enemy, branchId) {
  const row = TOWER_AFFINITY[towerTypeId];
  if (!row) return 1;
  const cls = (ENEMY_TYPES[enemy.typeId] || {}).cls || 'medium';
  let m = row[cls] !== undefined ? row[cls] : 1;
  if (branchId) {
    const b = branchDef(towerTypeId, branchId);
    if (b && b.aff && b.aff[cls] !== undefined) m *= b.aff[cls];
  }
  return m;
}
// 이 타워가 그 등급에 실제로 내는 배율 (패널 표시용)
function towerAffinityRow(typeId, branchId) {
  const row = TOWER_AFFINITY[typeId] || {};
  const b = branchDef(typeId, branchId);
  const out = {};
  for (const k of MOB_CLASS_ORDER) {
    let m = row[k] !== undefined ? row[k] : 1;
    if (b && b.aff && b.aff[k] !== undefined) m *= b.aff[k];
    out[k] = m;
  }
  return out;
}
// 상성 표시용 — 1.2 이상이면 강함, 0.8 이하면 약함
function affinityLabel(mult) {
  if (mult >= 1.2) return { txt:'강', color:'#22c55e' };
  if (mult <= 0.8) return { txt:'약', color:'#ef4444' };
  return { txt:'—', color:'#475569' };
}

// ─── Tower Types ─────────────────────────────────────────────────────────────
// ─── ☠️ 독탑 ─────────────────────────────────────────────────────────────────
// ☠️ 장판은 **방어력을 무시한다**(defense.js의 updatePoisonPools 참고).
// 다른 타워가 100층에서 방어력에 51%를 깎일 때 독탑만 그대로 다 넣으므로,
// 원 수치는 그만큼 낮아야 공평하다. 안 그러면 층이 깊어질수록 독탑만 세진다 —
// 실측에서 실제로 그랬다(10층 56 → 100층 311 DPS. 같은 구간 대포는 57 → 158).
// 0.55 → 0.30. 초반에는 대포·번개보다 얌전하고, 후반에 나란해진다.
const POISON_POOL_DPS    = 0.30;  // 장판이 초당 주는 피해 = 탑 실효 공격력 × 이 값
const POISON_POOL_RADIUS = 34;    // 장판 반경(px)
const POISON_POOL_DUR    = 4.0;   // 장판 지속(초)
const POISON_POOL_MAX    = 24;    // 동시에 깔릴 수 있는 장판 수 — 프레임을 지키는 상한

// 기본 공격력은 v0.9.2에서 1.7배로 올렸다.
// v0.9.0에서 강화를 전부 배율로 바꿨는데 화살탑 기본값이 2였다 — 6% 강화는 2.12,
// 반올림하면 그대로 2다. 즉 심연 1층에서 골드로 살 수 있는 것이 아무 효과가 없었고,
// 한 대 2로는 체력 14짜리 고블린을 지나가는 동안 죽이지 못해 한 마리도 못 잡았다.
// 배율이 물릴 바닥이 있어야 배율형 강화가 작동한다.
const TOWER_TYPES = {
  arrow: {
    id:'arrow', name:'화살탑', cost:5,
    dmg:3.4, spd:1.0, range: CELL_W * 2.4,
    color:'#22c55e', projColor:'#fbbf24', icon:'🏹',
    desc:'저렴한 단일 연사'
  },
  frost: {
    id:'frost', name:'서리탑', cost:12,
    dmg:1.7, spd:0.9, range: CELL_W * 2.2,
    slow: 0.45, slowDur: 1.6,
    color:'#38bdf8', projColor:'#7dd3fc', icon:'❄️',
    desc:'이동속도 45% 감속'
  },
  cannon: {
    id:'cannon', name:'대포탑', cost:18,
    dmg:13.6, spd:0.5, range: CELL_W * 2.0,
    splash: 40,
    color:'#f97316', projColor:'#fb923c', icon:'💣',
    desc:'착탄 지점 범위 피해'
  },
  sniper: {
    id:'sniper', name:'저격탑', cost:26,
    dmg:30, spd:0.35, range: CELL_W * 5.0,
    pierceArmor: true, targetMode:'strongest',
    color:'#e879f9', projColor:'#f0abfc', icon:'🎯',
    desc:'초장거리·방어 무시'
  },
  tesla: {
    id:'tesla', name:'번개탑', cost:22,
    dmg:10, spd:1.4, range: CELL_W * 2.6,
    chain: 2, chainRange: CELL_W * 1.5,
    color:'#22d3ee', projColor:'#67e8f9', icon:'⚡',
    desc:'대공 특화·연쇄'
  },
  // ☠️ 독탑 — 다른 탑은 전부 "지나가는 순간에만" 값을 낸다. 독탑은 자리에 값을 남긴다.
  // 한 발이 느리고 약한 대신 착탄점에 장판이 깔리고, 그 위를 밟는 동안 계속 깎인다.
  // 밀집한 무리와 느린 대형에게 강하고, 한 마리씩 스쳐 지나가면 거의 무의미하다.
  poison: {
    id:'poison', name:'독탑', cost:20,
    dmg:5, spd:0.45, range: CELL_W * 2.2,
    poolDps: POISON_POOL_DPS, poolRadius: POISON_POOL_RADIUS, poolDur: POISON_POOL_DUR,
    color:'#84cc16', projColor:'#bef264', icon:'☠️',
    desc:'착탄점에 독 장판 · 장판은 방어 무시'
  }
};
const TOWER_ORDER = ['arrow', 'frost', 'cannon', 'sniper', 'tesla', 'poison'];

// ─── ★5 분기 특화 ────────────────────────────────────────────────────────────
// 지금까지 타워를 키우는 일은 "같은 것이 커진다"뿐이었다. Lv.1도 Lv.5도 화살탑은
// 소형에 강하고 대형에 약했다 — 레벨은 숫자만 올리고 성격은 하나도 안 바꿨다.
//
// ★5에 도달하면 세 갈래 중 하나를 골라 골드로 특화한다. 고르면 그 타워는
// 다른 물건이 된다 — 배율이 바뀌고, 상성 행이 통째로 다시 쓰이고, 고유 특성이 붙는다.
//
// 설계 규칙 셋:
//   1. 모든 분기는 **주고받는다**. 얻는 것이 있으면 잃는 것이 있다.
//   2. 세 분기의 총 DPS는 비슷하게 두고, **어디에 쓰이는지**를 갈라 놓는다.
//      그래야 "무조건 이거"가 없고 층 편성을 보고 고르게 된다.
//   3. 상성은 **곱한다**(`aff`). 원래 잘 잡던 것을 더 잘 잡거나,
//      원래 못 잡던 것을 잡을 수 있게 되거나 — 둘 중 하나지 둘 다는 아니다.
//
// ⚠️ 분기를 섞지 않는 이유 (다른 분기끼리 합쳐 두 특성을 갖게 하지 않는 이유):
//   분기가 전부 트레이드오프라서 둘을 겹치면 서로를 지운다. 속사(공속×1.70·공격력×0.72)와
//   공성(공속×0.42·공격력×2.80)을 합치면 공속×0.71·공격력×2.02 — 그냥 못한 공성이 된다.
//   게다가 6종 × 3분기 = 18개를 4등급에 맞춰 잡는 것도 벅찬데, 교차 조합까지 열면
//   18쌍이 더 붙어 36개를 잡아야 한다. 무엇보다 셋 중 하나를 고르는 것이 이 시스템의
//   전부인데, 결국 다 가질 수 있으면 그 선택이 사라진다.
//   대신 **재분기**를 뒀다 — 값을 더 내고 갈아탈 수는 있되, 두 개를 동시에 갖지는 못한다.
const TOWER_BRANCH_LEVEL = 5;      // 여기 도달하면 분기가 열린다
const TOWER_BRANCH_COST_MULT   = 12;   // 분기 값 = 타워 기본가 × 12
const TOWER_REBRANCH_COST_MULT = 26;   // 갈아타는 값 = 기본가 × 26

const TOWER_BRANCHES = {
  arrow: [
    // 💨 속사 — 얇은 타격을 아주 자주. 그래서 **방어력에 가장 약한 분기**다.
    // 방어력은 한 발마다 빼기 때문에, 한 발이 얇을수록 비율로 더 많이 깎인다.
    // 실측(강화 없는 ★5): 10층 총 DPS 86 → 100층 9. 같은 구간에서 공성은 120 → 82.
    // 셋의 '원시 DPS'는 1.22 / 1.24 / 1.18로 거의 같게 맞춰져 있었는데,
    // 방어력 빼기를 아무도 계산에 넣지 않아서 속사만 구조적으로 죽어 있었다.
    // 비율 관통을 줘서 층이 깊어져도 얇은 타격이 0으로 수렴하지 않게 한다.
    { id:'a_rapid', name:'속사', icon:'💨', color:'#4ade80',
      mult:{ dmg:0.72, spd:1.70, range:0.92 },
      aff:{ small:1.15 },
      special:{ piercePct:0.45 },
      desc:'공격력↓ 공속↑↑ · 방어 45% 무시 · 소형에 더 강하게',
      note:'얇게 자주 — 갑옷 틈을 노린다' },
    { id:'a_pierce', name:'관통', icon:'🎯', color:'#60a5fa',
      mult:{ dmg:1.30, spd:0.95, range:1.10 },
      aff:{ medium:1.40 },
      special:{ pierce:3 },
      desc:'방어 관통 +3 · 중형에 강하게',
      note:'갑옷 두른 주력을 맡는다' },
    // 🏹 공성 — 반대쪽 끝. 한 발이 무거워 방어력 빼기를 거의 안 탄다.
    // 여기에 **사거리까지 셋 중 가장 넓었다**(0.92 / 1.10 / 1.30).
    // 트레이드오프로 짠 시스템에서 한 분기가 화력·사거리를 동시에 가지면
    // 고를 이유가 없어진다. 사거리 우위를 줄이고, 한 발 무게도 조금 낮췄다.
    // 대형 특화(x2.10)와 소형 포기(x0.55)라는 성격은 그대로 남긴다.
    { id:'a_siege', name:'공성', icon:'🏹', color:'#f59e0b',
      mult:{ dmg:2.30, spd:0.42, range:1.15 },
      aff:{ small:0.55, large:2.10 },
      desc:'공속↓↓ 한 발이 무겁게 · 대형에 강하게',
      note:'못 잡던 대형을 잡는다 — 소형은 포기한다' },
  ],
  frost: [
    // 🧊 혹한 — 실측에서 **분기 없는 서리탑과 DPS가 완전히 같았다**(모든 층 ×1.0).
    // 144골드를 내고 고르는데 피해가 1도 안 변하니, 감속만 놓고 보면 고를 이유가 약했다.
    // 이제 값을 확실히 갈라 놓는다: 한 발은 더 약해지고(0.85 → 0.62),
    // 대신 **얼어붙은 것은 무르다** — 감속이 걸린 동안 그 적이 받는 모든 피해가 늘어난다.
    // 혼자 세우면 여전히 약하다. 옆에 선 타워 전부를 세게 만드는 것이 값어치다
    // (부식과 같은 자리, 다른 방식 — 부식은 방어를 지우고 혹한은 시간을 벌며 무르게 한다).
    // 취약을 붙였는데도 처음엔 아무 값이 없었다(대포 옆에 세워 168 vs 167).
    // 한 번에 **한 마리만** 얼리니, 옆 타워가 그 한 마리를 때릴 확률이 낮았다.
    // 지원 분기는 판에 닿는 넓이가 값어치다 — 착탄 범위에 냉기를 퍼뜨린다.
    { id:'f_deep', name:'혹한', icon:'🧊', color:'#38bdf8',
      mult:{ dmg:0.62, spd:1.10 },
      special:{ slow:0.70, slowDurMult:1.70, frail:0.25, splash:44 },
      desc:'착탄 범위 감속 70% · 지속 1.7배 · 얼어붙은 적이 받는 피해 +25%',
      note:'혼자서는 약하다 — 판을 통째로 느리고 무르게 만든다' },
    { id:'f_shatter', name:'서릿발', icon:'💎', color:'#a5b4fc',
      mult:{ dmg:1.65, spd:0.90 },
      special:{ slow:0.30, vsSlowed:1.70 },
      desc:'감속 30%로 약화 · 이미 느려진 적에게 ×1.7',
      note:'혹한을 옆에 두면 둘이 맞물린다' },
    { id:'f_blizzard', name:'눈보라', icon:'🌨️', color:'#e0f2fe',
      mult:{ dmg:0.95, spd:0.92, range:1.20 },
      aff:{ air:2.00 },
      special:{ splash:46 },
      desc:'착탄 범위 감속 · 비행에 강하게',
      note:'못 맞히던 비행을 맡을 수 있다' },
  ],
  cannon: [
    { id:'c_carpet', name:'융단', icon:'💥', color:'#fb923c',
      mult:{ dmg:0.72, spd:1.35 },
      aff:{ small:1.60 },
      special:{ splash:72 },
      desc:'범위 1.8배 · 소형에 강하게',
      note:'약점이던 소형 물량을 통째로 쓸어 담는다' },
    { id:'c_ap', name:'철갑탄', icon:'🛡️', color:'#94a3b8',
      mult:{ dmg:1.32, spd:0.85 },
      aff:{ large:1.30 },
      special:{ splash:22, pierceArmor:true },
      desc:'방어 무시 · 범위↓ · 대형에 더 강하게',
      note:'심층의 두꺼운 갑옷을 무시한다' },
    // 🚀 박격 — 실측에서 40·100층 모두 **분기를 안 고른 대포보다 약했다**(×0.7).
    // 원시 DPS가 1.25 × 0.65 = 0.81이라, 대공을 사려고 지상을 19% 내준 셈이었다.
    // 특화가 '안 고르느니만 못한 선택'이 되면 그건 특화가 아니다.
    // 지상을 거의 본전(0.95)까지 올린다 — 대공은 그대로 압도적이다.
    { id:'c_mortar', name:'박격', icon:'🚀', color:'#c084fc',
      mult:{ dmg:1.40, spd:0.68, range:1.75 },
      special:{ splash:62 },
      aff:{ air:3.83 },
      desc:'사거리 1.75배 · 비행을 잡을 수 있게',
      note:'대공 0.30 → 1.15. 화력이 아니라 사각을 산다' },
  ],
  sniper: [
    // 🎯 헤드샷 — 기대 배율이 1.20 × (0.68 + 0.32×2.6) = **×1.81**이었다.
    // 다른 둘은 얻는 만큼 내주는데(연사는 사거리 0.6, 대물은 공속 0.52) 헤드샷만
    // **순증**이라, 세 층 모두에서 1위였다. '흔들림'은 한 웨이브를 놓고 보면 대가가 아니다.
    // 한 발을 낮춰 기대값을 ×1.29로 맞춘다 — 굴림이 흔들리는 맛은 그대로 남는다.
    { id:'s_head', name:'헤드샷', icon:'🎯', color:'#f0abfc',
      mult:{ dmg:0.85 },
      special:{ critChance:0.32, critMult:2.6 },
      desc:'한 발 ↓ · 32% 확률로 ×2.6 치명타',
      note:'평균은 ×1.29 — 대신 굴림이 흔들린다' },
    { id:'s_auto', name:'연사 저격', icon:'🔫', color:'#fbbf24',
      mult:{ dmg:0.50, spd:2.40, range:0.60 },
      desc:'사거리↓ 공격력↓ 공속↑↑',
      note:'저격탑을 주력 딜러로 바꾼다' },
    { id:'s_anti', name:'대물 저격', icon:'💀', color:'#ef4444',
      mult:{ dmg:2.10, spd:0.52, range:1.20 },
      aff:{ large:1.35 },
      special:{ execute:0.14 },
      desc:'대형에 더 강하게 · HP 14% 이하 즉시 처형',
      note:'보스를 반토막에서 끝낸다' },
  ],
  tesla: [
    { id:'t_chain', name:'연쇄 증폭', icon:'⛓️', color:'#67e8f9',
      mult:{ dmg:0.78 },
      special:{ chain:5, chainRangeMult:1.35 },
      desc:'연쇄 2 → 5회 · 연쇄 사거리 1.35배',
      note:'뭉쳐 오면 한 발이 다섯 발이 된다' },
    // 🔋 과충전 — 100층 실측에서 소·중·대 전부 **분기를 안 고른 번개탑보다 약했다**
    // (92·55·29 vs 135·96·51). 연쇄 2회는 뭉친 무리에서 실효 ×2.2쯤인데,
    // 그걸 통째로 버리고 받는 대가가 1.75 × 0.68 = ×1.19뿐이었다.
    // 단일 화력을 사는 분기라면 그 값을 제대로 치러야 한다.
    { id:'t_over', name:'과충전', icon:'🔋', color:'#facc15',
      mult:{ dmg:2.60, spd:0.72 },
      special:{ chain:0, stunChance:0.22, stunDur:0.5 },
      desc:'연쇄 없음 · 한 발이 아주 무겁게 · 22% 감전(0.5초 정지)',
      note:'연쇄를 버리고 단일 화력을 산다 — 보스와 대형에 몰아친다' },
    { id:'t_aa', name:'대공 관제', icon:'🛩️', color:'#818cf8',
      mult:{ dmg:1.15, spd:0.90, range:1.45 },
      aff:{ small:0.60, medium:0.75, large:0.75, air:1.40 },
      desc:'사거리 1.45배 · 비행 특화 · 지상은 약해진다',
      note:'대공 1.60 → 2.24. 하늘만 본다' },
  ],
  poison: [
    { id:'p_virul', name:'맹독', icon:'☠️', color:'#84cc16',
      mult:{ dmg:1.10 },
      special:{ poolDpsMult:1.55, poolDurMult:0.65 },
      desc:'장판 피해 1.55배 · 지속 0.65배',
      note:'짧고 진하게 — 스쳐 가도 아프다' },
    { id:'p_spread', name:'확산', icon:'🌫️', color:'#a3e635',
      mult:{ spd:1.15 },
      special:{ poolRadiusMult:1.55, poolDurMult:1.45, poolDpsMult:0.65 },
      desc:'장판 반경 1.55배 · 지속 1.45배 · 피해 0.65배',
      note:'길목을 통째로 덮는다' },
    { id:'p_corrode', name:'부식', icon:'🧪', color:'#22d3ee',
      mult:{ dmg:1.05 },
      aff:{ medium:1.15 },
      special:{ poolDpsMult:0.85, corrode:0.30 },
      desc:'장판 위의 적은 방어력을 잃고 받는 피해 +30%',
      note:'혼자서는 약하다 — 다른 타워를 전부 세게 만든다' },
  ],
};

function towerBranches(typeId) { return TOWER_BRANCHES[typeId] || []; }
function branchDef(typeId, branchId) {
  if (!branchId) return null;
  return towerBranches(typeId).find(b => b.id === branchId) || null;
}
function towerBranchOf(t) { return t ? branchDef(t.typeId, t.branch) : null; }
// ★5에 닿았고 아직 안 고른 타워만 분기를 연다
function towerCanBranch(t) {
  return !!t && (t.level || 1) >= TOWER_BRANCH_LEVEL && !t.branch && towerBranches(t.typeId).length > 0;
}
function towerBranchCost(t) {
  return Math.max(1, Math.round(TOWER_TYPES[t.typeId].cost * TOWER_BRANCH_COST_MULT)
                     - (BONUSES.towerCostDiscount || 0));
}
function towerRebranchCost(t) {
  return Math.max(1, Math.round(TOWER_TYPES[t.typeId].cost * TOWER_REBRANCH_COST_MULT));
}


// ─── 해금 (로비에서 보석으로 영구 개방) ──────────────────────────────────────
// 처음부터 열려 있는 것은 화살탑 · 궁수 · 검사뿐이다.
// 나머지는 런을 돌며 모은 보석으로 하나씩 연다 — 로그라이트의 주 진행축.
// 값은 첫 판에 다 열리지 않을 만큼만 올렸다 (총 86 → 322).
// 해금은 초반 진행축이라 너무 무겁게 하면 판이 늘 같은 그림으로 시작한다 —
// 보석을 크게 먹어야 하는 곳은 스킬 트리와 🔥단련이지 여기가 아니다.
const UNLOCK_DEFS = [
  { id:'frost',    kind:'tower', cost:12, name:'서리탑',   icon:'❄️',  desc:'이동속도 45% 감속' },
  { id:'healer',   kind:'unit',  cost:16, name:'치유사',   icon:'✚',   desc:'주변 아군 회복' },
  { id:'cannon',   kind:'tower', cost:28, name:'대포탑',   icon:'💣',  desc:'착탄 범위 피해' },
  { id:'guardian', kind:'unit',  cost:32, name:'방패병',   icon:'🛡️', desc:'전방 방벽 · 도발' },
  { id:'rogue',    kind:'unit',  cost:38, name:'도적',     icon:'🗡️', desc:'은신 · 기습 · 드랍 회수' },
  { id:'mage',     kind:'unit',  cost:46, name:'마법사',   icon:'✨',  desc:'자기 중심 광역' },
  { id:'tesla',    kind:'tower', cost:42, name:'번개탑',   icon:'⚡',  desc:'대공 특화 · 연쇄' },
  { id:'sniper',   kind:'tower', cost:56, name:'저격탑',   icon:'🎯',  desc:'초장거리 · 방어 무시' },
  { id:'poison',   kind:'tower', cost:52, name:'독탑',     icon:'☠️', desc:'착탄점에 독 장판' },
];
const UNLOCK_TOTAL_COST = UNLOCK_DEFS.reduce((a, u) => a + u.cost, 0);
const INITIAL_UNLOCKED  = ['arrow', 'archer', 'swordsman'];

// ─── 서약 (난이도를 스스로 올리고 보석 배율을 받는다) ────────────────────────
// v2.5까지는 전부 고정값이었다 — 기지 최대 HP −20, 편성 슬롯 −1 같은.
// 만렙 편성(기지 220, 슬롯 6)에게는 −20이 9%, −1이 17%라 아무 의미가 없었고,
// 실측에서 13웨이브 동안 기지 HP를 8밖에 안 잃었다.
// 배율형으로 다시 잡는다. 성장한 만큼 그대로 비례해 깎여야 서약이 작동한다.
const PACT_DEFS = [
  // ── 적을 강하게 ──
  { id:'pc_hp',    name:'거친 침입자', icon:'💢', gem:0.20, tier:1,
    desc:'상단 적 HP ×1.8',
    apply:b=>{ b.pactDefHpMult *= 1.8; } },
  { id:'pc_armor', name:'무쇠 가죽',   icon:'🛡️', gem:0.18, tier:1,
    desc:'상단 적 방어력 +6 · 타워 피해 −15%',
    apply:b=>{ b.pactArmorBonus += 6; b.pactTowerDmgMult *= 0.85; } },
  { id:'pc_swift', name:'질주 본능',   icon:'💨', gem:0.16, tier:1,
    desc:'상단 적 이동속도 +35%',
    apply:b=>{ b.pactEnemySpdMult *= 1.35; } },
  { id:'pc_swarm', name:'굶주린 무리', icon:'🌑', gem:0.22, tier:1,
    desc:'아레나 스폰 간격 −30% · 몹 HP ×1.5',
    apply:b=>{ b.pactSpawnMult *= 0.70; pctAdd(b, 'mobHpMult', 0.5); } },

  // ── 나를 약하게 ──
  { id:'pc_wall',  name:'얇은 성벽',   icon:'🧱', gem:0.24, tier:2,
    desc:'기지 최대 HP 절반 · 완주 수리 없음',
    apply:b=>{ b.pactBaseHpMult *= 0.5; b.pactNoRepair = true; } },
  { id:'pc_cap',   name:'봉인된 설계도', icon:'📐', gem:0.20, tier:2,
    desc:'타워 최고 레벨 3 제한',
    apply:b=>{ b.pactTowerLevelCap = Math.min(b.pactTowerLevelCap, 3); } },
  { id:'pc_static',name:'멈춘 시간',   icon:'⏸️', gem:0.14, tier:2,
    desc:'타워 과부하 사용 불가',
    apply:b=>{ b.pactNoOverload = true; } },
  { id:'pc_solo',  name:'고독한 지휘', icon:'🕯️', gem:0.18, tier:2,
    desc:'편성 슬롯 절반 · 아군 HP −25%',
    apply:b=>{ b.pactSlotMult *= 0.5; b.pactUnitHpMult *= 0.75; } },

  // ── 경제를 조이기 ──
  { id:'pc_purse', name:'빈 주머니',   icon:'👛', gem:0.20, tier:3,
    desc:'모든 골드 획득 −40%',
    apply:b=>{ pctAdd(b, 'battleGoldMult', -0.4); pctAdd(b, 'defenseGoldMult', -0.4); } },
  { id:'pc_rest',  name:'짧은 휴식',   icon:'😴', gem:0.12, tier:3,
    desc:'웨이브 후 회복 없음 · 전투 이탈 회복 절반',
    apply:b=>{ b.restHealBonus -= 1; b.pactRegenMult *= 0.5; } },
];
const PACT_TIERS = { 1:'적을 강하게', 2:'나를 약하게', 3:'경제를 조이기' };

// ─── 🌑 악몽 — 목표선을 세운다 ────────────────────────────────────────────────
// 지금까지 심연은 "죽어야 끝나는" 무한이었다. 끝이 없다는 건 목표도 없다는 뜻이라,
// 스무 층쯤에서 "이걸 언제까지 하지"가 된다. 그래서 결승선을 그었다.
//
//   ⚔️ 훈련 30웨이브 → ∞ 심연 1~100층(마왕) → 🌑 악몽 1~10단계 → ♾️ 무한
//
// 악몽 N단계는 심연 100층을 그대로 다시 내려가되, **서약 N개가 강제로 붙는다**.
// 서약은 이미 열 개를 만들어 뒀으니 그것을 사다리로 쓴다 — 한 단계에 하나씩 쌓인다.
// 100층 × 11갈래(심연 + 악몽 10) = 1,100층. 같은 층이라도 서약 조합이 다르면
// 다른 판이 된다.
//
// 순서는 '약한 것부터'가 아니라 '성격이 번갈아 오도록' 짰다. 적을 세게 하는 서약만
// 연달아 붙으면 3단계쯤에서 화력만 올리면 되는 문제가 되고, 나를 약하게 하는 것만
// 붙으면 무엇을 해도 안 되는 벽이 된다. 셋을 섞어 매 단계 다른 곳이 아프게 한다.
const NIGHTMARE_MAX = 10;
const NIGHTMARE_LADDER = [
  'pc_swift',   // 1 — 적 이속 +35%           (적)
  'pc_rest',    // 2 — 웨이브 후 회복 없음     (경제)
  'pc_armor',   // 3 — 적 방어 +6 · 타워 −15%  (적)
  'pc_static',  // 4 — 과부하 사용 불가        (나)
  'pc_hp',      // 5 — 적 HP ×1.8             (적)
  'pc_purse',   // 6 — 골드 −40%              (경제)
  'pc_solo',    // 7 — 슬롯 절반 · 아군 HP −25% (나)
  'pc_swarm',   // 8 — 스폰 −30% · 몹 HP ×1.5  (적)
  'pc_cap',     // 9 — 타워 레벨 3 제한        (나)
  'pc_wall',    // 10 — 기지 HP 절반 · 수리 없음 (나)
];
// N단계에 강제로 붙는 서약 목록 (누적)
function nightmarePacts(level) {
  const n = Math.max(0, Math.min(NIGHTMARE_MAX, level || 0));
  return NIGHTMARE_LADDER.slice(0, n);
}
// 악몽 단계 이름과 색
function nightmareName(level) {
  return level > 0 ? `🌑 악몽 ${level}단계` : '∞ 심연';
}
function nightmareColor(level) {
  if (level <= 0) return '#a78bfa';
  if (level <= 3) return '#f472b6';
  if (level <= 6) return '#f43f5e';
  if (level <= 9) return '#dc2626';
  return '#fbbf24';                       // 10단계는 금색 — 마지막 문
}
// 단계가 오를수록 보석이 더 나온다. 서약 자체의 배율(pactGemMult)과 곱해진다.
// 한 갈래를 처음 깼을 때 주는 보석 — 단계가 오를수록 크다
const NIGHTMARE_CLEAR_GEMS      = 40;
const NIGHTMARE_CLEAR_GEMS_STEP = 25;
// 단계당 선형 0.35였다 — 악몽 10이 ×4.5라 "열 배 어려운데 네 배 반"이었다.
// 서약이 하나씩 겹치는 난이도는 선형이 아니라 곱으로 오르므로 보상도 곱을 따라간다.
// 악몽 10 = ×9.5, 5단계 = ×4.5.
function nightmareGemMult(level) {
  const n = Math.max(0, Math.min(NIGHTMARE_MAX + 1, level || 0));
  return 1 + n * 0.55 + n * n * 0.03;
}
// ♾️ 무한은 악몽 10 위에 한 칸 더 있는 것으로 친다
function unboundedGemMult() { return nightmareGemMult(NIGHTMARE_MAX + 1); }
// ♾️ 무한 — 악몽 10의 서약을 전부 지고 시작하는 데 더해, 층마다 무게가 한 겹 더 붙는다.
// 결승선이 없다는 것만으로는 '더 어렵다'가 되지 않는다 — 같은 50층이면 악몽 10과
// 똑같은 50층이었다. 여기서는 층이 깊어질수록 그 차이가 벌어진다.
const UNBOUNDED_HP_PER_FLOOR = 0.010;   // 층당 적 체력 +1%p (복리 아님, 누적 가산)
function unboundedFloorMult(tier) {
  return 1 + Math.max(0, (tier || 1) - 1) * UNBOUNDED_HP_PER_FLOOR;
}

// ─── 👹 마왕 — 100층의 끝 ────────────────────────────────────────────────────
// 100층은 그냥 '조금 더 센 층'이 아니라 **끝**이어야 한다. 그래서 마왕 하나만 온다.
// 체력이 셋으로 나뉘고, 한 토막이 깎일 때마다 성격이 바뀐다 —
// 한 번 세운 배치로 끝까지 가지 못하게 하려는 것이다.
const ABYSS_FINAL_FLOOR = 100;            // 여기서 심연이 끝난다
const BOSS_PHASES       = 3;
const BOSS_ESCORT_EVERY = 12;             // 페이즈마다 부르는 호위 수
function isFinalFloor(tier) { return tier === ABYSS_FINAL_FLOOR; }
// 이 층이 마왕 층인가 — ♾️ 무한에는 결승선이 없으므로 마왕도 없다
function isBossFloor(gsp, waveIndex) {
  if (!gsp || gsp.mode !== 'endless' || gsp.unbounded) return false;
  return isFinalFloor(endlessTier(waveIndex));
}
// 심연·악몽이 여기서 끝나는가
function runHasFinish(gsp) {
  return !!gsp && gsp.mode === 'endless' && !gsp.unbounded;
}
// 그 층에 원래 나왔을 적 전체의 총 체력. makeDefenseEnemy·buildSpawnPlan과 같은 식으로 센다.
// 마왕 체력을 여기에 걸어 두면 곡선을 나중에 다시 잡아도 보스가 같이 따라온다 —
// 상수로 박아 두면 곡선을 건드릴 때마다 보스만 혼자 뒤처진다.
function floorTotalHp(tier) {
  const idx = Math.max(0, (tier || 1) - 1);
  const def = waveDefFor(idx);
  if (!def || !def.defenseEnemies) return 0;
  const countMult = 1 + idx * DEF_WAVE_COUNT_SCALE;
  const scale = endlessStatMult(idx);
  let total = 0;
  for (const d of def.defenseEnemies) {
    const tpl = ENEMY_TYPES[d.type]; if (!tpl) continue;
    total += tpl.hp * scale * Math.round((d.count || 0) * countMult);
  }
  return total;
}
// 마왕 체력 — 그 층 적 전체와 맞먹는 양을 한 마리에 몰아 준다.
// 예전에는 900 × 곡선으로 잡았는데 100층 총량의 1.1%밖에 안 됐다 —
// 만렙 화력이면 0.1초에 끝나는 '최종 보스'였다.
const BOSS_HP_SHARE = 0.85;
// 악몽 단계당 마왕 체력 증가. 0.22였을 때 악몽 10이 ×3.2가 되어
// 만렙 화력으로도 마왕이 걸어오는 시간 안에 못 잡았다 — 벽이 아니라 막다른 길이었다.
const NIGHTMARE_BOSS_HP_STEP = 0.16;
function demonLordHp(nightmare) {
  const base = floorTotalHp(ABYSS_FINAL_FLOOR) * BOSS_HP_SHARE;
  return Math.max(1000, Math.round(base * (1 + (nightmare || 0) * NIGHTMARE_BOSS_HP_STEP)
                                        * (BONUSES.pactDefHpMult || 1)));
}


// 타워 레벨 1~5.
// Lv.4~5는 후반 골드 사용처다. 격자 40칸이 다 차고 마을 강화가 바닥나면
// 갈 곳 없는 골드가 수천 단위로 쌓이는데, 비용이 급격히 오르는 상위 레벨이
// 그것을 계속 빨아들인다.
// ★6~★10은 ⚒️ 대장간 합성으로만 열린다 — 기본 상한은 여전히 5다.
const TOWER_MAX_LEVEL = 10;
const TOWER_BASE_LEVEL_CAP = 5;
const TOWER_LEVEL_MULT = [
  null,
  { dmg:1.00, spd:1.00, range:1.00 },
  { dmg:1.70, spd:1.15, range:1.12 },
  { dmg:2.60, spd:1.30, range:1.25 },
  { dmg:3.80, spd:1.45, range:1.35 },
  { dmg:5.40, spd:1.62, range:1.45 },
  { dmg:7.60, spd:1.78, range:1.54 },
  { dmg:10.6, spd:1.94, range:1.62 },
  { dmg:14.6, spd:2.10, range:1.69 },
  { dmg:20.0, spd:2.26, range:1.75 },
  { dmg:27.0, spd:2.42, range:1.80 }
];
// 같은 종류를 많이 지을수록 건설비가 오른다 — 도배 대신 배치를 고민하게 만든다
const TOWER_COST_ESCALATION = 0.28;
function towerBuildCost(typeId, towers) {
  const base = TOWER_TYPES[typeId].cost;
  const n = (towers || []).filter(t => t.typeId === typeId).length;
  return Math.max(1, Math.round(base * (1 + TOWER_COST_ESCALATION * n)) - BONUSES.towerCostDiscount);
}
// Lv.3까지는 완만하고, Lv.4부터 급격히 비싸진다
const TOWER_HIGH_LEVEL_ESCALATION = 2.6;
// 합성으로 연 별과 서약 상한 중 낮은 쪽
// 💰 골드로 올릴 수 있는 한계. ★5까지다.
//
// 예전에는 여기서 forgeBestStar(가진 최고 별)를 읽었다. 그래서 ★6 심을 하나
// 만들면 **판 위의 모든 타워**가 골드만으로 ★6이 됐다 — 심 하나에 타워 하나라는
// 규칙이 성립하지 않았다. ★5 위로는 골드가 아니라 심을 태워야 오른다.
function towerLevelCap() {
  return Math.max(1, Math.min(TOWER_BASE_LEVEL_CAP,
                              BONUSES.pactTowerLevelCap || TOWER_MAX_LEVEL));
}
// 🔥 심을 태워 올릴 수 있는 한계 (★10). 서약이 상한을 낮추면 그것도 따른다.
function towerStarCap() {
  return Math.max(1, Math.min(TOWER_MAX_LEVEL, BONUSES.pactTowerLevelCap || TOWER_MAX_LEVEL));
}
// 능력치를 찾을 때 쓰는 레벨 — 골드 상한이 아니라 **그 타워가 실제로 가진 별**이다.
// 여기서 towerLevelCap을 쓰면 심으로 올린 ★7 타워가 ★5 능력치로 계산된다.
function towerStatLevel(t) {
  return Math.max(1, Math.min(TOWER_MAX_LEVEL, (t && t.level) || 1));
}
function towerUpgradeCost(t) {
  const lv = t.level || 1;
  if (lv >= towerLevelCap()) return null;
  const base = TOWER_TYPES[t.typeId].cost;
  const mult = lv <= 2 ? 0.9 * lv
                       : 0.9 * lv * Math.pow(TOWER_HIGH_LEVEL_ESCALATION, lv - 2);
  return Math.max(1, Math.round(base * mult));
}
// 이 자리에 세우면 경로를 몇 칸이나 사정권에 넣는가.
// 사거리 원만 보여주면 "커 보이는데 정작 길을 안 덮는" 자리를 못 거른다.
function pathCellsInRange(col, row, rangePx) {
  const c0 = cellCenter(col, row);
  let n = 0;
  for (const key of PATH_CELLS) {
    const [pc, pr] = key.split(',').map(Number);
    const p = cellCenter(pc, pr);
    if (Math.hypot(p.x - c0.x, p.y - c0.y) <= rangePx) n++;
  }
  return n;
}

function towerSellValue(t) {
  return Math.max(1, Math.floor((t.invested || TOWER_TYPES[t.typeId].cost)
                                * (0.6 + (BONUSES.towerSellBonus || 0))));
}

// ─── Defense Enemy Types ─────────────────────────────────────────────────────
// cls로 타워 상성이 결정된다. flying이면 ∞ 경로 대신 항로를 탄다.
const ENEMY_TYPES = {
  goblin: { id:'goblin', name:'고블린',   cls:'small',  hp:14,  spd:1.10, dmg:2,  reward:3,  armor:0, color:'#4ade80', radius:9  },
  runner: { id:'runner', name:'늑대',     cls:'small',  hp:12,  spd:2.30, dmg:2,  reward:5,  armor:0, color:'#fbbf24', radius:8  },
  orc:    { id:'orc',    name:'오크',     cls:'medium', hp:40,  spd:0.70, dmg:6,  reward:8,  armor:1, color:'#818cf8', radius:13 },
  brute:  { id:'brute',  name:'강철오크', cls:'large',  hp:95,  spd:0.50, dmg:12, reward:18, armor:3, color:'#94a3b8', radius:15 },
  boss:   { id:'boss',   name:'던전보스', cls:'large',  hp:400, spd:0.40, dmg:20, reward:50, armor:5, color:'#ef4444', radius:20 },

  // ── 비행 ──
  // 지상보다 빠르고 항로가 짧다. 대신 대포탑·서리탑은 거의 못 맞힌다.
  bat:    { id:'bat',    name:'박쥐',     cls:'air',    hp:26,  spd:1.15, dmg:4,  reward:7,  armor:0, color:'#c084fc', radius:9,  flying:true },
  wyvern: { id:'wyvern', name:'비룡',     cls:'air',    hp:150, spd:0.78, dmg:16, reward:30, armor:2, color:'#7c3aed', radius:15, flying:true },

  // ── 현상수배 (플레이어가 직접 소환) ──
  bounty: { id:'bounty', name:'현상수배', cls:'large',  hp:340, spd:0.55, dmg:26, reward:40, armor:4, color:'#fbbf24', radius:18, isBounty:true },

  // 👹 마왕 — 100층에만 나온다. 느리고 거대하고, 기지에 닿으면 그 자리에서 판이 끝난다.
  // dmg가 크다 — 마왕이 기지에 닿으면 그 자리에서 판이 끝난다.
  // 이동 시간이 곧 제한 시간이어야 보스전이 '언제까지'가 있는 싸움이 된다.
  demonlord: { id:'demonlord', name:'마왕', cls:'large', hp:900, spd:0.45, dmg:99999, reward:900,
               armor:8, color:'#dc2626', radius:26, isBoss:true }
};
const ENEMY_CELL_SPD = CELL_W;

// 격자가 7줄 → 8줄이 된 만큼 상단 적 체력을 되올린다.
//
// "한 줄 늘었으니 1/7 = +14%"가 직관이지만, 재 보니 그렇지 않았다.
// 늘어난 여덟 칸은 전부 기지 앞 마지막 줄이고, 타워 사거리로 덮이는 경로 칸
// 수를 세어 보면 **좋은 자리부터 짓는 한 이득이 거의 없다.**
//
//   타워 6기(초반)   경로 변형 4종 전부 +0.0%   ← 새 칸이 기존 상위 6칸을 못 이긴다
//   타워 10기        +0.8 ~ +2.8%
//   타워 16기        +1.1 ~ +2.7%
//   타워 24기        +2.6 ~ +3.4%
//   판을 다 채우면   +5.9 ~ +13.0%             ← 골드가 남아도는 심층에서만
//
// 여기에 경로가 한 칸 길어져 사정권에 머무는 시간이 +3.4~4.0% 붙는다.
// 실제로 겪는 이득은 초반 +4%, 중반 +5~7%, 심층에서 조금 더다.
// 그래서 +6%로 잡았다. 14%를 얹으면 보정이 아니라 상향이 된다.
const GRID_ROW_HP_COMP = 1.06;

// 웨이브가 오를수록 상단 적도 강해진다
const DEF_WAVE_HP_SCALE    = 0.22;
const DEF_WAVE_ARMOR_EVERY = 5;

// ─── 🛡 방어력이 피해를 깎는 방식 ────────────────────────────────────────────
// 예전에는 **빼기**였다: 피해 = 공격 − 방어. 이게 후반이 무너진 두 번째 원인이다.
// 빼기는 "한 발이 얇을수록 비율로 더 많이 깎는다". 100층(방어 21)에서 실측:
//
//   저격탑  0% 깎임 (방어 무시)      대포탑 27%      번개탑 42%
//   독탑   66%                      화살탑 94%      서리탑 91%
//
// 같은 방어력인데 타워마다 0%에서 94%까지 갈렸다. 그래서 얇게 자주 때리는
// 분기(속사·혹한)는 무엇을 해도 구조적으로 죽었고, 한 발이 무거운 쪽만 살아남았다.
// 공속 강화도 마찬가지다 — 공격력을 안 올리고 공속만 올리면 후반에 아무 의미가 없다.
//
// 이제 요즘 RPG·AOS가 쓰는 **비율 감소**로 바꾼다:
//
//   감소율 = 방어 / (방어 + K)
//
// 비율이므로 한 발의 크기와 무관하다. 얇은 타워도 두꺼운 타워와 **같은 비율**만
// 깎인다. 방어력이 아무리 높아도 100%가 되지 않으니 바닥(1 피해)에 눌리지도 않는다.
//
// 같은 식을 뒤집으면 **"방어력 1점 = 최대 체력 +(100/K)%"** 다:
//
//   실질 체력 = 체력 × (1 + 방어 / K)
//
// K=20이므로 방어 1점이 실질 체력 5%다. 100층 몹은 방어 21 → 실질 체력 2.05배.
// 이쪽이 값을 잡을 때 훨씬 읽기 쉽다 — "이 층 몹은 체력이 두 배인 셈"으로 생각하면 된다.
//
// K = 20을 고른 이유: 이 값에서 전체 화력 총합이 지금의 98%로 거의 그대로다
// (K=10이면 85%로 너무 어려워지고 K=40이면 109%로 물러진다).
// 그 층 감소율 — 1층 5% · 25층 23% · 60층 39% · 100층 51% · 120층 56%
// (= 실질 체력 1.05배 · 1.30배 · 1.65배 · 2.05배 · 2.25배).
const DEF_ARMOR_K = 20;
const DEF_WAVE_COUNT_SCALE = 0.07;

// ─── 하단 아레나 레이아웃 ─────────────────────────────────────────────────────
// 460 ┌ 상태 바 28 ┐ 488 ┌ 아레나 400 ┐ 888 ┌ 컨트롤 바 40 ┐ 928
//
// 아레나 세로는 **고정 400**이다. 기준 높이(800)에서 330이었으니 +21% —
// 사용자가 "좀 넓어지니까 시원하다"고 한 그 느낌은 남기되, 기기 비율과는 끊었다.
// 이 값이 화면을 따라가면 폰이 길수록 유리해진다(위 CH 주석 참고).
const ARENA_STATUS_H = 28;
// 컨트롤 바를 40으로 키웠다. 32였을 때 버튼이 24px밖에 안 돼서
// 480 논리폭을 6인치 화면에 늘려 놓아도 손가락에는 여전히 작았다.
const ARENA_CTRL_H   = 40;
// 준비 화면 위쪽 ⏸·배속·🔊 전용 띠. 브리핑 본문은 이 아래에서 시작한다.
const BRIEF_CTRL_H   = 38;
const ARENA_X = 0;
const ARENA_W = CW;
// 👹 하단 레이드에서는 상단 라인을 통째로 치우고 아레나가 화면을 다 가져간다.
// 그때만 이 둘이 바뀐다 — applyArenaBounds()가 다시 잡는다.
const BOSS_HUD_H = 54;
const ARENA_H_NORMAL = 400;
const ARENA_H_RAID   = CH - ARENA_CTRL_H - (BOSS_HUD_H + ARENA_STATUS_H);   // 806
let   ARENA_Y = BATTLE_Y + ARENA_STATUS_H;
let   ARENA_H = ARENA_H_NORMAL;

// 지금 아레나가 '레이드 배치'인가. 이 모듈이 직접 들고 있는다 —
// 아래 모듈이 위 모듈의 전역을 읽으면 로드 순서에 묶인다. 제 상태는 제가 든다.
// (예전에 gs.boss를 들여다봤다가 TDZ로 화면이 통째로 검게 나온 적이 있다.)
let _arenaRaidMode = false;
function applyArenaBounds(raid) {
  _arenaRaidMode = !!raid;
  ARENA_Y = _arenaRaidMode ? (BOSS_HUD_H + ARENA_STATUS_H) : (BATTLE_Y + ARENA_STATUS_H);
  ARENA_H = _arenaRaidMode ? ARENA_H_RAID : ARENA_H_NORMAL;
  return ARENA_H;
}

// ── 개체 몸집 ────────────────────────────────────────────────────────────────
// 아군 반지름이 7.5px였다. 이모지는 그 크기에서도 실루엣이 읽히지만 그림은 안 읽힌다 —
// 지름 15px짜리 점에 캐릭터를 그려 넣을 수는 없다.
//
// 몸집을 키우면 같은 판에 들어가는 수가 줄어야 한다. 안 그러면 서로 겹쳐서
// 무엇이 몇 마리인지 보이지 않는다. 그래서 상한을 함께 내린다.
//
// 근접 사거리는 대상의 '표면'까지로 재므로(dist − target.radius), 몸이 커져도
// 자기 반지름보다 사거리가 길기만 하면 계속 닿는다. 가장 빠듯한 것이
// 오우거(19 vs 26) · 보스(20.9 vs 30)이고, 둘 다 여유가 있다.
const ARENA_BODY_SCALE    = 1.85;  // 몸집 배율 — 반지름 7.5 → 13.9
function bodyRadius(r) { return Math.round((r || 0) * ARENA_BODY_SCALE * 10) / 10; }
// 그림은 몸보다 조금 크게 그린다 — 충돌원은 발밑, 그림은 그 위로 선다
const ARENA_ART_W_MULT    = 2.1;   // 그림 가로 = 반지름 × 이 값
const ARENA_ART_H_MULT    = 2.7;   // 그림 세로

const ARENA_MAX_MOBS      = 20;    // 동시 생존 상한 — 가독성 + 성능 (몸집을 키우며 28 → 20)
const ARENA_SPAWN_BAND    = 26;    // 가장자리 스폰 밴드 두께
const SPAWN_BASE_INTERVAL = 1.6;   // 초. 경과에 따라 짧아진다
const SPAWN_RAMP          = 0.03;  // 간격 = base / (1 + 경과초 × RAMP)
const SPAWN_SAFE_RADIUS   = 120;   // 아군 부대 중심에서 이 반경 안에는 스폰 금지
const DROP_PICKUP_RADIUS  = 44;    // 아군이 이 반경에 들어와야 드랍 획득
const DROP_LIFETIME       = 9;     // 초
const DROP_SCATTER_MIN    = 24;    // 처치 지점에서 튀어나가는 최소 거리
const DROP_SCATTER_MAX    = 66;    // 최대 거리 — 수거 반경보다 넓어야 이동에 값이 생긴다

// ─── 아레나 드랍 ─────────────────────────────────────────────────────────────
// 예전에는 처치할 때마다 골드 토큰이 떨어지고 그걸 하나하나 주우러 다녀야 했다.
// 60초 내내 동전을 줍는 일은 조작이 아니라 잡일이다.
//
// 이제 기본 골드는 처치하는 순간 바로 들어온다. 대신 가끔 값나가는 것이 떨어지고,
// 그것만 주우러 간다 — 움직일 이유는 남기되, 움직임이 의무가 되지 않게.
// 자동 수거로 바뀌면서 흘리는 골드가 없어졌다 — 예전에는 못 주운 드랍이 그냥 사라졌다.
// 같은 몹을 잡고 같은 돈을 벌게 하려면 마리당 값을 그만큼 낮춰야 한다.
// (실측: 자동 수거만 넣었을 때 1-2 웨이브 5 시작 골드가 400 → 1,001)
const ARENA_GOLD_SCALE    = 0.58;
const DROP_SPECIAL_CHANCE = 0.075; // 처치당 특수 드랍 확률
const ARENA_BUFF_DURATION = 9;     // 일시 버프 지속(초)
const DROP_HEAL_PCT       = 0.10;  // ❤️ 응급 치료가 되살리는 최대 HP 비율

// ─── 🌊 아레나 쇄도 ──────────────────────────────────────────────────────────
// 한두 마리씩 꾸준히 나오는 리듬만 있으면 60초가 평탄해진다. 위험이 오르내려야
// "지금 물러날까"가 판단거리가 된다. 그래서 웨이브 중간중간 한 번에 몰려오는 순간을 만든다.
// 2초 전에 경고가 뜨므로 대비할 시간은 준다 — 예고 없이 쏟아지면 그건 사고지 설계가 아니다.
const SURGE_FIRST_AT   = 18;    // 첫 쇄도까지(초)
const SURGE_EVERY      = 22;    // 그 뒤 간격
const SURGE_EVERY_JIT  = 6;     // 간격 흔들기 — 초시계를 세지 않게
const SURGE_WARN       = 2.0;   // 경고 시간
const SURGE_BASE       = 6;     // 기본 마릿수
const SURGE_PER_TIER   = 0.22;  // 층당 가산
const SURGE_MAX        = 14;
function surgeCount(tier) {
  return Math.min(SURGE_MAX, Math.round(SURGE_BASE + Math.max(0, (tier || 1) - 1) * SURGE_PER_TIER));
}

// ─── 🏳 하단을 비우면 상단으로 넘어온다 ──────────────────────────────────────
// 예전에는 후퇴가 성벽 HP 정액 차감이었다. 숫자가 조용히 깎일 뿐이라
// "돈을 조금 덜 벌었네" 정도로 읽혔고, 상단이 하단보다 쉬운 것과 겹쳐
// 아레나를 일찍 접는 쪽이 언제나 편했다.
//
// 이제 하단을 비우면 거기 있던 것들이 그대로 위로 올라온다. 후퇴는 벌이 아니라
// 전선을 옮기는 결정이 된다 — 타워로 감당할 수 있다면 여전히 옳은 선택이다.
// 전멸은 후퇴보다 비싸다 — 병력까지 잃었으므로.
// 예전 돌파(DPS × 15초)가 주던 양을 한 번에 환산해 같은 무게로 맞춘다.
const WIPE_BASE   = 14;    // 기본 성벽 피해
const WIPE_TIER   = 0.55;  // 층당 가산
// 얼마나 일찍 무너졌나 — 남은 스폰 시간의 비율만큼 값이 붙는다.
//
// 예전에는 초당 정액(0.34)이었다. 그러면 층이 깊어질수록 정액 항(기본+층)이
// 커져서 시간 항이 묻힌다 — 50층에서 시작하자마자 전멸하나 끝나기 직전에
// 전멸하나 62 대 42, 1.5배밖에 안 갈렸다. 1초 만에 무너진 것과 59초를 버틴 것이
// 거의 같은 값이면 "버틴다"는 행동에 값이 없다.
// 비율로 바꾸면 층과 무관하게 늘 같은 배수로 갈린다.
const WIPE_EARLY_MULT = 1.0;   // (구식 공식의 잔재 — 지금은 per-mob 쪽을 쓴다)
// 성문에 닿는 한 마리가 물고 가는 값 — **성벽 최대치의 이 비율**이다.
//
// 정액으로 두면 초반과 후반 중 한쪽이 반드시 망가진다. 성벽이 100일 때는
// 한 마리 2.4가 상한에 눌려 몇 마리가 오든 똑같았고, 성벽이 수만일 때는
// 예순 마리가 와도 긁힌 자국이었다. 비율로 두면 규칙이 하나로 읽힌다 —
// **성문에 닿은 한 마리가 성벽의 1%를 문다.**
const WIPE_PER_MOB_PCT  = 0.010;
// 다만 한 번의 전멸이 만피에서 즉사가 되지는 않게 상한을 둔다.
// 아레나에서 전멸은 예외가 아니라 흔한 일이다.
// 예전 0.55는 너무 물러서 하단을 통째로 버리는 쪽이 늘 쌌다 —
// 두 번 뚫리면 죽는 자리까지 올린다.
const WIPE_HP_CAP_PCT = 0.80;
// 남은 시간 동안 **나왔을** 마릿수. 아레나는 정해진 대기열이 아니라
// spawnInterval(경과시간)로 계속 뽑으므로, 남은 시간을 그 간격으로 적분해 센다.
function pendingArenaSpawns(elapsed, remainSec, spawnMult) {
  let t = Math.max(0, elapsed || 0);
  let left = Math.max(0, remainSec || 0);
  let n = 0, guard = 0;
  while (left > 0 && guard++ < 4000) {
    const iv = Math.max(0.05, spawnInterval(t) * (spawnMult || 1));
    left -= iv; t += iv;
    if (left >= 0) n++;
  }
  return n;
}

// 하단이 뚫렸을 때 성벽이 무는 값.
//
// 예전에는 "기본값 + 층 × 계수"짜리 공식이었다. 그러면 **얼마나 일찍 뚫렸는지가
// 거의 반영되지 않는다** — 20초 만에 전멸한 판과 59초까지 버틴 판이 두 배도
// 차이 나지 않았다. 하단을 아예 포기하는 쪽이 늘 쌌다.
//
// 이제는 마릿수로 센다. 지금 판에 살아 있는 몹 + **남은 시간에 나왔을 몹**이
// 전부 성문으로 간다. 20초에 뚫리면 40초어치가 통째로 얹히므로, 일찍 무너질수록
// 정직하게 더 아프다.
function wipeCost(remainSec, waveIndex, liveMobs, arena) {
  const a   = arena || (typeof gs !== 'undefined' && gs ? gs.arena : null);
  const el  = a ? (a.elapsed || 0) : 0;
  const sm  = a ? (a.spawnMult || 1) : 1;
  const pend = pendingArenaSpawns(el, remainSec, sm);
  const n    = Math.max(0, liveMobs || 0) + pend;
  // 한 마리가 성문에서 물고 가는 값 — 성벽 최대치의 1%
  const hpMax = (typeof baseHpMax === 'function') ? baseHpMax() : 100;
  const per   = Math.max(1, hpMax * WIPE_PER_MOB_PCT);
  // 한 마리도 안 남았는데 뚫렸다면(시간이 다 된 전멸) 최소한은 문다
  const raw  = Math.max(WIPE_BASE, n * per);
  const cap  = Math.max(WIPE_BASE, Math.round(hpMax * WIPE_HP_CAP_PCT));
  return Math.min(cap, Math.round(raw));
}

const DROP_TYPES = [
  { id:'gold',  icon:'💰', w:30, color:'#fbbf24', label:'금화 더미' },
  { id:'exp',   icon:'✨', w:22, color:'#f59e0b', label:'전투 기록' },
  { id:'heal',  icon:'❤️', w:16, color:'#22c55e', label:'응급 치료' },
  { id:'rage',  icon:'🔥', w:10, color:'#f87171', label:'분노',   buff:{kind:'rage',  mult:1.6} },
  { id:'haste', icon:'💨', w:10, color:'#38bdf8', label:'질풍',   buff:{kind:'haste', mult:1.6} },
  { id:'guard', icon:'🛡️', w:  6, color:'#a78bfa', label:'수호',  buff:{kind:'guard', mult:0.55} },
];
function rollDropType() {
  const total = DROP_TYPES.reduce((a, d) => a + d.w, 0);
  let r = Math.random() * total;
  for (const d of DROP_TYPES) { r -= d.w; if (r <= 0) return d; }
  return DROP_TYPES[0];
}
const FORMATION_RADIUS    = 30;    // 집결 지점 기준 대형 반경
const AUTO_ADVANCE_PCT    = 0.40;  // 자동 모드에서 사거리 밖 적에게 접근하는 속도 비율
const SEPARATION_FORCE    = 26;    // 개체가 서로 완전히 겹치지 않게 미는 힘

// 전투에서 벗어나면 회복한다. 틱 전투에서는 한 웨이브가 짧은 그룹전 3번이었지만
// 실시간에서는 60초 내내 노출되므로, 사거리 밖으로 빼는 행동에 값을 줘야 한다.
// 수동 조작(빼고 다시 붙이기)이 이득이 되는 것도 이 규칙 덕분이다.
// ─── 🗡️ 도적 ─────────────────────────────────────────────────────────────────
const ROGUE_STEALTH_CD    = 7.0;   // 은신 재사용 대기(초)
const ROGUE_STEALTH_DUR   = 2.6;   // 은신 지속. 이 안에 때리면 기습이 터진다
const ROGUE_AMBUSH_MULT   = 3.2;   // 은신을 풀며 넣는 첫 타격 배율
const ROGUE_STEALTH_SPD   = 1.45;  // 은신 중 이동속도 배율 — 파고들라고 준다
const ROGUE_GREED_CHANCE  = 0.55;  // 드랍이 떨어졌을 때 주우러 갈 확률

const ARENA_REGEN_DELAY = 4.0;   // 마지막 피격 후 이 시간이 지나야 회복 시작
// 기본 자연 회복을 0.5%/s까지 낮췄다. 4.5%/s면 22초면 만피가 되어, 전투가 끝났을 때
// 부대는 늘 "죽었거나 멀쩡하거나" 둘 중 하나였다 — 그 사이가 없으면 🏨여관이 할 일이 없다.
// 0.5%/s는 60초를 온전히 쉬어야 30%다. 있는 듯 없는 듯한 몫만 남기고,
// 실질적인 재생은 카드·장비·스킬(regenBonus)로 사게 한다.
const ARENA_REGEN_PCT   = 0.005; // 초당 최대 HP 비율 — 있는 듯 없는 듯한 수준만 남긴다

function spawnInterval(elapsed) {
  const base = SPAWN_BASE_INTERVAL * (BONUSES.pactSpawnMult || 1) / (BONUSES.spawnSpeedMult || 1);
  return Math.max(0.30, base / (1 + elapsed * SPAWN_RAMP));
}
function clampToArena(p, r) {
  p.x = Math.max(ARENA_X + r, Math.min(ARENA_X + ARENA_W - r, p.x));
  p.y = Math.max(ARENA_Y + r, Math.min(ARENA_Y + ARENA_H - r, p.y));
  return p;
}
function arenaCenter() {
  return { x: ARENA_X + ARENA_W / 2, y: ARENA_Y + ARENA_H / 2 };
}

// ─── 아군 유닛 — 실시간 스탯 ─────────────────────────────────────────────────
// atkPeriod(초) · range(px) · moveSpd(px/s) · skillCd(초)
// DPS는 v1.0 틱 전투(ATK = 초당 피해)와 같은 값이 되도록 주기를 맞췄다.
//
// ── v12.8 근접·원거리 재조정 ──
// 보고: "후반부로 가니까 근접 유닛은 모두 죽어버리고 활밖에 못 쓰게 돼."
// 몹 공격력은 층을 따라 sm^0.80으로 오르는데 아군 체력은 정액 합산이라
// 곡선을 따라가지 못한다. 그 차이를 **접촉하는 쪽**이 전부 뒤집어쓴다 —
// 근접은 맞고 원거리는 안 맞으니, 깊어질수록 답이 활 하나로 수렴한다.
// 그래서 역할대로 갈랐다.
//   근접 — 체력·방어를 올리고 공격을 내린다 (버티는 것이 일이다)
//   활   — 체력을 내린다 (안 맞는 값을 이미 사거리로 받고 있다)
// 특히 ✝️성기사는 '방패병보다 단단하다'가 이름값이라 폭을 가장 크게 줬다.
const UNIT_TYPES = {
  swordsman: {
    id:'swordsman', name:'검사',   cost:8,
    hp:152, atk:10, def:5, atkPeriod:0.90, range:26, moveSpd:85, radius:7.5,
    skillName:'회전 베기', skillKind:'spin', skillAtk:28, skillCd:6, skillRadius:52, skillColor:'#f59e0b',
    color:'#60a5fa', icon:'⚔️', role:'균형 잡힌 근접 딜러'
  },
  archer: {
    id:'archer',    name:'궁수',   cost:6,
    hp:52, atk:10, def:1, atkPeriod:0.75, range:130, moveSpd:90, radius:7.5, ranged:true,
    skillName:'연사', skillKind:'volley', skillAtk:12, skillHits:3, skillCd:5, skillColor:'#a78bfa',
    color:'#a78bfa', icon:'🏹', role:'긴 사거리 · 카이팅'
  },
  healer: {
    id:'healer',    name:'치유사', cost:10,
    hp:80, atk:5,  def:2, atkPeriod:1.20, range:100, moveSpd:88, radius:7.5, ranged:true,
    skillName:'치유', skillKind:'heal', skillAtk:0, skillCd:7, skillRadius:90, healAmt:25, skillColor:'#34d399',
    color:'#34d399', icon:'✚', role:'주변 아군 회복'
  },
  guardian: {
    id:'guardian',  name:'방패병', cost:14,
    hp:305, atk:6,  def:12, atkPeriod:1.10, range:24, moveSpd:70, radius:9, isTank:true,
    skillName:'방벽', skillKind:'bulwark', skillAtk:0, skillCd:8, skillRadius:110, shieldAmt:22, skillColor:'#38bdf8',
    color:'#38bdf8', icon:'🛡️', role:'앞에 서서 맞고 도발'
  },
  mage: {
    id:'mage',      name:'마법사', cost:16,
    hp:80, atk:9,  def:1, atkPeriod:1.00, range:110, moveSpd:82, radius:7.5, ranged:true,
    skillName:'화염 폭발', skillKind:'nova', skillAtk:22, skillCd:7, skillRadius:78, skillColor:'#f97316',
    color:'#f97316', icon:'✨', role:'뭉친 적에게 광역'
  },
  // 🗡️ 도적 — 다른 용병은 "얼마나 세게 맞고 얼마나 세게 때리나"뿐이라
  // 조합이 결국 앞줄/뒷줄 두 갈래로 수렴했다. 도적은 그 축 밖에 선다.
  //   은신 — 쿨다운마다 사라진다. 사라진 동안은 맞지 않고 표적도 되지 않는다.
  //   기습 — 은신을 풀며 넣는 첫 타격이 크게 들어간다.
  //   탐욕 — 바닥에 떨어진 것을 확률적으로 주우러 간다. 알아서 챙기는 대신
  //          그동안 전열에서 빠지므로, 쓸모와 손해가 같이 온다.
  rogue: {
    id:'rogue',     name:'도적',   cost:13,
    hp:106, atk:12, def:2, atkPeriod:0.62, range:26, moveSpd:112, radius:7.5,
    skillName:'은신', skillKind:'stealth', skillAtk:0, skillCd:ROGUE_STEALTH_CD, skillColor:'#c084fc',
    stealth:true, greed:ROGUE_GREED_CHANCE,
    color:'#c084fc', icon:'🗡️', role:'은신 · 기습 · 드랍 회수'
  }
};
// ─── 특수 용병 ───────────────────────────────────────────────────────────────
// 여관에서만 고용할 수 있다. 골드로 사는 것은 같지만, 캠프 보석 해금과 달리
// 런 안에서 여관을 올려야 열리므로 "이번 판에 무엇을 지을까"의 선택지가 된다.
// 일반 용병보다 비싸고 확실히 강하다 — 후반 골드의 사용처이기도 하다.
const SPECIAL_UNIT_TYPES = {
  // 도적이 일반 용병으로 나갔으므로 그 자리를 광전사가 메운다 —
  // 여관의 첫 손님은 "싸고 빠른 근접 DPS"여야 조합이 이어진다.
  berserker: {
    id:'berserker', name:'광전사', cost:22, innLevel:0,
    hp:176, atk:18, def:4, atkPeriod:0.58, range:28, moveSpd:104, radius:8,
    skillName:'광란', skillKind:'spin', skillAtk:36, skillCd:5, skillRadius:52, skillColor:'#f43f5e',
    color:'#f43f5e', icon:'🪓', role:'가장 빠른 근접 DPS · 물몸', special:true
  },
  paladin: {
    id:'paladin', name:'성기사', cost:28, innLevel:1,
    hp:445, atk:10, def:19, atkPeriod:1.10, range:26, moveSpd:70, radius:9, isTank:true,
    skillName:'성역', skillKind:'bulwark', skillAtk:0, skillCd:7, skillRadius:120, shieldAmt:38, skillColor:'#fbbf24',
    color:'#fbbf24', icon:'✝️', role:'방패병보다 단단하고 보호막도 크다', special:true
  },
  marksman: {
    id:'marksman', name:'명사수', cost:32, innLevel:2,
    hp:58, atk:17, def:1, atkPeriod:1.00, range:180, moveSpd:84, radius:7.5, ranged:true,
    skillName:'관통 사격', skillKind:'volley', skillAtk:30, skillHits:4, skillCd:6, skillColor:'#22d3ee',
    color:'#22d3ee', icon:'🎯', role:'사거리 180 · 아레나 절반을 덮는다', special:true
  }
};
const SPECIAL_UNIT_ORDER = ['berserker', 'paladin', 'marksman'];

// ─── 특수 용병은 매 웨이브 여관에 "들르는" 것이다 ────────────────────────────
// 항상 고용할 수 있으면 그냥 비싼 일반 용병일 뿐이다.
// 웨이브마다 여관 문을 열어봐야 누가 와 있는지 알 수 있게 하면,
// 원하는 조합이 떴을 때 골드를 쓸지 아낄지가 판단거리가 된다.
// 등장 확률과 자릿수는 여관 레벨과 '소문난 주점' 강화가 올린다.
const SPECIAL_BASE_CHANCE  = 0.28;   // 여관 Lv.1 기준 한 자리당 등장 확률
const SPECIAL_CHANCE_PER_LV= 0.05;   // 여관 레벨당 가산
const SPECIAL_SEATS_BASE   = 1;      // 굴리는 자릿수
const SPECIAL_SEATS_PER_LV = 1/3;    // 여관 3레벨마다 +1

function specialSeats(innLv) {
  return SPECIAL_SEATS_BASE + Math.floor(Math.max(0, innLv) * SPECIAL_SEATS_PER_LV);
}
function specialChance(innLv) {
  return Math.min(0.92, SPECIAL_BASE_CHANCE + Math.max(0, innLv) * SPECIAL_CHANCE_PER_LV
                        + (BONUSES.specialChance || 0));
}
// 이번 웨이브에 여관에 와 있는 특수 용병을 뽑는다 (중복 없음)
function rollInnOffers(innLv) {
  if (innLv < 0) return [];
  const seats = specialSeats(innLv);
  const chance = specialChance(innLv);
  const pool = SPECIAL_UNIT_ORDER.slice();
  const out = [];
  for (let i = 0; i < seats && pool.length; i++) {
    if (Math.random() >= chance) continue;
    const k = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(k, 1)[0]);
  }
  return out;
}
// 특수 용병 전용 슬롯 — 일반 편성 슬롯과 따로 센다.
// 🏨 여관 레벨 두 단마다 한 칸. 예전에는 보석 트랙 하나에만 매달려 있어서
// 여관을 Lv.10까지 올려도 자리가 늘지 않았다 — 건물을 올린 보람이 없었다.
function specialSlotMax() {
  const lv = (typeof townBuildingLevel === 'function' && typeof gs !== 'undefined')
    ? townBuildingLevel(gs, 'inn') : 0;
  return 1 + Math.floor(lv / 2) + (BONUSES.specialSlotBonus || 0);
}
// 일반 용병과 특수 용병을 한 표에서 찾을 수 있게 합쳐 둔다
Object.assign(UNIT_TYPES, SPECIAL_UNIT_TYPES);

const UNIT_ORDER = ['archer', 'swordsman', 'rogue', 'healer', 'guardian', 'mage'];

const HERO_ARENA = {
  atkPeriod:0.80, range:34, moveSpd:95, radius:9,
  skillName:'영웅 일격', skillKind:'cleave', skillCd:6, skillRadius:60, skillMult:2.2, skillColor:'#fbbf24'
};

// ─── 👑 영웅 각인 ────────────────────────────────────────────────────────────
// 영웅이 오래도록 "레벨만 오르는 스탯 덩어리"였다. 스킬 트리는 숫자를 키울 뿐
// 영웅이 무엇을 하는 존재인지는 바꾸지 못했다 — 누구의 영웅이든 6초마다 같은 일격을 쳤다.
// 각인은 캠프에서 고르는 하나의 길이다. 아레나 스킬을 통째로 갈아치우고
// 그에 맞는 패시브를 얹는다. 값을 치르지 않고 언제든 바꿀 수 있게 뒀다 —
// 층마다 다른 조합을 요구하는 게임에서, 각인을 잠가두면 그냥 안 쓰게 된다.
const HERO_SIGILS = [
  { id:'blade', name:'검성', icon:'⚔️', color:'#f87171',
    tagline:'붙어서 벤다',
    skill:{ name:'회전베기', kind:'spin', cd:6.5, radius:80, mult:2.9, color:'#fbbf24',
            desc:'주변 전체를 벤다 — 가장 넓은 근접기' },
    passive:'영웅 공격력 +15% · 공격속도 +10%',
    apply:b=>{ b.sigilHeroAtkMult *= 1.15; b.sigilHeroSpdMult *= 1.10; } },

  { id:'warden', name:'수호자', icon:'🛡️', color:'#38bdf8',
    tagline:'앞에서 버틴다',
    skill:{ name:'불굴의 함성', kind:'bulwark', cd:9, radius:96, mult:0, color:'#38bdf8',
            desc:'부대 전체에 보호막 + 주변 도발' },
    passive:'영웅 HP +30% · 아군 방어 +4',
    apply:b=>{ b.sigilHeroHpMult *= 1.30; b.heroAura += 4; } },

  { id:'sorcerer', name:'술사', icon:'🔥', color:'#a78bfa',
    tagline:'멀리서 태운다',
    skill:{ name:'화염 폭발', kind:'nova', cd:9.5, radius:110, mult:3.6, color:'#f97316',
            desc:'가장 넓은 범위 · 맞은 적은 둔화' },
    passive:'영웅 사거리 +40% · 스킬 피해 +25%',
    apply:b=>{ b.sigilHeroRangeMult *= 1.40; b.sigilSkillMult *= 1.25; } },

  // 🏹 신궁 — 술사와 같은 원거리지만 성격이 반대다.
  // 술사는 한 방을 넓게 터뜨리고, 신궁은 여러 발을 빠르게 꽂는다.
  // 방패병이 원거리를 반으로 깎는 판에서 '원거리인데도 뚫는' 갈래를 하나 둔다 —
  // 그래서 관통(방어 무시)이 이 각인의 몫이다.
  { id:'ranger', name:'신궁', icon:'🏹', color:'#4ade80',
    tagline:'멀리서, 빠르게, 여러 발',
    ranged:true,
    skill:{ name:'연사', kind:'volley', cd:5.5, radius:0, mult:1.5, color:'#86efac',
            hits:4, desc:'사거리 안 넷에게 연달아 쏜다' },
    passive:'영웅 사거리 +90% · 공격속도 +25% · 원거리 저항 무시',
    apply:b=>{ b.sigilHeroRangeMult *= 1.90; b.sigilHeroSpdMult *= 1.25;
               b.heroPierceRanged = true; } },
];
const DEFAULT_SIGIL = 'blade';

function sigilDef(id) {
  return HERO_SIGILS.find(s => s.id === id) || HERO_SIGILS[0];
}
// 지금 걸려 있는 각인 (세이브에 남는 영구 선택)
function activeSigil() {
  const id = (typeof gs !== 'undefined' && gs) ? gs.heroSigil : DEFAULT_SIGIL;
  return sigilDef(id || DEFAULT_SIGIL);
}

// ─── 아레나 몬스터 ───────────────────────────────────────────────────────────
// behavior: 'charge' 최근접 아군 직진 · 'kite' 거리 유지 원거리 · 'dash' 주기적 돌진
// 이속은 아군 최고(95)보다 느려야 카이팅이 성립한다 — 광견(135)만 예외.
const BATTLE_MOB_TYPES = {
  goblin:   { id:'goblin',   name:'고블린',   hp:30,  atk:8,  def:1,  atkPeriod:1.0, range:20,  moveSpd:70,  radius:6,  goldReward:3,   color:'#4ade80', icon:'👺', behavior:'charge' },
  hound:    { id:'hound',    name:'광견',     hp:22,  atk:6,  def:0,  atkPeriod:0.7, range:18,  moveSpd:135, radius:6,  goldReward:5,  color:'#f472b6', icon:'🐺', behavior:'charge' },
  orc:      { id:'orc',      name:'오크',     hp:80,  atk:15, def:4,  atkPeriod:1.2, range:22,  moveSpd:55,  radius:8,  goldReward:8,  color:'#818cf8', icon:'👹', behavior:'charge' },
  darkarch: { id:'darkarch', name:'다크아처', hp:45,  atk:12, def:2,  atkPeriod:1.4, range:140, moveSpd:60,  radius:7,  goldReward:9,  color:'#c084fc', icon:'🏹', behavior:'kite', ranged:true },
  ogre:     { id:'ogre',     name:'오우거',   hp:150, atk:22, def:6,  atkPeriod:1.6, range:26,  moveSpd:45,  radius:10, goldReward:15,  color:'#a16207', icon:'🧌', behavior:'charge' },
  // 😈 뿔귀 — 날아오는 것이 뿔과 가죽에 튕긴다. 궁수 한 종류로 칸을 다 채우는 것이
  // 늘 정답이던 것을 되돌리려고 넣었다. 궁수를 약하게 만드는 대신
  // **궁수만으로는 안 되는 적**을 둔다 — 숫자를 깎으면 궁수가 나빠지지만,
  // 이 적을 두면 검사를 섞을 이유가 생긴다. 붙어서 때리면 그대로 아프다.
  //
  // 저항 0.65 + 방어 5는 두 겹으로 물려 궁수가 '약한' 게 아니라 '안 통하는' 것이 됐다 —
  // 궁수 여섯이 30초 동안 여섯 마리를 한 마리도 못 잡았다. 그건 편성을 섞게 만드는 게
  // 아니라 궁수를 버리게 만든다. 방어를 낮추고 저항만 남겨 한 겹으로 만들었다.
  //
  // 예전 이름은 '방패병', 그림은 방패 든 파란 기사였다. 그런데 **아군에도 방패병이
  // 있다**(guardian). 이름이 같고 색·실루엣까지 겹쳐서, 화면에서 적인지 아군인지
  // 구별되지 않았다. 붉은 뿔 달린 마귀로 갈아 이름부터 겹치지 않게 했다.
  hornfiend:{ id:'hornfiend',name:'뿔귀',     hp:110, atk:14, def:2,  atkPeriod:1.3, range:22,  moveSpd:58,  radius:9,  goldReward:13,  color:'#ef4444', icon:'😈', behavior:'charge', rangedResist:0.50 },
  boss:     { id:'boss',     name:'보스',     hp:200, atk:25, def:8,  atkPeriod:1.5, range:30,  moveSpd:40,  radius:11, goldReward:24,  color:'#ef4444', icon:'💀', behavior:'dash',  isBoss:true },
  warlord:  { id:'warlord',  name:'마왕',     hp:520, atk:40, def:14, atkPeriod:1.8, range:34,  moveSpd:35,  radius:11, goldReward:70, color:'#db2777', icon:'🐲', behavior:'slam',  isBoss:true }
};

// ─── 웨이브 결과 3단계 ───────────────────────────────────────────────────────
// 완주 · 후퇴 · 전멸이 각각 다른 값을 갖도록 만든다.
// v2.2까지는 전멸만 기지 피해를 받고 후퇴는 공짜였다 — 그래서 실측에서
// "일찍 후퇴하는 것이 언제나 정답"이 되어버렸다.
//
//   완주 — 60초를 버텼다        : 승리 보너스 + 완주 보너스 + 성벽 수리
//   후퇴 — 하단을 비웠다        : 승리 보너스 절반, 남은 시간만큼 성벽 피해
//   전멸 — 병력을 잃었다        : 보너스 없음, 돌파 피해 + 병력 전멸
//
// 후퇴 피해가 남은 시간에 비례하므로 "언제 뺄까"가 실제 판단이 된다.
// 10초 남기고 빼면 3HP, 50초 남기고 빼면 15HP.
// 0.30으로 잡았더니 첫 런이 7웨이브에서 끝났다 — 약한 편성은 매 웨이브
// 후퇴할 수밖에 없는데 그때마다 15HP씩 나가 회복할 방법이 없었다.
// 0.20이면 60초 남기고 빼도 12HP, 20초 남기고 빼면 4HP다.
const RETREAT_DPS = 0.20;   // 후퇴 시 남은 1초당 기지 피해
const RETREAT_MAX = 14;     // 상한 — 돌파(27)의 절반 수준

// ─── 골드 경제 (v3.2 재조정) ─────────────────────────────────────────────────
// 실측: 1-4까지 가볍게 진행한 판에서 8,000골드가 남고 살 것이 없었다.
// 원인은 후반 사용처가 아니라 초반부터의 과잉 수급이었다 —
// 웨이브 1에 41골드가 들어오고 웨이브 2에 323골드가 들어왔다.
//
// 목표: 웨이브 1을 마치면 타워 두 기(10) + 용병 한 명(6)을 살 정도.
// 처음 몇 웨이브는 완벽하게 막지 못하고 기지가 조금씩 깎여야 하고,
// 그 부족분을 보석 강화로 메워 다음 판이 쉬워지는 것이 이 게임의 성장 축이다.
//
//   몹 보상   ×0.4 정도로 (고블린 8→3 … 마왕 180→70) — 수입의 대부분이 여기서 나온다
//   처치 보너스 kills×(웨이브+1) → kills×(1+웨이브×0.12). 곱셈이 이중으로 붙어 폭발했다
//   승리/완주 보너스도 절반 이하로
//   사용처 비용도 함께 내린다 — 수입만 깎으면 후반 사용처에 영영 못 닿는다
//
// ─── 후반 골드 사용처 ────────────────────────────────────────────────────────
// 실측에서 발전한 편성은 웨이브 5부터 2,000~3,600골드를 놀린다.
// 타워 격자가 30기에서 차고 마을 강화가 바닥나는데 수입은 계속 늘기 때문이다.
// 아래 셋은 모두 반복 구매 가능하고, 살수록 비싸져 수입이 늘어도 계속 흡수한다.

// 성벽 보수 — 후반에 남아도는 것은 골드고 모자란 것은 기지 HP다.
// 그 둘을 교환하는 통로를 열되, 런 안에서 살수록 비싸진다.
const WALL_REPAIR_AMOUNT = 12;
const WALL_REPAIR_BASE   = 40;
const WALL_REPAIR_ESCALATION = 1.45;
function wallRepairCost(n) {
  return Math.round(WALL_REPAIR_BASE * Math.pow(WALL_REPAIR_ESCALATION, Math.max(0, n || 0)));
}

// 강화 카드 리롤 — 원하는 빌드로 밀어붙이고 싶을 때 쓰는 곳
const REROLL_BASE = 22;
const REROLL_ESCALATION = 1.6;
function rerollCost(n) {
  return Math.round(REROLL_BASE * Math.pow(REROLL_ESCALATION, Math.max(0, n || 0)));
}

const CLEAR_BONUS_BASE     = 12;   // 완주 보너스 기본
const CLEAR_BONUS_PER_WAVE = 4;    // 웨이브당 가산
// 완주 보상의 알맹이는 골드가 아니라 성벽 수리다.
// 후반에는 골드가 남아돌지만 기지 HP는 언제나 모자라기 때문이고,
// 버티기 어려운 후반 웨이브일수록 많이 수리해줘야 완주할 이유가 생긴다.
const CLEAR_REPAIR_BASE = 2;
const CLEAR_REPAIR_MAX  = 6;
function clearRepair(waveIndex) {
  return Math.min(CLEAR_REPAIR_MAX, CLEAR_REPAIR_BASE + Math.floor((waveIndex || 0) / 4));
}

// 기지 피해 감소는 상한을 둔다.
// 스킬 트리만으로 65%가 쌓이고 강화 카드까지 겹치면 85%까지 간다 —
// 이 상태에서는 기지에 닿는 모든 피해가 1/7이 되어, 적을 아무리 강하게 만들어도
// 만렙 편성이 죽지 않는다. 실측(∞-29, 적 ×44.7)에서 한 웨이브 피해가
// 상수 9HP로 고정돼 있던 원인 중 하나가 이것이다.
// 기지 피해 감소의 **합계** 상한. 갈래마다 따로 상한을 두고 곱했더니
// (1-0.55) × (1-0.6) = 0.18, 즉 82%까지 깎였다. 거기서 피해가 1로 바닥을 치고
// 기지 재생이 그걸 도로 채워서 "맞았는데 체력이 안 줄어든다"가 됐다.
// 이제 어느 갈래를 얼마나 쌓든 **절반 아래로는 내려가지 않는다.**
const BASE_DEF_PCT_CAP   = 0.55;   // (개별 갈래 표시용으로만 남긴다)
const BASE_DEF_TOTAL_CAP = 0.50;
// 아군 비율 방어의 상한. 기지와 같은 이유로 둔다 — 100%에 닿으면 그 뒤로는
// 아무것도 위험하지 않아서 판이 끝난다.
const UNIT_DEF_PCT_CAP   = 0.50;
// 웨이브가 끝나도 아직 걸어오던 적은 사라지지 않고 다음 웨이브로 넘어간다.
// 상한은 성능과 가독성 때문이지, 밸런스 때문이 아니다.
const CARRYOVER_MAX = 40;

function baseDamageMult() {
  // 🧱 성벽 결계가 걸려 있는 동안은 기지가 아무 피해도 받지 않는다
  if (typeof gs !== 'undefined' && gs && (gs.baseWardUntil || 0) > 0) return 0;
  // 두 갈래를 각각 자른 뒤 곱하면 상한이 상한 구실을 못 한다 — 합쳐서 한 번 자른다.
  const combined = 1 - (1 - Math.max(0, BONUSES.baseDefPct    || 0))
                     * (1 - Math.max(0, BONUSES.breachReduce  || 0));
  return 1 - Math.min(BASE_DEF_TOTAL_CAP, combined);
}
// 화면에 적어 주기 위한 값 — 지금 실제로 몇 %가 깎이는가
function baseDefPctShown() { return Math.round((1 - baseDamageMult()) * 100); }

// 🏰 최후 저지선 — 성채가 직접 쏜다. 강화를 사지 않으면 공격력이 0이라 아무 일도 없다.
const CASTLE_BASE_RANGE = CELL_W * 1.6;
const CASTLE_BASE_SPD   = 0.7;
function castleAtk()   { return Math.round(BONUSES.castleAtk || 0); }
function castleRange() { return CASTLE_BASE_RANGE * (1 + (BONUSES.castleRange || 0)); }
function castleSpd()   { return CASTLE_BASE_SPD * (BONUSES.castleSpd || 1); }

function retreatCost(remainSec) {
  // 무한 구간에서는 후퇴 단가도 같이 오른다. 상수로 두면 깊은 층에서
  // "매 웨이브 후퇴"가 전멸(층에 비례)보다 압도적으로 싸져 다시 정답이 된다.
  //
  // 기지 피해 감소(baseDefPct)는 여기 적용하지 않는다.
  // 후퇴는 적이 성벽을 때린 결과가 아니라 하단을 스스로 비운 대가다.
  // 감소율을 먹였더니 방어 스킬을 다 찍은 편성은 웨이브 시작 직후 빼도 6~10HP밖에
  // 안 들어, 성벽 보수(+12HP)로 메우며 무한히 도는 고리가 생겼다.
  // 신규 플레이어는 baseDefPct가 0이므로 초반 난이도는 그대로다.
  const w = _curWaveIndex();
  return Math.min(retreatCap(w),
    Math.ceil(Math.max(0, remainSec) * RETREAT_DPS * endlessCapMult(w)));
}
function clearBonusGold(waveIndex) {
  return CLEAR_BONUS_BASE + waveIndex * CLEAR_BONUS_PER_WAVE;
}

// 아군이 전멸하면 아레나에 남은 몬스터가 기지로 돌파해 초당 피해를 준다.
// 두 전선을 연결해, 하단에서 지는 것도 실제 패배로 이어지게 만든다.
const BREAKTHROUGH_DPS      = 0.03;  // 몹 공격력 1당 초당 기지 피해
const BREAKTHROUGH_MAX      = 1.8;   // 초당 상한 — 한 웨이브 전멸이 즉사가 되지 않도록
// v1.0에서는 2.5(전멸 1회당 37HP)였다. 그룹 전투에서 전멸은 예외였지만
// 아레나에서는 흔한 일이라, 전멸 3번이면 런이 끝나는 계산이 너무 가팔랐다.
// 1.8 = 전멸 1회당 최대 27HP → 네 번은 버틴다.
const BREAKTHROUGH_DURATION = 15;    // 돌파 지속(초). 이후 몬스터는 물러나고 상단만 남는다

// 무한 구간에서는 두 상한을 함께 푼다.
// 상한이 상수로 남아 있으면 아레나에서 매 웨이브 전멸해도 피해가 27HP로 고정돼,
// "계속 지는데 죽지는 않는" 상태가 무한히 이어진다.
// 다만 이 상한은 완만해야 한다 — 층당 1.10으로 잡았더니 ∞-25에서 전멸 한 번이
// 131HP(기지의 60%)가 되어, 무한 모드가 두 웨이브 만에 끝났다.
// 깊은 층에서도 전멸 한 번은 기지의 1/5 언저리여야 만회할 여지가 남는다.
const ENDLESS_CAP_GROWTH = 1.03;
const ENDLESS_CAP_MAX    = 2.5;
function _curWaveIndex() {
  return (typeof wm !== 'undefined' && wm) ? (wm.waveIndex || 0)
       : (typeof gs !== 'undefined' && gs) ? (gs.wave || 0) : 0;
}
function endlessCapMult(waveIndex) {
  const t = endlessTier(waveIndex);
  return t <= 0 ? 1 : Math.min(ENDLESS_CAP_MAX, Math.pow(ENDLESS_CAP_GROWTH, t - 1));
}
function breakthroughCap(waveIndex) {
  return BREAKTHROUGH_MAX * endlessCapMult(waveIndex);
}
function retreatCap(waveIndex) {
  return Math.round(RETREAT_MAX * endlessCapMult(waveIndex));
}

// 엘리트: 케이브 업그레이드로 확률 상승. 스탯 강화 + 보상 증가
const ELITE_STAT_MULT = 1.8;
const ELITE_GOLD_MULT = 2.5;

// ─── 웨이브 정의 ─────────────────────────────────────────────────────────────
// defenseEnemies: 상단 스폰 큐 (변경 없음)
// arenaPool: 하단 아레나 스폰 풀 — [몹 id, 가중치] 목록에서 뽑아 리젠한다.
//            v1.0의 "그룹을 순서대로 격파"가 "어떤 몹이 어떤 비율로 나오는가"로 바뀌었다.
// 10 스테이지 × 3 웨이브 = 30 웨이브
// 훈련은 "한 번 해보는 곳"이다. 30웨이브(30분 이상)를 다 치르게 하면
// 본편인 심연에 닿기도 전에 지친다는 보고가 있었다 — 6웨이브, 10분 안쪽으로 줄였다.
// WAVE_DEFS의 나머지 항목은 남겨 둔다: 곡선의 참고이자, 늘리고 싶을 때의 여유다.
const TRAINING_WAVES = 6;
// 훈련에서 나오는 보석은 이것뿐이다. 스테이지별 지급은 없앴다.
// 훈련을 건너뛰면 주는 보석. 완주(2) + 첫 클리어 정산까지 합쳐 4를 벌 수 있으므로
// 평균치에 가까운 3을 주고 심연을 바로 연다 — 아는 내용을 다시 치르게 하는 것은 값이 아니다.
const TRAIN_SKIP_GEMS     = 3;
const TRAINING_CLEAR_GEMS = 2;   // 완주
const TRAINING_QUIT_GEMS  = 1;   // 중간에 접음

const WAVE_DEFS = [
  // ── 1-1 : 고블린 입문 · 기본 조작 ────────────────────────────────────────
  // 1-1은 영웅 하나로 하단을 정리할 수 있어야 한다 — 버는 돈은 적지만 손에 익히는 곳이다.
  // spawnMult는 아레나 스폰 간격 배수다 (클수록 뜸하게 나온다).
  { defenseEnemies:[{type:'goblin',count:4,interval:2000}], arenaPool:[['goblin',10]], spawnMult:4.2 },
  { defenseEnemies:[{type:'goblin',count:5,interval:1800}], arenaPool:[['goblin',10]], spawnMult:2.6 },
  { defenseEnemies:[{type:'goblin',count:6,interval:1600}], arenaPool:[['goblin',10]], spawnMult:1.7 },
  // ── 1-2 : 광견 등장 · 수동 조작의 첫 필요 ────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:6,interval:1500},{type:'runner',count:2,interval:3000}], arenaPool:[['goblin',10],['hound',3]] },
  { defenseEnemies:[{type:'goblin',count:7,interval:1400},{type:'runner',count:3,interval:2600}], arenaPool:[['goblin',9],['hound',5]] },
  { defenseEnemies:[{type:'goblin',count:8,interval:1300},{type:'runner',count:4,interval:2400}], arenaPool:[['goblin',8],['hound',6]] },
  // ── 1-3 : 오크 · 체력 벽 ─────────────────────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:8,interval:1200},{type:'orc',count:2,interval:4000}], arenaPool:[['goblin',8],['hound',5],['orc',3]] },
  { defenseEnemies:[{type:'goblin',count:9,interval:1100},{type:'orc',count:3,interval:3500}], arenaPool:[['goblin',7],['hound',5],['orc',5]] },
  { defenseEnemies:[{type:'goblin',count:10,interval:1000},{type:'orc',count:3,interval:3200}], arenaPool:[['goblin',6],['hound',5],['orc',6],['hornfiend',3]] },
  // ── 1-4 : 다크아처 · 접근 강제 ───────────────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:8,interval:1000},{type:'brute',count:1,interval:6000},{type:'bat',count:3,interval:3000}], arenaPool:[['goblin',6],['hound',5],['orc',5],['hornfiend',4],['darkarch',3]] },
  { defenseEnemies:[{type:'orc',count:4,interval:2500},{type:'brute',count:1,interval:6000},{type:'bat',count:4,interval:2600}], arenaPool:[['goblin',5],['hound',4],['orc',5],['hornfiend',4],['darkarch',4]] },
  { defenseEnemies:[{type:'orc',count:5,interval:2200},{type:'brute',count:2,interval:5000},{type:'bat',count:5,interval:2400}], arenaPool:[['goblin',4],['hound',5],['orc',7],['darkarch',5]] },
  // ── 1-5 : 오우거 · 고타격 저속 ───────────────────────────────────────────
  { defenseEnemies:[{type:'runner',count:6,interval:1400},{type:'orc',count:3,interval:2200},{type:'bat',count:5,interval:2200}], arenaPool:[['goblin',4],['hound',5],['orc',6],['darkarch',4],['ogre',2]] },
  { defenseEnemies:[{type:'orc',count:5,interval:2000},{type:'brute',count:2,interval:4500},{type:'bat',count:6,interval:2000}], arenaPool:[['hound',5],['orc',6],['darkarch',4],['ogre',3]] },
  { defenseEnemies:[{type:'goblin',count:8,interval:800},{type:'brute',count:3,interval:4000},{type:'bat',count:7,interval:1800}], arenaPool:[['hound',5],['orc',6],['darkarch',4],['ogre',4]] },
  // ── 1-6 : 보스 등장 · 돌진 패턴 ──────────────────────────────────────────
  { defenseEnemies:[{type:'orc',count:6,interval:1800},{type:'brute',count:2,interval:4000},{type:'bat',count:6,interval:2000}], arenaPool:[['hound',5],['orc',6],['darkarch',4],['ogre',4],['boss',1]] },
  { defenseEnemies:[{type:'runner',count:8,interval:1100},{type:'orc',count:5,interval:1800},{type:'bat',count:8,interval:1600}], arenaPool:[['hound',5],['orc',5],['darkarch',4],['ogre',5],['boss',1]] },
  { defenseEnemies:[{type:'orc',count:7,interval:1600},{type:'brute',count:3,interval:3600},{type:'bat',count:8,interval:1500}], arenaPool:[['hound',4],['orc',5],['darkarch',4],['ogre',5],['boss',2]] },
  // ── 1-7 : 엘리트 확률 상승 · 단일 고위협 ─────────────────────────────────
  { defenseEnemies:[{type:'orc',count:7,interval:1500},{type:'brute',count:3,interval:3400},{type:'wyvern',count:1,interval:9000}], arenaPool:[['hound',4],['orc',5],['darkarch',5],['ogre',5],['boss',2]], eliteBonus:0.10 },
  { defenseEnemies:[{type:'orc',count:8,interval:1400},{type:'runner',count:6,interval:1600},{type:'bat',count:8,interval:1500},{type:'wyvern',count:1,interval:8000}], arenaPool:[['hound',4],['orc',4],['darkarch',5],['ogre',6],['boss',3]], eliteBonus:0.12 },
  { defenseEnemies:[{type:'orc',count:9,interval:1300},{type:'brute',count:4,interval:3000},{type:'wyvern',count:2,interval:7000}], arenaPool:[['hound',4],['orc',4],['darkarch',5],['ogre',6],['boss',3]], eliteBonus:0.14 },
  // ── 1-8 : 오우거 · 보스 혼합 · 복합 압력 ─────────────────────────────────
  { defenseEnemies:[{type:'orc',count:8,interval:1200},{type:'brute',count:4,interval:2800},{type:'bat',count:9,interval:1400},{type:'wyvern',count:2,interval:6500}], arenaPool:[['hound',3],['orc',4],['darkarch',5],['ogre',7],['boss',4]], eliteBonus:0.14 },
  { defenseEnemies:[{type:'brute',count:5,interval:2600},{type:'runner',count:8,interval:1000},{type:'wyvern',count:2,interval:6000}], arenaPool:[['hound',3],['darkarch',5],['ogre',7],['boss',5]], eliteBonus:0.16 },
  { defenseEnemies:[{type:'brute',count:6,interval:2400},{type:'orc',count:6,interval:1600},{type:'bat',count:10,interval:1300},{type:'wyvern',count:3,interval:5500}], arenaPool:[['hound',3],['darkarch',4],['ogre',7],['boss',6]], eliteBonus:0.16 },
  // ── 1-9 : 마왕 · 상하단 모두 보스급 ──────────────────────────────────────
  { defenseEnemies:[{type:'brute',count:6,interval:2200},{type:'boss',count:1,interval:9000},{type:'wyvern',count:3,interval:5000}], arenaPool:[['darkarch',4],['ogre',6],['boss',6],['warlord',1]], eliteBonus:0.18 },
  { defenseEnemies:[{type:'brute',count:7,interval:2000},{type:'boss',count:1,interval:8000},{type:'bat',count:10,interval:1200},{type:'wyvern',count:3,interval:4800}], arenaPool:[['darkarch',4],['ogre',5],['boss',7],['warlord',2]], eliteBonus:0.18 },
  { defenseEnemies:[{type:'brute',count:8,interval:1800},{type:'boss',count:2,interval:6000},{type:'wyvern',count:4,interval:4500}], arenaPool:[['darkarch',3],['ogre',5],['boss',8],['warlord',3]], eliteBonus:0.20 },
  // ── 1-10 : 최종 · 마왕 다수 + 최대 밀도 ──────────────────────────────────
  { defenseEnemies:[{type:'brute',count:8,interval:1600},{type:'boss',count:2,interval:5000},{type:'bat',count:12,interval:1100},{type:'wyvern',count:4,interval:4200}], arenaPool:[['ogre',4],['boss',8],['warlord',4]], eliteBonus:0.20, spawnMult:0.85 },
  { defenseEnemies:[{type:'brute',count:9,interval:1500},{type:'boss',count:3,interval:4500},{type:'wyvern',count:5,interval:4000}], arenaPool:[['ogre',3],['boss',8],['warlord',6]], eliteBonus:0.22, spawnMult:0.80 },
  { defenseEnemies:[{type:'boss',count:5,interval:3500},{type:'brute',count:8,interval:1600},{type:'bat',count:12,interval:1000},{type:'wyvern',count:6,interval:3500}], arenaPool:[['ogre',2],['boss',7],['warlord',9]], eliteBonus:0.25, spawnMult:0.72 },
];

// 가중치 풀에서 몹 id 하나를 뽑는다
function rollArenaMob(pool) {
  if (!pool || !pool.length) return 'goblin';
  let total = 0;
  for (const [, w] of pool) total += w;
  let r = Math.random() * total;
  for (const [id, w] of pool) { r -= w; if (r <= 0) return id; }
  return pool[0][0];
}

// ─── 무한 모드 ───────────────────────────────────────────────────────────────
// 30웨이브를 완주해도 런이 끝나지 않는 구간.
//
// 실측에서 만렙 편성(스킬 27개 + 해금 전부 + 타워 30기 Lv.5)이 13웨이브 동안
// 기지 HP를 8밖에 안 잃었다. 원인은 명확하다 — 타워 성장(스킬 누적 × 레벨 5.4배)이
// 적 성장(웨이브당 +22%, 선형)을 압도적으로 앞지른다.
// ─── ∞ 무한 모드 ─────────────────────────────────────────────────────────────
// v3.0에서 무한 모드가 메인 콘텐츠가 됐다.
//
// v2.6까지 무한은 "30웨이브를 완주해야 열리는 연장전"이었다. 그런데 만렙 편성이
// ∞-19까지 가는 데 통산 49웨이브 — 그중 앞의 30웨이브는 결과가 이미 정해진
// 구간이었다. 매 런 30분을 알던 길로 걸어야 진짜 게임이 시작됐다.
//
// 그래서 무한을 1층부터 시작하는 독립 모드로 떼어냈다.
//   훈련(캠페인 30웨이브) — 손에 익히는 곳. 한 번 완주하면 무한이 열린다.
//   무한 — 죽어야 끝나는 본편. 도달 층이 곧 기록이고, 나온 보석으로 강해져서 다시 내려간다.
//
// 층 정의는 손으로 쓰지 않는다. tier 하나에서 전부 생성한다 — 그래야 진짜로 끝이 없다.

// 성장 곡선: 초반은 완만한 선형, 후반은 지수가 지배한다.
// 선형만 쓰면 반드시 따라잡히고, 지수만 쓰면 1~10층이 지루하게 똑같다.
const ENDLESS_LINEAR   = 0.11;    // 층당 가산 (상단)
const ENDLESS_EXP      = 1.068;   // 층당 배율 — 상단 체력. 1.055는 26층이 무피해로 막혔다
const ENDLESS_ARENA_EXP= 1.034;   // 하단 체력 곡선 — 1.040은 26층부터 처리량을 못 따라갔다
const ENDLESS_ARENA_LINEAR = 0.06;// 하단은 가산도 따로 쓴다. 상단을 올리자고 하단까지 끌려가면 안 된다
// 하단 몹의 방어력·공격력은 체력 배율(sm)을 그대로 쓰지 않는다. 지수를 눌러 쓴다.
const ARENA_DEF_EXP    = 0.45;    // 방어력
const ARENA_ATK_EXP    = 0.80;    // 공격력
const ARENA_DMG_FLOOR  = 0.12;    // 방어력을 다 뚫려도 원 공격력의 12%는 들어간다   // 아레나는 완만하게 — 두 전선이 비슷한 층에서 위험해지도록
const ENDLESS_DMG_EXP  = 1.035;   // 기지에 넣는 피해
const ENDLESS_SPD_EXP  = 1.022;   // 이동속도
const ENDLESS_SPD_CAP  = 2.4;     // 상한 — 이 이상은 프레임 간 이동이 격자를 건너뛴다
const ENDLESS_DENSITY_STEP = 0.975;  // 층당 상단 스폰 간격
const ENDLESS_DENSITY_MIN  = 0.40;   // 하한 — 이 이상 촘촘해지면 개체 수가 감당이 안 된다
const ENDLESS_ARENA_TIGHTEN= 0.99;   // 층당 아레나 스폰 간격
const ENDLESS_ELITE_STEP   = 0.012;  // 층당 정예 확률

// ─── 보석 ────────────────────────────────────────────────────────────────────
// 층당 몫이 깊이에 따라 커진다. 정액이면 20층에서 40층으로 가는 열 배 어려운 구간이
// 정확히 두 배 값어치밖에 안 돼서, 더 내려갈 이유가 사라진다.
// 보석 경로가 셋이 됐다 — 층당 적립 · 상단 현상수배 · 하단 정예.
// 소환 두 갈래가 모두 층마다 기회를 주므로, 층당 적립을 그만큼 낮춘다.
// 그러지 않으면 "깊이 간 대가"보다 "소환을 몇 번 눌렀나"가 보석을 지배한다.
const ENDLESS_GEM_BASE      = 0.24;   // 층당 기본
const ENDLESS_GEM_ACCEL     = 0.040;  // 층당 가산 — 깊이의 값
const ENDLESS_GATE_BONUS      = 5;    // 관문(10층 단위) 최초 돌파
const ENDLESS_GATE_BONUS_STEP = 3;    // 관문마다 증가
function endlessGemStep(tier) {
  return ENDLESS_GEM_BASE + Math.max(0, (tier || 1) - 1) * ENDLESS_GEM_ACCEL;
}

// 이미 돌파해 본 층은 값이 거의 없다.
// 예전에는 몇 층이든 내려갈 때마다 같은 값을 줬다. 그러면 최고 기록이 40층인 사람에게도
// 1~10층을 빠르게 훑고 나오는 쪽이 41층을 노리는 것보다 시간당 이득이 커진다 —
// 깊이가 점수인 게임에서 얕은 반복이 최적 전략이 되는 것은 앞뒤가 안 맞는다.
// 그래서 보석은 '처음 닿은 깊이'에만 제값이 붙고, 되짚는 층은 1/10만 남긴다.
const ENDLESS_REPEAT_MULT = 0.10;
// 되짚기를 1/10로 깎으면 층 적립만으로는 벌이가 4분의 1로 준다.
// 그 몫을 '새로 돌파한 층'으로 옮긴다 — 벌이의 중심을 깊이로 밀어붙이는 것이 이 개편의 목적이므로,
// 총량을 줄이는 게 아니라 어디서 버는지를 바꾸는 것이 맞다.
// 깊은 층은 한 층 내려가기가 더 어려우니 층당 몫도 기록에 비례해 커진다.
const ENDLESS_NEW_FLOOR_GEM   = 1.0;    // 새로 돌파한 층 한 층당
const ENDLESS_NEW_FLOOR_DEPTH = 0.06;   // 기존 기록 한 층당 가산
function newDepthGems(cleared, bestAtStart) {
  const gained = Math.max(0, (cleared || 0) - (bestAtStart || 0));
  if (!gained) return 0;
  return Math.round(gained * (ENDLESS_NEW_FLOOR_GEM + (bestAtStart || 0) * ENDLESS_NEW_FLOOR_DEPTH));
}
// 깊이와 무관한 정산 항(케이브 레벨 · 처치 수)에 걸리는 배율.
// 전부 되짚기면 ENDLESS_REPEAT_MULT, 전부 새 깊이면 1.0, 그 사이는 비례.
// 층 적립에만 감액을 걸고 정액 항을 그대로 두면 얕은 반복이 다시 최적이 된다.
function repeatSideMult(cleared, bestAtStart) {
  const c = Math.max(0, cleared || 0);
  if (c <= 0) return 0;
  const fresh = Math.max(0, c - Math.max(0, bestAtStart || 0));
  const share = Math.min(1, fresh / c);
  return ENDLESS_REPEAT_MULT + (1 - ENDLESS_REPEAT_MULT) * share;
}

// 이번 판에서 이 층을 넘었을 때 쌓이는 몫. bestAtStart는 판을 시작할 때의 최고 기록.
function endlessGemStepFor(tier, bestAtStart) {
  const first = tier > (bestAtStart || 0);
  return endlessGemStep(tier) * (first ? 1 : ENDLESS_REPEAT_MULT);
}
// t층까지 내려갔을 때 쌓이는 총량 (표시용 — 실제 적립은 층마다 endlessGemStep)
function endlessGemTotal(tier) {
  const t = Math.max(0, tier || 0);
  return t * ENDLESS_GEM_BASE + ENDLESS_GEM_ACCEL * t * (t - 1) / 2;
}
// 최고 기록이 best인 사람이 t층까지 내려갔을 때 실제로 받는 총량.
// best층까지는 되짚기라 1/10, 그 위는 제값이다.
function endlessGemTotalFor(tier, best) {
  const t = Math.max(0, tier || 0);
  const b = Math.min(t, Math.max(0, best || 0));
  return endlessGemTotal(b) * ENDLESS_REPEAT_MULT + (endlessGemTotal(t) - endlessGemTotal(b));
}

// 1층이 기준(×1)이고 거기서부터 오른다
function endlessCurve(tier, exp, linear) {
  const n = Math.max(0, (tier || 1) - 1);
  return (1 + n * (linear === undefined ? ENDLESS_LINEAR : linear)) * Math.pow(exp, n);
}

function isEndlessRun() {
  return (typeof gs !== 'undefined' && gs && gs.mode === 'endless');
}
// 무한 런에서는 웨이브 인덱스가 곧 층(0-based → 1층부터). 훈련에서는 0.
function endlessTier(waveIndex) {
  return isEndlessRun() ? (waveIndex || 0) + 1 : 0;
}
function endlessStatMult(waveIndex) {
  const t = endlessTier(waveIndex);
  return t <= 0 ? 1 : endlessCurve(t, ENDLESS_EXP);
}
function endlessArenaMult(waveIndex) {
  const t = endlessTier(waveIndex);
  return t <= 0 ? 1 : endlessCurve(t, ENDLESS_ARENA_EXP, ENDLESS_ARENA_LINEAR);
}
function endlessDmgMult(waveIndex) {
  const t = endlessTier(waveIndex);
  return t <= 0 ? 1 : Math.pow(ENDLESS_DMG_EXP, t - 1);
}
function endlessSpdMult(waveIndex) {
  const t = endlessTier(waveIndex);
  return t <= 0 ? 1 : Math.min(ENDLESS_SPD_CAP, Math.pow(ENDLESS_SPD_EXP, t - 1));
}
function endlessDensityMult(waveIndex) {
  const t = endlessTier(waveIndex);
  return t <= 0 ? 1 : Math.max(ENDLESS_DENSITY_MIN, Math.pow(ENDLESS_DENSITY_STEP, t - 1));
}

// ─── 결정적 난수 ─────────────────────────────────────────────────────────────
// 층 구성과 변형은 무작위로 "보이되" 층 번호만으로 결정돼야 한다.
// 같은 27층은 누가 언제 가도 같은 27층이어야 기록에 의미가 생긴다.
// 런 시드를 함께 섞는다.
// 층 번호만으로 결정하면 27층은 언제나 같은 27층이라 기록 비교는 깔끔하지만,
// 판을 거듭할수록 "아, 이 층은 그거"가 되어 단조로워진다.
// 난이도 곡선(배율·물량)은 층 번호만으로 정해지고 시드는 구성과 변형만 흔들므로,
// 판마다 그림이 달라져도 같은 층의 무게는 같다.
function runSeed() {
  return (typeof gs !== 'undefined' && gs && gs.runSeed) ? (gs.runSeed | 0) : 0;
}
function endlessRand(tier, salt, seed) {
  const sd = (seed === undefined) ? runSeed() : (seed | 0);
  let x = ((tier | 0) * 2654435761 + (salt | 0) * 40503 + sd * 2246822519 + 0x9E3779B9) >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;  x >>>= 0;
  return x / 4294967296;
}

// ─── 아레나 지형 ─────────────────────────────────────────────────────────────
// 빈 직사각형 아레나에서는 어디에 서든 똑같다 — 위치 선정이 의미를 갖지 않는다.
// 지형이 들어가면 "어디서 싸울지"가 판단거리가 된다:
//   바위 — 못 지나가고 화살도 막는다. 엄폐물이자 장애물
//   수렁 — 통과는 되지만 느려진다. 쫓기면 치명적
//   가시 — 서 있으면 최대 HP 비례로 깎인다. 아군도 몹도 똑같이
// 층과 런 시드로 생성하므로 판마다 다른 지형이 나온다.
const TERRAIN_DEFS = {
  rock:  { name:'바위', fill:'#3a4252', edge:'#6b7280', blocksMove:true, blocksShot:true },
  mud:   { name:'수렁', fill:'#2f2a16', edge:'#7c6f2a', slow:0.52 },
  spike: { name:'가시', fill:'#33131f', edge:'#9f1239', dpsPct:0.014 },  // 초당 최대HP의 1.4%
  // 💧 물 — 못 지나가지만 **화살은 건너간다.** 바위와 정반대다.
  // 이 하나가 있어야 지형이 "누구에게 불리한가"를 갈라 놓을 수 있다:
  //   바위(둘 다 막음) → 근접·원거리 모두 답답
  //   물(이동만 막음)  → 근접은 돌아가야 하고 원거리는 그대로 쏜다
  //   미로(바위 벽)    → 원거리가 손해
  water: { name:'물',   fill:'#12314f', edge:'#38bdf8', blocksMove:true }
};
const TERRAIN_ORDER    = ['rock','mud','spike'];
const TERRAIN_MARGIN   = 22;   // 벽에서 떨어뜨릴 거리 — 밀려나도 아레나를 벗어나지 않게
const TERRAIN_SAFE_R   = 74;   // 중앙 안전 반경 — 아군이 시작하는 자리는 비워둔다
const TERRAIN_MIN      = 30;
const TERRAIN_MAX      = 76;

// 층이 깊어질수록 지형이 늘어난다. 1~2층은 비워두고 배우게 한다.
function terrainCountFor(tier) {
  if (tier < 3) return 0;
  const n = Math.min(5, 1 + Math.floor((tier - 3) / 5));
  return Math.min(9, Math.round(n * fev('terrainMult', 1)));   // 🌋 지진이면 2배
}

function _rectsOverlap(a, b, pad) {
  return !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x ||
           a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
}

// ─── 🗺 아레나 지형 배치 ─────────────────────────────────────────────────────
// 예전에는 층마다 작은 사각형 몇 개를 무작위로 뿌리는 것이 전부였다. 그러니
// 어느 층을 가도 "여기저기 조금 걸리적거린다"가 끝이고, 판이 달라지는 느낌이 없었다.
//
// 이제 층마다 **이름 있는 배치**를 하나 뽑는다. 배치마다 누가 손해를 보는지가
// 분명해서, 편성을 그 층에 맞춰 바꿀 이유가 생긴다.
//
//   🌾 개활지  아무것도 없다 — 순수한 힘 싸움
//   🪨 돌밭    예전의 무작위 흩뿌리기
//   🧱 미로    긴 벽이 늘어서 시야를 끊는다 → **원거리가 손해**
//   💧 호수    가운데가 물 → 근접은 돌아가야 한다, **원거리가 이득**
//   🏛 회랑    가로 벽 두 줄로 길이 셋 → 뭉치면 갇힌다
//   🌋 화산    가시밭이 넓게 깔린다 → 오래 서 있으면 녹는다
//   🐊 늪지    수렁이 넓게 → 전부 느려진다, 원거리가 조금 이득
//
// 각 생성기는 사각형 목록만 돌려준다. 막기·느려짐·피해는 TERRAIN_DEFS가 정한다.
function _terr(kind, x, y, w, h) {
  const d = TERRAIN_DEFS[kind] || TERRAIN_DEFS.rock;
  return { kind, x, y, w, h,
           blocksMove: !!d.blocksMove, blocksShot: !!d.blocksShot,
           slow: d.slow || 0, dpsPct: d.dpsPct || 0 };
}
// 아군이 시작하는 한가운데는 늘 비워 둔다 — 시작하자마자 벽에 끼면 판이 아니다.
function _clearsCenter(r) {
  const cx = ARENA_X + ARENA_W / 2, cy = ARENA_Y + ARENA_H / 2;
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return Math.hypot(cx - nx, cy - ny) >= TERRAIN_SAFE_R;
}

const ARENA_LAYOUTS = [
  { id:'open', name:'개활지', icon:'🌾', minTier:1, weight:14,
    desc:'가릴 것이 없다 — 힘으로 붙는다',
    gen: () => [] },

  { id:'rubble', name:'돌밭', icon:'🪨', minTier:3, weight:20,
    desc:'바위가 흩어져 있다 — 화살이 자주 걸린다',
    gen: (tier) => scatterTerrain(tier) },

  // 🧱 미로 — 긴 직선 벽. 벽이 화살을 막으므로 원거리 효율이 떨어진다.
  // 벽마다 통로를 하나씩 남겨 길이 완전히 끊기지는 않게 한다.
  { id:'maze', name:'미로', icon:'🧱', minTier:6, weight:16,
    desc:'긴 벽이 시야를 끊는다 — 원거리가 손해',
    gen: (tier) => {
      const out = [];
      const rows = 4, wallH = 12;
      const gapW = 92;
      for (let i = 0; i < rows; i++) {
        const y = ARENA_Y + ARENA_H * (i + 1) / (rows + 1) - wallH / 2;
        // 통로 위치를 줄마다 어긋나게 — 한 줄로 뚫려 있으면 미로가 아니다
        const gx = ARENA_X + 14 + endlessRand(tier, 4100 + i) * (ARENA_W - gapW - 28);
        const left  = _terr('rock', ARENA_X + 8, y, Math.max(0, gx - ARENA_X - 8), wallH);
        const right = _terr('rock', gx + gapW, y,
                            Math.max(0, ARENA_X + ARENA_W - 8 - (gx + gapW)), wallH);
        for (const r of [left, right]) if (r.w > 16 && _clearsCenter(r)) out.push(r);
      }
      return out;
    } },

  // 💧 호수 — 가운데 물. 근접은 돌아가야 하고 화살은 그대로 건너간다.
  // 한가운데를 통째로 막으면 아군 시작 자리가 없어지므로 도넛처럼 비켜 놓는다.
  { id:'lake', name:'호수', icon:'💧', minTier:5, weight:16,
    desc:'가운데가 물 — 근접은 돌아서 간다',
    gen: (tier) => {
      const cx = ARENA_X + ARENA_W / 2, cy = ARENA_Y + ARENA_H / 2;
      const w = ARENA_W * 0.46, h = ARENA_H * 0.26;
      // 물을 한가운데가 아니라 위/아래 중 한쪽으로 민다.
      // 26px만 띄웠더니 아군이 시작하는 자리를 물이 덮어서, 판이 시작하자마자
      // 부대가 물 밖으로 밀려났다. 안전 반경(TERRAIN_SAFE_R)만큼 띄운다.
      const up  = endlessRand(tier, 4300) < 0.5;
      const off = TERRAIN_SAFE_R - 10;
      const y   = up ? cy - h - off : cy + off;
      const out = [ _terr('water', cx - w / 2, y, w, h) ];
      // 물가에 수렁을 조금 — 물을 돌아가는 길이 완전히 공짜는 아니게
      out.push(_terr('mud', cx - w / 2 - 34, y + h * 0.2, 30, h * 0.6));
      out.push(_terr('mud', cx + w / 2 + 4,  y + h * 0.2, 30, h * 0.6));
      return out.filter(r => r.w > 8 && r.h > 8);
    } },

  // 🏛 회랑 — 가로 벽 두 줄. 길이 셋으로 갈려 부대가 흩어진다.
  { id:'corridor', name:'회랑', icon:'🏛', minTier:8, weight:13,
    desc:'가로 벽 두 줄 — 길이 셋으로 갈린다',
    gen: (tier) => {
      const out = [];
      const wallH = 14, sideW = ARENA_W * 0.34;
      for (let i = 0; i < 2; i++) {
        const y = ARENA_Y + ARENA_H * (i === 0 ? 0.28 : 0.72) - wallH / 2;
        const flip = endlessRand(tier, 4500 + i) < 0.5;
        const a = _terr('rock', ARENA_X + 6, y, sideW, wallH);
        const b = _terr('rock', ARENA_X + ARENA_W - 6 - sideW, y, sideW, wallH);
        for (const r of (flip ? [a, b] : [b, a])) if (_clearsCenter(r)) out.push(r);
      }
      return out;
    } },

  // 🌋 화산 — 가시밭. 서 있으면 녹으므로 계속 움직여야 한다.
  { id:'volcano', name:'화산', icon:'🌋', minTier:12, weight:11,
    desc:'가시밭이 넓다 — 서 있으면 녹는다',
    gen: (tier) => {
      const out = [];
      for (let i = 0; i < 5; i++) {
        const w = 54 + endlessRand(tier, 4700 + i) * 60;
        const h = 40 + endlessRand(tier, 4800 + i) * 46;
        const x = ARENA_X + TERRAIN_MARGIN + endlessRand(tier, 4900 + i) * (ARENA_W - w - TERRAIN_MARGIN * 2);
        const y = ARENA_Y + TERRAIN_MARGIN + endlessRand(tier, 5000 + i) * (ARENA_H - h - TERRAIN_MARGIN * 2);
        const r = _terr('spike', x, y, w, h);
        if (_clearsCenter(r) && !out.some(o => _rectsOverlap(o, r, 6))) out.push(r);
      }
      return out;
    } },

  // 🐊 늪지 — 수렁이 넓게. 전부 느려지니 원거리가 조금 이득이다.
  { id:'swamp', name:'늪지', icon:'🐊', minTier:10, weight:11,
    desc:'수렁이 넓다 — 모두 느려진다',
    gen: (tier) => {
      const out = [];
      for (let i = 0; i < 4; i++) {
        const w = 80 + endlessRand(tier, 5200 + i) * 90;
        const h = 54 + endlessRand(tier, 5300 + i) * 60;
        const x = ARENA_X + 10 + endlessRand(tier, 5400 + i) * (ARENA_W - w - 20);
        const y = ARENA_Y + 10 + endlessRand(tier, 5500 + i) * (ARENA_H - h - 20);
        const r = _terr('mud', x, y, w, h);
        if (!out.some(o => _rectsOverlap(o, r, 4))) out.push(r);
      }
      return out;
    } },
];

// ─── 🛢 바닥 장식 ────────────────────────────────────────────────────────────
// 판정에 전혀 관여하지 않는다 — 통·상자·항아리·금무더기를 바닥에 몇 개 놓을 뿐이다.
// 그런데 이게 없으면 아레나가 "무늬 깔린 빈 직사각형"으로 보인다. 지형이 없는
// 개활지에서 특히 그렇다. 그래서 **지형이 적은 배치일수록 장식을 더 놓는다.**
//
// 지형과 같은 시드를 쓰므로 같은 층은 늘 같은 자리에 놓인다 — 판이 리셋돼도
// 배경이 안 바뀌어서, 다시 봐도 "그 층"으로 읽힌다.
const DECO_FRAMES = 8;     // terrain/deco.png 안의 그림 수
const DECO_W      = 16;    // 원본 크기 그대로 — 유닛(반지름 9~11)과 나란히 놓일 크기다
const DECO_H      = 32;
const DECO_CLEAR  = 16;    // 지형 사각형에서 이만큼 떨어뜨린다
// 🛢 어디에 놓는가 — 장식은 판정이 없어서 유닛이 통 위로 걸어 지나간다.
// 막게 만들 수도 있었지만, 그러면 '장식'이 전투 판정을 바꾸는 물건이 되고
// 통 하나에 부대가 끼는 사고가 난다. 대신 **싸움이 벌어지는 곳을 피한다** —
// 네 귀퉁이에만 놓으면 유닛과 겹칠 일이 거의 없다.
const DECO_CORNER_W = 0.26;   // 좌우 가장자리에서 이 비율 안쪽까지가 '구석'
const DECO_CORNER_H = 0.24;   // 위아래도 같은 방식
const DECO_COMBAT_R_PCT = 0.40;   // 짧은 변의 이 비율 = 중앙 전투권. 여기엔 아무것도 안 놓는다

function generateArenaDeco(tier, seed, terrain) {
  const t = Math.max(0, tier | 0);
  if (t <= 0) return [];                        // 훈련장은 비워 둔다
  // 지형이 빽빽하면 장식까지 얹을 자리가 없다
  const ter = terrain || [];
  const n   = Math.max(3, 9 - ter.length);
  const cx  = ARENA_X + ARENA_W / 2, cy = ARENA_Y + ARENA_H / 2;
  const DECO_COMBAT_R = Math.min(ARENA_W, ARENA_H) * DECO_COMBAT_R_PCT;
  const out = [];
  // 네 귀퉁이 상자 — 여기 안에만 놓는다
  const bw = ARENA_W * DECO_CORNER_W, bh = ARENA_H * DECO_CORNER_H;
  const CORNERS = [
    { x: ARENA_X + 12,                 y: ARENA_Y + 26 },
    { x: ARENA_X + ARENA_W - 12 - bw,  y: ARENA_Y + 26 },
    { x: ARENA_X + 12,                 y: ARENA_Y + ARENA_H - 8 - bh },
    { x: ARENA_X + ARENA_W - 12 - bw,  y: ARENA_Y + ARENA_H - 8 - bh },
  ];
  let salt = 6100;
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 24; tries++) {
      salt++;
      // 귀퉁이를 돌아가며 채운다 — 한 구석에 몰리면 그것대로 어색하다
      const q = CORNERS[(i + tries) % 4];
      const x = q.x + endlessRand(t, salt, seed) * bw;
      const y = q.y + endlessRand(t, salt + 700, seed) * bh;
      // 싸움이 벌어지는 한가운데는 통째로 비운다. 귀퉁이 상자의 안쪽 모서리가
      // 여기 걸리는 경우가 있어서(전수 검사에서 4.6%), 반경으로 한 번 더 자른다.
      if (Math.hypot(cx - x, cy - y) < DECO_COMBAT_R) continue;
      // 지형 위나 바로 옆에 놓으면 "이것도 막히나?" 하고 헷갈린다
      let bad = false;
      for (const r of ter) {
        if (x > r.x - DECO_CLEAR && x < r.x + r.w + DECO_CLEAR &&
            y > r.y - DECO_CLEAR && y < r.y + r.h + DECO_CLEAR) { bad = true; break; }
      }
      if (bad) continue;
      // 서로 겹치지 않게
      if (out.some(o => Math.abs(o.x - x) < 20 && Math.abs(o.y - y) < 20)) continue;
      out.push({ f: Math.floor(endlessRand(t, salt + 1400, seed) * DECO_FRAMES) % DECO_FRAMES,
                 x, y });
      break;
    }
  }
  return out;
}

function arenaLayoutById(id) { return ARENA_LAYOUTS.find(l => l.id === id) || ARENA_LAYOUTS[0]; }

// 이 층의 배치. 층과 런 시드로 정해지므로 브리핑에서 미리 보여줄 수 있다.
function arenaLayoutFor(tier, seed) {
  const t = Math.max(1, tier || 1);
  const pool = ARENA_LAYOUTS.filter(l => t >= l.minTier);
  if (!pool.length) return ARENA_LAYOUTS[0];
  const total = pool.reduce((a, l) => a + l.weight, 0);
  let r = endlessRand(t, 5900, seed) * total;
  for (const l of pool) { r -= l.weight; if (r <= 0) return l; }
  return pool[pool.length - 1];
}

// 이 층의 지형. 배치를 하나 뽑아 그 생성기를 돌린다.
// (예전에는 이 자리가 곧 흩뿌리기였다 — 지금 그건 '돌밭' 배치 하나로 남았다.)
function generateArenaTerrain(tier, seed) {
  const L = arenaLayoutFor(tier, seed);
  let out = [];
  try { out = L.gen(tier) || []; } catch (e) { out = []; }
  // 어떤 배치든 아레나 밖으로 새지 않게 한 번 다듬는다
  return out.filter(r => r.w > 6 && r.h > 6).map(r => {
    r.x = Math.max(ARENA_X, Math.min(ARENA_X + ARENA_W - r.w, r.x));
    r.y = Math.max(ARENA_Y, Math.min(ARENA_Y + ARENA_H - r.h, r.y));
    return r;
  });
}

function scatterTerrain(tier) {
  const n = terrainCountFor(tier);
  if (n <= 0) return [];
  const cx = ARENA_X + ARENA_W / 2, cy = ARENA_Y + ARENA_H / 2;
  const out = [];
  let salt = 200;
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 30; tries++) {
      salt++;
      const kind = TERRAIN_ORDER[Math.floor(endlessRand(tier, salt) * TERRAIN_ORDER.length) % TERRAIN_ORDER.length];
      const w = TERRAIN_MIN + Math.floor(endlessRand(tier, salt + 900) * (TERRAIN_MAX - TERRAIN_MIN));
      const h = TERRAIN_MIN + Math.floor(endlessRand(tier, salt + 1800) * (TERRAIN_MAX - TERRAIN_MIN));
      const x = ARENA_X + TERRAIN_MARGIN + endlessRand(tier, salt + 2700) * (ARENA_W - w - TERRAIN_MARGIN * 2);
      const y = ARENA_Y + TERRAIN_MARGIN + endlessRand(tier, salt + 3600) * (ARENA_H - h - TERRAIN_MARGIN * 2);
      const rect = { kind, x, y, w, h };
      // 중앙(아군 시작 자리)과 겹치면 버린다
      const nx = Math.max(x, Math.min(cx, x + w));
      const ny = Math.max(y, Math.min(cy, y + h));
      if (Math.hypot(cx - nx, cy - ny) < TERRAIN_SAFE_R) continue;
      if (out.some(o => _rectsOverlap(o, rect, 16))) continue;
      const d = TERRAIN_DEFS[kind];
      out.push(Object.assign(rect, {
        blocksMove: !!d.blocksMove, blocksShot: !!d.blocksShot,
        slow: d.slow || 0, dpsPct: d.dpsPct || 0
      }));
      break;
    }
  }
  return out;
}

// 점이 이 사각형 안인지 (반지름 r만큼 여유)
function terrainAt(terrain, x, y) {
  if (!terrain) return null;
  for (const t of terrain) {
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return t;
  }
  return null;
}

// 이동 속도 배율 — 수렁 위에 있으면 느려진다
function terrainSpeedMult(terrain, e) {
  const t = terrainAt(terrain, e.x, e.y);
  return (t && t.slow) ? (1 - t.slow) : 1;
}

// 바위 밖으로 밀어낸다 (원 vs 사각형)
function resolveTerrainCollision(terrain, e) {
  if (!terrain || !terrain.length) return;
  const r = e.radius || 6;
  for (const t of terrain) {
    if (!t.blocksMove) continue;
    const nx = Math.max(t.x, Math.min(e.x, t.x + t.w));
    const ny = Math.max(t.y, Math.min(e.y, t.y + t.h));
    const dx = e.x - nx, dy = e.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 < 0.0001) {
      // 중심이 사각형 안 — 가장 가까운 변으로 뺀다
      const left = e.x - t.x, right = t.x + t.w - e.x;
      const top  = e.y - t.y, bot   = t.y + t.h - e.y;
      const m = Math.min(left, right, top, bot);
      if      (m === left)  e.x = t.x - r;
      else if (m === right) e.x = t.x + t.w + r;
      else if (m === top)   e.y = t.y - r;
      else                  e.y = t.y + t.h + r;
    } else {
      const d = Math.sqrt(d2);
      e.x = nx + dx / d * r;
      e.y = ny + dy / d * r;
    }
  }
}

// 투사체가 바위에 막히는지
function terrainBlocksShot(terrain, x, y) {
  if (!terrain) return false;
  for (const t of terrain) {
    if (!t.blocksShot) continue;
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return true;
  }
  return false;
}

// ─── 적 해금 순서 ────────────────────────────────────────────────────────────
// 층이 깊어지면 새 적이 합류하고, 오래된 적은 비중이 서서히 줄어든다.
// 사라지지는 않는다 — 소형 물량은 끝까지 상성 판단거리로 남아야 한다.
const ENDLESS_DEF_UNLOCK = [
  { tier: 1,  type: 'goblin' },
  { tier: 3,  type: 'runner' },
  { tier: 5,  type: 'orc'    },
  { tier: 8,  type: 'bat'    },
  { tier: 11, type: 'brute'  },
  { tier: 15, type: 'wyvern' },
  { tier: 19, type: 'boss'   },
];
const ENDLESS_ARENA_UNLOCK = [
  { tier: 1,  type: 'goblin'  },
  { tier: 3,  type: 'hound'   },
  { tier: 6,  type: 'orc'     },
  // 😈 뿔귀 — 다크아처(원거리 적)보다 먼저 나온다. 궁수로만 밀던 편성이
  // 처음으로 막히는 자리다.
  { tier: 7,  type: 'hornfiend'},
  { tier: 9,  type: 'darkarch'},
  { tier: 13, type: 'ogre'    },
  { tier: 17, type: 'boss'    },
  { tier: 22, type: 'warlord' },
];

// ─── 층 변형 ─────────────────────────────────────────────────────────────────
// 같은 곡선을 계속 올리기만 하면 40층과 41층이 구분되지 않는다.
// 층마다 성격을 하나씩 붙여, "이번엔 뭘 세워야 하나"를 다시 묻게 만든다.
const ENDLESS_AFFIXES = [
  { id:'sky',   name:'창공',   icon:'🕊',  desc:'비행 비중 2배',            apply:m=>{ m.airW   *= 2.4; } },
  { id:'iron',  name:'강철',   icon:'🛡',  desc:'적 방어력 +8',             apply:m=>{ m.armor  += 8;   } },
  { id:'rush',  name:'폭주',   icon:'💨', desc:'이동속도 +30%',            apply:m=>{ m.spd    *= 1.30; } },
  { id:'swarm', name:'무리',   icon:'🐝', desc:'물량 +60% · 체력 −30%',     apply:m=>{ m.count  *= 1.60; m.hp *= 0.70; } },
  { id:'elite', name:'정예',   icon:'💀', desc:'정예 확률 +25%',            apply:m=>{ m.elite  += 0.25; } },
  { id:'giant', name:'거인',   icon:'🗿', desc:'대형 비중 2배 · 체력 +35%', apply:m=>{ m.largeW *= 2.4; m.hp *= 1.35; } },
  { id:'horde', name:'해일',   icon:'🌊', desc:'아레나 스폰 간격 −35%',     apply:m=>{ m.arena  *= 0.65; } },

  // ── 심층 전용 (40층~) ──
  // 여기부터는 수치를 더 올려봐야 40층과 41층이 구분되지 않는다.
  // 배율이 아니라 "적이 다르게 행동하는" 변형을 따로 둔다.
  { id:'regen',    name:'재생',     icon:'🌱', deep:true, desc:'상단 적이 초당 최대체력 1.5% 회복',
    apply:m=>{ m.regen = 0.015; } },
  { id:'thorns',   name:'가시껍질', icon:'🌵', deep:true, desc:'아레나 몹이 근접 피해 25%를 반사',
    apply:m=>{ m.thorns = 0.25; } },
  { id:'split',    name:'분열',     icon:'🧬', deep:true, desc:'아레나 대형이 죽으면 소형 2기로 나뉜다',
    apply:m=>{ m.split = 2; } },
  { id:'volatile', name:'폭발',     icon:'💥', deep:true, desc:'아레나 몹이 죽으며 주변에 피해',
    apply:m=>{ m.volatile = 1; } },
];

const DEEP_FLOOR_FROM = 40;      // 여기부터 "심층" — 규칙이 겹치기 시작한다
function isDeepTier(tier) { return (tier || 0) >= DEEP_FLOOR_FROM; }

// 5층마다 변형이 하나씩 늘고, 심층에서 하나 더 겹친다
function affixCountFor(tier) {
  if (tier < 5)  return 0;
  if (tier < 15) return 1;
  if (tier < 30) return 2;
  if (!isDeepTier(tier)) return 3;
  return 4;
}
function affixesFor(tier) {
  const n = affixCountFor(tier);
  if (n <= 0) return [];
  // 심층 전용 변형은 40층부터만 풀에 들어간다
  const pool = ENDLESS_AFFIXES.filter(a => !a.deep || isDeepTier(tier));
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const k = Math.floor(endlessRand(tier, i + 1) * pool.length) % pool.length;
    out.push(pool.splice(k, 1)[0]);
  }
  return out;
}

// ─── 층 이벤트 ───────────────────────────────────────────────────────────────
// 변형(affix)이 적의 숫자를 바꾼다면, 이벤트는 그 층 동안의 규칙을 바꾼다.
// 배율만 계속 올리면 40층과 41층이 구분되지 않는다 — 다른 축의 변화가 필요하다.
// 불리한 것만 넣으면 그냥 난이도 곡선이 한 겹 더 생길 뿐이라,
// 유리한 것과 교환(득실이 함께 있는 것)을 섞었다. 좋은 층은 밀어붙이고
// 나쁜 층은 버티는 — 층마다 다른 판단을 하게 만드는 것이 목적이다.
const FLOOR_EVENTS = [
  // 불리
  { id:'fog',   icon:'🌫', name:'짙은 안개', tone:'bad',  w:12, desc:'타워 사거리 −30%',
    towerRangeMult:0.70 },
  { id:'seal',  icon:'🔒', name:'봉인',      tone:'bad',  w:10, desc:'타워 한 종류가 침묵합니다',
    sealsTower:true },
  { id:'rust',  icon:'🧪', name:'부식',      tone:'bad',  w:10, desc:'타워 공격력 −25%',
    towerDmgMult:0.75 },
  { id:'bleed', icon:'🩸', name:'출혈',      tone:'bad',  w:9,  desc:'완주 수리·성벽 보수 없음',
    noRepair:true },
  // 유리
  { id:'lode',  icon:'💰', name:'노다지',    tone:'good', w:9,  desc:'골드 획득 ×2',
    goldMult:2 },
  { id:'trove', icon:'💎', name:'보물',      tone:'good', w:7,  desc:'이 층 보석 ×3',
    gemMult:3 },
  { id:'surge', icon:'⚡', name:'각성',      tone:'good', w:9,  desc:'타워 과부하 쿨다운 −70%',
    overloadCdMult:0.30 },
  { id:'levy',  icon:'👥', name:'증원',      tone:'good', w:9,  desc:'편성 슬롯 +2',
    slotBonus:2 },
  { id:'boon',  icon:'🎲', name:'풍요',      tone:'good', w:8,  desc:'강화 카드 5장 중 선택',
    cards:5 },
  // 교환 — 득과 실이 함께 있다
  { id:'blitz', icon:'🕐', name:'속공',      tone:'mix',  w:8,  desc:'40초 · 골드 ×1.6',
    duration:40, goldMult:1.6 },
  { id:'greed', icon:'🪙', name:'탐욕',      tone:'mix',  w:8,  desc:'골드 ×2.5 · 적 HP +40%',
    goldMult:2.5, hpMult:1.4 },

  // ── 심층 전용 (40층~) ──
  { id:'blackout', icon:'🌑', name:'암전',   tone:'bad',  w:10, deep:true, desc:'타워 사거리 −50%',
    towerRangeMult:0.50 },
  { id:'quake',    icon:'🌋', name:'지진',   tone:'bad',  w:9,  deep:true, desc:'아레나 지형 2배',
    terrainMult:2 },
  { id:'frenzy',   icon:'🩻', name:'광란',   tone:'mix',  w:9,  deep:true, desc:'적 이동 +50% · 체력 −20%',
    enemySpdMult:1.5, hpMult:0.80 },
  { id:'vault',    icon:'🏺', name:'금고',   tone:'good', w:9,  deep:true, desc:'골드 획득 ×3',
    goldMult:3 },
  { id:'relic',    icon:'🗿', name:'유물',   tone:'good', w:7,  deep:true, desc:'이 층 보석 ×5',
    gemMult:5 },
];
const FLOOR_EVENT_FROM   = 4;     // 1~3층은 비워둔다 — 기본을 먼저 익히게
const FLOOR_EVENT_CHANCE = 0.55;

// 이벤트를 하나만 뽑는다. salt를 달리하면 같은 층에서 두 번 뽑을 수 있다.
function _pickFloorEvent(tier, salt, filter) {
  const pool = FLOOR_EVENTS.filter(e => (!e.deep || isDeepTier(tier)) && (!filter || filter(e)));
  const total = pool.reduce((a, e) => a + e.w, 0);
  if (!total) return null;
  let roll = endlessRand(tier, salt) * total;
  for (const e of pool) {
    roll -= e.w;
    if (roll <= 0) {
      if (!e.sealsTower) return e;
      // 봉인은 어떤 타워가 막히는지까지 정해야 한다
      const tp = (typeof unlockedTowers === 'function') ? unlockedTowers() : ['arrow'];
      const idx = Math.floor(endlessRand(tier, salt + 1) * tp.length) % tp.length;
      const id  = tp[idx] || 'arrow';
      const nm  = (TOWER_TYPES[id] || {}).name || id;
      return Object.assign({}, e, { sealedTower: id, desc: `${nm}이(가) 이 층에서 침묵합니다` });
    }
  }
  return null;
}

// 두 이벤트를 한 장으로 합친다. 배율은 곱하고, 슬롯은 더하고,
// 시간은 짧은 쪽을, 카드는 많은 쪽을 쓴다 — 나중에 뽑힌 쪽이 앞의 것을 덮지 않게.
const _FEV_MUL = ['towerRangeMult','towerDmgMult','goldMult','gemMult','overloadCdMult','hpMult',
                  'enemySpdMult','terrainMult'];
function _mergeFloorEvents(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = { id:`${a.id}+${b.id}`, tone:'deep', deep:true, parts:[a, b],
                icon:`${a.icon}${b.icon}`, name:`${a.name} · ${b.name}`,
                desc:`${a.desc} / ${b.desc}` };
  for (const k of _FEV_MUL) {
    const va = a[k], vb = b[k];
    if (va === undefined && vb === undefined) continue;
    out[k] = (va === undefined ? 1 : va) * (vb === undefined ? 1 : vb);
  }
  if (a.slotBonus || b.slotBonus) out.slotBonus = (a.slotBonus||0) + (b.slotBonus||0);
  if (a.duration  || b.duration)  out.duration  = Math.min(a.duration||WAVE_DURATION, b.duration||WAVE_DURATION);
  if (a.cards     || b.cards)     out.cards     = Math.max(a.cards||0, b.cards||0);
  if (a.noRepair  || b.noRepair)  out.noRepair  = true;
  const sealed = a.sealedTower || b.sealedTower;
  if (sealed) { out.sealsTower = true; out.sealedTower = sealed; }
  return out;
}

function floorEventOf(tier) {
  if (!tier || tier < FLOOR_EVENT_FROM) return null;

  // 심층에서는 해로운 것 하나 + 이로운 것 하나가 항상 함께 걸린다.
  // 40층 넘어서도 계속 배율만 올리면 층이 서로 구분되지 않는다 —
  // "이번 층은 어떤 조합인가"를 매 층 새로 판단하게 만드는 것이 목적이다.
  if (isDeepTier(tier)) {
    const bad  = _pickFloorEvent(tier, 501, e => e.tone === 'bad' || e.tone === 'mix');
    const good = _pickFloorEvent(tier, 511, e => e.tone === 'good');
    return _mergeFloorEvents(bad, good);
  }

  if (endlessRand(tier, 500) >= FLOOR_EVENT_CHANCE) return null;
  return _pickFloorEvent(tier, 501, null);
}

// 현재 층의 이벤트에서 값 하나를 꺼낸다 (없으면 기본값)
function fev(key, dflt) {
  const e = (typeof gs !== 'undefined' && gs) ? gs.floorEvent : null;
  if (!e || e[key] === undefined) return dflt;
  const v = e[key];
  // 🏮 등불 — 배율형 이벤트가 나에게 불리한 쪽이면 중립(1)으로 그만큼 끌어당긴다.
  // 유리한 쪽은 건드리지 않는다. 노드 이름 그대로 "완화"지 "무효"가 아니다.
  const soft = (typeof BONUSES !== 'undefined' && BONUSES.eventSoften) || 0;
  if (soft > 0 && typeof v === 'number' && _FEV_MUL.indexOf(key) >= 0) {
    const good = _FEV_GOOD_HIGH.indexOf(key) >= 0 ? v > 1 : v < 1;
    if (!good) return v + (1 - v) * Math.min(0.8, soft);
  }
  return v;
}
// 값이 높을수록 나에게 이로운 키 — 나머지는 낮을수록 이롭다
const _FEV_GOOD_HIGH = ['towerRangeMult','towerDmgMult','goldMult','gemMult'];
// 이 시간은 이제 "웨이브 길이"가 아니라 "몹이 나오는 시간"이다.
// 예전에는 타이머가 0이 되면 경로 위에 몹이 남아 있어도 웨이브가 끝났다 —
// 서리탑으로 느리게 만들수록 손해를 보는 이상한 규칙이었고,
// 잘 막을수록 마지막 몹이 기지에 닿지 못해 처치 보상도 놓쳤다.
// 이제 스폰이 끝난 뒤에도 판이 빌 때까지 계속된다.
function waveDuration() { return fev('duration', WAVE_DURATION); }

// 정리 구간의 상한. 안 죽는 조합이 걸려도 웨이브가 영원히 끝나지는 않게 한다.
// 여기 걸리면 남은 상단 몹은 기지에 닿은 것으로, 하단 몹은 물러난 것으로 친다.
const WAVE_CLEANUP_MAX = 90;

// 10층마다 관문 — 물량이 줄고 대형·보스가 몰려온다. 조합이 안 맞으면 여기서 막힌다.
function isGateTier(tier) { return tier > 0 && tier % 10 === 0; }

// ─── 🐲 중간보스 — 10층마다 한 마리 ──────────────────────────────────────────
// 관문은 "물량이 줄고 대형이 몰려오는 층"이었을 뿐, 그 층을 **기억하게 만드는 것**이
// 없었다. 100층 마왕 하나만으로는 90층을 내려가는 동안 목표가 너무 멀다.
// 그래서 10·20…90층에 중간보스를 세운다.
//
// 핵심은 **어느 쪽에서 나오는가**다. 상단이면 타워와 과부하를, 하단이면 부대와
// 영웅 배치를 고민해야 한다. 층에 들어가기 전에 미리 알려 주므로, 그 한 층을
// 위해 무엇을 사고 영웅을 어디에 둘지가 실제 판단이 된다.
// 층 번호와 런 시드로 정해지므로 판마다 배치가 달라지되, 예고와 실제는 늘 같다.
const MIDBOSS_EVERY     = 10;
// 그 층 전체 체력의 이만큼을 혼자 진다.
//
// 한때 0.62까지 올렸다. 중간보스도 전면 보스전이라 그 층에 한 마리뿐이던 시절의
// 값이다. 지금은 다시 **잡몹과 함께** 오므로 그만한 몫이면 층이 통째로 벽이 된다.
// 예전 0.20보다는 조금 무겁게(0.30) — '조금 더 체력이 많은 한 마리'가 되도록.
const MIDBOSS_HP_SHARE  = 0.30;
// 하단은 잡몹 기준이 낮아 따로 곱한다. 다시 잡몹과 섞여 나오므로 15.0에서 되돌린다.
const MIDBOSS_ARENA_MULT= 10.0;

// 이 층에 중간보스가 있는가 — 100층(마왕)과 겹치지 않는다
function isMidBossTier(tier) {
  if (!(tier > 0 && tier % MIDBOSS_EVERY === 0)) return false;
  return tier !== ABYSS_FINAL_FLOOR;
}
function isMidBossFloor(gsp, waveIndex) {
  if (!gsp || gsp.mode !== 'endless') return false;
  return isMidBossTier(endlessTier(waveIndex));
}
// 'defense'(상단) | 'arena'(하단) — 층과 시드로 정해진다
function midBossSide(tier) {
  return endlessRand(tier, 917) < 0.5 ? 'defense' : 'arena';
}
function midBossName(tier) {
  const names = ['둔중한 파수꾼', '피에 젖은 우두머리', '깨진 뿔의 군장', '잿빛 포식자',
                 '무쇠 턱', '심연의 감시자', '뒤틀린 거인', '재의 군주', '뼈의 왕'];
  return names[Math.max(0, Math.floor(tier / MIDBOSS_EVERY) - 1) % names.length];
}
// 중간보스 체력 — 그 층 전체 체력에 걸어 둔다. 곡선을 나중에 고쳐도 같이 따라온다.
function midBossHp(tier, nightmare) {
  const base = floorTotalHp(tier) * MIDBOSS_HP_SHARE;
  return Math.max(200, Math.round(base * (1 + (nightmare || 0) * NIGHTMARE_BOSS_HP_STEP)));
}

// ─── 층 생성 ─────────────────────────────────────────────────────────────────
let _endlessDefCache = new Map();
let _endlessCacheSeed = null;
function endlessWaveDef(tier) {
  const sd = runSeed();
  if (_endlessCacheSeed !== sd) { _endlessDefCache = new Map(); _endlessCacheSeed = sd; }
  if (_endlessDefCache.has(tier)) return _endlessDefCache.get(tier);

  const gate = isGateTier(tier);
  const mods = { airW:1, largeW:1, armor:0, spd:1, count:1, hp:1, elite:0, arena:1,
                 regen:0, thorns:0, split:0, volatile:0 };
  const affixes = affixesFor(tier);
  for (const a of affixes) a.apply(mods);
  if (gate) { mods.largeW *= 2.0; mods.count *= 0.72; mods.hp *= 1.30; }

  // 상단 구성 — 해금된 적에 가중치를 매기고 상위 4종을 쓴다
  const unlocked = ENDLESS_DEF_UNLOCK.filter(u => tier >= u.tier);
  const weighted = unlocked.map((u, i) => {
    const tpl = ENEMY_TYPES[u.type] || {};
    const age = tier - u.tier;
    // 갓 나온 적일수록 비중이 크고, 오래되면 줄지만 0이 되지는 않는다
    let w = Math.max(0.22, 1.55 - age * 0.035);
    if (tpl.flying)        w *= mods.airW;
    if (tpl.cls === 'large') w *= mods.largeW;
    w *= 0.85 + endlessRand(tier, 40 + i) * 0.45;   // 층마다 조금씩 흔든다
    return { type: u.type, w, tpl };
  }).sort((a, b) => b.w - a.w).slice(0, 4);

  // 하늘 비중 상한 — 60층에서 69%, 80층에서 HP의 85%가 비행이던 적이 있다.
  // 대공은 저격·번개 두 종류로만 제대로 잡히니, 한 층이 사실상 전부 비행이 되면
  // 그 층은 "배치를 잘못했다"가 아니라 "그 두 타워를 안 열었으면 끝"이 된다.
  // 종류를 지우지는 않고 비중만 눌러, 하늘은 늘 있되 하늘만 오지는 않게 한다.
  const AIR_SHARE_CAP = 0.45;
  const airW = weighted.reduce((a, x) => a + (x.tpl.flying ? x.w : 0), 0);
  const allW = weighted.reduce((a, x) => a + x.w, 0) || 1;
  if (airW / allW > AIR_SHARE_CAP) {
    const groundW = allW - airW;
    // 지상이 아예 없으면 누를 곳이 없다 — 그때는 그대로 둔다
    if (groundW > 0) {
      const want = groundW * AIR_SHARE_CAP / (1 - AIR_SHARE_CAP);
      const k = want / airW;
      for (const x of weighted) if (x.tpl.flying) x.w *= k;
    }
  }

  const wSum = weighted.reduce((a, x) => a + x.w, 0) || 1;
  // 층당 총 마릿수 — 완만하게 늘되 밀도(간격)가 실제 압력을 만든다
  const totalCount = Math.round((10 + tier * 0.85) * mods.count);

  const defenseEnemies = weighted.map(x => {
    const share = x.w / wSum;
    const count = Math.max(1, Math.round(totalCount * share));
    // 무거운 적일수록 간격을 넓게 — 60초 안에 다 나오도록 맞춘다
    const spread = (x.tpl.cls === 'large') ? 3.2 : (x.tpl.flying ? 1.4 : 1.0);
    const interval = Math.max(280, Math.round((52000 / Math.max(1, count)) * spread * 0.42));
    return { type: x.type, count, interval };
  });

  // 아레나 풀 — 상단과 같은 방식이되 종류를 더 섞는다
  const aUnlocked = ENDLESS_ARENA_UNLOCK.filter(u => tier >= u.tier);
  const arenaPool = aUnlocked.map((u, i) => {
    const age = tier - u.tier;
    let w = Math.max(1, Math.round((14 - age * 0.35) * (0.8 + endlessRand(tier, 70 + i) * 0.5)));
    return [u.type, w];
  }).slice(-5);

  const def = {
    tier, gate, affixes,
    defenseEnemies,
    arenaPool,
    eliteBonus: tier * ENDLESS_ELITE_STEP + mods.elite,
    spawnMult:  Math.pow(ENDLESS_ARENA_TIGHTEN, tier - 1) * mods.arena,
    armorBonus: mods.armor,
    spdBonus:   mods.spd,
    hpBonus:    mods.hp,
    // 심층 변형 — 배율이 아니라 행동을 바꾼다
    regen:    mods.regen,
    thorns:   mods.thorns,
    split:    mods.split,
    volatile: mods.volatile
  };
  _endlessDefCache.set(tier, def);
  return def;
}

function waveDefFor(waveIndex) {
  if (isEndlessRun()) return endlessWaveDef((waveIndex || 0) + 1);
  return WAVE_DEFS[Math.min(waveIndex || 0, WAVE_DEFS.length - 1)];
}
// 층 변형이 개별 적 스탯에 얹는 값 — defense.js가 읽는다
function endlessMods(waveIndex) {
  if (!isEndlessRun()) return null;
  return endlessWaveDef((waveIndex || 0) + 1);
}

function getStageInfo(waveIndex) {
  const t = endlessTier(waveIndex);
  if (t > 0) {
    return { stageIdx: 9, waveInStage: 0, stageLabel: `${t}층`,
             isBossStage: isGateTier(t), endless: true, tier: t };
  }
  const stageIdx = Math.floor(waveIndex / 3);
  const waveInStage = waveIndex % 3;
  const isBossStage = stageIdx === 9;
  return { stageIdx, waveInStage, stageLabel: `1-${stageIdx+1}`, isBossStage, endless: false, tier: 0 };
}

// ─── 🗿 몬스터 케이브 ────────────────────────────────────────────────────────
// 예전에는 다섯 칸짜리 사다리(CAVE_LEVELS)에 버튼 하나였다. 이제 건물이라
// 갱도 심화·정예 소굴 같은 트랙으로 나뉘어 js/town.js에 있다.
// 여기 남는 것은 케이브 레벨의 이름표뿐 — 마을 카드와 상태 바에 쓴다.
const CAVE_LABELS = ['자연 동굴','다듬은 갱도','강화 동굴','위험 동굴','깊은 갱도',
                     '심연 동굴','흉험한 소굴','지옥 동굴','폐허의 심장','마경','끝없는 굴'];
function caveLabel(lv) { return CAVE_LABELS[Math.max(0, Math.min(CAVE_LABELS.length-1, lv|0))]; }
// 보석 정산에서 처치 몇 마리를 1보석으로 칠 것인가
const GEM_KILLS_PER = 100;
// 정예 확률 상한 — 이 위로는 아무리 쌓아도 오르지 않는다
const ELITE_CHANCE_CAP = 0.55;
// 케이브 레벨은 이제 따로 세지 않는다 — 건물 레벨이 곧 케이브 레벨이다.
// 짓지 않았으면 0. 예전에는 새 판에서도 최소 1이라, 한 층도 못 넘긴 판이
// 이 항 하나로 보석 1개를 받아 갔다.
function caveLevelOf(state) {
  const bs = state && state.town && state.town.buildings && state.town.buildings.cave;
  return (bs && bs.built) ? (bs.level || 0) + 1 : 0;
}
// ─── 현상수배 몹 ─────────────────────────────────────────────────────────────
// 준비 단계에서 플레이어가 직접 불러오는 강한 적. 잡으면 보석, 놓치면 큰 피해.
// 스테이지당 한 번씩 기회가 생기고, 부를수록 강해지며 보상도 조금씩 오른다.
// 보석 수급을 플레이어가 조절할 수 있게 하되, 실력 없이는 못 가져가게 만든다.
const BOUNTY_HP_ESCALATION = 0.85;   // 소환 1회당 HP +85%
const BOUNTY_SPAWN_DELAY   = 8;      // 웨이브 시작 후 등장까지(초)
function bountyCharges(waveIndex) { return Math.floor((waveIndex || 0) / 3) + 1; }
function bountyHp(n, waveIndex) {
  return Math.round(ENEMY_TYPES.bounty.hp * (1 + (n || 0) * BOUNTY_HP_ESCALATION)
                    * (1 + (waveIndex || 0) * DEF_WAVE_HP_SCALE) * GRID_ROW_HP_COMP);
}
// 보석 획득 경로가 상단 현상수배 + 하단 정예 둘이 됐다.
// 둘 다 예전 값을 그대로 주면 보석이 두 배로 들어오므로, 한 마리당 값을 낮춘다.
function bountyGems(n)  { return 1 + Math.floor((n || 0) / 3); }   // 1,1,1,2,2,2,3…
function bountyGold(n, waveIndex) {
  return Math.round(ENEMY_TYPES.bounty.reward * (1 + (n || 0) * 0.5) * (1 + (waveIndex || 0) * 0.05));
}

// ─── 하단 정예 소환 ──────────────────────────────────────────────────────────
// 상단의 현상수배와 짝을 이루는 하단판.
// 상단은 "경로를 막을 화력이 있는가"를 묻고, 하단은 "부대가 정면으로 이겨낼 수 있는가"를 묻는다.
// 놓쳤을 때의 대가도 다르다 — 상단은 성벽이 깎이고, 하단은 부대가 죽는다.
const ELITE_HP_ESCALATION   = 0.80;   // 소환 1회당 HP +80%
const ELITE_SPAWN_DELAY     = 6;      // 웨이브 시작 후 등장까지(초)
const ELITE_STAT_BONUS      = 6.0;    // 같은 층 일반 몹 대비 배율
const ELITE_MIN_HP          = 200;    // 1층 고블린이 뻥튀기돼도 벽처럼 느껴질 최소치
// 🏹사냥 허가증(케이브) 한 장에 기회가 한 번씩 더 늘어난다
function eliteCharges(waveIndex) {
  return Math.floor((waveIndex || 0) / 4) + 1 + Math.round(BONUSES.eliteChargeBonus || 0);
}
function eliteGems(n)   { return 1 + Math.floor((n || 0) / 3); }
function eliteGoldMult(n) { return 6 + (n || 0) * 1.5; }

// ─── 상단 개입 수단 ──────────────────────────────────────────────────────────
// 웨이브가 시작되면 상단은 손댈 곳이 없었다. 배치형은 유지하되
// 웨이브 중에 쓸 수 있는 카드 하나를 준다.
const OVERLOAD_DURATION = 5;    // 과부하 지속(초)
const OVERLOAD_COOLDOWN = 20;   // 재사용 대기(초)
const OVERLOAD_SPD_MULT = 3;    // 공격속도 배율
const HERO_DEF_MOVE_SPD = 105;  // 상단 영웅 이동속도(px/s)
// 👑 영웅과 겹친 적은 느려진다 — 상단에 세우는 것이 "몸으로 막는" 선택이 되도록
const HERO_BLOCK_SLOW      = 0.45;  // 이동속도 배율
const HERO_BLOCK_SLOW_DUR  = 0.35;  // 겹침이 끊겨도 이만큼은 남는다(초)
// 붙어 있는 적이 영웅을 때리는 주기와, 동시에 때릴 수 있는 마릿수.
// 상단은 아레나처럼 개체마다 공격 주기를 굴리지 않으므로 여기서 한 번에 정한다.
const HERO_TOUCH_PERIOD    = 1.0;   // 초
const HERO_TOUCH_MAX       = 6;     // 둘러쌀 수 있는 자리는 유한하다

// 몹 강화 곡선.
// v1.0에서는 "처치 1회마다 +8%"였다. 한 웨이브에 10마리쯤 잡던 그룹 전투에서는
// 1.8배로 끝났지만, 아레나는 한 웨이브에 45~70마리가 나온다 — 같은 계수면
// 웨이브 후반 고블린이 4.6배가 되어 어떤 편성으로도 따라잡을 수 없다.
// 난이도 상승은 웨이브 인덱스(등급·물량)가 맡고, 처치 항은 보조로만 남긴다.
const WAVE_STAT_SCALE = 0.07;   // 웨이브 1당 몹 스탯 +7%
const KILL_SCALE      = 0.006;  // 처치 1회당 +0.6% (웨이브 내 완만한 가속)
const WAVE_GOLD_SCALE = 0.045;  // 웨이브 1당 보상 +4.5%


// 웨이브 종료 후 생존 병력이 회복하는 최대 HP 비율
const REST_HEAL_PCT    = 0.16;   // 웨이브 사이 무상 회복. 나머지는 🏨여관에서 산다

const WAVE_DURATION    = 60;
const INTERMISSION     = 15;
const BASE_HP_MAX      = 100;
// ─── 영웅 전사 ───────────────────────────────────────────────────────────────
// 20초 뒤 만피로 부활하던 시절에는 영웅이 죽는 것에 아무 대가가 없었다 —
// 오히려 위험한 자리에 밀어넣고 죽으면 기다리는 쪽이 편했다.
// 이제 쓰러진 층은 물론 다음 층까지 영웅 없이 치러야 하고, 돌아올 때도 만피가 아니다.
const HERO_DOWN_FLOORS  = 1;     // 쓰러진 층 다음으로 결장하는 층 수
const HERO_RETURN_HP    = 0.40;  // 복귀 시 최대 HP 비율 (구원의 손으로 올린다)
const HERO_RETURN_HP_PER = 0.05; // 구원의 손 1단계당 +5%p

// v1.0의 틱 전투 상수(TICK_INTERVAL · SKILL_TICK_CD · MP_REGEN_TICK)는 폐기됐다.
// 실시간 전투에서는 유닛마다 atkPeriod / skillCd(초)를 직접 쓴다.

// ─── 영웅 기본 스탯 ───────────────────────────────────────────────────────────
// 30웨이브 분량에 맞춰 Lv.10까지 확장
// ─── 👑 영웅 레벨 ────────────────────────────────────────────────────────────
// v12.9에서 10 → 99. 열 판이면 끝나는 성장은 무한 모드의 길이와 맞지 않았다.
//
// 경험치 곡선은 **10레벨이 한 마디**다. 한 마디 안(예: 11~19)에서는 필요 경험치가
// 고르게 오르다가, 마디를 넘는 순간(11·21·31…)에 한 번 크게 뛴다. 그래서
// "이번 마디는 금방 오르는데 다음 마디로 넘어가는 그 한 칸이 무겁다"가 된다 —
// 밋밋한 지수 곡선보다 어디쯤 왔는지가 손에 잡힌다.
const HERO_MAX_LEVEL   = 99;
const HERO_BAND        = 10;     // 이 레벨마다 한 마디
// 마디를 넘을 때 뛰는 배수. 마디 안에서 9칸이 오르므로(1 + 9×STEP = 1.54),
// 이 값이 그보다 커야 11·21·31레벨에서 실제로 **뛴다**. 처음엔 2.35에 STEP 0.16을
// 뒀다가 마디 끝(2.44)이 다음 마디 시작(2.35)보다 커져 요구치가 되레 내려갔다.
const HERO_BAND_JUMP   = 2.60;
const HERO_STEP_IN_BAND= 0.06;   // 마디 안에서 한 레벨당 완만한 증가

// 레벨 L → 다음 레벨까지 필요한 경험치
function heroExpNeeded(L) {
  if (L >= HERO_MAX_LEVEL) return Infinity;
  const band  = Math.floor((L - 1) / HERO_BAND);          // 0,0..0,1,1..
  const inBand= (L - 1) % HERO_BAND;
  return Math.round(30 * Math.pow(HERO_BAND_JUMP, band) * (1 + inBand * HERO_STEP_IN_BAND));
}
// 레벨 L의 스탯 — 마디마다 한 단씩 굵어진다
function heroStatsAt(L) {
  const lv = Math.max(1, Math.min(HERO_MAX_LEVEL, L));
  const t  = lv - 1;
  return {
    atk:  Math.round(15 * Math.pow(1.055, t) + t * 1.6),
    hp:   Math.round(80 * Math.pow(1.048, t) + t * 5),
    def:  Math.round(5  * Math.pow(1.042, t) + t * 0.55),
    range: CELL_W * (3.0 + Math.min(2.6, t * 0.035)),
    expNeeded: heroExpNeeded(lv)
  };
}
// 예전 코드가 HERO_LEVELS[lv]로 바로 읽으므로 표를 만들어 둔다 (인덱스 0은 안 쓴다)
const HERO_LEVELS = (() => {
  const out = [null];
  for (let L = 1; L <= HERO_MAX_LEVEL; L++) out.push(heroStatsAt(L));
  return out;
})();

// ─── 게임 속도 ────────────────────────────────────────────────────────────────
// 배속. 캠프 강화가 쌓이면 초반 층은 타워 두 개로도 밀리므로,
// "안 지는 판"을 앉아서 기다리는 시간이 진짜 비용이 된다.
// 루프가 dt를 키우지 않고 update()를 N번 도는 방식이라 10배속에서도
// 충돌·투사체가 건너뛰지 않는다 — 정수만 쓸 수 있는 이유이기도 하다.
const SPEED_STEPS = [1, 2, 3, 5, 10];

// 타워 이설 — 경로가 바뀌면 잘 세워둔 배치가 통째로 어긋난다.
// 판매 후 재건설(회수 60%)보다 싸되 공짜는 아니게, 투자액에 비례해 받는다.
const TOWER_MOVE_PCT  = 0.15;
const TOWER_MOVE_MIN  = 4;
const TOWER_SWAP_MULT = 2;      // 타워끼리 맞바꾸면 두 배 — 둘 다 옮기는 것이므로
function towerMoveCost(t) {
  if (!t) return 0;
  const inv = t.invested || TOWER_TYPES[t.typeId].cost;
  return Math.max(TOWER_MOVE_MIN, Math.round(inv * TOWER_MOVE_PCT));
}
// 맞바꾸면 둘 다 옮기는 것이므로 둘의 이설비를 더한다 —
// 같은 값의 타워끼리라면 정확히 한 번 옮기는 값의 두 배가 된다.
function towerSwapCost(a, b) {
  return b ? towerMoveCost(a) + towerMoveCost(b)
           : towerMoveCost(a) * TOWER_SWAP_MULT;
}

const COLORS = {
  defenseBg:  '#0f172a',
  defenseGrid:'#1e293b',
  pathCell:   '#0e1e0e',
  uiBar:      '#0f0f1a',
  battleBg:   '#0d1117',
  hpGreen:    '#22c55e',
  hpYellow:   '#eab308',
  hpRed:      '#ef4444',
  gold:       '#fbbf24',
  text:       '#e2e8f0',
  textDim:    '#64748b',
  accent:     '#6366f1',
  mp:         '#3b82f6',
  shield:     '#38bdf8',
  hero:       '#f59e0b'
};
