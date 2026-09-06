// ─── 🏆 랭킹 — 저장과 검증 ────────────────────────────────────────────────────
// 재미용 순위표다. 클라이언트를 믿을 수 없다는 사실은 바꿀 수 없으므로
// (브라우저에서 도는 게임이라 원리적으로 불가능하다) 여기서 하는 일은
// **말이 되는 기록만 받는 것**이지 부정을 막는 것이 아니다.
//
// 저장은 Netlify Blobs 하나로 끝낸다 — 계정을 더 만들 필요도, 환경변수도 없다.
// 규모가 커지면 이 파일의 loadBoard/saveBoard 둘만 갈아끼우면 된다.
import { getStore } from '@netlify/blobs';

export const BOARD_MAX = 200;          // 한 갈래에 보관할 최대 기록 수
const RATE_PER_HOUR    = 20;           // 같은 IP가 한 시간에 낼 수 있는 횟수

// ── 갈래 ─────────────────────────────────────────────────────────────────────
// 심연·악몽 10단계·무한은 난이도가 전혀 다르다. 한 표에 섞으면 순위가 뜻을 잃는다.
export const BOARDS = ['abyss', 'unbounded',
  ...Array.from({ length: 10 }, (_, i) => `nm${i + 1}`)];

export function boardLabel(id) {
  if (id === 'abyss')     return '∞ 심연';
  if (id === 'unbounded') return '♾️ 무한';
  const n = /^nm(\d+)$/.exec(id);
  return n ? `🌑 악몽 ${n[1]}` : id;
}

// ── 게임 상수 (js/constants.js와 같은 값이어야 한다) ─────────────────────────
const WAVE_DURATION = 60;    // 한 층의 길이(초)
const MAX_SPEED     = 10;    // SPEED_STEPS의 최대 배속

// ── 개연성 검사 ──────────────────────────────────────────────────────────────
// 통과 = "이런 판이 있을 수는 있다". 통과 ≠ "진짜다".
// 서로 어긋나는 값을 걸러내는 것이 전부다.
export function checkRecord(r) {
  const bad = m => ({ ok: false, err: m });

  if (!r || typeof r !== 'object') return bad('내용이 없습니다');
  if (!BOARDS.includes(r.board))   return bad('알 수 없는 갈래입니다');

  const name = String(r.name ?? '').trim();
  if (name.length < 1)  return bad('이름을 입력하세요');
  if (name.length > 12) return bad('이름은 12자까지입니다');
  // 제어문자·줄바꿈은 표를 깨뜨린다
  if (/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029]/.test(name))
    return bad('이름에 쓸 수 없는 글자가 있습니다');

  const tier = Number(r.tier);
  if (!Number.isInteger(tier) || tier < 1 || tier > 999) return bad('층수가 범위를 벗어났습니다');

  const gameSec = Number(r.gameSec);
  const wallSec = Number(r.wallSec);
  if (!Number.isFinite(gameSec) || gameSec < 0) return bad('플레이 시간이 이상합니다');
  if (!Number.isFinite(wallSec) || wallSec < 0) return bad('경과 시간이 이상합니다');

  // ① 한 층은 60초다. 마지막 층은 도중에 끝날 수 있으니 그 앞까지만 따진다.
  //    층 이벤트가 길이를 줄이는 경우가 있어 20%를 접어 준다.
  const minGame = (tier - 1) * WAVE_DURATION * 0.8;
  if (gameSec < minGame)
    return bad(`${tier}층인데 플레이 시간이 너무 짧습니다`);

  // ② 배속은 최대 10배다. 실시간이 게임시간의 1/10보다 짧을 수는 없다.
  if (wallSec * MAX_SPEED * 1.1 < gameSec)
    return bad('경과 시간과 플레이 시간이 맞지 않습니다');

  // ③ 나머지는 헐거운 상한만 — 표시용 값이라 정밀할 이유가 없다
  const gems  = Number(r.gems  ?? 0);
  const kills = Number(r.kills ?? 0);
  if (!Number.isFinite(gems)  || gems  < 0 || gems  > tier * 5000 + 50000) return bad('보석 수가 범위를 벗어났습니다');
  if (!Number.isFinite(kills) || kills < 0 || kills > tier * 3000 + 10000) return bad('처치 수가 범위를 벗어났습니다');

  if (!/^v\d+\.\d+\.\d+$/.test(String(r.version || ''))) return bad('버전 표기가 이상합니다');

  const cid = String(r.cid || '');
  if (!/^[a-z0-9-]{8,64}$/i.test(cid)) return bad('클라이언트 식별자가 이상합니다');

  return {
    ok: true,
    rec: {
      name,
      board:    r.board,
      tier,
      bossDown: !!r.bossDown,
      gems:     Math.round(gems),
      kills:    Math.round(kills),
      gameSec:  Math.round(gameSec),
      version:  String(r.version),
      cid,
    }
  };
}

