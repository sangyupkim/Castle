'use strict';

// ─── Canvas / Layout ────────────────────────────────────────────────────────
const CW = 480;
const CH = 844;

const DEFENSE_Y  = 0;
const DEFENSE_H  = 355;
const TOOLBAR_Y  = 355;   // 타워 팔레트 / 게임 컨트롤
const TOOLBAR_H  = 44;
const UIBAR_Y    = 399;
const UIBAR_H    = 55;
const BATTLE_Y   = 454;
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

// 타워를 세울 수 없는 칸 (경로 + 시작/기지)
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
    id:'frost', name:'서리탑', cost:10,
    dmg:1, spd:0.9, range: CELL_W * 2.2,
    slow: 0.45, slowDur: 1.6,
    color:'#38bdf8', projColor:'#7dd3fc', icon:'❄️',
    desc:'이동속도 45% 감속'
  },
  cannon: {
    id:'cannon', name:'대포탑', cost:16,
    dmg:7, spd:0.5, range: CELL_W * 2.0,
    splash: 40,
    color:'#f97316', projColor:'#fb923c', icon:'💣',
    desc:'착탄 지점 범위 피해'
  },
  sniper: {
    id:'sniper', name:'저격탑', cost:24,
    dmg:17, spd:0.35, range: CELL_W * 5.0,
    pierceArmor: true, targetMode: 'strongest',
    color:'#e879f9', projColor:'#f0abfc', icon:'🎯',
    desc:'초장거리·방어 무시'
  }
};
const TOWER_ORDER = ['arrow', 'frost', 'cannon', 'sniper'];

// 타워 레벨 (1~3) 배율
const TOWER_MAX_LEVEL = 3;
const TOWER_LEVEL_MULT = [
  null,
  { dmg:1.00, spd:1.00, range:1.00 },
  { dmg:1.70, spd:1.15, range:1.12 },
  { dmg:2.60, spd:1.30, range:1.25 }
];
// 같은 종류를 많이 지을수록 건설비가 오른다 — 도배 대신 배치/강화를 고민하게 만든다
const TOWER_COST_ESCALATION = 0.32;
function towerBuildCost(typeId, towers) {
  const base = TOWER_TYPES[typeId].cost;
  const n = (towers || []).filter(t => t.typeId === typeId).length;
  const raw = base * (1 + TOWER_COST_ESCALATION * n);
  return Math.max(1, Math.round(raw) - BONUSES.towerCostDiscount);
}

function towerUpgradeCost(t) {
  if (t.level >= TOWER_MAX_LEVEL) return null;
  return Math.max(1, Math.round(TOWER_TYPES[t.typeId].cost * 0.9 * t.level));
}
function towerSellValue(t) {
  return Math.max(1, Math.floor(t.invested * 0.6));
}

// ─── Defense Enemy Types ─────────────────────────────────────────────────────
const ENEMY_TYPES = {
  goblin: { id:'goblin', name:'고블린',   hp:14,  spd:1.10, dmg:2,  reward:3,  armor:0, color:'#4ade80', radius:9  },
  runner: { id:'runner', name:'늑대',     hp:12,  spd:2.30, dmg:2,  reward:5,  armor:0, color:'#fbbf24', radius:8  },
  orc:    { id:'orc',    name:'오크',     hp:40,  spd:0.70, dmg:6,  reward:8,  armor:1, color:'#818cf8', radius:13 },
  brute:  { id:'brute',  name:'강철오크', hp:95,  spd:0.50, dmg:12, reward:18, armor:3, color:'#94a3b8', radius:15 },
  troll:  { id:'troll',  name:'트롤',     hp:280, spd:0.45, dmg:28, reward:55, armor:5, color:'#ef4444', radius:18 }
};
const ENEMY_CELL_SPD = CELL_W;
// 웨이브가 오를수록 상단 적도 강해진다
const DEF_WAVE_HP_SCALE = 0.30;
// 웨이브가 오를수록 침입자 방어력도 붙는다 → 싸구려 화살탑 도배만으로는 못 막는다
const DEF_WAVE_ARMOR_EVERY = 3;
const DEF_WAVE_COUNT_SCALE = 0.15;

