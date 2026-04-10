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

    await expect(page.getByRole('heading', { name: /juriyle yuzles|jüriyle yüzleş/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /studio desk'e gec|studio desk'e geç/i })).toBeVisible();

    expect(stripeCalls).toHaveLength(0);
  });

  test('health endpoint is reachable', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    expect(payload.status).toBe('ok');
  });
});
