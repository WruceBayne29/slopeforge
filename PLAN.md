# SlopeForge — build plan

Browser-based **slope stability analyser** for geotechnical engineering students: draw a slope
cross-section and its soil layers, set a water table, and find the critical slip circle and its
factor of safety. Third tool in a set with
[FrameForge](https://github.com/WruceBayne29/frameforge) (frames and trusses) and
[RCForge](https://github.com/WruceBayne29/rcforge) (IS 456 concrete design).
TypeScript + React + Vite, no backend, deployed to GitHub Pages.

- Repo: https://github.com/WruceBayne29/slopeforge
- Live: https://wrucebayne29.github.io/slopeforge/

## What it does

- Slope geometry as a ground-surface polyline, with polyline soil layer boundaries.
- Soils with unit weight γ, effective cohesion c′ and friction angle φ′.
- Pore pressure from a phreatic line (depth below the line × γw) or an ru coefficient; ponded
  water in front of the slope is carried as a surface load.
- Circular slip surfaces analysed by the method of slices: Ordinary (Fellenius) and Bishop's
  simplified method. Surcharge strips, horizontal seismic coefficient, tension crack.
- Critical circle search: grid of centres × radii, then local refinement; FoS map by centre.
- Worked steps: slice table and the Bishop iteration, written like a hand calculation.
- Sensitivity of FoS to c′, φ′ and water level. PDF report, JSON save/load, share links.

## Architecture

```
src/
  engine/    pure TS, no React/DOM
    types.ts        model and result types
    geometry.ts     polylines, circle–polyline intersection, exact areas under an arc
    strata.ts       layer boundaries clipped to the ground, soil at a point
    slices.ts       slice discretisation for a circle (breakpoints + subdivision)
    methods.ts      Fellenius, Bishop (+ Janbu, Spencer as stretch)
    analyse.ts      analyseCircle(model, circle, options) → factors, slice table, messages
    search.ts       centre grid × radius scan, pattern-search refinement, FoS map
    sensitivity.ts  FoS against c′, φ′, water level
    steps.ts        worked calculation steps
    contours.ts     marching squares for the FoS map
  model/     project (model + settings), input checks, examples, undo history
  io/        JSON files, share URLs, PDF report
  ui/        React: section drawing (SVG), borehole-log soil table, results, working
tests/validation/   benchmark cases → VALIDATION.md
scripts/     Playwright end-to-end and screenshot scripts
docs/        THEORY.md, screenshots
```

Units: m, kN, kPa, kN/m³, degrees at the API boundary. Plane strain, forces per metre run.

## Milestones

1. **Engine** — geometry, strata, slices, Fellenius, Bishop, surcharge, seismic, tension crack.
2. **Critical circle search** — grid + radius scan + refinement, FoS map by centre.
3. **Validation** — Taylor φ = 0 stability numbers; φ = 0 closed-form moment check; slice-by-slice
   hand check; infinite-slope limits (dry, ru, seismic); ACADS 1(a), 1(c) (and 1(d) seismic).
   `VALIDATION.md` generated from the suite.
4. **MVP deploy** — example slope, search, drawing with critical circle and FoS, live on Pages.
5. **Editor** — drag ground / layer / water points, add and delete points, soil table, snap,
   undo/redo.
6. **Results view** — slices, forces on a slice, FoS contour map, slice table, Fellenius vs
   Bishop, sensitivity.
7. **Worked steps.**
8. **Example library** (6+).
9. **Export** — PDF report, JSON, share URL.
10. **Polish** — responsive, shortcuts, tour.
11. **Stretch** — Janbu simplified, Spencer, non-circular surfaces.

## Final deliverables

README (GIF/screenshots, features, live link, theory, validation table, Mermaid architecture,
roadmap), docs/THEORY.md, VALIDATION.md, CONTRIBUTING.md, issue templates, MIT LICENSE,
LINKEDIN_POST.md, CV_BULLETS.md.

## Working rules

- PROGRESS.md updated after every meaningful step; small commits pushed often.
- `npm run check` (lint + format check + tests + build) before every commit; check the exit code.
- Decisions → DECISIONS.md. Anything needing the owner → BLOCKERS.md.
- On resume: read PROGRESS.md, PLAN.md, DECISIONS.md, BLOCKERS.md first. HANDOVER.md is a
  self-contained prompt for a fresh session.
