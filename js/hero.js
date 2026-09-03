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

  // ── ✦ 전설 ──
  // 등급 표(GRADE_NAME)에는 전설이 있는데 물건이 하나도 없었다. 영웅 상점을
  // 끝까지 올려도 살 것이 영웅 등급에서 멈추니, 건물을 올릴 이유가 중간에 끊겼다.
  // 한 부위에 하나씩. 값은 영웅의 두 배쯤이고, 상점 레벨이 높아야 매대에 오른다.
  { id:'w_worldend',name:'세계의 끝',     icon:'🌑', slot:'weapon', grade:'legend', cost:290, stats:{atk:62, crit:0.14, aspd:0.10} },
  { id:'h_halo',    name:'성좌의 고리',   icon:'💫', slot:'helmet', grade:'legend', cost:260, stats:{hp:130, def:7, exp:0.30} },
  { id:'a_aegis',   name:'불멸의 흉갑',   icon:'🜲', slot:'armor',  grade:'legend', cost:300, stats:{def:22, hp:150, regen:2.5} },
  { id:'p_stride',  name:'천리보',        icon:'🌀', slot:'pants',  grade:'legend', cost:250, stats:{hp:120, def:11, aspd:0.14} },
  { id:'b_void',    name:'공허의 발자국', icon:'🕳', slot:'boots',  grade:'legend', cost:270, stats:{aspd:0.42, range:0.35, hp:50} },
  { id:'c_eye',     name:'심연의 눈',     icon:'👁', slot:'acc',    grade:'legend', cost:280, stats:{atk:24, skill:0.45, crit:0.10} },
];
// 등급별 매대 등장 가중치와, 그 등급이 열리는 상점 레벨(화면상 Lv.)
const GRADE_WEIGHT     = { common:34, rare:26, epic:12, legend:4 };
const GRADE_SHOP_LEVEL = { common:1,  rare:1,  epic:3,  legend:6 };
function equipDef(id) { return HERO_EQUIPMENT_POOL.find(e => e.id === id); }

// 보관함에서 파는 값 — 산 값의 절반. 낀 것은 못 판다 (실수로 알몸이 되지 않게).
const GEAR_SELL_PCT = 0.5;
function gearSellValue(gs, uid) {
  const e = invEntry(gs, uid); if (!e) return 0;
  const d = equipDef(e.itemId); if (!d) return 0;
  return Math.max(1, Math.round(d.cost * GEAR_SELL_PCT));
}
function sellGear(gs, uid) {
  if (isEquipped(gs, uid)) return 0;
  const v = gearSellValue(gs, uid);
  if (!v) return 0;
  const g = heroGear(gs);
  const i = g.inventory.findIndex(e => e.uid === uid);
  if (i < 0) return 0;
  g.inventory.splice(i, 1);
  gs.gold = (gs.gold || 0) + v;
  return v;
}

