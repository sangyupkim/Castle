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
      if (gs.battle.ourTeam.length === 0) return; // 병력 없으면 시작 불가

      this.phase = 'active';
      this.elapsed = 0;
      this.timer = WAVE_DURATION;

      // 상단 방어 적 스폰 큐 설정
      const def = WAVE_DEFS[this.waveIndex];
      this.defenseQueues = def.defenseEnemies.map(d => ({
        type: d.type,
        remaining: d.count,
        interval: d.interval / 1000,
        nextSpawn: 0.5
      }));

      // 하단 전투 시작 (생존 몬스터 + 이번 웨이브 추가 몬스터)
      addEnemiesForWave(gs.battle, this.waveIndex);
      startFighting(gs.battle);
    },

    update(gs, dt) {
      if (this.phase !== 'active') return;

      this.elapsed += dt;
      this.timer = Math.max(0, WAVE_DURATION - this.elapsed);

      // 상단 적 스폰
      for (const q of this.defenseQueues) {
        if (q.remaining <= 0) continue;
        q.nextSpawn -= dt;
        if (q.nextSpawn <= 0) {
          gs.defenseEnemies.push(makeDefenseEnemy(q.type, 'A'));
          q.remaining--;
          q.nextSpawn = q.interval;
        }
      }

      // 웨이브 종료 조건
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

      // ── 자원 지급: 오직 하단 전투 결과에서만 ──────────────────────────────
      const earned = gs.battle.goldEarned;
      gs.gold += earned;

      // 전투 승리 보너스
      if (gs.battle.result === 'won') {
        const bonus = 15 + this.waveIndex * 10;
        gs.gold += bonus;
        gs.battle.goldEarned += bonus; // 표시용
      }

      // 전투 결과 로그
      addLog(gs.battle, `웨이브 종료: +${gs.battle.goldEarned}💰 획득`, COLORS.gold);

      // ── 정리 ────────────────────────────────────────────────────────────
      gs.defenseEnemies = [];
      gs.projectiles    = [];

      // 죽은 아군 제거, 생존 아군은 다음 웨이브로 이월
      gs.battle.ourTeam  = gs.battle.ourTeam.filter(u => !u.dead);
      // 죽은 적 제거, 생존 적은 체력 유지한 채 이월
      gs.battle.enemyTeam = gs.battle.enemyTeam.filter(m => !m.dead);
      gs.battle.phase    = 'hire';
      gs.battle.result   = null;
      gs.battle.floaties = [];
      gs.battle.log      = [];
      gs.battle.goldEarned = 0;

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
          // 다음 웨이브 적은 startWave 시 추가됨 (체력 이월된 생존자 유지)
        }
      }
    }
  };
}
