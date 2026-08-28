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
  { id:'u_combo',   name:'연속 공격',     desc:'공격 시 20% 추가 타격', grade:'rare',   icon:'⚔️', cat:'unit',
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
  { id:'h_regen',   name:'회복의 기운',   desc:'영웅 HP 초당 +3 재생',  grade:'common', icon:'👑', cat:'hero',
    apply: b => { b.heroRegen += 3; } },
  { id:'h_aura',    name:'영웅의 오라',   desc:'아군 전체 방어력 +3',  grade:'rare',   icon:'👑', cat:'hero',
    apply: b => { b.heroAura += 3; } },
  { id:'h_exp',     name:'급성장',        desc:'영웅 EXP +100%',       grade:'rare',   icon:'👑', cat:'hero',
    apply: b => { b.heroExpMult *= 2.0; } },
  { id:'h_immortal',name:'불사의 영웅',   desc:'전사해도 결장 없음',   grade:'epic',   icon:'👑', cat:'hero',
    apply: b => { b.heroInstantRevive = true; } },
  { id:'h_power',   name:'신의 강림',     desc:'영웅 모든 스탯 +20%',  grade:'epic',   icon:'👑', cat:'hero',
    apply: b => { b.heroStatMult *= 1.2; b.heroAtk += 5; } },

  // ── 기지 ──────────────────────────────────────────────────────────────────
  // once — 집는 순간에만 일어나는 것. 다시 계산할 때 되풀이하면 안 된다.
  // persist — 다시 계산할 때 되살려야 하는 지속 효과.
  { id:'b_heal',    name:'성벽 보수',     desc:'기지 HP +20 회복',     grade:'common', icon:'🏰', cat:'base', once:true,
    apply: (b, gs) => { gs.baseHP = Math.min(BASE_HP_MAX + b.baseHpMax, gs.baseHP + 20); } },
  { id:'b_fort',    name:'견고한 기지',   desc:'기지 최대HP +20, 즉시 회복', grade:'rare', icon:'🏰', cat:'base',
    persist: b => { b.baseHpMax += 20; },
    apply: (b, gs) => { b.baseHpMax += 20; gs.baseHP = Math.min(BASE_HP_MAX + b.baseHpMax, gs.baseHP + 20); } },
  { id:'b_wall',    name:'철옹성',        desc:'기지 피해 -20%',       grade:'epic',   icon:'🏰', cat:'base',
    apply: b => { b.baseDefPct += 0.2; } },

  // ── 자원 ──────────────────────────────────────────────────────────────────
  { id:'r_gold1',   name:'황금 손길',     desc:'즉시 골드 +15',        grade:'common', icon:'💰', cat:'resource', once:true,
    apply: (b, gs) => { gs.gold += 15; } },
  { id:'r_gold2',   name:'보물 창고',     desc:'즉시 골드 +35',        grade:'rare',   icon:'💰', cat:'resource', once:true,
    apply: (b, gs) => { gs.gold += 35; } },
  { id:'r_discount',name:'무기 할인',     desc:'병력 고용비용 -1',     grade:'common', icon:'💰', cat:'resource',
    apply: b => { b.hireCostDiscount += 1; } },
];