// ── 🧬 패시브 스킬 ───────────────────────────────────────────────────────────
// 상점에서 '영웅 스킬'로 팔던 것들이다. 이름과 달리 전부 **패시브**라
// 아래 ⚡액티브와 구별이 안 됐다 — 이름을 물건에 맞췄다.
// 각인과 무관하게 누구에게나 같은 것이 나온다. 다만 sigil이 붙은 몇은
// 그 각인일 때만 매대에 오른다(아래 SIGIL_PASSIVES).
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
// 각인 색이 도는 패시브 넷. 공통 열 개는 누구에게나 똑같이 나오고,
// 이것만 그 각인일 때 매대에 섞여 든다 — "달라도 똑같은 게 나오게, 다른 게
// 섞여 나와도 좋다"는 요구를 이렇게 갈랐다. 공통이 기본이고 이쪽이 양념이다.
// 값은 공통 희귀급과 같은 자리에 두되, 그 각인이 하는 일을 한 칸 더 밀어 준다.
const SIGIL_PASSIVES = [
  { id:'s_edge',   sigil:'blade',    name:'검성의 결의', icon:'⚔️', grade:'rare', cost:74,
    base:{atk:16, crit:0.05},        note:'검성 — 공격력 · 치명타' },
  { id:'s_bastion',sigil:'warden',   name:'수호의 맹세', icon:'🛡', grade:'rare', cost:74,
    base:{hp:70, def:6, regen:1},    note:'수호자 — 체력 · 방어 · 재생' },
  { id:'s_arcane', sigil:'sorcerer', name:'술사의 정수', icon:'🔮', grade:'rare', cost:76,
    base:{skill:0.35, aspd:0.06},    note:'술사 — 스킬 피해 · 공격속도' },
  { id:'s_hawk',   sigil:'ranger',   name:'신궁의 눈',   icon:'🏹', grade:'rare', cost:76,
    base:{range:0.30, crit:0.06},    note:'신궁 — 사거리 · 치명타' },
];
function skillDef(id) {
  return HERO_SKILL_POOL.find(s => s.id === id)
      || SIGIL_PASSIVES.find(s => s.id === id);
}
// 지금 각인에서 매대에 오를 수 있는 패시브 전부
function availablePassives(sigilId) {
  const sg = sigilId || ((typeof activeSigil === 'function') ? activeSigil().id : null);
  return HERO_SKILL_POOL.concat(SIGIL_PASSIVES.filter(s => s.sigil === sg));
}

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
// ── 🏅 각인 전용 액티브 ──────────────────────────────────────────────────────
// 위의 여덟은 누구나 산다. 여기 열둘은 **각인마다 셋씩**, 그 각인일 때만 매대에
// 올라온다. 정합(ACTIVE_FIT)은 "맞으면 싸다"는 할인이라 각인을 바꿔도 손해가
// 크지 않았는데, 그러다 보니 각인이 스킬 구성을 바꾸지는 못했다.
// 전용 셋이 있으면 각인을 고르는 일이 "어떤 스킬을 쓸 것인가"가 된다.
//
// 잠그는 것은 **매대뿐**이다. 한 번 산 스킬은 각인을 바꿔도 남는다 —
// 산 물건이 각인 하나 바꿨다고 사라지면 아무도 각인을 안 바꾼다.
const SIGIL_ACTIVE_POOL = [
  // ⚔️ 검성 — 붙어서, 한 점에, 세게
  { id:'a_whirl',  sigil:'blade', name:'회전 베기', icon:'🌀', grade:'rare', cost:86, mp:22, cd:14, lane:'bottom',
    desc:'영웅 주위 적 전체에 공격력 ×2.2 · 뒤로 밀어낸다',
    note:'둘러싸였을 때 한 번에 걷어낸다' },
  { id:'a_exec',   sigil:'blade', name:'참수',      icon:'🗡', grade:'epic', cost:128, mp:28, cd:18, lane:'bottom',
    desc:'체력 25% 이하 적을 즉사 · 아니면 공격력 ×6',
    note:'깎아 둔 적을 확실히 끊는다' },
  { id:'a_frenzy', sigil:'blade', name:'혈전',      icon:'🩸', grade:'rare', cost:92, mp:24, cd:22, lane:'bottom',
    desc:'8초간 부대 전체 공격력 ×1.5 · 즉시 영웅 HP 20% 회복',
    note:'짧게 몰아치는 구간을 만든다' },

  // 🛡 수호자 — 버티고, 끌고, 되돌려준다
  { id:'a_taunt',  sigil:'warden', name:'도발',      icon:'📢', grade:'common', cost:66, mp:18, cd:15, lane:'bottom',
    desc:'아레나 적을 영웅에게 끌어모으고 5초간 부대 피해 40% 감소',
    note:'뒷줄이 맞고 있을 때 앞으로 당긴다' },
  { id:'a_aegis',  sigil:'warden', name:'불굴의 방벽', icon:'🛡', grade:'epic', cost:124, mp:30, cd:26, lane:'both',
    desc:'7초간 부대 피해 60% 감소 · 기지 피해도 함께 막는다',
    note:'두 전선을 한꺼번에 버틴다' },
  { id:'a_thorn',  sigil:'warden', name:'가시 갑주', icon:'🌵', grade:'rare', cost:88, mp:22, cd:20, lane:'bottom',
    desc:'10초간 근접으로 받은 피해의 45%를 되돌린다',
    note:'맞을수록 이득이 되는 유일한 스킬' },

  // 🔮 술사 — 넓게, 묶고, 되감는다
  { id:'a_nova',   sigil:'sorcerer', name:'서리 폭발', icon:'❄️', grade:'rare', cost:90, mp:24, cd:15, lane:'bottom',
    desc:'넓은 범위에 공격력 ×2.4 · 4초간 둔화',
    note:'물량을 한 번에 묶는다' },
  { id:'a_chain',  sigil:'sorcerer', name:'연쇄 번개', icon:'🔗', grade:'epic', cost:126, mp:28, cd:16, lane:'bottom',
    desc:'가까운 적 여섯을 튀며 공격력 ×1.9씩',
    note:'흩어진 적을 골라 때린다' },
  { id:'a_rift',   sigil:'sorcerer', name:'시간 균열', icon:'🌀', grade:'epic', cost:132, mp:32, cd:24, lane:'top',
    desc:'상단 적 전체를 경로 세 칸 뒤로 되돌린다',
    note:'관문 러시를 통째로 물린다 — 타워가 다시 때릴 시간을 번다' },

  // 🏹 신궁 — 멀리서, 꿰뚫고, 표시한다
  { id:'a_arrows', sigil:'ranger', name:'화살비',    icon:'🏹', grade:'rare', cost:88, mp:24, cd:16, lane:'bottom',
    desc:'아레나 전역에 공격력 ×1.9',
    note:'범위가 곧 화면 전체 — 위치를 안 봐도 된다' },
  { id:'a_pierce', sigil:'ranger', name:'관통 사격', icon:'➶', grade:'epic', cost:122, mp:26, cd:14, lane:'bottom',
    desc:'영웅이 보는 방향으로 관통하는 화살 · 맞은 전부에 공격력 ×3.4',
    note:'줄지어 오는 적을 한 줄로 꿴다' },
  { id:'a_mark',   sigil:'ranger', name:'사냥 표식', icon:'🎯', grade:'rare', cost:84, mp:20, cd:18, lane:'both',
    desc:'양쪽 전선에서 가장 단단한 적에게 12초간 받는 피해 +60%',
    note:'보스와 정예를 녹이는 준비 동작' },
];

