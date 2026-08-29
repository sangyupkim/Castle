'use strict';

// ─── 마을 건물 ───────────────────────────────────────────────────────────────
// v3.4에서 구조를 다시 잡았다.
//
// 이전에는 건물마다 levels[] 안에 강화 목록을 손으로 적어뒀다. 레벨이 2까지뿐이라
// 무한 모드에 들어가면 살 것이 금세 바닥났고, 10레벨로 늘리려면 항목을 120개 넘게
// 손으로 써야 했다.
//
// 그래서 건물은 이제 "강화 트랙" 목록을 갖는다. 트랙 하나가 곧 하나의 강화 항목이고,
// 몇 번이든 반복 구매한다. 살 때마다
//   비용   = cost × costMult^(n-1)          — 지수로 오른다
//   효과   = step × (1 + (n-1) × growth)    — 상승치도 조금씩 커진다
// 건물 레벨은 어떤 트랙이 열리는지를 정한다(unlockLv).
//
// 최고 레벨(10)에 닿으면 maxLv가 없는 ♾ 무한 트랙이 열린다. 비용이 계속 오르므로
// 수입이 아무리 늘어도 흡수한다 — 무한 모드의 골드 사용처가 마르지 않게 하는 장치다.

const BUILDING_MAX_LEVEL = 10;

// ─── v3.9 — 마을이 골드를 다 못 먹고 있었다 ──────────────────────────────────
// 실측: 15층에서 골드가 12만 넘게 남았다. 살 것이 바닥나면 후반의 모든 판단이
// "어차피 남으니까 아무거나"가 된다. 세 갈래로 조인다.
//
//  1. 값 자체를 올린다 — 건설비 ~1.9배, 레벨업비 ~1.9배에 배수도 1.7→1.85.
//  2. 한 번에 다 못 찍게 한다 — 트랙마다 살 수 있는 횟수를 건물 레벨이 정한다.
//     Lv.1이면 2번, 레벨이 오를 때마다 +1. 10레벨이 돼야 10번까지 간다.
//  3. 레벨업에 조건을 건다 — 🏰성채 레벨(전역)과 그 건물에서 산 강화 수(지역).
//     골드만 있으면 다 되는 구조에서는 "무엇을 먼저 올릴까"가 선택이 아니다.
const TRACK_CAP_BASE   = 2;    // Lv.1에서 트랙 하나를 살 수 있는 횟수
const TRACK_CAP_PER_LV = 1;    // 건물 레벨마다 +1
// 건물 레벨업에 필요한, 그 건물에서 산 강화 총 횟수 (다음 레벨 × 이 값)
const LEVELUP_UPGRADES_PER_LV = 3;
// 🏰 성채가 다른 건물보다 이만큼까지는 앞서 올릴 수 있다.
// 0이면 성채와 나란히만 가고, 1이면 성채보다 한 단계 위까지 허용한다.
const CASTLE_LEAD = 1;

// 이 트랙을 지금 건물 레벨에서 몇 번까지 살 수 있나
function trackCapAt(tr, level) {
  const hard = trackMax(tr);
  if (hard === Infinity) return Infinity;   // ♾ 트랙은 최고 레벨 전용이라 따로 안 막는다
  return Math.min(hard, TRACK_CAP_BASE + (level || 0) * TRACK_CAP_PER_LV);
}
// 그 건물에서 지금까지 산 강화 총 횟수
function buildingUpgradeCount(bs) {
  let n = 0;
  for (const k in (bs.upgrades || {})) n += bs.upgrades[k] || 0;
  return n;
}
// 🏰 성채 레벨이 정하는 다른 건물의 레벨 상한
function castleLevel(gs) {
  const c = gs.town && gs.town.buildings && gs.town.buildings.castle;
  return c ? (c.level || 0) : 0;
}
function buildingLevelCap(gs, id) {
  if (id === 'castle') return BUILDING_MAX_LEVEL - 1;   // 성채는 스스로가 상한이다
  return Math.min(BUILDING_MAX_LEVEL - 1, castleLevel(gs) + CASTLE_LEAD);
}
// 다음 레벨로 올릴 수 있는가 — { ok } 또는 { ok:false, why, need, have }
function canLevelUpBuilding(gs, id) {
  const def = TOWN_BUILDINGS.find(b => b.id === id);
  const bs  = gs.town.buildings[id];
  if (!def || !bs || !bs.built) return { ok:false, why:'built' };
  const next = (bs.level || 0) + 1;
  if (next > BUILDING_MAX_LEVEL - 1) return { ok:false, why:'max' };
  if (next > buildingLevelCap(gs, id))
    return { ok:false, why:'castle', need: next - CASTLE_LEAD, have: castleLevel(gs) };
  const needUp = next * LEVELUP_UPGRADES_PER_LV;
  const haveUp = buildingUpgradeCount(bs);
  if (haveUp < needUp) return { ok:false, why:'upgrades', need:needUp, have:haveUp };
  const cost = buildingLevelCost(def, next);
  if (gs.gold < cost) return { ok:false, why:'gold', need:cost, have:Math.floor(gs.gold) };
  return { ok:true, cost, next };
}

