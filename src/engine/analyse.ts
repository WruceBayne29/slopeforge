/**
 * Analysis of one circular slip surface by the method of slices.
 */
import { arcCrossings, arcIntegral, arcY, uniqueSorted, yAt } from './geometry';
import { bishopSlice, felleniusSlice, solveBishop } from './methods';
import type { SliceInput } from './methods';
import { prepare } from './strata';
import type { PreparedModel } from './strata';
import type {
  AnalysisOptions,
  Circle,
  CircleAnalysis,
  CircleFailure,
  FailureCode,
  LayerPart,
  Slice,
  SlopeModel,
} from './types';

export const DEFAULT_SLICES = 30;

const fail = (code: FailureCode, message: string): CircleFailure => ({ ok: false, code, message });

/** The stretch [xa, xb] over which the lower arc lies below the ground, or why there is none. */
function slipInterval(pm: PreparedModel, c: Circle): [number, number] | CircleFailure {
  const lo = Math.max(pm.xmin, c.xc - c.r);
  const hi = Math.min(pm.xmax, c.xc + c.r);
  const nothing = fail('no-intersection', 'The circle does not cut into the slope.');
  if (!(hi > lo)) return nothing;
  const tol = 1e-9 * (pm.xmax - pm.xmin);
  const dTol = 1e-7 * Math.max(1, c.r);
  const roots = arcCrossings(pm.ground, c).filter((x) => x > lo + tol && x < hi - tol);
  const xs = [lo, ...uniqueSorted(roots, tol), hi];
  const depth = (x: number): number => yAt(pm.ground, x) - arcY(c, x);

  // A circle can dip below the ground in more than one place (for instance under the level
  // ground in front of a steep face, and again behind the face). The stretch that matters is
  // the one whose ends differ most in elevation; the wider one breaks a tie.
  let best: [number, number] | null = null;
  let bestRise = -1;
  let start: number | null = null;
  const close = (end: number): void => {
    if (start !== null) {
      const rise = Math.abs(yAt(pm.ground, end) - yAt(pm.ground, start));
      const better =
        rise > bestRise + dTol ||
        (Math.abs(rise - bestRise) <= dTol && best !== null && end - start > best[1] - best[0]);
      if (!best || better) {
        best = [start, end];
        bestRise = rise;
      }
    }
    start = null;
  };
  for (let i = 0; i + 1 < xs.length; i++) {
    if (depth(0.5 * (xs[i] + xs[i + 1])) > dTol) {
      if (start === null) start = xs[i];
    } else close(xs[i]);
  }
  close(hi);
  const found = best as [number, number] | null;
  if (!found) return nothing;
  for (const x of found) {
    if (depth(x) > 1e-5 * Math.max(1, c.r)) {
      return x <= pm.xmin + tol || x >= pm.xmax - tol
        ? fail(
            'outside-model',
            'The slip surface runs out of the section before it reaches the ground. Extend the ground line or use a smaller circle.',
          )
        : fail(
            'vertical',
            'The arc turns vertical while still below ground. Raise the centre or reduce the radius.',
          );
    }
  }
  return found;
}

