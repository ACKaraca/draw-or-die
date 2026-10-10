import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Header } from '@/components/Header';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = jest.requireMock('@/hooks/useAuth').useAuth as jest.Mock;

describe('Header navigation', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: jest.fn(),
    });
  });

  it('shows only live navigation items and excludes mock-only features', () => {
    render(
      <Header
        goHome={jest.fn()}
        setCurrentGallery={jest.fn()}
        setStep={jest.fn()}
        onAuthClick={jest.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: /studio desk/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /ai mentor/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /community/i }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /galeri|gallery/i }));
    expect(screen.getAllByRole('button', { name: /hall of fame/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /wall of death/i }).length).toBeGreaterThan(0);

    expect(screen.queryByRole('button', { name: /weekly charettes/i })).not.toBeTruthy();
    expect(screen.queryByRole('button', { name: /leaderboard/i })).not.toBeTruthy();
    expect(screen.queryByRole('button', { name: /peer review/i })).not.toBeTruthy();
    expect(screen.queryByRole('button', { name: /confessions/i })).not.toBeTruthy();
    expect(screen.queryByRole('button', { name: /portfol/i })).not.toBeTruthy();
  });

  it('renders a neutral placeholder instead of the login button while the session restores', () => {
    mockedUseAuth.mockReturnValueOnce({ user: null, profile: null, loading: true, signOut: jest.fn() });

    render(
      <Header goHome={jest.fn()} setCurrentGallery={jest.fn()} setStep={jest.fn()} onAuthClick={jest.fn()} />,
    );

    expect(screen.queryByRole('button', { name: /giriş yap/i })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: /oturum kontrol ediliyor/i })).toBeInTheDocument();
  });

  it('uses proper Turkish copy for the login button', () => {
    render(
      <Header goHome={jest.fn()} setCurrentGallery={jest.fn()} setStep={jest.fn()} onAuthClick={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: /giriş yap \/ katıl/i })).toBeInTheDocument();
  });

  it('lets signed-in users sign out from the mobile menu', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'mimar@example.com', name: 'Mimar', identities: [{ provider: 'email' }] },
      profile: { is_premium: false, rapido_pens: 12, progression_score: 3 },
      loading: false,
      signOut,
    });

    render(
      <Header goHome={jest.fn()} setCurrentGallery={jest.fn()} setStep={jest.fn()} onAuthClick={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /mobil menüyü aç/i }));
    const mobileMenu = document.getElementById('mobile-menu');
    expect(mobileMenu).not.toBeNull();

    fireEvent.click(within(mobileMenu as HTMLElement).getByRole('button', { name: /çıkış yap/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(document.getElementById('mobile-menu')).toBeNull();
  });
});
