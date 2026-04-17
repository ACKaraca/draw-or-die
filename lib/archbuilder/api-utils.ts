import type { SupportedLanguage } from '@/lib/i18n';
import { pickLocalized } from '@/lib/i18n';
import { getFeatureFlag } from '@/lib/appwrite/server';

const ARCHBUILDER_FEATURE_FLAG_KEY = 'archbuilder_enabled';

export type ArchBuilderAccessState = 'enabled' | 'disabled' | 'not-allowlisted';

export function isArchBuilderServerUnavailable(): boolean {
  return !(process.env.APPWRITE_API_KEY ?? '').trim();
}

function parseArchBuilderAllowlist(valueJson?: string): string[] {
  if (!valueJson) return [];

  try {
    const parsed = JSON.parse(valueJson) as { allowlist?: unknown };
    if (!parsed || !Array.isArray(parsed.allowlist)) return [];

    return parsed.allowlist
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

export async function getArchBuilderAccessForUser(userId: string): Promise<ArchBuilderAccessState> {
  if ((process.env.FEATURE_ARCHBUILDER_ENABLED ?? '').trim().toLowerCase() === 'true') {
    return 'enabled';
  }

  try {
    const flag = await getFeatureFlag(ARCHBUILDER_FEATURE_FLAG_KEY);
    if (!flag?.enabled) {
      return 'disabled';
    }

    const allowlist = parseArchBuilderAllowlist(flag.value_json);
    if (!allowlist.length) {
      return 'enabled';
    }

    return allowlist.includes(userId) ? 'enabled' : 'not-allowlisted';
  } catch {
    return 'disabled';
  }
}

export function parseSessionIdFromArchBuilderPath(pathname: string): string | null {
  const match = /^\/api\/archbuilder\/sessions\/([^/]+)(?:\/|$)/i.exec(pathname);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function localizedArchBuilderMessage(
  language: SupportedLanguage,
  trText: string,
  enText: string,
): string {
  return pickLocalized(language, trText, enText);
}
