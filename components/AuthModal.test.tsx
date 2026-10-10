import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AuthModal } from '@/components/AuthModal';
import { account } from '@/lib/appwrite';

jest.mock('@/lib/appwrite', () => ({
  account: {
    createEmailPasswordSession: jest.fn(),
    create: jest.fn(),
    createVerification: jest.fn(),
    createRecovery: jest.fn(),
    createJWT: jest.fn(),
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

jest.mock('@/lib/growth-tracking', () => ({
  trackConversionEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/logger', () => ({
  reportClientError: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/ReferralCapture', () => ({
  REFERRAL_STORAGE_KEY: 'dod_referral_code_test',
}));

const mockedAccount = jest.mocked(account);
const mockedUseAuth = jest.requireMock('@/hooks/useAuth').useAuth as jest.Mock;

function renderModal(onClose = jest.fn()) {
  render(<AuthModal isOpen onClose={onClose} />);
  return onClose;
}

describe('AuthModal', () => {
  const signInAnonymously = jest.fn();
  const reloadSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      signInAnonymously,
      signInWithGoogle: jest.fn(),
      reloadSession,
    });
    reloadSession.mockResolvedValue(undefined);
    global.fetch = jest.fn();
  });

  it('is an accessible modal dialog with a labelled close button and initial focus', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: /tekrar hoş geldin/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: /^kapat$/i })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(/e-posta/i));
  });

  it('closes on Escape', () => {
    const onClose = renderModal();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('maps Appwrite invalid-credential errors to localized copy', async () => {
    mockedAccount.createEmailPasswordSession.mockRejectedValueOnce(
      Object.assign(new Error('Invalid credentials. Please check the email and password.'), {
        type: 'user_invalid_credentials',
        code: 401,
      }),
    );
    const onClose = renderModal();

    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: 'mimar@example.com' } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: /^giriş yap$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('E-posta veya şifre hatalı');
    expect(alert).not.toHaveTextContent(/invalid credentials/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the modal open after sign-up so the verification notice is seen', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ canonicalEmail: 'yeni@example.com' }),
    });
    mockedAccount.create.mockResolvedValue({} as never);
    mockedAccount.createEmailPasswordSession.mockResolvedValue({} as never);
    mockedAccount.createVerification.mockResolvedValue({} as never);
    const onClose = renderModal();

    fireEvent.click(screen.getAllByRole('button', { name: /^kayıt ol$/i })[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText(/ad soyad/i), { target: { value: 'Yeni Mimar' } });
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: 'yeni@example.com' } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: 'super-secret-123' } });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText(/e-posta/i).closest('form') as HTMLFormElement);
    });

    expect(await screen.findByRole('dialog', { name: /hesabın oluşturuldu/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/doğrulama bağlantısı gönderdik/i);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /devam et/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows guest sign-in failures instead of swallowing them', async () => {
    signInAnonymously.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const onClose = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /misafir olarak devam et/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/bağlantı sorunu/i);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
