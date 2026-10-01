import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext.tsx';
import type { EffectKey } from '../../lib/themePatterns.ts';

// ─── Bayram animatsiyalari uchun rang palitrasi ─────────────────────────
const FLAG = { blue: '#1EB5DD', white: '#FFFFFF', green: '#1F9E53', red: '#CE1126' };
const FESTIVE = ['#FFD34E', '#FF6B6B', '#4ECDC4', '#A78BFA', '#F472B6', '#34D399', '#60A5FA'];

interface P {
  x: number; y: number; vx: number; vy: number;
  r: number; a: number; rot: number; vr: number;
  color: string; life: number; maxLife: number;
  tx?: number; ty?: number; // flagStars maqsad nuqtasi
}

/**
 * Butun sayt dizaynini o'zgartiruvchi mavzu muhiti:
 *  - fon qatlami (hudud rasmlari almashinuvi yaki gradient + naqsh)
 *  - canvas animatsiya qatlami (bayram effektlari)
 *  - yangi yil "chiroqlar" garlandasi
 */
export const ThemeAtmosphere: React.FC = () => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgIndex, setBgIndex] = useState(0);

  const backgrounds = theme.backgrounds;
  const hasImage = backgrounds.length > 0;
  const isDefault = theme.kind === 'default' && !hasImage;

  // Bir nechta fon rasmini almashib ko'rsatish
  useEffect(() => {
    if (backgrounds.length <= 1) { setBgIndex(0); return; }
    const t = setInterval(() => setBgIndex((i) => (i + 1) % backgrounds.length), 9000);
    return () => clearInterval(t);
  }, [backgrounds.length]);

  // ── Canvas animatsiya dvigateli ──
  useEffect(() => {
    const effect = theme.effect;
    const canvas = canvasRef.current;
    if (!canvas || effect === 'none') {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const particles: P[] = [];
    let rockets: P[] = [];
    let raf = 0;
    let frame = 0;

    const makeSnow = () => {
      particles.length = 0;
      const n = Math.min(160, Math.floor(w / 9));
      for (let i = 0; i < n; i++)
        particles.push({ x: rnd(0, w), y: rnd(0, h), vx: 0, vy: rnd(0.6, 2.2), r: rnd(1.2, 3.6), a: rnd(0.5, 1), rot: 0, vr: 0, color: '#fff', life: 0, maxLife: 1 });
    };
    const makePetals = () => {
      particles.length = 0;
      const n = Math.min(70, Math.floor(w / 22));
      const cols = ['#F9A8D4', '#FBCFE8', '#86EFAC', '#FDE68A', '#FCA5A5'];
      for (let i = 0; i < n; i++)
        particles.push({ x: rnd(0, w), y: rnd(-h, h), vx: rnd(-0.4, 0.4), vy: rnd(0.7, 1.9), r: rnd(4, 9), a: rnd(0.6, 1), rot: rnd(0, Math.PI), vr: rnd(-0.03, 0.03), color: cols[i % cols.length], life: 0, maxLife: 1 });
    };
    const makeSparkle = () => {
      particles.length = 0;
      const n = Math.min(90, Math.floor(w / 16));
      for (let i = 0; i < n; i++)
        particles.push({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.15, 0.15), vy: rnd(-0.5, -0.1), r: rnd(1, 2.6), a: rnd(0, 1), rot: 0, vr: 0, color: Math.random() > 0.5 ? '#FDE68A' : '#FFFFFF', life: rnd(0, 100), maxLife: 1 });
    };
    const makeFlagStars = () => {
      particles.length = 0;
      const n = 150;
      const targets = flagTargets(w, h, n);
      for (let i = 0; i < n; i++) {
        const t = targets[i];
        particles.push({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.6, 0.6), vy: rnd(-0.6, 0.6), r: rnd(2, 3.6), a: 1, rot: 0, vr: 0, color: t.color, life: 0, maxLife: 1, tx: t.x, ty: t.y });
      }
    };

    if (effect === 'snow') makeSnow();
    else if (effect === 'petals') makePetals();
    else if (effect === 'sparkle') makeSparkle();
    else if (effect === 'flagStars') makeFlagStars();

    // flagStars sikl holati (drift -> forming -> formed -> dispersing -> drift)
    let phase: 'drift' | 'forming' | 'formed' | 'dispersing' = 'drift';
    let phaseStart = performance.now();
    const CYCLE = 4.5 * 60 * 1000; // ~4.5 daqiqada bir marta bayroq hosil qiladi
    let nextFormAt = performance.now() + 2500; // birinchi marta tez ko'rinadi

    const drawStar = (x: number, y: number, r: number, color: string, alpha: number) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const ang2 = ang + Math.PI / 5;
        ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
        ctx.lineTo(x + Math.cos(ang2) * r * 0.45, y + Math.sin(ang2) * r * 0.45);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    };

    const loop = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);

      if (effect === 'snow') {
        for (const p of particles) {
          p.y += p.vy; p.x += Math.sin((p.y + p.r * 20) / 40) * 0.8;
          if (p.y > h + 5) { p.y = -5; p.x = rnd(0, w); }
          ctx.globalAlpha = p.a; ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (effect === 'petals') {
        for (const p of particles) {
          p.y += p.vy; p.x += p.vx + Math.sin(p.y / 30) * 0.6; p.rot += p.vr;
          if (p.y > h + 10) { p.y = -10; p.x = rnd(0, w); }
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.a; ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      } else if (effect === 'sparkle') {
        for (const p of particles) {
          p.y += p.vy; p.x += p.vx; p.life += 1;
          const tw = 0.5 + 0.5 * Math.sin(p.life / 12);
          if (p.y < -5) { p.y = h + 5; p.x = rnd(0, w); }
          drawStar(p.x, p.y, p.r * (0.8 + tw), p.color, 0.35 + tw * 0.6);
        }
      } else if (effect === 'fireworks') {
        // raketa uchirish
        if (frame % 70 === 0 && rockets.length < 6) {
          rockets.push({ x: rnd(w * 0.2, w * 0.8), y: h, vx: rnd(-0.6, 0.6), vy: rnd(-11, -8.5), r: 2.5, a: 1, rot: 0, vr: 0, color: FESTIVE[(frame / 70) % FESTIVE.length | 0], life: 0, maxLife: rnd(48, 66) });
        }
        for (let i = rockets.length - 1; i >= 0; i--) {
          const rk = rockets[i]; rk.x += rk.vx; rk.y += rk.vy; rk.vy += 0.16; rk.life++;
          ctx.globalAlpha = 1; ctx.fillStyle = rk.color;
          ctx.beginPath(); ctx.arc(rk.x, rk.y, rk.r, 0, Math.PI * 2); ctx.fill();
          if (rk.life >= rk.maxLife || rk.vy > -1) {
            const burst = 60; const col = rk.color;
            for (let j = 0; j < burst; j++) {
              const ang = (Math.PI * 2 * j) / burst; const sp = rnd(2, 5.5);
              particles.push({ x: rk.x, y: rk.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: rnd(1.4, 2.6), a: 1, rot: 0, vr: 0, color: Math.random() > 0.6 ? FESTIVE[j % FESTIVE.length] : col, life: 0, maxLife: rnd(50, 80) });
            }
            rockets.splice(i, 1);
          }
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.vx *= 0.98; p.life++;
          p.a = Math.max(0, 1 - p.life / p.maxLife);
          if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
          ctx.globalAlpha = p.a; ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (effect === 'flagStars') {
        const now = performance.now();
        const el = now - phaseStart;
        if (phase === 'drift') {
          for (const p of particles) {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;
          }
          if (now >= nextFormAt) { phase = 'forming'; phaseStart = now; }
        } else if (phase === 'forming' || phase === 'formed') {
          const k = phase === 'formed' ? 0.18 : 0.06;
          for (const p of particles) {
            p.x += (p.tx! - p.x) * k;
            p.y += (p.ty! - p.y) * k;
          }
          if (phase === 'forming' && el > 2800) { phase = 'formed'; phaseStart = now; }
          else if (phase === 'formed' && el > 12000) { phase = 'dispersing'; phaseStart = now; }
        } else {
          // dispersing — yana tarqaladi
          for (const p of particles) {
            p.x += p.vx * 2.2; p.y += p.vy * 2.2;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;
          }
          if (el > 2800) { phase = 'drift'; phaseStart = now; nextFormAt = now + CYCLE; }
        }
        for (const p of particles) drawStar(p.x, p.y, p.r, p.color, 0.92);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [theme.effect]);

  // ── Fon qatlami ──
  const bgStyle: React.CSSProperties = isDefault
    ? {}
    : hasImage
    ? {}
    : { backgroundImage: `linear-gradient(160deg, ${theme.accent}18 0%, ${theme.accentSoft} 60%, #ffffff 100%)` };

  return (
    <>
      {/* Fon qatlami — kontent ortida (z-0) */}
      {!isDefault && (
        <div className="th-atmo fixed inset-0 z-0 pointer-events-none" aria-hidden style={bgStyle}>
          {/* Admin yuklagan rasmlar (almashinadi) */}
          {backgrounds.map((src, i) => (
            <div
              key={src + i}
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2200ms] ease-in-out"
              style={{ backgroundImage: `url("${src}")`, opacity: i === bgIndex ? 1 : 0 }}
            />
          ))}
          {/* O'qish uchun nozik oq pardasi */}
          {hasImage && <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.86), rgba(255,255,255,.74))' }} />}
          {/* Madaniy naqsh qatlami */}
          <div className="th-atmo-ornament absolute inset-0" />
          {/* Aksent nur dog'lari */}
          <div className="absolute inset-0" style={{ background: `radial-gradient(1200px 400px at 50% -10%, ${theme.accent}22, transparent 70%)` }} />
        </div>
      )}

      {/* Bayram animatsiyasi — kontent ustida, lekin bosishlarni o'tkazadi */}
      {theme.effect !== 'none' && (
        <canvas ref={canvasRef} className="th-fx fixed inset-0 z-20 pointer-events-none" aria-hidden />
      )}

      {/* Yangi yil chiroqlari garlandasi */}
      {theme.effect === 'snow' && <YearLights />}
    </>
  );
};

// ─── O'zbekiston bayrog'i nuqtalari (flagStars maqsadlari) ───────────────
function flagTargets(w: number, h: number, n: number): { x: number; y: number; color: string }[] {
  const fw = Math.min(w * 0.6, 620);
  const fh = fw * 0.5;
  const fx = (w - fw) / 2;
  const fy = (h - fh) / 2 - 20;
  const out: { x: number; y: number; color: string }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const x = fx + Math.random() * fw;
    const band = t; // vertikal taqsimot
    let y: number, color: string;
    if (band < 0.33) { y = fy + Math.random() * (fh * 0.33); color = FLAG.blue; }
    else if (band < 0.66) { y = fy + fh * 0.33 + Math.random() * (fh * 0.34); color = FLAG.white; }
    else { y = fy + fh * 0.67 + Math.random() * (fh * 0.33); color = FLAG.green; }
    out.push({ x, y, color });
  }
  // Qizil chiziqlar (band chegaralari) va yarim oy+ulduzlar uchun bir guruh oq nuqta
  for (let i = 0; i < 18; i++) {
    out[i % n] = { x: fx + Math.random() * fw, y: fy + fh * 0.32 + (i % 2) * fh * 0.35, color: FLAG.red };
  }
  for (let i = 0; i < 14; i++) {
    const ang = (Math.PI * 2 * i) / 14;
    out[(n - 1 - i)] = { x: fx + fw * 0.16 + Math.cos(ang) * 26, y: fy + fh * 0.16 + Math.sin(ang) * 26, color: FLAG.white };
  }
  return out;
}

// ─── Yangi yil chiroqlari (yuqorida miltillosan gurland) ─────────────────
const YearLights: React.FC = () => {
  const bulbs = 26;
  return (
    <div className="th-garland fixed top-0 left-0 right-0 z-30 pointer-events-none flex justify-between px-2 pt-1" aria-hidden>
      {Array.from({ length: bulbs }).map((_, i) => (
        <span
          key={i}
          className="th-bulb"
          style={{ background: FESTIVE[i % FESTIVE.length], animationDelay: `${(i % 7) * 0.28}s` }}
        />
      ))}
    </div>
  );
};

export type { EffectKey };
