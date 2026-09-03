'use strict';

// ─── Canvas ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let _scale   = 1;

function getViewport() {
  // visualViewport가 있으면 사용 (모바일 브라우저 주소창 제외한 실제 높이)
  if (window.visualViewport) {
    return { w: window.visualViewport.width, h: window.visualViewport.height };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

function resize() {
  // 최소 DPR 2 강제: PC(DPR=1)에서도 2배 고해상도 렌더링으로 텍스트 선명도 확보
  const dpr = Math.max(2, window.devicePixelRatio || 1);
  const vp  = getViewport();
  // 세로를 기기 비율에 맞춰 다시 잡는다. 바뀌면 아레나 바닥을 다시 구워야 한다 —
  // 예전 높이로 구운 캔버스를 그대로 쓰면 바닥이 새 경계와 어긋난다.
  if (applyViewportHeight(vp.w, vp.h) && typeof invalidateArenaFloor === 'function')
    invalidateArenaFloor();
  const s   = Math.min(vp.w / CW, vp.h / CH);
  canvas.width  = Math.round(CW * dpr);
  canvas.height = Math.round(CH * dpr);
  canvas.style.width  = `${CW * s}px`;
  canvas.style.height = `${CH * s}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  _scale = s;
}
window.addEventListener('resize', resize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resize);
}
resize();

// ─── 타이틀 이미지 ───────────────────────────────────────────────────────────
const _titleImg = new Image();
_titleImg.src = 'assets/images/mainpage.png';

// ── 🖼 스프라이트 프리로드 ────────────────────────────────────────────────────
// 매니페스트가 비어 있으면 즉시 끝나고 로딩 화면도 뜨지 않는다.
let _assetsLoading = Sprites.total > 0 || !Sprites.ready;
Sprites.load().then(() => {
  _assetsLoading = false;
  if (Sprites.total) console.info('[스프라이트]', Sprites.report());
});
// 그림 한 장이 응답 없이 매달리면 로딩 화면에서 영영 못 빠져나온다.
// 8초가 지나면 있는 것만으로 시작한다 — 없는 그림은 어차피 이모지로 떨어진다.
setTimeout(() => {
  if (_assetsLoading) {
    _assetsLoading = false;
    console.warn('[스프라이트] 로딩이 8초를 넘겨 있는 것만으로 시작합니다', Sprites.report());
  }
}, 8000);
let _titleScreen = true;  // 앱 시작 시 타이틀 화면 표시
let _resetArmed  = false; // 리셋 버튼 1차 확인 상태
let _resetArmedAt = 0;
// 🌳 스킬 초기화도 되돌릴 수 없다 — 같은 두 번 누르기 규칙을 쓴다
let _skillResetArmed = false, _skillResetArmedAt = 0;
let _giveUpArmed = false;  // 포기 1차 확인
let _titleAlpha  = 1;     // 페이드아웃용

// ─── 세션 설정 (런 리셋과 무관) ──────────────────────────────────────────────
let _paused   = false;
let _speedIdx = 0;
// 수동 조작 중에는 2배속으로 강등되는데, 그때 플레이어가 원래 고른 배속을 기억해 둔다.
// 이게 없으면 한 번 수동을 만졌다가 자동으로 돌아와도 2배속에 갇힌다 — 실제로 그랬다.
let _speedPref = 0;
function gameSpeed() { return SPEED_STEPS[_speedIdx]; }
function togglePause() { _paused = !_paused; _giveUpArmed = false; SFX.click(); }
function cycleSpeed()  { _speedIdx = (_speedIdx + 1) % SPEED_STEPS.length; _speedPref = _speedIdx; SFX.click(); }

// ─── 영구 데이터 (런 초기화 후에도 유지) ─────────────────────────────────────
let _soulStones    = 0;
let _metaUpgrades  = {};
let _clearedStages = new Array(10).fill(false);
let _skillLevels   = {};   // 스킬 노드 id → 레벨(0~10)
let _forge         = { cores:{}, best:5, mastery:0, plus:{} };  // (옛 세이브 호환)
let _camp          = { levels:{}, tries:0, breaks:0 };          // 🔥 캠프 단련 (보석·영구)
let _cardMeta      = { levels:{}, bans:[] };                    // 🎴 패 강화 (보석·영구)
let _relics        = { owned:[], equipped:[] };                 // 🏺 보스 유물 (영구)
let _charms        = [];   // 🎴 보관 중인 일회용 부적
let _charmSlots    = [null, null];
let _ascension     = 0;    // ♾️ 승천 단계
// 👑 영웅을 어디에 세웠는지 기억한다. 층마다 배치가 풀리는데 매번 같은 곳을
// 다시 고르는 게 일이었다 — 마지막으로 고른 자리를 다음 층·다음 판에 자동으로 적용한다.
let _heroPlacePref = 'none';
// ⏭ 훈련을 건너뛰었는가. 초기화하면 함께 지워진다 —
// 훈련은 '설명'이 아니라 '진행'이므로, 초기화의 뜻을 흐리지 않는다.
// 대신 초기화 직후 캠프에 버튼이 그대로 있어서 한 번만 누르면 된다.
let _trainSkipped  = false;
let _unlocked       = [];   // 보석으로 연 타워/유닛
let _pacts          = [];   // 걸어둔 서약
let _seenMobs       = [];   // 도감
let _clearedGates   = [];   // 최초 돌파한 무한 관문 (10층 단위)
// 🌑 악몽 — 깬 최고 단계. 0 = 아직 심연 100층도 못 깼다, 1 = 심연 클리어(악몽 1단계 개방),
// 11 = 악몽 10단계까지 다 깼다(♾️ 무한 개방). '깬 것'이 아니라 '열린 것'을 센다.
let _nightmareOpen  = 0;
let _heroSigil      = DEFAULT_SIGIL;   // 👑 영웅 각인 — 캠프에서 고르는 길
let _unlockedSigils = [DEFAULT_SIGIL];  // 보석으로 연 각인
let _stats          = createStats();

// ─── 초기 상태 ────────────────────────────────────────────────────────────────
function newState() {
  return {
    wave:0,
    page:'lobby',        // 'lobby' | 'battle' | 'town' | 'result'
    inRun:false,         // 로비 밖(런 안)에 있는가
    gold:10, baseHP:BASE_HP_MAX,
    towers:[], defenseEnemies:[], projectiles:[], chargers:[], poisonPools:[],
    castleCd:0, baseWardUntil:0,
    battle: null,
    arena: createArena(),
    lobby: createLobby(),
    runSummary: null,    // 결과 화면에 보여줄 이번 런 요약
    hero: {
      level:1, exp:0,
      hp: HERO_LEVELS[1].hp,
      placement:'none',
      mp:0, activeCd:{}, skillAuto:true,   // ⚡ 액티브 스킬
      dead:false, downFor:0,   // downFor: 전사 후 결장이 남은 층 수
      defX: GRID_OX + 4*CELL_W + CELL_W/2,
      defY: GRID_OY + 3*CELL_H + CELL_H/2,
      moveX: null, moveY: null,   // 웨이브 중 지정한 이동 목표
      atkCooldown:0
    },
    town: createTown(),
    waveActive:false,
    gameOver:false, stageCleared:false, gaveUp:false,
    upgradePick: { active:false, cards:[] },
    activeUpgrades: [],
    briefScroll: 0,
    lobbyScroll: 0,     // 캠프 기록 탭 스크롤
    wallRepairs:0,      // 이번 런에서 성벽을 몇 번 보수했는지 (비용 체증)
    bossPick:'random',  // 👹 보스를 어디서 맞이할지 (준비 화면에서 고른다)
    runCardsOpen:false, // 🃏 이번 판 카드 보기 화면이 열려 있는가
    runCardsScroll:0,
    runGameSec:0,       // 이 판의 게임 내 경과 시간(초) — 배속과 무관하다
    runWallStart:0,     // 이 판을 시작한 실제 시각 — 랭킹 개연성 검사에 쓴다
    rerolls:0,          // 이번 런에서 강화 카드를 몇 번 리롤했는지 (골드 비용 체증)
    freeRerolls:0,      // 🎴패에서 산 공짜 리롤 — 층마다 다시 채워진다
    bountyUsed:0,       // 현상수배를 몇 번 불렀는지 (강해지고 보상도 오른다)
    mode:'campaign',    // 'campaign'(훈련 30웨이브) | 'endless'(심연·악몽·무한)
    nightmare:0,        // 🌑 악몽 단계 — 서약이 그만큼 강제로 붙는다 (0 = 심연)
    unbounded:false,    // ♾️ 무한 — 100층 결승선이 없다 (악몽 10단계를 깨야 열린다)
    bossDefeated:false, // 👹 마왕을 잡았는가
    runSeed:0,          // 이 판의 시드 — 층 구성·변형·지형·경로를 흔든다
    pathChanged:null,   // 직전 층에서 경로가 바뀐 결과 (준비 화면 안내용)
    floorEvent:null,    // 이 층에만 걸리는 규칙 변화
    innOffers:[],       // 이번 웨이브에 여관에 와 있는 특수 용병
    endlessGems:0,      // 무한 층에서 쌓인 보석
    endlessGemsNew:0,   // 그중 처음 닿은 깊이에서 온 몫
    endlessGemsOld:0,   // 그중 이미 돌파해 본 층에서 온 몫
    runBestAtStart:0,   // 이 판을 시작할 때의 최고 기록 — 첫 돌파 판정의 기준
    bountyPending:false,// 이번 웨이브에 소환 예약됨
    eliteUsed:0,        // 하단 정예를 몇 번 불렀는지
    elitePending:false, // 이번 웨이브에 하단 정예 예약됨
    overloadReady:0,    // 타워 과부하 재사용까지 남은 시간
    hoveredCell:null,
    selectedTowerType:'arrow',
    resultBanked:false,
    floaties:[],
    ui:{ waveBtn:{}, hireCards:[], hiredSlots:[], specialCards:[], specialSlots:[], heroDefBtn:{}, heroBatBtn:{},
         metaCards:[], skillTreeTabs:[], towerMove:null,
         lobbyTabBtns:[], unlockBtns:[], pactBtns:[], sortieBtn:{}, trainBtn:null, resultBtn:{},
         unboundedBtn:null, nightmareBtns:[],
         buildingScroll:null, pageScroll:null, briefScroll:null, lobbyScroll:null, pickScroll:null,
         pauseResumeBtn:null, pauseGiveUpBtn:null,
         backupExportBtn:null, backupImportBtn:null, backupMsg:null,
         tutReplayBtn:null, tutResetTipBtn:null, guideReplayBtn:null, campBtns:[], campGroupBtns:[], relicBtns:[], relicSellBtns:[], cardMetaBtns:[], cardCatBtns:[], cardBanBtns:[], cardBackBtn:null,
         rankSubmitBtn:null, rankBoardBtns:[], rankReloadBtn:null,
         pauseCardsBtn:null, runCardsCloseBtn:null, runCardsScroll:null, towerPromoteBtn:null,
         bossPickBtns:[], bgmToggleBtn:null, sfxToggleBtn:null,
         tutSkipBtn:null, tutBackBtn:null, sigilCards:[] },
    // 영구 데이터 참조
    get soulStones()    { return _soulStones; },
    set soulStones(v)   { _soulStones = v; },
    get metaUpgrades()  { return _metaUpgrades; },
    set metaUpgrades(v) { _metaUpgrades = v; },
    get clearedStages()  { return _clearedStages; },
    set clearedStages(v) { _clearedStages = v; },
    get skillLevels()  { return _skillLevels; },
    set skillLevels(v) { _skillLevels = v; },
    get forge()  { return _forge; },
    set forge(v) { _forge = v; },
    get camp()   { return _camp; },
    set camp(v)  { _camp = v; },
    get cardMeta()  { return _cardMeta; },
    set cardMeta(v) { _cardMeta = v; },
    get relics()  { return _relics; },
    set relics(v) { _relics = v; },
    get charms()  { return _charms; },
    set charms(v) { _charms = v; },
    get charmSlots()  { return _charmSlots; },
    set charmSlots(v) { _charmSlots = v; },
    get ascension()  { return _ascension; },
    set ascension(v) { _ascension = v; },
    get heroPlacePref()  { return _heroPlacePref; },
    set heroPlacePref(v) { _heroPlacePref = v; },
    get trainSkipped()  { return _trainSkipped; },
    set trainSkipped(v) { _trainSkipped = v; },
    get unlocked()  { return _unlocked; },
    set unlocked(v) { _unlocked = v; },
    get pacts()  { return _pacts; },
    set pacts(v) { _pacts = v; },
    get seenMobs()  { return _seenMobs; },
    set seenMobs(v) { _seenMobs = v; },
    get clearedGates()  { return _clearedGates; },
    set clearedGates(v) { _clearedGates = v; },
    get nightmareOpen()  { return _nightmareOpen; },
    set nightmareOpen(v) { _nightmareOpen = v; },
    get heroSigil()  { return _heroSigil; },
    set heroSigil(v) { _heroSigil = v; },
    get unlockedSigils()  { return _unlockedSigils; },
    set unlockedSigils(v) { _unlockedSigils = v; },
    get stats()  { return _stats; },
    set stats(v) { _stats = v; },
  };
}

let gs  = newState();
const wm  = createWaveManager();
const tut = createTutorial();
// 🧭 첫걸음 안내 — 글이 아니라 손가락. 눌러야 할 버튼을 짚고, 할 때까지 기다린다.
const guide = createGuide();

gs.battle = createBattle();

let _restoredHero = null;   // 이어하는 판의 영웅 상태 (보너스 적용 뒤에 되돌린다)

// 세이브 로드 — 영구 데이터는 항상, 런 진행은 출격 중이었을 때만 이어받는다
(function(){
  const sv = SaveManager.load();
  if (!sv) return;
  _soulStones     = sv.soulStones    || 0;
  _metaUpgrades   = sv.metaUpgrades  || {};
  _clearedStages  = sv.clearedStages || new Array(10).fill(false);
  _skillLevels    = sv.skillLevels || {};
  _forge          = sv.forge      || { cores:{}, best:5, mastery:0, plus:{} };
  _camp           = sv.camp       || { levels:{}, tries:0, breaks:0 };
  if (!_camp.levels) _camp.levels = {};
  _relics         = sv.relics     || { owned:[], equipped:[] };
  if (!Array.isArray(_relics.owned))    _relics.owned = [];
  if (!Array.isArray(_relics.equipped)) _relics.equipped = [];
  _cardMeta       = sv.cardMeta   || { levels:{}, bans:[] };
  if (!_cardMeta.levels) _cardMeta.levels = {};
  if (!Array.isArray(_cardMeta.bans)) _cardMeta.bans = [];
  _charms         = sv.charms     || [];
  _charmSlots     = sv.charmSlots || [null, null];
  _ascension      = sv.ascension  || 0;
  _heroPlacePref  = sv.heroPlacePref || 'none';
  _trainSkipped   = !!sv.trainSkipped;
  // 트리 v2 이전 세이브 — 노드 구성이 통째로 바뀌었으므로 습득분은 보석으로 환급한다
  if (!sv.skillLevels && Array.isArray(sv.skillTreeOwned) && sv.skillTreeOwned.length)
    _soulStones += sv.skillTreeOwned.length * SKILL_V1_REFUND;
  _unlocked       = sv.unlocked      || [];
  _pacts          = sv.pacts         || [];
  _seenMobs       = sv.seenMobs      || [];
  _clearedGates   = sv.clearedGates  || [];
  _nightmareOpen  = Math.max(0, Math.min(NIGHTMARE_MAX + 1, sv.nightmareOpen || 0));
  _heroSigil      = sv.heroSigil     || DEFAULT_SIGIL;
  _unlockedSigils = sv.unlockedSigils || [DEFAULT_SIGIL];
  if (!_unlockedSigils.includes(DEFAULT_SIGIL)) _unlockedSigils.push(DEFAULT_SIGIL);
  if (!sigilUnlocked(gs, _heroSigil)) _heroSigil = DEFAULT_SIGIL;
  _stats          = Object.assign(createStats(), sv.stats || {});

  if (!sv.inRun) return;   // 로비에서 종료했다면 런은 새로 시작한다

  gs.inRun      = true;
  gs.page       = 'battle';
  gs.gold       = sv.gold   || 10;
  gs.baseHP     = sv.baseHP || BASE_HP_MAX;
  gs.wave       = sv.wave   || 0;
  gs.hero.level = Math.max(1, Math.min(HERO_MAX_LEVEL, sv.heroLevel||1));
  gs.hero.exp   = sv.heroExp || 0;
  gs.hero.hp    = heroMaxHp();
  gs.battle.totalGoldEarned = sv.totalGoldEarned || 0;
  gs.wallRepairs = sv.wallRepairs || 0;
  gs.bountyUsed  = sv.bountyUsed  || 0;
  gs.eliteUsed   = sv.eliteUsed   || 0;
  gs.mode          = sv.mode === 'endless' ? 'endless' : 'campaign';
  gs.nightmare     = Math.max(0, Math.min(NIGHTMARE_MAX, sv.nightmare || 0));
  gs.unbounded     = !!sv.unbounded;
  gs.bossDefeated  = !!sv.bossDefeated;
  gs.runSeed       = sv.runSeed || 0;
  gs.endlessGems    = sv.endlessGems || 0;
  gs.endlessGemsNew = sv.endlessGemsNew || 0;
  gs.endlessGemsOld = sv.endlessGemsOld || 0;
  // 옛 세이브에는 없다 — 없으면 지금 기록을 기준으로 삼는다(이미 지나온 층은 되짚기로 친다)
  gs.runBestAtStart = sv.runBestAtStart !== undefined
                    ? sv.runBestAtStart : ((sv.stats && sv.stats.bestEndless) || 0);
  gs.rerolls     = sv.rerolls     || 0;
  gs.freeRerolls = sv.freeRerolls || 0;
  if (sv.townBuildings) {
    // v0.9.6에서 🏰성채가 생겼다. 옛 세이브에는 없으므로 기본값이 그대로 남게 둔다.
    for (const [k, v] of Object.entries(sv.townBuildings)) {
      if (gs.town.buildings[k]) gs.town.buildings[k] = v;
    }
  }
  // 보관함 — 옛 세이브(townEquipped: 장착 아이디 배열)도 받아들인다
  gs.town.gear = normalizeHeroGear(sv.townGear, sv.townEquipped);
  // ⚒️ 대장간은 판 안의 것이 됐다 — 출격 중이던 판을 이어받을 때만 복원한다
  if (sv.inRun && sv.townForge) gs.town.forge = sv.townForge;

  gs.innOffers = sv.innOffers || [];

  // 🃏 이번 판에 고른 카드 — 아래 reapplyAllBonuses가 이 배열을 읽어 효과를 다시 얹는다.
  // 정의에 없는 id(카드표가 바뀐 옛 세이브)는 버린다.
  gs.activeUpgrades = (sv.activeUpgrades || [])
    .filter(id => UPGRADE_CARDS.some(c => c.id === id));
  // 이어한 판의 시간은 이어서 센다 — 0으로 돌아가면 랭킹 개연성 검사에 걸린다
  gs.runGameSec   = sv.runGameSec || 0;
  gs.runWallStart = Date.now() - (sv.runWallMs || 0);

  // ── 판에 세워둔 것 복원 ──
  // 경로는 층에 따라 정해지므로 wm.init()이 THE_PATH를 맞춘 뒤에 타워를 올려야 하는데,
  // 반대로 타워가 먼저 있어야 경로 변경 시 이설 대상이 된다. init 전에 세운다.
  for (const t of (sv.towers || [])) {
    if (!TOWER_TYPES[t.typeId]) continue;
    if (t.col < 0 || t.col >= GRID_COLS || t.row < 0 || t.row >= GRID_ROWS) continue;
    if (gs.towers.some(x => x.col === t.col && x.row === t.row)) continue;
    const tw = makeTower(t.col, t.row, t.typeId);
    tw.level    = Math.max(1, Math.min(TOWER_MAX_LEVEL, t.level || 1));
    // ★5 분기 — 지금 정의에 없는 id면 버린다 (분기표가 바뀌어도 세이브가 안 깨지게)
    tw.branch   = branchDef(t.typeId, t.branch) ? t.branch : null;
    tw.invested = t.invested || tw.invested;
    tw.kills    = t.kills || 0;
    tw.damageDealt = t.damageDealt || 0;
    gs.towers.push(tw);
  }
  for (const u of (sv.team || [])) {
    if (!UNIT_TYPES[u.typeId]) continue;
    const unit = makeUnit(u.typeId);
    unit.hp = Math.max(1, Math.min(unit.maxHp, u.hp || unit.maxHp));
    gs.battle.ourTeam.push(unit);
  }
  // 영웅은 _applyStartBonuses()가 만피로 채우므로, 그 뒤에 되돌린다
  _restoredHero = { hp:sv.heroHp || 0, placement:sv.heroPlacement || 'none',
                    mp:sv.heroMp || 0, skillAuto:sv.heroSkillAuto !== false,
                    dead:!!sv.heroDead, downFor:sv.heroDownFor || 0 };

  refreshHeroShop(gs);
  wm.init(gs.wave);
})();

// 메타 업그레이드 및 시작 보너스 적용
reapplyAllBonuses(gs);
_applyStartBonuses();

// 이어하는 판이면 영웅 상태를 세이브 값으로 되돌린다 (만피 초기화 뒤에)
if (_restoredHero) {
  const rh = _restoredHero;
  gs.hero.dead    = rh.dead;
  gs.hero.downFor = rh.downFor;
  gs.hero.hp      = rh.dead ? 0 : Math.max(1, Math.min(heroMaxHp(), rh.hp || heroMaxHp()));
  gs.hero.mp        = Math.min(heroMaxMp(), rh.mp || 0);
  gs.hero.skillAuto = rh.skillAuto !== false;
  if (!rh.dead && (rh.placement === 'battle' || rh.placement === 'defense')) {
    gs.hero.placement = rh.placement;
    if (rh.placement === 'battle' && !gs.battle.ourTeam.some(u => u.isHero)) {
      gs.battle.ourTeam.unshift(makeHeroUnit(gs.hero));
    }
  }
  _restoredHero = null;
}

function _applyStartBonuses() {
  gs.gold     = Math.max(0, gs.gold + BONUSES.startGoldBonus);
  // 각인·스킬의 HP 배율은 보너스를 적용한 뒤에야 알 수 있다.
  // newState()는 Lv.1 기본값(80)을 넣어두므로 여기서 상한에 맞춰 채운다 — 판은 만피로 시작한다.
  gs.hero.hp  = heroMaxHp();
  gs.baseHP   = Math.max(1, Math.min(baseHpMax(), gs.baseHP + BONUSES.baseHpMax));
  gs.hero.exp = Math.min(HERO_LEVELS[gs.hero.level].expNeeded - 1, gs.hero.exp + BONUSES.heroStartExp);
  recalcMaxSlots(gs);
}

function baseHpMax()     { return Math.max(20, Math.round((BASE_HP_MAX + BONUSES.baseHpMax) * (BONUSES.pactBaseHpMult || 1))); }
function heroMaxHp()     { return Math.round((HERO_LEVELS[gs.hero.level].hp + BONUSES.heroHpFlat) * BONUSES.heroStatMult * BONUSES.sigilHeroHpMult); }

tut.start();
guide.start();

// ─── 입력 ────────────────────────────────────────────────────────────────────
function pt(e) {
  const r=canvas.getBoundingClientRect();
  const t=e.touches?e.touches[0]:e;
  return {x:(t.clientX-r.left)/_scale, y:(t.clientY-r.top)/_scale};
}

// ─── 드래그 스크롤 ───────────────────────────────────────────────────────────
// 건물 강화 목록이 한 화면을 넘으므로 끌어서 훑을 수 있어야 한다.
// 탭과 구분하려고 임계값(6px)을 넘겨야 드래그로 친다.
const DRAG_THRESHOLD = 6;
let _drag = null;      // { y0, scroll0, region }
let _didDrag = false;

function scrollRegionAt(p) {
  // 건물 상세 · 마을 탭 본문 · 전투 준비 화면이 각각 스크롤된다.
  // 강화 카드 띠(pickScroll)만 가로로 민다 — axis:'x'로 구분한다.
  for (const r of [gs.ui.pickScroll, gs.ui.buildingScroll, gs.ui.pageScroll, gs.ui.briefScroll, gs.ui.lobbyScroll]) {
    if (!r) continue;
    if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) continue;
    return r;
  }
  return null;
}
// 손가락이 처음 닿은 자리 — 스크롤 영역 밖이어도 기억한다.
// 예전에는 스크롤이 걸린 곳에서만 이동을 쟀다. 그래서 전장 위를 쓸어넘기면
// _didDrag가 서지 않은 채 손을 떼는 순간 탭으로 처리돼, 화면을 위아래로 훑을 때마다
// 영웅이 그리로 걸어가거나 타워가 과부하에 들어갔다.
let _pressAt = null;
function beginDrag(p) {
  _didDrag = false;
  _pressAt = { x: p.x, y: p.y };
  const r = scrollRegionAt(p);
  _drag = r ? { y0: p.y, x0: p.x, max: r.max, axis: r.axis === 'x' ? 'x' : 'y',
                kind: r === gs.ui.pickScroll  ? 'pick'
                    : r === gs.ui.briefScroll ? 'brief'
                    : r === gs.ui.lobbyScroll ? 'lobby' : 'town',
                scroll0: r === gs.ui.pickScroll  ? (gs.pickScroll||0)
                       : r === gs.ui.briefScroll ? (gs.briefScroll||0)
                       : r === gs.ui.lobbyScroll ? (gs.lobbyScroll||0)
                       : (gs.town.scroll||0) } : null;
}
function moveDrag(p) {
  // 어디서 시작했든 일정 거리 이상 움직였으면 그건 탭이 아니다
  if (_pressAt && !_didDrag) {
    const d = Math.abs(p.x - _pressAt.x) + Math.abs(p.y - _pressAt.y);
    if (d >= DRAG_THRESHOLD) _didDrag = true;
  }
  if (!_drag) return;
  const d = _drag.axis === 'x' ? (p.x - _drag.x0) : (p.y - _drag.y0);
  if (!_didDrag) return;
  const v = Math.max(0, Math.min(_drag.max, _drag.scroll0 - d));
  if      (_drag.kind === 'pick')  gs.pickScroll  = v;
  else if (_drag.kind === 'brief') gs.briefScroll = v;
  else if (_drag.kind === 'lobby') gs.lobbyScroll = v;
  else                             gs.town.scroll = v;
}
function endDrag() { _drag = null; _pressAt = null; }

canvas.addEventListener('mousemove', e => {
  const p=pt(e);
  gs.hoveredCell = p.y<UIBAR_Y ? screenToCell(p.x,p.y) : null;
  if (_pressAt) moveDrag(p);   // 누른 상태면 스크롤 영역 밖이어도 이동을 잰다
});
canvas.addEventListener('mouseleave', ()=>{ gs.hoveredCell=null; endDrag(); });
canvas.addEventListener('mousedown', e=>beginDrag(pt(e)));
canvas.addEventListener('mouseup',   ()=>endDrag());
canvas.addEventListener('click', e=>{ if (_didDrag) { _didDrag=false; return; } tap(pt(e)); });

canvas.addEventListener('touchstart', e=>{ e.preventDefault(); beginDrag(pt(e)); },{passive:false});
canvas.addEventListener('touchmove',  e=>{ e.preventDefault(); moveDrag(pt(e)); },{passive:false});
canvas.addEventListener('touchend',   e=>{
  e.preventDefault();
  const wasDrag = _didDrag; endDrag(); _didDrag=false;
  if (wasDrag) return;
  const t = e.changedTouches && e.changedTouches[0];
  if (t) {
    const r = canvas.getBoundingClientRect();
    tap({ x:(t.clientX-r.left)/_scale, y:(t.clientY-r.top)/_scale });
  }
},{passive:false});

// 휠은 캔버스가 아니라 **창 전체**에서 받는다.
// PC에서는 480×800 캔버스가 넓은 화면 한가운데 좁은 기둥으로 놓인다. 리스너를
// 캔버스에만 걸면 커서가 그 기둥 밖(양옆 여백)에 있을 때 휠이 아무 데도 닿지 않는다 —
// "PC에서 스크롤이 안 된다"는 보고가 이것이었다. 여백에서 굴려도 통하게,
// 캔버스 밖 좌표는 기둥 안으로 끌어당겨 읽는다.
window.addEventListener('wheel', e=>{
  const p0 = pt(e);
  const p  = { x: Math.max(0, Math.min(CW, p0.x)), y: Math.max(0, Math.min(CH, p0.y)) };
  const r = scrollRegionAt(p);
  if (!r) return;
  e.preventDefault();
  // 가로 띠는 세로 휠로도 밀리게 한다 — 마우스에 가로 휠이 없는 쪽이 흔하다
  if      (r === gs.ui.pickScroll)  gs.pickScroll  = Math.max(0, Math.min(r.max, (gs.pickScroll||0) + (e.deltaX || e.deltaY)));
  else if (r === gs.ui.briefScroll) gs.briefScroll = Math.max(0, Math.min(r.max, (gs.briefScroll||0) + e.deltaY));
  else if (r === gs.ui.lobbyScroll) gs.lobbyScroll = Math.max(0, Math.min(r.max, (gs.lobbyScroll||0) + e.deltaY));
  else                              gs.town.scroll = Math.max(0, Math.min(r.max, (gs.town.scroll||0) + e.deltaY));
},{passive:false});

// 지금 화면에서 스크롤되는 세로 영역 하나 (키보드용)
function activeScrollRegion() {
  // 카드 보기가 열려 있으면 그게 유일한 스크롤 대상이다 — 뒤 화면을 밀면 안 된다
  if (gs.runCardsOpen && gs.ui.runCardsScroll && gs.ui.runCardsScroll.max > 0)
    return gs.ui.runCardsScroll;
  for (const r of [gs.ui.buildingScroll, gs.ui.pageScroll, gs.ui.briefScroll, gs.ui.lobbyScroll])
    if (r && r.max > 0) return r;
  return null;
}
function nudgeScroll(dy) {
  const r = activeScrollRegion(); if (!r) return false;
  const v = x => Math.max(0, Math.min(r.max, x + dy));
  if      (r === gs.ui.runCardsScroll) gs.runCardsScroll = v(gs.runCardsScroll||0);
  else if (r === gs.ui.briefScroll) gs.briefScroll = v(gs.briefScroll||0);
  else if (r === gs.ui.lobbyScroll) gs.lobbyScroll = v(gs.lobbyScroll||0);
  else                              gs.town.scroll = v(gs.town.scroll||0);
  return true;
}

window.addEventListener('keydown', e => {
  if (_titleScreen) { _startFadeOut(); return; }
  if (tut.active)   { tut.next(); return; }

  // PageUp/Down · Home/End — 휠도 트랙패드도 없는 자리를 위해
  if (e.key === 'PageDown' || e.key === 'PageUp') {
    if (nudgeScroll(e.key === 'PageDown' ? 420 : -420)) { e.preventDefault(); return; }
  }
  if (e.key === 'Home' || e.key === 'End') {
    if (nudgeScroll(e.key === 'End' ? 99999 : -99999)) { e.preventDefault(); return; }
  }

  // 로비 — 탭 이동과 출격만
  if (gs.page === 'lobby') {
    const tabs = LOBBY_TABS.map(t => t.id);
    const i = tabs.indexOf(gs.lobby.tab);
    if (e.key === 'ArrowLeft')  { gs.lobby.tab = tabs[(i - 1 + tabs.length) % tabs.length]; SFX.click(); }
    if (e.key === 'ArrowRight') { gs.lobby.tab = tabs[(i + 1) % tabs.length]; SFX.click(); }
    if (e.key === ' ') { e.preventDefault(); startRun(); }
    return;
  }
  if (gs.page === 'result') {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); returnToLobby(); }
    return;
  }

  switch (e.key) {
    case '1': case '2': case '3': case '4': case '5': {
      const id = TOWER_ORDER[Number(e.key) - 1];
      if (id && isUnlocked(id)) { gs.selectedTowerType = id; gs.ui.towerAction = null; SFX.click(); }
      else if (id) { spawnFloaty('🔒 아직 해금되지 않았습니다', CW/2, UIBAR_Y-20, '#ef4444'); SFX.denied(); }
      break;
    }
    case ' ':
      e.preventDefault();
      if (wm.phase === 'idle' && gs.page === 'battle') tryStartWave();
      else togglePause();
      break;
    case 'p': case 'P': togglePause(); break;
    case 's': case 'S': cycleSpeed(); if (gs.arena.mode==='manual') clampManualSpeed(); break;
    case 'm': case 'M': SFX.toggleMute(); break;
    case 't': case 'T': gs.page = (gs.page === 'town' ? 'battle' : 'town'); SFX.click(); break;
    case 'r': case 'R': wm.retreat(gs); break;
    case 'a': case 'A':
      if (wm.phase === 'active') {
        const m = toggleArenaMode(gs);
        spawnFloaty(m === 'manual' ? '수동 모드' : '자동 모드', CW/2, ARENA_Y + 20, '#a5b4fc');
      }
      break;
    case 'ArrowUp':    case 'w': case 'W': nudgeArena(0, -28); break;
    case 'ArrowDown':  case 'x': nudgeArena(0,  28); break;
    case 'ArrowLeft':                      nudgeArena(-28, 0); break;
    case 'ArrowRight': case 'd': case 'D': nudgeArena( 28, 0); break;
    case 'Escape': gs.ui.towerAction = null; gs.ui.towerMove = null; break;
  }
});

function nudgeArena(dx, dy) {
  if (wm.phase !== 'active' || gs.page !== 'battle') return;
  if (gs.battle.phase !== 'fighting') return;
  nudgeRally(gs, dx, dy);
}

// 출전 조건 — 어디서 시작하든 같은 검사를 거친다
function canStartWave(fx, fy) {
  const px = fx !== undefined ? fx : CW/2;
  const py = fy !== undefined ? fy : BATTLE_Y+40;
  if (!gs.battle.ourTeam.length) {
    spawnFloaty('병력을 먼저 고용하세요!', px, py, '#ef4444');
    SFX.denied();
    return false;
  }
  // 영웅은 반드시 어딘가에 선다. 배치를 잊은 채 시작해 한 웨이브를 통째로
  // 손해 보는 일이 잦아서, 시작 자체를 막는다. (전사해서 부활 중이면 예외)
  if (gs.hero.placement === 'none' && !gs.hero.dead) {
    spawnFloaty('👑 영웅을 배치하세요 — 🏰마을 › 출전준비', px, py, '#fbbf24');
    SFX.denied();
    return false;
  }
  return true;
}

function tryStartWave() {
  if (!canStartWave()) return false;
  wm.startWave(gs);
  gs.waveActive = true;
  return true;
}

// 웨이브가 끝나면 아래 절반이 아레나에서 준비 화면으로 통째로 바뀐다.
// 수동 전투 중에는 바닥을 연타하고 있으므로, 바뀐 직후의 탭이 그 자리에 새로 생긴
// [마을] 버튼에 그대로 꽂힌다 — 전투 중에 갑자기 마을로 넘어가던 것이 이것이다.
// 배치가 바뀐 뒤 잠깐은 탭을 먹지 않는다.
const LAYOUT_TAP_LOCK = 0.45;   // 초
let _tapLockUntil = 0;
function lockTapsBriefly() { _tapLockUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + LAYOUT_TAP_LOCK * 1000; }
function tapsLocked() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) < _tapLockUntil; }

function tap({x,y}) {
  if (_assetsLoading) return;   // 로딩 화면에서는 아무것도 안 받는다
  if (_titleScreen) {
    SFX.unlock();
    try { BGM.play('camp'); } catch (e) {}
    // 리셋은 두 번 눌러야 실행된다 — 실수로 세이브를 날리지 않도록
    if (hitTest(x, y, gs.ui.titleResetBtn || {})) {
      if (_resetArmed && (Date.now() - _resetArmedAt < 5000)) {
        _resetArmed = false;
        resetAllProgress();
      } else {
        _resetArmed = true; _resetArmedAt = Date.now();
        SFX.denied();
      }
      return;
    }
    _resetArmed = false;
    _startFadeOut();
    return;
  }
  if (tut.active) {
    if (hitTest(x,y,gs.ui.tutSkipBtn||{})) {
      const first = tut.skip();
      if (first) {
        gs.soulStones += TUTORIAL_SKIP_GEMS;
        gs.stats.totalGems = (gs.stats.totalGems || 0) + TUTORIAL_SKIP_GEMS;
        SaveManager.save(gs);
        SFX.levelUp();
        spawnFloaty(`💎 +${TUTORIAL_SKIP_GEMS} — 안내를 건너뛰었습니다`, CW/2, CH/2, '#a78bfa');
      } else {
        SFX.click();
        spawnFloaty('안내를 모두 껐습니다', CW/2, CH/2, '#94a3b8');
      }
      return;
    }
    if (hitTest(x,y,gs.ui.tutBackBtn||{})) { tut.back(); SFX.click(); return; }
    tut.next(); SFX.click(); return;
  }

  // 🧭 안내 끄기 — 안내가 먹는 탭은 이 버튼 하나뿐이다. 나머지는 전부 통과한다.
  if (typeof guide !== 'undefined' && guide.active && hitTest(x,y,gs.ui.guideSkipBtn||{})) {
    guide.finish(); SFX.click(); return;
  }

  if (gs.page === 'lobby')  { handleLobbyTap(x,y);  return; }
  if (gs.page === 'result') { handleResultTap(x,y); return; }

  // 방금 화면 배치가 바뀌었으면 이 탭은 흘려보낸다
  if (tapsLocked()) return;

  // 훈련 완주 — 무한이 열린다
  if (gs.stageCleared && !gs.gameOver) { showResult(); return; }
  // 기지 함락 — 결과 화면으로. 스킬 트리는 로비에 있으므로 여기서 열지 않는다.
  if (gs.gameOver) { showResult(); return; }

  // 🃏 카드 보기가 열려 있으면 닫기만 받는다 — 뒤 화면이 눌리면 안 된다
  if (gs.runCardsOpen) {
    if (hitTest(x,y,gs.ui.runCardsCloseBtn||{})) { gs.runCardsOpen = false; SFX.click(); }
    return;
  }

  // 일시정지 중에는 재개 / 포기만 받는다.
  // 한 판이 10~30분이라 중간에 접어야 할 때가 있고, 초반에 망한 판을 끝까지
  // 붙들고 있을 이유도 없다. 여기까지 번 보석은 그대로 정산된다.
  if (_paused && !_titleScreen && !tut.active && gs.page!=='lobby' && gs.page!=='result') {
    if (hitTest(x,y,gs.ui.pauseGiveUpBtn||{})) {
      if (_giveUpArmed) { _giveUpArmed=false; _paused=false; gs.gaveUp=true; showResult(); }
      else { _giveUpArmed=true; SFX.denied(); }
      return;
    }
    if (hitTest(x,y,gs.ui.pauseCardsBtn||{})) {
      gs.runCardsOpen = true; gs.runCardsScroll = 0; SFX.click(); return;
    }
    if (hitTest(x,y,gs.ui.pauseResumeBtn||{})) { _giveUpArmed=false; togglePause(); return; }
    _giveUpArmed=false;
    return;
  }

  if (gs.upgradePick.active) {
    if (hitTest(x,y,gs.ui.rerollBtn||{})) {
      // 🎲 캠프에서 산 공짜 리롤을 먼저 쓴다 — 값을 치른 것을 놔두고 골드를 받으면
      // "샀는데 왜 안 쓰이지"가 된다.
      const free = (gs.freeRerolls || 0) > 0;
      const cost = free ? 0 : rerollCost(gs.rerolls);
      if (!free && gs.gold < cost) { spawnFloaty('골드 부족!',x,y,'#ef4444'); SFX.denied(); return; }
      if (free) { gs.freeRerolls--; spawnFloaty('🎲 공짜 리롤', x, y, '#4ade80'); }
      else gs.gold -= cost;
      gs.rerolls++;
      // 장수는 그대로 다시 뽑는다 — 🎲풍요(5장) 층에서 리롤했더니 3장으로
      // 줄어드는 버그가 있었다. 돈을 내고 이벤트 혜택을 잃는 셈이었다.
      gs.upgradePick.cards = rollUpgradeCards(gs.activeUpgrades,
        Math.max(cardHandSize(gs), fev('cards', 0)), gs);
      gs.pickScroll = 0;
      SFX.click();
      return;
    }
    for (const card of gs.ui.upgradeCards||[]) {
      if (hitTest(x,y,card)) { applyUpgradeCard(card.card,gs); wm.confirmPick(gs); gs.upgradePick={active:false,cards:[]}; gs.waveActive=false; return; }
    }
    return;
  }

  // 게임 컨트롤 (항상 최우선)
  if (gs.page!=='town') {
    if (hitTest(x,y,gs.ui.ctrlPause||{})) { togglePause(); return; }
    if (hitTest(x,y,gs.ui.ctrlSpeed||{})) { cycleSpeed(); if (gs.arena.mode==='manual') clampManualSpeed(); return; }
    if (hitTest(x,y,gs.ui.ctrlMute ||{})) {
      const m = SFX.toggleMute();
      if (m) BGM.stop(0.3); else BGM.sync(gs, wm);   // 음소거는 배경음도 함께 다룬다
      return;
    }
    if (hitTest(x,y,gs.ui.modeBtn||{}))   {
      const m = toggleArenaMode(gs);
      spawnFloaty(m === 'manual' ? '수동 — 아레나를 탭해 이동' : '자동 — 제자리 사수', CW/2, ARENA_Y+18, '#a5b4fc');
      return;
    }
    if (hitTest(x,y,gs.ui.retreatBtn||{})) { wm.retreat(gs); return; }
    // ⚡ 자동/수동 토글
    if (hitTest(x,y,gs.ui.heroAutoBtn||{})) {
      gs.hero.skillAuto = !(gs.hero.skillAuto !== false);
      spawnFloaty(gs.hero.skillAuto ? '🤖 스킬 자동 시전' : '👆 스킬 수동 — 직접 누르세요',
                  CW/2, ARENA_Y+18, '#a5b4fc');
      SFX.click(); SaveManager.save(gs); return;
    }
    for (const btn of gs.ui.heroActiveBtns||[]) {
      if (hitTest(x,y,btn)) {
        if (castHeroActive(gs, btn.id)) { /* 시전 성공 — 연출은 castHeroActive가 낸다 */ }
        else {
          const d = activeDef(btn.id);
          const cd = activeCdLeft(gs, btn.id);
          spawnFloaty(cd > 0 ? `재사용까지 ${Math.ceil(cd)}초`
                             : (gs.hero.mp||0) < d.mp ? `💧 MP ${d.mp} 필요` : '지금은 쓸 수 없습니다',
                      x, y, '#ef4444');
          SFX.denied();
        }
        return;
      }
    }
    if (hitTest(x,y,gs.ui.briefTownBtn||{})) { gs.page='town'; SFX.click(); return; }
  }

  // 아레나 탭 → 집결 지점 지정 (자동으로 수동 모드 전환)
  if (gs.page === 'battle' && wm.phase === 'active' && gs.battle.phase === 'fighting'
      && x >= ARENA_X && x <= ARENA_X + ARENA_W && y >= ARENA_Y && y <= ARENA_Y + ARENA_H) {
    setRally(gs, x, y);
    return;
  }

  // ── 웨이브 중 상단 개입 ──────────────────────────────────────────────────
  // 타워를 탭하면 과부하, 빈 곳을 탭하면 영웅이 그리로 이동한다.
  if (wm.phase==='active' && gs.page==='battle' && y < UIBAR_Y) {
    const cell = screenToCell(x, y);
    if (cell) {
      const tw = gs.towers.find(t => t.col===cell.c && t.row===cell.r);
      if (tw) {
        if (BONUSES.pactNoOverload) {
          spawnFloaty('📜 멈춘 시간 — 과부하 봉인됨', x, y, '#f43f5e');
          SFX.denied();
        } else if (gs.overloadReady > 0) {
          spawnFloaty(`재사용까지 ${Math.ceil(gs.overloadReady)}초`, x, y, '#64748b');
          SFX.denied();
        } else {
          tw.overloadUntil  = OVERLOAD_DURATION;
          gs.overloadReady  = OVERLOAD_COOLDOWN * fev('overloadCdMult', 1)
                            * (BONUSES.overloadCdMult || 1);
          const ctr = cellCenter(tw.col, tw.row);
          spawnFloaty('⚡ 과부하!', ctr.x, ctr.y - 18, '#fbbf24');
          FX.ring(ctr.x, ctr.y, '#fbbf24', 12);
          SFX.upgrade();
        }
        return;
      }
      // 빈 칸 → 영웅 이동 (상단에 배치돼 있을 때만)
      if (gs.hero.placement==='defense' && !gs.hero.dead) {
        const ctr = cellCenter(cell.c, cell.r);
        gs.hero.moveX = ctr.x; gs.hero.moveY = ctr.y;
        spawnFloaty('👑 이동', ctr.x, ctr.y - 14, COLORS.hero);
        return;
      }
    }
    return;
  }

  // 기지 탭 → 마을 진입 (idle 상태에서만)
  if (wm.phase==='idle' && y<UIBAR_Y) {
    const cell=screenToCell(x,y);
    if (cell && cell.c===4 && cell.r===6) { gs.page='town'; return; }
  }
  // 마을 페이지에서는 전투 화면 탭 막기
  if (gs.page==='town') { handleTownTap(x,y); return; }

  // 준비 화면의 격자는 읽기 전용이다.
  // 배치·강화·판매는 전부 🏰마을 › 타워배치에서 한다 — 준비할 곳과 확인할 곳을 갈라야
  // "여기서 지어도 되나?"를 매번 고민하지 않는다.
  if (y<UIBAR_Y && wm.phase==='idle') {
    const cell=screenToCell(x,y);
    if (!cell) return;
    const tower = gs.towers.find(t=>t.col===cell.c&&t.row===cell.r);
    if (tower) {
      const same = gs.ui.towerAction?.col===cell.c && gs.ui.towerAction?.row===cell.r;
      gs.ui.towerAction = same ? null : { col:cell.c, row:cell.r, tower, readonly:true };
      SFX.click();
    } else if (gs.hero.placement==='defense' && !gs.hero.dead) {
      // 준비 단계에서도 영웅 자리는 잡을 수 있어야 한다.
      // 웨이브가 시작된 뒤에야 옮길 수 있으면 첫 몇 초는 늘 엉뚱한 곳에 서 있다.
      const ctr = cellCenter(cell.c, cell.r);
      gs.hero.moveX = ctr.x; gs.hero.moveY = ctr.y;
      gs.hero.defX  = ctr.x; gs.hero.defY  = ctr.y;   // 준비 중이므로 즉시 이동
      gs.hero.moveX = gs.hero.moveY = null;
      spawnFloaty('👑 여기서 시작', ctr.x, ctr.y - 14, COLORS.hero);
      SFX.click();
    } else if (!isBlockedCell(cell.c, cell.r)) {
      spawnFloaty('타워 배치는 🏰마을에서', CW/2, DEFENSE_H-30, '#94a3b8');
    }
    return;
  }

  // Idle phase: wave start buttons (UIBar or battle area)
  if (wm.phase==='idle') {
    if (hitTest(x,y,gs.ui.waveBtn||{}) || hitTest(x,y,gs.ui.battleWaveStartBtn||{})) {
      tryStartWave();
      return;
    }
    // 여기서 handleTownTap을 부르던 코드가 있었다. 준비 화면에 마을 조작이 얹혀 있던 시절의
    // 잔재인데, 지금은 마을이 별도 페이지라 전투 화면 탭이 "지난번 마을 화면에 남아 있던"
    // 버튼 좌표에 맞아 마을로 튕기는 버그가 됐다 — 수동 전투 중 웨이브가 끝난 직후
    // 바닥을 계속 탭하면 갑자기 마을로 넘어가던 것이 이것이다.
    return;
  }
}

// 페이지가 바뀌면 지난 화면의 버튼 좌표를 지운다.
// gs.ui는 그리면서 채워지므로, 다른 페이지의 낡은 사각형이 남아 엉뚱한 탭을 먹는다.
// ─── 화면이 바뀌면 옛 버튼 자리를 지운다 ─────────────────────────────────────
// gs.ui.*의 사각형은 **그려질 때** 등록된다. 그리지 않은 화면의 사각형은 지난 값이
// 그대로 남아 있는데, 탭 판정은 그 값을 그대로 믿는다. 그래서 화면을 옮기면
// **보이지도 않는 버튼이 눌린다.**
//
// 실제로 그렇게 터졌다: 🌳스킬 탭에서 노드를 누르면 "🔒 심연의 마왕을 먼저
// 잡으세요"가 떴다. ⚔️출격 탭의 악몽 사다리 버튼이 같은 좌표에 남아 있었기 때문이다.
//
// 고칠 곳이 둘이었다.
//  ① 열쇠 — 예전에는 gs.page만 봤다. 로비 안에서 탭을 옮기는 것은 page가 그대로라
//     아무것도 지워지지 않았다. 이제 **실제로 보이는 화면을 특정하는 모든 것**을
//     넣는다 (로비 탭·스킬 나무·단련 무리·마을 탭·건물 화면·영웅 상세·대장간 탭·상점 탭).
//  ② 목록 — 예전에는 지울 키를 손으로 적어 두었다. 그러니 새 버튼을 만들 때마다
//     여기 적는 것을 잊었고, 실제로 deployBtn·towerTypeBtns 둘이 빠져 있었다.
//     이제 **gs.ui에 있는 것을 전부 지우고**, 화면이 바뀌어도 남아야 하는 몇 개만
//     따로 적는다. 빠뜨렸을 때의 결과가 '엉뚱한 버튼이 눌린다'에서
//     '한 프레임 늦게 눌린다'로 뒤집힌다 — 안전한 쪽으로 실패한다.
//
// 지운 자리는 그 다음 렌더가 곧바로 다시 채운다. 화면 전환 자체가 탭 처리 안에서
// 일어나고 그 뒤에 렌더가 돌므로, 잘못된 사각형이 살아 있는 순간이 없다.

// 화면이 바뀌어도 지우면 안 되는 것 — 사각형이 아니라 상태다
const _UI_KEEP = new Set([
  'towerAction',   // 고른 타워 (타워 탭 안에서만 쓰지만 렌더가 만들지 않는다)
  'towerMove',     // 이설 중인 타워
  'towerPlan',     // ◎ 배치 미리보기 — 같은 화면 안에서 이어져야 한다
  'backupMsg',     // 몇 초간 떠 있는 안내문
]);
let _lastUiScope = null;
function uiScopeKey() {
  const L = gs.lobby || {}, t = gs.town || {};
  if (gs.page === 'lobby') {
    return `lobby|${L.tab}|${L.tab === 'skill' ? (L.skillTree||'') : ''}|${L.tab === 'camp' ? ((L.campGroup||'') + (L.campGroup === 'relic'
        ? '|' + relicState(gs).equipped.join(',') + '|' + relicState(gs).owned.length : '')) : ''}|${L.tab === 'card' ? (L.cardCat||'-') : ''}`;
  }
  if (gs.page === 'town') {
    return `town|${t.screen||'main'}|${t.tab||''}|${t.heroView?'hero':''}|${t.forgeTab||''}|${t.shopTab||''}`;
  }
  return gs.page;
}
function clearStalePageUI() {
  const key = uiScopeKey();
  if (key === _lastUiScope) return;
  _lastUiScope = key;
  for (const k of Object.keys(gs.ui)) {
    if (_UI_KEEP.has(k)) continue;
    const v = gs.ui[k];
    if (Array.isArray(v)) gs.ui[k] = [];
    else if (v && typeof v === 'object') gs.ui[k] = null;
    else if (v) gs.ui[k] = null;
  }
}

// ─── 로비 ────────────────────────────────────────────────────────────────────
function handleLobbyTap(x, y) {
  const L = gs.lobby;

  for (const b of gs.ui.lobbyTabBtns || []) {
    if (hitTest(x,y,b)) {
      L.tab = b.id; gs.lobbyScroll = 0; SFX.click();
      // 📊 기록 탭에는 순위표가 들어 있다 — 열 때 한 번 읽어 온다
      if (b.id === 'record') fetchRank(rankState.board, false);
      return;
    }
  }

  // ── 출격 바 — 로비 어느 탭에서도 아래에 고정으로 그려진다 ──
  // 여기 있는 것만 탭과 무관하게 검사해도 된다. 실제로 매 프레임 그려지므로
  // 사각형이 '지난 화면의 잔재'가 될 수 없기 때문이다.
  if (hitTest(x,y,gs.ui.trainBtn||{}))  { startRun('campaign'); return; }
  if (hitTest(x,y,gs.ui.unboundedBtn||{})) { startRun('unbounded'); return; }
  if (hitTest(x,y,gs.ui.sortieBtn||{})) {
    if (!endlessUnlocked()) { startRun('campaign'); return; }
    startRun('endless', gs.lobby.nightmare || 0); return;
  }

  if (L.tab === 'sortie') {
    // 🌑 악몽 사다리 — 내려갈 단계를 고른다.
    // ⚔️출격 탭에서만 그려지므로 여기서만 검사한다. 예전에는 탭 밖에서 검사해
    // 🌳스킬 탭의 노드를 누를 때 같은 좌표의 악몽 칸이 함께 눌렸다.
    for (const b of gs.ui.nightmareBtns||[]) {
      if (!hitTest(x,y,b)) continue;
      if (!b.can) {
        const prev = b.level - 1;
        spawnFloaty(`🔒 ${prev <= 0 ? '∞ 심연' : `악몽 ${prev}단계`}의 마왕을 먼저 잡으세요`, x, y, '#f43f5e');
        SFX.denied(); return;
      }
      gs.lobby.nightmare = b.level;
      SFX.click(); return;
    }

    // 출격 탭도 스크롤된 채 그려진다
    const ry = y + (gs.lobbyScroll || 0);
    if (hitTest(x,ry,gs.ui.trainSkipBtn||{})) {
      if (skipTraining()) {
        spawnFloaty(`⏭ 훈련 건너뛰기 — 💎+${TRAIN_SKIP_GEMS}`, x, y, '#fbbf24');
        spawnFloaty('∞ 심연이 열렸습니다', CW/2, CH/2, '#a78bfa');
        SFX.levelUp();
      } else SFX.denied();
      return;
    }
    if (hitTest(x,ry,gs.ui.charmRollBtn||{})) {
      const e = rollCharm(gs);
      if (e) {
        const d = charmDef(e.charmId);
        SFX.levelUp(); SaveManager.save(gs);
        spawnFloaty(`${d.icon} ${d.name}!`, x, y, GRADE_COLOR[d.grade] || '#a78bfa');
      } else {
        SFX.denied();
        spawnFloaty(charmBag(gs).length >= CHARM_BAG_MAX ? '보관함이 가득 찼습니다'
                                                         : `💎 ${CHARM_ROLL_COST} 부족`, x, y, '#ef4444');
      }
      return;
    }
    for (const b of gs.ui.charmSlotBtns||[]) {
      if (hitTest(x,ry,b)) {   // 낀 것을 다시 누르면 뺀다
        setCharmSlot(gs, b.idx, null); SFX.click(); SaveManager.save(gs); return;
      }
    }
    for (const c of gs.ui.charmCards||[]) {
      if (hitTest(x,ry,c)) {
        const sl = charmSlots(gs);
        if (isCharmSlotted(gs, c.uid)) {          // 이미 낀 것 → 뺀다
          for (let i=0;i<sl.length;i++) if (sl[i]===c.uid) sl[i]=null;
        } else {
          let idx = sl.findIndex(v => v == null);
          if (idx < 0) idx = 0;                    // 자리가 없으면 첫 칸을 갈아 끼운다
          setCharmSlot(gs, idx, c.uid);
        }
        SFX.click(); SaveManager.save(gs); return;
      }
    }
    // 나머지(출격 버튼 등)는 아래 공통 처리로
  }

  if (L.tab === 'skill') {
    // 스킬 탭도 스크롤된 채 그려진다 — 좌표를 같은 기준으로 맞춘다
    y = y + (gs.lobbyScroll || 0);
    for (const c of gs.ui.sigilCards||[]) {
      if (hitTest(x,y,c)) {
        if (c.locked) {
          const sg = sigilDef(c.id);
          if (unlockSigil(gs, c.id)) {
            SaveManager.save(gs);
            spawnFloaty(`${sg.icon} ${sg.name} 해금!`, x, y, '#fbbf24'); SFX.upgrade();
          } else {
            spawnFloaty(`보석 부족 — 💎${SIGIL_UNLOCK_COST[c.id]} 필요`, x, y, '#ef4444'); SFX.denied();
          }
          return;
        }
        if (gs.heroSigil !== c.id) {
          gs.heroSigil = c.id;
          reapplyAllBonuses(gs);
          // 이미 편성된 영웅은 새 각인으로 다시 만든다
          if (gs.battle) {
            const i = gs.battle.ourTeam.findIndex(u => u.isHero);
            if (i >= 0) gs.battle.ourTeam[i] = makeHeroUnit(gs.hero);
          }
          SaveManager.save(gs);
          const sg = sigilDef(c.id);
          spawnFloaty(`${sg.icon} ${sg.name} 각인`, x, y, sg.color);
          SFX.upgrade();
        }
        return;
      }
    }
    if (hitTest(x,y,gs.ui.skillResetBtn||{})) {
      // 되돌릴 수 없으므로 두 번 눌러야 실행된다. 5초 안에 다시 안 누르면 풀린다.
      if (_skillResetArmed && Date.now() - _skillResetArmedAt < 5000) {
        _skillResetArmed = false;
        const back = resetSkillTree(gs);
        SaveManager.save(gs);
        spawnFloaty(`♻️ 스킬 초기화 — 💎+${back}`, x, y, '#a78bfa');
        SFX.levelUp();
      } else {
        _skillResetArmed = true; _skillResetArmedAt = Date.now();
        SFX.denied();
      }
      return;
    }
    for (const t of gs.ui.skillTreeTabs||[]) {
      if (hitTest(x,y,t)) { L.skillTree=t.id; gs.lobbyScroll=0; SFX.click(); return; }
    }
    // ×10 칩이 카드보다 먼저다 — 칩이 카드 위에 얹혀 있으므로
    for (const card of (gs.ui.metaBulkCards||[]).concat(gs.ui.metaCards||[])) {
      if (hitTest(x,y,card)) {
        let got = 0;
        const want = Math.max(1, card.bulk || 1);
        while (got < want && buySkillNode(card.skillId, gs)) got++;
        if (got) {
          SaveManager.save(gs);
          const lv = skillLevel(gs, card.skillId);
          spawnFloaty(`${card.icon} Lv${lv}!${got>1?` (+${got})`:''}`,x,y,'#a78bfa'); SFX.upgrade();
        } else {
          spawnFloaty('보석 부족 또는 잠김!',x,y,'#ef4444'); SFX.denied();
        }
        return;
      }
    }
    return;
  }

  // 🔥 단련 — 보석을 걸고 굴린다
  if (L.tab === 'camp') {
    const ry = y + (gs.lobbyScroll || 0);
    for (const g of gs.ui.campGroupBtns||[]) {
      if (hitTest(x,ry,g)) { L.campGroup = g.id; gs.lobbyScroll = 0; SFX.click(); return; }
    }
    // 🏺 유물 — 끼우기/빼기와 겹친 것 팔기
    for (const b of gs.ui.relicBtns||[]) {
      if (!hitTest(x,ry,b)) continue;
      if (toggleRelic(gs, b.id)) {
        reapplyAllBonuses(gs); SaveManager.save(gs); SFX.click();
        const d = relicDef(b.id);
        spawnFloaty(relicEquipped(gs, b.id) ? `${d.icon} ${d.name} 장착` : `${d.icon} 해제`,
                    CW/2, 300, relicEquipped(gs, b.id) ? '#fbbf24' : '#94a3b8');
      } else { spawnFloaty('칸이 찼습니다', x, y, '#ef4444'); SFX.denied(); }
      return;
    }
    for (const b of gs.ui.relicSellBtns||[]) {
      if (!hitTest(x,ry,b)) continue;
      const v = sellRelic(gs, b.id);
      if (v > 0) { SaveManager.save(gs); SFX.levelUp();
                   spawnFloaty(`💎 +${v}`, CW/2, 300, COLORS.gem); }
      else { SFX.denied(); }
      return;
    }
    for (const b of gs.ui.campBtns||[]) {
      if (!hitTest(x,ry,b)) continue;
      const r = campTemper(gs, b.id);
      if (!r) { spawnFloaty('보석 부족!',x,y,'#ef4444'); SFX.denied(); return; }
      SaveManager.save(gs);
      const tr = campTrack(b.id);
      if (r.kind === 'up') {
        spawnFloaty(`${tr.icon} +${r.after} 성공!`, CW/2, 300, '#22c55e'); SFX.levelUp();
      } else if (r.kind === 'break') {
        spawnFloaty(`💥 무너졌습니다 — +${r.before} → +${r.after}`, CW/2, 300, '#ef4444');
        FX.shake(7, 0.4); SFX.denied();
      } else if (r.kind === 'down') {
        spawnFloaty(`▼ 하락 — +${r.before} → +${r.after}`, CW/2, 300, '#f97316'); SFX.denied();
      } else {
        spawnFloaty(`실패 — +${r.after} 그대로`, CW/2, 300, '#94a3b8'); SFX.denied();
      }
      return;
    }
    return;
  }

  // 🎴 패 — 카드 선택 자체를 산다. 확정 구매라 실패 분기가 없다.
  if (L.tab === 'card') {
    const ry = y + (gs.lobbyScroll || 0);
    if (gs.ui.cardBackBtn && hitTest(x, ry, gs.ui.cardBackBtn)) {
      L.cardCat = null; gs.lobbyScroll = 0; SFX.click(); return;
    }
    for (const c of gs.ui.cardCatBtns||[]) {
      if (hitTest(x,ry,c)) { L.cardCat = c.id; gs.lobbyScroll = 0; SFX.click(); return; }
    }
    for (const b of gs.ui.cardBanBtns||[]) {
      if (!hitTest(x,ry,b)) continue;
      const card = UPGRADE_CARDS.find(c => c.id === b.id);
      if (toggleCardBan(gs, b.id)) {
        SaveManager.save(gs);
        const off = isCardBanned(gs, b.id);
        spawnFloaty(off ? `🚫 ${card.name} 제외` : `${card.name} 되돌림`,
                    CW/2, 300, off ? '#f87171' : '#94a3b8');
        SFX.click();
      } else {
        spawnFloaty(`기피 칸이 없습니다 (${cardBanSlots(gs)}칸)`, CW/2, 300, '#ef4444');
        SFX.denied();
      }
      return;
    }
    for (const b of gs.ui.cardMetaBtns||[]) {
      if (!hitTest(x,ry,b)) continue;
      if (b.id === '__banpick') {
        L.cardCat = L.cardCat || 'tower'; gs.lobbyScroll = 0; SFX.click(); return;
      }
      if (buyCardMeta(gs, b.id)) {
        SaveManager.save(gs);
        const tr = cardMetaTrack(b.id);
        spawnFloaty(`${tr.icon} ${tr.name} +${cardMetaLevel(gs, b.id)}`, CW/2, 300, '#38bdf8');
        SFX.levelUp();
      } else {
        spawnFloaty('보석 부족!', x, y, '#ef4444'); SFX.denied();
      }
      return;
    }
    return;
  }

  if (L.tab === 'pact') {
    for (const b of gs.ui.pactBtns||[]) {
      if (hitTest(x,y,b)) {
        togglePact(b.id, gs);
        spawnFloaty(isPactOn(b.id) ? '서약 체결' : '서약 해제', x, y, isPactOn(b.id) ? '#f43f5e' : '#64748b');
        SFX.click();
        return;
      }
    }
    return;
  }

  if (L.tab === 'record') {
    const ry0 = y + (gs.lobbyScroll || 0);
    for (const b of gs.ui.rankBoardBtns||[]) {
      if (hitTest(x,ry0,b)) { fetchRank(b.id, true); SFX.click(); return; }
    }
    if (hitTest(x,ry0,gs.ui.rankReloadBtn||{})) { fetchRank(rankState.board, true); SFX.click(); return; }
    // 본문은 스크롤된 채 그려지지만 버튼 좌표는 스크롤 이전 값으로 기록된다.
    // 탭 좌표를 같은 기준으로 옮겨서 견준다.
    const ry = y + (gs.lobbyScroll || 0);
    if (hitTest(x,ry,gs.ui.backupExportBtn||{})) { exportSaveCode(); return; }
    if (hitTest(x,ry,gs.ui.backupImportBtn||{})) { importSaveCode(); return; }
    if (hitTest(x,ry,gs.ui.tutReplayBtn||{}))    { replayTutorial(); return; }
    if (hitTest(x,ry,gs.ui.tutResetTipBtn||{}))  { resetTutorialTips(); return; }
    if (hitTest(x,ry,gs.ui.guideReplayBtn||{}))  { replayGuide(); return; }
    if (hitTest(x,ry,gs.ui.bgmToggleBtn||{})) { BGM.toggle(); BGM.sync(gs, wm); SFX.click(); return; }
    if (hitTest(x,ry,gs.ui.sfxToggleBtn||{})) { const m=SFX.toggleMute(); if (m) BGM.stop(0.3); else BGM.sync(gs,wm); return; }
    return;
  }

  if (L.tab === 'unlock') {
    if (hitTest(x,y,gs.ui.ascendBtn||{})) {
      const c = ascendCost(gs);
      if (buyAscend(gs)) { SaveManager.save(gs); spawnFloaty(`♾️ ${ascendLevel(gs)}단계!`,x,y,'#a78bfa'); SFX.levelUp(); }
      else { spawnFloaty(`💎 ${c - gs.soulStones} 더 필요`,x,y,'#ef4444'); SFX.denied(); }
      return;
    }
    for (const b of gs.ui.unlockBtns||[]) {
      if (hitTest(x,y,b)) {
        if (buyUnlock(b.id, gs)) { spawnFloaty(`${b.icon} 해금!`,x,y,'#f59e0b'); SFX.levelUp(); }
        else { spawnFloaty('보석이 부족합니다',x,y,'#ef4444'); SFX.denied(); }
        return;
      }
    }
    for (const b of gs.ui.pactBtns||[]) {
      if (hitTest(x,y,b)) {
        togglePact(b.id, gs);
        spawnFloaty(isPactOn(b.id) ? '서약 체결' : '서약 해제', x, y, isPactOn(b.id) ? '#f43f5e' : '#64748b');
        SFX.click();
        return;
      }
    }
  }
}

// ─── 세이브 백업 ─────────────────────────────────────────────────────────────
// 캔버스 게임이라 텍스트 입력 칸이 없다. 클립보드와 prompt로 대신한다.
function _backupMsg(text, color) { gs.ui.backupMsg = { text, color, until: Date.now() + 4000 }; }

function exportSaveCode() {
  SaveManager.save(gs);            // 지금 상태까지 담아서 내보낸다
  const code = SaveManager.exportCode();
  if (!code) { _backupMsg('내보낼 기록이 없습니다', '#ef4444'); SFX.denied(); return; }
  const done = () => { _backupMsg('\u2705 백업 코드를 클립보드에 복사했습니다', '#22c55e'); SFX.upgrade(); };
  // 클립보드가 막힌 환경(비 HTTPS 등)에서는 코드를 직접 띄워 준다
  const fallback = () => {
    _backupMsg('\u26A0 클립보드 실패 — 코드를 직접 복사하세요', '#f59e0b');
    try { window.prompt('백업 코드 (전체 선택 후 복사)', code); } catch (e) {}
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(fallback);
    } else fallback();
  } catch (e) { fallback(); }
}

function importSaveCode() {
  let code = null;
  try { code = window.prompt('백업 코드를 붙여넣으세요 (현재 기록은 덮어써집니다)', ''); }
  catch (e) { _backupMsg('이 환경에서는 붙여넣기를 열 수 없습니다', '#ef4444'); return; }
  if (code === null) return;       // 취소
  const r = SaveManager.importCode(code);
  if (!r.ok) { _backupMsg('\u274C ' + r.err, '#ef4444'); SFX.denied(); return; }
  _backupMsg('\u2705 복원 완료 — 다시 불러옵니다\u2026', '#22c55e');
  SFX.levelUp();
  // 메모리에 흩어진 전역들을 일일이 되돌리는 것보다 다시 켜는 쪽이 확실하다
  setTimeout(() => { try { location.reload(); } catch (e) {} }, 700);
}

// ─── 🏆 랭킹 등록 ────────────────────────────────────────────────────────────
// 캔버스 게임이라 텍스트 입력 수단이 prompt뿐이다 — 백업 코드 입력과 같은 방식.
function askAndSubmitRank() {
  const r = gs.runSummary;
  if (!r) return;
  let nm = null;
  try {
    nm = window.prompt('순위표에 올릴 이름 (12자까지)', rankName() || '');
  } catch (e) {
    rankSetSubmit('error', '이 환경에서는 이름을 입력할 수 없습니다', '#ef4444');
    return;
  }
  if (nm === null) return;                     // 취소
  if (!String(nm).trim()) { rankSetSubmit('error', '이름을 입력하세요', '#ef4444'); return; }
  submitRank(r, nm);
  SFX.click();
}

// ─── 데이터 초기화 ───────────────────────────────────────────────────────────
// 세이브·영구 데이터·튜토리얼 진행을 전부 지우고 처음 상태로 되돌린다.
// 페이지를 새로 고치는 대신 메모리 상태까지 직접 되돌려야 지금 화면이 옛 값을 들고 있지 않다.
function resetAllProgress() {
  try {
    SaveManager.clear();
    for (let i = 1; i <= 9; i++) localStorage.removeItem('df_tut' + i);
    clearTipMarks();
  } catch (e) {}

  _soulStones = 0;
  _metaUpgrades = {};
  _clearedStages = new Array(10).fill(false);
  _skillLevels = {};
  _forge = { cores:{}, best:5, mastery:0, plus:{} };
  _camp  = { levels:{}, tries:0, breaks:0 };
  _cardMeta = { levels:{}, bans:[] };
  _relics = { owned:[], equipped:[] };
  _charms = []; _charmSlots = [null, null]; _ascension = 0; _heroPlacePref = 'none';
  _trainSkipped = false;
  _unlocked = [];
  _heroSigil = DEFAULT_SIGIL;
  _unlockedSigils = [DEFAULT_SIGIL];
  _pacts = [];
  _seenMobs = [];
  _clearedGates = [];
  _stats = createStats();

  resetGame();               // 런 상태를 새로 만든다 (영구 데이터는 위에서 이미 비웠다)
  gs.lobby  = createLobby();
  gs.page   = 'lobby';
  gs.inRun  = false;
  gs.selectedTowerType = 'arrow';
  applyPathVariant(0);

  // 안내는 '한 번 봤으면 끝'이 초기화보다 우선한다 — df_tut_seen은 위에서 지우지 않았다
  tut.active = false; tut.step = 0;
  tut.done = tutorialEverSeen();
  _titleScreen = true; _fadingOut = false; _titleAlpha = 1;
  if (typeof SFX !== 'undefined') SFX.levelUp();
}

// 👹 마왕을 잡았다 — 연출과 뒷정리. 클리어 판정은 웨이브가 끝날 때 본다.
function markBossDefeated() {
  gs.bossDefeated = true;
  spawnFloaty('👹 마왕 처치!', CW/2, DEFENSE_H/2, '#fbbf24');
  addLog(gs.battle, '👹 마왕을 쓰러뜨렸습니다', '#fbbf24');
  if (typeof FX  !== 'undefined') FX.shake(10, 0.9);
  if (typeof SFX !== 'undefined') SFX.win();
  // 남은 호위는 함께 사라진다 — 주인이 죽었는데 정리를 더 시킬 이유가 없다
  for (const en of gs.defenseEnemies) if (!en.isBoss) en.dead = true;
  gs.chargers = [];
}

// ─── 런 시작 / 종료 ──────────────────────────────────────────────────────────
// mode: 'campaign'(훈련) | 'endless'(심연·악몽) | 'unbounded'(♾️ 무한)
// nightmare: 0 = 심연, 1~10 = 악몽 N단계. 'unbounded'에서는 무시한다.
function startRun(mode, nightmare) {
  SFX.click();
  resetGame();
  // 판마다 다른 시드 — 같은 층도 구성과 변형이 달라진다
  gs.runSeed = (Math.floor(Math.random() * 0x7FFFFFFF) | 0) || 1;
  const wantAbyss = (mode === 'endless' || mode === 'unbounded') && endlessUnlocked();
  // 곡선·층 생성은 전부 'endless' 하나로 돈다. 심연·악몽·무한의 차이는
  // 강제 서약(nightmare)과 결승선(unbounded)뿐이다 — 엔진을 갈래마다 복제하지 않는다.
  gs.mode  = wantAbyss ? 'endless' : 'campaign';
  gs.unbounded = (mode === 'unbounded') && unboundedUnlocked();
  gs.nightmare = gs.unbounded ? 0
               : Math.max(0, Math.min(NIGHTMARE_MAX,
                   nightmareAvailable(nightmare || 0) ? (nightmare || 0) : 0));
  // inRun을 여기서 켠다 — 아래 reapplyAllBonuses가 forcedPacts()를 읽는데,
  // 그게 gs.inRun을 보고 판단하기 때문이다. 예전처럼 맨 끝에서 켜면
  // 악몽 서약이 '켜진 것으로 보이지만 BONUSES에는 안 붙은' 상태가 된다.
  gs.inRun = true;
  // 판이 도는 동안 최고 기록은 계속 갱신된다. 첫 돌파를 판정하려면
  // 시작 시점의 기록을 따로 붙들고 있어야 한다.
  gs.runBestAtStart = (gs.stats && gs.stats.bestEndless) || 0;
  gs.runGameSec   = 0;
  gs.runWallStart = Date.now();
  applyPathVariant(0);
  gs.pathChanged = null;
  refreshInnOffers(gs);
  // 🎴 끼워둔 부적은 여기서 소모된다 — 판이 시작되면 사라지고 이 판에만 붙는다
  consumeCharmsForRun(gs);
  reapplyAllBonuses(gs);
  applyHeroPlacePref(gs);   // 지난 판에 세워둔 자리 그대로 시작한다
  gs.page  = 'battle';
  wm.init(0);
  if (gs.mode === 'endless') {
    if (gs.unbounded) {
      spawnFloaty('♾️ 무한 — 죽어야 끝납니다', CW/2, DEFENSE_H/2, '#fbbf24');
    } else if (gs.nightmare > 0) {
      spawnFloaty(`${nightmareName(gs.nightmare)} — 서약 ${gs.nightmare}개`,
                  CW/2, DEFENSE_H/2, nightmareColor(gs.nightmare));
    } else {
      spawnFloaty(`∞ 심연 — ${ABYSS_FINAL_FLOOR}층의 마왕까지`, CW/2, DEFENSE_H/2, '#a78bfa');
    }
  }
  SaveManager.save(gs);
}

// 훈련을 한 판 치러 봤으면 무한이 열린다 — 완주가 아니라 "한 번 해보기"다.
// 완주를 조건으로 걸면 신규 플레이어는 열지 못한다. 첫 런 도달이 11웨이브인데
// 훈련은 30웨이브라, 본편에 들어가려고 연습을 수십 번 반복하는 꼴이 된다.
// 그건 이번 개편이 없애려던 바로 그 낭비다.
function endlessUnlocked() {
  const st = gs.stats || {};
  return gs.trainSkipped ||
         (st.runs || 0) > 0 || (st.clears || 0) > 0 || (st.bestEndless || 0) > 0;
}

// ⏭ 훈련 건너뛰기 — 한 번만 값을 준다. 이미 열려 있으면 아무 일도 하지 않는다.
function skipTraining() {
  if (endlessUnlocked()) return false;
  gs.trainSkipped = true;
  gs.soulStones += TRAIN_SKIP_GEMS;
  gs.stats.totalGems = (gs.stats.totalGems || 0) + TRAIN_SKIP_GEMS;
  SaveManager.save(gs);
  return true;
}

function showResult() {
  bankRunResult();
  gs.page = 'result';
}

function handleResultTap(x, y) {
  if (hitTest(x,y,gs.ui.rankSubmitBtn||{})) { askAndSubmitRank(); return; }
  if (hitTest(x,y,gs.ui.resultBtn||{})) { returnToLobby(); return; }
}

function returnToLobby() {
  SFX.click();
  const lobbyTab = gs.lobby.tab;
  resetGame();
  gs.inRun = false;
  gs.page  = 'lobby';
  gs.lobby.tab = lobbyTab;
  SaveManager.save(gs);
}

// ─── 👑 영웅 상세 화면 ────────────────────────────────────────────────────────
// 고르기(pick)와 끼우기를 나눴다. 한 번 탭해 고르면 스탯창이 바뀔 값을 보여주고,
// 칸이나 장착 버튼을 누르면 그때 실제로 들어간다.
function handleHeroDetailTap(x,y) {
  const t = gs.town;
  if (hitTest(x,y,gs.ui.heroBackBtn||{})) { t.heroView=false; t.pick=null; t.scroll=0; SFX.click(); return; }

  // 장착/해제 버튼 — 고른 것을 그대로 처리한다
  if (t.pick && hitTest(x,y,gs.ui.heroPickBtn||{})) { applyHeroPick(x,y,null); return; }

  // 장비 칸
  for (const b of gs.ui.equipSlotBtns||[]) {
    if (!hitTest(x,y,b)) continue;
    if (t.pick && t.pick.kind==='item') { applyHeroPick(x,y,b.slot); return; }
    if (unequipGear(gs, b.slot)) { spawnFloaty('해제',x,y,'#f87171'); SFX.click(); SaveManager.save(gs); }
    return;
  }
  // 스킬 칸
  for (const b of gs.ui.skillSlotBtns||[]) {
    if (!hitTest(x,y,b)) continue;
    if (t.pick && t.pick.kind==='skill') { applyHeroPick(x,y,b.idx); return; }
    if (unequipSkill(gs, b.idx)) { spawnFloaty('해제',x,y,'#f87171'); SFX.click(); SaveManager.save(gs); }
    return;
  }
  // ⚡ 액티브 칸 / 배운 액티브 — 탭하면 끼우고, 다시 탭하면 뺀다
  for (const b of gs.ui.activeSlotBtns||[]) {
    if (!hitTest(x,y,b)) continue;
    if (!b.id) { spawnFloaty('배운 액티브를 탭하세요',x,y,'#64748b'); return; }
    const r = toggleActiveSlot(gs, b.id);
    spawnFloaty(r==='on'?'장착':'해제',x,y,r==='on'?'#38bdf8':'#f87171');
    SFX.click(); SaveManager.save(gs);
    return;
  }
  // 보관함 · 보유 스킬 — 탭하면 고른다 (같은 것을 다시 탭하면 취소)
  for (const c of gs.ui.invCards||[]) {
    if (!hitTest(x,y,c)) continue;
    t.pick = (t.pick && t.pick.kind==='item' && t.pick.uid===c.uid) ? null : {kind:'item', uid:c.uid};
    SFX.click(); return;
  }
  for (const c of gs.ui.skillCards||[]) {
    if (!hitTest(x,y,c)) continue;
    t.pick = (t.pick && t.pick.kind==='skill' && t.pick.uid===c.uid) ? null : {kind:'skill', uid:c.uid};
    SFX.click(); return;
  }
}

// 고른 것을 실제로 끼우거나 뺀다. target은 장비면 칸 id, 스킬이면 칸 번호.
function applyHeroPick(x, y, target) {
  const t = gs.town, pick = t.pick;
  if (!pick) return;
  if (pick.kind==='item') {
    if (isEquipped(gs, pick.uid)) {
      for (const sl of EQUIP_SLOTS) {
        if (heroGear(gs).equipped[sl.id]===pick.uid) { unequipGear(gs, sl.id); break; }
      }
      spawnFloaty('해제', x, y, '#f87171');
    } else if (equipGear(gs, pick.uid, target)) {
      spawnFloaty('장착!', x, y, '#4ade80');
    } else { spawnFloaty('낄 수 없는 칸입니다', x, y, '#ef4444'); SFX.denied(); return; }
  } else {
    if (isSkillEquipped(gs, pick.uid)) {
      const i = heroGear(gs).skillSlots.indexOf(pick.uid);
      unequipSkill(gs, i);
      spawnFloaty('해제', x, y, '#f87171');
    } else if (skillSlotCount(gs) <= 0) {
      spawnFloaty(`스킬 칸은 영웅 Lv.${SKILL_SLOT_LEVELS[0]}부터`, x, y, '#ef4444'); SFX.denied(); return;
    } else if (equipSkill(gs, pick.uid, target)) {
      spawnFloaty('장착!', x, y, '#4ade80');
    } else { spawnFloaty('장착 실패', x, y, '#ef4444'); SFX.denied(); return; }
  }
  t.pick = null;
  // 편성된 영웅은 새 스탯으로 다시 만든다 — 마을에서 낀 것이 판에 반영되도록
  refreshDeployedHero();
  SFX.upgrade();
  SaveManager.save(gs);
}

// 장비·스킬·각인이 바뀌면 이미 편성된 영웅 유닛도 새로 만든다
function refreshDeployedHero() {
  if (!gs.battle) return;
  const i = gs.battle.ourTeam.findIndex(u => u.isHero);
  if (i < 0) return;
  const hpRatio = gs.battle.ourTeam[i].maxHp > 0 ? gs.battle.ourTeam[i].hp / gs.battle.ourTeam[i].maxHp : 1;
  const u = makeHeroUnit(gs.hero);
  u.hp = Math.max(1, Math.round(u.maxHp * Math.min(1, hpRatio)));
  gs.battle.ourTeam[i] = u;
}

// ⚒️ 대장간 — 보석을 쓰는 세 갈래. 처리됐으면 true.
function handleForgeTap(x, y) {
  const t = gs.town;
  const say = (text, color) => { gs.ui.forgeMsg = { text, color, until: Date.now()+2600 }; };
  for (const b of gs.ui.forgeTabs||[]) {
    if (hitTest(x,y,b)) { t.forgeTab=b.id; t.scroll=0; SFX.click(); return true; }
  }
  for (const b of gs.ui.forgeGearBtns||[]) {
    if (hitTest(x,y,b)) {
      const cost = slotPlusCost(gs, b.slot);
      if (upgradeSlotPlus(gs, b.slot)) {
        SFX.upgrade(); SaveManager.save(gs);
        say(`🔨 ${slotDef(b.slot).name} +${slotPlus(gs,b.slot)}`, '#fbbf24');
      } else { SFX.denied(); say(`💎 ${cost} 부족`, '#ef4444'); }
      return true;
    }
  }
  if (hitTest(x,y,gs.ui.forgeCoreBtn||{})) {
    if (buyForgeCore(gs)) { SFX.upgrade(); SaveManager.save(gs); say('★5 심을 사들였습니다', '#60a5fa'); }
    else { SFX.denied(); say(`💎 ${FORGE_CORE_COST} 부족`, '#ef4444'); }
    return true;
  }
  for (const b of gs.ui.forgeFuseBtns||[]) {
    if (hitTest(x,y,b)) {
      const r = fuseCores(gs, b.star);
      if (!r) { SFX.denied(); say('심이 2개 필요합니다', '#ef4444'); return true; }
      SaveManager.save(gs);
      if (r.ok) { SFX.levelUp(); FX.shake(6,0.4); say(`🔥 성공! ★${r.got} 심을 얻었습니다`, '#fbbf24'); }
      else      { SFX.denied(); say(`💥 실패 — ★${r.star} 심 1개가 탔습니다`, '#ef4444'); }
      return true;
    }
  }
  if (hitTest(x,y,gs.ui.forgeTemperBtn||{})) {
    const r = temperForge(gs);
    if (!r) { SFX.denied(); say(`💎 ${temperCost(gs)} 부족`, '#ef4444'); return true; }
    SaveManager.save(gs);
    if (r.ok) { SFX.levelUp(); say(`🎲 성공! 숙련도 ${r.before} → ${r.after}`, '#22c55e'); }
    else      { SFX.denied(); FX.shake(5,0.35); say(`🎲 실패 — 숙련도 ${r.before} → ${r.after}`, '#ef4444'); }
    return true;
  }
  return false;
}

function handleTownTap(x,y) {
  const t=gs.town;

  // Back to battle page
  if (hitTest(x,y,gs.ui.townPageBackBtn||{})) { gs.page='battle'; return; }

  // 👹 보스를 어디서 맞이할지 — 출전 전에만 고를 수 있다
  {
    const ry = y + (t.scroll || 0);
    for (const b of gs.ui.bossPickBtns||[]) {
      if (hitTest(x,ry,b)) { gs.bossPick = b.id; SFX.click(); return; }
    }
  }

// Building sub-screen
  if (t.screen!=='main') {
    // Tab buttons work even inside sub-screen
    if (hitTest(x,y,gs.ui.tabTownBtn||{}))   { t.screen='main'; t.tab='town';   t.scroll=0; return; }
    if (hitTest(x,y,gs.ui.tabArmyBtn||{}))   { t.screen='main'; t.tab='army';   t.scroll=0; return; }
    if (hitTest(x,y,gs.ui.tabTowersBtn||{})) { t.screen='main'; t.tab='towers'; t.scroll=0; gs.ui.towerAction=null; gs.ui.towerMove=null; return; }
    if (hitTest(x,y,gs.ui.townBackBtn||{})) { t.screen='main'; t.scroll=0; return; }
    if (t.screen==='heroShop') {
      if (hitTest(x,y,gs.ui.shopTabBuy||{})) { t.shopTab='buy';     t.scroll=0; SFX.click(); return; }
      if (hitTest(x,y,gs.ui.shopTabUp ||{})) { t.shopTab='upgrade'; t.scroll=0; SFX.click(); return; }
      // 매대 탭일 때만 매대 버튼을 본다 — 렌더가 좌표를 지우지 못한 프레임이 있어도 안전하게
      const onBuyTab = (t.shopTab||'buy')==='buy';
      for (const btn of (onBuyTab ? gs.ui.shopItemBtns : null)||[]) {
        if (hitTest(x,y,btn)) {
          if (!buyShopItem(btn.item,gs)) { spawnFloaty('골드 부족!',x,y,'#ef4444'); SFX.denied(); }
          else { spawnFloaty(`${btn.item.icon} 구매 — 🎒보관함`,x,y,'#a78bfa'); SFX.upgrade(); SaveManager.save(gs); }
          return;
        }
      }
      for (const btn of (onBuyTab ? gs.ui.skillBuyBtns : null)||[]) {
        if (hitTest(x,y,btn)) {
          if (!buySkillOffer(gs, btn.uid)) { spawnFloaty('골드 부족!',x,y,'#ef4444'); SFX.denied(); }
          else { spawnFloaty('🔮 스킬 습득!',x,y,'#f0abfc'); SFX.upgrade(); SaveManager.save(gs); }
          return;
        }
      }
      for (const btn of (onBuyTab ? gs.ui.activeBuyBtns : null)||[]) {
        if (hitTest(x,y,btn)) {
          if (!buyActiveOffer(gs, btn.id)) { spawnFloaty('골드 부족!',x,y,'#ef4444'); SFX.denied(); }
          else {
            const d = activeDef(btn.id);
            spawnFloaty(`${d.icon} ${d.name} 습득!`,x,y,'#c4b5fd'); SFX.levelUp(); SaveManager.save(gs);
          }
          return;
        }
      }
      // 매대 탭에서는 강화 버튼이 없다 — 나머지 탭 전환만 위에서 처리된다
      if (onBuyTab) return;
    }
    if (t.screen==='forge' && handleForgeTap(x,y)) return;
    if (hitTest(x,y,gs.ui.buildingLvUpBtn||{})) {
      if (levelUpBuilding(t.screen,gs)) spawnFloaty('건물 레벨업!',x,y,'#f59e0b');
      else spawnFloaty('골드 부족!',x,y,'#ef4444');
      return;
    }
    for (const btn of gs.ui.upgradeBtns||[]) {
      if (hitTest(x,y,btn)) {
        const got = buyTownUpgradeBulk(t.screen, btn.id, gs, btn.bulk || 1);
        if (!got) spawnFloaty('골드 부족!',x,y,'#ef4444');
        else spawnFloaty(got>1?`강화 ×${got}!`:'강화 완료!',x,y,'#22c55e');
        if (got) SFX.upgrade();
        return;
      }
    }
    return;
  }

  // Tab switching
  if (hitTest(x,y,gs.ui.tabTownBtn||{})) { t.tab='town';   t.scroll=0; return; }
  if (hitTest(x,y,gs.ui.tabArmyBtn||{})) { t.tab='army';   t.scroll=0; return; }
  if (hitTest(x,y,gs.ui.tabTowersBtn||{})) { t.tab='towers'; t.scroll=0; gs.ui.towerAction=null; gs.ui.towerMove=null; return; }

  // Towers tab
  if (t.tab==='towers') {
    if (hitTest(x,y,gs.ui.towerUpgradeBtn||{})) { upgradeSelectedTower(x,y); return; }
    if (hitTest(x,y,gs.ui.towerPromoteBtn||{})) { promoteSelectedTower(x,y); return; }
    if (hitTest(x,y,gs.ui.towerMoveBtn||{}))    { beginTowerMove();          return; }
    if (hitTest(x,y,gs.ui.towerRemoveBtn||{}))  { sellSelectedTower(x,y);    return; }
    // ★5 분기 — 세 갈래 중 하나
    for (const b of gs.ui.towerBranchBtns||[]) {
      if (hitTest(x,y,b)) { chooseTowerBranch(b.branchId, x, y); return; }
    }
    // ◎ 배치 확인 — 놓을 자리를 집은 상태에서만 뜨는 두 버튼
    if (hitTest(x,y,gs.ui.planCancelBtn||{}))  { gs.ui.towerPlan=null; SFX.click(); return; }
    if (hitTest(x,y,gs.ui.planConfirmBtn||{})) { commitTowerPlan(x,y); return; }
    for (const b of gs.ui.towerTypeBtns||[]) {
      if (hitTest(x,y,b)) {
        gs.selectedTowerType=b.typeId; gs.ui.towerAction=null;
        // 종류를 바꾸면 집어둔 자리도 그 종류로 다시 본다 — 사거리가 종류마다 다르다
        if (gs.ui.towerPlan) gs.ui.towerPlan.typeId = b.typeId;
        SFX.click(); return;
      }
    }
    if (gs.ui.towerMiniGrid) {
      const mg=gs.ui.towerMiniGrid;
      if (x>=mg.x && x<mg.x+GRID_COLS*mg.cellW && y>=mg.y && y<mg.y+GRID_ROWS*mg.cellH) {
        const c=Math.floor((x-mg.x)/mg.cellW);
        const r=Math.floor((y-mg.y)/mg.cellH);
        if (c<0||c>=GRID_COLS||r<0||r>=GRID_ROWS) return;
        if (tryTowerMoveTo(c, r, x, y)) return;
        const existing=gs.towers.find(tw=>tw.col===c&&tw.row===r);
        if (existing) {
          gs.ui.towerPlan=null;
          gs.ui.towerAction=(gs.ui.towerAction?.col===c&&gs.ui.towerAction?.row===r)?null:{col:c,row:r,tower:existing};
        } else {
          if (isBlockedCell(c, r)) return;
          const pl = gs.ui.towerPlan;
          // 같은 칸을 다시 누르면 그대로 확정 — 두 번 탭이 곧 '놓고 확인'이다
          if (pl && pl.col===c && pl.row===r) { commitTowerPlan(x,y); return; }
          gs.ui.towerPlan = { col:c, row:r, typeId:gs.selectedTowerType||'arrow' };
          gs.ui.towerAction = null;
          SFX.click();
        }
        return;
      }
    }
    return;
  }

  if (t.tab==='town') {
    for (const card of gs.ui.buildingCards||[]) {
      if (hitTest(x,y,card)) {
        if (!card.built) {
          if (!buildBuilding(card.id,gs)) spawnFloaty('골드 부족!',x,y,'#ef4444');
          else spawnFloaty('건설 완료!',x,y,'#22c55e');
        } else {
          t.screen=card.id; t.scroll=0;
        }
        return;
      }
    }
    if (hitTest(x,y,gs.ui.wallRepairBtn||{})) {
      const cost = wallRepairCost(gs.wallRepairs);
      if (fev('noRepair', false)) { spawnFloaty('🩸 출혈 — 이 층에서는 보수할 수 없습니다',CW/2,300,'#ef4444'); SFX.denied(); return; }
      if (gs.baseHP >= baseHpMax()) { spawnFloaty('성벽이 이미 온전합니다',x,y,'#64748b'); SFX.denied(); return; }
      if (gs.gold < cost) { spawnFloaty('골드 부족!',x,y,'#ef4444'); SFX.denied(); return; }
      gs.gold -= cost;
      gs.wallRepairs++;
      const before = gs.baseHP;
      gs.baseHP = Math.min(baseHpMax(), gs.baseHP + WALL_REPAIR_AMOUNT);
      spawnFloaty(`🧱 성벽 +${Math.round(gs.baseHP-before)}HP`, CW/2, 300, '#22c55e');
      SFX.upgrade();
      return;
    }
  }

  if (t.tab==='army') {
    // ── 👑 영웅 상세 — 장비·스킬 ────────────────────────────────────────────
    if (t.heroView) { handleHeroDetailTap(x,y); return; }
    if (hitTest(x,y,gs.ui.heroInfoBtn||{})) { t.heroView=true; t.pick=null; t.scroll=0; SFX.click(); return; }
    if (hitTest(x,y,gs.ui.heroDefBtn||{})) {
      gs.hero.placement = gs.hero.placement==='defense' ? 'none' : 'defense';
      if (gs.hero.placement==='defense') gs.battle.ourTeam=gs.battle.ourTeam.filter(u=>!u.isHero);
      gs.heroPlacePref = gs.hero.placement;   // 다음 층·다음 판에도 여기에 선다
      SaveManager.save(gs);
      return;
    }
    if (hitTest(x,y,gs.ui.heroBatBtn||{})) {
      if (gs.hero.placement==='battle') { gs.hero.placement='none'; gs.battle.ourTeam=gs.battle.ourTeam.filter(u=>!u.isHero); }
      else { gs.hero.placement='battle'; if (!gs.battle.ourTeam.some(u=>u.isHero)) gs.battle.ourTeam.unshift(makeHeroUnit(gs.hero)); }
      gs.heroPlacePref = gs.hero.placement;
      SaveManager.save(gs);
      return;
    }
    for (const card of gs.ui.hireCards||[]) {
      if (hitTest(x,y,card)) {
        const prev=gs.gold; gs.gold=hireUnit(gs.battle,card.typeId,gs.gold);
        if (gs.gold<prev) { spawnFloaty(`+${UNIT_TYPES[card.typeId].name}`,card.x+card.w/2,card.y,'#60a5fa'); SFX.hire(); }
        else { const full=gs.battle.ourTeam.filter(u=>!u.isHero&&!(UNIT_TYPES[u.typeId]||{}).special).length>=gs.battle.maxSlots;
               spawnFloaty(full?'슬롯이 가득 참!':'골드 부족!',x,y,'#ef4444'); SFX.denied(); }
        return;
      }
    }
    // 🏨 여관 손님 — 전용 슬롯을 쓴다
    for (const card of gs.ui.specialCards||[]) {
      if (hitTest(x,y,card)) {
        const prev=gs.gold; gs.gold=hireUnit(gs.battle,card.typeId,gs.gold);
        if (gs.gold<prev) { spawnFloaty(`★ ${UNIT_TYPES[card.typeId].name} 합류!`,card.x+card.w/2,card.y,'#f472b6'); SFX.hire(); }
        else { const full=specialHiredCount(gs.battle)>=specialSlotMax();
               spawnFloaty(full?'특수 슬롯이 가득 참! — 🏨여관에서 증축':'골드 부족!',x,y,'#ef4444'); SFX.denied(); }
        return;
      }
    }
    for (const slot of gs.ui.specialSlots||[]) {
      if (hitTest(x,y,slot)) {
        const sp=gs.battle.ourTeam.filter(u=>!u.isHero&&(UNIT_TYPES[u.typeId]||{}).special);
        if (sp[slot.idx]) { const ref=fireUnit(gs.battle,gs.battle.ourTeam.indexOf(sp[slot.idx])); gs.gold+=ref; if (ref>0) { spawnFloaty(`+${ref}💰`,x,y,COLORS.gold); SFX.sell(); } }
        return;
      }
    }
    for (const slot of gs.ui.hiredSlots||[]) {
      if (hitTest(x,y,slot)) {
        const units=gs.battle.ourTeam.filter(u=>!u.isHero&&!(UNIT_TYPES[u.typeId]||{}).special);
        if (units[slot.idx]) { const ref=fireUnit(gs.battle,gs.battle.ourTeam.indexOf(units[slot.idx])); gs.gold+=ref; if (ref>0) { spawnFloaty(`+${ref}💰`,x,y,COLORS.gold); SFX.sell(); } }
        return;
      }
    }
    if (hitTest(x,y,gs.ui.deployBtn||{})) {
      if (!canStartWave(x,y)) return;
      gs.page='battle'; wm.startWave(gs); gs.waveActive=true;
      return;
    }
    // 💰 현상수배 — 마을에서만 예약한다
    if (hitTest(x,y,gs.ui.eliteBtn||{})) {
      if (gs.elitePending) {
        gs.elitePending = false;
        spawnFloaty('소환 취소', x, y, '#64748b'); SFX.click();
      } else if (gs.eliteUsed >= eliteCharges(gs.wave)) {
        spawnFloaty('남은 소환 기회가 없습니다', x, y, '#ef4444'); SFX.denied();
      } else {
        gs.elitePending = true;
        gs.eliteUsed++;
        spawnFloaty(`⚔️ ${gs.eliteUsed}번째 정예 예약`, x, y, '#fbbf24'); SFX.upgrade();
      }
      return;
    }
    if (hitTest(x,y,gs.ui.bountyBtn||{})) {
      if (gs.bountyPending) {
        gs.bountyPending = false;
        spawnFloaty('소환 취소', x, y, '#64748b'); SFX.click();
      } else if (gs.bountyUsed >= bountyCharges(gs.wave)) {
        spawnFloaty('남은 소환 기회가 없습니다', x, y, '#ef4444'); SFX.denied();
      } else {
        gs.bountyPending = true;
        gs.bountyUsed++;
        spawnFloaty(`💰 ${gs.bountyUsed}번째 현상수배 예약`, x, y, '#fbbf24'); SFX.upgrade();
      }
      return;
    }
  }
}

// ─── 타워 건설 / 강화 / 판매 ─────────────────────────────────────────────────
function buildTowerAt(c, r, fx, fy) {
  const typeId = gs.selectedTowerType || 'arrow';
  if (!isUnlocked(typeId)) { spawnFloaty('🔒 캠프에서 해금하세요', fx, fy, '#f59e0b'); SFX.denied(); return false; }
  const cost   = towerBuildCost(typeId, gs.towers);
  if (gs.gold < cost) { spawnFloaty('골드 부족!', fx, fy, '#ef4444'); SFX.denied(); return false; }
  gs.gold -= cost;
  const t = makeTower(c, r, typeId);
  t.invested = cost;
  gs.towers.push(t);
  gs.ui.towerAction = null;
  gs.ui.towerMove = null;
  spawnFloaty(`-${cost}💰`, fx, fy, COLORS.gold);
  const ctr = cellCenter(c, r);
  FX.ring(ctr.x, ctr.y, TOWER_TYPES[typeId].color, 8);
  SFX.build();
  return true;
}

// 🔥 ★5 위로는 심을 태워 한 기씩 올린다 — 심 하나에 타워 하나.
function promoteSelectedTower(x, y) {
  const ta = gs.ui.towerAction;
  if (!ta) return;
  const tower = gs.towers.find(tw => tw.col === ta.col && tw.row === ta.row);
  if (!tower) { gs.ui.towerAction = null; return; }
  const need = (tower.level || 1) + 1;
  if (!promoteTowerWithCore(gs, tower)) {
    spawnFloaty(`★${need} 심이 없습니다`, x, y, '#ef4444'); SFX.denied(); return;
  }
  spawnFloaty(`★${tower.level} 승급!`, x, y, '#fbbf24');
  const ctr = cellCenter(tower.col, tower.row);
  FX.ring(ctr.x, ctr.y, '#fbbf24', 12);
  SFX.upgrade();
  SaveManager.save(gs);
}

function upgradeSelectedTower(x, y) {
  const ta = gs.ui.towerAction;
  if (!ta) return;
  const tower = gs.towers.find(tw => tw.col === ta.col && tw.row === ta.row);
  if (!tower) { gs.ui.towerAction = null; return; }
  const cost = towerUpgradeCost(tower);
  if (cost === null) { spawnFloaty('최대 레벨!', x, y, '#f59e0b'); SFX.denied(); return; }
  if (gs.gold < cost) { spawnFloaty('골드 부족!', x, y, '#ef4444'); SFX.denied(); return; }
  gs.gold -= cost;
  tower.invested = (tower.invested || 0) + cost;
  tower.level = (tower.level || 1) + 1;
  spawnFloaty(`타워 Lv.${tower.level}!`, x, y, '#f59e0b');
  const ctr = cellCenter(tower.col, tower.row);
  FX.ring(ctr.x, ctr.y, '#22c55e', 9);
  SFX.upgrade();
}

// ─── ★5 분기 특화 ────────────────────────────────────────────────────────────
// ★5에 닿은 타워는 세 갈래 중 하나를 골라 골드로 특화한다.
// 고른 뒤에도 값을 더 내면 갈아탈 수 있다(재분기). 두 개를 동시에 갖지는 못한다 —
// 분기가 전부 트레이드오프라서 겹치면 서로를 지우고, 셋 중 하나를 고르는 것이
// 이 시스템의 전부인데 다 가질 수 있으면 그 선택이 사라지기 때문이다.
function chooseTowerBranch(branchId, x, y) {
  const ta = gs.ui.towerAction;
  if (!ta) return;
  const tower = gs.towers.find(tw => tw.col === ta.col && tw.row === ta.row);
  if (!tower) { gs.ui.towerAction = null; return; }
  const def = branchDef(tower.typeId, branchId);
  if (!def) return;
  if ((tower.level || 1) < TOWER_BRANCH_LEVEL) {
    spawnFloaty(`★${TOWER_BRANCH_LEVEL} 부터 분기할 수 있습니다`, x, y, '#f59e0b'); SFX.denied(); return;
  }
  if (tower.branch === branchId) {
    spawnFloaty('이미 그 분기입니다', x, y, '#64748b'); SFX.denied(); return;
  }
  const rebrand = !!tower.branch;
  const cost = rebrand ? towerRebranchCost(tower) : towerBranchCost(tower);
  if (gs.gold < cost) { spawnFloaty(`골드 부족! ${cost}💰`, x, y, '#ef4444'); SFX.denied(); return; }
  gs.gold -= cost;
  tower.invested = (tower.invested || 0) + cost;
  tower.branch = branchId;
  spawnFloaty(`${def.icon} ${def.name}${rebrand ? ' 재분기' : ' 특화!'}`, x, y, def.color);
  const ctr = cellCenter(tower.col, tower.row);
  FX.ring(ctr.x, ctr.y, def.color, 12);
  FX.burst(ctr.x, ctr.y, def.color, 14, 18);
  SFX.upgrade();
  SaveManager.save(gs);
}

// 집어둔 자리에 실제로 세운다. 세우고 나면 미리보기는 지운다.
function commitTowerPlan(fx, fy) {
  const pl = gs.ui.towerPlan; if (!pl) return;
  if (isBlockedCell(pl.col, pl.row)) { gs.ui.towerPlan = null; return; }
  if (gs.towers.some(t => t.col===pl.col && t.row===pl.row)) { gs.ui.towerPlan = null; return; }
  const prev = gs.selectedTowerType;
  gs.selectedTowerType = pl.typeId;          // buildTowerAt이 고른 종류를 본다
  const ok = buildTowerAt(pl.col, pl.row, fx, fy);
  gs.selectedTowerType = prev;
  if (ok) gs.ui.towerPlan = null;             // 실패(골드 부족)면 자리를 붙들어 둔다
}

// ─── 🔀 타워 이설 ────────────────────────────────────────────────────────────
// 10층마다 경로가 바뀌면 공들여 잡은 배치가 통째로 어긋난다. 그때마다 팔고 다시 짓는 건
// 회수 60% 손실에 건설비 상승까지 겹쳐서 사실상 "다시 하라"는 말이 된다.
// 빈 칸으로 옮기는 값은 투자액의 15%, 타워끼리 맞바꾸면 그 두 배다.
function beginTowerMove() {
  const ta = gs.ui.towerAction;
  if (!ta) return;
  const tower = gs.towers.find(tw => tw.col === ta.col && tw.row === ta.row);
  if (!tower) { gs.ui.towerAction = null; return; }
  gs.ui.towerMove = (gs.ui.towerMove && gs.ui.towerMove.col === ta.col && gs.ui.towerMove.row === ta.row)
                  ? null : { col: ta.col, row: ta.row };
  SFX.click();
}

// 이설 모드에서 격자 한 칸을 눌렀다. 처리했으면 true.
function tryTowerMoveTo(c, r, fx, fy) {
  const mv = gs.ui.towerMove;
  if (!mv) return false;
  const from = gs.towers.find(tw => tw.col === mv.col && tw.row === mv.row);
  if (!from) { gs.ui.towerMove = null; return false; }
  if (c === mv.col && r === mv.row) { gs.ui.towerMove = null; SFX.click(); return true; }

  const other = gs.towers.find(tw => tw.col === c && tw.row === r);
  const cost  = other ? towerSwapCost(from, other) : towerMoveCost(from);

  if (!other && isBlockedCell(c, r)) {
    spawnFloaty('여기엔 세울 수 없습니다', fx, fy, '#ef4444'); SFX.denied(); return true;
  }
  if (gs.gold < cost) {
    spawnFloaty(`골드 부족 — ${cost}💰 필요`, fx, fy, '#ef4444'); SFX.denied(); return true;
  }

  gs.gold -= cost;
  if (other) {
    other.col = mv.col; other.row = mv.row;
    from.col = c; from.row = r;
    spawnFloaty(`🔀 교환 -${cost}💰`, fx, fy, COLORS.gold);
  } else {
    from.col = c; from.row = r;
    spawnFloaty(`🔀 이동 -${cost}💰`, fx, fy, COLORS.gold);
  }
  // 옮긴 자리에서 다시 조준하도록 쿨다운만 초기화한다 (레벨·투자액·처치수는 그대로)
  from.cooldown = 0; if (other) other.cooldown = 0;
  gs.ui.towerMove   = null;
  gs.ui.towerAction = { col:c, row:r, tower:from };
  const ctr = cellCenter(c, r);
  FX.ring(ctr.x, ctr.y, '#818cf8', 9);
  SFX.build();
  return true;
}

function sellSelectedTower(x, y) {
  const ta = gs.ui.towerAction;
  if (!ta) return;
  const tower = gs.towers.find(tw => tw.col === ta.col && tw.row === ta.row);
  if (!tower) { gs.ui.towerAction = null; return; }
  const value = towerSellValue(tower);
  gs.gold += value;
  gs.towers = gs.towers.filter(tw => tw !== tower);
  gs.ui.towerAction = null;
  spawnFloaty(`+${value}💰`, x, y, COLORS.gold);
  SFX.sell();
}

// 손가락은 마우스 커서보다 굵다. 이 게임의 버튼은 세로 22px가 많은데,
// 화면 폭 412 기준으로 캔버스 1px이 0.86px이라 실제로는 19px밖에 안 된다 —
// 권장 터치 크기(48px)의 절반도 못 미친다.
// 그림은 그대로 두고 판정만 넓힌다. 작은 버튼일수록 손이 조금 빗나가도 눌리게.
// 여백은 4px로 얕게 둔다 — 세로로 붙어 있는 목록에서 옆 항목까지 먹지 않도록.
const TOUCH_PAD = 4;
function hitTest(x,y,r){
  if (!r || !r.w || !r.h) return false;
  const px = r.w < 60 ? TOUCH_PAD : 0;
  const py = r.h < 34 ? TOUCH_PAD : 0;
  return x>=r.x-px && x<=r.x+r.w+px && y>=r.y-py && y<=r.y+r.h+py;
}

function screenToCell(x,y) {
  const c=Math.floor((x-GRID_OX)/CELL_W), r=Math.floor((y-GRID_OY)/CELL_H);
  if(c<0||c>=GRID_COLS||r<0||r>=GRID_ROWS) return null;
  return {c,r};
}

// ─── 플로티 ──────────────────────────────────────────────────────────────────
function spawnFloaty(text,x,y,color) {
  gs.floaties.push({text,x,y,color,life:1.2,vy:-28});
}
function updateFloaties(dt) {
  for(let i=gs.floaties.length-1;i>=0;i--) {
    const f=gs.floaties[i]; f.life-=dt; f.y+=f.vy*dt;
    if(f.life<=0) gs.floaties.splice(i,1);
  }
}
function drawFloaties(ctx) {
  for(const f of gs.floaties) {
    ctx.globalAlpha=Math.max(0,f.life/1.2);
    ctx.fillStyle=f.color; ctx.font='bold 13px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(f.text,f.x,f.y);
  }
  ctx.globalAlpha=1;
}

// ─── 상단 처치 보상 ──────────────────────────────────────────────────────────
// 상단 골드는 한 마리에 1골드도 안 되는 경우가 많다.
// 마리마다 올림하면 축소가 통째로 무효가 되므로(실측: 23% → 14%밖에 안 줄었다)
// 소수점을 모아 두었다가 1이 넘을 때만 지급한다.
let _defGoldFrac = 0;

function onDefenseKill(e, byHero) {
  const tpl  = ENEMY_TYPES[e.typeId] || {};
  // 👹 마왕 처치는 죽는 순간에 잡는다.
  // 예전에는 wm.updateBoss가 매 프레임 배열에서 죽은 보스를 '찾아' 판정했는데,
  // 죽은 적은 그 프레임 안에서 gs.defenseEnemies에서 걸러져 나간다 —
  // 다음 프레임에는 찾을 것이 없어 클리어가 영영 안 떴다.
  if (e.isBoss && !gs.bossDefeated) markBossDefeated();
  // 👹 보스전 종료 — 상단 보스를 잡았다. 유물이 여기서 떨어진다.
  if ((e.isBoss || e.isMidBoss) && typeof bossActive === 'function' && bossActive(gs)
      && gs.boss.side === 'top') {
    grantBossReward(gs);
    endBossFight(gs, true);
  }
  // 상단은 막는 곳이지 버는 곳이 아니다 — 현상수배만 값을 그대로 받는다
  const scale = e.isBounty ? 1 : DEFENSE_GOLD_SCALE;
  _defGoldFrac += (e.reward || 1) * BONUSES.defenseGoldMult * scale;
  const gold = Math.floor(_defGoldFrac);
  _defGoldFrac -= gold;

  // 현상수배 — 잡아야만 보석이 들어온다
  if (e.gems > 0) {
    gs.soulStones += e.gems;
    gs.stats.totalGems = (gs.stats.totalGems || 0) + e.gems;
    gs.stats.bountyKills = (gs.stats.bountyKills || 0) + 1;
    spawnFloaty(`💎 +${e.gems}`, e.x, e.y - 30, '#a78bfa');
    addLog(gs.battle, `💰 현상수배 처치! 보석 +${e.gems}`, '#a78bfa');
    if (typeof FX !== 'undefined') { FX.ring(e.x, e.y, '#fbbf24', 26); FX.shake(6, 0.4); }
    SaveManager.save(gs);
  }
  gs.gold += gold;
  gs.battle.totalGoldEarned += gold;
  gs.battle.runKills = (gs.battle.runKills || 0) + 1;
  gs.stats.totalKills++;
  if (gold > 0) spawnFloaty(`+${gold}💰`, e.x, e.y - 14, COLORS.gold);
  FX.burst(e.x, e.y, tpl.color || '#fff', 12, 14);
  SFX.kill();

  grantHeroExp(tpl.reward || 2, 'defense', !!byHero, e.x, e.y);
}

// ─── 영웅 경험치 ─────────────────────────────────────────────────────────────
// 상단·하단 어느 쪽 처치든 여기로 모인다.
// 영웅이 서 있는 전선이면 많이, 반대쪽이면 소량 — 배치는 비중을 고르는 일이지
// 한쪽을 통째로 포기하는 일이 아니다.
function grantHeroExp(baseReward, side, direct, fx, fy) {
  const hero = gs.hero;
  if (hero.dead || hero.placement === 'none') return;
  const home = (hero.placement === side);
  const rate = home ? (direct ? HERO_EXP_DIRECT : HERO_EXP_ASSIST) : HERO_EXP_AWAY;
  const exp  = (baseReward || 0) * rate * BONUSES.heroExpMult;
  if (exp <= 0) return;
  heroGainExp(exp);
  // 소수점짜리까지 띄우면 화면이 숫자로 뒤덮인다 — 눈에 띄는 것만 알린다
  if (exp >= 1 && home) {
    const x = (fx !== undefined) ? fx : CW / 2;
    const y = (fy !== undefined) ? fy : DEFENSE_H / 2;
    spawnFloaty(`EXP+${Math.floor(exp)}`, x, y - 22, '#f59e0b');
  }
}

// ─── 🏰 최후 저지선 ──────────────────────────────────────────────────────────
// 성채가 직접 쏜다. 강화를 사지 않으면 castleAtk가 0이라 여기서 바로 빠진다.
// 사거리가 짧아 마지막 한두 칸에서만 닿는다 — 방어선이 아니라 최후의 보루다.
function updateCastleGuns(dt) {
  const atk = castleAtk();
  if (atk <= 0) return;
  gs.castleCd = Math.max(0, (gs.castleCd || 0) - dt);
  if (gs.castleCd > 0) return;
  const base = cellCenter(4, 6);
  const best = pickTarget(gs.defenseEnemies, base, castleRange(), 'nearest');
  if (!best) return;
  gs.castleCd = 1 / Math.max(0.05, castleSpd());
  hurtDefenseEnemy(best, atk, false, e => onDefenseKill(e, false), 1, BONUSES.towerPierce || 0);
  gs.projectiles.push({
    x: base.x, y: base.y, tx: best.x, ty: best.y,
    target: best, dmg: 0, color: '#facc15', spd: 480, visual: true
  });
  if (typeof SFX !== 'undefined') SFX.shoot();
}

// ─── 영웅 방어 구역 전투 ─────────────────────────────────────────────────────
function updateHeroDefense(dt) {
  const hero = gs.hero;
  if (hero.placement !== 'defense' || hero.dead) return;
  // 🌀 추방 — 기믹이 걸린 동안 영웅은 전투에서 빠진다. 상단의 핵심 화력이
  // 10초 사라지므로 그 사이를 타워만으로 버텨야 한다.
  if (typeof bossEffect === 'function' && bossEffect(gs, 'nohero')) return;
  const lv = HERO_LEVELS[hero.level];

  // 지정한 지점으로 이동 — 상단에도 포지셔닝이 생긴다
  if (hero.moveX !== null && hero.moveY !== null) {
    const dx = hero.moveX - hero.defX, dy = hero.moveY - hero.defY;
    const d  = Math.hypot(dx, dy);
    if (d < 3) { hero.moveX = hero.moveY = null; }
    else {
      const step = Math.min(d, HERO_DEF_MOVE_SPD * dt);
      hero.defX += dx / d * step;
      hero.defY += dy / d * step;
    }
  }

  // 공격
  hero.atkCooldown = Math.max(0, hero.atkCooldown - dt);
  if (hero.atkCooldown <= 0) {
    const best = pickTarget(gs.defenseEnemies, { x: hero.defX, y: hero.defY }, lv.range, 'nearest');
    if (best) {
      hero.atkCooldown = 1.0;
      const atk = Math.round((lv.atk + BONUSES.heroAtk) * BONUSES.heroStatMult);
      const hAff = HERO_AFFINITY[best.cls || 'medium'] || 1;
      hurtDefenseEnemy(best, atk, false, e => onDefenseKill(e, true), hAff);
      gs.projectiles.push({
        x: hero.defX, y: hero.defY, tx: best.x, ty: best.y,
        target: best, dmg: 0, color: '#f59e0b', spd: 420, visual: true
      });
      SFX.shoot();
    }
  }

  // 근접한 적의 반격 — 영웅도 죽을 수 있다.
  //
  // 예전에는 "1초마다, 반경 안의 모든 적의 공격력 합"을 통째로 맞았다.
  // 경로 한가운데 서면 지나가는 무리 전체가 매 초 다시 계산되므로,
  // 30마리짜리 웨이브에서는 영웅이 몇 초 만에 녹았다 — 서 있을 이유가 없어진다.
  //
  // 이제 적 하나는 **한 번 지나갈 때 한 대만** 친다. 사거리 밖으로 나갔다가
  // 다시 들어오면 그때 또 한 대다. 대신 부딪히는 동안 그 적은 느려진다 —
  // 영웅을 경로에 세우는 것이 "몸으로 막는" 선택이 되도록.
  const touchR = CELL_W * 0.75;
  let incoming = 0, touched = 0;
  for (const e of gs.defenseEnemies) {
    if (e.dead || e.reached) continue;
    const near = Math.hypot(e.x - hero.defX, e.y - hero.defY) < touchR;
    if (!near) { e._heroHit = false; continue; }
    touched++;
    // 몸으로 막는다 — 영웅과 겹친 동안 이동이 느려진다
    e.heroBlockUntil = HERO_BLOCK_SLOW_DUR;
    if (e._heroHit) continue;          // 이번 통과에서 이미 한 대 쳤다
    e._heroHit = true;
    incoming += e.dmg;
  }
  if (incoming > 0) {
    const def  = Math.round(lv.def * BONUSES.heroStatMult);
    const real = Math.max(1, incoming - def);
    hero.hp -= real;
    spawnFloaty(`-${real}`, hero.defX, hero.defY - 18, '#ef4444');
    FX.burst(hero.defX, hero.defY, '#ef4444', 5, 10);
    if (hero.hp <= 0) { killHero(gs); return; }
  }
  hero.blocking = touched;
}

// 기억해둔 자리에 영웅을 다시 세운다. 층이 넘어갈 때와 부활할 때 부른다.
// 전사 중이거나 기억이 없으면 아무 일도 하지 않는다.
function applyHeroPlacePref(state) {
  const hero = state.hero;
  if (!hero || hero.dead) return;
  const pref = state.heroPlacePref || 'none';
  if (pref !== 'defense' && pref !== 'battle') return;
  hero.placement = pref;
  if (pref === 'battle') {
    if (!state.battle.ourTeam.some(u => u.isHero)) state.battle.ourTeam.unshift(makeHeroUnit(hero));
  } else {
    state.battle.ourTeam = state.battle.ourTeam.filter(u => !u.isHero);
  }
}

function killHero(state) {
  const hero = state.hero;
  if (hero.dead) return;
  hero.dead = true;
  hero.hp = 0;
  hero.placement = 'none';
  hero.moveX = hero.moveY = null;
  // 이 층은 이미 끝났고, 결장할 층이 몇 개 더 남았는지를 센다.
  // 불사(스킬·두루마리)는 결장 없이 이 층이 끝나면 바로 돌아온다.
  hero.downFor = BONUSES.heroInstantRevive ? 0 : HERO_DOWN_FLOORS;
  state.battle.ourTeam = state.battle.ourTeam.filter(u => !u.isHero);
  const msg = hero.downFor > 0
    ? `👑 영웅 전사! — 다음 ${hero.downFor}개 층 결장`
    : '👑 영웅 전사! — 이 층이 끝나면 복귀';
  spawnFloaty(msg, CW/2, DEFENSE_H/2, '#ef4444');
  addLog(state.battle, msg, '#ef4444');
  FX.shake(7, 0.4);
  SFX.lose();
}

// 영웅이 돌아올 때 채워지는 HP 비율 — 🕊️ 구원의 손으로 올린다
function heroReturnHpPct() {
  return Math.min(1, HERO_RETURN_HP + (BONUSES.heroReviveReduction || 0) * HERO_RETURN_HP_PER);
}

// 층이 끝날 때마다 한 칸씩 센다. 다 세면 만피가 아니라 일부만 채우고 돌아온다.
function tickHeroDown(state) {
  const hero = state.hero;
  if (!hero.dead) return;
  if ((hero.downFor || 0) > 0) {
    hero.downFor--;
    return;
  }
  hero.dead = false;
  hero.hp = Math.max(1, Math.round(heroMaxHp() * heroReturnHpPct()));
  hero.placement = 'none';
  applyHeroPlacePref(state);   // 마지막으로 고른 자리에 그대로 복귀시킨다
  spawnFloaty(`👑 영웅 복귀 — HP ${Math.round(heroReturnHpPct()*100)}%`, CW/2, DEFENSE_H/2, '#22c55e');
  addLog(state.battle, '👑 영웅이 돌아왔습니다', '#22c55e');
  SFX.levelUp();
}

function heroGainExp(amount) {
  const hero = gs.hero;
  hero.exp += amount;
  while (hero.level < HERO_MAX_LEVEL && hero.exp >= HERO_LEVELS[hero.level].expNeeded) {
    hero.exp -= HERO_LEVELS[hero.level].expNeeded;
    hero.level++;
    hero.hp = heroMaxHp();
    spawnFloaty(`영웅 레벨업! Lv.${hero.level}`, CW/2, DEFENSE_H/2, '#f59e0b');
    addLog(gs.battle, `👑 영웅이 Lv.${hero.level}로 성장!`, COLORS.hero);
    FX.ring(CW/2, DEFENSE_H/2, COLORS.hero, 18);
    SFX.levelUp();
  }
}

// ─── 타이틀 페이드아웃 ───────────────────────────────────────────────────────
let _fadingOut = false;
function _startFadeOut() {
  if (_fadingOut) return;
  _fadingOut = true;
}

// ─── 업데이트 ─────────────────────────────────────────────────────────────────
function update(dt) {
  // 타이틀 페이드아웃
  if (_fadingOut) {
    _titleAlpha = Math.max(0, _titleAlpha - dt * 1.8);
    if (_titleAlpha <= 0) { _titleScreen = false; _fadingOut = false; }
    return;
  }
  if (_titleScreen) return;

  FX.update(dt);
  updateFloaties(dt);

  // 로비 · 결과 화면에서는 런이 진행되지 않는다
  if (gs.page === 'lobby' || gs.page === 'result') return;

  // 게임 내 경과 시간. 배속은 update(dt)를 여러 번 부르므로 여기서 더하면
  // 저절로 '게임 시간'이 된다 — 10배속으로 돌려도 한 층은 60초다.
  if (gs.inRun) gs.runGameSec = (gs.runGameSec || 0) + dt;

  if (gs.gameOver || gs.stageCleared) { bankRunResult(); return; }
  if (gs.upgradePick.active) return;

  updateBattleFx(gs.battle, dt);

  // 성문으로 달려드는 무리는 웨이브가 끝나도 끝까지 간다.
  // 조기 반환 뒤에 두면 웨이브가 먼저 끝났을 때 화면 위에 얼어붙는다.
  updateChargers(dt);

  if (!gs.waveActive) { wm.updateIntermission(gs,dt); return; }

  wm.update(gs,dt);

  // 상단 방어
  updateDefenseEnemies(gs.defenseEnemies,dt);
  for (const e of gs.defenseEnemies) {
    if (e.reached&&!e._counted) {
      e._counted=true;
      // 👹 보스가 정해진 바퀴를 다 돌고 성에 닿았다 — 막지 못했으므로 거기서 끝난다.
      // 성벽을 조금 깎고 넘어가는 적과는 다르다.
      if ((e.isBoss || e.isMidBoss) && typeof bossActive === 'function' && bossActive(gs)
          && gs.boss.side === 'top') {
        endBossFight(gs, false);
        gs.baseHP = 0; gs.gameOver = true;
        addLog(gs.battle, '💀 보스가 성문을 부쉈습니다', '#ef4444');
        if (typeof SFX !== 'undefined') SFX.lose();
        bankRunResult();
        return;
      }
      const dmg = Math.max(1, Math.round(e.dmg * baseDamageMult()));
      gs.baseHP=Math.max(0,gs.baseHP-dmg);
      spawnFloaty(`-${dmg}HP`,CW/2,DEFENSE_H-25,'#ef4444');
      if (e.isBounty) addLog(gs.battle, `💰 현상수배를 놓쳤습니다 — 성벽 -${dmg}HP`, '#ef4444');
      FX.shake(Math.min(8, 2 + dmg * 0.2), 0.3);
      SFX.baseHit();
      if (gs.baseHP<=0) { gs.gameOver=true; bankRunResult(); return; }
    }
  }

  // 기지 재생
  if (BONUSES.baseRegen > 0) {
    gs.baseHP = Math.min(baseHpMax(), gs.baseHP + BONUSES.baseRegen * dt);
  }

  if (gs.overloadReady > 0) gs.overloadReady = Math.max(0, gs.overloadReady - dt);
  updateTowers(gs.towers,gs.defenseEnemies,gs.projectiles,dt);
  updateProjectiles(gs.projectiles, e => onDefenseKill(e, false), dt);
  updatePoisonPools(gs.defenseEnemies, e => onDefenseKill(e, false), dt);
  updateCastleGuns(dt);
  updateHeroActives(gs, dt);
  gs.defenseEnemies=gs.defenseEnemies.filter(e=>!e.dead&&!e.reached);

  updateHeroDefense(dt);
  updateBreakthrough(dt);

  if (wm.phase==='intermission') gs.waveActive=false;
}

// ─── 돌파: 아군 전멸 시 남은 몬스터가 기지를 때린다 ──────────────────────────
let _breachAccum = 0;
// ─── 🐗 성문으로 달려드는 무리 ───────────────────────────────────────────────
// 하단을 비웠을 때 남은 것들이 기지로 달려간다. 타워는 이들을 잡지 못한다 —
// 잡을 수 있으면 하단을 버리고 상단만 키우는 쪽이 정답이 되어 버린다.
// 이건 막을 수 있는 적이 아니라, 이미 치른 값을 눈으로 보여주는 연출이다.
// 달려든 값의 소수점 나머지. 한 마리씩 반올림하면 값이 통째로 증발한다 —
// 아래 설명 참고. 웨이브를 넘어 이어지므로 모듈 스코프에 둔다.
let _chargeFrac = 0;

function updateChargers(dt) {
  const list = gs.chargers;
  if (!list || !list.length) return;
  const base = cellCenter(4, 6);
  for (const c of list) {
    if (c.dead) continue;
    if (c.delay > 0) { c.delay -= dt; continue; }
    const dx = base.x - c.x, dy = base.y - c.y;
    const d  = Math.hypot(dx, dy);
    if (d < 10) {
      c.dead = true;
      // 🌵 가시 방벽 — 성벽에 닿는 순간 확률로 통째로 튕겨낸다
      if ((BONUSES.chargeBlock || 0) > 0 && Math.random() < Math.min(0.75, BONUSES.chargeBlock)) {
        spawnFloaty('🌵 막아냈다!', base.x, base.y - 16, '#84cc16');
        FX.burst(base.x, base.y, '#84cc16', 7, 11);
        if (typeof SFX !== 'undefined') SFX.denied();
        continue;
      }
      // ── 값을 소수점째 모은다 ────────────────────────────────────────────
      // 예전에는 `Math.round(c.dmg * baseDamageMult())`로 **한 마리씩** 반올림했다.
      // 전멸 비용은 마릿수로 쪼개져 오는데(38을 18기로 나누면 한 기당 2),
      // 거기에 피해 감소가 곱해지면 2×0.2=0.4 → 반올림 0이 된다.
      // 열여덟 마리가 전부 0이 되어 **전멸 대가가 통째로 사라졌다** —
      // "몹이 성으로 박는데 데미지가 안 들어온다"는 보고가 정확히 이것이다.
      // 게다가 아레나에 몹이 많을수록(=더 크게 진 판일수록) 더 잘게 쪼개져
      // 손해가 줄었다. 이제 나머지를 모아 두었다가 1이 차면 함께 넣는다.
      _chargeFrac += c.dmg * baseDamageMult();
      const dmg = Math.floor(_chargeFrac);
      _chargeFrac -= dmg;
      if (dmg > 0) {
        gs.baseHP = Math.max(0, gs.baseHP - dmg);
        spawnFloaty(`-${dmg}HP`, base.x, base.y - 16, '#ef4444');
        FX.shake(Math.min(7, 2 + dmg * 0.3), 0.22);
        FX.burst(base.x, base.y, '#ef4444', 8, 10);
        SFX.baseHit();
        if (gs.baseHP <= 0) { gs.gameOver = true; bankRunResult(); return; }
      } else {
        // 값이 0으로 떨어졌어도 **아무 일도 안 일어난 것처럼 보이면 안 된다.**
        // 막아낸 것인지 버그인지 플레이어가 구분할 수 없기 때문이다.
        FX.burst(base.x, base.y, '#64748b', 4, 7);
        if ((gs.baseWardUntil || 0) > 0) spawnFloaty('🧱 결계', base.x, base.y - 16, '#38bdf8');
      }
      continue;
    }
    const step = CHARGE_SPEED * dt;
    c.x += dx / d * step; c.y += dy / d * step;
  }
  gs.chargers = list.filter(c => !c.dead);
}

function updateBreakthrough(dt) {
  const b = gs.battle;
  if (b.phase !== 'idle_defeated' && b.phase !== 'lost') { _breachAccum = 0; return; }

  const live = gs.arena.mobs.filter(e => !e.dead);
  if (!live.length) { _breachAccum = 0; return; }

  const atkSum = live.reduce((a, e) => a + e.atk, 0);
  const dps    = Math.min(atkSum * BREAKTHROUGH_DPS, breakthroughCap(wm.waveIndex));
  _breachAccum += dps * dt * baseDamageMult();

  if (_breachAccum >= 1) {
    const dmg = Math.floor(_breachAccum);
    _breachAccum -= dmg;
    gs.baseHP = Math.max(0, gs.baseHP - dmg);
    spawnFloaty(`돌파! -${dmg}HP`, CW/2, DEFENSE_H - 40, '#ef4444');
    FX.shake(4, 0.2);
    if (gs.baseHP <= 0) { gs.gameOver = true; bankRunResult(); }
  }
}

// ─── 런 종료 정산 ────────────────────────────────────────────────────────────
function bankRunResult() {
  if (gs.resultBanked) return;
  gs.resultBanked = true;

  const endless  = gs.mode === 'endless';
  const reached  = gs.wave + (gs.stageCleared ? 1 : 0);
  // 무한에서 기록은 "도달 층"이다 — 마지막으로 발을 디딘 층까지 쳐준다
  const tier     = endless ? Math.max(1, gs.wave + 1) : 0;
  const bd       = soulStoneBreakdown(gs);
  const wasBest  = endless ? (tier > (gs.stats.bestEndless || 0))
                           : (reached > (gs.stats.bestWave || 0));

  _soulStones += bd.total;
  gs.lastSoulEarned = bd.total;
  gs.stats.runs++;
  if (endless) gs.stats.bestEndless = Math.max(gs.stats.bestEndless || 0, tier);
  else         gs.stats.bestWave    = Math.max(gs.stats.bestWave || 0, reached);
  gs.stats.totalGold += gs.battle.totalGoldEarned;
  gs.stats.totalGems  = (gs.stats.totalGems || 0) + bd.total;

  gs.runSummary = {
    endless,
    cleared:  !!gs.stageCleared,
    endlessTier: tier,
    reached,
    stageLabel: endless ? `${tier}층` : getStageInfo(gs.wave).stageLabel,
    kills:    gs.battle.runKills || 0,
    gold:     gs.battle.totalGoldEarned,
    baseHP:   Math.ceil(gs.baseHP),
    gems:     bd.total,
    rows:     bd.rows,
    mult:     bd.mult,
    gaveUp:   !!gs.gaveUp,
    newBest:  wasBest,
    // 🌑 악몽 — 어느 갈래였고, 마왕을 잡았고, 다음 문이 열렸는가
    nightmare:   gs.nightmare || 0,
    unbounded:   !!gs.unbounded,
    bossDown:    !!gs.bossDefeated,
    clearGems:   gs.clearBonusGems || 0,
    // 🏆 랭킹 — 개연성 검사에 쓰는 두 시간. 게임시간은 배속과 무관하고,
    // 실시간은 "최대 10배속이므로 이보다 짧을 수 없다"를 따지는 데 쓴다.
    gameSec:     Math.round(gs.runGameSec || 0),
    wallSec:     gs.runWallStart ? Math.round((Date.now() - gs.runWallStart) / 1000) : 0,
    nextOpen:    (gs.bossDefeated && !gs.unbounded)
                 ? ((gs.nightmare || 0) + 1 <= NIGHTMARE_MAX
                     ? nightmareName((gs.nightmare || 0) + 1) : '♾️ 무한')
                 : null
  };

  gs.inRun = false;
  SaveManager.save(gs);
}

// ─── 렌더 루프 ────────────────────────────────────────────────────────────────
let _last=0;
// 한 프레임에서 예외가 나면 requestAnimationFrame 재등록까지 못 가고 게임이 통째로 멈춘다.
// 실제로 마을 건물 카드가 없어진 필드를 참조하다 그렇게 얼어붙은 적이 있다.
// 그리기/시뮬레이션 오류 하나가 판을 끝내지 않도록 프레임을 감싸고, 원인은 한 번만 알린다.
let _loopErrShown = false;
function loop(ts) {
  try {
    frame(ts);
  } catch (err) {
    if (!_loopErrShown) {
      _loopErrShown = true;
      console.error('[frame]', err);
      try { spawnFloaty('⚠ 화면 오류 — 계속 진행합니다', CW/2, CH/2, '#f87171'); } catch (e) {}
    }
  }
  requestAnimationFrame(loop);
}

function frame(ts) {
  // 탭이 뒤로 갔다 오면 ts가 크게 튄다. 음수·NaN도 막는다 —
  // 한 번이라도 NaN dt가 흘러들면 그 뒤 모든 타이머가 NaN이 된다.
  let dt = (ts - _last) / 1000;
  if (!(dt > 0)) dt = 0;
  if (dt > 0.05) dt = 0.05;
  _last = ts;
  ctx.clearRect(0,0,CW,CH);
  if (_assetsLoading && !Sprites.ready) { renderLoadingScreen(ctx, Sprites.progress); return; }
  _assetsLoading = false;
  clearStalePageUI();

  const [shx, shy] = FX.shakeOffset();
  ctx.save();
  ctx.translate(shx, shy);
  if (gs.page==='lobby') {
    renderLobby(ctx,gs);
  } else if (gs.page==='result') {
    renderResult(ctx,gs);
  } else if (gs.page==='town') {
    renderTownPage(ctx,gs);
  } else if (typeof bossActive === 'function' && bossActive(gs)) {
    // 👹 보스전 — 한쪽 전선만 쓴다. 안 쓰는 쪽은 아예 그리지 않고,
    // 쓰는 쪽이 화면 세로를 다 가져간다. 반씩 보다가 보스를 놓치지 않게.
    renderBossLane(ctx, gs);
    FX.draw(ctx);
  } else {
    renderDefense(ctx,gs);
    renderUIBar(ctx,gs,wm);
    renderBattle(ctx,gs);
    FX.draw(ctx);
  }
  ctx.restore();
  if (typeof bossActive === 'function' && bossActive(gs)
      && gs.page!=='lobby' && gs.page!=='result' && gs.page!=='town') {
    renderBossHud(ctx, gs);
  }

  // 런 종료·갈림길 오버레이 — 전투/마을 위에 덮는다.
  // (로비 개편 때 이 호출이 빠져 게임오버 화면이 보이지 않았다)
  if (gs.page!=='lobby' && gs.page!=='result') renderHUD(ctx,gs);
  if (gs.upgradePick.active && gs.page==='battle') renderUpgradePick(ctx,gs);
  drawFloaties(ctx);
  if (_paused && !_titleScreen && !tut.active && gs.page!=='lobby' && gs.page!=='result') {
    renderPauseOverlay(ctx);
    // 🃏 카드 보기는 일시정지 위에 얹는다 — 판을 멈춘 채로 훑어보는 화면이다
    if (gs.runCardsOpen) renderRunCardsOverlay(ctx);
  } else if (gs.runCardsOpen) {
    gs.runCardsOpen = false;      // 일시정지가 풀렸으면 같이 닫는다
  }
  renderTutorial(ctx,tut);
  // 안내는 튜토리얼 글이 떠 있지 않을 때만 — 둘이 겹치면 무엇을 보라는지 알 수 없다
  if (!tut.active) renderGuide(ctx,gs);
  if (_titleScreen || _fadingOut) renderTitleScreen(ctx, _titleAlpha);
  // 배경음 — 화면과 상황에 맞는 곡으로. 같은 곡이면 아무 일도 하지 않는다.
  if (!_titleScreen) { try { BGM.sync(gs, wm); } catch (e) {} }
  // 🧭 시킨 일을 해냈는지 매 프레임 본다. 확인 버튼이 없으므로 이게 유일한 진행 수단이다.
  if (!_titleScreen && !tut.active) { try { guide.update(gs, dt); } catch (e) {} }

  if ((_paused || tut.active) && !_titleScreen && !_fadingOut) {
    FX.update(dt); updateFloaties(dt);
  } else {
    // 로비/결과는 시뮬레이션이 없으므로 배속을 적용하지 않는다
    const steps = (_titleScreen || _fadingOut || gs.page==='lobby' || gs.page==='result') ? 1 : gameSpeed();
    for (let i = 0; i < steps; i++) update(dt);
  }
}

// ─── 런 리셋 ─────────────────────────────────────────────────────────────────
// 로비로 돌아가거나 새 런을 시작할 때 호출한다. 영구 데이터는 전역이므로 남는다.
function resetGame() {
  const lobby = gs.lobby;
  gs = newState();
  gs.battle = createBattle();
  gs.lobby  = lobby;
  gs.town   = createTown();
  FX.clear();
  _paused   = false;
  _giveUpArmed = false;
  _breachAccum = 0;
  _defGoldFrac = 0;
  _chargeFrac  = 0;
  // 잠긴 타워가 선택돼 있으면 화살탑으로 되돌린다
  if (!isUnlocked(gs.selectedTowerType)) gs.selectedTowerType = 'arrow';
  refreshHeroShop(gs);
  reapplyAllBonuses(gs);
  _applyStartBonuses();
  wm.init(0);
}

// ─── 자동 저장 ───────────────────────────────────────────────────────────────
// 웨이브가 끝날 때만 저장하고 있었다. 한 층이 60초인데 그 사이에 산 타워·용병·건물이
// 앱을 강제 종료하면 통째로 사라졌다 — 모바일에서는 홈 버튼 한 번이면 그렇게 된다.
// 주기적으로, 그리고 화면이 가려지는 순간에 반드시 한 번 더 쓴다.
// ─── 📖 안내 다시 보기 ────────────────────────────────────────────────────────
function replayTutorial() {
  // df_tut_seen은 일부러 그대로 둔다 — 자동 진입은 영영 막고, 여기서만 다시 본다
  try { localStorage.removeItem('df_tut9'); } catch (e) {}
  tut.done = false; tut.tip = null; tut.step = 0; tut.active = true;
  SFX.click();
}
// 🧭 첫걸음 안내를 다시 — 로비 첫 단계부터 시작하므로 로비로 보내 준다
function replayGuide() {
  guide.reset();
  gs.page = 'lobby'; gs.lobby.tab = 'sortie';
  SFX.click();
}
function resetTutorialTips() {
  clearTipMarks();
  SFX.upgrade();
  gs.ui.backupMsg = { text:'\uD83D\uDD01 상황별 쪽지를 다시 보게 됩니다', color:'#22c55e', until: Date.now()+2600 };
}

function autoSave() {
  if (!gs || !gs.inRun || _titleScreen) return;
  try { SaveManager.save(gs); } catch (e) {}
}
setInterval(autoSave, 10000);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoSave(); });
window.addEventListener('pagehide', autoSave);
window.addEventListener('blur', autoSave);

// ─── 시작 ────────────────────────────────────────────────────────────────────
requestAnimationFrame(ts=>{ _last=ts; requestAnimationFrame(loop); });
