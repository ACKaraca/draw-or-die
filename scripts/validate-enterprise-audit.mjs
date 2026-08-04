import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';

const AUDIT_RELATIVE_PATH = 'docs/enterprise-audit';
const CONTRACT_FILE = 'VALIDATION-CONTRACT.json';
const DEFAULT_REPOSITORY_SLUG = 'ACKaraca/draw-or-die';
const AUDIT_BASELINE_TIMESTAMP = '2026-08-04T00:00:00Z';
const PORTFOLIO_FILE = 'branches/README.md';
const TRACEABILITY_FILE = 'TRACEABILITY.md';
const DECISION_FILE = 'DECISION-LOG.md';
const RISK_FILE = 'RISK-REGISTER.md';
const BRANCH_NAME_PATTERN = /^(?:feat|fix|chore|refactor|docs)\/[a-z0-9][a-z0-9-]*$/;
const BRANCH_NAME_SOURCE = '(?:feat|fix|chore|refactor|docs)\\/[a-z0-9][a-z0-9-]*';
const DEPENDENCY_LIST_PATTERN = new RegExp(
  `^\`${BRANCH_NAME_SOURCE}\`(?:, \`${BRANCH_NAME_SOURCE}\`)*` +
    `(?:(?:; |, D-\\d{3}\\b| plus )[^\`]+|, D-\\d{3})?$`,
);
const NO_DEPENDENCY_PATTERN = /^None(?:$| for [^`]+$)/;
const REFERENCE_RANGE_PATTERN = /\b([DR])-(\d{3})\s*[–—-]\s*(?:\1-)?(\d{3})\b/g;
const REFERENCE_PATTERN = /\b[DR]-\d{3}\b/g;
const CANONICAL_BRANCH_METADATA = [
  'Priority / phase',
  'Status',
  'DRI',
  'Approver',
  'Target',
  'Decision gates',
  'Blocked until',
  'Effort / delivery risk',
  'Base',
  'Depends on',
  'Accountable roles',
];
const CANONICAL_BRANCH_SECTIONS = [
  'Outcome',
  'Evidence',
  'Scope',
  'Non-goals',
  'Acceptance criteria',
  'Approval and migration boundary',
  'Rollout',
  'Rollback',
  'Metrics and required artifacts',
];
const CANONICAL_DECISION_COLUMNS = [
  'ID',
  'Decision required',
  'Recommended default',
  'Blocks',
  'Status',
];
const CANONICAL_RISK_COLUMNS = [
  [
    'ID',
    'P',
    'Risk and business consequence',
    'Likelihood',
    'Permanent control / branch',
    'Status',
  ],
  [
    'ID',
    'P',
    'Risk and business consequence',
    'Likelihood',
    'Primary evidence',
    'Permanent control / branch',
    'Status',
  ],
];
const CANONICAL_REQUIRED_FILES = [
  'AI-DATA-STRATEGY.md',
  'AUDIT-METHOD.md',
  DECISION_FILE,
  'EMERGENCY-CHANGE-PROTOCOL.md',
  'EVIDENCE-BASELINE.md',
  'EXECUTIVE-BRIEF.md',
  'MARKETING-GTM.md',
  'METRICS-EXPERIMENTATION.md',
  'MONETIZATION-STRATEGY.md',
  'P0-CONTAINMENT-RUNBOOK.md',
  'PRODUCT-STRATEGY.md',
  'QUALITY-RELIABILITY.md',
  'README.md',
  'REVIEW-PROVENANCE.md',
  RISK_FILE,
  'ROADMAP.md',
  'SECURITY-PRIVACY.md',
  'TECHNOLOGY-ARCHITECTURE.md',
  TRACEABILITY_FILE,
  PORTFOLIO_FILE,
];
const CANONICAL_SPECIALIST_FILES = [
  'AI-DATA-STRATEGY.md',
  'AUDIT-METHOD.md',
  'EMERGENCY-CHANGE-PROTOCOL.md',
  'EVIDENCE-BASELINE.md',
  'EXECUTIVE-BRIEF.md',
  'MARKETING-GTM.md',
  'METRICS-EXPERIMENTATION.md',
  'MONETIZATION-STRATEGY.md',
  'P0-CONTAINMENT-RUNBOOK.md',
  'PRODUCT-STRATEGY.md',
  'QUALITY-RELIABILITY.md',
  'REVIEW-PROVENANCE.md',
  'ROADMAP.md',
  'SECURITY-PRIVACY.md',
  'TECHNOLOGY-ARCHITECTURE.md',
];
const CANONICAL_POLICY_DIGEST = '26f3667197b455a779bb8360b52398a4fd097822b18d87b58b7ae2eb12cb971b';
const DECISION_GATE_ALIASES = new Map([
  ['branch approval', [{ key: 'approval:branch', requiredAt: 'ready' }]],
  [
    'none — branch and per-migration approval only',
    [
      { key: 'approval:branch', requiredAt: 'ready' },
      { key: 'approval:migration', requiredAt: 'operation' },
    ],
  ],
  [
    'none — branch approval and emergency-change approval only',
    [
      { key: 'approval:branch', requiredAt: 'ready' },
      { key: 'approval:emergency-change', requiredAt: 'operation' },
    ],
  ],
  [
    'none — branch approval only',
    [{ key: 'approval:branch', requiredAt: 'ready' }],
  ],
  [
    'none — branch approval plus event-specific incident/change record',
    [
      { key: 'approval:branch', requiredAt: 'ready' },
      { key: 'evidence:event-change-record', requiredAt: 'operation' },
    ],
  ],
  [
    'none — branch approval plus verified production domain/redirect ownership',
    [
      { key: 'approval:branch', requiredAt: 'ready' },
      { key: 'evidence:domain-redirect-ownership', requiredAt: 'ready' },
    ],
  ],
  [
    'none — incident/change approval and live hold inventory required',
    [
      { key: 'approval:incident-change', requiredAt: 'ready' },
      { key: 'evidence:live-hold-inventory', requiredAt: 'ready' },
    ],
  ],
]);
const DECISION_GATE_SUFFIXES = [
  {
    text: ' and explicit destructive confirmation for archive/delete targets',
    requirements: [{ key: 'approval:destructive-confirmation', requiredAt: 'operation' }],
  },
  {
    text: ' plus research consent, storage, recruitment, and claims review',
    requirements: [{ key: 'approval:research-protocol', requiredAt: 'ready' }],
  },
  {
    text: ', signed pilot closeout, and paid renewal/expansion evidence',
    requirements: [
      { key: 'evidence:paid-renewal-expansion', requiredAt: 'verify' },
      { key: 'evidence:signed-pilot-closeout', requiredAt: 'verify' },
    ],
  },
];
const DECISION_ATOM_SOURCE = 'D-\\d{3}(?:[–—-](?:D-)?\\d{3})?';
const DECISION_LIST_PATTERN = new RegExp(
  `^${DECISION_ATOM_SOURCE}(?:(?:,\\s*(?:and\\s+)?|\\s+and\\s+)${DECISION_ATOM_SOURCE})*$`,
);
const RESOLVED_DECISION_STATUSES = new Set([
  'Approved',
  'Approved by owner',
  'Approved for `dev-main` recovery/validator; `main` protection pending',
  'Decided by owner',
  'Implemented on `dev-main`; production release pending',
]);
const RECORDED_DECISION_STATUSES = new Set([
  ...RESOLVED_DECISION_STATUSES,
  'Decided by owner; not planned',
]);
const DECISION_STATUSES = new Set([
  'Recommended',
  'Required',
  'Required now',
  ...RECORDED_DECISION_STATUSES,
]);
const DECISION_RECORD_FIELDS = [
  'Date',
  'Owner',
  'Revision',
  'Disposition',
  'Allowed bases',
  'Decision',
  'Context and evidence',
  'Alternatives rejected',
  'Consequences and risks',
  'Review/expiry date',
  'Linked branch/PR',
];
const DECISION_DISPOSITIONS = new Set(['approved', 'implemented', 'not-planned']);
const GATE_REQUIREMENT_KEYS = new Set([
  'approval:branch',
  'approval:destructive-confirmation',
  'approval:emergency-change',
  'approval:incident-change',
  'approval:migration',
  'approval:research-protocol',
  'evidence:domain-redirect-ownership',
  'evidence:event-change-record',
  'evidence:live-hold-inventory',
  'evidence:paid-renewal-expansion',
  'evidence:signed-pilot-closeout',
]);
const GATE_REQUIREMENT_STAGES = new Set(['ready', 'merge', 'verify', 'operation']);
const LIFECYCLE_RANK = new Map([
  ['Planned', 0],
  ['Ready', 1],
  ['PR open', 2],
  ['Merged', 3],
  ['Verified', 4],
]);
const REQUIREMENT_STAGE_RANK = new Map([
  ['ready', 1],
  ['merge', 3],
  ['verify', 4],
]);
const UNRESOLVED_OWNER_FIELD_PATTERN = /\b(?:UNASSIGNED|UNSET|NOT STARTED|TBD|TBC|SOMETIME|UNKNOWN|PENDING)\b/i;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const VERIFICATION_EVIDENCE_LABELS = new Set([
  'acceptance evidence',
  'base branch',
  'checks',
  'head sha',
  'merge sha',
  'merged at',
  'pull request',
  'reconciliation / monitoring',
  'release sha',
  'review threads',
  'rollback evidence',
  'rollout evidence',
]);
const PRE_PILOT_BRANCHES = [
  'docs/education-studio-pilot',
  'feat/education-pilot-cohort-controls',
  'docs/education-pilot-evidence',
];
const POST_PILOT_INSTITUTION_BRANCHES = [
  'feat/institution-foundation',
  'feat/institution-cohort-roster',
  'feat/institution-billing-rapido',
  'feat/institution-educator-reporting',
  'feat/institution-recovery-offboarding',
];
const GATE_EVIDENCE_SUFFIX_SOURCE =
  '(?:; gate `[^`]+`; record `sha256:[0-9a-f]{64}`; attested by `[^`]+`;' +
  ' attested at `\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z`)*';

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseEvidenceTable(text) {
  const values = new Map();
  const duplicates = new Set();
  const unknown = new Set();
  let isInEvidenceTable = false;
  let hasSeparator = false;
  let tableCount = 0;
  let isStructureValid = true;
  for (const line of text.split('\n')) {
    const cells = splitTableRow(line);
    if (arraysEqual(cells ?? [], ['Evidence', 'Value'])) {
      tableCount += 1;
      isInEvidenceTable = true;
      hasSeparator = false;
      continue;
    }
    if (!isInEvidenceTable) continue;
    if (isTableSeparator(cells, 2)) {
      if (hasSeparator) isStructureValid = false;
      hasSeparator = true;
      continue;
    }
    if (!line.trim() || !cells || cells.length !== 2) {
      isInEvidenceTable = false;
      continue;
    }
    if (!hasSeparator) isStructureValid = false;
    const label = cells[0].replace(/\s+/g, ' ').trim().toLowerCase();
    if (!VERIFICATION_EVIDENCE_LABELS.has(label)) unknown.add(label);
    if (values.has(label)) duplicates.add(label);
    else values.set(label, cells[1]);
  }
  return {
    duplicates,
    isStructureValid: isStructureValid && tableCount === 1 && hasSeparator,
    unknown,
    values,
  };
}

function extractImmutableEvidenceReference(value) {
  const digest = value.match(/sha256:([0-9a-f]{64})(?![0-9a-f])/i)?.[1] ?? '';
  if (digest && !/^0{64}$/i.test(digest)) return `sha256:${digest.toLowerCase()}`;
  const workflowRun = value.match(
    /https:\/\/github\.com\/[^)\s]+\/actions\/runs\/([1-9]\d*)(?=[)\s?#/]|$)/i,
  );
  if (workflowRun) return workflowRun[0].toLowerCase();
  const commit = value.match(
    /https:\/\/github\.com\/[^)\s]+\/commit\/([0-9a-f]{40})(?=[)\s?#/]|$)/i,
  );
  if (commit && !/^0{40}$/i.test(commit[1])) return commit[0].toLowerCase();
  return '';
}

function hasImmutableEvidenceReference(value) {
  return Boolean(extractImmutableEvidenceReference(value));
}

function hasRepositoryBoundChecksEvidence(value, repositorySlug, allowedCommitShas) {
  const reference = extractImmutableEvidenceReference(value);
  if (!reference) return false;
  if (reference.startsWith('sha256:')) return true;

  const repositoryPrefix = `https://github.com/${repositorySlug.toLowerCase()}`;
  if (reference.startsWith(`${repositoryPrefix}/actions/runs/`)) return true;

  const commitSha = reference.match(
    new RegExp(`^${escapeRegExp(repositoryPrefix)}/commit/([0-9a-f]{40})$`),
  )?.[1];
  return Boolean(commitSha && allowedCommitShas.has(commitSha));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function calculateDecisionRecordDigest(tableCells, recordText) {
  return `sha256:${createHash('sha256')
    .update(`${stableJson(tableCells)}\n${recordText}`)
    .digest('hex')}`;
}

function calculateTableDigest(rows) {
  const canonicalRows = rows.map((cells) => stableJson(cells)).join('\n');
  return `sha256:${createHash('sha256').update(canonicalRows).digest('hex')}`;
}

function calculatePolicyDigest(contract) {
  const policy = {
    allowedOperationalEdges: contract.allowedOperationalEdges,
    branchDecisionGates: contract.branchDecisionGates,
    branchRiskControls: contract.branchRiskControls,
    declaredCounts: contract.declaredCounts,
    decisionTableDigest: contract.decisionTableDigest,
    decisionRecords: contract.decisionRecords,
    dependencyGraphDigest: contract.dependencyGraphDigest,
    portfolioDigest: contract.portfolioDigest,
    requiredFiles: contract.requiredFiles,
    specialistDocumentDigests: contract.specialistDocumentDigests,
    riskTableDigest: contract.riskTableDigest,
    unmappedRisks: contract.unmappedRisks,
  };
  return createHash('sha256').update(stableJson(policy)).digest('hex');
}

function createPullRequestEvidencePattern(repositorySlug) {
  return new RegExp(
    [
      `^PR open: \\[PR #([1-9]\\d*)\\]\\(https:\\/\\/github\\.com\\/${escapeRegExp(repositorySlug)}`,
      '\\/pull\\/([1-9]\\d*)\\), head `([0-9a-f]{40})`; checks: (?:passed|green);',
      ' review: (?:approved|complete)',
      '; rollout: (sha256:[0-9a-f]{64}); rollback: (sha256:[0-9a-f]{64})',
      `${GATE_EVIDENCE_SUFFIX_SOURCE}$`,
    ].join(''),
    'i',
  );
}

function createMergedEvidencePattern(repositorySlug) {
  const pullRequestPrefix =
    `\\[PR #([1-9]\\d*)\\]\\(https:\\/\\/github\\.com\\/${escapeRegExp(repositorySlug)}` +
    '\\/pull\\/([1-9]\\d*)\\)';
  return new RegExp(
    [
      '^Merged to `(dev-main|main)`: ',
      pullRequestPrefix,
      ', head `([0-9a-f]{7,40})`, merge `([0-9a-f]{7,40})`',
      '(?:; production not promoted)?',
      `${GATE_EVIDENCE_SUFFIX_SOURCE}$`,
    ].join(''),
    'i',
  );
}

function createVerifiedEvidencePattern(repositorySlug) {
  const pullRequestPrefix =
    `\\[PR #([1-9]\\d*)\\]\\(https:\\/\\/github\\.com\\/${escapeRegExp(repositorySlug)}` +
    '\\/pull\\/([1-9]\\d*)\\)';
  return new RegExp(
    [
      '^Verified; merged to `(dev-main|main)`: ',
      pullRequestPrefix,
      ', head `([0-9a-f]{7,40})`, merge `([0-9a-f]{7,40})`, release `([0-9a-f]{40})`',
      `${GATE_EVIDENCE_SUFFIX_SOURCE}$`,
    ].join(''),
    'i',
  );
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isPastOrPresentIsoDate(value) {
  if (!isValidIsoDate(value)) return false;
  return value <= new Date().toISOString().slice(0, 10);
}

function isValidUtcTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === `${value.slice(0, -1)}.000Z`;
}

function isPastOrPresentUtcTimestamp(value) {
  if (!isValidUtcTimestamp(value)) return false;
  return Date.parse(value) <= Date.now() + 5 * 60 * 1000;
}

function isValidGitSha(value) {
  return /^[0-9a-f]{40}$/i.test(value) && !/^0{40}$/.test(value);
}

function isValidGitShaPrefix(value) {
  return /^[0-9a-f]{7,40}$/i.test(value) && !/^0+$/.test(value);
}

function extractApprovedBaseBranch(value) {
  return value.match(/^(?:Protected(?: green)?|Existing(?: remote)?)\s+`(dev-main|main)`(?:\s|$)/)?.[1] ?? '';
}

function parseArguments(argv) {
  let root = process.cwd();
  let format = 'text';
  let repositorySlug = DEFAULT_REPOSITORY_SLUG;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') {
      const value = argv[index + 1];
      if (!value) throw new Error('--root requires a path.');
      root = path.resolve(value);
      index += 1;
      continue;
    }
    if (argument === '--format') {
      const value = argv[index + 1];
      if (value !== 'text' && value !== 'json') throw new Error('--format must be text or json.');
      format = value;
      index += 1;
      continue;
    }
    if (argument === '--repository') {
      const value = argv[index + 1];
      if (!value || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
        throw new Error('--repository must be an owner/name slug.');
      }
      repositorySlug = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return { root, format, repositorySlug };
}

function relativePath(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function createReporter(root) {
  const errors = [];

  return {
    add(code, file, line, message) {
      errors.push({
        code,
        file: relativePath(root, file),
        line,
        message,
      });
    },
    sorted() {
      return [...errors].sort((left, right) => {
        return (
          compareText(left.code, right.code) ||
          compareText(left.file, right.file) ||
          left.line - right.line ||
          compareText(left.message, right.message)
        );
      });
    },
  };
}

function readUtf8File(file, reporter) {
  let buffer;
  try {
    buffer = readFileSync(file);
  } catch {
    reporter.add('MISSING_FILE', file, 1, 'Required file is missing or unreadable.');
    return '';
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    reporter.add('INVALID_UTF8', file, 1, 'UTF-8 byte order marks are not allowed.');
  }

  let contents = '';
  try {
    contents = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    reporter.add('INVALID_UTF8', file, 1, 'File is not valid UTF-8.');
    return '';
  }

  if (contents.includes('\r')) {
    const line = contents.slice(0, contents.indexOf('\r')).split('\n').length;
    reporter.add('CRLF_NOT_ALLOWED', file, line, 'Use LF line endings.');
  }
  if (!contents.endsWith('\n') || contents.endsWith('\n\n')) {
    reporter.add('FINAL_NEWLINE', file, Math.max(1, contents.split('\n').length), 'File must end with one newline.');
  }

  return contents;
}

function walkMarkdownFiles(directory, reporter) {
  const files = [];

  function visit(current) {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true }).sort((left, right) => compareText(left.name, right.name));
    } catch {
      reporter.add('MISSING_FILE', current, 1, 'Audit directory is missing or unreadable.');
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        reporter.add('SYMLINK_NOT_ALLOWED', fullPath, 1, 'Symlinks are not allowed in the audit package.');
      } else if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  visit(directory);
  return files;
}

function maskInlineCode(line) {
  const characters = line.split('');
  let index = 0;

  while (index < line.length) {
    if (line[index] !== '`') {
      index += 1;
      continue;
    }

    let delimiterLength = 1;
    while (line[index + delimiterLength] === '`') delimiterLength += 1;
    const delimiter = '`'.repeat(delimiterLength);
    let closing = -1;
    let searchFrom = index + delimiterLength;
    while (searchFrom < line.length) {
      const candidate = line.indexOf(delimiter, searchFrom);
      if (candidate === -1) break;
      const hasAdjacentBacktick =
        line[candidate - 1] === '`' || line[candidate + delimiterLength] === '`';
      if (!hasAdjacentBacktick) {
        closing = candidate;
        break;
      }
      searchFrom = candidate + delimiterLength;
    }
    if (closing === -1) {
      index += delimiterLength;
      continue;
    }
    for (let cursor = index; cursor < closing + delimiterLength; cursor += 1) characters[cursor] = ' ';
    index = closing + delimiterLength;
  }

  return characters.join('');
}

function analyzeMarkdown(file, contents, reporter) {
  const lines = contents.split('\n');
  const commentMaskedLines = [];
  const structuralLines = [];
  const proseLines = [];
  const fencedBlocks = [];
  let fence = null;
  let isInComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (fence) {
      const closingMatch = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      commentMaskedLines.push(line);
      structuralLines.push('');
      proseLines.push('');
      if (
        closingMatch &&
        closingMatch[1][0] === fence.character &&
        closingMatch[1].length >= fence.length
      ) {
        fencedBlocks.push({ ...fence, end: index });
        fence = null;
      }
      continue;
    }

    let cursor = 0;
    let masked = '';
    while (cursor < line.length) {
      if (isInComment) {
        const end = line.indexOf('-->', cursor);
        if (end === -1) {
          masked += ' '.repeat(line.length - cursor);
          cursor = line.length;
        } else {
          masked += ' '.repeat(end + 3 - cursor);
          cursor = end + 3;
          isInComment = false;
        }
      } else {
        const start = line.indexOf('<!--', cursor);
        if (start === -1) {
          masked += line.slice(cursor);
          cursor = line.length;
        } else {
          masked += line.slice(cursor, start);
          isInComment = true;
          cursor = start;
        }
      }
    }
    commentMaskedLines.push(masked);

    const fenceMatch = masked.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    const fenceInfo = fenceMatch?.[2].trim() ?? '';
    const isValidFence = fenceMatch && !(fenceMatch[1][0] === '`' && fenceInfo.includes('`'));
    if (isValidFence) {
      fence = {
        character: fenceMatch[1][0],
        length: fenceMatch[1].length,
        line: index + 1,
        start: index,
        info: fenceInfo,
      };
      structuralLines.push('');
      proseLines.push('');
      continue;
    }

    structuralLines.push(masked);
    proseLines.push(maskInlineCode(masked));
  }

  if (fence) {
    reporter.add('UNBALANCED_FENCE', file, fence.line, 'Fenced code block is not closed with the same marker.');
  }
  if (isInComment) {
    reporter.add('UNBALANCED_COMMENT', file, lines.length, 'HTML comment is not closed.');
  }

  return { lines, commentMaskedLines, structuralLines, proseLines, fencedBlocks };
}