// 건물 레벨은 내부적으로 0-based다 (0..BUILDING_MAX_LEVEL-1 = 화면상 Lv.1..Lv.10).
// 트랙의 unlockLv도 같은 기준이라, 최고 레벨 전용 트랙은 BUILDING_MAX_LEVEL-1을 쓴다.
// 건물 레벨업 비용 — 레벨마다 lvMult배
function buildingLevelCost(def, nextLv) {
  return Math.round(def.lvCost * Math.pow(def.lvMult || 1.85, Math.max(0, nextLv - 1)));
}

// n번 구매했을 때 누적 효과
function trackTotal(tr, n) {
  const k = Math.max(0, n || 0);
  return tr.step * (k + (tr.growth || 0) * k * (k - 1) / 2);
}
// n+1번째 구매 비용
function trackCost(tr, n) {
  return Math.round(tr.cost * Math.pow(tr.costMult, Math.max(0, n || 0)));
}
function trackMax(tr) { return tr.maxLv === undefined ? 10 : tr.maxLv; }
function trackIsInfinite(tr) { return trackMax(tr) === Infinity; }

const pct = v => `${Math.round(v * 100)}%`;

const TOWN_BUILDINGS = [
  {
    id:'workshop', name:'무기 공방', icon:'⚒️', buildCost:75, color:'#f59e0b',
    desc:'타워 성능을 연구하는 시설',
    lvCost:66, lvMult:1.85,
    tracks:[
      // 정액이 아니라 배율이다. v1은 +38을 통째로 얹었는데 화살탑 기본 공격력이 2라
      // 10층에서 산 강화가 26층까지 그대로 통했다 — 적 체력 곡선이 아무 의미가 없었다.
      { id:'t_dmg',  name:'날붙이 연마', icon:'⚔️', unlockLv:0, cost:18, costMult:1.42, step:0.06, growth:0.06,
        desc:v=>`모든 타워 공격력 +${pct(v)}`,               apply:(b,v)=>{ b.towerDmgMult *= 1 + v; } },
      { id:'t_rng',  name:'조준경',     icon:'🔭', unlockLv:0, cost:22, costMult:1.45, step:0.03, growth:0.14,
        desc:v=>`타워 사거리 +${pct(v)}`,                    apply:(b,v)=>{ b.towerRangeMult += v; } },
      { id:'t_spd',  name:'속사 장치',   icon:'⚡', unlockLv:1, cost:33, costMult:1.48, step:0.04, growth:0.12,
        desc:v=>`타워 공격속도 +${pct(v)}`,                  apply:(b,v)=>{ b.towerSpdMult += v; } },
      { id:'t_cost', name:'대량 생산',   icon:'🏭', unlockLv:2, cost:39, costMult:1.55, step:1,    growth:0.10,
        desc:v=>`타워 건설비 -${Math.round(v)}`,             apply:(b,v)=>{ b.towerCostDiscount += Math.round(v); } },
      { id:'t_heavy',name:'강화 탄두',  icon:'💥', unlockLv:4, cost:90, costMult:1.55, step:0.09, growth:0.07, maxLv:8,
        desc:v=>`모든 타워 공격력 +${pct(v)}`,               apply:(b,v)=>{ b.towerDmgMult *= 1 + v; } },
      { id:'t_crit', name:'예광탄',     icon:'✨', unlockLv:3, cost:44, costMult:1.52, step:0.03, growth:0.08, maxLv:8,
        desc:v=>`타워 사거리 +${pct(v)} · 공격속도 +${pct(v*0.6)}`,
        apply:(b,v)=>{ b.towerRangeMult += v; b.towerSpdMult += v*0.6; } },
      { id:'t_pierce',name:'철갑 촉',    icon:'🔩', unlockLv:5, cost:72, costMult:1.55, step:1, growth:0.10, maxLv:8,
        desc:v=>`타워가 적 방어 ${Math.round(v)} 무시`,      apply:(b,v)=>{ b.towerPierce += Math.round(v); } },
      { id:'t_slow',  name:'냉각 코팅',  icon:'❄️', unlockLv:6, cost:80, costMult:1.56, step:0.02, growth:0.05, maxLv:8,
        desc:v=>`모든 타워에 감속 ${pct(v)}`,                apply:(b,v)=>{ b.towerSlow += v; } },
      { id:'t_inf',  name:'정밀 세공',   icon:'♾️', unlockLv:BUILDING_MAX_LEVEL-1, cost:270, costMult:1.26, step:0.03, growth:0.004, maxLv:Infinity,
        desc:v=>`모든 타워 공격력 +${pct(v)}`,               apply:(b,v)=>{ b.towerDmgMult *= 1 + v; } },
    ]
  },
  {
    id:'barracks', name:'병영', icon:'⚔️', buildCost:58, color:'#60a5fa',
    desc:'용병을 훈련하는 시설',
    lvCost:56, lvMult:1.85,
    tracks:[
      { id:'u_atk',  name:'전투 훈련',  icon:'⚔️', unlockLv:0, cost:16, costMult:1.42, step:3,    growth:0.20,
        desc:v=>`아군 공격력 +${Math.round(v)}`,             apply:(b,v)=>{ b.unitAtk += v; } },
      { id:'u_hp',   name:'체력 단련',  icon:'💪', unlockLv:0, cost:16, costMult:1.42, step:14,   growth:0.20,
        desc:v=>`아군 최대 HP +${Math.round(v)}`,            apply:(b,v)=>{ b.unitHp += v; } },
      { id:'u_def',  name:'철갑 훈련',  icon:'🛡️', unlockLv:1, cost:21, costMult:1.45, step:2,    growth:0.18,
        desc:v=>`아군 방어력 +${Math.round(v)}`,             apply:(b,v)=>{ b.unitDef += v; } },
      { id:'u_aspd', name:'속공 훈련',  icon:'🌀', unlockLv:2, cost:36, costMult:1.50, step:0.035,growth:0.10,
        desc:v=>`아군 공격속도 +${pct(v)}`,                  apply:(b,v)=>{ b.unitAtkSpdMult += v; } },
      { id:'u_disc', name:'고용 할인',  icon:'💰', unlockLv:3, cost:30, costMult:1.55, step:1,    growth:0.08,
        desc:v=>`용병 고용비 -${Math.round(v)}`,             apply:(b,v)=>{ b.hireCostDiscount += Math.round(v); } },
      { id:'u_crit', name:'급소 교본',  icon:'🎯', unlockLv:4, cost:51, costMult:1.52, step:0.03, growth:0.08, maxLv:8,
        desc:v=>`치명타 확률 +${pct(v)}`,                    apply:(b,v)=>{ b.critChance += v; } },
      { id:'u_slot', name:'병력 증원',  icon:'➕', unlockLv:5, cost:90, costMult:2.10, step:1,    growth:0,    maxLv:4,
        desc:v=>`편성 슬롯 +${Math.round(v)}`,               apply:(b,v)=>{ b.maxSlotBonus += Math.round(v); } },
      { id:'u_regen',name:'야전 의무',  icon:'🩹', unlockLv:3, cost:46, costMult:1.52, step:0.003, growth:0.06, maxLv:8,
        desc:v=>`전투 이탈 회복 +${pct(v)}/s`,               apply:(b,v)=>{ b.regenBonus += v; } },
      { id:'u_combo',name:'연계 훈련',  icon:'🔗', unlockLv:6, cost:76, costMult:1.55, step:0.025, growth:0.06, maxLv:8,
        desc:v=>`추가 타격 확률 +${pct(v)}`,                 apply:(b,v)=>{ b.comboChance += v; } },
      { id:'u_inf',  name:'불굴의 대열', icon:'♾️', unlockLv:BUILDING_MAX_LEVEL-1, cost:255, costMult:1.26, step:5, growth:0.06, maxLv:Infinity,
        desc:v=>`아군 공격력 +${Math.round(v)} · HP +${Math.round(v*4)}`,
        apply:(b,v)=>{ b.unitAtk += v; b.unitHp += v*4; } },
    ]
  },
  {
    id:'heroShop', name:'영웅 상점', icon:'🏪', buildCost:52, color:'#a78bfa',
    desc:'영웅 아이템을 구매하는 시설',
    lvCost:60, lvMult:1.85,
    tracks:[
      { id:'h_atk',  name:'영웅 단련',  icon:'👑', unlockLv:0, cost:20, costMult:1.44, step:4,    growth:0.20,
        desc:v=>`영웅 공격력 +${Math.round(v)}`,             apply:(b,v)=>{ b.heroAtk += v; } },
      { id:'h_exp',  name:'전투 교본',  icon:'📖', unlockLv:0, cost:24, costMult:1.46, step:0.10, growth:0.10,
        desc:v=>`영웅 경험치 +${pct(v)}`,                    apply:(b,v)=>{ b.heroExpMult += v; } },
      { id:'h_stat', name:'영웅 각성',  icon:'✨', unlockLv:2, cost:45, costMult:1.52, step:0.05, growth:0.10,
        desc:v=>`영웅 전체 능력치 +${pct(v)}`,               apply:(b,v)=>{ b.heroStatMult += v; } },
      { id:'h_aura', name:'지휘 오라',  icon:'🎖️', unlockLv:3, cost:42, costMult:1.50, step:2,    growth:0.15,
        desc:v=>`영웅 방어력 +${Math.round(v)}`,             apply:(b,v)=>{ b.heroAura += v; } },
      { id:'h_rev',  name:'구원의 손',  icon:'🕊️', unlockLv:4, cost:57, costMult:1.55, step:1,  growth:0, maxLv:8,
        desc:v=>`전사 후 복귀 HP +${Math.round(v*HERO_RETURN_HP_PER*100)}%p`, apply:(b,v)=>{ b.heroReviveReduction += v; } },
      { id:'h_regen',name:'성수 배급',  icon:'💚', unlockLv:5, cost:56, costMult:1.54, step:0.4, growth:0.10, maxLv:8,
        desc:v=>`영웅 재생 +${v.toFixed(1)}/s`,              apply:(b,v)=>{ b.heroRegen += v; } },
      { id:'h_skill',name:'각인 연구',  icon:'🔮', unlockLv:6, cost:72, costMult:1.55, step:0.05, growth:0.08, maxLv:8,
        desc:v=>`영웅 스킬 피해 +${pct(v)}`,                 apply:(b,v)=>{ b.heroSkillMult += v; } },
      { id:'h_inf',  name:'전설의 무구', icon:'♾️', unlockLv:BUILDING_MAX_LEVEL-1, cost:285, costMult:1.27, step:0.04, growth:0.05, maxLv:Infinity,
        desc:v=>`영웅 전체 능력치 +${pct(v)}`,               apply:(b,v)=>{ b.heroStatMult += v; } },
    ]
  },
  {
    id:'inn', name:'여관', icon:'🏨', buildCost:68, color:'#f472b6',
    desc:'웨이브 후 회복 · 특수 용병',
    lvCost:74, lvMult:1.85,
    // 여관이 하는 일은 둘뿐이다 — 웨이브가 끝난 뒤의 회복, 그리고 특수 용병.
    // 예전에는 '뜨거운 식사'(아군 최대 HP)가 있었는데 병영의 '체력 단련'과 같은 값을 올려서,
    // 두 건물이 같은 일을 하고 있었다. 겹치면 어느 쪽을 올릴지가 선택이 아니라 계산이 된다.
    tracks:[
      // ── 회복 ──
      { id:'i_rest', name:'따뜻한 잠자리', icon:'🛏️', unlockLv:0, cost:18, costMult:1.44, step:0.03, growth:0.10,
        desc:v=>`웨이브 후 회복 +${pct(v)}`,                 apply:(b,v)=>{ b.restHealBonus += v; } },
      { id:'i_hero', name:'영웅 대접',     icon:'🍷', unlockLv:4, cost:105, costMult:2.0,  step:1,    growth:0,    maxLv:1,
        desc:()=>'웨이브 후 영웅 완전 회복',                  apply:(b)=>{ b.heroFullRest = true; } },
      // ── 특수 용병 ──
      { id:'i_luck', name:'소문난 주점',   icon:'🍺', unlockLv:0, cost:42, costMult:1.52, step:0.06, growth:0.08, maxLv:8,
        desc:v=>`특수 용병 등장 확률 +${pct(v)}`,            apply:(b,v)=>{ b.specialChance += v; } },
      { id:'i_fame', name:'명성',          icon:'📜', unlockLv:1, cost:45, costMult:1.50, step:0.08, growth:0.10,
        desc:v=>`특수 용병 능력치 +${pct(v)}`,               apply:(b,v)=>{ b.specialUnitMult += v; } },
      { id:'i_slot', name:'별관 증축',     icon:'🚪', unlockLv:2, cost:82, costMult:2.05, step:1,    growth:0,    maxLv:4,
        desc:v=>`특수 용병 슬롯 +${Math.round(v)}`,          apply:(b,v)=>{ b.specialSlotBonus += Math.round(v); } },
      { id:'i_stock',name:'보급 계약',   icon:'📦', unlockLv:3, cost:44, costMult:1.52, step:8, growth:0.12,
        desc:v=>`매 층 시작 골드 +${Math.round(v)}`,          apply:(b,v)=>{ b.startGoldBonus += Math.round(v); } },
      { id:'i_gold', name:'단골 손님',   icon:'💰', unlockLv:5, cost:66, costMult:1.55, step:0.04, growth:0.08, maxLv:8,
        desc:v=>`전투 골드 +${pct(v)}`,                       apply:(b,v)=>{ b.battleGoldMult += v; } },
      { id:'i_inf',  name:'끝없는 환대',   icon:'♾️', unlockLv:BUILDING_MAX_LEVEL-1, cost:240, costMult:1.25, step:0.03, growth:0.05, maxLv:Infinity,
        desc:v=>`웨이브 후 회복 +${pct(v)} · 특수 용병 +${pct(v*2)}`,
        apply:(b,v)=>{ b.restHealBonus += v; b.specialUnitMult += v*2; } },
    ]
  },
  {
    id:'forge', name:'대장간', icon:'⚒️', buildCost:98, color:'#fb923c',
    desc:'장비를 연마하고 타워 심을 벼리는 곳',
    lvCost:84, lvMult:1.85,
    // 대장간의 본체는 보석을 쓰는 세 갈래(연마·합성·담금질)이고 아래 트랙은 곁가지다.
    tracks:[
      { id:'f_gearcost', name:'풀무 개량', icon:'🔥', unlockLv:0, cost:30, costMult:1.50, step:0.04, growth:0.08, maxLv:8,
        desc:v=>`장비 연마 효과 +${pct(v)}`,                 apply:(b,v)=>{ b.gearPlusBonus += v; } },
      { id:'f_sell',     name:'고철 회수', icon:'♻️', unlockLv:1, cost:36, costMult:1.50, step:0.05, growth:0.08,
        desc:v=>`타워 매각가 +${pct(v)}`,                    apply:(b,v)=>{ b.towerSellBonus += v; } },
      { id:'f_repair',   name:'성벽 담금질', icon:'🧱', unlockLv:2, cost:45, costMult:1.52, step:0.04, growth:0.10,
        desc:v=>`기지 피해 감소 +${pct(v)}`,                 apply:(b,v)=>{ b.baseDefPct += v; } },
      { id:'f_luck',     name:'장인의 눈', icon:'👁️', unlockLv:4, cost:72, costMult:1.58, step:0.02, growth:0.06, maxLv:8,
        desc:v=>`합성 성공 확률 +${pct(v)}`,                 apply:(b,v)=>{ b.fuseLuck += v; } },
      { id:'f_gem',      name:'감정사',   icon:'💎', unlockLv:5, cost:80, costMult:1.58, step:0.03, growth:0.06, maxLv:8,
        desc:v=>`층당 보석 +${pct(v)}`,                       apply:(b,v)=>{ b.gemMult *= 1 + v; } },
      { id:'f_drop',     name:'선별 수거', icon:'🔎', unlockLv:6, cost:72, costMult:1.55, step:0.015, growth:0.06, maxLv:8,
        desc:v=>`특수 드랍 확률 +${pct(v)}`,                  apply:(b,v)=>{ b.dropChance += v; } },
      { id:'f_inf',      name:'끝없는 망치', icon:'♾️', unlockLv:BUILDING_MAX_LEVEL-1, cost:262, costMult:1.26, step:0.025, growth:0.05, maxLv:Infinity,
        desc:v=>`타워 공격력 +${pct(v)} · 아군 공격력 +${pct(v)}`,
        apply:(b,v)=>{ b.towerDmgMult *= 1+v; b.unitAtkMult *= 1+v; } },
    ]
  },
  {
    // 🏰 성채 — 마을의 축이다. 성채 레벨이 다른 건물의 레벨 상한을 정하므로
    // "무엇을 먼저 올릴까"가 아니라 "성채를 언제 올릴까"가 첫 판단이 된다.
    // 강화도 다른 건물과 겹치지 않는다 — 여기만 **기지 자체**를 만진다.
    id:'castle', name:'성채', icon:'🏰', buildCost:0, color:'#facc15',
    desc:'기지를 키우는 곳 · 다른 건물의 레벨 상한', alwaysBuilt:true,
    lvCost:80, lvMult:1.92,
    tracks:[
      { id:'c_wall',  name:'성벽 증축',   icon:'🧱', unlockLv:0, cost:24, costMult:1.46, step:14, growth:0.16,
        desc:v=>`기지 최대 HP +${Math.round(v)}`,           apply:(b,v)=>{ b.baseHpMax += v; } },
      { id:'c_steel', name:'강철 성체',   icon:'🛡️', unlockLv:0, cost:30, costMult:1.50, step:0.025, growth:0.08, maxLv:8,
        desc:v=>`기지 피해 감소 ${pct(v)}`,                  apply:(b,v)=>{ b.baseDefPct += v; } },
      { id:'c_heal',  name:'자가 회복',   icon:'❤️', unlockLv:1, cost:34, costMult:1.50, step:0.25, growth:0.12,
        desc:v=>`웨이브 중 기지 재생 +${v.toFixed(1)}/s`,     apply:(b,v)=>{ b.baseRegen += v; } },
      // 🏹 최후 저지선 — 성채가 직접 쏜다. 사지 않으면 공격력이 0이라 아무 일도 없다.
      { id:'c_last',  name:'최후 저지선', icon:'🏹', unlockLv:2, cost:52, costMult:1.54, step:6, growth:0.20,
        desc:v=>`성채가 직접 공격 — 공격력 ${Math.round(v)}`, apply:(b,v)=>{ b.castleAtk += v; } },
      { id:'c_thorn', name:'가시 방벽',   icon:'🌵', unlockLv:3, cost:60, costMult:1.56, step:0.05, growth:0.06, maxLv:8,
        desc:v=>`돌진해 오는 적을 ${pct(v)} 확률로 막아낸다`, apply:(b,v)=>{ b.chargeBlock += v; } },
      { id:'c_gate',  name:'철문 보강',   icon:'🚪', unlockLv:4, cost:56, costMult:1.55, step:0.03, growth:0.07, maxLv:8,
        desc:v=>`기지에 닿은 적의 피해 ${pct(v)} 감소`,        apply:(b,v)=>{ b.breachReduce += v; } },
      { id:'c_range', name:'망루 증축',   icon:'🔭', unlockLv:5, cost:64, costMult:1.55, step:0.10, growth:0.08, maxLv:8,
        desc:v=>`성채 사거리 +${pct(v)} · 공격속도 +${pct(v*0.5)}`,
        apply:(b,v)=>{ b.castleRange += v; b.castleSpd *= 1 + v*0.5; } },
      { id:'c_winch', name:'권양기',      icon:'⚙️', unlockLv:6, cost:78, costMult:1.58, step:0.035, growth:0.05, maxLv:8,
        desc:v=>`과부하 쿨다운 -${pct(v)}`,
        apply:(b,v)=>{ b.overloadCdMult *= 1 - Math.min(0.6, v); } },
      { id:'c_store', name:'비축 창고',   icon:'📦', unlockLv:7, cost:70, costMult:1.56, step:12, growth:0.14,
        desc:v=>`매 층 시작 골드 +${Math.round(v)}`,          apply:(b,v)=>{ b.startGoldBonus += Math.round(v); } },
      { id:'c_inf',   name:'불멸의 성',   icon:'♾️', unlockLv:BUILDING_MAX_LEVEL-1, cost:300, costMult:1.26, step:0.02, growth:0.04, maxLv:Infinity,
        desc:v=>`기지 최대 HP +${pct(v)} · 피해 감소 +${pct(v*0.4)}`,
        apply:(b,v)=>{ b.baseHpMax += Math.round(BASE_HP_MAX * v); b.baseDefPct += v*0.4; } },
    ]
  },
  {
    id:'cave', name:'몬스터 케이브', icon:'🗿', buildCost:0, color:'#6b7280',
    desc:'몬스터 던전을 관리합니다', alwaysBuilt:true,
    lvCost:0, lvMult:1, tracks:[]
  }
];

