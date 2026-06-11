'use strict';

// WaveManager handles spawning and timing for a single wave
function createWaveManager() {
  return {
    waveIndex: 0,      // 0-based
    phase: 'idle',     // idle | active | intermission
    timer: 0,
    intermissionTimer: 0,

    // Spawn queues: [{type, path, remaining, nextSpawnTime}]
    defenseQueues: [],
    battleQueues: [],

    elapsed: 0,        // seconds since wave start

    init(waveIndex) {
      this.waveIndex = waveIndex;
      this.phase = 'idle';
      this.timer = 0;
      this.defenseQueues = [];
      this.battleQueues  = [];
      this.elapsed = 0;
    },

    startWave(gs) {
      if (this.phase !== 'idle') return;
      this.phase = 'active';
      this.timer = WAVE_DURATION;
      this.elapsed = 0;

      const def = WAVE_DEFS[this.waveIndex];

      // Build defense spawn queues
      this.defenseQueues = def.defenseEnemies.map(d => ({
        type: d.type, path: d.path,
        remaining: d.count,
        interval: d.interval / 1000,
        nextSpawn: 0.5
      }));

      // Build battle spawn queues
      this.battleQueues = def.battleEnemies.map(b => ({
        type: b.type,
        remaining: b.count,
        interval: b.interval / 1000,
        nextSpawn: (b.delay || 0) / 1000
      }));
    },

    update(gs, dt) {
      if (this.phase !== 'active') return;

      this.elapsed += dt;
      this.timer   = Math.max(0, WAVE_DURATION - this.elapsed);

      // ── spawn defense enemies ───────────────────────────────────────────
      for (const q of this.defenseQueues) {
        if (q.remaining <= 0) continue;
        q.nextSpawn -= dt;
        if (q.nextSpawn <= 0) {
          gs.defenseEnemies.push(makeDefenseEnemy(q.type, q.path));
          q.remaining--;
          q.nextSpawn = q.interval;
        }
      }

      // ── spawn battle enemies ────────────────────────────────────────────
      for (const q of this.battleQueues) {
        if (q.remaining <= 0) continue;
        q.nextSpawn -= dt;
        if (q.nextSpawn <= 0) {
          gs.battleEnemies.push(makeBattleEnemy(q.type));
          q.remaining--;
          q.nextSpawn = q.interval;
        }
      }

      // ── end condition ───────────────────────────────────────────────────
      const allDefDone = gs.defenseEnemies.every(e => e.dead || e.reached);
      const allBatDone = gs.battleEnemies.every(e => e.dead);
      const allMercDead = gs.mercs.every(m => m.dead);
      const spawnsDone = this.defenseQueues.every(q => q.remaining <= 0) &&
                         this.battleQueues.every(q => q.remaining <= 0);

      // Wave ends when timer expires OR (all spawns done AND all enemies cleared)
      // Battle ends early if all mercs are dead (before timer)
      const timerDone = this.timer <= 0;
      const combatResolved = spawnsDone && allDefDone && (allBatDone || allMercDead);

      if (timerDone || combatResolved) {
        this.endWave(gs);
      }
    },

    endWave(gs) {
      this.phase = 'intermission';
      this.intermissionTimer = INTERMISSION;

      // Wave clear rewards
      gs.gold += 20 + this.waveIndex * 10;

      // Clean up dead units
      gs.defenseEnemies = gs.defenseEnemies.filter(e => !e.dead);
      gs.battleEnemies  = gs.battleEnemies.filter(e => !e.dead);
      gs.mercs          = gs.mercs.filter(m => !m.dead);
      gs.projectiles    = [];

      SaveManager.save(gs);
    },

    updateIntermission(gs, dt) {
      if (this.phase !== 'intermission') return;
      this.intermissionTimer = Math.max(0, this.intermissionTimer - dt);

      if (this.intermissionTimer <= 0) {
        if (this.waveIndex >= WAVE_DEFS.length - 1) {
          gs.stageCleared = true;
          SaveManager.save(gs);
        } else {
          this.init(this.waveIndex + 1);
          gs.wave = this.waveIndex + 1;
        }
      }
    }
  };
}
