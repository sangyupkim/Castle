'use strict';

// ─── 🔥 캠프 단련소 ───────────────────────────────────────────────────────────
// 보석의 마지막 사용처. 스킬 트리와 해금은 **확정**이다 — 보석을 내면 정해진
// 만큼 오르고, 다 사고 나면 더 살 것이 없다. 여기는 끝이 없고 확정이 아니다.
//   · 보석을 걸고 굴린다. 성공하면 +1.
//   · 실패는 세 갈래 — 유지 / 하락 / 파괴.
//   · 단계가 높을수록 성공은 드물고 실패는 아프다.
// 파괴가 있어야 "지금 멈출까"가 판단이 된다. 다만 바닥은 있다 — 5단마다 안전지대를
// 두어, 파괴가 나도 거기까지만 떨어진다.
//
// ── v12.9 재설계 ──
// 처음에는 '무기/방어/성채/심연' 네 덩어리였다. 값은 오르는데 **무엇을 키우는지가
// 없었다** — 어떤 타워를 쓰든 어떤 용병을 쓰든 같은 네 줄이라, 단련이 조합과
// 아무 상관이 없었다. 이제 대상별로 나눈다.
//   🏹 타워 6종 · 🌟 분기 18종 · ⚔️ 용병 6종 · 🏨 특수 용병 3종 · 🏰 성벽
// 한 칸을 올리면 그 대상의 **종합 능력치**가 함께 오른다(타워는 공격력·공속·사거리,
// 병력은 체력·공격력·방어력). 그래서 "저격탑을 주력으로 쓰겠다"가 캠프에서부터
// 시작되는 결정이 된다.

const CAMP_SAFE_STEP = 5;    // 이 배수는 안전지대 — 파괴해도 여기까지만 떨어진다
const CAMP_MAX_LV    = 40;   // 한 항목의 끝

// 한 단계가 올리는 폭. 대상이 34종으로 잘게 나뉘었으므로 하나하나는 작다 —
// 대신 내가 실제로 쓰는 것만 골라 올리면 그쪽이 확실히 세진다.
const CAMP_TOWER_PER  = 0.022;   // 타워 공격력 +2.2%p/단 (공속·사거리는 그 절반·1/3)
const CAMP_BRANCH_PER = 0.030;   // 분기는 더 좁은 대상이라 폭이 크다
const CAMP_UNIT_PER   = 0.026;   // 병력 체력·공격력
const CAMP_SPEC_PER   = 0.034;   // 특수 용병은 수가 적어 더 크게
const CAMP_WALL_PER   = 0.030;   // 성벽 최대 HP