/** Analyses one circle. `source` may be a model or an already prepared model. */
export function analyseCircle(
  source: SlopeModel | PreparedModel,
  circle: Circle,
  options: AnalysisOptions = {},
): CircleAnalysis {
  const pm = 'breaks' in source ? source : prepare(source);
  const { model, ground } = pm;
  const { xc, yc, r } = circle;
  if (!(r > 0) || ![xc, yc, r].every(Number.isFinite)) {
    return fail('bad-circle', 'The circle needs a centre and a radius greater than zero.');
  }
  const interval = slipInterval(pm, circle);
  if (!Array.isArray(interval)) return interval;
  let [xa, xb] = interval;
  const depthAt = (x: number): number => yAt(ground, x) - arcY(circle, x);

  // Tension crack: the surface stops at a vertical crack on the higher side.
  const crestRight = yAt(ground, xb) >= yAt(ground, xa);
  let crackDepth = 0;
  let crackThrust = 0;
  let crackY = 0;
  if (model.crack) {
    const zc = model.crack.depth;
    const from = crestRight ? xb : xa;
    const to = crestRight ? xa : xb;
    const steps = 96;
    let prev = from;
    let xt: number | null = null;
    for (let k = 1; k <= steps; k++) {
      const x = from + ((to - from) * k) / steps;
      if (depthAt(x) >= zc) {
        let p = prev;
        let q = x;
        for (let it = 0; it < 50; it++) {
          const m = 0.5 * (p + q);
          if (depthAt(m) >= zc) q = m;
          else p = m;
        }
        xt = 0.5 * (p + q);
        break;
      }
      prev = x;
    }
    if (xt === null) {
      return fail('crack', 'The whole slip surface lies within the depth of the tension crack.');
    }
    if (crestRight) xb = xt;
    else xa = xt;
    crackDepth = zc;
    const zw = zc * model.crack.water;
    crackThrust = 0.5 * model.gammaW * zw * zw;
    crackY = arcY(circle, xt) + zw / 3;
  }

  const lowest = xc >= xa && xc <= xb ? yc - r : Math.min(arcY(circle, xa), arcY(circle, xb));
  if (lowest < model.base - 1e-9 * Math.max(1, r)) {
    return fail('below-base', 'The circle passes below the firm base.');
  }

  // Slice boundaries: every vertex and crossing, then equal subdivision.
  const width = xb - xa;
  const tol = 1e-6 * width;
  const marks = pm.breaks.filter((x) => x > xa + tol && x < xb - tol);
  for (const line of pm.boundaries) marks.push(...arcCrossings(line, circle));
  if (pm.water) marks.push(...arcCrossings(pm.water, circle));
  const fixed = [
    xa,
    ...uniqueSorted(
      marks.filter((x) => x > xa + tol && x < xb - tol),
      tol,
    ),
    xb,
  ];
  const target = width / Math.max(1, Math.round(options.slices ?? DEFAULT_SLICES));
  const edges: number[] = [xa];
  for (let i = 0; i + 1 < fixed.length; i++) {
    const span = fixed[i + 1] - fixed[i];
    const parts = Math.max(1, Math.ceil(span / target - 1e-9));
    for (let k = 1; k < parts; k++) edges.push(fixed[i] + (span * k) / parts);
    edges.push(fixed[i + 1]);
  }

  const nb = pm.boundaries.length;
  const gw = model.gammaW;
  interface Raw {
    x1: number;
    x2: number;
    xm: number;
    b: number;
    g: number;
    a: number;
    h: number;
    layers: LayerPart[];
    soil: number;
    weight: number;
    surcharge: number;
    pond: number;
    fxWater: number;
    ycg: number;
    w: number;
  }
  const raws: Raw[] = [];
  let gravityMoment = 0;
  let area = 0;
  let totalWeight = 0;
  let maxDepth = 0;
  for (let i = 0; i + 1 < edges.length; i++) {
    const x1 = edges[i];
    const x2 = edges[i + 1];
    const b = x2 - x1;
    const xm = 0.5 * (x1 + x2);
    const g = yAt(ground, xm);
    const a = arcY(circle, xm);
    const aMean = arcIntegral(circle, x1, x2) / b;
    const w = pm.water ? yAt(pm.water, xm) : Number.NEGATIVE_INFINITY;
    maxDepth = Math.max(maxDepth, g - a, depthAt(x1), depthAt(x2));

    const layers: LayerPart[] = [];
    let top = g;
    let weight = 0;
    let sliceArea = 0;
    let sumWy = 0;
    let soil = pm.soils.length - 1;
    for (let s = 0; s < pm.soils.length; s++) {
      const line = s < nb ? yAt(pm.boundaries[s], xm) : Number.NEGATIVE_INFINITY;
      const cut = line < a;
      const bot = cut ? aMean : line;
      const thick = top - bot;
      if (thick > 0) {
        const wet = Math.max(0, Math.min(top, w) - bot);
        const def = pm.soils[s];
        const part = (def.gamma * (thick - wet) + (def.gammaSat ?? def.gamma) * wet) * b;
        layers.push({ soil: s, area: thick * b, wetArea: wet * b, weight: part });
        weight += part;
        sliceArea += thick * b;
        sumWy += part * 0.5 * (top + bot);
      }
      if (cut) {
        soil = s;
        break;
      }
      top = line;
    }
    let surcharge = 0;
    for (const sc of model.surcharges) {
      surcharge += sc.q * Math.max(0, Math.min(x2, sc.x2) - Math.max(x1, sc.x1));
    }
    let pond = 0;
    let fxWater = 0;
    if (w > g) {
      pond = gw * (w - g) * b;
      fxWater = gw * (w - g) * (yAt(ground, x2) - yAt(ground, x1));
    }
    gravityMoment += (weight + surcharge + pond) * (xm - xc);
    area += sliceArea;
    totalWeight += weight;
    raws.push({
      x1,
      x2,
      xm,
      b,
      g,
      a,
      h: sliceArea / b,
      layers,
      soil,
      weight,
      surcharge,
      pond,
      fxWater,
      ycg: weight > 0 ? sumWy / weight : 0.5 * (g + a),
      w,
    });
  }
  if (maxDepth < (options.minDepth ?? 0)) {
    return fail(
      'too-shallow',
      'The circle only skims the surface (shallower than the minimum depth).',
    );
  }
  const still = fail('no-driving', 'The soil above this circle has no tendency to slide.');
  if (Math.abs(gravityMoment) <= 1e-9 * Math.max(1, totalWeight) * r) return still;
  const dir = gravityMoment > 0 ? 1 : -1;

  const warnings: string[] = [];
  const inputs: SliceInput[] = [];
  const slices: Slice[] = [];
  let sumDriving = (crackThrust * (yc - crackY)) / r;
  let sumFellenius = 0;
  let negative = 0;
  for (let i = 0; i < raws.length; i++) {
    const q = raws[i];
    const sin = (dir * (q.xm - xc)) / r;
    const alpha = Math.asin(sin);
    const l = q.b / Math.cos(alpha);
    const load = q.weight + q.surcharge + q.pond;
    const hForce = model.kh * q.weight - dir * q.fxWater;
    let u = 0;
    if (pm.water) u = gw * Math.max(0, q.w - q.a);
    else if (model.water.kind === 'ru') u = (model.water.ru * q.weight) / q.b;
    const driving =
      load * sin + (model.kh * q.weight * (yc - q.ycg) - dir * q.fxWater * (yc - q.g)) / r;
    const def = pm.soils[q.soil];
    const input: SliceInput = {
      b: q.b,
      alpha,
      l,
      load,
      hForce,
      u,
      c: def.c,
      tanPhi: pm.tanPhi[q.soil],
    };
    const fell = felleniusSlice(input);
    if (fell.n < 0 && input.tanPhi > 0) negative++;
    sumDriving += driving;
    sumFellenius += fell.t;
    inputs.push(input);
    slices.push({
      index: i + 1,
      x1: q.x1,
      x2: q.x2,
      xm: q.xm,
      b: q.b,
      yTop: q.g,
      yBase: q.a,
      h: q.h,
      alpha,
      l,
      layers: q.layers,
      soil: q.soil,
      c: def.c,
      phi: def.phi,
      weight: q.weight,
      surcharge: q.surcharge,
      pond: q.pond,
      load,
      hForce,
      u,
      driving,
      nFellenius: fell.n,
      tFellenius: fell.t,
      mAlpha: 0,
      nBishop: 0,
      tBishop: 0,
    });
  }
  if (!(sumDriving > 1e-9 * Math.max(1, totalWeight))) return still;

  const fFellenius = sumFellenius / sumDriving;
  if (negative > 0) {
    warnings.push(
      `Ordinary method: the effective normal force is negative on ${negative} slice${negative > 1 ? 's' : ''} (high pore pressure on a steep base); friction is taken as zero there.`,
    );
  }
  if (sumFellenius === 0) {
    warnings.push(
      'The soil along this slip surface has no strength (c′ = 0 and φ′ = 0), so F = 0.',
    );
  }

  const solved = solveBishop(inputs, sumDriving, fFellenius);
  let sumBishop = 0;
  if (solved.fos !== null && solved.fos > 0) {
    let low = 0;
    let neg = 0;
    slices.forEach((s, i) => {
      const bs = bishopSlice(inputs[i], solved.fos as number);
      s.mAlpha = bs.mAlpha;
      s.nBishop = bs.n;
      s.tBishop = bs.t;
      sumBishop += bs.t;
      if (bs.mAlpha < 0.2) low++;
      if (bs.n < 0 && inputs[i].tanPhi > 0) neg++;
    });
    if (low > 0) {
      warnings.push(
        `Bishop: mα is below 0.2 on ${low} slice${low > 1 ? 's' : ''} near the toe, where the method becomes unreliable.`,
      );
    }
    if (neg > 0) {
      warnings.push(
        `Bishop: the effective normal force is negative on ${neg} slice${neg > 1 ? 's' : ''}; friction is taken as zero there.`,
      );
    }
  }

  const toeX = crestRight ? xa : xb;
  const crestX = crestRight ? xb : xa;
  return {
    ok: true,
    circle: { xc, yc, r },
    toe: { x: toeX, y: arcY(circle, toeX) },
    crest: { x: crestX, y: arcY(circle, crestX) },
    dir,
    slices,
    drivingMoment: sumDriving * r,
    area,
    weight: totalWeight,
    maxDepth,
    crackThrust,
    crackDepth,
    fellenius: {
      fos: fFellenius,
      resistingMoment: sumFellenius * r,
      iterations: [],
      converged: true,
    },
    bishop: {
      fos: solved.fos,
      resistingMoment: sumBishop * r,
      iterations: solved.iterations,
      converged: solved.converged,
      note: solved.note,
    },
    warnings,
  };
}
