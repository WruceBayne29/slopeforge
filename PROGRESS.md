# Progress

**Status:** IN PROGRESS — engine and validation done; UI is a placeholder.

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

## In progress
- Milestone 4: MVP UI and first real deploy (the placeholder page is live-able but plain).

## Exact next step
- `src/model/project.ts` (project = model + settings, defaults), `src/model/examples.ts`, then the
  UI: `src/ui/App.tsx`, `Section.tsx` (SVG cross-section with hatches, axes, scale bar, critical
  circle), results panel. Deploy, verify with curl.

## Milestone checklist
- [x] 1. Engine
- [x] 2. Critical circle search
- [x] 3. Validation suite → VALIDATION.md
- [ ] 4. MVP deploy
- [ ] 5. Editor
- [ ] 6. Results view
- [ ] 7. Worked steps
- [ ] 8. Example library
- [ ] 9. Export
- [ ] 10. Polish
- [ ] Final docs & deliverables
- [ ] Self-review on live site
- [ ] Stretch: Janbu, Spencer, non-circular
