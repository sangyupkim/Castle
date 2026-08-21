'use strict';

const SAVE_KEY = 'dualfrontier_v6';

function createStats() {
  return { runs:0, bestWave:0, totalKills:0, totalGold:0, wavesCleared:0 };
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
      wave:       gs.wave,
      gold:       gs.gold,
      baseHP:     gs.baseHP,
      heroLevel:  gs.hero.level,
      heroExp:    gs.hero.exp,
      caveLevel:  gs.caveLevel,
      totalGoldEarned: gs.battle.totalGoldEarned,
      soulStones:  gs.soulStones  || 0,
      metaUpgrades: gs.metaUpgrades || {},
      clearedStages: gs.clearedStages || new Array(10).fill(false),
      skillTreeOwned: gs.skillTreeOwned || [],
      townBuildings: JSON.parse(JSON.stringify(gs.town?.buildings || {})),
      townEquipped:  gs.town?.equippedItems || [],
      stats:         gs.stats || createStats(),
      timestamp:  Date.now()
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(e) {}
  },

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  }
};