// ── 정렬 ─────────────────────────────────────────────────────────────────────
// 층수가 먼저, 같으면 마왕 처치, 그 다음 보석. 전부 같으면 **먼저 세운 쪽**이 위다.
export function rankSort(a, b) {
  if (b.tier !== a.tier)             return b.tier - a.tier;
  if (!!b.bossDown !== !!a.bossDown) return (b.bossDown ? 1 : 0) - (a.bossDown ? 1 : 0);
  if (b.gems !== a.gems)             return b.gems - a.gems;
  return a.at - b.at;
}

// ── 저장 ─────────────────────────────────────────────────────────────────────
function store() { return getStore('leaderboard'); }

// 읽기 실패는 **반드시 던진다.** 삼켜서 []를 돌려주면 부르는 쪽은 "표가 비었다"로
// 읽고, 그 뒤 saveBoard가 기록 하나로 순위표를 통째로 덮어쓴다 —
// 저장소가 잠깐 흔들린 것뿐인데 남의 기록이 전부 사라진다.
// 없는 키는 null이고 실패는 예외다. 그 둘을 갈라 두는 것이 여기서 할 일의 전부다.
export async function loadBoard(board) {
  const v = await store().get(`board/${board}`, { type: 'json' });
  if (v === null || v === undefined) return [];    // 아직 아무도 안 올린 표
  if (!Array.isArray(v)) throw new Error('순위표가 배열이 아닙니다');
  return v;
}

export async function saveBoard(board, rows) {
  await store().setJSON(`board/${board}`, rows.slice(0, BOARD_MAX));
}

// 같은 사람이 표를 도배하지 않게 — 한 기기당 갈래별 최고 기록 하나만 남긴다.
// localStorage를 지우면 새 사람이 되지만, 재미용 순위표에 그 이상은 과하다.
export function mergeRecord(rows, rec) {
  const mine = rows.find(x => x.cid === rec.cid);
  // 이전 기록이 더 좋으면 그대로 둔다
  if (mine && rankSort(mine, rec) < 0) return { rows, replaced: false };
  const kept = rows.filter(x => x.cid !== rec.cid);
  kept.push(rec);
  kept.sort(rankSort);
  return { rows: kept.slice(0, BOARD_MAX), replaced: true };
}

// ── 호출 제한 ────────────────────────────────────────────────────────────────
export async function rateLimited(ip) {
  const key  = `rate/${(ip || 'unknown').replace(/[^a-z0-9.:_-]/gi, '_')}`;
  const hour = Math.floor(Date.now() / 3600000);
  let cur;
  try { cur = await store().get(key, { type: 'json' }); } catch (e) { cur = null; }
  if (!cur || cur.hour !== hour) cur = { hour, n: 0 };
  if (cur.n >= RATE_PER_HOUR) return true;
  cur.n += 1;
  try { await store().setJSON(key, cur); } catch (e) { /* 못 세도 등록은 막지 않는다 */ }
  return false;
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
