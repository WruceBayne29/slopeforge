# Validation

SlopeForge's analysis engine is checked against **70 values in 6 groups**: published
benchmark slopes, closed-form solutions that use no slices at all, a hand calculation written out
slice by slice, and cross-checks between independent formulations. This file is generated from
`tests/validation/cases.ts` by `npm run validation`, so it cannot drift from the code, and the
suite runs in CI on every push.

**How to read the tolerances.** "Allowed" is the difference each source permits, not a fixed
percentage: a table printed to three figures allows half a unit in the third figure, a closed
form allows only the discretisation error of the slices, and a benchmark solved by many programs
allows the scatter between them. Each group states its own reasoning.

**Basis.** *published* — the expected number comes from the literature. *closed form* — derived
from a formula in the test, with no slices. *hand calculation* — the same method worked
independently, slice by slice, in the test. *cross-check* — two formulations that must agree.

## What is not independently verified

- **Numbers recalled from memory.** Taylor’s stability numbers (V1), the ACADS referee values and
  the Slide comparison values for problems 1(a) and 1(d) (V6) were typed in from memory. They are
  standard figures and the engine reproduces them, but they were not re-read from the original
  publications while writing the tests. The geometry and soil properties of ACADS 1(c) and its
  Bishop value of 1.405 were checked against a published verification document.
- **Pore pressure benchmarks.** Water is validated by closed forms (infinite slope with ru and with
  a phreatic line, the submerged-slope identity), not against a published slope with a water
  table solved by another program.
- **Tension cracks, surcharges and ponded water** are covered by unit tests of their mechanics
  (`src/engine/analyse.test.ts`) and, for ponded water, by V5; there is no published benchmark
  for them here.
- **The ordinary method under high pore pressure** is known to be inaccurate (it can make the
  normal force negative). SlopeForge reports this as a warning; it is a property of the method,
  not something validation can remove.

## Summary

| # | What is checked | Basis | Values |
| --- | --- | --- | ---: |
| V1 | φ = 0 slopes against Taylor’s stability numbers | published | 4 |
| V2 | φ = 0: slices against the exact moment solution | closed form | 12 |
| V3 | Dry homogeneous slope checked slice by slice | hand calculation | 36 |
| V4 | Long shallow circle against the infinite-slope formula | closed form | 9 |
| V5 | Submerged slope against the buoyant-weight analysis | cross-check | 3 |
| V6 | ACADS benchmark slopes 1(a), 1(c) and 1(d) | published | 6 |

## Full results

### V1 — φ = 0 slopes against Taylor’s stability numbers

**Source:** Taylor (1937), stability numbers for φ = 0; reproduced in most soil mechanics texts

**Basis:** published. The stability number N = cu / (F γ H) is found by a full critical-circle search (24 × 24 centres, 60 slices) on a 10 m slope and compared with Taylor’s tabulated values 0.261 (90°), 0.219 (75°), 0.191 (60°) and 0.181 (any slope flatter than 53° with a deep firm base). The table values were entered from memory; they are the standard figures quoted in textbooks. Tolerance ±0.001: half a unit in the third figure of the table plus the resolution of the search. The 90° case is run at 89.99° because the ground line must be single-valued. The deep-base case uses a firm base 8 H below the crest, where the limit 0.181 is approached from below.

| Quantity | Expected | SlopeForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| N, β = 90° (toe circle) | 0.26100 | 0.26098 | 2.0e-5 | 0.00100 |
| N, β = 75° (toe circle) | 0.21900 | 0.21905 | 4.6e-5 | 0.00100 |
| N, β = 60° (toe circle) | 0.19100 | 0.19061 | 3.9e-4 | 0.00100 |
| N, β = 30°, firm base at 8 H (deep circle) | 0.18100 | 0.18085 | 1.5e-4 | 0.00100 |

### V2 — φ = 0: slices against the exact moment solution

**Source:** F = cu R² θ / (γ ∫∫ (x − xc) dA), integrated analytically (src/engine/reference.ts)

**Basis:** closed form. With φ = 0 the factor of safety of a given circle does not depend on how normal forces are distributed, so both methods must reproduce the exact ratio of moments. The expected values are computed in the test from the closed-form integrals of the area between the ground line and the arc; the points where each circle meets the ground are worked out by hand from the circle equation. 200 slices; tolerance 0.05 % of F, the remaining error of taking α at the middle of each base.

