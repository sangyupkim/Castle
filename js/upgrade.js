'use strict';

// ─── 보너스 기본값 ────────────────────────────────────────────────────────────
function createDefaultBonuses() {
  return {
    // 타워
    towerDmg: 0, towerDmgMult: 1.0, towerSpdMult: 1.0, towerRangeMult: 1.0,
    towerCostDiscount: 0, towerSplash: false, towerPierce: 0, towerSlow: 0,
    // 유닛
    unitAtk: 0, unitHp: 0, unitDef: 0, unitAtkMult: 1.0, unitHpMult: 1.0,
    hireCostDiscount: 0, hireCostPct: 0, maxSlotBonus: 0,
    killHeal: 0, comboChance: 0, critChance: 0,
    healBonus: 0, shieldBonus: 0, mpRegenBonus: 0, restHealBonus: 0,
    regenBonus: 0, heroFullRest: false,
    specialChance: 0, specialSlotBonus: 0, specialUnitMult: 1.0,
    undying: false,
    // 케이브/전투
    battleGoldMult: 1.0, mobHpMult: 1.0, spawnSpeedMult: 1.0,
    eliteChance: 0, dropChance: 0,
    // 영웅
    heroAtk: 0, heroRegen: 0, heroAura: 0,
    // 장비·스킬이 얹는 영웅 전용 값 (각인 배율과 곱해서 쓴다)
    heroHpFlat: 0, heroSpdMult: 1.0, heroRangeMult: 1.0, heroSkillMult: 1.0,
    heroExpMult: 1.0, heroInstantRevive: false,
    heroStartExp: 0, heroReviveReduction: 0, heroStatMult: 1.0,
    // 각인 — 영웅에게만 걸리는 배율. heroStatMult와 곱해서 쓴다.
    sigilHeroAtkMult: 1.0, sigilHeroHpMult: 1.0, sigilHeroSpdMult: 1.0,
    sigilHeroRangeMult: 1.0, sigilSkillMult: 1.0,
    // 기지
    baseHpMax: 0, baseDefPct: 0, baseRegen: 0,
    // 자원
    startGoldBonus: 0, defenseGoldMult: 1.0,
    // 심연 — 스킬 트리 5번째 나무가 얹는 값
    gemMult: 1.0, summonRewardMult: 1.0, eventSoften: 0, overloadCdMult: 1.0,
    // ⚒️ 대장간
    gearPlusBonus: 0, towerSellBonus: 0, fuseLuck: 0,
    // 유닛 공속 (실시간 전투)
    unitAtkSpdMult: 1.0,
    // 서약 — 로비에서 스스로 거는 난이도 (전부 배율형)
    pactDefHpMult: 1.0, pactSpawnMult: 1.0,
    pactArmorBonus: 0, pactEnemySpdMult: 1.0, pactTowerDmgMult: 1.0,
    pactBaseHpMult: 1.0, pactSlotMult: 1.0, pactUnitHpMult: 1.0,
    pactRegenMult: 1.0, pactTowerLevelCap: TOWER_MAX_LEVEL,
    pactNoRepair: false, pactNoOverload: false,
  };
}

// 현재 실행 중인 보너스 (전역 참조)
let BONUSES = createDefaultBonuses();

function resetBonuses() { BONUSES = createDefaultBonuses(); }

