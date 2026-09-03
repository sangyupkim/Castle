'use strict';

// ─── 👹 보스전 ────────────────────────────────────────────────────────────────
// 보스 층은 **한쪽 전선만** 쓴다. 상단이면 아레나에 몹이 한 마리도 안 나오고,
// 하단이면 격자에 한 마리도 안 나온다. 안 쓰는 쪽은 화면에서 통째로 치우고
// 쓰는 쪽이 세로를 다 가져간다 — 두 전선을 반씩 보다가 보스를 놓치는 일이 없게.
//
// 어디서 싸울지는 **플레이어가 고른다.** 세 번째 선택지 '무작위'는 보상이 더 좋다 —
// 준비한 쪽을 고르는 안전함과, 어느 쪽이 나올지 모르는 위험을 맞바꾸는 자리다.
//
// 체력은 여러 줄로 나뉜다. 한 줄이 깎일 때마다 **기믹**이 하나 터진다.
// 기믹은 배치를 무르게 하는 것이 아니라 **그 순간 다르게 움직이게** 만드는 것들이다 —
// 타워가 부서지고, 둔화가 안 걸리고, 영웅이 잠깐 빠지고.

// ── 보상 ─────────────────────────────────────────────────────────────────────
const BOSS_RANDOM_REWARD = 1.35;   // '무작위'를 골랐을 때 보상 배율

// ── 체력 줄 ──────────────────────────────────────────────────────────────────
const BOSS_BARS      = 10;   // 마왕 — 열 줄. 한 줄마다 기믹.
const MIDBOSS_BARS   = 5;    // 중간보스 — 다섯 줄

// ── 상단: 몇 바퀴를 돌면 성으로 가는가 ───────────────────────────────────────
const BOSS_LAPS      = 10;
const MIDBOSS_SECS   = 60;   // 중간보스는 바퀴가 아니라 60초

// ── 하단 레이드 ──────────────────────────────────────────────────────────────
const RAID_TIME_LIMIT   = 150;   // 이 안에 못 잡으면 패배
const MIDRAID_TIME_LIMIT = 60;
const RAID_FIELD_WARN   = 1.1;   // 장판이 터지기까지 예고되는 시간(초)

// ─── 기믹 ────────────────────────────────────────────────────────────────────
// dur이 0이면 즉발(그 자리에서 한 번 일어나고 끝), 아니면 그 초만큼 지속된다.
// side는 이 기믹이 어느 전선에서 뜻이 있는가.
const BOSS_GIMMICKS = [
  // ── 상단 ──
  { id:'crush',   side:'top',    dur:0,  icon:'💥', name:'붕괴',
    desc:'보스 옆 1칸의 타워가 부서집니다',
    fire(gs, boss) {
      const hit = [];
      for (const t of gs.towers.slice()) {
        const c = cellCenter(t.col, t.row);
        if (Math.hypot(c.x - boss.x, c.y - boss.y) <= CELL_W * 1.5) hit.push(t);
      }
      for (const t of hit) {
        const i = gs.towers.indexOf(t);
        if (i >= 0) gs.towers.splice(i, 1);
        const c = cellCenter(t.col, t.row);
        if (typeof FX !== 'undefined') FX.burst(c.x, c.y, '#ef4444', 14, 18);
      }
      return hit.length ? `타워 ${hit.length}기가 부서졌습니다` : '부술 타워가 없었습니다';
    } },
  { id:'unslow',  side:'top',    dur:10, icon:'🔥', name:'열기',
    desc:'10초 동안 둔화가 걸리지 않습니다' },
  { id:'antibig', side:'top',    dur:30, icon:'🛡', name:'경화',
    desc:'30초 동안 대형 특화 공격이 통하지 않습니다' },
  { id:'nohero',  side:'both',   dur:10, icon:'🌀', name:'추방',
    desc:'10초 동안 영웅이 전투에서 빠집니다' },
  { id:'haste',   side:'top',    dur:12, icon:'💨', name:'질주',
    desc:'12초 동안 보스가 빨라집니다' },
  // ── 하단 ──
  { id:'noranged', side:'bottom', dur:10, icon:'🏹', name:'반사막',
    desc:'10초 동안 원거리 공격을 받지 않습니다' },
  { id:'slowatk',  side:'bottom', dur:12, icon:'🕸', name:'점착',
    desc:'12초 동안 아군 공격속도가 절반이 됩니다' },
  { id:'slowmove', side:'bottom', dur:12, icon:'🧊', name:'한기',
    desc:'12초 동안 아군 이동속도가 절반이 됩니다' },
  { id:'storm',    side:'bottom', dur:0,  icon:'☄️', name:'폭격',
    desc:'장판이 한꺼번에 쏟아집니다',
    fire(gs) { bossSpawnFieldBurst(gs, 5); return '장판 5개가 동시에 떨어집니다'; } },
];

