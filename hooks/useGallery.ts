'use client';

/**
 * useGallery.ts
 *
 * Fetches public gallery submissions from Appwrite-backed API and populates the
 * Zustand store's galleryItems. Supports pagination and filtering.
 * Only fetches approved submissions for public viewing.
 *
 * Usage:
 *   const { fetchGallery, loadMore, isLoading, error, hasMore } = useGallery();
 *   useEffect(() => { fetchGallery(); }, []);
 *   // For pagination: loadMore()
 */

import { useState, useCallback, useRef } from 'react';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import { GalleryItem, GalleryType } from '@/types';

const PAGE_SIZE = 15;

interface FetchOptions {
  type?: GalleryType;
  refresh?: boolean;
}

export function useGallery() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<GalleryType | null>(null);
  const isLoadingRef = useRef(false);
  const pageRef = useRef(0);
  const currentFilterRef = useRef<GalleryType | null>(null);
  const setGalleryItems = useDrawOrDieStore((s) => s.setGalleryItems);
  const galleryItems = useDrawOrDieStore((s) => s.galleryItems);

  const fetchGallery = useCallback(async (options?: FetchOptions) => {
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    const filterType = options?.type ?? currentFilterRef.current;
    const refresh = options?.refresh ?? false;

    if (refresh) {
      pageRef.current = 0;
      setHasMore(true);
    }

    try {
      const currentPage = refresh ? 0 : pageRef.current;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(currentPage * PAGE_SIZE),
      });

      if (filterType) {
        params.set('type', filterType);
      }

      const response = await fetch(`/api/gallery?${params.toString()}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'Galeri yüklenemedi.'
        );
      }

      const payload = (await response.json()) as {
        items?: GalleryItem[];
        total?: number;
      };

      const items = Array.isArray(payload.items) ? payload.items : [];
      const total = typeof payload.total === 'number' ? payload.total : 0;

      if (refresh) {
        setGalleryItems(items);
      } else {
        setGalleryItems((prev) => [...prev, ...items]);
      }

      const nextPage = currentPage + 1;
      pageRef.current = nextPage;
      currentFilterRef.current = filterType ?? null;
      setCurrentFilter(filterType ?? null);
      setHasMore(nextPage * PAGE_SIZE < total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Galeri yüklenemedi.';
      setError(message);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [setGalleryItems]);

  const loadMore = useCallback(async () => {
    if (!isLoading && hasMore) {
      await fetchGallery({ type: currentFilterRef.current ?? undefined });
    }
  }, [isLoading, hasMore, fetchGallery]);

  const filterByType = useCallback(async (type: GalleryType | null) => {
    await fetchGallery({ type: type ?? undefined, refresh: true });
  }, [fetchGallery]);

  return {
    fetchGallery,
    loadMore,
    filterByType,
    isLoading,
    error,
    hasMore,
    currentFilter,
    totalItems: galleryItems.length,
  };
}
