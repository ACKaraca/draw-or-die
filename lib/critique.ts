import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

/** Collapses three or more consecutive newline characters to exactly two */
function collapseTriplePlusNewlines(text: string): string {
  let out = '';
  let newlineRun = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') {
      newlineRun++;
      continue;
    }
    if (newlineRun > 0) {
      out += newlineRun >= 3 ? '\n\n' : '\n'.repeat(newlineRun);
      newlineRun = 0;
    }
    out += c;
  }
  if (newlineRun > 0) {
    out += newlineRun >= 3 ? '\n\n' : '\n'.repeat(newlineRun);
  }
  return out;
}

/** Turns whitespace-only lines between two newlines into a single paragraph break (\n\n) */
function normalizeBlankLinesBetweenNewlines(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== '\n') {
      out += ch;
      i++;
      continue;
    }

    let j = i + 1;
    while (j < text.length && text[j] !== '\n') {
      if (!/[ \t]/.test(text[j])) {
        break;
      }
      j++;
    }

    if (j < text.length && text[j] === '\n') {
      out += '\n\n';
      i = j + 1;
      continue;
    }

    out += '\n';
    i++;
  }
  return out;
}

function stripFence(value: string): string {
  let s = value.trim();
  const lower = s.toLowerCase();
  if (lower.startsWith('```json')) {
    s = s.slice('```json'.length).trimStart();
  } else if (s.startsWith('```')) {
    s = s.slice(3).trimStart();
  }
  s = s.trimEnd();
  if (s.endsWith('```')) {
    s = s.slice(0, -3).trimEnd();
  }
  return s.trim();
}

function decodeJsonStringCandidate(value: string): string {
  const cleaned = stripFence(value);
  if (!cleaned) return '';

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'string') return parsed.trim();
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as { critique?: unknown }).critique === 'string'
    ) {
      return String((parsed as { critique: string }).critique).trim();
    }
  } catch {
    // Fall through to raw text handling.
  }

  return cleaned;
}

export function normalizeCritiqueText(value: unknown): string {
  if (typeof value !== 'string') return '';

  let text = decodeJsonStringCandidate(value)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!text) return '';

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    const unwrapped = text.slice(1, -1).trim();
    if (unwrapped) text = unwrapped;
  }

  const spaced = normalizeBlankLinesBetweenNewlines(text);
  return collapseTriplePlusNewlines(spaced).trim();
}

export function ensureAtLeastTwoParagraphs(value: string, language: SupportedLanguage = 'tr'): string {
  const text = normalizeCritiqueText(value);
  if (!text) return '';

  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (paragraphs.length >= 2) {
    return paragraphs.join('\n\n');
  }

  const sentences = paragraphs[0]
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (sentences.length >= 4) {
    const middle = Math.ceil(sentences.length / 2);
    return `${sentences.slice(0, middle).join(' ')}\n\n${sentences.slice(middle).join(' ')}`.trim();
  }

  const filler = pickLocalized(
    language,
    'Uygulama adimi: paftada kararlarini plan, kesit ve cephe uzerinde ayni hiyerarsiyle netlestir; her kritik noktaya olcekli ve okunur aciklama ekle.',
    'Next step: clarify your decisions on plan, section, and elevation with the same hierarchy; add scaled, readable notes at each critical point.',
  );

  return `${paragraphs[0]}\n\n${filler}`;
}
