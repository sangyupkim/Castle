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
      if (isEnd)   labelCell(ctx,'🏰마을',x,y,'#fca5a5');

      // Hover
      if (!isPath && gs.hoveredCell && gs.hoveredCell.c===c && gs.hoveredCell.r===r) {
        ctx.fillStyle='rgba(99,102,241,0.25)'; ctx.fillRect(x+1,y+1,CELL_W-2,CELL_H-2);
        ctx.strokeStyle='#6366f1'; ctx.lineWidth=1.5; ctx.strokeRect(x+1,y+1,CELL_W-2,CELL_H-2);
      }
    }
  }

  drawPathFlow(ctx, THE_PATH, 'rgba(239,68,68,0.4)');

  // 기지 셀 - idle 상태에서 마을 입장 힌트
  if (wm && wm.phase==='idle') {
    const bx2=GRID_OX+4*CELL_W+1, by2=GRID_OY+6*CELL_H+1;
    ctx.fillStyle='rgba(99,102,241,0.35)'; ctx.fillRect(bx2,by2,CELL_W-2,CELL_H-2);
    ctx.fillStyle='#a5b4fc'; ctx.font='bold 9px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🏰',GRID_OX+4*CELL_W+CELL_W/2,GRID_OY+6*CELL_H+CELL_H/2-5);
    ctx.fillText('마을',GRID_OX+4*CELL_W+CELL_W/2,GRID_OY+6*CELL_H+CELL_H/2+7);
  }

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

  // 타워 개별 강화 액션
  if (gs.ui.towerAction && wm && wm.phase==='idle') {
    const ta=gs.ui.towerAction;
    const cc=cellCenter(ta.col,ta.row);
    const tower=gs.towers.find(t=>t.col===ta.col&&t.row===ta.row);
    if (tower) {
      const lv=tower.level||1;
      const ax=cc.x-50, ay2=cc.y+CELL_H/2+2, aw=100, ah=22;
      roundRect(ctx,ax,ay2,aw,ah,4); ctx.fillStyle='#0f172a'; ctx.fill(); ctx.strokeStyle='#f59e0b'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle='#f59e0b'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`Lv.${lv}/3`,ax+18,ay2+ah/2);
      if (lv<3) {
        roundRect(ctx,ax+26,ay2+2,42,ah-4,3); ctx.fillStyle='#1e3a5f'; ctx.fill(); ctx.strokeStyle='#60a5fa'; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle='#60a5fa'; ctx.font='7px sans-serif'; ctx.fillText(`강화 ${lv*15}💰`,ax+47,ay2+ah/2);
        gs.ui.towerUpgradeBtn={x:ax+26,y:ay2+2,w:42,h:ah-4};
      } else { gs.ui.towerUpgradeBtn=null; }
      roundRect(ctx,ax+72,ay2+2,24,ah-4,3); ctx.fillStyle='#3f1515'; ctx.fill(); ctx.strokeStyle='#ef4444'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='#ef4444'; ctx.font='7px sans-serif'; ctx.fillText('철거',ax+84,ay2+ah/2);
      gs.ui.towerRemoveBtn={x:ax+72,y:ay2+2,w:24,h:ah-4};
    }
  }
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
  const tpl=TOWER_TYPES[t.typeId];
  const kick=t.muzzle>0?1.5:0;
  ctx.fillStyle='#0f2540';
  roundRect(ctx,x-CELL_W/2+3,y-CELL_H/2+3,CELL_W-6,CELL_H-6,4); ctx.fill();
  ctx.fillStyle=tpl.color;
  ctx.fillRect(x-9-kick,y-9-kick,18+kick*2,18+kick*2);
  ctx.fillStyle='#0f172a';
  ctx.font='13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(tpl.icon,x,y+1);
  ctx.strokeStyle=tpl.color; ctx.lineWidth=1; ctx.strokeRect(x-9,y-9,18,18);
  if ((t.level||1)>1) {
    ctx.fillStyle='#fbbf24'; ctx.font='bold 7px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('★'.repeat((t.level||1)-1), x, y+9);
  }
}

