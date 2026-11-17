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

- Milestones 5–10: result views (slice forces, Fellenius vs Bishop, sensitivity), PDF report
  (`src/io/report.ts`), About note and five-stop tour (`src/ui/Guide.tsx`), error boundary,
  responsive layout, shortcuts.
- `scripts/e2e.mjs`: 95 Playwright checks, passing against the local build
  (`npm run build && node scripts/e2e.mjs local`; `npm run e2e` runs against the live site).

## In progress
- Final docs and screenshots.

## Exact next step
- Run `npm run e2e` against the live site once the deploy finishes.
- Write `scripts/screenshots.mjs` (hero GIF + PNGs into `docs/screenshots/`), then README.md,
  docs/THEORY.md, CONTRIBUTING.md, LINKEDIN_POST.md, CV_BULLETS.md; check issue templates.
- Then self-review from screenshots (desktop, phone, PDF), fix polish issues.
- Stretch if usage remains: Janbu simplified, Spencer, non-circular.

## Milestone checklist
- [x] 1. Engine
- [x] 2. Critical circle search
- [x] 3. Validation suite → VALIDATION.md
- [x] 4. MVP deploy
- [x] 5. Editor
- [x] 6. Results view
- [x] 7. Worked steps
- [x] 8. Example library
- [x] 9. Export
- [x] 10. Polish
- [ ] Final docs & deliverables
- [ ] Self-review on live site
- [ ] Stretch: Janbu, Spencer, non-circular
