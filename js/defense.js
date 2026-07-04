'use strict';

// ─── Tower ───────────────────────────────────────────────────────────────────
function makeTower(col, row, typeId) {
  const tpl = TOWER_TYPES[typeId];
  return {
    col, row, typeId,
    level: 1,
    dmg:   tpl.dmg,
    spd:   tpl.spd   * BONUSES.towerSpdMult,
    range: tpl.range  * BONUSES.towerRangeMult,
    cooldown: 0,
    totalKills: 0
  };
}

// ─── Defense Enemy ────────────────────────────────────────────────────────────
let _defEnemyId = 0;
function makeDefenseEnemy(typeId, pathKey) {
  const tpl = ENEMY_TYPES[typeId];
  const path = THE_PATH;  // 단일 경로 사용 (pathKey 무시)
  const start = cellCenter(path[0][0], path[0][1]);
  return {
    id: ++_defEnemyId,
    typeId, pathKey,
    path,
    wpIdx: 0,       // current waypoint index
    x: start.x, y: start.y,
    hp: tpl.hp, maxHp: tpl.hp,
    spd: tpl.spd * ENEMY_CELL_SPD,
    dmg: tpl.dmg, reward: tpl.reward,
    radius: tpl.radius,
    dead: false,
    reached: false  // reached the base
  };
}

// ─── Projectile ───────────────────────────────────────────────────────────────
function makeProjectile(sx, sy, target, dmg, color) {
  return { x: sx, y: sy, tx: target.x, ty: target.y, target, dmg, color, spd: 320 };
}

// ─── Update Logic ─────────────────────────────────────────────────────────────
function updateDefenseEnemies(enemies, dt) {
  for (const e of enemies) {
    if (e.dead || e.reached) continue;
    if (e.wpIdx >= e.path.length - 1) { e.reached = true; continue; }

    const next = cellCenter(e.path[e.wpIdx + 1][0], e.path[e.wpIdx + 1][1]);
    const dx = next.x - e.x, dy = next.y - e.y;
    const dist = Math.hypot(dx, dy);
    const step = e.spd * dt;

    if (step >= dist) {
      e.x = next.x; e.y = next.y;
      e.wpIdx++;
    } else {
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
    }
  }
}

function updateTowers(towers, enemies, projectiles, dt) {
  for (const tower of towers) {
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    if (tower.cooldown > 0) continue;

    const center = cellCenter(tower.col, tower.row);
    // find nearest alive enemy in range
    let best = null, bestDist = Infinity;
    for (const e of enemies) {
      if (e.dead || e.reached) continue;
      const d = Math.hypot(e.x - center.x, e.y - center.y);
      if (d <= tower.range && d < bestDist) { best = e; bestDist = d; }
    }
    if (!best) continue;

    tower.cooldown = 1 / tower.spd;
    const tpl = TOWER_TYPES[tower.typeId];
    const dmg = tower.dmg + BONUSES.towerDmg;
    const proj = makeProjectile(center.x, center.y, best, dmg, tpl.projColor);
    proj._enemies = enemies; // 범위 피해용
    projectiles.push(proj);
  }
}

function updateProjectiles(projectiles, onKill, dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    const tgt = p.target;

    if (!tgt || tgt.dead || tgt.reached) { projectiles.splice(i, 1); continue; }

    // Track target current position
    p.tx = tgt.x; p.ty = tgt.y;
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy);
    const step = p.spd * dt;

    if (step >= dist) {
      // Hit
      tgt.hp -= p.dmg;
      if (tgt.hp <= 0) { tgt.dead = true; onKill(tgt); }
      // 범위 피해 (천둥 화살)
      if (BONUSES.towerSplash && !p._heroShot) {
        for (const e of (p._enemies || [])) {
          if (e !== tgt && !e.dead && !e.reached) {
            const dx2 = e.x - tgt.x, dy2 = e.y - tgt.y;
            if (Math.hypot(dx2, dy2) < 40) {
              e.hp -= Math.ceil(p.dmg * 0.5);
              if (e.hp <= 0) { e.dead = true; onKill(e); }
            }
          }
        }
      }
      projectiles.splice(i, 1);
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }
  }
}
