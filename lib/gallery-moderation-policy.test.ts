import {
  decidePublication,
  detectPromptInjection,
  findClientApprovalFields,
  isPubliclyVisibleGalleryRow,
  parseModerationVerdict,
  pendingVerdict,
} from '@/lib/gallery-moderation-policy';
import { GALLERY_CONSENT_VERSION, buildGalleryConsent, validateGalleryConsent } from '@/lib/gallery-consent';
import { BENIGN_CRITIQUE_CORPUS, PROMPT_INJECTION_CORPUS } from '@/__tests__/fixtures/prompt-injection-corpus';

describe('gallery moderation policy', () => {
  it.each([
    [undefined],
    [''],
    ['not json'],
    ['[]'],
    ['{"approved":"true","category":"SAFE"}'],
    ['{"approved":1,"category":"SAFE"}'],
    ['{"approved":true}'],
    ['{"approved":true,"category":"SENSITIVE"}'],
    ['{"approved":true,"category":"safe"}'],
    ['{"category":"SAFE"}'],
  ])('maps uncertain model output %j to pending', (raw) => {
    expect(parseModerationVerdict(raw).kind).toBe('pending');
  });

  it('approves only a strict SAFE verdict, including a fenced one', () => {
    expect(parseModerationVerdict('{"approved":true,"category":"SAFE","reason":"ok"}').kind).toBe('approved');
    expect(parseModerationVerdict('```json\n{"approved":true,"category":"SAFE"}\n```').kind).toBe('approved');
  });

  it('rejects explicit negative verdicts', () => {
    expect(parseModerationVerdict('{"approved":false,"category":"REJECT","reason":"nsfw"}')).toMatchObject({
      kind: 'rejected',
      category: 'REJECT',
      reason: 'nsfw',
    });
  });

  it.each(PROMPT_INJECTION_CORPUS)('flags injection attempt: %s', (text) => {
    expect(detectPromptInjection(text)).toBe(true);
  });

  it.each(BENIGN_CRITIQUE_CORPUS)('does not flag ordinary critique: %s', (text) => {
    expect(detectPromptInjection(text)).toBe(false);
  });

  it('never lets injected content reach approved even with a SAFE verdict', () => {
    const safe = parseModerationVerdict('{"approved":true,"category":"SAFE"}');
    for (const text of PROMPT_INJECTION_CORPUS) {
      expect(decidePublication(safe, { isInjectionSuspected: detectPromptInjection(text) })).toBe('pending');
    }
  });

  it('maps unavailable/uncertain verdicts to pending and keeps rejections', () => {
    expect(decidePublication(pendingVerdict('unavailable'), { isInjectionSuspected: false })).toBe('pending');
    expect(decidePublication(pendingVerdict('uncertain'), { isInjectionSuspected: false })).toBe('pending');
    expect(decidePublication(parseModerationVerdict('{"approved":false}'), { isInjectionSuspected: true }))
      .toBe('rejected');
  });

  it('exposes only approved, non-revoked rows publicly', () => {
    expect(isPubliclyVisibleGalleryRow({ status: 'approved' })).toBe(true);
    expect(isPubliclyVisibleGalleryRow({ status: 'approved', revoked_at: '2026-10-01T00:00:00Z' })).toBe(false);
    expect(isPubliclyVisibleGalleryRow({ status: 'pending' })).toBe(false);
    expect(isPubliclyVisibleGalleryRow({ status: 'archived' })).toBe(false);
    expect(isPubliclyVisibleGalleryRow({ status: 'rejected' })).toBe(false);
  });

  it('detects client attempts to set approval state', () => {
    expect(findClientApprovalFields({ title: 'x', autoApproved: true, status: 'approved' }))
      .toEqual(['autoApproved', 'status']);
    expect(findClientApprovalFields(null)).toEqual([]);
  });
});

describe('gallery consent', () => {
  it('accepts the client-built consent and stamps a server timestamp', () => {
    const now = new Date('2026-10-13T10:00:00.000Z');
    expect(validateGalleryConsent(buildGalleryConsent('COMMUNITY'), 'COMMUNITY', now)).toEqual({
      isValid: true,
      consent: { scope: 'COMMUNITY', version: GALLERY_CONSENT_VERSION, consentedAt: now.toISOString() },
    });
  });

  it.each([
    [undefined, 'GALLERY_CONSENT_REQUIRED'],
    [true, 'GALLERY_CONSENT_REQUIRED'],
    [{ granted: true, version: GALLERY_CONSENT_VERSION, scope: 'WALL_OF_DEATH' }, 'GALLERY_CONSENT_SCOPE_MISMATCH'],
    [{ granted: true, version: 'v0', scope: 'COMMUNITY' }, 'GALLERY_CONSENT_VERSION_MISMATCH'],
  ])('refuses %j', (raw, code) => {
    expect(validateGalleryConsent(raw, 'COMMUNITY')).toEqual({ isValid: false, code });
  });
});
