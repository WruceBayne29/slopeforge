import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, Ref } from 'react';
import { arcY, contourLevels, contours, fix, strataPolygons, yAt } from '../engine';
import type {
  Circle,
  CircleSuccess,
  Point,
  PreparedModel,
  SearchBox,
  SearchResult,
  SlopeModel,
} from '../engine';
import { deletePoint, insertPoint, movePoint, sameLine, snapTo } from '../model/edit';
import type { LineRef } from '../model/edit';
import type { Settings } from '../model/project';
import { HatchDefs, INK, MUTED, SLIP, WATER } from './hatch';
import { notify } from './toast';

export interface Selection {
  line: LineRef;
  index: number;
}

export interface SectionProps {
  title: string;
  model: SlopeModel;
  /** The model prepared for analysis, or null when it has problems. */
  prepared: PreparedModel | null;
  settings: Settings;
  search: SearchResult | null;
  critical: CircleSuccess | null;
  /** Analysis of the hand-placed circle, when there is one and it is valid. */
  trial: CircleSuccess | null;
  showMap: boolean;
  showSlices: boolean;
  selectedSlice: number | null;
  onSelectSlice: (index: number | null) => void;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  /** A change while dragging (not yet an undo step). */
  onPreviewModel: (model: SlopeModel) => void;
  onPreviewSettings: (patch: Partial<Settings>) => void;
  /** The drag has ended. */
  onSettle: () => void;
  /** A complete change (one undo step). */
  onCommitModel: (model: SlopeModel) => void;
  svgRef?: Ref<SVGSVGElement>;
}

const SANS = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";
const MARGIN = { left: 58, right: 16, top: 16, bottom: 92 };
/** Below this plot width the title block goes under the scale bar instead of beside it. */
const NARROW = 520;
const bottomMargin = (width: number): number =>
  width - MARGIN.left - MARGIN.right < NARROW ? MARGIN.bottom + 52 : MARGIN.bottom;

interface View {
  scale: number;
  /** World coordinates of the top-left corner of the plot area. */
  x0: number;
  y1: number;
  plot: { x: number; y: number; w: number; h: number };
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const m = raw / power;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * power;
}

type Drag =
  | { kind: 'vertex'; line: LineRef; index: number; start: SlopeModel }
  | { kind: 'trial-centre'; start: Circle; from: Point }
  | { kind: 'trial-radius'; start: Circle }
  | { kind: 'box'; corner: 0 | 1 | 2 | 3; start: SearchBox };

