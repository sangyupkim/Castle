'use strict';

// ─── 👑 영웅 장비 · 스킬 ──────────────────────────────────────────────────────
// 영웅은 오래도록 "레벨만 오르는 스탯 덩어리"였다. 상점에서 산 장비는 사는 즉시
// 영구히 붙어버려서 고를 것이 없었고 — 비싼 걸 사면 그게 정답이었다 —
// 스킬은 각인 하나가 전부였다.
//
// 여기서 바꾸는 것은 셋이다.
//  1. 장비는 정해진 칸(무기·투구·갑옷·각반·신발·악세 ×2)에만 들어간다.
//     사면 인벤토리로 가고, 장착은 출전준비에서 직접 한다.
//  2. 스킬은 상점을 키워야 팔리고, 하나하나 굴림값이 달라서 같은 스킬도 같지 않다.
//     영웅 레벨이 오르면 낄 수 있는 칸이 늘어난다.
//  3. 무엇을 끼든 옆의 스탯창이 바뀌는 값을 그 자리에서 보여준다.

// ── 장비 칸 ─────────────────────────────────────────────────────────────────
const EQUIP_SLOTS = [
  { id:'weapon', name:'무기',   icon:'⚔️', accepts:'weapon' },
  { id:'helmet', name:'투구',   icon:'⛑️', accepts:'helmet' },
  { id:'armor',  name:'갑옷',   icon:'🥋', accepts:'armor'  },
  { id:'pants',  name:'각반',   icon:'👖', accepts:'pants'  },
  { id:'boots',  name:'신발',   icon:'👟', accepts:'boots'  },
  { id:'acc1',   name:'악세 1', icon:'💍', accepts:'acc'    },
  { id:'acc2',   name:'악세 2', icon:'📿', accepts:'acc'    },
];
function slotDef(id) { return EQUIP_SLOTS.find(s => s.id === id); }
// 이 아이템이 들어갈 수 있는 칸들 — 악세는 두 칸 중 아무데나
function slotsForItem(item) {
  if (!item) return [];
  return EQUIP_SLOTS.filter(s => s.accepts === item.slot).map(s => s.id);
}

// ── 스탯 표 ─────────────────────────────────────────────────────────────────
// 장비도 스킬도 전부 이 표의 키로만 값을 준다. 그래야 스탯창이 "무엇이 얼마나
// 바뀌는지"를 계산할 수 있다 — 임의의 apply() 클로저였다면 미리보기가 불가능했다.
const EQUIP_STATS = {
  atk:   { name:'공격력',   icon:'⚔️', pct:false, apply:(b,v)=>{ b.heroAtk    += v; } },
  hp:    { name:'체력',     icon:'❤️', pct:false, apply:(b,v)=>{ b.heroHpFlat += v; } },
  def:   { name:'방어력',   icon:'🛡️', pct:false, apply:(b,v)=>{ b.heroAura   += v; } },
  regen: { name:'재생',     icon:'💚', pct:false, apply:(b,v)=>{ b.heroRegen  += v; }, unit:'/s' },
  aspd:  { name:'공격속도', icon:'🌀', pct:true,  apply:(b,v)=>{ b.heroSpdMult   *= 1+v; } },
  range: { name:'사거리',   icon:'🎯', pct:true,  apply:(b,v)=>{ b.heroRangeMult *= 1+v; } },
  skill: { name:'스킬 피해',icon:'✨', pct:true,  apply:(b,v)=>{ b.heroSkillMult *= 1+v; } },
  crit:  { name:'치명타',   icon:'💥', pct:true,  apply:(b,v)=>{ b.critChance += v; } },
  gold:  { name:'획득 골드',icon:'💰', pct:true,  apply:(b,v)=>{ b.battleGoldMult *= 1+v; } },
  exp:   { name:'획득 EXP', icon:'📖', pct:true,  apply:(b,v)=>{ b.heroExpMult    *= 1+v; } },
};
const STAT_ORDER = ['atk','hp','def','regen','aspd','range','skill','crit','gold','exp'];

function statText(key, v) {
  const d = EQUIP_STATS[key]; if (!d) return '';
  const s = d.pct ? `${v>=0?'+':''}${Math.round(v*100)}%`
                  : `${v>=0?'+':''}${Math.round(v*10)/10}${d.unit||''}`;
  return `${d.name} ${s}`;
}
function statsLine(stats) {
  return STAT_ORDER.filter(k => stats && stats[k]).map(k => statText(k, stats[k])).join(' · ');
}
function applyStatBlock(b, stats, mult) {
  if (!stats) return;
  for (const k of STAT_ORDER) {
    const v = stats[k];
    if (v) EQUIP_STATS[k].apply(b, v * (mult === undefined ? 1 : mult));
  }
}

// ── 장비 도감 ───────────────────────────────────────────────────────────────
// 칸마다 3등급씩 — 무엇을 목표로 모아야 하는지가 한눈에 보여야 한다.
const GRADE_COLOR = { common:'#94a3b8', rare:'#60a5fa', epic:'#a78bfa', legend:'#fbbf24' };
const GRADE_NAME  = { common:'일반', rare:'희귀', epic:'영웅', legend:'전설' };

