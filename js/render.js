'use strict';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hpColor(r) {
  return r > 0.6 ? COLORS.hpGreen : r > 0.3 ? COLORS.hpYellow : COLORS.hpRed;
}
function drawHPBar(ctx, x, y, w, h, ratio) {
  ctx.fillStyle = '#1e293b'; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = hpColor(Math.max(0,ratio));
  ctx.fillRect(x, y, Math.max(0, w*ratio), h);
}
function drawMPBar(ctx, x, y, w, h, ratio) {
  ctx.fillStyle = '#1e293b'; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = COLORS.mp;
  ctx.fillRect(x, y, Math.max(0, w*Math.max(0,ratio)), h);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}
function drawBtn(ctx, x, y, w, h, label, bg, fg, on) {
  roundRect(ctx, x, y, w, h, 5);
  ctx.fillStyle = on!==false ? bg : '#374151'; ctx.fill();
  ctx.strokeStyle = on!==false ? fg : '#4b5563'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle = on!==false ? fg : '#6b7280';
  ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label, x+w/2, y+h/2);
}

// ─── Defense Zone ─────────────────────────────────────────────────────────────
function renderDefense(ctx, gs) {
  ctx.fillStyle = COLORS.defenseBg;
  ctx.fillRect(0, DEFENSE_Y, CW, DEFENSE_H);

  for (let r=0; r<GRID_ROWS; r++) {
    for (let c=0; c<GRID_COLS; c++) {
      const x = GRID_OX + c*CELL_W, y = GRID_OY + r*CELL_H;
      const isPath  = PATH_CELLS.has(`${c},${r}`);
      const isStart = c===4 && r===0, isEnd = c===4 && r===6;
      const isCross = c===4 && r>=1 && r<=4;

      ctx.fillStyle = isStart ? '#1e3a5f'
                    : isEnd   ? '#3f1515'
                    : isCross ? '#1a1a0a'
                    : isPath  ? COLORS.pathCell
                    : COLORS.defenseGrid;
      ctx.fillRect(x+1, y+1, CELL_W-2, CELL_H-2);

      if (isPath && !isStart && !isEnd) {
        ctx.fillStyle = isCross ? 'rgba(200,100,0,0.18)' : 'rgba(220,38,38,0.12)';
        ctx.fillRect(x+1, y+1, CELL_W-2, CELL_H-2);
      }
      if (isStart) labelCell(ctx,'시작',x,y,'#93c5fd');
      if (isEnd)   labelCell(ctx,'기지',x,y,'#fca5a5');

      // Hover
      if (!isPath && gs.hoveredCell && gs.hoveredCell.c===c && gs.hoveredCell.r===r) {
        ctx.fillStyle='rgba(99,102,241,0.25)'; ctx.fillRect(x+1,y+1,CELL_W-2,CELL_H-2);
        ctx.strokeStyle='#6366f1'; ctx.lineWidth=1.5; ctx.strokeRect(x+1,y+1,CELL_W-2,CELL_H-2);
      }
    }
  }

  drawPathFlow(ctx, THE_PATH, 'rgba(239,68,68,0.4)');

  // 사거리 미리보기
  if (gs.hoveredCell) {
    const {c,r} = gs.hoveredCell;
    if (!PATH_CELLS.has(`${c},${r}`) && !(c===4&&(r===0||r===6))) {
      const cc = cellCenter(c,r);
      ctx.beginPath(); ctx.arc(cc.x, cc.y, TOWER_TYPES.arrow.range, 0, Math.PI*2);
      ctx.strokeStyle='rgba(99,102,241,0.4)'; ctx.lineWidth=1; ctx.stroke();
    }
  }

  for (const t of gs.towers) renderTower(ctx, t);
  for (const p of gs.projectiles) {
    ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2);
    ctx.fillStyle=p.color; ctx.fill();
  }
  for (const e of gs.defenseEnemies) {
    if (!e.dead && !e.reached) renderDefEnemy(ctx, e);
  }

  // 영웅 (상단 배치 시)
  if (gs.hero.placement === 'defense') {
    renderHeroInDefense(ctx, gs.hero);
  }

  // 기지 HP
  const bx=8, by=DEFENSE_Y+DEFENSE_H-14;
  ctx.fillStyle='#0f172a'; ctx.fillRect(bx-1,by-1,181,10);
  drawHPBar(ctx,bx,by,180,8,gs.baseHP/BASE_HP_MAX);
  ctx.fillStyle=COLORS.text; ctx.font='10px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`기지 HP ${gs.baseHP}/${BASE_HP_MAX}`, bx+184, by+4);
}

function labelCell(ctx,text,x,y,color) {
  ctx.fillStyle=color; ctx.font='bold 9px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text, x+CELL_W/2, y+CELL_H/2);
}

