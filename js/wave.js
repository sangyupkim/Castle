'use strict';

function createWaveManager() {
  return {
    waveIndex: 0,
    phase: 'idle',       // idle | active | intermission
    timer: 0,
    elapsed: 0,
    intermissionTimer: 0,
    defenseQueues: [],

    init(waveIndex) {
      this.waveIndex = waveIndex;
      this.phase = 'idle';
      this.timer = WAVE_DURATION;
      this.elapsed = 0;
      this.defenseQueues = [];
    },

    startWave(gs) {
      if (this.phase !== 'idle') return;
      this.phase = 'active';
      this.elapsed = 0;
      this.timer = WAVE_DURATION;

      const def = WAVE_DEFS[this.waveIndex];

      this.defenseQueues = def.defenseEnemies.map(d => ({
        type: d.type, path: d.path,
        remaining: d.count,
        interval: d.interval / 1000,
        nextSpawn: 0.5
      }));

      // Start battle fighting phase
      startFighting(gs.battle);
    },

    update(gs, dt) {
      if (this.phase !== 'active') return;

      this.elapsed += dt;
      this.timer = Math.max(0, WAVE_DURATION - this.elapsed);

      // Spawn defense enemies
      for (const q of this.defenseQueues) {
        if (q.remaining <= 0) continue;
        q.nextSpawn -= dt;
        if (q.nextSpawn <= 0) {
          gs.defenseEnemies.push(makeDefenseEnemy(q.type, q.path));
          q.remaining--;
          q.nextSpawn = q.interval;
        }
      }

      // Check wave end: timer OR all defense cleared + battle resolved
      const defSpawnDone = this.defenseQueues.every(q => q.remaining <= 0);
      const defCleared   = gs.defenseEnemies.every(e => e.dead || e.reached);
      const batDone      = gs.battle.phase === 'won' || gs.battle.phase === 'lost';

      if (this.timer <= 0 || (defSpawnDone && defCleared && batDone)) {
        this.endWave(gs);
      }
    },

    endWave(gs) {
      this.phase = 'intermission';
      this.intermissionTimer = INTERMISSION;

      // Gold reward
      const won = gs.battle.result === 'won';
      gs.gold += won ? (25 + this.waveIndex * 12) : (10 + this.waveIndex * 5);

      // Cleanup
      gs.defenseEnemies = [];
      gs.projectiles    = [];
      gs.battle.phase   = 'hire';
      gs.battle.result  = null;
      gs.battle.ourTeam = gs.battle.ourTeam.filter(u => !u.dead); // survivors persist
      gs.battle.floaties = [];
      gs.battle.log      = [];

      SaveManager.save(gs);
    },

    updateIntermission(gs, dt) {
      if (this.phase !== 'intermission') return;
      this.intermissionTimer = Math.max(0, this.intermissionTimer - dt);

      if (this.intermissionTimer <= 0) {
        const nextIdx = this.waveIndex + 1;
        if (nextIdx >= WAVE_DEFS.length) {
          gs.stageCleared = true;
          SaveManager.save(gs);
        } else {
          gs.wave = nextIdx;
          this.init(nextIdx);
          setupEnemyTeam(gs.battle, nextIdx);
        }
      }
    }
  };
}