// 지금 각인에서 살 수 있는 액티브 전부 (공통 + 그 각인 전용)
function availableActives(sigilId) {
  const sg = sigilId || ((typeof activeSigil === 'function') ? activeSigil().id : null);
  return HERO_ACTIVE_POOL.concat(SIGIL_ACTIVE_POOL.filter(a => a.sigil === sg));
}
function activeDef(id) {
  return HERO_ACTIVE_POOL.find(a => a.id === id)
      || SIGIL_ACTIVE_POOL.find(a => a.id === id);
}
// 전용 스킬은 제 각인에서 늘 정합이다 — ACTIVE_FIT에 또 적지 않는다
// 각인 전용 표시 — 상점 줄 끝에 붙는다. "이 각인이라 살 수 있는 물건"이라는 뜻이다.
function sigilBadge(sigilId) {
  const sg = (typeof HERO_SIGILS !== 'undefined') ? HERO_SIGILS.find(x => x.id === sigilId) : null;
  return sg ? `${sg.icon}${sg.name} 전용` : '전용';
}
function activeSigilOwner(id) {
  const d = SIGIL_ACTIVE_POOL.find(a => a.id === id);
  return d ? d.sigil : null;
}

// ── 각인 정합 ────────────────────────────────────────────────────────────────
// 액티브 여덟 개가 각인과 무관하게 똑같이 돌았다. 그래서 각인은 아레나 스킬만
// 바꾸고, 액티브는 늘 '센 것 두 개'가 정답이었다 — 고르는 자리가 하나 죽어 있었다.
//
// 잠그지는 않는다. 잠그면 각인을 바꾸는 순간 사둔 액티브가 쓰레기가 되고,
// 그러면 각인을 안 바꾸게 된다. 대신 **맞는 각인이면 값이 싸고 빨리 돌아온다.**
// 안 맞아도 쓸 수는 있으니 "이 조합으로 갈까"가 판단으로 남는다.
const ACTIVE_FIT = {
  a_overload: ['sorcerer', 'ranger'],   // 상단을 미는 것 — 멀리 보는 갈래
  a_meteor:   ['sorcerer'],
  a_bulwark:  ['warden'],
  a_freeze:   ['sorcerer', 'warden'],
  a_smite:    ['blade', 'ranger'],      // 한 마리를 지우는 것 — 단일 화력 갈래
  a_mend:     ['warden'],
  a_rally:    ['blade'],                // 모아서 한꺼번에 베는 것
  a_plunder:  ['ranger', 'blade'],
};
const ACTIVE_FIT_MP = 0.70;   // 맞으면 MP 30% 싸고
const ACTIVE_FIT_CD = 0.80;   // 쿨다운 20% 짧다

