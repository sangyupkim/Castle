// ─── 글자 크기 회귀 검사 ──────────────────────────────────────────────────────
// 실행: node tools/text-size-check.mjs  (저장소 어디서든)
//
// 캔버스는 폰에서 줄어든다 — 360px 폰이면 배율 0.75다. 그래서 "코드에 몇 px을
// 적었나"가 아니라 **"화면에 몇 px으로 그려지나"**를 재야 한다.
//
// 화면을 실제로 그리게 하고 ctx.fillText를 가로채, 그려진 글자를 크기별로 센다.
// 문장을 작게 쓴 자리가 다시 생기면 여기서 걸린다.
//
// 태그(S/M/L)나 떠오르는 숫자처럼 짧은 것은 작아도 읽힌다. 그래서 길이로 가른다 —
// MIN_SENTENCE자 이상인 것만 '문장'으로 보고 하한을 요구한다.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8917;

const PHONE_SCALE  = 0.75;   // 360px 폰 — 가장 작은 흔한 기기
const MIN_ON_PHONE = 9.5;    // 화면에서 이보다 작은 문장은 없어야 한다
const MIN_SENTENCE = 6;      // 이 글자 수부터 '문장'으로 본다

const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.png':'image/png', '.jpg':'image/jpeg', '.webmanifest':'application/manifest+json',
  '.json':'application/json', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' ) p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream',
                         'cache-control': 'no-store' });
    res.end(buf);
  } catch { res.writeHead(404).end(); }
});

const chromium = (() => {
  const require = createRequire(import.meta.url);
  for (const base of ['/opt/node22/lib/node_modules/playwright', 'playwright']) {
    try { return require(base).chromium; } catch {}
  }
  return null;
})();

if (!chromium) {
  console.error('playwright를 찾지 못했습니다. NODE_PATH에 playwright가 있어야 합니다.');
  process.exit(2);
}

await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const pg = await browser.newPage({ viewport: { width: 520, height: 1060 }, deviceScaleFactor: 1 });
await pg.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
await pg.waitForFunction(() => typeof Sprites !== 'undefined' && Sprites.ready, null, { timeout: 30000 });

