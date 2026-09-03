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
  { id:'camp',   label:'단련', icon:'🔥', color:'#fb923c' },
  // 🎴 패 — 카드 선택은 한 판에서 30번 넘게 돌아오는 결정이다. 단련 안에 한 줄로
  // 끼워 넣으면 그 무게가 보이지 않아서, 단독 탭으로 뺐다.
  { id:'card',   label:'패',   icon:'🎴', color:'#38bdf8' },
  { id:'unlock', label:'해금', icon:'🔓', color:'#f59e0b' },
  { id:'pact',   label:'서약', icon:'📜', color:'#f43f5e' },
  { id:'record', label:'기록', icon:'📊', color:'#60a5fa' },
];


// ─── 🏅 업적 ──────────────────────────────────────────────────────────────────
// 판이 끝날 때마다 숫자는 쌓이는데 그 숫자를 봐 주는 곳이 없었다. 기록 탭은
// "지금까지 몇 마리 잡았다"를 적을 뿐, 그게 많은 건지 적은 건지는 안 알려준다.
// 업적은 그 숫자에 **눈금을 붙이는 일**이다 — 50마리가 첫 칸이고 20만이 끝 칸이라는
// 것을 알면 같은 숫자가 다르게 읽힌다.
//
// 보상은 보석으로 준다. 다만 한 번만 받는다 — 받은 것은 claimed에 적어 둔다.
// 업적을 위해 따로 플레이하게 만들지는 않는다. 이미 하는 일에 이름을 붙일 뿐이다.
//
// 값은 전부 **이미 쌓고 있던 통계**에서 읽는다. 새로 세는 것을 만들지 않은 것은,
// 세는 곳이 늘면 세는 곳마다 어긋날 자리가 생기기 때문이다.
const ACHIEVEMENTS = [
  // ── 깊이 ──
  { id:'depth10',  icon:'🪜', name:'첫 하강',     desc:'10층 도달',        gem:5,
    cat:'depth', goal:10,     val:g => g.stats.bestEndless || 0 },
  { id:'depth30',  icon:'⛰️', name:'중반의 벽',   desc:'30층 도달',        gem:15,
    cat:'depth', goal:30,     val:g => g.stats.bestEndless || 0 },
  { id:'depth50',  icon:'🌋', name:'심층',        desc:'50층 도달',        gem:40,
    cat:'depth', goal:50,     val:g => g.stats.bestEndless || 0 },
  { id:'depth100', icon:'👹', name:'마왕 격파',   desc:'100층 도달',       gem:120,
    cat:'depth', goal:100,    val:g => g.stats.bestEndless || 0 },

  // ── 처치 ──
  { id:'kill1k',   icon:'⚔️', name:'토벌대',      desc:'누적 1,000 처치',  gem:10,
    cat:'kill',  goal:1000,   val:g => g.stats.totalKills || 0 },
  { id:'kill20k',  icon:'💀', name:'학살자',      desc:'누적 20,000 처치', gem:35,
    cat:'kill',  goal:20000,  val:g => g.stats.totalKills || 0 },
  { id:'kill200k', icon:'☠️', name:'심연의 청소부',desc:'누적 200,000 처치',gem:100,
    cat:'kill',  goal:200000, val:g => g.stats.totalKills || 0 },
  { id:'bounty25', icon:'💰', name:'현상금 사냥꾼',desc:'현상수배 25마리',  gem:25,
    cat:'kill',  goal:25,     val:g => g.stats.bountyKills || 0 },
  { id:'elite100', icon:'🔥', name:'정예 사냥',   desc:'소환 정예 100마리', gem:30,
    cat:'kill',  goal:100,    val:g => g.stats.eliteKills || 0 },

  // ── 수집 ──
  { id:'mobdex',   icon:'📖', name:'몬스터 도감', desc:'아레나 몹 전부 만나기', gem:30,
    cat:'collect', goal:() => Object.keys(BATTLE_MOB_TYPES).length,
    val:g => (g.seenMobs || []).length },
  { id:'relic5',   icon:'🏺', name:'수집가',      desc:'유물 5종 획득',     gem:40,
    cat:'collect', goal:5,
    val:g => new Set((g.relics && g.relics.owned) || []).size },
  { id:'relicall', icon:'✨', name:'유물 완성',   desc:'유물 전부 획득',    gem:120,
    cat:'collect', goal:() => (typeof RELICS !== 'undefined' ? RELICS.length : 9),
    val:g => new Set((g.relics && g.relics.owned) || []).size },
  { id:'unlockall',icon:'🔓', name:'전부 해금',   desc:'해금 목록 전부',    gem:60,
    cat:'collect', goal:() => UNLOCK_DEFS.length,
    val:g => UNLOCK_DEFS.filter(u => isUnlocked(u.id)).length },

  // ── 도전 ──
  { id:'nm1',      icon:'🌑', name:'악몽의 문',   desc:'악몽 1단계 돌파',  gem:30,
    cat:'trial', goal:1,      val:g => g.stats.bestNightmare || 0 },
  { id:'nm5',      icon:'🌘', name:'깊은 악몽',   desc:'악몽 5단계 돌파',  gem:80,
    cat:'trial', goal:5,      val:g => g.stats.bestNightmare || 0 },
  { id:'nm10',     icon:'♾️', name:'무한의 문',   desc:'악몽 10단계 돌파', gem:200,
    cat:'trial', goal:10,     val:g => g.stats.bestNightmare || 0 },
  { id:'runs50',   icon:'🎲', name:'끈질김',      desc:'50판 플레이',      gem:20,
    cat:'trial', goal:50,     val:g => g.stats.runs || 0 },
  { id:'gems5k',   icon:'💎', name:'광부',        desc:'누적 보석 5,000',  gem:50,
    cat:'trial', goal:5000,   val:g => g.stats.totalGems || 0 },
];
const ACH_CATS = [
  { id:'depth',   icon:'🪜', name:'깊이' },
  { id:'kill',    icon:'⚔️', name:'처치' },
  { id:'collect', icon:'📖', name:'수집' },
  { id:'trial',   icon:'🌑', name:'도전' },
];

