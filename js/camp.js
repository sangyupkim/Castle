'use strict';

// ─── 🔥 캠프 단련소 ───────────────────────────────────────────────────────────
// 보석의 마지막 사용처. 스킬 트리와 해금은 **확정**이다 — 보석을 내면 정해진
// 만큼 오르고, 다 사고 나면 더 살 것이 없다. 100층을 한 번 돌파하면 9,000보석이
// 들어오는데 캠프에서 살 수 있는 것이 다 합쳐 7,000이라, 첫 돌파에서 이미
// 모든 것이 끝나 버렸다. 끝이 있는 사용처만으로는 보석이 남는다.
//
// 그래서 여기는 **끝이 없고 확정이 아니다.**
//   · 보석을 걸고 굴린다. 성공하면 +1.
//   · 실패는 세 갈래 — 유지 / 하락 / 파괴.
//   · 단계가 높을수록 성공은 드물고 실패는 아프다.
//
// 파괴가 있어야 "지금 멈출까"가 판단이 된다. 다만 바닥은 있다 — 5단마다 안전지대를
// 두어, 파괴가 나도 거기까지만 떨어진다. 스무 시간을 쌓은 것이 한 번에 0이 되면
// 그건 도박이 아니라 벌이다.
//
// 대장간(마을)과 헷갈리지 않게: 대장간은 골드로 굴리고 그 판에서만 산다.
// 여기는 보석으로 굴리고 영원히 남는다.

const CAMP_SAFE_STEP = 5;    // 이 배수는 안전지대 — 파괴해도 여기까지만 떨어진다
const CAMP_MAX_LV    = 40;   // 한 항목의 끝

const CAMP_TRACKS = [
  { id:'weapon', name:'무기 단련', icon:'⚔️', color:'#f59e0b',
    per:0.030, desc:v=>`타워·병력 공격력 +${Math.round(v*1000)/10}%`,
    apply:(b,v)=>{ b.towerDmgMult *= 1+v; b.unitAtkMult *= 1+v; } },
  { id:'armor',  name:'방어 단련', icon:'🛡️', color:'#38bdf8',
    per:0.040, desc:v=>`병력 최대 HP +${Math.round(v*1000)/10}%`,
    apply:(b,v)=>{ b.unitHpMult *= 1+v; } },
  { id:'castle', name:'성채 단련', icon:'🏰', color:'#facc15',
    per:0.038, desc:v=>`기지 최대 HP +${Math.round(v*1000)/10}%`,
    apply:(b,v)=>{ b.baseHpMax += Math.round(BASE_HP_MAX * v); } },
  { id:'abyss',  name:'심연 단련', icon:'💎', color:'#a78bfa',
    per:0.025, desc:v=>`획득 보석 +${Math.round(v*1000)/10}%`,
    apply:(b,v)=>{ b.gemMult *= 1+v; } },
];
function campTrack(id) { return CAMP_TRACKS.find(t => t.id === id) || null; }

function campState(gs) {
  if (!gs.camp) gs.camp = { levels:{}, tries:0, breaks:0 };
  if (!gs.camp.levels) gs.camp.levels = {};
  return gs.camp;
}
function campLevel(gs, id) { return campState(gs).levels[id] || 0; }

// 값 — 단계마다 가파르게. 끝이 없는 사용처라 후반이 무거워야 의미가 있다.
function campCost(gs, id) {
  const lv = campLevel(gs, id);
  if (lv >= CAMP_MAX_LV) return null;
  return Math.max(4, Math.round(6 * Math.pow(1.19, lv)));
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
// 낮은 단계는 대부분 그대로 남고, 높아질수록 하락과 파괴가 고개를 든다.
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
  for (const tr of CAMP_TRACKS) {
    const lv = campLevel(gs, tr.id);
    if (lv > 0) tr.apply(BONUSES, lv * tr.per);
  }
}

// 지금까지 이 항목에 넣은 보석 총액 (기록용)
function campSpentOn(gs, id) {
  let t = 0;
  for (let i = 0; i < campLevel(gs, id); i++) t += Math.max(4, Math.round(6 * Math.pow(1.19, i)));
  return t;
}
