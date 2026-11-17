import type { ReactNode } from 'react';
import type { Pattern } from '../engine';

/**
 * Strata are drawn the way a borehole log draws them: a muted earth tone with a traditional
 * hatch over it. Colours are set as SVG attributes so a drawing survives being rasterised.
 */
export const INK = '#16181a';
export const WATER = '#1f5fa8';
export const SLIP = '#c2311d';
export const MUTED = '#6d7175';
export const RULE = '#c9cccf';

export const PATTERNS: { id: Pattern; label: string; tone: string }[] = [
  { id: 'clay', label: 'Clay', tone: '#dccdbb' },
  { id: 'sand', label: 'Sand', tone: '#efe4c4' },
  { id: 'silt', label: 'Silt', tone: '#dfdccb' },
  { id: 'gravel', label: 'Gravel', tone: '#e6dccb' },
  { id: 'fill', label: 'Fill / made ground', tone: '#e3d9d3' },
  { id: 'rock', label: 'Rock', tone: '#d3d5d2' },
  { id: 'peat', label: 'Peat / organic', tone: '#c9bca6' },
];

export const toneOf = (pattern: Pattern): string =>
  PATTERNS.find((p) => p.id === pattern)?.tone ?? '#dddddd';

const MARK = '#4a4640';

function marks(pattern: Pattern): { size: [number, number]; body: ReactNode } {
  switch (pattern) {
    case 'sand':
      return {
        size: [14, 14],
        body: (
          <g fill={MARK}>
            <circle cx="2" cy="3" r="0.75" />
            <circle cx="9" cy="1.5" r="0.6" />
            <circle cx="6" cy="7.5" r="0.75" />
            <circle cx="12" cy="9.5" r="0.6" />
            <circle cx="2.5" cy="11.5" r="0.6" />
            <circle cx="8.5" cy="12.5" r="0.5" />
          </g>
        ),
      };
    case 'clay':
      return {
        size: [22, 12],
        body: (
          <g stroke={MARK} strokeWidth="0.9" fill="none">
            <line x1="1" y1="3" x2="10" y2="3" />
            <line x1="12" y1="9" x2="21" y2="9" />
          </g>
        ),
      };
    case 'silt':
      return {
        size: [20, 12],
        body: (
          <g stroke={MARK} strokeWidth="0.9" fill={MARK}>
            <line x1="1" y1="3" x2="7" y2="3" />
            <circle cx="11" cy="3" r="0.6" stroke="none" />
            <line x1="11" y1="9" x2="17" y2="9" />
            <circle cx="3" cy="9" r="0.6" stroke="none" />
          </g>
        ),
      };
    case 'gravel':
      return {
        size: [22, 18],
        body: (
          <g stroke={MARK} strokeWidth="0.8" fill="none">
            <ellipse cx="5" cy="5" rx="3" ry="2.2" />
            <ellipse cx="15.5" cy="12.5" rx="3.4" ry="2.4" />
            <circle cx="14" cy="3.5" r="1.3" />
            <circle cx="4.5" cy="13.5" r="1.5" />
            <circle cx="10" cy="9" r="0.6" fill={MARK} stroke="none" />
          </g>
        ),
      };
    case 'fill':
      return {
        size: [14, 14],
        body: (
          <g stroke={MARK} strokeWidth="0.7" fill="none">
            <line x1="0" y1="14" x2="14" y2="0" />
            <line x1="0" y1="0" x2="14" y2="14" />
          </g>
        ),
      };
    case 'rock':
      return {
        size: [28, 16],
        body: (
          <g stroke={MARK} strokeWidth="0.8" fill="none">
            <line x1="0" y1="0.5" x2="28" y2="0.5" />
            <line x1="0" y1="8.5" x2="28" y2="8.5" />
            <line x1="8" y1="0.5" x2="5" y2="8.5" />
            <line x1="22" y1="8.5" x2="19" y2="16.5" />
          </g>
        ),
      };
    case 'peat':
      return {
        size: [22, 14],
        body: (
          <g stroke={MARK} strokeWidth="0.8" fill="none">
            <path d="M2 5 l2 -3 M4 5 l0 -4 M6 5 l-2 -3" />
            <path d="M13 12 l2 -3 M15 12 l0 -4 M17 12 l-2 -3" />
            <line x1="9" y1="5" x2="14" y2="5" />
            <line x1="1" y1="12" x2="6" y2="12" />
          </g>
        ),
      };
  }
}

/** `<pattern>` definitions for every hatch; ids are `${prefix}-${pattern}`. */
export function HatchDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      {PATTERNS.map((p) => {
        const m = marks(p.id);
        return (
          <pattern
            key={p.id}
            id={`${prefix}-${p.id}`}
            width={m.size[0]}
            height={m.size[1]}
            patternUnits="userSpaceOnUse"
          >
            <rect width={m.size[0]} height={m.size[1]} fill={p.tone} />
            {m.body}
          </pattern>
        );
      })}
    </defs>
  );
}

/** A small rectangle of hatch, as in the legend column of a borehole log. */
export function Swatch({
  pattern,
  width = 34,
  height = 26,
}: {
  pattern: Pattern;
  width?: number;
  height?: number;
}) {
  const prefix = `sw-${pattern}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <HatchDefs prefix={prefix} />
      <rect width={width} height={height} fill={`url(#${prefix}-${pattern})`} />
    </svg>
  );
}