// 이 건물 레벨에서 열려 있는 트랙
function buildingTracks(def, level) {
  return (def.tracks || []).filter(t => (t.unlockLv || 0) <= (level || 0));
}
// 다음 레벨에 새로 열리는 트랙
function tracksUnlockedAt(def, level) {
  return (def.tracks || []).filter(t => (t.unlockLv || 0) === level);
}

// 영웅 상점 고정 매대 — 소모품과 두루마리. 트랙 개편 때 실수로 같이 지워졌던 것을 되살린다.
const HERO_SHOP_FIXED = [
  { id:'potion_hp',  name:'회복 포션',    icon:'🧪', cost:12, type:'consumable', grade:'common', desc:'영웅 HP 완전 회복',             apply:gs=>{ gs.hero.hp = heroMaxHp(); } },
  { id:'potion_mp',  name:'MP 포션',      icon:'💧', cost: 8, type:'consumable', grade:'common', desc:'이번 웨이브 MP 충전',           apply:gs=>{ gs.town.waveBuffs.push('mp_full'); } },
  { id:'scroll_atk', name:'공격 두루마리',icon:'📜', cost:15, type:'scroll',     grade:'rare',   desc:'이번 웨이브 영웅 스탯 +30%',    apply:gs=>{ gs.town.waveBuffs.push('hero_atk'); } },
  { id:'scroll_def', name:'방어 두루마리',icon:'📜', cost:15, type:'scroll',     grade:'rare',   desc:'이번 웨이브 아군 방어 +5',      apply:gs=>{ gs.town.waveBuffs.push('unit_def'); } },
];

