# Handover prompt

Paste everything below the line into a new Claude Code session (any account). Open the session in
the project folder if it exists on that machine; otherwise the prompt tells Claude to clone it.

---

You are continuing an autonomous build of **SlopeForge**, a portfolio-quality open-source project.
I am AFK and will NOT respond. Never ask me questions. When you hit a decision, make the best
call, log it in DECISIONS.md, and keep going. If something truly needs me (e.g. an auth failure),
log it in BLOCKERS.md, skip it, and continue with other work.

## Where the work is

- Local folder: `/Users/vishnusuhaasmagadala/Desktop/slopeforge` (if it does not exist, run
  `gh repo clone WruceBayne29/slopeforge` and work there).
- GitHub: https://github.com/WruceBayne29/slopeforge (public, GitHub Pages via Actions)
- Live site: https://wrucebayne29.github.io/slopeforge/
- Sister projects, finished, for reference and reusable code:
  `/Users/vishnusuhaasmagadala/Desktop/rcforge` (https://github.com/WruceBayne29/rcforge) and
  `/Users/vishnusuhaasmagadala/Desktop/frameforge` (https://github.com/WruceBayne29/frameforge).

## First thing to do

Read, in this order: `PROGRESS.md` (state and the exact next step), `PLAN.md` (scope and
architecture), `DECISIONS.md` (calls already made — do not re-litigate them), `BLOCKERS.md`.
Run `npm install` then `npm run check` to confirm the repo is green. Then continue from the
"Exact next step" in PROGRESS.md.

## What SlopeForge is

A browser-based slope stability analyser for geotechnical engineering students: draw a slope
cross-section and soil layers, set a water table, and find the critical slip circle and its factor
of safety by the method of slices (Ordinary / Fellenius and Bishop's simplified), with a grid
search over circle centres and radii, a FoS contour map, worked hand-calculation steps,
sensitivity plots, a PDF report, JSON save/load and share links. The analysis engine in
`src/engine` is written from scratch in pure TypeScript (no geotechnical libraries, no React/DOM).
TypeScript + React + Vite, no backend, deployed to GitHub Pages. Full scope: PLAN.md.

## Rules

- Session may be cut off at any moment. Update PROGRESS.md (done / in progress / exact next step)
  after every meaningful step. Commit and push small, frequent commits. The repo must always be
  working, deployed and presentable. Keep this HANDOVER.md accurate too.
- Run `npm run check` (lint + format check + tests + build) before every commit and fix anything
  that fails. Check exit codes properly: do not pipe a command into `tail` and assume it passed.
- Strict TypeScript, ESLint + Prettier, no `any`. `src/engine/` is pure and must stay above 90 %
  test coverage (`npm run coverage` enforces the threshold).
- Be honest in all docs. If a benchmark value is recalled from memory rather than derived in the
  test, VALIDATION.md must say so and state the tolerance and why. LINKEDIN_POST.md and
  CV_BULLETS.md must say the code was written by an AI coding agent (Claude Code) from the owner's
  specification.
- `VALIDATION.md` is generated: edit `tests/validation/cases.ts`, then `npm run validation`.

## Look and feel (owner's explicit request)

SlopeForge must NOT look like FrameForge (dark/light slate-and-blue CAD tool), RCForge (warm paper
calculation sheet, rust / ochre / olive) or a generic AI-generated dashboard. It looks like a
**geotechnical site-investigation drawing**: a geological cross-section with strata drawn in muted
earth tones and traditional hatch patterns (dots for sand, dashes for clay, …), RL and chainage
axes, a scale bar and a title block; the soil table is laid out like a borehole log. White ground,
black linework, blue only for water, red only for the slip surface. Condensed uppercase lettering,
monospace figures, square corners, no gradients, no pills.

## Lessons already learned (from the sister projects)

- TypeScript is pinned to 6.0: `typescript-eslint` does not support 7.x.
- The in-app browser may refuse the public Pages URL without the owner's approval. Verify deploys
  with `curl` and with Playwright (`npm run e2e`), which also generates README screenshots.
- `tsc -b` uses `erasableSyntaxOnly`: no enums, no constructor parameter properties.
- jsPDF's built-in fonts only cover Latin-1; sanitise Greek letters and arrows before writing text.
- Drawings set their colours as SVG attributes, not CSS classes, so the same drawing can be
  rasterised into the PDF.

## Final deliverables

README.md (hero GIF and screenshots generated with Playwright, feature list, live link, theory
with equations, validation table, Mermaid architecture diagram, roadmap), docs/THEORY.md,
VALIDATION.md, CONTRIBUTING.md, issue templates, MIT license, LINKEDIN_POST.md and CV_BULLETS.md
(first person, first-year Civil Engineering student at BITS Pilani, concrete metrics from the repo,
plain statement that an AI coding agent wrote the code). Then a full self-review: run the live
site with Playwright (`npm run e2e`), use every feature, fix bugs, improve polish. If usage
remains, stretch: Janbu's simplified method, Spencer's method, non-circular surfaces. Mark
PROGRESS.md "COMPLETE" only when everything is done and deployed, with an honest list of anything
not done or not verified.
