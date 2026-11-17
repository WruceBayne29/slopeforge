import { fix } from '../engine';
import type { Pattern, Point, SlopeModel, Surcharge } from '../engine';
import {
  addSoil,
  defaultWaterLine,
  linePoints,
  removeSoil,
  sameLine,
  updateSoil,
} from '../model/edit';
import type { LineRef } from '../model/edit';
import { cloneModel, LIMITS } from '../model/project';
import type { Settings } from '../model/project';
import { NumberField, TextField } from './fields';
import { PATTERNS, Swatch } from './hatch';
import type { Selection } from './Section';

interface Props {
  model: SlopeModel;
  settings: Settings;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  onModel: (model: SlopeModel) => void;
  onSettings: (patch: Partial<Settings>) => void;
}

const lineName = (line: LineRef): string =>
  line.kind === 'ground'
    ? 'Ground surface'
    : line.kind === 'water'
      ? 'Water table'
      : `Boundary ${line.index + 1}`;

/** The input side: strata laid out like a borehole log, then water, loads and analysis settings. */
export function LogPanel({ model, settings, selection, onSelect, onModel, onSettings }: Props) {
  const change = (edit: (m: SlopeModel) => void): void => {
    const next = cloneModel(model);
    edit(next);
    onModel(next);
  };
  const lines: LineRef[] = [
    { kind: 'ground' },
    ...model.boundaries.map((_, index) => ({ kind: 'boundary', index }) as LineRef),
    ...(model.water.kind === 'line' ? [{ kind: 'water' } as LineRef] : []),
  ];
  const active: LineRef = selection?.line ?? { kind: 'ground' };
  const activeLine = lines.find((l) => sameLine(l, active)) ?? lines[0];
  const points = linePoints(model, activeLine);
  const setPoints = (next: Point[]): void =>
    change((m) => {
      if (activeLine.kind === 'ground') m.ground = next;
      else if (activeLine.kind === 'boundary') m.boundaries[activeLine.index] = next;
      else m.water = { kind: 'line', points: next };
    });

  return (
    <aside className="log" data-tour="log">
      <section className="panel strata">
        <header>
          <h2>Borehole log</h2>
          <span className="tag">Strata, top down</span>
        </header>
        <table className="borehole">
          <thead>
            <tr>
              <th className="legend">Legend</th>
              <th className="desc">Description</th>
              <th className="sym" title="Bulk unit weight">
                γ<small>kN/m³</small>
              </th>
              <th className="sym" title="Effective cohesion">
                c′<small>kPa</small>
              </th>
              <th className="sym" title="Effective friction angle">
                φ′<small>deg</small>
              </th>
              <th aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {model.soils.map((soil, i) => (
              <tr key={soil.id} className="stratum-row">
                <td className="legend">
                  <Swatch pattern={soil.pattern} width={46} height={54} />
                </td>
                <td className="desc">
                  <TextField
                    label={`Stratum ${i + 1} description`}
                    value={soil.name}
                    onChange={(name) => onModel(updateSoil(model, i, { name }))}
                  />
                  <div className="sub">
                    <select
                      aria-label={`Stratum ${i + 1} hatch`}
                      value={soil.pattern}
                      onChange={(e) =>
                        onModel(updateSoil(model, i, { pattern: e.target.value as Pattern }))
                      }
                    >
                      {PATTERNS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <label title="Saturated unit weight used below the water table (blank = same as γ)">
                      <span>
                        γ<sub>sat</sub>
                      </span>
                      <NumberField
                        label={`Stratum ${i + 1} saturated unit weight`}
                        value={soil.gammaSat ?? NaN}
                        min={0}
                        decimals={2}
                        onChange={(gammaSat) =>
                          onModel(
                            updateSoil(model, i, { gammaSat: gammaSat > 0 ? gammaSat : undefined }),
                          )
                        }
                      />
                    </label>
                  </div>
                </td>
                <td>
                  <NumberField
                    label={`Stratum ${i + 1} unit weight`}
                    value={soil.gamma}
                    min={0}
                    step={0.5}
                    onChange={(gamma) => onModel(updateSoil(model, i, { gamma }))}
                  />
                </td>
                <td>
                  <NumberField
                    label={`Stratum ${i + 1} cohesion`}
                    value={soil.c}
                    min={0}
                    step={1}
                    onChange={(c) => onModel(updateSoil(model, i, { c }))}
                  />
                </td>
                <td>
                  <NumberField
                    label={`Stratum ${i + 1} friction angle`}
                    value={soil.phi}
                    min={0}
                    max={89}
                    step={1}
                    onChange={(phi) => onModel(updateSoil(model, i, { phi }))}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="icon"
                    aria-label={`Remove stratum ${i + 1}`}
                    title="Remove this stratum"
                    disabled={model.soils.length <= 1}
                    onClick={() => {
                      const next = removeSoil(model, i);
                      if (next) onModel(next);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row">
          <button type="button" onClick={() => onModel(addSoil(model))}>
            + Add stratum below
          </button>
          <label className="inline" title="No slip surface may pass below this level">
            Firm base RL
            <NumberField
              label="Firm base level"
              value={model.base}
              step={0.5}
              onChange={(base) => change((m) => (m.base = base))}
            />
            <span className="unit">m</span>
          </label>
        </div>
      </section>

      <section className="panel">
        <header>
          <h2>Groundwater</h2>
        </header>
        <div className="choice" role="radiogroup" aria-label="Pore pressure">
          {(
            [
              ['none', 'Dry'],
              ['line', 'Water table'],
              ['ru', 'ru ratio'],
            ] as const
          ).map(([kind, label]) => (
            <label key={kind} className={model.water.kind === kind ? 'on' : ''}>
              <input
                type="radio"
                name="water"
                checked={model.water.kind === kind}
                onChange={() =>
                  change((m) => {
                    if (kind === 'none') m.water = { kind: 'none' };
                    else if (kind === 'ru') m.water = { kind: 'ru', ru: 0.25 };
                    else m.water = { kind: 'line', points: defaultWaterLine(m) };
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        {model.water.kind === 'ru' && (
          <label className="inline">
            <span>
              r<sub>u</sub>
            </span>
            <NumberField
              label="Pore pressure ratio"
              value={model.water.ru}
              min={0}
              max={0.95}
              step={0.05}
              onChange={(ru) => change((m) => (m.water = { kind: 'ru', ru }))}
            />
            <span className="hint">
              u = r<sub>u</sub> × γh at the base of each slice
            </span>
          </label>
        )}
        {model.water.kind === 'line' && (
          <p className="hint">
            Drag the blue diamonds on the drawing. Pore pressure is γ<sub>w</sub> × depth below the
            line; water standing above the ground loads the surface.
          </p>
        )}
        {model.water.kind !== 'none' && (
          <label className="inline">
            γ<sub>w</sub>
            <NumberField
              label="Unit weight of water"
              value={model.gammaW}
              min={0.1}
              onChange={(v) => change((m) => (m.gammaW = v))}
            />
            <span className="unit">kN/m³</span>
          </label>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Loads</h2>
        </header>
        {model.surcharges.map((s, i) => {
          const set = (patch: Partial<Surcharge>): void =>
            change((m) => (m.surcharges[i] = { ...m.surcharges[i], ...patch }));
          return (
            <div className="load-row" key={i}>
              <span className="lbl">Surcharge</span>
              <NumberField
                label={`Surcharge ${i + 1} load`}
                value={s.q}
                min={0}
                step={5}
                onChange={(q) => set({ q })}
              />
              <span className="unit">kPa from CH</span>
              <NumberField
                label={`Surcharge ${i + 1} start`}
                value={s.x1}
                step={0.5}
                onChange={(x1) => set({ x1 })}
              />
              <span className="unit">to</span>
              <NumberField
                label={`Surcharge ${i + 1} end`}
                value={s.x2}
                step={0.5}
                onChange={(x2) => set({ x2 })}
              />
              <button
                type="button"
                className="icon"
                aria-label={`Remove surcharge ${i + 1}`}
                onClick={() => change((m) => m.surcharges.splice(i, 1))}
              >
                ×
              </button>
            </div>
          );
        })}
        <div className="row">
          <button
            type="button"
            onClick={() =>
              change((m) => {
                const g = m.ground;
                const top = g.reduce((a, b) => (b.y > a.y ? b : a));
                const span = g[g.length - 1].x - g[0].x;
                const x1 = Math.min(top.x + 0.04 * span, g[g.length - 1].x - 0.12 * span);
                m.surcharges.push({ x1: Math.round(x1), x2: Math.round(x1 + 0.1 * span), q: 10 });
              })
            }
          >
            + Add surcharge
          </button>
        </div>
        <label
          className="inline"
          title="Horizontal seismic coefficient: this fraction of the soil weight acts towards the toe"
        >
          <span>
            Seismic k<sub>h</sub>
          </span>
          <NumberField
            label="Seismic coefficient"
            value={model.kh}
            min={0}
            max={0.9}
            step={0.05}
            onChange={(kh) => change((m) => (m.kh = kh))}
          />
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={model.crack !== null}
            onChange={(e) =>
              change((m) => (m.crack = e.target.checked ? { depth: 1.5, water: 0 } : null))
            }
          />
          Tension crack
        </label>
        {model.crack && (
          <div className="load-row">
            <span className="lbl">Depth</span>
            <NumberField
              label="Tension crack depth"
              value={model.crack.depth}
              min={0.05}
              step={0.25}
              onChange={(depth) => change((m) => m.crack && (m.crack.depth = depth))}
            />
            <span className="unit">m, water-filled to</span>
            <NumberField
              label="Tension crack water"
              value={model.crack.water * 100}
              min={0}
              max={100}
              step={10}
              decimals={0}
              onChange={(pc) => change((m) => m.crack && (m.crack.water = pc / 100))}
            />
            <span className="unit">%</span>
          </div>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Search</h2>
        </header>
        <div className="choice" role="radiogroup" aria-label="Method to minimise">
          {(
            [
              ['bishop', 'Bishop'],
              ['fellenius', 'Fellenius'],
            ] as const
          ).map(([method, label]) => (
            <label key={method} className={settings.method === method ? 'on' : ''}>
              <input
                type="radio"
                name="method"
                checked={settings.method === method}
                onChange={() => onSettings({ method })}
              />
              Minimise {label}
            </label>
          ))}
        </div>
        <div className="grid2">
          <label className="inline">
            Slices
            <NumberField
              label="Number of slices"
              value={settings.slices}
              min={LIMITS.slices.min}
              max={LIMITS.slices.max}
              step={1}
              decimals={0}
              onChange={(slices) => onSettings({ slices })}
            />
          </label>
          <label className="inline" title="Trial centres along each side of the search grid">
            Grid
            <NumberField
              label="Search grid size"
              value={settings.grid}
              min={LIMITS.grid.min}
              max={LIMITS.grid.max}
              step={1}
              decimals={0}
              onChange={(grid) => onSettings({ grid })}
            />
          </label>
          <label className="inline" title="Ignore circles shallower than this">
            Min depth
            <NumberField
              label="Minimum depth of slip"
              value={settings.minDepth}
              min={0}
              step={0.25}
              onChange={(minDepth) => onSettings({ minDepth })}
            />
          </label>
          <label
            className="inline"
            title="Points snap to this spacing when dragged (hold Alt to move freely)"
          >
            Snap
            <NumberField
              label="Snap spacing"
              value={settings.snap}
              min={0}
              step={0.25}
              onChange={(snap) => onSettings({ snap })}
            />
          </label>
        </div>
        <div className="row">
          {settings.box ? (
            <button type="button" onClick={() => onSettings({ box: null })}>
              Reset search grid to automatic
            </button>
          ) : (
            <span className="hint">The grid of trial centres is placed automatically.</span>
          )}
        </div>
      </section>

      <section className="panel coords">
        <header>
          <h2>Survey points</h2>
          <select
            aria-label="Line to edit"
            value={lines.findIndex((l) => sameLine(l, activeLine))}
            onChange={(e) => onSelect({ line: lines[Number(e.target.value)], index: 0 })}
          >
            {lines.map((l, i) => (
              <option key={i} value={i}>
                {lineName(l)}
              </option>
            ))}
          </select>
        </header>
        <table className="points">
          <thead>
            <tr>
              <th>#</th>
              <th>Chainage (m)</th>
              <th>RL (m)</th>
              <th aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => {
              const picked =
                selection !== null && sameLine(selection.line, activeLine) && selection.index === i;
              return (
                <tr
                  key={i}
                  className={picked ? 'picked' : ''}
                  onFocus={() => onSelect({ line: activeLine, index: i })}
                >
                  <td>{i + 1}</td>
                  <td>
                    <NumberField
                      label={`${lineName(activeLine)} point ${i + 1} chainage`}
                      value={p.x}
                      onChange={(x) => setPoints(points.map((q, k) => (k === i ? { ...q, x } : q)))}
                    />
                  </td>
                  <td>
                    <NumberField
                      label={`${lineName(activeLine)} point ${i + 1} level`}
                      value={p.y}
                      onChange={(y) => setPoints(points.map((q, k) => (k === i ? { ...q, y } : q)))}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon"
                      aria-label={`Remove point ${i + 1}`}
                      disabled={points.length <= (activeLine.kind === 'water' ? 1 : 2)}
                      onClick={() => setPoints(points.filter((_, k) => k !== i))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="row">
          <button
            type="button"
            onClick={() => {
              const last = points[points.length - 1];
              const prev = points[points.length - 2] ?? { x: last.x - 10, y: last.y };
              setPoints([
                ...points,
                { x: last.x + Math.max(1, Math.round((last.x - prev.x) / 2)), y: last.y },
              ]);
            }}
          >
            + Add point at the end
          </button>
          <span className="hint">{fix(points.length, 0)} points</span>
        </div>
      </section>
    </aside>
  );
}
