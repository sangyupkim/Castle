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
const CELL_W = Math.floor(CW / GRID_COLS);        // 53
const CELL_H = Math.floor(DEFENSE_H / GRID_ROWS); // 50

const GRID_OX = Math.floor((CW - GRID_COLS * CELL_W) / 2);
const GRID_OY = 5;

/*  단일 ∞ 경로 — 9×7 grid
    모든 적이 동일한 하나의 경로를 따라 이동합니다.

    진행 순서:
    시작(4,0) → 아래(4,1) → 왼쪽(1,1) → 아래(1,4) → 오른쪽(4,4)
    → 위(4,1)[교차] → 오른쪽(7,1) → 아래(7,4) → 왼쪽(4,4)
    → 아래(4,6) 기지

      col: 0    1    2    3   [4]   5    6    7    8
  row 0: [ ]  [T]  [T]  [T] [S↓]  [T]  [T]  [T]  [ ]
  row 1: [T]  [←]  [←]  [←] [X↑→] [→]  [→]  [→]  [T]
  row 2: [T]  [↓]  [T]  [T]  [X]  [T]  [T]  [↓]  [T]
  row 3: [T]  [↓]  [T]  [T]  [X]  [T]  [T]  [↓]  [T]
  row 4: [T]  [→]  [→]  [→] [X←]  [←]  [←]  [←]  [T]
  row 5: [ ]  [T]  [T]  [T] [↓]   [T]  [T]  [T]  [ ]
  row 6: [ ]  [ ]  [ ]  [ ] [E]   [ ]  [ ]  [ ]  [ ]

  X = 교차점 (col4, row1~4): 두 방향으로 통행
*/
const THE_PATH = [
  [4,0],[4,1],              // ↓ 시작에서 내려옴
  [3,1],[2,1],[1,1],        // ← 왼쪽으로
  [1,2],[1,3],[1,4],        // ↓ 왼쪽 아래로
  [2,4],[3,4],[4,4],        // → 오른쪽으로 (교차점 아래)
  [4,3],[4,2],[4,1],        // ↑ 중앙 위로 (교차점 통과)
  [5,1],[6,1],[7,1],        // → 오른쪽으로
  [7,2],[7,3],[7,4],        // ↓ 오른쪽 아래로
  [6,4],[5,4],[4,4],        // ← 왼쪽으로 (교차점 아래)
  [4,5],[4,6]               // ↓ 기지로
];

// 하위 호환성 (wave.js 등에서 path:'A'/'B' 파라미터 무시됨)
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
    id: 'arrow', name: '화살 타워', cost: 5,
    dmg: 2, spd: 1.0,
    range: CELL_W * 2.4,
    color: '#22c55e', projColor: '#fbbf24',
    icon: '🏹'
  }
};

// ─── Defense Enemy Types ─────────────────────────────────────────────────────
const ENEMY_TYPES = {
  goblin: { id:'goblin', name:'고블린', hp:14, spd:1.1, dmg:2,  reward:3, color:'#4ade80', radius:9  },
  orc:    { id:'orc',    name:'오크',   hp:40, spd:0.7, dmg:6,  reward:8, color:'#818cf8', radius:13 }
};

const ENEMY_CELL_SPD = CELL_W;

// ─── Battle Zone Layout ───────────────────────────────────────────────────────
const BATTLE_TEAM_X   = 110;   // our team column X
const BATTLE_ENEMY_X  = 370;   // enemy team column X
const BATTLE_UNIT_R   = 24;    // unit circle radius
const BATTLE_UNIT_GAP = 80;    // vertical spacing between units
const BATTLE_UNIT_START_Y = BATTLE_Y + 80; // first unit Y

// ─── Battle Unit Types (우리팀) ───────────────────────────────────────────────
const UNIT_TYPES = {
  swordsman: {
    id:'swordsman', name:'검사',  cost:8,
    hp:60,  atk:12, def:3,
    mp:30,  maxMp:30,
    skillName:'강타', skillAtk:28, skillCost:15, skillColor:'#f59e0b',
    color:'#60a5fa', icon:'⚔️'
  },
  archer: {
    id:'archer',    name:'궁수',  cost:6,
    hp:40,  atk:10, def:1,
    mp:30,  maxMp:30,
    skillName:'연사', skillAtk:20, skillCost:12, skillColor:'#a78bfa',
    color:'#a78bfa', icon:'🏹'
  },
  healer: {
    id:'healer',    name:'치유사', cost:10,
    hp:45,  atk:5,  def:2,
    mp:40,  maxMp:40,
    skillName:'치유', skillAtk:0,  skillCost:20, skillColor:'#34d399', healAmt:25,
    color:'#34d399', icon:'✚'
  }
};

// ─── Battle Enemy Types (적팀) ────────────────────────────────────────────────
const BATTLE_MOB_TYPES = {
  goblin: { id:'goblin', name:'고블린', hp:30,  atk:8,  def:1, mp:20, maxMp:20, skillAtk:15, skillCost:10, color:'#4ade80', icon:'👺', goldReward:8  },
  orc:    { id:'orc',    name:'오크',   hp:80,  atk:15, def:4, mp:20, maxMp:20, skillAtk:30, skillCost:15, color:'#818cf8', icon:'👹', goldReward:20 },
  boss:   { id:'boss',   name:'보스',   hp:200, atk:25, def:8, mp:30, maxMp:30, skillAtk:50, skillCost:20, color:'#ef4444', icon:'💀', goldReward:60 }
};

// ─── Wave Definitions (Phase 1) ───────────────────────────────────────────────
// addEnemies: 해당 웨이브 시작 시 기존 생존 풀에 추가되는 몬스터
// (생존 몬스터는 체력 유지한 채 다음 웨이브로 이월됨)
const WAVE_DEFS = [
  {
    defenseEnemies: [
      { type:'goblin', count:5, interval:1600 }
    ],
    addEnemies: [                          // 웨이브 1 시작 시 신규 추가
      { type:'goblin', count:3 }
    ]
  },
  {
    defenseEnemies: [
      { type:'goblin', count:8, interval:1200 }
    ],
    addEnemies: [                          // 기존 생존자 + 이 몬스터들 추가
      { type:'goblin', count:2 },
      { type:'orc',    count:1 }
    ]
  },
  {
    defenseEnemies: [
      { type:'goblin', count:6, interval:1100 },
      { type:'orc',    count:2, interval:3000 }
    ],
    addEnemies: [
      { type:'orc',    count:2 },
      { type:'boss',   count:1 }
    ]
  }
];

const WAVE_DURATION  = 60;
const INTERMISSION   = 15;
const BASE_HP_MAX    = 100;
const HERO_REVIVE_TIME = 8;

// ─── Battle Tick Rate ─────────────────────────────────────────────────────────
const TICK_INTERVAL  = 1.0;  // seconds between combat ticks
const SKILL_TICK_CD  = 5;    // every N ticks a skill fires (if enough MP)
const MP_REGEN_TICK  = 5;    // MP regen per tick

const COLORS = {
  defenseBg:  '#0f172a',
  defenseGrid:'#1e293b',
  pathCell:   '#0e1e0e',
  uiBar:      '#0f0f1a',
  battleBg:   '#0d1117',
  ground:     '#1a2e1a',
  sky:        '#050d1a',
  hpGreen:    '#22c55e',
  hpYellow:   '#eab308',
  hpRed:      '#ef4444',
  gold:       '#fbbf24',
  text:       '#e2e8f0',
  textDim:    '#64748b',
  accent:     '#6366f1',
  mp:         '#3b82f6'
};