function achDef(id) { return ACHIEVEMENTS.find(a => a.id === id) || null; }
function achState(gs) {
  if (!gs.achievements) gs.achievements = { claimed: [] };
  if (!Array.isArray(gs.achievements.claimed)) gs.achievements.claimed = [];
  return gs.achievements;
}
function achGoal(a) { return typeof a.goal === 'function' ? a.goal() : a.goal; }
function achValue(gs, a) {
  try { return Math.max(0, a.val(gs) || 0); } catch (e) { return 0; }
}
function achDone(gs, a)    { return achValue(gs, a) >= achGoal(a); }
function achClaimed(gs, a) { return achState(gs).claimed.includes(a.id); }
// 받을 수 있는데 아직 안 받은 것 — 탭에 뱃지로 띄운다
function achClaimable(gs)  { return ACHIEVEMENTS.filter(a => achDone(gs, a) && !achClaimed(gs, a)); }

function claimAch(gs, id) {
  const a = achDef(id);
  if (!a || !achDone(gs, a) || achClaimed(gs, a)) return 0;
  achState(gs).claimed.push(id);
  gs.soulStones = (gs.soulStones || 0) + a.gem;
  gs.stats.totalGems = (gs.stats.totalGems || 0) + a.gem;
  return a.gem;
}
// 받을 수 있는 것을 한꺼번에
function claimAllAch(gs) {
  let n = 0, gem = 0;
  for (const a of achClaimable(gs)) { const v = claimAch(gs, a.id); if (v) { n++; gem += v; } }
  return { n, gem };
}

