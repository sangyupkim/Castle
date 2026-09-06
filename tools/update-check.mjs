// ─── 🔄 최신판 확인 검사 ───────────────────────────────────────────────────────
// "배포는 올라갔는데 화면은 옛 판" — 눈으로는 절대 못 잡는 종류다. 사람이 보기엔
// 그냥 안 바뀐 화면이고, 원인이 브라우저 캐시인지 워커인지 서버인지가 안 갈린다.
//
// 그래서 서버를 직접 세우고 **거짓말을 시킨다.** 문서가 읽는 js/version.js와
// 확인용으로 물어보는 js/version.js를 서로 다른 버전으로 주면, 클라이언트 입장에선
// "지금 돌고 있는 것보다 서버가 새것"인 상황과 똑같다.
//
//   1) 같은 버전   → 아무 일도 없어야 한다 (괜히 새로고침하면 판이 끊긴다)
//   2) 다른 버전   → 캐시·워커를 비우고 한 번 갈아타야 한다
//   3) 갈아탔는데도 여전히 다르면 → **멈춰야 한다** (무한 새로고침 방지)
//   4) 서버가 제대로 새 판을 주면 → 갈아탄 뒤 조용해져야 한다
//
//   node tools/update-check.mjs

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8901;
const REAL = /GAME_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(
  fs.readFileSync(path.join(ROOT, 'js/version.js'), 'utf8'))[1];
const FAKE = 'v9.9.9';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

