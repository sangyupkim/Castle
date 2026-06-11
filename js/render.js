'use strict';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hpColor(r) {
  return r > 0.6 ? COLORS.hpGreen : r > 0.3 ? COLORS.hpYellow : COLORS.hpRed;
}

function drawHPBar(ctx, x, y, w, h, ratio) {
  ctx.fillStyle = '#1e293b'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hpColor(Math.max(0, ratio));
  ctx.fillRect(x, y, Math.max(0, w * ratio), h);
}

function drawMPBar(ctx, x, y, w, h, ratio) {
  ctx.fillStyle = '#1e293b'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.mp;
  ctx.fillRect(x, y, Math.max(0, w * Math.max(0, ratio)), h);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

function drawButton(ctx, x, y, w, h, label, bg, fg, enabled) {
  roundRect(ctx, x, y, w, h, 5);
  ctx.fillStyle = enabled !== false ? bg : '#374151'; ctx.fill();
  ctx.strokeStyle = enabled !== false ? fg : '#4b5563'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = enabled !== false ? fg : '#6b7280';
  ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w/2, y + h/2);
}

// ─── Defense Zone ─────────────────────────────────────────────────────────────
function renderDefense(ctx, gs) {
  ctx.fillStyle = COLORS.defenseBg;
  ctx.fillRect(0, DEFENSE_Y, CW, DEFENSE_H);

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const x  = GRID_OX + c * CELL_W;
      const y  = GRID_OY + r * CELL_H;
      const isPath  = PATH_CELLS.has(`${c},${r}`);
      const isStart = c === 4 && r === 0;
      const isEnd   = c === 4 && r === 6;
      const isCross = c === 4 && r >= 1 && r <= 4; // center crossing cells

      if (isStart)       ctx.fillStyle = '#1e3a5f';
      else if (isEnd)    ctx.fillStyle = '#3f1515';
      else if (isCross)  ctx.fillStyle = '#1a1a0a';  // crossing — darker
      else if (isPath)   ctx.fillStyle = COLORS.pathCell;
      else               ctx.fillStyle = COLORS.defenseGrid;
      ctx.fillRect(x+1, y+1, CELL_W-2, CELL_H-2);

      // Path red tint
      if (isPath && !isStart && !isEnd) {
        ctx.fillStyle = isCross ? 'rgba(200,100,0,0.18)' : 'rgba(220,38,38,0.12)';
        ctx.fillRect(x+1, y+1, CELL_W-2, CELL_H-2);
      }

      if (isStart) { labelCell(ctx, '시작', x, y, '#93c5fd'); }
      if (isEnd)   { labelCell(ctx, '기지', x, y, '#fca5a5'); }

      // Hover highlight (tower placement)
      if (!isPath && gs.hoveredCell &&
          gs.hoveredCell.c === c && gs.hoveredCell.r === r) {
        ctx.fillStyle = 'rgba(99,102,241,0.25)';
        ctx.fillRect(x+1, y+1, CELL_W-2, CELL_H-2);
        ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.5;
        ctx.strokeRect(x+1, y+1, CELL_W-2, CELL_H-2);
      }
    }
  }

  // Path direction arrows
  drawPathFlow(ctx, PATH_A, 'rgba(239,68,68,0.45)');
  drawPathFlow(ctx, PATH_B, 'rgba(239,68,68,0.45)');

  // Tower range preview on hover
  if (gs.hoveredCell) {
    const { c, r } = gs.hoveredCell;
    if (!PATH_CELLS.has(`${c},${r}`) && !(c===4&&r===0) && !(c===4&&r===6)) {
      const cc = cellCenter(c, r);
      ctx.beginPath();
      ctx.arc(cc.x, cc.y, TOWER_TYPES.arrow.range, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(99,102,241,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  // Towers
  for (const t of gs.towers) renderTower(ctx, t);

  // Projectiles
  for (const p of gs.projectiles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
    ctx.fillStyle = p.color; ctx.fill();
  }

  // Enemies
  for (const e of gs.defenseEnemies) {
    if (!e.dead && !e.reached) renderDefEnemy(ctx, e);
  }

  // Base HP bar
  const bx = 8, by = DEFENSE_Y + DEFENSE_H - 14;
  ctx.fillStyle = '#0f172a'; ctx.fillRect(bx-1, by-1, 181, 10);
  drawHPBar(ctx, bx, by, 180, 8, gs.baseHP / BASE_HP_MAX);
  ctx.fillStyle = COLORS.text; ctx.font = '10px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`기지 HP ${gs.baseHP}/${BASE_HP_MAX}`, bx+184, by+4);
}

function labelCell(ctx, text, x, y, color) {
  ctx.fillStyle = color; ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + CELL_W/2, y + CELL_H/2);
}

function drawPathFlow(ctx, path, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.setLineDash([5,4]);
  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const p = cellCenter(path[i][0], path[i][1]);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow heads every few waypoints
  for (let i = 1; i < path.length; i += 2) {
    const a = cellCenter(path[i-1][0], path[i-1][1]);
    const b = cellCenter(path[i][0],   path[i][1]);
    drawArrowHead(ctx, a.x, a.y, b.x, b.y, color);
  }
  ctx.restore();
}

function drawArrowHead(ctx, x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2-y1, x2-x1);
  const mx = (x1+x2)/2, my = (y1+y2)/2;
  const size = 6;
  ctx.save();
  ctx.translate(mx, my); ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size, 0); ctx.lineTo(-size, -size*0.6); ctx.lineTo(-size, size*0.6);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

function renderTower(ctx, t) {
  const { x, y } = cellCenter(t.col, t.row);
  ctx.fillStyle = '#0f2540';
  roundRect(ctx, x-CELL_W/2+3, y-CELL_H/2+3, CELL_W-6, CELL_H-6, 4);
  ctx.fill();
  ctx.fillStyle = TOWER_TYPES[t.typeId].color;
  ctx.fillRect(x-9, y-9, 18, 18);
  ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(TOWER_TYPES[t.typeId].icon, x, y+1);
  ctx.strokeStyle = '#86efac'; ctx.lineWidth = 1;
  ctx.strokeRect(x-9, y-9, 18, 18);
}

function renderDefEnemy(ctx, e) {
  ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2);
  ctx.fillStyle = ENEMY_TYPES[e.typeId].color; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
  drawHPBar(ctx, e.x-e.radius, e.y-e.radius-7, e.radius*2, 4, e.hp/e.maxHp);
}

