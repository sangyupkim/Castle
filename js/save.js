'use strict';

const SAVE_KEY = 'dualfrontier_v1';

const SaveManager = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) { return null; }
  },

  save(state) {
    const data = {
      phase:      state.phase,
      wave:       state.wave,
      gold:       state.gold,
      baseHP:     state.baseHP,
      heroLevel:  state.hero.level,
      heroExp:    state.hero.exp,
      timestamp:  Date.now()
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(e) {}
  },

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  }
};
