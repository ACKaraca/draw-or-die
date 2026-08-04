import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(TEST_DIRECTORY, '../..');
const VALIDATOR_PATH = join(REPOSITORY_ROOT, 'scripts/validate-enterprise-audit.mjs');
const FIXTURE_ROOT = join(
  REPOSITORY_ROOT,
  'tests/fixtures/enterprise-audit-validator/valid-repo',
);
const AUDIT_ROOT = 'docs/enterprise-audit';
const PR_ROLLOUT_EVIDENCE = `sha256:${'a'.repeat(64)}`;
const PR_ROLLBACK_EVIDENCE = `sha256:${'b'.repeat(64)}`;

function createFixture(t) {
  const repositoryRoot = mkdtempSync(
    join(tmpdir(), 'enterprise-audit-validator-'),
  );
  cpSync(FIXTURE_ROOT, repositoryRoot, { recursive: true });
  t.after(() => rmSync(repositoryRoot, { recursive: true, force: true }));
  return repositoryRoot;
}

function createProductionAuditFixture(t) {
  const repositoryRoot = mkdtempSync(
    join(tmpdir(), 'enterprise-audit-production-validator-'),
  );
  cpSync(
    join(REPOSITORY_ROOT, AUDIT_ROOT),
    join(repositoryRoot, AUDIT_ROOT),
    { recursive: true },
  );
  t.after(() => rmSync(repositoryRoot, { recursive: true, force: true }));
  return repositoryRoot;
}

function readFixtureFile(repositoryRoot, relativePath) {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

function writeFixtureFile(repositoryRoot, relativePath, content) {
  writeFileSync(join(repositoryRoot, relativePath), content, 'utf8');
}

function replaceFixtureText(repositoryRoot, relativePath, search, replacement) {
  const content = readFixtureFile(repositoryRoot, relativePath);
  assert.ok(
    content.includes(search),
    `Fixture mutation target was not found in ${relativePath}: ${search}`,
  );
  writeFixtureFile(
    repositoryRoot,
    relativePath,
    content.replace(search, replacement),
  );
}

function updateFixtureContract(repositoryRoot, mutateContract) {
  const relativePath = `${AUDIT_ROOT}/VALIDATION-CONTRACT.json`;
  const contract = JSON.parse(readFixtureFile(repositoryRoot, relativePath));
  mutateContract(contract);
  writeFixtureFile(repositoryRoot, relativePath, `${JSON.stringify(contract, null, 2)}\n`);
}

function runValidator(repositoryRoot, options = {}) {
  const repositorySlug = options.repositorySlug ?? 'example/repo';
  const validatorArguments = [VALIDATOR_PATH];
  if (options.useExplicitRoot !== false) {
    validatorArguments.push('--root', repositoryRoot);
  }
  validatorArguments.push('--repository', repositorySlug, '--format', 'json');
  const result = spawnSync(
    process.execPath,
    validatorArguments,
    {
      cwd: options.useExplicitRoot === false ? repositoryRoot : REPOSITORY_ROOT,
      encoding: 'utf8',
    },
  );

  assert.equal(result.signal, null, result.stderr);
  assert.notEqual(result.stdout.trim(), '', 'Validator emitted empty stdout.');

  let output;
  try {
    output = JSON.parse(result.stdout);
  } catch (error) {
    assert.fail(
      `Validator did not emit JSON.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}\n${String(error)}`,
    );
  }

  return {
    output,
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function assertFailsWithCode(t, expectedCode, mutateFixture) {
  const repositoryRoot = createFixture(t);
  mutateFixture(repositoryRoot);
  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 1, result.stdout);
  assert.equal(result.output.ok, false);
  assert.ok(
    result.output.errors.some(({ code }) => code === expectedCode),
    `Expected ${expectedCode}, received:\n${JSON.stringify(result.output.errors, null, 2)}`,
  );
}

function resolveFoundationDecision(repositoryRoot) {
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/DECISION-LOG.md`,
    '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |',
    '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Approved |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Target | Phase 0 exit |',
    '| Target | 2026-08-10 |',
  );
  pinFoundationDecisionRecord(repositoryRoot);
}

function pinFoundationDecisionRecord(repositoryRoot) {
  const recordDigest = calculateFixtureDecisionRecordDigest(repositoryRoot, 'D-001');
  const decisionTableDigest = calculateFixtureTableDigest(
    repositoryRoot,
    `${AUDIT_ROOT}/DECISION-LOG.md`,
    'D',
  );
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.decisionRecords['D-001'] = {
      revision: 1,
      disposition: 'approved',
      allowedBases: ['dev-main'],
      recordDigest,
    };
    contract.decisionTableDigest = decisionTableDigest;
  });
}

function calculateFixtureTableDigest(repositoryRoot, relativePath, prefix) {
  const rows = readFixtureFile(repositoryRoot, relativePath)
    .split(/\r?\n/)
    .filter((line) => new RegExp(`^\\| ${prefix}-\\d{3} \\|`).test(line))
    .map((line) => {
      return line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
    });
  return `sha256:${createHash('sha256').update(rows.map((cells) => JSON.stringify(cells)).join('\n')).digest('hex')}`;
}

function calculateFixtureDecisionRecordDigest(repositoryRoot, decisionId) {
  const decisionLog = readFixtureFile(repositoryRoot, `${AUDIT_ROOT}/DECISION-LOG.md`);
  const lines = decisionLog.split(/\r?\n/);
  const tableLine = lines.find((line) => line.startsWith(`| ${decisionId} |`));
  assert.ok(tableLine, `Missing decision table row: ${decisionId}`);
  const tableCells = tableLine
    .trim()
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
  const start = lines.findIndex((line) => line.startsWith(`### ${decisionId} `));
  assert.notEqual(start, -1, `Missing decision fixture: ${decisionId}`);
  const end = lines.findIndex((line, index) => index > start && /^#{1,3}\s/.test(line));
  const recordText = lines.slice(start, end === -1 ? lines.length : end).join('\n').trim();
  return `sha256:${createHash('sha256')
    .update(`${JSON.stringify(tableCells)}\n${recordText}`)
    .digest('hex')}`;
}

function addFoundationVerification(repositoryRoot, options = {}) {
  const pullRequestNumber = options.pullRequestNumber ?? 1;
  const headSha = options.headSha ?? 'a'.repeat(40);
  const mergeSha = options.mergeSha ?? 'b'.repeat(40);
  const releaseSha = options.releaseSha;
  const rows = [
    '# Foundation verification',
    '',
    '| Evidence | Value |',
    '|---|---|',
    `| Pull request | [#${pullRequestNumber}](https://github.com/example/repo/pull/${pullRequestNumber}) |`,
    `| Head SHA | \`${headSha}\` |`,
    '| Base branch | `dev-main` |',
    `| Merge SHA | \`${mergeSha}\` |`,
    '| Merged at | `2026-08-04T18:00:00Z` |',
    '| Review threads | Resolved |',
    `| Checks | Passed: sha256:${'c'.repeat(64)} |`,
  ];
  if (releaseSha) {
    rows.push(
      `| Release SHA | \`${releaseSha}\` |`,
      `| Acceptance evidence | sha256:${'d'.repeat(64)} |`,
      `| Reconciliation / monitoring | sha256:${'e'.repeat(64)} |`,
      `| Rollout evidence | sha256:${'f'.repeat(64)} |`,
      `| Rollback evidence | sha256:${'1'.repeat(64)} |`,
    );
  }
  writeFixtureFile(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
    `${rows.join('\n')}\n`,
  );

  const contractPath = `${AUDIT_ROOT}/VALIDATION-CONTRACT.json`;
  const contract = JSON.parse(readFixtureFile(repositoryRoot, contractPath));
  contract.declaredCounts.markdownFiles += 1;
  writeFixtureFile(repositoryRoot, contractPath, `${JSON.stringify(contract, null, 2)}\n`);
}

function configureFoundationApprovalGate(repositoryRoot, options = {}) {
  const digest = options.digest ?? 'a'.repeat(64);
  const attestedAt = options.attestedAt ?? '2026-08-04T12:00:00Z';
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Status | Planned |',
    '| Status | Ready |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Decision gates | D-001 |',
    '| Decision gates | Branch approval |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Target | Phase 0 exit |',
    '| Target | 2026-08-10 |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-001 | D-001 | Planned / unset |',
    '| R-001 | Branch approval | Ready; gate `approval:branch`; ' +
      `record \`sha256:${digest}\`; attested by \`QA\`; ` +
      `attested at \`${attestedAt}\` |`,
  );
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.branchDecisionGates['fix/foundation'] = {
      decisions: [],
      requirements: [{ attestor: 'QA', key: 'approval:branch', requiredAt: 'ready' }],
    };
  });
}