function renderDefEnemy(ctx, e) {
  const slowed = e.slowTimer > 0;
  if (slowed) {
    ctx.beginPath(); ctx.arc(e.x,e.y,e.radius+3,0,Math.PI*2);
    ctx.fillStyle='rgba(56,189,248,0.30)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(e.x,e.y,e.radius,0,Math.PI*2);
  ctx.fillStyle = e.hitFlash>0 ? '#ffffff' : (slowed ? '#7dd3fc' : ENEMY_TYPES[e.typeId].color);
  ctx.fill();
  ctx.strokeStyle = (e.armor||0)>0 ? '#cbd5e1' : '#fff';
  ctx.lineWidth = (e.armor||0)>0 ? 2 : 1;
  ctx.stroke();
  drawHPBar(ctx, e.x-e.radius, e.y-e.radius-7, e.radius*2, 4, e.hp/e.maxHp);
}

function renderHeroInDefense(ctx, hero) {
  if (hero.dead) {
    ctx.globalAlpha=0.4;
    ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('💀', hero.defX, hero.defY);
    ctx.globalAlpha=1;
    ctx.fillStyle='#f87171'; ctx.font='bold 8px sans-serif'; ctx.textBaseline='top';
    ctx.fillText(`부활 ${Math.ceil(hero.reviveTimer)}s`, hero.defX, hero.defY+12);
    return;
  }
  const lv = HERO_LEVELS[hero.level];
  const r  = 14;
  // 방어 구역 중앙 좌표
  const hx = hero.defX, hy = hero.defY;

  // 사거리 표시 (방어 구역 안쪽으로만)
  ctx.save();
  ctx.beginPath(); ctx.rect(0, DEFENSE_Y, CW, DEFENSE_H); ctx.clip();
  ctx.beginPath(); ctx.arc(hx, hy, lv.range, 0, Math.PI*2);
  ctx.strokeStyle='rgba(245,158,11,0.3)'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();

  // 영웅 원
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI*2);
  ctx.fillStyle=COLORS.hero; ctx.fill();
  ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();

  ctx.font=`${r}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('👑', hx, hy+1);

  // HP 바 + 레벨 뱃지
  const hMax = Math.round(lv.hp * BONUSES.heroStatMult);
  drawHPBar(ctx, hx-16, hy+r+2, 32, 4, hero.hp/hMax);
  ctx.fillStyle=COLORS.hero; ctx.font='bold 8px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(`Lv.${hero.level}`, hx, hy+r+8);
}

// ─── 일시정지 오버레이 ───────────────────────────────────────────────────────
function renderPauseOverlay(ctx) {
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,CW,CH);
  ctx.fillStyle='#e2e8f0'; ctx.font='bold 30px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('⏸ 일시정지', CW/2, CH/2-12);
  ctx.fillStyle='#94a3b8'; ctx.font='12px sans-serif';
  ctx.fillText('P 키 또는 ⏸ 버튼으로 재개', CW/2, CH/2+18);
}

// ─── UI Bar ──────────────────────────────────────────────────────────────────
function renderUIBar(ctx, gs, wm) {
  ctx.fillStyle=COLORS.uiBar; ctx.fillRect(0,UIBAR_Y,CW,UIBAR_H);
  ctx.strokeStyle='#334155'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,UIBAR_Y); ctx.lineTo(CW,UIBAR_Y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,UIBAR_Y+UIBAR_H); ctx.lineTo(CW,UIBAR_Y+UIBAR_H); ctx.stroke();

  const cy=UIBAR_Y+UIBAR_H/2;

  // 스테이지 / 웨이브 (좌측 상·하 2줄)
  const si = getStageInfo(gs.wave);
  ctx.fillStyle=COLORS.text; ctx.font='bold 12px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`${si.stageLabel}`, 8, cy-13);
  ctx.fillStyle='#94a3b8'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`웨이브 ${si.waveInStage+1}/3`, 30, cy-12);

  // 타이머
  const tv = wm.phase==='active'       ? Math.ceil(wm.timer)
           : wm.phase==='intermission' ? Math.ceil(wm.intermissionTimer)
           : WAVE_DURATION;
  const tlabel = wm.phase==='intermission'
    ? `준비 ${tv}s`
    : `${String(Math.floor(tv/60)).padStart(2,'0')}:${String(tv%60).padStart(2,'0')}`;
  ctx.fillStyle = wm.phase==='active' && tv<=10 ? '#ef4444' : COLORS.gold;
  ctx.font='bold 13px monospace'; ctx.textAlign='left';
  ctx.fillText(`⏱ ${tlabel}`, 8, cy+4);

  ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`누적 ${gs.battle.totalGoldEarned}💰 · 💎${gs.soulStones}`, 8, cy+19);

  // 골드
  ctx.fillStyle=COLORS.gold; ctx.font='bold 14px sans-serif';
  ctx.textAlign='center';
  ctx.fillText(`💰 ${Math.floor(gs.gold)}`, CW/2, cy-7);

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
  ctx.font='bold 10px sans-serif'; ctx.textAlign='center';
  ctx.fillText(bLabel, CW/2, cy+8);

  // 웨이브 시작 버튼
  const bw=110, bh=38, bx=CW-bw-6, by2=UIBAR_Y+(UIBAR_H-bh)/2;
  if (wm.phase==='active') {
    drawBtn(ctx,bx,by2,bw,bh,'진행 중...',  '#1e293b','#475569',false);
  } else if (wm.phase==='upgradePick') {
    drawBtn(ctx,bx,by2,bw,bh,'강화 선택 중...','#2d1b69','#a78bfa',false);
  } else if (wm.phase==='intermission') {
    drawBtn(ctx,bx,by2,bw,bh,`인터미션 ${Math.ceil(wm.intermissionTimer)}s`,'#1e293b','#475569',false);
  } else {
    drawBtn(ctx,bx,by2,bw,bh,'🏰 마을에서 준비','#1e293b','#a5b4fc',true);
  }
  gs.ui.waveBtn = (wm.phase==='idle') ? null : {x:bx,y:by2,w:bw,h:bh};
  gs.ui.uibarTownBtn = (wm.phase==='idle') ? {x:bx,y:by2,w:bw,h:bh} : null;
}

// ─── Battle Zone ─────────────────────────────────────────────────────────────
function renderBattle(ctx, gs) {
  ctx.fillStyle='#0a1520'; ctx.fillRect(0,BATTLE_Y,CW,BATTLE_H);

  if (wm.phase==='idle') {
    renderBriefing(ctx, gs);
  } else if (wm.phase==='upgradePick') {
    ctx.fillStyle='#080d18'; ctx.fillRect(0,BATTLE_Y,CW,BATTLE_H);
  } else {
    renderFightPhase(ctx,gs);
  }
  renderBattleControls(ctx, gs);
}

// ─── 게임 컨트롤 (일시정지 / 배속 / 음소거) ──────────────────────────────────
function renderBattleControls(ctx, gs) {
  const bw=34, bh=24, gap=4, by=BATTLE_Y+6;
  const x3=CW-6-bw, x2=x3-bw-gap, x1=x2-bw-gap;
  drawBtn(ctx,x1,by,bw,bh,_paused?'▶':'⏸','#111c2e','#a5b4fc',true);
  drawBtn(ctx,x2,by,bw,bh,`x${gameSpeed()}`,gameSpeed()>1?'#3b1d6e':'#111c2e',gameSpeed()>1?'#c4b5fd':'#94a3b8',true);
  drawBtn(ctx,x3,by,bw,bh,SFX.isMuted()?'🔇':'🔊','#111c2e','#94a3b8',true);
  gs.ui.ctrlPause={x:x1,y:by,w:bw,h:bh};
  gs.ui.ctrlSpeed={x:x2,y:by,w:bw,h:bh};
  gs.ui.ctrlMute ={x:x3,y:by,w:bw,h:bh};
}

// ─── 출전 브리핑 (웨이브 대기 화면) ──────────────────────────────────────────
function renderBriefing(ctx, gs) {
  ctx.fillStyle='#0c1421'; ctx.fillRect(0,BATTLE_Y,CW,BATTLE_H);

  const st  = getStageInfo(gs.wave);
  const def = WAVE_DEFS[gs.wave] || { battleGroups:[], defenseEnemies:[] };

  // ── 헤더 ─────────────────────────────────────────────────────────────────
  ctx.fillStyle='#a5b4fc'; ctx.font='bold 13px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`출전 브리핑 — 스테이지 ${st.stageLabel}`, 10, BATTLE_Y+9);
  ctx.fillStyle='#475569'; ctx.font='bold 10px sans-serif';
  ctx.fillText(`웨이브 ${st.waveInStage+1}/3${st.isBossStage?'  ★보스 스테이지':''}`, 10, BATTLE_Y+26);

  let y = BATTLE_Y+44;

  // ── 하단 전투 그룹 ───────────────────────────────────────────────────────
  const panelH = 74;
  roundRect(ctx,6,y,CW-12,panelH,7);
  ctx.fillStyle='#0a1019'; ctx.fill(); ctx.strokeStyle='#3f1d1d'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#f87171'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`⚔️ 하단 전투 — ${def.battleGroups.length}개 그룹 (순차 등장)`, 12, y+7);

  const groups = def.battleGroups;
  const gw = Math.floor((CW-24 - (groups.length-1)*5) / Math.max(1,groups.length));
  groups.forEach((g,i) => {
    const gx = 12 + i*(gw+5);
    roundRect(ctx,gx,y+22,gw,44,4);
    ctx.fillStyle='#140c0c'; ctx.fill();
    ctx.strokeStyle='#5b2121'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#64748b'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(`G${i+1}`, gx+gw/2, y+25);
    // 몬스터 아이콘 나열
    const icons = g.types.map(t=>BATTLE_MOB_TYPES[t]?BATTLE_MOB_TYPES[t].icon:'?').join('');
    const fs = Math.max(9, Math.min(15, (gw-8) / Math.max(1,g.types.length) * 0.95));
    ctx.fillStyle='#e2e8f0'; ctx.font=`${Math.floor(fs)}px sans-serif`; ctx.textBaseline='middle';
    ctx.fillText(icons, gx+gw/2, y+48);
  });
  y += panelH + 6;

  // ── 상단 침입자 ──────────────────────────────────────────────────────────
  const dh = 52;
  roundRect(ctx,6,y,CW-12,dh,7);
  ctx.fillStyle='#0a1019'; ctx.fill(); ctx.strokeStyle='#1e3a5f'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#60a5fa'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('🏰 상단 침입자 — 기지에 닿으면 HP 손실', 12, y+7);
  let dx = 12;
  const countMult = 1 + gs.wave * DEF_WAVE_COUNT_SCALE;
  for (const d of def.defenseEnemies) {
    const t = ENEMY_TYPES[d.type]; if (!t) continue;
    const n = Math.max(1, Math.round(d.count * countMult));
    ctx.fillStyle=t.color; ctx.font='bold 10px sans-serif';
    ctx.fillText(`● ${t.name} ×${n}`, dx, y+26);
    ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
    ctx.fillText(`피해 ${Math.round(t.dmg*(1+gs.wave*0.04))}`, dx, y+38);
    dx += 108;
  }
  y += dh + 6;

  // ── 내 편성 ──────────────────────────────────────────────────────────────
  const mh = 78;
  roundRect(ctx,6,y,CW-12,mh,7);
  ctx.fillStyle='#0a1019'; ctx.fill(); ctx.strokeStyle='#1e3a2f'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#34d399'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('🛡 내 편성', 12, y+7);

  const hired = gs.battle.ourTeam.filter(u=>!u.isHero);
  if (hired.length) {
    let ux = 12;
    for (const u of hired) {
      ctx.fillStyle='#e2e8f0'; ctx.font='15px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText(u.icon, ux, y+23);
      ctx.fillStyle='#64748b'; ctx.font='bold 8px sans-serif';
      ctx.fillText(`${Math.ceil(u.hp)}`, ux, y+41);
      ux += 26;
    }
  } else {
    ctx.fillStyle='#f87171'; ctx.font='bold 10px sans-serif';
    ctx.fillText('⚠️ 병력 없음 — 마을 › 출전준비에서 고용하세요', 12, y+27);
  }

  const heroTxt = gs.hero.dead ? `💀 부활 ${Math.ceil(gs.hero.reviveTimer)}s`
                : gs.hero.placement==='defense' ? '👑 상단 배치'
                : gs.hero.placement==='battle'  ? '👑 하단 배치' : '👑 미배치';
  ctx.fillStyle = gs.hero.dead ? '#f87171' : gs.hero.placement==='none' ? '#64748b' : COLORS.hero;
  ctx.font='bold 10px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='top';
  ctx.fillText(`${heroTxt}  Lv.${gs.hero.level}`, CW-14, y+7);
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`🏹 타워 ${gs.towers.length}기`, CW-14, y+23);
  ctx.fillText(`🗿 케이브 Lv.${gs.caveLevel}`, CW-14, y+36);

  // 획득 강화 아이콘
  ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('강화', 12, y+56);
  const icons = (gs.activeUpgrades||[]).map(id=>(UPGRADE_CARDS.find(c=>c.id===id)||{}).icon||'').join(' ');
  ctx.fillStyle='#a5b4fc'; ctx.font='10px sans-serif';
  ctx.fillText(icons ? icons.slice(0,64) : '— 웨이브를 클리어하면 강화를 고를 수 있습니다', 40, y+56);
  y += mh + 8;

  // ── 버튼 ─────────────────────────────────────────────────────────────────
  const ready = gs.battle.ourTeam.length > 0;
  const bw2 = CW-140, bh2 = 46;
  roundRect(ctx,20,y,bw2,bh2,9);
  ctx.fillStyle = ready ? '#14532d' : '#1f2937'; ctx.fill();
  ctx.strokeStyle = ready ? '#22c55e' : '#374151'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle = ready ? '#fff' : '#6b7280'; ctx.font='bold 17px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('▶ 웨이브 시작', 20+bw2/2, y+bh2/2);
  gs.ui.battleWaveStartBtn = ready ? {x:20,y:y,w:bw2,h:bh2} : null;

  const tbx = 20+bw2+10, tbw = CW-tbx-20;
  roundRect(ctx,tbx,y,tbw,bh2,9);
  ctx.fillStyle='#1e293b'; ctx.fill(); ctx.strokeStyle='#475569'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#cbd5e1'; ctx.font='bold 12px sans-serif';
  ctx.fillText('🏰 마을', tbx+tbw/2, y+bh2/2);
  gs.ui.briefTownBtn = {x:tbx,y:y,w:tbw,h:bh2};

  y += bh2 + 6;
  ctx.fillStyle='#3f4a5c'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('Space 시작 · P 일시정지 · S 배속 · T 마을 · 1~4 타워 선택', CW/2, y);
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
    ctx.fillStyle = e.color; ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(e.text, 6, logY + 2 + i * 15);
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
  ctx.fillStyle = '#f1f5f9'; ctx.font = 'bold 9px sans-serif';
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

// ─── 스킬 트리 화면 ──────────────────────────────────────────────────────────
function renderMetaScreen(ctx, gs) {
  ctx.fillStyle='rgba(4,8,20,0.97)'; ctx.fillRect(0,0,CW,CH);

  // Header
  ctx.fillStyle='#a78bfa'; ctx.font='bold 16px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('💎 스킬 트리', CW/2, 10);
  ctx.fillStyle='#f59e0b'; ctx.font='bold 12px sans-serif';
  ctx.fillText(`보석: ${gs.soulStones}`, CW/2, 32);

  // 3 tree tabs
  const tabs = [
    { id:'tower',   label:'🏹 타워', color:'#22c55e' },
    { id:'hero',    label:'👑 영웅', color:'#f59e0b' },
    { id:'support', label:'⚙️ 보조', color:'#60a5fa' },
  ];
  const tabW = (CW-16)/3, tabH = 32, tabY = 52;
  if (!gs.ui.metaTab) gs.ui.metaTab = 'tower';
  tabs.forEach((tab, i) => {
    const tx = 8 + i*(tabW+4);
    const active = gs.ui.metaTab === tab.id;
    roundRect(ctx, tx, tabY, tabW, tabH, 5);
    ctx.fillStyle = active ? '#1e293b' : '#0a0d18'; ctx.fill();
    ctx.strokeStyle = active ? tab.color : '#334155'; ctx.lineWidth = active ? 2 : 1; ctx.stroke();
    ctx.fillStyle = active ? tab.color : '#64748b'; ctx.font='bold 11px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(tab.label, tx+tabW/2, tabY+tabH/2);
    if (tab.id==='tower') gs.ui.towerTabBtn = {x:tx,y:tabY,w:tabW,h:tabH};
    else if (tab.id==='hero') gs.ui.heroTabBtn = {x:tx,y:tabY,w:tabW,h:tabH};
    else gs.ui.supportTabBtn = {x:tx,y:tabY,w:tabW,h:tabH};
  });

  // Draw the active tree
  const treeKey = gs.ui.metaTab || 'tower';
  const tree = SKILL_TREES[treeKey];
  gs.ui.metaCards = [];
  _renderSkillTree(ctx, gs, tree, 92);

  // Start button at bottom
  const bw=200, bh=40, bx=(CW-bw)/2, btnY=CH-52;
  roundRect(ctx,bx,btnY,bw,bh,8);
  ctx.fillStyle='#22c55e'; ctx.fill();
  ctx.fillStyle='#0f172a'; ctx.font='bold 14px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('▶ 새 게임 시작', bx+bw/2, btnY+bh/2);
  gs.ui.metaStartBtn={x:bx,y:btnY,w:bw,h:bh};
}

function _renderSkillTree(ctx, gs, tree, startY) {
  const nodeW=110, nodeH=68, hGap=15, vGap=40;
  const totalW = 3*nodeW + 2*hGap;
  const offX = (CW - totalW) / 2;

  const getPos = (row, col) => ({
    x: offX + col*(nodeW+hGap),
    y: startY + row*(nodeH+vGap)
  });

  const owned = gs.skillTreeOwned || [];

  // Draw connection lines first
  for (const skill of tree.skills) {
    if (!skill.req) continue;
    const parent = tree.skills.find(s => s.id === skill.req);
    if (!parent) continue;
    const pp = getPos(parent.row, parent.col);
    const cp = getPos(skill.row, skill.col);
    const canReach = owned.includes(skill.req);
    ctx.strokeStyle = canReach ? (owned.includes(skill.id) ? '#22c55e' : '#334155') : '#1e293b';
    ctx.lineWidth = 2;
    ctx.setLineDash(canReach ? [] : [4,4]);
    ctx.beginPath();
    ctx.moveTo(pp.x+nodeW/2, pp.y+nodeH);
    ctx.lineTo(cp.x+nodeW/2, cp.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw nodes
  for (const skill of tree.skills) {
    const {x,y} = getPos(skill.row, skill.col);
    const isOwned = owned.includes(skill.id);
    const reqMet = !skill.req || owned.includes(skill.req);
    const canBuy = !isOwned && reqMet && gs.soulStones >= skill.cost;

    roundRect(ctx,x,y,nodeW,nodeH,8);
    ctx.fillStyle = isOwned ? '#0d2a1a' : canBuy ? '#0d1929' : '#080d18'; ctx.fill();
    ctx.strokeStyle = isOwned ? tree.color : canBuy ? '#4b6cb7' : '#1e293b';
    ctx.lineWidth = isOwned ? 2.5 : canBuy ? 2 : 1; ctx.stroke();

    ctx.font='22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.globalAlpha = reqMet ? 1.0 : 0.35;
    ctx.fillText(skill.icon, x+nodeW/2, y+5);

    ctx.fillStyle = isOwned ? tree.color : reqMet ? '#e2e8f0' : '#475569';
    ctx.font='bold 9px sans-serif'; ctx.textBaseline='top';
    ctx.fillText(skill.name, x+nodeW/2, y+30);

    ctx.fillStyle = isOwned ? '#86efac' : reqMet ? '#94a3b8' : '#374151';
    ctx.font='8px sans-serif';
    const descWords = skill.desc.split(',');
    if (descWords.length > 1) {
      ctx.fillText(descWords[0]+',', x+nodeW/2, y+42);
      ctx.fillText(descWords[1].trim(), x+nodeW/2, y+52);
    } else {
      ctx.fillText(skill.desc, x+nodeW/2, y+44);
    }

    if (isOwned) {
      ctx.fillStyle='#22c55e'; ctx.font='bold 9px sans-serif';
      ctx.fillText('✓ 습득', x+nodeW/2, y+nodeH-8);
    } else if (reqMet) {
      const costColor = canBuy ? '#f59e0b' : '#64748b';
      ctx.fillStyle=costColor; ctx.font='bold 9px sans-serif';
      ctx.fillText(`💎 ${skill.cost}`, x+nodeW/2, y+nodeH-8);
      gs.ui.metaCards.push({x,y,w:nodeW,h:nodeH,skillId:skill.id,icon:skill.icon});
    } else {
      ctx.fillStyle='#374151'; ctx.font='8px sans-serif';
      ctx.fillText('🔒 선행 필요', x+nodeW/2, y+nodeH-8);
    }
    ctx.globalAlpha = 1.0;
  }
}



// ─── 건물 서브 화면 ───────────────────────────────────────────────────────────
function renderBuildingScreen(ctx, gs, buildingId) {
  if (buildingId==='heroShop') { renderHeroShopScreen(ctx,gs); return; }
  const def=TOWN_BUILDINGS.find(b=>b.id===buildingId);
  const bs=gs.town.buildings[buildingId];
  if (!def||!bs) return;

  ctx.fillStyle='#0c0f1a'; ctx.fillRect(0,BATTLE_Y,CW,BATTLE_H);

  // Header
  const hY=BATTLE_Y+6;
  ctx.fillStyle=def.color; ctx.font='bold 13px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(`${def.icon} ${def.name}`,CW/2,hY);

  // Back button
  roundRect(ctx,6,hY,50,22,4);
  ctx.fillStyle='#1e293b'; ctx.fill();
  ctx.strokeStyle='#475569'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('← 뒤로',31,hY+11);
  gs.ui.townBackBtn={x:6,y:hY,w:50,h:22};

  // Level up button
  const curLv=bs.level||0, maxLv=def.levels.length-1;
  const nextLvDef=curLv<maxLv?def.levels[curLv+1]:null;
  if (nextLvDef) {
    const canAff=gs.gold>=nextLvDef.upgradeCost;
    const bw=140,bh=22,bx=CW-6-bw,by2=hY;
    roundRect(ctx,bx,by2,bw,bh,4);
    ctx.fillStyle=canAff?'#1e3a5f':'#1a1a2e'; ctx.fill();
    ctx.strokeStyle=canAff?'#f59e0b':'#374151'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle=canAff?'#fbbf24':'#6b7280'; ctx.font='bold 8px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`건물 Lv.UP ${nextLvDef.upgradeCost}💰`,bx+bw/2,by2+bh/2);
    gs.ui.buildingLvUpBtn={x:bx,y:by2,w:bw,h:bh};
  } else { gs.ui.buildingLvUpBtn=null; }

  ctx.fillStyle='#475569'; ctx.font='9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`현재 ${def.levels[curLv].levelName} | 최대 ${def.levels[maxLv].levelName}`,6,hY+26);

  // Upgrades
  gs.ui.upgradeBtns=[];
  let uy=BATTLE_Y+52;
  for (let lv=0;lv<=curLv&&lv<def.levels.length;lv++) {
    const lvDef=def.levels[lv];
    if (lv>0) { ctx.fillStyle='#1e293b'; ctx.fillRect(6,uy,CW-12,1); uy+=6; }
    ctx.fillStyle='#a5b4fc'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(lvDef.levelName+' 업그레이드',8,uy); uy+=14;

    for (const upg of lvDef.upgrades) {
      const curUpgLv=bs.upgrades[upg.id]||0;
      const maxed=curUpgLv>=upg.maxLv;
      const canAff=!maxed&&gs.gold>=upg.cost;
      const uh=36;
      roundRect(ctx,6,uy,CW-12,uh,5);
      ctx.fillStyle=maxed?'#0f1a0f':canAff?'#0d1929':'#0f0f1a'; ctx.fill();
      ctx.strokeStyle=maxed?'#22c55e':canAff?def.color:'#334155'; ctx.lineWidth=1; ctx.stroke();
      ctx.font='13px sans-serif'; ctx.textBaseline='middle';
      ctx.fillText(upg.icon,12,uy+uh/2);
      ctx.fillStyle='#f1f5f9'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left';
      ctx.fillText(upg.name,30,uy+uh/2-7);
      ctx.fillStyle='#cbd5e1'; ctx.font='bold 9px sans-serif';
      ctx.fillText(upg.desc(curUpgLv>0?curUpgLv:1),30,uy+uh/2+6);
      // level dots
      for (let d=0;d<upg.maxLv;d++) {
        ctx.beginPath(); ctx.arc(CW-100+d*10,uy+uh/2,3.5,0,Math.PI*2);
        ctx.fillStyle=d<curUpgLv?'#22c55e':'#334155'; ctx.fill();
      }
      if (!maxed) {
        const bw2=68,bh2=20,bx2=CW-8-bw2,by2=uy+(uh-bh2)/2;
        roundRect(ctx,bx2,by2,bw2,bh2,4);
        ctx.fillStyle=canAff?def.color:'#1e293b'; ctx.fill();
        ctx.fillStyle=canAff?'#fff':'#475569'; ctx.font='bold 8px sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(`${upg.cost}💰`,bx2+bw2/2,by2+bh2/2);
        gs.ui.upgradeBtns.push({x:bx2,y:by2,w:bw2,h:bh2,id:upg.id});
      } else {
        ctx.fillStyle='#22c55e'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('MAX',CW-30,uy+uh/2);
      }
      uy+=uh+4;
    }
  }

  // Locked levels
  for (let lv=curLv+1;lv<def.levels.length;lv++) {
    const lvDef=def.levels[lv];
    roundRect(ctx,6,uy,CW-12,30,5);
    ctx.fillStyle='#080d18'; ctx.fill();
    ctx.strokeStyle='#374151'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`🔒 ${lvDef.levelName} (건물 레벨업 필요 ${lvDef.upgradeCost}💰)`,CW/2,uy+15);
    uy+=34;
  }
}

// ─── 영웅 상점 ───────────────────────────────────────────────────────────────
function renderHeroShopScreen(ctx, gs) {
  ctx.fillStyle='#0c0f1a'; ctx.fillRect(0,BATTLE_Y,CW,BATTLE_H);
  const hY=BATTLE_Y+6;
  ctx.fillStyle='#a78bfa'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('🏪 영웅 상점',CW/2,hY);
  roundRect(ctx,6,hY,50,22,4); ctx.fillStyle='#1e293b'; ctx.fill(); ctx.strokeStyle='#475569'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('← 뒤로',31,hY+11);
  gs.ui.townBackBtn={x:6,y:hY,w:50,h:22};
  gs.ui.shopItemBtns=[];

  let sy=BATTLE_Y+34;
  // Fixed items
  ctx.fillStyle='#a5b4fc'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('소비 아이템',8,sy); sy+=14;
  for (const item of HERO_SHOP_FIXED) {
    const ih=38;
    const gc=item.grade==='rare'?'#60a5fa':'#94a3b8';
    roundRect(ctx,6,sy,CW-12,ih,5); ctx.fillStyle='#0d1929'; ctx.fill(); ctx.strokeStyle=gc; ctx.lineWidth=1; ctx.stroke();
    ctx.font='16px sans-serif'; ctx.textBaseline='middle'; ctx.fillText(item.icon,12,sy+ih/2);
    ctx.fillStyle='#f1f5f9'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.fillText(item.name,30,sy+ih/2-7);
    ctx.fillStyle='#cbd5e1'; ctx.font='bold 9px sans-serif'; ctx.fillText(item.desc,30,sy+ih/2+6);
    const canAff=gs.gold>=item.cost;
    const bw=60,bh=20,bx=CW-8-bw,by2=sy+(ih-bh)/2;
    roundRect(ctx,bx,by2,bw,bh,4); ctx.fillStyle=canAff?'#4c1d95':'#1e293b'; ctx.fill();
    ctx.fillStyle=canAff?'#c4b5fd':'#475569'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`${item.cost}💰`,bx+bw/2,by2+bh/2);
    gs.ui.shopItemBtns.push({x:bx,y:by2,w:bw,h:bh,item});
    sy+=ih+4;
  }

  sy+=4;
  ctx.fillStyle='#a5b4fc'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('영웅 장비 (웨이브마다 갱신)',8,sy); sy+=14;
  const shopItems=gs.town.buildings.heroShop.built?gs.town.shopItems:[];
  if (!gs.town.buildings.heroShop.built) {
    ctx.fillStyle='#374151'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('영웅 상점 건설 후 이용 가능',CW/2,sy+20);
  }
  for (const item of shopItems) {
    const ih=38;
    const gc=item.grade==='epic'?'#a78bfa':item.grade==='rare'?'#60a5fa':'#94a3b8';
    const owned=gs.town.equippedItems.includes(item.id);
    roundRect(ctx,6,sy,CW-12,ih,5); ctx.fillStyle=owned?'#141e0d':'#0d1929'; ctx.fill(); ctx.strokeStyle=gc; ctx.lineWidth=owned?2:1; ctx.stroke();
    ctx.font='18px sans-serif'; ctx.textBaseline='middle'; ctx.fillText(item.icon,12,sy+ih/2);
    ctx.fillStyle=gc; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.fillText(`[${item.slot}] ${item.name}`,32,sy+ih/2-8);
    ctx.fillStyle='#cbd5e1'; ctx.font='bold 9px sans-serif'; ctx.fillText(item.desc,32,sy+ih/2+5);
    if (owned) { ctx.fillStyle='#22c55e'; ctx.font='bold 9px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='middle'; ctx.fillText('장착중',CW-10,sy+ih/2); }
    else {
      const canAff=gs.gold>=item.cost;
      const bw=60,bh=22,bx=CW-8-bw,by2=sy+(ih-bh)/2;
      roundRect(ctx,bx,by2,bw,bh,4); ctx.fillStyle=canAff?'#2d1b69':'#1e293b'; ctx.fill();
      ctx.fillStyle=canAff?gc:'#475569'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${item.cost}💰`,bx+bw/2,by2+bh/2);
      gs.ui.shopItemBtns.push({x:bx,y:by2,w:bw,h:bh,item});
    }
    sy+=ih+4;
  }

  // Equipped items display
  if (gs.town.equippedItems.length>0) {
    sy+=4; ctx.fillStyle='#a5b4fc'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText('장착 중인 아이템:',8,sy); sy+=11;
    const icons=gs.town.equippedItems.map(id=>HERO_EQUIPMENT_POOL.find(e=>e.id===id)).filter(Boolean);
    ctx.font='14px sans-serif'; ctx.textBaseline='top';
    icons.forEach((item,i)=>{ ctx.fillText(item.icon,8+i*20,sy); });
  }
}


