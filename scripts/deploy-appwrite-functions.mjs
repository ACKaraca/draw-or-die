import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'appwrite.config.json');

if (!fs.existsSync(configPath)) {
  console.log('[deploy:appwrite-functions] appwrite.config.json bulunmuyor, adim atlandi.');
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const functions = Array.isArray(config.functions) ? config.functions : [];

if (functions.length === 0) {
  console.log('[deploy:appwrite-functions] appwrite.config.json icinde functions tanimi yok, adim atlandi.');
  console.log('[deploy:appwrite-functions] Once Appwrite Console/CLI ile function olusturup `appwrite pull functions` calistirin.');
  process.exit(0);
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['appwrite', 'push', 'functions'], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