// ── 트랙 목록은 게임 데이터에서 만든다 ──────────────────────────────────────
// 타워나 용병이 하나 늘면 단련 항목도 저절로 하나 는다. 손으로 적어 두면
// 새 타워를 넣을 때마다 여기를 잊는다.
function _campBuildTracks() {
  const out = [];

  // 🏰 성벽 — 하나뿐이라 맨 앞에
  out.push({
    id:'wall', group:'wall', name:'성벽', icon:'🏰', color:'#facc15',
    per:CAMP_WALL_PER,
    desc:v=>`기지 최대 HP +${Math.round(v*1000)/10}% · 피해 감소 +${Math.round(v*400)/10}%`,
    apply:(b,v)=>{ b.baseHpMax += Math.round(BASE_HP_MAX * v); b.baseDefPct += v*0.4; }
  });

  // 🏹 타워 — 종류마다. 공격력이 주고 공속·사거리가 따라온다.
  for (const id of TOWER_ORDER) {
    const t = TOWER_TYPES[id]; if (!t) continue;
    out.push({
      id:'tw_'+id, group:'tower', name:t.name, icon:t.icon, color:t.color,
      per:CAMP_TOWER_PER,
      desc:v=>`공격력 +${Math.round(v*1000)/10}% · 공속 +${Math.round(v*500)/10}% · 사거리 +${Math.round(v*334)/10}%`,
      apply:(b,v)=>{ _campTowerAdd(b, id, v); }
    });
  }

  // 🌟 분기 — ★5에서 갈라지는 18갈래. 그 갈래를 탄 타워에만 붙는다.
  for (const id of TOWER_ORDER) {
    for (const br of (TOWER_BRANCHES[id] || [])) {
      out.push({
        id:'br_'+br.id, group:'branch', name:br.name, icon:br.icon, color:br.color,
        parent:(TOWER_TYPES[id]||{}).name || id,
        per:CAMP_BRANCH_PER,
        desc:v=>`공격력 +${Math.round(v*1000)/10}% · 공속 +${Math.round(v*500)/10}%`,
        apply:(b,v)=>{ _campBranchAdd(b, br.id, v); }
      });
    }
  }

  // ⚔️ 용병 — 종류마다 체력·공격력·방어력이 함께 오른다.
  // UNIT_TYPES에는 특수 용병이 Object.assign으로 합쳐져 있으므로 여기서는 걸러낸다
  // (특수는 아래에서 따로, 더 큰 폭으로 다룬다).
  for (const id of Object.keys(UNIT_TYPES)) {
    const u = UNIT_TYPES[id];
    if (u.special) continue;
    out.push({
      id:'un_'+id, group:'unit', name:u.name, icon:u.icon, color:u.color,
      per:CAMP_UNIT_PER,
      desc:v=>`체력 +${Math.round(v*1000)/10}% · 공격력 +${Math.round(v*1000)/10}% · 방어력 +${Math.round(v*500)/10}%`,
      apply:(b,v)=>{ _campUnitAdd(b, id, v); }
    });
  }

  // 🏨 특수 용병 — 여관에서만 오는 셋
  for (const id of SPECIAL_UNIT_ORDER) {
    const u = SPECIAL_UNIT_TYPES[id]; if (!u) continue;
    out.push({
      id:'un_'+id, group:'special', name:u.name, icon:u.icon, color:u.color,
      per:CAMP_SPEC_PER,
      desc:v=>`체력 +${Math.round(v*1000)/10}% · 공격력 +${Math.round(v*1000)/10}% · 방어력 +${Math.round(v*500)/10}%`,
      apply:(b,v)=>{ _campUnitAdd(b, id, v); }
    });
  }
  return out;
}

// BONUSES에 대상별 배율을 쌓는다. 없으면 만들어 쓴다 —
// 34개를 createDefaultBonuses에 일일이 적으면 타워 하나 늘 때마다 또 잊는다.
function _campBucket(b, key) { return (b[key] || (b[key] = {})); }
function _campTowerAdd(b, id, v) {
  const m = _campBucket(b, 'campTower');
  const e = m[id] || (m[id] = { dmg:1, spd:1, range:1 });
  e.dmg *= 1 + v; e.spd *= 1 + v*0.5; e.range *= 1 + v/3;
}
function _campBranchAdd(b, id, v) {
  const m = _campBucket(b, 'campBranch');
  const e = m[id] || (m[id] = { dmg:1, spd:1 });
  e.dmg *= 1 + v; e.spd *= 1 + v*0.5;
}
function _campUnitAdd(b, id, v) {
  const m = _campBucket(b, 'campUnit');
  const e = m[id] || (m[id] = { hp:1, atk:1, def:1 });
  e.hp *= 1 + v; e.atk *= 1 + v; e.def *= 1 + v*0.5;
}
// 읽는 쪽 — 단련한 적이 없으면 1
function campTowerMult(typeId, key) {
  const e = (BONUSES.campTower || {})[typeId];
  return e ? (e[key] || 1) : 1;
}
function campBranchMult(branchId, key) {
  if (!branchId) return 1;
  const e = (BONUSES.campBranch || {})[branchId];
  return e ? (e[key] || 1) : 1;
}
function campUnitMult(typeId, key) {
  const e = (BONUSES.campUnit || {})[typeId];
  return e ? (e[key] || 1) : 1;
}

