'use strict';

// ─── Canvas / Layout ────────────────────────────────────────────────────────
const CW = 480;
const CH = 800;

const DEFENSE_Y  = 0;
const DEFENSE_H  = 355;
const UIBAR_Y    = 355;
const UIBAR_H    = 55;
const BATTLE_Y   = 410;
const BATTLE_H   = 390;

// ─── Defense Grid ────────────────────────────────────────────────────────────
const GRID_COLS = 9;
const GRID_ROWS = 7;
const CELL_W = Math.floor(CW / GRID_COLS);
const CELL_H = Math.floor(DEFENSE_H / GRID_ROWS);
const GRID_OX = Math.floor((CW - GRID_COLS * CELL_W) / 2);
const GRID_OY = 5;

// ─── ∞ 경로 (단일) ───────────────────────────────────────────────────────────
const THE_PATH = [
  [4,0],[4,1],
  [3,1],[2,1],[1,1],
  [1,2],[1,3],[1,4],
  [2,4],[3,4],[4,4],
  [4,3],[4,2],[4,1],
  [5,1],[6,1],[7,1],
  [7,2],[7,3],[7,4],
  [6,4],[5,4],[4,4],
  [4,5],[4,6]
];
const PATH_CELLS = new Set(THE_PATH.map(([c,r]) => `${c},${r}`));

function cellCenter(col, row) {
  return {
    x: GRID_OX + col * CELL_W + CELL_W / 2,
    y: GRID_OY + row * CELL_H + CELL_H / 2
  };
}

// 타워를 세울 수 없는 칸 (경로 + 출발/기지)
function isBlockedCell(c, r) {
  if (PATH_CELLS.has(`${c},${r}`)) return true;
  if (c === 4 && (r === 0 || r === 6)) return true;
  return false;
}

// ─── Tower Types ─────────────────────────────────────────────────────────────
const TOWER_TYPES = {
  arrow: {
    id:'arrow', name:'화살탑', cost:5,
    dmg:2, spd:1.0, range: CELL_W * 2.4,
    color:'#22c55e', projColor:'#fbbf24', icon:'🏹',
    desc:'저렴한 단일 연사'
  },
  frost: {
    id:'frost', name:'서리탑', cost:12,
    dmg:1, spd:0.9, range: CELL_W * 2.2,
    slow: 0.45, slowDur: 1.6,
    color:'#38bdf8', projColor:'#7dd3fc', icon:'❄️',
    desc:'이동속도 45% 감속'
  },
  cannon: {
    id:'cannon', name:'대포탑', cost:18,
    dmg:8, spd:0.5, range: CELL_W * 2.0,
    splash: 40,
    color:'#f97316', projColor:'#fb923c', icon:'💣',
    desc:'착탄 지점 범위 피해'
  },
  sniper: {
    id:'sniper', name:'저격탑', cost:26,
    dmg:18, spd:0.35, range: CELL_W * 5.0,
    pierceArmor: true, targetMode:'strongest',
    color:'#e879f9', projColor:'#f0abfc', icon:'🎯',
    desc:'초장거리·방어 무시'
  }
};
const TOWER_ORDER = ['arrow', 'frost', 'cannon', 'sniper'];

// ─── 해금 (로비에서 보석으로 영구 개방) ──────────────────────────────────────
// 처음부터 열려 있는 것은 화살탑 · 궁수 · 검사뿐이다.
// 나머지는 런을 돌며 모은 보석으로 하나씩 연다 — 로그라이트의 주 진행축.
const UNLOCK_DEFS = [
  { id:'frost',    kind:'tower', cost:4,  name:'서리탑',   icon:'❄️',  desc:'이동속도 45% 감속' },
  { id:'healer',   kind:'unit',  cost:5,  name:'치유사',   icon:'✚',   desc:'주변 아군 회복' },
  { id:'cannon',   kind:'tower', cost:8,  name:'대포탑',   icon:'💣',  desc:'착탄 범위 피해' },
  { id:'guardian', kind:'unit',  cost:9,  name:'방패병',   icon:'🛡️', desc:'전방 방벽 · 도발' },
  { id:'mage',     kind:'unit',  cost:12, name:'마법사',   icon:'✨',  desc:'자기 중심 광역' },
  { id:'sniper',   kind:'tower', cost:14, name:'저격탑',   icon:'🎯',  desc:'초장거리 · 방어 무시' },
];
const UNLOCK_TOTAL_COST = UNLOCK_DEFS.reduce((a, u) => a + u.cost, 0);
const INITIAL_UNLOCKED  = ['arrow', 'archer', 'swordsman'];

