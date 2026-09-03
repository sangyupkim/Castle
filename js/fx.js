'use strict';

// ─── 파티클 / 화면 흔들림 ────────────────────────────────────────────────────
const FX = (() => {
  const parts = [];
  const bolts = [];              // 번개 연쇄 섬광
  const casts = [];              // ✨ 스킬 연출 — 실제 시간으로 도는 별도 층
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

    // ── ✨ 스킬 연출 ──────────────────────────────────────────────────────
    // 액티브를 써도 화면에서는 숫자만 떴다. 스킬을 쓴 티가 안 나면 쓴 보람도 없다.
    //
    // 파티클(parts)과 따로 두는 이유는 **시간이 다르기 때문**이다. parts는
    // update(dt)에 얹혀 있어서 배속을 그대로 탄다. 10배속에서 0.5초짜리
    // 연출은 0.05초 — 세 프레임이라 보이지도 않는다. 연출은 사람이 보라고
    // 있는 것이므로 실제 시간으로 돈다(updateCasts는 프레임당 한 번).
    cast(kind, o) {
      if (casts.length > 24) casts.shift();
      casts.push(Object.assign({ kind, t: 0, dur: 0.5, color: '#c4b5fd' }, o || {}));
    },
    updateCasts(dtReal) {
      for (let i = casts.length - 1; i >= 0; i--) {
        casts[i].t += dtReal;
        if (casts[i].t >= casts[i].dur) casts.splice(i, 1);
      }
    },
    drawCasts(ctx) {
      for (const c of casts) {
        const p  = Math.min(1, c.t / c.dur);   // 0 → 1
        const fade = 1 - p;
        ctx.save();
        ctx.strokeStyle = c.color; ctx.fillStyle = c.color;
        switch (c.kind) {
          // 💥 폭발 — 차오르는 원 + 테두리 파동. 광역기 전반
          case 'nova': {
            const r = c.r * (0.25 + p * 0.9);
            ctx.globalAlpha = fade * 0.22;
            ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = fade * 0.9; ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI*2); ctx.stroke();
            ctx.globalAlpha = fade * 0.45; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.62, 0, Math.PI*2); ctx.stroke();
            break;
          }
          // ⚔ 베기 — 호가 연달아 쓸리고 지나간다
          case 'slash': {
            const n = c.n || 3;
            ctx.lineWidth = 4; ctx.lineCap = 'round';
            for (let k = 0; k < n; k++) {
              const kp = Math.min(1, Math.max(0, p * 1.5 - k * 0.22));
              if (kp <= 0 || kp >= 1) continue;
              const a0 = (c.a0 || 0) + k * 2.1 + kp * 2.4;
              ctx.globalAlpha = (1 - kp) * 0.85;
              ctx.beginPath();
              ctx.arc(c.x, c.y, c.r * (0.55 + kp * 0.5), a0, a0 + 1.5);
              ctx.stroke();
            }
            break;
          }
          // 🏹 관통 — 굵은 빛줄기가 가늘어지며 사라진다
          case 'beam': {
            ctx.lineCap = 'round';
            ctx.globalAlpha = fade * 0.28; ctx.lineWidth = (c.w || 14) * (1 - p * 0.5);
            ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2); ctx.stroke();
            ctx.globalAlpha = fade;        ctx.lineWidth = Math.max(1, (c.w || 14) * 0.28 * (1 - p));
            ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2); ctx.stroke();
            break;
          }
          // 🌧 쏟아짐 — 사각 영역에 빗금이 떨어진다
          case 'rain': {
            const n = c.n || 18;
            ctx.lineWidth = 2; ctx.lineCap = 'round';
            for (let k = 0; k < n; k++) {
              const seed = (k * 9301 + 49297) % 233280 / 233280;
              const kp = (p * 1.4 - seed * 0.5);
              if (kp <= 0 || kp >= 1) continue;
              const x = c.x + seed * c.w;
              const y = c.y + kp * c.h;
              ctx.globalAlpha = (1 - kp) * 0.9;
              ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 2, y); ctx.stroke();
            }
            break;
          }
          // 🗼 기둥 — 한 점에서 위로 솟는 빛
          case 'pillar': {
            const w = (c.w || 26) * (1 - p * 0.6);
            ctx.globalAlpha = fade * 0.30;
            ctx.fillRect(c.x - w/2, c.y - (c.h || 90), w, (c.h || 90));
            ctx.globalAlpha = fade * 0.85; ctx.lineWidth = 2;
            ctx.strokeRect(c.x - w/2, c.y - (c.h || 90), w, (c.h || 90));
            break;
          }
          // 🌊 띠 — 한쪽 전선 전체를 색으로 한 번 쓸어 준다
          case 'wash': {
            ctx.globalAlpha = fade * 0.20;
            ctx.fillRect(0, c.y, CW, c.h);
            ctx.globalAlpha = fade * 0.7; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, c.y + c.h * p); ctx.lineTo(CW, c.y + c.h * p); ctx.stroke();
            break;
          }
          // 🔮 문양 — 도는 룬 고리. 버프·강화처럼 '나에게 거는' 스킬
          case 'runes': {
            const n = 6, r = c.r * (0.7 + p * 0.35);
            ctx.globalAlpha = fade * 0.8; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI*2); ctx.stroke();
            for (let k = 0; k < n; k++) {
              const a = p * 4 + k * (Math.PI*2/n);
              const gx = c.x + Math.cos(a) * r, gy = c.y + Math.sin(a) * r;
              ctx.beginPath(); ctx.arc(gx, gy, 3.2, 0, Math.PI*2); ctx.fill();
            }
            break;
          }
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },

    clear() { parts.length = 0; bolts.length = 0; casts.length = 0; shakeMag = 0; shakeTime = 0; }
  };
})();