function extractLinkTargets(line) {
  const targets = [];
  let searchFrom = 0;

  while (searchFrom < line.length) {
    const opening = line.indexOf('](', searchFrom);
    if (opening === -1) break;
    let cursor = opening + 2;
    let depth = 1;
    let escaped = false;
    while (cursor < line.length && depth > 0) {
      const character = line[cursor];
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '(') {
        depth += 1;
      } else if (character === ')') {
        depth -= 1;
      }
      cursor += 1;
    }
    if (depth !== 0) break;
    targets.push(line.slice(opening + 2, cursor - 1).trim());
    searchFrom = cursor;
  }

  return targets;
}

function parseLinkDestination(rawTarget) {
  if (!rawTarget) return '';
  if (rawTarget.startsWith('<')) {
    const closing = rawTarget.indexOf('>');
    return closing === -1 ? rawTarget : rawTarget.slice(1, closing);
  }

  let destination = '';
  let escaped = false;
  for (const character of rawTarget) {
    if (escaped) {
      destination += character;
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (/\s/.test(character)) {
      break;
    } else {
      destination += character;
    }
  }
  return destination;
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function hasExactCase(target, root) {
  const relative = path.relative(root, target);
  if (!relative || relative === '.') return true;
  let current = root;
  for (const segment of relative.split(path.sep)) {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return false;
    }
    if (!entries.includes(segment)) return false;
    current = path.join(current, segment);
  }
  return true;
}

function containsSymlink(target, root) {
  const relative = path.relative(root, target);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) return true;
    } catch {
      return false;
    }
  }
  return false;
}

function normalizeReferenceLabel(label) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function headingSlug(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-');
}

function buildAnchorSet(document) {
  const anchors = new Set();
  const slugCounts = new Map();
  for (const line of document.structuralLines) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      const base = headingSlug(heading[1]);
      if (base) {
        const count = slugCounts.get(base) ?? 0;
        anchors.add(count === 0 ? base : `${base}-${count}`);
        slugCounts.set(base, count + 1);
      }
    }
    for (const match of line.matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/gi)) {
      anchors.add(match[1]);
    }
  }
  return anchors;
}

function validateLinkDestination(
  rawTarget,
  sourceFile,
  line,
  auditRoot,
  markdownByFile,
  anchorCache,
  reporter,
) {
  const destination = parseLinkDestination(rawTarget);
  if (!destination) return;
  if (/^[a-z][a-z0-9+.-]*:/i.test(destination) || destination.startsWith('//')) return;

  const hashIndex = destination.indexOf('#');
  const rawPath = (hashIndex === -1 ? destination : destination.slice(0, hashIndex)).split('?')[0];
  const rawFragment = hashIndex === -1 ? '' : destination.slice(hashIndex + 1);
  let decodedPath;
  let fragment;
  try {
    decodedPath = decodeURIComponent(rawPath);
    fragment = decodeURIComponent(rawFragment);
  } catch {
    reporter.add('BROKEN_LINK', sourceFile, line, 'Local link has invalid percent encoding.');
    return;
  }
  if (path.isAbsolute(decodedPath)) {
    reporter.add('LINK_TRAVERSAL', sourceFile, line, 'Absolute local links are not allowed.');
    return;
  }
  const resolved = decodedPath ? path.resolve(path.dirname(sourceFile), decodedPath) : sourceFile;
  if (!isWithin(auditRoot, resolved)) {
    reporter.add('LINK_TRAVERSAL', sourceFile, line, 'Local link escapes the enterprise-audit package.');
    return;
  }
  if (!existsSync(resolved) || !hasExactCase(resolved, auditRoot)) {
    reporter.add('BROKEN_LINK', sourceFile, line, 'Local link target does not exist with exact path casing.');
    return;
  }
  if (containsSymlink(resolved, auditRoot)) {
    reporter.add('SYMLINK_NOT_ALLOWED', sourceFile, line, 'Local link resolves through a symlink.');
    return;
  }
  if (!fragment) return;
  const targetDocument = markdownByFile.get(resolved);
  if (!targetDocument) {
    reporter.add('BROKEN_LINK', sourceFile, line, 'Local fragment target is not a Markdown document.');
    return;
  }
  if (!anchorCache.has(resolved)) anchorCache.set(resolved, buildAnchorSet(targetDocument));
  if (!anchorCache.get(resolved).has(fragment)) {
    reporter.add('BROKEN_LINK', sourceFile, line, 'Local Markdown fragment does not exist.');
  }
}