// ─── Battle Layout ────────────────────────────────────────────────────────────
const BATTLE_TEAM_X        = 108;   // 아군 x (렌더 기준)
const BATTLE_ENEMY_X       = 336;   // 적 전투 대기 x
const BATTLE_ENEMY_SPAWN_X = CW + 70; // 적 스폰 위치 (화면 밖)
const BATTLE_MARCH_SPD     = 90;    // 배경 스크롤 속도 (전진 연출)
const BATTLE_ENEMY_WALK_SPD = 180;  // 적 걸어오는 속도 px/s
const BATTLE_LOG_H         = 65;

// 슬롯 수에 따라 유닛 크기/간격을 자동 조절 (슬롯이 늘어도 화면을 벗어나지 않음)
let BATTLE_SLOT_COUNT  = 4;
let BATTLE_UNIT_GAP    = 64;
let BATTLE_UNIT_R      = 23;
let BATTLE_UNIT_TOP    = BATTLE_Y + 42;
let BATTLE_SHOW_MP     = true;

function setBattleSlotCount(n) {
  BATTLE_SLOT_COUNT = Math.max(4, n || 4);
  const top = BATTLE_Y + 42;
  const bot = BATTLE_Y + BATTLE_H - BATTLE_LOG_H - 13;
  BATTLE_UNIT_TOP = top;
  BATTLE_UNIT_GAP = Math.min(64, (bot - top) / BATTLE_SLOT_COUNT);
  BATTLE_UNIT_R   = Math.max(11, Math.min(22, BATTLE_UNIT_GAP * 0.34));
  // 슬롯이 촘촘해지면 MP 바는 생략해 겹침을 막는다
  BATTLE_SHOW_MP  = BATTLE_UNIT_GAP >= 40;
}
function unitY(idx) {
  return BATTLE_UNIT_TOP + BATTLE_UNIT_GAP * (idx + 0.5);
}
setBattleSlotCount(4);

// 웨이브가 진행될수록 동시에 등장하는 적 수 증가
function maxLiveEnemies(waveIndex) {
  return Math.min(4, 2 + Math.floor(waveIndex / 4));
}

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
    id:'guardian',  name:'방패병', cost:13,
    hp:120, atk:7,  def:9, mp:30, maxMp:30,
    skillName:'수호 방벽', skillKind:'shield', skillAtk:0, skillCost:16, skillColor:'#38bdf8', shieldAmt:22,
    color:'#38bdf8', icon:'🛡️', role:'아군 전체에 보호막 부여'
  },
  mage: {
    id:'mage',      name:'마법사', cost:15,
    hp:45, atk:9,  def:1, mp:40, maxMp:40,
    skillName:'화염 폭발', skillKind:'aoe', skillAtk:22, skillCost:22, skillColor:'#f97316',
    color:'#f97316', icon:'✨', role:'적 전체 광역 피해'
  }
};
const UNIT_ORDER = ['archer', 'swordsman', 'healer', 'guardian', 'mage'];

// ─── 적 유닛 (하단 전투) ─────────────────────────────────────────────────────
const BATTLE_MOB_TYPES = {
  goblin:  { id:'goblin',  name:'고블린', hp:30,  atk:8,  def:1,  mp:20, maxMp:20, skillAtk:15,  skillCost:10, color:'#4ade80', icon:'👺', goldReward:8   },
  orc:     { id:'orc',     name:'오크',   hp:80,  atk:15, def:4,  mp:20, maxMp:20, skillAtk:30,  skillCost:15, color:'#818cf8', icon:'👹', goldReward:20  },
  ogre:    { id:'ogre',    name:'오우거', hp:150, atk:22, def:6,  mp:24, maxMp:24, skillAtk:42,  skillCost:16, color:'#a16207', icon:'🧌', goldReward:38  },
  boss:    { id:'boss',    name:'보스',   hp:200, atk:25, def:8,  mp:30, maxMp:30, skillAtk:50,  skillCost:20, color:'#ef4444', icon:'💀', goldReward:60,  isBoss:true },
  warlord: { id:'warlord', name:'마왕',   hp:520, atk:40, def:14, mp:36, maxMp:36, skillAtk:88,  skillCost:22, color:'#db2777', icon:'🐲', goldReward:180, isBoss:true }
};