// ─── 서약 (난이도를 스스로 올리고 보석 배율을 받는다) ────────────────────────
const PACT_DEFS = [
  { id:'pc_hp',    name:'거친 침입자', icon:'💢', gem:0.12, desc:'상단 적 HP +25%',              apply:b=>{ b.pactDefHpMult   *= 1.25; } },
  { id:'pc_spawn', name:'굶주린 무리', icon:'🌑', gem:0.15, desc:'아레나 스폰 간격 −15%',        apply:b=>{ b.pactSpawnMult   *= 0.85; } },
  { id:'pc_wall',  name:'얇은 성벽',   icon:'🧱', gem:0.12, desc:'기지 최대 HP −20',             apply:b=>{ b.baseHpMax       -= 20;   } },
  { id:'pc_purse', name:'빈 주머니',   icon:'👛', gem:0.18, desc:'시작 골드 −5 · 골드 획득 −10%', apply:b=>{ b.startGoldBonus -= 5; b.battleGoldMult *= 0.9; b.defenseGoldMult *= 0.9; } },
  { id:'pc_rest',  name:'짧은 휴식',   icon:'😴', gem:0.10, desc:'웨이브 후 회복 30% → 10%',     apply:b=>{ b.restHealBonus   -= 0.20; } },
  { id:'pc_solo',  name:'고독한 지휘', icon:'🕯️', gem:0.20, desc:'편성 슬롯 −1',                apply:b=>{ b.maxSlotBonus    -= 1;    } },
];

// 타워 레벨 1~3 배율
const TOWER_MAX_LEVEL = 3;
const TOWER_LEVEL_MULT = [
  null,
  { dmg:1.00, spd:1.00, range:1.00 },
  { dmg:1.70, spd:1.15, range:1.12 },
  { dmg:2.60, spd:1.30, range:1.25 }
];
// 같은 종류를 많이 지을수록 건설비가 오른다 — 도배 대신 배치를 고민하게 만든다
const TOWER_COST_ESCALATION = 0.28;
function towerBuildCost(typeId, towers) {
  const base = TOWER_TYPES[typeId].cost;
  const n = (towers || []).filter(t => t.typeId === typeId).length;
  return Math.max(1, Math.round(base * (1 + TOWER_COST_ESCALATION * n)) - BONUSES.towerCostDiscount);
}
function towerUpgradeCost(t) {
  if ((t.level || 1) >= TOWER_MAX_LEVEL) return null;
  return Math.max(1, Math.round(TOWER_TYPES[t.typeId].cost * 0.9 * (t.level || 1)));
}
function towerSellValue(t) {
  return Math.max(1, Math.floor((t.invested || TOWER_TYPES[t.typeId].cost) * 0.6));
}

// ─── Defense Enemy Types ─────────────────────────────────────────────────────
const ENEMY_TYPES = {
  goblin: { id:'goblin', name:'고블린',   hp:14,  spd:1.10, dmg:2,  reward:3,  armor:0, color:'#4ade80', radius:9  },
  runner: { id:'runner', name:'늑대',     hp:12,  spd:2.30, dmg:2,  reward:5,  armor:0, color:'#fbbf24', radius:8  },
  orc:    { id:'orc',    name:'오크',     hp:40,  spd:0.70, dmg:6,  reward:8,  armor:1, color:'#818cf8', radius:13 },
  brute:  { id:'brute',  name:'강철오크', hp:95,  spd:0.50, dmg:12, reward:18, armor:3, color:'#94a3b8', radius:15 },
  boss:   { id:'boss',   name:'던전보스', hp:400, spd:0.40, dmg:20, reward:50, armor:5, color:'#ef4444', radius:20 }
};
const ENEMY_CELL_SPD = CELL_W;
// 웨이브가 오를수록 상단 적도 강해진다
const DEF_WAVE_HP_SCALE    = 0.22;
const DEF_WAVE_ARMOR_EVERY = 5;
const DEF_WAVE_COUNT_SCALE = 0.07;