function validateLocalLinks(file, proseLines, auditRoot, markdownByFile, reporter) {
  const definitions = new Map();
  const anchorCache = new Map();
  for (let index = 0; index < proseLines.length; index += 1) {
    const definition = proseLines[index].match(
      /^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|(?:\\.|[^\s])+)(?:\s+.*)?$/,
    );
    if (definition) {
      const label = normalizeReferenceLabel(definition[1]);
      if (definitions.has(label)) {
        reporter.add('BROKEN_LINK', file, index + 1, 'Reference-style link label is duplicated.');
      } else {
        definitions.set(label, { target: definition[2], line: index + 1 });
      }
    }
  }

  for (const definition of definitions.values()) {
    validateLinkDestination(
      definition.target,
      file,
      definition.line,
      auditRoot,
      markdownByFile,
      anchorCache,
      reporter,
    );
  }

  for (let index = 0; index < proseLines.length; index += 1) {
    const line = proseLines[index];
    for (const rawTarget of extractLinkTargets(line)) {
      validateLinkDestination(rawTarget, file, index + 1, auditRoot, markdownByFile, anchorCache, reporter);
    }
    for (const match of line.matchAll(/!?\[([^\]]+)\]\[([^\]]*)\]/g)) {
      const label = normalizeReferenceLabel(match[2] || match[1]);
      const definition = definitions.get(label);
      if (!definition) {
        reporter.add('BROKEN_LINK', file, index + 1, 'Reference-style link definition is missing.');
      }
    }
    for (const match of line.matchAll(/<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
      validateLinkDestination(match[1], file, index + 1, auditRoot, markdownByFile, anchorCache, reporter);
    }
    for (const match of line.matchAll(/<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
      validateLinkDestination(match[1], file, index + 1, auditRoot, markdownByFile, anchorCache, reporter);
    }
  }
}

function splitTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const cells = [];
  let cell = '';
  let escaped = false;
  let codeDelimiterLength = 0;

  for (let index = 1; index < trimmed.length - 1; index += 1) {
    const character = trimmed[index];
    if (escaped) {
      cell += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      cell += character;
      escaped = true;
      continue;
    }
    if (character === '`') {
      let runLength = 1;
      while (trimmed[index + runLength] === '`') runLength += 1;
      if (codeDelimiterLength === 0) codeDelimiterLength = runLength;
      else if (codeDelimiterLength === runLength) codeDelimiterLength = 0;
      cell += '`'.repeat(runLength);
      index += runLength - 1;
      continue;
    }
    if (character === '|' && codeDelimiterLength === 0) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

function isTableSeparator(cells, expectedLength) {
  return (
    cells?.length === expectedLength &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell))
  );
}

function parseMetadata(file, lines, reporter, requiredFields) {
  const headerIndex = lines.findIndex((line) => {
    const cells = splitTableRow(line);
    return cells?.length === 2 && cells[0] === 'Field' && cells[1] === 'Value';
  });
  const values = new Map();
  if (headerIndex === -1) {
    for (const field of requiredFields) {
      reporter.add('METADATA_MISSING', file, 1, `Missing branch metadata field: ${field}.`);
    }
    return values;
  }
  const separator = splitTableRow(lines[headerIndex + 1] ?? '');
  if (!isTableSeparator(separator, 2)) {
    reporter.add('METADATA_MISSING', file, headerIndex + 2, 'Branch metadata table separator is malformed.');
  }

  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = splitTableRow(lines[index]);
    if (!cells || cells.length !== 2) break;
    const [field, value] = cells;
    if (!field || !value) {
      reporter.add('METADATA_MISSING', file, index + 1, 'Metadata fields and values must not be empty.');
      continue;
    }
    if (values.has(field)) {
      reporter.add('METADATA_DUPLICATE', file, index + 1, `Duplicate branch metadata field: ${field}.`);
      continue;
    }
    values.set(field, { value, line: index + 1 });
  }

  for (const field of requiredFields) {
    if (!values.has(field)) {
      reporter.add('METADATA_MISSING', file, headerIndex + 1, `Missing branch metadata field: ${field}.`);
    }
  }
  for (const [field, entry] of values) {
    if (!requiredFields.includes(field)) {
      reporter.add('METADATA_UNKNOWN', file, entry.line, `Unknown branch metadata field: ${field}.`);
    }
  }
  return values;
}

