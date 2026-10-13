#!/usr/bin/env node
// Deployed search-identity check: robots.txt, sitemap.xml, root headers/HTML and (optionally) legacy redirects.
//
//   npm run check:search-identity -- https://dev.drawordie.app
//   npm run check:search-identity -- https://drawordie.app --check-legacy
//   SEARCH_IDENTITY_URL=https://<preview>.vercel.app npm run check:search-identity -- --expect=non-production
//
// Production is expected only for https://drawordie.app unless --expect overrides it. Exits 1 on any finding.
// The constants below mirror lib/site-identity.ts; tests/search-identity/check-search-identity.test.mjs fails on drift.

import { pathToFileURL } from 'node:url';

export const PRODUCTION_ORIGIN = 'https://drawordie.app';
export const LEGACY_HOSTS = ['drawordie.ackaraca.me', 'www.drawordie.app'];
export const PRODUCTION_ANALYTICS_IDS = ['GT-5TCMV7L2', 'G-1159TDRHXC', 'G-53LBVDCHC6'];
export const NON_PUBLIC_SITEMAP_PATTERN =
  /^\/(gallery|community|confessions|peer-review|profile|history|auth|api|shop|references)(\/|$)/;

const REQUEST_TIMEOUT_MS = 15_000;
const LEGACY_PROBE_PATH = '/legal/terms?utm_source=search-identity-check';

export function parseBaseUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? '').trim());
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) {
    throw new Error('Only https URLs (or http://localhost) are accepted.');
  }
  return url.origin;
}

export function findLegacyDomains(text) {
  const lower = String(text ?? '').toLowerCase();
  return LEGACY_HOSTS.filter((host) => lower.includes(host));
}

export function findProductionAnalyticsIds(text) {
  const source = String(text ?? '');
  return PRODUCTION_ANALYTICS_IDS.filter((id) => source.includes(id));
}

function hasNoindex(value) {
  return /\bnoindex\b/i.test(String(value ?? ''));
}

