import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

// Opt-in: needs a running app plus a real browser for layout-dependent rules (contrast, target size).
const isEnabled = process.env.A11Y_E2E === '1';

const AXE_SCRIPT_PATH = path.join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js');

type AxeViolation = { id: string; impact: string | null; help: string; nodes: { target: string[] }[] };

async function blockingViolations(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: AXE_SCRIPT_PATH });
  const violations = await page.evaluate(async () => {
    type AxeRunner = { run: (context: Document, options: unknown) => Promise<{ violations: AxeViolation[] }> };
    const { axe } = window as unknown as { axe: AxeRunner };
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return results.violations;
  });
  return violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
}

test.describe('Accessibility - core flow (axe, real browser)', () => {
  test.skip(!isEnabled, 'Set A11Y_E2E=1 to run the browser accessibility audit.');

  test('landing page has no critical/serious violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });

  test('Studio Desk is keyboard reachable and has no critical/serious violations', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /İçeriğe geç|skip to content/i })).toBeFocused();

    await page.getByRole('button', { name: /studio desk/i }).first().click();
    await expect(page.getByRole('heading', { name: /studio desk/i })).toBeFocused();
    expect(await blockingViolations(page)).toEqual([]);
  });
});