function parseSections(file, proseLines, reporter, requiredSections) {
  const headings = [];
  for (let index = 0; index < proseLines.length; index += 1) {
    const match = proseLines[index].match(/^##\s+(.+?)\s*$/);
    if (match) headings.push({ name: match[1], line: index + 1, index });
  }

  for (const section of requiredSections) {
    const matches = headings.filter((heading) => heading.name === section);
    if (matches.length === 0) {
      reporter.add('REQUIRED_SECTION_MISSING', file, 1, `Missing required section: ${section}.`);
      continue;
    }
    if (matches.length > 1) {
      reporter.add('REQUIRED_SECTION_MISSING', file, matches[1].line, `Required section is duplicated: ${section}.`);
    }
    const heading = matches[0];
    const nextHeading = headings.find((candidate) => candidate.index > heading.index);
    const end = nextHeading?.index ?? proseLines.length;
    const content = proseLines.slice(heading.index + 1, end).join('\n').trim();
    if (!content) {
      reporter.add('REQUIRED_SECTION_MISSING', file, heading.line, `Required section is empty: ${section}.`);
    }
  }
}

function findFirstHeading(proseLines) {
  for (const line of proseLines) {
    const match = line.match(/^#\s+(.+?)\s*$/);
    if (match) return match[1];
  }
  return null;
}

function extractReferences(text, prefix) {
  const references = new Set();
  for (const match of text.matchAll(REFERENCE_PATTERN)) {
    if (match[0].startsWith(`${prefix}-`)) references.add(match[0]);
  }
  for (const match of text.matchAll(REFERENCE_RANGE_PATTERN)) {
    if (match[1] !== prefix) continue;
    const start = Number(match[2]);
    const end = Number(match[3]);
    if (start > end || end - start > 999) continue;
    for (let value = start; value <= end; value += 1) {
      references.add(`${prefix}-${String(value).padStart(3, '0')}`);
    }
  }
  return references;
}

function parsePortfolio(file, lines, reporter) {
  const entries = [];
  let isInPortfolio = false;
  let hasHeader = false;
  let hasSeparator = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === '## Portfolio') {
      isInPortfolio = true;
      continue;
    }
    if (isInPortfolio && lines[index].startsWith('## ')) break;
    if (!isInPortfolio) continue;
    if (!lines[index].trim()) continue;
    const cells = splitTableRow(lines[index]);
    if (cells?.[0] === '#') {
      if (hasHeader) reporter.add('PORTFOLIO_PARITY', file, index + 1, 'Portfolio table header is duplicated.');
      hasHeader = true;
      if (!arraysEqual(cells, ['#', 'Proposed branch', 'P', 'Phase', 'Mode', 'Plan'])) {
        reporter.add('PORTFOLIO_PARITY', file, index + 1, 'Portfolio table header is malformed.');
      }
      continue;
    }
    if (isTableSeparator(cells, 6)) {
      if (!hasHeader || hasSeparator) {
        reporter.add('PORTFOLIO_PARITY', file, index + 1, 'Portfolio table separator is misplaced.');
      }
      hasSeparator = true;
      continue;
    }
    if (!hasHeader || !hasSeparator) {
      reporter.add('PORTFOLIO_PARITY', file, index + 1, 'Portfolio content appears before its table header.');
      continue;
    }
    if (!cells || cells.length !== 6 || !/^\d+[A-Z]?$/.test(cells[0] ?? '')) {
      reporter.add('PORTFOLIO_PARITY', file, index + 1, 'Portfolio data row is malformed.');
      continue;
    }
    const name = cells[1]?.match(/`([^`]+)`/)?.[1];
    const planTarget = cells[5]?.match(/\]\(([^)]+)\)/)?.[1];
    if (!name || !planTarget) {
      reporter.add('PORTFOLIO_PARITY', file, index + 1, 'Portfolio row must contain a branch name and plan link.');
      continue;
    }
    if (!/^P[0-3]$/.test(cells[2]) || !/^\d+$/.test(cells[3]) || !cells[4]) {
      reporter.add('PORTFOLIO_PARITY', file, index + 1, 'Portfolio priority, phase, or mode is malformed.');
    }
    entries.push({
      id: cells[0],
      name,
      priority: cells[2],
      phase: cells[3],
      mode: cells[4],
      planTarget,
      line: index + 1,
    });
  }

  if (!hasHeader || !hasSeparator) {
    reporter.add('PORTFOLIO_PARITY', file, 1, 'Portfolio table header or separator is missing.');
  }

  const seenIds = new Set();
  const seenNames = new Set();
  const seenTargets = new Set();
  for (const entry of entries) {
    if (seenIds.has(entry.id) || seenNames.has(entry.name) || seenTargets.has(entry.planTarget)) {
      reporter.add('DUPLICATE_BRANCH', file, entry.line, 'Portfolio branch ID, name, and plan path must be unique.');
    }
    seenIds.add(entry.id);
    seenNames.add(entry.name);
    seenTargets.add(entry.planTarget);
  }
  return entries;
}

function parseBranchPlans(auditRoot, contract, reporter, markdownByFile) {
  const branchRoot = path.join(auditRoot, 'branches');
  const plans = [];
  let entries = [];
  try {
    entries = readdirSync(branchRoot, { withFileTypes: true }).sort((left, right) => {
      return compareText(left.name, right.name);
    });
  } catch {
    reporter.add('MISSING_FILE', branchRoot, 1, 'Branch plan directory is missing.');
    return plans;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(branchRoot, entry.name, 'README.md');
    if (!existsSync(file)) {
      reporter.add('PORTFOLIO_PARITY', file, 1, 'Branch plan directory must contain README.md.');
      continue;
    }
    const document = markdownByFile.get(file);
    if (!document) continue;
    const metadata = parseMetadata(
      file,
      document.structuralLines,
      reporter,
      contract.requiredBranchMetadata,
    );
    parseSections(file, document.proseLines, reporter, contract.requiredBranchSections);
    const name = findFirstHeading(document.proseLines);
    if (!name || !BRANCH_NAME_PATTERN.test(name)) {
      reporter.add('PORTFOLIO_PARITY', file, 1, 'Branch plan H1 must be a valid proposed branch name.');
    }
    const idMatch = entry.name.match(/^(\d+[a-z]?)-/);
    plans.push({
      id: idMatch ? idMatch[1].toUpperCase() : '',
      directory: entry.name,
      file,
      name: name ?? '',
      metadata,
      dependencies: [],
    });
  }

  const names = new Set();
  for (const plan of plans) {
    if (names.has(plan.name)) {
      reporter.add('DUPLICATE_BRANCH', plan.file, 1, `Duplicate branch plan name: ${plan.name}.`);
    }
    names.add(plan.name);
  }
  return plans;
}

function validatePortfolioParity(portfolioFile, portfolio, plans, reporter) {
  const byName = new Map(plans.map((plan) => [plan.name, plan]));
  const portfolioNames = new Set(portfolio.map((entry) => entry.name));

  for (const entry of portfolio) {
    const plan = byName.get(entry.name);
    if (!plan) {
      reporter.add('PORTFOLIO_PARITY', portfolioFile, entry.line, `Portfolio branch has no plan: ${entry.name}.`);
      continue;
    }
    const linkedFile = path.resolve(path.dirname(portfolioFile), entry.planTarget);
    if (entry.id !== plan.id || linkedFile !== plan.file) {
      reporter.add(
        'PORTFOLIO_PARITY',
        portfolioFile,
        entry.line,
        `Portfolio ID or path does not match: ${entry.name}.`,
      );
    }
    const priorityPhase = plan.metadata
      .get('Priority / phase')
      ?.value.match(/^(P[0-3])(?:\s+closure)?\s+\/\s+.*?\bPhase\s+(\d+)\b/);
    if (!priorityPhase || entry.priority !== priorityPhase[1] || entry.phase !== priorityPhase[2]) {
      reporter.add(
        'PORTFOLIO_PARITY',
        portfolioFile,
        entry.line,
        `Portfolio priority or phase differs from the plan: ${entry.name}.`,
      );
    }
  }
  for (const plan of plans) {
    if (!portfolioNames.has(plan.name)) {
      reporter.add('PORTFOLIO_PARITY', plan.file, 1, `Branch plan is missing from the portfolio: ${plan.name}.`);
    }
  }
}

function validatePortfolioDigest(portfolio, contractFile, expectedDigest, reporter) {
  const canonicalRows = portfolio
    .map(({ id, name, priority, phase, mode, planTarget }) => {
      return stableJson({ id, mode, name, phase, planTarget, priority });
    })
    .join('\n');
  const actualDigest = `sha256:${createHash('sha256').update(canonicalRows).digest('hex')}`;
  if (actualDigest !== expectedDigest) {
    reporter.add('PORTFOLIO_POLICY_DRIFT', contractFile, 1, 'Portfolio rows differ from the reviewed policy.');
  }
}

function validateDependencies(plans, reporter) {
  const byName = new Map(plans.map((plan) => [plan.name, plan]));
  const edges = new Set();

  for (const plan of plans) {
    const dependsOn = plan.metadata.get('Depends on');
    if (!dependsOn) continue;
    const branchLikeDependencies = [
      ...dependsOn.value.matchAll(new RegExp(BRANCH_NAME_SOURCE, 'g')),
    ].map((match) => match[0]);
    const quotedDependencies = [...dependsOn.value.matchAll(/`([^`]+)`/g)]
      .map((match) => match[1])
      .filter((dependency) => BRANCH_NAME_PATTERN.test(dependency));
    const hasMalformedDependency =
      (!NO_DEPENDENCY_PATTERN.test(dependsOn.value) && !DEPENDENCY_LIST_PATTERN.test(dependsOn.value)) ||
      !arraysEqual(branchLikeDependencies, quotedDependencies);
    if (hasMalformedDependency) {
      reporter.add(
        'DEPENDENCY_FORMAT',
        plan.file,
        dependsOn.line,
        'Depends on must be None or an exact comma-separated list of backticked branch names.',
      );
    }
    const seen = new Set();
    for (const match of dependsOn.value.matchAll(/`([^`]+)`/g)) {
      const dependency = match[1];
      if (!BRANCH_NAME_PATTERN.test(dependency)) continue;
      if (!byName.has(dependency)) {
        reporter.add('UNKNOWN_DEPENDENCY', plan.file, dependsOn.line, `Unknown branch dependency: ${dependency}.`);
        continue;
      }
      if (dependency === plan.name) {
        reporter.add('DEPENDENCY_CYCLE', plan.file, dependsOn.line, 'A branch cannot depend on itself.');
        continue;
      }
      if (seen.has(dependency)) {
        reporter.add('DUPLICATE_DEPENDENCY', plan.file, dependsOn.line, `Duplicate dependency: ${dependency}.`);
        continue;
      }
      seen.add(dependency);
      plan.dependencies.push(dependency);
      edges.add(`${dependency}->${plan.name}`);
    }
    const blockedUntil = plan.metadata.get('Blocked until');
    if (plan.dependencies.length > 0 && /^(?:None|No dependencies?)\b/i.test(blockedUntil?.value ?? '')) {
      reporter.add(
        'DEPENDENCY_BLOCKER_MISMATCH',
        plan.file,
        blockedUntil?.line ?? dependsOn.line,
        'Blocked until cannot waive declared hard dependencies.',
      );
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(name, trail) {
    if (visiting.has(name)) {
      const cycleStart = trail.indexOf(name);
      const cycle = [...trail.slice(cycleStart), name];
      reporter.add('DEPENDENCY_CYCLE', byName.get(name).file, 1, `Dependency cycle: ${cycle.join(' -> ')}.`);
      return;
    }
    if (visited.has(name)) return;
    visiting.add(name);
    const plan = byName.get(name);
    for (const dependency of [...plan.dependencies].sort(compareText)) visit(dependency, [...trail, name]);
    visiting.delete(name);
    visited.add(name);
  }
  for (const name of [...byName.keys()].sort(compareText)) visit(name, []);

  return edges;
}

function validateDependencyGraphDigest(edges, contractFile, expectedDigest, reporter) {
  const canonicalEdges = [...edges].sort(compareText).join('\n');
  const actualDigest = `sha256:${createHash('sha256').update(canonicalEdges).digest('hex')}`;
  if (actualDigest !== expectedDigest) {
    reporter.add('DEPENDENCY_POLICY_DRIFT', contractFile, 1, 'Dependency topology differs from the reviewed policy.');
  }
}

function parseIdTable(
  file,
  lines,
  startHeading,
  endHeading,
  prefix,
  duplicateCode,
  expectedColumns,
  expectedTableDigest,
  reporter,
) {
  const ids = [];
  const rows = [];
  let isInside = false;
  let hasHeader = false;
  let hasSeparator = false;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === startHeading) {
      isInside = true;
      continue;
    }
    if (isInside && lines[index] === endHeading) break;
    if (!isInside) continue;
    if (!lines[index].trim()) continue;
    const cells = splitTableRow(lines[index]);
    if (cells?.[0] === 'ID') {
      if (hasHeader) {
        reporter.add(
          `${prefix === 'D' ? 'DECISION' : 'RISK'}_TABLE_INVALID`,
          file,
          index + 1,
          'Canonical table header is duplicated.',
        );
      }
      hasHeader = true;
      if (
        cells.length !== expectedColumns.length ||
        cells.some((cell, cellIndex) => cell !== expectedColumns[cellIndex])
      ) {
        reporter.add(
          `${prefix === 'D' ? 'DECISION' : 'RISK'}_TABLE_INVALID`,
          file,
          index + 1,
          'Table columns differ from the validation contract.',
        );
      }
      continue;
    }
    if (isTableSeparator(cells, expectedColumns.length)) {
      if (!hasHeader || hasSeparator) {
        reporter.add(
          `${prefix === 'D' ? 'DECISION' : 'RISK'}_TABLE_INVALID`,
          file,
          index + 1,
          'Canonical table separator is misplaced.',
        );
      }
      hasSeparator = true;
      continue;
    }
    if (!hasHeader || !hasSeparator || !cells || !new RegExp(`^${prefix}-\\d{3}$`).test(cells[0] ?? '')) {
      reporter.add(
        `${prefix === 'D' ? 'DECISION' : 'RISK'}_ROW_INVALID`,
        file,
        index + 1,
        `${prefix} table contains malformed content.`,
      );
      continue;
    }
    if (cells.length !== expectedColumns.length || cells.some((cell) => !cell)) {
      reporter.add(
        `${prefix === 'D' ? 'DECISION' : 'RISK'}_ROW_INVALID`,
        file,
        index + 1,
        `${prefix} table rows must contain every contracted value.`,
      );
    }
    if (prefix === 'R' && !/^P[0-3]$/.test(cells[1] ?? '')) {
      reporter.add('RISK_ROW_INVALID', file, index + 1, 'Risk priority must be P0, P1, P2, or P3.');
    }
    if (prefix === 'R' && !/^(?:Open|Contained|Controlled|Accepted)(?:\s|—|-|$)/.test(cells.at(-1) ?? '')) {
      reporter.add('RISK_ROW_INVALID', file, index + 1, 'Risk status is outside the supported lifecycle.');
    }
    if (prefix === 'R') {
      const controlIndex = expectedColumns.indexOf('Permanent control / branch');
      const controlValue = cells[controlIndex] ?? '';
      const controls = [...controlValue.matchAll(new RegExp(`\`(${BRANCH_NAME_SOURCE})\``, 'g'))].map(
        (match) => match[1],
      );
      rows.push({ id: cells[0], file, line: index + 1, controls, cells });
    }
    ids.push({ id: cells[0], line: index + 1 });
  }

  if (!hasHeader || !hasSeparator) {
    reporter.add(`${prefix === 'D' ? 'DECISION' : 'RISK'}_TABLE_MISSING`, file, 1, 'Canonical table is missing.');
  }

  const seen = new Set();
  for (const entry of ids) {
    if (seen.has(entry.id)) reporter.add(duplicateCode, file, entry.line, `Duplicate ${prefix} ID: ${entry.id}.`);
    seen.add(entry.id);
  }
  const numericIds = ids.map((entry) => Number(entry.id.slice(2)));
  for (let index = 1; index < numericIds.length; index += 1) {
    if (numericIds[index] <= numericIds[index - 1]) {
      reporter.add(
        `${prefix === 'D' ? 'DECISION' : 'RISK'}_ORDER`,
        file,
        ids[index].line,
        `${prefix} IDs must be ascending.`,
      );
    }
  }
  if (calculateTableDigest(rows.map(({ cells }) => cells)) !== expectedTableDigest) {
    reporter.add('RISK_TABLE_POLICY_DRIFT', file, 1, 'Risk table differs from the reviewed policy.');
  }
  return { ids: seen, rows };
}

function validateRiskControlReferences(riskRegistry, plans, branchRiskControls, reporter) {
  const planNames = new Set(plans.map((plan) => plan.name));
  for (const row of riskRegistry.rows) {
    const seen = new Set();
    for (const branch of row.controls) {
      if (seen.has(branch)) {
        reporter.add('RISK_CONTROL_INVALID', row.file, row.line, `Risk control branch is duplicated: ${branch}.`);
      }
      seen.add(branch);
      if (!planNames.has(branch)) {
        reporter.add('RISK_CONTROL_INVALID', row.file, row.line, `Risk control branch is unknown: ${branch}.`);
        continue;
      }
      if (!(branchRiskControls[branch] ?? []).includes(row.id)) {
        reporter.add(
          'RISK_CONTROL_INVALID',
          row.file,
          row.line,
          `Risk control branch mapping is inconsistent: ${row.id} -> ${branch}.`,
        );
      }
    }
  }
}

function validateEducationDecisionSequencing(contractFile, branchDecisionGates, reporter) {
  for (const branch of PRE_PILOT_BRANCHES) {
    const decisions = branchDecisionGates[branch]?.decisions;
    if (Array.isArray(decisions) && decisions.includes('D-027')) {
      reporter.add(
        'PILOT_DECISION_DEADLOCK',
        contractFile,
        1,
        `Pre-pilot delivery cannot require the post-pilot investment decision: ${branch}.`,
      );
    }
  }
  for (const branch of POST_PILOT_INSTITUTION_BRANCHES) {
    const decisions = branchDecisionGates[branch]?.decisions;
    if (Array.isArray(decisions) && !decisions.includes('D-027')) {
      reporter.add(
        'PILOT_DECISION_DEADLOCK',
        contractFile,
        1,
        `Institution delivery must retain the successful-pilot investment decision: ${branch}.`,
      );
    }
  }
}