let CAMP_TRACKS = [];
function campTracks() {
  if (!CAMP_TRACKS.length) CAMP_TRACKS = _campBuildTracks();
  return CAMP_TRACKS;
}
function campTrack(id) { return campTracks().find(t => t.id === id) || null; }

const CAMP_GROUPS = [
  { id:'wall',    icon:'🏰', short:'성벽', label:'성벽',      color:'#facc15' },
  { id:'tower',   icon:'🏹', short:'타워', label:'타워',      color:'#22c55e' },
  { id:'branch',  icon:'🌟', short:'분기', label:'타워 분기', color:'#a78bfa' },
  { id:'unit',    icon:'⚔️', short:'용병', label:'용병',      color:'#f97316' },
  { id:'special', icon:'🏨', short:'특수', label:'특수 용병', color:'#f43f5e' },
];

function campState(gs) {
  if (!gs.camp) gs.camp = { levels:{}, tries:0, breaks:0 };
  if (!gs.camp.levels) gs.camp.levels = {};
  return gs.camp;
}
function campLevel(gs, id) { return campState(gs).levels[id] || 0; }

// 값 — 단계마다 가파르게. 대상이 34종이라 하나하나는 예전보다 싸다.
function campCost(gs, id) {
  const lv = campLevel(gs, id);
  if (lv >= CAMP_MAX_LV) return null;
  const tr = campTrack(id);
  // 분기와 특수 용병은 대상이 좁은 만큼 폭이 크므로 값도 비싸다
  const base = tr && (tr.group === 'branch' || tr.group === 'special') ? 9
             : tr && tr.group === 'wall' ? 12 : 7;
  return Math.max(3, Math.round(base * Math.pow(1.165, lv)));
}
// 성공 확률 — 안전지대 직후는 후하고, 다음 안전지대에 가까울수록 인색해진다
function campOdds(gs, id) {
  const lv = campLevel(gs, id);
  const within = lv % CAMP_SAFE_STEP;
  return Math.max(0.14, 0.86 - within * 0.115 - Math.floor(lv / CAMP_SAFE_STEP) * 0.030);
}
function campSafeFloor(gs, id) {
  return Math.floor(campLevel(gs, id) / CAMP_SAFE_STEP) * CAMP_SAFE_STEP;
}
// 실패했을 때 무슨 일이 일어나는가 — { keep, down, brk } (합이 1)
function campFailOdds(gs, id) {
  const lv = campLevel(gs, id);
  if (lv < CAMP_SAFE_STEP) return { keep:1, down:0, brk:0 };   // 첫 구간은 잃지 않는다
  const down = Math.min(0.55, 0.16 + lv * 0.013);
  const brk  = Math.min(0.30, Math.max(0, (lv - CAMP_SAFE_STEP * 2) * 0.011));
  return { keep: Math.max(0, 1 - down - brk), down, brk };
}

// 한 번 굴린다. { ok, kind, before, after, cost } 또는 null(불가)
//   kind: 'up' | 'keep' | 'down' | 'break'
function campTemper(gs, id) {
  if (!campTrack(id)) return null;
  const c = campState(gs);
  const lv = campLevel(gs, id);
  if (lv >= CAMP_MAX_LV) return null;
  const cost = campCost(gs, id);
  if (cost == null || (gs.soulStones || 0) < cost) return null;

  gs.soulStones -= cost;
  c.tries = (c.tries || 0) + 1;
  const before = lv;
  let kind;
  if (Math.random() < campOdds(gs, id)) {
    c.levels[id] = lv + 1; kind = 'up';
  } else {
    const f = campFailOdds(gs, id);
    const r = Math.random();
    if (r < f.brk) {
      c.levels[id] = campSafeFloor(gs, id);
      c.breaks = (c.breaks || 0) + 1;
      kind = c.levels[id] === lv ? 'keep' : 'break';
    } else if (r < f.brk + f.down) {
      c.levels[id] = Math.max(campSafeFloor(gs, id), lv - 1);
      kind = c.levels[id] === lv ? 'keep' : 'down';
    } else {
      kind = 'keep';
    }
  }
  reapplyAllBonuses(gs);
  return { ok: kind === 'up', kind, before, after: campLevel(gs, id), cost };
}