const HERO_EQUIPMENT_POOL = [
  // 무기 — 공격력이 본체
  { id:'w_iron',    name:'강철 검',       icon:'⚔️', slot:'weapon', grade:'common', cost:30,  stats:{atk:8} },
  { id:'w_silver',  name:'은빛 검',       icon:'🗡️', slot:'weapon', grade:'rare',   cost:60,  stats:{atk:18, aspd:0.08} },
  { id:'w_staff',   name:'마법사 지팡이', icon:'🪄', slot:'weapon', grade:'rare',   cost:65,  stats:{atk:12, skill:0.20, range:0.15} },
  { id:'w_dragon',  name:'용살자',        icon:'🐉', slot:'weapon', grade:'epic',   cost:130, stats:{atk:34, crit:0.08} },

  // 투구 — 체력과 시야
  { id:'h_leather', name:'가죽 두건',     icon:'🧢', slot:'helmet', grade:'common', cost:22,  stats:{hp:18} },
  { id:'h_warrior', name:'전사의 투구',   icon:'⛑️', slot:'helmet', grade:'rare',   cost:48,  stats:{hp:40, def:3} },
  { id:'h_crown',   name:'왕관',          icon:'👑', slot:'helmet', grade:'epic',   cost:120, stats:{hp:70, exp:0.15} },

  // 갑옷 — 방어의 중심
  { id:'a_chain',   name:'사슬 갑옷',     icon:'🥋', slot:'armor',  grade:'common', cost:34,  stats:{def:4, hp:20} },
  { id:'a_plate',   name:'판금 갑옷',     icon:'🛡️', slot:'armor',  grade:'rare',   cost:70,  stats:{def:9, hp:50} },
  { id:'a_shadow',  name:'그림자 망토',   icon:'🦸', slot:'armor',  grade:'epic',   cost:140, stats:{def:12, hp:80, aspd:0.10} },

  // 각반 — 체력 · 재생
  { id:'p_cloth',   name:'천 각반',       icon:'👖', slot:'pants',  grade:'common', cost:20,  stats:{hp:16} },
  { id:'p_guard',   name:'수호의 각반',   icon:'🩳', slot:'pants',  grade:'rare',   cost:46,  stats:{hp:36, regen:1} },
  { id:'p_titan',   name:'거인의 각반',   icon:'🦿', slot:'pants',  grade:'epic',   cost:112, stats:{hp:66, def:6, regen:1.5} },

  // 신발 — 공속 · 사거리
  { id:'b_swift',   name:'신속의 장화',   icon:'👟', slot:'boots',  grade:'common', cost:28,  stats:{aspd:0.08} },
  { id:'b_wind',    name:'질풍화',        icon:'🥾', slot:'boots',  grade:'rare',   cost:56,  stats:{aspd:0.16, range:0.10} },
  { id:'b_sky',     name:'천공의 신발',   icon:'🩰', slot:'boots',  grade:'epic',   cost:124, stats:{aspd:0.26, range:0.20, hp:24} },

  // 악세 — 잡다한 배율
  { id:'c_ringhp',  name:'생명의 반지',   icon:'💍', slot:'acc',    grade:'common', cost:26,  stats:{regen:1.5} },
  { id:'c_ringgold',name:'황금 반지',     icon:'🪙', slot:'acc',    grade:'common', cost:32,  stats:{gold:0.18} },
  { id:'c_amulet',  name:'힘의 부적',     icon:'🔮', slot:'acc',    grade:'rare',   cost:52,  stats:{atk:11, crit:0.05} },
  { id:'c_cross',   name:'성스러운 십자가',icon:'✝️',slot:'acc',    grade:'rare',   cost:58,  stats:{hp:34, regen:2} },
  { id:'c_tome',    name:'현자의 서',     icon:'📕', slot:'acc',    grade:'epic',   cost:118, stats:{skill:0.30, exp:0.20} },
];
function equipDef(id) { return HERO_EQUIPMENT_POOL.find(e => e.id === id); }

// ── 🔮 영웅 스킬 ─────────────────────────────────────────────────────────────
// 스킬은 굴림값(roll)을 함께 들고 다닌다. 같은 '광폭'이라도 0.72짜리와 1.34짜리는
// 다른 물건이다 — 좋은 굴림을 뽑는 것 자체가 상점을 계속 들여다볼 이유가 된다.
const SKILL_ROLL_MIN = 0.70;
const SKILL_ROLL_MAX = 1.40;
// 등급별 굴림 하한 — 영웅 등급이 일반 최고 굴림보다 못하면 등급이 의미가 없다
const SKILL_GRADE_FLOOR = { common:0.70, rare:0.85, epic:1.00 };