// ─── 마을 페이지 (full-screen) ────────────────────────────────────────────────
function renderTownPage(ctx, gs) {
  ctx.fillStyle='#080d18'; ctx.fillRect(0,0,CW,CH);
  ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1;
  for (let yy=0;yy<CH;yy+=30){ ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(CW,yy); ctx.stroke(); }

  // Header
  ctx.fillStyle='#0c1220'; ctx.fillRect(0,0,CW,50);
  ctx.strokeStyle='#1e293b'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,50); ctx.lineTo(CW,50); ctx.stroke();

  // Back button
  roundRect(ctx,8,10,60,30,6); ctx.fillStyle='#1e293b'; ctx.fill();
  ctx.strokeStyle='#475569'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('← 전투',38,25);
  gs.ui.townPageBackBtn={x:8,y:10,w:60,h:30};

  // Title
  ctx.fillStyle='#fbbf24'; ctx.font='bold 16px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🏰 마을',CW/2,25);

  // Gold
  ctx.fillStyle=COLORS.gold; ctx.font='bold 14px sans-serif';
  ctx.textAlign='right'; ctx.textBaseline='middle'; ctx.fillText(`💰 ${gs.gold}`,CW-10,25);

  // Tab bar
  const tabs=[{id:'town',label:'🏰 마을'},{id:'army',label:'⚔️ 출전준비'},{id:'towers',label:'🗼 타워배치'}];
  const tabW=(CW-8)/3;
  gs.ui.tabTownBtn=null; gs.ui.tabArmyBtn=null; gs.ui.tabTowersBtn=null;
  tabs.forEach((tab,i)=>{
    const tx=4+i*tabW,ty=54,th=34;
    const active=gs.town.tab===tab.id;
    roundRect(ctx,tx,ty,tabW-4,th,5);
    ctx.fillStyle=active?'#1e3a5f':'#0f172a'; ctx.fill();
    ctx.strokeStyle=active?'#60a5fa':'#1e293b'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle=active?'#e2e8f0':'#64748b'; ctx.font='bold 11px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(tab.label,tx+(tabW-4)/2,ty+th/2);
    if (tab.id==='town') gs.ui.tabTownBtn={x:tx,y:ty,w:tabW-4,h:th};
    else if (tab.id==='army') gs.ui.tabArmyBtn={x:tx,y:ty,w:tabW-4,h:th};
    else gs.ui.tabTowersBtn={x:tx,y:ty,w:tabW-4,h:th};
  });

  const contentY=92;
  if (gs.town.screen!=='main') {
    renderBuildingScreen(ctx,gs,gs.town.screen);
  } else if (gs.town.tab==='town') {
    renderTownPageBuildingGrid(ctx,gs,contentY);
  } else if (gs.town.tab==='army') {
    renderTownPageArmy(ctx,gs,contentY);
  } else if (gs.town.tab==='towers') {
    renderTownPageTowers(ctx,gs,contentY);
  }
}

