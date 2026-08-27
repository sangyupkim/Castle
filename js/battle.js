'use strict';

// 유닛 생성 · 스탯 계산 · 고용/해고만 담당한다.
// 전투 진행(이동 · 충돌 · 타게팅 · 스킬 발동)은 arena.js로 옮겼다.

let _uid = 0;

// ─── 유닛 생성 ────────────────────────────────────────────────────────────────
function makeUnit(typeId) {
  const t = UNIT_TYPES[typeId];
  const u = {
    id:++_uid, typeId, isPlayer:true, isHero:false,
    name:t.name, icon:t.icon, color:t.color,
    hp:0, maxHp:0, atk:0, def:0, shield:0,
    // 실시간 전투 필드
    atkPeriod:t.atkPeriod, atkCd:0,
    range:t.range, moveSpd:t.moveSpd, radius:t.radius,
    ranged:!!t.ranged, isTank:!!t.isTank,
    skillName:t.skillName, skillKind:t.skillKind, skillCd:t.skillCd, skillCdLeft:t.skillCd,
    skillRadius:t.skillRadius||0, skillHits:t.skillHits||1, skillColor:t.skillColor,
    skillAtk:0, healAmt:0, shieldAmt:0,
    x:0, y:0, slotX:0, slotY:0,
    dead:false, undyingUsed:false,
    flashTimer:0, flashColor:'#fff'
  };
  applyUnitStats(u, 1);
  return u;
}

// 현재 BONUSES를 유닛에 반영. hpRatio를 주면 그 비율로 HP를 맞춘다.
function applyUnitStats(u, hpRatio) {
  const t = UNIT_TYPES[u.typeId];
  if (!t) return;
  const ratio = hpRatio !== undefined ? hpRatio : (u.maxHp > 0 ? u.hp / u.maxHp : 1);
  u.maxHp     = Math.max(1, Math.round((t.hp + BONUSES.unitHp) * (BONUSES.pactUnitHpMult || 1)));
  u.atk       = t.atk + BONUSES.unitAtk;
  u.def       = t.def + BONUSES.unitDef + BONUSES.heroAura;
  u.skillAtk  = t.skillAtk  ? t.skillAtk  + BONUSES.unitAtk : 0;
  u.healAmt   = t.healAmt   ? t.healAmt   + BONUSES.healBonus   : 0;
  u.shieldAmt = t.shieldAmt ? t.shieldAmt + BONUSES.shieldBonus : 0;
  u.hp        = Math.max(1, Math.min(u.maxHp, Math.round(u.maxHp * ratio)));
}

// 강화를 산 뒤 이미 고용한 병력에도 즉시 반영
function refreshTeamStats(battle) {
  if (!battle) return;
  for (const u of battle.ourTeam) {
    if (u.isHero || u.dead) continue;
    applyUnitStats(u);
  }
}

// 웨이브 종료 후 생존 병력 휴식 회복
function restHealTeam(battle) {
  const pct = Math.max(0, REST_HEAL_PCT + BONUSES.restHealBonus);
  let healed = 0;
  for (const u of battle.ourTeam) {
    if (u.dead) continue;
    u.shield = 0;
    u.undyingUsed = false;
    const before = u.hp;
    const full = u.isHero && BONUSES.heroFullRest;   // 여관 Lv.3 — 영웅 대접
    u.hp = full ? u.maxHp : Math.min(u.maxHp, u.hp + Math.ceil(u.maxHp * pct));
    healed += Math.max(0, u.hp - before);
  }
  if (healed > 0) {
    const inn = (typeof gs !== 'undefined' && gs.town?.buildings?.inn?.built);
    addLog(battle, `${inn ? '🏨 여관' : '휴식'} — 병력 회복 +${Math.round(healed)}HP`, '#34d399');
  }
}

