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

// ─── Battle Layout ────────────────────────────────────────────────────────────
const BATTLE_TEAM_X        = 110;   // 아군 x (렌더 기준)
const BATTLE_ENEMY_X       = 340;   // 적 전투 대기 x
const BATTLE_ENEMY_SPAWN_X = CW + 70; // 적 스폰 위치 (화면 밖)
const BATTLE_MARCH_SPD     = 90;    // 배경 스크롤 속도 (전진 연출)
const BATTLE_ENEMY_WALK_SPD = 180;  // 적 걸어오는 속도 px/s
const BATTLE_LOG_H         = 65;

// 한 줄에 세울 유닛 수에 맞춰 간격/반지름을 계산한다.
// 보스 그룹처럼 9마리가 몰려도 화면 밖으로 밀려나지 않는다.
let BATTLE_ROW_COUNT = 4;
let BATTLE_UNIT_GAP  = 64;
let BATTLE_UNIT_R    = 24;
let BATTLE_UNIT_TOP  = BATTLE_Y + 42;

function setBattleRowCount(n) {
  BATTLE_ROW_COUNT = Math.max(4, n || 4);
  const top = BATTLE_Y + 42;
  const bot = BATTLE_Y + BATTLE_H - BATTLE_LOG_H - 10;
  BATTLE_UNIT_TOP = top;
  BATTLE_UNIT_GAP = Math.min(64, (bot - top) / BATTLE_ROW_COUNT);
  BATTLE_UNIT_R   = Math.max(9, Math.min(24, BATTLE_UNIT_GAP * 0.36));
}
function unitY(idx) {
  return BATTLE_UNIT_TOP + BATTLE_UNIT_GAP * (idx + 0.5);
}
// 아군 슬롯과 적 그룹 중 큰 쪽에 맞춰 레이아웃을 잡는다
function syncBattleLayout(battle) {
  const our = battle ? battle.ourTeam.length : 0;
  const foe = battle ? battle.enemyTeam.length : 0;
  setBattleRowCount(Math.max(4, our, foe));
}
setBattleRowCount(4);

// ─── 아군 유닛 ───────────────────────────────────────────────────────────────
const UNIT_TYPES = {
  swordsman: {
    id:'swordsman', name:'검사',   cost:8,
    hp:60, atk:12, def:3, mp:30, maxMp:30,
    skillName:'강타', skillKind:'strike', skillAtk:28, skillCost:15, skillColor:'#f59e0b',
    color:'#60a5fa', icon:'⚔️', role:'균형 잡힌 근접 딜러'
  },
  archer: {
    id:'archer',    name:'궁수',   cost:6,
    hp:40, atk:10, def:1, mp:30, maxMp:30,
    skillName:'연사', skillKind:'multi', skillAtk:12, skillHits:3, skillCost:12, skillColor:'#a78bfa',
    color:'#a78bfa', icon:'🏹', role:'저렴한 다단 히트'
  },
  healer: {
    id:'healer',    name:'치유사', cost:10,
    hp:45, atk:5,  def:2, mp:40, maxMp:40,
    skillName:'치유', skillKind:'heal', skillAtk:0, skillCost:20, skillColor:'#34d399', healAmt:25,
    color:'#34d399', icon:'✚', role:'가장 다친 아군 회복'
  },
  guardian: {
    id:'guardian',  name:'방패병', cost:14,
    hp:120, atk:7,  def:9, mp:30, maxMp:30,
    skillName:'수호 방벽', skillKind:'shield', skillAtk:0, skillCost:16, skillColor:'#38bdf8', shieldAmt:22,
    color:'#38bdf8', icon:'🛡️', role:'적 표적을 끌고 전체 보호막'
  },
  mage: {
    id:'mage',      name:'마법사', cost:16,
    hp:45, atk:9,  def:1, mp:40, maxMp:40,
    skillName:'화염 폭발', skillKind:'aoe', skillAtk:22, skillCost:22, skillColor:'#f97316',
    color:'#f97316', icon:'✨', role:'적 전체 광역 피해'
  }
};
const UNIT_ORDER = ['archer', 'swordsman', 'healer', 'guardian', 'mage'];

// ─── 적 유닛 (하단 전투) ─────────────────────────────────────────────────────
const BATTLE_MOB_TYPES = {
  goblin:  { id:'goblin',  name:'고블린', hp:30,  atk:8,  def:1,  mp:20, maxMp:20, skillAtk:15, skillCost:10, color:'#4ade80', icon:'👺', goldReward:8   },
  orc:     { id:'orc',     name:'오크',   hp:80,  atk:15, def:4,  mp:20, maxMp:20, skillAtk:30, skillCost:15, color:'#818cf8', icon:'👹', goldReward:20  },
  ogre:    { id:'ogre',    name:'오우거', hp:150, atk:22, def:6,  mp:24, maxMp:24, skillAtk:42, skillCost:16, color:'#a16207', icon:'🧌', goldReward:38  },
  boss:    { id:'boss',    name:'보스',   hp:200, atk:25, def:8,  mp:30, maxMp:30, skillAtk:50, skillCost:20, color:'#ef4444', icon:'💀', goldReward:60,  isBoss:true },
  warlord: { id:'warlord', name:'마왕',   hp:520, atk:40, def:14, mp:36, maxMp:36, skillAtk:88, skillCost:22, color:'#db2777', icon:'🐲', goldReward:180, isBoss:true }
};
// 아군이 전멸하면 남은 몬스터가 기지로 돌파해 초당 피해를 준다.
// 두 전선을 연결해, 하단에서 지는 것도 실제 패배로 이어지게 만든다.
const BREAKTHROUGH_DPS = 0.03;   // 몹 공격력 1당 초당 기지 피해
const BREAKTHROUGH_MAX = 2.5;    // 초당 상한 — 한 웨이브 전멸이 즉사가 되지 않도록