function readMetaRobots(html) {
  const tags = String(html ?? '').match(/<meta\b[^>]*>/gi) ?? [];
  return tags
    .filter((tag) => /\bname=["'](robots|googlebot)["']/i.test(tag))
    .map((tag) => (tag.match(/\bcontent=["']([^"']*)["']/i) ?? [])[1] ?? '');
}

function readCanonical(html) {
  const tags = String(html ?? '').match(/<link\b[^>]*>/gi) ?? [];
  const canonical = tags.find((tag) => /\brel=["']canonical["']/i.test(tag));
  return canonical ? ((canonical.match(/\bhref=["']([^"']*)["']/i) ?? [])[1] ?? null) : null;
}

function robotsDisallowsAll(robotsText) {
  return String(robotsText ?? '')
    .split(/\r?\n/)
    .some((line) => /^\s*disallow\s*:\s*\/\s*(#.*)?$/i.test(line));
}

export function analyzeRobots(robotsText, { isProduction }) {
  const issues = [];
  const sitemapLines = String(robotsText ?? '')
    .split(/\r?\n/)
    .filter((line) => /^\s*sitemap\s*:/i.test(line))
    .map((line) => line.replace(/^\s*sitemap\s*:\s*/i, '').trim());

  if (isProduction) {
    if (robotsDisallowsAll(robotsText)) issues.push('robots.txt: production must not "Disallow: /".');
    if (sitemapLines.length !== 1 || sitemapLines[0] !== `${PRODUCTION_ORIGIN}/sitemap.xml`) {
      issues.push(`robots.txt: expected exactly one "Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml", got ${
        JSON.stringify(sitemapLines)}.`);
    }
  } else {
    if (!robotsDisallowsAll(robotsText)) issues.push('robots.txt: non-production must "Disallow: /".');
    if (sitemapLines.length > 0) issues.push('robots.txt: non-production must not advertise a sitemap.');
  }
  return issues;
}

export function analyzeSitemap(xml, { isProduction }) {
  const issues = [];
  const source = String(xml ?? '');
  const locs = [...source.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => match[1]);

  if (/<sitemapindex\b/i.test(source)) issues.push('sitemap.xml: expected one urlset, found a sitemap index.');

  if (!isProduction) {
    if (locs.length > 0) issues.push(`sitemap.xml: non-production must be empty, found ${locs.length} URL(s).`);
    return issues;
  }

  if (locs.length === 0) issues.push('sitemap.xml: production sitemap has no URLs.');
  if (new Set(locs).size !== locs.length) issues.push('sitemap.xml: duplicate URLs.');
  for (const loc of locs) {
    let url;
    try {
      url = new URL(loc);
    } catch {
      issues.push(`sitemap.xml: invalid URL ${loc}.`);
      continue;
    }
    if (url.origin !== PRODUCTION_ORIGIN) issues.push(`sitemap.xml: off-domain URL ${loc}.`);
    if (NON_PUBLIC_SITEMAP_PATTERN.test(url.pathname)) issues.push(`sitemap.xml: non-public/user-content URL ${loc}.`);
  }
  return issues;
}

export function analyzeRoot({ status, xRobotsTag, html }, { isProduction }) {
  const issues = [];
  if (status < 200 || status >= 300) issues.push(`/: expected 2xx, got ${status}.`);

  const metaRobots = readMetaRobots(html);
  const isMetaNoindex = metaRobots.some(hasNoindex);
  const isHeaderNoindex = hasNoindex(xRobotsTag);
  const canonical = readCanonical(html);

  if (isProduction) {
    if (isHeaderNoindex) issues.push(`/: production sends X-Robots-Tag "${xRobotsTag}".`);
    if (isMetaNoindex) issues.push('/: production renders a noindex robots meta tag.');
    if (canonical && !canonical.startsWith(`${PRODUCTION_ORIGIN}/`) && canonical !== PRODUCTION_ORIGIN) {
      issues.push(`/: canonical ${canonical} is not on ${PRODUCTION_ORIGIN}.`);
    }
  } else {
    if (!isHeaderNoindex) issues.push('/: non-production is missing "X-Robots-Tag: noindex".');
    if (!isMetaNoindex) issues.push('/: non-production is missing a noindex robots meta tag.');
    const leakedIds = findProductionAnalyticsIds(html);
    if (leakedIds.length > 0) issues.push(`/: non-production HTML loads production analytics ${leakedIds.join(', ')}.`);
  }
  return issues;
}

export function analyzeLegacyRedirect({ host, status, location }) {
  const expected = `${PRODUCTION_ORIGIN}${LEGACY_PROBE_PATH}`;
  if (status !== 301 && status !== 308) return [`${host}: expected a permanent redirect, got ${status}.`];
  if (location !== expected) return [`${host}: redirected to ${location}, expected ${expected} in one hop.`];
  return [];
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    redirect: 'manual',
    headers: { 'user-agent': 'draw-or-die-search-identity-check' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: response.status, headers: response.headers, text: await response.text() };
}

export async function runChecks(baseUrl, { isProduction, checkLegacy = false, fetchImpl = fetch }) {
  const origin = parseBaseUrl(baseUrl);
  const issues = [];

  const [root, robotsTxt, sitemapXml] = await Promise.all([
    fetchText(`${origin}/`, fetchImpl),
    fetchText(`${origin}/robots.txt`, fetchImpl),
    fetchText(`${origin}/sitemap.xml`, fetchImpl),
  ]);

  for (const [label, response] of [['/', root], ['robots.txt', robotsTxt], ['sitemap.xml', sitemapXml]]) {
    const legacy = findLegacyDomains(response.text);
    if (legacy.length > 0) issues.push(`${label}: references legacy domain ${legacy.join(', ')}.`);
  }
  if (robotsTxt.status !== 200) issues.push(`robots.txt: expected 200, got ${robotsTxt.status}.`);
  if (sitemapXml.status !== 200) issues.push(`sitemap.xml: expected 200, got ${sitemapXml.status}.`);

  issues.push(...analyzeRobots(robotsTxt.text, { isProduction }));
  issues.push(...analyzeSitemap(sitemapXml.text, { isProduction }));
  issues.push(...analyzeRoot(
    { status: root.status, xRobotsTag: root.headers.get('x-robots-tag'), html: root.text },
    { isProduction },
  ));

  if (checkLegacy) {
    for (const host of LEGACY_HOSTS) {
      try {
        const response = await fetchImpl(`https://${host}${LEGACY_PROBE_PATH}`, {
          redirect: 'manual',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        const location = response.headers.get('location');
        issues.push(...analyzeLegacyRedirect({ host, status: response.status, location }));
      } catch (error) {
        issues.push(`${host}: request failed (${error instanceof Error ? error.message : String(error)}).`);
      }
    }
  }

  return issues;
}

function parseArgs(argv) {
  const options = { url: process.env.SEARCH_IDENTITY_URL ?? '', expect: null, checkLegacy: false };
  for (const arg of argv) {
    if (arg === '--check-legacy') options.checkLegacy = true;
    else if (arg.startsWith('--expect=')) options.expect = arg.slice('--expect='.length);
    else if (!arg.startsWith('--')) options.url = arg;
    else throw new Error(`Unknown option ${arg}`);
  }
  if (options.expect !== null && options.expect !== 'production' && options.expect !== 'non-production') {
    throw new Error('--expect must be "production" or "non-production".');
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.url) throw new Error('Pass the deployment URL as an argument or SEARCH_IDENTITY_URL.');

  const origin = parseBaseUrl(options.url);
  const isProduction = options.expect ? options.expect === 'production' : origin === PRODUCTION_ORIGIN;
  console.log(`[check:search-identity] ${origin} (expecting ${isProduction ? 'production' : 'non-production'})`);

  const issues = await runChecks(origin, { isProduction, checkLegacy: options.checkLegacy });
  if (issues.length > 0) {
    for (const issue of issues) console.error(`  x ${issue}`);
    process.exit(1);
  }
  console.log('  ok robots.txt, sitemap.xml, root headers/metadata and analytics isolation');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[check:search-identity] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
