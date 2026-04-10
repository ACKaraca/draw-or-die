import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const functionsDir = path.join(root, 'supabase', 'functions');

if (!fs.existsSync(functionsDir)) {
  console.log('[deploy:supabase-functions] supabase/functions bulunmuyor, adim atlandi.');
  process.exit(0);
}

const dirs = fs.readdirSync(functionsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
console.log(`[deploy:supabase-functions] ${dirs.length} function tespit edildi. Gercek deployment harici CI/CD entegrasyonunda calistirilir.`);
process.exit(0);
