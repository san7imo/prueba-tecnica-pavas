import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  resolve(process.cwd(), 'src/styles.css'),
  'utf8',
);

const betweenBreakpoints = (from, to) => {
  const start = stylesheet.indexOf(`@media (max-width: ${from}px)`);
  const end = to
    ? stylesheet.indexOf(`@media (max-width: ${to}px)`, start + 1)
    : stylesheet.length;

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return stylesheet.slice(start, end);
};

describe('HITO 17 responsive workflow baseline', () => {
  it('collapses navigation and relational detail before tablet width', () => {
    const tabletRules = betweenBreakpoints(820, 640);

    expect(tabletRules).toContain('.app-shell { display: block; }');
    expect(tabletRules).toContain('.primary-nav { display: flex; overflow-x: auto; }');
    expect(tabletRules).toContain('.detail-grid { grid-template-columns: 1fr; }');
  });

  it('stacks operational forms, tables and recovery actions on mobile', () => {
    const mobileRules = betweenBreakpoints(640, 430);

    expect(mobileRules).toContain('.lookup-form, .form-grid, .form-grid--item { grid-template-columns: 1fr; }');
    expect(mobileRules).toContain('.data-table, .data-table tbody, .data-table tr, .data-table td { display: block; width: 100%; }');
    expect(mobileRules).toContain('.actionable-alert, .actionable-summary { align-items: flex-start; flex-direction: column; }');
  });
});