// 서버가 무엇을 주는지를 이 두 스위치가 정한다.
//   pollVersion : `?_nocache=`가 붙은 요청(=확인용)에 돌려줄 버전
//   docVersion  : 그냥 <script>로 읽는 요청에 돌려줄 버전 (=지금 돌게 될 판)
//   flipAfterPoll: 확인용 요청이 한 번 다녀가면 문서 쪽도 새 버전으로 바꾼다
//                  — 배포가 실제로 반영된 상황을 흉내 낸다
let pollVersion = REAL, docVersion = REAL, flipAfterPoll = false;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(u.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  const ext = path.extname(file);
  if (rel === '/js/version.js') {
    const poll = u.searchParams.has('_nocache');
    const want = poll ? pollVersion : docVersion;
    if (poll && flipAfterPoll) docVersion = pollVersion;
    const body = fs.readFileSync(file, 'utf8').replace(
      /GAME_VERSION\s*=\s*'[^']*'/, `GAME_VERSION = '${want}'`);
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-cache' });
    res.end(body); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream',
                       'Cache-Control': ext === '.js' || ext === '.html' ? 'no-cache' : 'max-age=60' });
  fs.createReadStream(file).pipe(res);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  (ok ? pass++ : fail++);
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`);
};

await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

// 한 판(page)을 열고, 무슨 일이 있었는지 기록해서 돌려준다.
async function run(label, settle = 4000) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const navs = [], logs = [];
  page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
  page.on('console', m => logs.push(m.text()));
  // 문서가 실제로 몇 번 실행됐는지 — replaceState도 framenavigated를 띄우므로
  // 이동 횟수로는 '진짜 새로고침'을 못 가른다.
  let boots = 0;
  await page.exposeFunction('__boot', () => { boots++; });
  await page.addInitScript(() => { window.__boot && window.__boot(); });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await sleep(settle);
  const running = await page.evaluate(() => window.GAME_VERSION || null).catch(() => null);
  const url = page.url();
  const swUrls = await page.evaluate(() =>
    navigator.serviceWorker.getRegistrations()
      .then(rs => rs.map(r => (r.active || r.installing || r.waiting || {}).scriptURL || ''))
  ).catch(() => []);
  const cacheKeys = await page.evaluate(() => caches.keys()).catch(() => []);
  // 캐시에 확인용 주소(`?_nocache=`)가 쌓였는지 — 쌓이면 볼 때마다 늘어난다
  const cached = await page.evaluate(() =>
    caches.keys().then(ks => Promise.all(ks.map(k =>
      caches.open(k).then(c => c.keys()).then(rs => rs.map(r => r.url))))
      .then(a => a.flat()))).catch(() => []);
  await ctx.close();
  return { label, navs, logs, running, url, swUrls, cacheKeys, cached, boots };
}

// ── 1. 서버와 같은 버전이면 아무 일도 없어야 한다 ────────────────────────────
{
  pollVersion = REAL; docVersion = REAL;
  const r = await run('같은 버전');
  check('같은 버전 — 갈아타지 않는다', r.boots === 1 && !r.url.includes('_v='),
        `실행 ${r.boots}회 · ${r.url.replace(`http://127.0.0.1:${PORT}`, '')}`);
  check('같은 버전 — 갈아탄다는 말도 없다',
        !r.logs.some(l => l.includes('갈아탑니다')));
  check('워커 주소에 버전이 붙는다',
        r.swUrls.some(u => u.includes('sw.js?v=' + REAL)), r.swUrls.join(',') || '(없음)');
  const junk = r.cached.filter(u => u.includes('_nocache'));
  check('확인용 요청은 캐시에 쌓이지 않는다', junk.length === 0,
        `캐시에 담긴 것 ${r.cached.length}개 중 확인용 ${junk.length}개`);
}

// ── 2. 서버가 더 새것이면 비우고 갈아탄다 ───────────────────────────────────
{
  pollVersion = FAKE; docVersion = REAL;   // 물어보면 새것, 실제로 주는 건 옛것
  const r = await run('새 판 발견', 7000);
  check('다른 버전 — 갈아탄다', r.boots === 2 && r.navs.some(u => u.includes('_v=' + FAKE)),
        `실행 ${r.boots}회`);
  check('다른 버전 — 새 판을 찾았다고 남긴다',
        r.logs.some(l => l.includes('새 판') && l.includes(FAKE)));
  // 갈아탔는데도 서버가 여전히 옛것을 준다 → 여기서 멈춰야 한다
  check('그래도 안 맞으면 멈춘다 (무한 새로고침 없음)', r.boots === 2,
        `실행 ${r.boots}회`);
  check('멈출 때는 배포 쪽을 보라고 남긴다',
        r.logs.some(l => l.includes('배포 쪽을 확인')));
  check('갈아탄 뒤 주소에 ?_v=가 남지 않는다', !r.url.includes('_v='), r.url);
}

// ── 3. 서버가 제대로 새 판을 주면 갈아탄 뒤 조용해진다 ──────────────────────
{
  pollVersion = FAKE; docVersion = REAL; flipAfterPoll = true;   // 배포가 실제로 반영된다
  const r = await run('제대로 된 새 판', 7000);
  flipAfterPoll = false;
  check('새 판으로 갈아타고 멈춘다', r.running === FAKE && r.boots === 2,
        `돌고 있는 판 ${r.running} · 실행 ${r.boots}회`);
  check('갈아탄 뒤에는 경고가 없다', !r.logs.some(l => l.includes('배포 쪽을 확인')));
  check('새 워커도 새 버전 주소로 붙는다',
        r.swUrls.some(u => u.includes('sw.js?v=' + FAKE)), r.swUrls.join(',') || '(없음)');
}

// ── 4. 옛 캐시가 통째로 남아 있어도 비운다 ──────────────────────────────────
{
  pollVersion = FAKE; docVersion = REAL;
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  // 손으로 쓰레기 캐시를 하나 심어 둔다 — 갈아탈 때 같이 지워져야 한다
  await page.evaluate(() => caches.open('dual-frontier-옛것').then(c => c.put('/junk', new Response('x'))));
  await sleep(6000);
  const keys = await page.evaluate(() => caches.keys()).catch(() => []);
  check('갈아탈 때 옛 캐시를 전부 지운다', !keys.includes('dual-frontier-옛것'),
        keys.join(',') || '(비어 있음)');
  await ctx.close();
}

// ── 5. ?reset=1 비상구 ──────────────────────────────────────────────────────
{
  pollVersion = REAL; docVersion = REAL;
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await page.goto(`http://127.0.0.1:${PORT}/?reset=1`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const keys = await page.evaluate(() => caches.keys()).catch(() => []);
  const regs = await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length));
  check('?reset=1 — 캐시를 비우고 제자리로 돌아온다',
        page.url().replace(`http://127.0.0.1:${PORT}`, '') === '/' && keys.length <= 1,
        `${page.url().replace(`http://127.0.0.1:${PORT}`, '')} · 캐시 ${keys.length}개 · 워커 ${regs}개`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${fail ? '❌' : '✅'} ${pass}건 통과 · ${fail}건 실패`);
process.exit(fail ? 1 : 0);
