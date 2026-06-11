'use strict';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hpColor(ratio) {
  if (ratio > 0.6) return COLORS.hpGreen;
  if (ratio > 0.3) return COLORS.hpYellow;
  return COLORS.hpRed;
}

function drawHPBar(ctx, x, y, w, h, ratio, bgColor) {
  ctx.fillStyle = bgColor || '#1e293b';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hpColor(ratio);
  ctx.fillRect(x, y, w * ratio, h);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── Defense Zone ─────────────────────────────────────────────────────────────
function renderDefense(ctx, gs) {
  // Background
  ctx.fillStyle = COLORS.defenseBg;
  ctx.fillRect(0, DEFENSE_Y, CW, DEFENSE_H);

  // Draw grid cells
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const x = GRID_OX + c * CELL_W;
      const y = GRID_OY + r * CELL_H;
      const isPath = PATH_CELLS.has(`${c},${r}`);
      const isStart = c === 4 && r === 0;
      const isEnd   = c === 4 && r === 6;

      // Cell background
      if (isStart) {
        ctx.fillStyle = '#1e3a5f';
      } else if (isEnd) {
        ctx.fillStyle = '#3f1515';
      } else if (isPath) {
        ctx.fillStyle = '#0e1e0e';
      } else {
        ctx.fillStyle = COLORS.defenseGrid;
      }
      ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);

      // Path highlight
      if (isPath && !isStart && !isEnd) {
        ctx.fillStyle = 'rgba(220,38,38,0.10)';
        ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
      }

      // Start / End labels
      if (isStart) {
        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('시작', x + CELL_W / 2, y + CELL_H / 2);
      }
      if (isEnd) {
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('기지', x + CELL_W / 2, y + CELL_H / 2);
      }

      // Tower-buildable hover highlight
      if (!isPath && gs.hoveredCell && gs.hoveredCell.c === c && gs.hoveredCell.r === r) {
        ctx.fillStyle = 'rgba(99,102,241,0.25)';
        ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
      }
    }
  }

  // Draw path arrows (subtle guide)
  drawPathArrows(ctx, PATH_A, 'rgba(239,68,68,0.35)');
  drawPathArrows(ctx, PATH_B, 'rgba(239,68,68,0.35)');

  // Draw towers
  for (const t of gs.towers) {
    renderTower(ctx, t);
  }

  // Tower range preview when hovering buildable cell
  if (gs.hoveredCell && !PATH_CELLS.has(`${gs.hoveredCell.c},${gs.hoveredCell.r}`)) {
    const cc = cellCenter(gs.hoveredCell.c, gs.hoveredCell.r);
    ctx.beginPath();
    ctx.arc(cc.x, cc.y, TOWER_TYPES.arrow.range, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(99,102,241,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw projectiles
  for (const p of gs.projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  // Draw enemies
  for (const e of gs.defenseEnemies) {
    if (e.dead || e.reached) continue;
    renderDefenseEnemy(ctx, e);
  }

  // Base HP bar at bottom of defense zone
  const bx = 8, by = DEFENSE_Y + DEFENSE_H - 14, bw = 180, bh = 8;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  drawHPBar(ctx, bx, by, bw, bh, gs.baseHP / BASE_HP_MAX);
  ctx.fillStyle = COLORS.text;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`기지 HP: ${gs.baseHP}/${BASE_HP_MAX}`, bx + bw + 6, by + 4);
}

function drawPathArrows(ctx, path, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const c = cellCenter(path[i][0], path[i][1]);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function renderTower(ctx, t) {
  const { x, y } = cellCenter(t.col, t.row);
  const tpl = TOWER_TYPES[t.typeId];

  // Base
  ctx.fillStyle = '#1e3a5f';
  roundRect(ctx, x - CELL_W/2 + 4, y - CELL_H/2 + 4, CELL_W - 8, CELL_H - 8, 4);
  ctx.fill();

  // Tower body
  ctx.fillStyle = tpl.color;
  ctx.fillRect(x - 8, y - 8, 16, 16);

  // Arrow icon
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tpl.icon, x, y + 1);

  // Outline
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 8, y - 8, 16, 16);
}

function renderDefenseEnemy(ctx, e) {
  // Body
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
  ctx.fillStyle = ENEMY_TYPES[e.typeId].color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();

  // HP bar above
  const bw = e.radius * 2;
  drawHPBar(ctx, e.x - e.radius, e.y - e.radius - 7, bw, 4, e.hp / e.maxHp, '#1e293b');
}

// ─── UI Bar ──────────────────────────────────────────────────────────────────
function renderUIBar(ctx, gs, wm) {
  ctx.fillStyle = COLORS.uiBar;
  ctx.fillRect(0, UIBAR_Y, CW, UIBAR_H);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, UIBAR_Y); ctx.lineTo(CW, UIBAR_Y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, UIBAR_Y + UIBAR_H); ctx.lineTo(CW, UIBAR_Y + UIBAR_H); ctx.stroke();

  const cy = UIBAR_Y + UIBAR_H / 2;

  // Wave label
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`웨이브 ${gs.wave + 1}/${WAVE_DEFS.length}`, 8, cy - 9);

  // Timer
  const timerVal = wm.phase === 'active'
    ? Math.ceil(wm.timer)
    : (wm.phase === 'intermission' ? Math.ceil(wm.intermissionTimer) : WAVE_DURATION);
  const timerLabel = wm.phase === 'intermission'
    ? `준비 ${timerVal}s`
    : `⏱ ${String(Math.floor(timerVal / 60)).padStart(2,'0')}:${String(timerVal % 60).padStart(2,'0')}`;

  ctx.fillStyle = wm.phase === 'active' && timerVal <= 10 ? '#ef4444' : COLORS.gold;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(timerLabel, 8, cy + 9);

  // Gold
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`💰 ${gs.gold}`, CW / 2, cy - 8);

  // Main button
  const btnW = 110, btnH = 32, btnX = CW / 2 - btnW / 2, btnY = UIBAR_Y + UIBAR_H - btnH - 4;

  if (wm.phase === 'idle') {
    drawButton(ctx, btnX, btnY, btnW, btnH, '▶ 웨이브 시작', '#4f46e5', '#a5b4fc');
  } else if (wm.phase === 'active') {
    drawButton(ctx, btnX, btnY, btnW, btnH, `⚔️ 병력 구매 (-10G)`, gs.gold >= 10 ? '#065f46' : '#374151', '#a7f3d0');
  } else {
    drawButton(ctx, btnX, btnY, btnW, btnH, '대기 중...', '#374151', '#64748b');
  }

  gs.ui.waveBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
}

