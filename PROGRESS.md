# Progress

**Status:** COMPLETE — deployed at https://wrucebayne29.github.io/slopeforge/

## Done
- Engine (`src/engine`, pure TypeScript): geometry, strata, slices with exact areas, ordinary and
  Bishop simplified methods, phreatic line / ru / ponded water, surcharge, seismic coefficient,
  tension crack, critical-circle search with FoS map, local refinement, sensitivity, contours,
  worked steps. About 99 % coverage.
- Validation: 70 values in 6 groups → `VALIDATION.md` (`npm run validation`). ACADS Bishop:
  0.985 / 1.403 / 1.013 against reported 0.987 / 1.405 / 1.015.
- UI in the site-investigation style: borehole-log soil table, cross-section drawing (hatches, RL
  and chainage axes, scale bar, title block, FoS contours, slices), drag / add / delete points,
  snap, undo/redo, trial circle, results panel, slice table, working, slice forces, Fellenius vs
  Bishop, sensitivity. Nine examples. Web worker. Error boundary.
- Export: PDF report, JSON save/open, share links. About note, five-stop tour, keyboard
  shortcuts, phone layout, print stylesheet.
- Tests: 246 unit and validation tests. `scripts/e2e.mjs`: 95 Playwright checks, passing on the
  live site.
- Docs: README (GIF, screenshots, theory, validation table, Mermaid architecture, roadmap),
  docs/THEORY.md, VALIDATION.md, CONTRIBUTING.md, issue and PR templates, LINKEDIN_POST.md,
  CV_BULLETS.md, HANDOVER.md.

## Not done / not verified
- **Stretch items not started:** Janbu's simplified method, Spencer's method, non-circular surfaces.
- **Reference values recalled from memory:** Taylor's stability numbers, the ACADS referee values,
  the ACADS 1(a) geometry and the Bishop comparison values for 1(a) and 1(d). The 1(c) geometry,
  soil properties and Bishop value 1.405 were checked against a published verification document.
  See the list at the top of VALIDATION.md.
- No published benchmark with a water table was reproduced; water is validated by closed forms
  (infinite slope, submerged ≡ buoyant).
- Only the first page of the PDF was inspected by eye.
- Tested in Chromium (Playwright) only; not checked in Safari or Firefox.

## If you resume
- Nothing is in progress. `npm run check` and `npm run e2e` should both pass.
- Next, if wanted: the stretch items above (start in `src/engine/methods.ts`; see CONTRIBUTING.md
  "Adding an analysis method").

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
- [x] Final docs & deliverables
- [x] Self-review on live site
- [ ] Stretch: Janbu, Spencer, non-circular
