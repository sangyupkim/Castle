'use strict';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hpColor(r) {
  return r > 0.6 ? COLORS.hpGreen : r > 0.3 ? COLORS.hpYellow : COLORS.hpRed;
}
function drawHPBar(ctx, x, y, w, h, ratio) {
  ctx.fillStyle = '#1e293b'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hpColor(Math.max(0, ratio));
  ctx.fillRect(x, y, Math.max(0, w * Math.min(1, ratio)), h);
}
function drawMPBar(ctx, x, y, w, h, ratio) {
  ctx.fillStyle = '#1e293b'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.mp;
  ctx.fillRect(x, y, Math.max(0, w * Math.min(1, Math.max(0, ratio))), h);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
function drawBtn(ctx, x, y, w, h, label, bg, fg, on, fontSize) {
  roundRect(ctx, x, y, w, h, 5);
  ctx.fillStyle = on !== false ? bg : '#374151'; ctx.fill();
  ctx.strokeStyle = on !== false ? fg : '#4b5563'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = on !== false ? fg : '#6b7280';
  ctx.font = `bold ${fontSize || 10}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
}
function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy); line = w; yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
  return yy + lineH;
}

// ─── Defense Zone ─────────────────────────────────────────────────────────────
function renderDefense(ctx, gs) {
  ctx.fillStyle = COLORS.defenseBg;
  ctx.fillRect(0, DEFENSE_Y, CW, DEFENSE_H);

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const x = GRID_OX + c * CELL_W, y = GRID_OY + r * CELL_H;
      const isPath  = PATH_CELLS.has(`${c},${r}`);
      const isStart = c === 4 && r === 0, isEnd = c === 4 && r === 6;
      const isCross = c === 4 && r >= 1 && r <= 4;

      ctx.fillStyle = isStart ? '#1e3a5f'
                    : isEnd   ? '#3f1515'
                    : isCross ? '#1a1a0a'
                    : isPath  ? COLORS.pathCell
                    : COLORS.defenseGrid;
      ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
      if (!isPath) {
        ctx.strokeStyle = 'rgba(148,163,184,0.10)'; ctx.lineWidth = 1;
        ctx.strokeRect(x + 1.5, y + 1.5, CELL_W - 3, CELL_H - 3);
      }
    }
  }

  drawPathFlow(ctx, THE_PATH, 'rgba(74,222,128,0.16)');
  labelCell(ctx, '▼출발', GRID_OX + 4 * CELL_W + CELL_W / 2, GRID_OY + CELL_H / 2, '#93c5fd');
  labelCell(ctx, '🏰기지', GRID_OX + 4 * CELL_W + CELL_W / 2, GRID_OY + 6 * CELL_H + CELL_H / 2, '#fca5a5');

  // 건설 미리보기 / 선택 타워 사거리
  const sel = gs.selectedTower;
  if (sel) {
    const c = cellCenter(sel.col, sel.row);
    const st = towerStats(sel);
    ctx.strokeStyle = 'rgba(251,191,36,0.55)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(c.x, c.y, st.range, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
    ctx.strokeRect(GRID_OX + sel.col * CELL_W + 1, GRID_OY + sel.row * CELL_H + 1, CELL_W - 2, CELL_H - 2);
  } else if (gs.hoveredCell) {
    const { c, r } = gs.hoveredCell;
    if (!isBlockedCell(c, r) && !gs.towers.some(t => t.col === c && t.row === r)) {
      const ctr = cellCenter(c, r);
      const tpl = TOWER_TYPES[gs.selectedTowerType];
      const range = tpl.range * BONUSES.towerRangeMult;
      ctx.strokeStyle = 'rgba(148,163,184,0.35)'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(ctr.x, ctr.y, range, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.35;
      ctx.font = `${Math.floor(CELL_H * 0.5)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tpl.icon, ctr.x, ctr.y);
      ctx.globalAlpha = 1;
    }
  }

  for (const t of gs.towers) renderTower(ctx, t, t === gs.selectedTower);

  for (const p of gs.projectiles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.visual ? 2 : 3, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.fill();
  }

  for (const e of gs.defenseEnemies) renderDefEnemy(ctx, e);

  if (gs.hero.placement === 'defense') renderHeroInDefense(ctx, gs.hero);

  // 기지 HP 바
  const maxHP = BASE_HP_MAX + BONUSES.baseHpMax;
  const ratio = gs.baseHP / maxHP;
  drawHPBar(ctx, 6, DEFENSE_H - 14, CW - 12, 9, ratio);
  ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`🏰 기지 ${Math.ceil(gs.baseHP)} / ${maxHP}`, CW / 2, DEFENSE_H - 9);

  // 남은 적 수
  const live = gs.defenseEnemies.filter(e => !e.dead && !e.reached).length;
  if (live > 0) {
    ctx.fillStyle = '#f87171'; ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(`침입자 ${live}`, CW - 6, 4);
  }
}