// 엘리트: 케이브 업그레이드로 확률 상승. 스탯 강화 + 보상 증가
const ELITE_STAT_MULT = 1.8;
const ELITE_GOLD_MULT = 2.5;

// ─── 웨이브 정의 ─────────────────────────────────────────────────────────────
// battleGroups: 하단 전투 그룹 배열. 한 그룹을 전멸시켜야 다음 그룹 등장.
// 각 그룹은 types 배열 (동시 등장 몬스터 목록)
// 10 스테이지 × 3 웨이브 = 30 웨이브
const WAVE_DEFS = [
  // ── Stage 1-1 : 고블린 입문 ──────────────────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:4,interval:2000}], battleGroups:[{types:['goblin']},{types:['goblin']},{types:['goblin','goblin']}] },
  { defenseEnemies:[{type:'goblin',count:5,interval:1800}], battleGroups:[{types:['goblin']},{types:['goblin','goblin']},{types:['goblin','goblin']}] },
  { defenseEnemies:[{type:'goblin',count:6,interval:1600}], battleGroups:[{types:['goblin','goblin']},{types:['goblin','goblin']},{types:['goblin','goblin','goblin']}] },
  // ── Stage 1-2 : 늑대 등장 ────────────────────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:6,interval:1500},{type:'runner',count:2,interval:3000}], battleGroups:[{types:['goblin','goblin']},{types:['goblin','orc']},{types:['goblin','goblin','goblin']}] },
  { defenseEnemies:[{type:'goblin',count:7,interval:1400},{type:'runner',count:3,interval:2600}], battleGroups:[{types:['goblin','orc']},{types:['orc','goblin']},{types:['orc','orc']}] },
  { defenseEnemies:[{type:'goblin',count:8,interval:1300},{type:'runner',count:4,interval:2400}], battleGroups:[{types:['orc','goblin']},{types:['orc','orc']},{types:['goblin','orc','goblin']}] },
  // ── Stage 1-3 : 오크 주력 ────────────────────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:8,interval:1200},{type:'orc',count:2,interval:4000}], battleGroups:[{types:['orc','orc']},{types:['goblin','orc','goblin']},{types:['orc','orc','goblin']}] },
  { defenseEnemies:[{type:'goblin',count:9,interval:1100},{type:'orc',count:3,interval:3500}], battleGroups:[{types:['orc','orc']},{types:['orc','orc','goblin']},{types:['ogre']}] },
  { defenseEnemies:[{type:'goblin',count:10,interval:1000},{type:'orc',count:3,interval:3200}], battleGroups:[{types:['goblin','orc','orc']},{types:['ogre','goblin']},{types:['ogre','orc']}] },
  // ── Stage 1-4 : 강철오크 & 첫 보스 ───────────────────────────────────────
  { defenseEnemies:[{type:'goblin',count:8,interval:1000},{type:'brute',count:1,interval:6000}], battleGroups:[{types:['orc','orc','goblin']},{types:['ogre','orc']},{types:['boss']}] },
  { defenseEnemies:[{type:'orc',count:4,interval:2500},{type:'brute',count:1,interval:6000}], battleGroups:[{types:['ogre','orc']},{types:['ogre','ogre']},{types:['boss','goblin']}] },
  { defenseEnemies:[{type:'orc',count:5,interval:2200},{type:'brute',count:2,interval:5000}], battleGroups:[{types:['ogre','ogre']},{types:['boss','orc']},{types:['boss','ogre']}] },
  // ── Stage 1-5 : 오우거 무리 ──────────────────────────────────────────────
  { defenseEnemies:[{type:'runner',count:6,interval:1400},{type:'orc',count:3,interval:2200}], battleGroups:[{types:['ogre','ogre']},{types:['boss','goblin','goblin']},{types:['boss','ogre']}] },
  { defenseEnemies:[{type:'orc',count:5,interval:2000},{type:'brute',count:2,interval:4500}], battleGroups:[{types:['boss','orc']},{types:['ogre','ogre','orc']},{types:['boss','ogre']}] },
  { defenseEnemies:[{type:'goblin',count:8,interval:800},{type:'brute',count:3,interval:4000}], battleGroups:[{types:['boss','ogre']},{types:['boss','orc','goblin']},{types:['boss','boss']}] },
  // ── Stage 1-6 : 보스 상시 등장 ───────────────────────────────────────────
  { defenseEnemies:[{type:'orc',count:6,interval:1800},{type:'brute',count:2,interval:4000}], battleGroups:[{types:['boss','ogre']},{types:['boss','ogre','goblin']},{types:['boss','boss']}] },
  { defenseEnemies:[{type:'runner',count:8,interval:1100},{type:'orc',count:5,interval:1800}], battleGroups:[{types:['boss','ogre','goblin']},{types:['boss','boss']},{types:['boss','boss','ogre']}] },
  { defenseEnemies:[{type:'orc',count:7,interval:1600},{type:'brute',count:3,interval:3600}], battleGroups:[{types:['boss','boss']},{types:['boss','boss','orc']},{types:['boss','boss','ogre']}] },
  // ── Stage 1-7 : 마왕 예고 ────────────────────────────────────────────────
  { defenseEnemies:[{type:'orc',count:7,interval:1500},{type:'brute',count:3,interval:3400}], battleGroups:[{types:['boss','boss','ogre']},{types:['boss','boss','orc']},{types:['warlord']}] },
  { defenseEnemies:[{type:'orc',count:8,interval:1400},{type:'runner',count:6,interval:1600}], battleGroups:[{types:['boss','boss']},{types:['boss','boss','ogre']},{types:['warlord','goblin']}] },
  { defenseEnemies:[{type:'orc',count:9,interval:1300},{type:'brute',count:4,interval:3000}], battleGroups:[{types:['boss','boss','ogre']},{types:['boss','boss','boss']},{types:['warlord','orc']}] },
  // ── Stage 1-8 : 정예 편성 ────────────────────────────────────────────────
  { defenseEnemies:[{type:'orc',count:8,interval:1200},{type:'brute',count:4,interval:2800}], battleGroups:[{types:['boss','boss','ogre']},{types:['boss','boss','boss']},{types:['warlord','ogre']}] },
  { defenseEnemies:[{type:'brute',count:5,interval:2600},{type:'runner',count:8,interval:1000}], battleGroups:[{types:['boss','boss','boss']},{types:['warlord','orc']},{types:['warlord','ogre','goblin']}] },
  { defenseEnemies:[{type:'brute',count:6,interval:2400},{type:'orc',count:6,interval:1600}], battleGroups:[{types:['boss','boss','boss','ogre']},{types:['warlord','ogre']},{types:['warlord','boss']}] },
  // ── Stage 1-9 : 마왕 다수 ────────────────────────────────────────────────
  { defenseEnemies:[{type:'brute',count:6,interval:2200},{type:'boss',count:1,interval:9000}], battleGroups:[{types:['boss','boss','boss','ogre']},{types:['warlord','boss']},{types:['warlord','boss','ogre']}] },
  { defenseEnemies:[{type:'brute',count:7,interval:2000},{type:'boss',count:1,interval:8000}], battleGroups:[{types:['warlord','boss']},{types:['warlord','boss','ogre']},{types:['warlord','warlord']}] },
  { defenseEnemies:[{type:'brute',count:8,interval:1800},{type:'boss',count:2,interval:6000}], battleGroups:[{types:['warlord','boss','ogre']},{types:['warlord','warlord']},{types:['warlord','warlord','boss']}] },
  // ── Stage 1-10 : 최종 보스 스테이지 ──────────────────────────────────────
  { defenseEnemies:[{type:'brute',count:8,interval:1600},{type:'boss',count:2,interval:5000}], battleGroups:[{types:['warlord','boss','boss']},{types:['warlord','warlord']},{types:['warlord','warlord','boss']}] },
  { defenseEnemies:[{type:'brute',count:9,interval:1500},{type:'boss',count:3,interval:4500}], battleGroups:[{types:['warlord','warlord']},{types:['warlord','warlord','boss']},{types:['warlord','warlord','ogre','boss']}] },
  { defenseEnemies:[{type:'boss',count:5,interval:3500},{type:'brute',count:8,interval:1600}], battleGroups:[{types:['warlord','warlord','boss']},{types:['warlord','warlord','boss','ogre']},{types:['warlord','warlord','warlord','boss','boss']}] },
];
// 한 그룹 최대 인원 (레이아웃/가독성 상한)
const MAX_GROUP_SIZE = 5;

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
// 처치 1회마다 다음 몹 스탯/보상 8% 증가
const KILL_SCALE = 0.08;

// 웨이브 종료 후 생존 병력이 회복하는 최대 HP 비율
const REST_HEAL_PCT    = 0.30;

const WAVE_DURATION    = 60;
const INTERMISSION     = 15;
const BASE_HP_MAX      = 100;
const HERO_REVIVE_TIME = 20;

// ─── 전투 틱 ──────────────────────────────────────────────────────────────────
const TICK_INTERVAL = 1.0;
const SKILL_TICK_CD = 5;
const MP_REGEN_TICK = 5;

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
