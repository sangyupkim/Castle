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
// 이 칸에 깔 타일 — 없는 것은 한 단계씩 일반 타일로 내려간다.
// 길 코너/교차를 안 넣어도 길 타일 하나로 전부 깔린다.
function tileSpriteKey(c, r, isPath, isStart, isEnd, isCross) {
  if (isStart) return Sprites.pick('tile.start', 'tile.path', 'tile.ground');
  if (isEnd)   return Sprites.pick('tile.base',  'tile.path', 'tile.ground');
  if (isCross) return Sprites.pick('tile.path_cross', 'tile.path', 'tile.ground');
  if (isPath) {
    // 꺾이는 칸이면 코너 타일을 우선 — 이웃 길칸이 대각으로 붙어 있으면 코너다
    const up=PATH_CELLS.has(`${c},${r-1}`), dn=PATH_CELLS.has(`${c},${r+1}`);
    const lf=PATH_CELLS.has(`${c-1},${r}`), rt=PATH_CELLS.has(`${c+1},${r}`);
    const corner = (up||dn) && (lf||rt);
    return corner ? Sprites.pick('tile.path_corner', 'tile.path', 'tile.ground')
                  : Sprites.pick('tile.path', 'tile.ground');
  }
  // 빈 칸은 두 종류를 섞어 깐다 — 같은 타일이 63칸이면 격자가 그대로 보인다
  if (Sprites.has('tile.ground2') && ((c*7 + r*3) % 5 === 0)) return 'tile.ground2';
  return Sprites.pick('tile.ground');
}

