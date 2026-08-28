'use strict';

// ─── 로비 · 캠프 ─────────────────────────────────────────────────────────────
// 런 밖에 머무는 곳. v2.0까지는 스킬 트리가 gs.gameOver일 때만 열려
// "보석을 쓰려면 죽어야" 했다. 로비를 런 밖으로 빼면서 순서가 뒤집힌다 —
// 먼저 쓰고, 그 다음에 들어간다.

const LOBBY_HEADER_H = 56;
const LOBBY_TAB_H    = 44;
const LOBBY_TAB_Y    = LOBBY_HEADER_H;
const LOBBY_BODY_Y   = LOBBY_HEADER_H + LOBBY_TAB_H;
const LOBBY_SORTIE_H = 60;
const LOBBY_BODY_H   = CH - LOBBY_BODY_Y - LOBBY_SORTIE_H;

const LOBBY_TABS = [
  { id:'sortie', label:'출격', icon:'⚔️', color:'#22c55e' },
  { id:'skill',  label:'스킬', icon:'🌳', color:'#a78bfa' },
  { id:'unlock', label:'해금', icon:'🔓', color:'#f59e0b' },
  { id:'pact',   label:'서약', icon:'📜', color:'#f43f5e' },
  { id:'record', label:'기록', icon:'📊', color:'#60a5fa' },
];

function createLobby() {
  return {
    tab: 'sortie',
    skillTree: 'tower',   // 스킬 탭 안의 계열
    scroll: 0
  };
}

// ─── 해금 ────────────────────────────────────────────────────────────────────
// 전역 참조(_unlocked)는 game.js가 소유한다. 런 리셋과 무관하게 유지된다.
function isUnlocked(id) {
  if (INITIAL_UNLOCKED.includes(id)) return true;
  return (typeof _unlocked !== 'undefined') && _unlocked.includes(id);
}

function unlockedTowers() { return TOWER_ORDER.filter(isUnlocked); }
function unlockedUnits()  { return UNIT_ORDER.filter(isUnlocked);  }

// ─── 여관 ────────────────────────────────────────────────────────────────────
// 특수 용병은 캠프 보석이 아니라 런 안의 여관 레벨로 열린다.
// "이번 판에 여관을 올릴까 타워에 쓸까"가 골드 배분의 선택지가 된다.
function innLevel(gs) {
  const b = gs.town && gs.town.buildings && gs.town.buildings.inn;
  return (b && b.built) ? (b.level || 0) : -1;   // -1 = 미건설
}
// 이번 웨이브에 여관에 와 있는 특수 용병. 웨이브가 넘어갈 때 다시 뽑는다.
function availableSpecialUnits(gs) {
  if (innLevel(gs) < 0) return [];
  return (gs.innOffers || []).filter(id => SPECIAL_UNIT_TYPES[id]);
}
// 웨이브가 바뀔 때 호출 — 여관 손님을 새로 뽑는다
function refreshInnOffers(gs) {
  gs.innOffers = rollInnOffers(innLevel(gs));
  return gs.innOffers;
}
// 편성된 특수 용병 수
function specialHiredCount(battle) {
  return battle.ourTeam.filter(u => !u.isHero && (UNIT_TYPES[u.typeId] || {}).special).length;
}
// 고용 가능한 전체 목록 (일반 + 여관 특수)
function hireableUnits(gs) {
  return unlockedUnits().concat(availableSpecialUnits(gs));
}

function unlockCost(id) {
  const d = UNLOCK_DEFS.find(u => u.id === id);
  return d ? d.cost : 0;
}

function buyUnlock(id, gs) {
  const d = UNLOCK_DEFS.find(u => u.id === id);
  if (!d) return false;
  if (isUnlocked(id)) return false;
  if (gs.soulStones < d.cost) return false;
  gs.soulStones -= d.cost;
  _unlocked.push(id);
  SaveManager.save(gs);
  return true;
}

// ─── 서약 ────────────────────────────────────────────────────────────────────
function isPactOn(id) {
  return (typeof _pacts !== 'undefined') && _pacts.includes(id);
}

function togglePact(id, gs) {
  if (!PACT_DEFS.some(p => p.id === id)) return false;
  const i = _pacts.indexOf(id);
  if (i >= 0) _pacts.splice(i, 1);
  else        _pacts.push(id);
  reapplyAllBonuses(gs);
  SaveManager.save(gs);
  return true;
}

// 서약 보석 배율 — 합산 (+10%~+20%씩)
function pactGemMult() {
  let m = 1;
  for (const p of PACT_DEFS) if (isPactOn(p.id)) m += p.gem;
  return m;
}

function applyPacts() {
  for (const p of PACT_DEFS) if (isPactOn(p.id)) p.apply(BONUSES);
}

// ─── 진행도 ──────────────────────────────────────────────────────────────────
function unlockProgress() {
  const owned = UNLOCK_DEFS.filter(u => isUnlocked(u.id));
  return {
    count: owned.length,
    total: UNLOCK_DEFS.length,
    spent: owned.reduce((a, u) => a + u.cost, 0),
    totalCost: UNLOCK_TOTAL_COST
  };
}

// 트리 v2 — 노드 수가 아니라 "쌓은 레벨 수"로 진행도를 센다
function skillProgress(gs) {
  let total = 0, owned = 0, spent = 0;
  for (const treeId of SKILL_TREE_ORDER) {
    for (const s of SKILL_TREES[treeId].skills) {
      const max = skillMaxLv(s), lv = skillLevel(gs, s.id);
      total += max; owned += lv;
      for (let i = 1; i <= lv; i++) spent += skillLevelCost(s, i);
    }
  }
  return { owned, total, spent, totalCost: skillTreeTotalCost() };
}

// ─── 출격 가능 여부 ──────────────────────────────────────────────────────────
// 로비에서 병력을 고를 수는 없다 — 골드는 런 안의 화폐다.
// 출격은 언제나 가능하고, 편성은 첫 웨이브 준비 단계(마을)에서 한다.
function canSortie() { return true; }