// ─── 스킬 트리 정의 ────────────────────────────────────────────────────────────
const SKILL_TREES = {
  tower: {
    name: '타워', icon: '🏹', color: '#22c55e',
    skills: [
      { id:'tw_s1', name:'정밀 조준',   icon:'🎯', cost:1, req:null,   row:0, col:1, desc:'타워 공격력 +6',        apply:b=>{ b.towerDmg+=6; } },
      { id:'tw_s2', name:'강화 화살',   icon:'🏹', cost:1, req:'tw_s1', row:1, col:0, desc:'타워 공격력 +12',       apply:b=>{ b.towerDmg+=12; } },
      { id:'tw_s3', name:'속사',        icon:'⚡', cost:1, req:'tw_s1', row:1, col:1, desc:'타워 공속 +25%',        apply:b=>{ b.towerSpdMult*=1.25; } },
      { id:'tw_s4', name:'요새화',      icon:'🏗️', cost:1, req:'tw_s1', row:1, col:2, desc:'타워 건설 비용 -3',     apply:b=>{ b.towerCostDiscount+=3; } },
      { id:'tw_s5', name:'저격 강화',   icon:'👁️', cost:2, req:'tw_s2', row:2, col:0, desc:'사거리 +25%, 공격력 +8',apply:b=>{ b.towerRangeMult*=1.25; b.towerDmg+=8; } },
      { id:'tw_s6', name:'연사 기계',   icon:'⚡', cost:2, req:'tw_s3', row:2, col:1, desc:'타워 공속 +40%',        apply:b=>{ b.towerSpdMult*=1.40; } },
      { id:'tw_s7', name:'비용 절감',   icon:'💰', cost:2, req:'tw_s4', row:2, col:2, desc:'타워 건설 비용 -4, 사거리+15%',apply:b=>{ b.towerCostDiscount+=4; b.towerRangeMult*=1.15; } },
      { id:'tw_s8', name:'폭발 화살',   icon:'💥', cost:3, req:'tw_s5', row:3, col:0, desc:'타워 범위 피해 + 공격력+15', apply:b=>{ b.towerSplash=true; b.towerDmg+=15; } },
      { id:'tw_s9', name:'타워 마스터', icon:'🌟', cost:3, req:'tw_s6', row:3, col:1, desc:'공속 +30%, 공격력 +20',  apply:b=>{ b.towerSpdMult*=1.30; b.towerDmg+=20; } },
    ]
  },
  hero: {
    name: '영웅', icon: '👑', color: '#f59e0b',
    skills: [
      { id:'hr_s1', name:'영웅 훈련',   icon:'⚔️', cost:1, req:null,   row:0, col:1, desc:'영웅 공격력 +8',         apply:b=>{ b.heroAtk+=8; } },
      { id:'hr_s2', name:'투사',        icon:'🗡️', cost:1, req:'hr_s1', row:1, col:0, desc:'영웅 공격력 +15',        apply:b=>{ b.heroAtk+=15; } },
      { id:'hr_s3', name:'재생',        icon:'💚', cost:1, req:'hr_s1', row:1, col:1, desc:'영웅 HP 재생 +5/초',      apply:b=>{ b.heroRegen+=5; } },
      { id:'hr_s4', name:'경험 축적',   icon:'📖', cost:1, req:'hr_s1', row:1, col:2, desc:'영웅 시작 EXP +40',       apply:b=>{ b.heroStartExp+=40; } },
      { id:'hr_s5', name:'신의 강림',   icon:'👑', cost:2, req:'hr_s2', row:2, col:0, desc:'영웅 모든 스탯 +20%',     apply:b=>{ b.heroStatMult*=1.20; b.heroAtk+=10; } },
      { id:'hr_s6', name:'영웅의 오라', icon:'✨', cost:2, req:'hr_s3', row:2, col:1, desc:'아군 방어력 오라 +5',      apply:b=>{ b.heroAura+=5; } },
      { id:'hr_s7', name:'빠른 성장',   icon:'⬆️', cost:2, req:'hr_s4', row:2, col:2, desc:'영웅 EXP +80%, 시작EXP+30',apply:b=>{ b.heroExpMult*=1.80; b.heroStartExp+=30; } },
      { id:'hr_s8', name:'불사의 영웅', icon:'🔮', cost:3, req:'hr_s5', row:3, col:0, desc:'전사해도 결장 없음',        apply:b=>{ b.heroInstantRevive=true; } },
      { id:'hr_s9', name:'영웅 전설',   icon:'🌟', cost:3, req:'hr_s6', row:3, col:1, desc:'스탯 +25%, 오라 +8',       apply:b=>{ b.heroStatMult*=1.25; b.heroAura+=8; } },
    ]
  },
  support: {
    name: '보조', icon: '⚙️', color: '#60a5fa',
    skills: [
      { id:'sp_s1', name:'기지 강화',   icon:'🏰', cost:1, req:null,   row:0, col:1, desc:'기지 최대HP +30',         apply:b=>{ b.baseHpMax+=30; } },
      { id:'sp_s2', name:'철옹성',      icon:'🛡️', cost:1, req:'sp_s1', row:1, col:0, desc:'기지 피해 -15%',          apply:b=>{ b.baseDefPct+=0.15; } },
      { id:'sp_s3', name:'병력 강화',   icon:'⚔️', cost:1, req:'sp_s1', row:1, col:1, desc:'아군 공격력 +5, HP +20',   apply:b=>{ b.unitAtk+=5; b.unitHp+=20; } },
      { id:'sp_s4', name:'황금 광맥',   icon:'💰', cost:1, req:'sp_s1', row:1, col:2, desc:'전투 골드 +25%',           apply:b=>{ b.battleGoldMult*=1.25; } },
      { id:'sp_s5', name:'난공불락',    icon:'🏰', cost:2, req:'sp_s2', row:2, col:0, desc:'기지 피해 -20%, HP +40',    apply:b=>{ b.baseDefPct+=0.20; b.baseHpMax+=40; } },
      { id:'sp_s6', name:'정예 부대',   icon:'🔥', cost:2, req:'sp_s3', row:2, col:1, desc:'아군 공격력+10, 슬롯+1',    apply:b=>{ b.unitAtk+=10; b.maxSlotBonus+=1; } },
      { id:'sp_s7', name:'엘도라도',    icon:'🌟', cost:2, req:'sp_s4', row:2, col:2, desc:'전투 골드 +40%, 초기골드+25',apply:b=>{ b.battleGoldMult*=1.40; b.startGoldBonus+=25; } },
      { id:'sp_s8', name:'성채',        icon:'🏯', cost:3, req:'sp_s5', row:3, col:0, desc:'기지 피해 -30%, 최대HP+50', apply:b=>{ b.baseDefPct+=0.30; b.baseHpMax+=50; } },
      { id:'sp_s9', name:'병력 만개',   icon:'⚔️', cost:3, req:'sp_s6', row:3, col:1, desc:'아군 ATK+15, HP+30, 슬롯+1',apply:b=>{ b.unitAtk+=15; b.unitHp+=30; b.maxSlotBonus+=1; } },
    ]
  }
};

