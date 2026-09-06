// ─── 🖐 눌러 보는 검사 ────────────────────────────────────────────────────────
// 실행: node tools/ui-tap-check.mjs
//
// 정보를 접어 두고 "누르면 열린다"로 바꾸면, **안 열리는 순간 그 정보는 사라진 것**이
// 된다. 그림 검사(text-size-check)는 열린 화면이 예쁜지만 보지 그 화면에 닿을 수
// 있는지는 안 본다. 실제로 방패병 버그가 그랬다 — 잘 그려져 있는데 안 눌렸다.
//
// 그래서 좌표를 꺼내서 진짜로 누른다. 눌린 뒤의 상태가 바뀌었는지만 본다.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8923;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg',
  '.webmanifest':'application/manifest+json', '.json':'application/json',
  '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream',
                         'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});

const chromium = (() => {
  const require = createRequire(import.meta.url);
  for (const base of ['/opt/node22/lib/node_modules/playwright', 'playwright']) {
    try { return require(base).chromium; } catch {}
  }
  return null;
})();
if (!chromium) { console.error('playwright를 찾지 못했습니다.'); process.exit(2); }

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const pg = await browser.newPage({ viewport: { width: 412, height: 915 } });
const errs = [];
pg.on('pageerror', e => errs.push(e.message));
await pg.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
await pg.waitForFunction(() => typeof Sprites !== 'undefined' && Sprites.ready, null, { timeout: 30000 });

// 타이틀·튜토리얼·손가락 안내를 걷어낸다 — 이것들이 떠 있으면 탭을 먼저 삼킨다
await pg.evaluate(() => {
  _titleScreen = false; _tutorialDone = true;
  if (typeof tut !== 'undefined' && tut) { tut.active = false; tut.tip = null; tut.showTip = () => {}; }
  if (typeof guide !== 'undefined' && guide.finish) guide.finish();
});

const rows = [];
const say = (ok, line) => { rows.push(ok); console.log(`  ${ok ? '✅' : '❌'} ${line}`); };
const run = (fn, arg) => pg.evaluate(fn, arg);

// 버튼 좌표는 그려질 때 gs.ui에 적힌다 — 누르기 전에 한 장 그려야 한다.
// 게임의 그리는 함수는 frame(ts)다 (requestAnimationFrame 콜백).
await pg.evaluate(() => { window.render = () => frame(performance.now()); });

console.log('\n🖐 눌러 보는 검사\n');