// ─── 하단 아레나 레이아웃 ─────────────────────────────────────────────────────
// 410 ┌ 상태 바 28 ┐ 438 ┌ 아레나 330 ┐ 768 ┌ 컨트롤 바 32 ┐ 800
const ARENA_STATUS_H = 28;
const ARENA_CTRL_H   = 32;
const ARENA_X = 0;
const ARENA_Y = BATTLE_Y + ARENA_STATUS_H;
const ARENA_W = CW;
const ARENA_H = BATTLE_H - ARENA_STATUS_H - ARENA_CTRL_H;   // 330

const ARENA_MAX_MOBS      = 28;    // 동시 생존 상한 — 가독성 + 성능
const ARENA_SPAWN_BAND    = 26;    // 가장자리 스폰 밴드 두께
const SPAWN_BASE_INTERVAL = 1.6;   // 초. 경과에 따라 짧아진다
const SPAWN_RAMP          = 0.03;  // 간격 = base / (1 + 경과초 × RAMP)
const SPAWN_SAFE_RADIUS   = 120;   // 아군 부대 중심에서 이 반경 안에는 스폰 금지
const DROP_PICKUP_RADIUS  = 40;    // 아군이 이 반경에 들어와야 드랍 획득
const DROP_LIFETIME       = 8;     // 초
const DROP_SCATTER_MIN    = 24;    // 처치 지점에서 튀어나가는 최소 거리
const DROP_SCATTER_MAX    = 66;    // 최대 거리 — 수거 반경(40)보다 넓어야 이동에 값이 생긴다
const FORMATION_RADIUS    = 30;    // 집결 지점 기준 대형 반경
const AUTO_ADVANCE_PCT    = 0.40;  // 자동 모드에서 사거리 밖 적에게 접근하는 속도 비율
const SEPARATION_FORCE    = 26;    // 개체가 서로 완전히 겹치지 않게 미는 힘

// 전투에서 벗어나면 회복한다. 틱 전투에서는 한 웨이브가 짧은 그룹전 3번이었지만
// 실시간에서는 60초 내내 노출되므로, 사거리 밖으로 빼는 행동에 값을 줘야 한다.
// 수동 조작(빼고 다시 붙이기)이 이득이 되는 것도 이 규칙 덕분이다.
const ARENA_REGEN_DELAY = 3.5;   // 마지막 피격 후 이 시간이 지나야 회복 시작
const ARENA_REGEN_PCT   = 0.045; // 초당 최대 HP 비율

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
const UNIT_TYPES = {
  swordsman: {
    id:'swordsman', name:'검사',   cost:8,
    hp:105, atk:12, def:3, atkPeriod:0.90, range:26, moveSpd:85, radius:7.5,
    skillName:'회전 베기', skillKind:'spin', skillAtk:28, skillCd:6, skillRadius:52, skillColor:'#f59e0b',
    color:'#60a5fa', icon:'⚔️', role:'균형 잡힌 근접 딜러'
  },
  archer: {
    id:'archer',    name:'궁수',   cost:6,
    hp:70, atk:10, def:1, atkPeriod:0.75, range:130, moveSpd:90, radius:7.5, ranged:true,
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
    hp:210, atk:7,  def:9, atkPeriod:1.10, range:24, moveSpd:70, radius:9, isTank:true,
    skillName:'방벽', skillKind:'bulwark', skillAtk:0, skillCd:8, skillRadius:110, shieldAmt:22, skillColor:'#38bdf8',
    color:'#38bdf8', icon:'🛡️', role:'앞에 서서 맞고 도발'
  },
  mage: {
    id:'mage',      name:'마법사', cost:16,
    hp:80, atk:9,  def:1, atkPeriod:1.00, range:110, moveSpd:82, radius:7.5, ranged:true,
    skillName:'화염 폭발', skillKind:'nova', skillAtk:22, skillCd:7, skillRadius:78, skillColor:'#f97316',
    color:'#f97316', icon:'✨', role:'뭉친 적에게 광역'
  }
};
const UNIT_ORDER = ['archer', 'swordsman', 'healer', 'guardian', 'mage'];