// ─── UI Bar ──────────────────────────────────────────────────────────────────
function renderUIBar(ctx, gs, wm) {
  ctx.fillStyle = COLORS.uiBar;
  ctx.fillRect(0, UIBAR_Y, CW, UIBAR_H);
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,UIBAR_Y); ctx.lineTo(CW,UIBAR_Y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,UIBAR_Y+UIBAR_H); ctx.lineTo(CW,UIBAR_Y+UIBAR_H); ctx.stroke();

  const cy = UIBAR_Y + UIBAR_H/2;

  // Wave
  ctx.fillStyle = COLORS.text; ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`웨이브 ${gs.wave+1}/${WAVE_DEFS.length}`, 8, cy-8);

  // Timer
  const tv = wm.phase === 'active' ? Math.ceil(wm.timer)
           : wm.phase === 'intermission' ? Math.ceil(wm.intermissionTimer) : WAVE_DURATION;
  const tlabel = wm.phase === 'intermission' ? `준비 ${tv}s`
               : `⏱ ${String(Math.floor(tv/60)).padStart(2,'0')}:${String(tv%60).padStart(2,'0')}`;
  ctx.fillStyle = wm.phase==='active' && tv<=10 ? '#ef4444' : COLORS.gold;
  ctx.font = 'bold 12px monospace'; ctx.fillText(tlabel, 8, cy+9);

  // Gold
  ctx.fillStyle = COLORS.gold; ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`💰 ${gs.gold}`, CW/2, cy-6);

  // Battle phase label
  const bphase = gs.battle.phase;
  const bLabel = bphase==='hire' ? '병력 고용 중' : bphase==='fighting' ? '⚔️ 전투 중!' : bphase==='won' ? '✅ 승리' : bphase==='lost' ? '❌ 패배' : '';
  ctx.fillStyle = bphase==='fighting' ? '#f59e0b' : bphase==='won' ? '#22c55e' : bphase==='lost' ? '#ef4444' : COLORS.textDim;
  ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(bLabel, CW/2, cy+9);

  // Main action button (right side)
  const bw = 108, bh = 38, bx = CW-bw-6, by = UIBAR_Y+(UIBAR_H-bh)/2;
  if (wm.phase === 'idle') {
    const canStart = gs.battle.phase === 'hire' || gs.battle.phase === 'fighting';
    drawButton(ctx, bx, by, bw, bh, '▶ 웨이브 시작', '#4f46e5', '#a5b4fc', canStart);
  } else if (wm.phase === 'active') {
    drawButton(ctx, bx, by, bw, bh, '웨이브 진행 중', '#1e293b', '#475569', false);
  } else {
    const tv2 = Math.ceil(wm.intermissionTimer);
    drawButton(ctx, bx, by, bw, bh, `인터미션 ${tv2}s`, '#1e293b', '#475569', false);
  }
  gs.ui.waveBtn = { x: bx, y: by, w: bw, h: bh };
}

