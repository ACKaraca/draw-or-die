import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import { pickLocalized } from './i18n';

import { type SupportedLanguage } from './i18n';
export function safeRedirect(url: string, language: SupportedLanguage = 'tr'): string {
    const redirectUrl = new URL(url, window.location.origin);
    if (redirectUrl.protocol !== 'http:' && redirectUrl.protocol !== 'https:') {
        throw new Error(pickLocalized(language, 'Geçersiz yönlendirme adresi.', 'Invalid redirect URL.'));
    }
    return redirectUrl.toString();
}
