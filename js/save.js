'use strict';

// v7 — 로비 도입으로 unlocked · pacts · seenMobs가 추가됐다.
// 구 세이브(v6)는 전투 모델이 통째로 바뀌어 이어 쓸 수 없으므로 폐기한다.
const SAVE_KEY = 'dualfrontier_v7';

function createStats() {
  return { runs:0, bestWave:0, bestStage:0, totalKills:0, totalGold:0, totalGems:0, wavesCleared:0 };
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
      totalGoldEarned: gs.battle ? gs.battle.totalGoldEarned : 0,
      townBuildings: JSON.parse(JSON.stringify(gs.town?.buildings || {})),
      townEquipped:  gs.town?.equippedItems || [],
      // ── 영구 (런과 무관) ──
      soulStones:     gs.soulStones  || 0,
      metaUpgrades:   gs.metaUpgrades || {},
      clearedStages:  gs.clearedStages || new Array(10).fill(false),
      skillTreeOwned: gs.skillTreeOwned || [],
      unlocked:       gs.unlocked || [],
      pacts:          gs.pacts    || [],
      seenMobs:       gs.seenMobs || [],
      stats:          gs.stats || createStats(),
      timestamp:  Date.now()
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(e) {}
  },

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  }
};
