'use strict';

const TOWN_BUILDINGS = [
  {
    id:'workshop', name:'무기 공방', icon:'⚒️', buildCost:40, color:'#f59e0b',
    desc:'타워 성능을 연구하는 시설',
    levels:[
      { levelName:'Lv.1', upgradeCost:0, upgrades:[
        { id:'tw_atk1',  name:'정밀 조준',  icon:'🏹', cost:15, maxLv:3, desc:lv=>`타워 공격력 +${lv*3}`,    apply:(b,lv)=>{ b.towerDmg += lv*3; } },
        { id:'tw_spd1',  name:'속사 훈련',  icon:'⚡', cost:15, maxLv:3, desc:lv=>`타워 공속 +${lv*10}%`,   apply:(b,lv)=>{ b.towerSpdMult   *= Math.pow(1.10,lv); } },
        { id:'tw_range1',name:'망루 확장',  icon:'👁️', cost:20, maxLv:2, desc:lv=>`타워 사거리 +${lv*10}%`, apply:(b,lv)=>{ b.towerRangeMult *= Math.pow(1.10,lv); } },
      ]},
      { levelName:'Lv.2', upgradeCost:60, upgrades:[
        { id:'tw_atk2',  name:'강철 화살촉',icon:'🏹', cost:25, maxLv:3, desc:lv=>`타워 공격력 +${lv*6}`,    apply:(b,lv)=>{ b.towerDmg += lv*6; } },
        { id:'tw_spd2',  name:'연사 장치',  icon:'⚡', cost:30, maxLv:2, desc:lv=>`타워 공속 +${lv*20}%`,   apply:(b,lv)=>{ b.towerSpdMult   *= Math.pow(1.20,lv); } },
        { id:'tw_splash',name:'폭발 화살',  icon:'💥', cost:50, maxLv:1, desc:()=>'타워 피격 시 범위 피해',  apply:(b)=>  { b.towerSplash = true; } },
        { id:'tw_cost',  name:'대량 생산',  icon:'🏗️', cost:35, maxLv:1, desc:()=>'타워 건설 비용 -5',      apply:(b)=>  { b.towerCostDiscount += 5; } },
      ]},
    ]
  },
  {
    id:'barracks', name:'병영', icon:'⚔️', buildCost:30, color:'#60a5fa',
    desc:'용병을 훈련하는 시설',
    levels:[
      { levelName:'Lv.1', upgradeCost:0, upgrades:[
        { id:'u_atk1',name:'전투 훈련', icon:'⚔️', cost:12, maxLv:3, desc:lv=>`아군 공격력 +${lv*3}`,  apply:(b,lv)=>{ b.unitAtk += lv*3; } },
        { id:'u_def1',name:'철갑 훈련', icon:'🛡️', cost:12, maxLv:3, desc:lv=>`아군 방어력 +${lv*2}`,  apply:(b,lv)=>{ b.unitDef += lv*2; } },
        { id:'u_hp1', name:'체력 단련', icon:'💪', cost:12, maxLv:3, desc:lv=>`아군 HP +${lv*15}`,     apply:(b,lv)=>{ b.unitHp  += lv*15; } },
        { id:'u_disc',name:'고용 할인', icon:'💰', cost:20, maxLv:2, desc:lv=>`고용 비용 -${lv}`,       apply:(b,lv)=>{ b.hireCostDiscount += lv; } },
      ]},
      { levelName:'Lv.2', upgradeCost:50, upgrades:[
        { id:'u_atk2', name:'정예 훈련', icon:'⚔️', cost:25, maxLv:3, desc:lv=>`아군 공격력 +${lv*6}`,  apply:(b,lv)=>{ b.unitAtk += lv*6; } },
        { id:'u_def2', name:'중갑 착용', icon:'🛡️', cost:25, maxLv:3, desc:lv=>`아군 방어력 +${lv*4}`,  apply:(b,lv)=>{ b.unitDef += lv*4; } },
        { id:'u_slot', name:'병력 증원', icon:'➕', cost:35, maxLv:2, desc:lv=>`병력 슬롯 +${lv}`,       apply:(b,lv)=>{ b.maxSlotBonus += lv; } },
        { id:'u_combo',name:'연속 공격', icon:'🔥', cost:40, maxLv:1, desc:()=>'틱당 20% 추가 공격',      apply:(b)=>  { b.comboChance += 0.2; } },
      ]},
    ]
  },
  {
    id:'heroShop', name:'영웅 상점', icon:'🏪', buildCost:25, color:'#a78bfa',
    desc:'영웅 아이템을 구매하는 시설',
    levels:[
      { levelName:'Lv.1', upgradeCost:0, upgrades:[] },
      { levelName:'Lv.2', upgradeCost:45, upgrades:[] },
    ]
  },
  {
    id:'cave', name:'몬스터 케이브', icon:'🗿', buildCost:0, color:'#6b7280',
    desc:'몬스터 던전을 관리합니다', alwaysBuilt:true,
    levels:[
      { levelName:'Lv.1', upgradeCost:0, upgrades:[
        { id:'cave_gold1',name:'금맥 개발',    icon:'💰', cost:20, maxLv:3, desc:lv=>`전투 골드 +${lv*15}%`,     apply:(b,lv)=>{ b.battleGoldMult *= Math.pow(1.15,lv); } },
        { id:'cave_weak', name:'몬스터 약화',  icon:'⬇️', cost:25, maxLv:2, desc:lv=>`몬스터 HP -${lv*10}%`,    apply:(b,lv)=>{ b.mobHpMult *= Math.pow(0.90,lv); } },
      ]},
      { levelName:'Lv.2', upgradeCost:55, upgrades:[
        { id:'cave_elite',name:'엘리트 소환',  icon:'👹', cost:30, maxLv:2, desc:lv=>`엘리트 확률 +${lv*10}%`,  apply:(b,lv)=>{ b.eliteChance=(b.eliteChance||0)+lv*0.10; } },
        { id:'cave_drop', name:'아이템 발굴',  icon:'💎', cost:35, maxLv:2, desc:lv=>`아이템 드랍 +${lv*15}%`,  apply:(b,lv)=>{ b.dropChance=(b.dropChance||0)+lv*0.15; } },
        { id:'cave_gold2',name:'보물 창고',    icon:'🌟', cost:40, maxLv:2, desc:lv=>`전투 골드 +${lv*25}%`,    apply:(b,lv)=>{ b.battleGoldMult *= Math.pow(1.25,lv); } },
      ]},
    ]
  },
];

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
    tab:'town',      // 'town' | 'army'
    buildings:{
      workshop:{ built:false, level:0, upgrades:{} },
      barracks: { built:false, level:0, upgrades:{} },
      heroShop: { built:false, level:0, upgrades:{} },
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
  if (nextLv>=def.levels.length) return false;
  const cost=def.levels[nextLv].upgradeCost;
  if (gs.gold<cost) return false;
  gs.gold-=cost; bs.level=nextLv;
  return true;
}

