'use strict';

function createWaveManager() {
  return {
    waveIndex: 0,
    phase: 'idle',
    timer: 0,
    elapsed: 0,
    intermissionTimer: 0,
    defenseQueues: [],
    battleSpawnQueues: [],   // 연속 스폰 큐

    init(idx) {
      this.waveIndex = idx;
      this.phase = 'idle';
      this.timer = WAVE_DURATION;
      this.elapsed = 0;
      this.defenseQueues = [];
      this.battleSpawnQueues = [];
    },

    startWave(gs) {
      if (this.phase !== 'idle') return;
      if (!gs.battle.ourTeam.length) return; // 병력 필수

      this.phase   = 'active';
      this.elapsed = 0;
      this.timer   = WAVE_DURATION;

      const def = WAVE_DEFS[this.waveIndex];

      // 상단 스폰 큐
      this.defenseQueues = def.defenseEnemies.map(d => ({
        type:d.type, remaining:d.count,
        interval:d.interval/1000, nextSpawn:0.5
      }));

      // 하단 연속 스폰 큐
      this.battleSpawnQueues = def.battleSpawns.map(b => ({
        type:b.type,
        interval:b.interval,
        nextSpawn:b.offset   // 첫 스폰 시각
      }));

      // 적팀 클린 스타트 (이월 없음)
      gs.battle.enemyTeam = [];
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

      // 하단 연속 스폰 (전투 중이고 팀이 살아있을 때만)
      if (gs.battle.phase === 'fighting') {
        for (const q of this.battleSpawnQueues) {
          q.nextSpawn -= dt;
          if (q.nextSpawn <= 0) {
            if (this.elapsed <= WAVE_DURATION) {
              gs.battle.enemyTeam.push(makeScaledMob(q.type, gs.battle.killCount, gs.caveLevel));
            }
            q.nextSpawn = q.interval;
          }
        }
      }

      // 아군 전멸 시 전투만 중단, 타이머는 계속
      if (gs.battle.phase === 'lost') {
        gs.battle.phase = 'idle_defeated';
      }

      // 종료 조건: 타이머 종료 or (상단 클리어 + 아군 전멸)
      const defDone = this.defenseQueues.every(q=>q.remaining<=0) &&
                      gs.defenseEnemies.every(e=>e.dead||e.reached);
      const batDone = gs.battle.phase==='idle_defeated';
      if (this.timer <= 0 || (defDone && batDone)) {
        this.endWave(gs);
      }
    },

    endWave(gs) {
      this.phase = 'intermission';
      this.intermissionTimer = INTERMISSION;

      // 웨이브 종료 시 승패 판정 — 아군이 살아있으면 승리
      if (gs.battle.phase === 'fighting') {
        gs.battle.phase  = 'won';
        gs.battle.result = 'won';
      }

      // ─ 자원 지급 ────────────────────────────────────────────────────────
      // 처치 골드 (누적) + 승리 보너스 + 처치량 보너스
      const earned    = gs.battle.goldEarned;
      const killBonus = gs.battle.killCount * (this.waveIndex + 1); // 웨이브 진행마다 처치당 보너스 증가
      const winBonus  = (gs.battle.result === 'won') ? (20 + this.waveIndex * 15) : 0;
      const total     = earned + killBonus + winBonus;
      gs.gold += total;

      const parts = [];
      if (earned > 0)    parts.push(`처치 +${earned}💰`);
      if (killBonus > 0) parts.push(`처치보너스 +${killBonus}💰`);
      if (winBonus > 0)  parts.push(`승리 +${winBonus}💰`);
      addLog(gs.battle, `웨이브${this.waveIndex+1} 보상: ${parts.join(' ')}`, COLORS.gold);

      // 정리
      gs.defenseEnemies = [];
      gs.projectiles    = [];
      gs.battle.enemyTeam = [];       // 이월 없음: 완전 초기화
      gs.battle.ourTeam   = gs.battle.ourTeam.filter(u => !u.dead); // 생존 아군 유지
      gs.battle.phase     = 'hire';
      gs.battle.result    = null;
      gs.battle.goldEarned = 0;
      gs.battle.floaties  = [];
      // log는 보상 메시지 보이도록 유지

      // 영웅 전투 배치 해제 (다음 웨이브 배치 선택 위해)
      if (gs.hero.placement === 'battle') {
        // 전투 유닛에서 영웅 제거
        gs.battle.ourTeam = gs.battle.ourTeam.filter(u => !u.isHero);
      }
      gs.hero.placement = 'none';

      SaveManager.save(gs);
    },

    updateIntermission(gs, dt) {
      if (this.phase !== 'intermission') return;
      this.intermissionTimer = Math.max(0, this.intermissionTimer - dt);

      if (this.intermissionTimer <= 0) {
        const next = this.waveIndex + 1;
        if (next >= WAVE_DEFS.length) {
          gs.stageCleared = true;
          SaveManager.save(gs);
        } else {
          gs.wave = next;
          this.init(next);
        }
      }
    }
  };
}
