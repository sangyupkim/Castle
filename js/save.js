'use strict';

// v8 — 무한이 본편이 되면서 mode · clearedGates · bestEndless가 추가됐다.
// v7 — 로비 도입으로 unlocked · pacts · seenMobs가 추가됐다.
// 구 세이브(v6)는 전투 모델이 통째로 바뀌어 이어 쓸 수 없으므로 폐기한다.
const SAVE_KEY = 'dualfrontier_v8';

function createStats() {
  return { runs:0, bestWave:0, bestStage:0, bestEndless:0, clears:0,
           totalKills:0, totalGold:0, totalGems:0, wavesCleared:0 };
}

const SaveManager = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  },

  save(gs) {
    const data = {
      // ── 런 진행 (출격 중일 때만 의미가 있다) ──
      inRun:      !!gs.inRun,
      wave:       gs.wave,
      gold:       gs.gold,
      baseHP:     gs.baseHP,
      heroLevel:  gs.hero.level,
      heroExp:    gs.hero.exp,
      caveLevel:  gs.caveLevel,
      wallRepairs: gs.wallRepairs || 0,
      bountyUsed:  gs.bountyUsed || 0,
      eliteUsed:   gs.eliteUsed  || 0,
      mode:       gs.mode || 'campaign',
      runSeed:    gs.runSeed || 0,
      endlessGems:    gs.endlessGems || 0,
      endlessGemsNew: gs.endlessGemsNew || 0,
      endlessGemsOld: gs.endlessGemsOld || 0,
      runBestAtStart: gs.runBestAtStart || 0,
      rerolls:     gs.rerolls || 0,
      totalGoldEarned: gs.battle ? gs.battle.totalGoldEarned : 0,
      townBuildings: JSON.parse(JSON.stringify(gs.town?.buildings || {})),
      townGear:      gs.town?.gear ? JSON.parse(JSON.stringify(gs.town.gear)) : null,

      // ── 판에 세워둔 것 ──
      // v8까지 골드·웨이브·건물만 담고 타워와 편성을 빼먹었다. 강제 종료 후 돌아오면
      // 골드는 그대로인데 판이 텅 비어 있었다 — 한 판에서 제일 오래 쌓은 것이 사라졌다.
      towers: (gs.towers || []).map(t => ({
        col:t.col, row:t.row, typeId:t.typeId, level:t.level || 1, invested:t.invested || 0,
        kills:t.kills || 0, damageDealt:t.damageDealt || 0
      })),
      team: (gs.battle?.ourTeam || []).filter(u => !u.isHero).map(u => ({
        typeId:u.typeId, hp:Math.max(1, Math.round(u.hp))
      })),
      heroPlacement: gs.hero?.placement || 'none',
      heroHp:        Math.max(0, Math.round(gs.hero?.hp || 0)),
      heroDead:      !!gs.hero?.dead,
      heroDownFor:   gs.hero?.downFor || 0,
      innOffers:     gs.innOffers || [],
      // ── 영구 (런과 무관) ──
      soulStones:     gs.soulStones  || 0,
      metaUpgrades:   gs.metaUpgrades || {},
      clearedStages:  gs.clearedStages || new Array(10).fill(false),
      skillLevels:    gs.skillLevels || {},
      forge:          gs.forge ? JSON.parse(JSON.stringify(gs.forge)) : null,
      charms:         gs.charms ? JSON.parse(JSON.stringify(gs.charms)) : [],
      charmSlots:     gs.charmSlots ? gs.charmSlots.slice() : [null, null],
      ascension:      gs.ascension || 0,
      heroPlacePref:  gs.heroPlacePref || 'none',
      trainSkipped:   !!gs.trainSkipped,
      unlocked:       gs.unlocked || [],
      pacts:          gs.pacts    || [],
      seenMobs:       gs.seenMobs || [],
      clearedGates:   gs.clearedGates || [],
      heroSigil:      gs.heroSigil || DEFAULT_SIGIL,
      unlockedSigils: gs.unlockedSigils || [DEFAULT_SIGIL],
      stats:          gs.stats || createStats(),
      timestamp:  Date.now()
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(e) {}
  },

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  }
};

// ── 세이브 백업 ───────────────────────────────────────────────────────────────
// 기록이 브라우저 localStorage에만 있어서, 캐시를 지우거나 폰을 바꾸면 통째로
// 사라진다. 무한 최고 기록이 이 게임의 점수판인 이상 그건 너무 아프다.
// 짧은 문자열 하나로 뽑아 두었다가 다시 붙여넣을 수 있게 한다.
const BACKUP_TAG = 'DF1';

function _bkEnc(s) { return btoa(unescape(encodeURIComponent(s))).replace(/=+$/, ''); }
function _bkDec(s) { return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))); }
// djb2 — 오타 난 코드를 먹고 세이브를 깨뜨리지 않기 위한 최소한의 검사
function _bkSum(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h * 33) ^ s.charCodeAt(i)) >>> 0);
  return h.toString(36);
}

SaveManager.hasSave = function () {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
};

SaveManager.exportCode = function () {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  const body = _bkEnc(raw);
  return `${BACKUP_TAG}.${_bkSum(raw)}.${body}`;
};

// 성공하면 {ok:true}, 실패하면 {ok:false, err:'사람이 읽을 이유'}
SaveManager.importCode = function (code) {
  const txt = String(code || '').trim().replace(/\s+/g, '');
  if (!txt) return { ok:false, err:'코드가 비어 있습니다' };
  const parts = txt.split('.');
  if (parts.length !== 3 || parts[0] !== BACKUP_TAG) return { ok:false, err:'듀얼 프론티어 백업 코드가 아닙니다' };
  let raw;
  try { raw = _bkDec(parts[2]); } catch (e) { return { ok:false, err:'코드가 손상됐습니다' }; }
  if (_bkSum(raw) !== parts[1]) return { ok:false, err:'코드가 손상됐습니다 (검사값 불일치)' };
  let data;
  try { data = JSON.parse(raw); } catch (e) { return { ok:false, err:'코드가 손상됐습니다' }; }
  if (!data || typeof data !== 'object' || !data.stats) return { ok:false, err:'세이브 내용을 알아볼 수 없습니다' };
  try { localStorage.setItem(SAVE_KEY, raw); } catch (e) { return { ok:false, err:'저장 공간에 쓸 수 없습니다' }; }
  return { ok:true, best:(data.stats.bestEndless||0), stones:(data.soulStones||0) };
};