// ─── Battle Zone ─────────────────────────────────────────────────────────────
function renderBattle(ctx, gs) {
  // Background
  ctx.fillStyle = '#0a1520';
  ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H);
  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  for (let yy = BATTLE_Y; yy < BATTLE_Y+BATTLE_H; yy += 40) {
    ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(CW,yy); ctx.stroke();
  }

  const battle = gs.battle;

  if (battle.phase === 'hire') {
    renderHirePhase(ctx, gs);
  } else {
    renderFightPhase(ctx, gs);
  }
}

// ─── Hire Phase UI ────────────────────────────────────────────────────────────
function renderHirePhase(ctx, gs) {
  const battle = gs.battle;

  // Title
  ctx.fillStyle = '#a5b4fc'; ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('병력 고용', CW/2, BATTLE_Y+8);

  // Available units panel (left)
  const units = Object.values(UNIT_TYPES);
  const panelX = 8, panelY = BATTLE_Y + 28;
  const cardW = 80, cardH = 62, gap = 6;

  gs.ui.hireCards = [];
  units.forEach((ut, i) => {
    const cx = panelX + i*(cardW+gap);
    const cy = panelY;
    const canAfford = gs.gold >= ut.cost;

    roundRect(ctx, cx, cy, cardW, cardH, 6);
    ctx.fillStyle = canAfford ? '#1e293b' : '#111827'; ctx.fill();
    ctx.strokeStyle = canAfford ? ut.color : '#374151'; ctx.lineWidth = 1.5; ctx.stroke();

    // Icon
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(ut.icon, cx+cardW/2, cy+4);

    // Name + cost
    ctx.fillStyle = canAfford ? '#e2e8f0' : '#64748b';
    ctx.font = 'bold 9px sans-serif'; ctx.textBaseline = 'bottom';
    ctx.fillText(ut.name, cx+cardW/2, cy+cardH-18);
    ctx.fillStyle = canAfford ? COLORS.gold : '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(`💰${ut.cost}`, cx+cardW/2, cy+cardH-6);

    gs.ui.hireCards.push({ x:cx, y:cy, w:cardW, h:cardH, typeId: ut.id });
  });

  // Separator
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(8, panelY+cardH+10); ctx.lineTo(CW-8, panelY+cardH+10); ctx.stroke();

  // Hired lineup (right side)
  ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`고용한 병력 (${battle.ourTeam.length}/${battle.maxSlots})`, panelX, panelY+cardH+16);

  const lineupY = panelY + cardH + 32;
  const slotSize = 50, slotGap = 8;
  gs.ui.hiredSlots = [];

  for (let i = 0; i < battle.maxSlots; i++) {
    const sx = panelX + i*(slotSize+slotGap);
    const sy = lineupY;
    const unit = battle.ourTeam[i];

    roundRect(ctx, sx, sy, slotSize, slotSize, 6);
    ctx.fillStyle = unit ? '#1e3a5f' : '#0f172a'; ctx.fill();
    ctx.strokeStyle = unit ? (unit.color||'#60a5fa') : '#334155'; ctx.lineWidth = 1.5; ctx.stroke();

    if (unit) {
      ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(unit.icon, sx+slotSize/2, sy+slotSize/2-4);
      ctx.fillStyle = '#94a3b8'; ctx.font = '8px sans-serif'; ctx.textBaseline = 'bottom';
      ctx.fillText(unit.name, sx+slotSize/2, sy+slotSize-3);
      // tap to remove
      ctx.fillStyle = '#ef4444'; ctx.font = '10px sans-serif'; ctx.textBaseline = 'top';
      ctx.fillText('✕', sx+slotSize-10, sy+2);
    } else {
      ctx.fillStyle = '#334155'; ctx.font = '22px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', sx+slotSize/2, sy+slotSize/2);
    }
    gs.ui.hiredSlots.push({ x:sx, y:sy, w:slotSize, h:slotSize, idx:i });
  }

  // Enemy preview
  const epX = 300, epY = lineupY;
  ctx.fillStyle = '#f87171'; ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('적 편성', epX, panelY+cardH+16);

  battle.enemyTeam.forEach((mob, i) => {
    const ex = epX + i*(40+4);
    roundRect(ctx, ex, epY, 40, 50, 5);
    ctx.fillStyle = '#2d1515'; ctx.fill();
    ctx.strokeStyle = mob.color; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(mob.icon, ex+20, epY+22);
    ctx.fillStyle = '#94a3b8'; ctx.font = '8px sans-serif'; ctx.textBaseline = 'bottom';
    ctx.fillText(mob.name, ex+20, epY+49);
  });

  // Wave start hint at bottom
  ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('병력 고용 후 우측 [웨이브 시작] 버튼을 누르세요', CW/2, BATTLE_Y+BATTLE_H-6);
}

