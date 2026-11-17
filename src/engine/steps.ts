/**
 * The calculation for one circle written out the way it is done by hand: the slice table, the
 * ordinary-method sum, and Bishop's iteration line by line.
 */
import { bishopSlice } from './methods';
import type { CircleSuccess, SlopeModel } from './types';

export interface WorkedSection {
  title: string;
  lines: string[];
  /** The value carried forward, e.g. "F = 1.403". */
  result?: string;
}

export interface WorkedTable {
  caption: string;
  head: string[];
  units: string[];
  rows: string[][];
  foot?: string[];
}

export interface Worked {
  circle: WorkedSection;
  slices: WorkedSection;
  sliceTable: WorkedTable;
  fellenius: WorkedSection;
  bishop: WorkedSection;
  /** One row per iteration of Bishop's equation. */
  iterationTable: WorkedTable;
  /** Slice-by-slice terms of Bishop's equation at the converged F. */
  bishopTable: WorkedTable | null;
  moments: WorkedSection;
  notes: string[];
}

const DEG = Math.PI / 180;

/** Fixed decimals, with a true minus sign. */
export function fix(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '–';
  const text = value.toFixed(decimals);
  const zero = Number(text) === 0;
  return (zero ? text.replace('-', '') : text).replace('-', '−');
}

