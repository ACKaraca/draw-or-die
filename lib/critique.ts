function stripFence(value: string): string {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
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
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!text) return '';

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    const unwrapped = text.slice(1, -1).trim();
    if (unwrapped) text = unwrapped;
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function ensureAtLeastTwoParagraphs(value: string): string {
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

  return `${paragraphs[0]}\n\nUygulama adimi: paftada kararlarini plan, kesit ve cephe uzerinde ayni hiyerarsiyle netlestir; her kritik noktaya olcekli ve okunur aciklama ekle.`;
}