// ── 준비 화면의 정보 카드 → 상세 시트 ───────────────────────────────────────
console.log('■ 준비 화면 — 카드를 누르면 시트가 열리고, 닫기로 닫힌다');
await run(() => {
  gs.stats.runs = 5; gs.nightmareOpen = NIGHTMARE_MAX + 1;
  startRun('endless', 0); gs.wave = 46; wm.init(gs.wave); wm.phase = 'idle';
  gs.unlocked = UNLOCK_DEFS.map(u => u.id); gs.gold = 1e6; gs.battle.maxSlots = 6;
  for (const t of ['swordsman','archer']) gs.gold = hireUnit(gs.battle, t, gs.gold);
  gs.hero.placement = 'battle'; gs.page = 'battle';
  gs.lastWave = { idx:46, top:812, bot:1759, kill:388, win:100, clear:104, left:9, result:'cleared', total:3163 };
  render();
});
{
  const ids = await run(() => (gs.ui.briefInfoBtns || []).map(b => b.id));
  say(ids.length === 5, `카드 ${ids.length}개 등록 — ${ids.join(', ')}`);
  for (const id of ids) {
    const r = await run((wanted) => {
      const b = (gs.ui.briefInfoBtns || []).find(v => v.id === wanted);
      if (!b) return { ok:false, why:'좌표 없음' };
      tap({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
      if (!sheetOpen()) return { ok:false, why:'안 열림' };
      render();
      const close = gs.ui.sheetCloseBtn;
      if (!close) return { ok:false, why:'닫기 버튼 없음' };
      tap({ x: close.x + close.w / 2, y: close.y + close.h / 2 });
      return { ok: !sheetOpen(), why: sheetOpen() ? '안 닫힘' : '' };
    }, id);
    say(r.ok, `${id.padEnd(8)} ${r.ok ? '열리고 닫힌다' : r.why}`);
  }
}

// ── 기록 탭의 속페이지 ──────────────────────────────────────────────────────
console.log('■ 기록 탭 — 큰 버튼으로 들어가고 ‹기록으로 나온다');
await run(() => { gs.page = 'lobby'; gs.lobby.tab = 'record'; gs.lobby.recordPage = null;
                  gs.lobbyScroll = 0; render(); });
{
  const ids = await run(() => (gs.ui.recordBtns || []).map(b => b.id));
  say(ids.length === 5, `버튼 ${ids.length}개 등록 — ${ids.join(', ')}`);
  for (const id of ids) {
    const r = await run((wanted) => {
      gs.lobby.recordPage = null; gs.lobbyScroll = 0; render();
      const b = (gs.ui.recordBtns || []).find(v => v.id === wanted);
      if (!b) return { ok:false, why:'좌표 없음' };
      tap({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
      if (gs.lobby.recordPage !== wanted) return { ok:false, why:`안 들어감 (${gs.lobby.recordPage})` };
      render();
      const back = gs.ui.recordBackBtn;
      if (!back) return { ok:false, why:'되돌아가기 버튼 없음' };
      tap({ x: back.x + back.w / 2, y: back.y + back.h / 2 });
      return { ok: gs.lobby.recordPage === null, why: '안 나옴' };
    }, id);
    say(r.ok, `${id.padEnd(6)} ${r.ok ? '들어가고 나온다' : r.why}`);
  }
}

// ── 출격 탭의 난이도 사다리 ─────────────────────────────────────────────────
console.log('■ 출격 탭 — 난이도 칸이 실제로 눌린다 (칸을 키웠다)');
{
  const r = await run(() => {
    gs.nightmareOpen = 5; gs.lobby.tab = 'sortie'; gs.lobby.nightmare = 0; gs.lobbyScroll = 0;
    render();
    const btns = gs.ui.nightmareBtns || [];
    const out = [];
    for (const b of btns) {
      if (!b.can) continue;
      gs.lobby.nightmare = -1;
      tap({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
      out.push({ level: b.level, got: gs.lobby.nightmare, w: Math.round(b.w), h: Math.round(b.h) });
    }
    return out;
  });
  const bad = r.filter(o => o.got !== o.level);
  say(r.length >= 5 && bad.length === 0,
      `열린 칸 ${r.length}개 전부 눌림 · 칸 크기 ${r[0] ? r[0].w + '×' + r[0].h : '-'}`);
  say(r.length > 0 && r[0].w >= 100 && r[0].h >= 80, '칸이 100×80 이상 (예전 72×40)');
}

// ── 패 탭으로 옮긴 부적 ─────────────────────────────────────────────────────
console.log('■ 패 탭 — 옮겨 온 부적이 여기서 눌린다');
{
  const r = await run(() => {
    gs.soulStones = 5000; gs.lobby.tab = 'card'; gs.lobby.cardCat = null; gs.lobbyScroll = 0;
    render();
    const before = charmBag(gs).length;
    const roll = gs.ui.charmRollBtn;
    if (!roll) return { ok:false, why:'뽑기 버튼이 안 그려짐' };
    tap({ x: roll.x + roll.w / 2, y: roll.y + roll.h / 2 });
    return { ok: charmBag(gs).length === before + 1, why:'눌러도 안 뽑힘', n: charmBag(gs).length };
  });
  say(r.ok, r.ok ? `뽑기가 돈다 (보관함 ${r.n}장)` : r.why);
  const gone = await run(() => {
    gs.lobby.tab = 'sortie'; gs.lobbyScroll = 0; render();
    return !gs.ui.charmRollBtn;
  });
  say(gone, '출격 탭에는 더 이상 부적이 없다');
}

// ── 해금 탭에서 승천이 사라졌다 ─────────────────────────────────────────────
console.log('■ 해금 탭 — ♾️승천이 없다');
{
  const r = await run(() => { gs.lobby.tab = 'unlock'; gs.lobbyScroll = 0; render();
                              return !gs.ui.ascendBtn; });
  say(r, '승천 버튼이 그려지지 않는다');
}

await browser.close();
server.close();
const bad = rows.filter(x => !x).length + errs.length;
if (errs.length) console.log('\n페이지 오류:', errs.slice(0, 3));
console.log(bad === 0 ? `\n✅ 전부 통과 — ${rows.length}/${rows.length}\n` : `\n❌ ${bad}건 실패\n`);
process.exit(bad ? 1 : 0);
