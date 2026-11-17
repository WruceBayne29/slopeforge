import { fix } from '../engine';
import type { CircleAnalysis, CircleSuccess, SearchResult } from '../engine';
import type { Settings } from '../model/project';
import { INK, MUTED, SLIP } from './hatch';

interface Props {
  settings: Settings;
  search: SearchResult | null;
  critical: CircleSuccess | null;
  /** Analysis of the hand-placed circle, if there is one. */
  trial: CircleAnalysis | null;
  problems: string[];
  busy: boolean;
  elapsed: number | null;
  onToggleTrial: () => void;
}

export function verdict(f: number | null): {
  word: string;
  text: string;
  level: 'fail' | 'warn' | 'ok';
} {
  if (f === null || !Number.isFinite(f))
    return { word: 'No result', text: 'No factor of safety could be computed.', level: 'warn' };
  if (f < 1)
    return {
      word: 'Unstable',
      text: 'F is below 1: failure is predicted on this surface.',
      level: 'fail',
    };
  if (f < 1.25)
    return {
      word: 'Marginal',
      text: 'F is between 1.00 and 1.25: little margin against sliding.',
      level: 'warn',
    };
  if (f < 1.5)
    return {
      word: 'Moderate',
      text: 'F is between 1.25 and 1.50: often accepted for temporary slopes.',
      level: 'ok',
    };
  return {
    word: 'Adequate',
    text: 'F is at least 1.50, the margin usually asked of permanent slopes.',
    level: 'ok',
  };
}

