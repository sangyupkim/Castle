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

// 건물 레벨은 내부적으로 0-based다 (0..BUILDING_MAX_LEVEL-1 = 화면상 Lv.1..Lv.10).
// 트랙의 unlockLv도 같은 기준이라, 최고 레벨 전용 트랙은 BUILDING_MAX_LEVEL-1을 쓴다.
// 건물 레벨업 비용 — 레벨마다 1.7배
function buildingLevelCost(def, nextLv) {
  return Math.round(def.lvCost * Math.pow(def.lvMult || 1.7, Math.max(0, nextLv - 1)));
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
    id:'workshop', name:'무기 공방', icon:'⚒️', buildCost:40, color:'#f59e0b',
    desc:'타워 성능을 연구하는 시설',
    lvCost:35, lvMult:1.7,
    tracks:[
      { id:'t_dmg',  name:'날붙이 연마', icon:'⚔️', unlockLv:0, cost:12, costMult:1.42, step:2,    growth:0.20,
        desc:v=>`모든 타워 공격력 +${Math.round(v)}`,        apply:(b,v)=>{ b.towerDmg += v; } },
      { id:'t_rng',  name:'조준경',     icon:'🔭', unlockLv:0, cost:15, costMult:1.45, step:0.03, growth:0.14,
        desc:v=>`타워 사거리 +${pct(v)}`,                    apply:(b,v)=>{ b.towerRangeMult += v; } },
      { id:'t_spd',  name:'속사 장치',   icon:'⚡', unlockLv:1, cost:22, costMult:1.48, step:0.04, growth:0.12,
        desc:v=>`타워 공격속도 +${pct(v)}`,                  apply:(b,v)=>{ b.towerSpdMult += v; } },
      { id:'t_cost', name:'대량 생산',   icon:'🏭', unlockLv:2, cost:26, costMult:1.55, step:1,    growth:0.10,
        desc:v=>`타워 건설비 -${Math.round(v)}`,             apply:(b,v)=>{ b.towerCostDiscount += Math.round(v); } },
      { id:'t_heavy',name:'강화 탄두',  icon:'💥', unlockLv:4, cost:60, costMult:1.55, step:5, growth:0.16, maxLv:8,
        desc:v=>`모든 타워 공격력 +${Math.round(v)}`,        apply:(b,v)=>{ b.towerDmg += v; } },
      { id:'t_inf',  name:'정밀 세공',   icon:'♾️', unlockLv:BUILDING_MAX_LEVEL-1, cost:180, costMult:1.26, step:4, growth:0.06, maxLv:Infinity,
        desc:v=>`모든 타워 공격력 +${Math.round(v)}`,        apply:(b,v)=>{ b.towerDmg += v; } },
    ]
  },
  {
    id:'barracks', name:'병영', icon:'⚔️', buildCost:30, color:'#60a5fa',
    desc:'용병을 훈련하는 시설',
    lvCost:30, lvMult:1.7,
    tracks:[
      { id:'u_atk',  name:'전투 훈련',  icon:'⚔️', unlockLv:0, cost:11, costMult:1.42, step:3,    growth:0.20,
        desc:v=>`아군 공격력 +${Math.round(v)}`,             apply:(b,v)=>{ b.unitAtk += v; } },
      { id:'u_hp',   name:'체력 단련',  icon:'💪', unlockLv:0, cost:11, costMult:1.42, step:14,   growth:0.20,
        desc:v=>`아군 최대 HP +${Math.round(v)}`,            apply:(b,v)=>{ b.unitHp += v; } },
      { id:'u_def',  name:'철갑 훈련',  icon:'🛡️', unlockLv:1, cost:14, costMult:1.45, step:2,    growth:0.18,
        desc:v=>`아군 방어력 +${Math.round(v)}`,             apply:(b,v)=>{ b.unitDef += v; } },
      { id:'u_aspd', name:'속공 훈련',  icon:'🌀', unlockLv:2, cost:24, costMult:1.50, step:0.035,growth:0.10,
        desc:v=>`아군 공격속도 +${pct(v)}`,                  apply:(b,v)=>{ b.unitAtkSpdMult += v; } },
      { id:'u_disc', name:'고용 할인',  icon:'💰', unlockLv:3, cost:20, costMult:1.55, step:1,    growth:0.08,
        desc:v=>`용병 고용비 -${Math.round(v)}`,             apply:(b,v)=>{ b.hireCostDiscount += Math.round(v); } },
      { id:'u_crit', name:'급소 교본',  icon:'🎯', unlockLv:4, cost:34, costMult:1.52, step:0.03, growth:0.08, maxLv:8,
        desc:v=>`치명타 확률 +${pct(v)}`,                    apply:(b,v)=>{ b.critChance += v; } },
      { id:'u_slot', name:'병력 증원',  icon:'➕', unlockLv:5, cost:60, costMult:2.10, step:1,    growth:0,    maxLv:4,
        desc:v=>`편성 슬롯 +${Math.round(v)}`,               apply:(b,v)=>{ b.maxSlotBonus += Math.round(v); } },
      { id:'u_inf',  name:'불굴의 대열', icon:'♾️', unlockLv:BUILDING_MAX_LEVEL-1, cost:170, costMult:1.26, step:5, growth:0.06, maxLv:Infinity,
        desc:v=>`아군 공격력 +${Math.round(v)} · HP +${Math.round(v*4)}`,
        apply:(b,v)=>{ b.unitAtk += v; b.unitHp += v*4; } },
    ]
  },
  {
    id:'heroShop', name:'영웅 상점', icon:'🏪', buildCost:25, color:'#a78bfa',
    desc:'영웅 아이템을 구매하는 시설',
    lvCost:32, lvMult:1.7,
    tracks:[
      { id:'h_atk',  name:'영웅 단련',  icon:'👑', unlockLv:0, cost:13, costMult:1.44, step:4,    growth:0.20,
        desc:v=>`영웅 공격력 +${Math.round(v)}`,             apply:(b,v)=>{ b.heroAtk += v; } },
      { id:'h_exp',  name:'전투 교본',  icon:'📖', unlockLv:0, cost:16, costMult:1.46, step:0.10, growth:0.10,
        desc:v=>`영웅 경험치 +${pct(v)}`,                    apply:(b,v)=>{ b.heroExpMult += v; } },
      { id:'h_stat', name:'영웅 각성',  icon:'✨', unlockLv:2, cost:30, costMult:1.52, step:0.05, growth:0.10,
        desc:v=>`영웅 전체 능력치 +${pct(v)}`,               apply:(b,v)=>{ b.heroStatMult += v; } },
      { id:'h_aura', name:'지휘 오라',  icon:'🎖️', unlockLv:3, cost:28, costMult:1.50, step:2,    growth:0.15,
        desc:v=>`영웅 방어력 +${Math.round(v)}`,             apply:(b,v)=>{ b.heroAura += v; } },
      { id:'h_rev',  name:'구원의 손',  icon:'🕊️', unlockLv:4, cost:38, costMult:1.55, step:1.2,  growth:0.10, maxLv:8,
        desc:v=>`영웅 부활 시간 -${v.toFixed(1)}초`,         apply:(b,v)=>{ b.heroReviveReduction += v; } },
      { id:'h_inf',  name:'전설의 무구', icon:'♾️', unlockLv:BUILDING_MAX_LEVEL-1, cost:190, costMult:1.27, step:0.04, growth:0.05, maxLv:Infinity,
        desc:v=>`영웅 전체 능력치 +${pct(v)}`,               apply:(b,v)=>{ b.heroStatMult += v; } },
    ]
  },
  {
    id:'inn', name:'여관', icon:'🏨', buildCost:35, color:'#f472b6',
    desc:'회복 · 특수 용병 고용',
    lvCost:40, lvMult:1.72,
    tracks:[
      { id:'i_rest', name:'따뜻한 잠자리', icon:'🛏️', unlockLv:0, cost:12, costMult:1.44, step:0.03, growth:0.10,
        desc:v=>`웨이브 후 회복 +${pct(v)}`,                 apply:(b,v)=>{ b.restHealBonus += v; } },
      { id:'i_meal', name:'뜨거운 식사',   icon:'🍲', unlockLv:0, cost:15, costMult:1.44, step:16,   growth:0.18,
        desc:v=>`아군 최대 HP +${Math.round(v)}`,            apply:(b,v)=>{ b.unitHp += v; } },
      { id:'i_tonic',name:'회복 물약',     icon:'🧴', unlockLv:1, cost:26, costMult:1.50, step:0.09, growth:0.08, maxLv:8,
        desc:v=>`전투 중 자연 회복 +${pct(v)}`,              apply:(b,v)=>{ b.regenBonus += v; } },
      // 특수 용병 — 여관의 본체
      { id:'i_luck', name:'소문난 주점',   icon:'🍺', unlockLv:1, cost:28, costMult:1.52, step:0.06, growth:0.08, maxLv:8,
        desc:v=>`특수 용병 등장 확률 +${pct(v)}`,            apply:(b,v)=>{ b.specialChance += v; } },
      { id:'i_slot', name:'별관 증축',     icon:'🚪', unlockLv:2, cost:55, costMult:2.05, step:1,    growth:0,    maxLv:4,
        desc:v=>`특수 용병 슬롯 +${Math.round(v)}`,          apply:(b,v)=>{ b.specialSlotBonus += Math.round(v); } },
      { id:'i_hero', name:'영웅 대접',     icon:'🍷', unlockLv:5, cost:70, costMult:2.0,  step:1,    growth:0,    maxLv:1,
        desc:()=>'웨이브 후 영웅 완전 회복',                  apply:(b)=>{ b.heroFullRest = true; } },
      { id:'i_inf',  name:'끝없는 환대',   icon:'♾️', unlockLv:BUILDING_MAX_LEVEL-1, cost:160, costMult:1.25, step:0.03, growth:0.05, maxLv:Infinity,
        desc:v=>`웨이브 후 회복 +${pct(v)}`,                 apply:(b,v)=>{ b.restHealBonus += v; } },
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
  { id:'potion_hp',  name:'회복 포션',    icon:'🧪', cost:12, type:'consumable', grade:'common', desc:'영웅 HP 완전 회복',             apply:gs=>{ gs.hero.hp = HERO_LEVELS[gs.hero.level].hp; } },
  { id:'potion_mp',  name:'MP 포션',      icon:'💧', cost: 8, type:'consumable', grade:'common', desc:'이번 웨이브 MP 충전',           apply:gs=>{ gs.town.waveBuffs.push('mp_full'); } },
  { id:'scroll_atk', name:'공격 두루마리',icon:'📜', cost:15, type:'scroll',     grade:'rare',   desc:'이번 웨이브 영웅 스탯 +30%',    apply:gs=>{ gs.town.waveBuffs.push('hero_atk'); } },
  { id:'scroll_def', name:'방어 두루마리',icon:'📜', cost:15, type:'scroll',     grade:'rare',   desc:'이번 웨이브 아군 방어 +5',      apply:gs=>{ gs.town.waveBuffs.push('unit_def'); } },
];

const HERO_EQUIPMENT_POOL = [
  { id:'sword_iron',   name:'강철 검',        icon:'⚔️', cost:30, grade:'common', slot:'무기',   desc:'영웅 ATK +8',                    apply:b=>{ b.heroAtk += 8; } },
  { id:'sword_silver', name:'은빛 검',        icon:'⚔️', cost:55, grade:'rare',   slot:'무기',   desc:'영웅 ATK +18, 스탯 +10%',        apply:b=>{ b.heroAtk += 18; b.heroStatMult *= 1.10; } },
  { id:'armor_chain',  name:'사슬 갑옷',      icon:'🥋', cost:35, grade:'common', slot:'방어구', desc:'아군 방어 오라 +4',               apply:b=>{ b.heroAura += 4; } },
  { id:'ring_hp',      name:'생명의 반지',    icon:'💍', cost:25, grade:'common', slot:'장신구', desc:'영웅 재생 +3/s',                  apply:b=>{ b.heroRegen += 3; } },
  { id:'amulet_power', name:'힘의 부적',      icon:'🔮', cost:45, grade:'rare',   slot:'장신구', desc:'아군 ATK +5, 영웅 ATK +10',       apply:b=>{ b.heroAtk += 10; b.unitAtk += 5; } },
  { id:'boots_swift',  name:'신속의 장화',    icon:'👟', cost:30, grade:'common', slot:'방어구', desc:'타워 공속 +15%',                  apply:b=>{ b.towerSpdMult *= 1.15; } },
  { id:'helm_warrior', name:'전사의 투구',    icon:'⛑️', cost:40, grade:'rare',   slot:'방어구', desc:'아군 방어 오라 +3',               apply:b=>{ b.heroAura += 3; } },
  { id:'staff_mage',   name:'마법사 지팡이',  icon:'🪄', cost:50, grade:'rare',   slot:'무기',   desc:'영웅 스탯 +15%',                  apply:b=>{ b.heroStatMult *= 1.15; } },
  { id:'cape_shadow',  name:'그림자 망토',    icon:'🦸', cost:65, grade:'epic',   slot:'방어구', desc:'불굴의 의지 + 콤보 +15%',         apply:b=>{ b.undying=true; b.comboChance+=0.15; } },
  { id:'ring_gold',    name:'황금 반지',      icon:'💍', cost:35, grade:'common', slot:'장신구', desc:'처치 골드 +20%',                  apply:b=>{ b.battleGoldMult *= 1.20; } },
  { id:'cross_holy',   name:'성스러운 십자가',icon:'✝️', cost:55, grade:'rare',   slot:'장신구', desc:'처치 시 아군 HP +5 회복',          apply:b=>{ b.killHeal += 5; } },
  { id:'scroll_epic',  name:'마법의 두루마리',icon:'📜', cost:70, grade:'epic',   slot:'장신구', desc:'영웅 즉시 부활',                   apply:b=>{ b.heroInstantRevive=true; } },
];

function createTown() {
  return {
    screen:'main',   // 'main' | building.id
    scroll:0,        // 건물 강화 목록 스크롤
    tab:'town',      // 'town' | 'army'
    buildings:{
      workshop:{ built:false, level:0, upgrades:{} },
      barracks: { built:false, level:0, upgrades:{} },
      heroShop: { built:false, level:0, upgrades:{} },
      inn:      { built:false, level:0, upgrades:{} },
      cave:     { built:true,  level:0, upgrades:{} },
    },
    equippedItems:[],
    shopItems:[],
    waveBuffs:[],
  };
}

function refreshHeroShop(gs) {
  const pool = HERO_EQUIPMENT_POOL.filter(e=>!gs.town.equippedItems.includes(e.id));
  const picked=[], avail=[...pool];
  while (picked.length<3 && avail.length>0) {
    const i=Math.floor(Math.random()*avail.length);
    picked.push(avail.splice(i,1)[0]);
  }
  gs.town.shopItems = picked;
}

function buildBuilding(id, gs) {
  const def=TOWN_BUILDINGS.find(b=>b.id===id);
  const bs=gs.town.buildings[id];
  if (!def||!bs||bs.built) return false;
  if (gs.gold<def.buildCost) return false;
  gs.gold-=def.buildCost; bs.built=true; bs.level=0;
  if (id==='heroShop') refreshHeroShop(gs);
  return true;
}

function levelUpBuilding(id, gs) {
  const def=TOWN_BUILDINGS.find(b=>b.id===id);
  const bs=gs.town.buildings[id];
  if (!def||!bs||!bs.built) return false;
  const nextLv=(bs.level||0)+1;
  if (nextLv>BUILDING_MAX_LEVEL-1) return false;
  const cost=buildingLevelCost(def, nextLv);
  if (gs.gold<cost) return false;
  gs.gold-=cost; bs.level=nextLv;
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
  if (n>=trackMax(tr)) return false;
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
    if (!gs.town.equippedItems.includes(item.id)) {
      gs.town.equippedItems.push(item.id);
      item.apply(BONUSES);
    }
    refreshHeroShop(gs);
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
  for (const itemId of (gs.town.equippedItems||[])) {
    const item=HERO_EQUIPMENT_POOL.find(e=>e.id===itemId);
    if (item) item.apply(BONUSES);
  }
  for (const buff of (gs.town.waveBuffs||[])) {
    if (buff==='hero_atk') BONUSES.heroStatMult*=1.30;
    if (buff==='unit_def') BONUSES.unitDef+=5;
  }
}

function reapplyAllBonuses(gs) {
  resetBonuses();
  applySkillTree(gs);
  applyPacts();          // 서약은 스킬 트리 뒤, 마을 강화 앞에 적용한다
  // 병기 연구 — 런 안에서 산 만큼 누적된다
  const rn = gs.research || 0;
  if (rn > 0) { BONUSES.towerDmg += rn * RESEARCH_TOWER_DMG; BONUSES.unitAtk += rn * RESEARCH_UNIT_ATK; }
  applyTownUpgrades(gs);
  if (gs.battle) gs.battle.maxSlots=Math.max(1,Math.floor((4+BONUSES.maxSlotBonus)*(BONUSES.pactSlotMult||1)));
}
