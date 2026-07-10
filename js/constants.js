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
  orc:    { id:'orc',    name:'오크',   hp:40, spd:0.7, dmg:6,  reward:8, color:'#818cf8', radius:13 },
  boss:   { id:'boss',   name:'던전보스', hp:400, spd:0.4, dmg:20, reward:50, color:'#ef4444', radius:20 }
};
const ENEMY_CELL_SPD = CELL_W;

// ─── Battle Layout ────────────────────────────────────────────────────────────
const BATTLE_TEAM_X        = 110;   // 아군 x (렌더 기준)
const BATTLE_ENEMY_X       = 340;   // 적 전투 대기 x
const BATTLE_ENEMY_SPAWN_X = CW + 70; // 적 스폰 위치 (화면 밖)
const BATTLE_MAX_LIVE_ENEMIES = 2;  // 동시 최대 생존 적 수
const BATTLE_MARCH_SPD     = 90;    // 배경 스크롤 속도 (전진 연출)
const BATTLE_ENEMY_WALK_SPD = 180;  // 적 걸어오는 속도 px/s
const BATTLE_UNIT_R       = 24;
const BATTLE_UNIT_GAP     = 64;
const BATTLE_UNIT_START_Y = BATTLE_Y + 55;

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
// battleGroups: 하단 전투 그룹 배열. 한 그룹을 전멸시켜야 다음 그룹 등장.
// 각 그룹은 types 배열 (동시 등장 몬스터 목록)
// 10 스테이지 × 3 웨이브 = 30 웨이브
const WAVE_DEFS = [
  // Stage 1-1
  { defenseEnemies:[{type:'goblin',count:4,interval:2000}], battleGroups:[{types:['goblin']},{types:['goblin']},{types:['goblin','goblin']}] },
  { defenseEnemies:[{type:'goblin',count:5,interval:1800}], battleGroups:[{types:['goblin']},{types:['goblin','goblin']},{types:['goblin','goblin']}] },
  { defenseEnemies:[{type:'goblin',count:6,interval:1600}], battleGroups:[{types:['goblin','goblin']},{types:['goblin','goblin']},{types:['goblin','goblin','goblin']}] },
  // Stage 1-2
  { defenseEnemies:[{type:'goblin',count:6,interval:1500}], battleGroups:[{types:['goblin','goblin']},{types:['goblin','orc']},{types:['goblin','goblin','goblin']}] },
  { defenseEnemies:[{type:'goblin',count:7,interval:1400}], battleGroups:[{types:['goblin','orc']},{types:['orc','goblin']},{types:['orc','orc']}] },
  { defenseEnemies:[{type:'goblin',count:8,interval:1300}], battleGroups:[{types:['orc','goblin']},{types:['orc','orc']},{types:['goblin','orc','goblin']}] },
  // Stage 1-3
  { defenseEnemies:[{type:'goblin',count:8,interval:1200},{type:'orc',count:1,interval:5000}], battleGroups:[{types:['orc','orc']},{types:['goblin','orc','goblin']},{types:['orc','orc','goblin']}] },
  { defenseEnemies:[{type:'goblin',count:9,interval:1100},{type:'orc',count:2,interval:4000}], battleGroups:[{types:['orc','orc']},{types:['orc','orc','goblin']},{types:['boss']}] },
  { defenseEnemies:[{type:'goblin',count:10,interval:1000},{type:'orc',count:2,interval:3500}], battleGroups:[{types:['goblin','orc','orc']},{types:['orc','orc']},{types:['boss']}] },
  // Stage 1-4
  { defenseEnemies:[{type:'goblin',count:8,interval:1000},{type:'orc',count:2,interval:3000}], battleGroups:[{types:['orc','orc']},{types:['boss']},{types:['boss','goblin']}] },
  { defenseEnemies:[{type:'orc',count:4,interval:2500}], battleGroups:[{types:['orc','orc','goblin']},{types:['boss']},{types:['boss','orc']}] },
  { defenseEnemies:[{type:'orc',count:5,interval:2200}], battleGroups:[{types:['boss']},{types:['boss','goblin']},{types:['boss','orc']}] },
  // Stage 1-5
  { defenseEnemies:[{type:'goblin',count:6,interval:900},{type:'orc',count:3,interval:2200}], battleGroups:[{types:['boss']},{types:['boss','goblin','goblin']},{types:['boss','boss']}] },
  { defenseEnemies:[{type:'orc',count:5,interval:2000}], battleGroups:[{types:['boss','goblin']},{types:['boss','orc']},{types:['boss','boss']}] },
  { defenseEnemies:[{type:'goblin',count:8,interval:800},{type:'orc',count:4,interval:2000}], battleGroups:[{types:['boss','boss']},{types:['boss','orc','goblin']},{types:['boss','boss','goblin']}] },
  // Stage 1-6
  { defenseEnemies:[{type:'orc',count:6,interval:1800}], battleGroups:[{types:['boss','boss']},{types:['boss','boss','goblin']},{types:['boss','boss','orc']}] },
  { defenseEnemies:[{type:'goblin',count:10,interval:700},{type:'orc',count:5,interval:1800}], battleGroups:[{types:['boss','boss','goblin']},{types:['boss','boss']},{types:['boss','boss','boss']}] },
  { defenseEnemies:[{type:'orc',count:7,interval:1600}], battleGroups:[{types:['boss','boss']},{types:['boss','boss','orc']},{types:['boss','boss','boss']}] },
  // Stage 1-7
  { defenseEnemies:[{type:'orc',count:7,interval:1500},{type:'goblin',count:8,interval:700}], battleGroups:[{types:['boss','boss','boss']},{types:['boss','boss','orc']},{types:['boss','boss','boss','goblin']}] },
  { defenseEnemies:[{type:'orc',count:8,interval:1400}], battleGroups:[{types:['boss','boss']},{types:['boss','boss','boss']},{types:['boss','boss','boss','orc']}] },
  { defenseEnemies:[{type:'orc',count:9,interval:1300}], battleGroups:[{types:['boss','boss','boss']},{types:['boss','boss','boss','goblin']},{types:['boss','boss','boss','boss']}] },
  // Stage 1-8
  { defenseEnemies:[{type:'orc',count:8,interval:1200},{type:'goblin',count:10,interval:600}], battleGroups:[{types:['boss','boss','boss']},{types:['boss','boss','boss','orc']},{types:['boss','boss','boss','boss']}] },
  { defenseEnemies:[{type:'orc',count:10,interval:1100}], battleGroups:[{types:['boss','boss','boss','boss']},{types:['boss','boss','boss']},{types:['boss','boss','boss','boss','goblin']}] },
  { defenseEnemies:[{type:'orc',count:12,interval:1000}], battleGroups:[{types:['boss','boss','boss','boss']},{types:['boss','boss','boss','boss']},{types:['boss','boss','boss','boss','boss']}] },
  // Stage 1-9
  { defenseEnemies:[{type:'orc',count:10,interval:900},{type:'boss',count:1,interval:8000}], battleGroups:[{types:['boss','boss','boss','boss']},{types:['boss','boss','boss','boss','orc']},{types:['boss','boss','boss','boss','boss']}] },
  { defenseEnemies:[{type:'orc',count:12,interval:800},{type:'boss',count:2,interval:6000}], battleGroups:[{types:['boss','boss','boss','boss','boss']},{types:['boss','boss','boss','boss','boss']},{types:['boss','boss','boss','boss','boss','goblin']}] },
  { defenseEnemies:[{type:'orc',count:12,interval:700},{type:'boss',count:3,interval:5000}], battleGroups:[{types:['boss','boss','boss','boss','boss']},{types:['boss','boss','boss','boss','boss','orc']},{types:['boss','boss','boss','boss','boss','boss']}] },
  // Stage 1-10 (BOSS STAGE)
  { defenseEnemies:[{type:'orc',count:8,interval:600},{type:'boss',count:3,interval:4000}], battleGroups:[{types:['boss','boss','boss','boss','boss']},{types:['boss','boss','boss','boss','boss','boss']},{types:['boss','boss','boss','boss','boss','boss','boss']}] },
  { defenseEnemies:[{type:'boss',count:5,interval:3500}], battleGroups:[{types:['boss','boss','boss','boss','boss','boss']},{types:['boss','boss','boss','boss','boss','boss']},{types:['boss','boss','boss','boss','boss','boss','boss','boss']}] },
  { defenseEnemies:[{type:'boss',count:8,interval:3000}], battleGroups:[{types:['boss','boss','boss','boss','boss','boss','boss']},{types:['boss','boss','boss','boss','boss','boss','boss']},{types:['boss','boss','boss','boss','boss','boss','boss','boss','boss']}] },
];

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
  { label:'강화 동굴', statMult:1.4, goldMult:1.5, upgradeCost: 20 },
  { label:'위험 동굴', statMult:1.9, goldMult:2.2, upgradeCost: 35 },
  { label:'심연 동굴', statMult:2.6, goldMult:3.2, upgradeCost: 55 },
  { label:'지옥 동굴', statMult:3.5, goldMult:4.5, upgradeCost: 80 }
];
// 처치 1회마다 다음 몹 스탯/보상 8% 증가
const KILL_SCALE = 0.08;

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