// ─── 웨이브 정의 ─────────────────────────────────────────────────────────────
// battleSpawns: offset=최초 스폰 딜레이(초), interval=슬롯 비면 대기 시간(초)
const WAVE_DEFS = [
  { // W1
    defenseEnemies: [{ type:'goblin', count:5, interval:1600 }],
    battleSpawns:   [{ type:'goblin', offset:0, interval:1.2 }]
  },
  { // W2
    defenseEnemies: [{ type:'goblin', count:8, interval:1200 }],
    battleSpawns:   [
      { type:'goblin', offset:0, interval:1.0 },
      { type:'orc',    offset:8, interval:8   }
    ]
  },
  { // W3
    defenseEnemies: [
      { type:'goblin', count:6, interval:1100 },
      { type:'runner', count:3, interval:2600 }
    ],
    battleSpawns: [
      { type:'goblin', offset:0, interval:0.9 },
      { type:'orc',    offset:6, interval:6   }
    ]
  },
  { // W4
    defenseEnemies: [
      { type:'goblin', count:8,  interval:900 },
      { type:'orc',    count:3,  interval:3000 }
    ],
    battleSpawns: [
      { type:'goblin', offset:0,  interval:0.8 },
      { type:'orc',    offset:4,  interval:5   },
      { type:'boss',   offset:34, interval:999 }
    ]
  },
  { // W5
    defenseEnemies: [
      { type:'runner', count:8,  interval:1200 },
      { type:'orc',    count:4,  interval:2600 }
    ],
    battleSpawns: [
      { type:'goblin', offset:0,  interval:0.7 },
      { type:'orc',    offset:3,  interval:4.5 },
      { type:'ogre',   offset:20, interval:18  }
    ]
  },
  { // W6
    defenseEnemies: [
      { type:'goblin', count:10, interval:800 },
      { type:'brute',  count:2,  interval:5000 }
    ],
    battleSpawns: [
      { type:'orc',    offset:0,  interval:3.5 },
      { type:'ogre',   offset:12, interval:14  }
    ]
  },
  { // W7
    defenseEnemies: [
      { type:'runner', count:10, interval:900 },
      { type:'orc',    count:5,  interval:2200 },
      { type:'brute',  count:2,  interval:6000 }
    ],
    battleSpawns: [
      { type:'orc',    offset:0,  interval:3   },
      { type:'ogre',   offset:8,  interval:11  },
      { type:'boss',   offset:32, interval:999 }
    ]
  },
  { // W8
    defenseEnemies: [
      { type:'goblin', count:12, interval:700 },
      { type:'brute',  count:4,  interval:3800 }
    ],
    battleSpawns: [
      { type:'orc',    offset:0,  interval:2.6 },
      { type:'ogre',   offset:6,  interval:9   }
    ]
  },
  { // W9
    defenseEnemies: [
      { type:'runner', count:12, interval:750 },
      { type:'brute',  count:4,  interval:3400 },
      { type:'orc',    count:5,  interval:2400 }
    ],
    battleSpawns: [
      { type:'ogre',   offset:0,  interval:7   },
      { type:'boss',   offset:18, interval:22  }
    ]
  },
  { // W10 — 최종
    defenseEnemies: [
      { type:'goblin', count:12, interval:650 },
      { type:'runner', count:8,  interval:1400 },
      { type:'brute',  count:4,  interval:3200 },
      { type:'troll',  count:1,  interval:9999 }
    ],
    battleSpawns: [
      { type:'ogre',    offset:0,  interval:6   },
      { type:'boss',    offset:10, interval:16  },
      { type:'warlord', offset:30, interval:999 }
    ]
  }
];
const STAGE_WAVES = WAVE_DEFS.length;