// ─── 강화 카드 정의 ────────────────────────────────────────────────────────────
const UPGRADE_CARDS = [
  // 정액 수치 카드는 대부분 배율로 바꿨다. 화살탑 기본 공격력이 2라 "+3"이
  // 1층에서는 2.5배였다가 20층에서는 반올림 오차였다 — 같은 카드가 언제 뽑히느냐로
  // 가치가 100배 달라지면 고를 이유가 없어진다.
  //
  // ── 타워 ──────────────────────────────────────────────────────────────────
  { id:'t_dmg1',    name:'날카로운 화살', desc:'타워 공격력 +20%',     grade:'common', icon:'🏹', cat:'tower',
    apply: b => { b.towerDmgMult *= 1.20; } },
  { id:'t_spd1',    name:'빠른 발사',     desc:'타워 공격속도 +20%',   grade:'common', icon:'🏹', cat:'tower',
    apply: b => { b.towerSpdMult *= 1.2; } },
  { id:'t_range1',  name:'긴 사거리',     desc:'타워 사거리 +15%',     grade:'common', icon:'🏹', cat:'tower',
    apply: b => { b.towerRangeMult *= 1.15; } },
  { id:'t_cheap',   name:'규격 부품',     desc:'타워 건설비 -3',       grade:'common', icon:'🏭', cat:'tower',
    apply: b => { b.towerCostDiscount += 3; } },
  { id:'t_dmg2',    name:'강철 화살',     desc:'타워 공격력 +45%',     grade:'rare',   icon:'🏹', cat:'tower',
    apply: b => { b.towerDmgMult *= 1.45; } },
  { id:'t_spd2',    name:'속사 장치',     desc:'타워 공격속도 +50%',   grade:'rare',   icon:'🏹', cat:'tower',
    apply: b => { b.towerSpdMult *= 1.5; } },
  { id:'t_range2',  name:'저격 망원경',   desc:'타워 사거리 +30%',     grade:'rare',   icon:'🏹', cat:'tower',
    apply: b => { b.towerRangeMult *= 1.3; } },
  { id:'t_pierce',  name:'관통 탄심',     desc:'타워가 적 방어 5 무시', grade:'rare',  icon:'🔩', cat:'tower',
    apply: b => { b.towerPierce += 5; } },
  { id:'t_frost',   name:'서리 코팅',     desc:'모든 타워에 감속 15%', grade:'rare',   icon:'❄️', cat:'tower',
    apply: b => { b.towerSlow += 0.15; } },
  { id:'t_overdrive',name:'과부하 개조',  desc:'과부하 쿨다운 -40%',   grade:'rare',   icon:'⚡', cat:'tower',
    apply: b => { b.overloadCdMult *= 0.6; } },
  { id:'t_thunder', name:'천둥 화살',     desc:'타워 피격 시 주변 범위 피해', grade:'epic', icon:'⚡', cat:'tower',
    apply: b => { b.towerSplash = true; } },
  { id:'t_ice',     name:'얼음 화살',     desc:'타워 공격력 +30%, 사거리 +20%', grade:'epic', icon:'❄️', cat:'tower',
    apply: b => { b.towerDmgMult *= 1.30; b.towerRangeMult *= 1.2; } },
  // 대가가 있는 카드 — 고민할 거리를 만든다
  { id:'t_focus',   name:'집중 포화',     desc:'타워 공격력 +80%, 사거리 -20%', grade:'epic', icon:'🎯', cat:'tower',
    apply: b => { b.towerDmgMult *= 1.80; b.towerRangeMult *= 0.8; } },

  // ── 유닛 ──────────────────────────────────────────────────────────────────
  { id:'u_atk1',    name:'훈련 강화',     desc:'아군 공격력 +12%',     grade:'common', icon:'⚔️', cat:'unit',
    apply: b => { b.unitAtkMult *= 1.12; } },
  { id:'u_def1',    name:'철벽 방어',     desc:'아군 방어력 +3',       grade:'common', icon:'🛡️', cat:'unit',
    apply: b => { b.unitDef += 3; } },
  { id:'u_hp1',     name:'강인한 체력',   desc:'아군 HP +15%',         grade:'common', icon:'💪', cat:'unit',
    apply: b => { b.unitHpMult *= 1.15; } },
  { id:'u_spd1',    name:'날렵한 손놀림', desc:'아군 공격속도 +15%',   grade:'common', icon:'🌀', cat:'unit',
    apply: b => { b.unitAtkSpdMult *= 1.15; } },
  // 자연 회복은 0이 됐다 — 재생은 이제 "사는 것"이다
  { id:'u_regen',   name:'응급 처치',     desc:'전투 이탈 시 초당 최대 HP 0.8% 회복', grade:'common', icon:'🩹', cat:'unit',
    apply: b => { b.regenBonus += 0.008; } },
  { id:'u_regen2',  name:'야전 의무대',   desc:'전투 이탈 시 초당 최대 HP 2% 회복', grade:'rare', icon:'⛑️', cat:'unit',
    apply: b => { b.regenBonus += 0.020; } },
  { id:'u_lifesteal',name:'전투 의지',    desc:'처치 시 아군 HP +2', grade:'rare', icon:'❤️', cat:'unit',
    apply: b => { b.killHeal += 2; } },
  { id:'u_combo',   name:'연속 공격',     desc:'공격 시 20% 추가 타격', grade:'rare',   icon:'⚔️', cat:'unit',
    apply: b => { b.comboChance += 0.2; } },
  { id:'u_crit',    name:'급소 찌르기',   desc:'치명타 확률 +18%',     grade:'rare',   icon:'💥', cat:'unit',
    apply: b => { b.critChance += 0.18; } },
  { id:'u_slot',    name:'용병 모집',     desc:'병력 슬롯 +1',         grade:'rare',   icon:'⚔️', cat:'unit',
    apply: b => { b.maxSlotBonus += 1; } },
  { id:'u_epic1',   name:'영웅적 전투',   desc:'아군 공격력 +30%, HP +30%', grade:'epic', icon:'🔥', cat:'unit',
    apply: b => { b.unitAtkMult *= 1.30; b.unitHpMult *= 1.30; } },
  { id:'u_undying', name:'불굴의 의지',   desc:'아군 최초 사망 시 HP 1 생존', grade:'epic', icon:'✨', cat:'unit',
    apply: b => { b.undying = true; } },
  { id:'u_glass',   name:'결사대',        desc:'아군 공격력 +70%, HP -25%', grade:'epic', icon:'🗡️', cat:'unit',
    apply: b => { b.unitAtkMult *= 1.70; b.unitHpMult *= 0.75; } },

  // ── 케이브 ────────────────────────────────────────────────────────────────
  { id:'c_gold1',   name:'풍부한 광맥',   desc:'전투 골드 +25%',       grade:'common', icon:'💰', cat:'cave',
    apply: b => { b.battleGoldMult *= 1.25; } },
  { id:'c_weak',    name:'약한 몹',       desc:'몬스터 HP -15%',       grade:'common', icon:'🗿', cat:'cave',
    apply: b => { b.mobHpMult *= 0.85; } },
  { id:'c_rush',    name:'몬스터 러시',   desc:'스폰 빠르고 골드 +30%', grade:'rare',  icon:'🗿', cat:'cave',
    apply: b => { b.battleGoldMult *= 1.3; b.spawnSpeedMult *= 1.5; } },
  { id:'c_elite',   name:'정예 사냥터',   desc:'정예 등장 +20%, 골드 +40%', grade:'rare', icon:'⚔️', cat:'cave',
    apply: b => { b.eliteChance += 0.2; b.battleGoldMult *= 1.4; } },
  { id:'c_gem',     name:'보석 광맥',     desc:'이 판의 층당 보석 +30%', grade:'rare', icon:'💎', cat:'cave',
    apply: b => { b.gemMult *= 1.3; } },
  { id:'c_eldorado',name:'엘도라도',      desc:'처치 보상 ×2',         grade:'epic',   icon:'🌟', cat:'cave',
    apply: b => { b.battleGoldMult *= 2.0; } },

  // ── 영웅 ──────────────────────────────────────────────────────────────────
  { id:'h_atk1',    name:'용기의 기운',   desc:'영웅 전체 능력 +8%',   grade:'common', icon:'👑', cat:'hero',
    apply: b => { b.heroStatMult *= 1.08; } },
  { id:'h_regen',   name:'회복의 기운',   desc:'영웅 HP 초당 +1.2 재생', grade:'common', icon:'👑', cat:'hero',
    apply: b => { b.heroRegen += 1.2; } },
  { id:'h_aura',    name:'영웅의 오라',   desc:'아군 전체 방어력 +3',  grade:'rare',   icon:'👑', cat:'hero',
    apply: b => { b.heroAura += 3; } },
  { id:'h_exp',     name:'급성장',        desc:'영웅 EXP +100%',       grade:'rare',   icon:'👑', cat:'hero',
    apply: b => { b.heroExpMult *= 2.0; } },
  { id:'h_skill',   name:'각인 공명',     desc:'영웅 스킬 피해 +50%',  grade:'rare',   icon:'✨', cat:'hero',
    apply: b => { b.heroSkillMult *= 1.5; } },
  { id:'h_immortal',name:'불사의 영웅',   desc:'전사해도 결장 없음',   grade:'epic',   icon:'👑', cat:'hero',
    apply: b => { b.heroInstantRevive = true; } },
  { id:'h_power',   name:'신의 강림',     desc:'영웅 모든 스탯 +25%',  grade:'epic',   icon:'👑', cat:'hero',
    apply: b => { b.heroStatMult *= 1.25; } },

  // ── 기지 ──────────────────────────────────────────────────────────────────
  // once — 집는 순간에만 일어나는 것. 다시 계산할 때 되풀이하면 안 된다.
  // persist — 다시 계산할 때 되살려야 하는 지속 효과.
  { id:'b_heal',    name:'성벽 보수',     desc:'기지 HP 30% 회복',     grade:'common', icon:'🏰', cat:'base', once:true,
    apply: (b, gs) => { const mx = BASE_HP_MAX + b.baseHpMax;
                        gs.baseHP = Math.min(mx, gs.baseHP + Math.ceil(mx * 0.3)); } },
  { id:'b_regen',   name:'자동 수복',     desc:'기지 초당 +0.5 재생',  grade:'common', icon:'🔧', cat:'base',
    apply: b => { b.baseRegen += 0.5; } },
  { id:'b_fort',    name:'견고한 기지',   desc:'기지 최대HP +25%, 즉시 회복', grade:'rare', icon:'🏰', cat:'base',
    persist: b => { b.baseHpMax += Math.round(BASE_HP_MAX * 0.25); },
    apply: (b, gs) => { const add = Math.round(BASE_HP_MAX * 0.25);
                        b.baseHpMax += add; gs.baseHP = Math.min(BASE_HP_MAX + b.baseHpMax, gs.baseHP + add); } },
  { id:'b_wall',    name:'철옹성',        desc:'기지 피해 -20%',       grade:'epic',   icon:'🏰', cat:'base',
    apply: b => { b.baseDefPct += 0.2; } },

  // ── 자원 ──────────────────────────────────────────────────────────────────
  // "즉시 골드 +15/+35"는 뺐다. 2층만 가도 한 판에 수백 골드가 도는데
  // 강화 한 장을 그걸로 채우면 그 선택지는 없는 것과 같다.
  { id:'r_discount',name:'무기 할인',     desc:'병력 고용비용 -25%',   grade:'common', icon:'💰', cat:'resource',
    persist: b => { b.hireCostPct = (b.hireCostPct || 0) + 0.25; },
    apply: b => { b.hireCostPct = (b.hireCostPct || 0) + 0.25; } },
  { id:'r_start',   name:'선불 보급',     desc:'매 층 시작 골드 +40',  grade:'rare',   icon:'📦', cat:'resource',
    apply: b => { b.startGoldBonus += 40; } },
  { id:'r_interest',name:'전시 이자',     desc:'전투 골드 +15%, 시작 골드 +25', grade:'common', icon:'🏦', cat:'resource',
    apply: b => { b.battleGoldMult *= 1.15; b.startGoldBonus += 25; } },
];