function labelCell(ctx, text, x, y, color) {
  ctx.fillStyle = color; ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawPathFlow(ctx, path, color) {
  ctx.strokeStyle = color; ctx.lineWidth = Math.min(CELL_W, CELL_H) * 0.55;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  path.forEach(([c, r], i) => {
    const p = cellCenter(c, r);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  ctx.lineWidth = 1;
}

function renderTower(ctx, t, selected) {
  const tpl = TOWER_TYPES[t.typeId];
  const c   = cellCenter(t.col, t.row);
  const kick = t.muzzle > 0 ? 2 : 0;

  ctx.beginPath(); ctx.arc(c.x, c.y, CELL_W * 0.36 + kick, 0, Math.PI * 2);
  ctx.fillStyle = selected ? '#334155' : '#1f2937'; ctx.fill();
  ctx.strokeStyle = tpl.color; ctx.lineWidth = selected ? 2.5 : 1.5; ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = `${Math.floor(CELL_H * 0.42)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tpl.icon, c.x, c.y);

  // 레벨 표시 (별)
  if (t.level > 1) {
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 8px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('★'.repeat(t.level - 1), c.x, c.y + CELL_H * 0.20);
  }
}

function renderDefEnemy(ctx, e) {
  const tpl = ENEMY_TYPES[e.typeId];
  const slowed = e.slowTimer > 0;

  if (slowed) {
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56,189,248,0.28)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
  ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : (slowed ? '#7dd3fc' : tpl.color);
  ctx.fill();
  if (e.armor > 0) {
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 1.5, 0, Math.PI * 2); ctx.stroke();
  }
  drawHPBar(ctx, e.x - e.radius, e.y - e.radius - 6, e.radius * 2, 3, e.hp / e.maxHp);
}

function renderHeroInDefense(ctx, hero) {
  const lv = HERO_LEVELS[hero.level];

  if (hero.dead) {
    ctx.globalAlpha = 0.35;
    ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💀', hero.defX, hero.defY);
    ctx.globalAlpha = 1;
    return;
  }

  ctx.strokeStyle = 'rgba(245,158,11,0.20)'; ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.arc(hero.defX, hero.defY, lv.range, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath(); ctx.arc(hero.defX, hero.defY, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#2a1e00'; ctx.fill();
  ctx.strokeStyle = COLORS.hero; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('👑', hero.defX, hero.defY);

  const maxHp = Math.round(lv.hp * BONUSES.heroStatMult);
  drawHPBar(ctx, hero.defX - 15, hero.defY + 15, 30, 4, hero.hp / maxHp);
  ctx.fillStyle = COLORS.hero; ctx.font = 'bold 8px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(`Lv.${hero.level}`, hero.defX, hero.defY + 21);
}

// ─── Toolbar (타워 팔레트 + 게임 컨트롤) ─────────────────────────────────────
function renderToolbar(ctx, gs) {
  ctx.fillStyle = '#0b1120'; ctx.fillRect(0, TOOLBAR_Y, CW, TOOLBAR_H);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, TOOLBAR_Y + TOOLBAR_H); ctx.lineTo(CW, TOOLBAR_Y + TOOLBAR_H); ctx.stroke();

  const by = TOOLBAR_Y + 4, bh = TOOLBAR_H - 8;

  // ── 게임 컨트롤 (우측) ──────────────────────────────────────────────────
  const cw2 = 36, cgap = 4;
  const c3x = CW - 4 - cw2, c2x = c3x - cw2 - cgap, c1x = c2x - cw2 - cgap;
  drawBtn(ctx, c1x, by, cw2, bh, _paused ? '▶' : '⏸', '#1e293b', '#a5b4fc', true, 13);
  drawBtn(ctx, c2x, by, cw2, bh, `x${gameSpeed()}`, gameSpeed() > 1 ? '#4c1d95' : '#1e293b',
          gameSpeed() > 1 ? '#c4b5fd' : '#94a3b8', true, 11);
  drawBtn(ctx, c3x, by, cw2, bh, SFX.isMuted() ? '🔇' : '🔊', '#1e293b', '#94a3b8', true, 12);
  gs.ui.ctrlPause = { x: c1x, y: by, w: cw2, h: bh };
  gs.ui.ctrlSpeed = { x: c2x, y: by, w: cw2, h: bh };
  gs.ui.ctrlMute  = { x: c3x, y: by, w: cw2, h: bh };

  const leftLimit = c1x - 6;

  // ── 선택된 타워가 있으면 업그레이드 / 판매 모드 ─────────────────────────
  if (gs.selectedTower) {
    const t    = gs.selectedTower;
    const tpl  = TOWER_TYPES[t.typeId];
    const st   = towerStats(t);
    const cost = towerUpgradeCost(t);
    const maxed = cost === null;
    const canUp = !maxed && gs.gold >= cost;

    drawBtn(ctx, 4, by, 116, bh,
      maxed ? '★ 최대 레벨' : `⬆ 강화 ${cost}💰`,
      maxed ? '#1e293b' : canUp ? '#166534' : '#1e293b',
      maxed ? '#f59e0b' : canUp ? '#4ade80' : '#6b7280', maxed ? true : canUp, 10);
    drawBtn(ctx, 124, by, 84, bh, `💰 판매 +${towerSellValue(t)}`, '#3f1d1d', '#fca5a5', true, 9);
    drawBtn(ctx, 212, by, 44, bh, '✕', '#1e293b', '#94a3b8', true, 11);
    gs.ui.towerUpBtn     = { x: 4,   y: by, w: 116, h: bh };
    gs.ui.towerSellBtn   = { x: 124, y: by, w: 84,  h: bh };
    gs.ui.towerCancelBtn = { x: 212, y: by, w: 44,  h: bh };
    gs.ui.towerBtns = [];

    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = tpl.color; ctx.font = 'bold 9px sans-serif';
    ctx.fillText(`${tpl.icon}${tpl.name} Lv.${t.level}`, 262, TOOLBAR_Y + 7);
    ctx.fillStyle = '#64748b'; ctx.font = '8px sans-serif';
    ctx.fillText(`DMG ${st.dmg} · ${st.spd.toFixed(1)}/s`, 262, TOOLBAR_Y + 20);
    ctx.fillText(`처치 ${t.kills}`, 262, TOOLBAR_Y + 30);
    return;
  }

  gs.ui.towerUpBtn = gs.ui.towerSellBtn = gs.ui.towerCancelBtn = null;

  // ── 타워 팔레트 ──────────────────────────────────────────────────────────
  const n = TOWER_ORDER.length;
  const tw = 58, tgap = 4;
  gs.ui.towerBtns = [];
  TOWER_ORDER.forEach((id, i) => {
    const tpl  = TOWER_TYPES[id];
    const x    = 4 + i * (tw + tgap);
    const cost = towerBuildCost(id, gs.towers);
    const on   = gs.selectedTowerType === id;
    const afford = gs.gold >= cost;

    roundRect(ctx, x, by, tw, bh, 5);
    ctx.fillStyle = on ? '#1e3a5f' : afford ? '#131c2b' : '#0f0f17'; ctx.fill();
    ctx.strokeStyle = on ? tpl.color : afford ? '#334155' : '#252b38';
    ctx.lineWidth = on ? 2 : 1; ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.globalAlpha = afford ? 1 : 0.45;
    ctx.fillText(tpl.icon, x + tw / 2, by + 3);
    ctx.fillStyle = afford ? COLORS.gold : '#4b5563';
    ctx.font = 'bold 9px sans-serif'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${cost}💰`, x + tw / 2, by + bh - 2);
    ctx.globalAlpha = 1;

    gs.ui.towerBtns.push({ x, y: by, w: tw, h: bh, typeId: id });
  });

  // 선택된 타워 종류 설명
  const tpl = TOWER_TYPES[gs.selectedTowerType];
  const infoX = 4 + n * (tw + tgap) + 4;
  if (infoX < leftLimit) {
    ctx.save();
    ctx.beginPath(); ctx.rect(infoX, TOOLBAR_Y, leftLimit - infoX, TOOLBAR_H); ctx.clip();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = tpl.color; ctx.font = 'bold 9px sans-serif';
    ctx.fillText(tpl.name, infoX, TOOLBAR_Y + 7);
    ctx.fillStyle = '#64748b'; ctx.font = '8px sans-serif';
    ctx.fillText(`공격 ${Math.round((tpl.dmg + BONUSES.towerDmg))} · ${(tpl.spd * BONUSES.towerSpdMult).toFixed(1)}/s`,
                 infoX, TOOLBAR_Y + 19);
    ctx.fillText(tpl.desc, infoX, TOOLBAR_Y + 29);
    ctx.restore();
  }
}