const HERO_SKILL_POOL = [
  { id:'s_rage',   name:'광폭',       icon:'🔥', grade:'common', cost:40,
    base:{atk:10},            note:'공격력' },
  { id:'s_iron',   name:'강철 피부',  icon:'🪨', grade:'common', cost:40,
    base:{hp:45, def:3},      note:'체력 · 방어' },
  { id:'s_haste',  name:'속공',       icon:'🌀', grade:'common', cost:44,
    base:{aspd:0.12},         note:'공격속도' },
  { id:'s_focus',  name:'집중',       icon:'🎯', grade:'rare',   cost:70,
    base:{crit:0.09},         note:'치명타' },
  { id:'s_reach',  name:'원격 투사',  icon:'📡', grade:'rare',   cost:72,
    base:{range:0.25, atk:6}, note:'사거리' },
  { id:'s_surge',  name:'마력 증폭',  icon:'✨', grade:'rare',   cost:78,
    base:{skill:0.30},        note:'스킬 피해' },
  { id:'s_vital',  name:'재생 각인',  icon:'💚', grade:'rare',   cost:68,
    base:{regen:2, hp:30},    note:'재생' },
  { id:'s_greed',  name:'탐욕',       icon:'💰', grade:'rare',   cost:66,
    base:{gold:0.25, exp:0.12}, note:'수급' },
  { id:'s_titan',  name:'거인의 심장',icon:'🫀', grade:'epic',   cost:135,
    base:{hp:90, def:8, atk:8}, note:'전면 강화' },
  { id:'s_avatar', name:'전쟁의 화신',icon:'⚡', grade:'epic',   cost:150,
    base:{atk:22, aspd:0.14, crit:0.06}, note:'공격 전반' },
];
function skillDef(id) { return HERO_SKILL_POOL.find(s => s.id === id); }

function rollSkillPower(grade) {
  const lo = SKILL_GRADE_FLOOR[grade] || SKILL_ROLL_MIN;
  return Math.round((lo + Math.random() * (SKILL_ROLL_MAX - lo)) * 100) / 100;
}
// 굴림값에 따른 별 표시 — 숫자보다 등급이 먼저 읽힌다
function rollStars(roll) {
  if (roll >= 1.30) return '★★★';
  if (roll >= 1.10) return '★★';
  if (roll >= 0.90) return '★';
  return '';
}
function skillStats(entry) {
  const def = skillDef(entry.skillId); if (!def) return {};
  const out = {};
  for (const k in def.base) out[k] = Math.round(def.base[k] * entry.roll * 1000) / 1000;
  return out;
}

// ── ⚡ 영웅 액티브 스킬 ──────────────────────────────────────────────────────
// 위의 HERO_SKILL_POOL은 전부 **패시브**다 — 끼우면 숫자가 올라갈 뿐이라
// 전투 중에 영웅이 하는 일이 없었고, 상점의 💧MP 포션도 쓸 데가 없었다.
//
// 액티브는 MP를 쓰고 쿨다운을 돈다. 절반은 **하단에 서서 상단을 건드린다** —
// 두 전선이 나뉘어 있으니, 한쪽에서 다른 쪽에 손을 뻗는 수단이 있어야
// "어디에 설 것인가"가 포기가 아니라 선택이 된다.
const HERO_MP_BASE    = 40;    // 1레벨 최대 MP
const HERO_MP_PER_LV  = 6;     // 레벨당
const HERO_MP_REGEN   = 3.2;   // 초당 회복 (웨이브 중에만)

function heroMaxMp() {
  const lv = (typeof gs !== 'undefined' && gs && gs.hero) ? gs.hero.level : 1;
  return Math.round((HERO_MP_BASE + (lv - 1) * HERO_MP_PER_LV) * (1 + (BONUSES.heroMpMax || 0)));
}
function heroMpRegen() {
  return HERO_MP_REGEN * (1 + (BONUSES.mpRegenBonus || 0));
}

// lane: 'top' 상단에 작용 · 'bottom' 아레나에 작용 · 'both'
const HERO_ACTIVE_POOL = [
  { id:'a_overload', name:'과부하 명령', icon:'⚡', grade:'epic', cost:120, mp:30, cd:24, lane:'top',
    desc:'모든 타워를 한꺼번에 과부하시킨다',
    note:'하단에 서 있어도 상단 전체를 밀어 올린다' },
  { id:'a_meteor',   name:'유성 낙하',   icon:'☄️', grade:'epic', cost:130, mp:35, cd:20, lane:'top',
    desc:'상단 경로의 적 전체에 영웅 공격력 ×2.2 피해',
    note:'상단이 밀릴 때 하단에서 끊어 준다' },
  { id:'a_bulwark',  name:'성벽 결계',   icon:'🧱', grade:'rare', cost:88,  mp:25, cd:26, lane:'top',
    desc:'6초간 기지가 받는 피해를 전부 막는다',
    note:'돌진과 관문 러시를 한 번 넘긴다' },
  { id:'a_freeze',   name:'시간 정지',   icon:'🕐', grade:'epic', cost:126, mp:30, cd:22, lane:'both',
    desc:'상·하단 적 전체를 3.5초간 크게 둔화',
    note:'두 전선을 동시에 산다' },
  { id:'a_smite',    name:'심판',        icon:'💥', grade:'rare', cost:80,  mp:20, cd:12, lane:'bottom',
    desc:'아레나에서 가장 강한 적에게 영웅 공격력 ×4.5',
    note:'보스 한 마리를 지운다' },
  { id:'a_mend',     name:'재정비',      icon:'💚', grade:'rare', cost:84,  mp:25, cd:18, lane:'bottom',
    desc:'부대 전체 HP를 최대치의 30% 회복',
    note:'자연 회복이 거의 없는 지금, 유일한 즉시 회복' },
  { id:'a_rally',    name:'소집',        icon:'🌪', grade:'common', cost:64, mp:22, cd:16, lane:'bottom',
    desc:'아레나 적을 영웅 쪽으로 끌어당기고 ×1.6 피해',
    note:'흩어진 적을 광역기 앞에 모은다' },
  { id:'a_plunder',  name:'약탈 명령',   icon:'💰', grade:'common', cost:60, mp:18, cd:20, lane:'both',
    desc:'즉시 골드 획득 (층에 비례)',
    note:'마을 값이 오른 만큼 벌이도 필요하다' },
];
function activeDef(id) { return HERO_ACTIVE_POOL.find(a => a.id === id); }
function activeLaneTag(lane) {
  return lane === 'top' ? '\ud83c\udff0 \uc0c1\ub2e8' : lane === 'both' ? '\u2195\ufe0f \uc591\ucabd' : '\u2694\ufe0f \ud558\ub2e8';
}