function configureFoundationPrOpen(repositoryRoot, options = {}) {
  const rollout = options.rollout ?? PR_ROLLOUT_EVIDENCE;
  const rollback = options.rollback;
  resolveFoundationDecision(repositoryRoot);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Status | Planned |',
    '| Status | PR open |',
  );
  const rollbackEvidence = rollback === null ? '' : `; rollback: ${rollback ?? PR_ROLLBACK_EVIDENCE}`;
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-001 | D-001 | Planned / unset |',
    '| R-001 | D-001 | PR open: [PR #1](https://github.com/example/repo/pull/1), ' +
      `head \`${'a'.repeat(40)}\`; checks: passed; review: complete; ` +
      `rollout: ${rollout}${rollbackEvidence} |`,
  );
}

function configureFoundationDelivery(repositoryRoot, options = {}) {
  const releaseSha = options.releaseSha;
  const lifecycle = releaseSha ? 'Verified' : 'Merged';
  resolveFoundationDecision(repositoryRoot);
  addFoundationVerification(repositoryRoot, { releaseSha });
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Status | Planned |',
    `| Status | ${lifecycle} |`,
  );
  const releaseEvidence = releaseSha ? `, release \`${releaseSha}\`` : '';
  const statePrefix = releaseSha ? 'Verified; merged' : 'Merged';
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-001 | D-001 | Planned / unset |',
    `| R-001 | D-001 | ${statePrefix} to \`dev-main\`: ` +
      '[PR #1](https://github.com/example/repo/pull/1), head `aaaaaaa`, merge `bbbbbbb`' +
      `${releaseEvidence} |`,
  );
}

function configureFoundationVerifyGates(repositoryRoot, options = {}) {
  const lifecycle = options.lifecycle ?? 'Ready';
  const attestedAt = options.attestedAt ?? '2026-08-04T12:00:00Z';
  if (lifecycle === 'Verified') {
    configureFoundationDelivery(repositoryRoot, { releaseSha: 'e'.repeat(40) });
  } else {
    resolveFoundationDecision(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Ready |',
    );
  }
  const decisionGate = 'D-001, signed pilot closeout, and paid renewal/expansion evidence';
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Decision gates | D-001 |',
    `| Decision gates | ${decisionGate} |`,
  );
  const traceabilityPath = `${AUDIT_ROOT}/TRACEABILITY.md`;
  const traceability = readFixtureFile(repositoryRoot, traceabilityPath);
  const traceRow = traceability.split(/\r?\n/).find((line) => line.includes('| R-001 | D-001 |'));
  assert.ok(traceRow, 'Missing foundation traceability row.');
  const gateEvidence =
    `; gate \`evidence:paid-renewal-expansion\`; record \`sha256:${'a'.repeat(64)}\`; ` +
    `attested by \`QA\`; attested at \`${attestedAt}\`; ` +
    `gate \`evidence:signed-pilot-closeout\`; record \`sha256:${'b'.repeat(64)}\`; ` +
    `attested by \`QA\`; attested at \`${attestedAt}\``;
  const updatedTraceRow = traceRow
    .replace('| R-001 | D-001 |', `| R-001 | ${decisionGate} |`)
    .replace(/ \|$/, `${gateEvidence} |`);
  replaceFixtureText(repositoryRoot, traceabilityPath, traceRow, updatedTraceRow);
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.branchDecisionGates['fix/foundation'] = {
      decisions: ['D-001'],
      requirements: [
        { attestor: 'QA', key: 'evidence:paid-renewal-expansion', requiredAt: 'verify' },
        { attestor: 'QA', key: 'evidence:signed-pilot-closeout', requiredAt: 'verify' },
      ],
    };
  });
}

test('accepts the complete valid audit fixture', (t) => {
  const repositoryRoot = createFixture(t);
  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(Object.keys(result.output).sort(), ['errors', 'ok', 'summary']);
  assert.equal(result.output.ok, true);
  assert.deepEqual(result.output.errors, []);
  assert.deepEqual(result.output.summary, {
    markdownFiles: 22,
    branchPlans: 2,
    hardDependencies: 1,
    decisions: 2,
    risks: 2,
  });
});

test('accepts known decision ranges in plans and traceability', (t) => {
  const repositoryRoot = createFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
    '| Decision gates | D-002 |',
    '| Decision gates | D-001–D-002 |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-002 | D-002 | Planned / unset |',
    '| R-002 | D-001–D-002 | Planned / unset |',
  );
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.branchDecisionGates['feat/follow-up'] = {
      decisions: ['D-001', 'D-002'],
      requirements: [],
    };
  });

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.output.ok, true);
  assert.deepEqual(result.output.errors, []);
});

test('ignores references and links inside fenced code, inline code, and HTML comments', (t) => {
  const repositoryRoot = createFixture(t);
  const relativePath = `${AUDIT_ROOT}/README.md`;
  const content = readFixtureFile(repositoryRoot, relativePath);
  const ignoredSyntax = [
    '## Ignored syntax examples',
    '',
    '`D-999 R-999 [missing inline target](./missing-inline.md)`',
    '',
    '```text',
    'D-999 and R-999',
    '[missing fenced target](./missing-fenced.md)',
    '```',
    '',
    '<!-- D-999 R-999 [missing comment target](./missing-comment.md) -->',
  ].join('\n');
  writeFixtureFile(repositoryRoot, relativePath, `${content}\n${ignoredSyntax}\n`);

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.output.ok, true);
  assert.deepEqual(result.output.errors, []);
});

test('does not let a mismatched inline backtick run hide a broken link', (t) => {
  assertFailsWithCode(t, 'BROKEN_LINK', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/README.md`;
    const content = readFixtureFile(repositoryRoot, relativePath);
    writeFixtureFile(
      repositoryRoot,
      relativePath,
      `${content}\n\`\` [broken target](./missing-inline-run.md) \`\`\`\n`,
    );
  });
});

test('does not let an invalid backtick-fence info string hide a broken link', (t) => {
  assertFailsWithCode(t, 'BROKEN_LINK', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/README.md`;
    const content = readFixtureFile(repositoryRoot, relativePath);
    const invalidFence = [
      '```invalid`info',
      '[broken target](./missing-invalid-fence.md)',
      '```',
    ].join('\n');
    writeFixtureFile(repositoryRoot, relativePath, `${content}\n${invalidFence}\n`);
  });
});

test('rejects a branch metadata table hidden inside an HTML comment', (t) => {
  assertFailsWithCode(t, 'METADATA_MISSING', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/branches/00-foundation/README.md`;
    replaceFixtureText(
      repositoryRoot,
      relativePath,
      '| Field | Value |\n',
      '<!--\n| Field | Value |\n',
    );
    replaceFixtureText(
      repositoryRoot,
      relativePath,
      '| Accountable roles | Release engineering + QA |\n',
      '| Accountable roles | Release engineering + QA |\n-->\n',
    );
  });
});

test('rejects a portfolio row hidden inside an HTML comment', (t) => {
  assertFailsWithCode(t, 'PORTFOLIO_PARITY', (repositoryRoot) => {
    const row =
      '| 01 | `feat/follow-up` | P2 | 1 | Standard | [Plan](./01-follow-up/README.md) |\n';
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/README.md`,
      row,
      `<!--\n${row}-->\n`,
    );
  });
});

test('rejects a traceability row hidden inside an HTML comment', (t) => {
  assertFailsWithCode(t, 'TRACEABILITY_MISSING', (repositoryRoot) => {
    const row =
      '| 01 | [`feat/follow-up`](./branches/01-follow-up/README.md) | R-002 | D-002 | Planned / unset |\n';
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      row,
      `<!--\n${row}-->\n`,
    );
  });
});