// ─── UI Bar ──────────────────────────────────────────────────────────────────
function renderUIBar(ctx, gs, wm) {
  ctx.fillStyle = COLORS.uiBar; ctx.fillRect(0, UIBAR_Y, CW, UIBAR_H);
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, UIBAR_Y + UIBAR_H); ctx.lineTo(CW, UIBAR_Y + UIBAR_H); ctx.stroke();

  const cy = UIBAR_Y + UIBAR_H / 2;

  // 웨이브
  ctx.fillStyle = COLORS.text; ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(gs.endless ? `♾️ 웨이브 ${gs.wave + 1}` : `웨이브 ${gs.wave + 1}/${STAGE_WAVES}`, 8, cy - 8);

  // 타이머
  const tv = wm.phase === 'active'       ? Math.ceil(wm.timer)
           : wm.phase === 'intermission' ? Math.ceil(wm.intermissionTimer)
           : WAVE_DURATION;
  const tlabel = wm.phase === 'intermission'
    ? `준비 ${tv}s`
    : `⏱ ${String(Math.floor(tv / 60)).padStart(2, '0')}:${String(tv % 60).padStart(2, '0')}`;
  ctx.fillStyle = wm.phase === 'active' && tv <= 10 ? '#ef4444' : COLORS.gold;
  ctx.font = 'bold 12px monospace'; ctx.fillText(tlabel, 8, cy + 9);

  // 골드
  ctx.fillStyle = COLORS.gold; ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`💰 ${Math.floor(gs.gold)}`, CW / 2, cy - 7);

  // 전투 상태
  const bp   = gs.battle.phase;
  const earn = gs.battle.goldEarned;
  const bLabel = bp === 'hire'          ? '병력 고용 중'
               : bp === 'fighting'      ? (earn > 0 ? `⚔️ +${earn}💰 적립 중` : '⚔️ 전투 중')
               : bp === 'won'           ? '✅ 전투 승리'
               : bp === 'idle_defeated' ? '❌ 병력 전멸'
               : bp === 'lost'          ? '❌ 전멸'
               : '';
  ctx.fillStyle = bp === 'fighting' || bp === 'won' ? '#22c55e'
                : bp.includes('defeat') || bp === 'lost' ? '#ef4444' : COLORS.textDim;
  ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(bLabel, CW / 2, cy + 8);

  // 누적 획득 골드 / 영혼석
  ctx.fillStyle = COLORS.textDim; ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`누적 ${gs.battle.totalGoldEarned}💰  ·  보유 ${gs.soulStones}💎`, 8, cy + 22);

  // 웨이브 시작 버튼
  const bw = 110, bh = 38, bx = CW - bw - 6, by2 = UIBAR_Y + (UIBAR_H - bh) / 2;
  const canStart = wm.phase === 'idle' && gs.battle.ourTeam.length > 0;
  if (wm.phase === 'idle') {
    drawBtn(ctx, bx, by2, bw, bh, '▶ 웨이브 시작', '#4f46e5', '#a5b4fc', canStart);
  } else if (wm.phase === 'active') {
    drawBtn(ctx, bx, by2, bw, bh, '진행 중...', '#1e293b', '#475569', false);
  } else if (wm.phase === 'upgradePick') {
    drawBtn(ctx, bx, by2, bw, bh, '강화 선택 중...', '#2d1b69', '#a78bfa', false);
  } else {
    drawBtn(ctx, bx, by2, bw, bh, `⏭ 건너뛰기 ${Math.ceil(wm.intermissionTimer)}s`, '#1e293b', '#a5b4fc', true, 9);
  }
  gs.ui.waveBtn = { x: bx, y: by2, w: bw, h: bh };
}

// ─── Battle Zone ─────────────────────────────────────────────────────────────
function renderBattle(ctx, gs) {
  ctx.fillStyle = '#0a1520'; ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  for (let yy = BATTLE_Y; yy < BATTLE_Y + BATTLE_H; yy += 40) {
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(CW, yy); ctx.stroke();
  }

  if (gs.battle.phase === 'hire') renderHirePhase(ctx, gs);
  else                            renderFightPhase(ctx, gs);
}