// ─── 랜덤 카드 3장 뽑기 ──────────────────────────────────────────────────────
function rollUpgradeCards(taken, count) {
  const owned = new Set(taken || []);
  // 불린/일회성 효과 카드는 이미 뽑았으면 후보에서 제외
  const uniqueOnly = new Set(['t_thunder', 'u_undying', 'h_immortal', 'b_wall', 'c_eldorado']);
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

// ─── 스킬 트리를 BONUSES에 반영 ──────────────────────────────────────────────
function applySkillTree(gs) {
  const owned = gs.skillTreeOwned || [];
  for (const tree of Object.values(SKILL_TREES)) {
    for (const skill of tree.skills) {
      if (owned.includes(skill.id)) skill.apply(BONUSES);
    }
  }
}

function buySkillNode(skillId, gs) {
  let found = null;
  for (const tree of Object.values(SKILL_TREES)) {
    const s = tree.skills.find(sk => sk.id === skillId);
    if (s) { found = s; break; }
  }
  if (!found) return false;
  if ((gs.skillTreeOwned||[]).includes(skillId)) return false;
  if (found.req && !(gs.skillTreeOwned||[]).includes(found.req)) return false;
  if (gs.soulStones < found.cost) return false;
  gs.soulStones -= found.cost;
  if (!gs.skillTreeOwned) gs.skillTreeOwned = [];
  gs.skillTreeOwned.push(skillId);
  reapplyAllBonuses(gs);
  return true;
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
    return Math.max(0, Math.round((endTerm + caveTerm + killTerm + recTerm) * mult));
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
    rows.push({ label:'케이브 레벨', value:gs.caveLevel, note:`Lv.${gs.caveLevel}` });
    rows.push({ label:'처치',        value:Math.floor((gs.battle.runKills||0)/60), note:`${gs.battle.runKills||0}마리 ÷ 60` });
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
