'use strict';

// ─── 보너스 기본값 ────────────────────────────────────────────────────────────
function createDefaultBonuses() {
  return {
    // 타워
    towerDmg: 0, towerSpdMult: 1.0, towerRangeMult: 1.0,
    towerCostDiscount: 0, towerSplash: false,
    // 유닛
    unitAtk: 0, unitHp: 0, unitDef: 0,
    hireCostDiscount: 0, maxSlotBonus: 0,
    killHeal: 0, comboChance: 0,
    undying: false, undyingUsed: false,
    // 케이브/전투
    battleGoldMult: 1.0, mobHpMult: 1.0, spawnSpeedMult: 1.0,
    // 영웅
    heroAtk: 0, heroRegen: 0, heroAura: 0,
    heroExpMult: 1.0, heroInstantRevive: false,
    heroStartExp: 0, heroReviveReduction: 0, heroStatMult: 1.0,
    // 기지
    baseHpMax: 0, baseDefPct: 0, baseRegen: 0,
    // 자원
    startGoldBonus: 0,
  };
}

// 현재 실행 중인 보너스 (전역 참조)
let BONUSES = createDefaultBonuses();

function resetBonuses() { BONUSES = createDefaultBonuses(); }

// ─── 강화 카드 정의 ────────────────────────────────────────────────────────────
const UPGRADE_CARDS = [
  // ── 타워 ──────────────────────────────────────────────────────────────────
  { id:'t_dmg1',    name:'날카로운 화살', desc:'타워 공격력 +3',       grade:'common', icon:'🏹', cat:'tower',
    apply: b => { b.towerDmg += 3; } },
  { id:'t_spd1',    name:'빠른 발사',     desc:'타워 공격속도 +20%',   grade:'common', icon:'🏹', cat:'tower',
    apply: b => { b.towerSpdMult *= 1.2; } },
  { id:'t_range1',  name:'긴 사거리',     desc:'타워 사거리 +15%',     grade:'common', icon:'🏹', cat:'tower',
    apply: b => { b.towerRangeMult *= 1.15; } },
  { id:'t_dmg2',    name:'강철 화살',     desc:'타워 공격력 +6',       grade:'rare',   icon:'🏹', cat:'tower',
    apply: b => { b.towerDmg += 6; } },
  { id:'t_spd2',    name:'속사 장치',     desc:'타워 공격속도 +50%',   grade:'rare',   icon:'🏹', cat:'tower',
    apply: b => { b.towerSpdMult *= 1.5; } },
  { id:'t_range2',  name:'저격 망원경',   desc:'타워 사거리 +30%',     grade:'rare',   icon:'🏹', cat:'tower',
    apply: b => { b.towerRangeMult *= 1.3; } },
  { id:'t_thunder', name:'천둥 화살',     desc:'타워 피격 시 주변 범위 피해', grade:'epic', icon:'⚡', cat:'tower',
    apply: b => { b.towerSplash = true; } },
  { id:'t_ice',     name:'얼음 화살',     desc:'타워 공격력 +4, 사거리 +20%', grade:'epic', icon:'❄️', cat:'tower',
    apply: b => { b.towerDmg += 4; b.towerRangeMult *= 1.2; } },

  // ── 유닛 ──────────────────────────────────────────────────────────────────
  { id:'u_atk1',    name:'훈련 강화',     desc:'아군 공격력 +3',       grade:'common', icon:'⚔️', cat:'unit',
    apply: b => { b.unitAtk += 3; } },
  { id:'u_def1',    name:'철벽 방어',     desc:'아군 방어력 +2',       grade:'common', icon:'🛡️', cat:'unit',
    apply: b => { b.unitDef += 2; } },
  { id:'u_hp1',     name:'강인한 체력',   desc:'아군 HP +15',          grade:'common', icon:'💪', cat:'unit',
    apply: b => { b.unitHp += 15; } },
  { id:'u_lifesteal',name:'전투 의지',    desc:'처치 시 아군 HP 5 회복', grade:'rare', icon:'❤️', cat:'unit',
    apply: b => { b.killHeal += 5; } },
  { id:'u_combo',   name:'연속 공격',     desc:'틱당 20% 추가 공격',   grade:'rare',   icon:'⚔️', cat:'unit',
    apply: b => { b.comboChance += 0.2; } },
  { id:'u_epic1',   name:'영웅적 전투',   desc:'공격력 +8, HP +30',    grade:'epic',   icon:'🔥', cat:'unit',
    apply: b => { b.unitAtk += 8; b.unitHp += 30; } },
  { id:'u_undying', name:'불굴의 의지',   desc:'아군 최초 사망 시 HP 1 생존', grade:'epic', icon:'✨', cat:'unit',
    apply: b => { b.undying = true; } },
  { id:'u_slot',    name:'용병 모집',     desc:'병력 슬롯 +1',         grade:'rare',   icon:'⚔️', cat:'unit',
    apply: b => { b.maxSlotBonus += 1; } },

  // ── 케이브 ────────────────────────────────────────────────────────────────
  { id:'c_gold1',   name:'풍부한 광맥',   desc:'전투 골드 +25%',       grade:'common', icon:'💰', cat:'cave',
    apply: b => { b.battleGoldMult *= 1.25; } },
  { id:'c_weak',    name:'약한 몹',       desc:'몬스터 HP -15%',       grade:'common', icon:'🗿', cat:'cave',
    apply: b => { b.mobHpMult *= 0.85; } },
  { id:'c_rush',    name:'몬스터 러시',   desc:'스폰 빠르고 골드 +30%', grade:'rare',  icon:'🗿', cat:'cave',
    apply: b => { b.battleGoldMult *= 1.3; b.spawnSpeedMult *= 1.5; } },
  { id:'c_eldorado',name:'엘도라도',      desc:'처치 보상 ×2',         grade:'epic',   icon:'🌟', cat:'cave',
    apply: b => { b.battleGoldMult *= 2.0; } },

  // ── 영웅 ──────────────────────────────────────────────────────────────────
  { id:'h_atk1',    name:'용기의 기운',   desc:'영웅 공격력 +5',       grade:'common', icon:'👑', cat:'hero',
    apply: b => { b.heroAtk += 5; } },
  { id:'h_regen',   name:'회복의 기운',   desc:'영웅 틱마다 HP +3 재생', grade:'common', icon:'👑', cat:'hero',
    apply: b => { b.heroRegen += 3; } },
  { id:'h_aura',    name:'영웅의 오라',   desc:'아군 전체 방어력 +3',  grade:'rare',   icon:'👑', cat:'hero',
    apply: b => { b.heroAura += 3; } },
  { id:'h_exp',     name:'급성장',        desc:'영웅 EXP +100%',       grade:'rare',   icon:'👑', cat:'hero',
    apply: b => { b.heroExpMult *= 2.0; } },
  { id:'h_immortal',name:'불사의 영웅',   desc:'영웅 즉시 부활',       grade:'epic',   icon:'👑', cat:'hero',
    apply: b => { b.heroInstantRevive = true; } },
  { id:'h_power',   name:'신의 강림',     desc:'영웅 모든 스탯 +20%',  grade:'epic',   icon:'👑', cat:'hero',
    apply: b => { b.heroStatMult *= 1.2; b.heroAtk += 5; } },

  // ── 기지 ──────────────────────────────────────────────────────────────────
  { id:'b_heal',    name:'성벽 보수',     desc:'기지 HP +20 회복',     grade:'common', icon:'🏰', cat:'base',
    apply: (b, gs) => { gs.baseHP = Math.min(BASE_HP_MAX + b.baseHpMax, gs.baseHP + 20); } },
  { id:'b_fort',    name:'견고한 기지',   desc:'기지 최대HP +20, 즉시 회복', grade:'rare', icon:'🏰', cat:'base',
    apply: (b, gs) => { b.baseHpMax += 20; gs.baseHP = Math.min(BASE_HP_MAX + b.baseHpMax, gs.baseHP + 20); } },
  { id:'b_wall',    name:'철옹성',        desc:'기지 피해 -20%',       grade:'epic',   icon:'🏰', cat:'base',
    apply: b => { b.baseDefPct += 0.2; } },

  // ── 자원 ──────────────────────────────────────────────────────────────────
  { id:'r_gold1',   name:'황금 손길',     desc:'즉시 골드 +15',        grade:'common', icon:'💰', cat:'resource',
    apply: (b, gs) => { gs.gold += 15; } },
  { id:'r_gold2',   name:'보물 창고',     desc:'즉시 골드 +35',        grade:'rare',   icon:'💰', cat:'resource',
    apply: (b, gs) => { gs.gold += 35; } },
  { id:'r_discount',name:'무기 할인',     desc:'병력 고용비용 -1',     grade:'common', icon:'💰', cat:'resource',
    apply: b => { b.hireCostDiscount += 1; } },
];