function renderDefense(ctx, gs) {
  ctx.fillStyle = COLORS.defenseBg;
  ctx.fillRect(0, DEFENSE_Y, CW, DEFENSE_H);

  for (let r=0; r<GRID_ROWS; r++) {
    for (let c=0; c<GRID_COLS; c++) {
      const x = GRID_OX + c*CELL_W, y = GRID_OY + r*CELL_H;
      const isPath  = PATH_CELLS.has(`${c},${r}`);
      const isStart = c===4 && r===0, isEnd = c===4 && r===6;
      const isCross = c===4 && r>=1 && r<=4;

      // 그림이 있으면 타일을 깔고, 없으면 지금까지처럼 색 사각형을 그린다.
      // 한 종류만 넣어도 그 칸부터 바뀌도록 칸마다 따로 판단한다.
      const key = tileSpriteKey(c, r, isPath, isStart, isEnd, isCross);
      if (!(key && Sprites.draw(ctx, key, x, y, CELL_W, CELL_H))) {
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
      }
      // 시작·기지 글자는 그림이 있어도 남긴다 — 어디로 들어와 어디를 지키는지가 규칙이라서
      if (isStart) labelCell(ctx,'시작',x,y,'#93c5fd');
      if (isEnd)   labelCell(ctx,'🏰마을',x,y,'#fca5a5');

      // Hover
      if (!isPath && gs.hoveredCell && gs.hoveredCell.c===c && gs.hoveredCell.r===r) {
        ctx.fillStyle='rgba(99,102,241,0.25)'; ctx.fillRect(x+1,y+1,CELL_W-2,CELL_H-2);
        ctx.strokeStyle='#6366f1'; ctx.lineWidth=1.5; ctx.strokeRect(x+1,y+1,CELL_W-2,CELL_H-2);
      }
    }
  }

  // 항로 — 이번 웨이브에 비행이 있으면 하늘길을 미리 보여준다.
  // 어디를 비워두면 안 되는지 알아야 배치를 고민할 수 있다.
  const waveHasAir = (waveDefFor(gs.wave)?.defenseEnemies || [])
                      .some(d => (ENEMY_TYPES[d.type] || {}).flying);
  if (waveHasAir || gs.defenseEnemies.some(e => e.flying)) {
    for (const lane of [AIR_PATH_L, AIR_PATH_R]) {
      ctx.strokeStyle = 'rgba(192,132,252,0.30)';
      ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
      ctx.beginPath();
      lane.forEach(([c, r], i) => {
        const p = cellCenter(c, r);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke(); ctx.setLineDash([]);
      const s0 = cellCenter(lane[0][0], lane[0][1]);
      ctx.fillStyle = 'rgba(192,132,252,0.75)'; ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔺', s0.x, s0.y);
    }
  }

  drawPathFlow(ctx, THE_PATH, 'rgba(239,68,68,0.4)');

  // ── 다음 경로 예고 ───────────────────────────────────────────────────────
  // 관문에서 경로가 바뀐다. 미리 보여줘야 두 경로가 함께 쓰는 칸에 지어둘 수 있고,
  // 그러면 경로 변경이 사고가 아니라 준비할 수 있는 일이 된다.
  if (wm && wm.phase === 'idle') {
    const prev = nextPathPreview(gs, gs.wave);
    if (prev) {
      ctx.strokeStyle = 'rgba(34,211,238,0.42)';
      ctx.lineWidth = 2.5; ctx.setLineDash([4, 5]);
      ctx.beginPath();
      prev.cells.forEach(([c, r], i) => {
        const pt = cellCenter(c, r);
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke(); ctx.setLineDash([]);
      // 다음 경로에만 있는 칸 = 지금 지으면 옮겨질 자리
      const cur = PATH_CELLS;
      ctx.fillStyle = 'rgba(34,211,238,0.16)';
      for (const [c, r] of prev.cells) {
        if (cur.has(`${c},${r}`)) continue;
        ctx.fillRect(GRID_OX + c*CELL_W + 1, GRID_OY + r*CELL_H + 1, CELL_W-2, CELL_H-2);
      }
    }
  }

  // ── 방금 이설된 타워 표시 ────────────────────────────────────────────────
  const relAge = gs.pathChanged ? (Date.now() - gs.pathChanged.at) / 1000 : 99;
  if (relAge < 6) {
    for (const t of gs.towers) {
      if (!t.relocatedAt || Date.now() - t.relocatedAt > 6000) continue;
      const cc = cellCenter(t.col, t.row);
      const pulse = 0.35 + 0.35 * Math.sin(Date.now() / 220);
      ctx.strokeStyle = `rgba(56,189,248,${pulse})`; ctx.lineWidth = 2;
      ctx.strokeRect(GRID_OX + t.col*CELL_W + 2, GRID_OY + t.row*CELL_H + 2, CELL_W-4, CELL_H-4);
    }
  }

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
      // 준비 화면에서는 정보만 — 강화·철거 버튼을 아예 그리지 않는다
      if (ta.readonly) {
        const st = towerStats(tower);
        roundRect(ctx,ax,ay2,aw,ah,4); ctx.fillStyle='#0f172a'; ctx.fill();
        ctx.strokeStyle='#475569'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle= st.sealed ? '#ef4444' : '#cbd5e1'; ctx.font='bold 8px sans-serif';
        ctx.fillText(st.sealed ? `Lv.${lv} · 🔒침묵` : `Lv.${lv} · ⚔${st.dmg} · ◎${Math.round(st.range)}`,
                     ax+aw/2, ay2+ah/2-4);
        ctx.fillStyle='#475569'; ctx.font='bold 7px sans-serif';
        ctx.fillText('강화·철거는 🏰마을에서', ax+aw/2, ay2+ah/2+7);
        gs.ui.towerUpgradeBtn=null; gs.ui.towerRemoveBtn=null;
        return;
      }
      roundRect(ctx,ax,ay2,aw,ah,4); ctx.fillStyle='#0f172a'; ctx.fill(); ctx.strokeStyle='#f59e0b'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle='#f59e0b'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`Lv.${lv}/${TOWER_MAX_LEVEL}`,ax+18,ay2+ah/2);
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

// 타워 그림 규격 — 칸(53×50)보다 세로로 길어서 칸 위로 솟는다
const TOWER_ART_W = 48, TOWER_ART_H = 56;

function renderTower(ctx, t) {
  const {x,y}=cellCenter(t.col,t.row);
  const tpl=TOWER_TYPES[t.typeId];
  const kick=t.muzzle>0?1.5:0;
  const key = towerSpriteKey(t.typeId, t.level);
  if (key) {
    // 발밑을 칸 아래쪽에 맞춘다 — 바닥선이 맞아야 앞뒤가 읽힌다
    const footY = y + CELL_H/2 - 2;
    const k = 1 + kick*0.03;   // 발사 반동
    Sprites.drawFoot(ctx, key, x, footY, TOWER_ART_W*k, TOWER_ART_H*k);
  } else {
  ctx.fillStyle='#0f2540';
  roundRect(ctx,x-CELL_W/2+3,y-CELL_H/2+3,CELL_W-6,CELL_H-6,4); ctx.fill();
  ctx.fillStyle=tpl.color;
  ctx.fillRect(x-9-kick,y-9-kick,18+kick*2,18+kick*2);
  ctx.fillStyle='#0f172a';
  ctx.font='13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(tpl.icon,x,y+1);
  ctx.strokeStyle=tpl.color; ctx.lineWidth=1; ctx.strokeRect(x-9,y-9,18,18);
  }
  const tlv = t.level || 1;
  if (tlv > 1) {
    // Lv.4~5는 별 네 개가 칸을 넘치므로 숫자로 표기한다.
    // 그림을 쓰면 몸통 한가운데라 글자가 묻힌다 — 칸 바닥으로 내린다.
    ctx.fillStyle='#fbbf24'; ctx.font='bold 7px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline= key ? 'bottom' : 'top';
    ctx.fillText(tlv <= 3 ? '★'.repeat(tlv-1) : `Lv${tlv}`, x, key ? y+CELL_H/2-1 : y+9);
  }
}

function renderDefEnemy(ctx, e) {
  const slowed = e.slowTimer > 0;
  const bob    = e.flying ? Math.sin(Date.now()/220 + e.id) * 2.5 : 0;
  const ey     = e.y + bob;

  // 비행은 바닥에 그림자를 깔아 "떠 있다"를 읽히게 한다
  if (e.flying) {
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.radius * 0.7, e.radius * 0.7, e.radius * 0.26, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  }
  if (slowed) {
    ctx.beginPath(); ctx.arc(e.x,ey,e.radius+3,0,Math.PI*2);
    ctx.fillStyle='rgba(56,189,248,0.30)'; ctx.fill();
  }
  // 현상수배는 금색 링으로 즉시 눈에 띄게
  if (e.isBounty) {
    const t = (Date.now()%900)/900;
    ctx.beginPath(); ctx.arc(e.x, ey, e.radius + 5 + t*5, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(251,191,36,${0.85-t*0.7})`; ctx.lineWidth = 2.5; ctx.stroke();
  }

  ctx.beginPath(); ctx.arc(e.x,ey,e.radius,0,Math.PI*2);
  ctx.fillStyle = e.hitFlash>0 ? '#ffffff' : (slowed ? '#7dd3fc' : ENEMY_TYPES[e.typeId].color);
  ctx.fill();
  ctx.strokeStyle = e.isBounty ? '#fbbf24' : e.flying ? '#e9d5ff' : (e.armor||0)>0 ? '#cbd5e1' : '#fff';
  ctx.lineWidth = (e.isBounty || (e.armor||0)>0) ? 2 : 1;
  ctx.stroke();

  // 등급 태그 — 어떤 타워로 잡아야 하는지 한 글자로
  const cls = MOB_CLASSES[e.cls || 'medium'];
  if (cls && e.radius >= 8) {
    ctx.fillStyle = '#0f172a'; ctx.font = `bold ${Math.round(e.radius*0.95)}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(cls.tag, e.x, ey + 0.5);
  }

  drawHPBar(ctx, e.x-e.radius, ey-e.radius-7, e.radius*2, 4, e.hp/e.maxHp);
}

// 전사한 영웅이 언제 돌아오는지 — 화면마다 같은 말을 쓰기 위해 한곳에 둔다
function heroDownLabel(hero) {
  const n = hero.downFor || 0;
  return n > 0 ? `${n}개 층 결장` : '이 층 끝나면 복귀';
}

function renderHeroInDefense(ctx, hero) {
  if (hero.dead) {
    ctx.globalAlpha=0.4;
    ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('💀', hero.defX, hero.defY);
    ctx.globalAlpha=1;
    ctx.fillStyle='#f87171'; ctx.font='bold 8px sans-serif'; ctx.textBaseline='top';
    ctx.fillText(heroDownLabel(hero), hero.defX, hero.defY+12);
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
  const hMax = Math.round((lv.hp + BONUSES.heroHpFlat) * BONUSES.heroStatMult * BONUSES.sigilHeroHpMult);
  drawHPBar(ctx, hx-16, hy+r+2, 32, 4, hero.hp/hMax);
  ctx.fillStyle=COLORS.hero; ctx.font='bold 8px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(`Lv.${hero.level}`, hx, hy+r+8);
}

// ─── 일시정지 오버레이 ───────────────────────────────────────────────────────
function renderPauseOverlay(ctx) {
  ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(0,0,CW,CH);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#e2e8f0'; ctx.font='bold 28px sans-serif';
  ctx.fillText('⏸ 일시정지', CW/2, CH/2-96);

  const st = getStageInfo(gs.wave);
  ctx.fillStyle='#64748b'; ctx.font='12px sans-serif';
  ctx.fillText(st.endless ? `∞ ${st.tier}층 진행 중` : `훈련 ${st.stageLabel}`, CW/2, CH/2-66);

  // 재개
  const bw=220, bh=48, bx=(CW-bw)/2;
  let y = CH/2-30;
  roundRect(ctx,bx,y,bw,bh,10);
  ctx.fillStyle='#14532d'; ctx.fill(); ctx.strokeStyle='#22c55e'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif';
  ctx.fillText('▶ 계속하기', CW/2, y+bh/2);
  gs.ui.pauseResumeBtn = {x:bx,y:y,w:bw,h:bh};
  y += bh + 14;

  // 포기 — 되돌릴 수 없으니 두 번 눌러야 한다
  roundRect(ctx,bx,y,bw,bh,10);
  ctx.fillStyle = _giveUpArmed ? '#7f1d1d' : '#1f2937'; ctx.fill();
  ctx.strokeStyle = _giveUpArmed ? '#ef4444' : '#475569'; ctx.lineWidth = _giveUpArmed ? 2 : 1; ctx.stroke();
  ctx.fillStyle = _giveUpArmed ? '#fecaca' : '#94a3b8'; ctx.font='bold 14px sans-serif';
  ctx.fillText(_giveUpArmed ? '⚠ 정말 포기합니다 — 다시 탭' : '🏳 포기하고 정산', CW/2, y+bh/2-7);
  ctx.fillStyle = _giveUpArmed ? '#f87171' : '#475569'; ctx.font='bold 9px sans-serif';
  const gaveUpGems = Math.max(1, Math.round(calcSoulStones(gs) * GIVE_UP_GEM_MULT));
  ctx.fillText(`정산 💎${gaveUpGems}  —  끝까지 버티면 ${Math.round((1-GIVE_UP_GEM_MULT)*100)}% 더`, CW/2, y+bh/2+11);
  gs.ui.pauseGiveUpBtn = {x:bx,y:y,w:bw,h:bh};
  y += bh + 18;

  ctx.fillStyle='#334155'; ctx.font='11px sans-serif';
  ctx.fillText('P 키 또는 ⏸ 버튼으로도 재개됩니다', CW/2, y);
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
  if (si.endless) {
    const bst = gs.stats.bestEndless || 0;
    ctx.fillStyle = si.tier > bst ? '#4ade80' : '#94a3b8';
    ctx.fillText(si.tier > bst ? '신기록' : `최고 ${bst}`, 42, cy-12);
    if (gs.floorEvent) {
      ctx.font='bold 10px sans-serif';
      ctx.fillStyle = gs.floorEvent.tone === 'good' ? '#4ade80'
                    : gs.floorEvent.tone === 'bad'  ? '#f87171' : '#fbbf24';
      ctx.fillText(`${gs.floorEvent.icon}${gs.floorEvent.name}`, 88, cy-12);
    }
  } else {
    ctx.fillText(`웨이브 ${si.waveInStage+1}/3`, 30, cy-12);
  }

  // 타이머 — 이제 "몹이 나오는 시간"이다.
  // 다 나온 뒤에는 판을 비울 때까지 계속되므로 그 상태를 따로 알려준다.
  const cleaning = wm.phase==='active' && wm.timer <= 0;
  const tv = wm.phase==='active'       ? Math.ceil(wm.timer)
           : wm.phase==='intermission' ? Math.ceil(wm.intermissionTimer)
           : waveDuration();
  let tlabel;
  if (cleaning) {
    const leftTop = gs.defenseEnemies.filter(e=>!e.dead&&!e.reached).length;
    const leftBot = gs.arena.mobs.filter(m=>!m.dead).length;
    tlabel = `정리 중 ${leftTop+leftBot}`;
  } else if (wm.phase==='intermission') {
    tlabel = `준비 ${tv}s`;
  } else {
    tlabel = `${String(Math.floor(tv/60)).padStart(2,'0')}:${String(tv%60).padStart(2,'0')}`;
  }
  ctx.fillStyle = cleaning ? '#22d3ee'
                : (wm.phase==='active' && tv<=10 ? '#ef4444' : COLORS.gold);
  ctx.font='bold 13px monospace'; ctx.textAlign='left';
  ctx.fillText(`${cleaning?'🧹':'⏱'} ${tlabel}`, 8, cy+4);

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
               : bp==='retreated'     ? '🛡 후퇴 — 병력 보존'
               : bp==='idle_defeated' ? '❌ 병력 전멸'
               : bp==='lost'          ? '❌ 전멸'
               : '';
  ctx.fillStyle = bp==='retreated' ? '#7dd3fc'
                : bp==='fighting'||bp==='won' ? '#22c55e'
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
    // 마을로 가는 길은 아래 [🏰 마을] 하나뿐이다.
    // 여기에도 같은 버튼을 두면 화면에 마을 입구가 둘이 되어 어느 쪽이 무엇인지 헷갈린다.
    drawBtn(ctx,bx,by2,bw,bh,'⏸ 준비 중','#141c2e','#475569',false);
  }
  gs.ui.waveBtn = (wm.phase==='idle') ? null : {x:bx,y:by2,w:bw,h:bh};
  gs.ui.uibarTownBtn = null;
}

// ─── Battle Zone ─────────────────────────────────────────────────────────────
let _briefBottom = 0;   // 브리핑이 그린 마지막 y — 스크롤 범위 계산에 쓴다

function renderBattle(ctx, gs) {
  ctx.fillStyle='#0a1520'; ctx.fillRect(0,BATTLE_Y,CW,BATTLE_H);

  if (wm.phase==='idle') {
    // 준비 화면은 층 정보가 늘면 아래가 잘린다 (층 이벤트 · 변형 · 이월 · 경로 변경…).
    // 마을 탭과 같은 방식으로 스크롤한다 — 렌더러에 스크롤이 반영된 기준선을 넘겨
    // 그림과 버튼 좌표가 함께 움직이게 한다.
    const scroll = gs.briefScroll || 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, BATTLE_Y, CW, BATTLE_H); ctx.clip();
    _briefBottom = BATTLE_Y;
    renderBriefing(ctx, gs, BATTLE_Y - scroll);
    ctx.restore();

    const contentH  = (_briefBottom + scroll) - BATTLE_Y + 8;
    const maxScroll = Math.max(0, contentH - BATTLE_H);
    gs.briefScroll = Math.max(0, Math.min(maxScroll, scroll));
    gs.ui.briefScroll = maxScroll > 0 ? {x:0,y:BATTLE_Y,w:CW,h:BATTLE_H,max:maxScroll} : null;
    if (maxScroll > 0) drawScrollHint(ctx, BATTLE_Y, BATTLE_H, gs.briefScroll, maxScroll);
  } else if (wm.phase==='upgradePick') {
    gs.ui.briefScroll = null;
    ctx.fillStyle='#080d18'; ctx.fillRect(0,BATTLE_Y,CW,BATTLE_H);
  } else {
    gs.ui.briefScroll = null;
    renderArenaPhase(ctx,gs);
  }
  renderBattleControls(ctx, gs);
}

// ─── 컨트롤 바 (아레나 아래 32px) ────────────────────────────────────────────
function renderBattleControls(ctx, gs) {
  const fighting = wm.phase==='active';
  const by = fighting ? (ARENA_Y + ARENA_H + 4) : (BATTLE_Y + 6);
  const bw=34, bh=24, gap=4;
  const x3=CW-6-bw, x2=x3-bw-gap, x1=x2-bw-gap;

  if (fighting) { ctx.fillStyle='#080e18'; ctx.fillRect(0, ARENA_Y+ARENA_H, CW, ARENA_CTRL_H); }

  drawBtn(ctx,x1,by,bw,bh,_paused?'▶':'⏸','#111c2e','#a5b4fc',true);
  drawBtn(ctx,x2,by,bw,bh,`x${gameSpeed()}`,gameSpeed()>1?'#3b1d6e':'#111c2e',gameSpeed()>1?'#c4b5fd':'#94a3b8',true);
  drawBtn(ctx,x3,by,bw,bh,SFX.isMuted()?'🔇':'🔊','#111c2e','#94a3b8',true);
  gs.ui.ctrlPause={x:x1,y:by,w:bw,h:bh};
  gs.ui.ctrlSpeed={x:x2,y:by,w:bw,h:bh};
  gs.ui.ctrlMute ={x:x3,y:by,w:bw,h:bh};

  if (fighting && gs.battle.phase==='fighting') {
    // ⚙ 자동/수동 · 🛡 후퇴
    const manual = gs.arena.mode==='manual';
    const mw=76, mx=6;
    drawBtn(ctx,mx,by,mw,bh, manual?'⚙ 수동':'⚙ 자동',
            manual?'#4c1d95':'#111c2e', manual?'#ddd6fe':'#94a3b8', true, 10);
    gs.ui.modeBtn={x:mx,y:by,w:mw,h:bh};

    // 후퇴 비용을 버튼에 직접 띄운다 — 누르기 전에 값을 알아야 판단이 된다
    const cost = retreatCost(wm.timer);
    const rw=84, rx=mx+mw+6;
    drawBtn(ctx,rx,by,rw,bh, cost>0?`🛡 후퇴 -${cost}`:'🛡 후퇴',
            cost>=14?'#4c1020':'#1e3a4f', cost>=14?'#fca5a5':'#7dd3fc', true, 10);
    gs.ui.retreatBtn={x:rx,y:by,w:rw,h:bh};
  } else {
    gs.ui.modeBtn=null;
    gs.ui.retreatBtn=null;
  }
}

// ─── 출전 브리핑 (웨이브 대기 화면) ──────────────────────────────────────────
function renderBriefing(ctx, gs, top) {
  const TOP = (top === undefined) ? BATTLE_Y : top;
  ctx.fillStyle='#0c1421'; ctx.fillRect(0,BATTLE_Y,CW,BATTLE_H);   // 배경은 화면 고정

  const st  = getStageInfo(gs.wave);
  const def = waveDefFor(gs.wave) || { arenaPool:[], defenseEnemies:[] };

  ctx.fillStyle='#a5b4fc'; ctx.font='bold 13px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle = st.endless ? '#c4b5fd' : '#a5b4fc';
  const gate = st.endless && st.isBossStage;
  if (gate) ctx.fillStyle = '#fbbf24';
  ctx.fillText(st.endless ? (gate ? `🏁 ${st.tier}층 — 관문` : `∞ ${st.tier}층`)
                          : `훈련 — 스테이지 ${st.stageLabel}`, 10, TOP+9);
  ctx.fillStyle='#475569'; ctx.font='bold 10px sans-serif';
  ctx.fillText(st.endless ? `적 HP ×${endlessStatMult(gs.wave).toFixed(1)} · 이동 ×${endlessSpdMult(gs.wave).toFixed(2)} · 이 층 보석 +${endlessGemStep(st.tier).toFixed(1)}`
                          : `웨이브 ${st.waveInStage+1}/3${st.isBossStage?'  ★보스 스테이지':''}`, 10, TOP+26);

  // 최고 기록 — 지금 어디쯤인지가 무한의 유일한 좌표다
  if (st.endless) {
    const best = gs.stats.bestEndless || 0;
    ctx.textAlign='right'; ctx.fillStyle = st.tier > best ? '#22c55e' : '#334155';
    ctx.font='bold 10px sans-serif';
    ctx.fillText(st.tier > best ? `★ 신기록 구간` : `최고 ${best}층`, CW-10, TOP+12);
    ctx.textAlign='left';
  }

  let y = TOP+44;

  // ── 경로 변경 안내 ───────────────────────────────────────────────────────
  const pc = gs.pathChanged;
  if (pc && pc.wave === gs.wave) {
    const ph2 = 26;
    roundRect(ctx, 6, y, CW-12, ph2, 6);
    ctx.fillStyle='rgba(8,47,73,0.55)'; ctx.fill();
    ctx.strokeStyle='#0891b2'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#22d3ee'; ctx.font='bold 11px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText('🛤 경로가 바뀌었습니다', 12, y+ph2/2);
    ctx.fillStyle='#0e7490'; ctx.font='bold 9px sans-serif'; ctx.textAlign='right';
    ctx.fillText(pc.refunded
        ? `타워 ${pc.moved}기 이설 · ${pc.refunded}기 환불 +${pc.gold}💰`
        : `타워 ${pc.moved}기를 인접 칸으로 옮겼습니다 (레벨 유지)`, CW-12, y+ph2/2+1);
    ctx.textAlign='left'; ctx.textBaseline='top';
    y += ph2 + 5;
  }

  // ── 다음 층 경로 예고 ────────────────────────────────────────────────────
  const nextPath = nextPathPreview(gs, gs.wave);
  if (nextPath) {
    const nh = 26;
    roundRect(ctx, 6, y, CW-12, nh, 6);
    ctx.fillStyle='rgba(8,47,73,0.35)'; ctx.fill();
    ctx.strokeStyle='#155e75'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#67e8f9'; ctx.font='bold 11px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText('🛤 다음 층에서 경로가 바뀝니다', 12, y+nh/2);
    ctx.fillStyle='#0e7490'; ctx.font='bold 9px sans-serif'; ctx.textAlign='right';
    ctx.fillText('격자에 점선으로 표시 · 겹치는 칸에 지으면 안 옮겨집니다', CW-12, y+nh/2+1);
    ctx.textAlign='left'; ctx.textBaseline='top';
    y += nh + 5;
  }

  // ── 이 층의 이벤트 ───────────────────────────────────────────────────────
  // 변형(적 숫자)과 달리 이벤트는 이 층 동안의 규칙을 바꾼다. 제일 먼저 보여야 한다.
  const ev = gs.floorEvent;
  if (st.endless && ev && ev.parts) {
    // 심층 — 해로운 것과 이로운 것이 함께 걸린다. 한 줄에 우겨넣으면 못 읽으므로 나눠 쓴다.
    const eh = 46;
    roundRect(ctx, 6, y, CW-12, eh, 6);
    ctx.fillStyle = 'rgba(49,10,84,0.48)'; ctx.fill();
    ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle='#d8b4fe'; ctx.font='bold 9px sans-serif';
    ctx.fillText('🌑 심층 — 두 규칙이 겹칩니다', 12, y+9);
    ev.parts.forEach((pt, i) => {
      const py = y + 24 + i*15;
      const col = pt.tone === 'good' ? '#4ade80' : pt.tone === 'bad' ? '#f87171' : '#fbbf24';
      ctx.fillStyle = col; ctx.font='bold 10px sans-serif';
      ctx.fillText(`${pt.icon} ${pt.name}`, 12, py);
      ctx.fillStyle = '#8b7bb8'; ctx.font='9px sans-serif';
      ctx.fillText(pt.desc, 92, py+1);
    });
    ctx.textAlign='left'; ctx.textBaseline='top';
    y += eh + 5;
  } else if (st.endless && ev) {
    const eh = 32;
    const tone = ev.tone === 'good' ? { bg:'rgba(20,83,45,0.42)',  bd:'#22c55e', fg:'#4ade80', sub:'#15803d' }
               : ev.tone === 'bad'  ? { bg:'rgba(127,29,29,0.42)', bd:'#ef4444', fg:'#f87171', sub:'#991b1b' }
                                    : { bg:'rgba(120,53,15,0.42)', bd:'#f59e0b', fg:'#fbbf24', sub:'#b45309' };
    roundRect(ctx, 6, y, CW-12, eh, 6);
    ctx.fillStyle = tone.bg; ctx.fill();
    ctx.strokeStyle = tone.bd; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = tone.fg; ctx.font='bold 12px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(`${ev.icon} ${ev.name}`, 12, y+eh/2-6);
    ctx.fillStyle = tone.sub; ctx.font='bold 9px sans-serif';
    ctx.fillText(ev.desc, 12, y+eh/2+8);
    ctx.textAlign='right'; ctx.fillStyle = tone.sub; ctx.font='bold 8px sans-serif';
    ctx.fillText('이 층에만 적용', CW-12, y+eh/2);
    ctx.textAlign='left'; ctx.textBaseline='top';
    y += eh + 5;
  }

  // ── 이 층의 변형 ─────────────────────────────────────────────────────────
  // 같은 곡선을 올리기만 하면 40층과 41층이 구분되지 않는다.
  // 층마다 붙는 성격을 먼저 보여줘야 "이번엔 뭘 세우지"를 묻게 된다.
  const affixes = (def.affixes || []);
  if (st.endless && (affixes.length || gate)) {
    const ah = 30;
    roundRect(ctx, 6, y, CW-12, ah, 6);
    ctx.fillStyle = gate ? 'rgba(120,53,15,0.35)' : 'rgba(76,29,149,0.30)'; ctx.fill();
    ctx.strokeStyle = gate ? '#f59e0b' : '#7c3aed'; ctx.lineWidth=1; ctx.stroke();
    let ax = 12;
    if (gate) {
      ctx.fillStyle='#fbbf24'; ctx.font='bold 10px sans-serif';
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText('🏁 관문 · 대형 집중', ax, y+ah/2);
      ax += 108;
    }
    affixes.forEach(a => {
      ctx.fillStyle='#c4b5fd'; ctx.font='bold 10px sans-serif';
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(`${a.icon} ${a.name}`, ax, y+ah/2-5);
      ctx.fillStyle='#6d5b9e'; ctx.font='bold 8px sans-serif';
      ctx.fillText(a.desc, ax, y+ah/2+7);
      ax += Math.max(72, ctx.measureText(a.desc).width + 14);
    });
    ctx.textBaseline='top';
    y += ah + 5;
  }

  // ── 잔존 침입자 ──────────────────────────────────────────────────────────
  // 지난 웨이브에 못 잡고 넘긴 적. 이번 웨이브 물량 위에 그대로 얹히므로
  // 배치를 바꿀지 현상수배를 참을지 판단하려면 먼저 보여야 한다.
  const carried = gs.defenseEnemies.filter(e => !e.dead && !e.reached).length;
  if (carried > 0) {
    const ch = 26;
    roundRect(ctx, 6, y, CW-12, ch, 6);
    ctx.fillStyle='rgba(120,53,15,0.40)'; ctx.fill();
    ctx.strokeStyle='#f59e0b'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#fbbf24'; ctx.font='bold 11px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(`⚠️ 잔존 침입자 ${carried}기`, 12, y+ch/2);
    ctx.fillStyle='#b45309'; ctx.font='bold 9px sans-serif'; ctx.textAlign='right';
    ctx.fillText('지난 웨이브에 못 막은 적이 경로 위에서 계속 옵니다', CW-12, y+ch/2+1);
    ctx.textAlign='left'; ctx.textBaseline='top';
    y += ch + 5;
  }

  // ── 아레나 스폰 풀 ───────────────────────────────────────────────────────
  const panelH = 74;
  roundRect(ctx,6,y,CW-12,panelH,7);
  ctx.fillStyle='#0a1019'; ctx.fill(); ctx.strokeStyle='#3f1d1d'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#f87171'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('⚔️ 아레나 — 60초 내내 리젠 · 갈수록 촘촘하고 강해집니다', 12, y+7);

  const pool = def.arenaPool || [];
  const total = pool.reduce((a,[,w])=>a+w, 0) || 1;
  const pw = Math.floor((CW-24 - (pool.length-1)*5) / Math.max(1,pool.length));
  pool.forEach(([id,w],i) => {
    const t = BATTLE_MOB_TYPES[id]; if (!t) return;
    const px = 12 + i*(pw+5);
    roundRect(ctx,px,y+22,pw,44,4);
    ctx.fillStyle='#140c0c'; ctx.fill();
    ctx.strokeStyle='#5b2121'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#e2e8f0'; ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(t.icon, px+pw/2, y+26);
    ctx.fillStyle='#94a3b8'; ctx.font='bold 8px sans-serif';
    ctx.fillText(`${Math.round(w/total*100)}%`, px+pw/2, y+47);
    ctx.fillStyle='#475569'; ctx.font='7px sans-serif';
    ctx.fillText(t.name, px+pw/2, y+57);
  });
  y += panelH + 6;

  // ── 상단 침입자 ──────────────────────────────────────────────────────────
  const dh = 52;
  roundRect(ctx,6,y,CW-12,dh,7);
  ctx.fillStyle='#0a1019'; ctx.fill(); ctx.strokeStyle='#1e3a5f'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#60a5fa'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('🏰 상단 침입자 — 기지에 닿으면 HP 손실', 12, y+7);
  const hasAir = def.defenseEnemies.some(d => (ENEMY_TYPES[d.type]||{}).flying);
  if (hasAir) {
    ctx.textAlign='right'; ctx.fillStyle='#c084fc'; ctx.font='bold 10px sans-serif';
    ctx.fillText('🔺 비행 — 항로로 가로질러 옵니다', CW-14, y+7);
    ctx.textAlign='left';
  }
  let dx = 12;
  const countMult = 1 + gs.wave * DEF_WAVE_COUNT_SCALE;
  const perRow = Math.max(1, Math.floor((CW-24) / 104));
  def.defenseEnemies.forEach((d, i) => {
    const t = ENEMY_TYPES[d.type]; if (!t) return;
    const n = Math.max(1, Math.round(d.count * countMult));
    const col = i % perRow;
    const ex = 12 + col*104;
    const cls = MOB_CLASSES[t.cls] || MOB_CLASSES.medium;
    ctx.fillStyle=t.color; ctx.font='bold 10px sans-serif'; ctx.textAlign='left';
    ctx.fillText(`● ${t.name} ×${n}`, ex, y+26);
    ctx.fillStyle=cls.color; ctx.font='bold 8px sans-serif';
    ctx.fillText(`[${cls.tag}] ${cls.name}`, ex, y+38);
  });
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

  const heroTxt = gs.hero.dead ? `💀 전사 — ${heroDownLabel(gs.hero)}`
                : gs.hero.placement==='defense' ? '👑 상단 배치'
                : gs.hero.placement==='battle'  ? '👑 하단 배치' : '👑 미배치';
  ctx.fillStyle = gs.hero.dead ? '#f87171' : gs.hero.placement==='none' ? '#64748b' : COLORS.hero;
  ctx.font='bold 10px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='top';
  ctx.fillText(`${heroTxt}  Lv.${gs.hero.level}`, CW-14, y+7);
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`🏹 타워 ${gs.towers.length}기`, CW-14, y+23);
  ctx.fillText(`🗿 케이브 Lv.${gs.caveLevel}`, CW-14, y+36);

  ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('강화', 12, y+56);
  const icons = (gs.activeUpgrades||[]).map(id=>(UPGRADE_CARDS.find(c=>c.id===id)||{}).icon||'').join(' ');
  ctx.fillStyle='#a5b4fc'; ctx.font='10px sans-serif';
  ctx.fillText(icons ? icons.slice(0,64) : '— 웨이브를 클리어하면 강화를 고를 수 있습니다', 40, y+56);
  y += mh + 8;

  // ── 버튼 ─────────────────────────────────────────────────────────────────
  // 이 화면은 확인용이다 — 편성·배치·현상수배는 전부 🏰마을에서 한다.
  ctx.fillStyle='#334155'; ctx.font='bold 9px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('타워 배치 · 병력 고용 · 현상수배는 🏰마을에서 합니다', CW/2, y);
  y += 14;

  const hasTeam = gs.battle.ourTeam.length > 0;
  const heroSet = gs.hero.placement !== 'none' || gs.hero.dead;
  const ready   = hasTeam && heroSet;
  const label   = !hasTeam ? '병력이 없습니다 — 🏰마을'
                : !heroSet ? '👑 영웅을 배치하세요 — 🏰마을'
                : '▶ 웨이브 시작';
  const bw2 = CW-140, bh2 = 46;
  roundRect(ctx,20,y,bw2,bh2,9);
  ctx.fillStyle = ready ? '#14532d' : '#1f2937'; ctx.fill();
  ctx.strokeStyle = ready ? '#22c55e' : (!heroSet && hasTeam ? '#f59e0b' : '#374151'); ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle = ready ? '#fff' : (!heroSet && hasTeam ? '#fbbf24' : '#6b7280');
  ctx.font = ready ? 'bold 17px sans-serif' : 'bold 13px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label, 20+bw2/2, y+bh2/2);
  gs.ui.battleWaveStartBtn = ready ? {x:20,y:y,w:bw2,h:bh2} : null;

  const tbx = 20+bw2+10, tbw = CW-tbx-20;
  roundRect(ctx,tbx,y,tbw,bh2,9);
  ctx.fillStyle='#1e293b'; ctx.fill(); ctx.strokeStyle='#475569'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#cbd5e1'; ctx.font='bold 12px sans-serif';
  ctx.fillText('🏰 마을', tbx+tbw/2, y+bh2/2);
  gs.ui.briefTownBtn = {x:tbx,y:y,w:tbw,h:bh2};
  y += bh2 + 6;


  ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillStyle='#22c55e';
  ctx.fillText(`★ 완주 +${clearBonusGold(gs.wave)}💰 · 성벽 +${clearRepair(gs.wave)}HP    `, CW/2-52, y);
  ctx.fillStyle='#f87171';
  ctx.fillText(`   🛡 후퇴 = 남은 시간 × ${RETREAT_DPS} 만큼 성벽 피해`, CW/2+78, y);
  y += 12;
  ctx.fillStyle='#3f4a5c';
  ctx.fillText('Space 시작 · A 자동/수동 · 방향키 부대 이동 · R 후퇴 · T 마을', CW/2, y);
  _briefBottom = y + 14;
}

// ─── 실시간 아레나 ───────────────────────────────────────────────────────────
// ─── 지형 ────────────────────────────────────────────────────────────────────
// 개체보다 아래에 깔고, 종류를 색과 무늬로 구분한다.
// 좁은 화면이라 아이콘을 얹을 자리가 없어서 무늬로 읽히게 했다:
//   바위 — 채워진 덩어리에 사선 하이라이트
//   수렁 — 가로 물결
//   가시 — 삼각 톱니
function renderArenaTerrain(ctx, a) {
  const ter = a.terrain;
  if (!ter || !ter.length) return;
  for (const t of ter) {
    const d = TERRAIN_DEFS[t.kind] || TERRAIN_DEFS.rock;
    roundRect(ctx, t.x, t.y, t.w, t.h, 5);
    ctx.fillStyle = d.fill; ctx.fill();
    ctx.strokeStyle = d.edge; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.save();
    ctx.beginPath(); roundRect(ctx, t.x, t.y, t.w, t.h, 5); ctx.clip();
    ctx.strokeStyle = d.edge; ctx.globalAlpha = 0.45; ctx.lineWidth = 1;

    if (t.kind === 'rock') {
      ctx.beginPath();
      for (let o = -t.h; o < t.w; o += 11) {
        ctx.moveTo(t.x + o, t.y + t.h); ctx.lineTo(t.x + o + t.h, t.y);
      }
      ctx.stroke();
    } else if (t.kind === 'mud') {
      ctx.beginPath();
      for (let yy = t.y + 6; yy < t.y + t.h; yy += 9) {
        ctx.moveTo(t.x, yy);
        for (let xx = t.x; xx < t.x + t.w; xx += 10) ctx.quadraticCurveTo(xx + 5, yy - 3, xx + 10, yy);
      }
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (let yy = t.y + 8; yy < t.y + t.h + 8; yy += 10) {
        for (let xx = t.x + 2; xx < t.x + t.w - 2; xx += 9) {
          ctx.moveTo(xx, yy); ctx.lineTo(xx + 4.5, yy - 7); ctx.lineTo(xx + 9, yy);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

function renderArenaPhase(ctx, gs) {
  const a = gs.arena, b = gs.battle;

  renderArenaStatusBar(ctx, gs);

  // 아레나 바닥
  ctx.fillStyle = '#0b1622';
  ctx.fillRect(ARENA_X, ARENA_Y, ARENA_W, ARENA_H);

  // 격자 (위치감)
  ctx.strokeStyle = 'rgba(148,163,184,0.055)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = ARENA_X + 40; gx < ARENA_X + ARENA_W; gx += 40) { ctx.moveTo(gx, ARENA_Y); ctx.lineTo(gx, ARENA_Y+ARENA_H); }
  for (let gy = ARENA_Y + 40; gy < ARENA_Y + ARENA_H; gy += 40) { ctx.moveTo(ARENA_X, gy); ctx.lineTo(ARENA_X+ARENA_W, gy); }
  ctx.stroke();

  // 스폰 밴드
  ctx.strokeStyle = 'rgba(239,68,68,0.16)'; ctx.lineWidth = 1; ctx.setLineDash([5,5]);
  ctx.strokeRect(ARENA_X+ARENA_SPAWN_BAND, ARENA_Y+ARENA_SPAWN_BAND,
                 ARENA_W-ARENA_SPAWN_BAND*2, ARENA_H-ARENA_SPAWN_BAND*2);
  ctx.setLineDash([]);

  ctx.save();
  ctx.beginPath(); ctx.rect(ARENA_X, ARENA_Y, ARENA_W, ARENA_H); ctx.clip();

  renderArenaTerrain(ctx, a);

  // 집결 지점
  if (a.mode==='manual' && a.rally) {
    const t = (Date.now()%1000)/1000;
    ctx.strokeStyle = `rgba(167,139,250,${0.9-t*0.6})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(a.rally.x, a.rally.y, 8 + t*14, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath(); ctx.arc(a.rally.x, a.rally.y, 3.5, 0, Math.PI*2); ctx.fill();
  }

  // 드랍 — 이제 바닥에 있는 것은 값나가는 것뿐이라 눈에 띄게 그린다
  for (const d of a.drops) {
    const fade = d.life < 2 ? (d.life/2) : 1;
    const bob  = Math.sin(Date.now()/220 + d.x) * 2.2;
    const col  = d.color || COLORS.gold;
    ctx.globalAlpha = fade;
    // 수거 반경을 옅게 — 어디까지 가야 하는지 보여준다
    ctx.strokeStyle = col; ctx.globalAlpha = fade * 0.16; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(d.x, d.y, DROP_PICKUP_RADIUS, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = fade * 0.30;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(d.x, d.y + bob, 11, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = fade;
    ctx.font = '13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(d.icon || '💰', d.x, d.y + bob);
    ctx.globalAlpha = 1;
  }

  // 걸려 있는 일시 버프 — 남은 시간을 아레나 좌상단에 띄운다
  if (a.buffs && a.buffs.length) {
    let bx = ARENA_X + 6;
    for (const bf of a.buffs) {
      const left = bf.until - a.elapsed;
      if (left <= 0) continue;
      const d = DROP_TYPES.find(t => t.buff && t.buff.kind === bf.kind) || {};
      roundRect(ctx, bx, ARENA_Y + 4, 46, 16, 4);
      ctx.fillStyle = 'rgba(10,14,26,0.82)'; ctx.fill();
      ctx.strokeStyle = d.color || '#94a3b8'; ctx.lineWidth = 1; ctx.stroke();
      ctx.font='9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillStyle = d.color || '#94a3b8';
      ctx.fillText(`${d.icon || '⚡'} ${left.toFixed(0)}s`, bx + 5, ARENA_Y + 12);
      bx += 50;
    }
    ctx.textAlign='left'; ctx.textBaseline='top';
  }

  // 스킬 파동
  for (const f of a.bursts) {
    const p = f.t / f.dur;
    ctx.globalAlpha = (1 - p) * 0.55;
    ctx.strokeStyle = f.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.35 + p * 0.75), 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 몹 → 아군 순으로 그려 아군이 위에 오게 한다
  for (const m of a.mobs) renderArenaEntity(ctx, m, m.dead ? Math.max(0, 1 - m.deadTimer/0.5) : 1);
  for (const u of b.ourTeam) if (!u.dead) renderArenaEntity(ctx, u, 1);

  // 투사체
  for (const sh of a.shots) {
    if (sh.delay > 0) continue;
    ctx.fillStyle = sh.color;
    ctx.beginPath(); ctx.arc(sh.x, sh.y, 2.6, 0, Math.PI*2); ctx.fill();
  }

  // 플로티
  for (const f of b.floaties) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = f.color; ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 아레나 테두리
  ctx.strokeStyle = '#1e2d40'; ctx.lineWidth = 1;
  ctx.strokeRect(ARENA_X+0.5, ARENA_Y+0.5, ARENA_W-1, ARENA_H-1);

  renderArenaOverlay(ctx, gs);
}

// 상태 바 28px — 처치 · 드랍 · 압력 · 모드
function renderArenaStatusBar(ctx, gs) {
  const a = gs.arena, b = gs.battle;
  ctx.fillStyle = '#080e18'; ctx.fillRect(0, BATTLE_Y, CW, ARENA_STATUS_H);

  ctx.font='bold 10px sans-serif'; ctx.textBaseline='middle'; ctx.textAlign='left';
  const cy = BATTLE_Y + ARENA_STATUS_H/2;
  ctx.fillStyle='#fbbf24'; ctx.fillText(`💰 ${b.goldEarned}`, 8, cy);
  ctx.fillStyle='#f87171'; ctx.fillText(`⚔ ${b.killCount}`, 66, cy);
  // 아레나 몹 강화율 — 무한은 층 곡선, 훈련은 웨이브 선형. 둘 다 처치 누적을 얹는다.
  const aBase = endlessTier(a.waveIndex) > 0 ? endlessArenaMult(a.waveIndex)
                                             : (1 + (a.waveIndex||0) * WAVE_STAT_SCALE);
  const scalePct = Math.round((aBase * (1 + (b.killCount||0) * KILL_SCALE) - 1) * 100);
  ctx.fillStyle='#7c3aed'; ctx.fillText(`🗿${gs.caveLevel} 몹+${scalePct}%`, 116, cy);

  const live = a.mobs.filter(m=>!m.dead).length;
  ctx.fillStyle = live >= ARENA_MAX_MOBS ? '#ef4444' : '#94a3b8';
  ctx.fillText(`👾 ${live}/${ARENA_MAX_MOBS}`, 200, cy);

  // 스폰 압력 게이지 — 간격이 짧아질수록 찬다
  const iv   = spawnInterval(a.elapsed) * (a.spawnMult||1);
  const pres = Math.max(0, Math.min(1, (SPAWN_BASE_INTERVAL - iv) / (SPAWN_BASE_INTERVAL - 0.4)));
  const gx = 256, gw = 92;
  ctx.fillStyle='#1e293b'; ctx.fillRect(gx, cy-4, gw, 8);
  ctx.fillStyle = pres > 0.75 ? '#ef4444' : pres > 0.45 ? '#f59e0b' : '#22c55e';
  ctx.fillRect(gx, cy-4, gw*pres, 8);

  ctx.textAlign='right'; ctx.font='bold 9px sans-serif';
  ctx.fillStyle = a.mode==='manual' ? '#c4b5fd' : '#475569';
  ctx.fillText(a.mode==='manual' ? '수동' : '자동', CW-8, cy);

  // 완주하면 받을 보너스를 미리 보여준다 — 버티는 쪽에도 이유를 준다
  if (gs.battle.phase === 'fighting') {
    ctx.textAlign='right'; ctx.fillStyle='#22c55e'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`★완주 +${clearBonusGold(wm.waveIndex)}`, CW-38, cy);
  }
}

// 아레나 개체 그림 키 — 영웅은 각인별로, 나머지는 타입 아이디로 찾는다.
//   unit.swordsman · unit.rogue · hero.blade · mob.goblin …
function arenaSpriteKey(e) {
  if (e.isHero)   return Sprites.pick(`hero.${e.sigil || DEFAULT_SIGIL}`, 'hero.blade');
  if (e.isPlayer) return Sprites.pick(`unit.${e.typeId}`);
  return Sprites.pick(`mob.${e.typeId}`);
}

function renderArenaEntity(ctx, e, alpha) {
  const r = e.radius;
  ctx.globalAlpha = alpha;

  if (e.flashTimer > 0) {
    ctx.beginPath(); ctx.arc(e.x, e.y, r+3, 0, Math.PI*2);
    ctx.fillStyle = e.flashColor; ctx.globalAlpha = alpha * 0.6; ctx.fill();
    ctx.globalAlpha = alpha;
  }
  if (e.shield > 0) {
    ctx.beginPath(); ctx.arc(e.x, e.y, r+3, 0, Math.PI*2);
    ctx.strokeStyle = COLORS.shield; ctx.lineWidth = 2; ctx.stroke();
  }

  // 아군은 밝은 링을 상시 두른다 — 28마리가 겹쳐도 내 편을 즉시 찾을 수 있게
  if (e.isPlayer) {
    ctx.beginPath(); ctx.arc(e.x, e.y, r + 2.5, 0, Math.PI*2);
    ctx.strokeStyle = e.isHero ? 'rgba(253,224,71,0.85)' : 'rgba(186,230,253,0.55)';
    ctx.lineWidth = e.isHero ? 2 : 1.5; ctx.stroke();
  }
  // 그림이 있으면 몸 대신 그린다. 충돌원은 발밑, 그림은 그 위로 선다.
  const skey = arenaSpriteKey(e);
  if (skey) {
    Sprites.drawFoot(ctx, skey, e.x, e.y + r, r*ARENA_ART_W_MULT, r*ARENA_ART_H_MULT);
  } else {
  ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI*2);
  ctx.fillStyle = e.isHero ? COLORS.hero : e.color; ctx.fill();
  // 아군은 흰 테두리, 몹은 어두운 테두리 — 겹쳐도 편이 구분된다
  ctx.strokeStyle = e.isHero ? '#fef08a' : e.isPlayer ? '#f8fafc' : e.isBoss ? '#fbbf24' : '#0b1622';
  ctx.lineWidth = (e.isHero || e.isBoss) ? 2 : 1.4;
  ctx.stroke();

  // 아이콘은 원보다 살짝 크게 — 작은 원 위의 8px 글자는 읽히지 않는다
  ctx.fillStyle = '#0f172a';
  ctx.font = `${Math.max(11, Math.round(r*1.1))}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(e.icon, e.x, e.y+0.5);
  }

  // 엘리트·보스는 바깥 링으로 한눈에 구분
  if (e.isElite || e.isBoss) {
    ctx.beginPath(); ctx.arc(e.x, e.y, r+3.5, 0, Math.PI*2);
    ctx.strokeStyle = e.isBoss ? '#fbbf24' : '#f43f5e';
    ctx.lineWidth = 1.5; ctx.stroke();
  }

  // HP 바 — 다쳤을 때만 (평상시 화면을 깨끗하게)
  if (e.hp < e.maxHp) {
    const bw = r*2 + 4;
    drawHPBar(ctx, e.x - bw/2, e.y + r + 2.5, bw, 3, e.hp / e.maxHp);
  }
  ctx.globalAlpha = 1;
}

// 결과 오버레이 — 아레나 위에만 덮는다
function renderArenaOverlay(ctx, gs) {
  const b = gs.arena && gs.battle;
  const ph = gs.battle.phase;
  if (ph === 'fighting') return;

  const cx = ARENA_X + ARENA_W/2, cy = ARENA_Y + ARENA_H/2;
  if (ph === 'won') {
    const cleared = gs.battle.result === 'cleared';
    ctx.fillStyle = cleared ? 'rgba(0,40,0,0.72)' : 'rgba(8,30,45,0.72)';
    ctx.fillRect(ARENA_X,ARENA_Y,ARENA_W,ARENA_H);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if (cleared) {
      ctx.fillStyle='#22c55e'; ctx.font='bold 22px sans-serif';
      ctx.fillText('★ 완주!', cx, cy-14);
      ctx.fillStyle='#86efac'; ctx.font='bold 12px sans-serif';
      ctx.fillText(`완주 보너스 +${clearBonusGold(wm.waveIndex)}💰 · 성벽 +${clearRepair(wm.waveIndex)}HP`, cx, cy+14);
    } else {
      ctx.fillStyle='#7dd3fc'; ctx.font='bold 20px sans-serif';
      ctx.fillText(`🛡 후퇴  획득 ${gs.battle.goldEarned}💰`, cx, cy-10);
      ctx.fillStyle='#94a3b8'; ctx.font='11px sans-serif';
      ctx.fillText('병력은 지켰지만 완주 보너스는 없습니다', cx, cy+16);
    }
  } else if (ph === 'retreated') {
    ctx.fillStyle='rgba(8,30,45,0.72)'; ctx.fillRect(ARENA_X,ARENA_Y,ARENA_W,ARENA_H);
    ctx.fillStyle='#7dd3fc'; ctx.font='bold 20px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`🛡 후퇴  획득 ${gs.battle.goldEarned}💰`, cx, cy-10);
    ctx.fillStyle='#94a3b8'; ctx.font='11px sans-serif';
    ctx.fillText('상단이 끝나면 웨이브가 마무리됩니다', cx, cy+16);
  } else if (ph === 'idle_defeated' || ph === 'lost') {
    ctx.fillStyle='rgba(40,0,0,0.62)'; ctx.fillRect(ARENA_X,ARENA_Y,ARENA_W,ARENA_H);
    ctx.fillStyle='#ef4444'; ctx.font='bold 20px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`병력 전멸  획득 ${gs.battle.goldEarned}💰`, cx, cy-14);
    const live = gs.arena.mobs.filter(e=>!e.dead).length;
    if (live > 0) {
      const left = Math.max(0, BREAKTHROUGH_DURATION - (wm.elapsed - (wm.wipedAt||0)));
      ctx.fillStyle='#fca5a5'; ctx.font='bold 12px sans-serif';
      ctx.fillText(`⚠️ ${live}마리가 기지로 돌파 중 — ${Math.ceil(left)}초`, cx, cy+14);
    }
  }
}

// 런 종료 안내 — renderHUD는 전투 페이지 위에만 그린다
function renderHUD(ctx, gs) {
  if (gs.gameOver)    { renderDefeatOverlay(ctx, gs); return; }
  if (gs.stageCleared){ renderTrainingClear(ctx, gs); return; }
  gs.ui.bankBtn = gs.ui.endlessBtn = null;
}

function renderDefeatOverlay(ctx, gs) {
  gs.ui.bankBtn = gs.ui.endlessBtn = null;
  ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(0,0,CW,CH);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#ef4444'; ctx.font='bold 28px sans-serif';
  ctx.fillText('기지 함락', CW/2, CH/2-20);
  ctx.fillStyle='#94a3b8'; ctx.font='13px sans-serif';
  ctx.fillText('탭하여 결과 보기', CW/2, CH/2+16);
}

// ─── 훈련 완주 — 무한이 열린다 ───────────────────────────────────────────────
// v3.0에서 갈림길이 사라졌다. 훈련 30웨이브는 손에 익히는 곳이고,
// 완주하면 본편인 무한이 열린다. 이후로는 캠프에서 바로 무한으로 내려간다.
function renderTrainingClear(ctx, gs) {
  ctx.fillStyle='#050810'; ctx.fillRect(0,0,CW,CH);
  ctx.textAlign='center'; ctx.textBaseline='top';

  const first = (gs.stats.clears || 0) <= 1;

  let y = 76;
  ctx.fillStyle='#22c55e'; ctx.font='bold 27px sans-serif';
  ctx.fillText('훈련 완주!', CW/2, y); y += 38;
  ctx.fillStyle='#475569'; ctx.font='12px sans-serif';
  ctx.fillText(`${TRAINING_WAVES}웨이브를 모두 막아냈습니다`, CW/2, y); y += 40;

  // ── 무한 해금 ──
  const bw = CW-56, bx = 28, bh = 118;
  roundRect(ctx, bx, y, bw, bh, 10);
  ctx.fillStyle='#1a0d2e'; ctx.fill(); ctx.strokeStyle='#a78bfa'; ctx.lineWidth=2; ctx.stroke();
  ctx.textAlign='center';
  ctx.fillStyle='#c4b5fd'; ctx.font='bold 19px sans-serif';
  ctx.fillText(first ? '∞ 심연이 열렸습니다' : '∞ 심연', CW/2, y+16);
  ctx.fillStyle='#8b7bb8'; ctx.font='11px sans-serif';
  ctx.fillText('1층부터 내려가며 버티는 본편입니다.', CW/2, y+46);
  ctx.fillText('층마다 적이 강해지고 새 변형이 붙습니다.', CW/2, y+64);
  ctx.fillStyle='#a78bfa'; ctx.font='bold 11px sans-serif';
  ctx.fillText('깊이 갈수록 층당 보석이 커집니다 — 그게 다음 판의 힘입니다.', CW/2, y+88);
  y += bh + 22;

  // ── 층 전망 ──
  const ph = 108;
  roundRect(ctx, bx, y, bw, ph, 8);
  ctx.fillStyle='#0b0f1a'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=1; ctx.stroke();
  ctx.textAlign='left'; ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif';
  ctx.fillText('심연 층 전망', bx+14, y+10);

  const tiers = [10, 20, 30, 40];
  const colW = (bw-28)/tiers.length;
  tiers.forEach((t,i) => {
    const cx2 = bx+14 + i*colW + colW/2;
    ctx.textAlign='center';
    ctx.fillStyle = isGateTier(t) ? '#fbbf24' : '#c4b5fd';
    ctx.font='bold 12px sans-serif';
    ctx.fillText(`${t}층`, cx2, y+30);
    ctx.fillStyle='#f87171'; ctx.font='bold 10px sans-serif';
    ctx.fillText(`적 ×${endlessCurve(t, ENDLESS_EXP).toFixed(1)}`, cx2, y+50);
    ctx.fillStyle='#a78bfa'; ctx.font='bold 10px sans-serif';
    ctx.fillText(`💎${Math.floor(endlessGemTotal(t))}`, cx2, y+68);
  });
  ctx.textAlign='left'; ctx.fillStyle='#334155'; ctx.font='9px sans-serif';
  ctx.fillText('10층마다 관문 — 최초 돌파에 보석이 따로 붙습니다.', bx+14, y+86);
  y += ph + 20;

  ctx.textAlign='center';
  ctx.fillStyle='#94a3b8'; ctx.font='13px sans-serif';
  ctx.fillText('탭하여 정산', CW/2, y);

  gs.ui.bankBtn = gs.ui.endlessBtn = null;
}

function renderUpgradePick(ctx, gs) {
  // 강화 선택은 온전히 집중해야 하는 결정이다 — 뒤 화면을 완전히 가린다
  ctx.fillStyle='#050810'; ctx.fillRect(0,0,CW,CH);

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

  // ── 리롤 — 원하는 빌드로 밀어붙이고 싶을 때 쓰는 골드 사용처 ──
  const rc   = rerollCost(gs.rerolls);
  const rAff = gs.gold >= rc;
  const rw=170, rh=34, rx=(CW-rw)/2, ry=startY+cardH+18;
  roundRect(ctx, rx, ry, rw, rh, 7);
  ctx.fillStyle = rAff ? '#1e293b' : '#12161f'; ctx.fill();
  ctx.strokeStyle = rAff ? '#f59e0b' : '#2a3140'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle = rAff ? '#fbbf24' : '#475569'; ctx.font='bold 12px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(`🎲 다시 뽑기  ${rc}💰`, CW/2, ry+rh/2);
  gs.ui.rerollBtn = rAff ? {x:rx,y:ry,w:rw,h:rh} : null;

  ctx.fillStyle='#475569'; ctx.font='9px sans-serif'; ctx.textBaseline='top';
  ctx.fillText(`보유 ${gs.gold}💰${gs.rerolls?`  ·  이번 런 ${gs.rerolls}회 리롤`:''}`, CW/2, ry+rh+8);

  // ── 지금까지 쌓은 빌드 — 무엇을 고를지 판단할 근거 ──────────────────────
  let by2 = ry + rh + 34;
  ctx.textAlign='left';
  ctx.fillStyle='#334155'; ctx.font='bold 10px sans-serif';
  ctx.fillText('이번 런에서 고른 강화', 22, by2);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`${(gs.activeUpgrades||[]).length}개`, CW-22, by2+1);
  by2 += 17;

  const taken = (gs.activeUpgrades||[]).map(id => UPGRADE_CARDS.find(c=>c.id===id)).filter(Boolean);
  if (taken.length) {
    // 같은 카드를 여러 번 골랐으면 묶어서 ×N으로
    const counted = [];
    for (const c of taken) {
      const hit = counted.find(e => e.card.id === c.id);
      if (hit) hit.n++; else counted.push({ card:c, n:1 });
    }
    const rowH = 17, perCol = 6, colW = (CW-44)/2;
    counted.slice(0, perCol*2).forEach((e, i) => {
      const col = Math.floor(i / perCol), row = i % perCol;
      const ex = 22 + col*colW, ey = by2 + row*rowH;
      const gc = e.card.grade==='epic' ? '#a78bfa' : e.card.grade==='rare' ? '#60a5fa' : '#64748b';
      ctx.textAlign='left'; ctx.font='11px sans-serif'; ctx.fillStyle='#cbd5e1';
      ctx.fillText(e.card.icon, ex, ey);
      ctx.font='10px sans-serif'; ctx.fillStyle=gc;
      ctx.fillText(e.card.name + (e.n>1?` ×${e.n}`:''), ex+18, ey);
    });
    if (counted.length > perCol*2) {
      ctx.textAlign='center'; ctx.fillStyle='#334155'; ctx.font='9px sans-serif';
      ctx.fillText(`외 ${counted.length - perCol*2}종`, CW/2, by2 + perCol*rowH + 4);
    }
  } else {
    ctx.textAlign='left'; ctx.fillStyle='#334155'; ctx.font='10px sans-serif';
    ctx.fillText('아직 없습니다 — 이번이 첫 선택입니다', 22, by2);
  }

  // ── 다음 웨이브 예고 — 무엇을 고를지 판단할 또 하나의 근거 ──────────────
  const nextIdx = gs.wave + 1;
  const nd = waveDefFor(nextIdx);
  if (nd) {
    const npY = by2 + 6*17 + 16;
    const npH = 78;
    roundRect(ctx, 20, npY, CW-40, npH, 7);
    ctx.fillStyle='#0a0f1a'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=1; ctx.stroke();

    const nst = getStageInfo(nextIdx);
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillStyle='#94a3b8'; ctx.font='bold 10px sans-serif';
    ctx.fillText(nst.endless
        ? `다음 — ${nst.stageLabel}${nst.isBossStage ? '  🏁관문' : ''}${(nd.affixes||[]).length ? '  ' + nd.affixes.map(a=>a.icon+a.name).join(' ') : ''}`
        : `다음 — 스테이지 ${nst.stageLabel} 웨이브 ${nst.waveInStage+1}/3`, 32, npY+9);
    ctx.textAlign='right'; ctx.fillStyle='#22c55e'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`★완주 +${clearBonusGold(nextIdx)}💰 · 성벽 +${clearRepair(nextIdx)}`, CW-32, npY+10);

    // 아레나 스폰 풀
    ctx.textAlign='left'; ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif';
    ctx.fillText('아레나', 32, npY+30);
    const npool = nd.arenaPool || [];
    const ntot  = npool.reduce((a,[,w])=>a+w,0) || 1;
    npool.forEach(([id,w],i) => {
      const mt = BATTLE_MOB_TYPES[id]; if (!mt) return;
      const ix = 72 + i*42;
      ctx.font='14px sans-serif'; ctx.fillStyle='#e2e8f0'; ctx.textAlign='left';
      ctx.fillText(mt.icon, ix, npY+27);
      ctx.font='bold 8px sans-serif'; ctx.fillStyle='#475569';
      ctx.fillText(`${Math.round(w/ntot*100)}%`, ix+17, npY+31);
    });

    // 상단 침입자
    ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left';
    ctx.fillText('상단', 32, npY+54);
    const ncm = 1 + nextIdx * DEF_WAVE_COUNT_SCALE;
    let nx = 72;
    for (const d of nd.defenseEnemies) {
      const t = ENEMY_TYPES[d.type]; if (!t) continue;
      ctx.fillStyle=t.color; ctx.font='bold 9px sans-serif';
      ctx.fillText(`● ${t.name} ×${Math.max(1,Math.round(d.count*ncm))}`, nx, npY+54);
      nx += 96;
    }
  }

  // 현재 상태 요약
  const sy = CH - 74;
  ctx.strokeStyle='#151b28'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(22, sy-12); ctx.lineTo(CW-22, sy-12); ctx.stroke();
  const stats = [
    ['기지',   `${Math.ceil(gs.baseHP)}/${baseHpMax()}`, hpColor(gs.baseHP/baseHpMax())],
    ['타워',   `${gs.towers.length}기`,                  '#22c55e'],
    ['병력',   `${gs.battle.ourTeam.filter(u=>!u.isHero).length}/${gs.battle.maxSlots}`, '#60a5fa'],
    ['영웅',   `Lv.${gs.hero.level}`,                    COLORS.hero],
    ['케이브', `Lv.${gs.caveLevel}`,                     '#a78bfa'],
  ];
  const sw = (CW-44)/stats.length;
  stats.forEach((st,i) => {
    const sx = 22 + i*sw + sw/2;
    ctx.textAlign='center';
    ctx.fillStyle='#334155'; ctx.font='bold 9px sans-serif';
    ctx.fillText(st[0], sx, sy);
    ctx.fillStyle=st[2]; ctx.font='bold 12px sans-serif';
    ctx.fillText(st[1], sx, sy+14);
  });
}

// ─── 로비 · 캠프 ─────────────────────────────────────────────────────────────
function renderLobby(ctx, gs) {
  const L = gs.lobby;
  ctx.fillStyle='#080b14'; ctx.fillRect(0,0,CW,CH);

  renderLobbyHeader(ctx, gs);
  renderLobbyTabs(ctx, gs);

  ctx.save();
  ctx.beginPath(); ctx.rect(0, LOBBY_BODY_Y, CW, LOBBY_BODY_H); ctx.clip();
  if      (L.tab === 'sortie') renderLobbySortie(ctx, gs);
  else if (L.tab === 'skill')  renderLobbySkill(ctx, gs);
  else if (L.tab === 'unlock') renderLobbyUnlock(ctx, gs);
  else if (L.tab === 'pact')   renderLobbyPact(ctx, gs);
  else                         renderLobbyRecord(ctx, gs);
  ctx.restore();

  renderSortieBar(ctx, gs);
}

function renderLobbyHeader(ctx, gs) {
  ctx.fillStyle='#0d1220'; ctx.fillRect(0,0,CW,LOBBY_HEADER_H);
  ctx.strokeStyle='#1e293b'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,LOBBY_HEADER_H-0.5); ctx.lineTo(CW,LOBBY_HEADER_H-0.5); ctx.stroke();

  ctx.textBaseline='middle'; ctx.textAlign='left';
  ctx.fillStyle='#e2e8f0'; ctx.font='bold 15px sans-serif';
  ctx.fillText('⛺ 캠프', 12, 20);
  ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
  ctx.fillText('다음 출격을 준비하는 곳', 12, 39);

  ctx.textAlign='right';
  ctx.fillStyle='#a78bfa'; ctx.font='bold 19px sans-serif';
  ctx.fillText(`💎 ${gs.soulStones}`, CW-12, 20);
  const st = gs.stats;
  ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
  ctx.fillText((st.bestEndless||0) > 0
      ? `∞ 최고 ${st.bestEndless}층 · ${st.runs||0}회 하강`
      : `최고 ${st.bestWave||0}웨이브 · ${st.runs||0}회 플레이`, CW-12, 39);
}

function renderLobbyTabs(ctx, gs) {
  const L = gs.lobby;
  gs.ui.lobbyTabBtns = [];
  const n = LOBBY_TABS.length, tw = CW / n;
  LOBBY_TABS.forEach((t, i) => {
    const tx = i*tw, active = L.tab === t.id;
    ctx.fillStyle = active ? '#141c2e' : '#0a0e18';
    ctx.fillRect(tx, LOBBY_TAB_Y, tw, LOBBY_TAB_H);
    if (active) { ctx.fillStyle = t.color; ctx.fillRect(tx, LOBBY_TAB_Y+LOBBY_TAB_H-2.5, tw, 2.5); }
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='14px sans-serif';
    ctx.globalAlpha = active ? 1 : 0.45;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(t.icon, tx+tw/2, LOBBY_TAB_Y+15);
    ctx.fillStyle = active ? t.color : '#64748b';
    ctx.font='bold 9px sans-serif';
    ctx.globalAlpha = 1;
    ctx.fillText(t.label, tx+tw/2, LOBBY_TAB_Y+32);
    gs.ui.lobbyTabBtns.push({x:tx, y:LOBBY_TAB_Y, w:tw, h:LOBBY_TAB_H, id:t.id});
  });
  ctx.strokeStyle='#1e293b'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,LOBBY_BODY_Y-0.5); ctx.lineTo(CW,LOBBY_BODY_Y-0.5); ctx.stroke();
}

// ── ⚔️ 출격 ─────────────────────────────────────────────────────────────────
function renderLobbySortie(ctx, gs) {
  let y = LOBBY_BODY_Y + 12;
  ctx.textAlign='left'; ctx.textBaseline='top';

  // ── 기록 배너 — 이 게임의 점수판 ────────────────────────────────────────
  const best = gs.stats.bestEndless || 0;
  const open = endlessUnlocked();
  const rh = 64;
  roundRect(ctx,10,y,CW-20,rh,8);
  ctx.fillStyle = open ? '#1a1033' : '#0c1220'; ctx.fill();
  ctx.strokeStyle = open ? '#7c3aed' : '#1e293b'; ctx.lineWidth=1; ctx.stroke();

  if (open) {
    ctx.fillStyle='#8b7bb8'; ctx.font='bold 9px sans-serif';
    ctx.fillText('∞ 최고 도달 층', 18, y+10);
    ctx.fillStyle='#c4b5fd'; ctx.font='bold 30px sans-serif';
    ctx.fillText(`${best}`, 18, y+24);
    const wBest = ctx.measureText(`${best}`).width;
    ctx.fillStyle='#6d5b9e'; ctx.font='bold 12px sans-serif';
    ctx.fillText('층', 20+wBest, y+42);

    // 다음 관문까지
    const nextGate = (Math.floor(best/10)+1)*10;
    ctx.textAlign='right';
    ctx.fillStyle='#fbbf24'; ctx.font='bold 10px sans-serif';
    ctx.fillText(`다음 관문 ${nextGate}층`, CW-18, y+12);
    ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`돌파 시 💎+${ENDLESS_GATE_BONUS + Math.floor(nextGate/10)*ENDLESS_GATE_BONUS_STEP}`, CW-18, y+28);
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif';
    ctx.fillText(`관문 ${(gs.clearedGates||[]).length}개 돌파`, CW-18, y+44);
    ctx.textAlign='left';
    // 진행 바 — 다음 관문까지
    const pw = CW-36, prog = (best % 10) / 10;
    ctx.fillStyle='#1e293b'; ctx.fillRect(18, y+rh-9, pw, 4);
    ctx.fillStyle='#a78bfa'; ctx.fillRect(18, y+rh-9, pw*prog, 4);
  } else {
    ctx.fillStyle='#64748b'; ctx.font='bold 11px sans-serif';
    ctx.fillText('∞ 심연 — 아직 잠겨 있습니다', 18, y+13);
    ctx.fillStyle='#475569'; ctx.font='10px sans-serif';
    ctx.fillText('훈련을 한 판 치르면 열립니다 — 완주하지 않아도 됩니다.', 18, y+32);
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif';
    ctx.fillText('심연이 본편입니다 — 훈련은 손에 익히는 곳입니다.', 18, y+48);
  }
  y += rh + 10;

  // 해금된 편성
  const th = 84;
  roundRect(ctx,10,y,CW-20,th,7);
  ctx.fillStyle='#0c1220'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#f59e0b'; ctx.font='bold 10px sans-serif'; ctx.textBaseline='top';
  ctx.fillText('🔓 사용 가능', 18, y+9);

  const tws = unlockedTowers(), uns = unlockedUnits();
  // 잠긴 것도 회색으로 자리를 지킨다 — 무엇이 남았는지 보여야 목표가 된다
  const drawSlots = (label, ids, table, ty) => {
    ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(label, 18, ty+8);
    ids.forEach((id, i) => {
      const t = table[id], on = isUnlocked(id);
      const sx = 50 + i*32;
      roundRect(ctx, sx, ty, 26, 26, 5);
      ctx.fillStyle = on ? '#152238' : '#0e131e'; ctx.fill();
      ctx.strokeStyle = on ? '#334155' : '#1a2130'; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = on ? 1 : 0.28;
      ctx.font='14px sans-serif'; ctx.fillStyle='#e2e8f0';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(t.icon, sx+13, ty+13);
      ctx.globalAlpha = 1;
      if (!on) {
        ctx.fillStyle='#0d1220';
        ctx.fillRect(sx+16, ty+16, 11, 11);
        ctx.fillStyle='#f59e0b'; ctx.font='bold 8px sans-serif';
        ctx.fillText(`${unlockCost(id)}`, sx+21, ty+22);
      }
    });
    ctx.textAlign='left'; ctx.textBaseline='top';
  };
  drawSlots('타워', TOWER_ORDER, TOWER_TYPES, y+22);
  drawSlots('병력', UNIT_ORDER,  UNIT_TYPES,  y+50);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`${tws.length}/${TOWER_ORDER.length} · ${uns.length}/${UNIT_ORDER.length}`, CW-18, y+9);
  ctx.textAlign='left';
  y += th + 10;

  // 적용 중인 스킬
  const sp = skillProgress(gs);
  const sh = 62;
  roundRect(ctx,10,y,CW-20,sh,7);
  ctx.fillStyle='#0c1220'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.stroke();
  ctx.fillStyle='#a78bfa'; ctx.font='bold 10px sans-serif';
  ctx.fillText('🌳 적용 중인 스킬', 18, y+9);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`${sp.owned}/${sp.total}`, CW-18, y+9);
  ctx.textAlign='left';
  const owned = gs.skillTreeOwned || [];
  if (owned.length) {
    let sx = 18;
    for (const tree of Object.values(SKILL_TREES)) {
      for (const sk of tree.skills) {
        if (!owned.includes(sk.id)) continue;
        ctx.font='13px sans-serif'; ctx.fillStyle='#e2e8f0';
        ctx.fillText(sk.icon, sx, y+28);
        sx += 20;
        if (sx > CW-40) break;
      }
    }
  } else {
    ctx.fillStyle='#475569'; ctx.font='10px sans-serif';
    ctx.fillText('아직 없습니다 — 🌳 스킬 탭에서 보석을 쓰세요', 18, y+30);
  }
  // 진행 바
  ctx.fillStyle='#1e293b'; ctx.fillRect(18, y+46, CW-36, 5);
  ctx.fillStyle='#a78bfa'; ctx.fillRect(18, y+46, (CW-36)*(sp.spent/sp.totalCost), 5);
  y += sh + 10;

  // 서약
  const pacts = PACT_DEFS.filter(p => isPactOn(p.id));
  const ph = 62;
  roundRect(ctx,10,y,CW-20,ph,7);
  ctx.fillStyle = pacts.length ? '#1a0d14' : '#0c1220'; ctx.fill();
  ctx.strokeStyle = pacts.length ? '#7f1d3a' : '#1e293b'; ctx.stroke();
  ctx.fillStyle='#f43f5e'; ctx.font='bold 10px sans-serif';
  ctx.fillText('📜 서약', 18, y+9);
  ctx.textAlign='right';
  ctx.fillStyle = pacts.length ? '#fda4af' : '#475569'; ctx.font='bold 11px sans-serif';
  ctx.fillText(`보석 ×${pactGemMult().toFixed(2)}`, CW-18, y+9);
  ctx.textAlign='left';
  if (pacts.length) {
    ctx.fillStyle='#fda4af'; ctx.font='9px sans-serif';
    let py = y+28;
    for (const p of pacts.slice(0,3)) { ctx.fillText(`${p.icon} ${p.name} — ${p.desc}`, 18, py); py += 12; }
    if (pacts.length > 3) ctx.fillText(`외 ${pacts.length-3}개`, 18, py);
  } else {
    ctx.fillStyle='#475569'; ctx.font='10px sans-serif';
    ctx.fillText('없음 — 🔓 해금 탭에서 난이도를 올리고 보석을 더 받을 수 있습니다', 18, y+30);
  }
  y += ph + 10;

  // 진행 상황
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`관문 ${(gs.clearedGates||[]).length}개 돌파 · 누적 처치 ${gs.stats.totalKills||0} · 누적 보석 ${gs.stats.totalGems||0}`, 14, y);
  y += 22;

  // 다음 목표 — 보석을 어디에 쓰면 좋을지 한 줄로 짚어준다
  const nextUnlock = UNLOCK_DEFS.find(u => !isUnlocked(u.id));
  const gh = 74;
  roundRect(ctx,10,y,CW-20,gh,7);
  ctx.fillStyle='#0c1220'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#22c55e'; ctx.font='bold 10px sans-serif';
  ctx.fillText('🎯 다음 목표', 18, y+9);
  let gy = y+28;
  if (nextUnlock) {
    const short = gs.soulStones < nextUnlock.cost;
    ctx.fillStyle = short ? '#64748b' : '#86efac'; ctx.font='10px sans-serif';
    ctx.fillText(`${nextUnlock.icon} ${nextUnlock.name} 해금`, 18, gy);
    ctx.textAlign='right';
    ctx.fillStyle = short ? '#f59e0b' : '#22c55e'; ctx.font='bold 10px sans-serif';
    ctx.fillText(short ? `💎 ${nextUnlock.cost - gs.soulStones} 더 필요` : `💎 ${nextUnlock.cost} — 지금 열 수 있습니다`, CW-18, gy);
    ctx.textAlign='left';
    gy += 17;
  }
  if (sp.owned < sp.total) {
    ctx.fillStyle='#94a3b8'; ctx.font='10px sans-serif';
    ctx.fillText(`🌳 스킬 ${sp.total - sp.owned}개 남음`, 18, gy);
    ctx.textAlign='right'; ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif';
    ctx.fillText(`💎 ${sp.totalCost - sp.spent}`, CW-18, gy);
    ctx.textAlign='left';
    gy += 17;
  }
  if (!nextUnlock && sp.owned >= sp.total) {
    ctx.fillStyle='#86efac'; ctx.font='10px sans-serif';
    ctx.fillText('전부 열었습니다 — 📜 서약으로 난이도를 올려 더 깊이 내려가세요', 18, gy);
    gy += 17;
  }
  ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
  ctx.fillText(`이번 하강 예상 보석 배율 ×${pactGemMult().toFixed(2)}`, 18, gy);
}