test('rejects a Mermaid heading and graph hidden inside an HTML comment', (t) => {
  assertFailsWithCode(t, 'MERMAID_DRIFT', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/branches/README.md`;
    replaceFixtureText(
      repositoryRoot,
      relativePath,
      '## Critical dependency graph\n',
      '<!--\n## Critical dependency graph\n',
    );
    replaceFixtureText(
      repositoryRoot,
      relativePath,
      '  b00 --> b01\n```\n',
      '  b00 --> b01\n```\n-->\n',
    );
  });
});

test('rejects an unknown hard dependency', (t) => {
  assertFailsWithCode(t, 'UNKNOWN_DEPENDENCY', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
      '| Depends on | `fix/foundation` |',
      '| Depends on | `fix/missing-foundation` |',
    );
  });
});

test('rejects a plain dependency even when Mermaid and declared counts are coordinated', (t) => {
  assertFailsWithCode(t, 'DEPENDENCY_FORMAT', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
      '| Depends on | `fix/foundation` |',
      '| Depends on | fix/foundation |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/README.md`,
      '  b00 --> b01\n',
      '',
    );
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.declaredCounts.hardDependencies = 0;
    });
  });
});

test('rejects a plain second dependency hidden in an annotation', (t) => {
  assertFailsWithCode(t, 'DEPENDENCY_FORMAT', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
      '| Depends on | `fix/foundation` |',
      '| Depends on | `fix/foundation`; optional feat/follow-up |',
    );
  });
});

test('rejects a dependency cycle', (t) => {
  assertFailsWithCode(t, 'DEPENDENCY_CYCLE', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Depends on | None |',
      '| Depends on | `feat/follow-up` |',
    );
  });
});

test('rejects a broken repository-local Markdown link', (t) => {
  assertFailsWithCode(t, 'BROKEN_LINK', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/README.md`,
      '[Risk register](./RISK-REGISTER.md)',
      '[Risk register](./MISSING-RISK-REGISTER.md)',
    );
  });
});

test('rejects a local Markdown link to a nonexistent anchor', (t) => {
  assertFailsWithCode(t, 'BROKEN_LINK', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/README.md`,
      '[Risk register](./RISK-REGISTER.md)',
      '[Risk register](./RISK-REGISTER.md#missing-register-anchor)',
    );
  });
});

test('rejects a reference-style link without a definition', (t) => {
  assertFailsWithCode(t, 'BROKEN_LINK', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/README.md`;
    const content = readFixtureFile(repositoryRoot, relativePath);
    writeFixtureFile(
      repositoryRoot,
      relativePath,
      `${content}\n[Broken reference][missing-definition]\n`,
    );
  });
});

test('rejects a broken local HTML image source', (t) => {
  assertFailsWithCode(t, 'BROKEN_LINK', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/README.md`;
    const content = readFixtureFile(repositoryRoot, relativePath);
    writeFixtureFile(
      repositoryRoot,
      relativePath,
      `${content}\n<img src="./missing-local-image.png" alt="Missing fixture">\n`,
    );
  });
});

test('rejects a local link that traverses outside the audit package', (t) => {
  assertFailsWithCode(t, 'LINK_TRAVERSAL', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/README.md`,
      '[Risk register](./RISK-REGISTER.md)',
      '[Risk register](../../outside-audit.md)',
    );
  });
});

test('rejects symlinks inside the temporary audit fixture', (t) => {
  assertFailsWithCode(t, 'SYMLINK_NOT_ALLOWED', (repositoryRoot) => {
    symlinkSync(
      'RISK-REGISTER.md',
      join(repositoryRoot, AUDIT_ROOT, 'SYMLINKED-RISK.md'),
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/README.md`,
      '[Risk register](./RISK-REGISTER.md)',
      '[Risk register](./SYMLINKED-RISK.md)',
    );
  });
});

test('rejects a duplicate proposed branch name', (t) => {
  assertFailsWithCode(t, 'DUPLICATE_BRANCH', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/README.md`,
      '| 01 | `feat/follow-up` |',
      '| 01 | `fix/foundation` |',
    );
  });
});

test('rejects an unknown decision gate', (t) => {
  assertFailsWithCode(t, 'UNKNOWN_DECISION', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
      '| Decision gates | D-002 |',
      '| Decision gates | D-999 |',
    );
  });
});

test('rejects coordinated contract, plan, and trace drift to a different known decision', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.branchDecisionGates['fix/guest-account-conversion'].decisions = ['D-005'];
  });
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/05-fix-guest-account-conversion/README.md`,
    '| Decision gates | D-006 |',
    '| Decision gates | D-005 |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-005 | D-006 | Planned / unset |',
    '| R-005 | D-005 | Planned / unset |',
  );

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'GATE_POLICY_DRIFT'));
});

test('rejects a decision gate whose known ID is surrounded by waiver text', (t) => {
  assertFailsWithCode(t, 'TRACEABILITY_DECISIONS', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Decision gates | D-001 |',
      '| Decision gates | D-001 is explicitly waived and not approved |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 is explicitly waived and not approved | Planned / unset |',
    );
  });
});

test('rejects an unknown risk reference', (t) => {
  assertFailsWithCode(t, 'UNKNOWN_RISK', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-002 | D-002 | Planned / unset |',
      '| R-999 | D-002 | Planned / unset |',
    );
  });
});

test('rejects lifecycle drift between a plan and traceability', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-002 | D-002 | Planned / unset |',
      '| R-002 | D-002 | Merged |',
    );
  });
});

test('rejects a Ready plan whose dependency is still Planned', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-002 | D-002 | Planned / unset |',
      '| R-002 | D-002 | Ready |',
    );
  });
});

test('rejects an unresolved Ready target such as TBD', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |',
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Approved |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | Phase 0 exit |',
      '| Target | TBD |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Ready |',
    );
  });
});

test('rejects a calendar-invalid Ready target', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | 2026-08-10 |',
      '| Target | 2026-02-31 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Ready |',
    );
  });
});

test('accepts an approval-only Ready lifecycle with structured approval evidence', (t) => {
  const repositoryRoot = createFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Status | Planned |',
    '| Status | Ready |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Decision gates | D-001 |',
    '| Decision gates | Branch approval |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Target | Phase 0 exit |',
    '| Target | 2026-08-10 |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-001 | D-001 | Planned / unset |',
    '| R-001 | Branch approval | Ready; gate `approval:branch`; ' +
      `record \`sha256:${'a'.repeat(64)}\`; attested by \`QA\`; ` +
      'attested at `2026-08-04T12:00:00Z` |',
  );
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.branchDecisionGates['fix/foundation'] = {
      decisions: [],
      requirements: [{ attestor: 'QA', key: 'approval:branch', requiredAt: 'ready' }],
    };
  });

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.output.ok, true);
  assert.deepEqual(result.output.errors, []);
});

test('rejects an approval-only Ready lifecycle with incomplete approval evidence', (t) => {
  assertFailsWithCode(t, 'GATE_EVIDENCE_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Decision gates | D-001 |',
      '| Decision gates | Branch approval |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | Phase 0 exit |',
      '| Target | 2026-08-10 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | Branch approval | Ready; gate `approval:branch`; ' +
        `record \`sha256:${'a'.repeat(64)}\`; attested by \`QA\` |`,
    );
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.branchDecisionGates['fix/foundation'] = {
        decisions: [],
        requirements: [{ attestor: 'QA', key: 'approval:branch', requiredAt: 'ready' }],
      };
    });
  });
});

test('rejects approval evidence whose approver differs from plan authority', (t) => {
  assertFailsWithCode(t, 'APPROVAL_AUTHORITY_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Decision gates | D-001 |',
      '| Decision gates | Branch approval |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | Phase 0 exit |',
      '| Target | 2026-08-10 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | Branch approval | Ready; gate `approval:branch`; ' +
        `record \`sha256:${'a'.repeat(64)}\`; attested by \`attacker\`; ` +
        'attested at `2026-08-04T12:00:00Z` |',
    );
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.branchDecisionGates['fix/foundation'] = {
        decisions: [],
        requirements: [{ attestor: 'QA', key: 'approval:branch', requiredAt: 'ready' }],
      };
    });
  });
});

test('rejects PR-open evidence that says checks failed and review is absent', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |',
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Approved |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | PR open |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | Phase 0 exit |',
      '| Target | 2026-08-10 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | PR open: [PR #1](https://github.com/example/repo/pull/1), ' +
        `head \`${'a'.repeat(40)}\`; checks failed; review absent |`,
    );
  });
});