function parseDecisionIds(file, lines, expectedColumns, expectedTableDigest, decisionRecords, reporter) {
  const tableIds = [];
  const headingIds = [];
  let isInPrimaryTable = false;
  let hasPrimaryTable = false;
  let hasPrimarySeparator = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (isInPrimaryTable && lines[index].startsWith('## ')) isInPrimaryTable = false;
    const cells = splitTableRow(lines[index]);
    if (cells?.[0] === 'ID' && cells[1] === 'Decision required') {
      if (hasPrimaryTable) {
        reporter.add('DECISION_TABLE_INVALID', file, index + 1, 'The canonical decision table is duplicated.');
      }
      isInPrimaryTable = true;
      hasPrimaryTable = true;
      if (
        cells.length !== expectedColumns.length ||
        cells.some((cell, cellIndex) => cell !== expectedColumns[cellIndex])
      ) {
        reporter.add('DECISION_TABLE_INVALID', file, index + 1, 'Table columns differ from the validation contract.');
      }
      continue;
    }
    if (isInPrimaryTable && isTableSeparator(cells, expectedColumns.length)) {
      if (hasPrimarySeparator) {
        reporter.add('DECISION_TABLE_INVALID', file, index + 1, 'Decision table separator is duplicated.');
      }
      hasPrimarySeparator = true;
      continue;
    }
    if (isInPrimaryTable && lines[index].trim()) {
      if (!hasPrimarySeparator || !cells || !/^D-\d{3}$/.test(cells[0] ?? '')) {
        reporter.add('DECISION_ROW_INVALID', file, index + 1, 'Decision table contains malformed content.');
        continue;
      }
      if (cells.length !== expectedColumns.length || cells.some((cell) => !cell)) {
        reporter.add(
          'DECISION_ROW_INVALID',
          file,
          index + 1,
          'Decision table rows must contain every contracted value.',
        );
      }
      if (!DECISION_STATUSES.has(cells.at(-1) ?? '')) {
        reporter.add('DECISION_ROW_INVALID', file, index + 1, 'Decision status is outside the supported lifecycle.');
      }
      tableIds.push({
        id: cells[0],
        line: index + 1,
        status: cells.at(-1) ?? '',
        cells,
      });
    }
    const heading = lines[index].match(/^###\s+(D-\d{3})\b/);
    if (heading) headingIds.push({ id: heading[1], line: index + 1, index });
  }

  function validateUnique(entries) {
    const seen = new Set();
    for (const entry of entries) {
      if (seen.has(entry.id)) {
        reporter.add('DUPLICATE_DECISION', file, entry.line, `Duplicate D ID: ${entry.id}.`);
      }
      seen.add(entry.id);
    }
    return seen;
  }

  const tableSet = validateUnique(tableIds);
  validateUnique(headingIds);
  if (!hasPrimaryTable || !hasPrimarySeparator) {
    reporter.add('DECISION_TABLE_MISSING', file, 1, 'The canonical decision table is missing.');
  }
  for (const heading of headingIds) {
    if (!tableSet.has(heading.id)) {
      reporter.add('UNKNOWN_DECISION', file, heading.line, `Decision detail is absent from the table: ${heading.id}.`);
    }
  }
  const statusById = new Map(tableIds.map(({ id, status }) => [id, status]));
  const detailById = new Map();
  const recordDigestById = new Map();
  const tableCellsById = new Map(tableIds.map(({ id, cells }) => [id, cells]));
  for (let headingIndex = 0; headingIndex < headingIds.length; headingIndex += 1) {
    const heading = headingIds[headingIndex];
    const nextHeadingIndex = lines.findIndex((line, index) => {
      return index > heading.index && /^#{1,3}\s/.test(line);
    });
    const endIndex = nextHeadingIndex === -1 ? lines.length : nextHeadingIndex;
    const fields = new Map();
    for (let index = heading.index + 1; index < endIndex; index += 1) {
      const field = lines[index].match(/^- ([^:]+):\s*(.*)$/);
      if (!field || !DECISION_RECORD_FIELDS.includes(field[1])) continue;
      if (fields.has(field[1])) {
        reporter.add('DECISION_RECORD_INVALID', file, index + 1, `Decision field is duplicated: ${field[1]}.`);
      }
      fields.set(field[1], { value: field[2].trim(), line: index + 1 });
    }
    detailById.set(heading.id, fields);
    const recordText = lines.slice(heading.index, endIndex).join('\n').trim();
    const tableCells = tableCellsById.get(heading.id);
    if (tableCells) {
      recordDigestById.set(heading.id, calculateDecisionRecordDigest(tableCells, recordText));
    }
  }
  const normalizedDecisionRecords = new Map();
  for (const [id, record] of Object.entries(decisionRecords)) {
    const isValidRecord =
      /^D-\d{3}$/.test(id) &&
      record &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      arraysEqual(
        Object.keys(record).sort(compareText),
        ['allowedBases', 'disposition', 'recordDigest', 'revision'],
      ) &&
      Number.isInteger(record.revision) &&
      record.revision > 0 &&
      DECISION_DISPOSITIONS.has(record.disposition) &&
      /^sha256:[0-9a-f]{64}$/.test(record.recordDigest) &&
      Array.isArray(record.allowedBases) &&
      record.allowedBases.every((base) => base === 'dev-main' || base === 'main') &&
      new Set(record.allowedBases).size === record.allowedBases.length &&
      arraysEqual([...record.allowedBases].sort(compareText), record.allowedBases);
    if (!isValidRecord || !tableSet.has(id)) {
      reporter.add('INVALID_CONTRACT', file, 1, `Decision record contract is invalid: ${id}.`);
      continue;
    }
    normalizedDecisionRecords.set(id, record);
  }
  for (const { id, line, status } of tableIds) {
    const contractedRecord = normalizedDecisionRecords.get(id);
    if (!RECORDED_DECISION_STATUSES.has(status) && !contractedRecord) continue;
    if (RECORDED_DECISION_STATUSES.has(status) && !contractedRecord) {
      reporter.add('DECISION_RECORD_INVALID', file, line, `Recorded decision has no pinned contract: ${id}.`);
      continue;
    }
    const fields = detailById.get(id);
    if (!fields) {
      reporter.add('DECISION_RECORD_INVALID', file, line, `Resolved decision has no detailed record: ${id}.`);
      continue;
    }
    for (const fieldName of DECISION_RECORD_FIELDS) {
      const field = fields.get(fieldName);
      if (!field?.value || UNRESOLVED_OWNER_FIELD_PATTERN.test(field.value)) {
        reporter.add(
          'DECISION_RECORD_INVALID',
          file,
          field?.line ?? line,
          `Resolved decision field is missing or unresolved: ${id} ${fieldName}.`,
        );
      }
    }
    const decisionDate = fields.get('Date');
    if (decisionDate?.value && !isPastOrPresentIsoDate(decisionDate.value)) {
      reporter.add('DECISION_RECORD_INVALID', file, decisionDate.line, `Decision date is invalid: ${id}.`);
    }
    if (!contractedRecord) continue;
    const expectedAllowedBases =
      contractedRecord.allowedBases.length > 0
        ? contractedRecord.allowedBases.map((base) => `\`${base}\``).join(', ')
        : 'None — no delivery authorization';
    if (
      fields.get('Revision')?.value !== String(contractedRecord.revision) ||
      fields.get('Disposition')?.value !== contractedRecord.disposition ||
      fields.get('Allowed bases')?.value !== expectedAllowedBases ||
      recordDigestById.get(id) !== contractedRecord.recordDigest
    ) {
      reporter.add('DECISION_RECORD_INVALID', file, line, `Decision record differs from its contract: ${id}.`);
    }
    const expectedDisposition = status.startsWith('Implemented')
      ? 'implemented'
      : status === 'Decided by owner; not planned'
        ? 'not-planned'
        : RECORDED_DECISION_STATUSES.has(status)
          ? 'approved'
          : null;
    if (!expectedDisposition) {
      reporter.add('DECISION_OUTCOME_MISMATCH', file, line, `Pinned decision status is unresolved: ${id}.`);
    }
    if (expectedDisposition && expectedDisposition !== contractedRecord.disposition) {
      reporter.add('DECISION_OUTCOME_MISMATCH', file, line, `Decision status contradicts its disposition: ${id}.`);
    }
  }
  for (let index = 1; index < tableIds.length; index += 1) {
    const previous = Number(tableIds[index - 1].id.slice(2));
    const current = Number(tableIds[index].id.slice(2));
    if (current <= previous) {
      reporter.add('DECISION_ORDER', file, tableIds[index].line, 'D IDs must be ascending.');
    }
  }
  if (calculateTableDigest(tableIds.map(({ cells }) => cells)) !== expectedTableDigest) {
    reporter.add('DECISION_TABLE_POLICY_DRIFT', file, 1, 'Decision table differs from the reviewed policy.');
  }
  return {
    ids: tableSet,
    statusById,
    recordById: normalizedDecisionRecords,
  };
}

function validateReferences(markdownByFile, knownDecisions, knownRisks, reporter) {
  for (const [file, document] of markdownByFile) {
    const prose = document.proseLines.join('\n');
    for (const decision of extractReferences(prose, 'D')) {
      if (!knownDecisions.has(decision)) {
        reporter.add('UNKNOWN_DECISION', file, 1, `Unknown decision reference: ${decision}.`);
      }
    }
    for (const risk of extractReferences(prose, 'R')) {
      if (!knownRisks.has(risk)) reporter.add('UNKNOWN_RISK', file, 1, `Unknown risk reference: ${risk}.`);
    }
  }
}

function parsePlanLifecycle(value) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return LIFECYCLE_RANK.has(normalized) ? normalized : null;
}

function parseTraceLifecycle(value, repositorySlug) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized === 'Planned' || normalized === 'Planned / unset') return 'Planned';
  if (new RegExp(`^Ready${GATE_EVIDENCE_SUFFIX_SOURCE}$`).test(normalized)) return 'Ready';
  if (createPullRequestEvidencePattern(repositorySlug).test(normalized)) return 'PR open';
  if (createMergedEvidencePattern(repositorySlug).test(normalized)) return 'Merged';
  if (createVerifiedEvidencePattern(repositorySlug).test(normalized)) return 'Verified';
  return null;
}

function parseDecisionSequence(value) {
  if (!DECISION_LIST_PATTERN.test(value)) return null;
  const decisions = [];
  const atomPattern = /D-(\d{3})(?:[–—-](?:D-)?(\d{3}))?/g;
  for (const match of value.matchAll(atomPattern)) {
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (end < start) return null;
    for (let current = start; current <= end; current += 1) {
      const decision = `D-${String(current).padStart(3, '0')}`;
      const previous = decisions.at(-1);
      if (previous && Number(previous.slice(2)) >= current) return null;
      decisions.push(decision);
    }
  }
  return decisions.length > 0 ? decisions : null;
}

function normalizeGateSpec(decisions, requirements) {
  const canonicalRequirements = requirements.map(({ key, requiredAt }) => ({ key, requiredAt }));
  return {
    canonical: stableJson({ decisions, requirements: canonicalRequirements }),
    decisions,
    requirements,
  };
}

function normalizeDecisionGate(value) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const aliasRequirements = DECISION_GATE_ALIASES.get(normalized.toLowerCase());
  if (aliasRequirements) return normalizeGateSpec([], aliasRequirements);

  const suffix = DECISION_GATE_SUFFIXES.find(({ text }) => normalized.endsWith(text));
  const decisionExpression = suffix ? normalized.slice(0, -suffix.text.length) : normalized;
  const decisions = parseDecisionSequence(decisionExpression);
  if (!decisions) return null;
  return normalizeGateSpec(decisions, suffix?.requirements ?? []);
}

function normalizeContractedDecisionGate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!arraysEqual(Object.keys(value).sort(compareText), ['decisions', 'requirements'])) return null;
  if (!Array.isArray(value.decisions) || !Array.isArray(value.requirements)) return null;
  if (
    value.decisions.some((decision) => typeof decision !== 'string' || !/^D-\d{3}$/.test(decision)) ||
    new Set(value.decisions).size !== value.decisions.length ||
    !arraysEqual([...value.decisions].sort(compareText), value.decisions)
  ) {
    return null;
  }
  const requirementKeys = [];
  for (const requirement of value.requirements) {
    if (
      !requirement ||
      typeof requirement !== 'object' ||
      Array.isArray(requirement) ||
      !arraysEqual(Object.keys(requirement).sort(compareText), ['attestor', 'key', 'requiredAt']) ||
      (requirement.attestor !== null &&
        (typeof requirement.attestor !== 'string' ||
          !requirement.attestor ||
          UNRESOLVED_OWNER_FIELD_PATTERN.test(requirement.attestor))) ||
      !GATE_REQUIREMENT_KEYS.has(requirement.key) ||
      !GATE_REQUIREMENT_STAGES.has(requirement.requiredAt)
    ) {
      return null;
    }
    requirementKeys.push(requirement.key);
  }
  if (
    new Set(requirementKeys).size !== requirementKeys.length ||
    !arraysEqual([...requirementKeys].sort(compareText), requirementKeys)
  ) {
    return null;
  }
  return normalizeGateSpec(value.decisions, value.requirements);
}

function parseGateEvidence(value) {
  const records = [];
  const pattern = new RegExp(
    [
      '(?:^|;\\s*)gate `([^`]+)`; record `(sha256:[0-9a-f]{64})`;',
      ' attested by `([^`]+)`; attested at `(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z)`',
    ].join(''),
    'gi',
  );
  for (const match of value.matchAll(pattern)) {
    records.push({
      key: match[1],
      digest: match[2].toLowerCase(),
      attestor: match[3],
      attestedAt: match[4],
    });
  }
  const markerCount = [...value.matchAll(/\bgate\s+`/gi)].length;
  return { records, isSyntaxValid: markerCount === records.length };
}

function isRequirementDue(requirement, lifecycle) {
  // Operation holds are checked when the named action is requested; lifecycle advancement cannot pre-authorize them.
  if (requirement.requiredAt === 'operation') return false;
  const requiredRank = REQUIREMENT_STAGE_RANK.get(requirement.requiredAt);
  const lifecycleRank = LIFECYCLE_RANK.get(lifecycle);
  return requiredRank !== undefined && lifecycleRank !== undefined && lifecycleRank >= requiredRank;
}

function parseTraceability(file, lines, reporter) {
  const rows = [];
  let isInside = false;
  let hasHeader = false;
  let hasSeparator = false;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === '## Branch register') {
      isInside = true;
      continue;
    }
    if (isInside && lines[index].startsWith('## ')) break;
    if (!isInside) continue;
    if (!lines[index].trim()) continue;
    const cells = splitTableRow(lines[index]);
    if (cells?.[0] === 'ID') {
      if (hasHeader) reporter.add('TRACEABILITY_MISSING', file, index + 1, 'Traceability header is duplicated.');
      hasHeader = true;
      if (!arraysEqual(cells, ['ID', 'Plan', 'Risk controls', 'Decision gates', 'Delivery state'])) {
        reporter.add('TRACEABILITY_MISSING', file, index + 1, 'Traceability table header is malformed.');
      }
      continue;
    }
    if (isTableSeparator(cells, 5)) {
      if (!hasHeader || hasSeparator) {
        reporter.add('TRACEABILITY_MISSING', file, index + 1, 'Traceability separator is misplaced.');
      }
      hasSeparator = true;
      continue;
    }
    if (!hasHeader || !hasSeparator) {
      reporter.add('TRACEABILITY_MISSING', file, index + 1, 'Traceability content appears before its table header.');
      continue;
    }
    if (!cells || cells.length !== 5 || !/^\d+[A-Z]?$/.test(cells[0] ?? '')) {
      reporter.add('TRACEABILITY_MISSING', file, index + 1, 'Traceability data row is malformed.');
      continue;
    }
    const link = cells[1]?.match(/\[`([^`]+)`\]\(([^)]+)\)/);
    if (!link) {
      reporter.add('TRACEABILITY_MISSING', file, index + 1, 'Traceability row is malformed.');
      continue;
    }
    rows.push({
      id: cells[0],
      name: link[1],
      target: link[2],
      risks: cells[2],
      decisions: cells[3],
      state: cells[4],
      line: index + 1,
    });
  }
  if (!hasHeader || !hasSeparator) {
    reporter.add('TRACEABILITY_MISSING', file, 1, 'Traceability table header or separator is missing.');
  }
  const seenIds = new Set();
  const seenNames = new Set();
  for (const row of rows) {
    if (seenIds.has(row.id) || seenNames.has(row.name)) {
      reporter.add('TRACEABILITY_DUPLICATE', file, row.line, 'Traceability branch ID and name must be unique.');
    }
    seenIds.add(row.id);
    seenNames.add(row.name);
  }
  return rows;
}