// ─── 스킬 트리 정의 ────────────────────────────────────────────────────────────
// ─── 캠프 스킬 트리 v2 ────────────────────────────────────────────────────────
// v1은 노드 하나당 한 번만 찍는 27개짜리였다. 전부 48보석이라 두세 판이면 다 찍혔고,
// 그 뒤로 보석은 쓸 데가 없어졌다 — 26층에서 140개가 남았다는 보고가 그 결과다.
//
// v2는 노드마다 10레벨이다. 레벨이 오를수록 값이 오르고(레벨 × 기본값),
// 아래 줄은 위에서 5레벨을 쌓아야 열린다. 나무도 셋에서 다섯으로 늘렸다.
//
// 효과는 대부분 **배율**로 바꿨다. v1은 타워 공격력을 정액으로 얹었는데,
// 기본 공격력이 2인 화살탑에 +880이 붙으니 층이 아무리 깊어져도 적이 녹았다 —
// 26층까지 무피해로 막힌다는 보고가 정확히 이것이다.
// 배율이면 적 체력 곡선과 같은 축에서 겨루므로 깊이가 의미를 되찾는다.

// 퍼센트 표기 헬퍼 — 트리 설명은 전부 이걸 쓴다
function skpct(x) { return Math.round(x * 1000) / 10 + '%'; }

