import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LEGACY_HOSTS,
  PRODUCTION_ANALYTICS_IDS,
  PRODUCTION_ORIGIN,
  analyzeLegacyRedirect,
  analyzeRobots,
  analyzeRoot,
  analyzeSitemap,
  parseBaseUrl,
  runChecks,
} from '../../scripts/check-search-identity.mjs';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SITE_IDENTITY_SOURCE = readFileSync(join(REPOSITORY_ROOT, 'lib/site-identity.ts'), 'utf8');

const PROD_HTML = '<html><head><link rel="canonical" href="https://drawordie.app/"/>'
  + '<script>gtag("config","G-1159TDRHXC")</script></head></html>';
const DEV_HTML = '<html><head><meta name="robots" content="noindex, nofollow"/></head></html>';
const PROD_ROBOTS = 'User-Agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://drawordie.app/sitemap.xml\n';
const DEV_ROBOTS = 'User-Agent: *\nDisallow: /\n';
const PROD_SITEMAP = '<?xml version="1.0"?><urlset><url><loc>https://drawordie.app/</loc></url>'
  + '<url><loc>https://drawordie.app/legal/terms</loc></url></urlset>';
const EMPTY_SITEMAP = '<?xml version="1.0"?><urlset></urlset>';

function fakeFetch(routes) {
  return async (url) => {
    const route = routes[url] ?? { status: 404, body: '' };
    return {
      status: route.status ?? 200,
      headers: new Headers(route.headers ?? {}),
      text: async () => route.body ?? '',
    };
  };
}

test('script constants match lib/site-identity.ts', () => {
  assert.ok(SITE_IDENTITY_SOURCE.includes(`\`https://\${PRODUCTION_HOST}\``));
  assert.ok(SITE_IDENTITY_SOURCE.includes(`PRODUCTION_HOST = '${new URL(PRODUCTION_ORIGIN).host}'`));
  for (const host of LEGACY_HOSTS) assert.ok(SITE_IDENTITY_SOURCE.includes(`'${host}'`), host);
  for (const id of PRODUCTION_ANALYTICS_IDS) assert.ok(SITE_IDENTITY_SOURCE.includes(`'${id}'`), id);
});

test('only https (or http://localhost) targets are accepted', () => {
  assert.equal(parseBaseUrl('https://dev.drawordie.app/foo'), 'https://dev.drawordie.app');
  assert.equal(parseBaseUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.throws(() => parseBaseUrl('http://dev.drawordie.app'));
  assert.throws(() => parseBaseUrl('file:///etc/passwd'));
});

test('production robots needs the single sitemap and no global disallow', () => {
  assert.deepEqual(analyzeRobots(PROD_ROBOTS, { isProduction: true }), []);
  assert.equal(analyzeRobots(DEV_ROBOTS, { isProduction: true }).length, 2);
  assert.equal(
    analyzeRobots('User-Agent: *\nAllow: /\nSitemap: https://drawordie.ackaraca.me/sitemap.xml', { isProduction: true })
      .length,
    1,
  );
});

test('non-production robots must disallow everything', () => {
  assert.deepEqual(analyzeRobots(DEV_ROBOTS, { isProduction: false }), []);
  assert.equal(analyzeRobots(PROD_ROBOTS, { isProduction: false }).length, 2);
});

test('sitemap rejects off-domain, user-content and non-empty non-production sitemaps', () => {
  assert.deepEqual(analyzeSitemap(PROD_SITEMAP, { isProduction: true }), []);
  const stale = '<urlset><url><loc>https://drawordie.ackaraca.me/</loc></url>'
    + '<url><loc>https://drawordie.app/gallery/hall-of-fame</loc></url></urlset>';
  assert.equal(analyzeSitemap(stale, { isProduction: true }).length, 2);
  assert.deepEqual(analyzeSitemap(EMPTY_SITEMAP, { isProduction: false }), []);
  assert.equal(analyzeSitemap(PROD_SITEMAP, { isProduction: false }).length, 1);
});

test('non-production root needs header + meta noindex and no production analytics', () => {
  assert.deepEqual(analyzeRoot({ status: 200, xRobotsTag: 'noindex, nofollow', html: DEV_HTML }, { isProduction: false }), []);
  const issues = analyzeRoot({ status: 200, xRobotsTag: null, html: PROD_HTML }, { isProduction: false });
  assert.equal(issues.length, 3);
  assert.ok(issues.some((issue) => issue.includes('G-1159TDRHXC')));
});

test('production root must stay indexable with a drawordie.app canonical', () => {
  assert.deepEqual(analyzeRoot({ status: 200, xRobotsTag: null, html: PROD_HTML }, { isProduction: true }), []);
  const badCanonical = PROD_HTML.replace('https://drawordie.app/', 'https://drawordie.ackaraca.me/');
  assert.equal(analyzeRoot({ status: 200, xRobotsTag: 'noindex', html: badCanonical }, { isProduction: true }).length, 2);
});

test('legacy redirects must be a single permanent hop to the same path', () => {
  const location = 'https://drawordie.app/legal/terms?utm_source=search-identity-check';
  assert.deepEqual(analyzeLegacyRedirect({ host: 'drawordie.ackaraca.me', status: 308, location }), []);
  assert.equal(analyzeLegacyRedirect({ host: 'x', status: 302, location }).length, 1);
  assert.equal(analyzeLegacyRedirect({ host: 'x', status: 301, location: 'https://drawordie.app/' }).length, 1);
});

test('runChecks flags a stale domain and production analytics on a dev deployment', async () => {
  const origin = 'https://dev.drawordie.app';
  const fetchImpl = fakeFetch({
    [`${origin}/`]: { body: PROD_HTML },
    [`${origin}/robots.txt`]: { body: 'User-Agent: *\nAllow: /\nSitemap: https://drawordie.ackaraca.me/sitemap.xml' },
    [`${origin}/sitemap.xml`]: { body: '<urlset><url><loc>https://drawordie.ackaraca.me/</loc></url></urlset>' },
  });
  const issues = await runChecks(origin, { isProduction: false, fetchImpl });
  assert.ok(issues.some((issue) => issue.includes('legacy domain')));
  assert.ok(issues.some((issue) => issue.includes('production analytics')));
  assert.ok(issues.some((issue) => issue.includes('X-Robots-Tag')));
});

test('runChecks passes a correct dev and production deployment', async () => {
  const dev = 'https://dev.drawordie.app';
  const devIssues = await runChecks(dev, {
    isProduction: false,
    fetchImpl: fakeFetch({
      [`${dev}/`]: { body: DEV_HTML, headers: { 'x-robots-tag': 'noindex, nofollow' } },
      [`${dev}/robots.txt`]: { body: DEV_ROBOTS },
      [`${dev}/sitemap.xml`]: { body: EMPTY_SITEMAP },
    }),
  });
  assert.deepEqual(devIssues, []);

  const prodIssues = await runChecks(PRODUCTION_ORIGIN, {
    isProduction: true,
    fetchImpl: fakeFetch({
      [`${PRODUCTION_ORIGIN}/`]: { body: PROD_HTML },
      [`${PRODUCTION_ORIGIN}/robots.txt`]: { body: PROD_ROBOTS },
      [`${PRODUCTION_ORIGIN}/sitemap.xml`]: { body: PROD_SITEMAP },
    }),
  });
  assert.deepEqual(prodIssues, []);
});
