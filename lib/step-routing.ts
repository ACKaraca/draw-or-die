import type { GalleryType, StepType } from '@/types';

export type RouteResolution = {
  step: StepType;
  gallery?: GalleryType;
};

function normalizePathname(pathname: string): string {
  const raw = pathname.trim() || '/';
  if (raw === '/') return '/';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export function resolveStepFromPath(pathname: string): RouteResolution {
  const normalized = normalizePathname(pathname);

  if (normalized === '/mentor') return { step: 'ai-mentor' };
  if (normalized === '/history') return { step: 'history' };
  if (normalized === '/profile') return { step: 'profile' };
  if (normalized === '/profile/account') return { step: 'account-details' };
  if (normalized === '/shop') return { step: 'rapido-shop' };
  if (normalized === '/shop/premium') return { step: 'premium-upgrade' };
  if (normalized === '/gallery/hall-of-fame') {
    return { step: 'gallery', gallery: 'HALL_OF_FAME' };
  }
  if (normalized === '/gallery/wall-of-death') {
    return { step: 'gallery', gallery: 'WALL_OF_DEATH' };
  }
  if (normalized === '/community') {
    return { step: 'gallery', gallery: 'COMMUNITY' };
  }
  if (normalized === '/gallery') return { step: 'gallery' };

  return { step: 'hero' };
}

export function resolvePathFromStep(
  step: StepType,
  currentGallery: GalleryType = 'WALL_OF_DEATH',
): string {
  if (step === 'ai-mentor') return '/mentor';
  if (step === 'history') return '/history';
  if (step === 'profile') return '/profile';
  if (step === 'account-details') return '/profile/account';
  if (step === 'rapido-shop') return '/shop';
  if (step === 'premium-upgrade') return '/shop/premium';
  if (step === 'gallery') {
    if (currentGallery === 'COMMUNITY') return '/community';
    return currentGallery === 'HALL_OF_FAME'
      ? '/gallery/hall-of-fame'
      : '/gallery/wall-of-death';
  }

  return '/';
}
