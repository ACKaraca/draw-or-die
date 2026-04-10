import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { account } from '@/lib/appwrite';

jest.mock('@/lib/appwrite', () => ({
  account: {
    get: jest.fn(),
    createJWT: jest.fn(),
    createAnonymousSession: jest.fn(),
    createOAuth2Session: jest.fn(),
    deleteSession: jest.fn(),
  },
}));

const mockedAccount = jest.mocked(account);
const mockedFetch = jest.fn();

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockedFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        profile: {
          id: 'user-1',
          email: 'user@example.com',
          is_premium: false,
          rapido_pens: 15,
          progression_score: 0,
          wall_of_death_count: 0,
          earned_badges: [],
        },
      }),
    });
    global.fetch = mockedFetch as unknown as typeof fetch;

    mockedAccount.get.mockRejectedValue(new Error('no session'));
    mockedAccount.createJWT.mockResolvedValue({ jwt: 'jwt-token' } as never);
    mockedAccount.createAnonymousSession.mockResolvedValue({} as never);
    mockedAccount.deleteSession.mockResolvedValue({} as never);
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  }

  it('initializes with no session and clears loading', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(mockedAccount.get).not.toHaveBeenCalled();
  });

  it('fetches profile for authenticated session and refreshes on demand', async () => {
    window.localStorage.setItem('dod_has_appwrite_session', '1');
    mockedAccount.get.mockResolvedValue({
      $id: 'user-1',
      email: 'user@example.com',
      name: 'User One',
    } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.profile?.id).toBe('user-1'));

    expect(result.current.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      identities: [{ provider: 'email' }],
    });

    await act(async () => {
      await result.current.refreshProfile();
    });

    expect(mockedAccount.createJWT).toHaveBeenCalledTimes(2);
    expect(mockedFetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
    }));
  });

  it('signs in anonymously and reloads session', async () => {
    mockedAccount.get.mockResolvedValueOnce({ $id: 'anon-1', email: null, name: null } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signInAnonymously();
    });

    expect(mockedAccount.createAnonymousSession).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.user?.id).toBe('anon-1');
    expect(result.current.user?.identities?.[0]?.provider).toBe('anonymous');
  });

  it('signs out and clears local auth state', async () => {
    window.localStorage.setItem('dod_has_appwrite_session', '1');
    mockedAccount.get.mockResolvedValue({
      $id: 'user-1',
      email: 'user@example.com',
      name: 'User One',
    } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.user?.id).toBe('user-1'));

    mockedAccount.get.mockRejectedValueOnce(new Error('signed out'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockedAccount.deleteSession).toHaveBeenCalledWith('current');
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });
});
