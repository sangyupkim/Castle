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
    loopCount: 0,          // 그룹을 몇 바퀴 순환했는지
    wipedAt: null,         // 아군이 전멸한 시각(초). 돌파 지속시간 계산용

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
      this.loopCount      = 0;
      this.wipedAt        = null;
    },

    startWave(gs) {
      if (this.phase !== 'idle') return;

      this.phase      = 'active';
      this.elapsed    = 0;
      this.timer      = WAVE_DURATION;
      this.groupIdx   = 0;
      this.groupPhase = 'idle';
      this.loopCount  = 0;
      this.wipedAt    = null;

      const def = WAVE_DEFS[this.waveIndex];

      // 상단 스폰 큐
      const countMult = 1 + this.waveIndex * DEF_WAVE_COUNT_SCALE;
      const spawnMult = BONUSES.spawnSpeedMult || 1;
      this.defenseQueues = def.defenseEnemies.map(d => ({
        type:d.type,
        remaining: Math.max(1, Math.round(d.count * countMult)),
        interval: (d.interval / 1000) / spawnMult,
        nextSpawn: 0.5
      }));

      // 하단 그룹 목록 복사
      this.battleGroups = def.battleGroups.map(g => ({ types:[...g.types] }));

      // 적팀 클린 스타트
      gs.battle.enemyTeam = [];
      reapplyAllBonuses(gs);
      startFighting(gs.battle);

      // 첫 그룹 바로 스폰
      this._spawnGroup(gs);
      if (typeof SFX !== 'undefined') SFX.waveStart();
    },

    _spawnGroup(gs) {
      if (!this.battleGroups.length) { this.groupPhase = 'done'; return; }
      // 그룹을 다 돌면 처음으로 순환한다. 하단은 자원 확보 구간이므로
      // 시간이 남아 있는 한 계속 몬스터가 나와야 한다.
      if (this.groupIdx >= this.battleGroups.length) {
        this.groupIdx = 0;
        this.loopCount++;
      }
      const group = this.battleGroups[this.groupIdx];
      const types = group.types.slice(0, MAX_GROUP_SIZE);
      // 아군/적 중 큰 쪽에 맞춰 행 간격을 먼저 확정해야 drawY가 화면 안에 들어온다
      setBattleRowCount(Math.max(4, gs.battle.ourTeam.length, types.length));
      const goldMult = loopGoldMult(this.loopCount);
      types.forEach((type, i) => {
        const mob = makeScaledMob(type, gs.battle.killCount, gs.caveLevel);
        mob.goldReward = Math.max(1, Math.round(mob.goldReward * goldMult));
        mob.drawY = unitY(i);
        gs.battle.enemyTeam.push(mob);
      });
      this.groupPhase = 'fighting';
      if (typeof SFX !== 'undefined' && this.groupIdx > 0) SFX.advance();
    },

    // 하단 전투에서 물러난다. 병력과 적립 골드를 지키고 남은 시간은 상단만 진행.
    retreat(gs) {
      if (this.phase !== 'active') return false;
      if (this.groupPhase === 'done') return false;
      if (gs.battle.phase !== 'fighting') return false;
      gs.battle.enemyTeam = [];
      this.groupPhase = 'done';
      gs.battle.phase = 'retreated';
      addLog(gs.battle, '🛡 후퇴 — 병력을 보존했습니다', '#38bdf8');
      if (typeof SFX !== 'undefined') SFX.click();
      return true;
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
          gs.defenseEnemies.push(makeDefenseEnemy(q.type, this.waveIndex));
          q.remaining--;
          q.nextSpawn = q.interval;
        }
      }

      // 하단 그룹 기반 스폰 관리
      if (gs.battle.phase === 'fighting') {
        this._updateGroupSpawn(gs, dt);
      }

      // 아군 전멸 시 — 시각을 기록해 돌파 지속시간을 잰다
      if (gs.battle.phase === 'lost') {
        gs.battle.phase = 'idle_defeated';
        this.wipedAt = this.elapsed;
        addLog(gs.battle, '⚠️ 병력 전멸 — 몬스터가 기지로 향합니다', '#ef4444');
      }
      // 돌파가 일정 시간 지나면 몬스터는 물러난다 (남은 시간은 상단만 진행)
      if (this.wipedAt !== null && this.elapsed - this.wipedAt >= BREAKTHROUGH_DURATION) {
        if (gs.battle.enemyTeam.length) {
          gs.battle.enemyTeam = [];
          addLog(gs.battle, '몬스터가 물러났습니다', '#64748b');
        }
      }

      // 종료 조건 — 웨이브는 타이머로만 끝난다.
      // 상단을 일찍 막았다고 해서 하단 자원 확보 시간까지 잘리면 안 된다.
      // 양쪽 다 더 진행될 여지가 없을 때만 조기 종료한다.
      const defDone = this.defenseQueues.every(q => q.remaining <= 0) &&
                      gs.defenseEnemies.every(e => e.dead || e.reached);
      const batOver = (gs.battle.phase === 'retreated') ||
                      (gs.battle.phase === 'idle_defeated' && gs.battle.enemyTeam.length === 0);

      if (this.timer <= 0 || (defDone && batOver)) {
        this.endWave(gs);
      }
    },

    _updateGroupSpawn(gs, dt) {
      if (this.groupPhase === 'done') return;

      if (this.groupPhase === 'fighting') {
        // 현재 그룹 전원 사망 확인 (화면에서 제거 대기 포함)
        const liveOrFading = gs.battle.enemyTeam.filter(e => !e.dead || e.deadTimer < 0.7);
        if (liveOrFading.length === 0) {
          // 모두 처치 — 전진 연출 후 다음 그룹 (마지막이면 처음으로 순환)
          this.groupIdx++;
          this.groupPhase   = 'advancing';
          this.advanceTimer = ADVANCE_DURATION;
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
      if (gs.battle.phase === 'fighting' || gs.battle.phase === 'retreated') {
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

      if (typeof SFX !== 'undefined') {
        if (gs.battle.result === 'won') SFX.win(); else SFX.lose();
      }

      // 하단에 배치했던 영웅 상태를 되돌려 받는다
      const heroUnit = gs.battle.ourTeam.find(u => u.isHero);
      if (heroUnit) {
        if (heroUnit.dead) killHero(gs);
        else gs.hero.hp = Math.max(1, Math.round(heroUnit.hp));
      }

      gs.defenseEnemies    = [];
      gs.projectiles       = [];
      gs.battle.enemyTeam  = [];
      gs.battle.ourTeam    = gs.battle.ourTeam.filter(u => !u.dead && !u.isHero);
      gs.battle.phase      = 'hire';
      gs.battle.result     = null;
      gs.battle.goldEarned = 0;
      gs.battle.floaties   = [];
      gs.battle.maxSlots   = 4 + BONUSES.maxSlotBonus;

      gs.hero.placement = 'none';
      restHealTeam(gs.battle);       // 생존 병력 휴식 회복
      syncBattleLayout(gs.battle);

      const isLast = (this.waveIndex + 1 >= WAVE_DEFS.length);
      if (!isLast) {
        this.phase = 'upgradePick';
        gs.upgradePick = { active: true, cards: rollUpgradeCards(gs.activeUpgrades) };
      } else {
        this.phase = 'intermission';
        this.intermissionTimer = 0;
      }

      gs.town.waveBuffs = [];
      reapplyAllBonuses(gs);

      // Stage completion gem reward
      const stageIdx = Math.floor(this.waveIndex / 3);
      const isLastWaveOfStage = ((this.waveIndex + 1) % 3 === 0);
      if (isLastWaveOfStage) {
        if (!gs.clearedStages) gs.clearedStages = new Array(10).fill(false);
        if (!gs.clearedStages[stageIdx]) {
          gs.clearedStages[stageIdx] = true;
          const isBoss = stageIdx === 9;
          const gems = isBoss ? 2 : 1;
          gs.soulStones += gems;
          addLog(gs.battle, `★ 1-${stageIdx+1} 클리어! 보석 +${gems}`, '#a78bfa');
        }
      }

      gs.stats.wavesCleared = Math.max(gs.stats.wavesCleared || 0, this.waveIndex + 1);
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