// 액티브 칸 — 영웅 레벨이 열어 준다
const ACTIVE_SLOT_LEVELS = [1, 5];
function activeSlotCount(gs) {
  const lv = gs.hero ? gs.hero.level : 1;
  return ACTIVE_SLOT_LEVELS.filter(n => lv >= n).length;
}
function nextActiveSlotLevel(gs) {
  const lv = gs.hero ? gs.hero.level : 1;
  return ACTIVE_SLOT_LEVELS.find(n => lv < n) || null;
}
function activeSlots(gs) {
  const g = heroGear(gs);
  if (!g.activeSlots) g.activeSlots = [null, null];
  return g.activeSlots;
}
// 지금 낀 액티브 목록 (칸 수만큼)
function equippedActives(gs) {
  const sl = activeSlots(gs), n = activeSlotCount(gs), out = [];
  for (let i = 0; i < n; i++) if (sl[i]) out.push({ idx:i, def:activeDef(sl[i]) });
  return out.filter(x => x.def);
}
function isActiveEquipped(gs, id) { return activeSlots(gs).includes(id); }

// ── 스킬 칸 ─────────────────────────────────────────────────────────────────
// 레벨이 오르면 칸이 늘어난다. 레벨업이 스탯 말고도 무언가를 주게 하려는 것이다.
const SKILL_SLOT_LEVELS = [3, 7, 12, 18];
function skillSlotCount(gs) {
  const lv = gs.hero ? gs.hero.level : 1;
  return SKILL_SLOT_LEVELS.filter(n => lv >= n).length;
}
function nextSkillSlotLevel(gs) {
  const lv = gs.hero ? gs.hero.level : 1;
  return SKILL_SLOT_LEVELS.find(n => lv < n) || null;
}
// 스킬 매대는 상점을 키워야 열린다
const SKILL_SHOP_LEVEL = 3;
function skillShopOpen(gs) {
  const b = gs.town && gs.town.buildings.heroShop;
  return !!(b && b.built && (b.level || 0) >= SKILL_SHOP_LEVEL);
}

// ── 보관함 ──────────────────────────────────────────────────────────────────
function createHeroGear() {
  return {
    equipped: { weapon:null, helmet:null, armor:null, pants:null, boots:null, acc1:null, acc2:null },
    inventory: [],       // { uid, itemId }
    skills: [],          // { uid, skillId, roll }
    skillSlots: [null, null, null, null],   // uid 참조
    actives: [],         // 배운 액티브 스킬 id
    activeSlots: [null, null],   // 낀 액티브 (id 참조 — 굴림값이 없어 uid가 필요 없다)
    skillOffers: [],     // 상점 매대 (웨이브마다 갱신)
  };
}
let _gearUid = 0;
function gearUid() { return ++_gearUid; }

function heroGear(gs) {
  if (!gs.town.gear) gs.town.gear = createHeroGear();
  return gs.town.gear;
}
function invEntry(gs, uid) { return heroGear(gs).inventory.find(e => e.uid === uid) || null; }
function skillEntry(gs, uid) { return heroGear(gs).skills.find(e => e.uid === uid) || null; }
function equippedItem(gs, slotId) {
  const uid = heroGear(gs).equipped[slotId];
  const e = uid == null ? null : invEntry(gs, uid);
  return e ? equipDef(e.itemId) : null;
}

