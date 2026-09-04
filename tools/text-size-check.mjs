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
  cx.fillText = function (t, x, y, m) {
    const px = parseInt((this.font.match(/(\d+)px/) || [])[1] || 0, 10);
    log.push([px, String(t)]);
    return orig(t, x, y, m);
  };
  const st = (patch) => { const d = newState(); d.battle = createBattle(); Object.assign(d, patch || {}); return d; };
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
    '마을':            () => renderTownPage(cx, st({ page:'town', gold:420 })),
    '마을 · 병력':      () => renderTownPageArmy(cx, st({ page:'town', gold:420 }), 92),
    '마을 · 타워':      () => renderTownPageTowers(cx, st({ page:'town', gold:420 }), 92),
    '캠프':            () => renderLobbyCamp(cx, st({ page:'lobby' })),
    '출전 준비':        () => renderLobbySortie(cx, st({ page:'lobby' })),
    // 📄 상세 시트 — 목록에서 걷어낸 설명이 전부 여기로 오므로,
    // 여기가 작으면 옮긴 의미가 없다. 같은 기준으로 잰다.
    '상세 시트':        () => { const d = st({ page:'lobby', soulStones:340 });
                              const tk = campTracks().filter(t => t.group === 'tower')[0];
                              if (!tk) return;
                              campTrackSheet(d, tk.id);
                              renderSheet(cx, d);
                              closeSheet(); },
    '📖 가이드북':      () => { const d = st({ page:'lobby' });
                              d.guideChapter = 6;   // 계산식이 가장 많은 '규칙' 장
                              renderGuideBook(cx, d); },
  };
  const out = [];
  for (const [name, fn] of Object.entries(screens)) {
    log = [];
    try { fn(); } catch (e) { out.push({ name, err: e.message }); continue; }
    const rows = log.filter(r => r[0] > 0 && r[1].trim().length >= minLen);
    const bad = rows.filter(r => r[0] * scale < minPx)
                    .map(r => ({ px: r[0], on: +(r[0] * scale).toFixed(1), text: r[1] }));
    out.push({ name, sentences: rows.length, bad, chars: log.reduce((a, r) => a + r[1].length, 0) });
  }
  return out;
}, { scale: PHONE_SCALE, minPx: MIN_ON_PHONE, minLen: MIN_SENTENCE });

await browser.close();
server.close();

console.log(`\n기준: 360px 폰(배율 ${PHONE_SCALE}) 기준 ${MIN_ON_PHONE}px 이상 · ${MIN_SENTENCE}자 이상을 문장으로 본다\n`);
let fails = 0;
for (const r of report) {
  if (r.err) { console.log(`❌ ${r.name} — 렌더 실패: ${r.err}`); fails++; continue; }
  if (!r.bad.length) { console.log(`✅ ${r.name.padEnd(16)} 문장 ${String(r.sentences).padStart(3)}개 · 전부 통과 (총 ${r.chars}자)`); continue; }
  fails += r.bad.length;
  console.log(`❌ ${r.name.padEnd(16)} 문장 ${String(r.sentences).padStart(3)}개 중 ${r.bad.length}개가 너무 작다`);
  for (const b of r.bad.slice(0, 8)) console.log(`     ${String(b.px).padStart(2)}px → ${String(b.on).padStart(4)}px  ${b.text}`);
  if (r.bad.length > 8) console.log(`     … 외 ${r.bad.length - 8}개`);
}
console.log(fails === 0 ? '\n✅ 전부 통과\n' : `\n❌ ${fails}건\n`);
process.exit(fails ? 1 : 0);