/** The cross-section drawing: strata, water, the slip circle, the map of trial centres. */
export function Section(props: SectionProps) {
  const { model, prepared, settings, search, critical, trial, showMap, selection } = props;
  const uid = useId().replace(/:/g, '');
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 560 });
  const drag = useRef<Drag | null>(null);
  const frozen = useRef<View | null>(null);
  const readout = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = (): void => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(320, Math.round(r.width)), h: Math.max(300, Math.round(r.height)) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const box = settings.box ?? search?.box ?? null;
  const shown = trial ?? critical;

  const live = useMemo<View>(() => {
    const xs = model.ground.map((p) => p.x);
    const ys = model.ground.map((p) => p.y);
    let xa = Math.min(...xs);
    let xb = Math.max(...xs);
    const high = Math.max(...ys);
    const low = Math.min(model.base, ...ys);
    let top = high + 0.25 * Math.max(high - low, 1);
    const include = (x: number, y: number): void => {
      xa = Math.min(xa, x);
      xb = Math.max(xb, x);
      top = Math.max(top, y);
    };
    const pad = 0.04 * (xb - xa);
    if (showMap && box) {
      include(Math.min(box.x1, box.x2) - pad, Math.max(box.y1, box.y2) + pad);
      include(Math.max(box.x1, box.x2) + pad, Math.max(box.y1, box.y2) + pad);
    }
    for (const c of [critical?.circle, settings.trial]) {
      if (c) {
        include(c.xc - 2 * pad, c.yc + 2 * pad);
        include(c.xc + 2 * pad, c.yc + 2 * pad);
      }
    }
    const w = size.w - MARGIN.left - MARGIN.right;
    const h = size.h - MARGIN.top - bottomMargin(size.w);
    const worldW = Math.max(xb - xa, 1e-6);
    const worldH = Math.max(top - low, 1e-6);
    const scale = Math.min(w / worldW, h / worldH);
    // centre the section horizontally; sit it on the bottom of the plot area
    const x0 = xa - (w / scale - worldW) / 2;
    const y1 = low + h / scale;
    return { scale, x0, y1, plot: { x: MARGIN.left, y: MARGIN.top, w, h } };
  }, [model.ground, model.base, box, showMap, critical, settings.trial, size]);

  const view = frozen.current ?? live;
  const X = (x: number): number => view.plot.x + (x - view.x0) * view.scale;
  const Y = (y: number): number => view.plot.y + (view.y1 - y) * view.scale;
  const pts = (line: readonly Point[]): string =>
    line.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');

  const toWorld = (e: { clientX: number; clientY: number }): Point => {
    const r = host.current?.getBoundingClientRect();
    const px = e.clientX - (r?.left ?? 0);
    const py = e.clientY - (r?.top ?? 0);
    return {
      x: view.x0 + (px - view.plot.x) / view.scale,
      y: view.y1 - (py - view.plot.y) / view.scale,
    };
  };

  const begin = (e: ReactPointerEvent<SVGElement>, d: Drag): void => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = d;
    frozen.current = view;
  };

  const onMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const world = toWorld(e);
    if (readout.current) {
      const inside =
        world.x >= view.x0 &&
        world.x <= view.x0 + view.plot.w / view.scale &&
        world.y <= view.y1 &&
        world.y >= view.y1 - view.plot.h / view.scale;
      readout.current.textContent = inside ? `CH ${fix(world.x, 2)}   RL ${fix(world.y, 2)}` : '';
    }
    const d = drag.current;
    if (!d) return;
    const snap = e.altKey ? 0 : settings.snap;
    if (d.kind === 'vertex') {
      props.onPreviewModel(movePoint(d.start, d.line, d.index, world, snap));
    } else if (d.kind === 'trial-centre') {
      props.onPreviewSettings({
        trial: {
          xc: snapTo(d.start.xc + world.x - d.from.x, snap),
          yc: snapTo(d.start.yc + world.y - d.from.y, snap),
          r: d.start.r,
        },
      });
    } else if (d.kind === 'trial-radius') {
      const r = Math.hypot(world.x - d.start.xc, world.y - d.start.yc);
      props.onPreviewSettings({ trial: { ...d.start, r: Math.max(0.5, snapTo(r, snap / 2)) } });
    } else {
      const b = { ...d.start };
      const x = snapTo(world.x, snap);
      const y = snapTo(world.y, snap);
      if (d.corner === 0 || d.corner === 3) b.x1 = x;
      else b.x2 = x;
      if (d.corner === 0 || d.corner === 1) b.y1 = y;
      else b.y2 = y;
      props.onPreviewSettings({ box: b });
    }
  };

  const onUp = (): void => {
    if (!drag.current) return;
    drag.current = null;
    frozen.current = null;
    props.onSettle();
  };

  // ----- axes -----
  const step = niceStep(70 / view.scale);
  const ticks = (from: number, to: number): number[] => {
    const out: number[] = [];
    for (let v = Math.ceil(from / step - 1e-9) * step; v <= to + 1e-9; v += step) {
      out.push(Math.round(v / step) * step);
    }
    return out;
  };
  const wx1 = view.x0 + view.plot.w / view.scale;
  const wy0 = view.y1 - view.plot.h / view.scale;
  const xTicks = ticks(view.x0, wx1);
  const yTicks = ticks(wy0, view.y1);
  const decimals = step < 1 ? 1 : 0;

  // ----- geometry to draw -----
  const xmin = model.ground[0].x;
  const xmax = model.ground[model.ground.length - 1].x;
  const strata = prepared ? strataPolygons(prepared) : [];
  const waterLine = prepared?.water ?? null;
  const ponds: Point[][] = [];
  if (prepared && waterLine) {
    const cuts = [xmin, ...prepared.breaks, xmax];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i];
      const b = cuts[i + 1];
      const m = 0.5 * (a + b);
      if (yAt(waterLine, m) > yAt(prepared.ground, m) + 1e-9) {
        ponds.push([
          { x: a, y: yAt(waterLine, a) },
          { x: b, y: yAt(waterLine, b) },
          { x: b, y: yAt(prepared.ground, b) },
          { x: a, y: yAt(prepared.ground, a) },
        ]);
      }
    }
  }

  const arcOf = (a: CircleSuccess): Point[] => {
    const lo = Math.min(a.toe.x, a.crest.x);
    const hi = Math.max(a.toe.x, a.crest.x);
    return Array.from({ length: 65 }, (_, i) => {
      const x = lo + ((hi - lo) * i) / 64;
      return { x, y: arcY(a.circle, x) };
    });
  };

  const levels = useMemo(() => {
    if (!search) return [];
    const flat = search.fos.flat().filter((v): v is number => v !== null);
    if (flat.length < 4) return [];
    return contours(
      search.xs,
      search.ys,
      search.fos,
      contourLevels(Math.min(...flat), Math.max(...flat)),
    );
  }, [search]);

  // One label per contour, each placed as far as possible from the labels already set down.
  const contourLabels = useMemo(() => {
    const placed: { level: number; x: number; y: number; text: string }[] = [];
    if (!search) return placed;
    const xa = search.xs[0];
    const xb = search.xs[search.xs.length - 1];
    const ya = search.ys[0];
    const yb = search.ys[search.ys.length - 1];
    const twoPlaces = levels.some((c) => Math.abs(c.level * 10 - Math.round(c.level * 10)) > 1e-6);
    for (const c of levels) {
      const path = [...c.paths].sort((p, q) => q.length - p.length)[0];
      if (!path || path.length < 3) continue;
      let best = path[0];
      let score = -Infinity;
      for (const p of path) {
        const edge = Math.min(p.x - xa, xb - p.x, p.y - ya, yb - p.y);
        let near = Infinity;
        for (const q of placed) near = Math.min(near, Math.hypot(p.x - q.x, p.y - q.y));
        const value = Math.min(near, 4 * edge);
        if (value > score) {
          score = value;
          best = p;
        }
      }
      placed.push({ level: c.level, x: best.x, y: best.y, text: fix(c.level, twoPlaces ? 2 : 1) });
    }
    return placed;
  }, [levels, search]);

  const lines: { ref: LineRef; points: Point[] }[] = [
    { ref: { kind: 'ground' }, points: model.ground },
    ...model.boundaries.map((b, index) => ({
      ref: { kind: 'boundary', index } as LineRef,
      points: b,
    })),
    ...(model.water.kind === 'line'
      ? [{ ref: { kind: 'water' } as LineRef, points: model.water.points }]
      : []),
  ];

  const insertAt = (ref: LineRef, e: { clientX: number; clientY: number }): void => {
    const world = toWorld(e);
    const x = snapTo(world.x, settings.snap);
    const added = insertPoint(model, ref, x) ?? insertPoint(model, ref, world.x);
    if (!added) {
      notify('There is already a point at that chainage.');
      return;
    }
    props.onCommitModel(added.model);
    props.onSelect({ line: ref, index: added.index });
  };

  const removeAt = (ref: LineRef, index: number): void => {
    const next = deletePoint(model, ref, index);
    if (!next) {
      notify(
        ref.kind === 'water'
          ? 'The water table needs at least one point.'
          : 'A line needs at least two points.',
      );
      return;
    }
    props.onCommitModel(next);
    props.onSelect(null);
  };

  const clip = `clip-${uid}`;
  const hatch = `hatch-${uid}`;
  const frameBottom = view.plot.y + view.plot.h;
  const stripY = frameBottom + 44;
  const narrow = view.plot.w < NARROW;
  const blockW = Math.min(250, view.plot.w);
  const barUnit = step / 2;
  const barPx = barUnit * view.scale;
  const trialCircle = settings.trial;

  return (
    <div className="section-host" ref={host}>
      <svg
        ref={props.svgRef}
        className="section"
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        role="img"
        aria-label="Cross-section of the slope with the critical slip circle"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => {
          if (readout.current) readout.current.textContent = '';
        }}
        onPointerDown={() => {
          props.onSelect(null);
          props.onSelectSlice(null);
        }}
      >
        <HatchDefs prefix={hatch} />
        <defs>
          <clipPath id={clip}>
            <rect x={view.plot.x} y={view.plot.y} width={view.plot.w} height={view.plot.h} />
          </clipPath>
        </defs>
        <rect width={size.w} height={size.h} fill="#ffffff" />

        {/* grid */}
        <g stroke="#eceeef" strokeWidth="1">
          {xTicks.map((v) => (
            <line key={`gx${v}`} x1={X(v)} y1={view.plot.y} x2={X(v)} y2={frameBottom} />
          ))}
          {yTicks.map((v) => (
            <line
              key={`gy${v}`}
              x1={view.plot.x}
              y1={Y(v)}
              x2={view.plot.x + view.plot.w}
              y2={Y(v)}
            />
          ))}
        </g>

        <g clipPath={`url(#${clip})`}>
          {/* strata */}
          {strata.map((poly, i) => (
            <polygon
              key={model.soils[i]?.id ?? i}
              className="stratum"
              points={pts(poly)}
              fill={`url(#${hatch}-${model.soils[i].pattern})`}
              stroke="none"
            />
          ))}
          {ponds.map((poly, i) => (
            <polygon
              key={`pond${i}`}
              points={pts(poly)}
              fill="#cfe1f3"
              fillOpacity="0.75"
              stroke="none"
            />
          ))}

          {/* firm base */}
          <g stroke={INK} strokeWidth="1.2">
            <line x1={X(xmin)} y1={Y(model.base)} x2={X(xmax)} y2={Y(model.base)} />
            {Array.from({ length: Math.max(0, Math.floor((X(xmax) - X(xmin)) / 9)) }, (_, i) => (
              <line
                key={`b${i}`}
                x1={X(xmin) + 9 * i + 7}
                y1={Y(model.base)}
                x2={X(xmin) + 9 * i}
                y2={Y(model.base) + 7}
                strokeWidth="0.8"
              />
            ))}
          </g>

          {/* boundaries and ground */}
          {(prepared?.boundaries ?? model.boundaries).map((b, i) => (
            <polyline
              key={`bd${i}`}
              points={pts(b)}
              fill="none"
              stroke="#3d4043"
              strokeWidth="0.9"
            />
          ))}
          <polyline
            className="ground-line"
            points={pts(model.ground)}
            fill="none"
            stroke={INK}
            strokeWidth="1.8"
            strokeLinejoin="miter"
          />
          {/* ground ticks, as on a survey section */}
          <g stroke={INK} strokeWidth="0.7">
            {model.ground.slice(0, -1).flatMap((p, i) => {
              const q = model.ground[i + 1];
              const len = Math.hypot(X(q.x) - X(p.x), Y(q.y) - Y(p.y));
              const n = Math.floor(len / 16);
              return Array.from({ length: n }, (_, k) => {
                const t = (k + 0.5) / n;
                const x = X(p.x) + t * (X(q.x) - X(p.x));
                const y = Y(p.y) + t * (Y(q.y) - Y(p.y));
                return <line key={`t${i}-${k}`} x1={x} y1={y} x2={x - 4} y2={y + 5} />;
              });
            })}
          </g>

          {/* water table */}
          {waterLine && (
            <g className="water-table">
              <polyline
                points={pts(waterLine)}
                fill="none"
                stroke={WATER}
                strokeWidth="1.4"
                strokeDasharray="9 3 2 3"
              />
              {(() => {
                const mid = 0.5 * (xmin + xmax) + 0.18 * (xmax - xmin);
                const wx = X(mid);
                const wy = Y(yAt(waterLine, mid));
                return (
                  <g stroke={WATER} strokeWidth="1.1" fill="none">
                    <path
                      d={`M${wx - 6} ${wy - 10} L${wx + 6} ${wy - 10} L${wx} ${wy - 1} Z`}
                      fill="#ffffff"
                    />
                    <line x1={wx - 6} y1={wy + 3.5} x2={wx + 6} y2={wy + 3.5} />
                    <line x1={wx - 3.5} y1={wy + 6.5} x2={wx + 3.5} y2={wy + 6.5} />
                  </g>
                );
              })()}
            </g>
          )}

          {/* surcharges */}
          {model.surcharges.map((s, i) => {
            const n = Math.max(2, Math.round(((s.x2 - s.x1) * view.scale) / 14));
            const topY = Math.min(Y(yAt(model.ground, s.x1)), Y(yAt(model.ground, s.x2))) - 22;
            return (
              <g key={`q${i}`} className="surcharge" stroke={INK} strokeWidth="0.9" fill={INK}>
                <line x1={X(s.x1)} y1={topY} x2={X(s.x2)} y2={topY} />
                {Array.from({ length: n + 1 }, (_, k) => {
                  const x = s.x1 + ((s.x2 - s.x1) * k) / n;
                  const gy = Y(yAt(model.ground, x)) - 1.5;
                  return (
                    <g key={k}>
                      <line x1={X(x)} y1={topY} x2={X(x)} y2={gy - 4} />
                      <path
                        d={`M${X(x) - 2.6} ${gy - 5} L${X(x) + 2.6} ${gy - 5} L${X(x)} ${gy} Z`}
                        stroke="none"
                      />
                    </g>
                  );
                })}
                <text
                  x={X(0.5 * (s.x1 + s.x2))}
                  y={topY - 5}
                  textAnchor="middle"
                  fontFamily={MONO}
                  fontSize="10"
                  stroke="none"
                >
                  {fix(s.q, 0)} kPa
                </text>
              </g>
            );
          })}

          {/* map of trial centres */}
          {showMap && box && (
            <g className="fos-map">
              <rect
                x={X(Math.min(box.x1, box.x2))}
                y={Y(Math.max(box.y1, box.y2))}
                width={Math.abs(box.x2 - box.x1) * view.scale}
                height={Math.abs(box.y2 - box.y1) * view.scale}
                fill="none"
                stroke={MUTED}
                strokeWidth="0.8"
                strokeDasharray="5 4"
              />
              {search?.ys.flatMap((y, j) =>
                search.xs.map((x, i) => {
                  const okPoint = search.fos[j][i] !== null;
                  return (
                    <path
                      key={`c${i}-${j}`}
                      d={`M${X(x) - 2.5} ${Y(y)} h5 M${X(x)} ${Y(y) - 2.5} v5`}
                      stroke={okPoint ? '#8b9095' : '#d5d8da'}
                      strokeWidth="0.8"
                    />
                  );
                }),
              )}
              {levels.map((c) => (
                <g key={`l${c.level}`}>
                  {c.paths.map((path, k) => (
                    <polyline
                      key={k}
                      className="contour"
                      points={pts(path)}
                      fill="none"
                      stroke={INK}
                      strokeWidth="0.75"
                      strokeOpacity="0.7"
                    />
                  ))}
                </g>
              ))}
              {contourLabels.map((l) => (
                <g key={`cl${l.level}`}>
                  <rect x={X(l.x) - 13} y={Y(l.y) - 6.5} width="26" height="12" fill="#ffffff" />
                  <text
                    x={X(l.x)}
                    y={Y(l.y) + 3}
                    textAnchor="middle"
                    fontFamily={MONO}
                    fontSize="9"
                    fill={INK}
                  >
                    {l.text}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* slices of the circle being shown */}
          {shown && props.showSlices && (
            <g className="slices">
              {shown.slices.map((s, i) => {
                const base = Array.from({ length: 5 }, (_, k) => {
                  const x = s.x2 - ((s.x2 - s.x1) * k) / 4;
                  return { x, y: arcY(shown.circle, x) };
                });
                const poly = [
                  { x: s.x1, y: yAt(model.ground, s.x1) },
                  { x: s.x2, y: yAt(model.ground, s.x2) },
                  ...base,
                ];
                const picked = props.selectedSlice === i;
                return (
                  <polygon
                    key={i}
                    className={picked ? 'slice picked' : 'slice'}
                    points={pts(poly)}
                    fill={picked ? SLIP : '#ffffff'}
                    fillOpacity={picked ? 0.22 : 0}
                    stroke={trial ? INK : SLIP}
                    strokeWidth="0.6"
                    strokeOpacity="0.75"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      props.onSelectSlice(picked ? null : i);
                    }}
                  />
                );
              })}
            </g>
          )}

          {/* critical circle */}
          {critical && (
            <g className="critical">
              <polyline
                points={pts(arcOf(critical))}
                fill="none"
                stroke={SLIP}
                strokeWidth={trial ? 1.4 : 2.4}
                strokeDasharray={trial ? '6 4' : undefined}
              />
              {critical.crackDepth > 0 && (
                <line
                  x1={X(critical.crest.x)}
                  y1={Y(critical.crest.y)}
                  x2={X(critical.crest.x)}
                  y2={Y(yAt(model.ground, critical.crest.x))}
                  stroke={SLIP}
                  strokeWidth="1.6"
                  strokeDasharray="3 2"
                />
              )}
              {!trial && (
                <g stroke={SLIP} strokeWidth="0.8" strokeDasharray="7 4" fill="none">
                  <line
                    x1={X(critical.circle.xc)}
                    y1={Y(critical.circle.yc)}
                    x2={X(critical.toe.x)}
                    y2={Y(critical.toe.y)}
                  />
                  <line
                    x1={X(critical.circle.xc)}
                    y1={Y(critical.circle.yc)}
                    x2={X(critical.crest.x)}
                    y2={Y(critical.crest.y)}
                  />
                </g>
              )}
              <g stroke={SLIP} strokeWidth="1.2" fill="#ffffff">
                <circle cx={X(critical.circle.xc)} cy={Y(critical.circle.yc)} r="4.5" />
                <path
                  d={`M${X(critical.circle.xc) - 8} ${Y(critical.circle.yc)} h16 M${X(critical.circle.xc)} ${Y(critical.circle.yc) - 8} v16`}
                />
              </g>
            </g>
          )}

          {/* hand-placed circle */}
          {trialCircle && (
            <g className="trial">
              {trial ? (
                <>
                  <polyline points={pts(arcOf(trial))} fill="none" stroke={INK} strokeWidth="2.2" />
                  <g stroke={INK} strokeWidth="0.8" strokeDasharray="7 4">
                    <line
                      x1={X(trialCircle.xc)}
                      y1={Y(trialCircle.yc)}
                      x2={X(trial.toe.x)}
                      y2={Y(trial.toe.y)}
                    />
                    <line
                      x1={X(trialCircle.xc)}
                      y1={Y(trialCircle.yc)}
                      x2={X(trial.crest.x)}
                      y2={Y(trial.crest.y)}
                    />
                  </g>
                </>
              ) : (
                <circle
                  cx={X(trialCircle.xc)}
                  cy={Y(trialCircle.yc)}
                  r={trialCircle.r * view.scale}
                  fill="none"
                  stroke={INK}
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
              )}
            </g>
          )}
        </g>

        {/* frame and axes */}
        <rect
          x={view.plot.x}
          y={view.plot.y}
          width={view.plot.w}
          height={view.plot.h}
          fill="none"
          stroke={INK}
          strokeWidth="1.2"
        />
        <g fontFamily={MONO} fontSize="10" fill={INK} stroke={INK} strokeWidth="1">
          {xTicks.map((v) => (
            <g key={`ax${v}`}>
              <line x1={X(v)} y1={frameBottom} x2={X(v)} y2={frameBottom + 5} />
              <text x={X(v)} y={frameBottom + 17} textAnchor="middle" stroke="none">
                {fix(v, decimals)}
              </text>
            </g>
          ))}
          {yTicks.map((v) => (
            <g key={`ay${v}`}>
              <line x1={view.plot.x - 5} y1={Y(v)} x2={view.plot.x} y2={Y(v)} />
              <text x={view.plot.x - 8} y={Y(v) + 3.5} textAnchor="end" stroke="none">
                {fix(v, decimals)}
              </text>
            </g>
          ))}
        </g>
        <g fontFamily={SANS} fontSize="11" fill={MUTED} letterSpacing="1.2">
          <text x={view.plot.x + view.plot.w / 2} y={frameBottom + 31} textAnchor="middle">
            CHAINAGE (m)
          </text>
          <text transform={`translate(13 ${view.plot.y + 4}) rotate(-90)`} textAnchor="end">
            REDUCED LEVEL (m)
          </text>
        </g>

        {/* labels that must not be clipped */}
        {critical && !trial && (
          <text
            className="fos-label"
            x={X(critical.circle.xc) + 12}
            y={Y(critical.circle.yc) - 9}
            fontFamily={MONO}
            fontSize="12"
            fontWeight="600"
            fill={SLIP}
          >
            F ={' '}
            {fix(
              (settings.method === 'bishop' ? critical.bishop.fos : critical.fellenius.fos) ?? NaN,
              3,
            )}
          </text>
        )}
        {trialCircle && trial && (
          <text
            x={X(trialCircle.xc) + 12}
            y={Y(trialCircle.yc) - 9}
            fontFamily={MONO}
            fontSize="12"
            fontWeight="600"
            fill={INK}
          >
            F ={' '}
            {fix((settings.method === 'bishop' ? trial.bishop.fos : trial.fellenius.fos) ?? NaN, 3)}
          </text>
        )}

        {/* scale bar and title block */}
        <g className="scale-bar" transform={`translate(${view.plot.x} ${stripY})`}>
          {[0, 1, 2, 3].map((k) => (
            <rect
              key={k}
              x={k * barPx}
              y="0"
              width={barPx}
              height="6"
              fill={k % 2 === 0 ? INK : '#ffffff'}
              stroke={INK}
              strokeWidth="0.8"
            />
          ))}
          <g fontFamily={MONO} fontSize="9.5" fill={INK}>
            {[0, 1, 2, 4].map((k) => (
              <text key={k} x={k * barPx} y="18" textAnchor="middle">
                {fix(k * barUnit, barUnit < 1 ? 1 : 0)}
                {k === 4 ? ' m' : ''}
              </text>
            ))}
          </g>
          <text x="0" y="33" fontFamily={SANS} fontSize="10.5" fill={MUTED} letterSpacing="1.1">
            SCALE BAR · HORIZONTAL = VERTICAL
          </text>
        </g>
        <g
          className="title-block"
          transform={`translate(${view.plot.x + view.plot.w - blockW} ${narrow ? stripY + 44 : stripY - 6})`}
        >
          <rect width={blockW} height="44" fill="#ffffff" stroke={INK} strokeWidth="1" />
          <line x1="0" y1="15" x2={blockW} y2="15" stroke={INK} strokeWidth="0.8" />
          <line x1={blockW - 82} y1="0" x2={blockW - 82} y2="15" stroke={INK} strokeWidth="0.8" />
          <text x="6" y="11" fontFamily={SANS} fontSize="10" letterSpacing="1.2" fill={INK}>
            GEOTECHNICAL SECTION A–A′
          </text>
          <text
            x={blockW - 76}
            y="11"
            fontFamily={SANS}
            fontSize="10"
            letterSpacing="1.2"
            fill={INK}
          >
            SLOPEFORGE
          </text>
          <text x="6" y="30" fontFamily={SANS} fontSize="13" fontWeight="600" fill={INK}>
            {props.title.length > 40 ? `${props.title.slice(0, 39)}…` : props.title}
          </text>
          <text x="6" y="40" fontFamily={SANS} fontSize="9" letterSpacing="0.8" fill={MUTED}>
            {model.soils.length} STRAT{model.soils.length === 1 ? 'UM' : 'A'} · SLIP CIRCLE BY
            METHOD OF SLICES
          </text>
        </g>

        {/* editing handles (not part of an exported drawing) */}
        <g className="handles" data-export="skip">
          {lines.map(({ ref, points }) => (
            <polyline
              key={`hit-${ref.kind}-${'index' in ref ? ref.index : ''}`}
              className="hit-line"
              points={pts(points)}
              fill="none"
              stroke="#000000"
              strokeOpacity="0"
              strokeWidth="12"
              pointerEvents="stroke"
              onDoubleClick={(e) => insertAt(ref, e)}
            >
              <title>Double-click to add a point</title>
            </polyline>
          ))}
          {/* ground points are drawn last so they stay on top where lines meet */}
          {[...lines].reverse().flatMap(({ ref, points }) =>
            points.map((p, index) => {
              const picked =
                selection !== null && sameLine(selection.line, ref) && selection.index === index;
              const colour = ref.kind === 'water' ? WATER : INK;
              return (
                <rect
                  key={`h-${ref.kind}-${'index' in ref ? ref.index : ''}-${index}`}
                  className={`handle handle-${ref.kind}${picked ? ' picked' : ''}`}
                  x={X(p.x) - (picked ? 5 : 4)}
                  y={Y(p.y) - (picked ? 5 : 4)}
                  width={picked ? 10 : 8}
                  height={picked ? 10 : 8}
                  fill={picked ? colour : '#ffffff'}
                  stroke={colour}
                  strokeWidth="1.3"
                  transform={ref.kind === 'ground' ? undefined : `rotate(45 ${X(p.x)} ${Y(p.y)})`}
                  onPointerDown={(e) => {
                    begin(e, { kind: 'vertex', line: ref, index, start: model });
                    props.onSelect({ line: ref, index });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    removeAt(ref, index);
                  }}
                >
                  <title>
                    {`${ref.kind === 'ground' ? 'Ground' : ref.kind === 'water' ? 'Water table' : `Boundary ${ref.index + 1}`} point ${index + 1}: CH ${fix(p.x, 2)}, RL ${fix(p.y, 2)} — drag to move, double-click to delete`}
                  </title>
                </rect>
              );
            }),
          )}
          {showMap && box && settings.box && (
            <g>
              {(
                [
                  [box.x1, box.y1],
                  [box.x2, box.y1],
                  [box.x2, box.y2],
                  [box.x1, box.y2],
                ] as const
              ).map(([x, y], corner) => (
                <rect
                  key={corner}
                  className="handle handle-box"
                  x={X(x) - 4}
                  y={Y(y) - 4}
                  width="8"
                  height="8"
                  fill="#ffffff"
                  stroke={MUTED}
                  strokeWidth="1.3"
                  onPointerDown={(e) =>
                    begin(e, { kind: 'box', corner: corner as 0 | 1 | 2 | 3, start: box })
                  }
                >
                  <title>Drag to resize the search grid</title>
                </rect>
              ))}
            </g>
          )}
          {trialCircle && (
            <g>
              <circle
                className="handle handle-trial-centre"
                cx={X(trialCircle.xc)}
                cy={Y(trialCircle.yc)}
                r="6"
                fill="#ffffff"
                stroke={INK}
                strokeWidth="1.6"
                onPointerDown={(e) =>
                  begin(e, { kind: 'trial-centre', start: trialCircle, from: toWorld(e) })
                }
              >
                <title>Drag to move the centre of the trial circle</title>
              </circle>
              <path
                d={`M${X(trialCircle.xc) - 3} ${Y(trialCircle.yc)} h6 M${X(trialCircle.xc)} ${Y(trialCircle.yc) - 3} v6`}
                stroke={INK}
                strokeWidth="1"
                pointerEvents="none"
              />
              <rect
                className="handle handle-trial-radius"
                x={X(trialCircle.xc) - 5}
                y={Y(trialCircle.yc - trialCircle.r) - 5}
                width="10"
                height="10"
                fill={INK}
                stroke="#ffffff"
                strokeWidth="1"
                onPointerDown={(e) => begin(e, { kind: 'trial-radius', start: trialCircle })}
              >
                <title>Drag to change the radius of the trial circle</title>
              </rect>
            </g>
          )}
        </g>
      </svg>
      <div className="readout" aria-hidden="true" ref={readout} />
    </div>
  );
}