// ─── Fight Phase ──────────────────────────────────────────────────────────────
function renderFightPhase(ctx, gs) {
  const battle = gs.battle;

  // "우리팀" / "적팀" labels
  ctx.font = 'bold 13px sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  ctx.fillStyle = '#60a5fa';
  ctx.fillText('우리팀', BATTLE_TEAM_X, BATTLE_Y+8);
  ctx.fillStyle = '#f87171';
  ctx.fillText('적팀', BATTLE_ENEMY_X, BATTLE_Y+8);

  // VS divider
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(CW/2, BATTLE_Y+30); ctx.lineTo(CW/2, BATTLE_Y+BATTLE_H-60); ctx.stroke();
  ctx.setLineDash([]);

  // Draw our team
  battle.ourTeam.forEach((u, i) => renderBattleUnit(ctx, u, i, true));
  // Draw enemy team
  battle.enemyTeam.forEach((u, i) => renderBattleUnit(ctx, u, i, false));

  // Floaties
  for (const f of battle.floaties) {
    ctx.globalAlpha = Math.max(0, f.life / 1.2);
    ctx.fillStyle = f.color;
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // Combat log (bottom)
  const logX = 8, logY = BATTLE_Y + BATTLE_H - 60;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, logY-4, CW, 64);
  battle.log.slice(0,4).forEach((entry, i) => {
    ctx.globalAlpha = Math.min(1, entry.timer / 0.8);
    ctx.fillStyle = entry.color; ctx.font = '9px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(entry.text, logX, logY + i*14);
  });
  ctx.globalAlpha = 1;

  // Tick progress bar
  const tp = battle.tickTimer / TICK_INTERVAL;
  ctx.fillStyle = '#1e293b'; ctx.fillRect(8, BATTLE_Y+BATTLE_H-8, CW-16, 5);
  ctx.fillStyle = '#6366f1'; ctx.fillRect(8, BATTLE_Y+BATTLE_H-8, (CW-16)*tp, 5);

  // Result overlay
  if (battle.phase === 'won') {
    ctx.fillStyle = 'rgba(0,50,0,0.7)'; ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H);
    ctx.fillStyle = '#22c55e'; ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('전투 승리! 🎉', CW/2, BATTLE_Y+BATTLE_H/2);
  } else if (battle.phase === 'lost') {
    ctx.fillStyle = 'rgba(50,0,0,0.7)'; ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H);
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('전투 패배...', CW/2, BATTLE_Y+BATTLE_H/2);
  }
}

