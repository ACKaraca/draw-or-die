import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RELEASE_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const MANIFEST_ASSIGNMENT_PATTERN = /export const EMBEDDED_RELEASE_SHA = '(?:unknown|[a-f0-9]{40})';/;
const manifestPath = fileURLToPath(new URL('../lib/release-manifest.ts', import.meta.url));

function stampReleaseManifest() {
  const releaseSha = String(process.env.RELEASE_SHA ?? '').trim().toLowerCase();
  if (!RELEASE_SHA_PATTERN.test(releaseSha)) {
    throw new Error('RELEASE_SHA must be a 40-character hexadecimal commit SHA.');
  }

  const manifest = readFileSync(manifestPath, 'utf8');
  if (!MANIFEST_ASSIGNMENT_PATTERN.test(manifest)) {
    throw new Error('Release manifest assignment was not found.');
  }

  const stampedManifest = manifest.replace(
    MANIFEST_ASSIGNMENT_PATTERN,
    `export const EMBEDDED_RELEASE_SHA = '${releaseSha}';`,
  );
  writeFileSync(manifestPath, stampedManifest, 'utf8');
  console.log(`[stamp:release] Embedded release SHA ${releaseSha}.`);
}

try {
  stampReleaseManifest();
} catch (error) {
  console.error('[stamp:release] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
