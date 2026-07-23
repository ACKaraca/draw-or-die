import {
  buildDesignInsightPrompt,
  isDesignInsightOperation,
} from '@/lib/design-insights';

describe('design insights', () => {
  it('recognizes only supported design insight operations', () => {
    expect(isDesignInsightOperation('DRAWING_CONSISTENCY')).toBe(true);
    expect(isDesignInsightOperation('SKILL_ROADMAP')).toBe(true);
    expect(isDesignInsightOperation('SINGLE_JURY')).toBe(false);
  });

  it('keeps accessibility output explicitly advisory', () => {
    const prompt = buildDesignInsightPrompt('ACCESSIBILITY_EGRESS', {
      topic: 'Library',
    });

    expect(prompt).toContain('preliminary visual review');
    expect(prompt).toContain('not a code-compliance certification');
  });

  it('grounds skill roadmaps in critique history', () => {
    const prompt = buildDesignInsightPrompt('SKILL_ROADMAP', {
      currentCritique: 'Circulation hierarchy is unclear.',
      memorySnippets: [{ snippet: 'Sections lack depth cues.' }],
    });

    expect(prompt).toContain('30-day skill roadmap');
    expect(prompt).toContain('Circulation hierarchy is unclear.');
    expect(prompt).toContain('Sections lack depth cues.');
  });
});