const report = await pg.evaluate(({ scale, minPx, minLen }) => {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const cx = c.getContext('2d');
  let log = [];
  const orig = cx.fillText.bind(cx);
  // 글자 하나를 그릴 때마다 **실제로 차지하는 사각형**을 같이 적어 둔다.
  // 크기만 봐서는 "13px인데 서로 겹쳐서 못 읽는" 경우를 못 잡는다 —
  // 사용자가 스크린샷으로 알려 준 문제가 전부 그것이었다.
  cx.fillText = function (t, x, y, m) {
    const px = parseInt((this.font.match(/(\d+)px/) || [])[1] || 0, 10);
    const s = String(t);
    let box = null;
    try {
      const mt = this.measureText(s);
      const w  = mt.width;
      const asc = mt.actualBoundingBoxAscent  || px * 0.8;
      const des = mt.actualBoundingBoxDescent || px * 0.2;
      const al = this.textAlign, bl = this.textBaseline;
      const x0 = al === 'center' ? x - w / 2 : (al === 'right' || al === 'end') ? x - w : x;
      // 세로는 baseline마다 기준이 다르다. 실제 잉크가 닿는 위쪽/아래쪽을 잡는다.
      let yTop;
      if (bl === 'top' || bl === 'hanging')            yTop = y;
      else if (bl === 'middle')                        yTop = y - (asc + des) / 2;
      else                                             yTop = y - asc;   // alphabetic·bottom
      box = { x: x0, y: yTop, w, h: asc + des };
    } catch (e) {}
    log.push([px, s, box]);
    return orig(t, x, y, m);
  };
  const st = (patch) => { const d = newState(); d.battle = createBattle(); Object.assign(d, patch || {}); return d; };
  // ⚠️ newState()가 주는 객체에서 skillLevels·pacts 같은 **영구 데이터**는 getter/setter라
  // 모듈 전역(_skillLevels)을 그대로 가리킨다. 한 화면을 위해 채워 놓으면
  // 그 뒤에 재는 화면이 전부 그 값을 물고 간다 — 무엇을 쟀는지가 순서에 따라 달라진다.
  // 채워 넣고 재는 화면은 이 도우미로 감싸서 원래대로 돌려놓는다.
  const withMeta = (d, levels, pactIds, fn) => {
    const savedSkills = Object.assign({}, d.skillLevels);
    d.skillLevels = levels;
    for (const id of pactIds) togglePact(id, d);
    try { fn(); }
    finally { for (const id of pactIds) togglePact(id, d); d.skillLevels = savedSkills; }
  };
  const screens = {
    '전투 · 상단':     () => renderDefense(cx, st({ page:'battle', inRun:true, waveActive:true, wave:6 })),
    '전투 · 가운데 바': () => renderUIBar(cx, st({ page:'battle', inRun:true, wave:6 }),
                                        { phase:'active', timer:34, intermissionTimer:0 }),
    '전투 · 아레나':   () => { const d = st({ page:'battle', inRun:true, waveActive:true });
                              d.battle.phase = 'fighting'; renderArenaPhase(cx, d); },
    '전투 · 조작':     () => { const d = st({ page:'battle', inRun:true, waveActive:true });
                              d.battle.phase = 'fighting'; renderBattleControls(cx, d); },
    // ── 2단계 · 목록 화면 ──────────────────────────────────────────────
    '준비 브리핑':      () => { const d = st({ page:'battle', inRun:true });
                              d.battle.phase = 'hire'; renderBriefing(cx, d, BATTLE_Y); },
    // 🧾 수입 상자는 웨이브를 한 번 치른 뒤에만 생긴다 — 빈 판만 재면 못 본다
    '준비 브리핑 · 정산':  () => {
      const d = st({ page:'battle', inRun:true, wave:23 });
      d.battle.phase = 'hire';
      d.lastWave = { idx:23, top:1842, bot:2571, kill:388, win:100, clear:104, left:12,
                     result:'cleared', total:5005 };
      renderBriefing(cx, d, BATTLE_Y);
    },
    // 📄 준비 화면의 정보 카드를 눌러 열리는 상세 시트 다섯 장.
    // 카드로 접어 둔 만큼 **읽히는 곳은 여기**다 — 여기가 작으면 접은 의미가 없다.
    ...Object.fromEntries(['arena','defense','team','rules','income'].map(id => [
      `준비 시트 · ${id}`,
      () => {
        const d = st({ page:'battle', inRun:true, wave:46 });
        d.battle.phase = 'hire';
        d.gold = 1e6;
        for (const t of ['swordsman','archer','guardian']) d.gold = hireUnit(d.battle, t, d.gold);
        d.hero.placement = 'battle';
        d.activeUpgrades = UPGRADE_CARDS.slice(0, 4).map(c => c.id);
        d.lastWave = { idx:46, top:812, bot:1759, kill:388, win:100, clear:104, left:9,
                       result:'cleared', total:3163 };
        openBriefSheet(d, id);
        renderSheet(cx, d);
        closeSheet();
      },
    ])),
    '마을':            () => renderTownPage(cx, st({ page:'town', gold:420 })),
    '마을 · 병력':      () => renderTownPageArmy(cx, st({ page:'town', gold:420 }), 92),
    '마을 · 타워':      () => renderTownPageTowers(cx, st({ page:'town', gold:420 }), 92),
    '캠프':            () => renderLobbyCamp(cx, st({ page:'lobby' })),
    '출전 준비':        () => renderLobbySortie(cx, st({ page:'lobby' })),
    // 빈 세이브로만 재면 **채워졌을 때 넘치는 상자**를 영영 못 본다.
    // 서약 상자와 「적용 중인 스킬」 줄이 정확히 그래서 겹쳐 있었다.
    '출전 준비 · 채운 판':  () => {
      const d = st({ page:'lobby', soulStones:5000 });
      const lv = {};
      for (const tid of SKILL_TREE_ORDER)
        for (const sk of SKILL_TREES[tid].skills) lv[sk.id] = 1 + (sk.row * 9);
      withMeta(d, lv, PACT_DEFS.slice(0, 4).map(p => p.id), () => renderLobbySortie(cx, d));
    },
    // 📄 상세 시트 — 목록에서 걷어낸 설명이 전부 여기로 오므로,
    // 여기가 작으면 옮긴 의미가 없다. 같은 기준으로 잰다.
    '상세 시트':        () => { const d = st({ page:'lobby', soulStones:340 });
                              const tk = campTracks().filter(t => t.group === 'tower')[0];
                              if (!tk) return;
                              campTrackSheet(d, tk.id);
                              renderSheet(cx, d);
                              closeSheet(); },
    // 가이드북은 장마다 짜임새가 다르다 — 전 장을 잰다
    ...Object.fromEntries(GUIDE_CHAPTERS.map((chp, i) => [
      `📖 가이드북 · ${chp.tab || chp.title || i}`,
      () => { const d = st({ page:'lobby' }); d.guideChapter = i; renderGuideBook(cx, d); },
    ])),
    // ── 3·4단계 · 나머지 전부 ─────────────────────────────────────────
    '결과 화면':        () => { const d = st({ page:'result' });
                              d.runSummary = { endless:true, endlessTier:30, gems:120, kills:900,
                                gameSec:1800, wallSec:400, bossDown:false, nightmare:0,
                                unbounded:false, gaveUp:false, gold:0, waves:30, baseHP:88,
                                rows:[], mult:1, cards:[] };
                              renderResult(cx, d); },
    '강화 카드':        () => { const d = st({ page:'battle', inRun:true });
                              d.upgradePick = { active:true, cards: rollUpgradeCards([], 3, d) };
                              renderUpgradePick(cx, d); },
    '대장간':          () => renderForgeScreen(cx, st({ page:'town', gold:900 })),
    // 건물 상세는 **강화를 하나라도 산 뒤**에 「▲ 다음 효과」 줄이 생긴다.
    // 0강 상태만 재던 탓에 그 줄이 지금 효과 줄을 밟고 있는 것을 오래 못 봤다.
    // 모든 건물을, 산 상태로 잰다.
    ...Object.fromEntries(TOWN_BUILDINGS.map(def => [
      `건물 상세 · ${def.name}`,
      () => {
        const d = st({ page:'town', gold:1e6 });
        const bs = d.town.buildings[def.id]; if (!bs) return;
        const saved = { built: bs.built, level: bs.level, upgrades: { ...bs.upgrades } };
        bs.built = true; bs.level = 3;
        for (const t of (def.tracks || []))
          bs.upgrades[t.id] = trackIsInfinite(t) ? 17 : Math.min(3, trackCapAt(t, bs.level));
        try { renderBuildingScreen(cx, d, def.id); }
        finally { bs.built = saved.built; bs.level = saved.level; bs.upgrades = saved.upgrades; }
      },
    ])),
    '영웅 상점':        () => renderHeroShopScreen(cx, st({ page:'town', gold:900 })),
    '영웅 상세':        () => renderHeroDetail(cx, st({ page:'town' }), 60),
    '로비 · 스킬':      () => renderLobbySkill(cx, st({ page:'lobby', soulStones:5000 })),
    // 잠긴 트리만 재면 「윗줄 0/40Lv」 같은 짧은 딱지만 본다 — 자릿수가 늘면 달라진다
    '로비 · 스킬 · 진행':  () => {
      const d = st({ page:'lobby', soulStones:900000 });
      const lv = {};
      for (const sk of SKILL_TREES.tower.skills) lv[sk.id] = 47;
      withMeta(d, lv, [], () => renderLobbySkill(cx, d));
    },
    '로비 · 패':       () => renderLobbyCardMeta(cx, st({ page:'lobby', soulStones:5000 })),
    '로비 · 해금':      () => renderLobbyUnlock(cx, st({ page:'lobby', soulStones:5000 })),
    '로비 · 서약':      () => renderLobbyPact(cx, st({ page:'lobby', soulStones:5000 })),
    '로비 · 기록':      () => renderLobbyRecord(cx, st({ page:'lobby' })),
    // 📊 기록의 속페이지 다섯 장. 차례만 재면 접어 둔 안쪽을 영영 안 본다.
    // 값이 들어차야 넘치는 줄(누적 처치 여섯 자리·업적 진행 막대)이 보이므로 채워서 잰다.
    ...Object.fromEntries(['stats','ach','dex','rank','data'].map(id => [
      `로비 · 기록 · ${id}`,
      () => {
        const d = st({ page:'lobby', soulStones:5000 });
        d.stats.runs = 137; d.stats.bestEndless = 98; d.stats.bestWave = 6;
        d.stats.totalKills = 248213; d.stats.totalGold = 9921378; d.stats.totalGems = 81219;
        d.clearedGates = [10,20,30,40,50,60,70];
        d.clearedStages = [true, true];
        d.seenMobs = Object.keys(BATTLE_MOB_TYPES);
        d.lobby.recordPage = id;
        renderLobbyRecord(cx, d);
        d.lobby.recordPage = null;
      },
    ])),
    '📋 소식':         () => renderPatchNotes(cx, st({ page:'lobby' })),
    // 하단 고정 출전 바 — 두 상태 모두 잰다. 잠긴 상태가 한 줄에 두 문구를 얹고 있었다.
    '출전 바 · 잠김':    () => renderSortieBar(cx, st({ page:'lobby' })),
    '출전 바 · 열림':    () => { const d = st({ page:'lobby' });
                              d.stats.bestEndless = 12; d.stats.trainCleared = true;
                              renderSortieBar(cx, d); },
    // 6장 전부를 잰다 — 장마다 줄 수가 달라 한 장만 봐서는 겹침을 놓친다
    ...Object.fromEntries(TUTORIAL_STEPS.map((_, i) => [
      `📘 기본 설명 ${i+1}/${TUTORIAL_STEPS.length}`,
      () => { tut.active = true; tut.tip = null; tut.step = i; renderTutorial(cx, tut); },
    ])),
    '타이틀':          () => renderTitleScreen(cx, 1),
    // 🎬 보스 등장 컷 — 화면을 덮는 만큼 여기 글자가 안 읽히면 컷을 띄운 뜻이 없다
    ...Object.fromEntries([['상단','defense'], ['하단','arena']].flatMap(([nm, side]) =>
      [['🐲 중간보스', false, '깨진 뿔의 군장'], ['👹 마왕', true, '마 왕']].map(([kind, lord, name]) => [
        `${kind} 등장 · ${nm}`,
        () => {
          const d = st({ page:'battle', inRun:true });
          bossAnnounce(d, { lord, side, name, icon: lord ? '👹' : '🐲' });
          d.bossIntro.t = 1.2;            // 한창 떠 있는 순간
          try { renderBossIntro(cx, d); } finally { d.bossIntro = null; }
        },
      ]))),
    '일시정지':         () => renderPauseOverlay(cx),
    // 정산 보석이 붙으면 안내 줄이 길어진다 — 짧은 쪽만 재면 넘치는 걸 못 본다
    '일시정지 · 정산':    () => {
      const oc = calcSoulStones;
      window.calcSoulStones = () => 4820;
      try { renderPauseOverlay(cx); } finally { window.calcSoulStones = oc; }
    },
    '이번 판 카드':      () => { const d = st({ page:'battle', inRun:true, runCardsOpen:true });
                              renderRunCardsOverlay(cx, d); },
  };
  const out = [];
  for (const [name, fn] of Object.entries(screens)) {
    log = [];
    try { fn(); } catch (e) { out.push({ name, err: e.message }); continue; }
    const rows = log.filter(r => r[0] > 0 && r[1].trim().length >= minLen);
    const bad = rows.filter(r => r[0] * scale < minPx)
                    .map(r => ({ px: r[0], on: +(r[0] * scale).toFixed(1), text: r[1] }));

    // ── 겹침 ────────────────────────────────────────────────────────────
    // 글자 상자 둘이 실제로 포개지면 둘 다 못 읽는다. 다만 **일부러** 포개는
    // 것도 있다(아이콘 위에 숫자를 얹는 칩 같은 것). 그래서 조금 스치는 것은
    // 넘기고, 한쪽 넓이의 상당 부분을 먹는 것만 문제로 센다.
    // 한글은 단어 경계가 드물어 _patchWrapDraw가 **글자 단위로** 그린다.
    // 그 조각들끼리는 원래 붙어 있는 것이라 볼 필요가 없다 — 문장만 본다.
    const drawn = log.filter(r => r[2] && r[1].trim().length >= 3 && r[2].w > 1 && r[2].h > 1);
    const overlaps = [];
    for (let i = 0; i < drawn.length; i++) {
      for (let j = i + 1; j < drawn.length; j++) {
        const a = drawn[i][2], b = drawn[j][2];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        // 가로로 겹치는데 세로가 붙어 있으면 — 실제로 포개지지 않아도 못 읽는다.
        // 사용자가 "글자가 너무 붙어 보인다"고 한 것이 이 경우다.
        const hOver = ox > 0 ? ox / Math.min(a.w, b.w) : 0;
        if (ox > 0.5 && oy > 0.5) {
          const frac = (ox * oy) / Math.min(a.w * a.h, b.w * b.h);
          if (frac < 0.06) continue;                  // 아주 살짝 스치는 것은 넘긴다
          overlaps.push({ a: drawn[i][1], b: drawn[j][1], frac: +(frac*100).toFixed(0), kind:'겹침' });
        } else if (hOver > 0.35 && oy > -1.5 && oy <= 0.5) {
          overlaps.push({ a: drawn[i][1], b: drawn[j][1], frac: +(-oy).toFixed(1), kind:'붙음' });
        }
      }
    }
    out.push({ name, sentences: rows.length, bad, overlaps,
               chars: log.reduce((a, r) => a + r[1].length, 0) });
  }
  return out;
}, { scale: PHONE_SCALE, minPx: MIN_ON_PHONE, minLen: MIN_SENTENCE });