// ── 🌳 스킬 ─────────────────────────────────────────────────────────────────
function renderLobbySkill(ctx, gs) {
  const L = gs.lobby;
  const tabs = [
    { id:'tower',   label:'🏹 타워', color:'#22c55e' },
    { id:'hero',    label:'👑 영웅', color:'#f59e0b' },
    { id:'support', label:'⚙️ 보조', color:'#60a5fa' },
  ];
  const tabW=(CW-16)/3, tabH=30, tabY=LOBBY_BODY_Y+8;
  tabs.forEach((tab,i) => {
    const tx = 8 + i*(tabW+4);
    const active = L.skillTree === tab.id;
    roundRect(ctx,tx,tabY,tabW,tabH,5);
    ctx.fillStyle = active ? '#1e293b' : '#0a0d18'; ctx.fill();
    ctx.strokeStyle = active ? tab.color : '#334155'; ctx.lineWidth = active ? 2 : 1; ctx.stroke();
    ctx.fillStyle = active ? tab.color : '#64748b'; ctx.font='bold 11px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(tab.label, tx+tabW/2, tabY+tabH/2);
    if (tab.id==='tower')        gs.ui.towerTabBtn   = {x:tx,y:tabY,w:tabW,h:tabH};
    else if (tab.id==='hero')    gs.ui.heroTabBtn    = {x:tx,y:tabY,w:tabW,h:tabH};
    else                         gs.ui.supportTabBtn = {x:tx,y:tabY,w:tabW,h:tabH};
  });

  gs.ui.metaCards = [];
  const treeTop = tabY + tabH + 14;
  _renderSkillTree(ctx, gs, SKILL_TREES[L.skillTree] || SKILL_TREES.tower, treeTop);
  // 각인은 영웅 탭 아래 빈 자리에 — 스킬 트리를 밀어내지 않는다
  gs.ui.sigilCards = [];
  if (L.skillTree === 'hero') renderSigilPicker(ctx, gs, treeTop + 4*(68+40) - 14);
}