const SKILL_MAX_LV   = 10;   // 노드 하나가 오를 수 있는 최대 레벨
const SKILL_ROW_GATE = 5;    // 아랫줄을 열려면 윗줄들에 쌓아야 하는 레벨 수

// 레벨 L을 찍는 값 = 기본값 × L. 10레벨까지 다 올리면 기본값 × 55.
function skillLevelCost(sk, level) { return Math.max(1, (sk.cost || 1) * Math.max(1, level)); }
function skillNodeTotal(sk) {
  let t = 0; for (let i = 1; i <= SKILL_MAX_LV; i++) t += skillLevelCost(sk, i); return t;
}

const SKILL_TREES = {
  tower: {
    name: '타워', icon: '🏹', color: '#22c55e',
    skills: [
      { id:'tw_s1', name:'정밀 조준', icon:'🎯', cost:1, row:0, col:1,
        desc:v=>`타워 공격력 +${skpct(v*0.05)}`,      apply:(b,v)=>{ b.towerDmgMult *= 1 + v*0.05; } },
      // 정액 공격력은 뺐다. 화살탑 기본 공격력이 2라 정액 +20이 붙는 순간
      // 타워 종류도 레벨도 의미를 잃는다. 대신 모든 타워에 감속을 얹는다.
      { id:'tw_s2', name:'얼음 도금', icon:'❄️', cost:1, row:1, col:0,
        desc:v=>`모든 타워에 감속 ${skpct(v*0.025)}`, apply:(b,v)=>{ b.towerSlow += v*0.025; } },
      { id:'tw_s3', name:'속사',      icon:'⚡', cost:1, row:1, col:1,
        desc:v=>`타워 공격속도 +${skpct(v*0.04)}`,     apply:(b,v)=>{ b.towerSpdMult *= 1 + v*0.04; } },
      { id:'tw_s4', name:'요새화',    icon:'🏗️', cost:1, row:1, col:2,
        desc:v=>`타워 건설비 -${Math.round(v)}`,     apply:(b,v)=>{ b.towerCostDiscount += Math.round(v); } },
      { id:'tw_s5', name:'저격 조준', icon:'👁️', cost:2, row:2, col:0,
        desc:v=>`타워 사거리 +${skpct(v*0.035)}`,      apply:(b,v)=>{ b.towerRangeMult *= 1 + v*0.035; } },
      { id:'tw_s6', name:'관통탄',    icon:'🔩', cost:2, row:2, col:1,
        desc:v=>`적 방어 무시 +${Math.round(v)}`,    apply:(b,v)=>{ b.towerPierce += Math.round(v); } },
      { id:'tw_s7', name:'연사 기계', icon:'⚙️', cost:2, row:2, col:2,
        desc:v=>`타워 공격속도 +${skpct(v*0.05)}`,     apply:(b,v)=>{ b.towerSpdMult *= 1 + v*0.05; } },
      { id:'tw_s8', name:'폭발 화살', icon:'💥', cost:3, row:3, col:0,
        desc:v=>`범위 피해 · 공격력 +${skpct(v*0.04)}`, apply:(b,v)=>{ b.towerSplash = true; b.towerDmgMult *= 1 + v*0.04; } },
      { id:'tw_s9', name:'타워 숙련', icon:'🌟', cost:3, row:3, col:1,
        desc:v=>`공격력 +${skpct(v*0.05)} · 공속 +${skpct(v*0.03)}`,
        apply:(b,v)=>{ b.towerDmgMult *= 1 + v*0.05; b.towerSpdMult *= 1 + v*0.03; } },
    ]
  },

  unit: {
    name: '병력', icon: '⚔️', color: '#f97316',
    skills: [
      { id:'un_s1', name:'기초 훈련', icon:'⚔️', cost:1, row:0, col:1,
        desc:v=>`아군 공격력 +${Math.round(v*2)}`,   apply:(b,v)=>{ b.unitAtk += v*2; } },
      { id:'un_s2', name:'체력 단련', icon:'💪', cost:1, row:1, col:0,
        desc:v=>`아군 HP +${Math.round(v*10)}`,       apply:(b,v)=>{ b.unitHp += v*10; } },
      { id:'un_s3', name:'방어 훈련', icon:'🛡️', cost:1, row:1, col:1,
        desc:v=>`아군 방어력 +${Math.round(v)}`,      apply:(b,v)=>{ b.unitDef += Math.round(v); } },
      { id:'un_s4', name:'속공',      icon:'🌀', cost:1, row:1, col:2,
        desc:v=>`아군 공격속도 +${skpct(v*0.03)}`,      apply:(b,v)=>{ b.unitAtkSpdMult *= 1 + v*0.03; } },
      { id:'un_s5', name:'급소 교본', icon:'💥', cost:2, row:2, col:0,
        desc:v=>`치명타 확률 +${skpct(v*0.02)}`,        apply:(b,v)=>{ b.critChance += v*0.02; } },
      { id:'un_s6', name:'연계 공격', icon:'🔗', cost:2, row:2, col:1,
        desc:v=>`추가 타격 확률 +${skpct(v*0.025)}`,    apply:(b,v)=>{ b.comboChance += v*0.025; } },
      { id:'un_s7', name:'전장 치유', icon:'💚', cost:2, row:2, col:2,
        desc:v=>`처치 시 아군 회복 +${(v*0.8).toFixed(1)}`, apply:(b,v)=>{ b.killHeal += v*0.8; } },
      { id:'un_s8', name:'정예 부대', icon:'🔥', cost:3, row:3, col:0,
        desc:v=>`아군 공격력 +${Math.round(v*3)} · HP +${Math.round(v*14)}`,
        apply:(b,v)=>{ b.unitAtk += v*3; b.unitHp += v*14; } },
      { id:'un_s9', name:'대열 확장', icon:'➕', cost:3, row:3, col:1, maxLv:4,
        desc:v=>`편성 슬롯 +${Math.round(v)}`,        apply:(b,v)=>{ b.maxSlotBonus += Math.round(v); } },
    ]
  },

  hero: {
    name: '영웅', icon: '👑', color: '#f59e0b',
    skills: [
      { id:'hr_s1', name:'영웅 훈련', icon:'⚔️', cost:1, row:0, col:1,
        desc:v=>`영웅 공격력 +${Math.round(v*3)}`,    apply:(b,v)=>{ b.heroAtk += v*3; } },
      { id:'hr_s2', name:'투사',      icon:'🗡️', cost:1, row:1, col:0,
        desc:v=>`영웅 전체 능력 +${skpct(v*0.03)}`,     apply:(b,v)=>{ b.heroStatMult *= 1 + v*0.03; } },
      { id:'hr_s3', name:'재생',      icon:'💚', cost:1, row:1, col:1,
        desc:v=>`영웅 재생 +${(v*0.5).toFixed(1)}/s`,   apply:(b,v)=>{ b.heroRegen += v*0.5; } },
      { id:'hr_s4', name:'경험 축적', icon:'📖', cost:1, row:1, col:2,
        desc:v=>`영웅 EXP +${skpct(v*0.08)}`,           apply:(b,v)=>{ b.heroExpMult *= 1 + v*0.08; } },
      { id:'hr_s5', name:'지휘 오라', icon:'🎖️', cost:2, row:2, col:0,
        desc:v=>`아군 방어 오라 +${Math.round(v)}`,    apply:(b,v)=>{ b.heroAura += Math.round(v); } },
      { id:'hr_s6', name:'각인 증폭', icon:'✨', cost:2, row:2, col:1,
        desc:v=>`영웅 스킬 피해 +${skpct(v*0.05)}`,      apply:(b,v)=>{ b.heroSkillMult *= 1 + v*0.05; } },
      { id:'hr_s7', name:'질풍',      icon:'🌀', cost:2, row:2, col:2,
        desc:v=>`영웅 공격속도 +${skpct(v*0.03)}`,       apply:(b,v)=>{ b.heroSpdMult *= 1 + v*0.03; } },
      { id:'hr_s8', name:'불굴',      icon:'🔮', cost:3, row:3, col:0, maxLv:5,
        desc:v=>v>=5 ? '전사해도 결장 없음' : `복귀 HP +${Math.round(v*8)}%p`,
        apply:(b,v)=>{ b.heroReviveReduction += v; if (v>=5) b.heroInstantRevive = true; } },
      { id:'hr_s9', name:'영웅 전설', icon:'🌟', cost:3, row:3, col:1,
        desc:v=>`영웅 전체 능력 +${skpct(v*0.04)}`,      apply:(b,v)=>{ b.heroStatMult *= 1 + v*0.04; } },
    ]
  },

  base: {
    name: '기지', icon: '🏰', color: '#60a5fa',
    skills: [
      { id:'bs_s1', name:'성벽 증축', icon:'🏰', cost:1, row:0, col:1,
        desc:v=>`기지 최대 HP +${Math.round(v*12)}`,  apply:(b,v)=>{ b.baseHpMax += v*12; } },
      { id:'bs_s2', name:'철갑',      icon:'🛡️', cost:1, row:1, col:0, maxLv:8,
        desc:v=>`기지 피해 -${skpct(v*0.04)}`,          apply:(b,v)=>{ b.baseDefPct += v*0.04; } },
      { id:'bs_s3', name:'자가 수복', icon:'🔧', cost:1, row:1, col:1,
        desc:v=>`기지 재생 +${(v*0.15).toFixed(1)}/s`, apply:(b,v)=>{ b.baseRegen += v*0.15; } },
      { id:'bs_s4', name:'보급 창고', icon:'📦', cost:1, row:1, col:2,
        desc:v=>`시작 골드 +${Math.round(v*8)}`,       apply:(b,v)=>{ b.startGoldBonus += v*8; } },
      { id:'bs_s5', name:'황금 광맥', icon:'💰', cost:2, row:2, col:0,
        desc:v=>`전투 골드 +${skpct(v*0.05)}`,           apply:(b,v)=>{ b.battleGoldMult *= 1 + v*0.05; } },
      { id:'bs_s6', name:'교대 근무', icon:'🛏️', cost:2, row:2, col:1,
        desc:v=>`웨이브 후 회복 +${skpct(v*0.03)}`,      apply:(b,v)=>{ b.restHealBonus += v*0.03; } },
      { id:'bs_s7', name:'상단 계약', icon:'🤝', cost:2, row:2, col:2,
        desc:v=>`고용비 -${Math.round(v)} · 타워 건설비 -${Math.round(v*0.5)}`,
        apply:(b,v)=>{ b.hireCostDiscount += Math.round(v); b.towerCostDiscount += Math.round(v*0.5); } },
      { id:'bs_s8', name:'난공불락', icon:'🏯', cost:3, row:3, col:0,
        desc:v=>`기지 최대 HP +${Math.round(v*18)} · 재생 +${(v*0.2).toFixed(1)}/s`,
        apply:(b,v)=>{ b.baseHpMax += v*18; b.baseRegen += v*0.2; } },
      { id:'bs_s9', name:'전시 경제', icon:'🏦', cost:3, row:3, col:1,
        desc:v=>`전투 골드 +${skpct(v*0.06)} · 시작 골드 +${Math.round(v*10)}`,
        apply:(b,v)=>{ b.battleGoldMult *= 1 + v*0.06; b.startGoldBonus += v*10; } },
    ]
  },

  // 🌊 심연 — 무한 모드에만 값이 붙는 나무. 깊이 내려갈 사람을 위한 갈래다.
  abyss: {
    name: '심연', icon: '🌊', color: '#a78bfa',
    skills: [
      { id:'ab_s1', name:'심연 적응', icon:'🌊', cost:1, row:0, col:1,
        desc:v=>`적 체력 -${skpct(v*0.015)}`,           apply:(b,v)=>{ b.mobHpMult *= 1 - Math.min(0.30, v*0.015); } },
      { id:'ab_s2', name:'보석 감식', icon:'💎', cost:1, row:1, col:0,
        desc:v=>`층당 보석 +${skpct(v*0.04)}`,           apply:(b,v)=>{ b.gemMult *= 1 + v*0.04; } },
      { id:'ab_s3', name:'현상금 사냥', icon:'🎯', cost:1, row:1, col:1,
        desc:v=>`소환 보상 +${skpct(v*0.06)}`,           apply:(b,v)=>{ b.summonRewardMult *= 1 + v*0.06; } },
      { id:'ab_s4', name:'등불',      icon:'🏮', cost:1, row:1, col:2,
        desc:v=>`불리한 층 이벤트 완화 ${skpct(v*0.05)}`, apply:(b,v)=>{ b.eventSoften += v*0.05; } },
      { id:'ab_s5', name:'과부하 회로', icon:'⚡', cost:2, row:2, col:0,
        desc:v=>`과부하 쿨다운 -${skpct(v*0.05)}`,        apply:(b,v)=>{ b.overloadCdMult *= 1 - Math.min(0.6, v*0.05); } },
      { id:'ab_s6', name:'정예 사냥', icon:'⚔️', cost:2, row:2, col:1,
        desc:v=>`정예 등장 +${skpct(v*0.015)} · 보상 +${skpct(v*0.04)}`,
        apply:(b,v)=>{ b.eliteChance += v*0.015; b.summonRewardMult *= 1 + v*0.04; } },
      { id:'ab_s7', name:'드랍 감지', icon:'🔎', cost:2, row:2, col:2,
        desc:v=>`특수 드랍 확률 +${skpct(v*0.012)}`,      apply:(b,v)=>{ b.dropChance += v*0.012; } },
      { id:'ab_s8', name:'심층 내성', icon:'🌑', cost:3, row:3, col:0,
        desc:v=>`적 이동속도 -${skpct(v*0.02)}`,          apply:(b,v)=>{ b.pactEnemySpdMult *= 1 - Math.min(0.35, v*0.02); } },
      { id:'ab_s9', name:'심연의 부름', icon:'🌟', cost:3, row:3, col:1,
        desc:v=>`층당 보석 +${skpct(v*0.05)} · 적 체력 -${skpct(v*0.01)}`,
        apply:(b,v)=>{ b.gemMult *= 1 + v*0.05; b.mobHpMult *= 1 - Math.min(0.20, v*0.01); } },
    ]
  }
};