function makeHeroUnit(hero) {
  const lv  = HERO_LEVELS[hero.level];
  const sm  = BONUSES.heroStatMult;
  const atk = Math.round((lv.atk + BONUSES.heroAtk) * sm);
  const hp  = Math.round(lv.hp * sm);
  const def = Math.round((lv.def + BONUSES.heroAura) * sm);
  const A   = HERO_ARENA;
  return {
    id:++_uid, typeId:'hero', isPlayer:true, isHero:true,
    name:'영웅', icon:'👑', color:COLORS.hero,
    hp:Math.min(hp, Math.max(1, hero.hp)), maxHp:hp, atk, def, shield:0,
    atkPeriod:A.atkPeriod, atkCd:0,
    range:A.range, moveSpd:A.moveSpd, radius:A.radius,
    ranged:false, isTank:false,
    skillName:A.skillName, skillKind:A.skillKind, skillCd:A.skillCd, skillCdLeft:A.skillCd,
    skillRadius:A.skillRadius, skillHits:1, skillColor:A.skillColor,
    skillAtk:Math.floor(atk * A.skillMult), healAmt:0, shieldAmt:0,
    x:0, y:0, slotX:0, slotY:0,
    dead:false, undyingUsed:false,
    flashTimer:0, flashColor:'#fff'
  };
}

// ─── 배틀 상태 ────────────────────────────────────────────────────────────────
function createBattle() {
  return {
    phase: 'hire',       // 'hire' | 'fighting' | 'won' | 'retreated' | 'lost' | 'idle_defeated'
    ourTeam: [],
    maxSlots: 4,
    goldEarned: 0,
    totalGoldEarned: 0,
    killCount: 0,
    runKills: 0,
    log: [],
    floaties: [],
    result: null
  };
}

// ─── 고용 / 해고 ─────────────────────────────────────────────────────────────
function hireCost(typeId) {
  return Math.max(1, UNIT_TYPES[typeId].cost - BONUSES.hireCostDiscount);
}

function hireUnit(battle, typeId, gold) {
  const t = UNIT_TYPES[typeId];
  if (!t) return gold;
  // 특수 용병은 캠프 해금이 아니라 여관 레벨로 열린다
  if (t.special) {
    if (typeof gs === 'undefined' || !availableSpecialUnits(gs).includes(typeId)) return gold;
  } else if (!isUnlocked(typeId)) return gold;
  const cost = hireCost(typeId);
  const nonHero = battle.ourTeam.filter(u => !u.isHero).length;
  if (nonHero >= battle.maxSlots || gold < cost) return gold;
  battle.ourTeam.push(makeUnit(typeId));
  return gold - cost;
}

function fireUnit(battle, idx) {
  if (idx < 0 || idx >= battle.ourTeam.length) return 0;
  const u = battle.ourTeam[idx];
  if (u.isHero) return 0;
  const refund = Math.floor(hireCost(u.typeId) / 2);
  battle.ourTeam.splice(idx, 1);
  return refund;
}

// ─── 전투 시작 ────────────────────────────────────────────────────────────────
function startFighting(battle) {
  if (battle.ourTeam.length === 0) return false;
  battle.phase      = 'fighting';
  battle.killCount  = 0;
  battle.result     = null;
  battle.goldEarned = 0;
  for (const u of battle.ourTeam) {
    u.shield = 0;
    u.undyingUsed = false;
    u.skillCdLeft = u.skillCd;
  }
  return true;
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────
function addLog(battle, text, color) {
  if (!battle) return;
  battle.log.unshift({text, color, timer:2.5});
  if (battle.log.length > 5) battle.log.pop();
}

function addFloaty(battle, text, x, y, color) {
  if (!battle) return;
  battle.floaties.push({text, x, y, vy:-38, life:1.0, color});
  if (battle.floaties.length > 40) battle.floaties.shift();
}

// 플로티/로그 수명 — 전투 종료 후에도 잔여 표시를 정리한다
function updateBattleFx(battle, dt) {
  for (let i = battle.floaties.length - 1; i >= 0; i--) {
    const f = battle.floaties[i];
    f.y += f.vy * dt; f.life -= dt;
    if (f.life <= 0) battle.floaties.splice(i, 1);
  }
  for (let i = battle.log.length - 1; i >= 0; i--) {
    battle.log[i].timer -= dt;
    if (battle.log[i].timer <= 0) battle.log.splice(i, 1);
  }
}