// reapplyAllBonuses가 매번 부른다
function applyCamp(gs) {
  for (const tr of campTracks()) {
    const lv = campLevel(gs, tr.id);
    if (lv > 0) tr.apply(BONUSES, lv * tr.per);
  }
}

// 지금까지 이 항목에 넣은 보석 총액 (기록용)
function campSpentOn(gs, id) {
  const tr = campTrack(id); if (!tr) return 0;
  const base = (tr.group === 'branch' || tr.group === 'special') ? 9
             : tr.group === 'wall' ? 12 : 7;
  let t = 0;
  for (let i = 0; i < campLevel(gs, id); i++) t += Math.max(3, Math.round(base * Math.pow(1.165, i)));
  return t;
}

// ─── 🎴 패 — 카드 선택 자체를 강화한다 ────────────────────────────────────────
// 강화 카드는 이 게임의 중추다. 한 판에서 30번 넘게 고르고, 그 30번이 그 판의
// 성격을 만든다. 그런데 지금까지 플레이어가 그 30번에 개입할 수 있는 방법은
// **골드를 내고 다시 뽑기** 하나뿐이었다 — 무엇이 나올지에는 손을 댈 수 없었다.
//
// 여기서 그 확률 자체를 산다. 넷 다 성격이 다르다.
//   🃏 패의 폭   — 몇 장 중에 고르나 (선택지의 수)
//   ✨ 감정안     — 좋은 등급이 얼마나 자주 오나 (질)
//   ✦ 전설의 예감 — 전설만 따로 밀어 올린다 (뾰족하게)
//   🚫 기피 목록  — 보기 싫은 카드를 아예 빼 버린다 (내가 정하는 풀)
//   🎲 다시 뽑기  — 층마다 공짜 리롤
//
// 값은 보석이고 영구다. 단련(🔥)과 달리 **확정**으로 오른다 — 확률을 사는 곳에서
// 확률로 굴리게 하면 두 겹이 되어 무엇을 샀는지 알 수 없다.
const CARD_META_TRACKS = [
  { id:'hand',   name:'패의 폭',     icon:'🃏', color:'#38bdf8', max:3,
    cost: lv => Math.round(180 * Math.pow(3.1, lv)),
    desc: lv => `카드 ${3 + lv}장 중에서 고릅니다`,
    note: '고를 수 있는 장수가 늘어납니다' },
  { id:'eye',    name:'감정안',      icon:'✨', color:'#a78bfa', max:20,
    cost: lv => Math.round(60 * Math.pow(1.20, lv)),
    desc: lv => `희귀 이상 등장 가중치 +${Math.round(lv * 6)}%`,
    note: '좋은 등급이 더 자주 옵니다' },
  { id:'omen',   name:'전설의 예감', icon:'✦', color:'#fbbf24', max:15,
    cost: lv => Math.round(140 * Math.pow(1.26, lv)),
    desc: lv => `✦전설 등장 가중치 +${Math.round(lv * 14)}%`,
    note: '전설만 따로 밀어 올립니다' },
  { id:'ban',    name:'기피 목록',   icon:'🚫', color:'#f87171', max:8,
    cost: lv => Math.round(260 * Math.pow(1.42, lv)),
    desc: lv => lv > 0 ? `보기 싫은 카드 ${lv}장을 뺍니다` : '아직 뺄 수 없습니다',
    note: '고른 카드는 이제 나오지 않습니다' },
  { id:'reroll', name:'다시 뽑기',   icon:'🎲', color:'#4ade80', max:3,
    cost: lv => Math.round(320 * Math.pow(2.2, lv)),
    desc: lv => lv > 0 ? `층마다 공짜 리롤 ${lv}회` : '리롤은 골드로만',
    note: '골드를 내지 않고 다시 뽑습니다' },
];
function cardMetaTrack(id) { return CARD_META_TRACKS.find(t => t.id === id) || null; }