const SKILL_V1_REFUND  = 2;   // 구 트리 노드 하나당 환급 보석
const SKILL_TREE_ORDER = ['tower','unit','hero','base','abyss'];

// 한 노드의 현재 레벨
function skillLevel(gs, id) { return (gs.skillLevels && gs.skillLevels[id]) || 0; }
// 그 나무에서 특정 줄보다 위에 쌓인 총 레벨
function treeLevelsAbove(gs, treeId, row) {
  const tree = SKILL_TREES[treeId]; if (!tree) return 0;
  let n = 0;
  for (const sk of tree.skills) if (sk.row < row) n += skillLevel(gs, sk.id);
  return n;
}
function skillMaxLv(sk) { return sk.maxLv || SKILL_MAX_LV; }
// 이 노드를 지금 한 단계 올릴 수 있는가
function skillCanBuy(gs, treeId, sk) {
  const lv = skillLevel(gs, sk.id);
  if (lv >= skillMaxLv(sk)) return { ok:false, why:'max' };
  const need = sk.row * SKILL_ROW_GATE;
  if (treeLevelsAbove(gs, treeId, sk.row) < need) return { ok:false, why:'gate', need };
  const cost = skillLevelCost(sk, lv + 1);
  if ((gs.soulStones || 0) < cost) return { ok:false, why:'gems', cost };
  return { ok:true, cost };
}
function buySkillNode(id, gs) {
  for (const treeId of SKILL_TREE_ORDER) {
    const sk = SKILL_TREES[treeId].skills.find(x => x.id === id);
    if (!sk) continue;
    const chk = skillCanBuy(gs, treeId, sk);
    if (!chk.ok) return false;
    gs.soulStones -= chk.cost;
    gs.skillLevels = gs.skillLevels || {};
    gs.skillLevels[id] = skillLevel(gs, id) + 1;
    reapplyAllBonuses(gs);
    return true;
  }
  return false;
}
function applySkillTree(gs) {
  for (const treeId of SKILL_TREE_ORDER) {
    for (const sk of SKILL_TREES[treeId].skills) {
      const lv = skillLevel(gs, sk.id);
      if (lv > 0) sk.apply(BONUSES, lv);
    }
  }
}
// 트리 전체를 다 올리는 데 드는 보석 (표시용)
function skillTreeTotalCost() {
  let t = 0;
  for (const id of SKILL_TREE_ORDER)
    for (const sk of SKILL_TREES[id].skills)
      for (let i = 1; i <= skillMaxLv(sk); i++) t += skillLevelCost(sk, i);
  return t;
}