// ── 👑 영웅 각인 ────────────────────────────────────────────────────────────
// 트리는 숫자를 키우고, 각인은 영웅이 무엇을 하는지를 정한다.
// 값을 치르지 않고 언제든 바꿀 수 있다 — 층 조합에 맞춰 갈아 끼우는 게 목적이다.
function renderSigilPicker(ctx, gs, y) {
  const cur = activeSigil();
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#f59e0b'; ctx.font='bold 11px sans-serif';
  ctx.fillText('👑 각인 — 아레나 스킬을 정합니다', 14, y);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
  ctx.fillText('연 각인은 언제든 바꿀 수 있습니다', CW-14, y+1);
  ctx.textAlign='left';
  y += 18;

  const cw = (CW-32)/3, ch = 74;
  HERO_SIGILS.forEach((sg, i) => {
    const cx = 12 + i*(cw+4);
    const on = sg.id === cur.id;
    // 각인은 보석으로 연다 — 심연에서 모은 보석이 "다음 영웅"이 되게
    const open = sigilUnlocked(gs, sg.id);
    const cost = SIGIL_UNLOCK_COST[sg.id] || 0;
    const canBuy = !open && (gs.soulStones||0) >= cost;
    roundRect(ctx, cx, y, cw, ch, 6);
    ctx.fillStyle = on ? '#1a1508' : open ? '#0a0e18' : '#080a12'; ctx.fill();
    ctx.strokeStyle = on ? sg.color : canBuy ? '#f59e0b' : open ? '#1e293b' : '#161d2b';
    ctx.lineWidth = on ? 2 : 1; ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.font='17px sans-serif'; ctx.globalAlpha = on ? 1 : open ? 0.5 : 0.25;
    ctx.fillStyle='#e2e8f0'; ctx.fillText(sg.icon, cx+cw/2, y+7);
    ctx.globalAlpha = 1;
    ctx.font='bold 11px sans-serif'; ctx.fillStyle = on ? sg.color : open ? '#64748b' : '#3b4658';
    ctx.fillText(sg.name, cx+cw/2, y+29);
    ctx.font='8px sans-serif'; ctx.fillStyle = on ? '#78716c' : '#334155';
    ctx.fillText(sg.tagline, cx+cw/2, y+44);
    if (open) {
      ctx.font='bold 8px sans-serif'; ctx.fillStyle = on ? sg.color : '#334155';
      ctx.fillText(sg.skill.name, cx+cw/2, y+57);
    } else {
      ctx.font='bold 9px sans-serif'; ctx.fillStyle = canBuy ? '#fbbf24' : '#475569';
      ctx.fillText(`🔒 💎${cost}`, cx+cw/2, y+56);
    }
    if (on) { ctx.fillStyle=sg.color; ctx.fillRect(cx+cw/2-9, y+ch-4, 18, 2); }
    gs.ui.sigilCards.push({x:cx, y, w:cw, h:ch, id:sg.id, locked:!open});
  });
  y += ch + 8;

  // 고른 각인의 세부 — 카드 안에 다 못 쓴 것들
  roundRect(ctx, 12, y, CW-24, 42, 6);
  ctx.fillStyle='#0c1220'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=1; ctx.stroke();
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillStyle=cur.color; ctx.font='bold 10px sans-serif';
  ctx.fillText(`${cur.skill.name} · 쿨다운 ${cur.skill.cd}초`, 20, y+13);
  ctx.fillStyle='#64748b'; ctx.font='9px sans-serif';
  ctx.fillText(cur.skill.desc, 20, y+28);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
  ctx.fillText(cur.passive, CW-20, y+21);
  ctx.textAlign='left'; ctx.textBaseline='top';
}

// ── 🔓 해금 · 서약 ──────────────────────────────────────────────────────────
function renderLobbyUnlock(ctx, gs) {
  gs.ui.unlockBtns = [];
  let y = LOBBY_BODY_Y + 12;

  const up = unlockProgress();
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#f59e0b'; ctx.font='bold 11px sans-serif';
  ctx.fillText('🔓 해금', 14, y);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`${up.count}/${up.total} · ${up.spent}/${up.totalCost}💎`, CW-14, y+1);
  ctx.textAlign='left';
  y += 18;

  const rowH = 40;
  for (const d of UNLOCK_DEFS) {
    const owned = isUnlocked(d.id);
    const can   = !owned && gs.soulStones >= d.cost;
    roundRect(ctx,10,y,CW-20,rowH-4,6);
    ctx.fillStyle = owned ? '#0d2018' : can ? '#141c2e' : '#0a0e18'; ctx.fill();
    ctx.strokeStyle = owned ? '#22c55e' : can ? '#f59e0b' : '#1e293b';
    ctx.lineWidth = owned || can ? 1.5 : 1; ctx.stroke();

    ctx.globalAlpha = owned || can ? 1 : 0.5;
    ctx.font='17px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle='#e2e8f0';
    ctx.fillText(d.icon, 20, y+18);
    ctx.font='bold 11px sans-serif';
    ctx.fillStyle = owned ? '#86efac' : '#e2e8f0';
    ctx.fillText(d.name, 46, y+12);
    ctx.font='9px sans-serif'; ctx.fillStyle='#64748b';
    ctx.fillText(`${d.kind==='tower'?'타워':'병력'} · ${d.desc}`, 46, y+25);

    ctx.textAlign='right'; ctx.font='bold 11px sans-serif';
    if (owned) { ctx.fillStyle='#22c55e'; ctx.fillText('✓ 해금', CW-20, y+18); }
    else {
      ctx.fillStyle = can ? '#f59e0b' : '#475569';
      ctx.fillText(`💎 ${d.cost}`, CW-20, y+18);
      gs.ui.unlockBtns.push({x:10,y:y,w:CW-20,h:rowH-4,id:d.id,icon:d.icon});
    }
    ctx.globalAlpha = 1;
    y += rowH;
  }

}

// ── 📜 서약 ─────────────────────────────────────────────────────────────────
function renderLobbyPact(ctx, gs) {
  gs.ui.pactBtns = [];
  let y = LOBBY_BODY_Y + 12;
  ctx.textAlign='left';
  ctx.fillStyle='#f43f5e'; ctx.font='bold 11px sans-serif';
  ctx.fillText('📜 서약 — 난이도를 올리고 보석을 더 받는다', 14, y);
  ctx.textAlign='right'; ctx.fillStyle='#fda4af'; ctx.font='bold 10px sans-serif';
  ctx.fillText(`×${pactGemMult().toFixed(2)}`, CW-14, y+1);
  ctx.textAlign='left';
  y += 18;

  // 세 갈래로 묶어서 보여준다 — 무엇을 포기하는지가 한눈에 갈리도록
  const pRowH = 34;
  for (const [tier, label] of Object.entries(PACT_TIERS)) {
    const group = PACT_DEFS.filter(p => String(p.tier) === tier);
    if (!group.length) continue;
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
    ctx.fillText(label, 14, y); y += 13;

    for (const p of group) {
      const on = isPactOn(p.id);
      roundRect(ctx, 10, y, CW-20, pRowH-3, 5);
      ctx.fillStyle   = on ? '#2a0a16' : '#0a0e18'; ctx.fill();
      ctx.strokeStyle = on ? '#f43f5e' : '#1a2130'; ctx.lineWidth = on ? 1.6 : 1; ctx.stroke();

      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.font='12px sans-serif'; ctx.fillStyle='#e2e8f0';
      ctx.fillText(p.icon, 18, y+15);
      ctx.font='bold 10px sans-serif'; ctx.fillStyle = on ? '#fda4af' : '#cbd5e1';
      ctx.fillText(p.name, 38, y+10);
      ctx.font='8px sans-serif'; ctx.fillStyle = on ? '#9f6070' : '#475569';
      ctx.fillText(p.desc, 38, y+22);

      ctx.textAlign='right'; ctx.font='bold 10px sans-serif';
      ctx.fillStyle = on ? '#f43f5e' : '#475569';
      ctx.fillText(`+${Math.round(p.gem*100)}%`, CW-18, y+15);
      gs.ui.pactBtns.push({x:10,y:y,w:CW-20,h:pRowH-3,id:p.id});
      y += pRowH;
    }
    y += 4;
  }
}