/** A ruler from F = 0.5 to 2.5 with the two methods marked on it. */
function Gauge({ bishop, fellenius }: { bishop: number | null; fellenius: number | null }) {
  const w = 252;
  const x = (f: number): number => 8 + ((Math.min(2.5, Math.max(0.5, f)) - 0.5) / 2) * (w - 16);
  return (
    <svg
      className="gauge"
      width={w}
      height="46"
      viewBox={`0 0 ${w} 46`}
      role="img"
      aria-label="Factor of safety on a scale from 0.5 to 2.5"
    >
      <rect x={x(0.5)} y="18" width={x(1) - x(0.5)} height="6" fill={SLIP} fillOpacity="0.18" />
      <line x1={x(0.5)} y1="24" x2={x(2.5)} y2="24" stroke={INK} strokeWidth="1.2" />
      {Array.from({ length: 21 }, (_, i) => 0.5 + i * 0.1).map((f) => {
        const major = Math.abs(f * 2 - Math.round(f * 2)) < 1e-6;
        return (
          <line
            key={f}
            x1={x(f)}
            y1={major ? 15 : 20}
            x2={x(f)}
            y2="24"
            stroke={INK}
            strokeWidth={major ? 1.1 : 0.6}
          />
        );
      })}
      {[0.5, 1, 1.5, 2, 2.5].map((f) => (
        <text
          key={f}
          x={x(f)}
          y="38"
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="'JetBrains Mono', monospace"
          fill={f === 1 ? SLIP : MUTED}
        >
          {f.toFixed(1)}
        </text>
      ))}
      {fellenius !== null && (
        <path
          d={`M${x(fellenius) - 4} 4 h8 l-4 9 z`}
          fill="#ffffff"
          stroke={INK}
          strokeWidth="1.1"
        />
      )}
      {bishop !== null && <path d={`M${x(bishop) - 4.5} 3 h9 l-4.5 10 z`} fill={INK} />}
    </svg>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function circleRows(a: CircleSuccess): [string, string][] {
  return [
    ['Centre', `CH ${fix(a.circle.xc, 2)}  RL ${fix(a.circle.yc, 2)}`],
    ['Radius', `${fix(a.circle.r, 2)} m`],
    ['Toe end', `CH ${fix(a.toe.x, 2)}`],
    ['Crest end', `CH ${fix(a.crest.x, 2)}`],
    ['Greatest depth', `${fix(a.maxDepth, 2)} m`],
    ['Sliding mass', `${fix(a.area, 1)} m²  ·  ${fix(a.weight, 0)} kN/m`],
    ['Driving moment', `${fix(a.drivingMoment, 0)} kN·m/m`],
    [
      'Resisting (Bishop)',
      a.bishop.fos === null ? '–' : `${fix(a.bishop.resistingMoment, 0)} kN·m/m`,
    ],
    ['Resisting (ordinary)', `${fix(a.fellenius.resistingMoment, 0)} kN·m/m`],
  ];
}

/** The answer: factors of safety, where the critical circle is, and any cautions. */
export function Results({
  settings,
  search,
  critical,
  trial,
  problems,
  busy,
  elapsed,
  onToggleTrial,
}: Props) {
  const shown = trial?.ok ? trial : critical;
  const bishop = shown?.bishop.fos ?? null;
  const fellenius = shown?.fellenius.fos ?? null;
  const governing = settings.method === 'bishop' ? bishop : fellenius;
  const v = verdict(shown ? governing : null);
  const warnings = [...(shown?.warnings ?? []), ...(shown?.bishop.note ? [shown.bishop.note] : [])];

  return (
    <aside className="results" data-tour="results" aria-live="polite">
      <section className="panel answer">
        <header>
          <h2>Factor of safety</h2>
          <span className={`tag state ${busy ? 'busy' : ''}`}>
            {busy ? 'Searching…' : trial ? 'Trial circle' : 'Critical circle'}
          </span>
        </header>
        {problems.length > 0 ? (
          <div className="problems" role="alert">
            <strong>The section cannot be analysed yet.</strong>
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : !shown ? (
          <div className="problems" role="status">
            <strong>
              {trial && !trial.ok
                ? 'This trial circle cannot be analysed.'
                : busy
                  ? 'Working…'
                  : 'No slip circle found.'}
            </strong>
            <p>{trial && !trial.ok ? trial.message : (search?.message ?? '')}</p>
          </div>
        ) : (
          <>
            <div className="fos-pair">
              <div className={`fos ${settings.method === 'bishop' ? 'lead' : ''}`}>
                <span className="method">Bishop simplified</span>
                <span className="value" data-testid="fos-bishop">
                  {bishop === null ? '–' : fix(bishop, 3)}
                </span>
              </div>
              <div className={`fos ${settings.method === 'fellenius' ? 'lead' : ''}`}>
                <span className="method">Ordinary (Fellenius)</span>
                <span className="value" data-testid="fos-fellenius">
                  {fellenius === null ? '–' : fix(fellenius, 3)}
                </span>
              </div>
            </div>
            <Gauge bishop={bishop} fellenius={fellenius} />
            <p className={`verdict ${v.level}`}>
              <b>{v.word}.</b> {v.text}
            </p>
            {trial && !trial.ok && <p className="verdict warn">{trial.message}</p>}
          </>
        )}
      </section>

      {shown && (
        <section className="panel">
          <header>
            <h2>{trial?.ok ? 'Trial circle' : 'Critical circle'}</h2>
          </header>
          <Rows rows={circleRows(shown)} />
          {trial?.ok && critical && (
            <p className="hint">
              The search found F ={' '}
              {fix(
                (settings.method === 'bishop' ? critical.bishop.fos : critical.fellenius.fos) ??
                  NaN,
                3,
              )}
              ; no circle you place should come out lower.
            </p>
          )}
          <div className="row">
            <button
              type="button"
              className={settings.trial ? 'on' : ''}
              onClick={onToggleTrial}
              aria-pressed={settings.trial !== null}
            >
              {settings.trial ? 'Remove trial circle' : 'Place a trial circle'}
            </button>
          </div>
        </section>
      )}

      {warnings.length > 0 && (
        <section className="panel cautions">
          <header>
            <h2>Cautions</h2>
          </header>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {search && (
        <section className="panel">
          <header>
            <h2>Search record</h2>
          </header>
          <Rows
            rows={[
              ['Minimised', settings.method === 'bishop' ? 'Bishop simplified' : 'Ordinary method'],
              ['Trial centres', `${search.xs.length} × ${search.ys.length}`],
              ['Circles analysed', search.evaluated.toLocaleString('en-GB')],
              ['Best on the grid', search.gridMinimum === null ? '–' : fix(search.gridMinimum, 3)],
              [
                'After refinement',
                critical
                  ? fix(
                      (settings.method === 'bishop'
                        ? critical.bishop.fos
                        : critical.fellenius.fos) ?? NaN,
                      3,
                    )
                  : '–',
              ],
              ...(elapsed !== null ? ([['Time', `${elapsed} ms`]] as [string, string][]) : []),
            ]}
          />
        </section>
      )}
    </aside>
  );
}
