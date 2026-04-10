import { act, renderHook, waitFor } from '@testing-library/react';
import { useGallery } from '@/hooks/useGallery';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import type { GalleryItem } from '@/types';

jest.mock('@/stores/drawOrDieStore', () => ({
  useDrawOrDieStore: jest.fn(),
}));

const mockedStore = jest.mocked(useDrawOrDieStore);

describe('useGallery', () => {
  const fetchMock = jest.fn();

  let galleryItemsState: GalleryItem[];
  const setGalleryItems = jest.fn(
    (value: GalleryItem[] | ((prev: GalleryItem[]) => GalleryItem[])) => {
      galleryItemsState = typeof value === 'function' ? value(galleryItemsState) : value;
    }
  );

  beforeEach(() => {
    jest.clearAllMocks();
    galleryItemsState = [];

    mockedStore.mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector({ setGalleryItems, galleryItems: galleryItemsState });
      }
      return { setGalleryItems, galleryItems: galleryItemsState };
    });

    global.fetch = fetchMock as typeof fetch;
  });

  it('fetches the first page and sets gallery items on refresh', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: '1',
            img: 'https://cdn.example.com/1.png',
            title: 'Gallery One',
            jury: 'Strong concept',
            type: 'HALL_OF_FAME',
          },
        ],
        total: 1,
      }),
    });

    const { result } = renderHook(() => useGallery());

    await act(async () => {
      await result.current.fetchGallery({ refresh: true });
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/gallery?limit=20&offset=0', {
      method: 'GET',
    });
    expect(setGalleryItems).toHaveBeenCalledWith([
      {
        id: '1',
        img: 'https://cdn.example.com/1.png',
        title: 'Gallery One',
        jury: 'Strong concept',
        type: 'HALL_OF_FAME',
      },
    ]);
    expect(result.current.currentFilter).toBeNull();
    expect(result.current.hasMore).toBe(false);
  });

  it('paginates from offset 20 when loading more', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: '1',
              img: 'https://cdn.example.com/1.png',
              title: 'Page One',
              jury: 'First page',
              type: 'HALL_OF_FAME',
            },
          ],
          total: 40,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: '2',
              img: 'https://cdn.example.com/2.png',
              title: 'Page Two',
              jury: 'Second page',
              type: 'WALL_OF_DEATH',
            },
          ],
          total: 40,
        }),
      });

    const { result } = renderHook(() => useGallery());

    await act(async () => {
      await result.current.fetchGallery({ refresh: true });
    });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/gallery?limit=20&offset=0', {
      method: 'GET',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/gallery?limit=20&offset=20', {
      method: 'GET',
    });

    expect(galleryItemsState).toEqual([
      {
        id: '1',
        img: 'https://cdn.example.com/1.png',
        title: 'Page One',
        jury: 'First page',
        type: 'HALL_OF_FAME',
      },
      {
        id: '2',
        img: 'https://cdn.example.com/2.png',
        title: 'Page Two',
        jury: 'Second page',
        type: 'WALL_OF_DEATH',
      },
    ]);
  });

  it('surfaces API errors from gallery endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Galeri patladı.' }),
    });

    const { result } = renderHook(() => useGallery());

    await act(async () => {
      await result.current.fetchGallery({ refresh: true });
    });

    await waitFor(() => expect(result.current.error).toBe('Galeri patladı.'));
  });
});
