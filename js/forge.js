'use strict';

// ─── ⚒️ 대장간 ────────────────────────────────────────────────────────────────
// 다른 건물은 전부 "골드를 내면 정해진 만큼 오른다". 대장간만 값이 흔들린다.
// 세 가지를 하는데, 셋 다 다른 건물과 겹치지 않는다.
//
// ── v12.8 화폐 정리 ──
// 예전에는 대장간만 **보석**을 썼고 결과가 판을 넘어 남았다. 그래서 화폐의 뜻이
// 흐렸다 — 판 안에서 버는 골드는 판 안에서만 쓰이는데, 판 안의 건물 하나가
// 영구 화폐를 요구했다. 이제 규칙을 하나로 세운다.
//   💰 골드  — 판 안에서 벌고 판 안에서만 쓴다. 판이 끝나면 사라진다.
//   💎 보석  — 캠프에서만 쓴다. 무엇을 사든 영구히 남는다.
// 그래서 마을 대장간은 전부 골드로 돌고, 상태도 gs.town에 산다(판마다 초기화).
// 보석을 걸고 굴리는 확률 강화는 캠프로 옮겼다 — js/camp.js.
//
//  1. 🔨 장비 연마 — 보관함의 영웅 장비를 +N까지 올린다. 확정이고, 값은 보석이다.
//  2. 🔥 타워 합성 — ★5 심(core) 둘을 녹여 ★6을 만든다. 확률이고, 실패하면 하나가 탄다.
//                    가진 최고 별이 그 판의 타워 최고 레벨이 된다 — ★10까지.
//  3. 🎲 담금질   — 대장간 숙련도를 걸고 굴린다. 성공하면 +1, 실패하면 체크포인트로.
//                    올라간 숙련도는 타워와 병력 모두에 붙는다.

// ── 1. 장비 연마 ─────────────────────────────────────────────────────────────
// 영웅 장비 자체는 한 판짜리다 — 상점에서 골드로 사고 판이 끝나면 없어진다.
// 그래서 연마는 물건이 아니라 **칸**에 붙인다. 무기 칸을 +5까지 올려두면
// 이번 판에 어떤 검을 사든 그 검이 +5로 붙는다. 보석은 영구히 남는 데 쓰여야 한다.
const FORGE_PLUS_MAX  = 10;          // 칸마다 +10이 끝
const FORGE_PLUS_STEP = 0.08;        // 한 단계마다 그 칸 장비 스탯 +8%
// 보석에서 골드로 옮기며 값의 자릿수를 골드 경제에 맞췄다 (보석 1 ≒ 골드 9쯤)
const FORGE_GOLD_SCALE = 9;

function slotPlus(gs, slotId) { return (forgeState(gs).plus || {})[slotId] || 0; }
function slotPlusCost(gs, slotId) {
  const p = slotPlus(gs, slotId);
  if (p >= FORGE_PLUS_MAX) return null;
  // 악세 칸은 둘이라 반값 — 두 칸을 다 올려야 하니 총액은 비슷해진다
  const base = (slotId === 'acc1' || slotId === 'acc2') ? 2 : 3;
  return Math.max(1, Math.round(base * (p + 1) * 1.15) * FORGE_GOLD_SCALE);
}
function upgradeSlotPlus(gs, slotId) {
  const cost = slotPlusCost(gs, slotId);
  if (cost == null || (gs.gold || 0) < cost) return false;
  const f = forgeState(gs);
  gs.gold -= cost;
  f.plus[slotId] = slotPlus(gs, slotId) + 1;
  reapplyAllBonuses(gs);
  return true;
}
// 그 칸에 낀 장비가 실제로 받는 배율
function slotPlusMult(gs, slotId) {
  return 1 + slotPlus(gs, slotId) * (FORGE_PLUS_STEP + (BONUSES.gearPlusBonus || 0));
}

// ── 2. 타워 합성 ─────────────────────────────────────────────────────────────
const FORGE_STAR_MIN  = 5;           // ★5부터 시작 (지금까지의 최고 레벨)
const FORGE_STAR_MAX  = 10;
const FORGE_CORE_COST = 14 * 9;      // ★5 심 하나를 사는 값 (골드)
// ★N 둘 → ★(N+1) 하나. 별이 높을수록 확률이 낮다.
const FORGE_ODDS = { 5:0.62, 6:0.48, 7:0.36, 8:0.26, 9:0.18 };

