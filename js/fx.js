'use strict';

// ─── 파티클 / 화면 흔들림 ────────────────────────────────────────────────────
const FX = (() => {
  const parts = [];
  const bolts = [];              // 번개 연쇄 섬광
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
          vx: Math.cos(a) * v * 4, vy: Math.sin(a) * v * 4 - 20,
          life: 0.35 + Math.random() * 0.35, maxLife: 0.7,
          r: 1.4 + Math.random() * 2.2, color
        });
      }
    },
    ring(x, y, color, radius) {
      const n = Math.min(14, MAX_PARTS - parts.length);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        parts.push({
          x, y, vx: Math.cos(a) * radius * 3, vy: Math.sin(a) * radius * 3,
          life: 0.3, maxLife: 0.3, r: 2, color
        });
      }
    },
    // 번개 연쇄 — 두 점을 잇는 짧은 섬광
    spark(x1, y1, x2, y2, color) {
      bolts.push({ x1, y1, x2, y2, color, life: 0.16, maxLife: 0.16 });
      if (bolts.length > 40) bolts.shift();
    },
    shake(mag, time) {
      shakeMag  = Math.max(shakeMag, mag);
      shakeTime = Math.max(shakeTime, time);
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt;
        p.life -= dt;
        if (p.life <= 0) parts.splice(i, 1);
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        bolts[i].life -= dt;
        if (bolts[i].life <= 0) bolts.splice(i, 1);
      }
      if (shakeTime > 0) {
        shakeTime = Math.max(0, shakeTime - dt);
        if (shakeTime === 0) shakeMag = 0;
      }
    },
    draw(ctx) {
      for (const b of bolts) {
        ctx.globalAlpha = Math.max(0, b.life / b.maxLife);
        ctx.strokeStyle = b.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
        // 가운데를 살짝 꺾어 번개처럼
        ctx.lineTo((b.x1+b.x2)/2 + (Math.random()*10-5), (b.y1+b.y2)/2 + (Math.random()*10-5));
        ctx.lineTo(b.x2, b.y2); ctx.stroke();
      }
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    shakeOffset() {
      if (shakeTime <= 0) return [0, 0];
      return [(Math.random() * 2 - 1) * shakeMag, (Math.random() * 2 - 1) * shakeMag];
    },
    clear() { parts.length = 0; bolts.length = 0; shakeMag = 0; shakeTime = 0; }
  };
})();