// 영웅 장비 도감과 착용 규칙은 js/hero.js로 옮겼다 — 칸이 정해진 이상 마을 코드가 아니다.

function createTown() {
  return {
    screen:'main',   // 'main' | building.id
    scroll:0,        // 건물 강화 목록 스크롤
    tab:'town',      // 'town' | 'army'
    heroView:false,  // 출전준비 › 영웅 상세 (장비·스킬)
    pick:null,       // 상세 화면에서 고른 장비/스킬 { kind, uid }
    shopTab:'buy',   // 영웅 상점 — 'buy' | 'upgrade'
    buildings:{
      workshop:{ built:false, level:0, upgrades:{} },
      barracks: { built:false, level:0, upgrades:{} },
      heroShop: { built:false, level:0, upgrades:{} },
      inn:      { built:false, level:0, upgrades:{} },
      forge:    { built:false, level:0, upgrades:{} },
      castle:   { built:true,  level:0, upgrades:{} },
      cave:     { built:true,  level:0, upgrades:{} },
    },
    gear:createHeroGear(),
    forgeTab:'gear',   // 대장간 — 'gear' | 'fuse' | 'temper'
    shopItems:[],
    waveBuffs:[],
  };
}

function refreshHeroShop(gs) {
  // 이미 가진 물건은 매대에서 빼둔다 — 같은 검이 세 자루 쌓이면 매대가 벌이 된다
  const owned = new Set((heroGear(gs).inventory || []).map(e => e.itemId));
  const pool = HERO_EQUIPMENT_POOL.filter(e => !owned.has(e.id));
  const picked=[], avail=[...pool];
  while (picked.length<3 && avail.length>0) {
    const i=Math.floor(Math.random()*avail.length);
    picked.push(avail.splice(i,1)[0]);
  }
  gs.town.shopItems = picked;
  if (skillShopOpen(gs)) refreshSkillOffers(gs);
}