| Quantity | Expected | SlopeForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| F, toe circle, ordinary | 1.2829 | 1.2829 | 7.5e-6 | 6.4e-4 |
| F, toe circle, Bishop | 1.2829 | 1.2829 | 7.5e-6 | 6.4e-4 |
| area of sliding mass, toe circle | 111.20 m² | 111.20 m² | 1.1e-13 | 1.1e-4 |
| driving moment, toe circle | 15600.0 kN·m/m | 15600.0 kN·m/m | 0.00276 | 7.8000 |
| F, deep circle, ordinary | 0.96968 | 0.96963 | 4.7e-5 | 4.8e-4 |
| F, deep circle, Bishop | 0.96968 | 0.96963 | 4.7e-5 | 4.8e-4 |
| area of sliding mass, deep circle | 688.32 m² | 688.32 m² | 1.1e-13 | 6.9e-4 |
| driving moment, deep circle | 68070.0 kN·m/m | 68070.0 kN·m/m | 0.02643 | 34.0350 |
| F, slope circle, ordinary | 2.5509 | 2.5509 | 1.1e-5 | 0.00128 |
| F, slope circle, Bishop | 2.5509 | 2.5509 | 1.1e-5 | 0.00128 |
| area of sliding mass, slope circle | 27.6001 m² | 27.6001 m² | 1.8e-14 | 2.8e-5 |
| driving moment, slope circle | 2983.9 kN·m/m | 2983.9 kN·m/m | 7.0e-4 | 1.4920 |

### V3 — Dry homogeneous slope checked slice by slice

**Source:** Hand calculation written out in tests/validation/cases.ts: 8 m slope at 2 : 3, γ = 18.5 kN/m³, c′ = 12 kPa, φ′ = 22°, circle centre (12, 16) through the toe (10, 0), eight 2 m slices

**Basis:** hand calculation. Every number in the slice table is recomputed in the test without calling the engine: areas by Simpson’s rule, α = asin((xm − xc)/R) at the middle of each base, l = b sec α, N = W cos α, T = W sin α, then F = Σ(c′l + N tan φ′)/ΣT and a separate Bishop iteration. Weights, angles and forces must agree to rounding (the engine integrates the arc analytically, the check uses Simpson’s rule). The last line compares with the cruder hand method that takes each weight from the mid-height of the slice; 1 % is allowed there because that is the error of the mid-ordinate rule with 2 m slices.