// 장착 — 같은 칸에 있던 것은 보관함으로 돌아간다 (버리지 않는다)
function equipGear(gs, uid, slotId) {
  const g = heroGear(gs);
  const e = invEntry(gs, uid); if (!e) return false;
  const item = equipDef(e.itemId); if (!item) return false;
  const fits = slotsForItem(item);
  if (!fits.length) return false;
  let target = slotId && fits.includes(slotId) ? slotId : null;
  if (!target) target = fits.find(s => g.equipped[s] == null) || fits[0];
  // 이미 다른 칸에 끼워둔 물건이면 그 칸부터 비운다
  for (const s of EQUIP_SLOTS) if (g.equipped[s.id] === uid) g.equipped[s.id] = null;
  g.equipped[target] = uid;
  reapplyAllBonuses(gs);
  return true;
}
function unequipGear(gs, slotId) {
  const g = heroGear(gs);
  if (g.equipped[slotId] == null) return false;
  g.equipped[slotId] = null;
  reapplyAllBonuses(gs);
  return true;
}
function isEquipped(gs, uid) {
  const g = heroGear(gs);
  return EQUIP_SLOTS.some(s => g.equipped[s.id] === uid);
}
function equipSkill(gs, uid, idx) {
  const g = heroGear(gs);
  const n = skillSlotCount(gs);
  if (n <= 0) return false;
  const e = skillEntry(gs, uid); if (!e) return false;
  let target = (idx != null && idx < n) ? idx : null;
  if (target == null) {
    target = g.skillSlots.findIndex((v, i) => i < n && v == null);
    if (target < 0) target = 0;
  }
  for (let i = 0; i < g.skillSlots.length; i++) if (g.skillSlots[i] === uid) g.skillSlots[i] = null;
  g.skillSlots[target] = uid;
  reapplyAllBonuses(gs);
  return true;
}
function unequipSkill(gs, idx) {
  const g = heroGear(gs);
  if (g.skillSlots[idx] == null) return false;
  g.skillSlots[idx] = null;
  reapplyAllBonuses(gs);
  return true;
}
function skillEquippedAt(gs, idx) {
  const uid = heroGear(gs).skillSlots[idx];
  return uid == null ? null : skillEntry(gs, uid);
}
function isSkillEquipped(gs, uid) { return heroGear(gs).skillSlots.includes(uid); }

// ── 보너스 적용 ─────────────────────────────────────────────────────────────
// reapplyAllBonuses가 매 웨이브 부른다.
function applyHeroGear(gs) {
  const g = heroGear(gs);
  for (const s of EQUIP_SLOTS) {
    const uid  = g.equipped[s.id];
    const e    = uid == null ? null : invEntry(gs, uid);
    const item = e ? equipDef(e.itemId) : null;
    // ⚒️ 대장간에서 그 칸을 연마해뒀으면 무엇을 끼든 그만큼 커진다
    if (item) applyStatBlock(BONUSES, item.stats, slotPlusMult(gs, s.id));
  }
  const n = skillSlotCount(gs);
  for (let i = 0; i < n; i++) {
    const e = skillEquippedAt(gs, i);
    if (e) applyStatBlock(BONUSES, skillStats(e));
  }
}

// ── 스탯창 ──────────────────────────────────────────────────────────────────
// "이걸 끼면 뭐가 달라지나"를 계산하는 유일한 방법은 실제로 끼워보는 것이다.
// 보너스 계산이 매 웨이브 도는 만큼 한 번 더 도는 비용은 무시할 수 있다.
function heroStatSnapshot(gs) {
  const lv = HERO_LEVELS[gs.hero.level];
  const B  = BONUSES;
  const sm = B.heroStatMult;
  return {
    atk:   Math.round((lv.atk + B.heroAtk) * sm * B.sigilHeroAtkMult),
    hp:    Math.round((lv.hp + B.heroHpFlat) * sm * B.sigilHeroHpMult),
    def:   Math.round((lv.def + B.heroAura) * sm),
    regen: Math.round(B.heroRegen * 10) / 10,
    aspd:  Math.round(B.sigilHeroSpdMult * B.heroSpdMult * 100) / 100,
    range: Math.round(HERO_ARENA.range * B.sigilHeroRangeMult * B.heroRangeMult),
    skill: Math.round(B.sigilSkillMult * B.heroSkillMult * 100) / 100,
    crit:  Math.round(B.critChance * 100),
  };
}
// 가정한 상태에서의 스탯 — mutate() 안에서 장비를 바꿔치기하고 원상복구한다
function heroStatPreview(gs, mutate) {
  const g = heroGear(gs);
  const savedEquip = Object.assign({}, g.equipped);
  const savedSkills = g.skillSlots.slice();
  mutate();
  reapplyAllBonuses(gs);
  const snap = heroStatSnapshot(gs);
  g.equipped = savedEquip;
  g.skillSlots = savedSkills;
  reapplyAllBonuses(gs);
  return snap;
}
const STAT_PANEL_ROWS = [
  { key:'atk',   label:'공격력',   fmt:v=>`${v}` },
  { key:'hp',    label:'최대 HP',  fmt:v=>`${v}` },
  { key:'def',   label:'방어력',   fmt:v=>`${v}` },
  { key:'regen', label:'재생',     fmt:v=>`${v}/s` },
  { key:'aspd',  label:'공격속도', fmt:v=>`×${v.toFixed(2)}` },
  { key:'range', label:'사거리',   fmt:v=>`${v}` },
  { key:'skill', label:'스킬 피해',fmt:v=>`×${v.toFixed(2)}` },
  { key:'crit',  label:'치명타',   fmt:v=>`${v}%` },
];

