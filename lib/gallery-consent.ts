import type { GalleryType } from '@/types';

/**
 * Bump whenever the publish copy shown to the user changes meaning, so recorded consent
 * always points at the wording the user actually agreed to.
 */
export const GALLERY_CONSENT_VERSION = '2026-10-gallery-publish-v1';

export type GalleryConsentPayload = {
  granted: true;
  version: string;
  scope: GalleryType;
};

export type RecordedGalleryConsent = {
  scope: GalleryType;
  version: string;
  consentedAt: string;
};

export type GalleryConsentCheck =
  | { isValid: true; consent: RecordedGalleryConsent }
  | {
    isValid: false;
    code: 'GALLERY_CONSENT_REQUIRED' | 'GALLERY_CONSENT_SCOPE_MISMATCH' | 'GALLERY_CONSENT_VERSION_MISMATCH';
  };

/** Client helper: only call from an explicit user publish action (button click). */
export function buildGalleryConsent(scope: GalleryType): GalleryConsentPayload {
  return { granted: true, version: GALLERY_CONSENT_VERSION, scope };
}

/**
 * Server check. The timestamp is server-issued; nothing about consent time or approval
 * state is taken from the client.
 */
export function validateGalleryConsent(
  raw: unknown,
  galleryType: GalleryType,
  now: Date = new Date(),
): GalleryConsentCheck {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { isValid: false, code: 'GALLERY_CONSENT_REQUIRED' };
  }

  const candidate = raw as Record<string, unknown>;
  if (candidate.granted !== true) {
    return { isValid: false, code: 'GALLERY_CONSENT_REQUIRED' };
  }

  if (candidate.scope !== galleryType) {
    return { isValid: false, code: 'GALLERY_CONSENT_SCOPE_MISMATCH' };
  }

  if (candidate.version !== GALLERY_CONSENT_VERSION) {
    return { isValid: false, code: 'GALLERY_CONSENT_VERSION_MISMATCH' };
  }

  return {
    isValid: true,
    consent: { scope: galleryType, version: GALLERY_CONSENT_VERSION, consentedAt: now.toISOString() },
  };
}