function buildBuilding(id, gs) {
  const def=TOWN_BUILDINGS.find(b=>b.id===id);
  const bs=gs.town.buildings[id];
  if (!def||!bs||bs.built) return false;
  if (gs.gold<def.buildCost) return false;
  gs.gold-=def.buildCost; bs.built=true; bs.level=0;
  if (id==='heroShop') refreshHeroShop(gs);
  if (typeof tut !== 'undefined' && tut && tut.showTip) {
    if (id === 'inn') tut.showTip('inn');
    else              tut.showTip('town');
  }
  return true;
}

function levelUpBuilding(id, gs) {
  const chk = canLevelUpBuilding(gs, id);
  if (!chk.ok) return false;
  const bs = gs.town.buildings[id];
  gs.gold -= chk.cost; bs.level = chk.next;
  // 스킬 매대가 막 열렸다면 첫 매물을 바로 깔아준다 — 다음 웨이브까지 빈 칸이 아니라
  if (id==='heroShop' && skillShopOpen(gs) && !(heroGear(gs).skillOffers||[]).length) {
    refreshSkillOffers(gs);
    if (typeof tut !== 'undefined' && tut && tut.showTip) tut.showTip('skillslot');
  }
  reapplyAllBonuses(gs);
  return true;
}

function buyTownUpgrade(buildingId, trackId, gs) {
  const def=TOWN_BUILDINGS.find(b=>b.id===buildingId);
  const bs=gs.town.buildings[buildingId];
  if (!def||!bs||!bs.built) return false;
  const tr=buildingTracks(def, bs.level||0).find(t=>t.id===trackId);
  if (!tr) return false;
  const n=bs.upgrades[trackId]||0;
  if (n>=trackCapAt(tr, bs.level||0)) return false;
  const cost=trackCost(tr, n);
  if (gs.gold<cost) return false;
  gs.gold-=cost; bs.upgrades[trackId]=n+1;
  reapplyAllBonuses(gs);
  return true;
}