// ── 상점 ────────────────────────────────────────────────────────────────────
// 장비 매대는 인벤토리에 없는 것 위주로, 스킬 매대는 매번 새로 굴려서 낸다.
function refreshSkillOffers(gs) {
  const g = heroGear(gs);
  refreshActiveOffers(gs);
  const picked = [], avail = HERO_SKILL_POOL.slice();
  while (picked.length < 3 && avail.length) {
    const i = Math.floor(Math.random() * avail.length);
    const def = avail.splice(i, 1)[0];
    picked.push({ uid:gearUid(), skillId:def.id, roll:rollSkillPower(def.grade) });
  }
  g.skillOffers = picked;
}
// ⚡ 액티브 매대 — 아직 안 배운 것만 둘 깐다
function refreshActiveOffers(gs) {
  const g = heroGear(gs);
  if (!g.actives) g.actives = [];
  const pool = HERO_ACTIVE_POOL.filter(a => !g.actives.includes(a.id));
  const picked = [], avail = pool.slice();
  while (picked.length < 2 && avail.length) {
    picked.push(avail.splice(Math.floor(Math.random() * avail.length), 1)[0].id);
  }
  g.activeOffers = picked;
}
function buyActiveOffer(gs, id) {
  const g = heroGear(gs);
  const i = (g.activeOffers || []).indexOf(id);
  if (i < 0) return false;
  const def = activeDef(id); if (!def) return false;
  if (gs.gold < def.cost) return false;
  gs.gold -= def.cost;
  g.activeOffers.splice(i, 1);
  if (!g.actives) g.actives = [];
  g.actives.push(id);
  // 빈 칸이 있으면 바로 끼워준다 — 산 물건이 어디로 갔는지 헤매지 않게
  const sl = activeSlots(gs), n = activeSlotCount(gs);
  const free = sl.findIndex((v, k) => k < n && v == null);
  if (free >= 0) sl[free] = id;
  return true;
}
// 액티브를 칸에 끼우거나 뺀다 (같은 것을 다시 누르면 뺀다)
function toggleActiveSlot(gs, id) {
  const sl = activeSlots(gs), n = activeSlotCount(gs);
  const at = sl.indexOf(id);
  if (at >= 0) { sl[at] = null; return 'off'; }
  let free = sl.findIndex((v, k) => k < n && v == null);
  if (free < 0) free = 0;      // 자리가 없으면 첫 칸을 갈아 끼운다
  sl[free] = id;
  return 'on';
}

function buySkillOffer(gs, uid) {
  const g = heroGear(gs);
  const i = g.skillOffers.findIndex(o => o.uid === uid);
  if (i < 0) return false;
  const off = g.skillOffers[i];
  const def = skillDef(off.skillId); if (!def) return false;
  const cost = skillOfferCost(off);
  if (gs.gold < cost) return false;
  gs.gold -= cost;
  g.skillOffers.splice(i, 1);
  g.skills.push({ uid:off.uid, skillId:off.skillId, roll:off.roll });
  // 빈 칸이 있으면 바로 끼워준다 — 산 물건이 어디로 갔는지 헤매지 않게
  const n = skillSlotCount(gs);
  const free = g.skillSlots.findIndex((v, k) => k < n && v == null);
  if (free >= 0) equipSkill(gs, off.uid, free);
  else reapplyAllBonuses(gs);
  return true;
}
// 좋은 굴림은 비싸다 — 싸게 사서 좋은 걸 얻는 일은 없어야 한다
function skillOfferCost(off) {
  const def = skillDef(off.skillId);
  return def ? Math.round(def.cost * (0.6 + off.roll * 0.55)) : 0;
}

