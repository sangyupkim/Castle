'use strict';

// ─── 보너스 기본값 ────────────────────────────────────────────────────────────
function createDefaultBonuses() {
  return {
    // 타워
    towerDmg: 0, towerDmgMult: 1.0, towerSpdMult: 1.0, towerRangeMult: 1.0,
    towerCostDiscount: 0, towerSplash: false, towerPierce: 0, towerSlow: 0,
    overloadEternal: false,   // ✦영구 기관 — 과부하가 풀리지 않는다
    cardHandBonus: 0,         // 🔮 유물 — 카드 선택지가 늘어난다
    // 유닛
    unitAtk: 0, unitHp: 0, unitDef: 0, unitAtkMult: 1.0, unitHpMult: 1.0,
    // ── 깊이를 타는 값들 ──
    // 정액 강화는 층이 깊어지면 없는 것과 같아진다. 30층 몹이 300으로 때리는데
    // 방어 +24는 8%고, 60층에서는 1%다. 영구 성장이 초반에만 보이고 본편에서
    // 사라지면 "무엇을 올려도 똑같다"가 된다. 그래서 비율로 세는 칸을 따로 뒀다.
    unitDefPct: 0,      // 아군이 받는 피해 감소 (합산, 상한 있음)
    killHealPct: 0,     // 처치 시 최대 HP의 이 비율만큼 회복
    heroRegenPct: 0,    // 영웅 최대 HP의 이 비율/초
    baseRegenPct: 0,    // 기지 최대 HP의 이 비율/초
    towerPiercePct: 0,  // 적 방어를 이 비율만큼 무시
    hireCostDiscount: 0, hireCostPct: 0, maxSlotBonus: 0,
    killHeal: 0, comboChance: 0, critChance: 0,
    healBonus: 0, shieldBonus: 0, mpRegenBonus: 0, heroMpMax: 0, restHealBonus: 0,
    regenBonus: 0, heroFullRest: false,
    specialChance: 0, specialSlotBonus: 0, specialUnitMult: 1.0,
    undying: false,
    // 케이브/전투
    battleGoldMult: 1.0, mobHpMult: 1.0, spawnSpeedMult: 1.0,
    eliteChance: 0, dropChance: 0,
    // 🗿 몬스터 케이브 — 아레나 몹을 직접 만지는 값들.
    // mobStatMult/mobGoldMult는 '1 + 합'으로 쓴다 (0이 기본).
    mobStatMult: 0, mobGoldMult: 0, mobAtkMult: 1.0, eliteChargeBonus: 0,
    // 영웅
    heroAtk: 0, heroRegen: 0, heroAura: 0,
    // 장비·스킬이 얹는 영웅 전용 값 (각인 배율과 곱해서 쓴다)
    heroHpFlat: 0, heroSpdMult: 1.0, heroRangeMult: 1.0, heroSkillMult: 1.0,
    heroSkillCdMult: 1.0,
    heroExpMult: 1.0, heroInstantRevive: false, heroPierceRanged: false,
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
    // 🏰 성채 — 기지 자체가 싸우고 버티는 값
    castleAtk: 0, castleRange: 0, castleSpd: 1.0,
    chargeBlock: 0, breachReduce: 0,
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

// ─── 퍼센트 강화는 더해서 쌓는다 ─────────────────────────────────────────────
// 예전에는 어디서든 `b.towerDmgMult *= 1.20` 이었다. 출처가 하나면 맞는 식인데,
// 이 게임은 카드·마을·스킬트리·대장간·유물·부적·각인이 **전부 같은 칸을 곱한다.**
// 곱셈은 출처가 늘어날 때마다 지수로 뛴다:
//
//   같은 카드 30장 = 1.20^30 = 배 237   (더하면 1+30x0.20 = 배 7)
//   영구 강화 만렙만으로 타워 공격력 배 75, 카드까지 얹으면 배 17,815
//
// 그래서 후반에 수치가 통째로 무너졌다. 퍼센트가 언제나 절대값을 이기고,
// 퍼센트끼리도 겹칠수록 기하급수로 벌어진다.
//
// 이제 퍼센트는 한 칸에 **더해서** 모았다가 마지막에 한 번만 곱한다.
// 그러면 "+20%"가 어디서 왔든 정직하게 20%p다. 덤으로 초반/후반의 관계가
// 뒤집힌다 — 화살탑 기본 공격력이 3.4일 때 정액 +3은 +88%지만 카드 +20%는
// +0.68이다. 별을 올려 기본값을 키운 뒤에야 퍼센트가 정액을 넘어선다.
// 초반에는 절대값, 후반에는 퍼센트가 이 구조에서 저절로 나온다.
//
// min/max는 그 칸이 넘지 못하는 선이다. 쿨다운처럼 0에 닿으면 게임이
// 성립하지 않는 값에만 둔다.
const PCT_STACKED = {
  towerDmgMult:    {}, towerSpdMult:  {}, towerRangeMult:  {},
  unitAtkMult:     {}, unitHpMult:    {}, unitAtkSpdMult:  {},
  heroStatMult:    {}, heroSkillMult: {}, heroExpMult:     {},
  gemMult:         {}, battleGoldMult:{}, defenseGoldMult: {},
  // 특수 용병 배율에 천장을 둔다. 이 값은 광전사·성기사·명사수 셋에게만
  // 붙는데, 여관의 ♾️ 무한 트랙이 상한 없이 밀어 올려서 만렙 x9.8까지 갔다.
  // 특수 용병은 '더 좋은 병종'이지 '다른 병종을 무의미하게 만드는 것'이 아니다.
  specialUnitMult: { max: 2.2 },
  mobHpMult:       {}, mobAtkMult:      {},
  summonRewardMult:{}, overloadCdMult:{ min: 0.35 },
  // 스킬 쿨다운 — 0.35 아래로는 안 내려간다.
  // 쿨감이 곱으로 쌓이던 시절에는 24초짜리 성벽 결계가 1초까지 줄어서
  // 무적을 끊기지 않게 유지할 수 있었다. 스킬을 '가끔 쓰는 것'으로 만드는
  // 장치가 쿨다운 하나뿐이라, 여기만은 반드시 바닥이 있어야 한다.
  heroSkillCdMult: { min: 0.35 },
};

// 퍼센트 한 조각을 더한다. v는 비율(0.20 = +20%).
function pctAdd(b, key, v) {
  if (!v) return;
  if (!b._pct) b._pct = Object.create(null);
  b._pct[key] = (b._pct[key] || 0) + v;
}
// 모아 둔 퍼센트를 실제 배율에 한 번만 얹는다. reapplyAllBonuses 끝에서 부른다.
function foldPctStacks(b) {
  const acc = b._pct;
  if (!acc) return;
  for (const k in acc) {
    const lim = PCT_STACKED[k] || {};
    let m = (b[k] === undefined ? 1 : b[k]) * (1 + acc[k]);
    if (!(m > 0)) m = 0;
    if (lim.min !== undefined) m = Math.max(lim.min, m);
    if (lim.max !== undefined) m = Math.min(lim.max, m);
    b[k] = m;
  }
  b._pct = null;
}

// 현재 실행 중인 보너스 (전역 참조)
let BONUSES = createDefaultBonuses();

function resetBonuses() { BONUSES = createDefaultBonuses(); BONUSES._pct = null; }

// ─── 강화 카드 정의 ────────────────────────────────────────────────────────────
// 정액 수치 카드는 대부분 배율로 바꿨다. 화살탑 기본 공격력이 2라 "+3"이
// 1층에서는 2.5배였다가 20층에서는 반올림 오차였다 — 같은 카드가 언제 뽑히느냐로
// 가치가 100배 달라지면 고를 이유가 없어진다.
//
// ── v13.0 등급 4단계 ──
// 예전에는 common / rare / epic 셋이었고 셋 다 "좋은 것을 얼마나 많이 주느냐"만
// 달랐다. 그러면 고르는 일이 늘 **가장 센 것 고르기**로 끝난다 — 등급이 셋이든
// 다섯이든 판단은 하나뿐이다. 그래서 등급마다 **성격**을 다르게 줬다.
//
//   ● 일반  — 작고 확실하다. 언제 집어도 손해가 없다.
//   ◆ 희귀  — 크고 확실하다.
//   ★ 영웅  — **양날이다.** 큰 것을 얻는 대신 반드시 무언가를 내놓는다.
//   ✦ 전설  — 판의 규칙을 바꾼다. 드물게 나오고, 대가가 없다.
//
// 영웅이 양날인 것이 이 개편의 핵심이다. "공격력 +90%, 사거리 −25%"는
// 저격탑 위주 편성에는 재앙이고 대포탑 도배에는 축복이다 — 그때까지 무엇을
// 지어 왔는지가 카드의 값을 정하므로, 선택과 집중이 실제로 성립한다.
const CARD_GRADES = ['common', 'rare', 'epic', 'legend'];
const CARD_GRADE_LABEL  = { common:'● 일반', rare:'◆ 희귀', epic:'★ 영웅', legend:'✦ 전설' };
const CARD_GRADE_COLOR  = { common:'#94a3b8', rare:'#60a5fa', epic:'#a78bfa', legend:'#fbbf24' };
const CARD_GRADE_BG     = { common:'#0f172a', rare:'#0a1e3c', epic:'#1e0a3c', legend:'#2a1f05' };
// 뽑기 가중치. 캠프 🎴패 강화가 상위 등급 쪽을 밀어 올린다.
const CARD_GRADE_WEIGHT = { common:58, rare:27, epic:12, legend:3 };

const UPGRADE_CARDS = [
  // ══ 🏹 타워 ═══════════════════════════════════════════════════════════════
  { id:'t_dmg1',    name:'날카로운 화살', desc:'타워 공격력 +20%',      grade:'common', icon:'🏹', cat:'tower',
    apply: b => { pctAdd(b, 'towerDmgMult', 0.2); } },
  { id:'t_spd1',    name:'빠른 발사',     desc:'타워 공격속도 +20%',    grade:'common', icon:'🏹', cat:'tower',
    apply: b => { pctAdd(b, 'towerSpdMult', 0.2); } },
  { id:'t_range1',  name:'긴 사거리',     desc:'타워 사거리 +15%',      grade:'common', icon:'🏹', cat:'tower',
    apply: b => { pctAdd(b, 'towerRangeMult', 0.15); } },
  { id:'t_cheap',   name:'규격 부품',     desc:'타워 건설비 -3',        grade:'common', icon:'🏭', cat:'tower',
    apply: b => { b.towerCostDiscount += 3; } },
  { id:'t_scrap',   name:'분해 공학',     desc:'타워 판매가 +40%',      grade:'common', icon:'🔧', cat:'tower',
    apply: b => { b.towerSellBonus += 0.40; } },
  { id:'t_dmg2',    name:'강철 화살',     desc:'타워 공격력 +45%',      grade:'rare',   icon:'🏹', cat:'tower',
    apply: b => { pctAdd(b, 'towerDmgMult', 0.45); } },
  { id:'t_spd2',    name:'속사 장치',     desc:'타워 공격속도 +50%',    grade:'rare',   icon:'🏹', cat:'tower',
    apply: b => { pctAdd(b, 'towerSpdMult', 0.5); } },
  { id:'t_range2',  name:'저격 망원경',   desc:'타워 사거리 +30%',      grade:'rare',   icon:'🏹', cat:'tower',
    apply: b => { pctAdd(b, 'towerRangeMult', 0.3); } },
  { id:'t_pierce',  name:'관통 탄심',     desc:'타워가 적 방어 5 무시', grade:'rare',   icon:'🔩', cat:'tower',
    apply: b => { b.towerPierce += 5; } },
  { id:'t_frost',   name:'서리 코팅',     desc:'모든 타워에 감속 15%',  grade:'rare',   icon:'❄️', cat:'tower',
    apply: b => { b.towerSlow += 0.15; } },
  { id:'t_overdrive',name:'과부하 개조',  desc:'과부하 쿨다운 -40%',    grade:'rare',   icon:'⚡', cat:'tower',
    apply: b => { pctAdd(b, 'overloadCdMult', -0.4); } },
  { id:'t_castle',  name:'최후 포대',     desc:'성채 공격력 +12 · 사거리 +25%', grade:'rare', icon:'🏯', cat:'tower',
    apply: b => { b.castleAtk += 12; b.castleRange += 0.25; } },
  // ★ 영웅 — 양날
  { id:'t_focus',   name:'집중 포화',     desc:'타워 공격력 +90%',      bane:'사거리 -25%',
    grade:'epic', icon:'🎯', cat:'tower',
    apply: b => { pctAdd(b, 'towerDmgMult', 0.9); pctAdd(b, 'towerRangeMult', -0.25); } },
  { id:'t_thunder', name:'천둥 화살',     desc:'타워 피격 시 주변 범위 피해', bane:'타워 공격속도 -20%',
    grade:'epic', icon:'⚡', cat:'tower',
    apply: b => { b.towerSplash = true; pctAdd(b, 'towerSpdMult', -0.2); } },
  { id:'t_scope',   name:'초장거리 조준', desc:'타워 사거리 +65%',      bane:'공격속도 -30%',
    grade:'epic', icon:'🔭', cat:'tower',
    apply: b => { pctAdd(b, 'towerRangeMult', 0.65); pctAdd(b, 'towerSpdMult', -0.3); } },
  { id:'t_burnout', name:'과열 코어',     desc:'타워 공격속도 +80%',    bane:'공격력 -25%',
    grade:'epic', icon:'🔥', cat:'tower',
    apply: b => { pctAdd(b, 'towerSpdMult', 0.8); pctAdd(b, 'towerDmgMult', -0.25); } },
  { id:'t_glasscan',name:'유리 대포',     desc:'타워 공격력 +120%',     bane:'기지 최대 HP -30%',
    grade:'epic', icon:'💥', cat:'tower',
    apply: b => { pctAdd(b, 'towerDmgMult', 1.2); b.pactBaseHpMult *= 0.70; } },
  // ✦ 전설
  { id:'t_absolute',name:'절대영도',      desc:'모든 타워 감속 45% · 공격력 +40%', grade:'legend', icon:'🧊', cat:'tower',
    apply: b => { b.towerSlow += 0.45; pctAdd(b, 'towerDmgMult', 0.4); } },
  { id:'t_eternal', name:'영구 기관',     desc:'과부하가 끝나지 않는다', grade:'legend', icon:'♾️', cat:'tower',
    apply: b => { b.overloadEternal = true; } },
  { id:'t_volley',  name:'일제 사격',     desc:'타워 공격력 +100% · 공속 +40%', grade:'legend', icon:'🌠', cat:'tower',
    apply: b => { pctAdd(b, 'towerDmgMult', 1.0); pctAdd(b, 'towerSpdMult', 0.4); } },

  // ══ ⚔️ 유닛 ═══════════════════════════════════════════════════════════════
  { id:'u_atk1',    name:'훈련 강화',     desc:'아군 공격력 +12%',      grade:'common', icon:'⚔️', cat:'unit',
    apply: b => { pctAdd(b, 'unitAtkMult', 0.12); } },
  { id:'u_def1',    name:'철벽 방어',     desc:'아군 방어력 +3',        grade:'common', icon:'🛡️', cat:'unit',
    apply: b => { b.unitDef += 3; } },
  { id:'u_hp1',     name:'강인한 체력',   desc:'아군 HP +15%',          grade:'common', icon:'💪', cat:'unit',
    apply: b => { pctAdd(b, 'unitHpMult', 0.15); } },
  { id:'u_aspd1',   name:'날렵한 손놀림', desc:'아군 공격속도 +15%',    grade:'common', icon:'🌀', cat:'unit',
    apply: b => { pctAdd(b, 'unitAtkSpdMult', 0.15); } },
  { id:'u_regen1',  name:'응급 처치',     desc:'전투 이탈 시 초당 최대 HP 0.8% 회복', grade:'common', icon:'🩹', cat:'unit',
    apply: b => { b.regenBonus += 0.008; } },
  { id:'u_cheap',   name:'징집령',        desc:'병력 고용비 -20%',      grade:'common', icon:'📜', cat:'unit',
    apply: b => { b.hireCostPct += 0.20; } },
  { id:'u_regen2',  name:'야전 의무대',   desc:'전투 이탈 시 초당 최대 HP 2% 회복', grade:'rare', icon:'⛑️', cat:'unit',
    apply: b => { b.regenBonus += 0.020; } },
  { id:'u_lifesteal',name:'전투 의지',    desc:'처치 시 아군 HP +2',    grade:'rare',   icon:'❤️', cat:'unit',
    apply: b => { b.killHeal += 2; } },
  { id:'u_combo',   name:'연속 공격',     desc:'공격 시 20% 추가 타격', grade:'rare',   icon:'⚔️', cat:'unit',
    apply: b => { b.comboChance += 0.20; } },
  { id:'u_crit',    name:'급소 찌르기',   desc:'치명타 확률 +18%',      grade:'rare',   icon:'💥', cat:'unit',
    apply: b => { b.critChance += 0.18; } },
  { id:'u_slot',    name:'용병 모집',     desc:'병력 슬롯 +1',          grade:'rare',   icon:'⚔️', cat:'unit',
    apply: b => { b.maxSlotBonus += 1; } },
  { id:'u_inn',     name:'소문난 주점',   desc:'특수 용병 등장 +25% · 능력 +15%', grade:'rare', icon:'🍺', cat:'unit',
    apply: b => { b.specialChance += 0.25; pctAdd(b, 'specialUnitMult', 0.15); } },
  { id:'u_rest',    name:'야영 기술',     desc:'웨이브 후 회복 +40%',   grade:'rare',   icon:'🏕', cat:'unit',
    apply: b => { b.restHealBonus += 0.40; } },
  // ★ 영웅 — 양날
  { id:'u_glass',   name:'결사대',        desc:'아군 공격력 +80%',      bane:'아군 HP -30%',
    grade:'epic', icon:'🗡️', cat:'unit',
    apply: b => { pctAdd(b, 'unitAtkMult', 0.8); pctAdd(b, 'unitHpMult', -0.3); } },
  { id:'u_turtle',  name:'거북 대형',     desc:'아군 HP +90% · 방어 +6', bane:'아군 공격속도 -35%',
    grade:'epic', icon:'🐢', cat:'unit',
    apply: b => { pctAdd(b, 'unitHpMult', 0.9); b.unitDef += 6; pctAdd(b, 'unitAtkSpdMult', -0.35); } },
  { id:'u_frenzy',  name:'광란의 북',     desc:'아군 공격속도 +70%',    bane:'아군 방어력 -5 · 휴식 회복 -50%',
    grade:'epic', icon:'🥁', cat:'unit',
    apply: b => { pctAdd(b, 'unitAtkSpdMult', 0.7); b.unitDef -= 5; b.restHealBonus -= 0.50; } },
  { id:'u_merc',    name:'용병 계약',     desc:'병력 슬롯 +2',          bane:'고용비 +60%',
    grade:'epic', icon:'📃', cat:'unit',
    apply: b => { b.maxSlotBonus += 2; b.hireCostPct -= 0.60; } },
  // ✦ 전설
  { id:'u_undying', name:'불굴의 의지',   desc:'아군이 처음 쓰러질 때 HP 1로 버틴다', grade:'legend', icon:'✨', cat:'unit',
    apply: b => { b.undying = true; } },
  { id:'u_legion',  name:'군단 편성',     desc:'병력 슬롯 +2 · 아군 전체 능력 +25%', grade:'legend', icon:'🎖️', cat:'unit',
    apply: b => { b.maxSlotBonus += 2; pctAdd(b, 'unitAtkMult', 0.25); pctAdd(b, 'unitHpMult', 0.25); } },

  // ══ 👑 영웅 ═══════════════════════════════════════════════════════════════
  { id:'h_all1',    name:'용기의 기운',   desc:'영웅 전체 능력 +8%',    grade:'common', icon:'👑', cat:'hero',
    apply: b => { pctAdd(b, 'heroStatMult', 0.08); } },
  { id:'h_regen',   name:'회복의 기운',   desc:'영웅 HP 초당 +1.2 재생', grade:'common', icon:'👑', cat:'hero',
    apply: b => { b.heroRegen += 1.2; } },
  { id:'h_mp',      name:'맑은 정신',     desc:'영웅 MP 회복 +40%',     grade:'common', icon:'💧', cat:'hero',
    apply: b => { b.mpRegenBonus += 0.40; } },
  { id:'h_aura',    name:'영웅의 오라',   desc:'아군 전체 방어력 +3',   grade:'rare',   icon:'👑', cat:'hero',
    apply: b => { b.heroAura += 3; } },
  { id:'h_exp',     name:'급성장',        desc:'영웅 EXP +100%',        grade:'rare',   icon:'👑', cat:'hero',
    apply: b => { pctAdd(b, 'heroExpMult', 1.0); } },
  { id:'h_sigil',   name:'각인 공명',     desc:'영웅 스킬 피해 +50%',   grade:'rare',   icon:'✨', cat:'hero',
    apply: b => { pctAdd(b, 'heroSkillMult', 0.5); } },
  { id:'h_cd',      name:'전투 직감',     desc:'영웅 스킬 쿨다운 -30%', grade:'rare',   icon:'⏱', cat:'hero',
    apply: b => { pctAdd(b, 'heroSkillCdMult', -0.3); } },
  { id:'h_range',   name:'매의 눈',       desc:'영웅 사거리 +35%',      grade:'rare',   icon:'🦅', cat:'hero',
    apply: b => { b.heroRangeMult *= 1.35; } },
  // ★ 영웅 — 양날
  { id:'h_duel',    name:'결투가',        desc:'영웅 전체 능력 +45%',   bane:'아군 병력 능력 -15%',
    grade:'epic', icon:'⚔️', cat:'hero',
    apply: b => { pctAdd(b, 'heroStatMult', 0.45); pctAdd(b, 'unitAtkMult', -0.15); pctAdd(b, 'unitHpMult', -0.15); } },
  { id:'h_martyr',  name:'순교자',        desc:'영웅 공격력 +100%',     bane:'영웅 최대 HP -35%',
    grade:'epic', icon:'🕯', cat:'hero',
    apply: b => { b.sigilHeroAtkMult *= 2.00; b.sigilHeroHpMult *= 0.65; } },
  { id:'h_reckless',name:'저돌맹진',      desc:'영웅 공속 +60% · 사거리 +30%', bane:'아군 방어 오라 -4',
    grade:'epic', icon:'🐗', cat:'hero',
    apply: b => { b.heroSpdMult *= 1.60; b.heroRangeMult *= 1.30; b.heroAura -= 4; } },
  // ✦ 전설
  { id:'h_immortal',name:'불사의 영웅',   desc:'전사해도 결장 없이 즉시 돌아온다', grade:'legend', icon:'👑', cat:'hero',
    apply: b => { b.heroInstantRevive = true; } },
  { id:'h_avatar',  name:'신의 강림',     desc:'영웅 모든 스탯 +45%',   grade:'legend', icon:'🌟', cat:'hero',
    apply: b => { pctAdd(b, 'heroStatMult', 0.45); } },

  // ══ 🏰 기지 ═══════════════════════════════════════════════════════════════
  { id:'b_heal',    name:'성벽 보수',     desc:'기지 HP 30% 회복',      grade:'common', icon:'🏰', cat:'base',
    apply: (b, gs) => { if (gs) gs.baseHP = Math.min(baseHpMax(), gs.baseHP + baseHpMax()*0.30); } },
  { id:'b_regen',   name:'자동 수복',     desc:'기지 초당 +0.5 재생',   grade:'common', icon:'🔧', cat:'base',
    apply: b => { b.baseRegen += 0.5; } },
  { id:'b_gate',    name:'철문 보강',     desc:'기지에 닿은 적의 피해 -25%', grade:'rare', icon:'🚪', cat:'base',
    apply: b => { b.breachReduce += 0.25; } },
  { id:'b_thorn',   name:'가시 방벽',     desc:'달려드는 적을 25% 확률로 막는다', grade:'rare', icon:'🌵', cat:'base',
    apply: b => { b.chargeBlock += 0.25; } },
  { id:'b_hp',      name:'견고한 기지',   desc:'기지 최대HP +25% · 즉시 회복', grade:'rare', icon:'🏰', cat:'base',
    apply: (b, gs) => { b.baseHpMax += BASE_HP_MAX*0.25; if (gs) gs.baseHP += BASE_HP_MAX*0.25; } },
  // ★ 영웅 — 양날
  { id:'b_wall',    name:'철옹성',        desc:'기지 피해 -35% · 최대HP +40%', bane:'타워 건설비 +5',
    grade:'epic', icon:'🏰', cat:'base',
    apply: b => { b.baseDefPct += 0.35; b.baseHpMax += BASE_HP_MAX*0.40; b.towerCostDiscount -= 5; } },
  { id:'b_siege',   name:'배수의 진',     desc:'타워·아군 공격력 +50%', bane:'기지 최대 HP 절반',
    grade:'epic', icon:'⚱️', cat:'base',
    apply: b => { pctAdd(b, 'towerDmgMult', 0.5); pctAdd(b, 'unitAtkMult', 0.5); b.pactBaseHpMult *= 0.50; } },
  // ✦ 전설
  { id:'b_bastion', name:'불멸의 성채',   desc:'기지 최대HP +80% · 재생 +3/s · 피해 -20%', grade:'legend', icon:'🛡️', cat:'base',
    apply: b => { b.baseHpMax += BASE_HP_MAX*0.80; b.baseRegen += 3; b.baseDefPct += 0.20; } },

  // ══ 🗿 케이브 ═════════════════════════════════════════════════════════════
  { id:'c_gold1',   name:'풍부한 광맥',   desc:'전투 골드 +25%',        grade:'common', icon:'💰', cat:'cave',
    apply: b => { pctAdd(b, 'battleGoldMult', 0.25); } },
  { id:'c_weak',    name:'약한 몹',       desc:'몬스터 HP -15%',        grade:'common', icon:'🗿', cat:'cave',
    apply: b => { pctAdd(b, 'mobHpMult', -0.15); } },
  { id:'c_drop',    name:'부산물',        desc:'특수 드랍 확률 +12%',   grade:'common', icon:'🎁', cat:'cave',
    apply: b => { b.dropChance += 0.12; } },
  { id:'c_rush',    name:'몬스터 러시',   desc:'스폰 빠르고 골드 +30%', grade:'rare',   icon:'🗿', cat:'cave',
    apply: b => { b.spawnSpeedMult *= 1.3; pctAdd(b, 'battleGoldMult', 0.3); } },
  { id:'c_elite',   name:'정예 사냥터',   desc:'정예 등장 +20% · 골드 +40%', grade:'rare', icon:'⚔️', cat:'cave',
    apply: b => { b.eliteChance += 0.20; pctAdd(b, 'battleGoldMult', 0.4); } },
  { id:'c_gem',     name:'보석 광맥',     desc:'이 판의 층당 보석 +30%', grade:'rare',  icon:'💎', cat:'cave',
    apply: b => { pctAdd(b, 'gemMult', 0.3); } },
  { id:'c_hunt',    name:'사냥 허가',     desc:'정예 소환 기회 +1 · 소환 보상 +40%', grade:'rare', icon:'🏹', cat:'cave',
    apply: b => { b.eliteChargeBonus += 1; pctAdd(b, 'summonRewardMult', 0.4); } },
  // ★ 영웅 — 양날
  { id:'c_deep',    name:'갱도 개방',     desc:'처치 골드 +120%',       bane:'몬스터 능력 +35%',
    grade:'epic', icon:'⛏️', cat:'cave',
    apply: b => { b.mobGoldMult += 1.20; b.mobStatMult += 0.35; } },
  // 보석 +60%는 에픽 한 장이 전설(엘도라도 +50%)을 넘어서는 값이었다. 보석은
  // 영구 성장 전부를 사는 화폐라 한 판의 카드 한 장이 다음 판들의 출발선을 옮긴다 —
  // 그 크기가 '이번 판을 어떻게 풀까'가 아니라 '이 카드가 떴나'로 판을 가른다.
  // 에픽다운 폭(+25%)으로 낮추고, 대신 그 자리에서 바로 벌리는 쪽(정예)을 키웠다.
  { id:'c_swarm',   name:'벌집 건드리기', desc:'보석 +25% · 정예 등장 +40%', bane:'아레나 스폰 간격 -35%',
    grade:'epic', icon:'🐝', cat:'cave',
    apply: b => { pctAdd(b, 'gemMult', 0.25); b.eliteChance += 0.40; b.pactSpawnMult *= 0.65; } },
  // ✦ 전설
  { id:'c_eldorado',name:'엘도라도',      desc:'처치 보상 ×2 · 층당 보석 +50%', grade:'legend', icon:'🌟', cat:'cave',
    apply: b => { pctAdd(b, 'battleGoldMult', 1.0); pctAdd(b, 'defenseGoldMult', 1.0); pctAdd(b, 'gemMult', 0.5); } },

  // ══ 💰 자원 ═══════════════════════════════════════════════════════════════
  { id:'r_hire',    name:'무기 할인',     desc:'병력 고용비용 -25%',    grade:'common', icon:'💰', cat:'resource',
    apply: b => { b.hireCostPct += 0.25; } },
  { id:'r_interest',name:'전시 이자',     desc:'전투 골드 +15% · 시작 골드 +25', grade:'common', icon:'🏦', cat:'resource',
    apply: b => { pctAdd(b, 'battleGoldMult', 0.15); b.startGoldBonus += 25; } },
  { id:'r_stock',   name:'선불 보급',     desc:'매 층 시작 골드 +40',   grade:'rare',   icon:'📦', cat:'resource',
    apply: b => { b.startGoldBonus += 40; } },
  { id:'r_toll',    name:'통행료',        desc:'상단 처치 골드 +80%',   grade:'rare',   icon:'🪙', cat:'resource',
    apply: b => { pctAdd(b, 'defenseGoldMult', 0.8); } },
  // ★ 영웅 — 양날
  { id:'r_usury',   name:'고리대금',      desc:'시작 골드 +150',        bane:'전투 골드 -35%',
    grade:'epic', icon:'💸', cat:'resource',
    apply: b => { b.startGoldBonus += 150; pctAdd(b, 'battleGoldMult', -0.35); } },
  { id:'r_gamble',  name:'도박꾼의 눈',   desc:'전투 골드 +90%',        bane:'시작 골드 -60',
    grade:'epic', icon:'🎲', cat:'resource',
    apply: b => { pctAdd(b, 'battleGoldMult', 0.9); b.startGoldBonus -= 60; } },
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

// ─── 트리의 눈금과 값 ────────────────────────────────────────────────────────
// v12.9에서 노드 하나가 10레벨에서 **100레벨**이 됐다. 보석을 쓸 데가 없어
// 남아돈다는 보고 때문인데, 단순히 값만 올리면 "같은 것을 더 비싸게"일 뿐이라
// 눈금 자체를 잘게 쪼갰다 — 한 번에 크게 오르는 대신 오래 오른다.
//
// 계수는 노드 정의에 그대로 두고 **넘겨주는 값**을 8로 나눈다(SKILL_EFFECT_SCALE).
// 100레벨이 옛 12.5레벨만큼이므로 끝까지 올리면 예전보다 25% 세다 — 값이 훨씬
// 무거워진 만큼의 몫이다. 계수 45줄을 일일이 고치면 Math.min 상한이나
// `v>=5` 같은 문턱을 하나씩 놓치기 마련이라, 한 군데서 나눈다.
const SKILL_MAX_LV      = 100;  // 노드 하나가 오를 수 있는 최대 레벨
const SKILL_EFFECT_SCALE= 0.125;

// ─── 줄을 여는 문턱 ──────────────────────────────────────────────────────────
// 예전에는 30·60·90처럼 **고정 수치**였다. 그런데 줄마다 찍을 수 있는 양이
// 다르다 — 1단은 노드 하나(100칸), 2단은 셋(300칸)이다. 고정 수치를 쓰면
// 아래로 갈수록 문턱이 오히려 **헐거워진다**: 3단은 위에 700칸이 있는데
// 90칸이면 열렸다(13%). 300칸짜리 줄을 거의 손대지 않고 그 아래로 내려갈 수
// 있었다는 뜻이고, 그러면 줄을 나눈 이유가 없다.
//
// 이제 **바로 윗줄 용량의 40%**를 요구한다. 딱지에 적는 "윗줄"이 곧 사실이 되고,
// 줄 구성이 바뀌어도 문턱이 저절로 따라온다.
const SKILL_ROW_GATE_FRAC = 0.40;

// maxLv를 따로 적은 노드(편성 슬롯 +N 같은 '개수' 노드)는 눈금이 곧 개수다.
// 이런 것은 100칸으로 늘릴 수도, 계수를 나눌 수도 없다 — 제 눈금을 그대로 쓴다.
function skillMaxLv(sk)      { return sk.maxLv || SKILL_MAX_LV; }
function skillEffV(sk, lv)   { return sk.maxLv ? lv : lv * SKILL_EFFECT_SCALE; }
function skillIsFine(sk)     { return !sk.maxLv; }   // 눈금이 잘게 쪼개진 노드인가

// 아랫줄일수록 한 칸이 비싸다 — 줄을 내려가는 것 자체가 값을 치르는 선택이 되게.
// 아랫줄 노드는 위보다 효율이 좋으므로(치명타·연계·처치 회복) 값도 그만큼 다르다.
const SKILL_ROW_COST_MULT = [1, 2.2, 4, 7];
// 배수만으로는 **첫 칸**에서 차이가 안 난다. 값이 레벨에 비례하니
// 3단 1레벨은 2보석, 1단 41레벨은 14보석 — 화면에는 아래가 더 싸 보였다.
// 줄마다 바닥값을 둬서 내려가는 첫 칸부터 무겁게 한다.
const SKILL_ROW_MIN_COST  = [1, 6, 16, 34];
function skillRowIdx(sk) {
  return Math.min(SKILL_ROW_COST_MULT.length - 1, Math.max(0, sk.row || 0));
}
function skillRowMult(sk) { return SKILL_ROW_COST_MULT[skillRowIdx(sk)]; }
function skillLevelCost(sk, level) {
  const L = Math.max(1, level);
  const base = (sk.cost || 1) * skillRowMult(sk);
  // 개수 노드는 눈금이 4~8칸뿐이라 같은 식으로는 거저가 된다 — 한 칸을 무겁게.
  const per = sk.maxLv ? 25 : 0.35;
  return Math.max(SKILL_ROW_MIN_COST[skillRowIdx(sk)], Math.round(base * L * per));
}
function skillNodeTotal(sk) {
  let t = 0; for (let i = 1; i <= skillMaxLv(sk); i++) t += skillLevelCost(sk, i); return t;
}

const SKILL_TREES = {
  tower: {
    name: '타워', icon: '🏹', color: '#22c55e',
    skills: [
      { id:'tw_s1', name:'정밀 조준', icon:'🎯', cost:1, row:0, col:1,
        desc:v=>`타워 공격력 +${skpct(v*0.05)}`,      apply:(b,v)=>{ pctAdd(b, 'towerDmgMult', v*0.05); } },
      // 정액 공격력은 뺐다. 화살탑 기본 공격력이 2라 정액 +20이 붙는 순간
      // 타워 종류도 레벨도 의미를 잃는다. 대신 모든 타워에 감속을 얹는다.
      { id:'tw_s2', name:'얼음 도금', icon:'❄️', cost:1, row:1, col:0,
        desc:v=>`모든 타워에 감속 ${skpct(v*0.025)}`, apply:(b,v)=>{ b.towerSlow += v*0.025; } },
      { id:'tw_s3', name:'속사',      icon:'⚡', cost:1, row:1, col:1,
        desc:v=>`타워 공격속도 +${skpct(v*0.04)}`,     apply:(b,v)=>{ pctAdd(b, 'towerSpdMult', v*0.04); } },
      { id:'tw_s4', name:'요새화',    icon:'🏗️', cost:1, row:1, col:2,
        desc:v=>`타워 건설비 -${Math.round(v)}`,     apply:(b,v)=>{ b.towerCostDiscount += Math.round(v); } },
      { id:'tw_s5', name:'저격 조준', icon:'👁️', cost:2, row:2, col:0,
        desc:v=>`타워 사거리 +${skpct(v*0.035)}`,      apply:(b,v)=>{ pctAdd(b, 'towerRangeMult', v*0.035); } },
      { id:'tw_s6', name:'관통탄',    icon:'🔩', cost:2, row:2, col:1,
        desc:v=>`적 방어 ${skpct(v*0.03)} 무시`,     apply:(b,v)=>{ b.towerPiercePct += v*0.03; } },
      { id:'tw_s7', name:'연사 기계', icon:'⚙️', cost:2, row:2, col:2,
        desc:v=>`타워 공격속도 +${skpct(v*0.05)}`,     apply:(b,v)=>{ pctAdd(b, 'towerSpdMult', v*0.05); } },
      { id:'tw_s8', name:'폭발 화살', icon:'💥', cost:3, row:3, col:0,
        desc:v=>`범위 피해 · 공격력 +${skpct(v*0.04)}`, apply:(b,v)=>{ b.towerSplash = true; pctAdd(b, 'towerDmgMult', v*0.04); } },
      { id:'tw_s9', name:'타워 숙련', icon:'🌟', cost:3, row:3, col:1,
        desc:v=>`공격력 +${skpct(v*0.05)} · 공속 +${skpct(v*0.03)}`,
        apply:(b,v)=>{ pctAdd(b, 'towerDmgMult', v*0.05); pctAdd(b, 'towerSpdMult', v*0.03); } },
    ]
  },

  unit: {
    name: '병력', icon: '⚔️', color: '#f97316',
    skills: [
      { id:'un_s1', name:'기초 훈련', icon:'⚔️', cost:1, row:0, col:1,
        desc:v=>`아군 공격력 +${skpct(v*0.05)}`,      apply:(b,v)=>{ pctAdd(b, 'unitAtkMult', v*0.05); } },
      { id:'un_s2', name:'체력 단련', icon:'💪', cost:1, row:1, col:0,
        desc:v=>`아군 HP +${skpct(v*0.05)}`,          apply:(b,v)=>{ pctAdd(b, 'unitHpMult', v*0.05); } },
      { id:'un_s3', name:'방어 훈련', icon:'🛡️', cost:1, row:1, col:1,
        desc:v=>`받는 피해 -${skpct(v*0.02)}`,        apply:(b,v)=>{ b.unitDefPct += v*0.02; } },
      { id:'un_s4', name:'속공',      icon:'🌀', cost:1, row:1, col:2,
        desc:v=>`아군 공격속도 +${skpct(v*0.03)}`,      apply:(b,v)=>{ pctAdd(b, 'unitAtkSpdMult', v*0.03); } },
      { id:'un_s5', name:'급소 교본', icon:'💥', cost:2, row:2, col:0,
        desc:v=>`치명타 확률 +${skpct(v*0.02)}`,        apply:(b,v)=>{ b.critChance += v*0.02; } },
      { id:'un_s6', name:'연계 공격', icon:'🔗', cost:2, row:2, col:1,
        desc:v=>`추가 타격 확률 +${skpct(v*0.025)}`,    apply:(b,v)=>{ b.comboChance += v*0.025; } },
      { id:'un_s7', name:'전장 치유', icon:'💚', cost:2, row:2, col:2,
        desc:v=>`처치 시 최대 HP의 ${skpct(v*0.006)} 회복`, apply:(b,v)=>{ b.killHealPct += v*0.006; } },
      { id:'un_s8', name:'정예 부대', icon:'🔥', cost:3, row:3, col:0,
        desc:v=>`아군 공격력 +${skpct(v*0.06)} · HP +${skpct(v*0.07)}`,
        apply:(b,v)=>{ pctAdd(b, 'unitAtkMult', v*0.06); pctAdd(b, 'unitHpMult', v*0.07); } },
      { id:'un_s9', name:'대열 확장', icon:'➕', cost:3, row:3, col:1, maxLv:4,
        desc:v=>`편성 슬롯 +${Math.round(v)}`,        apply:(b,v)=>{ b.maxSlotBonus += Math.round(v); } },
    ]
  },

  hero: {
    name: '영웅', icon: '👑', color: '#f59e0b',
    skills: [
      { id:'hr_s1', name:'영웅 훈련', icon:'⚔️', cost:1, row:0, col:1,
        desc:v=>`영웅 공격력 +${skpct(v*0.05)}`,      apply:(b,v)=>{ b.sigilHeroAtkMult *= 1 + v*0.05; } },
      { id:'hr_s2', name:'투사',      icon:'🗡️', cost:1, row:1, col:0,
        desc:v=>`영웅 전체 능력 +${skpct(v*0.03)}`,     apply:(b,v)=>{ pctAdd(b, 'heroStatMult', v*0.03); } },
      { id:'hr_s3', name:'재생',      icon:'💚', cost:1, row:1, col:1,
        desc:v=>`영웅 재생 최대 HP의 ${skpct(v*0.004)}/s`, apply:(b,v)=>{ b.heroRegenPct += v*0.004; } },
      { id:'hr_s4', name:'경험 축적', icon:'📖', cost:1, row:1, col:2,
        desc:v=>`영웅 EXP +${skpct(v*0.08)}`,           apply:(b,v)=>{ pctAdd(b, 'heroExpMult', v*0.08); } },
      { id:'hr_s5', name:'지휘 오라', icon:'🎖️', cost:2, row:2, col:0,
        desc:v=>`부대가 받는 피해 -${skpct(v*0.015)}`,  apply:(b,v)=>{ b.unitDefPct += v*0.015; } },
      { id:'hr_s6', name:'각인 증폭', icon:'✨', cost:2, row:2, col:1,
        desc:v=>`영웅 스킬 피해 +${skpct(v*0.05)}`,      apply:(b,v)=>{ pctAdd(b, 'heroSkillMult', v*0.05); } },
      { id:'hr_s7', name:'질풍',      icon:'🌀', cost:2, row:2, col:2,
        desc:v=>`영웅 공격속도 +${skpct(v*0.03)}`,       apply:(b,v)=>{ b.heroSpdMult *= 1 + v*0.03; } },
      { id:'hr_s8', name:'불굴',      icon:'🔮', cost:3, row:3, col:0, maxLv:5,
        desc:v=>v>=5 ? '전사해도 결장 없음' : `복귀 HP +${Math.round(v*8)}%p`,
        apply:(b,v)=>{ b.heroReviveReduction += v; if (v>=5) b.heroInstantRevive = true; } },
      { id:'hr_s9', name:'영웅 전설', icon:'🌟', cost:3, row:3, col:1,
        desc:v=>`영웅 전체 능력 +${skpct(v*0.04)}`,      apply:(b,v)=>{ pctAdd(b, 'heroStatMult', v*0.04); } },
      { id:'hr_s10', name:'마력 순환', icon:'💧', cost:2, row:3, col:2,
        desc:v=>`최대 MP +${skpct(v*0.06)} · MP 회복 +${skpct(v*0.05)}`,
        apply:(b,v)=>{ b.heroMpMax += v*0.06; b.mpRegenBonus += v*0.05; } },
    ]
  },

  base: {
    name: '기지', icon: '🏰', color: '#60a5fa',
    skills: [
      { id:'bs_s1', name:'성벽 증축', icon:'🏰', cost:1, row:0, col:1,
        desc:v=>`기지 최대 HP +${skpct(v*0.05)}`,     apply:(b,v)=>{ b.baseHpMax += BASE_HP_MAX * v*0.05; } },
      { id:'bs_s2', name:'철갑',      icon:'🛡️', cost:1, row:1, col:0, maxLv:8,
        desc:v=>`기지 피해 -${skpct(v*0.04)}`,          apply:(b,v)=>{ b.baseDefPct += v*0.04; } },
      { id:'bs_s3', name:'자가 수복', icon:'🔧', cost:1, row:1, col:1,
        desc:v=>`기지 재생 최대 HP의 ${skpct(v*0.0012)}/s`, apply:(b,v)=>{ b.baseRegenPct += v*0.0012; } },
      { id:'bs_s4', name:'보급 창고', icon:'📦', cost:1, row:1, col:2,
        desc:v=>`시작 골드 +${Math.round(v*8)}`,       apply:(b,v)=>{ b.startGoldBonus += v*8; } },
      { id:'bs_s5', name:'황금 광맥', icon:'💰', cost:2, row:2, col:0,
        desc:v=>`전투 골드 +${skpct(v*0.05)}`,           apply:(b,v)=>{ pctAdd(b, 'battleGoldMult', v*0.05); } },
      { id:'bs_s6', name:'교대 근무', icon:'🛏️', cost:2, row:2, col:1,
        desc:v=>`웨이브 후 회복 +${skpct(v*0.03)}`,      apply:(b,v)=>{ b.restHealBonus += v*0.03; } },
      { id:'bs_s7', name:'상단 계약', icon:'🤝', cost:2, row:2, col:2,
        desc:v=>`고용비 -${Math.round(v)} · 타워 건설비 -${Math.round(v*0.5)}`,
        apply:(b,v)=>{ b.hireCostDiscount += Math.round(v); b.towerCostDiscount += Math.round(v*0.5); } },
      { id:'bs_s8', name:'난공불락', icon:'🏯', cost:3, row:3, col:0,
        desc:v=>`기지 최대 HP +${skpct(v*0.07)} · 재생 ${skpct(v*0.0016)}/s`,
        apply:(b,v)=>{ b.baseHpMax += BASE_HP_MAX * v*0.07; b.baseRegenPct += v*0.0016; } },
      { id:'bs_s9', name:'전시 경제', icon:'🏦', cost:3, row:3, col:1,
        desc:v=>`전투 골드 +${skpct(v*0.06)} · 시작 골드 +${Math.round(v*10)}`,
        apply:(b,v)=>{ pctAdd(b, 'battleGoldMult', v*0.06); b.startGoldBonus += v*10; } },
    ]
  },

  // 🌊 심연 — 무한 모드에만 값이 붙는 나무. 깊이 내려갈 사람을 위한 갈래다.
  abyss: {
    name: '심연', icon: '🌊', color: '#a78bfa',
    skills: [
      { id:'ab_s1', name:'심연 적응', icon:'🌊', cost:1, row:0, col:1,
        desc:v=>`적 체력 -${skpct(v*0.015)}`,           apply:(b,v)=>{ pctAdd(b, 'mobHpMult', -(Math.min(0.30, v*0.015))); } },
      { id:'ab_s2', name:'보석 감식', icon:'💎', cost:1, row:1, col:0,
        desc:v=>`층당 보석 +${skpct(v*0.04)}`,           apply:(b,v)=>{ pctAdd(b, 'gemMult', v*0.04); } },
      { id:'ab_s3', name:'현상금 사냥', icon:'🎯', cost:1, row:1, col:1,
        desc:v=>`소환 보상 +${skpct(v*0.06)}`,           apply:(b,v)=>{ pctAdd(b, 'summonRewardMult', v*0.06); } },
      { id:'ab_s4', name:'등불',      icon:'🏮', cost:1, row:1, col:2,
        desc:v=>`불리한 층 이벤트 완화 ${skpct(v*0.05)}`, apply:(b,v)=>{ b.eventSoften += v*0.05; } },
      { id:'ab_s5', name:'과부하 회로', icon:'⚡', cost:2, row:2, col:0,
        desc:v=>`과부하 쿨다운 -${skpct(v*0.05)}`,        apply:(b,v)=>{ pctAdd(b, 'overloadCdMult', -(Math.min(0.6, v*0.05))); } },
      { id:'ab_s6', name:'정예 사냥', icon:'⚔️', cost:2, row:2, col:1,
        desc:v=>`정예 등장 +${skpct(v*0.015)} · 보상 +${skpct(v*0.04)}`,
        apply:(b,v)=>{ b.eliteChance += v*0.015; pctAdd(b, 'summonRewardMult', v*0.04); } },
      { id:'ab_s7', name:'드랍 감지', icon:'🔎', cost:2, row:2, col:2,
        desc:v=>`특수 드랍 확률 +${skpct(v*0.012)}`,      apply:(b,v)=>{ b.dropChance += v*0.012; } },
      { id:'ab_s8', name:'심층 내성', icon:'🌑', cost:3, row:3, col:0,
        desc:v=>`적 이동속도 -${skpct(v*0.02)}`,          apply:(b,v)=>{ b.pactEnemySpdMult *= 1 - Math.min(0.35, v*0.02); } },
      { id:'ab_s9', name:'심연의 부름', icon:'🌟', cost:3, row:3, col:1,
        desc:v=>`층당 보석 +${skpct(v*0.05)} · 적 체력 -${skpct(v*0.01)}`,
        apply:(b,v)=>{ pctAdd(b, 'gemMult', v*0.05); pctAdd(b, 'mobHpMult', -(Math.min(0.20, v*0.01))); } },
    ]
  }
};

const SKILL_V1_REFUND  = 2;   // 구 트리 노드 하나당 환급 보석
const SKILL_TREE_ORDER = ['tower','unit','hero','base','abyss'];

// 한 노드의 현재 레벨
function skillLevel(gs, id) { return (gs.skillLevels && gs.skillLevels[id]) || 0; }
// 그 나무의 한 줄이 담을 수 있는 총 칸 수 / 지금 그 줄에 쌓인 레벨
function treeRowCap(treeId, row) {
  const tree = SKILL_TREES[treeId]; if (!tree) return 0;
  let n = 0;
  for (const sk of tree.skills) if (sk.row === row) n += skillMaxLv(sk);
  return n;
}
function treeRowLevels(gs, treeId, row) {
  const tree = SKILL_TREES[treeId]; if (!tree) return 0;
  let n = 0;
  for (const sk of tree.skills) if (sk.row === row) n += skillLevel(gs, sk.id);
  return n;
}
// 이 줄을 열려면 **바로 윗줄**에 몇 레벨이 있어야 하는가 — 5단위로 떨어뜨려 읽기 쉽게
function skillRowGate(treeId, row) {
  if (row <= 0) return 0;
  return Math.round(treeRowCap(treeId, row - 1) * SKILL_ROW_GATE_FRAC / 5) * 5;
}
// 이 노드를 지금 한 단계 올릴 수 있는가
function skillCanBuy(gs, treeId, sk) {
  const lv = skillLevel(gs, sk.id);
  if (lv >= skillMaxLv(sk)) return { ok:false, why:'max' };
  const need = skillRowGate(treeId, sk.row);
  if (treeRowLevels(gs, treeId, sk.row - 1) < need) return { ok:false, why:'gate', need };
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
      if (lv > 0) sk.apply(BONUSES, skillEffV(sk, lv));
    }
  }
}
// 지금까지 트리에 넣은 보석 총액
function skillSpentTotal(gs) {
  let t = 0;
  for (const treeId of SKILL_TREE_ORDER)
    for (const sk of SKILL_TREES[treeId].skills) {
      const lv = skillLevel(gs, sk.id);
      for (let i = 1; i <= lv; i++) t += skillLevelCost(sk, i);
    }
  return t;
}

// 트리를 통째로 되돌리고 넣은 보석을 전액 돌려준다. 값은 받지 않는다 —
// 4126보석짜리 나무에서 한 번 잘못 찍은 것이 판을 통째로 묶어 두면
// 플레이어가 하는 일은 '고민'이 아니라 '검색'이 된다. 되돌릴 수 있어야 실험이 선택이 된다.
function resetSkillTree(gs) {
  const refund = skillSpentTotal(gs);
  if (refund <= 0) return 0;
  gs.skillLevels = {};
  gs.soulStones += refund;
  reapplyAllBonuses(gs);
  return refund;
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
// 한 번만 의미가 있는 카드 — 이미 집었으면 후보에서 뺀다.
// 불린을 켜는 것(splash·undying), 상태를 한 번 바꾸는 것(즉시 부활)이 여기 든다.
const CARD_UNIQUE = new Set([
  't_thunder', 't_focus', 't_eternal',
  'u_undying', 'u_slot', 'u_merc', 'u_legion',
  'h_immortal',
  'b_wall', 'b_bastion',
  'c_eldorado',
]);

// 이번 판에 보여줄 카드를 뽑는다.
// 등급 가중치와 장수, 기피 목록은 캠프 🎴패 강화가 정한다 — gsp를 넘기지 않으면
// (테스트 등) 기본값으로 돈다.
function rollUpgradeCards(taken, count, gsp) {
  const owned = new Set(taken || []);
  const st = gsp || (typeof gs !== 'undefined' ? gs : null);
  const banned = st ? new Set(cardMetaState(st).bans) : new Set();
  const pool = UPGRADE_CARDS.filter(c =>
    !(CARD_UNIQUE.has(c.id) && owned.has(c.id)) && !banned.has(c.id));

  const gw = st ? cardGradeWeights(st) : CARD_GRADE_WEIGHT;
  const weights = pool.map(c => gw[c.grade] || 1);
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

// 편성 슬롯 — 네 군데에서 제각기 계산하고 있었고 그중 둘만 층 이벤트를 반영했다.
//
// 한때 '병영 레벨 두 단마다 한 칸'을 자동으로 얹었다. 보석 트랙 하나로만
// 늘리던 시절이 너무 가팔랐던 것에 대한 보정이었는데, 트랙을 Lv.5~8에 한 칸씩
// 여는 방식으로 고친 뒤로는 **찍지도 않은 칸이 저절로 늘어나는** 상태가 됐다.
// 병영을 2레벨로 올리기만 해도 칸이 하나 붙으니, ➕병력 증원을 사는 일이
// 무엇을 위한 것인지가 흐려진다. 칸이 느는 길은 하나로 둔다.
function recalcMaxSlots(gs) {
  if (!gs || !gs.battle) return;
  const base = 4 + BONUSES.maxSlotBonus;
  gs.battle.maxSlots = Math.max(1,
    Math.floor(base * (BONUSES.pactSlotMult || 1)) + fev('slotBonus', 0));
}

// 슬롯이 줄었는데 이미 그보다 많이 데리고 있으면 넘치는 만큼 돌려보낸다.
// 👥증원은 '한 층짜리' 이벤트인데, 그 층에서 6명을 뽑으면 다음 층에도 6명이
// 그대로 따라갔다 — 한 층만 걸리는 규칙이 영구 강화가 되고 있었다.
// 내가 자른 것이 아니라 층이 끝나서 자리가 사라진 것이므로 고용비는 전액 돌려준다.
function releaseOverCapUnits(gs) {
  if (!gs || !gs.battle) return 0;
  const team = gs.battle.ourTeam;
  const isNormal = u => !u.isHero && !(UNIT_TYPES[u.typeId] || {}).special;
  let over = team.filter(isNormal).length - gs.battle.maxSlots;
  if (over <= 0) return 0;
  let refund = 0, freed = 0;
  // 나중에 뽑은 것부터 — 층 이벤트를 보고 추가로 뽑았을 쪽이다
  for (let i = team.length - 1; i >= 0 && over > 0; i--) {
    if (!isNormal(team[i])) continue;
    // 값이 오르는 체계라 '지금 그 종류의 마지막 한 명' 값으로 돌려준다 (전액 환불)
    refund += hireCostAt(team[i].typeId, hireCountOf(gs.battle, team[i].typeId) - 1);
    team.splice(i, 1);
    over--; freed++;
  }
  if (freed > 0) {
    gs.gold += refund;
    if (typeof addLog === 'function') {
      addLog(gs.battle, `👥 증원이 끝나 용병 ${freed}명 해산 +${refund}💰`, COLORS.gold);
    }
  }
  return freed;
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

// ─── 판 도중에 이미 받은 보석 ────────────────────────────────────────────────
// 현상수배·소환 정예·관문·보스 보상은 잡는 그 자리에서 바로 들어온다.
// 그런데 결과 화면의 '💎 보석 정산'에는 층·처치·케이브만 적혀 있었다 —
// 30보석짜리 현상수배를 세 마리 잡고 나왔는데 정산에 8이라고 적혀 있으면
// 받은 것을 안 준 것으로 읽는다. 실제로 빠진 적은 없고, **보이지 않았을 뿐이다.**
// 그래서 판 도중 수입을 따로 세어 두고 정산 화면에 '이미 받음'으로 같이 적는다.
const RUN_GEM_KINDS = {
  bounty: { label:'💰 현상수배', note:'잡는 즉시 받았습니다' },
  elite:  { label:'⚔️ 소환 정예', note:'잡는 즉시 받았습니다' },
  gate:   { label:'🏁 관문 최초 돌파', note:'넘는 즉시 받았습니다' },
  boss:   { label:'👹 보스 처치', note:'잡는 즉시 받았습니다' },
};
function runGemState(gs) {
  if (!gs.runGems) gs.runGems = {};
  return gs.runGems;
}
function addRunGems(gs, kind, n) {
  if (!(n > 0)) return;
  const r = runGemState(gs);
  r[kind] = (r[kind] || 0) + n;
}
function runGemsTotal(gs) {
  return Object.values(runGemState(gs)).reduce((a, x) => a + x, 0);
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
  // 케이브가 건물이 되면서 레벨 폭이 1~5에서 0~11로 늘었다.
  // 정산의 무게는 그대로 두려고 절반으로 읽는다.
  const caveTerm = caveLevelOf(gs) * 0.5;
  // 처치 60마리당 1보석이던 것을 100마리당 1로 낮춘다.
  // v12.8에서 상단 물량을 절반 넘게 늘렸는데(스폰 뭉치기), 그러면 이 항이
  // 난이도를 올린 만큼 보석도 같이 불어난다 — 어렵게 만든 값이 보상으로 되돌아오면
  // 바꾼 것이 없다. 마릿수가 늘어난 비율만큼 분모를 키워 제자리에 둔다.
  const killTerm = Math.floor((gs.battle.runKills || 0) / GEM_KILLS_PER);
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
      return { rows, mult, gaveUp:!!gs.gaveUp, total: 0,
               already: runGemRows(gs), alreadyTotal: runGemsTotal(gs) };
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
    const caveLv   = caveLevelOf(gs);
    const caveRaw  = caveLv * 0.5;
    const killRaw  = Math.floor((gs.battle.runKills||0)/GEM_KILLS_PER);
    const sideNote = sideMult < 1 ? ` · 되짚기 ×${sideMult.toFixed(2)}` : '';
    rows.push({ label:'케이브 레벨', value:+(caveRaw*sideMult).toFixed(1), note:`Lv.${caveLv}${sideNote}` });
    rows.push({ label:'처치',        value:+(killRaw*sideMult).toFixed(1), note:`${gs.battle.runKills||0}마리 ÷ ${GEM_KILLS_PER}${sideNote}` });
    if (cleared > start) {
      rows.push({ label:'새로 돌파한 층', value:newDepthGems(cleared, start),
                  note:`${start}층 → ${cleared}층 · ${cleared-start}개 층` });
    }
    return { rows, mult, gaveUp:!!gs.gaveUp, total: calcSoulStones(gs),
             already: runGemRows(gs), alreadyTotal: runGemsTotal(gs) };
  }

  rows.push({ label: gs.stageCleared ? '훈련 완주' : '훈련 중단',
              value: gs.stageCleared ? TRAINING_CLEAR_GEMS : TRAINING_QUIT_GEMS,
              note: '훈련은 익히는 곳입니다 — 보석은 심연에서 법니다' });
  return { rows, mult, gaveUp:!!gs.gaveUp, total: calcSoulStones(gs),
           already: runGemRows(gs), alreadyTotal: runGemsTotal(gs) };
}

// 판 도중에 이미 받은 보석을 정산 화면용 줄로 만든다.
// 정산 총합(total)과는 별개다 — 이미 지갑에 들어간 값이라 다시 더하면 두 번 준다.
function runGemRows(gs) {
  const r = runGemState(gs), out = [];
  for (const k of Object.keys(RUN_GEM_KINDS)) {
    if (!(r[k] > 0)) continue;
    out.push({ label: RUN_GEM_KINDS[k].label, value: r[k], note: RUN_GEM_KINDS[k].note });
  }
  return out;
}
