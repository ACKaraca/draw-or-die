import { fireEvent, render, screen } from '@testing-library/react';
import { Header } from '@/components/Header';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: null,
    profile: null,
    loading: false,
    signOut: jest.fn(),
  })),
}));

describe('Header navigation', () => {
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
});