// ─── 랜덤 카드 3장 뽑기 ──────────────────────────────────────────────────────
function rollUpgradeCards(taken, count) {
  const owned = new Set(taken || []);
  // 불린/일회성 효과 카드는 이미 뽑았으면 후보에서 제외
  const uniqueOnly = new Set(['t_thunder', 'u_undying', 'h_immortal', 'b_wall', 'c_eldorado',
                              't_focus', 'u_glass', 'u_slot']);
  const pool = UPGRADE_CARDS.filter(c => !(uniqueOnly.has(c.id) && owned.has(c.id)));

  const weights = pool.map(c =>
    c.grade === 'common' ? 60 : c.grade === 'rare' ? 28 : 12
  );
  const picked = [], used = new Set();

  const want = Math.max(1, count || 3);
  while (picked.length < want && used.size < pool.length) {
    let total = 0;
    for (let i = 0; i < pool.length; i++) if (!used.has(i)) total += weights[i];
    if (total <= 0) break;
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      if (used.has(i)) continue;
      r -= weights[i];
      if (r <= 0) { picked.push(pool[i]); used.add(i); break; }
    }
  }
  return picked;
}

// ─── 카드 효과 적용 ───────────────────────────────────────────────────────────
function applyUpgradeCard(card, gs) {
  card.apply(BONUSES, gs);        // 즉시 효과(회복·골드)는 여기서 딱 한 번
  gs.activeUpgrades.push(card.id);
  reapplyAllBonuses(gs);          // 방금 집은 것까지 포함해 전부 다시 계산
  refreshTeamStats(gs.battle);    // 이미 고용한 병력에도 즉시 적용
}

