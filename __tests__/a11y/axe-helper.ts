import axe, { type AxeResults, type Result } from 'axe-core';

const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

// jsdom has no layout engine, so contrast and landmark checks are verified in the browser instead.
const JSDOM_DISABLED_RULES = {
  'color-contrast': { enabled: false },
  region: { enabled: false },
};

export async function runAxe(root: Element = document.body): Promise<AxeResults> {
  return axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    rules: JSDOM_DISABLED_RULES,
  });
}

export function formatViolations(violations: Result[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n');
      return `[${violation.impact}] ${violation.id}: ${violation.help}\n${targets}`;
    })
    .join('\n');
}

export async function expectNoBlockingAxeViolations(root: Element = document.body): Promise<void> {
  const results = await runAxe(root);
  const blocking = results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''));
  if (blocking.length > 0) {
    throw new Error(`Blocking axe violations:\n${formatViolations(blocking)}`);
  }
}
