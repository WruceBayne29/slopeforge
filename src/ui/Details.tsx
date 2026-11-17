import { fix, workedSteps, yAt } from '../engine';
import type {
  CircleSuccess,
  SearchResult,
  SensitivityCurve,
  SlopeModel,
  WorkedSection,
  WorkedTable,
} from '../engine';
import type { Settings } from '../model/project';
import { ChartKey, LineChart } from './charts';
import type { Series } from './charts';

export type DetailTab = 'slices' | 'working' | 'forces' | 'compare' | 'sensitivity';

export function Table({
  table,
  picked,
  onPick,
}: {
  table: WorkedTable;
  picked?: number | null;
  onPick?: (row: number) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="calc">
        <caption>{table.caption}</caption>
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th key={i}>
                {h}
                {table.units[i] && <small>{table.units[i]}</small>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr
              key={r}
              className={picked === r ? 'picked' : ''}
              onClick={onPick ? () => onPick(r) : undefined}
            >
              {row.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {table.foot && (
          <tfoot>
            <tr>
              {table.foot.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function Step({ n, section }: { n: number; section: WorkedSection }) {
  return (
    <div className="step">
      <div className="step-no">{n}</div>
      <div className="step-body">
        <h3>{section.title}</h3>
        {section.lines.map((line, i) => (
          <p key={i} className={/^F = |^N′ = |^T = /.test(line) ? 'eq' : ''}>
            {line}
          </p>
        ))}
      </div>
      <div className="step-out">{section.result ?? ''}</div>
    </div>
  );
}

/** The calculation written out as a hand calculation. */
export function Working({ model, result }: { model: SlopeModel; result: CircleSuccess }) {
  const w = workedSteps(model, result);
  return (
    <div className="working">
      <Step n={1} section={w.circle} />
      <Step n={2} section={w.slices} />
      <Table table={w.sliceTable} />
      <Step n={3} section={w.fellenius} />
      <Step n={4} section={w.bishop} />
      <Table table={w.iterationTable} />
      {w.bishopTable && <Table table={w.bishopTable} />}
      <Step n={5} section={w.moments} />
      {w.notes.length > 0 && (
        <div className="notes">
          <h3>Notes</h3>
          <ul>
            {w.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SliceTable({
  model,
  result,
  picked,
  onPick,
}: {
  model: SlopeModel;
  result: CircleSuccess;
  picked: number | null;
  onPick: (index: number | null) => void;
}) {
  const w = workedSteps(model, result);
  return (
    <div>
      <Table table={w.sliceTable} picked={picked} onPick={(r) => onPick(picked === r ? null : r)} />
      <p className="hint">
        Click a row (or a slice on the drawing) to pick it out. F (ordinary) ={' '}
        {fix(result.fellenius.fos ?? NaN, 3)}, F (Bishop) = {fix(result.bishop.fos ?? NaN, 3)}.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Forces on one slice
// ---------------------------------------------------------------------------------------------

const DEG = Math.PI / 180;

function Arrow({
  x,
  y,
  dx,
  dy,
  colour,
  label,
  dashed,
  tail,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  colour: string;
  label: string;
  dashed?: boolean;
  /** Put the label at the tail of the arrow instead of the tip. */
  tail?: boolean;
}) {
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  const tipX = x + dx;
  const tipY = y + dy;
  const head = 7;
  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={tipX - ux * head * 0.6}
        y2={tipY - uy * head * 0.6}
        stroke={colour}
        strokeWidth="1.6"
        strokeDasharray={dashed ? '4 3' : undefined}
      />
      <path
        d={`M${tipX} ${tipY} L${tipX - ux * head - uy * 3.2} ${tipY - uy * head + ux * 3.2} L${tipX - ux * head + uy * 3.2} ${tipY - uy * head - ux * 3.2} Z`}
        fill={colour}
      />
      <text
        x={tail ? x - ux * 6 : tipX + ux * 8}
        y={tail ? y - uy * 12 + 4 : tipY + uy * 12 + 4}
        textAnchor={tail ? 'middle' : ux < -0.3 ? 'end' : 'start'}
        fontFamily="'JetBrains Mono', monospace"
        fontSize="11"
        fill={colour}
        stroke="#ffffff"
        strokeWidth="3"
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  );
}

/** Free-body diagram of one slice with the forces each method puts on it. */
export function SliceForces({
  model,
  result,
  picked,
  onPick,
}: {
  model: SlopeModel;
  result: CircleSuccess;
  picked: number | null;
  onPick: (i: number) => void;
}) {
  const gammaW = model.gammaW;
  const fallback = result.slices.reduce(
    (best, s, i) => (s.weight > result.slices[best].weight ? i : best),
    0,
  );
  const index = picked !== null && result.slices[picked] ? picked : fallback;
  const s = result.slices[index];
  const { circle, dir } = result;
  const yb = (x: number): number =>
    circle.yc - Math.sqrt(Math.max(0, circle.r ** 2 - (x - circle.xc) ** 2));
  const W = 380;
  const H = 330;
  const base1 = yb(s.x1);
  const base2 = yb(s.x2);
  const top1 = yAt(model.ground, s.x1);
  const top2 = yAt(model.ground, s.x2);
  // A schematic, not to scale: fixed width, true base and ground angles, height in proportion.
  const half = 55;
  const clampTan = (t: number): number => Math.max(-1.6, Math.min(1.6, t));
  const baseRise = half * clampTan((base2 - base1) / s.b);
  const topRise = half * clampTan((top2 - top1) / s.b);
  const tallest = Math.max(...result.slices.map((q) => q.h), 1e-9);
  const tall = 40 + 95 * (s.h / tallest);
  const cxm = W / 2;
  const bym = H / 2 + tall / 2 + 8;
  const poly = [
    [cxm - half, bym - tall + topRise],
    [cxm + half, bym - tall - topRise],
    [cxm + half, bym - baseRise],
    [cxm - half, bym + baseRise],
  ];
  const fBishop = result.bishop.fos;
  const fFell = result.fellenius.fos ?? 0;
  const mobilised =
    fBishop && fBishop > 0 ? s.tBishop / fBishop : fFell > 0 ? s.tFellenius / fFell : 0;
  const normal = fBishop && fBishop > 0 ? s.nBishop : s.nFellenius;
  const forces = [s.load, Math.abs(normal), s.u * s.l, mobilised, Math.abs(s.hForce)];
  const unit = 86 / Math.max(...forces, 1e-9);
  const size = (f: number): number => Math.max(16, Math.abs(f) * unit);
  // base geometry on screen (y grows downwards)
  const theta = Math.atan2(-2 * baseRise, 2 * half);
  const tx = Math.cos(theta);
  const ty = Math.sin(theta);
  const nx = ty; // unit normal pointing up into the slice (screen)
  const ny = -tx;
  const bx = cxm;
  const by = bym;
  const cx = cxm;
  const cy = bym - tall / 2;
  const ink = '#16181a';
  const water = '#1f5fa8';
  const slip = '#c2311d';
  const rows: [string, string, string][] = [
    ['Width b', `${fix(s.b, 2)} m`, ''],
    ['Mean height h', `${fix(s.h, 2)} m`, ''],
    ['Base angle α', `${fix(s.alpha / DEG, 1)}°`, 'positive where the base dips towards the toe'],
    ['Base length l = b sec α', `${fix(s.l, 2)} m`, ''],
    [
      'Vertical load W',
      `${fix(s.load, 1)} kN/m`,
      s.surcharge + s.pond > 0
        ? `soil ${fix(s.weight, 1)} + surface load ${fix(s.surcharge + s.pond, 1)}`
        : '',
    ],
    [
      'Pore pressure u',
      `${fix(s.u, 1)} kPa`,
      `water force on the base U = u l = ${fix(s.u * s.l, 1)} kN/m (γw = ${fix(gammaW, 2)})`,
    ],
    ['Strength on the base', `c′ = ${fix(s.c, 1)} kPa, φ′ = ${fix(s.phi, 1)}°`, ''],
    ['N′ (ordinary)', `${fix(s.nFellenius, 1)} kN/m`, 'W cos α − u l, inter-slice forces ignored'],
    [
      'N′ (Bishop)',
      fBishop ? `${fix(s.nBishop, 1)} kN/m` : '–',
      fBishop ? `vertical equilibrium, mα = ${fix(s.mAlpha, 3)}` : '',
    ],
    [
      'Strength available',
      `${fix(s.tFellenius, 1)} / ${fBishop ? fix(s.tBishop, 1) : '–'} kN/m`,
      'c′l + N′ tan φ′: ordinary / Bishop',
    ],
    [
      'Shear mobilised S',
      `${fix(mobilised, 1)} kN/m`,
      `strength ÷ F (${fBishop ? 'Bishop' : 'ordinary'})`,
    ],
    ['Driving term T', `${fix(s.driving, 1)} kN/m`, 'this slice’s share of Σ T'],
  ];
  return (
    <div className="forces">
      <div className="fbd">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Forces on slice ${s.index}`}
        >
          <rect width={W} height={H} fill="#ffffff" />
          <polygon
            points={poly.map((p) => p.join(',')).join(' ')}
            fill="#efe9dc"
            stroke={ink}
            strokeWidth="1.3"
          />
          <line
            x1={bx - tx * 60}
            y1={by - ty * 60}
            x2={bx + tx * 60}
            y2={by + ty * 60}
            stroke={ink}
            strokeWidth="0.6"
            strokeDasharray="3 3"
          />
          <Arrow
            x={cx}
            y={cy - size(s.load) / 2}
            dx={0}
            dy={size(s.load)}
            colour={ink}
            label={`W ${fix(s.load, 0)}`}
            tail
          />
          {Math.abs(s.hForce) > 1e-6 && (
            <Arrow
              x={cx}
              y={cy}
              dx={-dir * Math.sign(s.hForce) * size(s.hForce)}
              dy={0}
              colour={ink}
              label={`H ${fix(Math.abs(s.hForce), 0)}`}
              dashed
            />
          )}
          <Arrow
            x={bx - nx * (size(normal) + 3) + tx * 26}
            y={by - ny * (size(normal) + 3) + ty * 26}
            dx={nx * size(normal)}
            dy={ny * size(normal)}
            colour={ink}
            label={`N′ ${fix(normal, 0)}`}
            tail
          />
          {s.u > 0 && (
            <Arrow
              x={bx - nx * (size(s.u * s.l) + 3) - tx * 30}
              y={by - ny * (size(s.u * s.l) + 3) - ty * 30}
              dx={nx * size(s.u * s.l)}
              dy={ny * size(s.u * s.l)}
              colour={water}
              label={`U ${fix(s.u * s.l, 0)}`}
              tail
            />
          )}
          <Arrow
            x={bx - dir * tx * size(mobilised) * 0.5 + nx * 10}
            y={by - dir * ty * size(mobilised) * 0.5 + ny * 10}
            dx={dir * tx * size(mobilised)}
            dy={dir * ty * size(mobilised)}
            colour={slip}
            label={`S ${fix(mobilised, 0)}`}
          />
          <text
            x="8"
            y="16"
            fontFamily="'Barlow Condensed', sans-serif"
            fontSize="13"
            fontWeight="600"
            letterSpacing="1.2"
            fill={ink}
          >
            SLICE {s.index} OF {result.slices.length} · FORCES IN kN PER METRE RUN
          </text>
          <text
            x="8"
            y={H - 8}
            fontFamily="'Barlow Condensed', sans-serif"
            fontSize="11"
            letterSpacing="0.8"
            fill="#6d7175"
          >
            SCHEMATIC · ANGLES TRUE, SIZE NOT TO SCALE
          </text>
        </svg>
        <div className="row">
          <button type="button" disabled={index <= 0} onClick={() => onPick(index - 1)}>
            ← Previous
          </button>
          <button
            type="button"
            disabled={index >= result.slices.length - 1}
            onClick={() => onPick(index + 1)}
          >
            Next →
          </button>
        </div>
      </div>
      <div className="fbd-table">
        <table className="calc plain">
          <caption>Slice {s.index}: what goes into each method</caption>
          <tbody>
            {rows.map(([k, v, note]) => (
              <tr key={k}>
                <td>
                  {k}
                  {note && <small className="note">{note}</small>}
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          Neither method uses the forces between slices in this equation: the ordinary method
          ignores them altogether, Bishop keeps the horizontal ones but they cancel when moments are
          taken for the whole mass. Arrow lengths are to scale with one another.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Fellenius against Bishop
// ---------------------------------------------------------------------------------------------

const pct = (a: number, b: number): string =>
  `${a >= b ? '+' : '−'}${fix(Math.abs((a / b - 1) * 100), 1)} %`;

export function Compare({
  result,
  settings,
  search,
  other,
  busy,
}: {
  result: CircleSuccess;
  settings: Settings;
  search: SearchResult | null;
  other: SearchResult | null;
  busy: boolean;
}) {
  const fb = result.bishop.fos;
  const ff = result.fellenius.fos ?? 0;
  const stress: Series[] = [
    {
      name: 'Bishop simplified',
      style: 'solid',
      points: fb ? result.slices.map((s) => [s.xm, s.nBishop / s.l]) : [],
    },
    {
      name: 'Ordinary (Fellenius)',
      style: 'open',
      points: result.slices.map((s) => [s.xm, s.nFellenius / s.l]),
    },
  ];
  const strength: Series[] = [
    {
      name: 'Bishop simplified',
      style: 'solid',
      points: fb ? result.slices.map((s) => [s.xm, s.tBishop / s.l]) : [],
    },
    {
      name: 'Ordinary (Fellenius)',
      style: 'open',
      points: result.slices.map((s) => [s.xm, s.tFellenius / s.l]),
    },
  ];
  const convergence: Series[] = [
    { name: 'F', style: 'solid', points: result.bishop.iterations.map((f, i) => [i, f]) },
  ];
  const byBishop = settings.method === 'bishop' ? search : other;
  const byFellenius = settings.method === 'fellenius' ? search : other;
  const row = (label: string, r: SearchResult | null): string[] => {
    const c = r?.critical;
    if (!c) return [label, '…', '…', '…', '…', '…'];
    return [
      label,
      fix(c.circle.xc, 2),
      fix(c.circle.yc, 2),
      fix(c.circle.r, 2),
      c.bishop.fos === null ? '–' : fix(c.bishop.fos, 3),
      fix(c.fellenius.fos ?? NaN, 3),
    ];
  };
  return (
    <div className="compare">
      <div className="lede">
        <p>
          On this circle the ordinary method gives <b>F = {fix(ff, 3)}</b> and Bishop’s simplified
          method <b>F = {fb === null ? '–' : fix(fb, 3)}</b>
          {fb !== null && ff > 0 ? ` (${pct(fb, ff)})` : ''}. Both take moments about the centre and
          share the same driving moment; they differ only in the normal force they put on each slice
          base. The ordinary method resolves each slice on its own and ignores its neighbours, which
          under-estimates the normal force where the base is steep, so it is usually the lower of
          the two.
        </p>
      </div>
      <div className="charts">
        <figure>
          <LineChart
            title="Effective normal stress on the base"
            series={stress}
            xLabel="CHAINAGE (m)"
            yLabel="σ′n = N′ / l (kPa)"
            width={400}
            height={250}
          />
          <ChartKey series={stress} />
        </figure>
        <figure>
          <LineChart
            title="Shear strength along the base"
            series={strength}
            xLabel="CHAINAGE (m)"
            yLabel="τf (kPa)"
            width={400}
            height={250}
          />
          <ChartKey series={strength} />
        </figure>
        {result.bishop.iterations.length > 1 && (
          <figure>
            <LineChart
              title="Bishop’s iteration"
              series={convergence}
              xLabel="ITERATION"
              yLabel="F"
              width={280}
              height={250}
            />
            <figcaption className="hint">Starts from the ordinary-method value.</figcaption>
          </figure>
        )}
      </div>
      <Table
        table={{
          caption: `Critical circle found when each method is minimised${busy && !other ? ' (searching…)' : ''}`,
          head: ['Search minimises', 'Centre CH', 'Centre RL', 'Radius', 'F Bishop', 'F ordinary'],
          units: ['', 'm', 'm', 'm', '', ''],
          rows: [row('Bishop simplified', byBishop), row('Ordinary (Fellenius)', byFellenius)],
        }}
      />
      <p className="hint">
        The two methods do not have the same critical circle: each search finds the circle that is
        worst for its own method.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Sensitivity
// ---------------------------------------------------------------------------------------------

export function Sensitivity({
  curves,
  busy,
  method,
}: {
  curves: SensitivityCurve[] | null;
  busy: boolean;
  method: string;
}) {
  if (!curves)
    return (
      <p className="hint">
        {busy ? 'Working out the sensitivity curves…' : 'No sensitivity curves for this section.'}
      </p>
    );
  if (curves.length === 0)
    return <p className="hint">This section has no strength or water parameters to vary.</p>;
  const values = curves
    .flatMap((c) => c.points.map((p) => p.fos))
    .filter((f): f is number => f !== null);
  const lo = Math.min(...values, 1);
  const hi = Math.max(...values, 1);
  const pad = 0.06 * (hi - lo || 1);
  return (
    <div className="sensitivity">
      <p className="lede">
        Minimum factor of safety ({method}) as one quantity is varied and everything else is held.
        At every point the critical circle is searched for again near the present one, so the curve
        follows the slip surface as it moves.
      </p>
      <div className="charts">
        {curves.map((c) => {
          const points = c.points
            .filter((p) => p.fos !== null)
            .map((p) => [p.value, p.fos as number] as [number, number]);
          const first = points[0];
          const last = points[points.length - 1];
          return (
            <figure key={c.parameter} data-parameter={c.parameter}>
              <LineChart
                title={c.label}
                series={[{ name: c.label, style: 'solid', points }]}
                xLabel={c.axis}
                yLabel="F"
                yMark={1}
                xMark={c.base}
                yRange={[lo - pad, hi + pad]}
                width={310}
                height={240}
              />
              {first && last && (
                <figcaption className="hint">
                  F runs from {fix(first[1], 2)} to {fix(last[1], 2)} across the range.
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    </div>
  );
}
