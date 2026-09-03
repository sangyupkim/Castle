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
    range:t.range, moveSpd:t.moveSpd, radius:bodyRadius(t.radius),
    ranged:!!t.ranged, isTank:!!t.isTank,
    skillName:t.skillName, skillKind:t.skillKind, skillCd:t.skillCd, skillCdLeft:t.skillCd,
    skillRadius:t.skillRadius||0, skillHits:t.skillHits||1, skillColor:t.skillColor,
    skillAtk:0, healAmt:0, shieldAmt:0,
    x:0, y:0, slotX:0, slotY:0,
    // 🗡️ 도적 — 은신 남은 시간 · 기습 대기 · 주우러 간 드랍
    stealthLeft:0, ambushReady:false, greedTarget:null,
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
  // 🏨 여관의 '명성' — 특수 용병에게만 붙는 배율
  const sp = t.special ? (BONUSES.specialUnitMult || 1) : 1;
  // 🔥 캠프 단련 — 이 병종만 오르는 배율. 조합을 정해 놓고 그쪽을 키우게 한다.
  const cHp  = campUnitMult(u.typeId, 'hp');
  const cAtk = campUnitMult(u.typeId, 'atk');
  const cDef = campUnitMult(u.typeId, 'def');
  u.maxHp     = Math.max(1, Math.round((t.hp + BONUSES.unitHp) * (BONUSES.unitHpMult || 1)
                                       * (BONUSES.pactUnitHpMult || 1) * sp * cHp));
  u.atk       = Math.round((t.atk + BONUSES.unitAtk) * (BONUSES.unitAtkMult || 1) * sp * cAtk);
  // 방어력은 0 아래로 내려가지 않는다 — ★영웅 카드의 대가(방어 -5 등)가 겹치면
  // 음수가 되어 '맞을수록 튼튼해지는' 식으로 뒤집힐 수 있다.
  u.def       = Math.max(0, Math.round((t.def + BONUSES.unitDef + BONUSES.heroAura) * sp * cDef));
  u.skillAtk  = t.skillAtk  ? Math.round((t.skillAtk + BONUSES.unitAtk) * sp * cAtk) : 0;
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
  const atk = Math.round((lv.atk + BONUSES.heroAtk) * sm * BONUSES.sigilHeroAtkMult);
  const hp  = Math.round((lv.hp + BONUSES.heroHpFlat) * sm * BONUSES.sigilHeroHpMult);
  const def = Math.max(0, Math.round((lv.def + BONUSES.heroAura) * sm));
  const A   = HERO_ARENA;
  // 각인이 아레나 스킬을 통째로 갈아치운다 — 이름·종류·쿨다운·범위 전부
  const sg  = activeSigil();
  const sk  = sg.skill;
  return {
    id:++_uid, typeId:'hero', isPlayer:true, isHero:true,
    name:'영웅', icon:'👑', color:COLORS.hero,
    sigil:sg.id,
    hp:Math.min(hp, Math.max(1, hero.hp)), maxHp:hp, atk, def, shield:0,
    atkPeriod:A.atkPeriod / (BONUSES.sigilHeroSpdMult * BONUSES.heroSpdMult), atkCd:0,
    range:A.range * BONUSES.sigilHeroRangeMult * BONUSES.heroRangeMult, moveSpd:A.moveSpd, radius:bodyRadius(A.radius),
    ranged:false, isTank:false,
    skillName:sk.name, skillKind:sk.kind, skillCd:sk.cd, skillCdLeft:sk.cd,
    skillRadius:sk.radius, skillHits:1, skillColor:sk.color,
    skillAtk:Math.floor(atk * sk.mult * BONUSES.sigilSkillMult * BONUSES.heroSkillMult),
    healAmt:0,
    // 🛡 수호자의 함성은 최대 HP에 비례한다 — 단단할수록 부대를 더 감싼다
    shieldAmt: sk.kind === 'bulwark' ? Math.max(6, Math.round(hp * 0.32)) : 0,
    x:0, y:0, slotX:0, slotY:0,
    // 🗡️ 도적 — 은신 남은 시간 · 기습 대기 · 주우러 간 드랍
    stealthLeft:0, ambushReady:false, greedTarget:null,
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
// 같은 용병을 더 뽑을수록 값이 오른다. 정액이던 시절에는 골드가 모이는 순간
// **가장 센 용병 하나로 칸을 다 채우는 것**이 늘 정답이었다 — 고를 것이 없으면
// 편성은 결정이 아니라 절차가 된다. 종류마다 따로 오르므로, 값이 오른 쪽 대신
// 아직 싼 다른 종류를 섞는 선택지가 생긴다.
const HIRE_STEP     = 1.34;   // 같은 종류 한 명 늘 때마다 이만큼
const HIRE_STEP_CAP = 6;      // 이 이상은 안 오른다 (칸을 다 채워도 계산이 터지지 않게)

function hireCountOf(battle, typeId) {
  if (!battle || !Array.isArray(battle.ourTeam)) return 0;
  return battle.ourTeam.filter(u => !u.isHero && u.typeId === typeId).length;
}

// n번째(0부터)로 뽑는 그 종류의 값
function hireCostAt(typeId, n) {
  const t = UNIT_TYPES[typeId];
  if (!t) return 1;
  // 특수 용병은 여관에 뜬 그 자리를 사는 것이라 '더 뽑을수록'이 성립하지 않는다
  const step = t.special ? 1
    : Math.pow(HIRE_STEP, Math.min(HIRE_STEP_CAP, Math.max(0, n | 0)));
  const base = t.cost * step;
  return Math.max(1, Math.round(base * (1 - Math.min(0.75, BONUSES.hireCostPct || 0)))
                     - BONUSES.hireCostDiscount);
}

// battle을 넘기면 지금 편성 기준의 '다음 한 명' 값. 안 넘기면 첫 명 값.
function hireCost(typeId, battle) {
  return hireCostAt(typeId, hireCountOf(battle, typeId));
}

function hireUnit(battle, typeId, gold) {
  const t = UNIT_TYPES[typeId];
  if (!t) return gold;
  const cost = hireCost(typeId, battle);
  if (gold < cost) return gold;

  if (t.special) {
    // 이번 웨이브에 여관에 와 있어야 하고, 전용 슬롯을 쓴다
    if (typeof gs === 'undefined' || !availableSpecialUnits(gs).includes(typeId)) return gold;
    if (specialHiredCount(battle) >= specialSlotMax()) return gold;
    battle.ourTeam.push(makeUnit(typeId));
    // 고용하면 그 자리는 사라진다 — 같은 웨이브에 둘을 뽑을 수 없다
    const i = gs.innOffers.indexOf(typeId);
    if (i >= 0) gs.innOffers.splice(i, 1);
    return gold - cost;
  }

  if (!isUnlocked(typeId)) return gold;
  const normal = battle.ourTeam.filter(u => !u.isHero && !(UNIT_TYPES[u.typeId]||{}).special).length;
  if (normal >= battle.maxSlots) return gold;
  battle.ourTeam.push(makeUnit(typeId));
  return gold - cost;
}

function fireUnit(battle, idx) {
  if (idx < 0 || idx >= battle.ourTeam.length) return 0;
  const u = battle.ourTeam[idx];
  if (u.isHero) return 0;
  // 값이 오르는 만큼, 돌려받는 것도 **방금 낸 그 값**의 절반이어야 한다.
  // 늘 첫 명 값으로 돌려주면 비싸게 뽑고 싸게 무르는 구멍이 된다.
  const refund = Math.floor(hireCostAt(u.typeId, hireCountOf(battle, u.typeId) - 1) / 2);
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