await browser.close();
server.close();

console.log(`\n기준: 360px 폰(배율 ${PHONE_SCALE}) 기준 ${MIN_ON_PHONE}px 이상 · ${MIN_SENTENCE}자 이상을 문장으로 본다\n`);
let fails = 0;
for (const r of report) {
  if (r.err) { console.log(`❌ ${r.name} — 렌더 실패: ${r.err}`); fails++; continue; }
  const nSmall = r.bad.length, nOver = r.overlaps.length;
  if (!nSmall && !nOver) {
    console.log(`✅ ${r.name.padEnd(16)} 문장 ${String(r.sentences).padStart(3)}개 · 전부 통과 (총 ${r.chars}자)`);
    continue;
  }
  fails += nSmall + nOver;
  const bits = [];
  if (nSmall) bits.push(`${nSmall}개가 너무 작다`);
  if (nOver)  bits.push(`${nOver}쌍이 겹친다`);
  console.log(`❌ ${r.name.padEnd(16)} ${bits.join(' · ')}`);
  for (const b of r.bad.slice(0, 6)) console.log(`     작음  ${String(b.px).padStart(2)}px → ${String(b.on).padStart(4)}px  ${b.text}`);
  if (nSmall > 6) console.log(`     … 외 ${nSmall - 6}개`);
  for (const o of r.overlaps.slice(0, 8))
    console.log(`     ${o.kind}  ${o.kind === '겹침' ? o.frac + '%' : o.frac + 'px'}  「${o.a}」 ↔ 「${o.b}」`);
  if (nOver > 8) console.log(`     … 외 ${nOver - 8}쌍`);
}
console.log(fails === 0 ? '\n✅ 전부 통과\n' : `\n❌ ${fails}건\n`);
process.exit(fails ? 1 : 0);