// 편성 슬롯 — 네 군데에서 제각기 계산하고 있었고 그중 둘만 층 이벤트를 반영했다
function recalcMaxSlots(gs) {
  if (!gs || !gs.battle) return;
  gs.battle.maxSlots = Math.max(1,
    Math.floor((4 + BONUSES.maxSlotBonus) * (BONUSES.pactSlotMult || 1)) + fev('slotBonus', 0));
}

// ─── 이번 판에 집은 강화 카드를 BONUSES에 되살린다 ───────────────────────────
// reapplyAllBonuses()가 resetBonuses()로 시작하는데 여기가 빠져 있었다.
// 웨이브가 시작될 때마다 reapply가 돌므로, 집은 카드는 다음 웨이브에 통째로 사라졌다 —
// 용병 슬롯이 한 판만 늘었다가 되돌아가던 것이 이것이고, 실은 모든 카드가 그랬다.
function applyRunUpgrades(gs) {
  for (const id of (gs.activeUpgrades || [])) {
    const c = UPGRADE_CARDS.find(x => x.id === id);
    if (!c) continue;
    if (c.persist)      c.persist(BONUSES);
    else if (!c.once)   c.apply(BONUSES, gs);
  }
}

// ─── 보석 정산 ────────────────────────────────────────────────────────────────
// 구 정산식(도달웨이브 × 5 + 기지HP × 0.2 + 케이브 × 3 + 처치 × 0.3)은
// 1-1만 넘긴 첫 런이 39보석을 줬다 — 스킬 트리 전체가 48보석인데.
// 영구 성장이 두 번째 런 전에 끝나는 문제라, 소비처(스킬 48 + 해금 52 = 100)에
// 맞춰 6~9런 규모로 다시 잡았다.
// 무한이 본편이 되면서 정산도 갈렸다.
//   훈련 — 도달 웨이브 위주. 손에 익히는 곳이므로 수입이 크지 않다.
//   무한 — 층당 적립이 본체고, 깊이 갈수록 층당 몫이 커진다.
function calcSoulStones(gs) {
  const caveTerm = gs.caveLevel;
  const killTerm = Math.floor((gs.battle.runKills || 0) / 60);
  const mult     = pactGemMult() * (gs.gaveUp ? GIVE_UP_GEM_MULT : 1);

  if (gs.mode === 'endless') {
    // 한 층도 못 넘겼으면 정산할 것이 없다.
    // 예전에는 Math.max(1, …) 두 겹이 바닥을 깔아서, 들어가자마자 나가도 보석이 나왔다 —
    // 케이브 레벨이 최소 1이라 항상 1 이상이었고, 기록 갱신 항목까지 붙어 2개씩 나왔다.
    // 아무것도 하지 않은 판에 값을 매기면 그게 최적 전략이 된다.
    const cleared = Math.max(0, gs.wave);              // 실제로 돌파한 층 수
    if (cleared <= 0) return 0;

    const endTerm = Math.floor(gs.endlessGems || 0);
    // 새로 돌파한 층이 벌이의 중심이다. 판 시작 시점의 기록과 견준다 —
    // 판 도중에 갱신되는 값을 쓰면 한 층도 못 넘긴 판이 자기 자신을 갱신한 것으로 쳐서 보너스를 받는다.
    const recTerm = newDepthGems(cleared, gs.runBestAtStart);
    // 케이브 레벨과 처치 수는 **깊이와 무관한 값**이다.
    // 케이브는 새 판에서도 최소 1이라 층 적립이 0이어도 정산이 1이 됐다 —
    // "1층 깨고 바로 나가면 보석 하나"가 정확히 이 항이었다. 되짚는 층에 ×0.1을
    // 걸어 놓고 옆에 정액 1을 두면 그 감액이 통째로 무의미해진다.
    // 그래서 이 둘도 '이번 판에서 새로 판 깊이의 비중'만큼만 받는다.
    const sideMult = repeatSideMult(cleared, gs.runBestAtStart);
    const side = (caveTerm + killTerm) * sideMult;
    return Math.max(0, Math.round((endTerm + recTerm + side) * mult));
  }

  // 훈련 정산 — 아주 적게. 훈련은 심연으로 가기 전에 조작을 익히는 6웨이브짜리 과정이고,
  // 여기서 보석이 모이면 본편을 시작하기도 전에 영구 성장이 끝나 버린다.
  return gs.stageCleared ? TRAINING_CLEAR_GEMS : TRAINING_QUIT_GEMS;
}

