'use strict';

const SAVE_KEY = 'dualfrontier_v4';

const SaveManager = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  },

  save(gs) {
    const data = {
      phase:      gs.phase,
      wave:       gs.wave,
      gold:       gs.gold,
      baseHP:     gs.baseHP,
      heroLevel:  gs.hero.level,
      heroExp:    gs.hero.exp,
      caveLevel:  gs.caveLevel,
      persistedEnemies: serializeEnemies(gs.battle.enemyTeam),
      totalGoldEarned: gs.battle.totalGoldEarned,
      soulStones:  gs.soulStones  || 0,
      metaUpgrades: gs.metaUpgrades || {},
      townBuildings: JSON.parse(JSON.stringify(gs.town?.buildings || {})),
      townEquipped:  gs.town?.equippedItems || [],
      timestamp:  Date.now()
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(e) {}
  },

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  }
};
