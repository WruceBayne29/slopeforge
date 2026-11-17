# Progress

**Status:** IN PROGRESS — MVP deployed at https://wrucebayne29.github.io/slopeforge/

## Done
- Scaffold: toolchain copied from RCForge, public repo, Pages enabled (workflow build), PLAN /
  DECISIONS / HANDOVER.
- Milestones 1–3. `src/engine`: geometry, strata (boundaries clipped to ground), slices with exact
  areas, Fellenius, Bishop, phreatic line / ru / ponded water, surcharge, seismic, tension crack,
  critical-circle search (grid × radius scan + pattern-search polish, FoS map). 88 unit tests,
  99 % coverage.
- Validation suite: 71 values in 6 groups (Taylor φ = 0, exact φ = 0 moments, slice-by-slice hand
  check, infinite slope, submerged ≡ buoyant, ACADS 1(a)/1(c)/1(d)) → `VALIDATION.md`
  (`npm run validation`). ACADS Bishop: 0.985 / 1.403 / 1.013.

- Milestone 4 (MVP): real UI live — borehole-log soil table, cross-section drawing (hatches, axes,
  scale bar, title block, FoS contour map, critical circle, slices), results panel, slice table,
  worked steps, examples (9), undo/redo, JSON open/save, share links, trial circle, keyboard
  shortcuts. Dragging points, double-click insert/delete already work (milestone 5 mostly done).
- `src/model` (project, edit ops, history, examples, benchmarks, run) and `src/io` (project file,
  share) with tests. Analysis runs in a web worker (`src/ui/analysis.worker.ts`).
- `scripts/serve.mjs` + `scripts/shot.mjs`: serve `dist/` and screenshot it with Playwright
  (`npm run build && node scripts/shot.mjs out.png 1500 950 acads-1c`).

## In progress
- Milestone 6: remaining result views.

## Exact next step
- `src/ui/Details.tsx`: add tabs "Slice forces" (free-body of the picked slice), "Methods"
  (Fellenius vs Bishop: per-slice normal stress chart, both searches) and "Sensitivity" (charts
  from `response.sensitivity`); wire `useAnalysis` extras in `App.tsx` (sensitivity/other flags).
- Then `src/io/report.ts` (PDF), `src/ui/Guide.tsx` (About + tour), `scripts/e2e.mjs`,
  `scripts/screenshots.mjs`, docs.

## Milestone checklist
- [x] 1. Engine
- [x] 2. Critical circle search
- [x] 3. Validation suite → VALIDATION.md
- [x] 4. MVP deploy
- [ ] 5. Editor
- [ ] 6. Results view
- [ ] 7. Worked steps
- [ ] 8. Example library
- [ ] 9. Export
- [ ] 10. Polish
- [ ] Final docs & deliverables
- [ ] Self-review on live site
- [ ] Stretch: Janbu, Spencer, non-circular