function drawPathFlow(ctx, path, color) {
  ctx.save();
  ctx.strokeStyle=color; ctx.lineWidth=2; ctx.setLineDash([5,4]);
  ctx.beginPath();
  for (let i=0;i<path.length;i++) {
    const p=cellCenter(path[i][0],path[i][1]);
    i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y);
  }
  ctx.stroke(); ctx.setLineDash([]);
  for (let i=1;i<path.length;i+=2) {
    const a=cellCenter(path[i-1][0],path[i-1][1]);
    const b=cellCenter(path[i][0],path[i][1]);
    drawArrow(ctx,a.x,a.y,b.x,b.y,color);
  }
  ctx.restore();
}

function drawArrow(ctx,x1,y1,x2,y2,color) {
  const angle=Math.atan2(y2-y1,x2-x1);
  const mx=(x1+x2)/2, my=(y1+y2)/2, s=6;
  ctx.save();
  ctx.translate(mx,my); ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(s,0); ctx.lineTo(-s,-s*0.6); ctx.lineTo(-s,s*0.6);
  ctx.closePath(); ctx.fillStyle=color; ctx.fill();
  ctx.restore();
}

function renderTower(ctx, t) {
  const {x,y}=cellCenter(t.col,t.row);
  ctx.fillStyle='#0f2540';
  roundRect(ctx,x-CELL_W/2+3,y-CELL_H/2+3,CELL_W-6,CELL_H-6,4); ctx.fill();
  ctx.fillStyle=TOWER_TYPES[t.typeId].color;
  ctx.fillRect(x-9,y-9,18,18);
  ctx.font='13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(TOWER_TYPES[t.typeId].icon,x,y+1);
  ctx.strokeStyle='#86efac'; ctx.lineWidth=1; ctx.strokeRect(x-9,y-9,18,18);
}

function renderDefEnemy(ctx, e) {
  ctx.beginPath(); ctx.arc(e.x,e.y,e.radius,0,Math.PI*2);
  ctx.fillStyle=ENEMY_TYPES[e.typeId].color; ctx.fill();
  ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.stroke();
  drawHPBar(ctx, e.x-e.radius, e.y-e.radius-7, e.radius*2, 4, e.hp/e.maxHp);
}

