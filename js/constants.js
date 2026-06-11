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
const PATH_A = THE_PATH;
const PATH_B = THE_PATH;
const PATH_CELLS = new Set(THE_PATH.map(([c,r]) => `${c},${r}`));

function cellCenter(col, row) {
  return {
    x: GRID_OX + col * CELL_W + CELL_W / 2,
    y: GRID_OY + row * CELL_H + CELL_H / 2
  };
}

// ─── Tower Types ─────────────────────────────────────────────────────────────
const TOWER_TYPES = {
  arrow: {
    id:'arrow', name:'화살 타워', cost:5,
    dmg:2, spd:1.0, range: CELL_W * 2.4,
    color:'#22c55e', projColor:'#fbbf24', icon:'🏹'
  }
};

// ─── Defense Enemy Types ─────────────────────────────────────────────────────
const ENEMY_TYPES = {
  goblin: { id:'goblin', name:'고블린', hp:14, spd:1.1, dmg:2,  reward:3, color:'#4ade80', radius:9  },
  orc:    { id:'orc',    name:'오크',   hp:40, spd:0.7, dmg:6,  reward:8, color:'#818cf8', radius:13 }
};
const ENEMY_CELL_SPD = CELL_W;

// ─── Battle Layout ────────────────────────────────────────────────────────────
const BATTLE_TEAM_X       = 110;
const BATTLE_ENEMY_X      = 370;
const BATTLE_UNIT_R       = 24;
const BATTLE_UNIT_GAP     = 72;
const BATTLE_UNIT_START_Y = BATTLE_Y + 75;

// ─── 아군 유닛 ───────────────────────────────────────────────────────────────
const UNIT_TYPES = {
  swordsman: {
    id:'swordsman', name:'검사',   cost:8,
    hp:60, atk:12, def:3, mp:30, maxMp:30,
    skillName:'강타', skillAtk:28, skillCost:15, skillColor:'#f59e0b',
    color:'#60a5fa', icon:'⚔️'
  },
  archer: {
    id:'archer',    name:'궁수',   cost:6,
    hp:40, atk:10, def:1, mp:30, maxMp:30,
    skillName:'연사', skillAtk:20, skillCost:12, skillColor:'#a78bfa',
    color:'#a78bfa', icon:'🏹'
  },
  healer: {
    id:'healer',    name:'치유사', cost:10,
    hp:45, atk:5,  def:2, mp:40, maxMp:40,
    skillName:'치유', skillAtk:0, skillCost:20, skillColor:'#34d399', healAmt:25,
    color:'#34d399', icon:'✚'
  }
};

// ─── 적 유닛 (하단 전투) ─────────────────────────────────────────────────────
const BATTLE_MOB_TYPES = {
  goblin: { id:'goblin', name:'고블린', hp:30,  atk:8,  def:1, mp:20, maxMp:20, skillAtk:15, skillCost:10, color:'#4ade80', icon:'👺', goldReward:8  },
  orc:    { id:'orc',    name:'오크',   hp:80,  atk:15, def:4, mp:20, maxMp:20, skillAtk:30, skillCost:15, color:'#818cf8', icon:'👹', goldReward:20 },
  boss:   { id:'boss',   name:'보스',   hp:200, atk:25, def:8, mp:30, maxMp:30, skillAtk:50, skillCost:20, color:'#ef4444', icon:'💀', goldReward:60 }
};

// ─── 웨이브 정의 ─────────────────────────────────────────────────────────────
// battleSpawns: 웨이브 60초 동안 연속 스폰 (offset = 최초 스폰 시각(초), interval = 재스폰 간격)
const WAVE_DEFS = [
  {
    defenseEnemies: [{ type:'goblin', count:5, interval:1600 }],
    battleSpawns:   [{ type:'goblin', offset:2,  interval:9  }]
  },
  {
    defenseEnemies: [{ type:'goblin', count:8, interval:1200 }],
    battleSpawns:   [
      { type:'goblin', offset:2,  interval:7  },
      { type:'orc',    offset:12, interval:22 }
    ]
  },
  {
    defenseEnemies: [
      { type:'goblin', count:6, interval:1100 },
      { type:'orc',    count:2, interval:3000 }
    ],
    battleSpawns: [
      { type:'goblin', offset:2,  interval:5  },
      { type:'orc',    offset:8,  interval:16 },
      { type:'boss',   offset:30, interval:999 } // 단 1회 (30초에 등장)
    ]
  }
];

const WAVE_DURATION    = 60;
const INTERMISSION     = 15;
const BASE_HP_MAX      = 100;
const HERO_REVIVE_TIME = 8;

// ─── 전투 틱 ──────────────────────────────────────────────────────────────────
const TICK_INTERVAL = 1.0;
const SKILL_TICK_CD = 5;
const MP_REGEN_TICK = 5;

// ─── 영웅 기본 스탯 ───────────────────────────────────────────────────────────
const HERO_LEVELS = [
  //  atk, hp,  def, expNeeded, atkRange(px)
  null,                               // index 0 unused
  { atk:15, hp:80,  def:5, expNeeded:30,  range: CELL_W*3.0 },  // Lv.1
  { atk:18, hp:90,  def:6, expNeeded:70,  range: CELL_W*3.2 },  // Lv.2
  { atk:22, hp:105, def:7, expNeeded:130, range: CELL_W*3.4 },  // Lv.3
  { atk:28, hp:125, def:9, expNeeded:220, range: CELL_W*3.6 },  // Lv.4
  { atk:35, hp:150, def:11,expNeeded:999, range: CELL_W*4.0 }   // Lv.5
];

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
  hero:       '#f59e0b'
};
