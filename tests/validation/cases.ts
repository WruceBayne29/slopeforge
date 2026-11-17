/**
 * Validation: benchmark problems with known answers, compared with what the engine computes.
 * Each check carries the tolerance its source allows, and each case says where the expected
 * numbers come from.
 */
import { analyseCircle, searchCritical } from '../../src/engine';
import type { Circle, CircleSuccess, SlopeModel } from '../../src/engine';
import { homogeneous, simpleSlope, soil } from '../../src/engine/fixtures';
import { infiniteSlopeFos, phiZeroExact } from '../../src/engine/reference';
import { ACADS_1A, ACADS_1C, ACADS_1D } from '../../src/model/benchmarks';

export interface ValidationCheck {
  quantity: string;
  expected: number;
  actual: number;
  /** Absolute tolerance. */
  tolerance: number;
  unit: string;
}

export interface ValidationCase {
  id: string;
  title: string;
  source: string;
  /** How the expected values were obtained. */
  basis: 'published' | 'closed form' | 'hand calculation' | 'cross-check';
  /** Where the expected numbers come from and why the tolerance is what it is. */
  provenance: string;
  run: () => ValidationCheck[];
  /** Extra Markdown printed under the results (for example a slice table). */
  notes?: () => string[];
}

const check = (
  quantity: string,
  expected: number,
  actual: number,
  tolerance: number,
  unit = '',
): ValidationCheck => ({ quantity, expected, actual, tolerance, unit });

function valid(model: SlopeModel, circle: Circle, slices: number): CircleSuccess {
  const a = analyseCircle(model, circle, { slices });
  if (!a.ok) throw new Error(`validation circle rejected: ${a.message}`);
  return a;
}

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------------------------
// V1  Taylor's stability numbers, φ = 0
// ---------------------------------------------------------------------------------------------
function taylor(beta: number, depthFactor: number, run: number): number {
  const H = 10;
  const gamma = 18;
  const cu = 40;
  const model = simpleSlope(H, beta, soil(gamma, cu, 0), depthFactor, run);
  const found = searchCritical(model, { slices: 60, nx: 24, ny: 24, nr: 16 });
  const f = found.critical?.bishop.fos;
  if (!f) throw new Error('search failed');
  return cu / (f * gamma * H);
}

// ---------------------------------------------------------------------------------------------
// V3  Hand calculation: 8 m high 2 : 3 slope, circle through the toe
// ---------------------------------------------------------------------------------------------
const HAND = {
  ground: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 22, y: 8 },
    { x: 40, y: 8 },
  ],
  gamma: 18.5,
  c: 12,
  phi: 22,
  circle: { xc: 12, yc: 16, r: Math.sqrt(260) },
  edges: [10, 12, 14, 16, 18, 20, 22, 24, 26],
};

interface HandRow {
  n: number;
  b: number;
  h: number;
  w: number;
  alphaDeg: number;
  l: number;
  normal: number;
  shear: number;
  cl: number;
}

/**
 * The calculation a student would do, written out independently of the engine: slice heights
 * by Simpson's rule on the ground line and the arc, α at the middle of each base.
 */
