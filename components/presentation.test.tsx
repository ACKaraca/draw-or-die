import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@/components/Header';
import { HeroStep } from '@/components/HeroStep';
import { ChatDefense } from '@/components/ChatDefense';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockedUseAuth = jest.requireMock('@/hooks/useAuth').useAuth as jest.Mock;

describe('presentation components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the guest header and opens auth from the login button', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: jest.fn(),
    });

    const onAuthClick = jest.fn();

    render(
      <Header
        goHome={jest.fn()}
        setCurrentGallery={jest.fn()}
        setStep={jest.fn()}
        onAuthClick={onAuthClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /log in \/ join/i }));

    expect(onAuthClick).toHaveBeenCalledTimes(1);
  });

  it('renders the hero CTA and gallery shortcut', () => {
    render(
      <HeroStep
        setStep={jest.fn()}
        setCurrentGallery={jest.fn()}
        galleryItems={[]}
      />,
    );

    expect(screen.getByRole('heading', { name: /sisteme paftanı at ve jüriyle yüzleş/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /studio desk'e geç/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /tümünü gör/i })).toBeTruthy();
  });

  it('hides the defense panel for non-premium users and renders the chat flow for premium users', () => {
    const { rerender, container } = render(
      <ChatDefense
        isPremiumUser={false}
        isDefending={false}
        setIsDefending={jest.fn()}
        defenseTurnCount={0}
        defenseMessages={[]}
        isDefenseLoading={false}
        defenseInput=""
        setDefenseInput={jest.fn()}
        handleDefenseSubmit={jest.fn()}
      />,
    );

    expect(container).toBeTruthy();
    expect(screen.queryByText(/projeyi savun/i)).toBeNull();

    const setIsDefending = jest.fn();
    const setDefenseInput = jest.fn();
    const handleDefenseSubmit = jest.fn();

    rerender(
      <ChatDefense
        isPremiumUser
        isDefending
        setIsDefending={setIsDefending}
        defenseTurnCount={1}
        defenseMessages={[
          { role: 'user', text: 'We designed for resilience.' },
          { role: 'jury', text: 'Show the evidence.' },
        ]}
        isDefenseLoading={false}
        defenseInput="Draft response"
        setDefenseInput={setDefenseInput}
        handleDefenseSubmit={handleDefenseSubmit}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/mesajınızı yazın/i), {
      target: { value: 'Updated response' },
    });
    expect(setDefenseInput).toHaveBeenCalledWith('Updated response');
    fireEvent.click(screen.getAllByRole('button').at(-1)!);
    expect(handleDefenseSubmit).toHaveBeenCalledTimes(1);
  });
});
