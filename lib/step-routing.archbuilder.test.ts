import { resolvePathFromStep, resolveStepFromPath } from '@/lib/step-routing';

describe('step-routing archbuilder mapping', () => {
  it('resolves /archbuilder path to archbuilder step', () => {
    expect(resolveStepFromPath('/archbuilder')).toEqual({ step: 'archbuilder' });
  });

  it('resolves archbuilder step to /archbuilder path', () => {
    expect(resolvePathFromStep('archbuilder')).toBe('/archbuilder');
  });
});