// ── 📜 기록 ─────────────────────────────────────────────────────────────────
function renderLobbyRecord(ctx, gs) {
  const st = gs.stats;
  let y = LOBBY_BODY_Y + 12;
  ctx.textAlign='left'; ctx.textBaseline='top';

  // ── 무한 최고 기록 — 이 게임의 점수판 ────────────────────────────────────
  const best = st.bestEndless || 0;
  const gates = gs.clearedGates || [];
  const bh = 58;
  roundRect(ctx,10,y,CW-20,bh,8);
  ctx.fillStyle='#1a1033'; ctx.fill(); ctx.strokeStyle='#7c3aed'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#8b7bb8'; ctx.font='bold 9px sans-serif';
  ctx.fillText('∞ 최고 도달 층', 18, y+9);
  ctx.fillStyle='#c4b5fd'; ctx.font='bold 26px sans-serif';
  ctx.fillText(`${best}`, 18, y+22);
  const bw2 = ctx.measureText(`${best}`).width;
  ctx.fillStyle='#6d5b9e'; ctx.font='bold 11px sans-serif';
  ctx.fillText('층', 20+bw2, y+37);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`${st.runs||0}회 하강 · 관문 ${gates.length}개 돌파`, CW-18, y+11);
  ctx.fillStyle='#334155'; ctx.font='9px sans-serif';
  ctx.fillText(`훈련 최고 ${st.bestWave||0}웨이브`, CW-18, y+38);
  ctx.textAlign='left';
  y += bh + 12;

  // ── 관문 기록 ────────────────────────────────────────────────────────────
  ctx.fillStyle='#fbbf24'; ctx.font='bold 11px sans-serif';
  ctx.fillText('🏁 관문', 14, y); y += 18;
  const gateList = [10,20,30,40,50,60,70,80];
  const gw = (CW-30)/gateList.length;
  gateList.forEach((g,i) => {
    const cx = 12 + i*gw, on = gates.includes(g);
    roundRect(ctx,cx,y,gw-3,26,4);
    ctx.fillStyle = on ? '#2a1f05' : '#0a0e18'; ctx.fill();
    ctx.strokeStyle = on ? '#f59e0b' : '#1e293b'; ctx.lineWidth=1; ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = on ? '#fbbf24' : '#334155'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`${g}`, cx+(gw-3)/2, y+13);
  });
  ctx.textAlign='left'; ctx.textBaseline='top';
  y += 38;

  const rows = [
    ['플레이 횟수',   `${st.runs||0}회`],
    ['훈련 최고',     `${st.bestWave||0}웨이브`],
    ['누적 처치',     `${st.totalKills||0}마리`],
    ['누적 골드',     `${st.totalGold||0}💰`],
    ['누적 보석',     `${st.totalGems||0}💎`],
  ];
  ctx.fillStyle='#60a5fa'; ctx.font='bold 11px sans-serif';
  ctx.fillText('📊 누적 기록', 14, y); y += 20;
  rows.forEach((r,i) => {
    const ry = y + i*22;
    if (i%2===0) { ctx.fillStyle='#0c1220'; ctx.fillRect(10,ry-3,CW-20,21); }
    ctx.fillStyle='#64748b'; ctx.font='10px sans-serif'; ctx.textAlign='left';
    ctx.fillText(r[0], 18, ry+2);
    ctx.fillStyle='#e2e8f0'; ctx.font='bold 11px sans-serif'; ctx.textAlign='right';
    ctx.fillText(r[1], CW-18, ry+1);
  });
  y += rows.length*22 + 14;

  // 스테이지 클리어 현황
  ctx.textAlign='left'; ctx.fillStyle='#60a5fa'; ctx.font='bold 11px sans-serif';
  ctx.fillText('🗺 훈련 스테이지', 14, y); y += 18;
  const cs = gs.clearedStages || [];
  const nStages = Math.max(1, Math.ceil(TRAINING_WAVES / 3));   // 훈련이 짧아졌으므로 칸도 줄인다
  const cw = (CW-30)/Math.max(4, nStages);
  for (let i=0; i<nStages; i++) {
    const cx = 12 + i*cw;
    roundRect(ctx,cx,y,cw-3,26,4);
    ctx.fillStyle = cs[i] ? '#0d2a1a' : '#0a0e18'; ctx.fill();
    ctx.strokeStyle = cs[i] ? '#22c55e' : '#1e293b'; ctx.lineWidth=1; ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = cs[i] ? '#86efac' : '#334155'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`${i+1}`, cx+(cw-3)/2, y+13);
  }
  y += 38;

  // 몬스터 도감
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#60a5fa'; ctx.font='bold 11px sans-serif';
  const seen = gs.seenMobs || [];
  const mobIds = Object.keys(BATTLE_MOB_TYPES);
  ctx.fillText('📖 몬스터 도감', 14, y);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`${seen.length}/${mobIds.length}`, CW-14, y+1);
  ctx.textAlign='left';
  y += 18;

  const mw = (CW-26)/4, mh = 46;
  mobIds.forEach((id,i) => {
    const t = BATTLE_MOB_TYPES[id];
    const mx = 10 + (i%4)*(mw+5.33);
    const my = y + Math.floor(i/4)*(mh+5);
    const known = seen.includes(id);
    roundRect(ctx,mx,my,mw,mh,5);
    ctx.fillStyle='#0a0e18'; ctx.fill();
    ctx.strokeStyle = known ? '#334155' : '#161d2b'; ctx.lineWidth=1; ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='top';
    if (known) {
      ctx.font='16px sans-serif'; ctx.fillStyle='#e2e8f0';
      ctx.fillText(t.icon, mx+mw/2, my+7);
      ctx.font='bold 8px sans-serif'; ctx.fillStyle='#94a3b8';
      ctx.fillText(t.name, mx+mw/2, my+28);
      ctx.font='7px sans-serif'; ctx.fillStyle='#475569';
      ctx.fillText(`HP${t.hp} ATK${t.atk}`, mx+mw/2, my+37);
    } else {
      ctx.font='16px sans-serif'; ctx.fillStyle='#1e293b';
      ctx.fillText('?', mx+mw/2, my+9);
      ctx.font='8px sans-serif'; ctx.fillStyle='#334155';
      ctx.fillText('미발견', mx+mw/2, my+30);
    }
  });
  y += Math.ceil(mobIds.length/4)*(mh+5) + 14;

  // ── 세이브 백업 ──────────────────────────────────────────────────────────
  // 기록이 이 브라우저 안에만 있다는 걸 알려 주고, 빠져나갈 길을 준다.
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#60a5fa'; ctx.font='bold 11px sans-serif';
  ctx.fillText('\uD83D\uDCBE 세이브 백업', 14, y); y += 17;
  ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
  ctx.fillText('기록은 이 브라우저에만 저장됩니다. 캐시를 지우면 사라집니다.', 14, y); y += 15;

  const kw = (CW-30)/2, kh = 34;
  const mk = (bx2, label, sub, col, dim) => {
    roundRect(ctx,bx2,y,kw,kh,6);
    ctx.fillStyle = dim ? '#0a0e18' : '#111c2e'; ctx.fill();
    ctx.strokeStyle = dim ? '#1e293b' : col; ctx.lineWidth=1; ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = dim ? '#334155' : col; ctx.font='bold 11px sans-serif';
    ctx.fillText(label, bx2+kw/2, y+12);
    ctx.fillStyle = dim ? '#1e293b' : '#475569'; ctx.font='8px sans-serif';
    ctx.fillText(sub, bx2+kw/2, y+25);
    ctx.textAlign='left'; ctx.textBaseline='top';
    return {x:bx2,y:y,w:kw,h:kh};
  };
  const hasSave = SaveManager.hasSave();   // 매 프레임 통째로 인코딩하지 않는다
  gs.ui.backupExportBtn = mk(12, '\uD83D\uDCCB 백업 코드 복사', hasSave?'클립보드로 내보내기':'저장된 기록 없음', '#22d3ee', !hasSave);
  gs.ui.backupImportBtn = mk(18+kw, '\uD83D\uDCE5 코드로 복원', '붙여넣어 되살리기', '#f59e0b', false);
  y += kh + 8;

  if (gs.ui.backupMsg && Date.now() < gs.ui.backupMsg.until) {
    ctx.textAlign='center'; ctx.fillStyle=gs.ui.backupMsg.color; ctx.font='bold 10px sans-serif';
    ctx.fillText(gs.ui.backupMsg.text, CW/2, y);
    ctx.textAlign='left';
  }
}

// ── 출격 버튼 ───────────────────────────────────────────────────────────────
// 출격은 두 갈래다. 무한이 본편이므로 넓고 밝게, 훈련은 옆에 작게 둔다.
function renderSortieBar(ctx, gs) {
  const by = CH - LOBBY_SORTIE_H;
  ctx.fillStyle='#0d1220'; ctx.fillRect(0,by,CW,LOBBY_SORTIE_H);
  ctx.strokeStyle='#1e293b'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,by+0.5); ctx.lineTo(CW,by+0.5); ctx.stroke();

  const open = endlessUnlocked();
  const bh = 42, byy = by + 9;

  if (!open) {
    // 아직 훈련을 못 끝냈다 — 선택지를 만들지 않는다
    const bw = CW-24, bx = 12;
    roundRect(ctx,bx,byy,bw,bh,8);
    ctx.fillStyle='#14532d'; ctx.fill();
    ctx.strokeStyle='#22c55e'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='bold 15px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('⚔️  훈련 시작', CW/2 - 40, byy+bh/2);
    ctx.fillStyle='#86efac'; ctx.font='bold 9px sans-serif';
    ctx.fillText('한 판 치르면 ∞ 심연이 열립니다', CW/2 + 82, byy+bh/2+1);
    gs.ui.sortieBtn = {x:bx,y:byy,w:bw,h:bh};
    gs.ui.trainBtn  = null;
    return;
  }

  const trainW = 132, gap = 8;
  const endW = CW - 24 - trainW - gap;

  // ∞ 무한 — 본편
  roundRect(ctx,12,byy,endW,bh,8);
  ctx.fillStyle='#2e1065'; ctx.fill();
  ctx.strokeStyle='#a78bfa'; ctx.lineWidth=2; ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif';
  ctx.fillText('∞  심연 하강', 12+endW/2, byy+bh/2-6);
  const best = gs.stats.bestEndless || 0;
  ctx.fillStyle='#c4b5fd'; ctx.font='bold 9px sans-serif';
  ctx.fillText(best > 0 ? `최고 ${best}층 — 더 내려가기` : '첫 하강', 12+endW/2, byy+bh/2+11);
  gs.ui.sortieBtn = {x:12,y:byy,w:endW,h:bh};

  // 훈련 — 연습
  const tx = 12 + endW + gap;
  roundRect(ctx,tx,byy,trainW,bh,8);
  ctx.fillStyle='#0f1e17'; ctx.fill();
  ctx.strokeStyle='#22c55e'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#4ade80'; ctx.font='bold 12px sans-serif';
  ctx.fillText('⚔️ 훈련', tx+trainW/2, byy+bh/2-6);
  ctx.fillStyle='#166534'; ctx.font='bold 8px sans-serif';
  ctx.fillText(`${TRAINING_WAVES}웨이브 · 연습`, tx+trainW/2, byy+bh/2+10);
  gs.ui.trainBtn = {x:tx,y:byy,w:trainW,h:bh};
}

// ─── 결과 화면 ───────────────────────────────────────────────────────────────
// v2.0까지는 게임오버에서 곧장 스킬 트리로 넘어가 "이번 런이 어땠는지"를
// 음미할 자리가 없었다. 정산 내역을 보여주고 로비로 돌려보낸다.
function renderResult(ctx, gs) {
  const r = gs.runSummary;
  ctx.fillStyle='#080b14'; ctx.fillRect(0,0,CW,CH);
  if (!r) { gs.ui.resultBtn=null; return; }

  ctx.textAlign='center'; ctx.textBaseline='top';
  let y = 46;
  if (r.endless) {
    // 무한은 도달 층이 곧 성적표다 — 제목 자리를 층수에 내준다
    ctx.fillStyle='#c4b5fd'; ctx.font='bold 13px sans-serif';
    ctx.fillText('∞ 하강 종료', CW/2, y); y += 20;
    ctx.fillStyle='#a78bfa'; ctx.font='bold 46px sans-serif';
    ctx.fillText(`${r.endlessTier}층`, CW/2, y); y += 52;
    ctx.fillStyle='#475569'; ctx.font='11px sans-serif';
    ctx.fillText(`이전 최고 ${gs.stats.bestEndless||0}층 · 여기까지 버텼습니다`, CW/2, y);
    y += 28;
  } else {
    ctx.fillStyle = r.cleared ? '#22c55e' : '#ef4444';
    ctx.font='bold 26px sans-serif';
    ctx.fillText(r.cleared ? '훈련 완주!' : '기지 함락', CW/2, y);
    y += 36;
    ctx.fillStyle='#475569'; ctx.font='11px sans-serif';
    ctx.fillText(r.cleared ? `${TRAINING_WAVES}웨이브를 모두 막아냈습니다 — ∞ 심연이 열렸습니다`
                           : '다음엔 더 멀리 갈 수 있습니다', CW/2, y);
    y += 30;
  }

  if (r.newBest) {
    roundRect(ctx,(CW-160)/2,y,160,24,12);
    ctx.fillStyle='#3b1d6e'; ctx.fill(); ctx.strokeStyle='#a78bfa'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#ddd6fe'; ctx.font='bold 11px sans-serif'; ctx.textBaseline='middle';
    ctx.fillText('🏆 최고 기록 갱신!', CW/2, y+12);
    ctx.textBaseline='top';
    y += 34;
  }

  // 이번 런 지표
  const stats = [
    ['도달',     r.endless ? `${r.endlessTier}층` : `${r.reached}웨이브`],
    ['처치',     `${r.kills}마리`],
    ['획득 골드', `${r.gold}💰`],
    ['남은 기지', `${r.baseHP}HP`],
  ];
  const sw = (CW-40)/4;
  stats.forEach((st,i) => {
    const sx = 20 + i*sw;
    ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif';
    ctx.fillText(st[0], sx+sw/2, y);
    ctx.fillStyle='#e2e8f0'; ctx.font='bold 13px sans-serif';
    ctx.fillText(st[1], sx+sw/2, y+14);
  });
  y += 48;

  // 보석 정산 내역
  const boxH = 40 + r.rows.length*20 + (r.mult > 1 ? 22 : 0) + (r.gaveUp ? 22 : 0);
  roundRect(ctx,20,y,CW-40,boxH,8);
  ctx.fillStyle='#0d1220'; ctx.fill(); ctx.strokeStyle='#3b2a5c'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.textAlign='left';
  ctx.fillStyle='#a78bfa'; ctx.font='bold 11px sans-serif';
  ctx.fillText('💎 보석 정산', 32, y+11);
  let ry = y + 32;
  for (const row of r.rows) {
    ctx.fillStyle='#64748b'; ctx.font='10px sans-serif'; ctx.textAlign='left';
    ctx.fillText(row.label, 32, ry);
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif';
    ctx.fillText(row.note, 130, ry+1);
    ctx.fillStyle = row.value > 0 ? '#c4b5fd' : '#334155';
    ctx.font='bold 10px sans-serif'; ctx.textAlign='right';
    ctx.fillText(`+${row.value}`, CW-32, ry);
    ry += 20;
  }
  if (r.mult > 1) {
    ctx.fillStyle='#f43f5e'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left';
    ctx.fillText('📜 서약 배율', 32, ry);
    ctx.textAlign='right';
    ctx.fillText(`×${r.mult.toFixed(2)}`, CW-32, ry);
    ry += 22;
  }
  if (r.gaveUp) {
    ctx.fillStyle='#f59e0b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left';
    ctx.fillText('🏳 중도 포기', 32, ry);
    ctx.fillStyle='#78716c'; ctx.font='9px sans-serif';
    ctx.fillText('끝까지 버텼다면 전액', 130, ry+1);
    ctx.fillStyle='#f59e0b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='right';
    ctx.fillText(`×${GIVE_UP_GEM_MULT.toFixed(2)}`, CW-32, ry);
  }
  y += boxH + 14;

  // 총 획득
  ctx.textAlign='center';
  ctx.fillStyle='#a78bfa'; ctx.font='bold 22px sans-serif';
  ctx.fillText(`💎 +${r.gems}`, CW/2, y);
  y += 30;
  ctx.fillStyle='#64748b'; ctx.font='11px sans-serif';
  ctx.fillText(`보유 ${gs.soulStones}💎`, CW/2, y);
  y += 28;

  // ── 지금 보유한 보석으로 캠프에서 할 수 있는 것 ──
  // "그래서 다음에 뭘 하지"를 결과 화면에서 바로 보여준다
  const affordable = UNLOCK_DEFS.filter(u => !isUnlocked(u.id) && gs.soulStones >= u.cost);
  const nextLocked = UNLOCK_DEFS.find(u => !isUnlocked(u.id));
  const buyable    = [];
  for (const tree of Object.values(SKILL_TREES)) {
    for (const sk of tree.skills) {
      if ((gs.skillTreeOwned||[]).includes(sk.id)) continue;
      if (sk.req && !(gs.skillTreeOwned||[]).includes(sk.req)) continue;
      if (gs.soulStones >= sk.cost) buyable.push(sk);
    }
  }

  const ph = 96;
  roundRect(ctx,20,y,CW-40,ph,8);
  ctx.fillStyle='#0c1220'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=1; ctx.stroke();
  ctx.textAlign='left';
  ctx.fillStyle='#22c55e'; ctx.font='bold 10px sans-serif';
  ctx.fillText('⛺ 캠프에서 지금 할 수 있는 것', 32, y+11);
  let py = y+31;

  if (affordable.length) {
    ctx.fillStyle='#86efac'; ctx.font='10px sans-serif';
    ctx.fillText(`🔓 해금 ${affordable.length}개`, 32, py);
    ctx.fillStyle='#e2e8f0'; ctx.font='12px sans-serif'; ctx.textAlign='right';
    ctx.fillText(affordable.map(u=>u.icon).join(' '), CW-32, py-1);
    ctx.textAlign='left';
  } else if (nextLocked) {
    ctx.fillStyle='#64748b'; ctx.font='10px sans-serif';
    ctx.fillText(`🔓 다음 해금 — ${nextLocked.icon} ${nextLocked.name}`, 32, py);
    ctx.textAlign='right'; ctx.fillStyle='#f59e0b'; ctx.font='bold 10px sans-serif';
    ctx.fillText(`💎 ${nextLocked.cost - gs.soulStones} 더`, CW-32, py);
    ctx.textAlign='left';
  } else {
    ctx.fillStyle='#86efac'; ctx.font='10px sans-serif';
    ctx.fillText('🔓 모두 해금 완료', 32, py);
  }
  py += 19;

  ctx.fillStyle = buyable.length ? '#c4b5fd' : '#475569'; ctx.font='10px sans-serif';
  ctx.fillText(buyable.length ? `🌳 스킬 ${buyable.length}개를 지금 찍을 수 있습니다` : '🌳 지금 찍을 수 있는 스킬 없음', 32, py);
  py += 19;

  const pactCount = PACT_DEFS.filter(p=>isPactOn(p.id)).length;
  ctx.fillStyle='#64748b'; ctx.font='10px sans-serif';
  ctx.fillText(pactCount ? `📜 서약 ${pactCount}개 유지 중 — 보석 ×${pactGemMult().toFixed(2)}`
                         : '📜 서약을 걸면 보석을 최대 +87%까지 더 받습니다', 32, py);
  ctx.textAlign='center';

  // 로비 복귀
  const bw=CW-60, bh=46, bx=30, by=CH-90;
  roundRect(ctx,bx,by,bw,bh,9);
  ctx.fillStyle='#1e293b'; ctx.fill(); ctx.strokeStyle='#a78bfa'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#ddd6fe'; ctx.font='bold 15px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('⛺ 캠프로 돌아가기', CW/2, by+bh/2);
  gs.ui.resultBtn = {x:bx,y:by,w:bw,h:bh};

  ctx.fillStyle='#334155'; ctx.font='9px sans-serif'; ctx.textBaseline='top';
  ctx.fillText('보석은 캠프에서 스킬과 해금에 쓸 수 있습니다', CW/2, by+bh+10);
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
  if (buildingId==='heroShop' && (gs.town.shopTab||'buy')==='buy') { renderHeroShopScreen(ctx,gs); return; }
  const def=TOWN_BUILDINGS.find(b=>b.id===buildingId);
  const bs=gs.town.buildings[buildingId];
  if (!def||!bs) return;

  // 건물 화면은 마을 탭 아래 전체를 쓴다.
  // 전에는 하단 전투 영역(BATTLE_Y부터)에만 그려서 위쪽 300px이 비어 있었고,
  // 강화 목록은 그 좁은 칸에 밀려 화면 밖으로 잘렸다.
  const SCR_TOP = 92;
  ctx.fillStyle='#0c0f1a'; ctx.fillRect(0,SCR_TOP,CW,CH-SCR_TOP);

  // Header
  const hY=SCR_TOP+6;
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

  // ── 건물 레벨 ────────────────────────────────────────────────────────────
  const curLv = bs.level||0, maxLv = BUILDING_MAX_LEVEL-1;
  if (curLv < maxLv) {
    const cost = buildingLevelCost(def, curLv+1);
    const canAff = gs.gold>=cost;
    const bw=140,bh=22,bx=CW-6-bw,by2=hY;
    roundRect(ctx,bx,by2,bw,bh,4);
    ctx.fillStyle=canAff?'#1e3a5f':'#1a1a2e'; ctx.fill();
    ctx.strokeStyle=canAff?'#f59e0b':'#374151'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle=canAff?'#fbbf24':'#6b7280'; ctx.font='bold 8px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`Lv.${curLv+2} 승급 ${cost}💰`,bx+bw/2,by2+bh/2);
    gs.ui.buildingLvUpBtn={x:bx,y:by2,w:bw,h:bh};
  } else {
    const bw=140,bh=22,bx=CW-6-bw;
    roundRect(ctx,bx,hY,bw,bh,4);
    ctx.fillStyle='#2a1f05'; ctx.fill(); ctx.strokeStyle='#f59e0b'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#fbbf24'; ctx.font='bold 8px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('★ 최고 레벨 — ♾️ 개방',bx+bw/2,hY+bh/2);
    gs.ui.buildingLvUpBtn=null;
  }

  ctx.fillStyle='#475569'; ctx.font='9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  const nextTracks = curLv<maxLv ? tracksUnlockedAt(def, curLv+1) : [];
  ctx.fillText(`Lv.${curLv+1} / ${BUILDING_MAX_LEVEL}` +
    (nextTracks.length ? `   다음 승급: ${nextTracks.map(t=>t.icon+t.name).join(' ')} 개방` : ''), 6, hY+26);

  // 영웅 상점은 매대와 강화가 한 건물 안에 있다 — 여기서도 돌아갈 길을 낸다
  const isShop = def.id==='heroShop';
  if (isShop) drawShopTabs(ctx, gs, hY+40);

  // ── 강화 목록 (스크롤) ───────────────────────────────────────────────────
  // 10레벨이면 항목이 화면을 넘는다. 드래그로 훑을 수 있게 잘라 그린다.
  const listTop = SCR_TOP+(isShop?72:50), listBot = CH-8, listH = listBot-listTop;
  const open   = buildingTracks(def, curLv);
  const locked = (def.tracks||[]).filter(t => (t.unlockLv||0) > curLv);
  const rowH = 40, gapH = 4, lockH = 26;
  const contentH = open.length*(rowH+gapH) + (locked.length ? 16 + locked.length*(lockH+3) : 0);
  const maxScroll = Math.max(0, contentH - listH);
  gs.town.scroll = Math.max(0, Math.min(maxScroll, gs.town.scroll||0));
  const sc = gs.town.scroll;

  ctx.save();
  ctx.beginPath(); ctx.rect(0, listTop, CW, listH); ctx.clip();

  gs.ui.upgradeBtns=[];
  let uy = listTop - sc;

  for (const tr of open) {
    if (uy > listBot || uy + rowH < listTop) { uy += rowH+gapH; continue; }
    const n = bs.upgrades[tr.id]||0;
    const mx = trackMax(tr), inf = trackIsInfinite(tr);
    const maxed = !inf && n>=mx;
    const cost = trackCost(tr, n);
    const canAff = !maxed && gs.gold>=cost;

    roundRect(ctx,6,uy,CW-12,rowH,5);
    ctx.fillStyle = maxed?'#0f1a0f' : inf?'#1a1030' : canAff?'#0d1929':'#0f0f1a'; ctx.fill();
    ctx.strokeStyle = maxed?'#22c55e' : inf?'#a78bfa' : canAff?def.color:'#334155';
    ctx.lineWidth = inf?1.5:1; ctx.stroke();

    ctx.fillStyle='#e2e8f0'; ctx.font='13px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(tr.icon,12,uy+rowH/2);
    ctx.fillStyle = inf?'#c4b5fd':'#f1f5f9'; ctx.font='bold 10px sans-serif';
    ctx.fillText(tr.name + (inf?'  (무한)':''),30,uy+rowH/2-9);
    // 현재 효과 → 다음 효과
    const now = trackTotal(tr, n), next = trackTotal(tr, n+1);
    ctx.fillStyle='#94a3b8'; ctx.font='bold 9px sans-serif';
    ctx.fillText(n>0 ? tr.desc(now) : tr.desc(next), 30, uy+rowH/2+2);
    if (!maxed && n>0) {
      ctx.fillStyle='#4ade80'; ctx.font='bold 8px sans-serif';
      ctx.fillText(`▲ ${tr.desc(next)}`, 30, uy+rowH/2+13);
    }
    // 진행 표시 — 유한이면 점, 무한이면 횟수
    ctx.textAlign='right';
    if (inf) {
      ctx.fillStyle='#a78bfa'; ctx.font='bold 10px sans-serif';
      ctx.fillText(`×${n}`, CW-84, uy+rowH/2);
    } else {
      const dots = Math.min(mx, 10), dw = 7;
      for (let d=0; d<dots; d++) {
        ctx.beginPath(); ctx.arc(CW-84-(dots-1-d)*dw, uy+rowH/2, 2.6, 0, Math.PI*2);
        ctx.fillStyle = d<n?'#22c55e':'#334155'; ctx.fill();
      }
      ctx.fillStyle='#475569'; ctx.font='bold 7px sans-serif'; ctx.textAlign='right';
      ctx.fillText(`${n}/${mx}`, CW-84, uy+rowH/2+12);
    }

    if (!maxed) {
      const bw2=68,bh2=22,bx2=CW-8-bw2,by2=uy+(rowH-bh2)/2;
      roundRect(ctx,bx2,by2,bw2,bh2,4);
      ctx.fillStyle=canAff?(inf?'#6d28d9':def.color):'#1e293b'; ctx.fill();
      ctx.fillStyle=canAff?'#fff':'#475569'; ctx.font='bold 9px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${cost}💰`,bx2+bw2/2,by2+bh2/2);
      gs.ui.upgradeBtns.push({x:bx2,y:by2,w:bw2,h:bh2,id:tr.id});
    } else {
      ctx.fillStyle='#22c55e'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('MAX',CW-42,uy+rowH/2);
    }
    uy += rowH+gapH;
  }

  // 아직 안 열린 트랙
  if (locked.length) {
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
    ctx.fillText('🔒 승급하면 열립니다', 8, uy+2);
    uy += 16;
    for (const tr of locked) {
      if (uy <= listBot && uy+lockH >= listTop) {
        roundRect(ctx,6,uy,CW-12,lockH,4);
        ctx.fillStyle='#080d18'; ctx.fill(); ctx.strokeStyle='#232c3d'; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle= trackIsInfinite(tr)?'#7c5cbf':'#64748b';
        ctx.font='bold 9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
        ctx.fillText(`${tr.icon} ${tr.name}`, 12, uy+lockH/2);
        ctx.fillStyle='#3f4a5c'; ctx.font='bold 8px sans-serif'; ctx.textAlign='right';
        ctx.fillText(`Lv.${(tr.unlockLv||0)+1} 필요`, CW-12, uy+lockH/2);
      }
      uy += lockH+3;
    }
  }
  ctx.restore();

  // 스크롤 막대
  if (maxScroll > 0) {
    const trackH = listH-8, thumbH = Math.max(24, trackH*listH/contentH);
    const ty = listTop+4 + (trackH-thumbH) * (sc/maxScroll);
    ctx.fillStyle='rgba(148,163,184,0.12)'; ctx.fillRect(CW-4, listTop+4, 2, trackH);
    ctx.fillStyle='rgba(148,163,184,0.55)'; ctx.fillRect(CW-4, ty, 2, thumbH);
  }
  gs.ui.buildingScroll = maxScroll>0 ? {x:0,y:listTop,w:CW,h:listH,max:maxScroll} : null;
}