// ── 세이브 정규화 ───────────────────────────────────────────────────────────
// 예전 세이브는 "장착한 아이템 아이디" 배열 하나뿐이었다. 칸이 생긴 지금은
// 그 배열을 보관함으로 옮기고, 들어갈 수 있는 칸에 다시 끼워준다.
function normalizeHeroGear(saved, legacyEquipped) {
  const g = createHeroGear();
  if (saved && saved.inventory) {
    g.inventory = (saved.inventory || []).filter(e => e && equipDef(e.itemId))
                    .map(e => ({ uid:e.uid, itemId:e.itemId }));
    g.skills    = (saved.skills || []).filter(e => e && skillDef(e.skillId))
                    .map(e => ({ uid:e.uid, skillId:e.skillId, roll:e.roll || 1 }));
    const ownedUids = new Set(g.inventory.map(e => e.uid));
    for (const s of EQUIP_SLOTS) {
      const uid = saved.equipped ? saved.equipped[s.id] : null;
      g.equipped[s.id] = ownedUids.has(uid) ? uid : null;
    }
    const skillUids = new Set(g.skills.map(e => e.uid));
    g.skillSlots = (saved.skillSlots || []).slice(0, 4).map(u => skillUids.has(u) ? u : null);
    while (g.skillSlots.length < 4) g.skillSlots.push(null);
    g.skillOffers = (saved.skillOffers || []).filter(o => o && skillDef(o.skillId));
    // ⚡ 액티브 — 배운 것과 낀 것을 살린다 (없어진 id는 버린다)
    g.actives     = (saved.actives || []).filter(id => !!activeDef(id));
    const ownedAct = new Set(g.actives);
    g.activeSlots = (saved.activeSlots || []).slice(0, ACTIVE_SLOT_LEVELS.length)
                      .map(id => ownedAct.has(id) ? id : null);
    while (g.activeSlots.length < ACTIVE_SLOT_LEVELS.length) g.activeSlots.push(null);
    g.activeOffers = (saved.activeOffers || []).filter(id => !!activeDef(id) && !ownedAct.has(id));
  } else if (Array.isArray(legacyEquipped) && legacyEquipped.length) {
    // 옛 아이디는 대부분 이름이 바뀌었다. 살릴 수 있는 것만 살린다.
    const LEGACY = {
      sword_iron:'w_iron', sword_silver:'w_silver', staff_mage:'w_staff',
      armor_chain:'a_chain', helm_warrior:'h_warrior', cape_shadow:'a_shadow',
      boots_swift:'b_swift', ring_hp:'c_ringhp', ring_gold:'c_ringgold',
      amulet_power:'c_amulet', cross_holy:'c_cross', scroll_epic:'c_tome',
    };
    for (const old of legacyEquipped) {
      const id = LEGACY[old]; if (!id) continue;
      const entry = { uid:gearUid(), itemId:id };
      g.inventory.push(entry);
      const item = equipDef(id);
      const free = slotsForItem(item).find(sl => g.equipped[sl] == null);
      if (free) g.equipped[free] = entry.uid;
    }
  }
  // uid 카운터를 실린 값 위로 올려둔다 — 새로 산 물건이 옛 uid와 부딪히지 않게
  let hi = 0;
  for (const e of g.inventory) hi = Math.max(hi, e.uid || 0);
  for (const e of g.skills)    hi = Math.max(hi, e.uid || 0);
  for (const o of g.skillOffers) hi = Math.max(hi, o.uid || 0);
  _gearUid = Math.max(_gearUid, hi);
  return g;
}

// ── 👑 각인 해금 ─────────────────────────────────────────────────────────────
// 각인은 지금까지 공짜였다 — 셋 다 처음부터 열려 있으니 고르는 데 값이 없었다.
// 보석으로 열게 하면 심연에서 모은 보석이 "다음 영웅"이라는 목표가 된다.
const SIGIL_UNLOCK_COST = { blade:0, warden:15, sorcerer:25 };
function sigilUnlocked(gs, id) {
  if ((SIGIL_UNLOCK_COST[id] || 0) === 0) return true;
  return (gs.unlockedSigils || []).includes(id);
}
function unlockSigil(gs, id) {
  const cost = SIGIL_UNLOCK_COST[id] || 0;
  if (sigilUnlocked(gs, id)) return false;
  if ((gs.soulStones || 0) < cost) return false;
  gs.soulStones -= cost;
  if (!gs.unlockedSigils) gs.unlockedSigils = [DEFAULT_SIGIL];
  gs.unlockedSigils.push(id);
  return true;
}

