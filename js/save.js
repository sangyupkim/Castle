'use strict';

const SAVE_KEY = 'dualfrontier_v4';

function createStats() {
  return {
    runs: 0,
    bestWave: 0,
    bestSoul: 0,
    totalKills: 0,
    totalGold: 0,
    wavesCleared: 0   // 이번 런에서 클리어한 웨이브
  };
}

const SaveManager = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  save(gs) {
    const data = {
      wave:        gs.wave,
      gold:        gs.gold,
      baseHP:      gs.baseHP,
      heroLevel:   gs.hero.level,
      heroExp:     gs.hero.exp,
      caveLevel:   gs.caveLevel,
      endless:     !!gs.endless,
      totalGoldEarned: gs.battle.totalGoldEarned,
      soulStones:  gs.soulStones  || 0,
      metaUpgrades: gs.metaUpgrades || {},
      stats:       gs.stats || createStats(),
      timestamp:   Date.now()
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  },

  // 런이 끝났을 때 영구 기록만 갱신 (진행 상황은 버린다)
  saveMetaOnly(gs) {
    const data = {
      soulStones:   gs.soulStones  || 0,
      metaUpgrades: gs.metaUpgrades || {},
      stats:        gs.stats || createStats(),
      timestamp:    Date.now()
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  },

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
};