function createLobby() {
  return {
    tab: 'sortie',
    campGroup: 'tower',   // 🔥 단련 — 지금 펼친 무리
    cardCat: null,        // 🎴 패 — 기피 목록에서 지금 펼친 분류 (null이면 트랙 화면)
    skillTree: 'tower',   // 스킬 탭 안의 계열
    nightmare: 0,         // 🌑 고른 악몽 단계 (0 = 심연)
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

// ─── 🌑 악몽 ─────────────────────────────────────────────────────────────────
// _nightmareOpen은 '열린 데까지'를 센다.
//   0  = 심연 100층을 아직 못 깼다 → 심연만 가능
//   1  = 심연 클리어 → 악몽 1단계 개방
//   N  = 악몽 N-1단계까지 깼다 → 악몽 N단계 개방
//   11 = 악몽 10단계까지 깼다 → ♾️ 무한 개방
function nightmareOpenLevel() {
  return (typeof _nightmareOpen !== 'undefined') ? _nightmareOpen : 0;
}
// 이 단계를 지금 고를 수 있는가 (0 = 심연은 언제나)
function nightmareAvailable(level) {
  return level <= 0 || level <= nightmareOpenLevel();
}
function unboundedUnlocked() { return nightmareOpenLevel() > NIGHTMARE_MAX; }
// 한 갈래를 깼다 — 다음 문이 열린다. 새로 열렸으면 true.
function markNightmareCleared(level) {
  const want = Math.max(0, Math.min(NIGHTMARE_MAX, level || 0)) + 1;
  if (want <= nightmareOpenLevel()) return false;
  _nightmareOpen = want;
  return true;
}

// 심연·악몽 한 갈래를 끝냈다 — 문을 열고 보상을 준다
function clearAbyssRun(gsp) {
  const lv = gsp.nightmare || 0;
  const opened = markNightmareCleared(lv);
  // 클리어 보상 — 단계가 오를수록 크다. 처음 깬 판에만 준다.
  if (opened) {
    const bonus = NIGHTMARE_CLEAR_GEMS + lv * NIGHTMARE_CLEAR_GEMS_STEP;
    gsp.soulStones += bonus;
    gsp.stats.totalGems = (gsp.stats.totalGems || 0) + bonus;
    gsp.clearBonusGems = bonus;
  } else {
    gsp.clearBonusGems = 0;
  }
  gsp.stats.bestNightmare = Math.max(gsp.stats.bestNightmare || 0, lv);
  return opened;
}

// ─── 서약 ────────────────────────────────────────────────────────────────────
// 악몽 단계가 걸려 있으면 그 사다리의 서약이 강제로 켜진다.
// 플레이어가 캠프에서 직접 건 서약과 합쳐진다 — 악몽 위에 더 걸 수는 있어도 뺄 수는 없다.
// ♾️ 무한은 **모든 악몽보다 어려워야 한다.** 예전에는 nightmare=0이라 강제 서약이
// 하나도 안 붙었고, 결승선만 없앤 악몽 0단계 — 즉 악몽 1단계보다도 쉬웠다.
// 무한은 악몽 10의 서약 전부를 그대로 지고 간다. 캠프에서 자원해 건 서약은
// 그 위에 더 얹힌다 (togglePact가 막지 않는 한).
function forcedPacts() {
  const gsp = (typeof gs !== 'undefined' && gs) ? gs : null;
  if (!gsp || !gsp.inRun) return [];
  if (gsp.unbounded) return nightmarePacts(NIGHTMARE_MAX);
  return nightmarePacts(gsp.nightmare || 0);
}
function isPactForced(id) { return forcedPacts().includes(id); }
function isPactOn(id) {
  if (isPactForced(id)) return true;
  return (typeof _pacts !== 'undefined') && _pacts.includes(id);
}

function togglePact(id, gs) {
  if (!PACT_DEFS.some(p => p.id === id)) return false;
  if (isPactForced(id)) return false;   // 악몽이 건 것은 뺄 수 없다
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

// ─── ♾️ 승천 ─────────────────────────────────────────────────────────────────
// 끝이 있는 사용처는 결국 다 채워진다. 해금 52, 스킬 4126, 대장간도 언젠가 끝난다.
// 그런데 층당 보석은 계속 들어온다 — 그래서 절대 끝나지 않는 사용처가 하나 필요하다.
// 값이 12%씩 붙으므로 아무리 벌어도 앞서가지 못한다. 저축이 계속 의미를 갖는다.
const ASCEND_BASE = 25;
const ASCEND_MULT = 1.12;
const ASCEND_DMG  = 0.012;   // 단계당 타워·아군 공격력 +1.2%
const ASCEND_HP   = 0.010;   // 단계당 기지·아군 HP +1.0%

function ascendLevel(gs) { return (gs && gs.ascension) || 0; }
function ascendCost(gs)  { return Math.round(ASCEND_BASE * Math.pow(ASCEND_MULT, ascendLevel(gs))); }
function buyAscend(gs) {
  const c = ascendCost(gs);
  if ((gs.soulStones || 0) < c) return false;
  gs.soulStones -= c;
  gs.ascension = ascendLevel(gs) + 1;
  reapplyAllBonuses(gs);
  return true;
}
function applyAscend(gs) {
  const n = ascendLevel(gs);
  if (n <= 0) return;
  BONUSES.towerDmgMult *= 1 + n * ASCEND_DMG;
  BONUSES.unitAtkMult  *= 1 + n * ASCEND_DMG;
  BONUSES.unitHpMult   *= 1 + n * ASCEND_HP;
  BONUSES.baseHpMax    += Math.round(BASE_HP_MAX * n * ASCEND_HP);
}