function activeFitsSigil(id, sigilId) {
  const sg = sigilId || ((typeof activeSigil === 'function') ? activeSigil().id : null);
  // 각인 전용 스킬은 제 각인에서 늘 정합이다
  const owner = activeSigilOwner(id);
  if (owner) return owner === sg;
  const list = ACTIVE_FIT[id];
  if (!list) return false;
  return list.includes(sg);
}
// 지금 각인 기준의 실제 MP·쿨다운. 화면과 시전이 같은 값을 써야 한다.
function activeMpCost(id) {
  const d = activeDef(id); if (!d) return 0;
  return activeFitsSigil(id) ? Math.max(1, Math.round(d.mp * ACTIVE_FIT_MP)) : d.mp;
}
function activeCooldown(id) {
  const d = activeDef(id); if (!d) return 0;
  return activeFitsSigil(id) ? Math.round(d.cd * ACTIVE_FIT_CD * 10) / 10 : d.cd;
}
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
    def:   Math.max(0, Math.round((lv.def + B.heroAura) * sm)),
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
  const picked = [], avail = availablePassives();
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
  // 각인 전용까지 포함해서 굴린다 — 전용이 매대에 안 오르면 존재하지 않는 것과 같다
  const pool = availableActives().filter(a => !g.actives.includes(a.id));
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
const SIGIL_UNLOCK_COST = { blade:0, warden:15, sorcerer:25, ranger:35 };
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