test('accepts complete PR-open evidence with distinct rollout and rollback records', (t) => {
  const repositoryRoot = createFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/DECISION-LOG.md`,
    '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |',
    '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Approved |',
  );
  pinFoundationDecisionRecord(repositoryRoot);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Status | Planned |',
    '| Status | PR open |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Target | Phase 0 exit |',
    '| Target | 2026-08-10 |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-001 | D-001 | Planned / unset |',
    '| R-001 | D-001 | PR open: [PR #1](https://github.com/example/repo/pull/1), ' +
      `head \`${'a'.repeat(40)}\`; checks: passed; review: complete; ` +
      `rollout: ${PR_ROLLOUT_EVIDENCE}; rollback: ${PR_ROLLBACK_EVIDENCE} |`,
  );

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.output.ok, true);
  assert.deepEqual(result.output.errors, []);
});

test('rejects otherwise valid PR-open evidence from a foreign repository', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | PR open |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | PR open: [PR #1](https://github.com/foreign/repo/pull/1), ' +
        `head \`${'a'.repeat(40)}\`; checks: passed; review: complete; ` +
        `rollout: ${PR_ROLLOUT_EVIDENCE}; rollback: ${PR_ROLLBACK_EVIDENCE} |`,
    );
  });
});

test('rejects PR-open evidence with an all-zero full head SHA', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | PR open |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | PR open: [PR #1](https://github.com/example/repo/pull/1), ' +
        `head \`${'0'.repeat(40)}\`; checks: passed; review: complete; ` +
        `rollout: ${PR_ROLLOUT_EVIDENCE}; rollback: ${PR_ROLLBACK_EVIDENCE} |`,
    );
  });
});

test('rejects PR-open evidence without a rollback record', (t) => {
  const repositoryRoot = createFixture(t);
  configureFoundationPrOpen(repositoryRoot, { rollback: null });

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'LIFECYCLE_MISMATCH'));
});

test('rejects PR-open evidence that reuses one record for rollout and rollback', (t) => {
  const repositoryRoot = createFixture(t);
  configureFoundationPrOpen(repositoryRoot, {
    rollout: PR_ROLLOUT_EVIDENCE,
    rollback: PR_ROLLOUT_EVIDENCE,
  });

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'LIFECYCLE_MISMATCH'));
});

test('rejects case-variant reuse of one PR-open evidence digest', (t) => {
  const repositoryRoot = createFixture(t);
  configureFoundationPrOpen(repositoryRoot, {
    rollout: PR_ROLLOUT_EVIDENCE,
    rollback: `sha256:${'A'.repeat(64)}`,
  });

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'LIFECYCLE_MISMATCH'));
});

test('rejects a Merged plan without immutable merge evidence', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Merged |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Merged |',
    );
  });
});

test('accepts Merged lifecycle when traceability and verification evidence match', (t) => {
  const repositoryRoot = createFixture(t);
  resolveFoundationDecision(repositoryRoot);
  addFoundationVerification(repositoryRoot);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Status | Planned |',
    '| Status | Merged |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-001 | D-001 | Planned / unset |',
    '| R-001 | D-001 | Merged to `dev-main`: ' +
      '[PR #1](https://github.com/example/repo/pull/1), head `aaaaaaa`, merge `bbbbbbb` |',
  );

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.output.ok, true);
  assert.deepEqual(result.output.errors, []);
});

test('rejects a calendar-invalid Merged-at timestamp with otherwise matching evidence', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    addFoundationVerification(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      '| Merged at | `2026-08-04T18:00:00Z` |',
      '| Merged at | `2026-99-99T99:99:99Z` |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Merged |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Merged to `dev-main`: ' +
        '[PR #1](https://github.com/example/repo/pull/1), head `aaaaaaa`, merge `bbbbbbb` |',
    );
  });
});

test('rejects a mismatched PR across traceability and verification', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    addFoundationVerification(repositoryRoot, { pullRequestNumber: 10 });
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Merged |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Merged to `dev-main`: ' +
        '[PR #1](https://github.com/example/repo/pull/1), head `aaaaaaa`, merge `bbbbbbb` |',
    );
  });
});

test('rejects a mismatched merge SHA across traceability and verification', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    addFoundationVerification(repositoryRoot, { mergeSha: 'd'.repeat(40) });
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Merged |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Merged to `dev-main`: ' +
        '[PR #1](https://github.com/example/repo/pull/1), head `aaaaaaa`, merge `bbbbbbb` |',
    );
  });
});

test('rejects merge evidence whose base differs from the approved plan base', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    addFoundationVerification(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Merged |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      '| Base branch | `dev-main` |',
      '| Base branch | `unprotected-scratch` |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Merged to `unprotected-scratch`: ' +
        '[PR #1](https://github.com/example/repo/pull/1), head `aaaaaaa`, merge `bbbbbbb` |',
    );
  });
});

test('rejects Verified lifecycle when its release SHA differs from verification', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    const traceReleaseSha = 'e'.repeat(40);
    resolveFoundationDecision(repositoryRoot);
    addFoundationVerification(repositoryRoot, { releaseSha: 'f'.repeat(40) });
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Verified |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Verified; merged to `dev-main`: ' +
        '[PR #1](https://github.com/example/repo/pull/1), head `aaaaaaa`, merge `bbbbbbb`, ' +
        `release \`${traceReleaseSha}\` |`,
    );
  });
});

test('rejects a branch plan missing from the portfolio index', (t) => {
  assertFailsWithCode(t, 'PORTFOLIO_PARITY', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/README.md`,
      '| 01 | `feat/follow-up` | P2 | 1 | Standard | [Plan](./01-follow-up/README.md) |\n',
      '',
    );
  });
});

test('rejects an extra portfolio row with malformed ID XX', (t) => {
  assertFailsWithCode(t, 'PORTFOLIO_PARITY', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/branches/README.md`;
    const existingRow =
      '| 01 | `feat/follow-up` | P2 | 1 | Standard | [Plan](./01-follow-up/README.md) |\n';
    const malformedRow =
      '| XX | `feat/follow-up` | P2 | 1 | Standard | [Plan](./01-follow-up/README.md) |\n';
    replaceFixtureText(
      repositoryRoot,
      relativePath,
      existingRow,
      `${existingRow}${malformedRow}`,
    );
  });
});

test('rejects a renamed required audit README', (t) => {
  assertFailsWithCode(t, 'MISSING_FILE', (repositoryRoot) => {
    renameSync(
      join(repositoryRoot, AUDIT_ROOT, 'README.md'),
      join(repositoryRoot, AUDIT_ROOT, 'OVERVIEW.md'),
    );
  });
});

test('rejects Mermaid hard-edge drift', (t) => {
  assertFailsWithCode(t, 'MERMAID_DRIFT', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/README.md`,
      '  b00 --> b01\n',
      '',
    );
  });
});

test('rejects an unapproved operational Mermaid node and edge', (t) => {
  assertFailsWithCode(t, 'MERMAID_DRIFT', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/README.md`,
      '  b00 --> b01\n```\n',
      '  b00 --> b01\n  rogueOps["rogue operation"]\n  b00 --> rogueOps\n```\n',
    );
  });
});

test('rejects missing branch metadata', (t) => {
  assertFailsWithCode(t, 'METADATA_MISSING', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| DRI | Release engineering |\n',
      '',
    );
  });
});

test('rejects duplicate branch metadata', (t) => {
  assertFailsWithCode(t, 'METADATA_DUPLICATE', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| DRI | Release engineering |\n',
      '| DRI | Release engineering |\n| DRI | Product engineering |\n',
    );
  });
});

test('rejects a malformed branch metadata table separator', (t) => {
  assertFailsWithCode(t, 'METADATA_MISSING', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '|---|---|\n',
      '|--|---|\n',
    );
  });
});

test('rejects a missing required branch-plan section', (t) => {
  assertFailsWithCode(t, 'REQUIRED_SECTION_MISSING', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '## Rollback\n',
      '## Recovery\n',
    );
  });
});

test('rejects an unbalanced Markdown fence', (t) => {
  assertFailsWithCode(t, 'UNBALANCED_FENCE', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/README.md`,
      '  b00 --> b01\n```\n',
      '  b00 --> b01\n',
    );
  });
});