function bossGimmicksFor(side) {
  return BOSS_GIMMICKS.filter(g => g.side === side || g.side === 'both');
}

// ─── 상태 ────────────────────────────────────────────────────────────────────
function makeBossState() {
  return {
    active:   false,
    kind:     null,      // 'lord' | 'mid'
    side:     null,      // 'top' | 'bottom'  — 실제로 싸우는 곳
    pick:     null,      // 'top' | 'bottom' | 'random'  — 플레이어가 고른 것
    wasRandom:false,
    bars:     BOSS_BARS,
    broken:   0,
    laps:     0,
    lapsMax:  BOSS_LAPS,
    timeLeft: 0,
    effects:  {},        // 기믹 id → 남은 초 (0 이하면 풀린 것)
    log:      null,      // 방금 터진 기믹 { icon, name, desc, until }
    fields:   [],        // 하단 장판 { x, y, r, warn, life, dmg }
    fieldTimer: 0,
    defeated: false,
    failed:   false,
  };
}

function bossState(gs) {
  if (!gs.boss) gs.boss = makeBossState();
  return gs.boss;
}
function bossActive(gs)  { return !!(gs && gs.boss && gs.boss.active); }
function bossSide(gs)    { return bossActive(gs) ? gs.boss.side : null; }
// 이 전선이 이번 층에 쓰이는가. 보스전이 아니면 둘 다 쓴다.
function laneInUse(gs, side) { return !bossActive(gs) || gs.boss.side === side; }
function bossEffect(gs, id)  { return bossActive(gs) && (gs.boss.effects[id] || 0) > 0; }

// ─── 이 층이 보스 층인가 ─────────────────────────────────────────────────────
// 마왕(100층)과 중간보스(10층마다) 둘 다 '한쪽만 쓰는' 같은 규칙으로 돈다.
function bossKindFor(gsp, waveIndex) {
  if (typeof isBossFloor === 'function' && isBossFloor(gsp, waveIndex))       return 'lord';
  if (typeof isMidBossFloor === 'function' && isMidBossFloor(gsp, waveIndex)) return 'mid';
  return null;
}

// ─── 시작 ────────────────────────────────────────────────────────────────────
// pick은 준비 화면에서 고른 값이다. 'random'이면 여기서 굴리고 보상을 우대한다.
function beginBossFight(gs, waveIndex, kind, pick) {
  const b = bossState(gs);
  const chosen = pick || 'random';
  const side = (chosen === 'random')
    ? (Math.random() < 0.5 ? 'top' : 'bottom')
    : chosen;

  b.active   = true;
  b.kind     = kind;
  b.side     = side;
  b.pick     = chosen;
  b.wasRandom= chosen === 'random';
  b.bars     = kind === 'lord' ? BOSS_BARS : MIDBOSS_BARS;
  b.broken   = 0;
  b.laps     = 0;
  b.lapsMax  = BOSS_LAPS;
  b.timeLeft = kind === 'lord' ? RAID_TIME_LIMIT : MIDRAID_TIME_LIMIT;
  b.effects  = {};
  b.log      = null;
  b.fields   = [];
  b.fieldTimer = 1.6;
  b.defeated = false;
  b.failed   = false;

  // 하단 레이드면 아레나가 화면을 다 가져간다 (상단 라인은 그리지 않는다)
  if (typeof applyArenaBounds === 'function') applyArenaBounds(side === 'bottom');
  if (typeof invalidateArenaFloor === 'function') invalidateArenaFloor();

  // 영웅은 보스가 있는 쪽에 자동으로 선다 — 고민할 자리가 아니다.
  if (gs.hero && !gs.hero.dead) {
    const want = side === 'top' ? 'defense' : 'battle';
    if (gs.hero.placement !== want) {
      gs.hero.placement = want;
      if (want === 'defense' && gs.battle)
        gs.battle.ourTeam = gs.battle.ourTeam.filter(u => !u.isHero);
    }
  }
  return b;
}

