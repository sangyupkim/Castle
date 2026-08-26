'use strict';

function createWaveManager() {
  return {
    waveIndex: 0,
    phase: 'idle',            // 'idle' | 'active' | 'upgradePick' | 'intermission'
    timer: 0,
    elapsed: 0,
    intermissionTimer: 0,
    defenseQueues: [],
    wipedAt: null,            // 아군 전멸 시각(초). 돌파 지속시간 계산용

    init(idx) {
      this.waveIndex = idx;
      this.phase     = 'idle';
      this.timer     = WAVE_DURATION;
      this.elapsed   = 0;
      this.defenseQueues = [];
      this.wipedAt   = null;
    },

    startWave(gs) {
      if (this.phase !== 'idle') return;

      this.phase   = 'active';
      this.elapsed = 0;
      this.timer   = WAVE_DURATION;
      this.wipedAt = null;

      const def = WAVE_DEFS[this.waveIndex];

      // 상단 스폰 큐
      const countMult = 1 + this.waveIndex * DEF_WAVE_COUNT_SCALE;
      const spawnMult = BONUSES.spawnSpeedMult || 1;
      this.defenseQueues = def.defenseEnemies.map(d => ({
        type: d.type,
        remaining: Math.max(1, Math.round(d.count * countMult)),
        interval: (d.interval / 1000) / spawnMult,
        nextSpawn: 0.5
      }));

      reapplyAllBonuses(gs);
      startFighting(gs.battle);
      startArena(gs, this.waveIndex);
      if (typeof SFX !== 'undefined') SFX.waveStart();
    },

    // 하단 아레나에서 물러난다. 병력과 적립 골드를 지키고 남은 시간은 상단만 진행.
    retreat(gs) {
      if (this.phase !== 'active') return false;
      if (gs.battle.phase !== 'fighting') return false;
      // 바닥에 남은 드랍은 절반만 챙긴다 — 후퇴가 손해만은 아니되,
      // 제때 주우러 간 것보다 이득일 수는 없다
      const left = Math.floor(gs.arena.drops.reduce((a, d) => a + d.amount, 0) * 0.5);
      if (left > 0) {
        gs.battle.goldEarned      += left;
        gs.battle.totalGoldEarned += left;
        addLog(gs.battle, `후퇴하며 드랍 회수 +${left}💰`, COLORS.gold);
      }
      clearArena(gs);
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

      // 하단 아레나
      updateArena(gs, dt);

      // 아군 전멸 — 시각을 기록해 돌파 지속시간을 잰다
      if (gs.battle.phase === 'lost') {
        gs.battle.phase = 'idle_defeated';
        this.wipedAt = this.elapsed;
        addLog(gs.battle, '⚠️ 병력 전멸 — 몬스터가 기지로 향합니다', '#ef4444');
      }
      // 돌파가 일정 시간 지나면 몬스터는 물러난다 (남은 시간은 상단만 진행)
      if (this.wipedAt !== null && this.elapsed - this.wipedAt >= BREAKTHROUGH_DURATION) {
        if (gs.arena.mobs.length) {
          clearArena(gs);
          addLog(gs.battle, '몬스터가 물러났습니다', '#64748b');
        }
      }

      // 종료 조건 — 웨이브는 타이머로만 끝난다.
      // 상단을 일찍 막았다고 해서 하단 자원 확보 시간까지 잘리면 안 된다.
      // 양쪽 다 더 진행될 여지가 없을 때만 조기 종료한다.
      const defDone = this.defenseQueues.every(q => q.remaining <= 0) &&
                      gs.defenseEnemies.every(e => e.dead || e.reached);
      const batOver = (gs.battle.phase === 'retreated') ||
                      (gs.battle.phase === 'idle_defeated' && gs.arena.mobs.length === 0);

      if (this.timer <= 0 || (defDone && batOver)) {
        this.endWave(gs);
      }
    },

    endWave(gs) {
      if (gs.battle.phase === 'fighting' || gs.battle.phase === 'retreated') {
        gs.battle.phase  = 'won';
        gs.battle.result = 'won';
      }

      // 바닥에 남은 드랍은 절반만 회수된다
      const leftover = Math.floor(gs.arena.drops.reduce((a, d) => a + d.amount, 0) * 0.5);
      if (leftover > 0) {
        gs.battle.goldEarned      += leftover;
        gs.battle.totalGoldEarned += leftover;
      }

      const earned    = gs.battle.goldEarned;
      const killBonus = gs.battle.killCount * (this.waveIndex + 1);
      const winBonus  = (gs.battle.result === 'won') ? (20 + this.waveIndex * 15) : 0;
      const total     = earned + killBonus + winBonus;
      gs.gold += total;

      const parts = [];
      if (earned > 0)    parts.push(`드랍 +${earned}💰`);
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
      clearArena(gs);
      gs.battle.ourTeam    = gs.battle.ourTeam.filter(u => !u.dead && !u.isHero);
      gs.battle.phase      = 'hire';
      gs.battle.result     = null;
      gs.battle.goldEarned = 0;
      gs.battle.floaties   = [];
      gs.battle.maxSlots   = Math.max(1, 4 + BONUSES.maxSlotBonus);

      gs.hero.placement = 'none';
      restHealTeam(gs.battle);       // 생존 병력 휴식 회복

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

      // 스테이지 최초 클리어 보석 (일회성)
      const stageIdx = Math.floor(this.waveIndex / 3);
      const isLastWaveOfStage = ((this.waveIndex + 1) % 3 === 0);
      if (isLastWaveOfStage) {
        if (!gs.clearedStages) gs.clearedStages = new Array(10).fill(false);
        gs.stats.bestStage = Math.max(gs.stats.bestStage || 0, stageIdx + 1);
        if (!gs.clearedStages[stageIdx]) {
          gs.clearedStages[stageIdx] = true;
          const gems = (stageIdx === 9) ? 2 : 1;
          gs.soulStones += gems;
          gs.stats.totalGems = (gs.stats.totalGems || 0) + gems;
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