// ─── 고용 화면 ────────────────────────────────────────────────────────────────
function renderHirePhase(ctx, gs) {
  const { battle, hero } = gs;

  ctx.fillStyle = '#a5b4fc'; ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('병력 고용 & 영웅 배치', CW / 2, BATTLE_Y + 6);

  // ── 영웅 패널 ────────────────────────────────────────────────────────────
  const hpanelY = BATTLE_Y + 24;
  const lv = HERO_LEVELS[hero.level];
  const hMax = Math.round(lv.hp * BONUSES.heroStatMult);

  roundRect(ctx, 6, hpanelY, 180, 52, 6);
  ctx.fillStyle = '#1a2535'; ctx.fill();
  ctx.strokeStyle = hero.dead ? '#7f1d1d' : COLORS.hero; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '18px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(hero.dead ? '💀' : '👑', 12, hpanelY + 4);
  ctx.fillStyle = hero.dead ? '#f87171' : COLORS.hero; ctx.font = 'bold 10px sans-serif';
  ctx.fillText(hero.dead ? `부활까지 ${Math.ceil(hero.reviveTimer)}s` : `영웅  Lv.${hero.level}`, 34, hpanelY + 4);
  ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif';
  ctx.fillText(`ATK ${Math.round((lv.atk + BONUSES.heroAtk) * BONUSES.heroStatMult)}  HP ${Math.ceil(hero.hp)}/${hMax}  DEF ${Math.round(lv.def * BONUSES.heroStatMult)}`,
               34, hpanelY + 18);

  const expNeed  = HERO_LEVELS[hero.level].expNeeded;
  const expRatio = hero.level >= HERO_MAX_LEVEL ? 1 : hero.exp / expNeed;
  ctx.fillStyle = '#1e293b'; ctx.fillRect(12, hpanelY + 32, 168, 6);
  ctx.fillStyle = '#f59e0b'; ctx.fillRect(12, hpanelY + 32, 168 * Math.min(1, expRatio), 6);
  ctx.fillStyle = '#64748b'; ctx.font = '8px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(hero.level >= HERO_MAX_LEVEL ? 'MAX LEVEL' : `EXP ${Math.floor(hero.exp)}/${expNeed}`, 180, hpanelY + 42);

  // 배치 버튼
  const btnY = hpanelY + 56, btnW = 86, btnH = 28;
  const pDef = hero.placement === 'defense';
  const pBat = hero.placement === 'battle';
  const alive = !hero.dead;

  drawBtn(ctx, 6, btnY, btnW, btnH, pDef ? '✅ 상단 배치' : '상단 배치',
    pDef ? '#064e3b' : '#1e293b', pDef ? '#34d399' : '#60a5fa', alive);
  drawBtn(ctx, 6 + btnW + 4, btnY, btnW, btnH, pBat ? '✅ 하단 배치' : '하단 배치',
    pBat ? '#4c1d95' : '#1e293b', pBat ? '#a78bfa' : '#f87171', alive);

  gs.ui.heroDefBtn = { x: 6, y: btnY, w: btnW, h: btnH };
  gs.ui.heroBatBtn = { x: 6 + btnW + 4, y: btnY, w: btnW, h: btnH };

  ctx.fillStyle = '#475569'; ctx.font = '8px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('상단: 경로 공격 + EXP (경로 탭으로 이동)', 8, btnY + btnH + 4);
  ctx.fillText('하단: 전투 참여 (전사 시 부활 대기)', 8, btnY + btnH + 14);

  // ── 병력 고용 카드 ──────────────────────────────────────────────────────
  const cardW = 52, cardGap = 3, cardStartX = 194, cardY = hpanelY, cardH = 58;
  gs.ui.hireCards = [];

  UNIT_ORDER.forEach((id, i) => {
    const ut = UNIT_TYPES[id];
    const cx = cardStartX + i * (cardW + cardGap);
    const cost = hireCost(id);
    const canAfford = gs.gold >= cost;

    roundRect(ctx, cx, cardY, cardW, cardH, 5);
    ctx.fillStyle = canAfford ? '#1e293b' : '#111827'; ctx.fill();
    ctx.strokeStyle = canAfford ? ut.color : '#374151'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(ut.icon, cx + cardW / 2, cardY + 4);
    ctx.fillStyle = canAfford ? '#e2e8f0' : '#64748b';
    ctx.font = 'bold 9px sans-serif'; ctx.textBaseline = 'bottom';
    ctx.fillText(ut.name, cx + cardW / 2, cardY + cardH - 16);
    ctx.fillStyle = canAfford ? COLORS.gold : '#64748b';
    ctx.font = '9px sans-serif';
    ctx.fillText(`💰${cost}`, cx + cardW / 2, cardY + cardH - 4);
    gs.ui.hireCards.push({ x: cx, y: cardY, w: cardW, h: cardH, typeId: id });
  });

  // ── 고용된 병력 슬롯 ────────────────────────────────────────────────────
  const lineY = hpanelY + 110;
  const hired = battle.ourTeam.filter(u => !u.isHero);
  ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`고용 병력 (${hired.length}/${battle.maxSlots})   탭하면 해고`, 6, lineY);

  const heroSlotW = gs.hero.placement === 'battle' ? 60 : 0;
  const avail = CW - 12 - heroSlotW;
  const slotGap = 6;
  const slotW = Math.max(34, Math.min(50, Math.floor((avail - (battle.maxSlots - 1) * slotGap) / battle.maxSlots)));
  const slotH = 50;
  gs.ui.hiredSlots = [];

  for (let i = 0; i < battle.maxSlots; i++) {
    const sx = 6 + i * (slotW + slotGap);
    const sy = lineY + 16;
    const unit = hired[i];

    roundRect(ctx, sx, sy, slotW, slotH, 5);
    ctx.fillStyle = unit ? '#1e3a5f' : '#0f172a'; ctx.fill();
    ctx.strokeStyle = unit ? (unit.color || '#60a5fa') : '#334155'; ctx.lineWidth = 1.5; ctx.stroke();

    if (unit) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(unit.icon, sx + slotW / 2, sy + 17);
      drawHPBar(ctx, sx + 4, sy + slotH - 15, slotW - 8, 4, unit.hp / unit.maxHp);
      ctx.fillStyle = '#94a3b8'; ctx.font = '8px sans-serif'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${Math.ceil(unit.hp)}/${unit.maxHp}`, sx + slotW / 2, sy + slotH - 2);
      ctx.fillStyle = '#ef4444'; ctx.font = '9px sans-serif'; ctx.textBaseline = 'top';
      ctx.fillText('✕', sx + slotW - 9, sy + 2);
    } else {
      ctx.fillStyle = '#334155'; ctx.font = '20px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', sx + slotW / 2, sy + slotH / 2);
    }
    gs.ui.hiredSlots.push({ x: sx, y: sy, w: slotW, h: slotH, idx: i });
  }

  if (gs.hero.placement === 'battle') {
    const hsx = 6 + battle.maxSlots * (slotW + slotGap) + 4;
    const hsy = lineY + 16;
    roundRect(ctx, hsx, hsy, Math.min(50, heroSlotW - 6), slotH, 5);
    ctx.fillStyle = '#2a1e00'; ctx.fill();
    ctx.strokeStyle = COLORS.hero; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('👑', hsx + 25, hsy + 20);
    ctx.fillStyle = COLORS.hero; ctx.font = 'bold 8px sans-serif'; ctx.textBaseline = 'bottom';
    ctx.fillText('영웅', hsx + 25, hsy + slotH - 2);
  }

  // ── 이번 웨이브 몬스터 미리보기 ──────────────────────────────────────────
  const epY = lineY + 82;
  ctx.fillStyle = '#f87171'; ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('이번 웨이브 등장:', 6, epY);

  const wdef = getWaveDef(gs.wave) || { battleSpawns: [], defenseEnemies: [] };
  (wdef.battleSpawns || []).forEach((s, i) => {
    const t = BATTLE_MOB_TYPES[s.type]; if (!t) return;
    const ex = 6 + i * 50;
    roundRect(ctx, ex, epY + 14, 45, 40, 4);
    ctx.fillStyle = '#1a0d0d'; ctx.fill();
    ctx.strokeStyle = t.color; ctx.lineWidth = t.isBoss ? 2 : 1; ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.icon, ex + 22, epY + 29);
    ctx.fillStyle = '#94a3b8'; ctx.font = '8px sans-serif'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${Number(s.interval).toFixed(0)}s`, ex + 22, epY + 52);
  });

  // 상단 침입자 미리보기
  const dOffX = 6 + (wdef.battleSpawns || []).length * 50 + 12;
  ctx.fillStyle = '#64748b'; ctx.font = '8px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('상단 침입자', dOffX, epY + 14);
  (wdef.defenseEnemies || []).forEach((d, i) => {
    const t = ENEMY_TYPES[d.type]; if (!t) return;
    ctx.fillStyle = t.color; ctx.font = '9px sans-serif';
    ctx.fillText(`${t.name} ×${d.count}`, dOffX, epY + 26 + i * 11);
  });

  // ── 케이브 패널 ──────────────────────────────────────────────────────────
  const caveY = epY + 62;
  const cv     = CAVE_LEVELS[gs.caveLevel];
  const nextCv = CAVE_LEVELS[gs.caveLevel + 1] || null;

  roundRect(ctx, 6, caveY, CW - 12, 52, 6);
  ctx.fillStyle = '#0a0d1a'; ctx.fill();
  ctx.strokeStyle = '#4c1d95'; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.fillStyle = '#a78bfa'; ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`🗿 몬스터 케이브  ${cv.label} (Lv.${gs.caveLevel}/${CAVE_MAX_LEVEL})`, 12, caveY + 5);
  ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif';
  ctx.fillText(`현재: 몬스터 ×${cv.statMult} 강함  /  보상 ×${cv.goldMult}`, 12, caveY + 19);

  if (nextCv) {
    ctx.fillText(`다음: 몬스터 ×${nextCv.statMult}  /  보상 ×${nextCv.goldMult}`, 12, caveY + 31);
    const canAfford = gs.gold >= nextCv.upgradeCost;
    const bw = 130, bh = 24, bx = CW - 12 - bw, by = caveY + 14;
    drawBtn(ctx, bx, by, bw, bh, `업그레이드  ${nextCv.upgradeCost}💰`,
      canAfford ? '#4c1d95' : '#1e293b', canAfford ? '#a78bfa' : '#6b7280', canAfford);
    gs.ui.caveBtn = { x: bx, y: by, w: bw, h: bh };
  } else {
    gs.ui.caveBtn = null;
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 9px sans-serif';
    ctx.fillText('★ 최고 등급 달성!', 12, caveY + 31);
  }

  // ── 획득한 강화 목록 ─────────────────────────────────────────────────────
  const upY = caveY + 56;
  if (gs.activeUpgrades.length) {
    ctx.fillStyle = '#64748b'; ctx.font = '8px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('획득 강화:', 6, upY);
    const icons = gs.activeUpgrades
      .map(id => (UPGRADE_CARDS.find(c => c.id === id) || {}).icon || '')
      .join(' ');
    ctx.fillStyle = '#a5b4fc'; ctx.font = '10px sans-serif';
    ctx.fillText(icons.slice(0, 90), 56, upY - 1);
  }

  // ── 안내 ─────────────────────────────────────────────────────────────────
  ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  if (!battle.ourTeam.length) {
    ctx.fillStyle = '#f87171';
    ctx.fillText('⚠️ 병력을 최소 1명 고용해야 웨이브를 시작할 수 있습니다', CW / 2, BATTLE_Y + BATTLE_H - 6);
  } else if (gs.hero.placement === 'none' && !gs.hero.dead) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('💡 영웅 배치를 고르면 더 유리합니다 (상단/하단)', CW / 2, BATTLE_Y + BATTLE_H - 6);
  } else {
    ctx.fillStyle = '#64748b';
    ctx.fillText('준비 완료 → 우측 [웨이브 시작] 버튼 (Space)', CW / 2, BATTLE_Y + BATTLE_H - 6);
  }
}