// ─── 메타 업그레이드 정의 ──────────────────────────────────────────────────────
const META_UPGRADES = [
  { id:'m_base_hp',    name:'기지 증축',    icon:'🏰', cat:'base',     maxLv:5, cost:10,
    desc: lv => `기지 최대 HP +${lv*20}` },
  { id:'m_base_def',   name:'철벽 방어구',  icon:'🏰', cat:'base',     maxLv:4, cost:15,
    desc: lv => `기지 피해 -${lv*5}%` },
  { id:'m_base_regen', name:'긴급 수리',    icon:'🏰', cat:'base',     maxLv:3, cost:25,
    desc: lv => `웨이브 시작 HP +${lv*10}` },
  { id:'m_slot',       name:'훈련소 확장',  icon:'⚔️', cat:'unit',     maxLv:2, cost:20,
    desc: lv => `병력 슬롯 +${lv}` },
  { id:'m_unit_atk',   name:'전투 훈련',    icon:'⚔️', cat:'unit',     maxLv:5, cost:12,
    desc: lv => `아군 공격력 +${lv*2}` },
  { id:'m_unit_hp',    name:'체력 강화',    icon:'⚔️', cat:'unit',     maxLv:5, cost:12,
    desc: lv => `아군 HP +${lv*10}` },
  { id:'m_hire_cost',  name:'고용 할인',    icon:'⚔️', cat:'unit',     maxLv:3, cost:20,
    desc: lv => `고용 비용 -${lv}` },
  { id:'m_tower_dmg',  name:'정밀 조준',    icon:'🏹', cat:'tower',    maxLv:5, cost:10,
    desc: lv => `타워 공격력 +${lv*2}` },
  { id:'m_tower_spd',  name:'연사 기계',    icon:'🏹', cat:'tower',    maxLv:4, cost:15,
    desc: lv => `타워 공속 +${lv*15}%` },
  { id:'m_tower_cost', name:'요새화',       icon:'🏹', cat:'tower',    maxLv:3, cost:20,
    desc: lv => `타워 건설비용 -${lv}` },
  { id:'m_hero_exp',   name:'영웅 훈련',    icon:'👑', cat:'hero',     maxLv:3, cost:10,
    desc: lv => `영웅 시작 EXP +${lv*20}` },
  { id:'m_hero_revive',name:'빠른 부활',    icon:'👑', cat:'hero',     maxLv:4, cost:15,
    desc: lv => `부활 시간 -${lv*2}초` },
  { id:'m_hero_stat',  name:'영웅의 유산',  icon:'👑', cat:'hero',     maxLv:3, cost:30,
    desc: lv => `영웅 스탯 +${lv*10}%` },
  { id:'m_start_gold', name:'시작 자금',    icon:'💰', cat:'resource', maxLv:5, cost:8,
    desc: lv => `초기 골드 +${lv*5}` },
  { id:'m_kill_gold',  name:'처치 보너스',  icon:'💰', cat:'resource', maxLv:4, cost:15,
    desc: lv => `전투 골드 +${lv*10}%` },
];

