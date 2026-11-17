# CV bullets

Numbers are taken from the repository and can be reproduced: tests and coverage from
`npm run coverage`, validation from `VALIDATION.md`, end-to-end checks from `npm run e2e`.

**SlopeForge — slope stability analysis in the browser** · TypeScript, React, Vite ·
[live](https://wrucebayne29.github.io/slopeforge/) · [source](https://github.com/WruceBayne29/slopeforge)

- Specified and shipped an open-source slope stability analyser that finds the critical slip
  circle by the **ordinary and Bishop simplified methods of slices**, with pore pressure, surcharge,
  seismic load and tension cracks; engine checked against **70 benchmark and closed-form values**
  (Taylor's charts, ACADS benchmark slopes within 0.2 % of published Bishop values) with
  **99 % test coverage** across 240+ automated tests.
- Implemented a **critical-circle search** (grid of centres, golden-section radius scan, compass
  refinement; about 10,000 circles in under a second in a web worker) with exact slice areas, a
  contour map of factor of safety and sensitivity curves for strength and water level.
- Delivered a drag-and-drop section editor styled as a geotechnical cross-section, worked
  hand-calculation steps, a generated **PDF report** and share links, deployed by a GitHub Actions
  CI/CD pipeline and verified by a **95-check Playwright end-to-end suite** on the live site.

## A note on wording

The implementation was written by an AI coding agent (Claude Code) working from your
specification, so the bullets say "specified and shipped", "implemented" and "delivered" in the
sense of directing the work. If an interviewer asks, say so plainly and then explain Bishop's
equation and why it needs iteration; `docs/THEORY.md` covers what you would be asked. If you would
rather not use "implemented" for the second bullet, "Directed the implementation of…" is the
stricter phrasing.

Shorter variants:

- Built SlopeForge, an open-source slope stability analyser (Fellenius and Bishop methods of
  slices) with a critical-circle search and worked steps.
- 70 benchmark values validated, including ACADS slopes; 99 % coverage.
- Shipped with CI/CD to GitHub Pages and a 95-check end-to-end suite.