test('rejects a Markdown file without a final newline', (t) => {
  assertFailsWithCode(t, 'FINAL_NEWLINE', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/README.md`;
    const content = readFixtureFile(repositoryRoot, relativePath);
    assert.ok(content.endsWith('\n'));
    writeFixtureFile(repositoryRoot, relativePath, content.slice(0, -1));
  });
});

test('rejects a branch omitted from traceability', (t) => {
  assertFailsWithCode(t, 'TRACEABILITY_MISSING', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| 01 | [`feat/follow-up`](./branches/01-follow-up/README.md) | R-002 | D-002 | Planned / unset |\n',
      '',
    );
  });
});

test('rejects an extra traceability row with malformed ID XX', (t) => {
  assertFailsWithCode(t, 'TRACEABILITY_MISSING', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/TRACEABILITY.md`;
    const existingRow =
      '| 01 | [`feat/follow-up`](./branches/01-follow-up/README.md) | R-002 | D-002 | Planned / unset |\n';
    const malformedRow =
      '| XX | [`feat/follow-up`](./branches/01-follow-up/README.md) | R-002 | D-002 | Planned / unset |\n';
    replaceFixtureText(
      repositoryRoot,
      relativePath,
      existingRow,
      `${existingRow}${malformedRow}`,
    );
  });
});

test('rejects declared count drift', (t) => {
  assertFailsWithCode(t, 'COUNT_MISMATCH', (repositoryRoot) => {
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.declaredCounts.branchPlans = 3;
    });
  });
});

test('rejects an emptied required-section contract plus a renamed Rollback section', (t) => {
  assertFailsWithCode(t, 'INVALID_CONTRACT', (repositoryRoot) => {
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.requiredBranchSections = [];
    });
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '## Rollback\n',
      '## Recovery\n',
    );
  });
});

test('rejects a coordinated weakening of decision table columns', (t) => {
  assertFailsWithCode(t, 'INVALID_CONTRACT', (repositoryRoot) => {
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.decisionTableColumns = contract.decisionTableColumns.filter(
        (column) => column !== 'Blocks',
      );
    });
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| ID | Decision required | Recommended default | Blocks | Status |',
      '| ID | Decision required | Recommended default | Status |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '|---|---|---|---|---|',
      '|---|---|---|---|',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |',
      '| D-001 | Release foundation | Establish the protected foundation first | Required |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| D-002 | Follow-up ordering | Start only after the foundation | Follow-up delivery | Required |',
      '| D-002 | Follow-up ordering | Start only after the foundation | Required |',
    );
  });
});

test('rejects a coordinated weakening of risk table columns', (t) => {
  assertFailsWithCode(t, 'INVALID_CONTRACT', (repositoryRoot) => {
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.riskTableColumns = contract.riskTableColumns.filter(
        (column) => column !== 'Permanent control / branch',
      );
    });
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/RISK-REGISTER.md`,
      '| ID | P | Risk and business consequence | Likelihood | Permanent control / branch | Status |',
      '| ID | P | Risk and business consequence | Likelihood | Status |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/RISK-REGISTER.md`,
      '|---|---:|---|---|---|---|',
      '|---|---:|---|---|---|',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/RISK-REGISTER.md`,
      '| R-001 | P1 | The release foundation can drift. | Medium | `fix/foundation` | Open |',
      '| R-001 | P1 | The release foundation can drift. | Medium | Open |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/RISK-REGISTER.md`,
      '| R-002 | P2 | Follow-up work can begin too early. | Low | `feat/follow-up` | Open |',
      '| R-002 | P2 | Follow-up work can begin too early. | Low | Open |',
    );
  });
});

test('rejects a duplicate decision ID', (t) => {
  assertFailsWithCode(t, 'DUPLICATE_DECISION', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/DECISION-LOG.md`;
    replaceFixtureText(
      repositoryRoot,
      relativePath,
      '| D-002 | Follow-up ordering | Start only after the foundation | Follow-up delivery | Required |\n',
      '| D-002 | Follow-up ordering | Start only after the foundation | Follow-up delivery | Required |\n' +
        '| D-002 | Duplicate follow-up | Duplicate decision | Follow-up delivery | Required |\n',
    );
  });
});

test('rejects a duplicate risk ID', (t) => {
  assertFailsWithCode(t, 'DUPLICATE_RISK', (repositoryRoot) => {
    const duplicateRisk =
      '| R-002 | P2 | Duplicate risk. | Low | `feat/follow-up` | Open |\n';
    const relativePath = `${AUDIT_ROOT}/RISK-REGISTER.md`;
    const content = readFixtureFile(repositoryRoot, relativePath);
    writeFixtureFile(repositoryRoot, relativePath, `${content}${duplicateRisk}`);
  });
});

test('rejects an extra decision table row with a malformed ID', (t) => {
  assertFailsWithCode(t, 'DECISION_ROW_INVALID', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/DECISION-LOG.md`;
    const existingRow =
      '| D-002 | Follow-up ordering | Start only after the foundation | Follow-up delivery | Required |\n';
    const malformedRow =
      '| D-XX2 | Malformed decision | Invalid ID must fail | Follow-up delivery | Required |\n';
    replaceFixtureText(
      repositoryRoot,
      relativePath,
      existingRow,
      `${existingRow}${malformedRow}`,
    );
  });
});

test('rejects an extra risk table row with a malformed ID', (t) => {
  assertFailsWithCode(t, 'RISK_ROW_INVALID', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/RISK-REGISTER.md`;
    const existingRow =
      '| R-002 | P2 | Follow-up work can begin too early. | Low | `feat/follow-up` | Open |\n';
    const malformedRow =
      '| R-XX2 | P2 | Malformed risk ID must fail. | Low | `feat/follow-up` | Open |\n';
    replaceFixtureText(
      repositoryRoot,
      relativePath,
      existingRow,
      `${existingRow}${malformedRow}`,
    );
  });
});

test('rejects an orphan risk even when the declared risk count is adjusted', (t) => {
  assertFailsWithCode(t, 'RISK_ORPHAN', (repositoryRoot) => {
    const relativePath = `${AUDIT_ROOT}/RISK-REGISTER.md`;
    const content = readFixtureFile(repositoryRoot, relativePath);
    const orphanRisk =
      '| R-003 | P2 | An orphan risk lacks a branch mapping. | Low | None | Open |\n';
    writeFixtureFile(repositoryRoot, relativePath, `${content}${orphanRisk}`);
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.declaredCounts.risks = 3;
    });
  });
});

test('rejects a decision row with an empty contracted cell', (t) => {
  assertFailsWithCode(t, 'DECISION_ROW_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| D-002 | Follow-up ordering | Start only after the foundation | Follow-up delivery | Required |',
      '| D-002 |  | Start only after the foundation | Follow-up delivery | Required |',
    );
  });
});

test('rejects a risk row with an empty contracted cell', (t) => {
  assertFailsWithCode(t, 'RISK_ROW_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/RISK-REGISTER.md`,
      '| R-002 | P2 | Follow-up work can begin too early. | Low | `feat/follow-up` | Open |',
      '| R-002 | P2 |  | Low | `feat/follow-up` | Open |',
    );
  });
});

test('rejects a known but incorrect traceability risk mapping', (t) => {
  assertFailsWithCode(t, 'TRACEABILITY_RISKS', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-002 | D-002 | Planned / unset |',
      '| R-001 | D-002 | Planned / unset |',
    );
  });
});

test('rejects a negated non-ID approval gate in traceability', (t) => {
  assertFailsWithCode(t, 'TRACEABILITY_DECISIONS', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
      '| Decision gates | D-002 |',
      '| Decision gates | Branch approval |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-002 | D-002 | Planned / unset |',
      '| R-002 | No branch approval | Planned / unset |',
    );
  });
});

test('rejects lifecycle advancement while its recorded decision is unresolved', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | Phase 0 exit |',
      '| Target | 2026-08-10 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Ready |',
    );
  });
});

test('rejects lifecycle advancement after an approval is explicitly revoked', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |',
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | ' +
        'Approved but revoked and no longer valid |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | Phase 0 exit |',
      '| Target | 2026-08-10 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Ready |',
    );
  });
});