function renderTownPageBuildingGrid(ctx, gs, startY) {
  const bw=228,bh=118,gap=8,ml=6;
  gs.ui.buildingCards=[];

  TOWN_BUILDINGS.forEach((def,i)=>{
    const col=i%2,row=Math.floor(i/2);
    const bx=ml+col*(bw+gap),by=startY+row*(bh+gap);
    const bs=gs.town.buildings[def.id];
    const built=bs&&(bs.built||def.alwaysBuilt);

    roundRect(ctx,bx,by,bw,bh,8);
    ctx.fillStyle=built?'#0d1929':'#080d18'; ctx.fill();
    ctx.strokeStyle=built?def.color:'#334155'; ctx.lineWidth=built?2:1; ctx.stroke();

    ctx.font='32px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(def.icon,bx+10,by+10);
    ctx.fillStyle=built?def.color:'#64748b'; ctx.font='bold 12px sans-serif'; ctx.fillText(def.name,bx+50,by+10);

    if (built&&def.id!=='cave') {
      const curLv=bs.level||0;
      const lvLabel=def.levels[curLv]?def.levels[curLv].levelName:`Lv.${curLv+1}`;
      ctx.fillStyle='#60a5fa'; ctx.font='bold 9px sans-serif'; ctx.fillText(lvLabel,bx+50,by+26);
    } else if (def.id==='cave') {
      ctx.fillStyle=def.color; ctx.font='bold 9px sans-serif'; ctx.textBaseline='top';
      ctx.fillText(`Lv.${gs.caveLevel}/5`,bx+50,by+26);
    }

    ctx.fillStyle='#94a3b8'; ctx.font='bold 10px sans-serif'; ctx.textBaseline='top'; ctx.fillText(def.desc,bx+10,by+52);

    if (built&&def.id!=='cave') {
      const curLv=bs.level||0;
      const totalUpgs=def.levels.slice(0,curLv+1).reduce((s,l)=>s+l.upgrades.length,0);
      const boughtUpgs=Object.keys(bs.upgrades||{}).length;
      ctx.fillStyle=boughtUpgs===totalUpgs?'#22c55e':'#94a3b8'; ctx.font='bold 9px sans-serif';
      ctx.fillText(`업그레이드 ${boughtUpgs}/${totalUpgs}`,bx+10,by+68);
    }

    const btnY=by+bh-28,btnH=22,btnW=bw-20;
    roundRect(ctx,bx+10,btnY,btnW,btnH,5);
    if (def.id==='cave') {
      const nextCv=CAVE_LEVELS[gs.caveLevel+1];
      if (nextCv) {
        const canAff=gs.gold>=nextCv.upgradeCost;
        ctx.fillStyle=canAff?'#1e3a5f':'#1a1a2e'; ctx.fill();
        ctx.strokeStyle=canAff?'#60a5fa':'#334155'; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle=canAff?'#60a5fa':'#64748b'; ctx.font='bold 10px sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(`케이브 업그레이드 ${nextCv.upgradeCost}💰`,bx+10+btnW/2,btnY+btnH/2);
        gs.ui.caveBtn={x:bx+10,y:btnY,w:btnW,h:btnH};
      } else {
        ctx.fillStyle='#0f2040'; ctx.fill(); ctx.strokeStyle='#f59e0b'; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle='#f59e0b'; ctx.font='bold 10px sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('★ 케이브 최고 레벨',bx+10+btnW/2,btnY+btnH/2);
        gs.ui.caveBtn=null;
      }
    } else if (!built) {
      const canAff=gs.gold>=def.buildCost;
      ctx.fillStyle=canAff?'#1e3a5f':'#1a1a2e'; ctx.fill();
      ctx.strokeStyle=canAff?'#22c55e':'#334155'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle=canAff?'#22c55e':'#64748b'; ctx.font='bold 10px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(`건설 ${def.buildCost}💰`,bx+10+btnW/2,btnY+btnH/2);
    } else {
      ctx.fillStyle='#0f2040'; ctx.fill(); ctx.strokeStyle=def.color; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle=def.color; ctx.font='bold 10px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('입장 →',bx+10+btnW/2,btnY+btnH/2);
    }
    gs.ui.buildingCards.push({x:bx,y:by,w:bw,h:bh,id:def.id,built});
  });

  const stripY=startY+2*(bh+gap)+4;
  roundRect(ctx,6,stripY,CW-12,44,6);
  ctx.fillStyle='#0a0d1a'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=1; ctx.stroke();
  const groups=WAVE_DEFS[gs.wave]?.battleGroups||[];
  const uniqueTypes=[...new Set(groups.flatMap(g=>g.types))];
  ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`웨이브 ${gs.wave+1} 등장 몬스터:`,12,stripY+14);
  uniqueTypes.forEach((type,i)=>{
    const mt=BATTLE_MOB_TYPES[type]; if (!mt) return;
    ctx.font='16px sans-serif'; ctx.textAlign='left'; ctx.fillText(mt.icon,12+i*36,stripY+30);
  });
  ctx.fillStyle='#475569'; ctx.font='10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`${groups.length}그룹`,12+uniqueTypes.length*36+4,stripY+30);
}