// ─── 전투 화면 ────────────────────────────────────────────────────────────────
function renderFightPhase(ctx, gs) {
  const { battle } = gs;

  ctx.fillStyle = '#0a1520';
  ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H);

  const strW = 60;
  const sOff = battle.scrollX % (strW * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.018)';
  for (let x = -sOff; x < CW + strW * 2; x += strW * 2) {
    ctx.fillRect(x, BATTLE_Y, strW, BATTLE_H - BATTLE_LOG_H);
  }

  ctx.strokeStyle = '#1e2d40'; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(CW / 2, BATTLE_Y + 35); ctx.lineTo(CW / 2, BATTLE_Y + BATTLE_H - BATTLE_LOG_H);
  ctx.stroke();

  ctx.font = 'bold 11px sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  ctx.fillStyle = '#60a5fa'; ctx.fillText('우리팀', BATTLE_TEAM_X, BATTLE_Y + 6);
  ctx.fillStyle = '#f87171'; ctx.fillText('적팀',   BATTLE_ENEMY_X, BATTLE_Y + 6);

  const pct = Math.round(battle.killCount * KILL_SCALE * 100);
  ctx.font = '8px sans-serif'; ctx.fillStyle = '#7c3aed'; ctx.textAlign = 'center';
  ctx.fillText(`🗿Lv.${gs.caveLevel}  처치 ${battle.killCount}회  강화 +${pct}%`, CW / 2, BATTLE_Y + 20);

  const px = BATTLE_TEAM_X + battle.playerDrift;
  battle.ourTeam.forEach((u, i) => renderBattleUnit(ctx, u, px, unitY(i)));

  for (const e of battle.enemyTeam) {
    const alpha = e.dead ? Math.max(0, 1 - e.deadTimer / 0.7) : 1;
    if (alpha > 0.01) renderBattleUnit(ctx, e, e.drawX, e.drawY, alpha);
  }

  for (const f of battle.floaties) {
    ctx.globalAlpha = Math.max(0, f.life / 1.2);
    ctx.fillStyle = f.color; ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // 전투 로그
  const logY = BATTLE_Y + BATTLE_H - BATTLE_LOG_H;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, logY - 2, CW, BATTLE_LOG_H + 2);
  battle.log.slice(0, 4).forEach((e, i) => {
    ctx.globalAlpha = Math.min(1, e.timer / 0.8);
    ctx.fillStyle = e.color; ctx.font = '9px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(e.text, 6, logY + 2 + i * 14);
  });
  ctx.globalAlpha = 1;

  // 틱 프로그레스 바
  const tp = battle.tickTimer / TICK_INTERVAL;
  ctx.fillStyle = '#1e293b'; ctx.fillRect(6, BATTLE_Y + BATTLE_H - 7, CW - 12, 5);
  ctx.fillStyle = '#6366f1'; ctx.fillRect(6, BATTLE_Y + BATTLE_H - 7, (CW - 12) * tp, 5);

  // 결과 오버레이
  if (battle.phase === 'won') {
    ctx.fillStyle = 'rgba(0,40,0,0.72)'; ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H - BATTLE_LOG_H);
    ctx.fillStyle = '#22c55e'; ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`전투 승리! 🎉 +${battle.goldEarned}💰`, CW / 2, BATTLE_Y + (BATTLE_H - BATTLE_LOG_H) / 2);
  } else if (battle.phase === 'idle_defeated' || battle.phase === 'lost') {
    ctx.fillStyle = 'rgba(40,0,0,0.72)'; ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H - BATTLE_LOG_H);
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`병력 전멸  획득: ${battle.goldEarned}💰`, CW / 2, BATTLE_Y + (BATTLE_H - BATTLE_LOG_H) / 2);
  }
}