function endBossFight(gs, won) {
  const b = bossState(gs);
  b.active = false;
  b.defeated = !!won;
  b.failed   = !won;
  b.fields   = [];
  b.effects  = {};
  // 아레나를 원래 자리로 되돌린다 — 안 되돌리면 다음 층이 어긋난 채로 시작한다
  if (typeof applyArenaBounds === 'function') applyArenaBounds(false);
  if (typeof invalidateArenaFloor === 'function') invalidateArenaFloor();
}

// ─── 체력 줄과 기믹 ──────────────────────────────────────────────────────────
// 체력이 한 줄 깎일 때마다 기믹 하나를 무작위로 터뜨린다.
function bossCheckBars(gs, hp, maxHp) {
  const b = bossState(gs);
  if (!b.active || maxHp <= 0) return;
  const want = Math.min(b.bars, Math.floor((1 - hp / maxHp) * b.bars));
  while (b.broken < want) {
    b.broken++;
    bossFireGimmick(gs);
  }
}

function bossFireGimmick(gs) {
  const b = bossState(gs);
  const pool = bossGimmicksFor(b.side === 'top' ? 'top' : 'bottom');
  if (!pool.length) return;
  const g = pool[Math.floor(Math.random() * pool.length)];
  let extra = '';
  if (g.fire) {
    const boss = bossFindTop(gs);
    try { extra = g.fire(gs, boss || { x: CW / 2, y: DEFENSE_H / 2 }) || ''; } catch (e) {}
  }
  if (g.dur > 0) b.effects[g.id] = g.dur;
  b.log = { icon:g.icon, name:g.name, desc: extra || g.desc, until: 3.2 };
  if (typeof FX  !== 'undefined') FX.shake(8, 0.5);
  if (typeof SFX !== 'undefined') SFX.lose();
  if (typeof addLog === 'function' && gs.battle)
    addLog(gs.battle, `${g.icon} ${g.name} — ${extra || g.desc}`, '#f43f5e');
}

// 상단에 서 있는 보스 하나 (기믹이 위치를 알아야 할 때 쓴다)
function bossFindTop(gs) {
  return (gs.defenseEnemies || []).find(e => (e.isBoss || e.isMidBoss) && !e.dead && !e.reached) || null;
}

// ─── 하단 장판 ───────────────────────────────────────────────────────────────
// 보스는 가까이 붙어서 때리지 않는다. 바닥에 원을 예고하고, 잠시 뒤 터진다.
// 서 있으면 맞고, 비키면 안 맞는다 — 스펙이 아니라 손이 푸는 문제로 만들려는 것이다.
function bossFieldDamage(gs) {
  const tier = (typeof endlessTier === 'function') ? endlessTier(gs.wave) : 1;
  return Math.max(6, Math.round(8 + tier * 1.6));
}

function bossSpawnField(gs, x, y, r) {
  const b = bossState(gs);
  b.fields.push({
    x, y,
    r: r || (36 + Math.random() * 26),
    warn: RAID_FIELD_WARN,
    life: 0.55,
    dmg: bossFieldDamage(gs),
    hit: false,
  });
}

function bossSpawnFieldBurst(gs, n) {
  for (let i = 0; i < (n || 3); i++) {
    bossSpawnField(gs,
      ARENA_X + 30 + Math.random() * (ARENA_W - 60),
      ARENA_Y + 30 + Math.random() * (ARENA_H - 60));
  }
}