function renderTownPageArmy(ctx, gs, startY) {
  const {battle,hero}=gs;
  const lv=HERO_LEVELS[hero.level];
  const hMax=Math.round(lv.hp*BONUSES.heroStatMult);
  let y=startY;

  // ── 영웅 ─────────────────────────────────────────────────────────────────
  roundRect(ctx,6,y,CW-12,58,7);
  ctx.fillStyle='#1a2535'; ctx.fill();
  ctx.strokeStyle=hero.dead?'#7f1d1d':COLORS.hero; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#e2e8f0';
  ctx.font='24px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(hero.dead?'💀':'👑',12,y+6);
  ctx.fillStyle=hero.dead?'#f87171':COLORS.hero; ctx.font='bold 12px sans-serif';
  ctx.fillText(hero.dead?`전사 — 부활까지 ${Math.ceil(hero.reviveTimer)}s`:`영웅  Lv.${hero.level}`,44,y+6);
  ctx.fillStyle='#cbd5e1'; ctx.font='bold 10px sans-serif';
  ctx.fillText(`ATK ${Math.round((lv.atk+BONUSES.heroAtk)*BONUSES.heroStatMult)}   HP ${Math.ceil(hero.hp)}/${hMax}   DEF ${Math.round((lv.def+BONUSES.heroAura)*BONUSES.heroStatMult)}`,44,y+22);
  const maxed=hero.level>=HERO_MAX_LEVEL;
  const expR=maxed?1:hero.exp/lv.expNeeded;
  ctx.fillStyle='#1e293b'; ctx.fillRect(12,y+42,CW-28,8);
  ctx.fillStyle='#f59e0b'; ctx.fillRect(12,y+42,(CW-28)*Math.min(1,expR),8);
  ctx.fillStyle='#94a3b8'; ctx.font='8px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText(maxed?'MAX LEVEL':`EXP ${Math.floor(hero.exp)}/${lv.expNeeded}`,CW-12,y+46);
  y+=66;

  // ── 영웅 배치 ────────────────────────────────────────────────────────────
  ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('영웅 배치',6,y); y+=14;
  const btnW2=(CW-20)/2,btnH2=34;
  const pDef=hero.placement==='defense',pBat=hero.placement==='battle';
  drawBtn(ctx,6,y,btnW2,btnH2,pDef?'✅ 상단 방어 배치':'상단 방어 배치',pDef?'#064e3b':'#1e293b',pDef?'#34d399':'#60a5fa',!hero.dead);
  drawBtn(ctx,6+btnW2+8,y,btnW2,btnH2,pBat?'✅ 하단 전투 배치':'하단 전투 배치',pBat?'#4c1d95':'#1e293b',pBat?'#a78bfa':'#f87171',!hero.dead);
  gs.ui.heroDefBtn={x:6,y,w:btnW2,h:btnH2};
  gs.ui.heroBatBtn={x:6+btnW2+8,y,w:btnW2,h:btnH2};
  y+=btnH2+10;

  // ── 병력 고용 (5종, 2열 그리드) ─────────────────────────────────────────
  ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('병력 고용 — 탭하여 편성',6,y); y+=14;
  const cols=3, cardW=(CW-12-(cols-1)*6)/cols, cardH=64;
  gs.ui.hireCards=[];
  UNIT_ORDER.forEach((id,i)=>{
    const ut=UNIT_TYPES[id];
    const col=i%cols, row=Math.floor(i/cols);
    const cx=6+col*(cardW+6), cy2=y+row*(cardH+6);
    const cost=hireCost(id), canAff=gs.gold>=cost;
    roundRect(ctx,cx,cy2,cardW,cardH,6);
    ctx.fillStyle=canAff?'#1e293b':'#111827'; ctx.fill();
    ctx.strokeStyle=canAff?ut.color:'#374151'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.globalAlpha=canAff?1:0.55;
    ctx.fillStyle='#e2e8f0'; ctx.font='20px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(ut.icon,cx+cardW/2,cy2+4);
    ctx.fillStyle=canAff?'#f1f5f9':'#64748b'; ctx.font='bold 11px sans-serif';
    ctx.fillText(ut.name,cx+cardW/2,cy2+27);
    ctx.fillStyle='#94a3b8'; ctx.font='bold 8px sans-serif';
    ctx.fillText(`ATK ${ut.atk+BONUSES.unitAtk} · HP ${ut.hp+BONUSES.unitHp}`,cx+cardW/2,cy2+40);
    ctx.fillStyle=canAff?COLORS.gold:'#64748b'; ctx.font='bold 10px sans-serif';
    ctx.fillText(`💰${cost}`,cx+cardW/2,cy2+50);
    ctx.globalAlpha=1;
    gs.ui.hireCards.push({x:cx,y:cy2,w:cardW,h:cardH,typeId:id});
  });
  y += Math.ceil(UNIT_ORDER.length/cols)*(cardH+6) + 4;

  // 선택한 유닛 역할 설명
  ctx.fillStyle='#475569'; ctx.font='9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('🛡️ 방패병은 적의 표적을 끌고 전체 보호막 · ✨ 마법사는 광역 피해',6,y);
  y+=16;

  // ── 편성 슬롯 ────────────────────────────────────────────────────────────
  const hired=battle.ourTeam.filter(u=>!u.isHero);
  ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`편성된 병력 (${hired.length}/${battle.maxSlots})  ·  탭하면 해고`,6,y); y+=14;
  const slotGap=6;
  const slotW=Math.max(44,Math.min(82,Math.floor((CW-12-(battle.maxSlots-1)*slotGap)/battle.maxSlots)));
  const slotH=56;
  gs.ui.hiredSlots=[];
  for (let i=0;i<battle.maxSlots;i++) {
    const sx=6+i*(slotW+slotGap),sy=y;
    const unit=hired[i];
    roundRect(ctx,sx,sy,slotW,slotH,6);
    ctx.fillStyle=unit?'#1e3a5f':'#0f172a'; ctx.fill();
    ctx.strokeStyle=unit?(unit.color||'#60a5fa'):'#334155'; ctx.lineWidth=1.5; ctx.stroke();
    if (unit) {
      ctx.fillStyle='#e2e8f0';
      ctx.font='19px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(unit.icon,sx+slotW/2,sy+19);
      drawHPBar(ctx,sx+5,sy+slotH-17,slotW-10,4,unit.hp/unit.maxHp);
      ctx.fillStyle='#94a3b8'; ctx.font='bold 8px sans-serif'; ctx.textBaseline='bottom';
      ctx.fillText(`${Math.ceil(unit.hp)}/${unit.maxHp}`,sx+slotW/2,sy+slotH-3);
      ctx.fillStyle='#ef4444'; ctx.font='bold 10px sans-serif'; ctx.textBaseline='top';
      ctx.fillText('✕',sx+slotW-11,sy+3);
    } else {
      ctx.fillStyle='#334155'; ctx.font='22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('+',sx+slotW/2,sy+slotH/2);
    }
    gs.ui.hiredSlots.push({x:sx,y:sy,w:slotW,h:slotH,idx:i});
  }
  y+=slotH+10;

  // ── 출전 버튼 ────────────────────────────────────────────────────────────
  const ready=battle.ourTeam.length>0;
  roundRect(ctx,6,y,CW-12,44,8);
  ctx.fillStyle=ready?'#15803d':'#1f2937'; ctx.fill();
  ctx.strokeStyle=ready?'#22c55e':'#374151'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle=ready?'#fff':'#6b7280'; ctx.font='bold 15px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(ready?'▶ 출전! 웨이브 시작':'병력을 1명 이상 고용하세요',6+(CW-12)/2,y+22);
  gs.ui.deployBtn={x:6,y,w:CW-12,h:44};
  y+=52;

  // ── 팀 전투력 요약 (남는 공간 활용) ──────────────────────────────────────
  if (y < CH-40) {
    roundRect(ctx,6,y,CW-12,CH-y-10,7);
    ctx.fillStyle='#080d18'; ctx.fill(); ctx.strokeStyle='#161f30'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText('전투력 요약',14,y+9);

    const totAtk=battle.ourTeam.reduce((a,u)=>a+u.atk,0);
    const totHp =battle.ourTeam.reduce((a,u)=>a+u.maxHp,0);
    const totDef=battle.ourTeam.reduce((a,u)=>a+u.def,0);
    const rows=[
      ['총 공격력', `${totAtk}`, '#f87171'],
      ['총 체력',   `${totHp}`,  '#22c55e'],
      ['총 방어력', `${totDef}`, '#60a5fa'],
      ['웨이브 후 회복', `최대 HP의 ${Math.round((REST_HEAL_PCT+BONUSES.restHealBonus)*100)}%`, '#34d399'],
    ];
    let ry=y+30;
    for (const [label,val,col] of rows) {
      ctx.fillStyle='#64748b'; ctx.font='10px sans-serif'; ctx.textAlign='left';
      ctx.fillText(label,18,ry);
      ctx.fillStyle=col; ctx.font='bold 11px sans-serif'; ctx.textAlign='right';
      ctx.fillText(val,CW-18,ry);
      ry+=18;
    }
    ctx.strokeStyle='#161f30'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(16,ry+2); ctx.lineTo(CW-16,ry+2); ctx.stroke();
    ry+=14;

    // 획득 강화
    ctx.fillStyle='#64748b'; ctx.font='10px sans-serif'; ctx.textAlign='left';
    ctx.fillText('획득 강화',18,ry);
    const upIcons=(gs.activeUpgrades||[]).map(id=>(UPGRADE_CARDS.find(c=>c.id===id)||{}).icon||'').join(' ');
    ctx.fillStyle='#a5b4fc'; ctx.font='11px sans-serif'; ctx.textAlign='right';
    ctx.fillText(upIcons?upIcons.slice(0,40):'—',CW-18,ry);
    ry+=18;

    // 다음 웨이브 미리보기
    const nd=WAVE_DEFS[gs.wave];
    if (nd && ry < CH-40) {
      ctx.fillStyle='#64748b'; ctx.font='10px sans-serif'; ctx.textAlign='left';
      ctx.fillText('다음 웨이브',18,ry);
      const mobIcons=nd.battleGroups.map(g=>g.types.map(t=>(BATTLE_MOB_TYPES[t]||{}).icon||'').join('')).join(' › ');
      ctx.fillStyle='#f87171'; ctx.font='11px sans-serif'; ctx.textAlign='right';
      ctx.fillText(mobIcons.slice(0,34),CW-18,ry);
      ry+=18;
    }

    if (ry < CH-30) {
      ctx.fillStyle='#3f4a5c'; ctx.font='9px sans-serif'; ctx.textAlign='left';
      ctx.fillText('전투는 1초 1틱, 5틱마다 스킬이 자동 발동됩니다.',18,ry+2);
      ry+=13;
      ctx.fillText('웨이브를 클리어하면 강화 카드 3장 중 1장을 고릅니다.',18,ry+2);
    }
  }
}

