import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CONFLICT_MARKER = /^(?:<<<<<<<(?: .*)?|=======|>>>>>>>(?: .*)?)$/;

function listTrackedFiles() {
  const output = execFileSync('/usr/bin/git', ['ls-files', '-z'], { encoding: 'buffer' });
  return output
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

const violations = [];

for (const file of listTrackedFiles()) {
  const contents = readFileSync(file);
  if (contents.includes(0)) continue;

  const lines = contents.toString('utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (CONFLICT_MARKER.test(line)) {
      violations.push(`${file}:${index + 1}:${line}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Unresolved merge conflict markers found:');
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('No unresolved merge conflict markers found.');