// 정산 내역 — 결과 화면에서 그대로 보여준다
function soulStoneBreakdown(gs) {
  const rows = [];
  const mult = pactGemMult();   // 서약 배율만 — 포기 감액은 따로 보여준다

  if (gs.mode === 'endless') {
    const cleared = Math.max(0, gs.wave);
    const start   = gs.runBestAtStart || 0;
    if (cleared <= 0) {
      rows.push({ label:'돌파한 층 없음', value:0, note:'한 층이라도 넘어야 정산이 있습니다' });
      return { rows, mult, gaveUp:!!gs.gaveUp, total: 0 };
    }
    // 새 깊이와 되짚은 층을 갈라 보여준다 — 어디서 벌었는지가 보여야 다음 판이 달라진다.
    // 층 적립은 소수로 쌓이고 총합에서 한 번만 내림하므로, 나눠 적을 때도 합이 총합과 맞아야 한다.
    const rawNew = gs.endlessGemsNew || 0, rawOld = gs.endlessGemsOld || 0;
    const endTerm = Math.floor(rawNew + rawOld);
    const nw = Math.min(endTerm, Math.floor(rawNew));
    const od = endTerm - nw;
    if (cleared > start) {
      rows.push({ label:'∞ 새 깊이', value:nw,
                  note:`${start+1}~${cleared}층 · 처음 닿은 깊이 → ${rawNew.toFixed(1)}` });
    }
    if (start > 0) {
      rows.push({ label:'∞ 되짚은 층', value:od,
                  note:`1~${Math.min(cleared, start)}층 · ×${ENDLESS_REPEAT_MULT} 적용 → ${rawOld.toFixed(1)}` });
    }
    // 케이브·처치는 깊이와 무관한 항이라 '새로 판 깊이의 비중'만큼만 받는다.
    // 그러지 않으면 되짚기 감액 옆에 정액 보석이 남아 얕은 반복이 다시 이득이 된다.
    const sideMult = repeatSideMult(cleared, start);
    const caveRaw  = gs.caveLevel;
    const killRaw  = Math.floor((gs.battle.runKills||0)/60);
    const sideNote = sideMult < 1 ? ` · 되짚기 ×${sideMult.toFixed(2)}` : '';
    rows.push({ label:'케이브 레벨', value:+(caveRaw*sideMult).toFixed(1), note:`Lv.${caveRaw}${sideNote}` });
    rows.push({ label:'처치',        value:+(killRaw*sideMult).toFixed(1), note:`${gs.battle.runKills||0}마리 ÷ 60${sideNote}` });
    if (cleared > start) {
      rows.push({ label:'새로 돌파한 층', value:newDepthGems(cleared, start),
                  note:`${start}층 → ${cleared}층 · ${cleared-start}개 층` });
    }
    return { rows, mult, gaveUp:!!gs.gaveUp, total: calcSoulStones(gs) };
  }

  rows.push({ label: gs.stageCleared ? '훈련 완주' : '훈련 중단',
              value: gs.stageCleared ? TRAINING_CLEAR_GEMS : TRAINING_QUIT_GEMS,
              note: '훈련은 익히는 곳입니다 — 보석은 심연에서 법니다' });
  return { rows, mult, gaveUp:!!gs.gaveUp, total: calcSoulStones(gs) };
}
