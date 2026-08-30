'use strict';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hpColor(r) {
  return r > 0.6 ? COLORS.hpGreen : r > 0.3 ? COLORS.hpYellow : COLORS.hpRed;
}
// ─── 🖼 9슬라이스 패널 ───────────────────────────────────────────────────────
// Cryo's Mini GUI의 24×24 판을 8px 모서리 기준으로 늘린다.
// 모서리는 그대로 두고 변과 가운데만 늘려야 테두리 장식이 안 뭉개진다.
// 그림이 없으면 false를 돌려주고, 부르는 쪽이 예전 roundRect로 물러난다.
const PANEL9_CORNER = 8;
function drawPanel9(ctx, key, x, y, w, h) {
  const k = Sprites.pick(key); if (!k) return false;
  const sz = Sprites.size(k);  if (!sz) return false;
  const c = PANEL9_CORNER;
  if (w < c*2 || h < c*2) return false;      // 너무 작으면 모서리끼리 겹친다
  const sw = sz.w, sh = sz.h, sc = c;
  const px = [x, x+c, x+w-c], pw = [c, w-2*c, c];
  const sx = [0, sc, sw-sc],  ssw = [sc, sw-2*sc, sc];
  const py = [y, y+c, y+h-c], ph = [c, h-2*c, c];
  const sy = [0, sc, sh-sc],  ssh = [sc, sh-2*sc, sc];
  for (let r = 0; r < 3; r++)
    for (let q = 0; q < 3; q++)
      Sprites.blitRect(ctx, k, sx[q], sy[r], ssw[q], ssh[r], px[q], py[r], pw[q], ph[r]);
  return true;
}
// ─── ◎ 사거리 미리보기 ───────────────────────────────────────────────────────
// 미니 그리드는 실제 격자를 mg.cellW/CELL_W 만큼 줄여 그린 것이다.
// 사거리도 같은 비율로 줄여야 "이 칸에서 저기까지 닿는다"가 눈으로 맞는다.
function drawMiniRange(ctx, mg, col, row, rangePx, color, planned) {
  if (!mg) return;
  const k  = mg.cellW / CELL_W;
  const cx = mg.x + col*mg.cellW + mg.cellW/2;
  const cy = mg.y + row*mg.cellH + mg.cellH/2;
  const rr = rangePx * k;
  ctx.save();
  // 격자 밖으로 새어 나가지 않게 자른다 — 저격탑(5칸)은 원이 팔레트까지 덮는다
  ctx.beginPath();
  ctx.rect(mg.x - 1, mg.y - 1, GRID_COLS*mg.cellW + 2, GRID_ROWS*mg.cellH + 2);
  ctx.clip();
  ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2);
  ctx.fillStyle = planned ? 'rgba(125,211,252,0.13)' : 'rgba(99,102,241,0.10)';
  ctx.fill();
  ctx.strokeStyle = color; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.5;
  if (planned) ctx.setLineDash([4,3]);
  ctx.stroke(); ctx.setLineDash([]);
  // 놓을 자리를 십자로 집어 준다 — 원만 있으면 중심이 어디인지 헷갈린다
  ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx-5, cy); ctx.lineTo(cx+5, cy);
  ctx.moveTo(cx, cy-5); ctx.lineTo(cx, cy+5);
  ctx.stroke();
  ctx.restore();
}
// 아직 안 세운 타워의 사거리 — 지금 강화까지 반영해서 미리 보여준다
function plannedTowerRange(typeId) {
  const t = makeTower(0, 0, typeId);
  return towerStats(t).range;
}

// ─── 🖼 패널 ────────────────────────────────────────────────────────────────
// 이 게임의 패널은 전부 roundRect + 채움 + 테두리 한 덩어리였다(121곳).
// 그걸 이 함수 하나로 모아, 큰 것만 팩의 9슬라이스 틀을 두르게 한다.
//
// 크기로 가르는 이유: 팩 틀에는 모서리 장식이 있어서, 작은 배지·칩까지 두르면
// 한 화면에 장식이 쉰 개씩 깔려 도리어 지저분해진다.
// 큰 담는 것은 틀을, 작은 것은 지금처럼 매끈한 둥근 사각형을.
//
// 그리고 원래 색은 버리지 않는다 — 채움은 50%로 틀 위에 얹고, 테두리색은
// 안쪽에 가늘게 남긴다. 섹션마다 다른 강조색(보라·파랑·초록)이 이 게임의
// 정보 구조라서, 틀로 갈아치우면 그 구조가 통째로 사라진다.
const UI_PANEL_MIN_W = 60, UI_PANEL_MIN_H = 30;
function uiPanel(ctx, x, y, w, h, r, fill, stroke, lw) {
  if (w >= UI_PANEL_MIN_W && h >= UI_PANEL_MIN_H &&
      drawPanel9(ctx, 'ui.panel.dark', x, y, w, h)) {
    ctx.save();
    roundRect(ctx, x+3, y+3, w-6, h-6, Math.max(0, r-2)); ctx.clip();
    ctx.globalAlpha = 0.5; ctx.fillStyle = fill;
    ctx.fillRect(x+3, y+3, w-6, h-6);
    ctx.restore();
    roundRect(ctx, x+2, y+2, w-4, h-4, Math.max(0, r-1));
    ctx.strokeStyle = stroke; ctx.lineWidth = Math.min(1.2, lw || 1); ctx.stroke();
    return;
  }
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke();
}

// 막대 채움 — 가로로만 늘린다 (원본이 가로 줄무늬라 세로로 늘려도 무늬가 안 깨진다)
function drawBarSprite(ctx, key, x, y, w, h) {
  const k = Sprites.pick(key); if (!k || w <= 0) return false;
  return Sprites.draw(ctx, k, x, y, w, h);
}

function drawHPBar(ctx, x, y, w, h, ratio) {
  const f = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = '#1e293b'; ctx.fillRect(x,y,w,h);
  // 색으로 위급함을 알리던 규칙은 그대로 두고, 칠만 팩 그림으로 바꾼다
  const key = f > 0.5 ? 'ui.bar.green' : f > 0.25 ? 'ui.bar.orange' : 'ui.bar.red';
  if (!drawBarSprite(ctx, key, x, y, w*f, h)) {
    ctx.fillStyle = hpColor(f);
    ctx.fillRect(x, y, Math.max(0, w*f), h);
  }
}
function drawMPBar(ctx, x, y, w, h, ratio) {
  const f = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = '#1e293b'; ctx.fillRect(x,y,w,h);
  if (!drawBarSprite(ctx, 'ui.bar.blue', x, y, w*f, h)) {
    ctx.fillStyle = COLORS.mp;
    ctx.fillRect(x, y, Math.max(0, w*f), h);
  }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}
// 폭에 맞춰 줄을 나눈다. 한국어는 띄어쓰기가 드물어 띄어쓰기로만 자르면
// 한 줄이 통째로 넘치므로, 어절이 칸보다 길면 글자 단위로 다시 자른다.
// ctx.font을 먼저 정해두고 부를 것 — 폭 계산이 그 글꼴로 이뤄진다.
// 큰 수를 한 줄에 넣는다 — 마왕 체력은 9자리라 콤마 표기로는 막대를 넘친다
function compactNum(n) {
  const v = Math.max(0, Math.ceil(n || 0));
  if (v >= 1e8) return `${(v/1e8).toFixed(v >= 1e9 ? 0 : 1)}억`;
  if (v >= 1e4) return `${(v/1e4).toFixed(v >= 1e5 ? 0 : 1)}만`;
  return `${v}`;
}

function wrapLines(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if (!word) continue;
    const cand = line ? line + ' ' + word : word;
    if (ctx.measureText(cand).width <= maxW) { line = cand; continue; }
    if (line) { out.push(line); line = ''; }
    if (ctx.measureText(word).width <= maxW) { line = word; continue; }
    let chunk = '';
    for (const ch of word) {
      if (ctx.measureText(chunk + ch).width > maxW && chunk) { out.push(chunk); chunk = ''; }
      chunk += ch;
    }
    line = chunk;
  }
  if (line) out.push(line);
  return out;
}

function drawBtn(ctx, x, y, w, h, label, bg, fg, on) {
  const live = on !== false;
  // 팩의 9슬라이스 틀을 깔고 그 위에 원래 색을 옅게 얹는다.
  // 색을 통째로 그림에 넘기면 초록=준비 / 빨강=위험 같은 신호가 사라진다 —
  // 틀은 팩에서, 뜻은 색에서 가져오는 것이 요점이다.
  const framed = drawPanel9(ctx, live ? 'ui.panel.dark' : 'ui.panel.navy', x, y, w, h);
  if (framed) {
    ctx.save();
    roundRect(ctx, x+2, y+2, w-4, h-4, 4); ctx.clip();
    ctx.globalAlpha = live ? 0.42 : 0.20;
    ctx.fillStyle = live ? bg : '#374151'; ctx.fillRect(x+2, y+2, w-4, h-4);
    ctx.restore();
  } else {
    uiPanel(ctx, x, y, w, h, 5, live ? bg : '#374151', live ? fg : '#4b5563', 1.5);
  }
  ctx.fillStyle = live ? fg : '#6b7280';
  ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label, x+w/2, y+h/2);
}

