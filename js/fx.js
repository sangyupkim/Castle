'use strict';

// ─── 파티클 / 화면 흔들림 ────────────────────────────────────────────────────
const FX = (() => {
  const parts = [];
  let shakeMag = 0, shakeTime = 0;
  const MAX_PARTS = 220;

  return {
    burst(x, y, color, count, spread) {
      const n = Math.min(count || 6, MAX_PARTS - parts.length);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (spread || 12) * (0.5 + Math.random());
        parts.push({
          x, y,
          vx: Math.cos(a) * v * 4,
          vy: Math.sin(a) * v * 4 - 20,
          life: 0.35 + Math.random() * 0.35,
          maxLife: 0.7,
          r: 1.4 + Math.random() * 2.2,
          color
        });
      }
    },

    ring(x, y, color, radius) {
      const n = Math.min(14, MAX_PARTS - parts.length);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        parts.push({
          x, y,
          vx: Math.cos(a) * radius * 3,
          vy: Math.sin(a) * radius * 3,
          life: 0.3, maxLife: 0.3, r: 2, color
        });
      }
    },

    shake(mag, time) {
      shakeMag  = Math.max(shakeMag, mag);
      shakeTime = Math.max(shakeTime, time);
    },

    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 160 * dt;
        p.life -= dt;
        if (p.life <= 0) parts.splice(i, 1);
      }
      if (shakeTime > 0) {
        shakeTime = Math.max(0, shakeTime - dt);
        if (shakeTime === 0) shakeMag = 0;
      }
    },

    draw(ctx) {
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    // 렌더 시작 시 호출 → [dx, dy] 오프셋
    shakeOffset() {
      if (shakeTime <= 0) return [0, 0];
      const m = shakeMag * (shakeTime > 0 ? 1 : 0);
      return [(Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m];
    },

    clear() { parts.length = 0; shakeMag = 0; shakeTime = 0; }
  };
})();
