import React from 'react';

// ─── Kutubxonasiz SVG chiziqli grafik (GSC uslubidagi) ────────────────────
// Ustun EMAS — nuqtalarni tutashtiruvchi chiziq. Bir nechta seriya bir
// vaqtda ko'rinadi (almashinuv/toggle yo'q). `showValues` bilan har nuqta
// ustida aniq son, aks holda sonlar + o'qiydigan jadval modallar ostida.

export interface LineSeries {
  name: string;
  color: string;   // hex (SVG stroke/fill uchun)
  values: number[];
}

interface LineChartProps {
  labels: string[];        // x o'qi (masalan oy qisqartmalari)
  series: LineSeries[];
  height?: number;         // viewBox balandligi (px)
  showValues?: boolean;    // har nuqta ustida aniq son
  compact?: boolean;       // sparkline: o'qlar/teglar/sonlar yo'q
  formatValue?: (n: number) => string;
}

// Ichki koordinota tizimi — viewBox orqali bir tekis masshtablanadi (matn
// buzilmaydi), shuning uchun ResizeObserver shart emas.
const W = 760;

export const LineChart: React.FC<LineChartProps> = ({
  labels,
  series,
  height = 240,
  showValues = false,
  compact = false,
  formatValue = (n) => String(n),
}) => {
  const H = height;
  const n = labels.length;
  const padL = compact ? 2 : 40;
  const padR = compact ? 2 : 16;
  const padT = compact ? 6 : 24;
  const padB = compact ? 6 : 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxV = Math.max(1, ...series.flatMap((s) => s.values));
  const xAt = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + (1 - v / maxV) * plotH;

  const ticks = 4;

  if (n === 0) {
    return <div className="h-40 flex items-center justify-center text-xs text-gray-400">—</div>;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img">
      {/* Gorizontal to'r chiziqlari + y o'qi sonlari */}
      {!compact &&
        Array.from({ length: ticks + 1 }).map((_, k) => {
          const val = (maxV / ticks) * k;
          const y = yAt(val);
          return (
            <g key={`grid-${k}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#eef2f7" strokeWidth={1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#9ca3af">
                {Math.round(val)}
              </text>
            </g>
          );
        })}

      {/* X o'qi belgilari (oy/qisqa sana) */}
      {!compact &&
        labels.map((lb, i) => (
          <text key={`xl-${i}`} x={xAt(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#9ca3af">
            {lb}
          </text>
        ))}

      {/* Seriyalar: chiziq + nuqtalar + (ixtiyoriy) aniq sonlar */}
      {series.map((s) => {
        const pts = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
        return (
          <g key={s.name}>
            <polyline
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={compact ? 1.5 : 2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => (
              <circle
                key={`pt-${s.name}-${i}`}
                cx={xAt(i)}
                cy={yAt(v)}
                r={compact ? 0 : 3}
                fill="#ffffff"
                stroke={s.color}
                strokeWidth={2}
              />
            ))}
            {showValues &&
              !compact &&
              s.values.map((v, i) => (
                <text
                  key={`vl-${s.name}-${i}`}
                  x={xAt(i)}
                  y={yAt(v) - 9}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill={s.color}
                >
                  {formatValue(v)}
                </text>
              ))}
          </g>
        );
      })}
    </svg>
  );
};

export default LineChart;