export function workedSteps(model: SlopeModel, result: CircleSuccess): Worked {
  const { circle, slices } = result;
  const n = slices.length;
  const hasWater = slices.some((s) => s.u > 0);
  const hasExtra = slices.some((s) => s.surcharge > 0 || s.pond > 0);
  const hasSeismic = model.kh > 0;
  const tan = (phi: number): number => Math.tan(phi * DEG);

  const sum = (pick: (i: number) => number): number => {
    let total = 0;
    for (let i = 0; i < n; i++) total += pick(i);
    return total;
  };
  const sumCl = sum((i) => slices[i].c * slices[i].l);
  const sumFriction = sum((i) => Math.max(0, slices[i].nFellenius) * tan(slices[i].phi));
  const sumDriving = result.drivingMoment / circle.r;
  const fFellenius = result.fellenius.fos ?? 0;

  const sliceTable: WorkedTable = {
    caption: 'Slice table (forces per metre run of slope)',
    head: ['Slice', 'b', 'h', 'W', 'α', 'l', 'u', 'c′', 'φ′', 'N′', 'c′l + N′ tan φ′', 'T'],
    units: ['', 'm', 'm', 'kN', '°', 'm', 'kPa', 'kPa', '°', 'kN', 'kN', 'kN'],
    rows: slices.map((s) => [
      String(s.index),
      fix(s.b, 2),
      fix(s.h, 2),
      fix(s.load, 1),
      fix(s.alpha / DEG, 1),
      fix(s.l, 2),
      fix(s.u, 1),
      fix(s.c, 1),
      fix(s.phi, 1),
      fix(s.nFellenius, 1),
      fix(s.tFellenius, 1),
      fix(s.driving, 1),
    ]),
    foot: [
      'Σ',
      fix(
        sum((i) => slices[i].b),
        2,
      ),
      '',
      fix(
        sum((i) => slices[i].load),
        1,
      ),
      '',
      fix(
        sum((i) => slices[i].l),
        2,
      ),
      '',
      '',
      '',
      '',
      fix(
        sum((i) => slices[i].tFellenius),
        1,
      ),
      fix(sumDriving, 1),
    ],
  };

  const loadTerm = hasExtra
    ? 'W (soil weight plus any surcharge and ponded water on the slice)'
    : 'W = γ × area of the slice';
  const driving = hasSeismic
    ? 'T = W sin α + kh W (yc − ȳ)/R, the second term being the moment of the seismic force about the centre divided by R'
    : 'T = W sin α';
  const normal = `N′ = W cos α${hasSeismic ? ' − kh W sin α' : ''}${hasWater ? ' − u l' : ''}`;

  const bishopF = result.bishop.fos;
  const its = result.bishop.iterations;
  const iterationTable: WorkedTable = {
    caption: 'Bishop’s iteration',
    head: ['Step', 'F assumed', 'Σ [c′b + (W − ub) tan φ′] / mα', 'F computed', 'change'],
    units: ['', '', 'kN', '', ''],
    rows: its
      .slice(0, -1)
      .map((f, k) => [
        String(k + 1),
        fix(f, 4),
        fix(its[k + 1] * sumDriving, 1),
        fix(its[k + 1], 4),
        fix(its[k + 1] - f, 4),
      ]),
  };

  let bishopTable: WorkedTable | null = null;
  if (bishopF !== null && bishopF > 0) {
    bishopTable = {
      caption: `Bishop’s terms at F = ${fix(bishopF, 3)}`,
      head: ['Slice', 'c′b', '(W − ub) tan φ′', 'mα', '[c′b + (W − ub) tan φ′] / mα', 'T'],
      units: ['', 'kN', 'kN', '', 'kN', 'kN'],
      rows: slices.map((s) => {
        const b = bishopSlice(
          {
            b: s.b,
            alpha: s.alpha,
            l: s.l,
            load: s.load,
            hForce: s.hForce,
            u: s.u,
            c: s.c,
            tanPhi: tan(s.phi),
          },
          bishopF,
        );
        return [
          String(s.index),
          fix(s.c * s.b, 1),
          fix((s.load - s.u * s.b) * tan(s.phi), 1),
          fix(b.mAlpha, 3),
          fix(b.t, 1),
          fix(s.driving, 1),
        ];
      }),
      foot: [
        'Σ',
        '',
        '',
        '',
        fix(
          sum((i) => slices[i].tBishop),
          1,
        ),
        fix(sumDriving, 1),
      ],
    };
  }

  const notes: string[] = [];
  if (hasExtra) {
    notes.push(
      'W in the tables is the total vertical load on the slice: soil weight plus surcharge and any water standing on it.',
    );
  }
  if (slices.some((s) => s.pond > 0)) {
    notes.push(
      'Where water stands against the slope, its horizontal thrust on the ground surface is included in T as a moment about the centre divided by R (it resists sliding).',
    );
  }
  if (result.crackDepth > 0) {
    notes.push(
      `The slip surface ends at a tension crack ${fix(result.crackDepth, 2)} m deep${result.crackThrust > 0 ? `; the water in it pushes with ${fix(result.crackThrust, 1)} kN/m, whose moment about the centre is added to the driving side` : ''}.`,
    );
  }
  if (model.water.kind === 'ru') {
    notes.push(`Pore pressure from the ratio ru = ${fix(model.water.ru, 2)}: u = ru W / b.`);
  } else if (hasWater) {
    notes.push(
      `Pore pressure at the middle of each base: u = γw × depth below the phreatic line, with γw = ${fix(model.gammaW, 2)} kN/m³.`,
    );
  }
  notes.push(...result.warnings);

  return {
    circle: {
      title: 'Trial circle',
      lines: [
        `Centre O at chainage ${fix(circle.xc, 2)} m, level ${fix(circle.yc, 2)} m; radius R = ${fix(circle.r, 2)} m.`,
        `The arc meets the ground at chainage ${fix(result.toe.x, 2)} m (toe end) and ${fix(result.crest.x, 2)} m (crest end).`,
        `Sliding mass: area ${fix(result.area, 1)} m², weight ${fix(result.weight, 0)} kN per metre run; greatest depth ${fix(result.maxDepth, 2)} m.`,
        'Moments are taken about O, so the normal forces on the arc, which all pass through O, drop out.',
      ],
    },
    slices: {
      title: 'Divide the mass into vertical slices',
      lines: [
        `${n} slices. A slice boundary is placed at every change of ground slope, soil boundary and water-table crossing, so each slice has one soil on its base.`,
        `For each slice: width b, mean height h, ${loadTerm}.`,
        'Base angle α from the mid-point of the base: sin α = (xm − xc)/R, positive where the base dips towards the toe. Base length l = b sec α.',
        `Normal force on the base (ordinary method): ${normal}.`,
        `Driving term: ${driving}.`,
      ],
    },
    sliceTable,
    fellenius: {
      title: 'Ordinary method of slices (Fellenius)',
      lines: [
        'Inter-slice forces are ignored. Taking moments about O:',
        'F = Σ (c′l + N′ tan φ′) / Σ T',
        `F = (${fix(sumCl, 1)} + ${fix(sumFriction, 1)}) / ${fix(sumDriving, 1)}`,
      ],
      result: `F = ${fix(fFellenius, 3)}`,
    },
    bishop: {
      title: 'Bishop’s simplified method',
      lines: [
        'Each slice is resolved vertically (inter-slice shear ignored), which puts F on both sides:',
        'F = Σ { [c′b + (W − ub) tan φ′] / mα } / Σ T,  where mα = cos α (1 + tan α tan φ′ / F)',
        `Start from the ordinary-method value F = ${fix(its[0] ?? fFellenius, 3)} and repeat until F stops changing.`,
        ...(result.bishop.note ? [result.bishop.note] : []),
      ],
      result:
        bishopF === null
          ? 'No result'
          : `F = ${fix(bishopF, 3)} after ${Math.max(0, its.length - 1)} iteration${its.length - 1 === 1 ? '' : 's'}`,
    },
    iterationTable,
    bishopTable,
    moments: {
      title: 'Moments about the centre',
      lines: [
        `Driving moment MD = R Σ T = ${fix(circle.r, 2)} × ${fix(sumDriving, 1)} = ${fix(result.drivingMoment, 0)} kN·m per metre.`,
        `Resisting moment, ordinary method: MR = ${fix(result.fellenius.resistingMoment, 0)} kN·m per metre.`,
        ...(bishopF !== null
          ? [
              `Resisting moment, Bishop: MR = ${fix(result.bishop.resistingMoment, 0)} kN·m per metre.`,
            ]
          : []),
      ],
    },
    notes,
  };
}