| Quantity | Expected | SlopeForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| number of slices | 8.0000 | 8.0000 | 0 | 0 |
| slice 1: weight W | 27.7404 kN/m | 27.7404 kN/m | 1.5e-12 | 2.8e-5 |
| slice 1: base angle α | -3.5556 ° | -3.5556 ° | 6.2e-15 | 1.0e-9 |
| slice 1: N = W cos α | 27.6870 kN/m | 27.6870 kN/m | 1.5e-12 | 2.8e-5 |
| slice 1: T = W sin α | -1.7204 kN/m | -1.7204 kN/m | 9.3e-14 | 2.8e-5 |
| slice 2: weight W | 77.0738 kN/m | 77.0738 kN/m | 1.5e-12 | 7.7e-5 |
| slice 2: base angle α | 3.5556 ° | 3.5556 ° | 6.7e-15 | 1.0e-9 |
| slice 2: N = W cos α | 76.9254 kN/m | 76.9254 kN/m | 1.5e-12 | 7.7e-5 |
| slice 2: T = W sin α | 4.7799 kN/m | 4.7799 kN/m | 1.0e-13 | 7.7e-5 |
| slice 3: weight W | 117.12 kN/m | 117.12 kN/m | 1.7e-12 | 1.2e-4 |
| slice 3: base angle α | 10.7225 ° | 10.7225 ° | 0 | 1.0e-9 |
| slice 3: N = W cos α | 115.08 kN/m | 115.08 kN/m | 1.7e-12 | 1.2e-4 |
| slice 3: T = W sin α | 21.7904 kN/m | 21.7904 kN/m | 3.2e-13 | 1.2e-4 |
| slice 4: weight W | 147.42 kN/m | 147.42 kN/m | 2.8e-12 | 1.5e-4 |
| slice 4: base angle α | 18.0645 ° | 18.0645 ° | 0 | 1.0e-9 |
| slice 4: N = W cos α | 140.15 kN/m | 140.15 kN/m | 2.6e-12 | 1.5e-4 |
| slice 4: T = W sin α | 45.7131 kN/m | 45.7131 kN/m | 8.7e-13 | 1.5e-4 |
| slice 5: weight W | 166.93 kN/m | 166.93 kN/m | 5.7e-12 | 1.7e-4 |
| slice 5: base angle α | 25.7294 ° | 25.7294 ° | 0 | 1.0e-9 |
| slice 5: N = W cos α | 150.38 kN/m | 150.38 kN/m | 5.1e-12 | 1.7e-4 |
| slice 5: T = W sin α | 72.4688 kN/m | 72.4688 kN/m | 2.5e-12 | 1.7e-4 |
| slice 6: weight W | 173.69 kN/m | 173.69 kN/m | 1.3e-11 | 1.7e-4 |
| slice 6: base angle α | 33.9284 ° | 33.9284 ° | 0 | 1.0e-9 |
| slice 6: N = W cos α | 144.12 kN/m | 144.12 kN/m | 1.0e-11 | 1.7e-4 |
| slice 6: T = W sin α | 96.9452 kN/m | 96.9452 kN/m | 7.0e-12 | 1.7e-4 |
| slice 7: weight W | 139.24 kN/m | 139.24 kN/m | 4.2e-11 | 1.4e-4 |
| slice 7: base angle α | 43.0151 ° | 43.0151 ° | 0 | 1.0e-9 |
| slice 7: N = W cos α | 101.81 kN/m | 101.81 kN/m | 3.1e-11 | 1.4e-4 |
| slice 7: T = W sin α | 94.9879 kN/m | 94.9879 kN/m | 2.9e-11 | 1.4e-4 |
| slice 8: weight W | 55.0780 kN/m | 55.0780 kN/m | 2.8e-10 | 5.5e-5 |
| slice 8: base angle α | 53.7288 ° | 53.7288 ° | 0 | 1.0e-9 |
| slice 8: N = W cos α | 32.5846 kN/m | 32.5846 kN/m | 1.6e-10 | 5.5e-5 |
| slice 8: T = W sin α | 44.4053 kN/m | 44.4053 kN/m | 2.2e-10 | 5.5e-5 |
| F, ordinary method | 1.4376 | 1.4376 | 7.6e-13 | 1.0e-6 |
| F, Bishop’s simplified method | 1.5056 | 1.5056 | 2.0e-7 | 1.0e-5 |
| F, ordinary, weights from mid-heights only | 1.4310 | 1.4376 | 0.00659 | 0.01431 |

The hand calculation (independent of the engine):

| Slice | b (m) | h (m) | W (kN/m) | α (°) | l (m) | N = W cos α | T = W sin α | c′l |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2.00 | 0.750 | 27.74 | -3.56 | 2.004 | 27.69 | -1.72 | 24.05 |
| 2 | 2.00 | 2.083 | 77.07 | 3.56 | 2.004 | 76.93 | 4.78 | 24.05 |
| 3 | 2.00 | 3.165 | 117.12 | 10.72 | 2.036 | 115.08 | 21.79 | 24.43 |
| 4 | 2.00 | 3.984 | 147.42 | 18.06 | 2.104 | 140.15 | 45.71 | 25.24 |
| 5 | 2.00 | 4.512 | 166.93 | 25.73 | 2.220 | 150.38 | 72.47 | 26.64 |
| 6 | 2.00 | 4.694 | 173.69 | 33.93 | 2.410 | 144.12 | 96.95 | 28.92 |
| 7 | 2.00 | 3.763 | 139.24 | 43.02 | 2.735 | 101.81 | 94.99 | 32.82 |
| 8 | 2.00 | 1.489 | 55.08 | 53.73 | 3.381 | 32.58 | 44.41 | 40.57 |
| Σ | | | 904.29 | | 18.893 | 788.73 | 379.37 | 226.72 |

F (ordinary) = (Σc′l + tan 22° ΣN) / ΣT = (226.72 + 0.4040 × 788.73) / 379.37 = **1.438**; Bishop converges to **1.506**.

### V4 — Long shallow circle against the infinite-slope formula

**Source:** F = [c′ sec β + (γ z (cos β − kh sin β) − u sec β) tan φ′] / [γ z (sin β + kh cos β)]; for c′ = 0 with ru this is the c′/γH = 0 line of Bishop & Morgenstern (1960)

**Basis:** closed form. A circle with a 100 m chord lying 0.5 m below a uniform 25° incline is as close to a plane as a circle gets. The expected value is the infinite-slope formula evaluated at the mean depth of the sliding mass (area / width), derived in the test file and in docs/THEORY.md. Tolerance 0.2 % for the ordinary method and 0.5 % for Bishop: the arc is not quite a plane, and Bishop’s vertical resolution feels the two ends more. The seismic case is checked for the ordinary method only, because the closed form resolves the seismic force normal to the plane, which Bishop’s method does not do.

