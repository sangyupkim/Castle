'use strict';

const ADVANCE_DURATION = 1.4;  // 전진 연출 시간(초)
const SPAWN_DELAY      = 0.5;  // 전진 후 다음 그룹 스폰까지 대기(초)

function createWaveManager() {
  return {
    waveIndex: 0,
    phase: 'idle',
    timer: 0,
    elapsed: 0,
    intermissionTimer: 0,
    defenseQueues: [],

    // 그룹 기반 전투 스폰
    battleGroups: [],      // 전체 그룹 목록
    groupIdx: 0,           // 현재 그룹 인덱스
    groupPhase: 'idle',    // 'idle' | 'fighting' | 'advancing' | 'waiting' | 'done'
    advanceTimer: 0,
    waitTimer: 0,

    init(idx) {
      this.waveIndex  = idx;
      this.phase      = 'idle';
      this.timer      = WAVE_DURATION;
      this.elapsed    = 0;
      this.defenseQueues  = [];
      this.battleGroups   = [];
      this.groupIdx       = 0;
      this.groupPhase     = 'idle';
      this.advanceTimer   = 0;
      this.waitTimer      = 0;
    },

    startWave(gs) {
      if (this.phase !== 'idle') return;

      this.phase      = 'active';
      this.elapsed    = 0;
      this.timer      = WAVE_DURATION;
      this.groupIdx   = 0;
      this.groupPhase = 'idle';

      const def = WAVE_DEFS[this.waveIndex];

      // 상단 스폰 큐
      this.defenseQueues = def.defenseEnemies.map(d => ({
        type:d.type, remaining:d.count,
        interval:d.interval/1000, nextSpawn:0.5
      }));

      // 하단 그룹 목록 복사
      this.battleGroups = def.battleGroups.map(g => ({ types:[...g.types] }));

      // 적팀 클린 스타트
      gs.battle.enemyTeam = [];
      reapplyAllBonuses(gs);
      startFighting(gs.battle);

      // 첫 그룹 바로 스폰
      this._spawnGroup(gs);
    },

    _spawnGroup(gs) {
      if (this.groupIdx >= this.battleGroups.length) {
        this.groupPhase = 'done';
        return;
      }
      const group = this.battleGroups[this.groupIdx];
      group.types.forEach((type, i) => {
        const mob = makeScaledMob(type, gs.battle.killCount, gs.caveLevel);
        mob.drawY = unitY(i);
        gs.battle.enemyTeam.push(mob);
      });
      this.groupPhase = 'fighting';
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

      // 하단 그룹 기반 스폰 관리
      if (gs.battle.phase === 'fighting') {
        this._updateGroupSpawn(gs, dt);
      }

      // 아군 전멸 시
      if (gs.battle.phase === 'lost') {
        gs.battle.phase = 'idle_defeated';
      }

      // 종료 조건
      const defDone = this.defenseQueues.every(q => q.remaining <= 0) &&
                      gs.defenseEnemies.every(e => e.dead || e.reached);
      const batDone = gs.battle.phase === 'idle_defeated';
      const allGroupsDone = this.groupPhase === 'done' &&
                            gs.battle.enemyTeam.every(e => e.dead);

      if (this.timer <= 0 || (defDone && batDone) || allGroupsDone) {
        this.endWave(gs);
      }
    },

    _updateGroupSpawn(gs, dt) {
      if (this.groupPhase === 'done') return;

      if (this.groupPhase === 'fighting') {
        // 현재 그룹 전원 사망 확인 (화면에서 제거 대기 포함)
        const liveOrFading = gs.battle.enemyTeam.filter(e => !e.dead || e.deadTimer < 0.7);
        if (liveOrFading.length === 0) {
          // 모두 처치 — 다음 그룹이 있으면 전진 연출 시작
          this.groupIdx++;
          if (this.groupIdx >= this.battleGroups.length) {
            this.groupPhase = 'done';
          } else {
            this.groupPhase   = 'advancing';
            this.advanceTimer = ADVANCE_DURATION;
          }
        }
      }

      else if (this.groupPhase === 'advancing') {
        this.advanceTimer -= dt;
        if (this.advanceTimer <= 0) {
          this.groupPhase = 'waiting';
          this.waitTimer  = SPAWN_DELAY;
        }
      }

      else if (this.groupPhase === 'waiting') {
        this.waitTimer -= dt;
        if (this.waitTimer <= 0) {
          // 다음 그룹 스폰
          gs.battle.enemyTeam = [];  // 사망한 적 잔해 제거
          this._spawnGroup(gs);
        }
      }
    },

    endWave(gs) {
      if (gs.battle.phase === 'fighting') {
        gs.battle.phase  = 'won';
        gs.battle.result = 'won';
      }

      const earned    = gs.battle.goldEarned;
      const killBonus = gs.battle.killCount * (this.waveIndex + 1);
      const winBonus  = (gs.battle.result === 'won') ? (20 + this.waveIndex * 15) : 0;
      const total     = earned + killBonus + winBonus;
      gs.gold += total;

      const parts = [];
      if (earned > 0)    parts.push(`처치 +${earned}💰`);
      if (killBonus > 0) parts.push(`처치보너스 +${killBonus}💰`);
      if (winBonus > 0)  parts.push(`승리 +${winBonus}💰`);
      addLog(gs.battle, `웨이브${this.waveIndex+1}: ${parts.join(' ')}`, COLORS.gold);

      gs.defenseEnemies    = [];
      gs.projectiles       = [];
      gs.battle.enemyTeam  = [];
      gs.battle.ourTeam    = gs.battle.ourTeam.filter(u => !u.dead);
      gs.battle.phase      = 'hire';
      gs.battle.result     = null;
      gs.battle.goldEarned = 0;
      gs.battle.floaties   = [];
      gs.battle.maxSlots   = 4 + BONUSES.maxSlotBonus;

      if (gs.hero.placement === 'battle') {
        gs.battle.ourTeam = gs.battle.ourTeam.filter(u => !u.isHero);
      }
      gs.hero.placement = 'none';

      const isLast = (this.waveIndex + 1 >= WAVE_DEFS.length);
      if (!isLast) {
        this.phase = 'upgradePick';
        gs.upgradePick = { active: true, cards: rollUpgradeCards() };
      } else {
        this.phase = 'intermission';
        this.intermissionTimer = 0;
      }

      gs.town.waveBuffs = [];
      reapplyAllBonuses(gs);
      SaveManager.save(gs);
    },

    confirmPick(gs) {
      gs.upgradePick = { active: false, cards: [] };
      this.phase = 'intermission';
      this.intermissionTimer = 0;
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
