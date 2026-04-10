import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Security - Randomness in ID Generation', () => {
  const routePath = path.resolve(process.cwd(), 'app/api/ai-generate/route.ts');

  it('should not use Math.random() for requestId or cookieIdentity in ai-generate route', () => {
    const content = fs.readFileSync(routePath, 'utf8');

    // Check for the specific vulnerable pattern
    const mathRandomUsage = content.includes('Math.random()');
    expect(mathRandomUsage).toBe(false);
  });

  it('should use randomUUID from crypto for requestId and cookieIdentity', () => {
    const content = fs.readFileSync(routePath, 'utf8');

    // Check for randomUUID import
    expect(content).toContain('import { createHash, randomUUID } from \'crypto\';');

    // Check for usage in requestId
    expect(content).toMatch(/const requestId = randomUUID\(\);/);

    // Check for usage in cookieIdentity
    expect(content).toMatch(/const cookieIdentity = existingCookieIdentity \|\| randomUUID\(\);/);
  });
});