const HERO_ARENA = {
  atkPeriod:0.80, range:34, moveSpd:95, radius:9,
  skillName:'영웅 일격', skillKind:'cleave', skillCd:6, skillRadius:60, skillMult:2.2, skillColor:'#fbbf24'
};

// ─── 아레나 몬스터 ───────────────────────────────────────────────────────────
// behavior: 'charge' 최근접 아군 직진 · 'kite' 거리 유지 원거리 · 'dash' 주기적 돌진
// 이속은 아군 최고(95)보다 느려야 카이팅이 성립한다 — 광견(135)만 예외.
const BATTLE_MOB_TYPES = {
  goblin:   { id:'goblin',   name:'고블린',   hp:30,  atk:8,  def:1,  atkPeriod:1.0, range:20,  moveSpd:70,  radius:6,  goldReward:8,   color:'#4ade80', icon:'👺', behavior:'charge' },
  hound:    { id:'hound',    name:'광견',     hp:22,  atk:6,  def:0,  atkPeriod:0.7, range:18,  moveSpd:135, radius:6,  goldReward:12,  color:'#f472b6', icon:'🐺', behavior:'charge' },
  orc:      { id:'orc',      name:'오크',     hp:80,  atk:15, def:4,  atkPeriod:1.2, range:22,  moveSpd:55,  radius:8,  goldReward:20,  color:'#818cf8', icon:'👹', behavior:'charge' },
  darkarch: { id:'darkarch', name:'다크아처', hp:45,  atk:12, def:2,  atkPeriod:1.4, range:140, moveSpd:60,  radius:7,  goldReward:24,  color:'#c084fc', icon:'🏹', behavior:'kite', ranged:true },
  ogre:     { id:'ogre',     name:'오우거',   hp:150, atk:22, def:6,  atkPeriod:1.6, range:26,  moveSpd:45,  radius:10, goldReward:38,  color:'#a16207', icon:'🧌', behavior:'charge' },
  boss:     { id:'boss',     name:'보스',     hp:200, atk:25, def:8,  atkPeriod:1.5, range:30,  moveSpd:40,  radius:11, goldReward:60,  color:'#ef4444', icon:'💀', behavior:'dash',  isBoss:true },
  warlord:  { id:'warlord',  name:'마왕',     hp:520, atk:40, def:14, atkPeriod:1.8, range:34,  moveSpd:35,  radius:11, goldReward:180, color:'#db2777', icon:'🐲', behavior:'slam',  isBoss:true }
};

// 아군이 전멸하면 아레나에 남은 몬스터가 기지로 돌파해 초당 피해를 준다.
// 두 전선을 연결해, 하단에서 지는 것도 실제 패배로 이어지게 만든다.
const BREAKTHROUGH_DPS      = 0.03;  // 몹 공격력 1당 초당 기지 피해
const BREAKTHROUGH_MAX      = 1.8;   // 초당 상한 — 한 웨이브 전멸이 즉사가 되지 않도록
// v1.0에서는 2.5(전멸 1회당 37HP)였다. 그룹 전투에서 전멸은 예외였지만
// 아레나에서는 흔한 일이라, 전멸 3번이면 런이 끝나는 계산이 너무 가팔랐다.
// 1.8 = 전멸 1회당 최대 27HP → 네 번은 버틴다.
const BREAKTHROUGH_DURATION = 15;    // 돌파 지속(초). 이후 몬스터는 물러나고 상단만 남는다

// 엘리트: 케이브 업그레이드로 확률 상승. 스탯 강화 + 보상 증가
const ELITE_STAT_MULT = 1.8;
const ELITE_GOLD_MULT = 2.5;

