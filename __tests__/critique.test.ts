import { normalizeCritiqueText, ensureAtLeastTwoParagraphs } from '@/lib/critique';

describe('critique helpers', () => {
  describe('normalizeCritiqueText', () => {
    it('returns empty string for non-string inputs', () => {
      expect(normalizeCritiqueText(null)).toBe('');
      expect(normalizeCritiqueText(undefined)).toBe('');
      expect(normalizeCritiqueText(123)).toBe('');
      expect(normalizeCritiqueText({})).toBe('');
    });

    it('strips markdown fences', () => {
      expect(normalizeCritiqueText('```json\n{"critique": "hello"}\n```')).toBe('hello');
      expect(normalizeCritiqueText('```\nhello\n```')).toBe('hello');
    });

    it('decodes JSON candidate', () => {
      // JSON string
      expect(normalizeCritiqueText('"hello"')).toBe('hello');
      // JSON object with critique key
      expect(normalizeCritiqueText('{"critique": "hello world"}')).toBe('hello world');
      // Invalid JSON falls back to raw text
      expect(normalizeCritiqueText('{invalid json')).toBe('{invalid json');
    });

    it('normalizes whitespace and newlines', () => {
      // Escaped newlines
      expect(normalizeCritiqueText('line1\\nline2')).toBe('line1\nline2');
      expect(normalizeCritiqueText('line1\\r\\nline2')).toBe('line1\nline2');
      // Non-breaking spaces
      expect(normalizeCritiqueText('hello\u00a0world')).toBe('hello world');
      // Trim
      expect(normalizeCritiqueText('  hello  ')).toBe('hello');
    });

    it('unwraps quotes', () => {
      expect(normalizeCritiqueText('"hello"')).toBe('hello');
      expect(normalizeCritiqueText("'hello'")).toBe('hello');
      // Only if it wraps the whole thing
      expect(normalizeCritiqueText('"hello\'')).toBe('"hello\'');
      // Trimmed before unwrapping
      expect(normalizeCritiqueText('  "hello"  ')).toBe('hello');
    });

    it('collapses excessive newlines', () => {
      expect(normalizeCritiqueText('line1\n\n\nline2')).toBe('line1\n\nline2');
      expect(normalizeCritiqueText('line1\n\n\n\nline2')).toBe('line1\n\nline2');
    });
  });

  describe('ensureAtLeastTwoParagraphs', () => {
    it('returns empty string for empty input', () => {
      expect(ensureAtLeastTwoParagraphs('')).toBe('');
    });

    it('preserves existing multiple paragraphs', () => {
      const input = 'Para 1\n\nPara 2';
      expect(ensureAtLeastTwoParagraphs(input)).toBe(input);
    });

    it('splits a single long paragraph into two', () => {
      const input = 'Sentence one. Sentence two. Sentence three. Sentence four.';
      const output = ensureAtLeastTwoParagraphs(input);
      const paragraphs = output.split('\n\n');
      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0]).toBe('Sentence one. Sentence two.');
      expect(paragraphs[1]).toBe('Sentence three. Sentence four.');
    });

    it('splits a single long paragraph with 5 sentences', () => {
      const input = 'S1. S2. S3. S4. S5.';
      const output = ensureAtLeastTwoParagraphs(input);
      const paragraphs = output.split('\n\n');
      expect(paragraphs.length).toBe(2);
      // middle = ceil(5/2) = 3
      expect(paragraphs[0]).toBe('S1. S2. S3.');
      expect(paragraphs[1]).toBe('S4. S5.');
    });

    it('appends filler text for short single paragraph in TR', () => {
      const input = 'Kisa bir metin.';
      const output = ensureAtLeastTwoParagraphs(input, 'tr');
      const paragraphs = output.split('\n\n');
      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0]).toBe('Kisa bir metin.');
      expect(paragraphs[1]).toContain('Uygulama adimi');
    });

    it('appends filler text for short single paragraph in EN', () => {
      const input = 'A short text.';
      const output = ensureAtLeastTwoParagraphs(input, 'en');
      const paragraphs = output.split('\n\n');
      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0]).toBe('A short text.');
      expect(paragraphs[1]).toContain('Next step');
    });
  });
});