function renderBattleUnit(ctx, u, idx, isPlayer) {
  const x = isPlayer ? BATTLE_TEAM_X : BATTLE_ENEMY_X;
  const y = unitY(idx);
  const r = BATTLE_UNIT_R;

  if (u.dead) {
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = '#374151'; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#6b7280'; ctx.font = '14px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💀', x, y);
    return;
  }

  // Flash effect
  const doFlash = u.flashTimer > 0;
  if (doFlash) {
    ctx.beginPath(); ctx.arc(x, y, r+4, 0, Math.PI*2);
    ctx.fillStyle = u.flashColor; ctx.fill();
  }

  // Body
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = u.color; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

  // Icon
  ctx.font = `${Math.floor(r*0.9)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(u.icon, x, y+1);

  // HP bar
  const bw = r*2+8;
  drawHPBar(ctx, x-bw/2, y+r+3, bw, 5, u.hp/u.maxHp);
  // MP bar
  drawMPBar(ctx, x-bw/2, y+r+10, bw, 3, u.mp/u.maxMp);

  // Name
  ctx.fillStyle = '#cbd5e1'; ctx.font = '8px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(`${u.name} ${u.hp}`, x, y+r+16);
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function renderHUD(ctx, gs) {
  if (gs.gameOver) {
    renderOverlay(ctx, '게임 오버', '#ef4444', '탭하여 재시작');
  } else if (gs.stageCleared) {
    const grade = gs.baseHP>=80 ? 'S' : gs.baseHP>=50 ? 'A' : gs.baseHP>=20 ? 'B' : 'C';
    renderOverlay(ctx, `스테이지 클리어! (${grade})`, '#22c55e', '탭하여 계속');
  }
}

function renderOverlay(ctx, title, color, sub) {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0,0,CW,CH);
  ctx.fillStyle = color; ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(title, CW/2, CH/2-18);
  ctx.fillStyle = '#e2e8f0'; ctx.font = '15px sans-serif';
  ctx.fillText(sub, CW/2, CH/2+18);
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────
function renderTutorial(ctx, tut) {
  if (!tut.active) return;
  const step = tut.current(); if (!step) return;

  ctx.fillStyle = 'rgba(0,0,0,0.68)'; ctx.fillRect(0,0,CW,CH);

  const cw=340, ch=165, cx=(CW-cw)/2, cy=(CH-ch)/2;
  roundRect(ctx, cx, cy, cw, ch, 10);
  ctx.fillStyle = '#0f172a'; ctx.fill();
  ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = '#a5b4fc'; ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(step.title, CW/2, cy+13);

  ctx.fillStyle = '#e2e8f0'; ctx.font = '12px sans-serif';
  step.text.split('\n').forEach((line, i) => {
    ctx.fillText(line, CW/2, cy+36+i*17);
  });

  // Dots
  for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
    ctx.beginPath(); ctx.arc(CW/2-(TUTORIAL_STEPS.length-1)*9+i*18, cy+ch-16, 4, 0, Math.PI*2);
    ctx.fillStyle = i===tut.step ? '#6366f1' : '#334155'; ctx.fill();
  }

  ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.fillText('탭하여 계속 ▶', CW/2, cy+ch-3);
}
