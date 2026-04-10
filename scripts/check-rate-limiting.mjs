import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredRoutes = [
  'app/api/checkout/route.ts',
  'app/api/checkout/validate-promo/route.ts',
  'app/api/ai-generate/route.ts',
  'app/api/verify-edu/route.ts',
];

const missing = [];

for (const routePath of requiredRoutes) {
  const fullPath = path.join(root, routePath);
  if (!fs.existsSync(fullPath)) {
    missing.push(`${routePath} (dosya yok)`);
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  if (!content.includes('checkRateLimit(')) {
    missing.push(`${routePath} (checkRateLimit yok)`);
  }
}

if (missing.length > 0) {
  console.error('[check:rate-limiting] Dogrulama basarisiz:');
  for (const item of missing) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}

console.log('[check:rate-limiting] Kritik route dosyalarinda rate limiting aktif.');