function handCalculation(): {
  rows: HandRow[];
  fellenius: number;
  bishop: number;
  midOrdinateFellenius: number;
} {
  const { gamma, c, phi, circle, edges } = HAND;
  const groundY = (x: number): number => (x <= 10 ? 0 : x >= 22 ? 8 : ((x - 10) * 8) / 12);
  const arc = (x: number): number => circle.yc - Math.sqrt(circle.r ** 2 - (x - circle.xc) ** 2);
  const tanPhi = Math.tan(phi * DEG);
  const rows: HandRow[] = [];
  let sumNormalTan = 0;
  let sumCl = 0;
  let sumShear = 0;
  let midNum = 0;
  let midDen = 0;
  for (let i = 0; i + 1 < edges.length; i++) {
    const x1 = edges[i];
    const x2 = edges[i + 1];
    const b = x2 - x1;
    const xm = (x1 + x2) / 2;
    // Simpson's rule with 200 strips for the area between the ground and the arc
    const strips = 200;
    let sum = 0;
    for (let k = 0; k <= strips; k++) {
      const x = x1 + (b * k) / strips;
      sum += (groundY(x) - arc(x)) * (k === 0 || k === strips ? 1 : k % 2 === 1 ? 4 : 2);
    }
    const area = (sum * b) / (3 * strips);
    const w = gamma * area;
    const alpha = Math.asin((xm - circle.xc) / circle.r);
    const l = b / Math.cos(alpha);
    const normal = w * Math.cos(alpha);
    const shear = w * Math.sin(alpha);
    rows.push({ n: i + 1, b, h: area / b, w, alphaDeg: alpha / DEG, l, normal, shear, cl: c * l });
    sumNormalTan += normal * tanPhi;
    sumCl += c * l;
    sumShear += shear;
    // the cruder version: weight from the mid-height alone
    const wMid = gamma * b * (groundY(xm) - arc(xm));
    midNum += c * l + wMid * Math.cos(alpha) * tanPhi;
    midDen += wMid * Math.sin(alpha);
  }
  const fellenius = (sumCl + sumNormalTan) / sumShear;
  let f = fellenius;
  for (let it = 0; it < 200; it++) {
    let num = 0;
    for (const r of rows) {
      const a = r.alphaDeg * DEG;
      num += (c * r.b + r.w * tanPhi) / (Math.cos(a) + (Math.sin(a) * tanPhi) / f);
    }
    f = num / sumShear;
  }
  return { rows, fellenius, bishop: f, midOrdinateFellenius: midNum / midDen };
}

const handModel = (): SlopeModel =>
  homogeneous(HAND.ground, -10, soil(HAND.gamma, HAND.c, HAND.phi));

// ---------------------------------------------------------------------------------------------
// V4  Infinite slope
// ---------------------------------------------------------------------------------------------
/** A long, shallow circle on a uniform incline: chord 100 m along the slope, 0.5 m deep. */
function shallow(beta: number, material: ReturnType<typeof soil>, extra: Partial<SlopeModel> = {}) {
  const b = beta * DEG;
  const ground = [
    { x: 0, y: 0 },
    { x: 400, y: 400 * Math.tan(b) },
  ];
  const chord = 100;
  const sag = 0.5;
  const r = (chord * chord) / 4 / (2 * sag) + sag / 2;
  const mid = { x: 200, y: 200 * Math.tan(b) };
  const circle = {
    xc: mid.x - (r - sag) * Math.sin(b),
    yc: mid.y + (r - sag) * Math.cos(b),
    r,
  };
  const model: SlopeModel = { ...homogeneous(ground, -50, material), ...extra };
  const a = valid(model, circle, 120);
  return { a, z: a.area / Math.abs(a.crest.x - a.toe.x) };
}

