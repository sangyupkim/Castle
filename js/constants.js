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
const CELL_W = Math.floor(CW / GRID_COLS);       // 53
const CELL_H = Math.floor(DEFENSE_H / GRID_ROWS); // 50

// Grid pixel origin (top-left of cell [0,0])
const GRID_OX = Math.floor((CW - GRID_COLS * CELL_W) / 2); // center horizontally
const GRID_OY = 5;

/*  Path layout (col, row) on a 9×7 grid:

      0    1    2    3   [4]   5    6    7    8
  0  [ ]  [T]  [T]  [T] [START][T] [T]  [T]  [ ]
  1  [T]  [◄]  [◄]  [◄] [▼▲]  [►] [►]  [►]  [T]
  2  [T]  [▼]  [T]  [T] [inner][T] [T]  [▲]  [T]
  3  [T]  [▼]  [T]  [T] [inner][T] [T]  [▲]  [T]
  4  [T]  [►]  [►]  [►] [merge][◄] [◄]  [◄]  [T]
  5  [ ]  [T]  [T]  [T] [▼]   [T] [T]  [T]  [ ]
  6  [ ]  [ ]  [ ]  [ ] [END]  [ ] [ ]  [ ]  [ ]

  PATH_A (left spiral):  (4,0)→(4,1)→(3,1)→(2,1)→(1,1)→(1,2)→(1,3)→(1,4)→(2,4)→(3,4)→(4,4)→(4,5)→(4,6)
  PATH_B (right spiral): (4,0)→(4,1)→(5,1)→(6,1)→(7,1)→(7,2)→(7,3)→(7,4)→(6,4)→(5,4)→(4,4)→(4,5)→(4,6)
*/
const PATH_A = [[4,0],[4,1],[3,1],[2,1],[1,1],[1,2],[1,3],[1,4],[2,4],[3,4],[4,4],[4,5],[4,6]];
const PATH_B = [[4,0],[4,1],[5,1],[6,1],[7,1],[7,2],[7,3],[7,4],[6,4],[5,4],[4,4],[4,5],[4,6]];

const PATH_CELLS = new Set([...PATH_A, ...PATH_B].map(([c,r]) => `${c},${r}`));

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
    dmg: 2, spd: 1.0,           // attacks per second
    range: CELL_W * 2.4,        // ~127 px
    color: '#22c55e', projColor: '#fbbf24',
    icon: '🏹'
  }
};

// ─── Defense Enemy Types ─────────────────────────────────────────────────────
const ENEMY_TYPES = {
  goblin: { id:'goblin', name:'고블린', hp:14, spd:1.1, dmg:2,  reward:3, color:'#4ade80', radius:9  },
  orc:    { id:'orc',    name:'오크',   hp:40, spd:0.7, dmg:6,  reward:8, color:'#818cf8', radius:13 }
};

// cells per second for enemy speed → pixels per second
const ENEMY_CELL_SPD = CELL_W; // 1.0 spd = CELL_W px/s

// ─── Battle Zone ─────────────────────────────────────────────────────────────
const GROUND_Y  = BATTLE_Y + BATTLE_H - 80; // ground line in canvas coords
const MERC_SPAWN_X = 30;
const MOB_SPAWN_X  = CW - 30;

const MERC_TYPES = {
  swordsman: {
    id:'swordsman', name:'검사', cost:10,
    hp:25, atk:5, atkSpd:1.0, moveSpd:45,
    color:'#60a5fa', radius:11, icon:'⚔️'
  }
};

const BATTLE_ENEMY_TYPES = {
  goblin: { id:'goblin', name:'고블린', hp:12, atk:3, atkSpd:1.0, moveSpd:35, color:'#4ade80', radius:9 },
  orc:    { id:'orc',    name:'오크',   hp:35, atk:8, atkSpd:0.7, moveSpd:22, color:'#818cf8', radius:13 }
};

// ─── Wave Definitions (Phase 1, 3 waves) ─────────────────────────────────────
const WAVE_DEFS = [
  {
    // Wave 1 — tutorial-friendly
    defenseEnemies: [
      { type:'goblin', count:5, path:'A', interval:1600 }
    ],
    battleEnemies: [
      { type:'goblin', count:6, interval:4000, delay:3000 }
    ]
  },
  {
    // Wave 2 — both paths + faster
    defenseEnemies: [
      { type:'goblin', count:4, path:'A', interval:1300 },
      { type:'goblin', count:4, path:'B', interval:1300 }
    ],
    battleEnemies: [
      { type:'goblin', count:8, interval:3200, delay:2000 },
      { type:'orc',    count:2, interval:7000, delay:8000 }
    ]
  },
  {
    // Wave 3 — boss wave
    defenseEnemies: [
      { type:'goblin', count:6, path:'A', interval:1100 },
      { type:'goblin', count:6, path:'B', interval:1100 },
      { type:'orc',    count:2, path:'A', interval:3500 }
    ],
    battleEnemies: [
      { type:'goblin', count:10, interval:2800, delay:1000 },
      { type:'orc',    count:3,  interval:5000, delay:5000 }
    ]
  }
];

const WAVE_DURATION = 60;   // seconds per wave
const INTERMISSION   = 12;  // seconds between waves

// ─── Misc ─────────────────────────────────────────────────────────────────────
const BASE_HP_MAX = 100;
const HERO_REVIVE_TIME = 8; // seconds

const COLORS = {
  defenseBg:  '#0f172a',
  defenseGrid:'#1e293b',
  pathCell:   '#1a1a2e',
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
  accent:     '#6366f1'
};