function buyShopItem(item, gs) {
  if (gs.gold<item.cost) return false;
  gs.gold-=item.cost;
  if (item.type==='consumable'||item.type==='scroll') {
    item.apply(gs);
  } else {
    // 산 물건은 보관함으로 간다. 끼우는 것은 출전준비에서 직접 — 사는 것과 고르는 것은 다른 결정이다.
    const g = heroGear(gs);
    const entry = { uid:gearUid(), itemId:item.id };
    g.inventory.push(entry);
    // 그 칸이 비어 있으면 바로 끼워준다 (첫 장비를 사고 어디로 갔는지 헤매지 않게)
    const free = slotsForItem(item).find(sl => g.equipped[sl] == null);
    if (free) equipGear(gs, entry.uid, free);
    else reapplyAllBonuses(gs);
    if (typeof tut !== 'undefined' && tut && tut.showTip) tut.showTip('gear');
    gs.town.shopItems = gs.town.shopItems.filter(it => it.id !== item.id);
  }
  return true;
}

// 여관은 지은 것만으로 효과가 있다.
// 업그레이드를 사야 비로소 쓸모가 생기면 "짓는 결정" 자체가 보상이 없다.
// 기본 +12%, 레벨마다 +6% — 그 위에 개별 강화가 얹힌다.
const INN_BASE_REST  = 0.12;
const INN_LEVEL_REST = 0.03;

