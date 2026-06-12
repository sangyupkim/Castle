'use strict';

const SAVE_KEY = 'dualfrontier_v2';

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
      timestamp:  Date.now()
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(e) {}
  },

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  }
};