function renderBattleUnit(ctx, u, x, y, alpha) {
  const r = BATTLE_UNIT_R;
  if (alpha !== undefined) ctx.globalAlpha = alpha;

  if (u.dead) {
    if (u.isPlayer) {
      ctx.globalAlpha = (alpha !== undefined ? alpha : 1) * 0.35;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#374151'; ctx.fill();
      ctx.globalAlpha = (alpha !== undefined ? alpha : 1) * 0.5;
      ctx.font = `${Math.floor(r * 0.6)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💀', x, y);
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (u.flashTimer > 0) {
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = u.flashColor; ctx.fill();
  }

  // 보호막 링
  if (u.shield > 0) {
    ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.shield; ctx.lineWidth = 2.5; ctx.stroke();
  }

  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = u.isHero ? COLORS.hero : u.color; ctx.fill();
  ctx.strokeStyle = u.isBoss ? '#fbbf24' : u.isHero ? '#fef08a' : '#fff';
  ctx.lineWidth = (u.isHero || u.isBoss) ? 2.5 : 1.5; ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = `${Math.floor(r * 0.85)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(u.icon, x, y + 1);

  const bw = r * 2 + 8;
  drawHPBar(ctx, x - bw / 2, y + r + 3, bw, 4, u.hp / u.maxHp);
  if (BATTLE_SHOW_MP && u.maxMp > 0) drawMPBar(ctx, x - bw / 2, y + r + 9, bw, 3, u.mp / u.maxMp);

  // 이름/HP는 원 옆에 표기 — 슬롯이 늘어나도 아래 유닛과 겹치지 않는다
  ctx.font = '9px sans-serif'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#cbd5e1';
  if (u.isPlayer) {
    ctx.textAlign = 'left';
    ctx.fillText(`${u.name} ${Math.ceil(u.hp)}`, x + r + 7, y - 4);
  } else {
    ctx.textAlign = 'right';
    ctx.fillText(`${u.name} ${Math.ceil(u.hp)}`, x - r - 7, y - 4);
  }
  if (u.shield > 0) {
    ctx.fillStyle = COLORS.shield; ctx.font = '8px sans-serif';
    ctx.fillText(`🛡${Math.ceil(u.shield)}`, u.isPlayer ? x + r + 7 : x - r - 7, y + 7);
  }

  ctx.globalAlpha = 1;
}

// ─── HUD (게임오버 / 클리어) ─────────────────────────────────────────────────
function renderHUD(ctx, gs) {
  if (gs.gameOver) {
    const earned = gs.lastSoulEarned !== undefined ? gs.lastSoulEarned : calcSoulStones(gs);
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, CW, CH);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 28px sans-serif';
    ctx.fillText('기지 함락 — 게임 오버', CW / 2, CH / 2 - 80);
    ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif';
    ctx.fillText(`${gs.wave}웨이브 클리어  ·  처치 ${gs.battle.runKills || 0}  ·  획득 ${gs.battle.totalGoldEarned}💰`,
                 CW / 2, CH / 2 - 46);
    ctx.fillStyle = '#a78bfa'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`💎 영혼석 +${earned}`, CW / 2, CH / 2 - 12);
    ctx.fillStyle = '#c4b5fd'; ctx.font = '12px sans-serif';
    ctx.fillText(`보유: ${gs.soulStones}💎`, CW / 2, CH / 2 + 12);
    ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif';
    ctx.fillText(`최고 기록: ${gs.stats.bestWave}웨이브  ·  누적 처치 ${gs.stats.totalKills}`, CW / 2, CH / 2 + 40);
    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText('탭하여 영구 강화 화면으로 ▶', CW / 2, CH / 2 + 80);
    return;
  }

  if (gs.stageCleared) {
    const g = gs.baseHP >= 80 ? 'S' : gs.baseHP >= 50 ? 'A' : gs.baseHP >= 20 ? 'B' : 'C';
    const earned = gs.lastSoulEarned !== undefined ? gs.lastSoulEarned : calcSoulStones(gs);
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, CW, CH);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#22c55e'; ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`스테이지 클리어!  등급 ${g}`, CW / 2, CH / 2 - 100);
    ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif';
    ctx.fillText(`${STAGE_WAVES}웨이브 완주  ·  기지 HP ${Math.ceil(gs.baseHP)}`, CW / 2, CH / 2 - 68);
    ctx.fillText(`누적 획득 ${gs.battle.totalGoldEarned}💰  ·  처치 ${gs.battle.runKills || 0}`, CW / 2, CH / 2 - 48);
    ctx.fillStyle = '#a78bfa'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`💎 영혼석 +${earned}`, CW / 2, CH / 2 - 14);

    const bw = 250, bh = 46;
    const bx = (CW - bw) / 2;
    roundRect(ctx, bx, CH / 2 + 20, bw, bh, 10);
    ctx.fillStyle = '#4c1d95'; ctx.fill();
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e9d5ff'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('♾️ 무한 모드로 계속 도전', CW / 2, CH / 2 + 43);
    gs.ui.clearEndlessBtn = { x: bx, y: CH / 2 + 20, w: bw, h: bh };

    ctx.fillStyle = '#94a3b8'; ctx.font = '12px sans-serif';
    ctx.fillText('또는 아무 곳이나 탭하여 영구 강화 화면으로 ▶', CW / 2, CH / 2 + 96);
    return;
  }

  gs.ui.clearEndlessBtn = null;
}

