import { expect, test } from '@playwright/test';

test.describe('Smoke - Local Critical Path', () => {
  test('homepage renders and blocks live Stripe dependency', async ({ page }) => {
    const stripeCalls: string[] = [];

    await page.route('https://api.stripe.com/**', async (route) => {
      stripeCalls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mocked: true }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /j.riyle y.zle.|face the jury/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /studio desk.*ge.|open studio desk/i })).toBeVisible();

    expect(stripeCalls).toHaveLength(0);
  });

  test('health endpoint is reachable', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    expect(payload.status).toBe('ok');
  });
});
