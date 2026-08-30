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