// ─── 영웅 상점 ───────────────────────────────────────────────────────────────
// 매대와 강화가 한 건물 안에 있다. 예전에는 상점 카드를 누르면 매대만 나와서
// 이 건물의 강화 트랙(👑 영웅 단련 등)에 아예 손이 닿지 않았다.
function drawShopTabs(ctx, gs, y) {
  const tabs = [{id:'buy', label:'🛒 매대'}, {id:'upgrade', label:'⚒️ 강화'}];
  const tw = 66, th = 20, x0 = CW/2 - tw - 3;
  const cur = gs.town.shopTab || 'buy';
  tabs.forEach((t,i)=>{
    const tx = x0 + i*(tw+6), on = cur===t.id;
    roundRect(ctx,tx,y,tw,th,4);
    ctx.fillStyle = on?'#2d1b69':'#0f172a'; ctx.fill();
    ctx.strokeStyle = on?'#a78bfa':'#1e293b'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle = on?'#c4b5fd':'#64748b'; ctx.font='bold 9px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(t.label, tx+tw/2, y+th/2);
    if (t.id==='buy') gs.ui.shopTabBuy = {x:tx,y,w:tw,h:th};
    else              gs.ui.shopTabUp  = {x:tx,y,w:tw,h:th};
  });
}

function renderHeroShopScreen(ctx, gs) {
  const SCR_TOP = 92;
  ctx.fillStyle='#0c0f1a'; ctx.fillRect(0,SCR_TOP,CW,CH-SCR_TOP);
  const hY=SCR_TOP+6;
  ctx.fillStyle='#a78bfa'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('🏪 영웅 상점',CW/2,hY);
  roundRect(ctx,6,hY,50,22,4); ctx.fillStyle='#1e293b'; ctx.fill(); ctx.strokeStyle='#475569'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('← 뒤로',31,hY+11);
  gs.ui.townBackBtn={x:6,y:hY,w:50,h:22};
  ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText(`Lv.${(gs.town.buildings.heroShop.level||0)+1}`, CW-8, hY+11);
  drawShopTabs(ctx, gs, hY+22);

  gs.ui.shopItemBtns=[];
  gs.ui.skillBuyBtns=[];

  // 매대는 길다 — 잘라 그리고 드래그로 훑는다
  const listTop = SCR_TOP+52, listBot = CH-8, listH = listBot-listTop;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, listTop, CW, listH); ctx.clip();
  let sy = listTop - (gs.town.scroll||0);

  // ── 소비 아이템 ─────────────────────────────────────────────────────────
  ctx.fillStyle='#a5b4fc'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('소비 아이템',8,sy); sy+=14;
  for (const item of HERO_SHOP_FIXED) {
    const ih=38;
    const gc=GRADE_COLOR[item.grade]||'#94a3b8';
    roundRect(ctx,6,sy,CW-12,ih,5); ctx.fillStyle='#0d1929'; ctx.fill(); ctx.strokeStyle=gc; ctx.lineWidth=1; ctx.stroke();
    ctx.font='16px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='#e2e8f0';
    ctx.fillText(item.icon,12,sy+ih/2);
    ctx.fillStyle='#f1f5f9'; ctx.font='bold 10px sans-serif'; ctx.fillText(item.name,30,sy+ih/2-7);
    ctx.fillStyle='#cbd5e1'; ctx.font='bold 9px sans-serif'; ctx.fillText(item.desc,30,sy+ih/2+6);
    const canAff=gs.gold>=item.cost;
    const bw=60,bh=20,bx=CW-8-bw,by2=sy+(ih-bh)/2;
    roundRect(ctx,bx,by2,bw,bh,4); ctx.fillStyle=canAff?'#4c1d95':'#1e293b'; ctx.fill();
    ctx.fillStyle=canAff?'#c4b5fd':'#475569'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`${item.cost}💰`,bx+bw/2,by2+bh/2);
    gs.ui.shopItemBtns.push({x:bx,y:by2,w:bw,h:bh,item});
    sy+=ih+4;
  }

  // ── 장비 ────────────────────────────────────────────────────────────────
  sy+=6;
  ctx.fillStyle='#a5b4fc'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('영웅 장비 (웨이브마다 갱신)',8,sy);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
  ctx.fillText('산 장비는 보관함으로 — 출전준비에서 장착', CW-8, sy+1);
  ctx.textAlign='left'; sy+=14;
  const shopItems=gs.town.buildings.heroShop.built?gs.town.shopItems:[];
  if (!gs.town.buildings.heroShop.built) {
    ctx.fillStyle='#374151'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('영웅 상점 건설 후 이용 가능',CW/2,sy+20);
    sy += 40;
  }
  const _owned = new Set(heroGear(gs).inventory.map(e=>e.itemId));
  for (const item of shopItems) {
    const ih=38;
    const gc=GRADE_COLOR[item.grade]||'#94a3b8';
    const have=_owned.has(item.id);
    roundRect(ctx,6,sy,CW-12,ih,5); ctx.fillStyle=have?'#141e0d':'#0d1929'; ctx.fill(); ctx.strokeStyle=gc; ctx.lineWidth=have?2:1; ctx.stroke();
    ctx.font='18px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='#e2e8f0';
    ctx.fillText(item.icon,12,sy+ih/2);
    const sl=EQUIP_SLOTS.find(s2=>s2.accepts===item.slot);
    ctx.fillStyle=gc; ctx.font='bold 10px sans-serif';
    ctx.fillText(`[${item.slot==='acc'?'악세':(sl?sl.name:item.slot)}] ${item.name}`,32,sy+ih/2-8);
    ctx.fillStyle='#cbd5e1'; ctx.font='bold 9px sans-serif';
    ctx.fillText(statsLine(item.stats),32,sy+ih/2+5);
    if (have) { ctx.fillStyle='#22c55e'; ctx.font='bold 9px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='middle'; ctx.fillText('보유 중',CW-10,sy+ih/2); }
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

  // ── 🔮 스킬 매대 ─────────────────────────────────────────────────────────
  // 상점을 키워야 열린다. 잠겨 있을 때도 자리를 보여준다 — 무엇을 위해 올리는지 알아야 한다.
  sy+=6;
  const _open = skillShopOpen(gs);
  ctx.fillStyle=_open?'#f0abfc':'#4b5563'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('🔮 영웅 스킬',8,sy);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
  ctx.fillText(_open?'같은 스킬도 굴림값에 따라 성능이 다릅니다':`상점 Lv.${SKILL_SHOP_LEVEL} 필요`, CW-8, sy+1);
  ctx.textAlign='left'; sy+=14;
  if (!_open) {
    roundRect(ctx,6,sy,CW-12,32,5); ctx.fillStyle='#0b0f1a'; ctx.fill(); ctx.strokeStyle='#1f2937'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#4b5563'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`🔒 영웅 상점을 Lv.${SKILL_SHOP_LEVEL}까지 올리면 스킬을 팝니다`,CW/2,sy+16);
    ctx.textAlign='left'; sy+=36;
  } else {
    const offers = heroGear(gs).skillOffers || [];
    if (!offers.length) {
      ctx.fillStyle='#374151'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('이번 웨이브 매물은 모두 팔렸습니다',CW/2,sy+16); ctx.textAlign='left'; sy+=34;
    }
    for (const off of offers) {
      const def=skillDef(off.skillId); if (!def) continue;
      const ih=40, gc=GRADE_COLOR[def.grade]||'#94a3b8';
      roundRect(ctx,6,sy,CW-12,ih,5); ctx.fillStyle='#120d1e'; ctx.fill(); ctx.strokeStyle=gc; ctx.lineWidth=1; ctx.stroke();
      ctx.font='18px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='#e2e8f0';
      ctx.fillText(def.icon,12,sy+ih/2);
      ctx.fillStyle=gc; ctx.font='bold 10px sans-serif';
      ctx.fillText(`${def.name} ${rollStars(off.roll)}`,32,sy+ih/2-9);
      ctx.fillStyle='#cbd5e1'; ctx.font='bold 9px sans-serif';
      ctx.fillText(statsLine(skillStats(off)),32,sy+ih/2+5);
      const cost=skillOfferCost(off), canAff=gs.gold>=cost;
      const bw=60,bh=22,bx=CW-8-bw,by2=sy+(ih-bh)/2;
      roundRect(ctx,bx,by2,bw,bh,4); ctx.fillStyle=canAff?'#3b1d5e':'#1e293b'; ctx.fill();
      ctx.fillStyle=canAff?gc:'#475569'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${cost}💰`,bx+bw/2,by2+bh/2);
      gs.ui.skillBuyBtns.push({x:bx,y:by2,w:bw,h:bh,uid:off.uid});
      sy+=ih+4;
    }
  }

  // ── 지금 낀 것 요약 ──────────────────────────────────────────────────────
  const _g = heroGear(gs);
  sy+=6; ctx.fillStyle='#a5b4fc'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('장착 중',8,sy);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
  ctx.fillText(`보관함 ${_g.inventory.length} · 스킬 ${_g.skills.length}`, CW-8, sy+1);
  ctx.textAlign='left'; sy+=15;
  ctx.font='14px sans-serif'; ctx.textBaseline='top';
  EQUIP_SLOTS.forEach((sl,i)=>{
    const it=equippedItem(gs,sl.id);
    ctx.globalAlpha=it?1:0.22;
    ctx.fillStyle='#e2e8f0'; ctx.fillText(it?it.icon:sl.icon,10+i*24,sy);
    ctx.globalAlpha=1;
  });
  sy += 22;
  ctx.restore();

  // 스크롤 범위 — 그린 만큼으로 되돌려 계산한다
  const contentH = (sy + (gs.town.scroll||0)) - listTop + 6;
  const maxScroll = Math.max(0, contentH - listH);
  gs.town.scroll = Math.max(0, Math.min(maxScroll, gs.town.scroll||0));
  if (maxScroll > 0) {
    const trackH = listH-8, thumbH = Math.max(24, trackH*listH/contentH);
    const ty = listTop+4 + (trackH-thumbH) * (gs.town.scroll/maxScroll);
    ctx.fillStyle='rgba(148,163,184,0.12)'; ctx.fillRect(CW-4, listTop+4, 2, trackH);
    ctx.fillStyle='rgba(148,163,184,0.55)'; ctx.fillRect(CW-4, ty, 2, thumbH);
  }
  gs.ui.buildingScroll = maxScroll>0 ? {x:0,y:listTop,w:CW,h:listH,max:maxScroll} : null;
  gs.ui.buildingLvUpBtn = null;
}


// ─── 마을 페이지 (full-screen) ────────────────────────────────────────────────
let _townBottom = 0;   // 탭 본문이 그린 마지막 y — 스크롤 범위 계산에 쓴다
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
    gs.ui.pageScroll = null;
    renderBuildingScreen(ctx,gs,gs.town.screen);
    return;
  }

  // ── 탭 본문 — 스크롤된다 ──────────────────────────────────────────────────
  // 예전에는 화면에 안 들어가는 부분을 아예 그리지 않았다(`if (y < CH-40)`).
  // 편성이 늘거나 타워가 많아지면 전투력 요약·배치 현황이 통째로 사라졌다.
  // 이제 잘라내는 대신 넘긴다. 렌더러에는 스크롤이 반영된 startY를 주므로
  // 그림과 버튼 좌표가 함께 움직여 탭 판정이 어긋나지 않는다.
  const scroll = gs.town.scroll || 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, contentY, CW, CH-contentY); ctx.clip();
  _townBottom = contentY;
  const top = contentY - scroll;
  if (gs.town.tab==='town')        renderTownPageBuildingGrid(ctx,gs,top);
  else if (gs.town.tab==='army')   renderTownPageArmy(ctx,gs,top);
  else if (gs.town.tab==='towers') renderTownPageTowers(ctx,gs,top);
  ctx.restore();

  const viewH   = CH - contentY;
  const contentH= (_townBottom + scroll) - contentY + 10;   // 스크롤을 되돌린 실제 높이
  const maxScroll = Math.max(0, contentH - viewH);
  gs.town.scroll = Math.max(0, Math.min(maxScroll, scroll));
  gs.ui.pageScroll = maxScroll > 0 ? {x:0,y:contentY,w:CW,h:viewH,max:maxScroll} : null;

  if (maxScroll > 0) drawScrollHint(ctx, contentY, viewH, gs.town.scroll, maxScroll);
}

// 스크롤 막대 — 더 볼 것이 남았다는 사실 자체를 알려야 한다
function drawScrollHint(ctx, top, viewH, scroll, maxScroll) {
  const trackH = viewH - 12;
  const barH   = Math.max(28, trackH * (viewH / (viewH + maxScroll)));
  const barY   = top + 6 + (trackH - barH) * (scroll / maxScroll);
  ctx.fillStyle='rgba(148,163,184,0.12)';
  roundRect(ctx, CW-7, top+6, 4, trackH, 2); ctx.fill();
  ctx.fillStyle='rgba(148,163,184,0.60)';
  roundRect(ctx, CW-7, barY, 4, barH, 2); ctx.fill();
  // 아직 아래에 더 있다는 표시 — 막대만으로는 눈에 안 들어온다
  if (scroll < maxScroll - 1) {
    const g = ctx.createLinearGradient(0, top+viewH-26, 0, top+viewH);
    g.addColorStop(0, 'rgba(8,13,24,0)'); g.addColorStop(1, 'rgba(8,13,24,0.92)');
    ctx.fillStyle = g; ctx.fillRect(0, top+viewH-26, CW, 26);
    ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('▼ 아래로 밀어서 더 보기', CW/2, top+viewH-4);
    ctx.textAlign='left'; ctx.textBaseline='top';
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
      ctx.fillStyle='#60a5fa'; ctx.font='bold 9px sans-serif';
      ctx.fillText(`Lv.${curLv+1}/${BUILDING_MAX_LEVEL}`,bx+50,by+26);
    } else if (def.id==='cave') {
      ctx.fillStyle=def.color; ctx.font='bold 9px sans-serif'; ctx.textBaseline='top';
      ctx.fillText(`Lv.${gs.caveLevel}/5`,bx+50,by+26);
    }

    ctx.fillStyle='#94a3b8'; ctx.font='bold 10px sans-serif'; ctx.textBaseline='top'; ctx.fillText(def.desc,bx+10,by+52);

    if (built&&def.id!=='cave') {
      const curLv=bs.level||0;
      const open=buildingTracks(def,curLv);
      // 유한 트랙만 진행도로 센다 — 무한 트랙은 끝이 없으므로 분모가 될 수 없다
      const fin=open.filter(t=>!trackIsInfinite(t));
      const cap=fin.reduce((a,t)=>a+trackMax(t),0);
      const got=fin.reduce((a,t)=>a+(bs.upgrades[t.id]||0),0);
      const inf=open.filter(t=>trackIsInfinite(t)).reduce((a,t)=>a+(bs.upgrades[t.id]||0),0);
      ctx.fillStyle=(cap>0&&got>=cap)?'#22c55e':'#94a3b8'; ctx.font='bold 9px sans-serif';
      ctx.fillText(`강화 ${got}/${cap}${inf?`  ♾️×${inf}`:''}`,bx+10,by+68);
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

  // ── 성벽 보수 — 남는 골드를 기지 HP로 바꾸는 통로 ──────────────────────
  // 건물이 늘어나면 행 수도 늘어난다 — 고정 2행으로 두면 아래 칸과 겹친다
  const bRows = Math.ceil(TOWN_BUILDINGS.length / 2);
  const wrY = startY+bRows*(bh+gap)+4;
  const wrH = 46;
  roundRect(ctx,6,wrY,CW-12,wrH,6);
  ctx.fillStyle='#0a0d1a'; ctx.fill(); ctx.strokeStyle='#2a3f5f'; ctx.lineWidth=1; ctx.stroke();

  const full   = gs.baseHP >= baseHpMax();
  const wrCost = wallRepairCost(gs.wallRepairs);
  const wrAff  = !full && gs.gold >= wrCost;

  ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('🧱 성벽 보수', 12, wrY+8);
  ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
  ctx.fillText(full ? '성벽이 온전합니다'
                    : `기지 HP +${WALL_REPAIR_AMOUNT} · 보수할수록 비싸집니다 (${gs.wallRepairs}회)`, 12, wrY+26);

  // 기지 HP 바
  const hbX=150, hbW=110;
  ctx.fillStyle='#1e293b'; ctx.fillRect(hbX, wrY+9, hbW, 7);
  const hr = gs.baseHP / baseHpMax();
  ctx.fillStyle = hpColor(hr); ctx.fillRect(hbX, wrY+9, hbW*Math.max(0,Math.min(1,hr)), 7);
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left';
  ctx.fillText(`${Math.ceil(gs.baseHP)}/${baseHpMax()}`, hbX+hbW+6, wrY+9);

  const wbW=112, wbH=28, wbX=CW-12-wbW, wbY=wrY+(wrH-wbH)/2;
  roundRect(ctx,wbX,wbY,wbW,wbH,5);
  ctx.fillStyle = wrAff ? '#14532d' : '#1a1a2e'; ctx.fill();
  ctx.strokeStyle = wrAff ? '#22c55e' : '#334155'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle = wrAff ? '#22c55e' : '#64748b'; ctx.font='bold 10px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(full ? '온전함' : `보수 ${wrCost}💰`, wbX+wbW/2, wbY+wbH/2);
  gs.ui.wallRepairBtn = full ? null : {x:wbX,y:wbY,w:wbW,h:wbH};

  gs.ui.researchBtn = null;   // 병기 연구는 없앴다 — 강화는 건물 안에서 한다

  const stripY = wrY + wrH + 5;
  roundRect(ctx,6,stripY,CW-12,44,6);
  ctx.fillStyle='#0a0d1a'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=1; ctx.stroke();
  const pool=waveDefFor(gs.wave)?.arenaPool||[];
  const totalW=pool.reduce((a,[,w])=>a+w,0)||1;
  ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`웨이브 ${gs.wave+1} 아레나 스폰:`,12,stripY+14);
  pool.forEach(([type,w],i)=>{
    const mt=BATTLE_MOB_TYPES[type]; if (!mt) return;
    const ix=12+i*44;
    ctx.font='15px sans-serif'; ctx.textAlign='left'; ctx.fillStyle='#e2e8f0';
    ctx.fillText(mt.icon,ix,stripY+30);
    ctx.font='bold 8px sans-serif'; ctx.fillStyle='#475569';
    ctx.fillText(`${Math.round(w/totalW*100)}%`,ix+19,stripY+31);
  });
  _townBottom = stripY + 44;
}

// ─── 👑 영웅 상세 (출전준비 › 영웅 정보) ─────────────────────────────────────
// 장비 칸 · 스킬 칸 · 보관함 · 스탯창을 한 화면에 놓는다.
// 무언가를 고르면 스탯창이 "지금 → 바꾼 뒤"를 나란히 보여준다 — 끼워보기 전에 안다.
function heroPickPreview(gs) {
  const pick = gs.town.pick;
  if (!pick) return null;
  const g = heroGear(gs);
  if (pick.kind === 'item') {
    const e = invEntry(gs, pick.uid); if (!e) return null;
    const item = equipDef(e.itemId); if (!item) return null;
    if (isEquipped(gs, pick.uid)) {
      // 이미 낀 것을 고르면 "빼면 어떻게 되는지"를 보여준다
      return heroStatPreview(gs, () => {
        for (const sl of EQUIP_SLOTS) if (g.equipped[sl.id] === pick.uid) g.equipped[sl.id] = null;
      });
    }
    const fits = slotsForItem(item);
    const target = pick.slot && fits.includes(pick.slot) ? pick.slot
                 : (fits.find(sl => g.equipped[sl] == null) || fits[0]);
    return heroStatPreview(gs, () => { g.equipped[target] = pick.uid; });
  }
  if (pick.kind === 'skill') {
    const n = skillSlotCount(gs);
    if (n <= 0) return null;
    if (isSkillEquipped(gs, pick.uid)) {
      return heroStatPreview(gs, () => {
        const i = g.skillSlots.indexOf(pick.uid); if (i >= 0) g.skillSlots[i] = null;
      });
    }
    let t = g.skillSlots.findIndex((v,i) => i < n && v == null);
    if (t < 0) t = 0;
    return heroStatPreview(gs, () => { g.skillSlots[t] = pick.uid; });
  }
  return null;
}

function renderHeroDetail(ctx, gs, startY) {
  const hero = gs.hero, lv = HERO_LEVELS[hero.level];
  const g = heroGear(gs);
  const now = heroStatSnapshot(gs);
  const prev = heroPickPreview(gs);
  let y = startY;

  gs.ui.heroBackBtn = null; gs.ui.equipSlotBtns = []; gs.ui.invCards = [];
  gs.ui.skillSlotBtns = []; gs.ui.skillCards = []; gs.ui.heroPickBtn = null;

  // ── 머리글 ──────────────────────────────────────────────────────────────
  roundRect(ctx,6,y,CW-12,30,6); ctx.fillStyle='#151f2e'; ctx.fill();
  ctx.strokeStyle=COLORS.hero; ctx.lineWidth=1.5; ctx.stroke();
  roundRect(ctx,10,y+5,48,20,4); ctx.fillStyle='#1e293b'; ctx.fill();
  ctx.strokeStyle='#475569'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#94a3b8'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('← 뒤로',34,y+15);
  gs.ui.heroBackBtn = {x:10,y:y+5,w:48,h:20};
  ctx.fillStyle=COLORS.hero; ctx.font='bold 12px sans-serif'; ctx.textAlign='left';
  ctx.fillText(`👑 영웅  Lv.${hero.level}`,68,y+15);
  const _sg = activeSigil();
  ctx.textAlign='right'; ctx.fillStyle=_sg.color; ctx.font='bold 9px sans-serif';
  ctx.fillText(`${_sg.icon} ${_sg.name} · ${_sg.skill.name}`, CW-12, y+15);
  ctx.textAlign='left';
  y += 36;

  // ── 왼쪽: 장비 칸 / 오른쪽: 스탯창 ───────────────────────────────────────
  const colW = 268, rowH = 27, gap = 3;
  const panelX = colW + 14, panelW = CW - panelX - 6;
  const slotsTop = y;

  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('장비 — 칸을 탭하면 해제',6,y);
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif';
  ctx.fillText('스탯',panelX,y);
  y += 12;

  EQUIP_SLOTS.forEach((sl,i)=>{
    const ry = y + i*(rowH+gap);
    const item = equippedItem(gs, sl.id);
    const uid = g.equipped[sl.id];
    const picked = gs.town.pick && gs.town.pick.kind==='item' && gs.town.pick.uid===uid && uid!=null;
    // 고른 물건이 들어갈 수 있는 칸은 테두리로 알려준다
    let fitHint = false;
    if (gs.town.pick && gs.town.pick.kind==='item') {
      const pe = invEntry(gs, gs.town.pick.uid);
      const pd = pe ? equipDef(pe.itemId) : null;
      if (pd && slotsForItem(pd).includes(sl.id)) fitHint = true;
    }
    const gc = item ? (GRADE_COLOR[item.grade]||'#94a3b8') : '#243044';
    roundRect(ctx,6,ry,colW,rowH,4);
    ctx.fillStyle = picked?'#20262e' : item?'#101a28':'#0a0f1a'; ctx.fill();
    ctx.strokeStyle = picked?'#fbbf24' : fitHint?'#22c55e' : gc; ctx.lineWidth = (picked||fitHint)?1.6:1; ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='13px sans-serif'; ctx.globalAlpha=item?1:0.3;
    ctx.fillStyle='#e2e8f0'; ctx.fillText(item?item.icon:sl.icon, 20, ry+rowH/2);
    ctx.globalAlpha=1;
    ctx.textAlign='left';
    ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
    ctx.fillText(sl.name, 34, ry+rowH/2-6);
    if (item) {
      ctx.fillStyle=gc; ctx.font='bold 9px sans-serif';
      ctx.fillText(item.name, 34, ry+rowH/2+5);
      ctx.textAlign='right'; ctx.fillStyle='#7c8ba1'; ctx.font='bold 8px sans-serif';
      ctx.fillText(statsLine(item.stats), colW, ry+rowH/2);
      ctx.textAlign='left';
    } else {
      ctx.fillStyle='#334155'; ctx.font='8px sans-serif';
      ctx.fillText('비어 있음', 34, ry+rowH/2+5);
    }
    gs.ui.equipSlotBtns.push({x:6,y:ry,w:colW,h:rowH,slot:sl.id});
  });
  const slotsBottom = y + EQUIP_SLOTS.length*(rowH+gap);

  // ── 스탯창 ──────────────────────────────────────────────────────────────
  const panelH = EQUIP_SLOTS.length*(rowH+gap) - gap;
  roundRect(ctx,panelX,y,panelW,panelH,5);
  ctx.fillStyle='#0a0f1a'; ctx.fill(); ctx.strokeStyle=prev?'#fbbf24':'#1e293b'; ctx.lineWidth=1; ctx.stroke();
  const srH = panelH / STAT_PANEL_ROWS.length;
  STAT_PANEL_ROWS.forEach((row,i)=>{
    const ry = y + i*srH;
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle='#5b6b80'; ctx.font='bold 8px sans-serif';
    ctx.fillText(row.label, panelX+6, ry+srH/2);
    const a = now[row.key], b = prev ? prev[row.key] : a;
    ctx.textAlign='right';
    if (prev && Math.abs(b-a) > 1e-6) {
      const up = b > a;
      ctx.fillStyle='#64748b'; ctx.font='bold 8px sans-serif';
      ctx.fillText(row.fmt(a), panelX+panelW-46, ry+srH/2);
      ctx.fillStyle=up?'#4ade80':'#f87171'; ctx.font='bold 9px sans-serif';
      ctx.fillText(`${up?'▲':'▼'}${row.fmt(b)}`, panelX+panelW-5, ry+srH/2);
    } else {
      ctx.fillStyle='#cbd5e1'; ctx.font='bold 9px sans-serif';
      ctx.fillText(row.fmt(a), panelX+panelW-5, ry+srH/2);
    }
  });
  ctx.textAlign='left';
  y = slotsBottom + 6;

  // ── 고른 것 처리 버튼 ───────────────────────────────────────────────────
  const pick = gs.town.pick;
  if (pick) {
    let label = '', color = '#22c55e', name = '';
    if (pick.kind === 'item') {
      const e = invEntry(gs, pick.uid), it = e ? equipDef(e.itemId) : null;
      if (it) { name = `${it.icon} ${it.name}`; const on = isEquipped(gs, pick.uid);
                label = on ? '해제' : '장착'; color = on ? '#f87171' : '#22c55e'; }
    } else {
      const e = skillEntry(gs, pick.uid), sd = e ? skillDef(e.skillId) : null;
      if (sd) { name = `${sd.icon} ${sd.name} ${rollStars(e.roll)}`; const on = isSkillEquipped(gs, pick.uid);
                label = on ? '해제' : '장착'; color = on ? '#f87171' : '#22c55e'; }
    }
    if (label) {
      roundRect(ctx,6,y,CW-12,26,5); ctx.fillStyle='#141b26'; ctx.fill();
      ctx.strokeStyle='#fbbf24'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='#e2e8f0'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(name, 12, y+13);
      const bw=62,bh=19,bx=CW-14-bw;
      roundRect(ctx,bx,y+3.5,bw,bh,4); ctx.fillStyle=color; ctx.fill();
      ctx.fillStyle='#07121a'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
      ctx.fillText(label, bx+bw/2, y+13);
      gs.ui.heroPickBtn={x:bx,y:y+3.5,w:bw,h:bh};
      ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
      ctx.fillText('칸을 탭해도 됩니다', bx-8, y+13);
      ctx.textAlign='left';
      y += 32;
    }
  }

  // ── 🔮 스킬 칸 ──────────────────────────────────────────────────────────
  const nSlots = skillSlotCount(gs), nextLv = nextSkillSlotLevel(gs);
  ctx.fillStyle='#f0abfc'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`🔮 스킬 칸 ${nSlots}/${SKILL_SLOT_LEVELS.length}`,6,y);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
  ctx.fillText(nextLv ? `다음 칸 — 영웅 Lv.${nextLv}` : '모든 칸 개방', CW-6, y+1);
  ctx.textAlign='left'; y += 14;
  const skW = (CW-12-3*6)/4, skH = 40;
  for (let i=0;i<SKILL_SLOT_LEVELS.length;i++) {
    const sx = 6 + i*(skW+6);
    const open = i < nSlots;
    const e = open ? skillEquippedAt(gs, i) : null;
    const def = e ? skillDef(e.skillId) : null;
    const gc = def ? (GRADE_COLOR[def.grade]||'#94a3b8') : '#243044';
    roundRect(ctx,sx,y,skW,skH,5);
    ctx.fillStyle = open ? (def?'#140f22':'#0a0f1a') : '#080b12'; ctx.fill();
    ctx.strokeStyle = open ? gc : '#1a2130'; ctx.lineWidth = def?1.5:1; ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='top';
    if (!open) {
      ctx.fillStyle='#334155'; ctx.font='13px sans-serif'; ctx.fillText('🔒',sx+skW/2,y+7);
      ctx.fillStyle='#334155'; ctx.font='bold 8px sans-serif';
      ctx.fillText(`Lv.${SKILL_SLOT_LEVELS[i]}`,sx+skW/2,y+25);
    } else if (def) {
      ctx.fillStyle='#e2e8f0'; ctx.font='15px sans-serif'; ctx.fillText(def.icon,sx+skW/2,y+4);
      ctx.fillStyle=gc; ctx.font='bold 8px sans-serif'; ctx.fillText(def.name,sx+skW/2,y+22);
      ctx.fillStyle='#fbbf24'; ctx.font='bold 7px sans-serif'; ctx.fillText(rollStars(e.roll)||`×${e.roll.toFixed(2)}`,sx+skW/2,y+31);
      gs.ui.skillSlotBtns.push({x:sx,y,w:skW,h:skH,idx:i});
    } else {
      ctx.fillStyle='#334155'; ctx.font='14px sans-serif'; ctx.fillText('＋',sx+skW/2,y+8);
      ctx.fillStyle='#334155'; ctx.font='bold 8px sans-serif'; ctx.fillText('비어 있음',sx+skW/2,y+26);
      gs.ui.skillSlotBtns.push({x:sx,y,w:skW,h:skH,idx:i});
    }
  }
  ctx.textAlign='left';
  y += skH + 10;

  // ── 보유 스킬 ───────────────────────────────────────────────────────────
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif'; ctx.textBaseline='top';
  ctx.fillText(`보유 스킬 ${g.skills.length}개`,6,y); y += 13;
  if (!g.skills.length) {
    roundRect(ctx,6,y,CW-12,26,4); ctx.fillStyle='#0a0f1a'; ctx.fill(); ctx.strokeStyle='#1a2130'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`🏪 영웅 상점 Lv.${SKILL_SHOP_LEVEL}에서 스킬을 살 수 있습니다`,CW/2,y+13);
    ctx.textAlign='left'; y += 32;
  } else {
    const rH = 26;
    g.skills.forEach((e,i)=>{
      const def = skillDef(e.skillId); if (!def) return;
      const ry = y + i*(rH+3);
      const on = isSkillEquipped(gs, e.uid);
      const picked = pick && pick.kind==='skill' && pick.uid===e.uid;
      const gc = GRADE_COLOR[def.grade]||'#94a3b8';
      roundRect(ctx,6,ry,CW-12,rH,4);
      ctx.fillStyle = picked?'#20262e' : on?'#101a12':'#0a0f1a'; ctx.fill();
      ctx.strokeStyle = picked?'#fbbf24' : on?'#22c55e':gc; ctx.lineWidth = picked?1.6:1; ctx.stroke();
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillStyle='#e2e8f0'; ctx.font='13px sans-serif'; ctx.fillText(def.icon,12,ry+rH/2);
      ctx.fillStyle=gc; ctx.font='bold 9px sans-serif';
      ctx.fillText(`${def.name} ${rollStars(e.roll)}`,30,ry+rH/2-5);
      ctx.fillStyle='#7c8ba1'; ctx.font='bold 8px sans-serif';
      ctx.fillText(statsLine(skillStats(e)),30,ry+rH/2+6);
      if (on) { ctx.textAlign='right'; ctx.fillStyle='#22c55e'; ctx.font='bold 8px sans-serif';
                ctx.fillText('장착 중',CW-12,ry+rH/2); ctx.textAlign='left'; }
      gs.ui.skillCards.push({x:6,y:ry,w:CW-12,h:rH,uid:e.uid});
    });
    y += g.skills.length*(rH+3) + 6;
  }

  // ── 보관함 ──────────────────────────────────────────────────────────────
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`🎒 보관함 ${g.inventory.length}개`,6,y);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
  ctx.fillText('탭해서 고르고 → 칸에 장착', CW-6, y+1);
  ctx.textAlign='left'; y += 13;
  if (!g.inventory.length) {
    roundRect(ctx,6,y,CW-12,26,4); ctx.fillStyle='#0a0f1a'; ctx.fill(); ctx.strokeStyle='#1a2130'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🏪 영웅 상점에서 장비를 사면 여기에 쌓입니다',CW/2,y+13);
    ctx.textAlign='left'; y += 30;
  } else {
    const cols=5, cw=(CW-12-(cols-1)*5)/cols, chh=48;
    g.inventory.forEach((e,i)=>{
      const item = equipDef(e.itemId); if (!item) return;
      const col=i%cols, row=Math.floor(i/cols);
      const cx=6+col*(cw+5), cy=y+row*(chh+5);
      const on = isEquipped(gs, e.uid);
      const picked = pick && pick.kind==='item' && pick.uid===e.uid;
      const gc = GRADE_COLOR[item.grade]||'#94a3b8';
      roundRect(ctx,cx,cy,cw,chh,5);
      ctx.fillStyle = picked?'#20262e' : on?'#101a12':'#0c1220'; ctx.fill();
      ctx.strokeStyle = picked?'#fbbf24' : on?'#22c55e':gc; ctx.lineWidth = picked?1.8:1; ctx.stroke();
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillStyle='#e2e8f0'; ctx.font='17px sans-serif'; ctx.fillText(item.icon,cx+cw/2,cy+4);
      ctx.fillStyle=gc; ctx.font='bold 8px sans-serif'; ctx.fillText(item.name,cx+cw/2,cy+25);
      ctx.fillStyle= on?'#22c55e':'#475569'; ctx.font='bold 7px sans-serif';
      ctx.fillText(on?'장착 중':GRADE_NAME[item.grade]||'',cx+cw/2,cy+36);
      gs.ui.invCards.push({x:cx,y:cy,w:cw,h:chh,uid:e.uid});
    });
    y += Math.ceil(g.inventory.length/cols)*(chh+5) + 4;
  }
  ctx.textAlign='left'; ctx.textBaseline='top';
  _townBottom = y + 10;
}

function renderTownPageArmy(ctx, gs, startY) {
  // 영웅 정보를 누르면 같은 탭 안에서 상세 화면으로 갈아탄다
  if (gs.town.heroView) { renderHeroDetail(ctx, gs, startY); return; }
  gs.ui.heroBackBtn = null; gs.ui.equipSlotBtns = []; gs.ui.invCards = [];
  gs.ui.skillSlotBtns = []; gs.ui.skillCards = []; gs.ui.heroPickBtn = null;
  const {battle,hero}=gs;
  const lv=HERO_LEVELS[hero.level];
  const hMax=Math.round((lv.hp+BONUSES.heroHpFlat)*BONUSES.heroStatMult*BONUSES.sigilHeroHpMult);
  let y=startY;

  // ── 영웅 ─────────────────────────────────────────────────────────────────
  roundRect(ctx,6,y,CW-12,58,7);
  ctx.fillStyle='#1a2535'; ctx.fill();
  ctx.strokeStyle=hero.dead?'#7f1d1d':COLORS.hero; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#e2e8f0';
  ctx.font='24px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(hero.dead?'💀':'👑',12,y+6);
  ctx.fillStyle=hero.dead?'#f87171':COLORS.hero; ctx.font='bold 12px sans-serif';
  ctx.fillText(hero.dead?`전사 — ${heroDownLabel(hero)}`:`영웅  Lv.${hero.level}`,44,y+6);
  ctx.fillStyle='#cbd5e1'; ctx.font='bold 10px sans-serif';
  ctx.fillText(`ATK ${Math.round((lv.atk+BONUSES.heroAtk)*BONUSES.heroStatMult*BONUSES.sigilHeroAtkMult)}   HP ${Math.ceil(hero.hp)}/${hMax}   DEF ${Math.round((lv.def+BONUSES.heroAura)*BONUSES.heroStatMult)}`,44,y+22);
  // 지금 걸린 각인 — 캠프에서 바꾼 게 여기 반영됐는지 바로 보이게
  const _sg = activeSigil();
  ctx.textAlign='right'; ctx.fillStyle=_sg.color; ctx.font='bold 9px sans-serif';
  ctx.fillText(`${_sg.icon} ${_sg.name}`, CW-12, y+6);
  ctx.fillStyle='#475569'; ctx.font='8px sans-serif';
  ctx.fillText(_sg.skill.name, CW-12, y+22);
  ctx.textAlign='left';
  const maxed=hero.level>=HERO_MAX_LEVEL;
  const expR=maxed?1:hero.exp/lv.expNeeded;
  ctx.fillStyle='#1e293b'; ctx.fillRect(12,y+42,CW-28,8);
  ctx.fillStyle='#f59e0b'; ctx.fillRect(12,y+42,(CW-28)*Math.min(1,expR),8);
  ctx.fillStyle='#94a3b8'; ctx.font='8px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText(maxed?'MAX LEVEL':`EXP ${Math.floor(hero.exp)}/${lv.expNeeded}`,CW-12,y+46);
  // 카드 전체가 상세 화면으로 가는 문이다 — 장비와 스킬은 여기서 만진다
  gs.ui.heroInfoBtn={x:6,y,w:CW-12,h:58};
  const _gear = heroGear(gs);
  const _eqN  = EQUIP_SLOTS.filter(sl=>_gear.equipped[sl.id]!=null).length;
  const _skN  = skillSlotCount(gs);
  const _skOn = _gear.skillSlots.filter((u,i)=>i<_skN && u!=null).length;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#fbbf24'; ctx.font='bold 8px sans-serif';
  ctx.fillText(`🎒 장비 ${_eqN}/${EQUIP_SLOTS.length}  ·  🔮 스킬 ${_skOn}/${_skN}  ·  탭하여 장착·스킬`, CW/2, y+69);
  ctx.textAlign='left'; ctx.textBaseline='top';
  y+=84;

  // ── 영웅 배치 ────────────────────────────────────────────────────────────
  ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('영웅 배치',6,y); y+=14;
  const btnW2=(CW-20)/2,btnH2=34;
  const pDef=hero.placement==='defense',pBat=hero.placement==='battle';
  drawBtn(ctx,6,y,btnW2,btnH2,pDef?'✅ 상단 방어 배치':'상단 방어 배치',pDef?'#064e3b':'#1e293b',pDef?'#34d399':'#60a5fa',!hero.dead);
  drawBtn(ctx,6+btnW2+8,y,btnW2,btnH2,pBat?'✅ 하단 전투 배치':'하단 전투 배치',pBat?'#4c1d95':'#1e293b',pBat?'#a78bfa':'#f87171',!hero.dead);
  gs.ui.heroDefBtn={x:6,y,w:btnW2,h:btnH2};
  gs.ui.heroBatBtn={x:6+btnW2+8,y,w:btnW2,h:btnH2};
  // 어느 쪽이든 반대쪽 몫도 들어온다 — 고르는 것은 비중이지 포기가 아니다
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillStyle='#64748b'; ctx.font='8px sans-serif';
  ctx.fillText('EXP 많이 · 골드 조금', 6+btnW2/2, y+btnH2+3);
  ctx.fillText('골드 많이 · EXP 조금', 6+btnW2+8+btnW2/2, y+btnH2+3);
  ctx.textAlign='left';
  y+=btnH2+20;

  // ── 병력 고용 (5종, 2열 그리드) ─────────────────────────────────────────
  ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('병력 고용 — 탭하여 편성',6,y); y+=14;
  const cols=3, cardW=(CW-12-(cols-1)*6)/cols, cardH=64;
  gs.ui.hireCards=[];
  const roster = UNIT_ORDER;
  roster.forEach((id,i)=>{
    const ut=UNIT_TYPES[id];
    const col=i%cols, row=Math.floor(i/cols);
    const cx=6+col*(cardW+6), cy2=y+row*(cardH+6);
    const unlocked = ut.special ? true : isUnlocked(id);
    const cost=hireCost(id), canAff=unlocked&&gs.gold>=cost;
    roundRect(ctx,cx,cy2,cardW,cardH,6);
    ctx.fillStyle=canAff?'#1e293b':'#111827'; ctx.fill();
    ctx.strokeStyle=canAff?ut.color:'#374151'; ctx.lineWidth=1.5; ctx.stroke();
    // 잠긴 것도 회색으로 보여준다 — 무엇을 목표로 삼을지 알 수 있도록
    ctx.globalAlpha=unlocked?(canAff?1:0.55):0.32;
    ctx.fillStyle='#e2e8f0'; ctx.font='20px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(ut.icon,cx+cardW/2,cy2+4);
    ctx.fillStyle=canAff?'#f1f5f9':'#64748b'; ctx.font='bold 11px sans-serif';
    ctx.fillText(ut.name,cx+cardW/2,cy2+27);
    ctx.fillStyle='#94a3b8'; ctx.font='bold 8px sans-serif';
    ctx.fillText(`ATK ${Math.round(ut.atk+BONUSES.unitAtk)} · HP ${Math.round((ut.hp+BONUSES.unitHp)*(BONUSES.pactUnitHpMult||1))}`,cx+cardW/2,cy2+40);
    ctx.globalAlpha=1;
    if (unlocked) {
      ctx.globalAlpha=canAff?1:0.55;
      ctx.fillStyle=canAff?COLORS.gold:'#64748b'; ctx.font='bold 10px sans-serif';
      ctx.fillText(`💰${cost}`,cx+cardW/2,cy2+50);
      ctx.globalAlpha=1;
      gs.ui.hireCards.push({x:cx,y:cy2,w:cardW,h:cardH,typeId:id});
    } else {
      ctx.fillStyle='#f59e0b'; ctx.font='bold 9px sans-serif';
      ctx.fillText(`🔒 캠프 💎${unlockCost(id)}`,cx+cardW/2,cy2+50);
    }
  });
  y += Math.ceil(roster.length/cols)*(cardH+6) + 6;

  // ── 🏨 여관 손님 (특수 용병) ─────────────────────────────────────────────
  // 매 웨이브 다시 뽑는다. 상시 고용이면 그냥 비싼 일반 용병일 뿐이라,
  // "이번엔 누가 와 있나"를 열어봐야 알게 했다.
  const innLv   = innLevel(gs);
  const offers  = availableSpecialUnits(gs);
  const spMax   = specialSlotMax();
  const spUsed  = specialHiredCount(battle);
  gs.ui.specialCards=[];

  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#f472b6'; ctx.font='bold 10px sans-serif';
  ctx.fillText('🏨 여관 손님 — 이번 웨이브에만',6,y);
  ctx.textAlign='right'; ctx.fillStyle= spUsed>=spMax ? '#f87171' : '#94a3b8'; ctx.font='bold 9px sans-serif';
  ctx.fillText(innLv<0 ? '여관 미건설' : `전용 슬롯 ${spUsed}/${spMax}`, CW-6, y);
  ctx.textAlign='left';
  y+=14;

  const spH=58;
  if (innLv < 0) {
    roundRect(ctx,6,y,CW-12,spH,6);
    ctx.fillStyle='#0c1220'; ctx.fill(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#64748b'; ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🏨 마을에 여관을 지으면 특수 용병이 찾아옵니다', CW/2, y+spH/2);
    ctx.textAlign='left'; ctx.textBaseline='top';
  } else if (!offers.length) {
    roundRect(ctx,6,y,CW-12,spH,6);
    ctx.fillStyle='#140d18'; ctx.fill(); ctx.strokeStyle='#3f2447'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#6b5b7a'; ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('이번 웨이브에는 아무도 오지 않았습니다', CW/2, y+spH/2-7);
    ctx.fillStyle='#4c3a5a'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`여관 Lv.${innLv+1} · 자리 ${specialSeats(innLv)} · 등장 확률 ${Math.round(specialChance(innLv)*100)}%`, CW/2, y+spH/2+9);
    ctx.textAlign='left'; ctx.textBaseline='top';
  } else {
    const sw=(CW-12-(offers.length-1)*6)/offers.length;
    offers.forEach((id,i)=>{
      const ut=SPECIAL_UNIT_TYPES[id];
      const sx=6+i*(sw+6);
      const cost=hireCost(id);
      const roomy=spUsed<spMax, canAff=roomy&&gs.gold>=cost;
      roundRect(ctx,sx,y,sw,spH,6);
      ctx.fillStyle=canAff?'#241528':'#141018'; ctx.fill();
      ctx.strokeStyle=canAff?ut.color:'#3f2447'; ctx.lineWidth=2; ctx.stroke();
      ctx.globalAlpha=canAff?1:0.5;
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillStyle='#e2e8f0'; ctx.font='19px sans-serif';
      ctx.fillText(ut.icon,sx+sw/2,y+4);
      ctx.fillStyle=ut.color; ctx.font='bold 11px sans-serif';
      ctx.fillText(ut.name,sx+sw/2,y+25);
      ctx.fillStyle='#94a3b8'; ctx.font='bold 8px sans-serif';
      ctx.fillText(`ATK ${Math.round(ut.atk+BONUSES.unitAtk)} · HP ${Math.round((ut.hp+BONUSES.unitHp)*(BONUSES.pactUnitHpMult||1))}`,sx+sw/2,y+38);
      ctx.fillStyle=canAff?COLORS.gold:'#64748b'; ctx.font='bold 10px sans-serif';
      ctx.fillText(roomy?`💰${cost}`:'슬롯 없음',sx+sw/2,y+47);
      ctx.globalAlpha=1;
      ctx.fillStyle=ut.color; ctx.font='bold 8px sans-serif'; ctx.textAlign='left';
      ctx.fillText('★',sx+4,y+3);
      ctx.textAlign='left';
      gs.ui.specialCards.push({x:sx,y:y,w:sw,h:spH,typeId:id});
    });
  }
  y += spH + 6;

  // 편성된 특수 용병 — 전용 슬롯 줄
  gs.ui.specialSlots=[];
  if (innLv >= 0) {
    const sp = battle.ourTeam.filter(u=>!u.isHero && (UNIT_TYPES[u.typeId]||{}).special);
    const ssW=Math.max(44,Math.min(82,Math.floor((CW-12-(spMax-1)*6)/Math.max(1,spMax))));
    const ssH=44;
    for (let i=0;i<spMax;i++) {
      const sx=6+i*(ssW+6), u=sp[i];
      roundRect(ctx,sx,y,ssW,ssH,6);
      ctx.fillStyle=u?'#2a1530':'#0f0a14'; ctx.fill();
      ctx.strokeStyle=u?(u.color||'#f472b6'):'#3f2447'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.textAlign='center'; ctx.textBaseline='middle';
      if (u) {
        ctx.fillStyle='#e2e8f0'; ctx.font='17px sans-serif';
        ctx.fillText(u.icon,sx+ssW/2,y+15);
        drawHPBar(ctx,sx+5,ssH+y-13,ssW-10,4,u.hp/u.maxHp);
        ctx.fillStyle='#ef4444'; ctx.font='bold 9px sans-serif';
        ctx.fillText('✕',sx+ssW-10,y+8);
      } else {
        ctx.fillStyle='#3f2447'; ctx.font='18px sans-serif';
        ctx.fillText('★',sx+ssW/2,y+ssH/2);
      }
      gs.ui.specialSlots.push({x:sx,y:y,w:ssW,h:ssH,idx:i});
    }
    ctx.textAlign='left'; ctx.textBaseline='top';
    y += ssH + 8;
  }

  // ── 편성 슬롯 ────────────────────────────────────────────────────────────
  const hired=battle.ourTeam.filter(u=>!u.isHero && !(UNIT_TYPES[u.typeId]||{}).special);
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

  // ── 💰 현상수배 소환 ─────────────────────────────────────────────────────
  // 준비 화면이 아니라 여기에 둔다 — 전투 준비는 전부 마을에서 끝나야 한다.
  const charges = bountyCharges(gs.wave);
  const left    = Math.max(0, charges - gs.bountyUsed);
  const on      = gs.bountyPending;
  const bh3 = 36;
  roundRect(ctx, 6, y, CW-12, bh3, 7);
  ctx.fillStyle   = on ? '#3b2a08' : left > 0 ? '#141c2e' : '#0e1017'; ctx.fill();
  ctx.strokeStyle = on ? '#fbbf24' : left > 0 ? '#a16207' : '#252b38';
  ctx.lineWidth   = on ? 2 : 1; ctx.stroke();
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillStyle = (left > 0 || on) ? '#fbbf24' : '#475569'; ctx.font='bold 11px sans-serif';
  ctx.fillText(on ? '💰 현상수배 예약됨 — 탭하여 취소' : '💰 현상수배 소환', 14, y+bh3/2-5);
  ctx.font='bold 9px sans-serif';
  if (on) {
    ctx.fillStyle='#fde68a';
    ctx.fillText(`처치 시 💎+${bountyGems(gs.bountyUsed-1)} · 놓치면 성벽에 큰 피해`, 14, y+bh3/2+9);
  } else if (left > 0) {
    ctx.fillStyle='#94a3b8';
    ctx.fillText(`남은 기회 ${left} · 처치 시 💎+${bountyGems(gs.bountyUsed)} · 대형에 강한 타워가 필요합니다`, 14, y+bh3/2+9);
  } else {
    ctx.fillStyle='#475569';
    ctx.fillText('기회를 다 썼습니다 — 더 진행하면 다시 생깁니다', 14, y+bh3/2+9);
  }
  gs.ui.bountyBtn = (left > 0 || on) ? {x:6,y,w:CW-12,h:bh3} : null;
  y += bh3 + 6;

  // ── ⚔️ 하단 정예 소환 ────────────────────────────────────────────────────
  // 상단 현상수배의 짝. 상단은 화력을, 하단은 부대의 정면 승부를 묻는다.
  const eCharges = eliteCharges(gs.wave);
  const eLeft    = Math.max(0, eCharges - (gs.eliteUsed || 0));
  const eOn      = gs.elitePending;
  roundRect(ctx, 6, y, CW-12, bh3, 7);
  ctx.fillStyle   = eOn ? '#2a1f08' : eLeft > 0 ? '#141c2e' : '#0e1017'; ctx.fill();
  ctx.strokeStyle = eOn ? '#fbbf24' : eLeft > 0 ? '#a16207' : '#252b38';
  ctx.lineWidth   = eOn ? 2 : 1; ctx.stroke();
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillStyle = (eLeft > 0 || eOn) ? '#fbbf24' : '#475569'; ctx.font='bold 11px sans-serif';
  ctx.fillText(eOn ? '⚔️ 정예 예약됨 — 탭하여 취소' : '⚔️ 아레나 정예 소환', 14, y+bh3/2-5);
  ctx.font='bold 9px sans-serif';
  if (eOn) {
    ctx.fillStyle='#fde68a';
    ctx.fillText(`처치 시 💎+${eliteGems((gs.eliteUsed||1)-1)} · 부대가 정면으로 이겨야 합니다`, 14, y+bh3/2+9);
  } else if (eLeft > 0) {
    ctx.fillStyle='#94a3b8';
    ctx.fillText(`남은 기회 ${eLeft} · 처치 시 💎+${eliteGems(gs.eliteUsed||0)} · 골드도 크게 떨어집니다`, 14, y+bh3/2+9);
  } else {
    ctx.fillStyle='#475569';
    ctx.fillText('기회를 다 썼습니다 — 더 진행하면 다시 생깁니다', 14, y+bh3/2+9);
  }
  gs.ui.eliteBtn = (eLeft > 0 || eOn) ? {x:6,y,w:CW-12,h:bh3} : null;
  y += bh3 + 8;

  // ── 출전 버튼 ────────────────────────────────────────────────────────────
  // 영웅 배치는 필수다 — 상단이든 하단이든 어딘가에는 서야 한다.
  const hasTeam  = battle.ourTeam.length>0;
  const heroSet  = hero.placement !== 'none' || hero.dead;
  const ready    = hasTeam && heroSet;
  const why = !hasTeam ? '병력을 1명 이상 고용하세요'
            : !heroSet ? '👑 영웅을 상단 또는 하단에 배치하세요'
            : '▶ 출전! 웨이브 시작';
  roundRect(ctx,6,y,CW-12,44,8);
  ctx.fillStyle=ready?'#15803d':'#1f2937'; ctx.fill();
  ctx.strokeStyle=ready?'#22c55e':(!heroSet&&hasTeam?'#f59e0b':'#374151'); ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle=ready?'#fff':(!heroSet&&hasTeam?'#fbbf24':'#6b7280'); ctx.font='bold 15px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(why,6+(CW-12)/2,y+22);
  gs.ui.deployBtn={x:6,y,w:CW-12,h:44};
  y+=52;

  // ── 팀 전투력 요약 ───────────────────────────────────────────────────────
  // 예전에는 "남는 공간"에 맞춰 높이를 CH-y로 잡고, 자리가 없으면 통째로 그리지 않았다.
  // 편성이 늘면 이 상자가 화면 밖으로 밀려 아예 안 보였다 — 이제는 페이지가 스크롤되므로
  // 높이를 내용에 맞춰 고정한다.
  {
    const boxH = 176;
    roundRect(ctx,6,y,CW-12,boxH,7);
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
    const nd=waveDefFor(gs.wave);
    if (nd) {
      ctx.fillStyle='#64748b'; ctx.font='10px sans-serif'; ctx.textAlign='left';
      ctx.fillText('다음 웨이브',18,ry);
      const mobIcons=(nd.arenaPool||[]).map(([t])=>(BATTLE_MOB_TYPES[t]||{}).icon||'').join(' ');
      ctx.fillStyle='#f87171'; ctx.font='11px sans-serif'; ctx.textAlign='right';
      ctx.fillText(mobIcons.slice(0,34),CW-18,ry);
      ry+=18;
    }

    ctx.fillStyle='#3f4a5c'; ctx.font='9px sans-serif'; ctx.textAlign='left';
    ctx.fillText('하단은 실시간 아레나입니다. A로 자동/수동을 전환하세요.',18,ry+2);
    ry+=13;
    ctx.fillText('웨이브를 클리어하면 강화 카드 3장 중 1장을 고릅니다.',18,ry+2);
    _townBottom = y + boxH;
  }
}

function renderTownPageTowers(ctx, gs, startY) {
  // ── 타워 종류 팔레트 ─────────────────────────────────────────────────────
  ctx.fillStyle='#60a5fa'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('타워를 고른 뒤 빈 셀을 탭 (1~5) · S/M/L/A = 등급별 피해 배율', CW/2, startY);

  // 타워 5종 — 한 줄에 안 들어가므로 3열 그리드로. 등급 상성을 카드에 같이 띄운다.
  const pcols = 3, pgap = 5;
  const pw = Math.floor((CW - 8 - (pcols-1)*pgap) / pcols), ph = 62;
  const px0 = 4, py0 = startY + 16;
  gs.ui.towerTypeBtns = [];
  TOWER_ORDER.forEach((id,i) => {
    const tpl=TOWER_TYPES[id];
    const col=i%pcols, row=Math.floor(i/pcols);
    const bx=px0+col*(pw+pgap), by=py0+row*(ph+pgap);
    const cost=towerBuildCost(id, gs.towers);
    const unlocked=isUnlocked(id);
    const sel=gs.selectedTowerType===id;
    const afford=unlocked&&gs.gold>=cost;
    roundRect(ctx,bx,by,pw,ph,6);
    ctx.fillStyle = sel?'#152b45' : afford?'#111c2e':'#0e1017'; ctx.fill();
    ctx.strokeStyle = sel?tpl.color : afford?'#334155':'#252b38';
    ctx.lineWidth = sel?2:1; ctx.stroke();

    ctx.globalAlpha = unlocked?(afford?1:0.55):0.32;
    ctx.fillStyle='#e2e8f0'; ctx.font='15px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(tpl.icon, bx+6, by+5);
    ctx.fillStyle = sel?tpl.color:'#cbd5e1'; ctx.font='bold 11px sans-serif';
    ctx.fillText(tpl.name, bx+26, by+6);

    // 등급 상성 4칸 — 강/약이 한눈에
    const aff = TOWER_AFFINITY[id] || {};
    const cw2 = (pw-12)/4;
    MOB_CLASS_ORDER.forEach((ck,ci) => {
      const cls = MOB_CLASSES[ck];
      const ax = bx+6+ci*cw2, ay = by+23;
      const m  = aff[ck] !== undefined ? aff[ck] : 1;
      const lab = affinityLabel(m);
      ctx.fillStyle='#0b1220'; ctx.fillRect(ax, ay, cw2-2, 15);
      ctx.fillStyle=cls.color; ctx.font='bold 8px sans-serif';
      ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText(cls.tag, ax+3, ay+4);
      ctx.fillStyle=lab.color; ctx.font='bold 8px sans-serif'; ctx.textAlign='right';
      ctx.fillText(m.toFixed(2).replace('0.','.'), ax+cw2-4, ay+4);
    });

    ctx.textAlign='left';
    ctx.fillStyle='#64748b'; ctx.font='8px sans-serif';
    ctx.fillText(tpl.desc.slice(0,12), bx+6, by+42);
    ctx.globalAlpha=1;

    if (unlocked) {
      ctx.globalAlpha = afford?1:0.55;
      ctx.fillStyle = afford?COLORS.gold:'#64748b'; ctx.font='bold 10px sans-serif';
      ctx.textAlign='right';
      ctx.fillText(`${cost}💰`, bx+pw-6, by+42);
      ctx.globalAlpha=1;
      gs.ui.towerTypeBtns.push({x:bx,y:by,w:pw,h:ph,typeId:id});
    } else {
      ctx.fillStyle='#f59e0b'; ctx.font='bold 8px sans-serif'; ctx.textAlign='right';
      ctx.fillText(`🔒💎${unlockCost(id)}`, bx+pw-6, by+42);
    }
  });
  const palRows   = Math.ceil(TOWER_ORDER.length / pcols);
  const palBottom = py0 + palRows*ph + (palRows-1)*pgap;

  // ── 미니 그리드 ──────────────────────────────────────────────────────────
  const scale=0.62;
  const mCW=Math.floor(CELL_W*scale),mCH=Math.floor(CELL_H*scale);
  const gridW=GRID_COLS*mCW,gridH=GRID_ROWS*mCH;
  const offX=Math.floor((CW-gridW)/2),offY=palBottom+10;

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

      // 등급별 실효 피해 — 이 타워가 무엇을 잘 잡는지
      const aff = TOWER_AFFINITY[tower.typeId] || {};
      let ax2 = CW - 14;
      for (let i = MOB_CLASS_ORDER.length - 1; i >= 0; i--) {
        const ck = MOB_CLASS_ORDER[i], cls = MOB_CLASSES[ck];
        const m = aff[ck] !== undefined ? aff[ck] : 1;
        const lab = affinityLabel(m);
        ctx.textAlign='right';
        ctx.fillStyle = lab.color; ctx.font='bold 10px sans-serif';
        ctx.fillText(`${Math.round(st.dmg * m)}`, ax2, panelY+13);
        ctx.fillStyle = cls.color; ctx.font='bold 8px sans-serif';
        ctx.fillText(cls.tag, ax2, panelY+26);
        ax2 -= 30;
      }
      ctx.textAlign='left';

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

  // ── 배치 요약 ────────────────────────────────────────────────────────────
  // 높이를 화면 잔여분(CH-infoY)이 아니라 내용에 맞춰 잡는다 — 페이지가 스크롤되므로
  const infoY=panelY+80;
  const infoH=Math.max(150, 60 + Object.keys(
    gs.towers.reduce((m,t)=>{ m[t.typeId]=1; return m; }, {})).length*20 + 70);
  roundRect(ctx,6,infoY,CW-12,infoH,7);
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
  _townBottom = Math.max(infoY + infoH, ry + 16);
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────
function renderTutorial(ctx, tut) {
  gs.ui.tutSkipBtn = null; gs.ui.tutBackBtn = null;
  if (!tut.active) return;
  const step = tut.current(); if (!step) return;
  const isTip = !!tut.tip;

  ctx.fillStyle='rgba(0,0,0,0.68)'; ctx.fillRect(0,0,CW,CH);
  const lines = step.text.split('\n');
  const cw=340, ch=Math.max(150, 58 + lines.length*17 + 34), cx=(CW-cw)/2, cy=(CH-ch)/2;
  roundRect(ctx,cx,cy,cw,ch,10);
  ctx.fillStyle='#0f172a'; ctx.fill();
  ctx.strokeStyle=isTip?'#22d3ee':'#6366f1'; ctx.lineWidth=2; ctx.stroke();

  // 쪽지는 본 튜토리얼과 구분되게 딱지를 붙인다 — "또 시작인가" 소리를 안 듣게
  if (isTip) {
    ctx.fillStyle='#22d3ee'; ctx.font='bold 8px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText('처음 보는 것 · 한 번만 뜹니다', cx+14, cy+9);
  }
  ctx.fillStyle=isTip?'#67e8f9':'#a5b4fc'; ctx.font='bold 14px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(step.title,CW/2,cy+(isTip?21:13));
  ctx.fillStyle='#e2e8f0'; ctx.font='12px sans-serif';
  lines.forEach((line,i)=>ctx.fillText(line,CW/2,cy+(isTip?44:36)+i*17));

  if (!isTip) {
    for (let i=0;i<TUTORIAL_STEPS.length;i++) {
      ctx.beginPath(); ctx.arc(CW/2-(TUTORIAL_STEPS.length-1)*9+i*18,cy+ch-16,4,0,Math.PI*2);
      ctx.fillStyle=i===tut.step?'#6366f1':'#334155'; ctx.fill();
    }
  }
  ctx.fillStyle='#64748b'; ctx.font='10px sans-serif';
  ctx.textBaseline='bottom';
  ctx.fillText(isTip ? '탭하여 닫기' : '탭하여 계속 ▶', CW/2, cy+ch-3);

  // 이전 / 건너뛰기 — 카드 바깥에 둬서 본문 탭(=다음)과 겹치지 않게 한다.
  // 건너뛰기는 남은 쪽지까지 전부 끈다. 쪽지가 층마다 계속 뜨면
  // 플레이어에겐 튜토리얼이 안 꺼진 것과 같다.
  const bw=104, bh=28, by=cy+ch+12;
  const left = tipsRemaining();
  if (!isTip && tut.step > 0) {
    const bx=cx;
    roundRect(ctx,bx,by,78,bh,6);
    ctx.fillStyle='#111827'; ctx.fill(); ctx.strokeStyle='#334155'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('◀ 이전', bx+39, by+bh/2);
    gs.ui.tutBackBtn={x:bx,y:by,w:78,h:bh};
  }
  const sx=cx+cw-bw;
  roundRect(ctx,sx,by,bw,bh,6);
  ctx.fillStyle='#1c1420'; ctx.fill(); ctx.strokeStyle='#4b5563'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#cbd5e1'; ctx.font='bold 11px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('✕ 안내 전부 끄기', sx+bw/2, by+bh/2-5);
  ctx.fillStyle='#64748b'; ctx.font='8px sans-serif';
  ctx.fillText(left ? `남은 안내 ${left}장까지` : '다시 안 뜹니다', sx+bw/2, by+bh/2+8);
  gs.ui.tutSkipBtn={x:sx,y:by,w:bw,h:bh};

  if (!isTip) {
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`${tut.step+1} / ${TUTORIAL_STEPS.length}`, CW/2, by+bh/2);
  }
  ctx.textAlign='left'; ctx.textBaseline='top';
}

// ─── 타이틀 화면 ─────────────────────────────────────────────────────────────
// ─── 로딩 화면 ───────────────────────────────────────────────────────────────
// 그림이 하나도 없으면 이 화면은 뜨지 않는다 (읽을 것이 없으면 즉시 끝난다).
function renderLoadingScreen(ctx, p) {
  ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, CW, CH);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText('듀얼 프론티어', CW/2, CH/2 - 46);
  const bw = 220, bh = 5, bx = (CW-bw)/2, by = CH/2;
  ctx.fillStyle = '#1e293b'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#6366f1'; ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, p)), bh);
  ctx.fillStyle = '#64748b'; ctx.font = 'bold 10px sans-serif';
  ctx.fillText(`그림 불러오는 중 ${Math.round(p*100)}%`, CW/2, by + 22);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
}

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
  const bw=220, bh=52, bx=(CW-bw)/2, by=CH-150;
  roundRect(ctx, bx, by, bw, bh, 26);
  const btnGrad = ctx.createLinearGradient(bx, by, bx, by+bh);
  btnGrad.addColorStop(0, '#6366f1');
  btnGrad.addColorStop(1, '#4f46e5');
  ctx.fillStyle = btnGrad; ctx.fill();
  ctx.strokeStyle = '#a5b4fc'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('▶  게임 시작', CW/2, by + bh/2);
  gs.ui.titleStartBtn = {x:bx, y:by, w:bw, h:bh};

  // ── 리셋 버튼 ──────────────────────────────────────────────────────────
  // 되돌릴 수 없는 조작이라 두 번 눌러야 실행된다. 한 번 누르면 경고로 바뀌고,
  // 5초 안에 다시 누르지 않으면 저절로 풀린다.
  const rw=160, rh=34, rx=(CW-rw)/2, ry=by+bh+12;
  const arming = _resetArmed && (Date.now() - _resetArmedAt < 5000);
  if (!arming) _resetArmed = false;
  roundRect(ctx, rx, ry, rw, rh, 17);
  ctx.fillStyle = arming ? 'rgba(127,29,29,0.92)' : 'rgba(15,23,42,0.72)'; ctx.fill();
  ctx.strokeStyle = arming ? '#ef4444' : 'rgba(148,163,184,0.45)'; ctx.lineWidth = arming ? 2 : 1; ctx.stroke();
  ctx.fillStyle = arming ? '#fecaca' : 'rgba(226,232,240,0.72)';
  ctx.font = arming ? 'bold 12px sans-serif' : '12px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(arming ? '⚠ 정말 초기화합니다 — 다시 탭' : '↺ 데이터 초기화', CW/2, ry + rh/2);
  gs.ui.titleResetBtn = {x:rx, y:ry, w:rw, h:rh};

  // 탭 안내
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.font = '10px sans-serif'; ctx.textBaseline = 'bottom';
  ctx.fillText(arming ? '다른 곳을 탭하면 취소됩니다' : '화면을 탭하여 시작', CW/2, CH - 30);

  // 버전 — 눈에 띄게
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = 'bold 11px monospace'; ctx.textBaseline = 'bottom';
  ctx.fillText(GAME_VERSION, CW/2, CH - 12);

  ctx.restore();
}