// ─── 일시정지 오버레이 ───────────────────────────────────────────────────────
function renderPauseOverlay(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⏸ 일시정지', CW / 2, CH / 2 - 12);
  ctx.fillStyle = '#94a3b8'; ctx.font = '12px sans-serif';
  ctx.fillText('툴바의 ▶ 버튼 또는 P 키로 재개', CW / 2, CH / 2 + 18);
}

// ─── 업그레이드 픽 화면 ──────────────────────────────────────────────────────
function renderUpgradePick(ctx, gs) {
  ctx.fillStyle = 'rgba(3,5,14,0.95)'; ctx.fillRect(0, 0, CW, CH);

  ctx.fillStyle = '#a5b4fc'; ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('웨이브 클리어! 강화를 선택하세요', CW / 2, 30);
  ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif';
  ctx.fillText(`웨이브 ${gs.wave + 1} 완료  ·  획득 강화 ${gs.activeUpgrades.length}개`, CW / 2, 52);

  const cards = gs.upgradePick.cards;
  const cardW = 132, cardH = 200, gap = 10;
  const totalW = cards.length * cardW + (cards.length - 1) * gap;
  const startX = (CW - totalW) / 2;
  const startY = 82;

  gs.ui.upgradeCards = [];

  cards.forEach((card, i) => {
    const cx = startX + i * (cardW + gap);
    const cy = startY;

    const gradeColor = card.grade === 'epic' ? '#a78bfa'
                     : card.grade === 'rare' ? '#60a5fa' : '#94a3b8';
    const gradeBg    = card.grade === 'epic' ? '#1e0a3c'
                     : card.grade === 'rare' ? '#0a1e3c' : '#0f172a';

    roundRect(ctx, cx, cy, cardW, cardH, 8);
    ctx.fillStyle = gradeBg; ctx.fill();
    ctx.strokeStyle = gradeColor; ctx.lineWidth = 2; ctx.stroke();

    const gradeLabel = card.grade === 'epic' ? '★ EPIC' : card.grade === 'rare' ? '◆ RARE' : '● COMMON';
    ctx.fillStyle = gradeColor; ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(gradeLabel, cx + cardW / 2, cy + 8);

    ctx.font = '34px sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText(card.icon, cx + cardW / 2, cy + 58);

    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 12px sans-serif'; ctx.textBaseline = 'top';
    ctx.fillText(card.name, cx + cardW / 2, cy + 92);

    const catLabel = card.cat === 'tower' ? '타워' : card.cat === 'unit' ? '유닛'
                   : card.cat === 'hero' ? '영웅' : card.cat === 'base' ? '기지'
                   : card.cat === 'cave' ? '케이브' : '자원';
    ctx.fillStyle = gradeColor; ctx.font = '9px sans-serif';
    ctx.fillText(catLabel, cx + cardW / 2, cy + 110);

    ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif';
    wrapText(ctx, card.desc, cx + cardW / 2, cy + 130, cardW - 14, 13);

    roundRect(ctx, cx + 8, cy + cardH - 30, cardW - 16, 22, 5);
    ctx.fillStyle = gradeColor; ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 10px sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText('선택', cx + cardW / 2, cy + cardH - 19);

    gs.ui.upgradeCards.push({ x: cx, y: cy, w: cardW, h: cardH, card });
  });

  // 현재 빌드 요약
  const sy = startY + cardH + 22;
  roundRect(ctx, 16, sy - 10, CW - 32, 118, 8);
  ctx.fillStyle = '#0b1020'; ctx.fill();
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif';
  ctx.fillText('현재 빌드', CW / 2, sy);
  ctx.fillStyle = '#a5b4fc'; ctx.font = '13px sans-serif';
  const icons = gs.activeUpgrades.map(id => (UPGRADE_CARDS.find(c => c.id === id) || {}).icon || '').join(' ');
  wrapText(ctx, icons || '—', CW / 2, sy + 16, CW - 40, 18);

  const stats = [
    `타워 공격 +${BONUSES.towerDmg}  공속 ×${BONUSES.towerSpdMult.toFixed(2)}  사거리 ×${BONUSES.towerRangeMult.toFixed(2)}`,
    `아군 ATK +${BONUSES.unitAtk}  HP +${BONUSES.unitHp}  DEF +${BONUSES.unitDef}  슬롯 ${4 + BONUSES.maxSlotBonus}`,
    `전투 골드 ×${BONUSES.battleGoldMult.toFixed(2)}  몹 HP ×${BONUSES.mobHpMult.toFixed(2)}`
  ];
  ctx.fillStyle = '#475569'; ctx.font = '9px sans-serif';
  stats.forEach((s, i) => ctx.fillText(s, CW / 2, sy + 58 + i * 13));
}

