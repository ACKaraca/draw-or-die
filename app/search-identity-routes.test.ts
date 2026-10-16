import { headers } from 'next/headers';

import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

jest.mock('next/headers', () => ({ headers: jest.fn() }));

const mockedHeaders = headers as unknown as jest.Mock;
const ORIGINAL_ENV = process.env;
const NON_PUBLIC_PATTERN = /\/(gallery|community|confessions|peer-review|profile|history|auth|api|shop|references)(\/|$)/;

function useHost(host: string): void {
  mockedHeaders.mockResolvedValue({ get: (name: string) => (name === 'host' ? host : null) });
}

function setEnv(overrides: Record<string, string>): void {
  process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_APP_URL: 'https://drawordie.ackaraca.me', ...overrides };
}

afterEach(() => {
  process.env = ORIGINAL_ENV;
  mockedHeaders.mockReset();
});

describe('production robots and sitemap', () => {
  beforeEach(() => {
    setEnv({ NODE_ENV: 'production', VERCEL_ENV: 'production' });
    useHost('drawordie.app');
  });

  it('robots allows crawling, hides private surfaces and points to the single sitemap', async () => {
    const result = await robots();
    expect(result.sitemap).toBe('https://drawordie.app/sitemap.xml');
    expect(result.host).toBe('https://drawordie.app');
    expect(result.rules).toEqual([
      expect.objectContaining({ userAgent: '*', allow: '/', disallow: expect.arrayContaining(['/api/', '/profile']) }),
    ]);
  });

  it('sitemap lists only static public routes on drawordie.app', async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);

    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      const parsed = new URL(url);
      expect(parsed.origin).toBe('https://drawordie.app');
      expect(parsed.pathname).not.toMatch(NON_PUBLIC_PATTERN);
    }
    expect(urls).toContain('https://drawordie.app/');
    expect(JSON.stringify(entries)).not.toContain('ackaraca');
  });
});

describe.each([
  ['dev host', 'dev.drawordie.app', { NODE_ENV: 'production', VERCEL_ENV: 'production' }],
  ['preview host', 'draw-or-die-git-x.vercel.app', { NODE_ENV: 'production', VERCEL_ENV: 'preview' }],
  ['preview build on prod alias', 'drawordie.app', { NODE_ENV: 'production', VERCEL_ENV: 'preview' }],
  ['appwrite dev site', 'drawordie.app', { NODE_ENV: 'production', SITE_ENV: 'development' }],
  ['legacy host', 'drawordie.ackaraca.me', { NODE_ENV: 'production', VERCEL_ENV: 'production' }],
])('non-production robots and sitemap (%s)', (_label, host, env) => {
  beforeEach(() => {
    setEnv(env);
    useHost(host);
  });

  it('robots disallows everything and names no sitemap', async () => {
    const result = await robots();
    expect(result.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(result.sitemap).toBeUndefined();
  });

  it('sitemap is empty', async () => {
    await expect(sitemap()).resolves.toEqual([]);
  });
});