// ─── 랜덤 카드 3장 뽑기 ──────────────────────────────────────────────────────
function rollUpgradeCards() {
  const weights = UPGRADE_CARDS.map(c =>
    c.grade === 'common' ? 60 : c.grade === 'rare' ? 28 : 12
  );
  const total = weights.reduce((a, b) => a + b, 0);
  const picked = [], used = new Set();

  while (picked.length < 3 && used.size < UPGRADE_CARDS.length) {
    let r = Math.random() * total;
    for (let i = 0; i < UPGRADE_CARDS.length; i++) {
      if (used.has(i)) continue;
      r -= weights[i];
      if (r <= 0) { picked.push(UPGRADE_CARDS[i]); used.add(i); break; }
    }
  }
  return picked;
}

// ─── 카드 효과 적용 ───────────────────────────────────────────────────────────
function applyUpgradeCard(card, gs) {
  card.apply(BONUSES, gs);
  gs.activeUpgrades.push(card.id);
  // 슬롯 추가는 즉시 battle.maxSlots에 반영
  gs.battle.maxSlots = 4 + BONUSES.maxSlotBonus;
}

// ─── 메타 업그레이드를 BONUSES에 반영 ────────────────────────────────────────
function applyMetaUpgrades(gs) {
  const mu = gs.metaUpgrades;
  const b  = BONUSES;
  const lv = id => mu[id] || 0;

  b.baseHpMax          += lv('m_base_hp') * 20;
  b.baseDefPct         += lv('m_base_def') * 0.05;
  b.baseRegen          += lv('m_base_regen') * 10;
  b.maxSlotBonus       += lv('m_slot');
  b.unitAtk            += lv('m_unit_atk') * 2;
  b.unitHp             += lv('m_unit_hp') * 10;
  b.hireCostDiscount   += lv('m_hire_cost');
  b.towerDmg           += lv('m_tower_dmg') * 2;
  b.towerSpdMult       *= (1 + lv('m_tower_spd') * 0.15);
  b.towerCostDiscount  += lv('m_tower_cost');
  b.heroStartExp       += lv('m_hero_exp') * 20;
  b.heroReviveReduction += lv('m_hero_revive') * 2;
  b.heroStatMult       *= (1 + lv('m_hero_stat') * 0.10);
  b.startGoldBonus     += lv('m_start_gold') * 5;
  b.battleGoldMult     *= (1 + lv('m_kill_gold') * 0.10);
}

// ─── 영혼석 계산 ──────────────────────────────────────────────────────────────
function calcSoulStones(gs) {
  const wavesCleared = gs.wave;
  const hpBonus   = Math.floor(gs.baseHP * 0.2);
  const caveBonus = gs.caveLevel * 3;
  return Math.max(1, wavesCleared * 5 + hpBonus + caveBonus);
}

// ─── 메타 업그레이드 구매 ─────────────────────────────────────────────────────
function buyMetaUpgrade(upg, gs) {
  const curLv = gs.metaUpgrades[upg.id] || 0;
  if (curLv >= upg.maxLv) return false;
  const cost = upg.cost * (curLv + 1); // 단계마다 비용 증가
  if (gs.soulStones < cost) return false;
  gs.soulStones -= cost;
  gs.metaUpgrades[upg.id] = curLv + 1;
  return true;
}
