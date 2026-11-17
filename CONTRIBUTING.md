# Contributing to SlopeForge

Thank you for looking. SlopeForge is a learning tool, and the most valuable contribution is
finding a factor of safety that is wrong.

## Getting set up

```bash
git clone https://github.com/WruceBayne29/slopeforge.git
cd slopeforge
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app with hot reload |
| `npm test` | Unit tests and the validation suite |
| `npm run coverage` | Tests with coverage; thresholds are enforced on `src/engine` |
| `npm run check` | Lint, format check, tests and a production build. Run it before every commit |
| `npm run validation` | Regenerate `VALIDATION.md` (and the table in the README) from the suite |
| `npm run e2e` | Playwright script that uses every feature of the live site |
| `node scripts/e2e.mjs local` | The same script against your own production build (`npm run build` first) |
| `npm run screenshots` | Regenerate the README screenshots and GIF from the production build |

## How the code is arranged

```
src/engine/   The analysis. Pure TypeScript, no React, no DOM.
  geometry.ts   polylines, the lower arc of a circle, exact areas under it
  strata.ts     model checks, layer boundaries clipped to the ground
  analyse.ts    one circle by the method of slices
  methods.ts    the ordinary method and Bishop's simplified method
  search.ts     grid of centres × radius scan, then local refinement
  sensitivity.ts, contours.ts, steps.ts (the worked calculation)
  reference.ts  closed forms that use no slices, for the tests
src/model/    The project document, editing operations, undo history, examples, benchmarks.
src/io/       JSON files, share links, the PDF report.
src/ui/       React: the section drawing, the borehole log, results and working.
tests/validation/   Benchmarks and closed forms the engine must reproduce → VALIDATION.md.
scripts/      Playwright end-to-end and screenshot scripts.
```

## Rules

- Strict TypeScript, no `any`. ESLint and Prettier must be clean.
- `src/engine` stays above 90 % test coverage.
- **Expected values in tests must be independent of the code under test**: a published
  benchmark, a closed form that uses no slices, or a hand calculation written out in the test.
  A test that recomputes the same formula proves nothing.
- **Say where a benchmark number comes from.** If a value is recalled from memory rather than
  read from the source while writing the test, the case's `provenance` must say so, with the
  tolerance and the reason for it.
- Units at function boundaries: m, kN, kPa, kN/m³, degrees; forces per metre run of slope.
- Drawings set their colours as SVG attributes, not CSS classes, so they rasterise into the PDF.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`).

## Adding a worked example

Add an entry to `src/model/examples.ts`. `src/model/model.test.ts` requires every example to pass
the model checks and to produce a critical circle with a sensible factor of safety; the PDF test
builds a report for each one.

## Adding an analysis method

1. Write the per-slice equation in `src/engine/methods.ts` and call it from `analyseCircle`.
2. Test it against something you can source: a published benchmark solved by that method, or a
   limit in which it must agree with a closed form (φ = 0, the infinite slope).
3. Add a validation case to `tests/validation/cases.ts` and run `npm run validation`.
4. Show it in `src/ui/Results.tsx` and the comparison tab, and write it out in `steps.ts`.

## Reporting a wrong result

Use the "Wrong result" issue template. Include the share link, the value that is wrong, the
value you expected and where it comes from.
