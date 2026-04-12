import { canonicalizeAuthEmail, isValidEmailFormat } from '@/lib/auth-email';

describe('auth email canonicalization', () => {
  it('keeps non-gmail emails as normalized lowercase values', () => {
    const result = canonicalizeAuthEmail('  User.Name@Example.com ');

    expect(result.normalizedEmail).toBe('user.name@example.com');
    expect(result.canonicalEmail).toBe('user.name@example.com');
    expect(result.isGmailFamily).toBe(false);
    expect(result.gmailCanonicalized).toBe(false);
  });

  it('removes dots for gmail.com local parts', () => {
    const result = canonicalizeAuthEmail('John.Doe+studio@gmail.com');

    expect(result.normalizedEmail).toBe('john.doe+studio@gmail.com');
    expect(result.canonicalEmail).toBe('johndoe+studio@gmail.com');
    expect(result.isGmailFamily).toBe(true);
    expect(result.gmailCanonicalized).toBe(true);
  });

  it('normalizes googlemail.com into gmail.com canonical form', () => {
    const result = canonicalizeAuthEmail('Jo.hn.Do.e@googlemail.com');

    expect(result.canonicalEmail).toBe('johndoe@gmail.com');
    expect(result.isGmailFamily).toBe(true);
    expect(result.gmailCanonicalized).toBe(true);
  });

  it('marks already canonical gmail addresses as not transformed', () => {
    const result = canonicalizeAuthEmail('johndoe@gmail.com');

    expect(result.canonicalEmail).toBe('johndoe@gmail.com');
    expect(result.gmailCanonicalized).toBe(false);
  });

  it('validates email format with a minimal auth-safe regex', () => {
    expect(isValidEmailFormat('student@gmail.com')).toBe(true);
    expect(isValidEmailFormat('missing-at-sign')).toBe(false);
    expect(isValidEmailFormat('')).toBe(false);
  });
});