test('accepts Ready lifecycle after its recorded decision is approved', (t) => {
  const repositoryRoot = createFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/DECISION-LOG.md`,
    '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |',
    '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | ' +
      'Approved by owner |',
  );
  pinFoundationDecisionRecord(repositoryRoot);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Status | Planned |',
    '| Status | Ready |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Target | Phase 0 exit |',
    '| Target | 2026-08-10 |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-001 | D-001 | Planned / unset |',
    '| R-001 | D-001 | Ready |',
  );

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.output.ok, true);
  assert.deepEqual(result.output.errors, []);
});

test('rejects a decision detail whose canonical table row was removed', (t) => {
  assertFailsWithCode(t, 'UNKNOWN_DECISION', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |\n',
      '',
    );
  });
});

test('rejects a broken audit under the production-style invocation without --root', (t) => {
  const repositoryRoot = createFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/README.md`,
    '[Risk register](./RISK-REGISTER.md)',
    '[Risk register](./missing-production-invocation.md)',
  );

  const result = runValidator(repositoryRoot, { useExplicitRoot: false });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'BROKEN_LINK'));
});

test('rejects a coordinated repository-slug mutation against CLI authority', (t) => {
  const repositoryRoot = createFixture(t);
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.repositorySlug = 'foreign/repository';
  });

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'INVALID_CONTRACT'));
});

test('rejects removal of a canonical specialist deliverable even when counts and contract are coordinated', (t) => {
  assertFailsWithCode(t, 'INVALID_CONTRACT', (repositoryRoot) => {
    rmSync(join(repositoryRoot, AUDIT_ROOT, 'SECURITY-PRIVACY.md'));
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.requiredFiles = contract.requiredFiles.filter((file) => file !== 'SECURITY-PRIVACY.md');
      contract.declaredCounts.markdownFiles -= 1;
    });
  });
});

test('rejects coordinated removal of a supplemental destructive-confirmation gate', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/03a-fix-historical-gallery-remediation/README.md`,
    '| Decision gates | D-004 and explicit destructive confirmation for archive/delete targets |',
    '| Decision gates | D-004 |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-003 | D-004 and explicit destructive confirmation for archive/delete targets | Planned / unset |',
    '| R-003 | D-004 | Planned / unset |',
  );
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.branchDecisionGates['fix/historical-gallery-remediation'].requirements = [];
  });

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'GATE_POLICY_DRIFT'));
});

test('rejects a duplicated decision gate even when plan and trace agree', (t) => {
  assertFailsWithCode(t, 'DECISION_SYNTAX_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Decision gates | D-001 |',
      '| Decision gates | D-001 and D-001 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 and D-001 | Planned / unset |',
    );
  });
});

test('rejects a descending decision range even when plan and trace agree', (t) => {
  assertFailsWithCode(t, 'DECISION_SYNTAX_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
      '| Decision gates | D-002 |',
      '| Decision gates | D-002-D-001 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-002 | D-002 | Planned / unset |',
      '| R-002 | D-002-D-001 | Planned / unset |',
    );
  });
});

test('rejects Ready lifecycle for a decision whose disposition is not planned', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |',
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | ' +
        'Decided by owner; not planned |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '- Disposition: approved',
      '- Disposition: not-planned',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '- Allowed bases: `dev-main`',
      '- Allowed bases: None — no delivery authorization',
    );
    const recordDigest = calculateFixtureDecisionRecordDigest(repositoryRoot, 'D-001');
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.decisionRecords['D-001'] = {
        revision: 1,
        disposition: 'not-planned',
        allowedBases: [],
        recordDigest,
      };
    });
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | Phase 0 exit |',
      '| Target | 2026-08-10 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Ready |',
    );
  });
});

test('rejects contradictory Ready-but-revoked lifecycle text', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready but revoked |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Ready but revoked |',
    );
  });
});

test('rejects future-dated gate attestation evidence', (t) => {
  assertFailsWithCode(t, 'GATE_EVIDENCE_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Decision gates | D-001 |',
      '| Decision gates | Branch approval |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | Phase 0 exit |',
      '| Target | 2026-08-10 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | Branch approval | Ready; gate `approval:branch`; ' +
        `record \`sha256:${'a'.repeat(64)}\`; attested by \`QA\`; ` +
        'attested at `2099-08-04T12:00:00Z` |',
    );
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.branchDecisionGates['fix/foundation'] = {
        decisions: [],
        requirements: [{ attestor: 'QA', key: 'approval:branch', requiredAt: 'ready' }],
      };
    });
  });
});

test('rejects coordinated plan and trace attestor drift away from pinned authority', (t) => {
  assertFailsWithCode(t, 'APPROVAL_AUTHORITY_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Approver | QA |',
      '| Approver | attacker |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Decision gates | D-001 |',
      '| Decision gates | Branch approval |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | Phase 0 exit |',
      '| Target | 2026-08-10 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | Branch approval | Ready; gate `approval:branch`; ' +
        `record \`sha256:${'a'.repeat(64)}\`; attested by \`attacker\`; ` +
        'attested at `2026-08-04T12:00:00Z` |',
    );
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.branchDecisionGates['fix/foundation'] = {
        decisions: [],
        requirements: [{ attestor: 'QA', key: 'approval:branch', requiredAt: 'ready' }],
      };
    });
  });
});

test('rejects a due approval gate whose contract has no pinned attestor', (t) => {
  assertFailsWithCode(t, 'APPROVAL_AUTHORITY_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Decision gates | D-001 |',
      '| Decision gates | Branch approval |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Target | Phase 0 exit |',
      '| Target | 2026-08-10 |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | Branch approval | Ready |',
    );
    updateFixtureContract(repositoryRoot, (contract) => {
      contract.branchDecisionGates['fix/foundation'] = {
        decisions: [],
        requirements: [{ attestor: null, key: 'approval:branch', requiredAt: 'ready' }],
      };
    });
  });
});

test('rejects a resolved decision record with a missing revision', (t) => {
  assertFailsWithCode(t, 'DECISION_RECORD_INVALID', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '- Revision: 1\n',
      '',
    );
  });
});

test('rejects a scoped dev-main decision used for a main-based branch', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/37-chore-enterprise-audit-validation/README.md`,
    '| Base | Protected `dev-main` |',
    '| Base | Protected `main` |',
  );

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'DECISION_SCOPE_MISMATCH'));
});

test('rejects arbitrary prose in the plan lifecycle enum', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready: arbitrary prose |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Ready |',
    );
  });
});

test('rejects rescinded approval prose in the trace lifecycle', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Ready |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Ready: approval rescinded |',
    );
  });
});

test('rejects a misspelled unresolved decision status', (t) => {
  assertFailsWithCode(t, 'DECISION_ROW_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| D-002 | Follow-up ordering | Start only after the foundation | Follow-up delivery | Required |',
      '| D-002 | Follow-up ordering | Start only after the foundation | Follow-up delivery | Requried |',
    );
  });
});

test('rejects drift in a pinned decision summary row', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/DECISION-LOG.md`,
    'One owner plus up to five invited verified members; owner/member roles only',
    'One owner plus five total accounts; administrator/member roles',
  );

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'DECISION_RECORD_INVALID'));
});

test('rejects a pinned decision downgraded to an unresolved status', (t) => {
  assertFailsWithCode(t, 'DECISION_OUTCOME_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Approved |',
      '| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |',
    );
  });
});

test('rejects a future decision date even when its record digest is refreshed', (t) => {
  assertFailsWithCode(t, 'DECISION_RECORD_INVALID', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/DECISION-LOG.md`,
      '- Date: 2026-08-04',
      '- Date: 2099-08-04',
    );
    pinFoundationDecisionRecord(repositoryRoot);
  });
});

test('rejects content drift in a canonical specialist document', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/SECURITY-PRIVACY.md`,
    '# Security and Privacy Program',
    '# Security and Privacy Programme',
  );

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'SPECIALIST_DIGEST_MISMATCH'));
});

test('rejects coordinated dependency removal against the pinned topology', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/37-chore-enterprise-audit-validation/README.md`,
    '| Depends on | `fix/release-build-blockers` |',
    '| Depends on | None |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/README.md`,
    '  b00 --> b37\n',
    '',
  );
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.declaredCounts.hardDependencies -= 1;
  });

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'DEPENDENCY_POLICY_DRIFT'));
});

test('rejects gate evidence older than the audit baseline', (t) => {
  const repositoryRoot = createFixture(t);
  configureFoundationApprovalGate(repositoryRoot, { attestedAt: '1970-01-01T00:00:00Z' });

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'GATE_EVIDENCE_INVALID'));
});

