// GET /api/rank?board=abyss&limit=50 — 순위 조회
//
// cid(기기 식별자)는 밖으로 내보내지 않는다. 표에 필요한 것만 골라 준다.
import { BOARDS, loadBoard, json } from './_lib/board.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 100;

export default async (req) => {
  const url   = new URL(req.url);
  const board = url.searchParams.get('board') || 'abyss';
  if (!BOARDS.includes(board))
    return json({ ok: false, err: '알 수 없는 갈래입니다' }, 400);

  // Number(null)은 NaN이 아니라 0이다 — 파라미터가 없을 때 limit이 1이 되어
  // 순위표가 한 줄만 나오던 버그가 여기 있었다. 있는지부터 본다.
  const raw = url.searchParams.get('limit');
  const n   = raw === null ? NaN : Number(raw);
  const limit = Number.isFinite(n) && n > 0
    ? Math.max(1, Math.min(MAX_LIMIT, Math.round(n)))
    : DEFAULT_LIMIT;

  // 내 기록이 몇 위인지 표시하려면 cid를 받아 위치만 돌려준다 (값 자체는 안 준다)
  const meCid = url.searchParams.get('cid') || '';

  let rows;
  try { rows = await loadBoard(board); }
  catch (e) { return json({ ok: false, err: '순위표를 열 수 없습니다' }, 503); }

  const myRank = meCid ? (rows.findIndex(x => x.cid === meCid) + 1) || null : null;

  return json({
    ok: true,
    board,
    total: rows.length,
    myRank,
    rows: rows.slice(0, limit).map((x, i) => ({
      rank:     i + 1,
      name:     x.name,
      tier:     x.tier,
      bossDown: !!x.bossDown,
      gems:     x.gems,
      kills:    x.kills,
      version:  x.version,
      at:       x.at,          // 서버가 찍은 등록 시각 — 클라이언트가 날짜로 그린다
      mine:     !!meCid && x.cid === meCid,
    })),
  });
};
