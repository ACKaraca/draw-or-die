import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const functionsDir = path.join(root, 'supabase', 'functions');

if (!fs.existsSync(functionsDir)) {
  console.log('[validate:supabase-functions] supabase/functions klasoru bulunmuyor. Bu repoda edge function deploy adimi atlanabilir.');
  process.exit(0);
}

const functionDirs = fs.readdirSync(functionsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());

if (functionDirs.length === 0) {
  console.log('[validate:supabase-functions] function klasoru bos.');
  process.exit(0);
}

const missingEntrypoints = functionDirs
  .map((entry) => path.join(functionsDir, entry.name, 'index.ts'))
  .filter((entryPath) => !fs.existsSync(entryPath));

if (missingEntrypoints.length > 0) {
  console.error('[validate:supabase-functions] Eksik entrypoint dosyalari:');
  for (const missing of missingEntrypoints) {
    console.error(` - ${path.relative(root, missing)}`);
  }
  process.exit(1);
}

console.log(`[validate:supabase-functions] ${functionDirs.length} function dizini dogrulandi.`);
