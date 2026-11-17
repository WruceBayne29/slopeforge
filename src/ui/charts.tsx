import { fix } from '../engine';
import { INK, MUTED, SLIP } from './hatch';

export interface Series {
  name: string;
  points: [number, number][];
  /** 'solid' black, 'open' black with hollow markers, 'red'. */
  style: 'solid' | 'open' | 'red';
}

interface Props {
  series: Series[];
  xLabel: string;
  yLabel: string;
  width?: number;
  height?: number;
  /** Horizontal reference line, e.g. F = 1. */
  yMark?: number;
  /** Vertical reference line, e.g. the value in the model as it stands. */
  xMark?: number;
  yRange?: [number, number];
  title?: string;
}

function niceTicks(lo: number, hi: number, target: number): number[] {
  const span = hi - lo || 1;
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const m = raw / power;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * power;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step)
    out.push(Number(v.toFixed(10)));
  return out;
}

const decimalsFor = (ticks: number[]): number => {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
  return step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
};

const MONO = "'JetBrains Mono', monospace";
const SANS = "'Barlow Condensed', 'Arial Narrow', sans-serif";

/** A plain line chart drawn like a figure in a report: ruled frame, ticks outside, no colour fill. */
export function LineChart({
  series,
  xLabel,
  yLabel,
  width = 300,
  height = 220,
  yMark,
  xMark,
  yRange,
  title,
}: Props) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  const m = { l: 46, r: 12, t: title ? 22 : 10, b: 40 };
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = yRange ? yRange[0] : Math.min(...ys, yMark ?? Infinity);
  let y1 = yRange ? yRange[1] : Math.max(...ys, yMark ?? -Infinity);
  if (!yRange) {
    const pad = 0.08 * (y1 - y0 || 1);
    y0 -= pad;
    y1 += pad;
  }
  const w = width - m.l - m.r;
  const h = height - m.t - m.b;
  const X = (x: number): number => m.l + ((x - x0) / (x1 - x0 || 1)) * w;
  const Y = (y: number): number => m.t + (1 - (y - y0) / (y1 - y0 || 1)) * h;
  const xt = niceTicks(x0, x1, 5);
  const yt = niceTicks(y0, y1, 5);
  const xd = decimalsFor(xt);
  const yd = decimalsFor(yt);
  return (
    <svg
      className="chart"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${title ?? yLabel} against ${xLabel}`}
    >
      <rect width={width} height={height} fill="#ffffff" />
      {title && (
        <text
          x={m.l}
          y="13"
          fontFamily={SANS}
          fontSize="13"
          fontWeight="600"
          letterSpacing="1"
          fill={INK}
        >
          {title}
        </text>
      )}
      <g stroke="#eceeef">
        {xt.map((v) => (
          <line key={`x${v}`} x1={X(v)} y1={m.t} x2={X(v)} y2={m.t + h} />
        ))}
        {yt.map((v) => (
          <line key={`y${v}`} x1={m.l} y1={Y(v)} x2={m.l + w} y2={Y(v)} />
        ))}
      </g>
      {xMark !== undefined && xMark >= x0 && xMark <= x1 && (
        <line
          x1={X(xMark)}
          y1={m.t}
          x2={X(xMark)}
          y2={m.t + h}
          stroke={MUTED}
          strokeDasharray="2 3"
        />
      )}
      {yMark !== undefined && yMark >= y0 && yMark <= y1 && (
        <g>
          <line
            x1={m.l}
            y1={Y(yMark)}
            x2={m.l + w}
            y2={Y(yMark)}
            stroke={SLIP}
            strokeDasharray="6 3"
          />
          <text
            x={m.l + w - 3}
            y={Y(yMark) - 3}
            textAnchor="end"
            fontFamily={MONO}
            fontSize="9"
            fill={SLIP}
          >
            F = {fix(yMark, 1)}
          </text>
        </g>
      )}
      <rect x={m.l} y={m.t} width={w} height={h} fill="none" stroke={INK} />
      <g fontFamily={MONO} fontSize="9.5" fill={INK} stroke={INK}>
        {xt.map((v) => (
          <g key={`tx${v}`}>
            <line x1={X(v)} y1={m.t + h} x2={X(v)} y2={m.t + h + 4} />
            <text x={X(v)} y={m.t + h + 15} textAnchor="middle" stroke="none">
              {fix(v, xd)}
            </text>
          </g>
        ))}
        {yt.map((v) => (
          <g key={`ty${v}`}>
            <line x1={m.l - 4} y1={Y(v)} x2={m.l} y2={Y(v)} />
            <text x={m.l - 7} y={Y(v) + 3} textAnchor="end" stroke="none">
              {fix(v, yd)}
            </text>
          </g>
        ))}
      </g>
      <text
        x={m.l + w / 2}
        y={height - 6}
        textAnchor="middle"
        fontFamily={SANS}
        fontSize="11"
        letterSpacing="0.8"
        fill={MUTED}
      >
        {xLabel}
      </text>
      <text
        transform={`translate(11 ${m.t + h / 2}) rotate(-90)`}
        textAnchor="middle"
        fontFamily={SANS}
        fontSize="11"
        letterSpacing="0.8"
        fill={MUTED}
      >
        {yLabel}
      </text>
      {series.map((s) => {
        const colour = s.style === 'red' ? SLIP : INK;
        return (
          <g key={s.name}>
            <polyline
              points={s.points.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={colour}
              strokeWidth="1.5"
              strokeDasharray={s.style === 'open' ? '5 3' : undefined}
            />
            {s.points.length <= 40 &&
              s.points.map((p, i) => (
                <rect
                  key={i}
                  x={X(p[0]) - 2.5}
                  y={Y(p[1]) - 2.5}
                  width="5"
                  height="5"
                  fill={s.style === 'open' ? '#ffffff' : colour}
                  stroke={colour}
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}

export function ChartKey({ series }: { series: Series[] }) {
  return (
    <div className="chart-key">
      {series.map((s) => (
        <span key={s.name}>
          <svg width="26" height="10" aria-hidden="true">
            <line
              x1="0"
              y1="5"
              x2="26"
              y2="5"
              stroke={s.style === 'red' ? SLIP : INK}
              strokeWidth="1.5"
              strokeDasharray={s.style === 'open' ? '5 3' : undefined}
            />
            <rect
              x="10.5"
              y="2.5"
              width="5"
              height="5"
              fill={s.style === 'open' ? '#ffffff' : s.style === 'red' ? SLIP : INK}
              stroke={s.style === 'red' ? SLIP : INK}
            />
          </svg>
          {s.name}
        </span>
      ))}
    </div>
  );
}