function drawButton(ctx, x, y, w, h, label, bg, fg) {
  roundRect(ctx, x, y, w, h, 5);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
}

// ─── Battle Zone ─────────────────────────────────────────────────────────────

// Simple parallax bg layers
const BG_LAYERS = [
  { stars: generateStars(40, 0.4) },
  { stars: generateStars(25, 0.7) }
];

function generateStars(n, size) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push({ x: Math.random() * CW, y: BATTLE_Y + Math.random() * (GROUND_Y - BATTLE_Y - 50), r: size * (0.5 + Math.random()) });
  }
  return arr;
}

let bgOffset = 0;
function renderBattle(ctx, gs, dt) {
  if (gs.waveActive) bgOffset += dt * 15;

  // Sky gradient
  const grad = ctx.createLinearGradient(0, BATTLE_Y, 0, GROUND_Y);
  grad.addColorStop(0, '#050d1a');
  grad.addColorStop(1, '#0d1b2a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, BATTLE_Y, CW, GROUND_Y - BATTLE_Y);

  // Stars (parallax)
  for (let li = 0; li < BG_LAYERS.length; li++) {
    const spd = (li + 1) * 0.3;
    ctx.fillStyle = li === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)';
    for (const s of BG_LAYERS[li].stars) {
      let sx = (s.x - bgOffset * spd) % CW;
      if (sx < 0) sx += CW;
      ctx.beginPath();
      ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ground
  ctx.fillStyle = '#0f2010';
  ctx.fillRect(0, GROUND_Y, CW, BATTLE_Y + BATTLE_H - GROUND_Y);
  ctx.fillStyle = '#1a3d1a';
  ctx.fillRect(0, GROUND_Y, CW, 6);

  // Battle mercs
  for (const m of gs.mercs) {
    if (m.dead) continue;
    renderUnit(ctx, m, true);
  }

  // Battle enemies
  for (const mob of gs.battleEnemies) {
    if (mob.dead) continue;
    renderUnit(ctx, mob, false);
  }

  // Skill buttons
  renderSkillButtons(ctx, gs);

  // "No mercs" hint
  if (gs.waveActive && gs.mercs.length === 0 && gs.battleEnemies.some(e => !e.dead)) {
    ctx.fillStyle = 'rgba(239,68,68,0.7)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('병력이 없습니다! 구매하세요 →', CW / 2, BATTLE_Y + 20);
  }
}

function renderUnit(ctx, u, isMerc) {
  const gy = GROUND_Y;

  // Shadow
  ctx.beginPath();
  ctx.ellipse(u.x, gy + 3, u.radius * 0.8, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  // Body
  const bodyY = gy - u.radius;
  ctx.beginPath();
  ctx.arc(u.x, bodyY, u.radius, 0, Math.PI * 2);
  ctx.fillStyle = isMerc
    ? (battleEffects.rally > 0 ? '#f59e0b' : MERC_TYPES[u.typeId]?.color || '#60a5fa')
    : (BATTLE_ENEMY_TYPES[u.typeId]?.color || '#ef4444');
  ctx.fill();

  // Shield effect glow
  if (isMerc && battleEffects.shield > 0) {
    ctx.beginPath();
    ctx.arc(u.x, bodyY, u.radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(99,102,241,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.strokeStyle = isMerc ? '#bfdbfe' : '#fca5a5';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Icon
  ctx.font = `${u.radius}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isMerc ? '⚔' : '👹', u.x, bodyY);

  // HP bar
  const bw = u.radius * 2 + 4;
  drawHPBar(ctx, u.x - bw / 2, bodyY - u.radius - 7, bw, 4, u.hp / u.maxHp);
}

function renderSkillButtons(ctx, gs) {
  const btnW = 58, btnH = 36;
  const startX = 4;
  const y = BATTLE_Y + BATTLE_H - btnH - 4;

  for (let i = 0; i < SKILLS.length; i++) {
    const sk = SKILLS[i];
    const x = startX + i * (btnW + 4);
    const ready = sk.activeCd <= 0;

    roundRect(ctx, x, y, btnW, btnH, 5);
    ctx.fillStyle = ready ? '#1e3a5f' : '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = ready ? '#60a5fa' : '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(sk.icon, x + btnW / 2, y + 3);

    // Name
    ctx.fillStyle = ready ? '#bfdbfe' : '#64748b';
    ctx.font = '8px sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(sk.name, x + btnW / 2, y + btnH - 1);

    // CD overlay
    if (!ready) {
      const ratio = sk.activeCd / sk.cd;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, x, y, btnW, btnH * ratio, 5);
      ctx.fill();
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.ceil(sk.activeCd) + 's', x + btnW / 2, y + btnH / 2);
    }

    gs.ui.skillBtns[i] = { x, y, w: btnW, h: btnH, skillId: sk.id };
  }
}

// ─── HUD Overlay ─────────────────────────────────────────────────────────────
function renderHUD(ctx, gs) {
  if (gs.gameOver) {
    renderOverlay(ctx, '게임 오버', '#ef4444', '다시 시도: 화면 탭');
    return;
  }
  if (gs.stageCleared) {
    const grade = getGrade(gs.baseHP);
    renderOverlay(ctx, `스테이지 클리어! ${grade}`, '#22c55e', '계속하려면 탭');
  }
}

function renderOverlay(ctx, title, color, sub) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = color;
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, CW / 2, CH / 2 - 20);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '16px sans-serif';
  ctx.fillText(sub, CW / 2, CH / 2 + 20);
}

function getGrade(baseHP) {
  const r = baseHP / BASE_HP_MAX;
  if (r >= 0.8) return 'S';
  if (r >= 0.5) return 'A';
  if (r >= 0.2) return 'B';
  return 'C';
}

// ─── Tutorial Overlay ─────────────────────────────────────────────────────────
function renderTutorial(ctx, tut) {
  if (!tut.active) return;
  const step = tut.current();
  if (!step) return;

  // Dim background
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, CW, CH);

  // Card
  const cardW = 340, cardH = 160;
  const cardX = (CW - cardW) / 2, cardY = (CH - cardH) / 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 10);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title
  ctx.fillStyle = '#a5b4fc';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(step.title, CW / 2, cardY + 14);

  // Body
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px sans-serif';
  ctx.textBaseline = 'top';
  const lines = step.text.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, CW / 2, cardY + 38 + i * 17);
  });

  // Progress dots
  for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
    ctx.beginPath();
    ctx.arc(CW / 2 - (TUTORIAL_STEPS.length - 1) * 8 + i * 16, cardY + cardH - 18, 4, 0, Math.PI * 2);
    ctx.fillStyle = i === tut.step ? '#6366f1' : '#334155';
    ctx.fill();
  }

  // Tap to continue
  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('탭하여 계속 ▶', CW / 2, cardY + cardH - 4);
}
