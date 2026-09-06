// import '@netlify/blobs'를 대역으로 바꿔치기하는 해석 훅.
// ESM은 import가 정적이라 런타임 몽키패치가 안 된다 — 해석 단계에서 갈아끼운다.
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUB = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '_blobs-stub.mjs')).href;

export async function resolve(spec, ctx, next) {
  if (spec === '@netlify/blobs') return { url: STUB, shortCircuit: true };
  return next(spec, ctx);
}