export const VALIDATION_CASES: ValidationCase[] = [
  {
    id: 'V1',
    title: 'φ = 0 slopes against Taylor’s stability numbers',
    source: 'Taylor (1937), stability numbers for φ = 0; reproduced in most soil mechanics texts',
    basis: 'published',
    provenance:
      'The stability number N = cu / (F γ H) is found by a full critical-circle search (24 × 24 centres, 60 slices) on a 10 m slope and compared with Taylor’s tabulated values 0.261 (90°), 0.219 (75°), 0.191 (60°) and 0.181 (any slope flatter than 53° with a deep firm base). The table values were entered from memory; they are the standard figures quoted in textbooks. Tolerance ±0.001: half a unit in the third figure of the table plus the resolution of the search. The 90° case is run at 89.99° because the ground line must be single-valued. The deep-base case uses a firm base 8 H below the crest, where the limit 0.181 is approached from below.',
    run: () => [
      check('N, β = 90° (toe circle)', 0.261, taylor(89.99, 3, 4), 0.001),
      check('N, β = 75° (toe circle)', 0.219, taylor(75, 3, 4), 0.001),
      check('N, β = 60° (toe circle)', 0.191, taylor(60, 3, 4), 0.001),
      check('N, β = 30°, firm base at 8 H (deep circle)', 0.181, taylor(30, 8, 16), 0.001),
    ],
  },
  {
    id: 'V2',
    title: 'φ = 0: slices against the exact moment solution',
    source: 'F = cu R² θ / (γ ∫∫ (x − xc) dA), integrated analytically (src/engine/reference.ts)',
    basis: 'closed form',
    provenance:
      'With φ = 0 the factor of safety of a given circle does not depend on how normal forces are distributed, so both methods must reproduce the exact ratio of moments. The expected values are computed in the test from the closed-form integrals of the area between the ground line and the arc; the points where each circle meets the ground are worked out by hand from the circle equation. 200 slices; tolerance 0.05 % of F, the remaining error of taking α at the middle of each base.',
    run: () => {
      const H = 10;
      const model = simpleSlope(H, Math.atan(0.5) / DEG, soil(18, 30, 0), 2.5, 6);
      const out: ValidationCheck[] = [];
      const circles: [string, Circle][] = [
        ['toe circle', { xc: 6, yc: 22, r: Math.hypot(6, 22) }],
        ['deep circle', { xc: 9, yc: 20, r: 32 }],
        ['slope circle', { xc: 8, yc: 18, r: 15 }],
      ];
      for (const [name, c] of circles) {
        // lower end: on the level ground in front (y = 0) or on the face (y = x / 2)
        const front = c.xc - Math.sqrt(c.r ** 2 - c.yc ** 2);
        let xa = front;
        if (!(front <= 0)) {
          // face: (x − xc)² + (x/2 − yc)² = r²
          const A = 1.25;
          const B = -2 * c.xc - c.yc;
          const C = c.xc ** 2 + c.yc ** 2 - c.r ** 2;
          xa = (-B - Math.sqrt(B * B - 4 * A * C)) / (2 * A);
        }
        const xb = c.xc + Math.sqrt(c.r ** 2 - (c.yc - H) ** 2);
        const exact = phiZeroExact(model.ground, 18, 30, c, xa, xb);
        const a = valid(model, c, 200);
        out.push(
          check(`F, ${name}, ordinary`, exact.fos, a.fellenius.fos as number, 5e-4 * exact.fos),
          check(`F, ${name}, Bishop`, exact.fos, a.bishop.fos as number, 5e-4 * exact.fos),
          check(`area of sliding mass, ${name}`, exact.area, a.area, 1e-6 * exact.area, 'm²'),
          check(
            `driving moment, ${name}`,
            exact.drivingMoment,
            a.drivingMoment,
            5e-4 * exact.drivingMoment,
            'kN·m/m',
          ),
        );
      }
      return out;
    },
  },
  {
    id: 'V3',
    title: 'Dry homogeneous slope checked slice by slice',
    source:
      'Hand calculation written out in tests/validation/cases.ts: 8 m slope at 2 : 3, γ = 18.5 kN/m³, c′ = 12 kPa, φ′ = 22°, circle centre (12, 16) through the toe (10, 0), eight 2 m slices',
    basis: 'hand calculation',
    provenance:
      'Every number in the slice table is recomputed in the test without calling the engine: areas by Simpson’s rule, α = asin((xm − xc)/R) at the middle of each base, l = b sec α, N = W cos α, T = W sin α, then F = Σ(c′l + N tan φ′)/ΣT and a separate Bishop iteration. Weights, angles and forces must agree to rounding (the engine integrates the arc analytically, the check uses Simpson’s rule). The last line compares with the cruder hand method that takes each weight from the mid-height of the slice; 1 % is allowed there because that is the error of the mid-ordinate rule with 2 m slices.',
    run: () => {
      const hand = handCalculation();
      const a = valid(handModel(), HAND.circle, 8);
      const out: ValidationCheck[] = [check('number of slices', 8, a.slices.length, 0)];
      hand.rows.forEach((r, i) => {
        const s = a.slices[i];
        out.push(
          check(`slice ${r.n}: weight W`, r.w, s.weight, 1e-6 * r.w, 'kN/m'),
          check(`slice ${r.n}: base angle α`, r.alphaDeg, s.alpha / DEG, 1e-9, '°'),
          check(`slice ${r.n}: N = W cos α`, r.normal, s.nFellenius, 1e-6 * r.w, 'kN/m'),
          check(`slice ${r.n}: T = W sin α`, r.shear, s.driving, 1e-6 * r.w, 'kN/m'),
        );
      });
      out.push(
        check('F, ordinary method', hand.fellenius, a.fellenius.fos as number, 1e-6),
        check('F, Bishop’s simplified method', hand.bishop, a.bishop.fos as number, 1e-5),
        check(
          'F, ordinary, weights from mid-heights only',
          hand.midOrdinateFellenius,
          a.fellenius.fos as number,
          0.01 * hand.midOrdinateFellenius,
        ),
      );
      return out;
    },
    notes: () => {
      const hand = handCalculation();
      const f = (v: number, d: number): string => v.toFixed(d);
      const sum = (pick: (r: HandRow) => number): number =>
        hand.rows.reduce((s, r) => s + pick(r), 0);
      return [
        '',
        'The hand calculation (independent of the engine):',
        '',
        '| Slice | b (m) | h (m) | W (kN/m) | α (°) | l (m) | N = W cos α | T = W sin α | c′l |',
        '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...hand.rows.map(
          (r) =>
            `| ${r.n} | ${f(r.b, 2)} | ${f(r.h, 3)} | ${f(r.w, 2)} | ${f(r.alphaDeg, 2)} | ${f(r.l, 3)} | ${f(r.normal, 2)} | ${f(r.shear, 2)} | ${f(r.cl, 2)} |`,
        ),
        `| Σ | | | ${f(
          sum((r) => r.w),
          2,
        )} | | ${f(
          sum((r) => r.l),
          3,
        )} | ${f(
          sum((r) => r.normal),
          2,
        )} | ${f(
          sum((r) => r.shear),
          2,
        )} | ${f(
          sum((r) => r.cl),
          2,
        )} |`,
        '',
        `F (ordinary) = (Σc′l + tan 22° ΣN) / ΣT = (${f(
          sum((r) => r.cl),
          2,
        )} + 0.4040 × ${f(
          sum((r) => r.normal),
          2,
        )}) / ${f(
          sum((r) => r.shear),
          2,
        )} = **${f(hand.fellenius, 3)}**; Bishop converges to **${f(hand.bishop, 3)}**.`,
      ];
    },
  },
  {
    id: 'V4',
    title: 'Long shallow circle against the infinite-slope formula',
    source:
      'F = [c′ sec β + (γ z (cos β − kh sin β) − u sec β) tan φ′] / [γ z (sin β + kh cos β)]; for c′ = 0 with ru this is the c′/γH = 0 line of Bishop & Morgenstern (1960)',
    basis: 'closed form',
    provenance:
      'A circle with a 100 m chord lying 0.5 m below a uniform 25° incline is as close to a plane as a circle gets. The expected value is the infinite-slope formula evaluated at the mean depth of the sliding mass (area / width), derived in the test file and in docs/THEORY.md. Tolerance 0.2 % for the ordinary method and 0.5 % for Bishop: the arc is not quite a plane, and Bishop’s vertical resolution feels the two ends more. The seismic case is checked for the ordinary method only, because the closed form resolves the seismic force normal to the plane, which Bishop’s method does not do.',
    run: () => {
      const beta = 25;
      const out: ValidationCheck[] = [];
      const add = (
        label: string,
        result: ReturnType<typeof shallow>,
        expected: number,
        bishop = true,
      ): void => {
        out.push(
          check(`${label}, ordinary`, expected, result.a.fellenius.fos as number, 0.002 * expected),
        );
        if (bishop) {
          out.push(
            check(`${label}, Bishop`, expected, result.a.bishop.fos as number, 0.005 * expected),
          );
        }
      };
      const dry = shallow(beta, soil(18, 6, 30));
      add(
        'F, dry c′–φ′ soil',
        dry,
        6 / (18 * dry.z * Math.sin(beta * DEG) * Math.cos(beta * DEG)) +
          Math.tan(30 * DEG) / Math.tan(beta * DEG),
      );
      const sand = shallow(beta, soil(18, 0, 32));
      add('F, dry sand (tan φ′ / tan β)', sand, Math.tan(32 * DEG) / Math.tan(beta * DEG));
      const ru = shallow(beta, soil(18, 0, 32), { water: { kind: 'ru', ru: 0.3 } });
      add(
        'F, sand with ru = 0.3 ((1 − ru sec²β) tan φ′ / tan β)',
        ru,
        ((1 - 0.3 / Math.cos(beta * DEG) ** 2) * Math.tan(32 * DEG)) / Math.tan(beta * DEG),
      );
      const wet = shallow(beta, soil(19, 8, 30), {
        water: {
          kind: 'line',
          points: [
            { x: 0, y: 0 },
            { x: 400, y: 400 * Math.tan(beta * DEG) },
          ],
        },
      });
      add(
        'F, phreatic line at the surface (u = γw z)',
        wet,
        infiniteSlopeFos({ beta, z: wet.z, gamma: 19, c: 8, phi: 30, u: 9.81 * wet.z }),
      );
      const quake = shallow(beta, soil(18, 6, 30), { kh: 0.1 });
      add(
        'F, seismic coefficient kh = 0.1',
        quake,
        infiniteSlopeFos({ beta, z: quake.z, gamma: 18, c: 6, phi: 30, kh: 0.1 }),
        false,
      );
      return out;
    },
  },
  {
    id: 'V5',
    title: 'Submerged slope against the buoyant-weight analysis',
    source: 'Hydrostatics: water pressure on a closed surface equals the weight of water displaced',
    basis: 'cross-check',
    provenance:
      'A slope standing wholly under still water is analysed twice: once with total unit weight, pore pressures on the slip surface and the water load on the ground surface; once dry with the buoyant unit weight γ − γw. The two must agree for any method that satisfies vertical equilibrium of each slice (Bishop), and for φ = 0. The ordinary method is not included for the frictional soil: its N′ = W cos α − u l is known not to reduce to the buoyant weight. Tolerance 0.2 %: the water thrust on the ground is applied at the mid-point of each slice top.',
    run: () => {
      const circle = { xc: 0, yc: 16, r: 18 };
      const water = {
        kind: 'line' as const,
        points: [
          { x: -40, y: 14 },
          { x: 50, y: 14 },
        ],
      };
      const out: ValidationCheck[] = [];
      for (const [label, c, phi] of [
        ['c′ = 12 kPa, φ′ = 28°', 12, 28],
        ['cu = 25 kPa, φ = 0', 25, 0],
      ] as const) {
        const wet = valid({ ...simpleSlope(10, 45, soil(20, c, phi)), water }, circle, 120);
        const buoyant = valid(simpleSlope(10, 45, soil(20 - 9.81, c, phi)), circle, 120);
        const expected = buoyant.bishop.fos as number;
        out.push(
          check(`F (Bishop), ${label}`, expected, wet.bishop.fos as number, 0.002 * expected),
        );
        if (phi === 0) {
          out.push(
            check(
              `F (ordinary), ${label}`,
              buoyant.fellenius.fos as number,
              wet.fellenius.fos as number,
              0.002 * expected,
            ),
          );
        }
      }
      return out;
    },
  },
  {
    id: 'V6',
    title: 'ACADS benchmark slopes 1(a), 1(c) and 1(d)',
    source:
      'Donald & Giam (1989), ACADS slope stability review, problems 1(a), 1(c), 1(d); Bishop comparison values as reproduced in software verification manuals',
    basis: 'published',
    provenance:
      'Critical circle by Bishop’s simplified method from a full search (default grid, 40 slices). Two comparisons each. (1) The ACADS referee values 1.00, 1.39 and 1.00, allowed ±0.03: they are rounded and the methods submitted to the review scatter by about that much. (2) Bishop’s simplified method as reported for the same problems (0.987, 1.405, 1.015), allowed ±0.005, the difference to expect between two search implementations. Honest note on sources: the three-layer geometry, the soil properties and the Bishop value 1.405 for 1(c) were checked against a published verification document that reproduces the ACADS problem (LUSAS, “Non-homogeneous slope”, shifted origin). The referee values, the 1(a) geometry and the Bishop values for 1(a) and 1(d) (recalled as those of the Rocscience Slide verification manual) were entered from memory and not re-checked against the original report.',
    run: () => {
      const bishop = (model: SlopeModel): number => {
        const f = searchCritical(model, { slices: 40 }).critical?.bishop.fos;
        if (!f) throw new Error('search failed');
        return f;
      };
      const a = bishop(ACADS_1A);
      const c = bishop(ACADS_1C);
      const d = bishop(ACADS_1D);
      return [
        check('1(a) homogeneous: F against the referee value', 1.0, a, 0.03),
        check('1(a) homogeneous: F against the reported Bishop value', 0.987, a, 0.005),
        check('1(c) three layers: F against the referee value', 1.39, c, 0.03),
        check('1(c) three layers: F against the reported Bishop value', 1.405, c, 0.005),
        check('1(d) three layers, kh = 0.15: F against the referee value', 1.0, d, 0.03),
        check('1(d) three layers, kh = 0.15: F against the reported Bishop value', 1.015, d, 0.005),
      ];
    },
  },
];