// 장판 진행 — 예고가 끝나면 터지고, 그 안에 있는 아군이 맞는다
function bossUpdateFields(gs, dt) {
  const b = bossState(gs);
  if (!b.active || b.side !== 'bottom') return;

  // 주기적으로 새 장판. 체력이 깎일수록 촘촘해진다.
  const pace = Math.max(0.9, 2.6 - b.broken * 0.18);
  b.fieldTimer -= dt;
  if (b.fieldTimer <= 0) {
    b.fieldTimer = pace;
    bossSpawnFieldBurst(gs, 1 + (Math.random() < 0.35 ? 1 : 0));
  }

  for (let i = b.fields.length - 1; i >= 0; i--) {
    const f = b.fields[i];
    if (f.warn > 0) {
      f.warn -= dt;
      if (f.warn <= 0 && !f.hit) {
        f.hit = true;
        // 터진다 — 원 안의 아군만 맞는다
        for (const u of (gs.battle?.ourTeam || [])) {
          if (u.dead) continue;
          if (Math.hypot((u.x || 0) - f.x, (u.y || 0) - f.y) <= f.r) {
            u.hp = Math.max(0, u.hp - f.dmg);
            if (u.hp <= 0) u.dead = true;
            if (typeof spawnFloaty === 'function')
              spawnFloaty(`-${f.dmg}`, u.x, u.y - 12, '#f87171');
          }
        }
        if (typeof FX !== 'undefined') FX.burst(f.x, f.y, '#f43f5e', 16, f.r * 0.5);
      }
    } else {
      f.life -= dt;
      if (f.life <= 0) b.fields.splice(i, 1);
    }
  }
}

// ─── 진행 ────────────────────────────────────────────────────────────────────
function bossUpdate(gs, dt) {
  const b = bossState(gs);
  if (!b.active) return;

  // 기믹 지속시간
  for (const k of Object.keys(b.effects)) {
    b.effects[k] -= dt;
    if (b.effects[k] <= 0) delete b.effects[k];
  }
  if (b.log) { b.log.until -= dt; if (b.log.until <= 0) b.log = null; }

  if (b.side === 'bottom') {
    bossUpdateFields(gs, dt);
    b.timeLeft -= dt;
    if (b.timeLeft <= 0) b.failed = true;
    // 전멸해도 패배
    const alive = (gs.battle?.ourTeam || []).some(u => !u.dead);
    if (!alive) b.failed = true;
  }
}

// 상단 보스가 경로를 한 바퀴 돌았다
function bossLapDone(gs) {
  const b = bossState(gs);
  if (!b.active || b.side !== 'top') return false;
  b.laps++;
  if (typeof addLog === 'function' && gs.battle)
    addLog(gs.battle, `👹 ${b.laps}/${b.lapsMax}바퀴`, '#f59e0b');
  return b.laps >= b.lapsMax;
}

// ─── 화면에 쓰는 값 ──────────────────────────────────────────────────────────
// 영웅 체력을 1000x10 꼴로 줄여 적는다. 만 단위가 넘어가면 자릿수만 늘어나
// 읽히지 않기 때문이다.
function heroHpShort(v) {
  const n = Math.max(0, Math.round(v || 0));
  if (n < 10000) return `${n}`;
  const mul = Math.pow(10, Math.floor(Math.log10(n)) - 3);
  return `${Math.round(n / mul)}x${mul}`;
}

function bossBarText(gs) {
  const b = bossState(gs);
  if (!b.active) return '';
  return b.side === 'top'
    ? `${b.laps}/${b.lapsMax}바퀴`
    : `${Math.max(0, Math.ceil(b.timeLeft))}초`;
}

// ─── 🏺 유물 ──────────────────────────────────────────────────────────────────
// 보스를 잡아야만 나온다. 캠프에서 끼우고, 판을 넘어 남는다.
// 스탯을 올리는 것과 규칙을 바꾸는 것을 섞었다 — 숫자만 있으면 "더 센 것"
// 하나가 정답이 되고, 규칙만 있으면 초반에 쓸 것이 없다.
const RELIC_SLOTS = 3;

const RELICS = [
  { id:'r_core',   name:'파열의 핵',   icon:'🔴', rarity:1,
    desc:'타워 공격력 +12%',        apply:b => { b.towerDmgMult *= 1.12; } },
  { id:'r_gear',   name:'맞물린 톱니', icon:'⚙️', rarity:1,
    desc:'타워 공격속도 +12%',      apply:b => { b.towerSpdMult *= 1.12; } },
  { id:'r_banner', name:'낡은 군기',   icon:'🚩', rarity:1,
    desc:'부대 체력·공격력 +10%',   apply:b => { b.unitHpMult *= 1.10; b.unitAtkMult *= 1.10; } },
  { id:'r_wall',   name:'성벽의 조각', icon:'🧱', rarity:1,
    desc:'기지 최대 HP +25%',       apply:b => { b.baseHpMax += BASE_HP_MAX * 0.25; } },
  { id:'r_crown',  name:'그을린 왕관', icon:'👑', rarity:2,
    desc:'영웅 전 스탯 +15%',       apply:b => { b.heroStatMult *= 1.15; } },
  { id:'r_lens',   name:'예언의 렌즈', icon:'🔮', rarity:2,
    desc:'카드 선택지 +1장',        apply:b => { b.cardHandBonus = (b.cardHandBonus||0) + 1; } },
  { id:'r_purse',  name:'밑빠진 주머니', icon:'👝', rarity:2,
    desc:'상단 골드 수입 +30%',     apply:b => { b.defenseGoldMult *= 1.30; } },
  { id:'r_gem',    name:'심연의 결정', icon:'💠', rarity:3,
    desc:'보석 획득 +20%',          apply:b => { b.gemMult *= 1.20; } },
  { id:'r_phoenix',name:'불사조 깃털', icon:'🪶', rarity:3,
    desc:'영웅이 즉시 부활합니다',  apply:b => { b.heroInstantRevive = true; } },
];
function relicDef(id) { return RELICS.find(r => r.id === id) || null; }