function renderHeroInDefense(ctx, hero) {
  if (hero.dead) return;
  const lv = HERO_LEVELS[hero.level];
  const r  = 14;
  // 방어 구역 중앙 좌표
  const hx = hero.defX, hy = hero.defY;

  // 사거리 표시
  ctx.beginPath(); ctx.arc(hx, hy, lv.range, 0, Math.PI*2);
  ctx.strokeStyle='rgba(245,158,11,0.3)'; ctx.lineWidth=1; ctx.stroke();

  // 영웅 원
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI*2);
  ctx.fillStyle=COLORS.hero; ctx.fill();
  ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();

  ctx.font=`${r}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('👑', hx, hy+1);

  // 레벨 뱃지
  ctx.fillStyle='#1e293b'; ctx.font='bold 8px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`Lv.${hero.level}`, hx+r-2, hy-r-1);
}

// ─── UI Bar ──────────────────────────────────────────────────────────────────
function renderUIBar(ctx, gs, wm) {
  ctx.fillStyle=COLORS.uiBar; ctx.fillRect(0,UIBAR_Y,CW,UIBAR_H);
  ctx.strokeStyle='#334155'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,UIBAR_Y); ctx.lineTo(CW,UIBAR_Y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,UIBAR_Y+UIBAR_H); ctx.lineTo(CW,UIBAR_Y+UIBAR_H); ctx.stroke();

  const cy=UIBAR_Y+UIBAR_H/2;

  // 웨이브
  ctx.fillStyle=COLORS.text; ctx.font='bold 11px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`웨이브 ${gs.wave+1}/${WAVE_DEFS.length}`, 8, cy-8);

  // 타이머
  const tv = wm.phase==='active'       ? Math.ceil(wm.timer)
           : wm.phase==='intermission' ? Math.ceil(wm.intermissionTimer)
           : WAVE_DURATION;
  const tlabel = wm.phase==='intermission'
    ? `준비 ${tv}s`
    : `⏱ ${String(Math.floor(tv/60)).padStart(2,'0')}:${String(tv%60).padStart(2,'0')}`;
  ctx.fillStyle = wm.phase==='active' && tv<=10 ? '#ef4444' : COLORS.gold;
  ctx.font='bold 12px monospace'; ctx.fillText(tlabel, 8, cy+9);

  // 골드
  ctx.fillStyle=COLORS.gold; ctx.font='bold 14px sans-serif';
  ctx.textAlign='center';
  ctx.fillText(`💰 ${gs.gold}`, CW/2, cy-7);

  // 전투 적립 골드
  const bp = gs.battle.phase;
  const earn = gs.battle.goldEarned;
  const bLabel = bp==='hire'          ? '병력 고용 중'
               : bp==='fighting'      ? (earn>0 ? `⚔️ +${earn}💰 적립 중` : '⚔️ 전투 중')
               : bp==='won'           ? '✅ 전투 승리'
               : bp==='idle_defeated' ? '❌ 병력 전멸'
               : bp==='lost'          ? '❌ 전멸'
               : '';
  ctx.fillStyle = bp==='fighting'||bp==='won' ? '#22c55e'
                : bp.includes('defeat')||bp==='lost' ? '#ef4444' : COLORS.textDim;
  ctx.font='10px sans-serif'; ctx.textAlign='center';
  ctx.fillText(bLabel, CW/2, cy+8);

  // 누적 획득 골드 (좌하)
  ctx.fillStyle=COLORS.textDim; ctx.font='9px sans-serif';
  ctx.textAlign='left';
  ctx.fillText(`누적: ${gs.battle.totalGoldEarned}💰`, 8, cy+22);

  // 웨이브 시작 버튼
  const bw=110, bh=38, bx=CW-bw-6, by2=UIBAR_Y+(UIBAR_H-bh)/2;
  const canStart = wm.phase==='idle' && gs.battle.ourTeam.length>0 && gs.hero.placement!==null;
  if (wm.phase==='idle') {
    drawBtn(ctx, bx, by2, bw, bh, '▶ 웨이브 시작', '#4f46e5','#a5b4fc', canStart);
  } else if (wm.phase==='active') {
    drawBtn(ctx, bx, by2, bw, bh, '진행 중...', '#1e293b','#475569', false);
  } else if (wm.phase==='upgradePick') {
    drawBtn(ctx, bx, by2, bw, bh, '강화 선택 중...', '#2d1b69','#a78bfa', false);
  } else {
    drawBtn(ctx, bx, by2, bw, bh, `인터미션 ${Math.ceil(wm.intermissionTimer)}s`, '#1e293b','#475569', false);
  }
  gs.ui.waveBtn = {x:bx, y:by2, w:bw, h:bh};
}

// ─── Battle Zone ─────────────────────────────────────────────────────────────
function renderBattle(ctx, gs) {
  ctx.fillStyle='#0a1520'; ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H);
  ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1;
  for (let yy=BATTLE_Y; yy<BATTLE_Y+BATTLE_H; yy+=40) {
    ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(CW,yy); ctx.stroke();
  }

  const {battle, hero} = gs;

  if (battle.phase==='hire') {
    renderHirePhase(ctx, gs);
  } else {
    renderFightPhase(ctx, gs);
  }
}

// ─── 고용 화면 ────────────────────────────────────────────────────────────────
function renderHirePhase(ctx, gs) {
  const {battle, hero} = gs;

  // 제목
  ctx.fillStyle='#a5b4fc'; ctx.font='bold 13px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('병력 고용 & 영웅 배치', CW/2, BATTLE_Y+6);

  // ── 영웅 배치 선택 ──────────────────────────────────────────────────────
  const hpanelY = BATTLE_Y + 24;
  const lv = HERO_LEVELS[hero.level];

  // 영웅 정보 박스
  roundRect(ctx, 6, hpanelY, 180, 52, 6);
  ctx.fillStyle='#1a2535'; ctx.fill();
  ctx.strokeStyle=COLORS.hero; ctx.lineWidth=1.5; ctx.stroke();

  ctx.font='18px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('👑', 12, hpanelY+4);
  ctx.fillStyle=COLORS.hero; ctx.font='bold 10px sans-serif';
  ctx.fillText(`영웅  Lv.${hero.level}`, 34, hpanelY+4);
  ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif';
  ctx.fillText(`ATK:${lv.atk}  HP:${hero.hp}/${lv.hp}  DEF:${lv.def}`, 34, hpanelY+18);

  // EXP 바
  const expRatio = hero.exp / lv.expNeeded;
  ctx.fillStyle='#1e293b'; ctx.fillRect(12, hpanelY+32, 168, 6);
  ctx.fillStyle='#f59e0b'; ctx.fillRect(12, hpanelY+32, 168*Math.min(1,expRatio), 6);
  ctx.fillStyle='#64748b'; ctx.font='8px sans-serif';
  ctx.textAlign='right';
  ctx.fillText(`EXP ${hero.exp}/${lv.expNeeded}`, 180, hpanelY+44);

  // 배치 버튼
  const btnY = hpanelY+56, btnW=82, btnH=28;
  const pDef = hero.placement==='defense';
  const pBat = hero.placement==='battle';

  drawBtn(ctx, 6,   btnY, btnW, btnH, pDef?'✅ 상단 배치':'상단 배치',
    pDef?'#064e3b':'#1e293b', pDef?'#34d399':'#60a5fa');
  drawBtn(ctx, 6+btnW+4, btnY, btnW, btnH, pBat?'✅ 하단 배치':'하단 배치',
    pBat?'#4c1d95':'#1e293b', pBat?'#a78bfa':'#f87171');

  gs.ui.heroDefBtn = {x:6,    y:btnY, w:btnW, h:btnH};
  gs.ui.heroBatBtn = {x:6+btnW+4, y:btnY, w:btnW, h:btnH};

  // 배치 효과 설명
  ctx.fillStyle='#475569'; ctx.font='8px sans-serif'; ctx.textAlign='left';
  ctx.textBaseline='top';
  ctx.fillText('상단: 경로 공격 + EXP 획득', 8, btnY+btnH+4);
  ctx.fillText('하단: 전투 참여 + 보상 증가', 8, btnY+btnH+14);

  // ── 병력 고용 카드 ──────────────────────────────────────────────────────
  const units = Object.values(UNIT_TYPES);
  const cardW=72, cardH=58, cardStartX=200, cardY=hpanelY;
  gs.ui.hireCards = [];

  units.forEach((ut,i) => {
    const cx = cardStartX + i*(cardW+5);
    const canAfford = gs.gold >= ut.cost;

    roundRect(ctx, cx, cardY, cardW, cardH, 5);
    ctx.fillStyle = canAfford?'#1e293b':'#111827'; ctx.fill();
    ctx.strokeStyle = canAfford?ut.color:'#374151'; ctx.lineWidth=1.5; ctx.stroke();

    ctx.font='20px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(ut.icon, cx+cardW/2, cardY+4);
    ctx.fillStyle = canAfford?'#e2e8f0':'#64748b';
    ctx.font='bold 9px sans-serif'; ctx.textBaseline='bottom';
    ctx.fillText(ut.name, cx+cardW/2, cardY+cardH-16);
    ctx.fillStyle = canAfford?COLORS.gold:'#64748b';
    ctx.font='9px sans-serif';
    ctx.fillText(`💰${ut.cost}`, cx+cardW/2, cardY+cardH-4);
    gs.ui.hireCards.push({x:cx,y:cardY,w:cardW,h:cardH,typeId:ut.id});
  });

  // ── 고용된 병력 슬롯 ────────────────────────────────────────────────────
  const lineY = hpanelY + 100;
  ctx.fillStyle='#94a3b8'; ctx.font='bold 10px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`고용 병력 (${battle.ourTeam.filter(u=>!u.isHero).length}/${battle.maxSlots})`, 6, lineY);

  const slotW=50, slotH=50, slotGap=6;
  gs.ui.hiredSlots = [];

  for (let i=0; i<battle.maxSlots; i++) {
    const sx = 6 + i*(slotW+slotGap);
    const sy = lineY+16;
    const unit = battle.ourTeam.filter(u=>!u.isHero)[i];

    roundRect(ctx, sx, sy, slotW, slotH, 5);
    ctx.fillStyle = unit?'#1e3a5f':'#0f172a'; ctx.fill();
    ctx.strokeStyle = unit?(unit.color||'#60a5fa'):'#334155'; ctx.lineWidth=1.5; ctx.stroke();

    if (unit) {
      ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(unit.icon, sx+slotW/2, sy+slotW/2-4);
      ctx.fillStyle='#94a3b8'; ctx.font='8px sans-serif'; ctx.textBaseline='bottom';
      ctx.fillText(unit.name, sx+slotW/2, sy+slotH-2);
      ctx.fillStyle='#ef4444'; ctx.font='10px sans-serif'; ctx.textBaseline='top';
      ctx.fillText('✕', sx+slotW-10, sy+2);
    } else {
      ctx.fillStyle='#334155'; ctx.font='22px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('+', sx+slotW/2, sy+slotH/2);
    }
    gs.ui.hiredSlots.push({x:sx,y:sy,w:slotW,h:slotH,idx:i});
  }

  // 영웅 하단 배치 시 영웅 슬롯 표시
  if (gs.hero.placement === 'battle') {
    const hsx = 6 + battle.maxSlots*(slotW+slotGap) + 10;
    const hsy = lineY+16;
    roundRect(ctx, hsx, hsy, slotW, slotH, 5);
    ctx.fillStyle='#2a1e00'; ctx.fill();
    ctx.strokeStyle=COLORS.hero; ctx.lineWidth=2; ctx.stroke();
    ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('👑', hsx+slotW/2, hsy+slotW/2-4);
    ctx.fillStyle=COLORS.hero; ctx.font='bold 8px sans-serif'; ctx.textBaseline='bottom';
    ctx.fillText('영웅', hsx+slotW/2, hsy+slotH-2);
  }

  // 적 편성 미리보기
  const epY = lineY + 82;
  ctx.fillStyle='#f87171'; ctx.font='bold 10px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('이번 웨이브 등장 몬스터:', 6, epY);

  const spawns = WAVE_DEFS[gs.wave]?.battleSpawns || [];
  spawns.forEach((s,i) => {
    const t = BATTLE_MOB_TYPES[s.type];
    const ex = 6 + i*52;
    roundRect(ctx,ex,epY+14,46,40,4);
    ctx.fillStyle='#1a0d0d'; ctx.fill();
    ctx.strokeStyle=t.color; ctx.lineWidth=1; ctx.stroke();
    ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(t.icon, ex+23, epY+30);
    ctx.fillStyle='#94a3b8'; ctx.font='8px sans-serif'; ctx.textBaseline='bottom';
    ctx.fillText(`${s.interval}s 주기`, ex+23, epY+52);
  });

  // ── 케이브 업그레이드 패널 ───────────────────────────────────────────
  const caveY = epY + 62;
  const cv    = CAVE_LEVELS[gs.caveLevel];
  const nextCv= CAVE_LEVELS[gs.caveLevel + 1] || null;

  roundRect(ctx, 6, caveY, CW-12, 56, 6);
  ctx.fillStyle='#0a0d1a'; ctx.fill();
  ctx.strokeStyle='#4c1d95'; ctx.lineWidth=1.5; ctx.stroke();

  ctx.fillStyle='#a78bfa'; ctx.font='bold 10px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`🗿 몬스터 케이브  ${cv.label} (Lv.${gs.caveLevel}/5)`, 12, caveY+6);

  ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif';
  ctx.fillText(`현재: 몬스터 ${cv.statMult}배 강함  /  보상 ${cv.goldMult}배`, 12, caveY+20);

  if (nextCv) {
    ctx.fillText(`다음: 몬스터 ${nextCv.statMult}배  /  보상 ${nextCv.goldMult}배`, 12, caveY+32);
    const canAfford = gs.gold >= nextCv.upgradeCost;
    const bw=140, bh=24, bx=CW-12-bw, by=caveY+16;
    drawBtn(ctx, bx, by, bw, bh,
      `업그레이드  ${nextCv.upgradeCost}💰`,
      canAfford?'#4c1d95':'#1e293b',
      canAfford?'#a78bfa':'#6b7280', canAfford);
    gs.ui.caveBtn = {x:bx, y:by, w:bw, h:bh};
  } else {
    gs.ui.caveBtn = null;
    ctx.fillStyle='#f59e0b'; ctx.font='bold 9px sans-serif';
    ctx.fillText('★ 최고 등급 달성!', 12, caveY+32);
  }

  // 경고 / 안내
  const hasUnit = battle.ourTeam.length > 0;
  const hasHero = gs.hero.placement !== 'none';
  ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='bottom';
  if (!hasUnit) {
    ctx.fillStyle='#f87171';
    ctx.fillText('⚠️ 병력을 최소 1명 고용해야 웨이브 시작 가능', CW/2, BATTLE_Y+BATTLE_H-6);
  } else if (!hasHero) {
    ctx.fillStyle='#fbbf24';
    ctx.fillText('💡 영웅 배치를 선택하세요 (상단/하단)', CW/2, BATTLE_Y+BATTLE_H-6);
  } else {
    ctx.fillStyle='#64748b';
    ctx.fillText('준비 완료 → 우측 [웨이브 시작] 버튼', CW/2, BATTLE_Y+BATTLE_H-6);
  }
}

// ─── 전투 화면 ────────────────────────────────────────────────────────────────
function renderFightPhase(ctx, gs) {
  const {battle} = gs;

  // 배경: 가로줄 스크롤 (전진 연출)
  ctx.fillStyle = '#0a1520';
  ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H);

  // 스크롤 세로 스트라이프 (오른쪽→왼쪽으로 흐름)
  const strW = 60;
  const sOff = battle.scrollX % (strW * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.018)';
  for (let x = -sOff; x < CW + strW * 2; x += strW * 2) {
    ctx.fillRect(x, BATTLE_Y, strW, BATTLE_H - 65);
  }

  // 중앙선
  ctx.strokeStyle = '#1e2d40'; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(CW/2, BATTLE_Y+35); ctx.lineTo(CW/2, BATTLE_Y+BATTLE_H-65); ctx.stroke();

  // 헤더
  ctx.font='bold 11px sans-serif'; ctx.textBaseline='top'; ctx.textAlign='center';
  ctx.fillStyle='#60a5fa'; ctx.fillText('우리팀', BATTLE_TEAM_X, BATTLE_Y+6);
  ctx.fillStyle='#f87171'; ctx.fillText('적팀',   BATTLE_ENEMY_X, BATTLE_Y+6);

  // 처치 수 & 강화 배율
  const pct = Math.round(battle.killCount * KILL_SCALE * 100);
  ctx.font='8px sans-serif'; ctx.fillStyle='#7c3aed'; ctx.textAlign='center';
  ctx.fillText(`🗿Lv.${gs.caveLevel}  처치 ${battle.killCount}회  강화 +${pct}%`, CW/2, BATTLE_Y+20);

  // 아군 유닛 (playerDrift 적용)
  const px = BATTLE_TEAM_X + battle.playerDrift;
  battle.ourTeam.forEach((u, i) => renderBattleUnit(ctx, u, i, px, unitY(i)));

  // 적 유닛 (drawX/drawY 사용, 사망 페이드아웃)
  for (const e of battle.enemyTeam) {
    const alpha = e.dead ? Math.max(0, 1 - e.deadTimer / 0.7) : 1;
    if (alpha > 0.01) renderBattleUnit(ctx, e, -1, e.drawX, e.drawY, alpha);
  }

  // 플로티
  for (const f of battle.floaties) {
    ctx.globalAlpha = Math.max(0, f.life / 1.2);
    ctx.fillStyle = f.color; ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // 전투 로그
  const logY = BATTLE_Y + BATTLE_H - 65;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, logY - 2, CW, 67);
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
    ctx.fillStyle = 'rgba(0,40,0,0.72)'; ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H - 65);
    ctx.fillStyle = '#22c55e'; ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`전투 승리! 🎉 +${battle.goldEarned}💰`, CW / 2, BATTLE_Y + (BATTLE_H - 65) / 2);
  } else if (battle.phase === 'idle_defeated' || battle.phase === 'lost') {
    ctx.fillStyle = 'rgba(40,0,0,0.72)'; ctx.fillRect(0, BATTLE_Y, CW, BATTLE_H - 65);
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`병력 전멸  획득: ${battle.goldEarned}💰`, CW / 2, BATTLE_Y + (BATTLE_H - 65) / 2);
  }
}

// idx=-1이면 x,y를 직접 사용 (적), 그 외 플레이어 인덱스 기반
function renderBattleUnit(ctx, u, idx, x, y, alpha) {
  const r = BATTLE_UNIT_R;
  if (alpha !== undefined) ctx.globalAlpha = alpha;

  if (u.dead) {
    // 사망한 아군은 반투명 해골로 표시
    if (u.isPlayer) {
      ctx.globalAlpha = (alpha !== undefined ? alpha : 1) * 0.35;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#374151'; ctx.fill();
      ctx.globalAlpha = (alpha !== undefined ? alpha : 1) * 0.5;
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💀', x, y);
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (u.flashTimer > 0) {
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = u.flashColor; ctx.fill();
  }

  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = u.isHero ? COLORS.hero : u.color; ctx.fill();
  ctx.strokeStyle = u.isHero ? '#fef08a' : '#fff';
  ctx.lineWidth = u.isHero ? 2.5 : 1.5; ctx.stroke();

  ctx.font = `${Math.floor(r * 0.85)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(u.icon, x, y + 1);

  const bw = r * 2 + 8;
  drawHPBar(ctx, x - bw/2, y + r + 3, bw, 5, u.hp / u.maxHp);
  if (!u.isPlayer || u.maxMp > 0) {
    drawMPBar(ctx, x - bw/2, y + r + 10, bw, 3, u.mp / u.maxMp);
  }
  ctx.fillStyle = '#cbd5e1'; ctx.font = '8px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(`${u.name} ${u.hp}`, x, y + r + 16);

  ctx.globalAlpha = 1;
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function renderHUD(ctx, gs) {
  if (gs.gameOver) {
    const earned = calcSoulStones(gs);
    ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(0,0,CW,CH);
    ctx.fillStyle='#ef4444'; ctx.font='bold 28px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('게임 오버', CW/2, CH/2-55);
    ctx.fillStyle='#94a3b8'; ctx.font='13px sans-serif';
    ctx.fillText(`${gs.wave}웨이브 클리어  기지 HP: ${gs.baseHP}`, CW/2, CH/2-22);
    ctx.fillStyle='#a78bfa'; ctx.font='bold 16px sans-serif';
    ctx.fillText(`💎 영혼석 +${earned} 획득`, CW/2, CH/2+10);
    ctx.fillStyle='#c4b5fd'; ctx.font='12px sans-serif';
    ctx.fillText(`보유: ${gs.soulStones + earned}  (탭하여 강화 화면으로)`, CW/2, CH/2+32);
  } else if (gs.stageCleared) {
    const g = gs.baseHP>=80?'S':gs.baseHP>=50?'A':gs.baseHP>=20?'B':'C';
    const earned = calcSoulStones(gs);
    ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(0,0,CW,CH);
    ctx.fillStyle='#22c55e'; ctx.font='bold 28px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`스테이지 클리어! (${g})`, CW/2, CH/2-55);
    ctx.fillStyle='#94a3b8'; ctx.font='13px sans-serif';
    ctx.fillText(`누적 획득 골드: ${gs.battle.totalGoldEarned}💰`, CW/2, CH/2-22);
    ctx.fillStyle='#a78bfa'; ctx.font='bold 16px sans-serif';
    ctx.fillText(`💎 영혼석 +${earned} 획득`, CW/2, CH/2+10);
    ctx.fillStyle='#c4b5fd'; ctx.font='12px sans-serif';
    ctx.fillText('탭하여 강화 화면으로', CW/2, CH/2+32);
  }
}

// ─── 업그레이드 픽 화면 ──────────────────────────────────────────────────────
function renderUpgradePick(ctx, gs) {
  ctx.fillStyle='rgba(0,0,0,0.80)'; ctx.fillRect(0,0,CW,CH);

  ctx.fillStyle='#a5b4fc'; ctx.font='bold 16px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('웨이브 클리어! 강화를 선택하세요', CW/2, 24);
  ctx.fillStyle='#64748b'; ctx.font='11px sans-serif';
  ctx.fillText(`웨이브 ${gs.wave+1} 완료`, CW/2, 45);

  const cards = gs.upgradePick.cards;
  const cardW=130, cardH=190, gap=12;
  const totalW = cards.length * cardW + (cards.length-1)*gap;
  const startX = (CW-totalW)/2;
  const startY = 70;

  gs.ui.upgradeCards = [];

  cards.forEach((card, i) => {
    const cx = startX + i*(cardW+gap);
    const cy = startY;

    const gradeColor = card.grade==='epic' ? '#a78bfa'
                     : card.grade==='rare' ? '#60a5fa' : '#94a3b8';
    const gradeBg    = card.grade==='epic' ? '#1e0a3c'
                     : card.grade==='rare' ? '#0a1e3c' : '#0f172a';

    roundRect(ctx, cx, cy, cardW, cardH, 8);
    ctx.fillStyle=gradeBg; ctx.fill();
    ctx.strokeStyle=gradeColor; ctx.lineWidth=2; ctx.stroke();

    // 등급 배지
    const gradeLabel = card.grade==='epic'?'★ EPIC':card.grade==='rare'?'◆ RARE':'● COMMON';
    ctx.fillStyle=gradeColor; ctx.font='bold 8px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(gradeLabel, cx+cardW/2, cy+8);

    // 아이콘
    ctx.font='36px sans-serif'; ctx.textBaseline='middle';
    ctx.fillText(card.icon, cx+cardW/2, cy+60);

    // 이름
    ctx.fillStyle='#e2e8f0'; ctx.font='bold 12px sans-serif'; ctx.textBaseline='top';
    ctx.fillText(card.name, cx+cardW/2, cy+95);

    // 카테고리
    const catLabel = card.cat==='tower'?'타워':card.cat==='unit'?'유닛':
                     card.cat==='hero'?'영웅':card.cat==='base'?'기지':
                     card.cat==='cave'?'케이브':'자원';
    ctx.fillStyle=gradeColor; ctx.font='9px sans-serif';
    ctx.fillText(catLabel, cx+cardW/2, cy+112);

    // 설명 (줄바꿈)
    ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif';
    const words = card.desc.split(' ');
    let line='', lineY=cy+130;
    for (const w of words) {
      const test = line ? line+' '+w : w;
      if (ctx.measureText(test).width > cardW-12) {
        ctx.fillText(line, cx+cardW/2, lineY); line=w; lineY+=13;
      } else { line=test; }
    }
    if (line) ctx.fillText(line, cx+cardW/2, lineY);

    // 선택 버튼
    roundRect(ctx, cx+8, cy+cardH-30, cardW-16, 22, 5);
    ctx.fillStyle=gradeColor; ctx.fill();
    ctx.fillStyle='#0f172a'; ctx.font='bold 10px sans-serif'; ctx.textBaseline='middle';
    ctx.fillText('선택', cx+cardW/2, cy+cardH-19);

    gs.ui.upgradeCards.push({x:cx, y:cy, w:cardW, h:cardH, card});
  });
}

// ─── 메타 업그레이드 화면 ────────────────────────────────────────────────────
function renderMetaScreen(ctx, gs) {
  ctx.fillStyle='rgba(5,5,20,0.96)'; ctx.fillRect(0,0,CW,CH);

  // 헤더
  ctx.fillStyle='#a78bfa'; ctx.font='bold 18px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('💎 영구 강화', CW/2, 12);
  ctx.fillStyle='#c4b5fd'; ctx.font='12px sans-serif';
  ctx.fillText(`보유 영혼석: ${gs.soulStones}`, CW/2, 36);

  const upgs = META_UPGRADES;
  const cw2=210, ch2=48, cols=2, gap=6;
  const gridW = cols*cw2+(cols-1)*gap;
  const startX = (CW-gridW)/2;
  const startY = 60;

  gs.ui.metaCards = [];

  upgs.forEach((upg, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = startX + col*(cw2+gap);
    const cy = startY + row*(ch2+gap);
    const curLv = gs.metaUpgrades[upg.id] || 0;
    const maxed = curLv >= upg.maxLv;
    const cost  = upg.cost * (curLv+1);
    const canBuy= !maxed && gs.soulStones >= cost;

    roundRect(ctx, cx, cy, cw2, ch2, 6);
    ctx.fillStyle = maxed ? '#14120a' : canBuy ? '#0d1a2e' : '#0f0f1a';
    ctx.fill();
    ctx.strokeStyle = maxed ? '#f59e0b' : canBuy ? '#6366f1' : '#374151';
    ctx.lineWidth=1.5; ctx.stroke();

    ctx.font='14px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(upg.icon, cx+6, cy+8);

    ctx.fillStyle='#e2e8f0'; ctx.font='bold 9px sans-serif';
    ctx.fillText(upg.name, cx+24, cy+8);

    ctx.fillStyle='#64748b'; ctx.font='8px sans-serif';
    ctx.fillText(curLv>0 ? upg.desc(curLv) : '미구매', cx+24, cy+22);

    // 레벨 점
    for (let l=0; l<upg.maxLv; l++) {
      ctx.beginPath(); ctx.arc(cx+24+l*10, cy+36, 3.5, 0, Math.PI*2);
      ctx.fillStyle = l<curLv ? '#f59e0b' : '#334155'; ctx.fill();
    }

    if (!maxed) {
      const bw=52, bh=18;
      roundRect(ctx, cx+cw2-bw-4, cy+(ch2-bh)/2, bw, bh, 4);
      ctx.fillStyle = canBuy ? '#4f46e5' : '#1e293b'; ctx.fill();
      ctx.fillStyle = canBuy ? '#a5b4fc' : '#475569';
      ctx.font='8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${cost}💎`, cx+cw2-bw/2-4, cy+ch2/2);
      gs.ui.metaCards.push({x:cx, y:cy, w:cw2, h:ch2, upg});
    } else {
      ctx.fillStyle='#f59e0b'; ctx.font='bold 8px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('MAX', cx+cw2-30, cy+ch2/2);
    }
  });

  // 시작 버튼
  const btnY = startY + Math.ceil(upgs.length/cols)*(ch2+gap) + 8;
  const bw=200, bh=38, bx=(CW-bw)/2;
  roundRect(ctx, bx, btnY, bw, bh, 8);
  ctx.fillStyle='#22c55e'; ctx.fill();
  ctx.fillStyle='#0f172a'; ctx.font='bold 14px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('▶ 새 게임 시작', bx+bw/2, btnY+bh/2);
  gs.ui.metaStartBtn = {x:bx, y:btnY, w:bw, h:bh};
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────
function renderTutorial(ctx, tut) {
  if (!tut.active) return;
  const step = tut.current(); if (!step) return;
  ctx.fillStyle='rgba(0,0,0,0.68)'; ctx.fillRect(0,0,CW,CH);
  const cw=340,ch=165,cx=(CW-cw)/2,cy=(CH-ch)/2;
  roundRect(ctx,cx,cy,cw,ch,10);
  ctx.fillStyle='#0f172a'; ctx.fill();
  ctx.strokeStyle='#6366f1'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#a5b4fc'; ctx.font='bold 14px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(step.title,CW/2,cy+13);
  ctx.fillStyle='#e2e8f0'; ctx.font='12px sans-serif';
  step.text.split('\n').forEach((line,i)=>ctx.fillText(line,CW/2,cy+36+i*17));
  for (let i=0;i<TUTORIAL_STEPS.length;i++) {
    ctx.beginPath(); ctx.arc(CW/2-(TUTORIAL_STEPS.length-1)*9+i*18,cy+ch-16,4,0,Math.PI*2);
    ctx.fillStyle=i===tut.step?'#6366f1':'#334155'; ctx.fill();
  }
  ctx.fillStyle='#64748b'; ctx.font='10px sans-serif';
  ctx.textBaseline='bottom'; ctx.fillText('탭하여 계속 ▶',CW/2,cy+ch-3);
}

// ─── 타이틀 화면 ─────────────────────────────────────────────────────────────
function renderTitleScreen(ctx, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // 배경 이미지 (세로 480×800 캔버스에 꽉 채움)
  if (_titleImg.complete && _titleImg.naturalWidth > 0) {
    // 이미지 비율 유지하며 캔버스 커버
    const iw = _titleImg.naturalWidth, ih = _titleImg.naturalHeight;
    const scale = Math.max(CW / iw, CH / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (CW - dw) / 2, dy = (CH - dh) / 2;
    ctx.drawImage(_titleImg, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CW, CH);
  }

  // 상단 반투명 그라디언트 (제목 가독성)
  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0,   'rgba(0,0,0,0.75)');
  grad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CW, 220);

  // 게임 타이틀
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 38px sans-serif';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 12;
  ctx.fillText('듀얼 프론티어', CW/2, 30);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('Dual Frontier', CW/2, 78);
  ctx.shadowBlur = 0;

  // 하단 그라디언트 (버튼 가독성)
  const grad2 = ctx.createLinearGradient(0, CH-200, 0, CH);
  grad2.addColorStop(0, 'rgba(0,0,0,0)');
  grad2.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = grad2;
  ctx.fillRect(0, CH-200, CW, 200);

  // 시작 버튼
  const bw=220, bh=52, bx=(CW-bw)/2, by=CH-110;
  roundRect(ctx, bx, by, bw, bh, 26);
  const btnGrad = ctx.createLinearGradient(bx, by, bx, by+bh);
  btnGrad.addColorStop(0, '#6366f1');
  btnGrad.addColorStop(1, '#4f46e5');
  ctx.fillStyle = btnGrad; ctx.fill();
  ctx.strokeStyle = '#a5b4fc'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('▶  게임 시작', CW/2, by + bh/2);

  // 탭 안내 (버튼 아래)
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px sans-serif'; ctx.textBaseline = 'bottom';
  ctx.fillText('화면을 탭하여 시작', CW/2, CH - 18);

  ctx.restore();
}