function buyTownUpgrade(buildingId, upgradeId, gs) {
  const def=TOWN_BUILDINGS.find(b=>b.id===buildingId);
  const bs=gs.town.buildings[buildingId];
  if (!def||!bs||!bs.built) return false;
  const upg=def.levels.slice(0,(bs.level||0)+1).flatMap(l=>l.upgrades).find(u=>u.id===upgradeId);
  if (!upg) return false;
  const curLv=bs.upgrades[upgradeId]||0;
  if (curLv>=upg.maxLv||gs.gold<upg.cost) return false;
  gs.gold-=upg.cost; bs.upgrades[upgradeId]=curLv+1;
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

function applyTownUpgrades(gs) {
  for (const def of TOWN_BUILDINGS) {
    const bs=gs.town.buildings[def.id];
    if (!bs||(!bs.built&&!def.alwaysBuilt)) continue;
    const maxLv=bs.level||0;
    for (let lv=0; lv<=maxLv&&lv<def.levels.length; lv++) {
      for (const upg of def.levels[lv].upgrades) {
        const n=bs.upgrades[upg.id]||0;
        if (n>0) upg.apply(BONUSES,n);
      }
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
  applyMetaUpgrades(gs);
  applyTownUpgrades(gs);
  if (gs.battle) gs.battle.maxSlots=4+BONUSES.maxSlotBonus;
}