// 마을 대장간은 골드로 돌아가고 **그 판에서만** 유효하다.
// 그래서 영구 슬롯(gs.forge)이 아니라 판 상태(gs.town.forge)에 산다 —
// gs.town은 출격할 때마다 새로 만들어지므로 판이 끝나면 자동으로 사라진다.
function forgeState(gs) {
  const home = (gs && gs.town) ? gs.town : gs;
  if (!home.forge) home.forge = { cores:{}, best:FORGE_STAR_MIN, mastery:0, plus:{} };
  const f = home.forge;
  if (!f.cores) f.cores = {};
  if (!f.plus)  f.plus  = {};
  if (!f.best)  f.best  = FORGE_STAR_MIN;
  if (f.mastery === undefined) f.mastery = 0;
  return f;
}
function forgeCores(gs, star) { return forgeState(gs).cores[star] || 0; }
function forgeBestStar(gs)    { return forgeState(gs).best; }

function buyForgeCore(gs) {
  if ((gs.gold || 0) < FORGE_CORE_COST) return false;
  const f = forgeState(gs);
  gs.gold -= FORGE_CORE_COST;
  f.cores[FORGE_STAR_MIN] = forgeCores(gs, FORGE_STAR_MIN) + 1;
  return true;
}

// 합성 한 번. { ok, star, got } 또는 null(불가)
function fuseCores(gs, star) {
  const f = forgeState(gs);
  if (star < FORGE_STAR_MIN || star >= FORGE_STAR_MAX) return null;
  if (forgeCores(gs, star) < 2) return null;
  f.cores[star] -= 2;
  const p = Math.min(0.95, (FORGE_ODDS[star] || 0.15) + (BONUSES.fuseLuck || 0));
  if (Math.random() < p) {
    const next = star + 1;
    f.cores[next] = (f.cores[next] || 0) + 1;
    if (next > f.best) { f.best = next; reapplyAllBonuses(gs); }
    return { ok:true, star, got:next };
  }
  // 실패해도 둘 다 잃지는 않는다 — 하나는 돌아온다. 벽이 아니라 비탈이어야 한다.
  f.cores[star] += 1;
  return { ok:false, star, got:star };
}

// ── 2-b. 심으로 타워 승급 ────────────────────────────────────────────────────
// ★5 위로는 골드가 통하지 않는다. **심 하나에 타워 하나**다 —
// ★6 심을 태우면 그 타워 한 기만 ★6이 된다. 다른 타워는 그대로 ★5다.
//
// 예전에는 심을 하나 만들면 판 위의 모든 타워가 골드로 그 별까지 올라갔다.
// 심을 모으는 일이 "한 번만 하면 끝나는 해금"이 되어 버려서, 합성을 계속할 이유가 없었다.
function towerPromoteStar(t) { return ((t && t.level) || 1) + 1; }

// 이 타워를 한 별 올리는 데 필요한 심을 가지고 있나
function canPromoteTower(gs, t) {
  if (!t) return false;
  const next = towerPromoteStar(t);
  if (next <= towerLevelCap()) return false;      // 아직 골드로 올릴 구간
  if (next > towerStarCap())   return false;      // ★10이 끝
  return forgeCores(gs, next) > 0;
}
// 승급 한 번. 심 하나를 태우고 그 타워만 한 별 올린다.
function promoteTowerWithCore(gs, t) {
  if (!canPromoteTower(gs, t)) return false;
  const next = towerPromoteStar(t);
  const f = forgeState(gs);
  f.cores[next] -= 1;
  t.level = next;
  return true;
}

// ── 3. 담금질 ────────────────────────────────────────────────────────────────
// 숙련도를 걸고 굴린다. 5의 배수는 체크포인트라 실패해도 거기서 멈춘다.
const TEMPER_CHECKPOINT = 5;
const TEMPER_MAX        = 40;
const TEMPER_GAIN       = 0.02;      // 숙련도 1당 타워·병력 공격력 +2%

