import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReferralCard } from '@/components/ReferralCard';

const mockedUseAuth = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockedUseAuth(),
}));

describe('ReferralCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders drawordie.app referral link and signup count', async () => {
    mockedUseAuth.mockReturnValue({
      profile: {
        referral_code: 'ABCD1234',
        referral_signup_count: 7,
      },
    });

    render(<ReferralCard />);

    expect(screen.getByText('Toplam referral kaydı')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('https://drawordie.app/?ref=ABCD1234')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /kopyala/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://drawordie.app/?ref=ABCD1234');
    });
  });

  it('does not render when referral code is missing', () => {
    mockedUseAuth.mockReturnValue({
      profile: {
        referral_code: null,
        referral_signup_count: 0,
      },
    });

    const { container } = render(<ReferralCard />);

    expect(container.firstChild).toBeNull();
  });
});