// ── 연출 보조 ────────────────────────────────────────────────────────────────
// FX가 아직 안 실린 상황(로드 순서·테스트 하네스)에서도 시전 자체는 성립해야 한다.
function castFx(kind, o) {
  if (typeof FX !== 'undefined' && FX.cast) FX.cast(kind, o);
}
// 영웅이 지금 서 있는 화면 좌표. 하단에 있으면 아레나의 영웅 유닛,
// 상단이면 방어 격자 위의 좌표, 둘 다 없으면 아레나 한가운데.
function heroSpot(gs) {
  const h = gs.battle && gs.battle.ourTeam ? gs.battle.ourTeam.find(u => u.isHero && !u.dead) : null;
  if (h) return { x:h.x, y:h.y };
  if (gs.hero && gs.hero.placement === 'top') return { x:gs.hero.defX, y:gs.hero.defY };
  return arenaCenter();
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
  const mpCost = activeMpCost(id);
  if ((gs.hero.mp || 0) < mpCost) return false;

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
      castFx('wash', { y:0, h:DEFENSE_H, color:'#fbbf24', dur:0.5 });
      for (const t of gs.towers) {
        const c = cellCenter(t.col, t.row);
        castFx('pillar', { x:c.x, y:c.y + 14, h:44, w:18, color:'#fbbf24', dur:0.45 });
      }
      ok = true; msg = `⚡ 타워 ${gs.towers.length}기 과부하`;
      break;
    }
    case 'a_meteor': {
      if (!tops.length) break;
      const dmg = Math.max(1, Math.round(atk * 2.2));
      for (const e of tops) {
        hurtDefenseEnemy(e, dmg, true, x => onDefenseKill(x, true), 1, 0);
        castFx('nova', { x:e.x, y:e.y, r:26, color:'#fb923c', dur:0.45 });
      }
      castFx('rain', { x:0, y:0, w:CW, h:DEFENSE_H, n:26, color:'#fb923c', dur:0.7 });
      ok = true; msg = `☄️ 상단 ${tops.length}마리 −${dmg}`;
      break;
    }
    case 'a_bulwark': {
      gs.baseWardUntil = Math.max(gs.baseWardUntil || 0, 6);
      const bc = cellCenter(CASTLE_C, CASTLE_R);
      castFx('runes', { x:bc.x, y:bc.y, r:44, color:'#38bdf8', dur:0.8 });
      castFx('nova',  { x:bc.x, y:bc.y, r:70, color:'#38bdf8', dur:0.55 });
      ok = true; msg = '🧱 성벽 결계 6초';
      break;
    }
    case 'a_freeze': {
      for (const e of tops) { e.slowTimer = Math.max(e.slowTimer || 0, 3.5); e.slowFactor = Math.max(e.slowFactor || 0, 0.7); }
      for (const m of mobs) m.slowUntil = Math.max(m.slowUntil || 0, 3.5);
      if (!tops.length && !mobs.length) break;
      castFx('wash', { y:0, h:DEFENSE_H, color:'#67e8f9', dur:0.6 });
      castFx('wash', { y:ARENA_Y, h:ARENA_H, color:'#67e8f9', dur:0.6 });
      for (const m of mobs) castFx('runes', { x:m.x, y:m.y, r:16, color:'#67e8f9', dur:0.7 });
      ok = true; msg = `🕐 ${tops.length + mobs.length}마리 정지`;
      break;
    }
    case 'a_smite': {
      if (!mobs.length) break;
      const t = mobs.reduce((a, m) => (m.hp > a.hp ? m : a), mobs[0]);
      const dmg = arenaDamage(atk * 4.5, t.def);
      hurtMob(gs, t, dmg, '#fbbf24');
      castFx('pillar', { x:t.x, y:t.y + 8, h:130, w:30, color:'#fbbf24', dur:0.5 });
      castFx('nova',   { x:t.x, y:t.y, r:52, color:'#fde047', dur:0.45 });
      if (typeof FX !== 'undefined') FX.burst(t.x, t.y, '#fde047', 16, 18);
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
      for (const u of gs.battle.ourTeam)
        if (!u.dead) castFx('runes', { x:u.x, y:u.y, r:15, color:'#34d399', dur:0.7 });
      castFx('nova', { x:arenaCenter().x, y:arenaCenter().y, r:150, color:'#34d399', dur:0.55 });
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
      castFx('nova',  { x:cx, y:cy, r:140, color:'#a5b4fc', dur:0.5 });
      castFx('runes', { x:cx, y:cy, r:52, color:'#818cf8', dur:0.75 });
      ok = true; msg = `🌪 ${n}마리 소집`;
      break;
    }
    // ⚔️ 검성 전용 ───────────────────────────────────────────────────────
    case 'a_whirl': {
      const c = heroSpot(gs), R = 92;
      const hit = mobs.filter(m => Math.hypot(m.x - c.x, m.y - c.y) <= R);
      if (!hit.length) break;
      for (const m of hit) {
        hurtMob(gs, m, arenaDamage(atk * 2.2, m.def), '#f87171');
        // 뒤로 민다 — 둘러싸인 것을 푸는 게 이 스킬의 일이다
        const d = Math.max(1, Math.hypot(m.x - c.x, m.y - c.y));
        m.x += (m.x - c.x) / d * 34; m.y += (m.y - c.y) / d * 34;
        clampToArena(m, m.radius);
      }
      castFx('slash', { x:c.x, y:c.y, r:R, n:3, color:'#f87171', dur:0.45 });
      castFx('nova',  { x:c.x, y:c.y, r:R, color:'#fca5a5', dur:0.4 });
      ok = true; msg = `🌀 ${hit.length}마리 베기`;
      break;
    }
    case 'a_exec': {
      if (!mobs.length) break;
      // 가장 약해진 놈부터 — '깎아 둔 것을 끊는' 스킬이라 체력 비율로 고른다
      const t = mobs.reduce((a, m) => ((m.hp / m.maxHp) < (a.hp / a.maxHp) ? m : a), mobs[0]);
      const low = (t.hp / t.maxHp) <= 0.25;
      const dmg = low ? t.hp : arenaDamage(atk * 6, t.def);
      hurtMob(gs, t, dmg, '#f43f5e');
      castFx('beam',  { x1:t.x, y1:ARENA_Y, x2:t.x, y2:t.y, w:18, color:'#f43f5e', dur:0.35 });
      castFx('slash', { x:t.x, y:t.y, r:46, n:2, color:'#fecdd3', dur:0.4 });
      if (typeof FX !== 'undefined') { FX.burst(t.x, t.y, '#f43f5e', 20, 20); FX.shake(5, 0.25); }
      ok = true; msg = low ? '🗡 참수!' : `🗡 −${dmg}`;
      break;
    }
    case 'a_frenzy': {
      // 부대 공격력 버프는 아레나 버프판(rage)에 얹는다 — 계산 경로를 새로 파지 않는다
      arena.buffs = (arena.buffs || []).filter(b => b.kind !== 'rage');
      arena.buffs.push({ kind:'rage', mult:1.5, until: arena.elapsed + 8 });
      const heal = Math.round(heroMaxHp() * 0.20);
      gs.hero.hp = Math.min(heroMaxHp(), gs.hero.hp + heal);
      for (const u of gs.battle.ourTeam)
        if (!u.dead) castFx('runes', { x:u.x, y:u.y, r:15, color:'#f43f5e', dur:0.75 });
      castFx('wash', { y:ARENA_Y, h:ARENA_H, color:'#f43f5e', dur:0.5 });
      ok = true; msg = `🩸 8초 공격력 ×1.5 · +${heal}`;
      break;
    }

    // 🛡 수호자 전용 ──────────────────────────────────────────────────────
    case 'a_taunt': {
      if (!mobs.length) break;
      const c = heroSpot(gs);
      for (const m of mobs) {
        m.x += (c.x - m.x) * 0.6; m.y += (c.y - m.y) * 0.6;
        clampToArena(m, m.radius);
      }
      arena.buffs = (arena.buffs || []).filter(b => b.kind !== 'guard');
      arena.buffs.push({ kind:'guard', mult:0.60, until: arena.elapsed + 5 });
      castFx('nova',  { x:c.x, y:c.y, r:150, color:'#38bdf8', dur:0.5 });
      castFx('runes', { x:c.x, y:c.y, r:40, color:'#38bdf8', dur:0.7 });
      ok = true; msg = `📢 ${mobs.length}마리 도발 · 5초 피해 40%↓`;
      break;
    }
    case 'a_aegis': {
      arena.buffs = (arena.buffs || []).filter(b => b.kind !== 'guard');
      arena.buffs.push({ kind:'guard', mult:0.40, until: arena.elapsed + 7 });
      gs.baseWardUntil = Math.max(gs.baseWardUntil || 0, 7);
      const bc = cellCenter(CASTLE_C, CASTLE_R);
      castFx('runes', { x:bc.x, y:bc.y, r:44, color:'#93c5fd', dur:0.8 });
      castFx('wash',  { y:0, h:DEFENSE_H, color:'#93c5fd', dur:0.55 });
      castFx('wash',  { y:ARENA_Y, h:ARENA_H, color:'#93c5fd', dur:0.55 });
      for (const u of gs.battle.ourTeam)
        if (!u.dead) castFx('runes', { x:u.x, y:u.y, r:16, color:'#93c5fd', dur:0.8 });
      ok = true; msg = '🛡 7초 피해 60%↓ · 기지 보호';
      break;
    }
    case 'a_thorn': {
      arena.allyThornUntil = arena.elapsed + 10;
      arena.allyThornPct   = 0.45;
      for (const u of gs.battle.ourTeam)
        if (!u.dead) castFx('runes', { x:u.x, y:u.y, r:17, color:'#84cc16', dur:0.8 });
      castFx('wash', { y:ARENA_Y, h:ARENA_H, color:'#84cc16', dur:0.5 });
      ok = true; msg = '🌵 10초 반사 45%';
      break;
    }

    // 🔮 술사 전용 ────────────────────────────────────────────────────────
    case 'a_nova': {
      const c = heroSpot(gs), R = 130;
      const hit = mobs.filter(m => Math.hypot(m.x - c.x, m.y - c.y) <= R);
      if (!hit.length) break;
      for (const m of hit) {
        hurtMob(gs, m, arenaDamage(atk * 2.4, m.def), '#67e8f9');
        m.slowUntil = Math.max(m.slowUntil || 0, 4);
      }
      castFx('nova',  { x:c.x, y:c.y, r:R, color:'#67e8f9', dur:0.55 });
      castFx('runes', { x:c.x, y:c.y, r:R*0.55, color:'#a5f3fc', dur:0.75 });
      ok = true; msg = `❄️ ${hit.length}마리 −둔화`;
      break;
    }
    case 'a_chain': {
      if (!mobs.length) break;
      const rest = mobs.slice();
      let from = heroSpot(gs), n = 0;
      while (n < 6 && rest.length) {
        let bi = 0, bd = Infinity;
        for (let i = 0; i < rest.length; i++) {
          const d = Math.hypot(rest[i].x - from.x, rest[i].y - from.y);
          if (d < bd) { bd = d; bi = i; }
        }
        const m = rest.splice(bi, 1)[0];
        if (typeof FX !== 'undefined') FX.spark(from.x, from.y, m.x, m.y, '#c4b5fd');
        castFx('beam', { x1:from.x, y1:from.y, x2:m.x, y2:m.y, w:7, color:'#c4b5fd', dur:0.3 });
        hurtMob(gs, m, arenaDamage(atk * 1.9, m.def), '#c4b5fd');
        castFx('nova', { x:m.x, y:m.y, r:24, color:'#c4b5fd', dur:0.35 });
        from = { x:m.x, y:m.y }; n++;
      }
      ok = true; msg = `🔗 ${n}마리 연쇄`;
      break;
    }
    case 'a_rift': {
      if (!tops.length) break;
      // 경로를 세 칸 되감는다. 타워가 그 구간을 다시 때릴 시간을 버는 것이 전부다.
      let n = 0;
      for (const e of tops) {
        const before = e.wpIdx || 0;
        e.wpIdx = Math.max(0, before - 3);
        if (e.wpIdx !== before) n++;
        castFx('runes', { x:e.x, y:e.y, r:18, color:'#c084fc', dur:0.8 });
      }
      castFx('wash', { y:0, h:DEFENSE_H, color:'#c084fc', dur:0.6 });
      if (!n) break;
      ok = true; msg = `🌀 상단 ${n}마리 되감기`;
      break;
    }

    // 🏹 신궁 전용 ────────────────────────────────────────────────────────
    case 'a_arrows': {
      if (!mobs.length) break;
      const dmg = arenaDamage(atk * 1.9, 0);
      for (const m of mobs) {
        hurtMob(gs, m, arenaDamage(atk * 1.9, m.def), '#86efac', true, null);
        castFx('nova', { x:m.x, y:m.y, r:20, color:'#86efac', dur:0.35 });
      }
      castFx('rain', { x:ARENA_X, y:ARENA_Y, w:ARENA_W, h:ARENA_H, n:30, color:'#86efac', dur:0.8 });
      ok = true; msg = `🏹 ${mobs.length}마리 −${dmg}`;
      break;
    }
    case 'a_pierce': {
      if (!mobs.length) break;
      const c = heroSpot(gs);
      // 가장 가까운 적 쪽을 본다 — 방향을 따로 고르게 하지 않는다
      const near = mobs.reduce((a, m) =>
        (Math.hypot(m.x-c.x, m.y-c.y) < Math.hypot(a.x-c.x, a.y-c.y) ? m : a), mobs[0]);
      const ang = Math.atan2(near.y - c.y, near.x - c.x);
      const ex = c.x + Math.cos(ang) * 600, ey = c.y + Math.sin(ang) * 600;
      // 선분에서 22px 안쪽이면 맞는다
      const hit = mobs.filter(m => {
        const t = ((m.x-c.x)*(ex-c.x) + (m.y-c.y)*(ey-c.y)) / ((ex-c.x)**2 + (ey-c.y)**2);
        if (t < 0) return false;
        const px = c.x + (ex-c.x)*Math.min(1,t), py = c.y + (ey-c.y)*Math.min(1,t);
        return Math.hypot(m.x-px, m.y-py) <= 22 + m.radius;
      });
      if (!hit.length) break;
      for (const m of hit) {
        hurtMob(gs, m, arenaDamage(atk * 3.4, m.def), '#4ade80', true, null);
        castFx('nova', { x:m.x, y:m.y, r:26, color:'#4ade80', dur:0.35 });
      }
      castFx('beam', { x1:c.x, y1:c.y, x2:ex, y2:ey, w:16, color:'#4ade80', dur:0.4 });
      ok = true; msg = `➶ ${hit.length}마리 관통`;
      break;
    }
    case 'a_mark': {
      let n = 0;
      if (mobs.length) {
        const t = mobs.reduce((a, m) => (m.maxHp > a.maxHp ? m : a), mobs[0]);
        t.markUntil = arena.elapsed + 12; t.markPct = 0.6;
        castFx('runes', { x:t.x, y:t.y, r:26, color:'#fbbf24', dur:0.9 });
        castFx('nova',  { x:t.x, y:t.y, r:40, color:'#fbbf24', dur:0.45 });
        n++;
      }
      if (tops.length) {
        const e = tops.reduce((a, x) => (x.maxHp > a.maxHp ? x : a), tops[0]);
        e.markedUntil = 12;   // 상단은 초 단위로 줄어드는 타이머를 쓴다
        castFx('runes', { x:e.x, y:e.y, r:22, color:'#fbbf24', dur:0.9 });
        n++;
      }
      if (!n) break;
      ok = true; msg = `🎯 표식 ${n}곳`;
      break;
    }

    case 'a_plunder': {
      const tier = Math.max(1, endlessTier(gs.wave) || (gs.wave + 1));
      const gold = Math.round((18 + tier * 9) * BONUSES.battleGoldMult);
      gs.gold += gold;
      gs.battle.totalGoldEarned += gold;
      const pc = heroSpot(gs);
      castFx('nova', { x:pc.x, y:pc.y, r:70, color:'#fbbf24', dur:0.45 });
      if (typeof FX !== 'undefined') FX.burst(pc.x, pc.y, '#fbbf24', 18, 16);
      ok = true; msg = `💰 +${gold}`;
      break;
    }
  }

  if (!ok) return false;
  gs.hero.mp = Math.max(0, gs.hero.mp - mpCost);
  cds[id] = activeCooldown(id) * (BONUSES.heroSkillCdMult || 1);
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
  return ((gs.hero.activeCd || {})[id] || 0) <= 0 && (gs.hero.mp || 0) >= activeMpCost(id);
}
function activeCdLeft(gs, id) { return (gs.hero && gs.hero.activeCd ? gs.hero.activeCd[id] : 0) || 0; }
