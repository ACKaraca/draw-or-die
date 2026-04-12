export type CanonicalEmailResult = {
  normalizedEmail: string;
  canonicalEmail: string;
  isGmailFamily: boolean;
  gmailCanonicalized: boolean;
};

const GMAIL_FAMILY_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function canonicalizeAuthEmail(value: string): CanonicalEmailResult {
  const normalizedEmail = normalizeEmail(value);
  const atIndex = normalizedEmail.lastIndexOf('@');

  if (atIndex <= 0 || atIndex >= normalizedEmail.length - 1) {
    return {
      normalizedEmail,
      canonicalEmail: normalizedEmail,
      isGmailFamily: false,
      gmailCanonicalized: false,
    };
  }

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);
  const isGmailFamily = GMAIL_FAMILY_DOMAINS.has(domain);

  if (!isGmailFamily) {
    return {
      normalizedEmail,
      canonicalEmail: normalizedEmail,
      isGmailFamily: false,
      gmailCanonicalized: false,
    };
  }

  const canonicalLocalPart = localPart.replace(/\./g, '');
  return {
    normalizedEmail,
    canonicalEmail: `${canonicalLocalPart}@gmail.com`,
    isGmailFamily: true,
    gmailCanonicalized: canonicalLocalPart !== localPart || domain !== 'gmail.com',
  };
}

export function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