// ─── 웨이브 정의 ─────────────────────────────────────────────────────────────
// defenseEnemies: 상단 스폰 큐 (변경 없음)
// arenaPool: 하단 아레나 스폰 풀 — [몹 id, 가중치] 목록에서 뽑아 리젠한다.
//            v1.0의 "그룹을 순서대로 격파"가 "어떤 몹이 어떤 비율로 나오는가"로 바뀌었다.
// 10 스테이지 × 3 웨이브 = 30 웨이브
const WAVE_DEFS = [
  // ── 1-1 : 고블린 입문 · 기본 조작 ────────────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:4,interval:2000}], arenaPool:[['goblin',10]] },
  { defenseEnemies:[{type:'goblin',count:5,interval:1800}], arenaPool:[['goblin',10]] },
  { defenseEnemies:[{type:'goblin',count:6,interval:1600}], arenaPool:[['goblin',10]] },
  // ── 1-2 : 광견 등장 · 수동 조작의 첫 필요 ────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:6,interval:1500},{type:'runner',count:2,interval:3000}], arenaPool:[['goblin',10],['hound',3]] },
  { defenseEnemies:[{type:'goblin',count:7,interval:1400},{type:'runner',count:3,interval:2600}], arenaPool:[['goblin',9],['hound',5]] },
  { defenseEnemies:[{type:'goblin',count:8,interval:1300},{type:'runner',count:4,interval:2400}], arenaPool:[['goblin',8],['hound',6]] },
  // ── 1-3 : 오크 · 체력 벽 ─────────────────────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:8,interval:1200},{type:'orc',count:2,interval:4000}], arenaPool:[['goblin',8],['hound',5],['orc',3]] },
  { defenseEnemies:[{type:'goblin',count:9,interval:1100},{type:'orc',count:3,interval:3500}], arenaPool:[['goblin',7],['hound',5],['orc',5]] },
  { defenseEnemies:[{type:'goblin',count:10,interval:1000},{type:'orc',count:3,interval:3200}], arenaPool:[['goblin',6],['hound',5],['orc',6]] },
  // ── 1-4 : 다크아처 · 접근 강제 ───────────────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:8,interval:1000},{type:'brute',count:1,interval:6000}], arenaPool:[['goblin',6],['hound',5],['orc',6],['darkarch',3]] },
  { defenseEnemies:[{type:'orc',count:4,interval:2500},{type:'brute',count:1,interval:6000}], arenaPool:[['goblin',5],['hound',5],['orc',6],['darkarch',4]] },
  { defenseEnemies:[{type:'orc',count:5,interval:2200},{type:'brute',count:2,interval:5000}], arenaPool:[['goblin',4],['hound',5],['orc',7],['darkarch',5]] },
  // ── 1-5 : 오우거 · 고타격 저속 ───────────────────────────────────────────
  { defenseEnemies:[{type:'runner',count:6,interval:1400},{type:'orc',count:3,interval:2200}], arenaPool:[['goblin',4],['hound',5],['orc',6],['darkarch',4],['ogre',2]] },
  { defenseEnemies:[{type:'orc',count:5,interval:2000},{type:'brute',count:2,interval:4500}], arenaPool:[['hound',5],['orc',6],['darkarch',4],['ogre',3]] },
  { defenseEnemies:[{type:'goblin',count:8,interval:800},{type:'brute',count:3,interval:4000}], arenaPool:[['hound',5],['orc',6],['darkarch',4],['ogre',4]] },
  // ── 1-6 : 보스 등장 · 돌진 패턴 ──────────────────────────────────────────
  { defenseEnemies:[{type:'orc',count:6,interval:1800},{type:'brute',count:2,interval:4000}], arenaPool:[['hound',5],['orc',6],['darkarch',4],['ogre',4],['boss',1]] },
  { defenseEnemies:[{type:'runner',count:8,interval:1100},{type:'orc',count:5,interval:1800}], arenaPool:[['hound',5],['orc',5],['darkarch',4],['ogre',5],['boss',1]] },
  { defenseEnemies:[{type:'orc',count:7,interval:1600},{type:'brute',count:3,interval:3600}], arenaPool:[['hound',4],['orc',5],['darkarch',4],['ogre',5],['boss',2]] },
  // ── 1-7 : 엘리트 확률 상승 · 단일 고위협 ─────────────────────────────────
  { defenseEnemies:[{type:'orc',count:7,interval:1500},{type:'brute',count:3,interval:3400}], arenaPool:[['hound',4],['orc',5],['darkarch',5],['ogre',5],['boss',2]], eliteBonus:0.10 },
  { defenseEnemies:[{type:'orc',count:8,interval:1400},{type:'runner',count:6,interval:1600}], arenaPool:[['hound',4],['orc',4],['darkarch',5],['ogre',6],['boss',3]], eliteBonus:0.12 },
  { defenseEnemies:[{type:'orc',count:9,interval:1300},{type:'brute',count:4,interval:3000}], arenaPool:[['hound',4],['orc',4],['darkarch',5],['ogre',6],['boss',3]], eliteBonus:0.14 },
  // ── 1-8 : 오우거 · 보스 혼합 · 복합 압력 ─────────────────────────────────
  { defenseEnemies:[{type:'orc',count:8,interval:1200},{type:'brute',count:4,interval:2800}], arenaPool:[['hound',3],['orc',4],['darkarch',5],['ogre',7],['boss',4]], eliteBonus:0.14 },
  { defenseEnemies:[{type:'brute',count:5,interval:2600},{type:'runner',count:8,interval:1000}], arenaPool:[['hound',3],['darkarch',5],['ogre',7],['boss',5]], eliteBonus:0.16 },
  { defenseEnemies:[{type:'brute',count:6,interval:2400},{type:'orc',count:6,interval:1600}], arenaPool:[['hound',3],['darkarch',4],['ogre',7],['boss',6]], eliteBonus:0.16 },
  // ── 1-9 : 마왕 · 상하단 모두 보스급 ──────────────────────────────────────
  { defenseEnemies:[{type:'brute',count:6,interval:2200},{type:'boss',count:1,interval:9000}], arenaPool:[['darkarch',4],['ogre',6],['boss',6],['warlord',1]], eliteBonus:0.18 },
  { defenseEnemies:[{type:'brute',count:7,interval:2000},{type:'boss',count:1,interval:8000}], arenaPool:[['darkarch',4],['ogre',5],['boss',7],['warlord',2]], eliteBonus:0.18 },
  { defenseEnemies:[{type:'brute',count:8,interval:1800},{type:'boss',count:2,interval:6000}], arenaPool:[['darkarch',3],['ogre',5],['boss',8],['warlord',3]], eliteBonus:0.20 },
  // ── 1-10 : 최종 · 마왕 다수 + 최대 밀도 ──────────────────────────────────
  { defenseEnemies:[{type:'brute',count:8,interval:1600},{type:'boss',count:2,interval:5000}], arenaPool:[['ogre',4],['boss',8],['warlord',4]], eliteBonus:0.20, spawnMult:0.85 },
  { defenseEnemies:[{type:'brute',count:9,interval:1500},{type:'boss',count:3,interval:4500}], arenaPool:[['ogre',3],['boss',8],['warlord',6]], eliteBonus:0.22, spawnMult:0.80 },
  { defenseEnemies:[{type:'boss',count:5,interval:3500},{type:'brute',count:8,interval:1600}], arenaPool:[['ogre',2],['boss',7],['warlord',9]], eliteBonus:0.25, spawnMult:0.72 },
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

function getStageInfo(waveIndex) {
  const stageIdx = Math.floor(waveIndex / 3);
  const waveInStage = waveIndex % 3;
  const isBossStage = stageIdx === 9;
  return { stageIdx, waveInStage, stageLabel: `1-${stageIdx+1}`, isBossStage };
}

// ─── 케이브 업그레이드 ────────────────────────────────────────────────────────
// statMult: 몹 기본 스탯 배율, goldMult: 보상 배율, upgradeCost: 업그레이드 비용
const CAVE_LEVELS = [
  null,
  { label:'자연 동굴', statMult:1.0, goldMult:1.0, upgradeCost:  0 },
  { label:'강화 동굴', statMult:1.4, goldMult:1.5, upgradeCost: 45 },
  { label:'위험 동굴', statMult:1.9, goldMult:2.2, upgradeCost: 110 },
  { label:'심연 동굴', statMult:2.6, goldMult:3.2, upgradeCost: 240 },
  { label:'지옥 동굴', statMult:3.5, goldMult:4.5, upgradeCost: 480 }
];
const CAVE_MAX_LEVEL = CAVE_LEVELS.length - 1;

// 몹 강화 곡선.
// v1.0에서는 "처치 1회마다 +8%"였다. 한 웨이브에 10마리쯤 잡던 그룹 전투에서는
// 1.8배로 끝났지만, 아레나는 한 웨이브에 45~70마리가 나온다 — 같은 계수면
// 웨이브 후반 고블린이 4.6배가 되어 어떤 편성으로도 따라잡을 수 없다.
// 난이도 상승은 웨이브 인덱스(등급·물량)가 맡고, 처치 항은 보조로만 남긴다.
const WAVE_STAT_SCALE = 0.07;   // 웨이브 1당 몹 스탯 +7%
const KILL_SCALE      = 0.006;  // 처치 1회당 +0.6% (웨이브 내 완만한 가속)
const WAVE_GOLD_SCALE = 0.06;   // 웨이브 1당 보상 +6%

function mobStatScale(waveIndex, killCount) {
  return (1 + (waveIndex || 0) * WAVE_STAT_SCALE) * (1 + (killCount || 0) * KILL_SCALE);
}
function mobGoldScale(waveIndex, killCount) {
  return (1 + (waveIndex || 0) * WAVE_GOLD_SCALE) * (1 + (killCount || 0) * KILL_SCALE);
}

// 웨이브 종료 후 생존 병력이 회복하는 최대 HP 비율
const REST_HEAL_PCT    = 0.30;

const WAVE_DURATION    = 60;
const INTERMISSION     = 15;
const BASE_HP_MAX      = 100;
const HERO_REVIVE_TIME = 20;

// v1.0의 틱 전투 상수(TICK_INTERVAL · SKILL_TICK_CD · MP_REGEN_TICK)는 폐기됐다.
// 실시간 전투에서는 유닛마다 atkPeriod / skillCd(초)를 직접 쓴다.

// ─── 영웅 기본 스탯 ───────────────────────────────────────────────────────────
// 30웨이브 분량에 맞춰 Lv.10까지 확장
const HERO_LEVELS = [
  //  atk, hp,  def, expNeeded, atkRange(px)
  null,                                                            // index 0 unused
  { atk:15,  hp:80,  def:5,  expNeeded:30,   range: CELL_W*3.0 },  // Lv.1
  { atk:18,  hp:90,  def:6,  expNeeded:70,   range: CELL_W*3.2 },  // Lv.2
  { atk:22,  hp:105, def:7,  expNeeded:130,  range: CELL_W*3.4 },  // Lv.3
  { atk:28,  hp:125, def:9,  expNeeded:220,  range: CELL_W*3.6 },  // Lv.4
  { atk:35,  hp:150, def:11, expNeeded:340,  range: CELL_W*4.0 },  // Lv.5
  { atk:44,  hp:180, def:13, expNeeded:500,  range: CELL_W*4.2 },  // Lv.6
  { atk:55,  hp:215, def:16, expNeeded:720,  range: CELL_W*4.4 },  // Lv.7
  { atk:68,  hp:255, def:19, expNeeded:1000, range: CELL_W*4.6 },  // Lv.8
  { atk:84,  hp:300, def:22, expNeeded:1400, range: CELL_W*4.8 },  // Lv.9
  { atk:105, hp:360, def:26, expNeeded:9999, range: CELL_W*5.2 }   // Lv.10
];
const HERO_MAX_LEVEL = HERO_LEVELS.length - 1;

// ─── 게임 속도 ────────────────────────────────────────────────────────────────
const SPEED_STEPS = [1, 2, 3];

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