function applyTownUpgrades(gs) {
  for (const def of TOWN_BUILDINGS) {
    const bs=gs.town.buildings[def.id];
    if (!bs||(!bs.built&&!def.alwaysBuilt)) continue;
    const lv=bs.level||0;
    // 여관은 지은 것만으로 효과가 있다 — 트랙을 사기 전에도 보상이 있어야 짓는 결정에 의미가 생긴다
    if (def.id === 'inn') BONUSES.restHealBonus += INN_BASE_REST + lv * INN_LEVEL_REST;
    for (const tr of buildingTracks(def, lv)) {
      const n=bs.upgrades[tr.id]||0;
      if (n>0) tr.apply(BONUSES, trackTotal(tr, n));
    }
  }
  applyHeroGear(gs);
  for (const buff of (gs.town.waveBuffs||[])) {
    if (buff==='hero_atk') BONUSES.heroStatMult*=1.30;
    if (buff==='unit_def') BONUSES.unitDef+=5;
  }
}

function reapplyAllBonuses(gs) {
  resetBonuses();
  applySkillTree(gs);
  applyPacts();          // 서약은 스킬 트리 뒤, 마을 강화 앞에 적용한다
  applyTownUpgrades(gs);
  applyRunUpgrades(gs);   // 이번 판에 집은 강화 카드
  applyForge(gs);         // ⚒️ 대장간 담금질 숙련도
  applyAscend(gs);        // ♾️ 승천 — 끝나지 않는 보석 사용처
  applyCharms(gs);        // 🎴 이번 판에 들고 온 부적
  // 각인은 마지막에 — 스킬 트리와 마을 강화 위에 얹힌다
  const sg = (typeof activeSigil === 'function') ? activeSigil() : null;
  if (sg && sg.apply) sg.apply(BONUSES);
  recalcMaxSlots(gs);
}
