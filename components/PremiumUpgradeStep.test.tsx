import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PremiumUpgradeStep } from './PremiumUpgradeStep';
import { STRIPE_PRICES } from '@/lib/pricing';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/appwrite', () => ({
  account: {
    createJWT: jest.fn().mockResolvedValue({ jwt: 'mock-jwt' }),
  },
}));

const mockedUseAuth = jest.requireMock('@/hooks/useAuth').useAuth as jest.Mock;

describe('PremiumUpgradeStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders the premium tab and opens checkout for logged in users', async () => {
    mockedUseAuth.mockReturnValue({
      user: { email: 'student@school.edu.tr' },
      profile: { is_premium: false, rapido_pens: 18 },
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ url: 'https://checkout.example/test' }),
    });

    render(<PremiumUpgradeStep setStep={jest.fn()} />);

    expect(screen.getByText(/premium & rapido mağaza/i)).toBeTruthy();
    expect(screen.getByText(/edu\.tr e-posta ile öğrenci fiyatlandırması uygulandı/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^premium ol$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/checkout',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    await screen.findByText(/premium ol/i);
  });

  it('opens the auth modal instead of checkout when the user is not logged in', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: null,
    });
    useDrawOrDieStore.getState().setIsAuthModalOpen(false);

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(<PremiumUpgradeStep setStep={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^premium ol$/i }));

    expect(useDrawOrDieStore.getState().isAuthModalOpen).toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('shows an inline error card when checkout cannot be started', async () => {
    mockedUseAuth.mockReturnValue({
      user: { email: 'architect@example.com' },
      profile: { is_premium: false, rapido_pens: 18 },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({}),
    });

    render(<PremiumUpgradeStep setStep={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^premium ol$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/ödeme sayfası açılamadı/i);
  });

  it('derives the Akdeniz campaign price from pricing config', () => {
    mockedUseAuth.mockReturnValue({
      user: { email: 'student@ogr.akdeniz.edu.tr' },
      profile: { is_premium: false, rapido_pens: 18 },
    });

    render(<PremiumUpgradeStep setStep={jest.fn()} />);

    const expectedPrice = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: STRIPE_PRICES.AKDENIZ_STUDENT.CURRENCY.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(STRIPE_PRICES.AKDENIZ_STUDENT.MONTHLY / 100);
    expect(screen.getByText((content) => content.includes('kampanyası aktif') && content.includes(expectedPrice)))
      .toBeTruthy();
  });
});