function relicState(gs) {
  if (!gs.relics) gs.relics = { owned:[], equipped:[] };
  if (!Array.isArray(gs.relics.owned))    gs.relics.owned = [];
  if (!Array.isArray(gs.relics.equipped)) gs.relics.equipped = [];
  return gs.relics;
}
function relicOwnedCount(gs, id) {
  return relicState(gs).owned.filter(x => x === id).length;
}
function relicEquipped(gs, id) { return relicState(gs).equipped.includes(id); }

// 끼우기 / 빼기. 칸이 다 찼으면 못 낀다.
function toggleRelic(gs, id) {
  const r = relicState(gs);
  const i = r.equipped.indexOf(id);
  if (i >= 0) { r.equipped.splice(i, 1); return true; }
  if (!relicOwnedCount(gs, id)) return false;
  if (r.equipped.length >= RELIC_SLOTS) return false;
  r.equipped.push(id);
  return true;
}
// 같은 유물이 둘 이상이면 판다. 끼운 것 하나는 남긴다.
function relicSellValue(id) {
  const d = relicDef(id);
  return d ? 120 * d.rarity : 60;
}
function sellRelic(gs, id) {
  const r = relicState(gs);
  const have = relicOwnedCount(gs, id);
  if (have <= 1) return 0;                 // 마지막 하나는 못 판다
  const i = r.owned.indexOf(id);
  if (i < 0) return 0;
  r.owned.splice(i, 1);
  const v = relicSellValue(id);
  gs.soulStones = (gs.soulStones || 0) + v;
  return v;
}

// 보스를 잡았을 때 — 유물 하나와 보석. '무작위'를 골랐으면 더 준다.
function grantBossReward(gs) {
  const b = bossState(gs);
  const mult = b.wasRandom ? BOSS_RANDOM_REWARD : 1;
  // 등급은 마왕일수록 좋은 쪽이 잘 나온다
  const pool = RELICS.filter(r => b.kind === 'lord' ? true : r.rarity <= 2);
  const weights = pool.map(r => (b.kind === 'lord' ? (4 - r.rarity) : (3 - r.rarity)) * 10);
  let total = weights.reduce((a, x) => a + x, 0), roll = Math.random() * total, got = pool[0];
  for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) { got = pool[i]; break; } }

  relicState(gs).owned.push(got.id);
  const gems = Math.round((b.kind === 'lord' ? 60 : 18) * mult);
  gs.soulStones = (gs.soulStones || 0) + gems;
  gs.stats.totalGems = (gs.stats.totalGems || 0) + gems;
  b.reward = { relic: got.id, gems, mult };

  if (typeof addLog === 'function' && gs.battle)
    addLog(gs.battle, `🏺 ${got.icon} ${got.name} 획득! 💎+${gems}${b.wasRandom ? ' (무작위 우대)' : ''}`, '#fbbf24');
  if (typeof spawnFloaty === 'function')
    spawnFloaty(`🏺 ${got.name}`, CW/2, CH/2 - 40, '#fbbf24');
  if (typeof SaveManager !== 'undefined') SaveManager.save(gs);
  return got;
}

// 장착한 유물을 BONUSES에 얹는다 — reapplyAllBonuses가 부른다
function applyRelics(gs) {
  for (const id of relicState(gs).equipped) {
    const d = relicDef(id);
    if (d && d.apply) { try { d.apply(BONUSES); } catch (e) {} }
  }
}
