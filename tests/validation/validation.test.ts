import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VALIDATION_CASES } from './cases';

function fmt(v: number): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(1);
  if (abs >= 100) return v.toFixed(2);
  if (abs >= 1) return v.toFixed(4);
  if (abs >= 0.001) return v.toFixed(5);
  return v.toExponential(1);
}

const rows: string[] = [];
const summary: string[] = [];
let total = 0;

describe('validation against published benchmarks and closed forms', () => {
  for (const vcase of VALIDATION_CASES) {
    describe(`${vcase.id} ${vcase.title}`, () => {
      const checks = vcase.run();
      total += checks.length;
      rows.push(
        `\n### ${vcase.id} — ${vcase.title}\n`,
        `**Source:** ${vcase.source}\n`,
        `**Basis:** ${vcase.basis}. ${vcase.provenance}\n`,
        '| Quantity | Expected | SlopeForge | Difference | Allowed |',
        '| --- | ---: | ---: | ---: | ---: |',
      );
      summary.push(`| ${vcase.id} | ${vcase.title} | ${vcase.basis} | ${checks.length} |`);
      for (const c of checks) {
        const diff = Math.abs(c.actual - c.expected);
        const unit = c.unit ? ` ${c.unit}` : '';
        rows.push(
          `| ${c.quantity} | ${fmt(c.expected)}${unit} | ${fmt(c.actual)}${unit} | ${fmt(diff)} | ${fmt(c.tolerance)} |`,
        );
        it(c.quantity, () => {
          expect(diff).toBeLessThanOrEqual(c.tolerance);
        });
      }
      if (vcase.notes) rows.push(...vcase.notes());
    });
  }

  it('writes VALIDATION.md when WRITE_VALIDATION=1', () => {
    if (process.env.WRITE_VALIDATION !== '1') return;
    const table = [
      '| # | What is checked | Basis | Values |',
      '| --- | --- | --- | ---: |',
      ...summary,
    ];
    const header = [
      '# Validation',
      '',
      `SlopeForge's analysis engine is checked against **${total} values in ${VALIDATION_CASES.length} groups**: published`,
      'benchmark slopes, closed-form solutions that use no slices at all, a hand calculation written out',
      'slice by slice, and cross-checks between independent formulations. This file is generated from',
      '`tests/validation/cases.ts` by `npm run validation`, so it cannot drift from the code, and the',
      'suite runs in CI on every push.',
      '',
      '**How to read the tolerances.** "Allowed" is the difference each source permits, not a fixed',
      'percentage: a table printed to three figures allows half a unit in the third figure, a closed',
      'form allows only the discretisation error of the slices, and a benchmark solved by many programs',
      'allows the scatter between them. Each group states its own reasoning.',
      '',
      '**Basis.** *published* — the expected number comes from the literature. *closed form* — derived',
      'from a formula in the test, with no slices. *hand calculation* — the same method worked',
      'independently, slice by slice, in the test. *cross-check* — two formulations that must agree.',
      '',
      '## What is not independently verified',
      '',
      '- **Numbers recalled from memory.** Taylor’s stability numbers (V1), the ACADS referee values and',
      '  the Slide comparison values for problems 1(a) and 1(d) (V6) were typed in from memory. They are',
      '  standard figures and the engine reproduces them, but they were not re-read from the original',
      '  publications while writing the tests. The geometry and soil properties of ACADS 1(c) and its',
      '  Bishop value of 1.405 were checked against a published verification document.',
      '- **Pore pressure benchmarks.** Water is validated by closed forms (infinite slope with ru and with',
      '  a phreatic line, the submerged-slope identity), not against a published slope with a water',
      '  table solved by another program.',
      '- **Tension cracks, surcharges and ponded water** are covered by unit tests of their mechanics',
      '  (`src/engine/analyse.test.ts`) and, for ponded water, by V5; there is no published benchmark',
      '  for them here.',
      '- **The ordinary method under high pore pressure** is known to be inaccurate (it can make the',
      '  normal force negative). SlopeForge reports this as a warning; it is a property of the method,',
      '  not something validation can remove.',
      '',
      '## Summary',
      '',
      ...table,
      '',
      '## Full results',
    ];
    writeFileSync('VALIDATION.md', [...header, ...rows, ''].join('\n'));
    const readme = readFileSync('README.md', 'utf8');
    const start = '<!-- validation:start -->';
    const end = '<!-- validation:end -->';
    if (readme.includes(start) && readme.includes(end)) {
      const block = [
        start,
        `**${total} values in ${VALIDATION_CASES.length} groups.**`,
        '',
        ...table,
        end,
      ].join('\n');
      writeFileSync(
        'README.md',
        readme.slice(0, readme.indexOf(start)) +
          block +
          readme.slice(readme.indexOf(end) + end.length),
      );
    }
  });
});