| Quantity | Expected | SlopeForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| F, dry c′–φ′ soil, ordinary | 3.6043 | 3.6048 | 5.6e-4 | 0.00721 |
| F, dry c′–φ′ soil, Bishop | 3.6043 | 3.6084 | 0.00407 | 0.01802 |
| F, dry sand (tan φ′ / tan β), ordinary | 1.3400 | 1.3402 | 1.3e-4 | 0.00268 |
| F, dry sand (tan φ′ / tan β), Bishop | 1.3400 | 1.3403 | 2.6e-4 | 0.00670 |
| F, sand with ru = 0.3 ((1 − ru sec²β) tan φ′ / tan β), ordinary | 0.85061 | 0.85066 | 5.2e-5 | 0.00170 |
| F, sand with ru = 0.3 ((1 − ru sec²β) tan φ′ / tan β), Bishop | 0.85061 | 0.85081 | 1.9e-4 | 0.00425 |
| F, phreatic line at the surface (u = γw z), ordinary | 3.4487 | 3.4492 | 5.3e-4 | 0.00690 |
| F, phreatic line at the surface (u = γw z), Bishop | 3.4487 | 3.4621 | 0.01346 | 0.01724 |
| F, seismic coefficient kh = 0.1, ordinary | 2.9203 | 2.9208 | 4.6e-4 | 0.00584 |

### V5 — Submerged slope against the buoyant-weight analysis

**Source:** Hydrostatics: water pressure on a closed surface equals the weight of water displaced

**Basis:** cross-check. A slope standing wholly under still water is analysed twice: once with total unit weight, pore pressures on the slip surface and the water load on the ground surface; once dry with the buoyant unit weight γ − γw. The two must agree for any method that satisfies vertical equilibrium of each slice (Bishop), and for φ = 0. The ordinary method is not included for the frictional soil: its N′ = W cos α − u l is known not to reduce to the buoyant weight. Tolerance 0.2 %: the water thrust on the ground is applied at the mid-point of each slice top.

| Quantity | Expected | SlopeForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| F (Bishop), c′ = 12 kPa, φ′ = 28° | 2.1012 | 2.1009 | 2.8e-4 | 0.00420 |
| F (Bishop), cu = 25 kPa, φ = 0 | 1.6818 | 1.6817 | 1.4e-4 | 0.00336 |
| F (ordinary), cu = 25 kPa, φ = 0 | 1.6818 | 1.6817 | 1.4e-4 | 0.00336 |

### V6 — ACADS benchmark slopes 1(a), 1(c) and 1(d)

**Source:** Donald & Giam (1989), ACADS slope stability review, problems 1(a), 1(c), 1(d); comparison values from the Rocscience Slide verification manual

**Basis:** published. Critical circle by Bishop’s simplified method from a full search (default grid, 40 slices). Two comparisons each. (1) The ACADS referee values 1.00, 1.39 and 1.00, allowed ±0.03: they are rounded and the methods submitted to the review scatter by about that much. (2) The Bishop results of an independent program (Slide: 0.987, 1.405, 1.015), allowed ±0.005, the difference to expect between two search implementations. Honest note on sources: the three-layer geometry, the soil properties and the Bishop value 1.405 for 1(c) were checked against a published verification document that reproduces the ACADS problem (LUSAS, “Non-homogeneous slope”, shifted origin). The referee values, the 1(a) geometry and the Slide values for 1(a) and 1(d) were entered from memory and not re-checked against the original report.

| Quantity | Expected | SlopeForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| 1(a) homogeneous: F against the referee value | 1.0000 | 0.98518 | 0.01482 | 0.03000 |
| 1(a) homogeneous: F against Bishop in Slide | 0.98700 | 0.98518 | 0.00182 | 0.00500 |
| 1(c) three layers: F against the referee value | 1.3900 | 1.4029 | 0.01289 | 0.03000 |
| 1(c) three layers: F against Bishop in Slide | 1.4050 | 1.4029 | 0.00211 | 0.00500 |
| 1(d) three layers, kh = 0.15: F against the referee value | 1.0000 | 1.0130 | 0.01297 | 0.03000 |
| 1(d) three layers, kh = 0.15: F against Bishop in Slide | 1.0150 | 1.0130 | 0.00203 | 0.00500 |