// ─── Defense Zone ─────────────────────────────────────────────────────────────
// 이 칸에 깔 타일. 길은 잔디, 빈 칸은 밭이다 —
// 밭 사이로 난 잔디 길을 군대가 걸어 내려온다.
//
// 밭은 20종을 칸마다 바꿔 깐다. 한 종류로 63칸을 채우면 격자가 그대로 드러난다.
// 칸 좌표로 정하므로 매 프레임 같은 타일이 나온다 (깜빡이지 않는다).
let _fieldCount = -1;
function fieldTileKey(c, r) {
  if (_fieldCount < 0) { let n = 0; while (Sprites.has(`tile.field.${n}`)) n++; _fieldCount = n; }
  if (!_fieldCount) return Sprites.pick('tile.ground');
  const h = (c * 73856093) ^ (r * 19349663);
  return `tile.field.${(h >>> 0) % _fieldCount}`;
}
function tileSpriteKey(c, r, isPath, isStart, isEnd, isCross) {
  if (isStart) return Sprites.pick('tile.start', 'tile.path');
  if (isEnd)   return Sprites.pick('tile.path');            // 성은 타일 위에 따로 세운다
  if (isPath)  return Sprites.pick('tile.path');
  return fieldTileKey(c, r);
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
      // 🏰 기지 — 길 타일 위에 성을 올린다. 깃발이 4프레임으로 나부낀다.
      let baseDrawn = false;
      if (isEnd && Sprites.has('tile.base')) {
        const sz = 50, hh = 38 * (sz / 52);
        baseDrawn = Sprites.frame(ctx, 'tile.base', Sprites.frameAt('tile.base', Date.now()/1000, 0),
                                  x + (CELL_W - sz)/2, y + CELL_H - hh - 9, sz, hh);
      }
      // 시작·기지 글자는 그림이 있어도 남긴다 — 어디로 들어와 어디를 지키는지가 규칙이라서
      if (isStart) labelCell(ctx,'시작',x,y,'#93c5fd');
      if (isEnd && !baseDrawn) labelCell(ctx,'🏰마을',x,y,'#fca5a5');

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

  drawPathFlow(ctx, THE_PATH, 'rgba(120,40,30,0.22)');

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

  // 기지 셀 - idle 상태에서 마을 입장 힌트.
  // 성 그림이 생긴 뒤로는 칸을 덮지 않고 테두리로만 알린다 — 덮으면 성이 안 보인다.
  if (wm && wm.phase==='idle') {
    const bx2=GRID_OX+4*CELL_W+1, by2=GRID_OY+6*CELL_H+1;
    const pulse = 0.35 + 0.25*Math.sin(Date.now()/420);
    if (Sprites.has('tile.base')) {
      ctx.strokeStyle=`rgba(165,180,252,${pulse})`; ctx.lineWidth=2;
      ctx.strokeRect(bx2,by2,CELL_W-2,CELL_H-2);
      ctx.fillStyle=`rgba(199,210,254,${0.55+pulse*0.45})`; ctx.font='bold 8px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.shadowColor='#0b1020'; ctx.shadowBlur=3;
      ctx.fillText('🏰 마을', GRID_OX+4*CELL_W+CELL_W/2, by2+2);
      ctx.shadowBlur=0;
    } else {
      ctx.fillStyle='rgba(99,102,241,0.35)'; ctx.fillRect(bx2,by2,CELL_W-2,CELL_H-2);
      ctx.fillStyle='#a5b4fc'; ctx.font='bold 9px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🏰',GRID_OX+4*CELL_W+CELL_W/2,GRID_OY+6*CELL_H+CELL_H/2-5);
      ctx.fillText('마을',GRID_OX+4*CELL_W+CELL_W/2,GRID_OY+6*CELL_H+CELL_H/2+7);
    }
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

  // 🏰 최후 저지선 — 성채가 쏠 수 있으면 그 사거리를 옅게 보여준다
  if (castleAtk() > 0) {
    const bc = cellCenter(4, 6);
    ctx.beginPath(); ctx.arc(bc.x, bc.y, castleRange(), 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(250,204,21,0.20)'; ctx.lineWidth = 1;
    ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
  }

  // ☠️ 독 장판 — 타워 아래에 깔린다. 남은 시간만큼 옅어진다.
  for (const q of (gs.poisonPools || [])) {
    const fade = Math.min(1, q.life / Math.max(0.001, q.maxLife));
    const grad = ctx.createRadialGradient(q.x, q.y, q.r * 0.15, q.x, q.y, q.r);
    grad.addColorStop(0, `rgba(132,204,22,${0.52 * fade})`);
    grad.addColorStop(1, `rgba(101,163,13,${0.10 * fade})`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = `rgba(163,230,53,${0.6 * fade})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI*2); ctx.stroke();
    // 보글보글 — 장판이 살아 있다는 표시
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    for (let k = 0; k < 3; k++) {
      const ph = (t0 * 0.9 + k * 0.37 + (q.x + q.y) * 0.01) % 1;
      const ang = (k * 2.1 + (q.x % 7)) * 1.3;
      const rr = q.r * (0.25 + 0.55 * ph);
      ctx.fillStyle = `rgba(190,242,100,${(1 - ph) * 0.5 * fade})`;
      ctx.beginPath();
      ctx.arc(q.x + Math.cos(ang) * rr, q.y + Math.sin(ang) * rr, 2.2 * (1 - ph * 0.5), 0, Math.PI*2);
      ctx.fill();
    }
  }

  for (const t of gs.towers) renderTower(ctx, t);
  for (const p of gs.projectiles) {
    // 그림이 있으면 날아가는 방향으로 돌려 그린다. 없으면 예전처럼 색 점.
    const pk = p.towerTypeId && Sprites.pick(`proj.${p.towerTypeId}`);
    const ps = pk && Sprites.size(pk);
    if (ps && p.target) {
      const ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
      // 원본은 오른쪽을 보고 있지 않은 것도 있어 세로로 긴 것은 90도 돌려 맞춘다
      if (ps.h > ps.w) ctx.rotate(Math.PI/2);
      const k = 1.7;
      Sprites.draw(ctx, pk, -ps.w*k/2, -ps.h*k/2, ps.w*k, ps.h*k);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2);
      ctx.fillStyle=p.color; ctx.fill();
    }
  }
  for (const e of gs.defenseEnemies) {
    if (enemyActive(e)) renderDefEnemy(ctx, e);
  }

  // 🐗 성문으로 달려드는 무리 — 막을 수 없다는 것이 보이도록 붉게 두른다
  for (const c of gs.chargers || []) {
    if (c.dead || c.delay > 0) continue;
    const pulse = 0.45 + 0.35 * Math.sin(Date.now() / 110 + c.x);
    ctx.beginPath(); ctx.arc(c.x, c.y, c.radius + 5, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(239,68,68,${pulse})`; ctx.lineWidth = 2; ctx.stroke();
    const drew = drawMobActor(ctx, c, c.y, true);
    if (!drew) {
      ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI*2);
      ctx.fillStyle = '#ef4444'; ctx.fill();
      ctx.strokeStyle = '#fecaca'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.fillStyle = '#fca5a5'; ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
    ctx.fillText(`-${c.dmg}`, c.x, c.y - c.radius - 4);
    ctx.shadowBlur = 0;
  }

  // 영웅 (상단 배치 시)
  if (gs.hero.placement === 'defense') {
    renderHeroInDefense(ctx, gs.hero);
  }

  // 기지 HP
  const bx=8, by=DEFENSE_Y+DEFENSE_H-14;
  // 최대치는 강화로 늘어난다 — 상수 100을 그대로 쓰면 200/100 같은 표시가 나온다
  const bMax = baseHpMax();
  ctx.fillStyle='#0f172a'; ctx.fillRect(bx-1,by-1,181,10);
  drawHPBar(ctx,bx,by,180,8,gs.baseHP/bMax);
  ctx.fillStyle=COLORS.text; ctx.font='10px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`기지 HP ${Math.ceil(gs.baseHP)}/${bMax}`, bx+184, by+4);

  // 👹 마왕 — 한 마리가 곧 이 층이므로 체력이 크게 보여야 한다.
  // 일반 적의 머리 위 막대로는 "얼마나 남았나"가 안 읽힌다.
  const _boss = (gs.defenseEnemies || []).find(e => e.isBoss && !e.dead && !e.reached);
  if (_boss) {
    const bw3 = CW - 40, bx3 = 20, by3 = DEFENSE_Y + 8, bh3 = 14;
    roundRect(ctx, bx3, by3, bw3, bh3, 4);
    ctx.fillStyle='rgba(8,4,6,0.86)'; ctx.fill();
    const fr = Math.max(0, _boss.hp / Math.max(1, _boss.maxHp));
    ctx.save(); ctx.beginPath(); roundRect(ctx, bx3, by3, bw3*fr, bh3, 4); ctx.clip();
    const gr = ctx.createLinearGradient(bx3, 0, bx3+bw3, 0);
    gr.addColorStop(0, '#7f1d1d'); gr.addColorStop(1, '#ef4444');
    ctx.fillStyle = gr; ctx.fillRect(bx3, by3, bw3, bh3); ctx.restore();
    // 페이즈 경계 — 여기를 넘길 때마다 호위가 온다
    ctx.strokeStyle='rgba(251,191,36,0.55)'; ctx.lineWidth=1;
    for (let i = 1; i < BOSS_PHASES; i++) {
      const px = bx3 + bw3 * (i / BOSS_PHASES);
      ctx.beginPath(); ctx.moveTo(px, by3); ctx.lineTo(px, by3+bh3); ctx.stroke();
    }
    ctx.strokeStyle='#dc2626'; ctx.lineWidth=1.5;
    roundRect(ctx, bx3, by3, bw3, bh3, 4); ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`👹 마왕   ${compactNum(_boss.hp)} / ${compactNum(_boss.maxHp)}   ${Math.ceil(fr*100)}%`,
                 bx3+bw3/2, by3+bh3/2);
    ctx.textAlign='left'; ctx.textBaseline='middle';
  }

  // ⚡ 과부하 — 쓸 수 있는지 어딘가에는 보여야 한다.
  // 예전에는 타워를 눌러 봐야 "재사용까지 N초"를 알았다 — 쓸 수 있는 줄 모르면 없는 기능이다.
  if (wm && wm.phase === 'active' && !BONUSES.pactNoOverload) {
    const ow = 74, oh = 15, ox = CW - ow - 8, oy = by - 3;
    const cd = gs.overloadReady || 0;
    const full = OVERLOAD_COOLDOWN * fev('overloadCdMult', 1) * (BONUSES.overloadCdMult || 1);
    const ready = cd <= 0;
    roundRect(ctx, ox, oy, ow, oh, 4);
    ctx.fillStyle = '#0b1220'; ctx.fill();
    if (!ready && full > 0) {   // 남은 쿨다운을 채워 가는 막대로
      ctx.save(); ctx.beginPath();
      roundRect(ctx, ox, oy, ow * (1 - cd / full), oh, 4); ctx.clip();
      ctx.fillStyle = '#3b1d6e'; ctx.fillRect(ox, oy, ow, oh); ctx.restore();
    }
    ctx.strokeStyle = ready ? '#fbbf24' : '#334155'; ctx.lineWidth = ready ? 1.5 : 1; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = ready ? '#fbbf24' : '#94a3b8';
    ctx.fillText(ready ? '⚡ 과부하 준비' : `⚡ ${Math.ceil(cd)}s`, ox + ow/2, oy + oh/2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  }

  // 🧱 성벽 결계 — 걸려 있는 동안은 기지가 무적이다. 그 사실이 보여야 한다.
  if ((gs.baseWardUntil || 0) > 0) {
    const bc = cellCenter(4, 6);
    ctx.beginPath(); ctx.arc(bc.x, bc.y, CELL_W * 0.85, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(56,189,248,0.75)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(56,189,248,0.12)'; ctx.fill();
    ctx.fillStyle = '#7dd3fc'; ctx.font='bold 9px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`🧱 ${gs.baseWardUntil.toFixed(1)}s`, bc.x, bc.y - CELL_W*0.85 - 7);
    ctx.textAlign='left';
  }

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
        uiPanel(ctx, ax,ay2,aw,ah,4, '#0f172a', '#475569', 1.5);
        ctx.textAlign='center'; ctx.textBaseline='middle';
        const rbr = towerBranchOf(tower);
        ctx.fillStyle= st.sealed ? '#ef4444' : '#cbd5e1'; ctx.font='bold 8px sans-serif';
        ctx.fillText(st.sealed ? `Lv.${lv} · 🔒침묵` : `Lv.${lv} · ⚔${st.dmg} · ◎${Math.round(st.range)}`,
                     ax+aw/2, ay2+ah/2-4);
        if (rbr) { ctx.fillStyle=rbr.color; ctx.font='bold 7px sans-serif';
                   ctx.fillText(`${rbr.icon} ${rbr.name}`, ax+aw/2, ay2+ah/2+7); }
        else { ctx.fillStyle='#475569'; ctx.font='bold 7px sans-serif';
               ctx.fillText('강화·철거는 🏰마을에서', ax+aw/2, ay2+ah/2+7); }
        gs.ui.towerUpgradeBtn=null; gs.ui.towerRemoveBtn=null;
        return;
      }
      uiPanel(ctx, ax,ay2,aw,ah,4, '#0f172a', '#f59e0b', 1.5);
      ctx.fillStyle='#f59e0b'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`Lv.${lv}/${towerLevelCap()}`,ax+18,ay2+ah/2);
      if (lv<3) {
        uiPanel(ctx, ax+26,ay2+2,42,ah-4,3, '#1e3a5f', '#60a5fa', 1);
        ctx.fillStyle='#60a5fa'; ctx.font='7px sans-serif'; ctx.fillText(`강화 ${lv*15}💰`,ax+47,ay2+ah/2);
        gs.ui.towerUpgradeBtn={x:ax+26,y:ay2+2,w:42,h:ah-4};
      } else { gs.ui.towerUpgradeBtn=null; }
      uiPanel(ctx, ax+72,ay2+2,24,ah-4,3, '#3f1515', '#ef4444', 1);
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

// 타워 그림 — 원본 비율 그대로 세운다. 픽셀 아트라 정수배에 가깝게 키워야 선이 깨지지 않는다.
// 원본이 16~18 × 23~35px이므로 2배면 32~36 × 46~70 — 칸(53×50) 위로 적당히 솟는다.
const TOWER_ART_SCALE = 2.2;

// ─── 👷 석대 + 점유자 ────────────────────────────────────────────────────────
// 타워를 **구조물**과 **사람** 두 겹으로 가른다.
// 통짜 그림 한 장이면 조합이 그림 수만큼이지만, 두 겹으로 가르면 곱셈이 된다:
//   석대 3티어 × 점유자 26종 = 78가지를 그림 29장으로.
// ★5 분기 18갈래에 각각 다른 얼굴을 주려면 통짜로는 18장을 새로 그려야 한다.
//
// 예전에는 타워 그림 한 장(16~18×23~35px)이 '건물 + 그 위의 사람'을 통째로 담고 있었다.
// 그래서 레벨이 올라도 그림이 하나뿐이라 ★1과 ★10이 똑같이 보였다
// (매니페스트에 tower.*.2 / .3이 아예 없어 towerSpriteKey가 늘 .1로 떨어졌다).
//
//   ★1~2  1단 석대
//   ★3~4  2단 석대 + 총안
//   ★5~   3단 석대 + ★5 분기 깃발
const PEDESTAL_TIER = lv => (lv >= 5 ? 2 : lv >= 3 ? 1 : 0);

// 분기 색에 가장 가까운 깃발을 고른다 — 깃발은 넷뿐이고 분기는 열여덟이다
function bannerKeyFor(hex) {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  const cands = { red:[220,60,60], blue:[70,130,220], green:[80,200,110], yellow:[230,190,60] };
  let best = 'red', bd = Infinity;
  for (const k in cands) {
    const c = cands[k];
    const d = (r-c[0])**2 + (g-c[1])**2 + (b-c[2])**2;
    if (d < bd) { bd = d; best = k; }
  }
  return Sprites.pick(`keep.banner.${best}`);
}

// 석대 — 0x72 석재 타일을 쌓아 올린다. 사람이 설 자리(y)를 돌려준다.
// 타일이 아직 안 실렸으면 예전 도형 방식으로 물러난다.
function drawTowerKeep(ctx, x, groundY, tier, tintColor) {
  const wallK = Sprites.pick('keep.wall');
  const T = 13;                                 // 타일 한 장을 이만큼으로 그린다
  const cols = 2, rows = 1 + tier;              // ★1~2:1줄 ★3~4:2줄 ★5~:3줄
  const w = cols * T, h = rows * T;
  const top = groundY - h;

  if (!wallK) {                                  // ── 폴백: 도형 ──
    ctx.fillStyle = '#657392';
    ctx.fillRect(x - w/2, top, w, h);
    ctx.fillStyle = '#2a2f4e'; ctx.fillRect(x - w/2, top, w, 1);
    return top;
  }

  // 몸통 — 벽돌을 격자로 채운다
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      Sprites.draw(ctx, wallK, x - w/2 + c*T, top + r*T, T, T);

  // 출입구 — 맨 아랫줄 가운데. '건물'로 읽히게 하는 것은 결국 문이다.
  const doorK = Sprites.pick('keep.door');
  if (doorK && rows >= 1) {
    const dw = T * 0.9, dh = T * 0.95;
    Sprites.draw(ctx, doorK, x - dw/2, groundY - dh, dw, dh);
  }
  // 총안 — 2줄 이상이면 가운뎃줄에 구멍 하나
  const holeK = Sprites.pick('keep.hole');
  if (holeK && rows >= 2) Sprites.draw(ctx, holeK, x - T*0.35, top + T*0.35, T*0.7, T*0.7);

  // 처마 — 왼끝/가운데/오른끝. 사람은 이 위에 선다.
  const tl = Sprites.pick('keep.top.l'), tm = Sprites.pick('keep.top.m'), tr = Sprites.pick('keep.top.r');
  const eaveH = T, eaveY = top - T * 0.72;
  if (tl && tm && tr) {
    Sprites.draw(ctx, tl, x - w/2 - T*0.30, eaveY, T, eaveH);
    for (let c = 1; c < cols - 1; c++) Sprites.draw(ctx, tm, x - w/2 + c*T, eaveY, T, eaveH);
    Sprites.draw(ctx, tr, x + w/2 - T*0.70, eaveY, T, eaveH);
  }

  // ★5 — 분기 깃발을 몸통에 건다
  if (tier >= 2) {
    const bk = bannerKeyFor(tintColor);
    if (bk) Sprites.draw(ctx, bk, x - T*0.5, top + T*0.15, T, T);
  }
  return top - T * 0.06;                         // 처마 윗면 = 발판
}

function renderTower(ctx, t) {
  const {x,y}=cellCenter(t.col,t.row);
  const tpl=TOWER_TYPES[t.typeId];
  const kick=t.muzzle>0?1.5:0;
  const key = towerSpriteKey(t.typeId, t.level);
  const ksz = key && Sprites.size(key);
  const br0 = towerBranchOf(t);
  // 점유자 — ★5 분기를 골랐으면 그 분기 전용 얼굴, 아니면 종류 기본값.
  // 두 겹으로 가른 값어치가 여기서 나온다: 18갈래에 18명이 붙는데 석대는 그대로다.
  // 넷씩 돌린다 — 칸마다 위상을 어긋나게 해서 마흔 기가 한 박자로 흔들리지 않게.
  const cf = (Math.floor(Date.now() / 160) + t.col * 3 + t.row * 5) % 4;
  const crewKey = Sprites.pick(
    br0 ? `crew.${br0.id}.${cf}` : `crew.${t.typeId}.${cf}`,
    br0 ? `crew.${br0.id}.0`     : `crew.${t.typeId}.0`,
    `crew.${t.typeId}.${cf}`, `crew.${t.typeId}.0`);
  if (crewKey) {
    // 👷 석대 + 사람
    const groundY = y + CELL_H/2 - 2;
    const tier = PEDESTAL_TIER(t.level || 1);
    ctx.beginPath(); ctx.ellipse(x, groundY-1, 17, 3.6, 0, 0, Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fill();
    const standY = drawTowerKeep(ctx, x, groundY, tier, br0 && br0.color);
    const cs = Sprites.size(crewKey);
    const ck = 30 / cs.w;                        // 32px 프레임을 칸에 맞춘다
    Sprites.drawFoot(ctx, crewKey, x, standY + 1 + (kick ? -1 : 0), cs.w*ck, cs.h*ck);
  } else if (ksz) {
    // 점유자 그림이 아직 안 실렸을 때만 — 옛 통짜 타워 그림으로 물러난다
    const groundY = y + CELL_H/2 - 2;
    const k = TOWER_ART_SCALE * (1 + kick*0.03);   // 발사 반동
    const bw = ksz.w * k;
    ctx.beginPath(); ctx.ellipse(x, groundY-2, bw*0.42, 3.4, 0, 0, Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fill();
    Sprites.drawFoot(ctx, key, x, groundY, bw, ksz.h*k);
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
  // ★5 분기 — 어느 갈래로 갔는지 칸에서 바로 보여야 한다.
  // 배치를 짤 때 "여기 대공이 있었나"를 패널을 열어 봐야 안다면 표시가 아니다.
  const br = br0;
  if (br) {
    const bx = x + CELL_W/2 - 8, by = y - CELL_H/2 + 7;
    ctx.beginPath(); ctx.arc(bx, by, 6.5, 0, Math.PI*2);
    ctx.fillStyle='rgba(8,12,20,0.85)'; ctx.fill();
    ctx.strokeStyle=br.color; ctx.lineWidth=1.2; ctx.stroke();
    ctx.font='8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(br.icon, bx, by+0.5);
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
  // 👹 마왕 — 붉은 파문 두 겹. 100층의 유일한 적이니 한눈에 달라 보여야 한다.
  if (e.isBoss) {
    const t0 = (Date.now()%1400)/1400;
    for (let k=0;k<2;k++) {
      const t = (t0 + k*0.5) % 1;
      ctx.beginPath(); ctx.arc(e.x, ey, e.radius + 4 + t*22, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(220,38,38,${0.7*(1-t)})`; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(e.x, ey, e.radius + 3, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(127,29,29,0.45)'; ctx.fill();
  }

  // 현상수배는 금색 링으로 즉시 눈에 띄게
  if (e.isBounty) {
    const t = (Date.now()%900)/900;
    ctx.beginPath(); ctx.arc(e.x, ey, e.radius + 5 + t*5, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(251,191,36,${0.85-t*0.7})`; ctx.lineWidth = 2.5; ctx.stroke();
  }

  // 👹 마왕은 전용 그림을 쓴다 — 배우 넷을 색만 바꿔 돌려 쓰는 다른 몹과 달리
  // 100층에 한 번 나오는 것이라 "저게 그거구나"가 즉시 읽혀야 한다.
  let drew = false;
  if (e.isBoss) {
    const fr = Math.floor(Date.now() / 140) % 4;
    const key = Sprites.pick(`mob.demon.run.${fr}`, `mob.demon.idle.${fr}`, 'mob.demon.idle.0');
    const sz  = key && Sprites.size(key);
    if (sz) {
      const k = (e.radius * 2.1) / sz.w;
      Sprites.drawFoot(ctx, key, e.x, ey + e.radius * 0.9, sz.w * k, sz.h * k);
      drew = true;
    }
  }
  if (!drew) drew = drawMobActor(ctx, e, ey, false);
  if (!drew) {
  ctx.beginPath(); ctx.arc(e.x,ey,e.radius,0,Math.PI*2);
  ctx.fillStyle = e.hitFlash>0 ? '#ffffff' : (slowed ? '#7dd3fc' : ENEMY_TYPES[e.typeId].color);
  ctx.fill();
  ctx.strokeStyle = e.isBounty ? '#fbbf24' : e.flying ? '#e9d5ff' : (e.armor||0)>0 ? '#cbd5e1' : '#fff';
  ctx.lineWidth = (e.isBounty || (e.armor||0)>0) ? 2 : 1;
  ctx.stroke();
  }

  // 그림을 쓰면 몸이 원보다 위로 솟으므로 표시들도 그만큼 올린다
  const top = drew ? mobArtTop(e, ey, false) : ey - e.radius;

  drawHPBar(ctx, e.x-e.radius, top-6, e.radius*2, 4, e.hp/e.maxHp);

  // 등급 태그 — 어떤 타워로 잡아야 하는지 한 글자로
  const cls = MOB_CLASSES[e.cls || 'medium'];
  if (cls && e.radius >= 8) {
    ctx.fillStyle = drew ? '#f1f5f9' : '#0f172a';
    ctx.font = `bold ${Math.round(Math.max(8, e.radius*(drew?0.62:0.95)))}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if (drew) { ctx.shadowColor='#000'; ctx.shadowBlur=3; }
    ctx.fillText(cls.tag, e.x, drew ? top-13 : ey+0.5);
    ctx.shadowBlur=0;
  }
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
  uiPanel(ctx, bx,y,bw,bh,10, '#14532d', '#22c55e', 2);
  ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif';
  ctx.fillText('▶ 계속하기', CW/2, y+bh/2);
  gs.ui.pauseResumeBtn = {x:bx,y:y,w:bw,h:bh};
  y += bh + 14;

  // 포기 — 되돌릴 수 없으니 두 번 눌러야 한다
  uiPanel(ctx, bx,y,bw,bh,10, _giveUpArmed ? '#7f1d1d' : '#1f2937', _giveUpArmed ? '#ef4444' : '#475569', _giveUpArmed ? 2 : 1);
  ctx.fillStyle = _giveUpArmed ? '#fecaca' : '#94a3b8'; ctx.font='bold 14px sans-serif';
  ctx.fillText(_giveUpArmed ? '⚠ 정말 포기합니다 — 다시 탭' : '🏳 포기하고 정산', CW/2, y+bh/2-7);
  ctx.fillStyle = _giveUpArmed ? '#f87171' : '#475569'; ctx.font='bold 9px sans-serif';
  const gaveUpGems = Math.max(0, Math.round(calcSoulStones(gs) * GIVE_UP_GEM_MULT));
  ctx.fillText(gaveUpGems > 0
    ? `정산 💎${gaveUpGems}  —  끝까지 버티면 ${Math.round((1-GIVE_UP_GEM_MULT)*100)}% 더`
    : '정산 💎0  —  한 층이라도 넘어야 보석이 남습니다', CW/2, y+bh/2+11);
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

  // 준비 화면의 버튼 좌표는 준비 화면에서만 살아 있어야 한다.
  // gs.ui는 그리면서 채워지고 페이지가 바뀔 때만 비워지는데, 준비 화면 → 전투는
  // 페이지가 그대로 'battle'이라 아무도 지우지 않았다. 그래서 전투 중에
  // 예전 [🏰마을] 자리(아레나 위)를 누르면 마을로 튕겨 나갔다.
  // 매 프레임 비우고, 준비 화면일 때만 renderBriefing이 다시 등록한다.
  gs.ui.briefTownBtn = null; gs.ui.battleWaveStartBtn = null;

  if (wm.phase==='idle') {
    // 준비 화면은 층 정보가 늘면 아래가 잘린다 (층 이벤트 · 변형 · 이월 · 경로 변경…).
    // 마을 탭과 같은 방식으로 스크롤한다 — 렌더러에 스크롤이 반영된 기준선을 넘겨
    // 그림과 버튼 좌표가 함께 움직이게 한다.
    // ⏸·배속·🔊는 준비 화면에서도 떠 있어야 한다. 예전에는 브리핑 위에 그냥 얹혀서
    // 그 자리에 있던 "최고 N층 / 💎되짚는 층" 글자를 가렸다 — 오른쪽 118px을 비워 두는
    // 방식으로는 버튼(142px)을 못 피한다. 아예 전용 띠를 잡고 본문을 그만큼 내린다.
    const bodyTop = BATTLE_Y + BRIEF_CTRL_H;
    const bodyH   = BATTLE_H - BRIEF_CTRL_H;
    const scroll = gs.briefScroll || 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, bodyTop, CW, bodyH); ctx.clip();
    _briefBottom = bodyTop;
    renderBriefing(ctx, gs, bodyTop - scroll);
    ctx.restore();

    const contentH  = (_briefBottom + scroll) - bodyTop + 8;
    const maxScroll = Math.max(0, contentH - bodyH);
    gs.briefScroll = Math.max(0, Math.min(maxScroll, scroll));
    gs.ui.briefScroll = maxScroll > 0 ? {x:0,y:bodyTop,w:CW,h:bodyH,max:maxScroll} : null;
    if (maxScroll > 0) drawScrollHint(ctx, bodyTop, bodyH, gs.briefScroll, maxScroll);
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
  const bw=44, bh=32, gap=5;
  const by = fighting ? (ARENA_Y + ARENA_H + 4) : (BATTLE_Y + (BRIEF_CTRL_H - bh) / 2);
  const x3=CW-6-bw, x2=x3-bw-gap, x1=x2-bw-gap;

  // 버튼 뒤는 항상 불투명하게 깐다 — 준비 화면에서는 이 띠가 본문 위쪽 경계가 된다
  if (fighting) { ctx.fillStyle='#080e18'; ctx.fillRect(0, ARENA_Y+ARENA_H, CW, ARENA_CTRL_H); }
  else if (wm.phase==='idle') {
    ctx.fillStyle='#080e18'; ctx.fillRect(0, BATTLE_Y, CW, BRIEF_CTRL_H);
    ctx.strokeStyle='#1e293b'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0, BATTLE_Y+BRIEF_CTRL_H-0.5); ctx.lineTo(CW, BATTLE_Y+BRIEF_CTRL_H-0.5); ctx.stroke();
    // 띠 왼쪽은 비니까 층 표시를 여기로 옮겨 준다 — 스크롤해도 늘 보이는 자리
    const st = getStageInfo(gs.wave);
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle = st.endless ? '#c4b5fd' : '#a5b4fc'; ctx.font='bold 12px sans-serif';
    ctx.fillText(st.endless ? `∞ ${st.tier}층` : `훈련 ${st.stageLabel}`, 10, BATTLE_Y + BRIEF_CTRL_H/2);
    if (st.endless) {
      const fresh = st.tier > (gs.runBestAtStart || 0);
      ctx.fillStyle = fresh ? '#4ade80' : '#8a6a33'; ctx.font='bold 9px sans-serif';
      ctx.fillText(fresh ? '★ 신기록 구간 · 💎 제값' : `되짚는 층 · 💎 ×${ENDLESS_REPEAT_MULT}`,
                   72, BATTLE_Y + BRIEF_CTRL_H/2);
    }
    ctx.textAlign='left'; ctx.textBaseline='top';
  }

  drawBtn(ctx,x1,by,bw,bh,_paused?'▶':'⏸','#111c2e','#a5b4fc',true);
  drawBtn(ctx,x2,by,bw,bh,`x${gameSpeed()}`,gameSpeed()>1?'#3b1d6e':'#111c2e',gameSpeed()>1?'#c4b5fd':'#94a3b8',true);
  drawBtn(ctx,x3,by,bw,bh,SFX.isMuted()?'🔇':'🔊','#111c2e','#94a3b8',true);
  gs.ui.ctrlPause={x:x1,y:by,w:bw,h:bh};
  gs.ui.ctrlSpeed={x:x2,y:by,w:bw,h:bh};
  gs.ui.ctrlMute ={x:x3,y:by,w:bw,h:bh};

  if (fighting && gs.battle.phase==='fighting') {
    // ⚙ 자동/수동 · 🛡 후퇴
    const manual = gs.arena.mode==='manual';
    const mw=92, mx=6;
    drawBtn(ctx,mx,by,mw,bh, manual?'⚙ 수동':'⚙ 자동',
            manual?'#4c1d95':'#111c2e', manual?'#ddd6fe':'#94a3b8', true, 10);
    gs.ui.modeBtn={x:mx,y:by,w:mw,h:bh};

    // 후퇴 비용을 버튼에 직접 띄운다 — 누르기 전에 값을 알아야 판단이 된다
    const cost = retreatCost(wm.timer);
    const rw=104, rx=mx+mw+7;
    drawBtn(ctx,rx,by,rw,bh, cost>0?`🛡 후퇴 -${cost}HP`:'🛡 후퇴',
            cost>=14?'#4c1020':'#1e3a4f', cost>=14?'#fca5a5':'#7dd3fc', true, 10);
    gs.ui.retreatBtn={x:rx,y:by,w:rw,h:bh};
  } else {
    gs.ui.modeBtn=null;
    gs.ui.retreatBtn=null;
  }

  if (fighting) renderHeroActiveBar(ctx, gs, by, bh);
  else { gs.ui.heroActiveBtns=null; gs.ui.heroAutoBtn=null; }
}

// ─── ⚡ 영웅 액티브 바 ────────────────────────────────────────────────────────
// MP 막대 + 자동/수동 토글 + 스킬 버튼. 컨트롤 줄 바로 위에 얹는다.
// 자동이면 버튼은 상태 표시로만 남고(눌러도 그만), 수동이면 눌러서 쓴다.
function renderHeroActiveBar(ctx, gs, ctrlY, ctrlH) {
  gs.ui.heroActiveBtns = []; gs.ui.heroAutoBtn = null;
  const acts = equippedActives(gs);
  const h = gs.hero;
  if (!h || h.placement === 'none') return;
  const slots = activeSlotCount(gs);
  if (!slots) return;                       // 아직 칸이 안 열렸다

  const y = ctrlY - 30, bh = 26;
  // MP 막대 — 액티브의 연료다. 액티브가 없으면 그릴 이유도 없다.
  const mw = 84, mx = 6;
  const mp = Math.floor(h.mp || 0), mmax = heroMaxMp();
  roundRect(ctx, mx, y, mw, bh, 5);
  ctx.fillStyle='#0b1220'; ctx.fill();
  ctx.save(); ctx.beginPath(); roundRect(ctx, mx, y, mw * Math.min(1, mp/Math.max(1,mmax)), bh, 5); ctx.clip();
  ctx.fillStyle='#1e3a8a'; ctx.fillRect(mx, y, mw, bh); ctx.restore();
  ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1; ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#93c5fd'; ctx.font='bold 10px sans-serif';
  ctx.fillText(`💧 ${mp}/${mmax}`, mx+mw/2, y+bh/2);

  // 자동 / 수동
  const aw = 62, ax = mx + mw + 6, auto = h.skillAuto !== false;
  uiPanel(ctx, ax, y, aw, bh, 5, auto ? '#14342a' : '#3a1d0a', auto ? '#22c55e' : '#f59e0b', 1.5);
  ctx.fillStyle = auto ? '#86efac' : '#fbbf24'; ctx.font='bold 10px sans-serif';
  ctx.fillText(auto ? '🤖 자동' : '👆 수동', ax+aw/2, y+bh/2);
  gs.ui.heroAutoBtn = { x:ax, y, w:aw, h:bh };

  // 스킬 버튼 — 칸 수만큼. 빈 칸도 그려서 "여기에 낄 수 있다"를 남긴다.
  const sw = 62, gap = 6;
  let sx = ax + aw + 8;
  for (let i = 0; i < slots; i++) {
    const a = acts.find(x => x.idx === i);
    roundRect(ctx, sx, y, sw, bh, 5);
    if (!a) {
      ctx.fillStyle='#0b1220'; ctx.fill(); ctx.strokeStyle='#233046'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='#334155'; ctx.font='bold 9px sans-serif';
      ctx.fillText('빈 칸', sx+sw/2, y+bh/2);
    } else {
      const d = a.def, cd = activeCdLeft(gs, d.id), ready = activeReady(gs, d.id);
      const lackMp = (h.mp || 0) < d.mp;
      ctx.fillStyle = ready ? '#2d1b69' : '#0b1220'; ctx.fill();
      if (cd > 0) {   // 쿨다운이 차오르는 것을 막대로
        ctx.save(); ctx.beginPath();
        const fullCd = Math.max(0.001, d.cd * (BONUSES.heroSkillCdMult || 1));
        roundRect(ctx, sx, y, sw * (1 - cd / fullCd), bh, 5); ctx.clip();
        ctx.fillStyle='#1e1b4b'; ctx.fillRect(sx, y, sw, bh); ctx.restore();
      }
      ctx.strokeStyle = ready ? '#a78bfa' : '#233046'; ctx.lineWidth = ready ? 1.5 : 1; ctx.stroke();
      ctx.fillStyle = ready ? '#ddd6fe' : '#64748b'; ctx.font='13px sans-serif';
      ctx.fillText(d.icon, sx+sw/2, y+bh/2-4);
      ctx.font='bold 8px sans-serif';
      ctx.fillStyle = cd > 0 ? '#818cf8' : lackMp ? '#3b82f6' : ready ? '#c4b5fd' : '#475569';
      ctx.fillText(cd > 0 ? `${Math.ceil(cd)}s` : lackMp ? `💧${d.mp}` : d.name, sx+sw/2, y+bh/2+8);
      gs.ui.heroActiveBtns.push({ x:sx, y, w:sw, h:bh, id:d.id });
    }
    sx += sw + gap;
  }
  ctx.textAlign='left'; ctx.textBaseline='top';
}

// ─── 출전 브리핑 (웨이브 대기 화면) ──────────────────────────────────────────
function renderBriefing(ctx, gs, top) {
  const TOP = (top === undefined) ? BATTLE_Y : top;
  ctx.fillStyle='#0c1421'; ctx.fillRect(0,BATTLE_Y,CW,BATTLE_H);   // 배경은 화면 고정

  const st  = getStageInfo(gs.wave);
  const def = waveDefFor(gs.wave) || { arenaPool:[], defenseEnemies:[] };

  // 층 이름은 위쪽 고정 띠가 이미 들고 있다. 여기서는 관문 표시와 수치만 적는다.
  ctx.textAlign='left'; ctx.textBaseline='top';
  const gate = st.endless && st.isBossStage;
  if (gate) {
    ctx.fillStyle = '#fbbf24'; ctx.font='bold 13px sans-serif';
    ctx.fillText(`🏁 ${st.tier}층 — 관문`, 10, TOP+7);
  }
  ctx.fillStyle='#475569'; ctx.font='bold 10px sans-serif';
  const _gemStep = st.endless ? endlessGemStepFor(st.tier, gs.runBestAtStart) : 0;
  ctx.fillText(st.endless ? `적 HP ×${endlessStatMult(gs.wave).toFixed(1)} · 이동 ×${endlessSpdMult(gs.wave).toFixed(2)} · 이 층 보석 +${_gemStep.toFixed(2)}`
                          : `훈련 스테이지 ${st.stageLabel} · 웨이브 ${st.waveInStage+1}/3${st.isBossStage?'  ★보스':''}`,
               10, gate ? TOP+26 : TOP+8);

  // 최고 기록 — 지금 어디쯤인지가 무한의 유일한 좌표다.
  // 신기록/되짚기 표시는 위쪽 고정 띠로 옮겼다. 여기는 기록 숫자만 남긴다.
  if (st.endless) {
    const best  = gs.stats.bestEndless || 0;
    const fresh = st.tier > (gs.runBestAtStart || 0);   // 처음 닿는 깊이인가
    const rx = CW - 12;
    ctx.textAlign='right'; ctx.fillStyle = fresh ? '#22c55e' : '#334155';
    ctx.font='bold 10px sans-serif';
    ctx.fillText(`최고 ${best}층`, rx, gate ? TOP+26 : TOP+8);
    ctx.textAlign='left';
  }

  let y = TOP + (gate ? 44 : 24);

  // ── 경로 변경 안내 ───────────────────────────────────────────────────────
  const pc = gs.pathChanged;
  if (pc && pc.wave === gs.wave) {
    const ph2 = 26;
    uiPanel(ctx, 6, y, CW-12, ph2, 6, 'rgba(8,47,73,0.55)', '#0891b2', 1);
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
    uiPanel(ctx, 6, y, CW-12, nh, 6, 'rgba(8,47,73,0.35)', '#155e75', 1);
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
    uiPanel(ctx, 6, y, CW-12, eh, 6, 'rgba(49,10,84,0.48)', '#a855f7', 1.5);
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
    uiPanel(ctx, 6, y, CW-12, eh, 6, tone.bg, tone.bd, 1.5);
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
    uiPanel(ctx, 6, y, CW-12, ah, 6, gate ? 'rgba(120,53,15,0.35)' : 'rgba(76,29,149,0.30)', gate ? '#f59e0b' : '#7c3aed', 1);
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
    uiPanel(ctx, 6, y, CW-12, ch, 6, 'rgba(120,53,15,0.40)', '#f59e0b', 1);
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
  uiPanel(ctx, 6,y,CW-12,panelH,7, '#0a1019', '#3f1d1d', 1);
  ctx.fillStyle='#f87171'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('⚔️ 아레나 — 60초 내내 리젠 · 갈수록 촘촘하고 강해집니다', 12, y+7);

  const pool = def.arenaPool || [];
  const total = pool.reduce((a,[,w])=>a+w, 0) || 1;
  const pw = Math.floor((CW-24 - (pool.length-1)*5) / Math.max(1,pool.length));
  pool.forEach(([id,w],i) => {
    const t = BATTLE_MOB_TYPES[id]; if (!t) return;
    const px = 12 + i*(pw+5);
    uiPanel(ctx, px,y+22,pw,44,4, '#140c0c', '#5b2121', 1);
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
  uiPanel(ctx, 6,y,CW-12,dh,7, '#0a1019', '#1e3a5f', 1);
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
  uiPanel(ctx, 6,y,CW-12,mh,7, '#0a1019', '#1e3a2f', 1);
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
  ctx.fillText(`🗿 케이브 Lv.${caveLevelOf(gs)}`, CW-14, y+36);

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
  uiPanel(ctx, 20,y,bw2,bh2,9, ready ? '#14532d' : '#1f2937', ready ? '#22c55e' : (!heroSet && hasTeam ? '#f59e0b' : '#374151'), 2);
  ctx.fillStyle = ready ? '#fff' : (!heroSet && hasTeam ? '#fbbf24' : '#6b7280');
  ctx.font = ready ? 'bold 17px sans-serif' : 'bold 13px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label, 20+bw2/2, y+bh2/2);
  gs.ui.battleWaveStartBtn = ready ? {x:20,y:y,w:bw2,h:bh2} : null;

  const tbx = 20+bw2+10, tbw = CW-tbx-20;
  uiPanel(ctx, tbx,y,tbw,bh2,9, '#1e293b', '#475569', 1.5);
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
// 아레나 바닥 타일 — 상단 밭 타일을 32px 격자로 깔고 어둡게 덮는다
const ARENA_TILE = 40;
let _arenaFloor = null;
// 바닥은 변하지 않는다. 매 프레임 108장을 다시 깔 이유가 없어서 한 번 구워 둔다.
function arenaFloorCanvas() {
  if (_arenaFloor !== null) return _arenaFloor;
  if (!Sprites.has('tile.field.0')) return (_arenaFloor = false);
  const c = document.createElement('canvas');
  c.width = ARENA_W * 2; c.height = ARENA_H * 2;      // 화면이 DPR 2로 그려지므로 두 배로 굽는다
  const x = c.getContext('2d');
  x.scale(2, 2);
  for (let ty = 0; ty * ARENA_TILE < ARENA_H; ty++) {
    for (let tx = 0; tx * ARENA_TILE < ARENA_W; tx++) {
      Sprites.draw(x, fieldTileKey(tx + 11, ty + 7),
                   tx*ARENA_TILE, ty*ARENA_TILE, ARENA_TILE, ARENA_TILE);
    }
  }
  // 밤 장막 — 이 정도로 눌러야 체력바와 아이콘이 읽힌다
  x.fillStyle = 'rgba(8,16,28,0.70)';
  x.fillRect(0, 0, ARENA_W, ARENA_H);
  return (_arenaFloor = c);
}
function drawArenaFloor(ctx) {
  const c = arenaFloorCanvas();
  if (!c) return false;
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, c.width, c.height, ARENA_X, ARENA_Y, ARENA_W, ARENA_H);
  ctx.imageSmoothingEnabled = sm;
  return true;
}

function renderArenaTerrain(ctx, a) {
  const ter = a.terrain;
  if (!ter || !ter.length) return;
  for (const t of ter) {
    const d = TERRAIN_DEFS[t.kind] || TERRAIN_DEFS.rock;
    uiPanel(ctx, t.x, t.y, t.w, t.h, 5, d.fill, d.edge, 1.5);

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

  // 아레나 바닥 — 상단과 같은 밭 타일을 깔되 어둡게 덮는다.
  // 같은 세계인데 아래쪽만 검은 판이면 두 전선이 딴 게임처럼 보인다.
  // 그렇다고 밝게 두면 개체와 UI가 안 읽히므로, 밤처럼 눌러 둔다.
  ctx.fillStyle = '#0b1622';
  ctx.fillRect(ARENA_X, ARENA_Y, ARENA_W, ARENA_H);
  const floorTiled = drawArenaFloor(ctx);

  if (!floorTiled) {
    // 격자 (위치감) — 타일을 깔면 무늬가 그 몫을 한다
    ctx.strokeStyle = 'rgba(148,163,184,0.055)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = ARENA_X + 40; gx < ARENA_X + ARENA_W; gx += 40) { ctx.moveTo(gx, ARENA_Y); ctx.lineTo(gx, ARENA_Y+ARENA_H); }
    for (let gy = ARENA_Y + 40; gy < ARENA_Y + ARENA_H; gy += 40) { ctx.moveTo(ARENA_X, gy); ctx.lineTo(ARENA_X+ARENA_W, gy); }
    ctx.stroke();
  }

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
      uiPanel(ctx, bx, ARENA_Y + 4, 46, 16, 4, 'rgba(10,14,26,0.82)', d.color || '#94a3b8', 1);
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
  for (const u of b.ourTeam) {
    if (u.dead) continue;
    // 🗡️ 은신 중인 도적은 반투명하게 — 사라진 게 보여야 은신이 은신으로 읽힌다
    const hid = (u.stealthLeft || 0) > 0;
    if (hid) ctx.globalAlpha = 0.34;
    renderArenaEntity(ctx, u, 1);
    if (hid) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(192,132,252,0.55)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.arc(u.x, u.y, u.radius + 4, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

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

  renderSurge(ctx, gs);
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
  // ⛏️갱도 심화로 산 몹 강화분도 같이 보여야 한다 — 내가 올린 값이 어디에 붙었는지
  const scalePct = Math.round((aBase * (1 + (b.killCount||0) * KILL_SCALE)
                               * (1 + (BONUSES.mobStatMult||0)) - 1) * 100);
  ctx.fillStyle='#7c3aed'; ctx.fillText(`🗿${caveLevelOf(gs)} 몹+${scalePct}%`, 116, cy);

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

// ─── 몬스터 그림 ─────────────────────────────────────────────────────────────
// 상단과 아레나가 같은 배우를 쓴다. 몸 반지름에 맞춰 크기를 잡고,
// 진행 방향을 보고 옆/앞/뒤 그림을 고른다.
// 48px 프레임 안에서 캐릭터는 22px 남짓만 차지한다. 몸이 충돌원만 하게 보이려면
// 프레임을 그 두 배 넘게 키워야 한다 — 2r × 48/22 ≈ 4.4r.
const MOB_ART_MULT = 4.3;

function mobArtHeight(e, arena) {
  const def = mobActorDef(e.typeId, arena);
  return def ? e.radius * MOB_ART_MULT * (def.h || 1) : 0;
}
// 그림의 머리 꼭대기 y — 체력바와 등급 표시를 여기 위에 얹는다.
// 프레임은 48px이지만 캐릭터는 그 안에서 절반도 안 차지해서, 프레임 위쪽을 쓰면 허공에 뜬다.
function mobArtTop(e, drawY, arena) {
  const def = mobActorDef(e.typeId, arena); if (!def) return drawY - e.radius;
  return drawY + e.radius - Sprites.actorHeadUp(def.actor, mobArtHeight(e, arena));
}
function drawMobActor(ctx, e, drawY, arena) {
  const def = mobActorDef(e.typeId, arena);
  if (!def) return false;
  const f = spriteFacing(e);
  const h = e.radius * MOB_ART_MULT * (def.h || 1);
  const opts = { flip: f.flip, phase: (e.id || 0) * 0.7 };
  // 맞은 순간은 하얗게 튄다 — 원으로 그릴 때의 hitFlash를 그림에서도 살린다
  if (e.hitFlash > 0)      { opts.tint = '#ffffff'; opts.tintAmt = 1; }
  else if (e.slowTimer > 0){ opts.tint = '#8fd6ff'; opts.tintAmt = 0.75; }
  else if (def.tint)       { opts.tint = def.tint; }
  const anim = 'Walk';
  const ok = Sprites.actor(ctx, def.actor, anim, f.dir, Date.now()/1000, e.x, drawY + e.radius, h, opts);
  return ok;
}

// 아레나 개체 그림 키 — 영웅은 각인별로, 나머지는 타입 아이디로 찾는다.
//   unit.swordsman.0~3 · hero.blade.0~3 · mob.goblin.0~3
// 넷씩 돌린다. 한 장으로 두면 실시간 아레나에서 죽은 것처럼 보인다.
// 개체마다 위상을 어긋나게 해서 스무 마리가 한 박자로 움직이는 것을 막는다.
const ARENA_ANIM_FPS = 8;
function arenaSpriteKey(e) {
  const f = (Math.floor(Date.now() / (1000 / ARENA_ANIM_FPS)) + (e.id || 0)) % 4;
  if (e.isHero) {
    const sg = e.sigil || DEFAULT_SIGIL;
    return Sprites.pick(`hero.${sg}.${f}`, `hero.${sg}.0`, `hero.blade.0`);
  }
  if (e.isPlayer) return Sprites.pick(`unit.${e.typeId}.${f}`, `unit.${e.typeId}.0`);
  return Sprites.pick(`mob.${e.typeId}.${f}`, `mob.${e.typeId}.0`);
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
  // 그림마다 비율이 다르다 (16×16 고블린 ~ 32×36 오우거 ~ 32×32 용병).
  // 가로·세로에 각각 고정 배수를 곱하면 정사각 그림은 늘어나고 세로긴 그림은 눌린다.
  // 가로를 기준으로 잡고 세로는 원본 비율을 따라가게 한다.
  let drewArt = false;
  if (skey) {
    const sz = Sprites.size(skey);
    const w  = r * ARENA_ART_W_MULT;
    const h  = sz ? w * (sz.h / sz.w) : r * ARENA_ART_H_MULT;
    drewArt = Sprites.drawFoot(ctx, skey, e.x, e.y + r, w, h);
  } else if (!e.isPlayer) {
    drewArt = drawMobActor(ctx, e, e.y, true);
  }
  if (!drewArt) {
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

// 🌊 쇄도 경고 — 2초 전에 알린다. 예고 없이 쏟아지면 사고지 설계가 아니다.
function renderSurge(ctx, gs) {
  const a = gs.arena; if (!a) return;
  if (a.surgeWarn > 0) {
    const p = 1 - (a.surgeWarn / SURGE_WARN);
    const pulse = 0.35 + 0.35 * Math.abs(Math.sin(Date.now() / 130));
    ctx.save();
    ctx.strokeStyle = `rgba(249,115,22,${pulse})`; ctx.lineWidth = 4;
    ctx.strokeRect(ARENA_X+2, ARENA_Y+2, ARENA_W-4, ARENA_H-4);
    ctx.fillStyle = `rgba(249,115,22,${0.10 + p*0.10})`;
    ctx.fillRect(ARENA_X, ARENA_Y, ARENA_W, ARENA_H);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = '#fdba74'; ctx.font='bold 17px sans-serif';
    ctx.shadowColor='#000'; ctx.shadowBlur=6;
    ctx.fillText('🌊 무리가 몰려옵니다', ARENA_X+ARENA_W/2, ARENA_Y+30);
    ctx.shadowBlur=0;
    ctx.restore();
  } else if (a.surgeFlash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(249,115,22,${a.surgeFlash * 0.22})`;
    ctx.fillRect(ARENA_X, ARENA_Y, ARENA_W, ARENA_H);
    ctx.restore();
  }
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
    const chR = (gs.chargers||[]).filter(c=>!c.dead).length;
    ctx.fillStyle = chR > 0 ? '#fca5a5' : '#94a3b8'; ctx.font='bold 11px sans-serif';
    ctx.fillText(chR > 0 ? `🐗 ${chR}마리가 성문으로 달려듭니다`
                         : '상단이 끝나면 웨이브가 마무리됩니다', cx, cy+16);
  } else if (ph === 'idle_defeated' || ph === 'lost') {
    ctx.fillStyle='rgba(40,0,0,0.62)'; ctx.fillRect(ARENA_X,ARENA_Y,ARENA_W,ARENA_H);
    ctx.fillStyle='#ef4444'; ctx.font='bold 20px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`병력 전멸  획득 ${gs.battle.goldEarned}💰`, cx, cy-14);
    const ch = (gs.chargers||[]).filter(c=>!c.dead).length;
    ctx.fillStyle='#fca5a5'; ctx.font='bold 12px sans-serif';
    ctx.fillText(ch > 0 ? `🐗 ${ch}마리가 성문으로 달려듭니다 — 막을 수 없습니다`
                        : '상단이 끝나면 웨이브가 마무리됩니다', cx, cy+14);
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
  const bw = CW-56, bx = 28, bh = 128;
  uiPanel(ctx, bx, y, bw, bh, 10, '#1a0d2e', '#a78bfa', 2);
  ctx.textAlign='center';
  ctx.fillStyle='#c4b5fd'; ctx.font='bold 19px sans-serif';
  ctx.fillText(first ? '∞ 심연이 열렸습니다' : '∞ 심연', CW/2, y+16);
  ctx.fillStyle='#8b7bb8'; ctx.font='11px sans-serif';
  ctx.fillText('1층부터 내려가며 버티는 본편입니다.', CW/2, y+46);
  ctx.fillText('층마다 적이 강해지고 새 변형이 붙습니다.', CW/2, y+64);
  ctx.fillStyle='#a78bfa'; ctx.font='bold 11px sans-serif';
  ctx.fillText('보석은 처음 닿은 깊이에서만 제값입니다.', CW/2, y+86);
  ctx.fillStyle='#7c6aa8'; ctx.font='10px sans-serif';
  ctx.fillText(`이미 돌파한 층을 되짚을 때는 ×${ENDLESS_REPEAT_MULT} — 더 내려가야 벌립니다.`, CW/2, y+102);
  y += bh + 22;

  // ── 층 전망 ──
  const ph = 108;
  uiPanel(ctx, bx, y, bw, ph, 8, '#0b0f1a', '#1e293b', 1);
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
    // 내 기록을 반영한 값 — 이미 돌파한 층은 1/10이라 표에도 그렇게 나와야 한다
    ctx.fillText(`💎${Math.floor(endlessGemTotalFor(t, gs.stats.bestEndless || 0))}`, cx2, y+68);
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
  const startY = 70;

  // ── 카드가 화면보다 넓으면 옆으로 민다 ──────────────────────────────────
  // 🎲풍요(5장)가 뜨면 414px 자리에 698px을 그리게 된다. 예전에는 그냥 가운데
  // 정렬이라 양 끝 카드가 화면 밖으로 잘려 나갔다 — 무엇이 있는지도 모르고
  // 고를 수 없는 카드가 생겼다. 넘치면 스크롤을 붙인다.
  const PICK_PAD = 10;
  const maxPickScroll = Math.max(0, totalW - (CW - PICK_PAD*2));
  if (maxPickScroll <= 0) gs.pickScroll = 0;
  else gs.pickScroll = Math.max(0, Math.min(maxPickScroll, gs.pickScroll || 0));
  const startX = maxPickScroll > 0 ? (PICK_PAD - gs.pickScroll) : (CW-totalW)/2;
  gs.ui.pickScroll = maxPickScroll > 0
    ? { x:0, y:startY, w:CW, h:cardH, max:maxPickScroll, axis:'x' } : null;

  gs.ui.upgradeCards = [];

  // 넘칠 때만 잘라낸다 — 안 넘치면 9슬라이스 틀의 그림자까지 잘릴 이유가 없다
  if (maxPickScroll > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, startY-6, CW, cardH+12); ctx.clip(); }

  cards.forEach((card, i) => {
    const cx = startX + i*(cardW+gap);
    const cy = startY;

    const gradeColor = card.grade==='epic' ? '#a78bfa'
                     : card.grade==='rare' ? '#60a5fa' : '#94a3b8';
    const gradeBg    = card.grade==='epic' ? '#1e0a3c'
                     : card.grade==='rare' ? '#0a1e3c' : '#0f172a';

    // 강화 카드는 매 층 멈춰 서서 고르는 화면이다 — 여기만큼은 진짜 틀을 두른다.
    // 등급 색은 틀 위에 얹어 남긴다 (영웅=보라 / 희귀=파랑).
    if (drawPanel9(ctx, card.grade==='common' ? 'ui.panel.dark' : 'ui.panel.gold', cx, cy, cardW, cardH)) {
      ctx.save(); roundRect(ctx, cx+3, cy+3, cardW-6, cardH-6, 6); ctx.clip();
      ctx.globalAlpha = 0.55; ctx.fillStyle = gradeBg;
      ctx.fillRect(cx+3, cy+3, cardW-6, cardH-6); ctx.restore();
      roundRect(ctx, cx+1, cy+1, cardW-2, cardH-2, 7);
      ctx.strokeStyle=gradeColor; ctx.lineWidth=1.5; ctx.stroke();
    } else {
      uiPanel(ctx, cx, cy, cardW, cardH, 8, gradeBg, gradeColor, 2);
    }

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

  if (maxPickScroll > 0) {
    ctx.restore();
    // 양 끝 그늘 + 화살표 — "옆에 더 있다"를 막대 없이 알린다
    const cy0 = startY, chh = cardH;
    if (gs.pickScroll > 1) {
      const g = ctx.createLinearGradient(0, 0, 34, 0);
      g.addColorStop(0, 'rgba(5,8,16,0.98)'); g.addColorStop(1, 'rgba(5,8,16,0)');
      ctx.fillStyle = g; ctx.fillRect(0, cy0, 34, chh);
      ctx.fillStyle='#94a3b8'; ctx.font='bold 15px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('‹', 9, cy0 + chh/2);
    }
    if (gs.pickScroll < maxPickScroll - 1) {
      const g = ctx.createLinearGradient(CW, 0, CW-34, 0);
      g.addColorStop(0, 'rgba(5,8,16,0.98)'); g.addColorStop(1, 'rgba(5,8,16,0)');
      ctx.fillStyle = g; ctx.fillRect(CW-34, cy0, 34, chh);
      ctx.fillStyle='#94a3b8'; ctx.font='bold 15px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('›', CW-9, cy0 + chh/2);
    }
    // 어디쯤인지 — 가로 막대
    const trackW = 120, tx0 = (CW-trackW)/2, ty0 = cy0 + chh + 5;
    ctx.fillStyle='rgba(148,163,184,0.14)';
    roundRect(ctx, tx0, ty0, trackW, 3, 1.5); ctx.fill();
    const thumbW = Math.max(24, trackW * ((CW - PICK_PAD*2) / totalW));
    ctx.fillStyle='rgba(148,163,184,0.55)';
    roundRect(ctx, tx0 + (trackW-thumbW) * (gs.pickScroll/maxPickScroll), ty0, thumbW, 3, 1.5); ctx.fill();
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
    ctx.fillText(`← 밀어서 ${cards.length}장 모두 보기 →`, CW/2, ty0 + 7);
  }

  // ── 리롤 — 원하는 빌드로 밀어붙이고 싶을 때 쓰는 골드 사용처 ──
  const rc   = rerollCost(gs.rerolls);
  const rAff = gs.gold >= rc;
  const rw=170, rh=34, rx=(CW-rw)/2, ry=startY+cardH+(maxPickScroll>0?32:18);
  uiPanel(ctx, rx, ry, rw, rh, 7, rAff ? '#1e293b' : '#12161f', rAff ? '#f59e0b' : '#2a3140', 1.5);
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
    // 🐲 중간보스가 있는 층이면 예고를 한 줄 더 쓴다 — 어느 쪽에서 나오는지가 핵심.
    // 상단이면 타워와 과부하를, 하단이면 부대와 영웅 배치를 다시 생각해야 하므로,
    // 들어가기 전에 알아야 그 한 층을 위해 무엇을 살지가 판단이 된다.
    const nTier = endlessTier(nextIdx);
    const nMid  = (gs.mode === 'endless') && isMidBossTier(nTier);
    const nSide = nMid ? midBossSide(nTier) : null;
    const npY = by2 + 6*17 + 16;
    const npH = nMid ? 100 : 78;
    uiPanel(ctx, 20, npY, CW-40, npH, 7, nMid ? '#180a10' : '#0a0f1a', nMid ? '#7f1d3a' : '#1e293b', nMid ? 1.5 : 1);

    const nst = getStageInfo(nextIdx);
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillStyle='#94a3b8'; ctx.font='bold 10px sans-serif';
    ctx.fillText(nst.endless
        ? `다음 — ${nst.stageLabel}${nst.isBossStage ? '  🏁관문' : ''}${(nd.affixes||[]).length ? '  ' + nd.affixes.map(a=>a.icon+a.name).join(' ') : ''}`
        : `다음 — 스테이지 ${nst.stageLabel} 웨이브 ${nst.waveInStage+1}/3`, 32, npY+9);
    ctx.textAlign='right'; ctx.fillStyle='#22c55e'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`★완주 +${clearBonusGold(nextIdx)}💰 · 성벽 +${clearRepair(nextIdx)}`, CW-32, npY+10);

    // 🐲 중간보스 예고 — 어느 전선인지를 크게
    let npBody = npY + 30;
    if (nMid) {
      const up = nSide === 'defense';
      uiPanel(ctx, 30, npBody-4, CW-60, 24, 5, up ? '#2a1208' : '#1a0a24', up ? '#f97316' : '#a855f7', 1.5);
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillStyle = up ? '#fb923c' : '#c084fc'; ctx.font='bold 10px sans-serif';
      ctx.fillText(`🐲 ${midBossName(nTier)} — ${up ? '상단 타워라인' : '하단 아레나'}에 나타납니다`, 38, npBody+8);
      ctx.textAlign='right'; ctx.fillStyle='#7c8ba1'; ctx.font='bold 8px sans-serif';
      ctx.fillText(up ? '타워·과부하' : '부대·영웅', CW-38, npBody+8);
      ctx.textAlign='left'; ctx.textBaseline='top';
      npBody += 26;
    }

    // 아레나 스폰 풀
    ctx.textAlign='left'; ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif';
    ctx.fillText('아레나', 32, npBody);
    const npool = nd.arenaPool || [];
    const ntot  = npool.reduce((a,[,w])=>a+w,0) || 1;
    npool.forEach(([id,w],i) => {
      const mt = BATTLE_MOB_TYPES[id]; if (!mt) return;
      const ix = 72 + i*42;
      ctx.font='14px sans-serif'; ctx.fillStyle='#e2e8f0'; ctx.textAlign='left';
      ctx.fillText(mt.icon, ix, npBody-3);
      ctx.font='bold 8px sans-serif'; ctx.fillStyle='#475569';
      ctx.fillText(`${Math.round(w/ntot*100)}%`, ix+17, npBody+1);
    });

    // 상단 침입자
    ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left';
    ctx.fillText('상단', 32, npBody+24);
    const ncm = 1 + nextIdx * DEF_WAVE_COUNT_SCALE;
    let nx = 72;
    for (const d of nd.defenseEnemies) {
      const t = ENEMY_TYPES[d.type]; if (!t) continue;
      ctx.fillStyle=t.color; ctx.font='bold 9px sans-serif';
      ctx.fillText(`● ${t.name} ×${Math.max(1,Math.round(d.count*ncm))}`, nx, npBody+24);
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
    ['케이브', `Lv.${caveLevelOf(gs)}`,                  '#a78bfa'],
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
let _lobbyBottom = 0;   // 로비 본문이 그린 마지막 y — 스크롤 범위 계산에 쓴다
function renderLobby(ctx, gs) {
  const L = gs.lobby;
  ctx.fillStyle='#080b14'; ctx.fillRect(0,0,CW,CH);

  renderLobbyHeader(ctx, gs);
  renderLobbyTabs(ctx, gs);

  // 기록 탭은 내용이 화면을 넘는다 — 마을과 같은 드래그 스크롤을 붙인다.
  // 나머지 탭은 한 화면에 들어가므로 예전처럼 고정으로 둔다.
  const scrollable = (L.tab === 'record' || L.tab === 'skill' || L.tab === 'sortie' || L.tab === 'camp');
  const sc = scrollable ? (gs.lobbyScroll || 0) : 0;
  _lobbyBottom = LOBBY_BODY_Y;

  ctx.save();
  ctx.beginPath(); ctx.rect(0, LOBBY_BODY_Y, CW, LOBBY_BODY_H); ctx.clip();
  ctx.translate(0, -sc);
  if      (L.tab === 'sortie') renderLobbySortie(ctx, gs);
  else if (L.tab === 'skill')  renderLobbySkill(ctx, gs);
  else if (L.tab === 'camp')   renderLobbyCamp(ctx, gs);
  else if (L.tab === 'unlock') renderLobbyUnlock(ctx, gs);
  else if (L.tab === 'pact')   renderLobbyPact(ctx, gs);
  else                         renderLobbyRecord(ctx, gs);
  ctx.restore();

  if (scrollable) {
    const contentH  = _lobbyBottom - LOBBY_BODY_Y + 12;
    const maxScroll = Math.max(0, contentH - LOBBY_BODY_H);
    gs.lobbyScroll = Math.max(0, Math.min(maxScroll, sc));
    gs.ui.lobbyScroll = maxScroll > 0 ? {x:0,y:LOBBY_BODY_Y,w:CW,h:LOBBY_BODY_H,max:maxScroll} : null;
    if (maxScroll > 0) drawScrollHint(ctx, LOBBY_BODY_Y, LOBBY_BODY_H, gs.lobbyScroll, maxScroll);
  } else {
    gs.ui.lobbyScroll = null;
    gs.lobbyScroll = 0;
  }

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
// 🎴 부적 — 뽑기 + 두 칸 장착 + 보관함
function _renderCharmBar(ctx, gs, y) {
  const bag = charmBag(gs), sl = charmSlots(gs);
  const rows = Math.min(2, Math.ceil(Math.max(1, bag.length) / 6));
  const h = 92 + (bag.length ? rows*30 : 0);
  uiPanel(ctx, 10,y,CW-20,h,7, '#140f22', '#4c1d95', 1);
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#c4b5fd'; ctx.font='bold 10px sans-serif';
  ctx.fillText('🎴 부적 — 이번 판에만 붙고 사라집니다', 18, y+9);

  // 장착 칸 2개
  gs.ui.charmSlotBtns=[];
  const cw2=132, chh=44, cx0=18;
  for (let i=0;i<CHARM_SLOTS;i++) {
    const cx=cx0+i*(cw2+8), cy=y+24;
    const uid=sl[i], e=uid!=null?charmEntry(gs,uid):null, d=e?charmDef(e.charmId):null;
    uiPanel(ctx, cx,cy,cw2,chh,6, d?'#241a3d':'#0c1017', d?'#a78bfa':'#2a2140', d?2:1);
    if (d) {
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.font='16px sans-serif'; ctx.fillStyle='#e2e8f0'; ctx.fillText(d.icon, cx+8, cy+chh/2);
      ctx.font='bold 9px sans-serif'; ctx.fillStyle=GRADE_COLOR[d.grade]||'#c4b5fd';
      ctx.fillText(d.name, cx+30, cy+chh/2-8);
      ctx.font='8px sans-serif'; ctx.fillStyle='#94a3b8';
      ctx.fillText(d.desc.length>22?d.desc.slice(0,21)+'…':d.desc, cx+30, cy+chh/2+7);
    } else {
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.font='bold 10px sans-serif'; ctx.fillStyle='#475569';
      ctx.fillText('빈 칸 — 아래에서 선택', cx+cw2/2, cy+chh/2);
    }
    gs.ui.charmSlotBtns.push({x:cx,y:cy,w:cw2,h:chh,idx:i});
  }
  // 뽑기 버튼
  const rw=CW-36-2*cw2-8-4, rx=cx0+2*(cw2+8), ry=y+24;
  const canRoll = gs.soulStones>=CHARM_ROLL_COST && bag.length<CHARM_BAG_MAX;
  uiPanel(ctx, rx,ry,Math.max(60,rw),chh,6, canRoll?'#2a1a05':'#12161f', canRoll?'#f59e0b':'#293040', canRoll?2:1);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='15px sans-serif'; ctx.fillText('🎰', rx+Math.max(60,rw)/2, ry+14);
  ctx.font='bold 9px sans-serif'; ctx.fillStyle=canRoll?'#fbbf24':'#475569';
  ctx.fillText(`💎${CHARM_ROLL_COST}`, rx+Math.max(60,rw)/2, ry+32);
  gs.ui.charmRollBtn={x:rx,y:ry,w:Math.max(60,rw),h:chh};

  // 보관함
  gs.ui.charmCards=[];
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif';
  ctx.fillText(`보관함 ${bag.length}/${CHARM_BAG_MAX}  ·  탭하면 빈 칸에 끼웁니다`, 18, y+74);
  if (bag.length) {
    const iw=70, ih=26, gap=4;
    bag.slice(0, 12).forEach((e,i)=>{
      const d=charmDef(e.charmId); if (!d) return;
      const bx=18+(i%6)*(iw+gap), by=y+88+Math.floor(i/6)*(ih+4);
      const on=isCharmSlotted(gs, e.uid);
      uiPanel(ctx, bx,by,iw,ih,4, on?'#241a3d':'#0f1420', on?'#a78bfa':(GRADE_COLOR[d.grade]||'#334155'), 1);
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.font='12px sans-serif'; ctx.fillStyle='#e2e8f0'; ctx.fillText(d.icon, bx+5, by+ih/2);
      ctx.font='bold 8px sans-serif'; ctx.fillStyle=on?'#c4b5fd':(GRADE_COLOR[d.grade]||'#94a3b8');
      ctx.fillText(d.name.length>5?d.name.slice(0,5):d.name, bx+21, by+ih/2);
      gs.ui.charmCards.push({x:bx,y:by,w:iw,h:ih,uid:e.uid});
    });
  }
  ctx.textAlign='left'; ctx.textBaseline='top';
  return y + h + 10;
}

// 🌑 악몽 사다리 — 심연(0) + 악몽 1~10 + ♾️ 무한
function _renderNightmareLadder(ctx, gs, y) {
  gs.ui.nightmareBtns = [];
  const openLv  = nightmareOpenLevel();
  const sel     = gs.lobby.nightmare || 0;
  const rows    = 2, cols = 6;          // 심연 + 1~10 = 11칸을 6×2에 담는다
  const cellW   = (CW - 20 - (cols - 1) * 5) / cols;
  const cellH   = 40;
  const h       = 30 + rows * (cellH + 5) + 30;

  uiPanel(ctx, 10, y, CW-20, h, 8, '#12091c', nightmareColor(sel), 1.5);

  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#e879f9'; ctx.font='bold 10px sans-serif';
  ctx.fillText(`🌑 난이도 — ${ABYSS_FINAL_FLOOR}층의 마왕을 잡으면 다음 단계가 열립니다`, 18, y+9);
  ctx.textAlign='right';
  ctx.fillStyle='#7c8ba1'; ctx.font='bold 9px sans-serif';
  ctx.fillText(openLv > NIGHTMARE_MAX ? '전부 돌파 — ♾️ 무한 개방'
             : `${openLv}/${NIGHTMARE_MAX} 단계 개방`, CW-18, y+10);
  ctx.textAlign='left';

  for (let i = 0; i <= NIGHTMARE_MAX; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const cx = 10 + c * (cellW + 5), cy = y + 26 + r * (cellH + 5);
    const can = nightmareAvailable(i);
    const on  = sel === i;
    const col = nightmareColor(i);
    uiPanel(ctx, cx, cy, cellW, cellH, 5, on ? '#2a1035' : can ? '#0e0a16' : '#08060c', on ? col : can ? '#3b2a4d' : '#1a1424', on ? 2 : 1);
    ctx.textAlign='center'; ctx.textBaseline='top';
    if (!can) {
      ctx.fillStyle='#3a2f4a'; ctx.font='12px sans-serif';
      ctx.fillText('🔒', cx+cellW/2, cy+7);
      ctx.fillStyle='#3a2f4a'; ctx.font='bold 8px sans-serif';
      ctx.fillText(`악몽 ${i}`, cx+cellW/2, cy+25);
    } else {
      ctx.globalAlpha = on ? 1 : 0.75;
      ctx.fillStyle = col; ctx.font='bold 11px sans-serif';
      ctx.fillText(i === 0 ? '∞ 심연' : `악몽 ${i}`, cx+cellW/2, cy+7);
      ctx.fillStyle = on ? '#cbd5e1' : '#5b6b80'; ctx.font='bold 8px sans-serif';
      ctx.fillText(i === 0 ? '서약 없음' : `서약 ${i}개`, cx+cellW/2, cy+22);
      // 이미 깬 갈래는 체크
      if (i < openLv) {
        ctx.fillStyle='#22c55e'; ctx.font='bold 8px sans-serif';
        ctx.fillText('✓', cx+cellW-8, cy+3);
      }
      ctx.globalAlpha = 1;
    }
    gs.ui.nightmareBtns.push({ x:cx, y:cy, w:cellW, h:cellH, level:i, can });
  }

  // 고른 단계가 무엇을 거는지 한 줄로
  const ny = y + 26 + rows * (cellH + 5) + 2;
  const pacts = nightmarePacts(sel);
  ctx.textAlign='left'; ctx.textBaseline='top';
  if (!pacts.length) {
    ctx.fillStyle='#5b6b80'; ctx.font='9px sans-serif';
    ctx.fillText(`강제 서약 없음 · 보석 ×${nightmareGemMult(0).toFixed(2)}`, 18, ny+4);
  } else {
    ctx.fillStyle='#f9a8d4'; ctx.font='bold 9px sans-serif';
    const names = pacts.map(id => { const d = PACT_DEFS.find(x=>x.id===id); return d ? `${d.icon}${d.name}` : id; });
    const line = `${names.join(' · ')}`;
    for (const ln of wrapLines(ctx, line, CW-140).slice(0,2)) { ctx.fillText(ln, 18, ny+4); break; }
    ctx.textAlign='right'; ctx.fillStyle='#fbbf24'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`보석 ×${nightmareGemMult(sel).toFixed(2)}`, CW-18, ny+4);
    ctx.textAlign='left';
  }
  if (pacts.length > 3) {
    ctx.fillStyle='#5b6b80'; ctx.font='8px sans-serif';
    ctx.fillText(`서약 ${pacts.length}개가 한꺼번에 걸립니다 — 캠프에서 뺄 수 없습니다`, 18, ny+16);
  }
  ctx.textAlign='left'; ctx.textBaseline='top';
  return y + h + 10;
}

function renderLobbySortie(ctx, gs) {
  let y = LOBBY_BODY_Y + 12;
  ctx.textAlign='left'; ctx.textBaseline='top';

  // ── 기록 배너 — 이 게임의 점수판 ────────────────────────────────────────
  const best = gs.stats.bestEndless || 0;
  const open = endlessUnlocked();
  const rh = open ? 64 : 94;   // 잠겨 있을 때는 ⏭ 건너뛰기 버튼 자리가 더 필요하다
  uiPanel(ctx, 10,y,CW-20,rh,8, open ? '#1a1033' : '#0c1220', open ? '#7c3aed' : '#1e293b', 1);

  if (open) {
    ctx.fillStyle='#8b7bb8'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`최고 도달 층  /  ${ABYSS_FINAL_FLOOR}`, 18, y+10);
    ctx.fillStyle='#c4b5fd'; ctx.font='bold 30px sans-serif';
    ctx.fillText(`${best}`, 18, y+24);
    const wBest = ctx.measureText(`${best}`).width;
    ctx.fillStyle='#6d5b9e'; ctx.font='bold 12px sans-serif';
    ctx.fillText('층', 20+wBest, y+42);

    // 다음 관문까지 — 100층에 결승선이 있으므로 그 너머를 가리키지 않는다
    const nextGate = Math.min(ABYSS_FINAL_FLOOR, (Math.floor(best/10)+1)*10);
    const atEnd = best >= ABYSS_FINAL_FLOOR;
    ctx.textAlign='right';
    ctx.fillStyle='#fbbf24'; ctx.font='bold 10px sans-serif';
    ctx.fillText(atEnd ? '👹 마왕층 도달' : `다음 관문 ${nextGate}층`, CW-18, y+12);
    ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
    ctx.fillText(atEnd ? `🌑 악몽 ${nightmareOpenLevel()}단계까지 개방`
                       : `돌파 시 💎+${ENDLESS_GATE_BONUS + Math.floor(nextGate/10)*ENDLESS_GATE_BONUS_STEP}`,
                 CW-18, y+28);
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif';
    ctx.fillText(`관문 ${(gs.clearedGates||[]).length}개 돌파`, CW-18, y+44);
    ctx.textAlign='left';
    // 진행 바 — 100층 결승선까지
    const pw = CW-36, prog = Math.min(1, best / ABYSS_FINAL_FLOOR);
    ctx.fillStyle='#1e293b'; ctx.fillRect(18, y+rh-9, pw, 4);
    ctx.fillStyle= atEnd ? '#fbbf24' : '#a78bfa'; ctx.fillRect(18, y+rh-9, pw*prog, 4);
  } else {
    ctx.fillStyle='#64748b'; ctx.font='bold 11px sans-serif';
    ctx.fillText('∞ 심연 — 아직 잠겨 있습니다', 18, y+13);
    ctx.fillStyle='#475569'; ctx.font='10px sans-serif';
    ctx.fillText('훈련을 한 판 치르면 열립니다 — 완주하지 않아도 됩니다.', 18, y+32);
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif';
    ctx.fillText('심연이 본편입니다 — 훈련은 손에 익히는 곳입니다.', 18, y+48);

    // ⏭ 훈련 건너뛰기 — 훈련을 아는 사람에게 같은 6웨이브를 다시 시키는 것은 값이 아니라 벌이다.
    // 완주해서 벌었을 만큼(최대 4)에 가까운 3보석을 주고 심연을 바로 연다.
    const skw = 150, skh = 30, skx = CW - 18 - skw, sky = y + rh - skh - 8;
    uiPanel(ctx, skx, sky, skw, skh, 6, '#2a1a05', '#f59e0b', 1.5);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#fbbf24'; ctx.font='bold 11px sans-serif';
    ctx.fillText(`⏭ 훈련 건너뛰기 💎+${TRAIN_SKIP_GEMS}`, skx+skw/2, sky+skh/2-5);
    ctx.fillStyle='#a16207'; ctx.font='8px sans-serif';
    ctx.fillText('바로 심연으로', skx+skw/2, sky+skh/2+8);
    gs.ui.trainSkipBtn = { x:skx, y:sky, w:skw, h:skh };
    ctx.textAlign='left'; ctx.textBaseline='top';
  }
  y += rh + 10;

  // ── 🌑 악몽 사다리 ──────────────────────────────────────────────────────
  // 심연이 끝이 없던 시절에는 목표가 없었다. 100층에 결승선을 긋고, 그 뒤로
  // 서약을 하나씩 얹은 열 개의 갈래를 놓는다. 여기가 이 게임의 진행 표다.
  if (open) y = _renderNightmareLadder(ctx, gs, y);

  // 해금된 편성
  const th = 84;
  uiPanel(ctx, 10,y,CW-20,th,7, '#0c1220', '#1e293b', 1);
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
      uiPanel(ctx, sx, ty, 26, 26, 5, on ? '#152238' : '#0e131e', on ? '#334155' : '#1a2130', 1);
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
  const lvd = [];
  for (const tid of SKILL_TREE_ORDER)
    for (const sk of SKILL_TREES[tid].skills) {
      const lv = skillLevel(gs, sk.id);
      if (lv > 0) lvd.push([sk, lv]);
    }
  if (lvd.length) {
    let sx = 18;
    for (const [sk, lv] of lvd) {
      if (sx > CW-46) { ctx.fillStyle='#475569'; ctx.font='9px sans-serif'; ctx.fillText('…', sx, y+30); break; }
      ctx.font='13px sans-serif'; ctx.fillStyle='#e2e8f0';
      ctx.fillText(sk.icon, sx, y+24);
      ctx.font='bold 8px sans-serif'; ctx.fillStyle='#a78bfa';
      ctx.fillText(String(lv), sx+2, y+38);
      sx += 22;
    }
  } else {
    ctx.fillStyle='#475569'; ctx.font='10px sans-serif';
    ctx.fillText('아직 없습니다 — 🌳 스킬 탭에서 보석을 쓰세요', 18, y+30);
  }
  // 진행 바
  ctx.fillStyle='#1e293b'; ctx.fillRect(18, y+46, CW-36, 5);
  ctx.fillStyle='#a78bfa'; ctx.fillRect(18, y+46, (CW-36)*(sp.total ? sp.owned/sp.total : 0), 5);
  y += sh + 10;

  // 🎴 부적 — 출전 전에 끼우는 일회용. 보석이 계속 들어오는 게임이라
  // 저축을 다시 목적으로 만들려면 확실한 소모처가 하나 있어야 한다.
  y = _renderCharmBar(ctx, gs, y);

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
  uiPanel(ctx, 10,y,CW-20,gh,7, '#0c1220', '#1e293b', 1);
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
    ctx.fillText(`🌳 스킬 ${sp.total - sp.owned}레벨 남음`, 18, gy);
    ctx.textAlign='right'; ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif';
    ctx.fillText(`💎 ${sp.totalCost - sp.spent}`, CW-18, gy);
    ctx.textAlign='left';
    gy += 17;
  }
  if (!nextUnlock && sp.owned >= sp.total) {
    ctx.fillStyle='#86efac'; ctx.font='10px sans-serif';
    ctx.fillText('스킬·해금을 전부 올렸습니다 — 📜 서약으로 더 깊이 내려가세요', 18, gy);
    gy += 17;
  }
  ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
  ctx.fillText(`이번 하강 예상 보석 배율 ×${pactGemMult().toFixed(2)}`, 18, gy);
  _lobbyBottom = gy + 20;
}

// ── 🌳 스킬 ─────────────────────────────────────────────────────────────────
// v2 — 나무 다섯, 노드마다 10레벨, 아랫줄은 윗줄에 레벨을 쌓아야 열린다.
// 초기화는 되돌릴 수 없는 조작이라 두 번 눌러야 실행된다 — 상태는 game.js가 들고 있다.
function renderLobbySkill(ctx, gs) {
  const L = gs.lobby;
  if (!SKILL_TREES[L.skillTree]) L.skillTree = 'tower';   // v1 세이브의 'support' 탭
  const tabs = SKILL_TREE_ORDER.map(id => ({ id, ...SKILL_TREES[id] }));
  const n = tabs.length;
  const tabW = (CW - 16 - (n-1)*4) / n, tabH = 32, tabY = LOBBY_BODY_Y + 8;
  gs.ui.skillTreeTabs = [];
  tabs.forEach((tab,i) => {
    const tx = 8 + i*(tabW+4);
    const active = L.skillTree === tab.id;
    uiPanel(ctx, tx,tabY,tabW,tabH,5, active ? '#1e293b' : '#0a0d18', active ? tab.color : '#334155', active ? 2 : 1);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = active ? tab.color : '#64748b';
    ctx.font='13px sans-serif'; ctx.fillText(tab.icon, tx+tabW/2, tabY+11);
    ctx.font='bold 9px sans-serif'; ctx.fillText(tab.name, tx+tabW/2, tabY+24);
    gs.ui.skillTreeTabs.push({x:tx,y:tabY,w:tabW,h:tabH,id:tab.id});
  });

  // ♻️ 초기화 — 무료. 넣은 보석을 전액 돌려주고 트리를 비운다.
  gs.ui.skillResetBtn = null;
  const spent = skillSpentTotal(gs);
  let headY = tabY + tabH + 8;
  if (spent > 0) {
    const armed = _skillResetArmed && (Date.now() - _skillResetArmedAt < 5000);
    if (!armed) _skillResetArmed = false;
    const rw = CW - 16, rh2 = 26;
    uiPanel(ctx, 8, headY, rw, rh2, 5, armed ? '#3f1515' : '#0f172a', armed ? '#ef4444' : '#334155', armed ? 2 : 1);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = armed ? '#fca5a5' : '#94a3b8'; ctx.font='bold 10px sans-serif';
    ctx.fillText(armed ? `한 번 더 누르면 초기화 — 💎${spent} 전액 반환`
                       : `♻️ 스킬 초기화 — 무료 · 💎${spent} 전액 반환`, CW/2, headY+rh2/2);
    gs.ui.skillResetBtn = { x:8, y:headY, w:rw, h:rh2 };
    ctx.textAlign='left'; ctx.textBaseline='top';
    headY += rh2 + 6;
  }

  gs.ui.metaCards = []; gs.ui.metaBulkCards = [];
  const treeTop = headY + 4;
  const bottom = _renderSkillTree(ctx, gs, L.skillTree, treeTop);
  // 각인은 영웅 탭 아래 빈 자리에 — 스킬 트리를 밀어내지 않는다
  gs.ui.sigilCards = [];
  if (L.skillTree === 'hero') renderSigilPicker(ctx, gs, bottom + 8);
  _lobbyBottom = (L.skillTree === 'hero') ? bottom + 8 + 130 : bottom;
}

// ── 🔥 캠프 단련소 ──────────────────────────────────────────────────────────
// 스킬 트리가 '확정으로 사는 곳'이라면 여기는 '걸고 굴리는 곳'이다.
// 값·성공률·실패했을 때 무슨 일이 나는지를 **누르기 전에** 전부 적어 둔다 —
// 파괴가 있는 판에서 확률을 숨기면 그건 도박이 아니라 사기다.
//
// 항목이 34개(성벽 1 · 타워 6 · 분기 18 · 용병 6 · 특수 3)라 한 화면에 다 펼치면
// 아무것도 못 찾는다. 무리별로 접어 두고 고른 무리만 편다.
function renderLobbyCamp(ctx, gs) {
  gs.ui.campBtns = []; gs.ui.campGroupBtns = [];
  const L = gs.lobby;
  if (!L.campGroup) L.campGroup = 'tower';
  let y = LOBBY_BODY_Y + 10;

  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#fb923c'; ctx.font='bold 12px sans-serif';
  ctx.fillText('🔥 단련 — 보석을 걸고 굴립니다', 14, y);
  ctx.textAlign='right'; ctx.fillStyle=COLORS.gem; ctx.font='bold 11px sans-serif';
  ctx.fillText(`💎 ${gs.soulStones||0}`, CW-14, y);
  y += 17;
  ctx.textAlign='left'; ctx.fillStyle='#64748b'; ctx.font='9px sans-serif';
  ctx.fillText(`대상마다 따로 오릅니다 · 실패하면 그대로거나 내려갑니다 · ${CAMP_SAFE_STEP}단마다 안전지대`, 14, y);
  y += 15;
  const stC = campState(gs);
  if ((stC.tries||0) > 0) {
    ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
    ctx.fillText(`지금까지 ${stC.tries}번 굴려 ${stC.breaks||0}번 무너졌습니다`, 14, y);
    y += 14;
  }
  y += 2;

  // ── 무리 고르기 ──
  const gw = (CW - 16 - 4*4) / 5, gh = 30;
  CAMP_GROUPS.forEach((g, i) => {
    const gx = 8 + i*(gw+4);
    const on = L.campGroup === g.id;
    const lvs = campTracks().filter(t => t.group === g.id)
                            .reduce((a2,t) => a2 + campLevel(gs, t.id), 0);
    uiPanel(ctx, gx, y, gw, gh, 5, on ? '#1e1408' : '#0b1220', on ? g.color : '#1e293b', on ? 2 : 1);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='12px sans-serif'; ctx.fillStyle = on ? '#e2e8f0' : '#475569';
    ctx.fillText(g.icon, gx+gw/2, y+10);
    ctx.fillStyle = on ? g.color : '#64748b'; ctx.font='bold 8px sans-serif';
    ctx.fillText(lvs > 0 ? `${g.short} +${lvs}` : g.short, gx+gw/2, y+22);
    gs.ui.campGroupBtns.push({ x:gx, y, w:gw, h:gh, id:g.id });
  });
  ctx.textAlign='left'; ctx.textBaseline='top';
  y += gh + 10;

  const rows = campTracks().filter(t => t.group === L.campGroup);
  for (const tr of rows) {
    const lv    = campLevel(gs, tr.id);
    const maxed = lv >= CAMP_MAX_LV;
    const cost  = campCost(gs, tr.id);
    const odds  = campOdds(gs, tr.id);
    const fail  = campFailOdds(gs, tr.id);
    const floorLv = campSafeFloor(gs, tr.id);
    const aff   = !maxed && cost != null && (gs.soulStones||0) >= cost;
    const rowH  = 74;

    uiPanel(ctx, 8, y, CW-16, rowH, 7, maxed?'#0f2a1a':'#0b1220', maxed?'#22c55e':tr.color, maxed?2:1.5);

    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.font='15px sans-serif'; ctx.fillText(tr.icon, 15, y+8);
    ctx.fillStyle=tr.color; ctx.font='bold 11px sans-serif';
    ctx.fillText(tr.name, 36, y+9);
    if (tr.parent) {   // 분기는 어느 타워의 갈래인지
      ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
      ctx.fillText(tr.parent, 36 + ctx.measureText(tr.name).width + 26, y+11);
    }
    ctx.textAlign='right';
    ctx.fillStyle = maxed?'#86efac':'#e2e8f0'; ctx.font='bold 12px sans-serif';
    ctx.fillText(`+${lv}`, CW-18, y+8);
    ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
    ctx.fillText(`/ ${CAMP_MAX_LV}`, CW-18, y+22);

    ctx.textAlign='left';
    ctx.fillStyle='#94a3b8'; ctx.font='bold 8px sans-serif';
    ctx.fillText(tr.desc(lv * tr.per), 36, y+24);
    if (!maxed) {
      ctx.fillStyle='#4ade80'; ctx.font='bold 8px sans-serif';
      ctx.fillText(`▲ ${tr.desc((lv+1) * tr.per)}`, 36, y+35);
    }

    // 단계 막대 — 안전지대에 눈금
    const bx=15, bw=CW-30, seg=bw/CAMP_MAX_LV, by=y+47;
    ctx.fillStyle='#1a2333'; ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle=tr.color;  ctx.fillRect(bx, by, bw * (lv/CAMP_MAX_LV), 4);
    ctx.fillStyle='rgba(8,13,24,0.8)';
    for (let i=CAMP_SAFE_STEP;i<CAMP_MAX_LV;i+=CAMP_SAFE_STEP) ctx.fillRect(bx + seg*i, by, 1, 4);

    if (maxed) {
      ctx.textAlign='center'; ctx.fillStyle='#22c55e'; ctx.font='bold 10px sans-serif';
      ctx.fillText('★ 끝까지 단련했습니다', CW/2, y+56);
    } else {
      const bw2=98, bh2=20, bx2=CW-16-bw2, by2=y+52;
      uiPanel(ctx, bx2, by2, bw2, bh2, 4, aff?'#2a1f08':'#12161f', aff?'#f59e0b':'#2a3140', 1);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle=aff?'#fbbf24':'#475569'; ctx.font='bold 10px sans-serif';
      ctx.fillText(`🎲 단련 💎${cost}`, bx2+bw2/2, by2+bh2/2);
      if (aff) gs.ui.campBtns.push({x:bx2,y:by2,w:bw2,h:bh2,id:tr.id});

      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillStyle='#22c55e'; ctx.font='bold 9px sans-serif';
      ctx.fillText(`성공 ${Math.round(odds*100)}%`, 15, by2+5);
      const parts = [];
      if (fail.keep > 0.001) parts.push(`유지 ${Math.round(fail.keep*100)}%`);
      if (fail.down > 0.001) parts.push(`하락 ${Math.round(fail.down*100)}%`);
      if (fail.brk  > 0.001) parts.push(`파괴 ${Math.round(fail.brk*100)}%`);
      ctx.fillStyle = fail.brk > 0.001 ? '#f87171' : '#64748b';
      ctx.font='bold 8px sans-serif';
      ctx.fillText(`실패 ${parts.join(' · ')}`, 15, by2+16);
      if (lv > CAMP_SAFE_STEP) {
        ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif'; ctx.textAlign='right';
        ctx.fillText(`무너져도 +${floorLv}`, bx2-8, by2+16);
      }
    }
    ctx.textAlign='left'; ctx.textBaseline='top';
    y += rowH + 6;
  }

  ctx.fillStyle='#334155'; ctx.font='9px sans-serif';
  ctx.fillText('보석은 캠프에서만 씁니다 — 여기서 올린 것은 판이 끝나도 남습니다.', 14, y+2);
  _lobbyBottom = y + 20;
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
    uiPanel(ctx, cx, y, cw, ch, 6, on ? '#1a1508' : open ? '#0a0e18' : '#080a12', on ? sg.color : canBuy ? '#f59e0b' : open ? '#1e293b' : '#161d2b', on ? 2 : 1);
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
  uiPanel(ctx, 12, y, CW-24, 42, 6, '#0c1220', '#1e293b', 1);
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
    uiPanel(ctx, 10,y,CW-20,rowH-4,6, owned ? '#0d2018' : can ? '#141c2e' : '#0a0e18', owned ? '#22c55e' : can ? '#f59e0b' : '#1e293b', owned || can ? 1.5 : 1);

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

  // ── ♾️ 승천 — 끝이 없는 사용처 ────────────────────────────────────────────
  y += 8;
  const an = ascendLevel(gs), ac = ascendCost(gs), acan = gs.soulStones >= ac;
  const ah = 74;
  uiPanel(ctx, 10,y,CW-20,ah,8, '#150f26', acan ? '#a78bfa' : '#3b2a5e', acan ? 2 : 1);
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#c4b5fd'; ctx.font='bold 11px sans-serif';
  ctx.fillText('♾️ 승천 — 끝이 없습니다', 20, y+10);
  ctx.textAlign='right'; ctx.fillStyle='#a78bfa'; ctx.font='bold 14px sans-serif';
  ctx.fillText(`${an}단계`, CW-20, y+8);
  ctx.textAlign='left'; ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif';
  ctx.fillText(`현재 — 타워·아군 공격력 +${(an*ASCEND_DMG*100).toFixed(1)}% · 체력 +${(an*ASCEND_HP*100).toFixed(1)}%`, 20, y+28);
  ctx.fillStyle='#64748b'; ctx.font='9px sans-serif';
  ctx.fillText('한 단계마다 값이 12%씩 오릅니다 — 남는 보석이 갈 곳', 20, y+41);
  const abw=CW-40, abh=22, aby=y+ah-abh-8;
  uiPanel(ctx, 20,aby,abw,abh,5, acan ? '#2a1a05' : '#12161f', acan ? '#f59e0b' : '#293040', 1);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle = acan ? '#fbbf24' : '#475569'; ctx.font='bold 11px sans-serif';
  ctx.fillText(`💎 ${ac}  →  ${an+1}단계`, CW/2, aby+abh/2);
  gs.ui.ascendBtn = {x:20,y:aby,w:abw,h:abh};
  ctx.textAlign='left'; ctx.textBaseline='top';
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

  // 갈래마다 서약이 어떻게 붙는지 — 고르기 전에 알아야 한다
  uiPanel(ctx, 8, y, CW-16, 30, 5, '#140a12', '#3f1d2e', 1);
  ctx.fillStyle='#94a3b8'; ctx.font='bold 8px sans-serif'; ctx.textBaseline='top';
  ctx.fillText(`🌑 악몽 N단계 — 위에서 N개가 강제로 붙습니다 (보석 ×${nightmareGemMult(NIGHTMARE_MAX).toFixed(2)}까지)`, 15, y+6);
  ctx.fillStyle='#fbbf24';
  ctx.fillText(`♾️ 무한 — ${PACT_DEFS.length}개가 전부 붙고 층마다 더 무거워집니다 (보석 ×${unboundedGemMult().toFixed(2)})`, 15, y+17);
  y += 36;

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
      uiPanel(ctx, 10, y, CW-20, pRowH-3, 5, on ? '#2a0a16' : '#0a0e18', on ? '#f43f5e' : '#1a2130', on ? 1.6 : 1);

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
  uiPanel(ctx, 10,y,CW-20,bh,8, '#1a1033', '#7c3aed', 1);
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
    uiPanel(ctx, cx,y,gw-3,26,4, on ? '#2a1f05' : '#0a0e18', on ? '#f59e0b' : '#1e293b', 1);
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
    uiPanel(ctx, cx,y,cw-3,26,4, cs[i] ? '#0d2a1a' : '#0a0e18', cs[i] ? '#22c55e' : '#1e293b', 1);
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
    uiPanel(ctx, mx,my,mw,mh,5, '#0a0e18', known ? '#334155' : '#161d2b', 1);
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
    uiPanel(ctx, bx2,y,kw,kh,6, dim ? '#0a0e18' : '#111c2e', dim ? '#1e293b' : col, 1);
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
  y += 22;

  // ── 📖 안내 다시 보기 ─────────────────────────────────────────────────────
  // 설명은 처음 한 번만 뜬다. 게임이 바뀌면 그때 읽은 내용이 옛것이 되는데,
  // 다시 볼 길이 없으면 초기화 말고는 방법이 없었다.
  ctx.fillStyle='#60a5fa'; ctx.font='bold 11px sans-serif';
  ctx.fillText('📖 게임 안내', 14, y); y += 17;
  ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
  const left = (typeof tipsRemaining === 'function') ? tipsRemaining() : 0;
  ctx.fillText(left > 0 ? `아직 안 뜬 쪽지 ${left}개 — 해당 상황에서 뜹니다`
                        : '쪽지를 모두 봤습니다. 다시 보려면 아래를 누르세요.', 14, y); y += 15;
  // 안내가 세 가지(글 6장 · 상황별 쪽지 · 🧭 손가락)라 한 줄에 셋을 놓는다.
  // 처음엔 밑에 한 줄을 더 달았는데, 그 줄이 로비 하단 고정 출격 바(y749~) 밑으로
  // 들어가 아예 누를 수 없었다 — 스크롤로도 닿지 않는 자리였다.
  const kw3 = (CW - 36) / 3;
  const mk3 = (bx2, label, sub, col, dim) => {
    uiPanel(ctx, bx2,y,kw3,kh,6, dim ? '#0a0e18' : '#111c2e', dim ? '#1e293b' : col, 1);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = dim ? '#334155' : col; ctx.font='bold 10px sans-serif';
    ctx.fillText(label, bx2+kw3/2, y+12);
    ctx.fillStyle = dim ? '#1e293b' : '#475569'; ctx.font='8px sans-serif';
    ctx.fillText(sub, bx2+kw3/2, y+25);
    ctx.textAlign='left'; ctx.textBaseline='top';
    return {x:bx2,y:y,w:kw3,h:kh};
  };
  gs.ui.tutReplayBtn  = mk3(12,           '📖 기본 설명',  '6장 다시 보기',  '#a78bfa', false);
  gs.ui.tutResetTipBtn= mk3(18+kw3,       '🔁 쪽지 초기화','상황별 안내',    '#22c55e', false);
  // 🧭 손가락 안내도 한 번 끝나면 다시 볼 길이 있어야 한다 — 글 설명과 같은 대우
  {
    const off = (typeof guide !== 'undefined') && guide.seen() && !guide.active;
    gs.ui.guideReplayBtn = mk3(24+kw3*2, '🧭 첫걸음 안내',
                               off ? '버튼을 짚어 준다' : '지금 켜져 있음',
                               off ? '#fbbf24' : '#475569', !off);
    if (!off) gs.ui.guideReplayBtn = null;
  }
  y += kh + 12;

  // ── 🎵 소리 ───────────────────────────────────────────────────────────────
  ctx.fillStyle='#60a5fa'; ctx.font='bold 11px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('🎵 소리', 14, y); y += 17;
  const bgmOn = BGM.isOn(), sfxOn = !SFX.isMuted();
  gs.ui.bgmToggleBtn = mk(12,    bgmOn?'🎵 배경음 켜짐':'🔇 배경음 꺼짐',
                          bgmOn?'상황에 맞는 곡이 흐릅니다':'조용히 진행합니다',
                          bgmOn?'#22c55e':'#475569', false);
  gs.ui.sfxToggleBtn = mk(18+kw, sfxOn?'🔊 효과음 켜짐':'🔇 효과음 꺼짐',
                          sfxOn?'타격 · 버튼 소리':'모든 소리가 멈춥니다',
                          sfxOn?'#22c55e':'#475569', false);
  y += kh + 8;
  _lobbyBottom = y;
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
    uiPanel(ctx, bx,byy,bw,bh,8, '#14532d', '#22c55e', 2);
    ctx.fillStyle='#fff'; ctx.font='bold 15px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('⚔️  훈련 시작', CW/2 - 40, byy+bh/2);
    ctx.fillStyle='#86efac'; ctx.font='bold 9px sans-serif';
    ctx.fillText('한 판 치르면 ∞ 심연이 열립니다', CW/2 + 82, byy+bh/2+1);
    gs.ui.sortieBtn = {x:bx,y:byy,w:bw,h:bh};
    gs.ui.trainBtn  = null;
    return;
  }

  const unb    = unboundedUnlocked();
  const trainW = unb ? 84 : 132, gap = 8;
  const unbW   = unb ? 92 : 0;
  const endW   = CW - 24 - trainW - gap - (unb ? unbW + gap : 0);

  // 🌑 심연 · 악몽 — 고른 단계로 내려간다
  const lv  = gs.lobby.nightmare || 0;
  const col = nightmareColor(lv);
  uiPanel(ctx, 12,byy,endW,bh,8, lv > 0 ? '#2a0a1e' : '#2e1065', col, 2);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#fff'; ctx.font='bold 15px sans-serif';
  ctx.fillText(lv > 0 ? `\ud83c\udf11 \uc545\ubabd ${lv}\ub2e8\uacc4` : '\u221e  \uc2ec\uc5f0 \ud558\uac15', 12+endW/2, byy+bh/2-6);
  const best = gs.stats.bestEndless || 0;
  ctx.fillStyle = lv > 0 ? '#f9a8d4' : '#c4b5fd'; ctx.font='bold 9px sans-serif';
  ctx.fillText(lv > 0 ? `\uc11c\uc57d ${lv}\uac1c \u00b7 ${ABYSS_FINAL_FLOOR}\uce35 \ub9c8\uc655\uae4c\uc9c0`
                      : (best > 0 ? `\ucd5c\uace0 ${best}\uce35 \u2014 ${ABYSS_FINAL_FLOOR}\uce35 \ub9c8\uc655\uae4c\uc9c0` : '\uccab \ud558\uac15'),
               12+endW/2, byy+bh/2+11);
  gs.ui.sortieBtn = {x:12,y:byy,w:endW,h:bh};

  // \u267e\ufe0f \ubb34\ud55c \u2014 \uc545\ubabd 10\ub2e8\uacc4\ub97c \uae68\uc57c \uc5f4\ub9b0\ub2e4
  let nx = 12 + endW + gap;
  if (unb) {
    uiPanel(ctx, nx,byy,unbW,bh,8, '#2a1a05', '#fbbf24', 1.5);
    ctx.fillStyle='#fbbf24'; ctx.font='bold 14px sans-serif';
    ctx.fillText('\u267e\ufe0f \ubb34\ud55c', nx+unbW/2, byy+bh/2-6);
    ctx.fillStyle='#a16207'; ctx.font='bold 8px sans-serif';
    ctx.fillText('\uac00\uc7a5 \uc5b4\ub835\ub2e4', nx+unbW/2, byy+bh/2+10);
    gs.ui.unboundedBtn = {x:nx,y:byy,w:unbW,h:bh};
    nx += unbW + gap;
  } else {
    gs.ui.unboundedBtn = null;
  }

  // \ud6c8\ub828 \u2014 \uc5f0\uc2b5
  const tx = nx;
  uiPanel(ctx, tx,byy,trainW,bh,8, '#0f1e17', '#22c55e', 1);
  ctx.fillStyle='#4ade80'; ctx.font='bold 12px sans-serif';
  ctx.fillText('\u2694\ufe0f \ud6c8\ub828', tx+trainW/2, byy+bh/2-6);
  ctx.fillStyle='#166534'; ctx.font='bold 8px sans-serif';
  ctx.fillText(unb ? '\uc5f0\uc2b5' : `${TRAINING_WAVES}\uc6e8\uc774\ube0c \u00b7 \uc5f0\uc2b5`, tx+trainW/2, byy+bh/2+10);
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
  if (r.endless && r.bossDown) {
    // 👹 마왕을 잡았다 — 처음으로 '끝냈다'가 있는 결과 화면
    const col = r.unbounded ? '#fbbf24' : nightmareColor(r.nightmare);
    ctx.fillStyle=col; ctx.font='bold 13px sans-serif';
    ctx.fillText(r.nightmare > 0 ? `${nightmareName(r.nightmare)} 돌파` : '∞ 심연 돌파', CW/2, y); y += 20;
    ctx.fillStyle='#fbbf24'; ctx.font='bold 34px sans-serif';
    ctx.fillText('👹 마왕 처치', CW/2, y); y += 42;
    ctx.fillStyle='#94a3b8'; ctx.font='11px sans-serif';
    ctx.fillText(`${ABYSS_FINAL_FLOOR}층까지 내려가 끝을 봤습니다`, CW/2, y); y += 20;
    if (r.nextOpen) {
      uiPanel(ctx, (CW-230)/2,y,230,26,13, '#2a1035', col, 1.5);
      ctx.fillStyle=col; ctx.font='bold 11px sans-serif'; ctx.textBaseline='middle';
      ctx.fillText(`🔓 ${r.nextOpen} 개방${r.clearGems ? `  ·  💎+${r.clearGems}` : ''}`, CW/2, y+13);
      ctx.textBaseline='top'; y += 32;
    }
    y += 6;
  } else if (r.endless) {
    // 무한은 도달 층이 곧 성적표다 — 제목 자리를 층수에 내준다
    const col = r.unbounded ? '#fbbf24' : nightmareColor(r.nightmare);
    ctx.fillStyle=col; ctx.font='bold 13px sans-serif';
    ctx.fillText(r.unbounded ? '♾️ 무한 종료'
               : r.nightmare > 0 ? `${nightmareName(r.nightmare)} 종료` : '∞ 하강 종료', CW/2, y); y += 20;
    ctx.fillStyle='#a78bfa'; ctx.font='bold 46px sans-serif';
    ctx.fillText(`${r.endlessTier}층`, CW/2, y); y += 52;
    ctx.fillStyle='#475569'; ctx.font='11px sans-serif';
    ctx.fillText(r.unbounded ? `이전 최고 ${gs.stats.bestEndless||0}층 · 여기까지 버텼습니다`
               : `${ABYSS_FINAL_FLOOR}층 마왕까지 ${Math.max(0, ABYSS_FINAL_FLOOR - r.endlessTier)}층 남았습니다`,
               CW/2, y);
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
    uiPanel(ctx, (CW-160)/2,y,160,24,12, '#3b1d6e', '#a78bfa', 1.5);
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
  uiPanel(ctx, 20,y,CW-40,boxH,8, '#0d1220', '#3b2a5c', 1.5);
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
  for (const tid of SKILL_TREE_ORDER)
    for (const sk of SKILL_TREES[tid].skills)
      if (skillCanBuy(gs, tid, sk).ok) buyable.push(sk);

  const ph = 96;
  uiPanel(ctx, 20,y,CW-40,ph,8, '#0c1220', '#1e293b', 1);
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
  uiPanel(ctx, bx,by,bw,bh,9, '#1e293b', '#a78bfa', 2);
  ctx.fillStyle='#ddd6fe'; ctx.font='bold 15px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('⛺ 캠프로 돌아가기', CW/2, by+bh/2);
  gs.ui.resultBtn = {x:bx,y:by,w:bw,h:bh};

  ctx.fillStyle='#334155'; ctx.font='9px sans-serif'; ctx.textBaseline='top';
  ctx.fillText('보석은 캠프에서 스킬과 해금에 쓸 수 있습니다', CW/2, by+bh+10);
}

// 나무 하나를 그린다. 그린 맨 아래 y를 돌려준다.
function _renderSkillTree(ctx, gs, treeId, startY) {
  const tree = SKILL_TREES[treeId] || SKILL_TREES.tower;
  const nodeW=112, nodeH=78, hGap=14, vGap=20;
  const totalW = 3*nodeW + 2*hGap;
  const offX = (CW - totalW) / 2;
  const getPos = (row, col) => ({ x: offX + col*(nodeW+hGap), y: startY + row*(nodeH+vGap) });

  // 줄 사이 게이트 안내 — 어느 줄이 왜 잠겼는지 한 줄로 보인다
  const rows = [...new Set(tree.skills.map(s=>s.row))].sort((a,b)=>a-b);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for (const row of rows) {
    if (row === 0) continue;
    const need = row * SKILL_ROW_GATE, have = treeLevelsAbove(gs, treeId, row);
    const gy = startY + row*(nodeH+vGap) - vGap/2;
    const open = have >= need;
    ctx.strokeStyle = open ? tree.color : '#1e293b'; ctx.lineWidth = open ? 2 : 1;
    ctx.setLineDash(open ? [] : [4,4]);
    ctx.beginPath(); ctx.moveTo(offX+10, gy); ctx.lineTo(offX+totalW-10, gy); ctx.stroke();
    ctx.setLineDash([]);
    const label = open ? `${row+1}단` : `🔒 윗줄 ${have}/${need}Lv`;
    ctx.font='bold 9px sans-serif';
    const lw = ctx.measureText(label).width + 12;
    ctx.fillStyle='#080b14'; ctx.fillRect(CW/2-lw/2, gy-7, lw, 14);
    ctx.fillStyle = open ? tree.color : '#64748b';
    ctx.fillText(label, CW/2, gy);
  }

  for (const sk of tree.skills) {
    const {x,y} = getPos(sk.row, sk.col);
    const lv    = skillLevel(gs, sk.id);
    const max   = skillMaxLv(sk);
    const chk   = skillCanBuy(gs, treeId, sk);
    const maxed = lv >= max;
    const gated = chk.why === 'gate';
    const canBuy = chk.ok;

    uiPanel(ctx, x,y,nodeW,nodeH,8, maxed ? '#0d2a1a' : canBuy ? '#0d1929' : '#080d18', maxed ? tree.color : canBuy ? '#4b6cb7' : lv>0 ? '#334155' : '#1e293b', maxed ? 2.5 : canBuy ? 2 : 1);
    ctx.globalAlpha = gated ? 0.4 : 1;

    // 아이콘 + 이름 + 레벨
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.font='16px sans-serif'; ctx.fillText(sk.icon, x+7, y+6);
    ctx.fillStyle = lv>0 ? tree.color : '#cbd5e1';
    ctx.font='bold 9px sans-serif'; ctx.fillText(sk.name, x+27, y+10);
    ctx.textAlign='right';
    ctx.fillStyle = maxed ? '#86efac' : lv>0 ? '#e2e8f0' : '#475569';
    ctx.font='bold 9px sans-serif'; ctx.fillText(`${lv}/${max}`, x+nodeW-7, y+10);

    // 레벨 표시 — 눈금이 100칸이면 칸 하나가 1px도 안 돼 읽히지 않는다.
    // 잘게 쪼갠 노드는 이어진 막대로, '개수' 노드는 예전처럼 칸으로 그린다.
    const bx=x+7, bw=nodeW-14, by=y+26;
    if (max > 20) {
      ctx.fillStyle='#1a2333'; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle=tree.color; ctx.fillRect(bx, by, bw * (lv/max), 4);
      // 10칸마다 눈금 하나 — 어디쯤인지 가늠할 자리는 남긴다
      ctx.fillStyle='rgba(8,13,24,0.75)';
      for (let i=1;i<10;i++) ctx.fillRect(bx + bw*(i/10), by, 1, 4);
    } else {
      const seg=bw/max;
      for (let i=0;i<max;i++) {
        ctx.fillStyle = i < lv ? tree.color : '#1a2333';
        ctx.fillRect(bx + i*seg + 0.5, by, seg-1.5, 4);
      }
    }

    // 지금 효과(레벨 0이면 1레벨 미리보기)
    ctx.textAlign='left';
    ctx.fillStyle = lv>0 ? '#94a3b8' : '#64748b';
    ctx.font='8px sans-serif';
    const txt = sk.desc(skillEffV(sk, lv > 0 ? lv : 1));
    _wrapSkillDesc(ctx, txt, x+7, y+36, nodeW-14, 10, 2);

    // 아래줄 — 다음 레벨 값
    ctx.textAlign='center';
    if (maxed) {
      ctx.fillStyle='#22c55e'; ctx.font='bold 9px sans-serif';
      ctx.fillText('★ 최대', x+nodeW/2, y+nodeH-13);
    } else if (gated) {
      ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
      ctx.fillText(`🔒 윗줄 ${sk.row*SKILL_ROW_GATE}Lv 필요`, x+nodeW/2, y+nodeH-12);
    } else {
      // 카드 전체가 '한 단계' 버튼이고, 오른쪽 끝에 ×10 칩을 붙인다.
      // 노드가 100레벨이라 칩이 없으면 나무 하나에 수백 번을 눌러야 한다.
      // 칩은 **정확히 열 칸**만 산다 — 지갑을 다 쓰는 올인 버튼이 아니다.
      const cost = skillLevelCost(sk, lv+1);
      let bulkN = 0, bulkSum = 0;
      for (let k = 0; k < 10; k++) {
        const nk = lv + k; if (nk >= max) break;
        bulkSum += skillLevelCost(sk, nk + 1); bulkN++;
      }
      const bulkAff = bulkN > 0 && (gs.soulStones||0) >= bulkSum && !gated;
      const chipW = 34, chipH = 15, chipX = x+nodeW-chipW-5, chipY = y+nodeH-chipH-4;
      ctx.fillStyle = canBuy ? '#f59e0b' : '#64748b';
      ctx.font='bold 9px sans-serif';
      ctx.fillText(`💎 ${compactNum(cost)} → Lv${lv+1}`, x+(nodeW-chipW)/2, y+nodeH-13);
      gs.ui.metaCards.push({x,y,w:nodeW,h:nodeH,skillId:sk.id,icon:sk.icon,bulk:1});
      if (bulkN > 1 && !gated) {
        roundRect(ctx, chipX, chipY, chipW, chipH, 3);
        ctx.fillStyle = bulkAff ? '#2a1f08' : '#141824'; ctx.fill();
        ctx.strokeStyle = bulkAff ? '#a16207' : '#252b38'; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle = bulkAff ? '#fbbf24' : '#3f4a5c'; ctx.font='bold 8px sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(`×${bulkN}`, chipX+chipW/2, chipY+chipH/2);
        ctx.textAlign='center'; ctx.textBaseline='top';
        // 칩이 카드보다 먼저 판정돼야 한다 — 카드가 통째로 탭을 먹지 않도록
        if (bulkAff) gs.ui.metaBulkCards.push({x:chipX,y:chipY,w:chipW,h:chipH,skillId:sk.id,icon:sk.icon,bulk:bulkN});
      }
    }
    ctx.globalAlpha = 1;
  }

  const lastRow = rows.length ? rows[rows.length-1] : 0;
  return startY + (lastRow+1)*(nodeH+vGap);
}

// 폭에 맞춰 잘라 그린다 — 설명이 노드를 넘지 않게
function _wrapSkillDesc(ctx, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(' ');
  let line = '', n = 0;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, y + n*lh); n++; line = w;
      if (n >= maxLines) { line=''; break; }
    } else line = t;
  }
  if (line && n < maxLines) ctx.fillText(line, x, y + n*lh);
}


// ─── ⚒️ 대장간 화면 ──────────────────────────────────────────────────────────
// 다른 건물은 골드로 확정 강화를 판다. 대장간도 골드를 받지만 셋 중 둘은 확률이다.
// 보석을 걸고 굴리는 영구 강화는 캠프 🔥단련으로 옮겼다 — 화폐의 뜻을 하나로 세운다.
function renderForgeScreen(ctx, gs) {
  const SCR_TOP = 92;
  ctx.fillStyle='#0c0f1a'; ctx.fillRect(0,SCR_TOP,CW,CH-SCR_TOP);
  const hY=SCR_TOP+6;
  ctx.fillStyle='#fb923c'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('⚒️ 대장간',CW/2,hY);
  uiPanel(ctx, 6,hY-3,64,30,5, '#1e293b', '#475569', 1);
  ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('← 뒤로',38,hY+12);
  gs.ui.townBackBtn={x:6,y:hY-3,w:64,h:30};
  // 대장간은 이제 골드로 돈다 — 이 판에서 번 것을 이 판에 쓴다
  ctx.fillStyle=COLORS.gold; ctx.font='bold 11px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText(`💰 ${gs.gold}`, CW-8, hY+11);

  // 탭
  const tabs=[{id:'gear',label:'🔨 장비 연마'},{id:'fuse',label:'🔥 타워 합성'},
              {id:'temper',label:'🎲 담금질'},{id:'track',label:'⚙️ 시설'}];
  const tw=(CW-16-3*4)/4, th=28, tabY=hY+26;
  const cur = gs.town.forgeTab || 'gear';
  gs.ui.forgeTabs=[];
  tabs.forEach((t,i)=>{
    const tx=8+i*(tw+4), on=cur===t.id;
    uiPanel(ctx, tx,tabY,tw,th,4, on?'#3a1f0a':'#0f172a', on?'#fb923c':'#1e293b', on?2:1);
    ctx.fillStyle=on?'#fdba74':'#64748b'; ctx.font='bold 9px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(t.label, tx+tw/2, tabY+th/2);
    gs.ui.forgeTabs.push({x:tx,y:tabY,w:tw,h:th,id:t.id});
  });

  // 시설 탭은 일반 건물 화면(트랙 목록)을 그대로 쓴다
  if (cur === 'track') { gs.ui.forgeGearBtns=null; gs.ui.forgeFuseBtns=null; gs.ui.forgeTemperBtn=null;
                         _renderForgeTracks(ctx, gs, tabY+th+8); return; }

  const top = tabY+th+10;
  gs.ui.forgeGearBtns=null; gs.ui.forgeFuseBtns=null; gs.ui.forgeTemperBtn=null; gs.ui.forgeCoreBtn=null;
  if      (cur==='gear')   _renderForgeGear(ctx, gs, top);
  else if (cur==='fuse')   _renderForgeFuse(ctx, gs, top);
  else                     _renderForgeTemper(ctx, gs, top);

  // 최근 결과 알림 (확률 판정은 눈에 보여야 한다)
  const msg = gs.ui.forgeMsg;
  if (msg && Date.now() < msg.until) {
    const mh=32; const my=CH-mh-10;
    uiPanel(ctx, 12,my,CW-24,mh,7, '#0c1220', msg.color, 2);
    ctx.fillStyle=msg.color; ctx.font='bold 12px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(msg.text, CW/2, my+mh/2);
  }
}

// 🔨 칸별 연마 — 장비는 판마다 바뀌지만 칸에 붙인 연마는 남는다
function _renderForgeGear(ctx, gs, y) {
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif';
  ctx.fillText('이번 판 동안 그 칸에 낀 장비가 그만큼 강해집니다 — 판이 끝나면 사라집니다', 10, y);
  y += 16;
  gs.ui.forgeGearBtns=[];
  const rowH=44, gap=5;
  for (const sl of EQUIP_SLOTS) {
    const p = slotPlus(gs, sl.id), cost = slotPlusCost(gs, sl.id);
    const can = cost != null && gs.gold >= cost;
    uiPanel(ctx, 8,y,CW-16,rowH,6, p>0?'#1a1206':'#0c1220', p>=FORGE_PLUS_MAX?'#fb923c':p>0?'#7c4a12':'#1e293b', 1);
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.font='17px sans-serif'; ctx.fillStyle='#e2e8f0';
    ctx.fillText(sl.icon, 16, y+rowH/2);
    ctx.font='bold 11px sans-serif'; ctx.fillStyle = p>0?'#fdba74':'#cbd5e1';
    ctx.fillText(sl.name, 40, y+rowH/2-8);
    ctx.font='9px sans-serif'; ctx.fillStyle='#64748b';
    ctx.fillText(`+${p} · 이 칸 장비 능력 ${Math.round((slotPlusMult(gs,sl.id)-1)*100)}% 증가`, 40, y+rowH/2+8);
    // 버튼
    const bw=92,bh=28,bx=CW-16-bw,by=y+(rowH-bh)/2;
    roundRect(ctx,bx,by,bw,bh,5);
    if (cost == null) {
      ctx.fillStyle='#1a2e1a'; ctx.fill(); ctx.strokeStyle='#22c55e'; ctx.stroke();
      ctx.fillStyle='#86efac'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center';
      ctx.fillText('★ 최대', bx+bw/2, by+bh/2);
    } else {
      ctx.fillStyle=can?'#2a1a05':'#12161f'; ctx.fill();
      ctx.strokeStyle=can?'#f59e0b':'#293040'; ctx.stroke();
      ctx.fillStyle=can?'#fbbf24':'#475569'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center';
      ctx.fillText(`💰 ${cost} → +${p+1}`, bx+bw/2, by+bh/2);
      gs.ui.forgeGearBtns.push({x:bx,y:by,w:bw,h:bh,slot:sl.id});
    }
    y += rowH+gap;
  }
  ctx.textAlign='left'; ctx.textBaseline='top';
}

// 🔥 합성 — ★5 심 둘로 ★6, ★10까지. 실패하면 하나가 탄다.
function _renderForgeFuse(ctx, gs, y) {
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif';
  ctx.fillText('가진 가장 높은 별이 이번 판 타워 최고 레벨이 됩니다 (기본 ★5)', 10, y); y+=15;

  // 현재 상한
  const best = forgeBestStar(gs);
  uiPanel(ctx, 8,y,CW-16,34,6, '#1a1206', '#fb923c', 2);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#fdba74'; ctx.font='bold 12px sans-serif';
  ctx.fillText(`현재 타워 최고 레벨  ★${best}  /  ★${FORGE_STAR_MAX}`, CW/2, y+17);
  y += 42;

  // ★5 심 구입
  const canBuy = gs.gold >= FORGE_CORE_COST;
  uiPanel(ctx, 8,y,CW-16,36,6, canBuy?'#0d1929':'#0c1017', canBuy?'#4b6cb7':'#1e293b', 1);
  ctx.textAlign='left'; ctx.fillStyle='#cbd5e1'; ctx.font='bold 11px sans-serif';
  ctx.fillText(`★5 타워 심 구입`, 18, y+18);
  ctx.textAlign='right'; ctx.fillStyle=canBuy?'#fbbf24':'#475569'; ctx.font='bold 11px sans-serif';
  ctx.fillText(`💰 ${FORGE_CORE_COST}`, CW-18, y+18);
  gs.ui.forgeCoreBtn={x:8,y,w:CW-16,h:36};
  y += 44;

  // 합성 줄
  gs.ui.forgeFuseBtns=[];
  const rowH=42, gap=5;
  for (let st=FORGE_STAR_MIN; st<FORGE_STAR_MAX; st++) {
    const have = forgeCores(gs, st);
    const ok   = have >= 2;
    const odds = Math.min(0.95, (FORGE_ODDS[st]||0.15) + (BONUSES.fuseLuck||0));
    uiPanel(ctx, 8,y,CW-16,rowH,6, ok?'#141c2e':'#0c1017', ok?'#4b6cb7':'#1e293b', 1);
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle = ok?'#e2e8f0':'#64748b'; ctx.font='bold 11px sans-serif';
    ctx.fillText(`★${st} ×2  →  ★${st+1}`, 16, y+rowH/2-7);
    ctx.font='9px sans-serif'; ctx.fillStyle='#64748b';
    ctx.fillText(`보유 ${have}개 · 성공 ${Math.round(odds*100)}% · 실패 시 1개 소실`, 16, y+rowH/2+9);
    const bw=76,bh=28,bx=CW-16-bw,by=y+(rowH-bh)/2;
    roundRect(ctx,bx,by,bw,bh,5);
    ctx.fillStyle=ok?'#2a1a05':'#12161f'; ctx.fill();
    ctx.strokeStyle=ok?'#f59e0b':'#293040'; ctx.stroke();
    ctx.fillStyle=ok?'#fbbf24':'#475569'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center';
    ctx.fillText('🔥 합성', bx+bw/2, by+bh/2);
    if (ok) gs.ui.forgeFuseBtns.push({x:bx,y:by,w:bw,h:bh,star:st});
    y += rowH+gap;
  }
  // 만렙 심
  const topHave = forgeCores(gs, FORGE_STAR_MAX);
  if (topHave > 0) {
    ctx.textAlign='center'; ctx.fillStyle='#fbbf24'; ctx.font='bold 10px sans-serif';
    ctx.fillText(`★${FORGE_STAR_MAX} 심 ${topHave}개 — 더 벼릴 곳이 없습니다`, CW/2, y+10);
  }
  ctx.textAlign='left'; ctx.textBaseline='top';
}

// 🎲 담금질 — 숙련도를 걸고 굴린다
function _renderForgeTemper(ctx, gs, y) {
  const f = forgeState(gs);
  const m = f.mastery, cost = temperCost(gs), odds = temperOdds(gs), floorLv = temperFloor(gs);
  const maxed = m >= TEMPER_MAX;
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif';
  ctx.fillText('성공하면 숙련도 +1, 실패하면 직전 체크포인트로 되돌아갑니다', 10, y); y+=16;

  uiPanel(ctx, 8,y,CW-16,86,8, '#1a1206', '#fb923c', 2);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#fdba74'; ctx.font='bold 26px sans-serif';
  ctx.fillText(`숙련도 ${m}`, CW/2, y+26);
  ctx.fillStyle='#cbd5e1'; ctx.font='bold 11px sans-serif';
  ctx.fillText(`타워 공격력 +${Math.round(m*TEMPER_GAIN*100)}%  ·  아군 공격력 +${Math.round(m*TEMPER_GAIN*100)}%`, CW/2, y+52);
  ctx.fillStyle='#64748b'; ctx.font='9px sans-serif';
  ctx.fillText(`실패 시 되돌아갈 지점 ${floorLv}  ·  ${TEMPER_CHECKPOINT}단위마다 체크포인트`, CW/2, y+70);
  y += 96;

  // 눈금
  const bw2=CW-24, bx2=12, seg=bw2/TEMPER_MAX;
  for (let i=0;i<TEMPER_MAX;i++) {
    const cp = (i+1) % TEMPER_CHECKPOINT === 0;
    ctx.fillStyle = i < m ? (cp?'#fbbf24':'#fb923c') : cp ? '#3a2a10' : '#1a2333';
    ctx.fillRect(bx2 + i*seg + 0.5, y, seg-1.5, 7);
  }
  y += 20;

  const bh=52, by=y;
  roundRect(ctx,12,by,CW-24,bh,9);
  const can = !maxed && gs.gold >= cost;
  ctx.fillStyle=can?'#2a1a05':'#12161f'; ctx.fill();
  ctx.strokeStyle=can?'#f59e0b':'#293040'; ctx.lineWidth=2; ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  if (maxed) {
    ctx.fillStyle='#86efac'; ctx.font='bold 14px sans-serif';
    ctx.fillText('★ 숙련도 최대', CW/2, by+bh/2);
  } else {
    ctx.fillStyle=can?'#fbbf24':'#475569'; ctx.font='bold 15px sans-serif';
    ctx.fillText(`🎲 담금질 — 💰 ${cost}`, CW/2, by+bh/2-8);
    ctx.font='bold 10px sans-serif';
    ctx.fillText(`성공 확률 ${Math.round(odds*100)}%`, CW/2, by+bh/2+12);
    gs.ui.forgeTemperBtn={x:12,y:by,w:CW-24,h:bh};
  }
  ctx.textAlign='left'; ctx.textBaseline='top';
}

// ⚙️ 시설 탭 — 골드로 사는 평범한 트랙 목록 (다른 건물과 같은 모양)
function _renderForgeTracks(ctx, gs, top) {
  const def = TOWN_BUILDINGS.find(b=>b.id==='forge');
  const bs  = gs.town.buildings.forge;
  const curLv = bs.level||0, maxLv = BUILDING_MAX_LEVEL-1;
  if (curLv < maxLv) drawLevelUpBtn(ctx, gs, def, bs, (CW-170)/2, top, 170, 26);
  else gs.ui.buildingLvUpBtn=null;
  _renderTrackList(ctx, gs, def, bs, top+32);
}

// ─── 건물 서브 화면 ───────────────────────────────────────────────────────────
function renderBuildingScreen(ctx, gs, buildingId) {
  if (buildingId==='heroShop' && (gs.town.shopTab||'buy')==='buy') { renderHeroShopScreen(ctx,gs); return; }
  if (buildingId==='forge') { renderForgeScreen(ctx,gs); return; }
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
  uiPanel(ctx, 6,hY-3,64,30,5, '#1e293b', '#475569', 1);
  ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('← 뒤로',38,hY+12);
  gs.ui.townBackBtn={x:6,y:hY-3,w:64,h:30};

  // ── 건물 레벨 ────────────────────────────────────────────────────────────
  const curLv = bs.level||0, maxLv = BUILDING_MAX_LEVEL-1;
  if (curLv < maxLv) {
    const bw=152,bh=28,bx=CW-6-bw,by2=hY-3;
    drawLevelUpBtn(ctx, gs, def, bs, bx, by2, bw, bh);
  } else {
    const bw=152,bh=28,bx=CW-6-bw;
    uiPanel(ctx, bx,hY-3,bw,bh,4, '#2a1f05', '#f59e0b', 1);
    ctx.fillStyle='#fbbf24'; ctx.font='bold 8px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('★ 최고 레벨 — ♾️ 개방',bx+bw/2,hY-3+bh/2);
    gs.ui.buildingLvUpBtn=null;
  }

  ctx.fillStyle='#475569'; ctx.font='9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  const nextTracks = curLv<maxLv ? tracksUnlockedAt(def, curLv+1) : [];
  ctx.fillText(`Lv.${curLv+1} / ${BUILDING_MAX_LEVEL}` +
    (nextTracks.length ? `   다음 승급: ${nextTracks.map(t=>t.icon+t.name).join(' ')} 개방` : ''), 6, hY+26);

  // 영웅 상점은 매대와 강화가 한 건물 안에 있다 — 여기서도 돌아갈 길을 낸다
  const isShop = def.id==='heroShop';
  if (isShop) {
    drawShopTabs(ctx, gs, hY+40);
    // 매대를 안 그리는 동안에는 매대 버튼 좌표를 지운다.
    // 남겨두면 강화 목록을 누를 때 그 자리에 있던 포션이 팔린다.
    gs.ui.shopItemBtns = null; gs.ui.skillBuyBtns = null; gs.ui.activeBuyBtns = null;
  }

  _renderTrackList(ctx, gs, def, bs, SCR_TOP+(isShop?72:50));
}

// 승급 버튼 — 골드만이 아니라 🏰성채 레벨과 그 건물에서 산 강화 수도 본다.
// 잠겨 있으면 무엇이 모자란지 버튼에 그대로 적는다 — 눌러 보고 알게 하면 안 된다.
function drawLevelUpBtn(ctx, gs, def, bs, bx, by, bw, bh) {
  const chk = canLevelUpBuilding(gs, def.id);
  const cost = buildingLevelCost(def, (bs.level||0)+1);
  let label, ok = false;
  if (chk.ok)                       { label = `Lv.${(bs.level||0)+2} 승급 ${cost}💰`; ok = true; }
  else if (chk.why === 'castle')    label = `🏰 성채 Lv.${chk.need+1} 필요`;
  else if (chk.why === 'upgrades')  label = `강화 ${chk.have}/${chk.need} 더 필요`;
  else                              label = `Lv.${(bs.level||0)+2} 승급 ${cost}💰`;
  uiPanel(ctx, bx,by,bw,bh,4, ok?'#1e3a5f':'#1a1a2e', ok?'#f59e0b':'#374151', 1);
  ctx.fillStyle = ok?'#fbbf24':'#6b7280'; ctx.font='bold 10px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label, bx+bw/2, by+bh/2);
  ctx.textAlign='left'; ctx.textBaseline='top';
  gs.ui.buildingLvUpBtn={x:bx,y:by,w:bw,h:bh};
}

// 건물 강화 트랙 목록 — 일반 건물과 대장간 '시설' 탭이 같이 쓴다
function _renderTrackList(ctx, gs, def, bs, listTop) {
  const curLv = bs.level||0;
  // ── 강화 목록 (스크롤) ───────────────────────────────────────────────────
  // 10레벨이면 항목이 화면을 넘는다. 드래그로 훑을 수 있게 잘라 그린다.
  const listBot = CH-8, listH = listBot-listTop;
  const open   = buildingTracks(def, curLv);
  const locked = (def.tracks||[]).filter(t => (t.unlockLv||0) > curLv);
  const rowH = 46, gapH = 5, lockH = 30;
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
    const hardMax = trackMax(tr), inf = trackIsInfinite(tr);
    // 건물 레벨이 "이 트랙을 몇 번까지 살 수 있는지"를 정한다.
    // 한 번에 다 찍지 못하게 해서 승급이 실제 선택이 되게 하는 장치다.
    const mx = trackCapAt(tr, curLv);
    const maxed = !inf && n>=mx;
    const capped = maxed && n < hardMax;      // 트랙이 끝난 게 아니라 레벨에 막힌 것
    const cost = trackCost(tr, n);
    const canAff = !maxed && gs.gold>=cost;

    uiPanel(ctx, 6,uy,CW-12,rowH,5, maxed?'#0f1a0f' : inf?'#1a1030' : canAff?'#0d1929':'#0f0f1a', maxed?'#22c55e' : inf?'#a78bfa' : canAff?def.color:'#334155', inf?1.5:1);

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
      ctx.fillText(`×${n}`, CW-118, uy+rowH/2);
    } else {
      // 30레벨짜리를 점으로 찍으면 읽히지 않는다 — 막대로 바꾼다.
      // 채운 칸(초록) / 지금 레벨로 살 수 있는 칸(회색) / 승급해야 열리는 칸(어둡게).
      const bw3 = 50, bx3 = CW-118-bw3, by3 = uy+rowH/2-4;
      ctx.fillStyle='#1b2230'; ctx.fillRect(bx3, by3, bw3, 5);
      ctx.fillStyle='#334155'; ctx.fillRect(bx3, by3, bw3 * (mx/hardMax), 5);
      ctx.fillStyle= capped?'#a16207':'#22c55e'; ctx.fillRect(bx3, by3, bw3 * (n/hardMax), 5);
      ctx.fillStyle = capped?'#a16207':'#475569'; ctx.font='bold 7px sans-serif'; ctx.textAlign='right';
      ctx.fillText(`${n}/${mx}` + (capped?` (최대 ${hardMax})`:''), CW-118, uy+rowH/2+12);
    }

    if (!maxed) {
      // ── 한 칸 / 열 칸 ────────────────────────────────────────────────────
      // 트랙이 24~30단인데 한 칸씩만 살 수 있으면 같은 버튼을 서른 번 눌러야 한다.
      //
      // 처음에는 "지갑으로 살 수 있는 만큼"을 샀는데, 그건 **올인 버튼**이었다 —
      // 골드가 어중간하면 그 트랙 하나에 지갑을 통째로 쏟아붓는다. 여러 트랙에
      // 나눠 쓰고 싶으면 결국 한 칸씩 눌러야 했으니 있으나 마나였다.
      // 그래서 **정확히 열 칸**만 산다. 열 칸 값이 모자라면 아예 안 눌린다 —
      // 얼마가 나갈지 모르는 버튼보다, 못 누르지만 값이 분명한 버튼이 낫다.
      const BULK_N = 10;
      // 열 칸(또는 상한까지 남은 칸)의 총액
      let bulkN = 0, bulkSum = 0;
      for (let k = 0; k < BULK_N; k++) {
        const nk = n + k;
        if (!inf && nk >= mx) break;
        bulkSum += trackCost(tr, nk); bulkN++;
      }
      const bulkAff = bulkN > 0 && gs.gold >= bulkSum;

      const bh2=30, by2=uy+(rowH-bh2)/2;
      const bw4=44, bw2=56, gapB=4;
      const bx2=CW-8-bw2, bx4=bx2-bw4-gapB;

      roundRect(ctx,bx2,by2,bw2,bh2,4);
      ctx.fillStyle=canAff?(inf?'#6d28d9':def.color):'#1e293b'; ctx.fill();
      ctx.fillStyle=canAff?'#fff':'#475569'; ctx.font='bold 11px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${compactNum(cost)}💰`,bx2+bw2/2,by2+bh2/2);
      gs.ui.upgradeBtns.push({x:bx2,y:by2,w:bw2,h:bh2,id:tr.id,bulk:1});

      if (bulkN > 0) {
        roundRect(ctx,bx4,by2,bw4,bh2,4);
        ctx.fillStyle = bulkAff ? (inf?'#3b2470':'#14304d') : '#141824'; ctx.fill();
        ctx.strokeStyle = bulkAff ? (inf?'#a78bfa':def.color) : '#252b38'; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle = bulkAff ? '#e2e8f0' : '#3f4a5c'; ctx.font='bold 10px sans-serif';
        ctx.fillText(`×${bulkN}`, bx4+bw4/2, by2+bh2/2-5);
        ctx.fillStyle = bulkAff ? '#94a3b8' : '#333b4a'; ctx.font='bold 7px sans-serif';
        ctx.fillText(compactNum(bulkSum), bx4+bw4/2, by2+bh2/2+8);
        // 값이 모자라면 rect를 등록하지 않는다 — 눌리지 않는 것이 곧 설명이다
        if (bulkAff) gs.ui.upgradeBtns.push({x:bx4,y:by2,w:bw4,h:bh2,id:tr.id,bulk:bulkN});
      }
    } else if (capped) {
      // 레벨에 막힌 것과 트랙을 다 찍은 것은 다른 상태다 — 다르게 보여야 승급이 목표가 된다
      ctx.fillStyle='#a16207'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('승급 필요',CW-46,uy+rowH/2);
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
        uiPanel(ctx, 6,uy,CW-12,lockH,4, '#080d18', '#232c3d', 1);
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
  const tw = 80, th = 28, x0 = CW/2 - tw - 4;
  const cur = gs.town.shopTab || 'buy';
  tabs.forEach((t,i)=>{
    const tx = x0 + i*(tw+8), on = cur===t.id;
    uiPanel(ctx, tx,y,tw,th,4, on?'#2d1b69':'#0f172a', on?'#a78bfa':'#1e293b', 1);
    ctx.fillStyle = on?'#c4b5fd':'#64748b'; ctx.font='bold 11px sans-serif';
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
  uiPanel(ctx, 6,hY-3,64,30,5, '#1e293b', '#475569', 1);
  ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('← 뒤로',38,hY+12);
  gs.ui.townBackBtn={x:6,y:hY-3,w:64,h:30};
  ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText(`Lv.${(gs.town.buildings.heroShop.level||0)+1}`, CW-8, hY+11);
  drawShopTabs(ctx, gs, hY+22);

  gs.ui.shopItemBtns=[];
  gs.ui.skillBuyBtns=[]; gs.ui.activeBuyBtns=[];

  // 매대는 길다 — 잘라 그리고 드래그로 훑는다
  const listTop = SCR_TOP+52, listBot = CH-8, listH = listBot-listTop;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, listTop, CW, listH); ctx.clip();
  let sy = listTop - (gs.town.scroll||0);

  // ── 소비 아이템 ─────────────────────────────────────────────────────────
  ctx.fillStyle='#a5b4fc'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('소비 아이템',8,sy); sy+=14;
  for (const item of HERO_SHOP_FIXED) {
    const ih=44;
    const gc=GRADE_COLOR[item.grade]||'#94a3b8';
    uiPanel(ctx, 6,sy,CW-12,ih,5, '#0d1929', gc, 1);
    ctx.font='16px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='#e2e8f0';
    ctx.fillText(item.icon,12,sy+ih/2);
    ctx.fillStyle='#f1f5f9'; ctx.font='bold 10px sans-serif'; ctx.fillText(item.name,30,sy+ih/2-7);
    ctx.fillStyle='#cbd5e1'; ctx.font='bold 9px sans-serif'; ctx.fillText(item.desc,30,sy+ih/2+6);
    const canAff=gs.gold>=item.cost;
    const bw=74,bh=30,bx=CW-8-bw,by2=sy+(ih-bh)/2;
    roundRect(ctx,bx,by2,bw,bh,4); ctx.fillStyle=canAff?'#4c1d95':'#1e293b'; ctx.fill();
    ctx.fillStyle=canAff?'#c4b5fd':'#475569'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
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
    const ih=44;
    const gc=GRADE_COLOR[item.grade]||'#94a3b8';
    const have=_owned.has(item.id);
    uiPanel(ctx, 6,sy,CW-12,ih,5, have?'#141e0d':'#0d1929', gc, have?2:1);
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
      const bw=74,bh=30,bx=CW-8-bw,by2=sy+(ih-bh)/2;
      roundRect(ctx,bx,by2,bw,bh,4); ctx.fillStyle=canAff?'#2d1b69':'#1e293b'; ctx.fill();
      ctx.fillStyle=canAff?gc:'#475569'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
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
    uiPanel(ctx, 6,sy,CW-12,32,5, '#0b0f1a', '#1f2937', 1);
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
      const ih=46, gc=GRADE_COLOR[def.grade]||'#94a3b8';
      uiPanel(ctx, 6,sy,CW-12,ih,5, '#120d1e', gc, 1);
      ctx.font='18px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='#e2e8f0';
      ctx.fillText(def.icon,12,sy+ih/2);
      ctx.fillStyle=gc; ctx.font='bold 10px sans-serif';
      ctx.fillText(`${def.name} ${rollStars(off.roll)}`,32,sy+ih/2-9);
      ctx.fillStyle='#cbd5e1'; ctx.font='bold 9px sans-serif';
      ctx.fillText(statsLine(skillStats(off)),32,sy+ih/2+5);
      const cost=skillOfferCost(off), canAff=gs.gold>=cost;
      const bw=74,bh=30,bx=CW-8-bw,by2=sy+(ih-bh)/2;
      roundRect(ctx,bx,by2,bw,bh,4); ctx.fillStyle=canAff?'#3b1d5e':'#1e293b'; ctx.fill();
      ctx.fillStyle=canAff?gc:'#475569'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${cost}💰`,bx+bw/2,by2+bh/2);
      gs.ui.skillBuyBtns.push({x:bx,y:by2,w:bw,h:bh,uid:off.uid});
      sy+=ih+4;
    }

    // ── ⚡ 액티브 스킬 매대 ────────────────────────────────────────────────
    // 위의 🔮스킬은 전부 패시브다. 액티브는 MP를 쓰고 쿨다운을 돌며,
    // 절반은 하단에 서서 상단을 건드린다 — 그래서 따로 판다.
    const aOffers = (heroGear(gs).activeOffers || []).map(activeDef).filter(Boolean);
    sy += 4;
    ctx.fillStyle='#c4b5fd'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText('⚡ 액티브 스킬', 8, sy);
    ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
    const _an = activeSlotCount(gs), _anx = nextActiveSlotLevel(gs);
    ctx.fillText(_an ? `칸 ${_an}개${_anx?` · Lv.${_anx}에 +1`:''}` : `영웅 Lv.${ACTIVE_SLOT_LEVELS[0]}에 칸이 열립니다`, CW-8, sy+1);
    ctx.textAlign='left'; sy += 14;
    if (!aOffers.length) {
      uiPanel(ctx, 6,sy,CW-12,30,5, '#0b0f1a', '#1f2937', 1);
      ctx.fillStyle='#4b5563'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('이번 웨이브 매물 없음 — 이미 다 배웠거나 팔렸습니다', CW/2, sy+15);
      ctx.textAlign='left'; sy += 34;
    }
    for (const d of aOffers) {
      const ih=48, gc=GRADE_COLOR[d.grade]||'#94a3b8';
      uiPanel(ctx, 6,sy,CW-12,ih,5, '#0f0d1e', gc, 1);
      ctx.font='18px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='#e2e8f0';
      ctx.fillText(d.icon,12,sy+ih/2);
      ctx.fillStyle=gc; ctx.font='bold 10px sans-serif';
      ctx.fillText(`${d.name}   ${activeLaneTag(d.lane)} · 💧${d.mp} · ${d.cd}s`, 32, sy+ih/2-11);
      ctx.fillStyle='#cbd5e1'; ctx.font='bold 9px sans-serif';
      ctx.fillText(d.desc, 32, sy+ih/2+2);
      ctx.fillStyle='#475569'; ctx.font='8px sans-serif';
      ctx.fillText(d.note, 32, sy+ih/2+14);
      const canAff = gs.gold>=d.cost;
      const bw=74,bh=30,bx=CW-8-bw,by2=sy+(ih-bh)/2;
      roundRect(ctx,bx,by2,bw,bh,4); ctx.fillStyle=canAff?'#3b1d5e':'#1e293b'; ctx.fill();
      ctx.fillStyle=canAff?gc:'#475569'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${d.cost}💰`,bx+bw/2,by2+bh/2);
      gs.ui.activeBuyBtns.push({x:bx,y:by2,w:bw,h:bh,id:d.id});
      ctx.textAlign='left';
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
  uiPanel(ctx, 8,8,74,34,7, '#1e293b', '#475569', 1);
  ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('← 전투',45,25);
  gs.ui.townPageBackBtn={x:8,y:8,w:74,h:34};

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
    uiPanel(ctx, tx,ty,tabW-4,th,5, active?'#1e3a5f':'#0f172a', active?'#60a5fa':'#1e293b', 1.5);
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

    uiPanel(ctx, bx,by,bw,bh,8, built?'#0d1929':'#080d18', built?def.color:'#334155', built?2:1);

    ctx.font='32px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(def.icon,bx+10,by+10);
    ctx.fillStyle=built?def.color:'#64748b'; ctx.font='bold 12px sans-serif'; ctx.fillText(def.name,bx+50,by+10);

    if (built) {
      const curLv=bs.level||0;
      ctx.fillStyle='#60a5fa'; ctx.font='bold 9px sans-serif';
      ctx.fillText(`Lv.${curLv+1}/${BUILDING_MAX_LEVEL}`,bx+50,by+26);
    }

    ctx.fillStyle='#94a3b8'; ctx.font='bold 10px sans-serif'; ctx.textBaseline='top'; ctx.fillText(def.desc,bx+10,by+52);

    if (built) {
      const curLv=bs.level||0;
      const open=buildingTracks(def,curLv);
      // 유한 트랙만 진행도로 센다 — 무한 트랙은 끝이 없으므로 분모가 될 수 없다
      const fin=open.filter(t=>!trackIsInfinite(t));
      // 분모는 지금 레벨에서 실제로 살 수 있는 횟수다.
      // 하드 상한을 적으면 승급 전에는 절대 못 채우는 숫자가 카드에 박힌다.
      const cap=fin.reduce((a,t)=>a+trackCapAt(t,curLv),0);
      const got=fin.reduce((a,t)=>a+(bs.upgrades[t.id]||0),0);
      const inf=open.filter(t=>trackIsInfinite(t)).reduce((a,t)=>a+(bs.upgrades[t.id]||0),0);
      ctx.fillStyle=(cap>0&&got>=cap)?'#22c55e':'#94a3b8'; ctx.font='bold 9px sans-serif';
      ctx.fillText(`강화 ${got}/${cap}${inf?`  ♾️×${inf}`:''}`,bx+10,by+68);
    }

    const btnY=by+bh-28,btnH=22,btnW=bw-20;
    roundRect(ctx,bx+10,btnY,btnW,btnH,5);
    if (!built) {
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
  uiPanel(ctx, 6,wrY,CW-12,wrH,6, '#0a0d1a', '#2a3f5f', 1);

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
  uiPanel(ctx, wbX,wbY,wbW,wbH,5, wrAff ? '#14532d' : '#1a1a2e', wrAff ? '#22c55e' : '#334155', 1);
  ctx.fillStyle = wrAff ? '#22c55e' : '#64748b'; ctx.font='bold 10px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(full ? '온전함' : `보수 ${wrCost}💰`, wbX+wbW/2, wbY+wbH/2);
  gs.ui.wallRepairBtn = full ? null : {x:wbX,y:wbY,w:wbW,h:wbH};

  gs.ui.researchBtn = null;   // 병기 연구는 없앴다 — 강화는 건물 안에서 한다

  const stripY = wrY + wrH + 5;
  uiPanel(ctx, 6,stripY,CW-12,44,6, '#0a0d1a', '#1e293b', 1);
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
  gs.ui.activeSlotBtns = [];

  // ── 머리글 ──────────────────────────────────────────────────────────────
  uiPanel(ctx, 6,y,CW-12,30,6, '#151f2e', COLORS.hero, 1.5);
  uiPanel(ctx, 8,y+3,62,26,5, '#1e293b', '#475569', 1);
  ctx.fillStyle='#cbd5e1'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('← 뒤로',39,y+16);
  gs.ui.heroBackBtn = {x:8,y:y+3,w:62,h:26};
  ctx.fillStyle=COLORS.hero; ctx.font='bold 12px sans-serif'; ctx.textAlign='left';
  ctx.fillText(`👑 영웅  Lv.${hero.level}`,68,y+15);
  const _sg = activeSigil();
  ctx.textAlign='right'; ctx.fillStyle=_sg.color; ctx.font='bold 9px sans-serif';
  ctx.fillText(`${_sg.icon} ${_sg.name} · ${_sg.skill.name}`, CW-12, y+15);
  ctx.textAlign='left';
  y += 36;

  // ── 왼쪽: 장비 칸 / 오른쪽: 스탯창 ───────────────────────────────────────
  const colW = 268, rowH = 32, gap = 3;
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
    uiPanel(ctx, 6,ry,colW,rowH,4, picked?'#20262e' : item?'#101a28':'#0a0f1a', picked?'#fbbf24' : fitHint?'#22c55e' : gc, (picked||fitHint)?1.6:1);
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
  uiPanel(ctx, panelX,y,panelW,panelH,5, '#0a0f1a', prev?'#fbbf24':'#1e293b', 1);
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
      uiPanel(ctx, 6,y,CW-12,32,5, '#141b26', '#fbbf24', 1);
      ctx.fillStyle='#e2e8f0'; ctx.font='bold 11px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(name, 12, y+16);
      const bw=76,bh=26,bx=CW-12-bw;
      roundRect(ctx,bx,y+3,bw,bh,5); ctx.fillStyle=color; ctx.fill();
      ctx.fillStyle='#07121a'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center';
      ctx.fillText(label, bx+bw/2, y+16);
      gs.ui.heroPickBtn={x:bx,y:y+3,w:bw,h:bh};
      ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 9px sans-serif';
      ctx.fillText('칸을 탭해도 됩니다', bx-8, y+16);
      ctx.textAlign='left';
      y += 38;
    }
  }

  // ── 🔮 스킬 칸 ──────────────────────────────────────────────────────────
  const nSlots = skillSlotCount(gs), nextLv = nextSkillSlotLevel(gs);
  ctx.fillStyle='#f0abfc'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`🔮 스킬 칸 ${nSlots}/${SKILL_SLOT_LEVELS.length}`,6,y);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
  ctx.fillText(nextLv ? `다음 칸 — 영웅 Lv.${nextLv}` : '모든 칸 개방', CW-6, y+1);
  ctx.textAlign='left'; y += 14;
  const skW = (CW-12-3*6)/4, skH = 50;
  for (let i=0;i<SKILL_SLOT_LEVELS.length;i++) {
    const sx = 6 + i*(skW+6);
    const open = i < nSlots;
    const e = open ? skillEquippedAt(gs, i) : null;
    const def = e ? skillDef(e.skillId) : null;
    const gc = def ? (GRADE_COLOR[def.grade]||'#94a3b8') : '#243044';
    uiPanel(ctx, sx,y,skW,skH,5, open ? (def?'#140f22':'#0a0f1a') : '#080b12', open ? gc : '#1a2130', def?1.5:1);
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

  // ── ⚡ 액티브 칸 ────────────────────────────────────────────────────────
  gs.ui.activeSlotBtns = [];
  const nAct = activeSlotCount(gs), nextAct = nextActiveSlotLevel(gs);
  const aSl = activeSlots(gs), owned = (g.actives || []);
  ctx.fillStyle='#38bdf8'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`\u26a1 \uc561\ud2f0\ube0c \uce78 ${nAct}/${ACTIVE_SLOT_LEVELS.length}`,6,y);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
  ctx.fillText(nextAct ? `\ub2e4\uc74c \uce78 \u2014 \uc601\uc6c5 Lv.${nextAct}` : '\ubaa8\ub4e0 \uce78 \uac1c\ubc29', CW-6, y+1);
  ctx.textAlign='left'; y += 14;
  const acW = (CW-12-6)/2, acH = 50;
  for (let i=0;i<ACTIVE_SLOT_LEVELS.length;i++) {
    const sx = 6 + i*(acW+6);
    const open = i < nAct;
    const def = open && aSl[i] ? activeDef(aSl[i]) : null;
    const gc = def ? (GRADE_COLOR[def.grade]||'#94a3b8') : '#243044';
    uiPanel(ctx, sx,y,acW,acH,5, open ? (def?'#0b1a24':'#0a0f1a') : '#080b12', open ? gc : '#1a2130', def?1.5:1);
    ctx.textAlign='center'; ctx.textBaseline='top';
    if (!open) {
      ctx.fillStyle='#334155'; ctx.font='13px sans-serif'; ctx.fillText('\ud83d\udd12',sx+acW/2,y+8);
      ctx.fillStyle='#334155'; ctx.font='bold 8px sans-serif';
      ctx.fillText(`Lv.${ACTIVE_SLOT_LEVELS[i]}`,sx+acW/2,y+28);
    } else if (def) {
      ctx.fillStyle='#e2e8f0'; ctx.font='15px sans-serif'; ctx.fillText(def.icon,sx+acW/2,y+4);
      ctx.fillStyle=gc; ctx.font='bold 9px sans-serif'; ctx.fillText(def.name,sx+acW/2,y+23);
      ctx.fillStyle='#5b6b80'; ctx.font='bold 7px sans-serif';
      ctx.fillText(`\ud83d\udca7${def.mp} \u00b7 ${def.cd}\ucd08 \u00b7 ${activeLaneTag(def.lane)}`,sx+acW/2,y+35);
      gs.ui.activeSlotBtns.push({x:sx,y,w:acW,h:acH,idx:i,id:def.id});
    } else {
      ctx.fillStyle='#334155'; ctx.font='14px sans-serif'; ctx.fillText('\uff0b',sx+acW/2,y+9);
      ctx.fillStyle='#334155'; ctx.font='bold 8px sans-serif'; ctx.fillText('\ube44\uc5b4 \uc788\uc74c',sx+acW/2,y+28);
      gs.ui.activeSlotBtns.push({x:sx,y,w:acW,h:acH,idx:i,id:null});
    }
  }
  ctx.textAlign='left'; y += acH + 8;

  // ── 배운 액티브 ─────────────────────────────────────────────────────────
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`\ubc30\uc6b4 \uc561\ud2f0\ube0c ${owned.length}\uac1c`,6,y);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
  ctx.fillText('\ud0ed\ud558\uba74 \uce78\uc5d0 \ub07c\uc6b0\uace0 / \ub2e4\uc2dc \ud0ed\ud558\uba74 \ube80\ub2e4', CW-6, y+1);
  ctx.textAlign='left'; y += 13;
  if (!owned.length) {
    uiPanel(ctx, 6,y,CW-12,26,4, '#0a0f1a', '#1a2130', 1);
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('\ud83c\udfea \uc601\uc6c5 \uc0c1\uc810\uc758 \u26a1 \uce78\uc5d0\uc11c \uc561\ud2f0\ube0c \uc2a4\ud0ac\uc744 \uc0b4 \uc218 \uc788\uc2b5\ub2c8\ub2e4',CW/2,y+13);
    ctx.textAlign='left'; y += 32;
  } else {
    const rH = 34;
    owned.forEach((id,i)=>{
      const def = activeDef(id); if (!def) return;
      const ry = y + i*(rH+4);
      const on = isActiveEquipped(gs, id);
      const gc = GRADE_COLOR[def.grade]||'#94a3b8';
      uiPanel(ctx, 6,ry,CW-12,rH,4, on?'#0b1a24':'#0a0f1a', on?'#38bdf8':gc, on?1.6:1);
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillStyle='#e2e8f0'; ctx.font='13px sans-serif'; ctx.fillText(def.icon,12,ry+rH/2);
      ctx.fillStyle=gc; ctx.font='bold 9px sans-serif';
      ctx.fillText(`${def.name}  ${activeLaneTag(def.lane)}`,30,ry+rH/2-6);
      ctx.fillStyle='#7c8ba1'; ctx.font='bold 8px sans-serif';
      ctx.fillText(`\ud83d\udca7${def.mp} \u00b7 \uc7ac\uc0ac\uc6a9 ${def.cd}\ucd08 \u00b7 ${def.desc}`,30,ry+rH/2+6);
      if (on) { ctx.textAlign='right'; ctx.fillStyle='#38bdf8'; ctx.font='bold 8px sans-serif';
                ctx.fillText('\uc7a5\ucc29 \uc911',CW-12,ry+rH/2); ctx.textAlign='left'; }
      gs.ui.activeSlotBtns.push({x:6,y:ry,w:CW-12,h:rH,idx:-1,id});
    });
    y += owned.length*(rH+4) + 6;
  }

  // ── 보유 스킬 ───────────────────────────────────────────────────────────
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif'; ctx.textBaseline='top';
  ctx.fillText(`보유 스킬 ${g.skills.length}개`,6,y); y += 13;
  if (!g.skills.length) {
    uiPanel(ctx, 6,y,CW-12,26,4, '#0a0f1a', '#1a2130', 1);
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`🏪 영웅 상점 Lv.${SKILL_SHOP_LEVEL}에서 스킬을 살 수 있습니다`,CW/2,y+13);
    ctx.textAlign='left'; y += 32;
  } else {
    const rH = 32;
    g.skills.forEach((e,i)=>{
      const def = skillDef(e.skillId); if (!def) return;
      const ry = y + i*(rH+4);
      const on = isSkillEquipped(gs, e.uid);
      const picked = pick && pick.kind==='skill' && pick.uid===e.uid;
      const gc = GRADE_COLOR[def.grade]||'#94a3b8';
      uiPanel(ctx, 6,ry,CW-12,rH,4, picked?'#20262e' : on?'#101a12':'#0a0f1a', picked?'#fbbf24' : on?'#22c55e':gc, picked?1.6:1);
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
    y += g.skills.length*(rH+4) + 6;
  }

  // ── 보관함 ──────────────────────────────────────────────────────────────
  ctx.fillStyle='#64748b'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`🎒 보관함 ${g.inventory.length}개`,6,y);
  ctx.textAlign='right'; ctx.fillStyle='#475569'; ctx.font='bold 8px sans-serif';
  ctx.fillText('탭해서 고르고 → 칸에 장착', CW-6, y+1);
  ctx.textAlign='left'; y += 13;
  if (!g.inventory.length) {
    uiPanel(ctx, 6,y,CW-12,26,4, '#0a0f1a', '#1a2130', 1);
    ctx.fillStyle='#334155'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🏪 영웅 상점에서 장비를 사면 여기에 쌓입니다',CW/2,y+13);
    ctx.textAlign='left'; y += 30;
  } else {
    const cols=4, cw=(CW-12-(cols-1)*6)/cols, chh=58;
    g.inventory.forEach((e,i)=>{
      const item = equipDef(e.itemId); if (!item) return;
      const col=i%cols, row=Math.floor(i/cols);
      const cx=6+col*(cw+6), cy=y+row*(chh+6);
      const on = isEquipped(gs, e.uid);
      const picked = pick && pick.kind==='item' && pick.uid===e.uid;
      const gc = GRADE_COLOR[item.grade]||'#94a3b8';
      uiPanel(ctx, cx,cy,cw,chh,5, picked?'#20262e' : on?'#101a12':'#0c1220', picked?'#fbbf24' : on?'#22c55e':gc, picked?1.8:1);
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillStyle='#e2e8f0'; ctx.font='21px sans-serif'; ctx.fillText(item.icon,cx+cw/2,cy+6);
      ctx.fillStyle=gc; ctx.font='bold 9px sans-serif'; ctx.fillText(item.name,cx+cw/2,cy+31);
      ctx.fillStyle= on?'#22c55e':'#475569'; ctx.font='bold 8px sans-serif';
      ctx.fillText(on?'장착 중':GRADE_NAME[item.grade]||'',cx+cw/2,cy+44);
      gs.ui.invCards.push({x:cx,y:cy,w:cw,h:chh,uid:e.uid});
    });
    y += Math.ceil(g.inventory.length/cols)*(chh+6) + 4;
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
  uiPanel(ctx, 6,y,CW-12,58,7, '#1a2535', hero.dead?'#7f1d1d':COLORS.hero, 2);
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
  const btnW2=(CW-20)/2,btnH2=44;
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
    uiPanel(ctx, cx,cy2,cardW,cardH,6, canAff?'#1e293b':'#111827', canAff?ut.color:'#374151', 1.5);
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
    uiPanel(ctx, 6,y,CW-12,spH,6, '#0c1220', '#1e293b', 1);
    ctx.fillStyle='#64748b'; ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🏨 마을에 여관을 지으면 특수 용병이 찾아옵니다', CW/2, y+spH/2);
    ctx.textAlign='left'; ctx.textBaseline='top';
  } else if (!offers.length) {
    uiPanel(ctx, 6,y,CW-12,spH,6, '#140d18', '#3f2447', 1);
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
      uiPanel(ctx, sx,y,sw,spH,6, canAff?'#241528':'#141018', canAff?ut.color:'#3f2447', 2);
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
    const ssCols=Math.max(1, Math.min(spMax, Math.floor((CW-12+6)/(52+6))));
    const ssW=Math.min(82,Math.floor((CW-12-(ssCols-1)*6)/ssCols));
    const ssH=44, ssTop=y;
    for (let i=0;i<spMax;i++) {
      const sx=6+(i%ssCols)*(ssW+6), u=sp[i];
      const y=ssTop+Math.floor(i/ssCols)*(ssH+6);
      uiPanel(ctx, sx,y,ssW,ssH,6, u?'#2a1530':'#0f0a14', u?(u.color||'#f472b6'):'#3f2447', 1.5);
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
    y = ssTop + Math.ceil(spMax/ssCols)*(ssH+6) + 2;
  }

  // ── 편성 슬롯 ────────────────────────────────────────────────────────────
  const hired=battle.ourTeam.filter(u=>!u.isHero && !(UNIT_TYPES[u.typeId]||{}).special);
  ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`편성된 병력 (${hired.length}/${battle.maxSlots})  ·  탭하면 해고`,6,y); y+=14;
  // 슬롯이 늘어나면 한 줄에 다 넣지 않고 다음 줄로 내린다.
  // 강화로 슬롯을 최대치까지 올리면 예전에는 화면 오른쪽으로 그대로 넘어갔다.
  const slotGap=6, SLOT_MIN=52;
  const perRow  = Math.max(1, Math.floor((CW-12+slotGap)/(SLOT_MIN+slotGap)));
  const slotCols= Math.min(battle.maxSlots, perRow);
  const slotW   = Math.min(82, Math.floor((CW-12-(slotCols-1)*slotGap)/slotCols));
  const slotH=56;
  gs.ui.hiredSlots=[];
  for (let i=0;i<battle.maxSlots;i++) {
    const sx=6+(i%slotCols)*(slotW+slotGap), sy=y+Math.floor(i/slotCols)*(slotH+slotGap);
    const unit=hired[i];
    uiPanel(ctx, sx,sy,slotW,slotH,6, unit?'#1e3a5f':'#0f172a', unit?(unit.color||'#60a5fa'):'#334155', 1.5);
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
  y += Math.ceil(battle.maxSlots/slotCols)*(slotH+slotGap) + 4;

  // ── 💰 현상수배 소환 ─────────────────────────────────────────────────────
  // 준비 화면이 아니라 여기에 둔다 — 전투 준비는 전부 마을에서 끝나야 한다.
  const charges = bountyCharges(gs.wave);
  const left    = Math.max(0, charges - gs.bountyUsed);
  const on      = gs.bountyPending;
  const bh3 = 36;
  uiPanel(ctx, 6, y, CW-12, bh3, 7, on ? '#3b2a08' : left > 0 ? '#141c2e' : '#0e1017', on ? '#fbbf24' : left > 0 ? '#a16207' : '#252b38', on ? 2 : 1);
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
  uiPanel(ctx, 6, y, CW-12, bh3, 7, eOn ? '#2a1f08' : eLeft > 0 ? '#141c2e' : '#0e1017', eOn ? '#fbbf24' : eLeft > 0 ? '#a16207' : '#252b38', eOn ? 2 : 1);
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

  // ── 🐲 중간보스 예고 ─────────────────────────────────────────────────────
  // 출전 버튼 바로 위에 둔다. 영웅을 위로 보낼지 아래로 보낼지가 이 한 줄에
  // 달려 있으므로, 배치 버튼과 출전 버튼 사이가 이 정보의 자리다.
  {
    const mTier = endlessTier(gs.wave);
    if (gs.mode === 'endless' && isMidBossTier(mTier)) {
      const up = midBossSide(mTier) === 'defense';
      uiPanel(ctx, 6, y, CW-12, 34, 6, up ? '#2a1208' : '#1a0a24', up ? '#f97316' : '#a855f7', 2);
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillStyle = up ? '#fb923c' : '#c084fc'; ctx.font='bold 11px sans-serif';
      ctx.fillText(`🐲 ${midBossName(mTier)}`, 14, y+12);
      ctx.fillStyle='#94a3b8'; ctx.font='bold 9px sans-serif';
      ctx.fillText(up ? '상단 타워라인에 나타납니다 — 타워와 과부하를 준비하세요'
                      : '하단 아레나에 나타납니다 — 부대와 영웅을 아래로', 14, y+25);
      y += 40;
    }
  }

  // ── 출전 버튼 ────────────────────────────────────────────────────────────
  // 영웅 배치는 필수다 — 상단이든 하단이든 어딘가에는 서야 한다.
  const hasTeam  = battle.ourTeam.length>0;
  const heroSet  = hero.placement !== 'none' || hero.dead;
  const ready    = hasTeam && heroSet;
  const why = !hasTeam ? '병력을 1명 이상 고용하세요'
            : !heroSet ? '👑 영웅을 상단 또는 하단에 배치하세요'
            : '▶ 출전! 웨이브 시작';
  uiPanel(ctx, 6,y,CW-12,44,8, ready?'#15803d':'#1f2937', ready?'#22c55e':(!heroSet&&hasTeam?'#f59e0b':'#374151'), 2);
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
    uiPanel(ctx, 6,y,CW-12,boxH,7, '#080d18', '#161f30', 1);
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
  ctx.fillText('타워를 고르고 → 빈 셀을 탭하면 ◎사거리를 보여줍니다 → 확인 후 배치', CW/2, startY);

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
    uiPanel(ctx, bx,by,pw,ph,6, sel?'#152b45' : afford?'#111c2e':'#0e1017', sel?tpl.color : afford?'#334155':'#252b38', sel?2:1);

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
    // ◎ 사거리 — 몇 칸까지 닿는지. 고르기 전에 견줄 수 있어야 한다.
    ctx.fillStyle='#7dd3fc'; ctx.font='bold 8px sans-serif';
    ctx.fillText(`◎${(tpl.range / CELL_W).toFixed(1)}칸`, bx+6, by+52);
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
      // 🔀 이설 모드 — 갈 수 있는 칸은 파랗게, 맞바꿀 타워는 보랗게
      const mv = gs.ui.towerMove;
      if (mv) {
        const isSrc = mv.col===c && mv.row===r;
        const occupied = gs.towers.some(tw=>tw.col===c&&tw.row===r);
        if (isSrc) {
          ctx.fillStyle='rgba(129,140,248,0.35)'; ctx.fillRect(x+1,y+1,mCW-2,mCH-2);
        } else if (occupied) {
          ctx.fillStyle='rgba(168,85,247,0.22)'; ctx.fillRect(x+1,y+1,mCW-2,mCH-2);
        } else if (!isBlockedCell(c,r)) {
          ctx.fillStyle='rgba(96,165,250,0.20)'; ctx.fillRect(x+1,y+1,mCW-2,mCH-2);
          ctx.strokeStyle='rgba(96,165,250,0.55)'; ctx.lineWidth=1;
          ctx.strokeRect(x+1.5,y+1.5,mCW-3,mCH-3);
        }
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
        // ★5 분기를 골랐으면 무엇으로 갔는지 칸 위에서 바로 읽혀야 한다
        const _mb = towerBranchOf(tower);
        if (_mb) {
          ctx.font='8px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='top';
          ctx.fillText(_mb.icon, x+mCW-1, y+1);
          ctx.textAlign='center';
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

  // ── ◎ 사거리 ─────────────────────────────────────────────────────────────
  // 예전에는 빈 칸을 누르면 그 자리에서 바로 세워졌다. 어디까지 닿는지는
  // 세워 본 뒤에야 알 수 있었고, 잘못 놓으면 이설비를 물거나 60% 손해를 보고 팔아야 했다.
  // 이제 한 단계를 끼워 넣는다 — 고르고, 놓아 보고(사거리를 보고), 확정한다.
  const _mg = gs.ui.towerMiniGrid;
  const _plan = gs.ui.towerPlan;
  if (_plan) drawMiniRange(ctx, _mg, _plan.col, _plan.row,
                           plannedTowerRange(_plan.typeId), TOWER_TYPES[_plan.typeId].color, true);
  else if (gs.ui.towerAction) {
    const _sel = gs.towers.find(tw=>tw.col===gs.ui.towerAction.col&&tw.row===gs.ui.towerAction.row);
    if (_sel) drawMiniRange(ctx, _mg, _sel.col, _sel.row,
                            towerStats(_sel).range, TOWER_TYPES[_sel.typeId].color, false);
  }

  // ── 배치 확인 패널 ───────────────────────────────────────────────────────
  // 놓을 자리를 집었으면, 세우기 전에 무엇이 어떻게 서는지 한 번 보여준다.
  const panelY=offY+gridH+8;
  gs.ui.towerBranchBtns=[];
  gs.ui.planConfirmBtn=null; gs.ui.planCancelBtn=null;
  if (_plan) {
    const tpl2 = TOWER_TYPES[_plan.typeId];
    const cost2 = towerBuildCost(_plan.typeId, gs.towers);
    const can2  = gs.gold >= cost2;
    const tmp   = makeTower(_plan.col, _plan.row, _plan.typeId);
    const st2   = towerStats(tmp);
    const ph2 = 74;
    uiPanel(ctx, 6, panelY, CW-12, ph2, 7, '#0d1929', tpl2.color, 1.5);
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle='#e2e8f0'; ctx.font='20px sans-serif';
    ctx.fillText(tpl2.icon, 14, panelY+20);
    ctx.fillStyle='#f1f5f9'; ctx.font='bold 12px sans-serif';
    ctx.fillText(`${tpl2.name}  →  ${_plan.col+1}열 ${_plan.row+1}행`, 42, panelY+13);
    ctx.fillStyle='#7dd3fc'; ctx.font='bold 10px sans-serif';
    ctx.fillText(`ATK ${st2.dmg}   ${st2.spd.toFixed(2)}/s   ◎ ${(st2.range/CELL_W).toFixed(1)}칸`, 42, panelY+29);
    // 이 자리에서 경로를 몇 칸이나 덮는지 — 사거리 원보다 이 숫자가 더 정직하다
    const covered = pathCellsInRange(_plan.col, _plan.row, st2.range);
    ctx.textAlign='right';
    ctx.fillStyle = covered > 0 ? '#4ade80' : '#ef4444'; ctx.font='bold 10px sans-serif';
    ctx.fillText(covered > 0 ? `경로 ${covered}칸 사정권` : '경로에 닿지 않습니다', CW-14, panelY+13);
    ctx.fillStyle = can2 ? COLORS.gold : '#ef4444'; ctx.font='bold 11px sans-serif';
    ctx.fillText(`${cost2}💰`, CW-14, panelY+29);
    ctx.textAlign='left';
    const cbw=150, cbh=26;
    drawBtn(ctx, 10, panelY+42, cbw, cbh,
            can2 ? `✔ 여기에 세운다  ${cost2}💰` : '골드 부족',
            can2?'#14532d':'#1f2937', can2?'#4ade80':'#6b7280', can2);
    if (can2) gs.ui.planConfirmBtn={x:10,y:panelY+42,w:cbw,h:cbh};
    const xbw=92, xbx=CW-10-xbw;
    drawBtn(ctx, xbx, panelY+42, xbw, cbh, '✕ 취소', '#3f1515', '#f87171');
    gs.ui.planCancelBtn={x:xbx,y:panelY+42,w:xbw,h:cbh};
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle='#475569'; ctx.font='8px sans-serif';
    ctx.fillText('다른 칸을 탭하면 그리로 옮겨집니다', 168, panelY+55);
    _townBottom = panelY + ph2 + 10;
    ctx.textAlign='left'; ctx.textBaseline='top';
    return;
  }
  // ★5 분기 칸이 붙으면 패널이 그만큼 길어진다
  let panelH = 72;
  const _selTower = gs.ui.towerAction
      ? gs.towers.find(tw=>tw.col===gs.ui.towerAction.col&&tw.row===gs.ui.towerAction.row) : null;
  const _showBranch = !!_selTower && (_selTower.level||1) >= TOWER_BRANCH_LEVEL
                      && towerBranches(_selTower.typeId).length > 0;
  if (_showBranch) panelH += 92;
  if (gs.ui.towerAction) {
    const ta=gs.ui.towerAction;
    const tower=_selTower;
    if (tower) {
      const lv=tower.level||1;
      const tpl=TOWER_TYPES[tower.typeId];
      const st=towerStats(tower);
      const br=towerBranchOf(tower);
      uiPanel(ctx, 6,panelY,CW-12,panelH,7, '#0d1929', br?br.color:tpl.color, 1.5);
      ctx.fillStyle='#e2e8f0';
      ctx.font='20px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(tpl.icon,14,panelY+20);
      ctx.fillStyle='#f1f5f9'; ctx.font='bold 12px sans-serif';
      const nameTxt=`${tpl.name}  Lv.${lv}/${towerLevelCap()}`;
      ctx.fillText(nameTxt,42,panelY+13);
      if (br) {   // 고른 분기를 이름 옆에 붙인다 — 이 타워가 무엇이 됐는지
        const nw=ctx.measureText(nameTxt).width;
        ctx.fillStyle=br.color; ctx.font='bold 10px sans-serif';
        ctx.fillText(`${br.icon} ${br.name}`, 42+nw+8, panelY+13);
      }
      ctx.fillStyle='#94a3b8'; ctx.font='bold 10px sans-serif';
      if (gs.ui.towerMove && gs.ui.towerMove.col===tower.col && gs.ui.towerMove.row===tower.row) {
        ctx.fillStyle='#a5b4fc';
        ctx.fillText(`옮길 칸을 고르세요 — 빈 칸 ${towerMoveCost(tower)}💰 · 타워끼리 교환은 두 배`,42,panelY+29);
      } else {
        ctx.fillText(`ATK ${st.dmg}   ${st.spd.toFixed(2)}/s   사거리 ${Math.round(st.range)}px   처치 ${tower.kills}`,42,panelY+29);
      }

      // 등급별 실효 피해 — 이 타워가 무엇을 잘 잡는지. 분기를 고르면 이 줄이 다시 쓰인다.
      const aff = towerAffinityRow(tower.typeId, tower.branch);
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
      // 🔀 이설 — 경로가 바뀌었을 때 배치를 통째로 다시 하지 않아도 되게
      const mvOn  = !!(gs.ui.towerMove && gs.ui.towerMove.col===tower.col && gs.ui.towerMove.row===tower.row);
      const mvCost= towerMoveCost(tower);
      const mvAff = gs.gold >= mvCost;
      const mbw=88, mbx=166;
      drawBtn(ctx,mbx,panelY+42,mbw,26,
              mvOn ? '✕ 취소' : `🔀 이동 ${mvCost}💰`,
              mvOn ? '#312e81' : (mvAff?'#1e2a4f':'#1e293b'),
              mvOn ? '#a5b4fc' : (mvAff?'#818cf8':'#64748b'), mvAff || mvOn);
      gs.ui.towerMoveBtn={x:mbx,y:panelY+42,w:mbw,h:26};

      const rbw=92,rbh=26,rbx=CW-10-rbw;
      drawBtn(ctx,rbx,panelY+42,rbw,rbh,`🗑 +${towerSellValue(tower)}💰`,'#3f1515','#ef4444');
      gs.ui.towerRemoveBtn={x:rbx,y:panelY+42,w:rbw,h:rbh};

      // ── ★5 분기 ────────────────────────────────────────────────────────
      // 세 갈래를 나란히 놓고, 고른 것에 테두리를 준다. 값은 처음이 싸고 갈아타면 비싸다.
      if (_showBranch) {
        const brs = towerBranches(tower.typeId);
        const bY = panelY + 74;
        const cost = br ? towerRebranchCost(tower) : towerBranchCost(tower);
        ctx.textAlign='left'; ctx.textBaseline='middle';
        ctx.fillStyle=br?'#64748b':'#fbbf24'; ctx.font='bold 9px sans-serif';
        ctx.fillText(br ? `★${TOWER_BRANCH_LEVEL} 분기 — 갈아타기 ${cost}💰 (한 번에 하나만)`
                        : `★${TOWER_BRANCH_LEVEL} 분기 — 하나를 고르세요 ${cost}💰`, 12, bY+5);
        const bw3=(CW-20-2*5)/3, bh3=68, byy=bY+12;
        brs.forEach((d,i)=>{
          const bx3 = 10 + i*(bw3+5);
          const on  = tower.branch === d.id;
          const can = gs.gold >= cost && !on;
          uiPanel(ctx, bx3,byy,bw3,bh3,5, on ? '#111f2e' : can ? '#0a1422' : '#080c14', on ? d.color : can ? '#2b3a52' : '#1a2130', on ? 2 : 1);
          ctx.textAlign='center'; ctx.textBaseline='top';
          ctx.globalAlpha = (on || can) ? 1 : 0.45;
          ctx.fillStyle='#e2e8f0'; ctx.font='14px sans-serif';
          ctx.fillText(d.icon, bx3+bw3/2, byy+4);
          ctx.fillStyle=d.color; ctx.font='bold 10px sans-serif';
          ctx.fillText(d.name, bx3+bw3/2, byy+22);
          ctx.fillStyle='#7c8ba1'; ctx.font='bold 7px sans-serif';
          // 세 줄까지 — 두 줄로 자르면 "받는 피해 +30%" 같은 핵심이 잘려 나간다
          wrapLines(ctx, d.desc, bw3-8).slice(0,3).forEach((ln,k)=>{
            ctx.fillText(ln, bx3+bw3/2, byy+34+k*9);
          });
          ctx.globalAlpha = 1;
          if (on) {
            ctx.fillStyle=d.color; ctx.font='bold 7px sans-serif';
            ctx.fillText('◆ 선택됨', bx3+bw3/2, byy+bh3-10);
          }
          gs.ui.towerBranchBtns.push({x:bx3,y:byy,w:bw3,h:bh3,branchId:d.id});
        });
        ctx.textAlign='left'; ctx.textBaseline='middle';
      }
    }
  } else {
    const tpl=TOWER_TYPES[gs.selectedTowerType]||TOWER_TYPES.arrow;
    uiPanel(ctx, 6,panelY,CW-12,72,7, '#080d18', '#1e293b', 1);
    ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`선택: ${tpl.icon} ${tpl.name} — ${towerBuildCost(gs.selectedTowerType, gs.towers)}💰`,CW/2,panelY+20);
    ctx.fillStyle='#64748b'; ctx.font='bold 10px sans-serif';
    ctx.fillText(tpl.desc,CW/2,panelY+38);
    ctx.fillStyle='#475569'; ctx.font='10px sans-serif';
    ctx.fillText('빈 셀 탭 = 건설 / 세운 타워 탭 = 강화·이동·판매',CW/2,panelY+56);
    gs.ui.towerUpgradeBtn=null; gs.ui.towerRemoveBtn=null; gs.ui.towerMoveBtn=null;
  }

  // ── 배치 요약 ────────────────────────────────────────────────────────────
  // 높이를 화면 잔여분(CH-infoY)이 아니라 내용에 맞춰 잡는다 — 페이지가 스크롤되므로
  const infoY=panelY+panelH+8;
  const infoH=Math.max(150, 60 + Object.keys(
    gs.towers.reduce((m,t)=>{ m[t.typeId]=1; return m; }, {})).length*20 + 70);
  uiPanel(ctx, 6,infoY,CW-12,infoH,7, '#080d18', '#161f30', 1);
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
  // ★5 분기를 고른 타워가 있으면 어느 갈래에 몇 기인지 한 줄로 접어 보여준다
  const brCount = {};
  for (const t of gs.towers) if (t.branch) brCount[t.branch] = (brCount[t.branch] || 0) + 1;
  const brKeys = Object.keys(brCount);
  if (brKeys.length) {
    ctx.fillStyle='#7c8ba1'; ctx.font='bold 9px sans-serif';
    const parts = brKeys.map(k => {
      const d = TOWER_ORDER.map(tt => branchDef(tt, k)).find(Boolean);
      return d ? `${d.icon}${d.name} ${brCount[k]}` : null;
    }).filter(Boolean);
    for (const ln of wrapLines(ctx, '★5 분기 — ' + parts.join('  ·  '), CW-36)) {
      ctx.fillText(ln, 18, ry); ry += 12;
    }
    ry += 4;
  }
  ctx.fillStyle='#475569'; ctx.font='9px sans-serif';
  ctx.fillText('같은 종류를 많이 지을수록 건설비가 오릅니다.',18,ry);
  ry+=13;
  ctx.fillText('∞ 경로는 같은 칸을 두 번 지나므로 교차 지점이 가장 효율적입니다.',18,ry);
  _townBottom = Math.max(infoY + infoH, ry + 16);
}

// ─── 🧭 첫걸음 안내 ──────────────────────────────────────────────────────────
// 짚는 자리만 남기고 나머지를 덮는다. 덮개는 **그림일 뿐** — 탭은 그대로 통과한다.
// 여기서 입력을 막으면 "진짜 버튼을 진짜로 누른다"는 전제가 깨진다.
function renderGuide(ctx, gs) {
  gs.ui.guideSkipBtn = null;
  if (typeof guide === 'undefined' || !guide.active) return;
  const view = guide.view(gs);
  if (!view) return;                        // 다른 페이지에 있어 짚을 것이 없을 때만 감춘다
  // (단계 객체는 view가 들고 있다)
  const spot = view.rect;
  const accent = view.detour ? '#38bdf8' : '#fbbf24';   // 우회 안내는 색을 달리해 구분한다
  const t = (Date.now() % 1200) / 1200;

  // ── 덮개 — 짚은 자리만 도려낸다 ────────────────────────────────────────
  ctx.save();
  if (spot) {
    const pad = 6;
    const sx = spot.x - pad, sy = spot.y - pad;
    const sw = spot.w + pad*2, sh = spot.h + pad*2;
    // 구멍 뚫기 — roundRect 헬퍼는 안에서 beginPath를 부르므로 여기서는 쓸 수 없다.
    // 헬퍼를 부르면 방금 쌓은 전체 화면 사각형이 지워져서, 짚은 자리에 구멍이 나는 대신
    // 그 자리만 불투명하게 덮여 버린다 (버튼이 안내에 가려져 안 보이던 원인).
    const rr = Math.max(0, Math.min(8, sw/2, sh/2));
    ctx.beginPath();
    ctx.rect(0, 0, CW, CH);
    ctx.moveTo(sx+rr, sy);
    ctx.lineTo(sx+sw-rr, sy);      ctx.arcTo(sx+sw, sy,      sx+sw, sy+rr,      rr);
    ctx.lineTo(sx+sw, sy+sh-rr);   ctx.arcTo(sx+sw, sy+sh,   sx+sw-rr, sy+sh,   rr);
    ctx.lineTo(sx+rr, sy+sh);      ctx.arcTo(sx, sy+sh,      sx, sy+sh-rr,      rr);
    ctx.lineTo(sx, sy+rr);         ctx.arcTo(sx, sy,         sx+rr, sy,         rr);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4,7,14,0.62)';
    ctx.fill('evenodd');
    // 짚은 자리 테두리 — 숨 쉬듯 굵기가 오간다
    roundRect(ctx, sx, sy, sw, sh, 8);
    ctx.strokeStyle = accent; ctx.lineWidth = 2 + Math.sin(t * Math.PI*2) * 1.2;
    ctx.stroke();
    // 바깥으로 퍼지는 고리
    roundRect(ctx, sx - t*8, sy - t*8, sw + t*16, sh + t*16, 10);
    ctx.strokeStyle = view.detour ? `rgba(56,189,248,${0.55*(1-t)})` : `rgba(251,191,36,${0.55*(1-t)})`;
    ctx.lineWidth = 2; ctx.stroke();
  } else {
    // 짚을 곳이 없는 단계(예: 전투를 지켜보라는 안내)는 화면을 거의 덮지 않는다.
    // 55%로 덮었더니 "두 전선이 함께 굴러가는 걸 보라"면서 그 전선을 가리고 있었다.
    ctx.fillStyle = 'rgba(4,7,14,0.22)';
    ctx.fillRect(0, 0, CW, CH);
  }
  ctx.restore();

  // ── 말풍선 — 짚은 자리를 가리지 않는 쪽에 붙인다 ───────────────────────
  const lines = String(view.text).split('\n');
  const bw = CW - 36, bh = 34 + lines.length * 15 + 12;
  let by;
  if (!spot)                       by = CH/2 - bh/2;
  else if (spot.y > CH * 0.45)     by = Math.max(70, spot.y - bh - 26);   // 짚은 곳이 아래면 위로
  else                             by = Math.min(CH - bh - 20, spot.y + spot.h + 26);
  const bx = 18;

  uiPanel(ctx, bx, by, bw, bh, 9, '#0b1220', accent, 2);
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle=accent; ctx.font='bold 12px sans-serif';
  ctx.fillText(`🧭 ${view.title}`, bx+14, by+11);
  ctx.fillStyle='#7c8ba1'; ctx.font='bold 9px sans-serif'; ctx.textAlign='right';
  ctx.fillText(`${guide.step+1} / ${GUIDE_STEPS.length}`, bx+bw-14, by+12);
  ctx.textAlign='left';
  ctx.fillStyle='#e2e8f0'; ctx.font='11px sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, bx+14, by+32 + i*15));

  // 진행 막대 — 몇 걸음 남았는지
  const pw2 = bw - 28, py2 = by + bh - 9;
  ctx.fillStyle='#1e293b'; ctx.fillRect(bx+14, py2, pw2, 3);
  ctx.fillStyle=accent;
  ctx.fillRect(bx+14, py2, pw2 * ((guide.step+1) / GUIDE_STEPS.length), 3);

  // 건너뛰기 — 안내를 못 끄면 그건 안내가 아니라 벽이다
  const kw = 74, kh = 22, kx = CW - kw - 12, ky = 8;
  uiPanel(ctx, kx, ky, kw, kh, 5, '#1e293b', '#64748b', 1);
  ctx.fillStyle='#94a3b8'; ctx.font='bold 10px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('안내 끄기', kx+kw/2, ky+kh/2);
  gs.ui.guideSkipBtn = { x:kx, y:ky, w:kw, h:kh };
  ctx.textAlign='left'; ctx.textBaseline='top';
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
  uiPanel(ctx, cx,cy,cw,ch,10, '#0f172a', isTip?'#22d3ee':'#6366f1', 2);

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
  const bw=126, bh=28, by=cy+ch+12;
  const left = tipsRemaining();
  if (!isTip && tut.step > 0) {
    const bx=cx;
    uiPanel(ctx, bx,by,78,bh,6, '#111827', '#334155', 1);
    ctx.fillStyle='#94a3b8'; ctx.font='bold 11px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('◀ 이전', bx+39, by+bh/2);
    gs.ui.tutBackBtn={x:bx,y:by,w:78,h:bh};
  }
  const sx=cx+cw-bw;
  uiPanel(ctx, sx,by,bw,bh,6, '#1c1420', '#4b5563', 1);
  ctx.fillStyle='#cbd5e1'; ctx.font='bold 11px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const rewardable = typeof tutorialEverSeen === 'function' && !tutorialEverSeen();
  if (rewardable) {
    ctx.fillStyle='#fbbf24'; ctx.font='bold 11px sans-serif';
    ctx.fillText(`⏭ 건너뛰기 💎+${TUTORIAL_SKIP_GEMS}`, sx+bw/2, by+bh/2-5);
    ctx.fillStyle='#64748b'; ctx.font='8px sans-serif';
    ctx.fillText('안내는 다시 뜨지 않습니다', sx+bw/2, by+bh/2+8);
  } else {
    ctx.fillText('✕ 안내 전부 끄기', sx+bw/2, by+bh/2-5);
    ctx.fillStyle='#64748b'; ctx.font='8px sans-serif';
    ctx.fillText(left ? `남은 안내 ${left}장까지` : '다시 안 뜹니다', sx+bw/2, by+bh/2+8);
  }
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
  uiPanel(ctx, rx, ry, rw, rh, 17, arming ? 'rgba(127,29,29,0.92)' : 'rgba(15,23,42,0.72)', arming ? '#ef4444' : 'rgba(148,163,184,0.45)', arming ? 2 : 1);
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