// ─── 메타 업그레이드 화면 ────────────────────────────────────────────────────
function renderMetaScreen(ctx, gs) {
  ctx.fillStyle = 'rgba(5,5,20,0.97)'; ctx.fillRect(0, 0, CW, CH);

  ctx.fillStyle = '#a78bfa'; ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('💎 영구 강화', CW / 2, 10);
  ctx.fillStyle = '#c4b5fd'; ctx.font = '12px sans-serif';
  ctx.fillText(`보유 영혼석: ${gs.soulStones}`, CW / 2, 33);
  ctx.fillStyle = '#475569'; ctx.font = '9px sans-serif';
  ctx.fillText(`플레이 ${gs.stats.runs}회  ·  최고 ${gs.stats.bestWave}웨이브  ·  누적 처치 ${gs.stats.totalKills}  ·  누적 ${gs.stats.totalGold}💰`,
               CW / 2, 50);

  const upgs = META_UPGRADES;
  const cw2 = 210, ch2 = 46, cols = 2, gap = 6;
  const gridW = cols * cw2 + (cols - 1) * gap;
  const startX = (CW - gridW) / 2;
  const startY = 68;

  gs.ui.metaCards = [];

  upgs.forEach((upg, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = startX + col * (cw2 + gap);
    const cy = startY + row * (ch2 + gap);
    const curLv = gs.metaUpgrades[upg.id] || 0;
    const maxed = curLv >= upg.maxLv;
    const cost  = metaUpgradeCost(upg, curLv);
    const canBuy = !maxed && gs.soulStones >= cost;

    roundRect(ctx, cx, cy, cw2, ch2, 6);
    ctx.fillStyle = maxed ? '#14120a' : canBuy ? '#0d1a2e' : '#0f0f1a';
    ctx.fill();
    ctx.strokeStyle = maxed ? '#f59e0b' : canBuy ? '#6366f1' : '#374151';
    ctx.lineWidth = 1.5; ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(upg.icon, cx + 6, cy + 7);

    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 9px sans-serif';
    ctx.fillText(upg.name, cx + 24, cy + 7);

    ctx.fillStyle = '#64748b'; ctx.font = '8px sans-serif';
    ctx.fillText(curLv > 0 ? upg.desc(curLv) : upg.desc(1) + ' (미구매)', cx + 24, cy + 20);

    for (let l = 0; l < upg.maxLv; l++) {
      ctx.beginPath(); ctx.arc(cx + 27 + l * 10, cy + 35, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = l < curLv ? '#f59e0b' : '#334155'; ctx.fill();
    }

    if (!maxed) {
      const bw = 52, bh = 18;
      roundRect(ctx, cx + cw2 - bw - 4, cy + (ch2 - bh) / 2, bw, bh, 4);
      ctx.fillStyle = canBuy ? '#4f46e5' : '#1e293b'; ctx.fill();
      ctx.fillStyle = canBuy ? '#a5b4fc' : '#475569';
      ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${cost}💎`, cx + cw2 - bw / 2 - 4, cy + ch2 / 2);
      gs.ui.metaCards.push({ x: cx, y: cy, w: cw2, h: ch2, upg });
    } else {
      ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('MAX', cx + cw2 - 30, cy + ch2 / 2);
    }
  });

  const rows = Math.ceil(upgs.length / cols);
  const btnY = startY + rows * (ch2 + gap) + 10;

  const bw = 220, bh = 42, bx = (CW - bw) / 2;
  roundRect(ctx, bx, btnY, bw, bh, 8);
  ctx.fillStyle = '#22c55e'; ctx.fill();
  ctx.fillStyle = '#0f172a'; ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('▶ 새 게임 시작', bx + bw / 2, btnY + bh / 2);
  gs.ui.metaStartBtn = { x: bx, y: btnY, w: bw, h: bh };

  const tw = 150, th = 26, tx = (CW - tw) / 2, ty = btnY + bh + 8;
  drawBtn(ctx, tx, ty, tw, th, '📖 튜토리얼 다시 보기', '#1e293b', '#94a3b8', true, 10);
  gs.ui.metaTutBtn = { x: tx, y: ty, w: tw, h: th };
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────
function renderTutorial(ctx, tut) {
  if (!tut.active) return;
  const step = tut.current(); if (!step) return;
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, CW, CH);
  const cw = 356, ch = 190, cx = (CW - cw) / 2, cy = (CH - ch) / 2;
  roundRect(ctx, cx, cy, cw, ch, 10);
  ctx.fillStyle = '#0f172a'; ctx.fill();
  ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#a5b4fc'; ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(step.title, CW / 2, cy + 14);
  ctx.fillStyle = '#e2e8f0'; ctx.font = '12px sans-serif';
  step.text.split('\n').forEach((line, i) => ctx.fillText(line, CW / 2, cy + 40 + i * 17));
  for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
    ctx.beginPath();
    ctx.arc(CW / 2 - (TUTORIAL_STEPS.length - 1) * 7 + i * 14, cy + ch - 16, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = i === tut.step ? '#6366f1' : '#334155'; ctx.fill();
  }
  ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif';
  ctx.textBaseline = 'bottom'; ctx.fillText('탭하여 계속 ▶', CW / 2, cy + ch - 3);
}

// ─── 타이틀 화면 ─────────────────────────────────────────────────────────────
function renderTitleScreen(ctx, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  if (_titleImg.complete && _titleImg.naturalWidth > 0) {
    const iw = _titleImg.naturalWidth, ih = _titleImg.naturalHeight;
    const scale = Math.max(CW / iw, CH / ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(_titleImg, (CW - dw) / 2, (CH - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CW, CH);
  }

  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CW, 220);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 38px sans-serif';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 12;
  ctx.fillText('듀얼 프론티어', CW / 2, 30);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('Dual Frontier', CW / 2, 78);
  ctx.shadowBlur = 0;

  const grad2 = ctx.createLinearGradient(0, CH - 220, 0, CH);
  grad2.addColorStop(0, 'rgba(0,0,0,0)');
  grad2.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = grad2;
  ctx.fillRect(0, CH - 220, CW, 220);

  if (_stats.bestWave > 0) {
    ctx.fillStyle = '#c4b5fd'; ctx.font = '12px sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`최고 기록 ${_stats.bestWave}웨이브  ·  보유 영혼석 ${_soulStones}💎`, CW / 2, CH - 150);
  }

  const bw = 220, bh = 52, bx = (CW - bw) / 2, by = CH - 120;
  roundRect(ctx, bx, by, bw, bh, 26);
  const btnGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
  btnGrad.addColorStop(0, '#6366f1');
  btnGrad.addColorStop(1, '#4f46e5');
  ctx.fillStyle = btnGrad; ctx.fill();
  ctx.strokeStyle = '#a5b4fc'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('▶  게임 시작', CW / 2, by + bh / 2);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px sans-serif'; ctx.textBaseline = 'bottom';
  ctx.fillText('화면을 탭하여 시작', CW / 2, CH - 22);

  ctx.restore();
}
