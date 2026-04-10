import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PremiumUpgradeStep } from './PremiumUpgradeStep';

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

  it('blocks checkout when the user is not logged in', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: null,
    });

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(<PremiumUpgradeStep setStep={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^premium ol$/i }));

    expect(alertSpy).toHaveBeenCalledWith('Lütfen önce giriş yapın.');
    expect(global.fetch).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