test('rejects a gate evidence digest reused by two branches', (t) => {
  const repositoryRoot = createFixture(t);
  const digest = 'a'.repeat(64);
  configureFoundationApprovalGate(repositoryRoot, { digest });
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
    '| Status | Planned |',
    '| Status | Ready |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
    '| Target | Phase 1 exit |',
    '| Target | 2026-08-10 |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
    '| Decision gates | D-002 |',
    '| Decision gates | Branch approval |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-002 | D-002 | Planned / unset |',
    '| R-002 | Branch approval | Ready; gate `approval:branch`; ' +
      `record \`sha256:${digest}\`; attested by \`Product owner\`; ` +
      'attested at `2026-08-04T12:00:00Z` |',
  );
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.branchDecisionGates['feat/follow-up'] = {
      decisions: [],
      requirements: [{ attestor: 'Product owner', key: 'approval:branch', requiredAt: 'ready' }],
    };
  });

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'GATE_EVIDENCE_INVALID'));
});

test('rejects an unknown branch named as a permanent risk control', (t) => {
  assertFailsWithCode(t, 'RISK_CONTROL_INVALID', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/RISK-REGISTER.md`,
      '| R-002 | P2 | Follow-up work can begin too early. | Low | `feat/follow-up` | Open |',
      '| R-002 | P2 | Follow-up work can begin too early. | Low | `fix/nonexistent-control` | Open |',
    );
  });
});

test('rejects portfolio priority and phase drift from plan metadata', (t) => {
  assertFailsWithCode(t, 'PORTFOLIO_PARITY', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/README.md`,
      '| 01 | `feat/follow-up` | P2 | 1 | Standard | [Plan](./01-follow-up/README.md) |',
      '| 01 | `feat/follow-up` | P0 | 9 | Critical path | [Plan](./01-follow-up/README.md) |',
    );
  });
});

test('rejects portfolio mode drift from the pinned portfolio rows', (t) => {
  assertFailsWithCode(t, 'PORTFOLIO_POLICY_DRIFT', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/README.md`,
      '| 01 | `feat/follow-up` | P2 | 1 | Standard | [Plan](./01-follow-up/README.md) |',
      '| 01 | `feat/follow-up` | P2 | 1 | Critical path | [Plan](./01-follow-up/README.md) |',
    );
  });
});

test('rejects a None blocker that contradicts a hard dependency', (t) => {
  assertFailsWithCode(t, 'DEPENDENCY_BLOCKER_MISMATCH', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
      '| Blocked until | `fix/foundation` is verified |',
      '| Blocked until | None |',
    );
  });
});

test('rejects a Planned branch base outside its resolved decision scope', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/32a-feat-private-team-workspace/README.md`,
    '| Base | Protected `dev-main` |',
    '| Base | Protected `main` |',
  );

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'DECISION_SCOPE_MISMATCH'));
});

test('rejects semantic drift in an unresolved decision row', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/DECISION-LOG.md`,
    'Shared Team Rapido authority',
    'Marketing email color',
  );

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'DECISION_TABLE_POLICY_DRIFT'));
});

test('rejects removal of a reviewed permanent risk control', (t) => {
  assertFailsWithCode(t, 'RISK_TABLE_POLICY_DRIFT', (repositoryRoot) => {
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/RISK-REGISTER.md`,
      '| R-002 | P2 | Follow-up work can begin too early. | Low | `feat/follow-up` | Open |',
      '| R-002 | P2 | Follow-up work can begin too early. | Low | No control assigned | Open |',
    );
  });
});

test('rejects Merged lifecycle when review-thread evidence is absent', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    resolveFoundationDecision(repositoryRoot);
    addFoundationVerification(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      '| Review threads | Resolved |\n',
      '',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Merged |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Merged to `dev-main`: ' +
        '[PR #1](https://github.com/example/repo/pull/1), head `aaaaaaa`, merge `bbbbbbb` |',
    );
  });
});

test('accepts Verified lifecycle with complete acceptance and operating evidence', (t) => {
  const repositoryRoot = createFixture(t);
  const releaseSha = 'e'.repeat(40);
  resolveFoundationDecision(repositoryRoot);
  addFoundationVerification(repositoryRoot, { releaseSha });
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| Status | Planned |',
    '| Status | Verified |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-001 | D-001 | Planned / unset |',
    '| R-001 | D-001 | Verified; merged to `dev-main`: ' +
      '[PR #1](https://github.com/example/repo/pull/1), head `aaaaaaa`, merge `bbbbbbb`, ' +
      `release \`${releaseSha}\` |`,
  );

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.output.ok, true);
  assert.deepEqual(result.output.errors, []);
});

test('rejects Verified lifecycle without reconciliation and monitoring evidence', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    const releaseSha = 'e'.repeat(40);
    resolveFoundationDecision(repositoryRoot);
    addFoundationVerification(repositoryRoot, { releaseSha });
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      `| Reconciliation / monitoring | sha256:${'e'.repeat(64)} |\n`,
      '',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/README.md`,
      '| Status | Planned |',
      '| Status | Verified |',
    );
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '| R-001 | D-001 | Planned / unset |',
      '| R-001 | D-001 | Verified; merged to `dev-main`: ' +
        '[PR #1](https://github.com/example/repo/pull/1), head `aaaaaaa`, merge `bbbbbbb`, ' +
        `release \`${releaseSha}\` |`,
    );
  });
});

test('rejects an all-zero immutable reference in Merged checks evidence', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      `| Checks | Passed: sha256:${'c'.repeat(64)} |`,
      `| Checks | Passed: sha256:${'0'.repeat(64)} |`,
    );
  });
});

test('rejects contradictory duplicate review-thread evidence', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      '| Review threads | Resolved |',
      '| Review threads | Resolved |\n| Review threads | Open |',
    );
  });
});

test('rejects case-variant duplicate review-thread evidence', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      '| Review threads | Resolved |',
      '| Review threads | Resolved |\n| review threads | Open |',
    );
  });
});

test('rejects duplicate immutable merge SHA evidence', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      `| Merge SHA | \`${'b'.repeat(40)}\` |`,
      `| Merge SHA | \`${'b'.repeat(40)}\` |\n| Merge SHA | \`${'f'.repeat(40)}\` |`,
    );
  });
});

test('rejects duplicate Verified-only labels while lifecycle is Merged', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      '| Review threads | Resolved |',
      `| Review threads | Resolved |\n| Release SHA | \`${'d'.repeat(40)}\` |\n` +
        `| Release SHA | \`${'e'.repeat(40)}\` |`,
    );
  });
});

test('rejects duplicate acceptance evidence in a Verified record', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot, { releaseSha: 'e'.repeat(40) });
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      `| Acceptance evidence | sha256:${'d'.repeat(64)} |`,
      `| Acceptance evidence | sha256:${'d'.repeat(64)} |\n` +
        `| Acceptance evidence | sha256:${'2'.repeat(64)} |`,
    );
  });
});

test('rejects reuse of one immutable reference across Verified evidence fields', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot, { releaseSha: 'e'.repeat(40) });
    for (const [label, originalDigest] of [
      ['Reconciliation / monitoring', 'e'],
      ['Rollout evidence', 'f'],
      ['Rollback evidence', '1'],
    ]) {
      replaceFixtureText(
        repositoryRoot,
        `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
        `| ${label} | sha256:${originalDigest.repeat(64)} |`,
        `| ${label} | sha256:${'d'.repeat(64)} |`,
      );
    }
  });
});

test('rejects verify-stage gate evidence recorded while the branch is only Ready', (t) => {
  const repositoryRoot = createFixture(t);
  configureFoundationVerifyGates(repositoryRoot, { lifecycle: 'Ready' });

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'GATE_EVIDENCE_INVALID'));
});

test('rejects Verified gate evidence attested before the recorded merge', (t) => {
  const repositoryRoot = createFixture(t);
  configureFoundationVerifyGates(repositoryRoot, {
    lifecycle: 'Verified',
    attestedAt: '2026-08-04T12:00:00Z',
  });

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'GATE_EVIDENCE_INVALID'));
});

test('rejects unknown labels in the lifecycle evidence table', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      '| Review threads | Resolved |',
      '| Review threads | Resolved |\n| Review status | Open |',
    );
  });
});

test('rejects a contradictory production-promotion evidence label', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      '| Review threads | Resolved |',
      '| Review threads | Resolved |\n| Production promotion | Performed |',
    );
  });
});

test('accepts an unrelated two-column table outside the lifecycle evidence table', (t) => {
  const repositoryRoot = createFixture(t);
  configureFoundationDelivery(repositoryRoot);
  const relativePath = `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`;
  const verification = readFixtureFile(repositoryRoot, relativePath);
  writeFixtureFile(
    repositoryRoot,
    relativePath,
    `${verification}\n## Runtime notes\n\n| Metric | Value |\n|---|---|\n| Validation duration | 10 seconds |\n`,
  );

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.output.ok, true);
  assert.deepEqual(result.output.errors, []);
});