// ── 액티브 시전 ──────────────────────────────────────────────────────────────
// 효과는 전부 여기 한 군데에 모은다. 상단·하단 어느 쪽을 건드리든
// "어떤 스킬이 무엇을 하는가"를 한 화면에서 읽을 수 있어야 고칠 수 있다.
//
// 돌려주는 값: 시전했으면 true. MP·쿨다운·대상 없음은 전부 false.
function castHeroActive(gs, id, opts) {
  const def = activeDef(id);
  if (!def || !gs.hero || gs.hero.dead) return false;
  const cds = gs.hero.activeCd || (gs.hero.activeCd = {});
  if ((cds[id] || 0) > 0) return false;
  if ((gs.hero.mp || 0) < def.mp) return false;

  const lv   = HERO_LEVELS[gs.hero.level];
  const atk  = Math.round((lv.atk + BONUSES.heroAtk) * BONUSES.heroStatMult
                          * BONUSES.sigilHeroAtkMult * BONUSES.heroSkillMult);
  const arena = gs.arena;
  const mobs  = (arena && arena.mobs) ? arena.mobs.filter(m => !m.dead) : [];
  const tops  = (gs.defenseEnemies || []).filter(e => !e.dead && !e.reached);
  let ok = false, msg = '';

  switch (id) {
    // ⚡ 하단에 서 있어도 상단 전체를 밀어 올린다
    case 'a_overload': {
      if (!gs.towers.length) break;
      for (const t of gs.towers) t.overloadUntil = OVERLOAD_DURATION;
      ok = true; msg = `⚡ 타워 ${gs.towers.length}기 과부하`;
      break;
    }
    case 'a_meteor': {
      if (!tops.length) break;
      const dmg = Math.max(1, Math.round(atk * 2.2));
      for (const e of tops) hurtDefenseEnemy(e, dmg, true, x => onDefenseKill(x, true), 1, 0);
      ok = true; msg = `☄️ 상단 ${tops.length}마리 −${dmg}`;
      break;
    }
    case 'a_bulwark': {
      gs.baseWardUntil = Math.max(gs.baseWardUntil || 0, 6);
      ok = true; msg = '🧱 성벽 결계 6초';
      break;
    }
    case 'a_freeze': {
      for (const e of tops) { e.slowTimer = Math.max(e.slowTimer || 0, 3.5); e.slowFactor = Math.max(e.slowFactor || 0, 0.7); }
      for (const m of mobs) m.slowUntil = Math.max(m.slowUntil || 0, 3.5);
      if (!tops.length && !mobs.length) break;
      ok = true; msg = `🕐 ${tops.length + mobs.length}마리 정지`;
      break;
    }
    case 'a_smite': {
      if (!mobs.length) break;
      const t = mobs.reduce((a, m) => (m.hp > a.hp ? m : a), mobs[0]);
      const dmg = arenaDamage(atk * 4.5, t.def);
      hurtMob(gs, t, dmg, '#fbbf24');
      arena.bursts.push({ x:t.x, y:t.y, r:44, color:'#fbbf24', t:0, dur:0.4 });
      ok = true; msg = `💥 심판 −${dmg}`;
      break;
    }
    case 'a_mend': {
      let healed = 0;
      for (const u of gs.battle.ourTeam) {
        if (u.dead) continue;
        const amt = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * 0.30));
        u.hp += amt; healed += amt;
      }
      const hAmt = Math.min(heroMaxHp() - gs.hero.hp, Math.round(heroMaxHp() * 0.30));
      gs.hero.hp += Math.max(0, hAmt); healed += Math.max(0, hAmt);
      if (healed <= 0) break;
      if (arena) arena.bursts.push({ x:arenaCenter().x, y:arenaCenter().y, r:120, color:'#34d399', t:0, dur:0.5 });
      ok = true; msg = `💚 +${healed}`;
      break;
    }
    case 'a_rally': {
      if (!mobs.length) break;
      const h = gs.battle.ourTeam.find(u => u.isHero);
      const cx = h ? h.x : arenaCenter().x, cy = h ? h.y : arenaCenter().y;
      let n = 0;
      for (const m of mobs) {
        const d = Math.hypot(m.x - cx, m.y - cy);
        if (d > 4) { m.x += (cx - m.x) * 0.55; m.y += (cy - m.y) * 0.55; clampToArena(m, m.radius); }
        hurtMob(gs, m, arenaDamage(atk * 1.6, m.def), '#a5b4fc');
        n++;
      }
      arena.bursts.push({ x:cx, y:cy, r:130, color:'#a5b4fc', t:0, dur:0.45 });
      ok = true; msg = `🌪 ${n}마리 소집`;
      break;
    }
    case 'a_plunder': {
      const tier = Math.max(1, endlessTier(gs.wave) || (gs.wave + 1));
      const gold = Math.round((18 + tier * 9) * BONUSES.battleGoldMult);
      gs.gold += gold;
      gs.battle.totalGoldEarned += gold;
      ok = true; msg = `💰 +${gold}`;
      break;
    }
  }

  if (!ok) return false;
  gs.hero.mp = Math.max(0, gs.hero.mp - def.mp);
  cds[id] = def.cd * (BONUSES.heroSkillCdMult || 1);
  if (typeof spawnFloaty === 'function') {
    const at = def.lane === 'top' ? { x: CW/2, y: DEFENSE_H/2 } : arenaCenter();
    spawnFloaty(`${def.icon} ${msg}`, at.x, at.y, '#c4b5fd');
  }
  if (typeof SFX !== 'undefined') SFX.skill();
  if (typeof FX !== 'undefined' && def.lane !== 'bottom') FX.shake(4, 0.25);
  return true;
}

// 매 프레임 — MP 회복과 쿨다운, 그리고 자동 시전
function updateHeroActives(gs, dt) {
  const h = gs.hero;
  if (!h) return;
  const cds = h.activeCd || (h.activeCd = {});
  for (const k in cds) if (cds[k] > 0) cds[k] = Math.max(0, cds[k] - dt);
  if (h.dead) return;
  h.mp = Math.min(heroMaxMp(), (h.mp || 0) + heroMpRegen() * dt);
  // 🧱 성벽 결계
  if ((gs.baseWardUntil || 0) > 0) gs.baseWardUntil = Math.max(0, gs.baseWardUntil - dt);
  // 자동 모드 — 쓸 수 있게 되는 대로 쓴다. 수동이면 플레이어가 누른다.
  if (h.skillAuto === false) return;
  for (const a of equippedActives(gs)) castHeroActive(gs, a.def.id);
}

// 지금 이 스킬을 쓸 수 있나 — 버튼 상태 표시에 쓴다
function activeReady(gs, id) {
  const def = activeDef(id); if (!def || !gs.hero || gs.hero.dead) return false;
  return ((gs.hero.activeCd || {})[id] || 0) <= 0 && (gs.hero.mp || 0) >= def.mp;
}
function activeCdLeft(gs, id) { return (gs.hero && gs.hero.activeCd ? gs.hero.activeCd[id] : 0) || 0; }
