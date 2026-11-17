## What this changes

<!-- One or two sentences. Link the issue if there is one. -->

## Kind of change

- [ ] Analysis engine (`src/engine`)
- [ ] Interface or drawing
- [ ] Export
- [ ] Documentation

## Checklist

- [ ] `npm run check` passes (lint, format, tests, build)
- [ ] Engine changes come with a test whose expected value is derived independently
      (a published benchmark, a closed form, or a hand calculation written out in the test)
- [ ] New benchmark values say where they come from in `tests/validation/cases.ts`, and
      `npm run validation` has been run
- [ ] `src/engine` coverage stays above 90 % (`npm run coverage`)
- [ ] Screenshots attached for interface changes