function temperCost(gs) {
  const m = forgeState(gs).mastery;
  return Math.max(3, Math.round(4 + m * 1.6)) * FORGE_GOLD_SCALE;
}
function temperOdds(gs) {
  const m = forgeState(gs).mastery;
  // 체크포인트 직후는 후하고, 다음 체크포인트에 가까워질수록 인색해진다
  const within = m % TEMPER_CHECKPOINT;
  return Math.max(0.22, 0.80 - within * 0.12 - Math.floor(m / TEMPER_CHECKPOINT) * 0.035);
}
function temperFloor(gs) {
  return Math.floor(forgeState(gs).mastery / TEMPER_CHECKPOINT) * TEMPER_CHECKPOINT;
}
function temperForge(gs) {
  const f = forgeState(gs);
  if (f.mastery >= TEMPER_MAX) return null;
  const cost = temperCost(gs);
  if ((gs.gold || 0) < cost) return null;
  gs.gold -= cost;
  const win = Math.random() < temperOdds(gs);
  const before = f.mastery;
  if (win) f.mastery += 1;
  else     f.mastery = temperFloor(gs);
  reapplyAllBonuses(gs);
  return { ok:win, before, after:f.mastery, cost };
}

// ── 보너스 적용 ──────────────────────────────────────────────────────────────
// reapplyAllBonuses가 매번 부른다.
function applyForge(gs) {
  const f = forgeState(gs);
  if (f.mastery > 0) {
    const m = 1 + f.mastery * TEMPER_GAIN;
    BONUSES.towerDmgMult *= m;
    BONUSES.unitAtkMult  *= m;
  }
}

// 합성으로 열린 타워 최고 레벨
function forgeTowerCap(gs) {
  return Math.min(FORGE_STAR_MAX, forgeBestStar(gs || (typeof window !== 'undefined' ? window.gs : null) || {}));
}

// ─── 🎴 부적 (일회용 보석 사용처) ─────────────────────────────────────────────
// 캠프에서 보석으로 뽑고, 출전 전에 두 칸에 끼우고, 판이 시작되면 사라진다.
// 영구 강화와 달리 "이번 판을 어떻게 풀 것인가"를 고르는 물건이다 —
// 보석이 계속 들어오는 게임이라 소모처가 하나쯤 있어야 저축이 목적을 되찾는다.
const CHARM_ROLL_COST = 8;
const CHARM_BAG_MAX   = 12;   // 보관함 상한. 넘치면 뽑을 수 없다.
const CHARM_SLOTS     = 2;

const CHARM_POOL = [
  // 흔함
  { id:'ch_gold',   name:'행상인의 주머니', icon:'💰', grade:'common', w:26,
    desc:'이번 판 전투 골드 +40%',        apply:b=>{ b.battleGoldMult *= 1.4; } },
  { id:'ch_start',  name:'선발대 보급',     icon:'📦', grade:'common', w:24,
    desc:'매 층 시작 골드 +60',           apply:b=>{ b.startGoldBonus += 60; } },
  { id:'ch_wall',   name:'회벽 한 통',      icon:'🧱', grade:'common', w:24,
    desc:'기지 최대 HP +30%',             apply:b=>{ b.baseHpMax += Math.round(BASE_HP_MAX * 0.3); } },
  { id:'ch_swift',  name:'바람의 깃털',     icon:'🪶', grade:'common', w:22,
    desc:'아군 공격속도 +25%',            apply:b=>{ b.unitAtkSpdMult *= 1.25; } },
  // 희귀
  { id:'ch_tower',  name:'벼려진 촉',       icon:'🏹', grade:'rare',   w:14,
    desc:'타워 공격력 +35%',              apply:b=>{ b.towerDmgMult *= 1.35; } },
  { id:'ch_unit',   name:'전열의 맹세',     icon:'⚔️', grade:'rare',   w:14,
    desc:'아군 공격력 +35%',              apply:b=>{ b.unitAtkMult *= 1.35; } },
  { id:'ch_slot',   name:'모병 영장',       icon:'➕', grade:'rare',   w:11,
    desc:'편성 슬롯 +2',                  apply:b=>{ b.maxSlotBonus += 2; } },
  { id:'ch_pierce', name:'파쇄의 인장',     icon:'🔩', grade:'rare',   w:12,
    desc:'타워가 적 방어 12 무시',        apply:b=>{ b.towerPierce += 12; } },
  { id:'ch_gem',    name:'보석 감정서',     icon:'💎', grade:'rare',   w:10,
    desc:'이번 판 층당 보석 +50%',        apply:b=>{ b.gemMult *= 1.5; } },
  // 영웅
  { id:'ch_hero',   name:'왕의 인장',       icon:'👑', grade:'epic',   w:6,
    desc:'영웅 전체 능력 +50%',           apply:b=>{ b.heroStatMult *= 1.5; } },
  { id:'ch_frost',  name:'서리 결정',       icon:'❄️', grade:'epic',   w:6,
    desc:'모든 타워에 감속 35%',          apply:b=>{ b.towerSlow += 0.35; } },
  { id:'ch_weak',   name:'저주받은 뼈',     icon:'🦴', grade:'epic',   w:5,
    desc:'모든 적 HP -25%',               apply:b=>{ b.mobHpMult *= 0.75; } },
  { id:'ch_undying',name:'불사조 깃털',     icon:'🔥', grade:'epic',   w:5,
    desc:'아군 최초 사망 시 HP 1 생존 · 영웅 즉시 부활',
    apply:b=>{ b.undying = true; b.heroInstantRevive = true; } },
];
function charmDef(id) { return CHARM_POOL.find(c => c.id === id); }

