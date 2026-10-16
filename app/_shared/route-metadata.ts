import { cookies, headers } from 'next/headers';

import {
  normalizeLanguage,
  pickLocalized,
  resolveLanguageFromAcceptLanguage,
  type SupportedLanguage,
} from '@/lib/i18n';
import { resolveSiteUrl } from '@/lib/site-identity';

import type { Metadata } from 'next';

// Never a legacy domain; production metadata uses resolveMetadataBase() instead.
export const SITE_URL = resolveSiteUrl();

// Must match UI_LANGUAGE_STORAGE_KEY in components/RuntimeTextLocalizer.tsx (client module, not importable here).
const UI_LANGUAGE_COOKIE = 'dod_ui_language';

type RouteMetadataInput = {
  titleTr: string;
  titleEn: string;
  descriptionTr: string;
  descriptionEn: string;
  /** Only set for leaf routes; a canonical on a layout would leak into nested routes. */
  canonicalPath?: string;
};

/** Server-side UI language: explicit cookie choice first, then the browser's Accept-Language, then Turkish. */
export async function resolveServerLanguage(): Promise<SupportedLanguage> {
  try {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get(UI_LANGUAGE_COOKIE)?.value;
    if (fromCookie) return normalizeLanguage(fromCookie, 'tr');

    const headerStore = await headers();
    return resolveLanguageFromAcceptLanguage(headerStore.get('accept-language'), 'tr');
  } catch {
    return 'tr';
  }
}

export const SITE_TITLE_TEMPLATE = '%s | Draw or Die';

export async function buildRouteMetadata(input: RouteMetadataInput): Promise<Metadata> {
  const language = await resolveServerLanguage();
  const metadata: Metadata = {
    // Object form (not a plain string): a string title on a layout would drop the template for nested routes.
    title: {
      default: pickLocalized(language, input.titleTr, input.titleEn),
      template: SITE_TITLE_TEMPLATE,
    },
    description: pickLocalized(language, input.descriptionTr, input.descriptionEn),
  };

  if (input.canonicalPath) {
    metadata.alternates = { canonical: input.canonicalPath };
  }

  return metadata;
}