function cardMetaState(gs) {
  if (!gs.cardMeta) gs.cardMeta = { levels:{}, bans:[] };
  if (!gs.cardMeta.levels) gs.cardMeta.levels = {};
  if (!Array.isArray(gs.cardMeta.bans)) gs.cardMeta.bans = [];
  return gs.cardMeta;
}
function cardMetaLevel(gs, id) { return cardMetaState(gs).levels[id] || 0; }
function cardMetaCost(gs, id) {
  const tr = cardMetaTrack(id); if (!tr) return null;
  const lv = cardMetaLevel(gs, id);
  if (lv >= tr.max) return null;
  return tr.cost(lv);
}
// 확정 구매 — 확률로 굴리지 않는다
function buyCardMeta(gs, id) {
  const cost = cardMetaCost(gs, id);
  if (cost == null || (gs.soulStones || 0) < cost) return false;
  gs.soulStones -= cost;
  const c = cardMetaState(gs);
  c.levels[id] = cardMetaLevel(gs, id) + 1;
  // 기피 칸이 줄어들 일은 없지만, 넘치면 뒤에서 자른다
  const slots = cardMetaLevel(gs, 'ban');
  if (c.bans.length > slots) c.bans.length = slots;
  return true;
}

// ── 기피 목록 ──
function cardBanSlots(gs)    { return cardMetaLevel(gs, 'ban'); }
function isCardBanned(gs, id){ return cardMetaState(gs).bans.includes(id); }
function toggleCardBan(gs, id) {
  const c = cardMetaState(gs);
  const i = c.bans.indexOf(id);
  if (i >= 0) { c.bans.splice(i, 1); return true; }
  if (c.bans.length >= cardBanSlots(gs)) return false;   // 칸이 없다
  c.bans.push(id);
  return true;
}

// ── 뽑기에 쓰이는 값 ──
// 한 번에 보여줄 장수 (층 이벤트 🎲풍요가 더 크면 그쪽을 쓴다)
function cardHandSize(gs)   { return 3 + cardMetaLevel(gs, 'hand'); }
// 층마다 주어지는 공짜 리롤
function cardFreeRerolls(gs){ return cardMetaLevel(gs, 'reroll'); }
// 등급별 가중치 — 감정안은 희귀 이상 전체를, 예감은 전설만 밀어 올린다
function cardGradeWeights(gs) {
  const eye  = cardMetaLevel(gs, 'eye')  * 0.06;
  const omen = cardMetaLevel(gs, 'omen') * 0.14;
  return {
    common: CARD_GRADE_WEIGHT.common,
    rare:   CARD_GRADE_WEIGHT.rare   * (1 + eye),
    epic:   CARD_GRADE_WEIGHT.epic   * (1 + eye),
    legend: CARD_GRADE_WEIGHT.legend * (1 + eye) * (1 + omen),
  };
}
// 지금 설정으로 각 등급이 나올 확률 (표시용)
function cardGradeOdds(gs) {
  const w = cardGradeWeights(gs);
  const n = {};
  // 기피로 뺀 카드는 풀에서 사라진다 — 여기서도 빼야 화면의 확률이 실제와 맞는다.
  // (일반을 여덟 장 빼 놓고 "일반 34%"라고 적혀 있으면 그 표시가 거짓말이 된다)
  const bans = new Set(cardMetaState(gs).bans);
  for (const c of UPGRADE_CARDS) if (!bans.has(c.id)) n[c.grade] = (n[c.grade] || 0) + 1;
  let total = 0;
  for (const g of CARD_GRADES) total += (w[g] || 0) * (n[g] || 0);
  const out = {};
  for (const g of CARD_GRADES) out[g] = total > 0 ? (w[g] || 0) * (n[g] || 0) / total : 0;
  return out;
}
// 캠프에서 🎴패에 넣은 보석 총액 (기록용)
function cardMetaSpent(gs) {
  let t = 0;
  for (const tr of CARD_META_TRACKS)
    for (let i = 0; i < cardMetaLevel(gs, tr.id); i++) t += tr.cost(i);
  return t;
}