test('rejects a lifecycle evidence table without its exact header and separator', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      '| Evidence | Value |\n|---|---|\n',
      '',
    );
  });
});

test('rejects Merged trace evidence whose PR label and URL disagree', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/TRACEABILITY.md`,
      '[PR #1](https://github.com/example/repo/pull/1)',
      '[PR #999](https://github.com/example/repo/pull/1)',
    );
  });
});

test('rejects Verified table evidence whose PR label and URL disagree', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot, { releaseSha: 'e'.repeat(40) });
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      '| Pull request | [#1](https://github.com/example/repo/pull/1) |',
      '| Pull request | [#999](https://github.com/example/repo/pull/1) |',
    );
  });
});

test('rejects impossible PR number zero in PR-open evidence', (t) => {
  const repositoryRoot = createFixture(t);
  configureFoundationPrOpen(repositoryRoot);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '[PR #1](https://github.com/example/repo/pull/1)',
    '[PR #0](https://github.com/example/repo/pull/0)',
  );

  const result = runValidator(repositoryRoot);

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'LIFECYCLE_MISMATCH'));
});

test('rejects an all-zero commit URL as immutable checks evidence', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      `| Checks | Passed: sha256:${'c'.repeat(64)} |`,
      `| Checks | Passed: https://github.com/example/repo/commit/${'0'.repeat(40)} |`,
    );
  });
});

test('rejects an overlong SHA-256 token as immutable checks evidence', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      `| Checks | Passed: sha256:${'c'.repeat(64)} |`,
      `| Checks | Passed: sha256:${'c'.repeat(65)} |`,
    );
  });
});

test('rejects a malformed GitHub Actions run identifier as immutable evidence', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      `| Checks | Passed: sha256:${'c'.repeat(64)} |`,
      '| Checks | Passed: https://github.com/example/repo/actions/runs/1abc |',
    );
  });
});

test('rejects checks evidence from a foreign GitHub repository', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      `| Checks | Passed: sha256:${'c'.repeat(64)} |`,
      '| Checks | Passed: https://github.com/foreign/repository/actions/runs/1 |',
    );
  });
});

test('rejects a checks commit URL unrelated to the recorded delivery', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    replaceFixtureText(
      repositoryRoot,
      `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`,
      `| Checks | Passed: sha256:${'c'.repeat(64)} |`,
      `| Checks | Passed: https://github.com/example/repo/commit/${'d'.repeat(40)} |`,
    );
  });
});

test('rejects required merge evidence moved outside the scoped Evidence table', (t) => {
  assertFailsWithCode(t, 'LIFECYCLE_MISMATCH', (repositoryRoot) => {
    configureFoundationDelivery(repositoryRoot);
    const relativePath = `${AUDIT_ROOT}/branches/00-foundation/VERIFICATION.md`;
    const requiredRows = [
      '| Pull request | [#1](https://github.com/example/repo/pull/1) |',
      `| Head SHA | \`${'a'.repeat(40)}\` |`,
      '| Base branch | `dev-main` |',
      `| Merge SHA | \`${'b'.repeat(40)}\` |`,
      '| Merged at | `2026-08-04T18:00:00Z` |',
    ];
    let verification = readFixtureFile(repositoryRoot, relativePath);
    for (const row of requiredRows) verification = verification.replace(`${row}\n`, '');
    verification += `\n## Runtime notes\n\n| Metric | Value |\n|---|---|\n${requiredRows.join('\n')}\n`;
    writeFixtureFile(repositoryRoot, relativePath, verification);
  });
});

test('rejects a post-pilot investment decision on a pre-pilot delivery branch', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/35-docs-education-studio-pilot/README.md`,
    '| Decision gates | D-019, D-026, D-028, and D-031 |',
    '| Decision gates | D-019, D-026, D-027, D-028, and D-031 |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-033, R-039, R-040, R-043 | D-019, D-026, D-028, D-031 | Planned / unset |',
    '| R-033, R-039, R-040, R-043 | D-019, D-026, D-027, D-028, D-031 | Planned / unset |',
  );
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.branchDecisionGates['docs/education-studio-pilot'].decisions.splice(2, 0, 'D-027');
  });

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'PILOT_DECISION_DEADLOCK'));
});

test('rejects removal of the successful-pilot decision from institution delivery', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/36a-feat-institution-cohort-roster/README.md`,
    '| Decision gates | D-027, D-028, and D-030 |',
    '| Decision gates | D-028 and D-030 |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-041, R-043, R-044 | D-027, D-028, D-030 | Planned / unset |',
    '| R-041, R-043, R-044 | D-028, D-030 | Planned / unset |',
  );
  updateFixtureContract(repositoryRoot, (contract) => {
    contract.branchDecisionGates['feat/institution-cohort-roster'].decisions = ['D-028', 'D-030'];
  });

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'PILOT_DECISION_DEADLOCK'));
});

test('rejects a vulnerability exception used in place of branch approval', (t) => {
  const repositoryRoot = createProductionAuditFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/11-chore-security-runtime-dependencies/README.md`,
    '| Decision gates | None — branch approval only |',
    '| Decision gates | None — branch approval or time-bounded vulnerability exception |',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/TRACEABILITY.md`,
    '| R-015 | None — branch approval only | Planned / unset |',
    '| R-015 | None — branch approval or time-bounded vulnerability exception | Planned / unset |',
  );

  const result = runValidator(repositoryRoot, { repositorySlug: 'ACKaraca/draw-or-die' });

  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.output.errors.some(({ code }) => code === 'DECISION_SYNTAX_INVALID'));
});

test('emits deterministic, sorted, repository-relative JSON diagnostics', (t) => {
  const repositoryRoot = createFixture(t);
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/README.md`,
    '[Risk register](./RISK-REGISTER.md)',
    '[Risk register](./MISSING-RISK-REGISTER.md)',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/00-foundation/README.md`,
    '| DRI | Release engineering |\n',
    '',
  );
  replaceFixtureText(
    repositoryRoot,
    `${AUDIT_ROOT}/branches/01-follow-up/README.md`,
    '| Decision gates | D-002 |',
    '| Decision gates | D-999 |',
  );

  const firstResult = runValidator(repositoryRoot);
  const secondResult = runValidator(repositoryRoot);

  assert.equal(firstResult.status, 1);
  assert.equal(secondResult.status, 1);
  assert.equal(firstResult.stdout, secondResult.stdout);
  assert.deepEqual(firstResult.output, secondResult.output);
  assert.deepEqual(Object.keys(firstResult.output).sort(), [
    'errors',
    'ok',
    'summary',
  ]);

  const sortedErrors = [...firstResult.output.errors].sort((left, right) =>
    left.code.localeCompare(right.code) ||
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.message.localeCompare(right.message),
  );
  assert.deepEqual(firstResult.output.errors, sortedErrors);

  for (const error of firstResult.output.errors) {
    assert.deepEqual(Object.keys(error).sort(), [
      'code',
      'file',
      'line',
      'message',
    ]);
    assert.equal(typeof error.code, 'string');
    assert.match(error.file, /^docs\/enterprise-audit\//);
    assert.equal(error.file.startsWith('/'), false);
    assert.equal(error.file.includes(repositoryRoot), false);
    assert.ok(Number.isInteger(error.line) && error.line > 0);
    assert.equal(typeof error.message, 'string');
    assert.notEqual(error.message, '');
    assert.equal(error.message.includes(repositoryRoot), false);
  }

  assert.equal(firstResult.stdout.includes(repositoryRoot), false);
});