function renderTownPageTowers(ctx, gs, startY) {
  // ── 타워 종류 팔레트 ─────────────────────────────────────────────────────
  ctx.fillStyle='#60a5fa'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('타워 종류를 고른 뒤 빈 셀을 탭하세요 (키보드 1~4)', CW/2, startY);

  const pw=112, ph=52, pgap=6;
  const prow = TOWER_ORDER.length;
  const totalW = prow*pw + (prow-1)*pgap;
  const px0 = Math.max(4, (CW-totalW)/2);
  const py0 = startY+16;
  gs.ui.towerTypeBtns = [];
  TOWER_ORDER.forEach((id,i) => {
    const tpl=TOWER_TYPES[id];
    const bx=px0+i*(pw+pgap);
    const cost=towerBuildCost(id, gs.towers);
    const sel=gs.selectedTowerType===id;
    const afford=gs.gold>=cost;
    roundRect(ctx,bx,py0,pw,ph,6);
    ctx.fillStyle = sel?'#152b45' : afford?'#111c2e':'#0e1017'; ctx.fill();
    ctx.strokeStyle = sel?tpl.color : afford?'#334155':'#252b38';
    ctx.lineWidth = sel?2:1; ctx.stroke();

    ctx.globalAlpha = afford?1:0.5;
    ctx.fillStyle='#e2e8f0'; ctx.font='16px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(tpl.icon, bx+7, py0+6);
    ctx.fillStyle = sel?tpl.color:'#cbd5e1'; ctx.font='bold 11px sans-serif';
    ctx.fillText(tpl.name, bx+29, py0+7);
    ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif';
    ctx.fillText(tpl.desc, bx+7, py0+26);
    ctx.fillStyle = afford?COLORS.gold:'#64748b'; ctx.font='bold 10px sans-serif';
    ctx.fillText(`${cost}💰`, bx+7, py0+38);
    ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif'; ctx.textAlign='right';
    ctx.fillText(`ATK ${Math.round(tpl.dmg+BONUSES.towerDmg)}`, bx+pw-7, py0+38);
    ctx.globalAlpha=1;

    gs.ui.towerTypeBtns.push({x:bx,y:py0,w:pw,h:ph,typeId:id});
  });

  // ── 미니 그리드 ──────────────────────────────────────────────────────────
  const scale=0.62;
  const mCW=Math.floor(CELL_W*scale),mCH=Math.floor(CELL_H*scale);
  const gridW=GRID_COLS*mCW,gridH=GRID_ROWS*mCH;
  const offX=Math.floor((CW-gridW)/2),offY=py0+ph+12;

  for (let r=0;r<GRID_ROWS;r++) {
    for (let c=0;c<GRID_COLS;c++) {
      const x=offX+c*mCW,y=offY+r*mCH;
      const isPath=PATH_CELLS.has(`${c},${r}`);
      const isBase=c===4&&r===6,isStart=c===4&&r===0;
      ctx.fillStyle=isBase?'#3f1515':isStart?'#1e3a5f':isPath?COLORS.pathCell:COLORS.defenseGrid;
      ctx.fillRect(x+1,y+1,mCW-2,mCH-2);
      if (!isPath && !isBase && !isStart) {
        ctx.strokeStyle='rgba(148,163,184,0.12)'; ctx.lineWidth=1;
        ctx.strokeRect(x+1.5,y+1.5,mCW-3,mCH-3);
      }
      const tower=gs.towers.find(tw=>tw.col===c&&tw.row===r);
      if (tower) {
        const selected=gs.ui.towerAction&&gs.ui.towerAction.col===c&&gs.ui.towerAction.row===r;
        ctx.fillStyle=selected?'rgba(99,102,241,0.5)':'rgba(34,197,94,0.22)'; ctx.fillRect(x+1,y+1,mCW-2,mCH-2);
        ctx.fillStyle='#e2e8f0';
        ctx.font=`${Math.floor(mCW*0.55)}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(TOWER_TYPES[tower.typeId].icon,x+mCW/2,y+mCH/2);
        if ((tower.level||1)>1) {
          ctx.fillStyle='#fbbf24'; ctx.font='bold 7px sans-serif'; ctx.textBaseline='bottom';
          ctx.fillText('★'.repeat((tower.level||1)-1), x+mCW/2, y+mCH-1);
        }
        if (selected) { ctx.strokeStyle='#6366f1'; ctx.lineWidth=2; ctx.strokeRect(x+1,y+1,mCW-2,mCH-2); }
      }
      if (isBase) {
        ctx.fillStyle='#fca5a5'; ctx.font=`${Math.floor(mCW*0.35)}px sans-serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('기지',x+mCW/2,y+mCH/2);
      }
    }
  }
  gs.ui.towerMiniGrid={x:offX,y:offY,cellW:mCW,cellH:mCH,scale};

  // ── 선택 타워 패널 ───────────────────────────────────────────────────────
  const panelY=offY+gridH+8;
  if (gs.ui.towerAction) {
    const ta=gs.ui.towerAction;
    const tower=gs.towers.find(tw=>tw.col===ta.col&&tw.row===ta.row);
    if (tower) {
      const lv=tower.level||1;
      const tpl=TOWER_TYPES[tower.typeId];
      const st=towerStats(tower);
      roundRect(ctx,6,panelY,CW-12,72,7);
      ctx.fillStyle='#0d1929'; ctx.fill(); ctx.strokeStyle=tpl.color; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle='#e2e8f0';
      ctx.font='20px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(tpl.icon,14,panelY+20);
      ctx.fillStyle='#f1f5f9'; ctx.font='bold 12px sans-serif';
      ctx.fillText(`${tpl.name}  Lv.${lv}/${TOWER_MAX_LEVEL}`,42,panelY+13);
      ctx.fillStyle='#94a3b8'; ctx.font='bold 10px sans-serif';
      ctx.fillText(`ATK ${st.dmg}   ${st.spd.toFixed(2)}/s   사거리 ${Math.round(st.range)}px   처치 ${tower.kills}`,42,panelY+29);

      const upgCost=towerUpgradeCost(tower);
      if (upgCost!==null) {
        const canAff=gs.gold>=upgCost,bw2=150,bh2=26;
        drawBtn(ctx,10,panelY+42,bw2,bh2,`강화 Lv.${lv+1}  ${upgCost}💰`,canAff?'#1e3a5f':'#1e293b',canAff?'#60a5fa':'#64748b',canAff);
        gs.ui.towerUpgradeBtn={x:10,y:panelY+42,w:bw2,h:bh2};
      } else {
        gs.ui.towerUpgradeBtn=null;
        ctx.fillStyle='#f59e0b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
        ctx.fillText('★ 최고 레벨',12,panelY+55);
      }
      const rbw=110,rbh=26,rbx=CW-10-rbw;
      drawBtn(ctx,rbx,panelY+42,rbw,rbh,`🗑 판매 +${towerSellValue(tower)}💰`,'#3f1515','#ef4444');
      gs.ui.towerRemoveBtn={x:rbx,y:panelY+42,w:rbw,h:rbh};
    }
  } else {
    const tpl=TOWER_TYPES[gs.selectedTowerType]||TOWER_TYPES.arrow;
    roundRect(ctx,6,panelY,CW-12,72,7);
    ctx.fillStyle='#080d18'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`선택: ${tpl.icon} ${tpl.name} — ${towerBuildCost(gs.selectedTowerType, gs.towers)}💰`,CW/2,panelY+20);
    ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif';
    ctx.fillText(tpl.desc,CW/2,panelY+38);
    ctx.fillStyle='#475569'; ctx.font='10px sans-serif';
    ctx.fillText('빈 셀 탭 = 건설 / 세운 타워 탭 = 강화·판매',CW/2,panelY+56);
    gs.ui.towerUpgradeBtn=null; gs.ui.towerRemoveBtn=null;
  }

  // ── 배치 요약 (빈 공간 활용) ─────────────────────────────────────────────
  const infoY=panelY+80;
  roundRect(ctx,6,infoY,CW-12,CH-infoY-10,7);
  ctx.fillStyle='#080d18'; ctx.fill(); ctx.strokeStyle='#161f30'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('배치 현황',14,infoY+9);

  const counts={};
  let totalKills=0, totalInvest=0;
  for (const t of gs.towers) {
    counts[t.typeId]=(counts[t.typeId]||0)+1;
    totalKills+=t.kills||0; totalInvest+=t.invested||0;
  }
  let ry=infoY+28;
  for (const id of TOWER_ORDER) {
    const n=counts[id]||0;
    const tpl=TOWER_TYPES[id];
    ctx.fillStyle = n>0?'#e2e8f0':'#3f4a5c'; ctx.font='11px sans-serif'; ctx.textAlign='left';
    ctx.fillText(`${tpl.icon} ${tpl.name}`,18,ry);
    ctx.fillStyle = n>0?tpl.color:'#3f4a5c'; ctx.font='bold 11px sans-serif'; ctx.textAlign='right';
    ctx.fillText(`${n}기`,CW-58,ry);
    ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
    ctx.fillText(`다음 ${towerBuildCost(id, gs.towers)}💰`,CW-18,ry+1);
    ry+=20;
  }
  ctx.strokeStyle='#1e293b'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(16,ry+4); ctx.lineTo(CW-16,ry+4); ctx.stroke();
  ry+=16;
  ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left';
  ctx.fillText(`총 ${gs.towers.length}기 · 누적 처치 ${totalKills} · 투자 ${totalInvest}💰`,18,ry);
  ry+=18;
  ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
  ctx.fillText('같은 종류를 많이 지을수록 건설비가 오릅니다.',18,ry);
  ry+=13;
  ctx.fillText('∞ 경로는 같은 칸을 두 번 지나므로 교차 지점이 가장 효율적입니다.',18,ry);
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

  // 버전 표기 (시작 버튼 바로 위 우측)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText('v0.2.0.0', CW - 8, by - 6);

  ctx.restore();
}
