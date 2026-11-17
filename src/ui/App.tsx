import { useMemo } from 'react';
import { arcY, searchCritical } from '../engine';
import type { SlopeModel } from '../engine';

const MODEL: SlopeModel = {
  ground: [
    { x: 20, y: 25 },
    { x: 30, y: 25 },
    { x: 50, y: 35 },
    { x: 70, y: 35 },
  ],
  soils: [{ id: 'a', name: 'Clayey silt', pattern: 'clay', gamma: 20, c: 3, phi: 19.6 }],
  boundaries: [],
  base: 20,
  water: { kind: 'none' },
  gammaW: 9.81,
  surcharges: [],
  kh: 0,
  crack: null,
};

/** Placeholder page while the full interface is being built: runs one benchmark slope. */
export function App() {
  const result = useMemo(() => searchCritical(MODEL), []);
  const c = result.critical;
  const sx = (x: number) => (x - 15) * 12;
  const sy = (y: number) => (60 - y) * 12;
  const ground = MODEL.ground.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const arc = c
    ? Array.from({ length: 41 }, (_, i) => {
        const x = c.toe.x + ((c.crest.x - c.toe.x) * i) / 40;
        return `${sx(x)},${sy(arcY(c.circle, x))}`;
      }).join(' ')
    : '';
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>SlopeForge</h1>
      <p>Slope stability analysis in the browser. The full interface is on its way.</p>
      <svg width={720} height={520} role="img" aria-label="Slope with critical circle">
        <polygon
          points={`${ground} ${sx(70)},${sy(20)} ${sx(20)},${sy(20)}`}
          fill="#e4dac4"
          stroke="#111"
        />
        <polyline points={arc} fill="none" stroke="#c2311d" strokeWidth={2} />
      </svg>
      {c && (
        <p className="fos">
          ACADS 1(a): Bishop F = {c.bishop.fos?.toFixed(3)}, Fellenius F ={' '}
          {c.fellenius.fos?.toFixed(3)}
        </p>
      )}
    </main>
  );
}
