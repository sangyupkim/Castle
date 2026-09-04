// POST /api/score — 기록 등록
//
// 날짜는 **서버가 찍는다**. 클라이언트가 보낸 시각을 쓰면 조작되기도 하고
// 시간대가 섞여서 표가 뒤죽박죽이 된다. 여기서 받은 순간이 그 기록의 시각이다.
import { checkRecord, loadBoard, saveBoard, mergeRecord, rateLimited, json }
  from './_lib/board.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ ok: false, err: 'POST만 받습니다' }, 405);

  let body;
  try { body = await req.json(); }
  catch (e) { return json({ ok: false, err: '내용을 읽을 수 없습니다' }, 400); }

  const chk = checkRecord(body);
  if (!chk.ok) return json({ ok: false, err: chk.err }, 400);

  const ip = req.headers.get('x-nf-client-connection-ip')
          || context?.ip || 'unknown';
  if (await rateLimited(ip))
    return json({ ok: false, err: '잠시 뒤에 다시 시도해 주세요' }, 429);

  const rec = { ...chk.rec, at: Date.now() };

  let rows;
  try {
    rows = await loadBoard(rec.board);
  } catch (e) {
    return json({ ok: false, err: '순위표를 열 수 없습니다' }, 503);
  }

  const merged = mergeRecord(rows, rec);
  if (!merged.replaced) {
    const rank = merged.rows.findIndex(x => x.cid === rec.cid) + 1;
    return json({ ok: true, replaced: false, rank, at: rec.at,
                  msg: '이미 더 좋은 기록이 올라가 있습니다' });
  }

  try {
    await saveBoard(rec.board, merged.rows);
  } catch (e) {
    return json({ ok: false, err: '순위표에 쓸 수 없습니다' }, 503);
  }

  const rank = merged.rows.findIndex(x => x.cid === rec.cid && x.at === rec.at) + 1;
  return json({ ok: true, replaced: true, rank, at: rec.at });
};