let _charmUid = 0;
function charmBag(gs) {
  if (!gs.charms)     gs.charms = [];
  if (!gs.charmSlots) gs.charmSlots = new Array(CHARM_SLOTS).fill(null);
  for (const c of gs.charms) if (c.uid > _charmUid) _charmUid = c.uid;
  return gs.charms;
}
function charmSlots(gs) { charmBag(gs); return gs.charmSlots; }
function charmEntry(gs, uid) { return charmBag(gs).find(c => c.uid === uid) || null; }

function rollCharm(gs) {
  const bag = charmBag(gs);
  if (bag.length >= CHARM_BAG_MAX) return null;
  if ((gs.soulStones || 0) < CHARM_ROLL_COST) return null;
  gs.soulStones -= CHARM_ROLL_COST;
  let total = 0; for (const c of CHARM_POOL) total += c.w;
  let r = Math.random() * total, picked = CHARM_POOL[0];
  for (const c of CHARM_POOL) { r -= c.w; if (r <= 0) { picked = c; break; } }
  const entry = { uid: ++_charmUid, charmId: picked.id };
  bag.push(entry);
  return entry;
}
// 슬롯에 끼우기 / 빼기 — 같은 부적이 두 칸에 들어가지는 않는다
function setCharmSlot(gs, idx, uid) {
  const sl = charmSlots(gs);
  if (idx < 0 || idx >= sl.length) return false;
  if (uid != null) {
    if (!charmEntry(gs, uid)) return false;
    for (let i = 0; i < sl.length; i++) if (sl[i] === uid) sl[i] = null;
  }
  sl[idx] = uid;
  return true;
}
function isCharmSlotted(gs, uid) { return charmSlots(gs).includes(uid); }
function discardCharm(gs, uid) {
  const bag = charmBag(gs);
  const i = bag.findIndex(c => c.uid === uid);
  if (i < 0) return false;
  bag.splice(i, 1);
  const sl = charmSlots(gs);
  for (let j = 0; j < sl.length; j++) if (sl[j] === uid) sl[j] = null;
  return true;
}

// 출격할 때 — 끼운 부적을 보관함에서 빼서 이번 판 전용으로 옮긴다. 판이 끝나면 사라진다.
function consumeCharmsForRun(gs) {
  const sl = charmSlots(gs), used = [];
  for (let i = 0; i < sl.length; i++) {
    const uid = sl[i]; if (uid == null) continue;
    const e = charmEntry(gs, uid); if (!e) { sl[i] = null; continue; }
    used.push(e.charmId);
    discardCharm(gs, uid);
    sl[i] = null;
  }
  gs.runCharms = used;
  return used;
}
function applyCharms(gs) {
  for (const id of (gs.runCharms || [])) {
    const c = charmDef(id);
    if (c && c.apply) c.apply(BONUSES, gs);
  }
}