// 무한 모드: 정의된 웨이브를 넘어서면 절차적으로 생성
function getWaveDef(idx) {
  if (idx < WAVE_DEFS.length) return WAVE_DEFS[idx];
  const over = idx - WAVE_DEFS.length + 1;   // 1, 2, 3 ...
  const tighten = f => Math.max(0.35, f - over * 0.03);
  return {
    endless: true,
    defenseEnemies: [
      { type:'goblin', count:12 + over*2, interval: tighten(0.65)*1000 },
      { type:'runner', count:8  + over*2, interval: tighten(1.30)*1000 },
      { type:'brute',  count:4  + over,   interval: tighten(3.00)*1000 },
      { type:'troll',  count:Math.ceil(over/2), interval: 12000 }
    ],
    battleSpawns: [
      { type:'ogre',    offset:0,  interval: tighten(5.5) },
      { type:'boss',    offset:8,  interval: tighten(14)  },
      { type:'warlord', offset:26, interval: Math.max(24, 45 - over*2) }
    ]
  };
}

// ─── 케이브 업그레이드 ────────────────────────────────────────────────────────
const CAVE_LEVELS = [
  null,
  { label:'자연 동굴', statMult:1.0, goldMult:1.0, upgradeCost:  0 },
  { label:'강화 동굴', statMult:1.4, goldMult:1.5, upgradeCost: 20 },
  { label:'위험 동굴', statMult:1.9, goldMult:2.2, upgradeCost: 35 },
  { label:'심연 동굴', statMult:2.6, goldMult:3.2, upgradeCost: 55 },
  { label:'지옥 동굴', statMult:3.5, goldMult:4.5, upgradeCost: 80 }
];
const CAVE_MAX_LEVEL = CAVE_LEVELS.length - 1;
// 처치 1회마다 다음 몹 스탯/보상 8% 증가
const KILL_SCALE = 0.08;

const WAVE_DURATION    = 60;
const INTERMISSION     = 15;
const BASE_HP_MAX      = 100;
const HERO_REVIVE_TIME = 20;
// 웨이브 종료 후 생존 병력이 회복하는 최대 HP 비율
const REST_HEAL_PCT    = 0.30;

// ─── 전투 틱 ──────────────────────────────────────────────────────────────────
const TICK_INTERVAL = 1.0;
const SKILL_TICK_CD = 5;
const MP_REGEN_TICK = 5;

// ─── 게임 속도 ────────────────────────────────────────────────────────────────
const SPEED_STEPS = [1, 2, 3];

// ─── 영웅 기본 스탯 ───────────────────────────────────────────────────────────
const HERO_LEVELS = [
  //  atk, hp,  def, expNeeded, atkRange(px)
  null,                                                            // index 0 unused
  { atk:15, hp:80,  def:5,  expNeeded:30,   range: CELL_W*3.0 },   // Lv.1
  { atk:18, hp:90,  def:6,  expNeeded:70,   range: CELL_W*3.2 },   // Lv.2
  { atk:22, hp:105, def:7,  expNeeded:130,  range: CELL_W*3.4 },   // Lv.3
  { atk:28, hp:125, def:9,  expNeeded:220,  range: CELL_W*3.6 },   // Lv.4
  { atk:35, hp:150, def:11, expNeeded:340,  range: CELL_W*4.0 },   // Lv.5
  { atk:44, hp:180, def:13, expNeeded:500,  range: CELL_W*4.2 },   // Lv.6
  { atk:55, hp:215, def:16, expNeeded:720,  range: CELL_W*4.4 },   // Lv.7
  { atk:68, hp:255, def:19, expNeeded:1000, range: CELL_W*4.6 },   // Lv.8
  { atk:84, hp:300, def:22, expNeeded:1400, range: CELL_W*4.8 },   // Lv.9
  { atk:105,hp:360, def:26, expNeeded:9999, range: CELL_W*5.2 }    // Lv.10
];
const HERO_MAX_LEVEL = HERO_LEVELS.length - 1;

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