function validateTraceability(
  file,
  rows,
  plans,
  decisionStatusById,
  decisionRecordById,
  knownRisks,
  branchDecisionGates,
  branchRiskControls,
  repositorySlug,
  markdownByFile,
  reporter,
) {
  const rowsByName = new Map(rows.map((row) => [row.name, row]));
  const planNames = new Set(plans.map((plan) => plan.name));
  const pullRequestEvidencePattern = createPullRequestEvidencePattern(repositorySlug);
  const pullRequestUrlPrefix = `https://github.com/${repositorySlug}/pull/`;
  const seenGateEvidenceDigests = new Set();
  const lifecycleByName = new Map(
    plans.map((plan) => [plan.name, parsePlanLifecycle(plan.metadata.get('Status')?.value ?? '')]),
  );
  for (const plan of plans) {
    const row = rowsByName.get(plan.name);
    if (!row) {
      reporter.add('TRACEABILITY_MISSING', plan.file, 1, `Branch is missing from traceability: ${plan.name}.`);
      continue;
    }
    const linkedFile = path.resolve(path.dirname(file), row.target);
    if (row.id !== plan.id || linkedFile !== plan.file) {
      reporter.add('TRACEABILITY_MISSING', file, row.line, `Traceability ID or path does not match: ${plan.name}.`);
    }
    const planDecisionValue = normalizeDecisionGate(plan.metadata.get('Decision gates')?.value ?? '');
    const rowDecisionValue = normalizeDecisionGate(row.decisions);
    const contractedDecisionValue = normalizeContractedDecisionGate(branchDecisionGates[plan.name]);
    if (!contractedDecisionValue) {
      reporter.add('INVALID_CONTRACT', file, row.line, `Decision contract is invalid for branch: ${plan.name}.`);
    }
    if (
      !planDecisionValue ||
      !rowDecisionValue ||
      planDecisionValue.canonical !== rowDecisionValue.canonical ||
      planDecisionValue.canonical !== contractedDecisionValue?.canonical
    ) {
      reporter.add('TRACEABILITY_DECISIONS', file, row.line, `Decision gates differ for branch: ${plan.name}.`);
    }
    if (!planDecisionValue || !rowDecisionValue) {
      reporter.add('DECISION_SYNTAX_INVALID', file, row.line, `Decision gate syntax is invalid: ${plan.name}.`);
    }
    const riskGrammar = /^R-\d{3}(?:\s*[–—-]\s*R-\d{3})?(?:,\s*R-\d{3}(?:\s*[–—-]\s*R-\d{3})?)*$/;
    const rowRisks = extractReferences(row.risks, 'R');
    if (!riskGrammar.test(row.risks) || rowRisks.size === 0) {
      reporter.add('TRACEABILITY_RISKS', file, row.line, `Risk controls are malformed for branch: ${plan.name}.`);
    } else {
      for (const risk of rowRisks) {
        if (!knownRisks.has(risk)) {
          reporter.add('UNKNOWN_RISK', file, row.line, `Unknown risk reference: ${risk}.`);
        }
      }
    }
    const contractedRisks = branchRiskControls[plan.name];
    if (!Array.isArray(contractedRisks)) {
      reporter.add('INVALID_CONTRACT', file, row.line, `Risk contract is missing for branch: ${plan.name}.`);
    } else {
      const expectedRisks = new Set(contractedRisks);
      if (
        expectedRisks.size !== contractedRisks.length ||
        expectedRisks.size !== rowRisks.size ||
        [...expectedRisks].some((risk) => !rowRisks.has(risk) || !knownRisks.has(risk))
      ) {
        reporter.add('TRACEABILITY_RISKS', file, row.line, `Risk controls differ for branch: ${plan.name}.`);
      }
    }
    const planLifecycle = parsePlanLifecycle(plan.metadata.get('Status')?.value ?? '');
    const rowLifecycle = parseTraceLifecycle(row.state, repositorySlug);
    const approvedBaseBranch = extractApprovedBaseBranch(plan.metadata.get('Base')?.value ?? '');
    const expectedApprover = plan.metadata.get('Approver')?.value ?? '';
    const gateEvidence = parseGateEvidence(row.state);
    const lifecycleVerificationFile = path.join(path.dirname(plan.file), 'VERIFICATION.md');
    const lifecycleVerificationText =
      markdownByFile.get(lifecycleVerificationFile)?.structuralLines.join('\n') ?? '';
    const lifecycleVerificationEvidence = parseEvidenceTable(lifecycleVerificationText);
    const lifecycleMergedAt =
      lifecycleVerificationEvidence.values
        .get('merged at')
        ?.match(/^`?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)`?$/)?.[1] ?? '';
    const gateEvidenceByKey = new Map();
    if (!gateEvidence.isSyntaxValid) {
      reporter.add('GATE_EVIDENCE_INVALID', file, row.line, `Gate evidence syntax is invalid: ${plan.name}.`);
    }
    for (const record of gateEvidence.records) {
      if (gateEvidenceByKey.has(record.key)) {
        reporter.add('GATE_EVIDENCE_INVALID', file, row.line, `Gate evidence is duplicated: ${record.key}.`);
      }
      gateEvidenceByKey.set(record.key, record);
      const requirement = contractedDecisionValue?.requirements.find(({ key }) => key === record.key);
      const isStageInvalid =
        Boolean(requirement && planLifecycle && !isRequirementDue(requirement, planLifecycle)) ||
        Boolean(
          requirement?.requiredAt === 'merge' &&
            planLifecycle &&
            LIFECYCLE_RANK.get(planLifecycle) >= LIFECYCLE_RANK.get('Merged') &&
            (!lifecycleMergedAt || record.attestedAt > lifecycleMergedAt),
        ) ||
        Boolean(
          requirement?.requiredAt === 'verify' &&
            planLifecycle === 'Verified' &&
            (!lifecycleMergedAt || record.attestedAt < lifecycleMergedAt),
        );
      if (
        !requirement ||
        isStageInvalid ||
        /^sha256:0{64}$/i.test(record.digest) ||
        !isPastOrPresentUtcTimestamp(record.attestedAt) ||
        record.attestedAt < AUDIT_BASELINE_TIMESTAMP ||
        seenGateEvidenceDigests.has(record.digest)
      ) {
        reporter.add('GATE_EVIDENCE_INVALID', file, row.line, `Gate evidence is invalid: ${record.key}.`);
      } else if (!requirement.attestor || record.attestor !== requirement.attestor) {
        reporter.add(
          'APPROVAL_AUTHORITY_INVALID',
          file,
          row.line,
          `Gate evidence attestor is not authorized: ${record.key}.`,
        );
      }
      seenGateEvidenceDigests.add(record.digest);
    }
    for (const requirement of contractedDecisionValue?.requirements ?? []) {
      if (requirement.attestor && requirement.attestor !== expectedApprover) {
        reporter.add(
          'APPROVAL_AUTHORITY_INVALID',
          plan.file,
          plan.metadata.get('Approver')?.line ?? 1,
          `Plan approver differs from the pinned gate authority: ${requirement.key}.`,
        );
      }
      if (planLifecycle && isRequirementDue(requirement, planLifecycle)) {
        if (!requirement.attestor) {
          reporter.add(
            'APPROVAL_AUTHORITY_INVALID',
            file,
            row.line,
            `Required gate has no pinned attestor: ${requirement.key}.`,
          );
        }
        if (!gateEvidenceByKey.has(requirement.key)) {
          reporter.add('GATE_UNSATISFIED', file, row.line, `Required gate evidence is missing: ${requirement.key}.`);
        }
      }
    }
    if (!planLifecycle || planLifecycle !== rowLifecycle) {
      reporter.add('LIFECYCLE_MISMATCH', file, row.line, `Lifecycle state differs for branch: ${plan.name}.`);
    }
    for (const decision of contractedDecisionValue?.decisions ?? []) {
      const status = decisionStatusById.get(decision) ?? '';
      const authorizedBases = decisionRecordById.get(decision)?.allowedBases ?? [];
      if (
        planLifecycle &&
        RESOLVED_DECISION_STATUSES.has(status) &&
        (!approvedBaseBranch || !authorizedBases.includes(approvedBaseBranch))
      ) {
        reporter.add(
          'DECISION_SCOPE_MISMATCH',
          plan.file,
          plan.metadata.get('Base')?.line ?? 1,
          `Decision scope does not authorize the selected base: ${decision}.`,
        );
      }
    }
    if (planLifecycle && planLifecycle !== 'Planned') {
      for (const field of ['DRI', 'Approver', 'Target']) {
        const value = plan.metadata.get(field)?.value ?? '';
        if (!value || UNRESOLVED_OWNER_FIELD_PATTERN.test(value)) {
          reporter.add('LIFECYCLE_MISMATCH', plan.file, plan.metadata.get(field)?.line ?? 1, `${field} is unresolved.`);
        }
      }
      const target = plan.metadata.get('Target');
      const targetDate = target?.value.match(ISO_DATE_PATTERN)?.[0] ?? '';
      if (!isValidIsoDate(targetDate)) {
        reporter.add(
          'LIFECYCLE_MISMATCH',
          plan.file,
          target?.line ?? 1,
          'Target must include an ISO calendar date for Ready or later lifecycle states.',
        );
      }
      if (!approvedBaseBranch) {
        reporter.add(
          'LIFECYCLE_MISMATCH',
          plan.file,
          plan.metadata.get('Base')?.line ?? 1,
          'Base must name an approved main or dev-main branch for lifecycle advancement.',
        );
      }
      for (const dependency of plan.dependencies) {
        const dependencyLifecycle = lifecycleByName.get(dependency);
        const acceptedStates = planLifecycle === 'Verified' ? ['Verified'] : ['Merged', 'Verified'];
        if (!acceptedStates.includes(dependencyLifecycle)) {
          reporter.add(
            'LIFECYCLE_MISMATCH',
            plan.file,
            plan.metadata.get('Depends on')?.line ?? 1,
            `Dependency evidence is incomplete: ${dependency}.`,
          );
        }
      }
      const decisionReferences = contractedDecisionValue?.decisions ?? [];
      if (decisionReferences.length === 0 && (contractedDecisionValue?.requirements.length ?? 0) === 0) {
        reporter.add('LIFECYCLE_MISMATCH', file, row.line, `Decision evidence is incomplete for branch: ${plan.name}.`);
      }
      for (const decision of decisionReferences) {
        const status = decisionStatusById.get(decision) ?? '';
        if (!RESOLVED_DECISION_STATUSES.has(status)) {
          reporter.add(
            'LIFECYCLE_MISMATCH',
            plan.file,
            plan.metadata.get('Decision gates')?.line ?? 1,
            `Decision is unresolved for lifecycle advancement: ${decision}.`,
          );
        }
      }
    }
    if (planLifecycle === 'PR open') {
      const pullRequestEvidence = row.state.match(pullRequestEvidencePattern);
      const rolloutEvidence = pullRequestEvidence?.[4]?.toLowerCase() ?? '';
      const rollbackEvidence = pullRequestEvidence?.[5]?.toLowerCase() ?? '';
      if (
        !pullRequestEvidence ||
        pullRequestEvidence[1] !== pullRequestEvidence[2] ||
        !isValidGitSha(pullRequestEvidence[3]) ||
        /^sha256:0{64}$/i.test(rolloutEvidence) ||
        /^sha256:0{64}$/i.test(rollbackEvidence) ||
        rolloutEvidence === rollbackEvidence
      ) {
        reporter.add('LIFECYCLE_MISMATCH', file, row.line, `PR evidence is incomplete for branch: ${plan.name}.`);
      }
    }
    if (planLifecycle === 'Merged' || planLifecycle === 'Verified') {
      const verificationEvidence = lifecycleVerificationEvidence;
      const rowPullRequestMatch = row.state.match(
        /\[PR #([1-9]\d*)\]\((https:\/\/github\.com\/[^)\s]+\/pull\/([1-9]\d*))\)/i,
      );
      const rowPullRequest = rowPullRequestMatch?.[2] ?? '';
      const rowHeadSha = row.state.match(/\bhead\s+`?([0-9a-f]{7,40})`?/i)?.[1] ?? '';
      const rowMergeSha = row.state.match(/\bmerge\s+`?([0-9a-f]{7,40})`?/i)?.[1] ?? '';
      const rowBaseBranch = row.state.match(/\bmerged\s+to\s+`([^`]+)`/i)?.[1] ?? '';
      const verificationPullRequestMatch = verificationEvidence.values
        .get('pull request')
        ?.match(/^\[(?:PR )?#([1-9]\d*)\]\((https:\/\/github\.com\/[^)\s]+\/pull\/([1-9]\d*))\)$/i);
      const verificationPullRequest = verificationPullRequestMatch?.[2] ?? '';
      const verificationHeadSha =
        verificationEvidence.values.get('head sha')?.match(/^`?([0-9a-f]{40})`?$/i)?.[1] ?? '';
      const verificationMergeSha =
        verificationEvidence.values.get('merge sha')?.match(/^`?([0-9a-f]{40})`?$/i)?.[1] ?? '';
      const verificationBaseBranch =
        verificationEvidence.values.get('base branch')?.match(/^`?([^`|\s]+)`?$/)?.[1] ?? '';
      const verificationMergedAt = lifecycleMergedAt;
      const verificationReviewThreads = verificationEvidence.values.get('review threads') ?? '';
      const verificationChecks = verificationEvidence.values.get('checks') ?? '';
      const verificationReleaseSha =
        planLifecycle === 'Verified'
          ? verificationEvidence.values.get('release sha')?.match(/^`?([0-9a-f]{40})`?$/i)?.[1] ?? ''
          : '';
      const checksCommitShas = new Set(
        [verificationHeadSha, verificationMergeSha, verificationReleaseSha]
          .filter(isValidGitSha)
          .map((sha) => sha.toLowerCase()),
      );
      const mergedEvidenceLabels = [
        'pull request',
        'head sha',
        'base branch',
        'merge sha',
        'merged at',
        'review threads',
        'checks',
      ];
      if (
        !rowPullRequest ||
        !rowPullRequestMatch ||
        rowPullRequestMatch[1] !== rowPullRequestMatch[3] ||
        !rowHeadSha ||
        !rowMergeSha ||
        !rowBaseBranch ||
        rowBaseBranch !== approvedBaseBranch ||
        !rowPullRequest.startsWith(pullRequestUrlPrefix) ||
        !verificationPullRequestMatch ||
        verificationPullRequestMatch[1] !== verificationPullRequestMatch[3] ||
        verificationPullRequest !== rowPullRequest ||
        !isValidGitShaPrefix(rowHeadSha) ||
        !isValidGitShaPrefix(rowMergeSha) ||
        !isValidGitSha(verificationHeadSha) ||
        !isValidGitSha(verificationMergeSha) ||
        !verificationHeadSha.startsWith(rowHeadSha) ||
        !verificationMergeSha.startsWith(rowMergeSha) ||
        verificationBaseBranch !== rowBaseBranch ||
        !isPastOrPresentUtcTimestamp(verificationMergedAt) ||
        verificationReviewThreads !== 'Resolved' ||
        !verificationEvidence.isStructureValid ||
        verificationEvidence.unknown.size > 0 ||
        verificationEvidence.duplicates.size > 0 ||
        !mergedEvidenceLabels.every((label) => verificationEvidence.values.has(label)) ||
        !/^Passed:/i.test(verificationChecks) ||
        !hasRepositoryBoundChecksEvidence(verificationChecks, repositorySlug, checksCommitShas)
      ) {
        reporter.add('LIFECYCLE_MISMATCH', file, row.line, `Merge evidence is incomplete for branch: ${plan.name}.`);
      }
    }
    if (planLifecycle === 'Verified') {
      const rowReleaseSha = row.state.match(/\brelease\s+`?([0-9a-f]{40})`?/i)?.[1] ?? '';
      const verificationEvidence = lifecycleVerificationEvidence;
      const verificationReleaseSha =
        verificationEvidence.values.get('release sha')?.match(/^`?([0-9a-f]{40})`?$/i)?.[1] ?? '';
      const requiredEvidenceFields = [
        'acceptance evidence',
        'reconciliation / monitoring',
        'rollout evidence',
        'rollback evidence',
      ];
      const immutableEvidenceReferences = requiredEvidenceFields.map((label) => {
        if (verificationEvidence.duplicates.has(label)) return '';
        return extractImmutableEvidenceReference(verificationEvidence.values.get(label) ?? '');
      });
      const hasCompleteVerificationEvidence =
        immutableEvidenceReferences.every(Boolean) &&
        new Set(immutableEvidenceReferences).size === immutableEvidenceReferences.length;
      if (
        !isValidGitSha(rowReleaseSha) ||
        verificationReleaseSha !== rowReleaseSha ||
        verificationEvidence.duplicates.has('release sha') ||
        !hasCompleteVerificationEvidence
      ) {
        reporter.add('LIFECYCLE_MISMATCH', file, row.line, `Release evidence is incomplete for branch: ${plan.name}.`);
      }
    }
  }
  for (const row of rows) {
    if (!planNames.has(row.name)) {
      reporter.add('TRACEABILITY_EXTRA', file, row.line, `Traceability contains an unknown branch: ${row.name}.`);
    }
  }
  for (const branchName of Object.keys(branchRiskControls)) {
    if (!planNames.has(branchName)) {
      reporter.add('INVALID_CONTRACT', file, 1, `Risk contract contains an unknown branch: ${branchName}.`);
    }
  }
  for (const branchName of Object.keys(branchDecisionGates)) {
    if (!planNames.has(branchName)) {
      reporter.add('INVALID_CONTRACT', file, 1, `Decision contract contains an unknown branch: ${branchName}.`);
    }
  }
}

function validateRiskCoverage(contractFile, knownRisks, branchRiskControls, unmappedRisks, reporter) {
  const mappedRisks = new Set();
  for (const risks of Object.values(branchRiskControls)) {
    if (!Array.isArray(risks)) {
      reporter.add('INVALID_CONTRACT', contractFile, 1, 'Branch risk controls must be arrays.');
      continue;
    }
    for (const risk of risks) mappedRisks.add(risk);
  }
  const explicitlyUnmappedRisks = new Set(unmappedRisks);
  for (const risk of mappedRisks) {
    if (!knownRisks.has(risk)) reporter.add('UNKNOWN_RISK', contractFile, 1, `Unknown risk reference: ${risk}.`);
    if (explicitlyUnmappedRisks.has(risk)) {
      reporter.add('INVALID_CONTRACT', contractFile, 1, `Risk cannot be mapped and explicitly unmapped: ${risk}.`);
    }
  }
  for (const risk of explicitlyUnmappedRisks) {
    if (!knownRisks.has(risk)) reporter.add('UNKNOWN_RISK', contractFile, 1, `Unknown risk reference: ${risk}.`);
  }
  for (const risk of knownRisks) {
    if (!mappedRisks.has(risk) && !explicitlyUnmappedRisks.has(risk)) {
      reporter.add('RISK_ORPHAN', contractFile, 1, `Risk has no branch control or explicit exception: ${risk}.`);
    }
  }
}

function extractMermaidGraph(file, commentMaskedLines, structuralLines, fencedBlocks, reporter) {
  const headingIndex = structuralLines.findIndex((line) => line === '## Critical dependency graph');
  if (headingIndex === -1) {
    reporter.add('MERMAID_DRIFT', file, 1, 'Critical dependency graph heading is missing.');
    return { nodes: new Map(), edges: new Set() };
  }
  const nextHeadingIndex = structuralLines.findIndex((line, index) => {
    return index > headingIndex && line.startsWith('## ');
  });
  const sectionEnd = nextHeadingIndex === -1 ? structuralLines.length : nextHeadingIndex;
  const candidates = fencedBlocks.filter((block) => {
    return block.info === 'mermaid' && block.start > headingIndex && block.end < sectionEnd;
  });
  if (candidates.length !== 1) {
    reporter.add(
      'MERMAID_DRIFT',
      file,
      headingIndex + 1,
      'Critical graph section must contain exactly one visible Mermaid fence.',
    );
    return { nodes: new Map(), edges: new Set() };
  }
  const [{ start: openingIndex, end: closingIndex }] = candidates;

  const nodes = new Map();
  const edges = new Set();
  for (let index = openingIndex + 1; index < closingIndex; index += 1) {
    const line = commentMaskedLines[index];
    if (!line.trim() || /^\s*flowchart\s+(?:LR|RL|TB|BT)\s*$/.test(line)) continue;
    const nodeMatch = line.match(/^\s*([A-Za-z][A-Za-z0-9]*)\["([^"]+)"\]\s*$/);
    if (nodeMatch) {
      if (nodes.has(nodeMatch[1])) {
        reporter.add('MERMAID_DRIFT', file, index + 1, `Duplicate Mermaid node: ${nodeMatch[1]}.`);
      }
      nodes.set(nodeMatch[1], nodeMatch[2]);
      continue;
    }
    const edgeMatch = line.match(/^\s*([A-Za-z][A-Za-z0-9]*)\s*-->\s*([A-Za-z][A-Za-z0-9]*)\s*$/);
    if (edgeMatch) {
      const edge = `${edgeMatch[1]}->${edgeMatch[2]}`;
      if (edges.has(edge)) reporter.add('MERMAID_DRIFT', file, index + 1, `Duplicate Mermaid edge: ${edge}.`);
      edges.add(edge);
      continue;
    }
    reporter.add('MERMAID_DRIFT', file, index + 1, 'Unsupported Mermaid syntax in the critical graph.');
  }
  return { nodes, edges };
}

function validateMermaid(file, graph, portfolio, dependencyEdges, allowedOperationalEdges, reporter) {
  const branchById = new Map(portfolio.map((entry) => [entry.id, entry.name]));
  const branchByNode = new Map();
  for (const [node, label] of graph.nodes) {
    const id = label.match(/^(\d+[A-Z]?)(?:\s|$)/i)?.[1]?.toUpperCase();
    if (id && branchById.has(id)) branchByNode.set(node, branchById.get(id));
  }
  for (const entry of portfolio) {
    const matches = [...branchByNode.values()].filter((name) => name === entry.name).length;
    if (matches !== 1) reporter.add('MERMAID_DRIFT', file, 1, `Branch must have one Mermaid node: ${entry.name}.`);
  }

  const branchEdges = new Set();
  const operationalEdges = new Set();
  const allowedOperationalNodes = new Set(
    allowedOperationalEdges.flatMap((edge) => edge.split('->')),
  );
  const adjacency = new Map();
  for (const edge of graph.edges) {
    const [source, target] = edge.split('->');
    if (!graph.nodes.has(source) || !graph.nodes.has(target)) {
      reporter.add('MERMAID_DRIFT', file, 1, `Mermaid edge references an unknown node: ${edge}.`);
      continue;
    }
    if (!adjacency.has(source)) adjacency.set(source, []);
    adjacency.get(source).push(target);
    const sourceBranch = branchByNode.get(source);
    const targetBranch = branchByNode.get(target);
    if (sourceBranch && targetBranch) branchEdges.add(`${sourceBranch}->${targetBranch}`);
    else operationalEdges.add(edge);
  }

  for (const edge of dependencyEdges) {
    if (!branchEdges.has(edge)) reporter.add('MERMAID_DRIFT', file, 1, 'Mermaid graph is missing a dependency edge.');
  }
  for (const edge of branchEdges) {
    if (!dependencyEdges.has(edge)) reporter.add('MERMAID_DRIFT', file, 1, 'Mermaid graph has an extra branch edge.');
  }
  const allowed = new Set(allowedOperationalEdges);
  for (const node of graph.nodes.keys()) {
    if (!branchByNode.has(node) && !allowedOperationalNodes.has(node)) {
      reporter.add('MERMAID_DRIFT', file, 1, `Unexpected operational node: ${node}.`);
    }
  }
  for (const edge of operationalEdges) {
    if (!allowed.has(edge)) reporter.add('MERMAID_DRIFT', file, 1, `Unexpected operational edge: ${edge}.`);
  }
  for (const edge of allowed) {
    if (!operationalEdges.has(edge)) reporter.add('MERMAID_DRIFT', file, 1, `Missing operational edge: ${edge}.`);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(node) {
    if (visiting.has(node)) {
      reporter.add('DEPENDENCY_CYCLE', file, 1, 'The complete Mermaid graph contains a cycle.');
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const target of [...(adjacency.get(node) ?? [])].sort(compareText)) visit(target);
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of [...graph.nodes.keys()].sort(compareText)) visit(node);
}

function validateDeclaredCounts(contractFile, contract, summary, reporter) {
  for (const key of ['markdownFiles', 'branchPlans', 'hardDependencies', 'decisions', 'risks']) {
    if (!Number.isInteger(contract.declaredCounts?.[key]) || contract.declaredCounts[key] < 0) {
      reporter.add('COUNT_MISMATCH', contractFile, 1, `Declared count is invalid: ${key}.`);
    } else if (contract.declaredCounts[key] !== summary[key]) {
      reporter.add('COUNT_MISMATCH', contractFile, 1, `Declared count does not match: ${key}.`);
    }
  }
}

function validateRequiredFiles(auditRoot, contract, reporter) {
  const seen = new Set();
  for (const relative of contract.requiredFiles) {
    if (
      typeof relative !== 'string' ||
      !relative ||
      path.isAbsolute(relative)
    ) {
      reporter.add('INVALID_CONTRACT', path.join(auditRoot, CONTRACT_FILE), 1, 'Required file path is unsafe.');
      continue;
    }
    const file = path.resolve(auditRoot, relative);
    if (!isWithin(auditRoot, file)) {
      reporter.add('INVALID_CONTRACT', path.join(auditRoot, CONTRACT_FILE), 1, 'Required file path is unsafe.');
      continue;
    }
    if (seen.has(relative)) {
      reporter.add('INVALID_CONTRACT', path.join(auditRoot, CONTRACT_FILE), 1, 'Required file path is duplicated.');
      continue;
    }
    seen.add(relative);
    if (
      !existsSync(file) ||
      !lstatSync(file).isFile() ||
      !hasExactCase(file, auditRoot) ||
      containsSymlink(file, auditRoot)
    ) {
      reporter.add('MISSING_FILE', file, 1, 'Contracted audit file is missing, renamed, or not a regular file.');
    }
  }
}

function validateSpecialistDocumentDigests(auditRoot, contract, reporter) {
  const entries = Object.entries(contract.specialistDocumentDigests);
  const configuredFiles = entries.map(([file]) => file).sort(compareText);
  if (
    contract.repositorySlug === DEFAULT_REPOSITORY_SLUG &&
    !arraysEqual(configuredFiles, [...CANONICAL_SPECIALIST_FILES].sort(compareText))
  ) {
    reporter.add(
      'INVALID_CONTRACT',
      path.join(auditRoot, CONTRACT_FILE),
      1,
      'Canonical specialist document digests are incomplete.',
    );
  }
  for (const [relative, expectedDigest] of entries) {
    if (!CANONICAL_SPECIALIST_FILES.includes(relative) || !/^sha256:[0-9a-f]{64}$/.test(expectedDigest)) {
      reporter.add('INVALID_CONTRACT', path.join(auditRoot, CONTRACT_FILE), 1, 'Specialist digest is invalid.');
      continue;
    }
    const file = path.join(auditRoot, relative);
    if (!existsSync(file) || !lstatSync(file).isFile()) continue;
    const actualDigest = `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`;
    if (actualDigest !== expectedDigest) {
      reporter.add('SPECIALIST_DIGEST_MISMATCH', file, 1, 'Specialist document differs from its reviewed digest.');
    }
  }
}

function loadContract(file, reporter) {
  const contents = readUtf8File(file, reporter);
  if (!contents) return null;
  try {
    const contract = JSON.parse(contents);
    if (
      contract.schemaVersion !== 2 ||
      typeof contract.repositorySlug !== 'string' ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(contract.repositorySlug) ||
      typeof contract.dependencyGraphDigest !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/.test(contract.dependencyGraphDigest) ||
      typeof contract.portfolioDigest !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/.test(contract.portfolioDigest) ||
      typeof contract.decisionTableDigest !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/.test(contract.decisionTableDigest) ||
      typeof contract.riskTableDigest !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/.test(contract.riskTableDigest) ||
      !contract.declaredCounts ||
      !Array.isArray(contract.requiredBranchMetadata) ||
      !Array.isArray(contract.requiredBranchSections) ||
      !Array.isArray(contract.requiredFiles) ||
      !Array.isArray(contract.decisionTableColumns) ||
      !Array.isArray(contract.riskTableColumns) ||
      !contract.decisionRecords ||
      typeof contract.decisionRecords !== 'object' ||
      Array.isArray(contract.decisionRecords) ||
      !contract.specialistDocumentDigests ||
      typeof contract.specialistDocumentDigests !== 'object' ||
      Array.isArray(contract.specialistDocumentDigests) ||
      !contract.branchRiskControls ||
      typeof contract.branchRiskControls !== 'object' ||
      Array.isArray(contract.branchRiskControls) ||
      !contract.branchDecisionGates ||
      typeof contract.branchDecisionGates !== 'object' ||
      Array.isArray(contract.branchDecisionGates) ||
      !Array.isArray(contract.unmappedRisks) ||
      !Array.isArray(contract.allowedOperationalEdges)
    ) {
      reporter.add('INVALID_CONTRACT', file, 1, 'Validation contract shape or schema version is invalid.');
      return null;
    }
    const requiredFileSet = new Set(contract.requiredFiles);
    const hasInvalidCanonicalFields =
      !arraysEqual(contract.requiredBranchMetadata, CANONICAL_BRANCH_METADATA) ||
      !arraysEqual(contract.requiredBranchSections, CANONICAL_BRANCH_SECTIONS) ||
      !arraysEqual(contract.decisionTableColumns, CANONICAL_DECISION_COLUMNS) ||
      !CANONICAL_RISK_COLUMNS.some((columns) => arraysEqual(contract.riskTableColumns, columns)) ||
      CANONICAL_REQUIRED_FILES.some((requiredFile) => !requiredFileSet.has(requiredFile));
    const contractArrays = [
      contract.requiredFiles,
      contract.decisionTableColumns,
      contract.riskTableColumns,
      contract.unmappedRisks,
      contract.allowedOperationalEdges,
    ];
    const hasInvalidArray = contractArrays.some((values) => {
      return values.some((value) => typeof value !== 'string' || !value) || new Set(values).size !== values.length;
    });
    if (hasInvalidCanonicalFields || hasInvalidArray) {
      reporter.add('INVALID_CONTRACT', file, 1, 'Validation contract weakens or duplicates canonical controls.');
      return null;
    }
    if (
      contract.repositorySlug === DEFAULT_REPOSITORY_SLUG &&
      calculatePolicyDigest(contract) !== CANONICAL_POLICY_DIGEST
    ) {
      reporter.add('GATE_POLICY_DRIFT', file, 1, 'Validation policy differs from the reviewed canonical baseline.');
    }
    return contract;
  } catch {
    reporter.add('INVALID_CONTRACT', file, 1, 'Validation contract is not valid JSON.');
    return null;
  }
}

function validate(root, repositorySlug) {
  const reporter = createReporter(root);
  const auditRoot = path.join(root, AUDIT_RELATIVE_PATH);
  const contractFile = path.join(auditRoot, CONTRACT_FILE);
  const contract = loadContract(contractFile, reporter);
  const emptySummary = {
    markdownFiles: 0,
    branchPlans: 0,
    hardDependencies: 0,
    decisions: 0,
    risks: 0,
  };
  if (!contract) return { summary: emptySummary, errors: reporter.sorted() };
  if (contract.repositorySlug !== repositorySlug) {
    reporter.add('INVALID_CONTRACT', contractFile, 1, 'Contract repository does not match validator authority.');
  }

  try {
    if (realpathSync(auditRoot) !== path.resolve(auditRoot)) {
      reporter.add('SYMLINK_NOT_ALLOWED', auditRoot, 1, 'Audit root must not be a symlink.');
    }
  } catch {
    reporter.add('MISSING_FILE', auditRoot, 1, 'Audit root is missing.');
  }
  validateRequiredFiles(auditRoot, contract, reporter);
  validateSpecialistDocumentDigests(auditRoot, contract, reporter);

  const markdownFiles = walkMarkdownFiles(auditRoot, reporter);
  const markdownByFile = new Map();
  for (const file of markdownFiles) {
    const contents = readUtf8File(file, reporter);
    const document = analyzeMarkdown(file, contents, reporter);
    markdownByFile.set(file, document);
  }
  for (const [file, document] of markdownByFile) {
    validateLocalLinks(file, document.proseLines, auditRoot, markdownByFile, reporter);
  }

  const portfolioFile = path.join(auditRoot, PORTFOLIO_FILE);
  const emptyDocument = {
    lines: [],
    commentMaskedLines: [],
    structuralLines: [],
    proseLines: [],
    fencedBlocks: [],
  };
  const portfolioDocument = markdownByFile.get(portfolioFile) ?? emptyDocument;
  const portfolio = parsePortfolio(portfolioFile, portfolioDocument.structuralLines, reporter);
  const plans = parseBranchPlans(auditRoot, contract, reporter, markdownByFile);
  validateEducationDecisionSequencing(contractFile, contract.branchDecisionGates, reporter);
  validatePortfolioParity(portfolioFile, portfolio, plans, reporter);
  validatePortfolioDigest(portfolio, contractFile, contract.portfolioDigest, reporter);
  const dependencyEdges = validateDependencies(plans, reporter);
  validateDependencyGraphDigest(dependencyEdges, contractFile, contract.dependencyGraphDigest, reporter);

  const decisionFile = path.join(auditRoot, DECISION_FILE);
  const decisionDocument = markdownByFile.get(decisionFile) ?? emptyDocument;
  const decisionRegistry = parseDecisionIds(
    decisionFile,
    decisionDocument.structuralLines,
    contract.decisionTableColumns,
    contract.decisionTableDigest,
    contract.decisionRecords,
    reporter,
  );
  const riskFile = path.join(auditRoot, RISK_FILE);
  const riskDocument = markdownByFile.get(riskFile) ?? emptyDocument;
  const riskRegistry = parseIdTable(
    riskFile,
    riskDocument.structuralLines,
    '## Register',
    '## P0 containment overlay',
    'R',
    'DUPLICATE_RISK',
    contract.riskTableColumns,
    contract.riskTableDigest,
    reporter,
  );
  const knownRisks = riskRegistry.ids;
  validateRiskControlReferences(riskRegistry, plans, contract.branchRiskControls, reporter);
  validateRiskCoverage(
    contractFile,
    knownRisks,
    contract.branchRiskControls,
    contract.unmappedRisks,
    reporter,
  );
  validateReferences(markdownByFile, decisionRegistry.ids, knownRisks, reporter);

  const traceabilityFile = path.join(auditRoot, TRACEABILITY_FILE);
  const traceabilityDocument = markdownByFile.get(traceabilityFile) ?? emptyDocument;
  const traceabilityRows = parseTraceability(
    traceabilityFile,
    traceabilityDocument.structuralLines,
    reporter,
  );
  validateTraceability(
    traceabilityFile,
    traceabilityRows,
    plans,
    decisionRegistry.statusById,
    decisionRegistry.recordById,
    knownRisks,
    contract.branchDecisionGates,
    contract.branchRiskControls,
    repositorySlug,
    markdownByFile,
    reporter,
  );

  const mermaidGraph = extractMermaidGraph(
    portfolioFile,
    portfolioDocument.commentMaskedLines,
    portfolioDocument.structuralLines,
    portfolioDocument.fencedBlocks,
    reporter,
  );
  validateMermaid(
    portfolioFile,
    mermaidGraph,
    portfolio,
    dependencyEdges,
    contract.allowedOperationalEdges ?? [],
    reporter,
  );

  const summary = {
    markdownFiles: markdownFiles.length,
    branchPlans: plans.length,
    hardDependencies: dependencyEdges.size,
    decisions: decisionRegistry.ids.size,
    risks: knownRisks.size,
  };
  if (traceabilityRows.length !== plans.length) {
    reporter.add('TRACEABILITY_MISSING', traceabilityFile, 1, 'Traceability row count must match branch plan count.');
  }
  validateDeclaredCounts(contractFile, contract, summary, reporter);
  return { summary, errors: reporter.sorted() };
}

function printResult(result, format) {
  const payload = {
    ok: result.errors.length === 0,
    summary: result.summary,
    errors: result.errors,
  };
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  if (payload.ok) {
    process.stdout.write(
      `Enterprise audit is valid: ${payload.summary.markdownFiles} Markdown files, ` +
        `${payload.summary.branchPlans} plans, ${payload.summary.hardDependencies} dependencies, ` +
        `${payload.summary.decisions} decisions, and ${payload.summary.risks} risks.\n`,
    );
    return;
  }
  for (const error of payload.errors) {
    process.stderr.write(`${error.code} ${error.file}:${error.line} ${error.message}\n`);
  }
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : 'Invalid validator arguments.';
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

try {
  const result = validate(options.root, options.repositorySlug);
  printResult(result, options.format);
  if (result.errors.length > 0) process.exit(1);
} catch {
  if (options.format === 'json') {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        summary: {
          markdownFiles: 0,
          branchPlans: 0,
          hardDependencies: 0,
          decisions: 0,
          risks: 0,
        },
        errors: [
          {
            code: 'VALIDATOR_INTERNAL',
            file: AUDIT_RELATIVE_PATH,
            line: 1,
            message: 'Validator failed without exposing repository contents.',
          },
        ],
      }, null, 2)}\n`,
    );
  } else {
    process.stderr.write('Validator failed without exposing repository contents.\n');
  }
  process.exit(2);
}
