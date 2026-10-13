import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AccountDataCard } from '@/components/AccountDataCard';
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/privacy/constants';

const mockSignOut = jest.fn(async () => undefined);

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    profile: { is_premium: false },
    getJWT: async () => 'jwt-token',
    signOut: mockSignOut,
  }),
}));

describe('AccountDataCard', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('keeps the destructive confirm disabled until the confirmation word is typed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ request: { status: 'completed' } }),
    });
    render(<AccountDataCard />);

    await userEvent.click(screen.getByRole('button', { name: /hesabımı sil/i }));
    const dialog = await screen.findByRole('dialog');
    const confirm = Array.from(dialog.querySelectorAll('button')).find((button) => /hesabımı sil/i.test(button.textContent ?? ''));
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/onaylamak için/i), 'sil');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/account/delete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ confirmation: ACCOUNT_DELETION_CONFIRMATION });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token');
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it('does not sign out and explains a partial deletion', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ request: { status: 'partial' } }),
    });
    render(<AccountDataCard />);

    await userEvent.click(screen.getByRole('button', { name: /hesabımı sil/i }));
    await userEvent.type(await screen.findByLabelText(/onaylamak için/i), 'SİL');
    const dialog = screen.getByRole('dialog');
    const confirm = Array.from(dialog.querySelectorAll('button')).find((button) => /hesabımı sil/i.test(button.textContent ?? ''));
    await userEvent.click(confirm!);

    expect(await screen.findByRole('status')).toHaveTextContent(/kaldığı yerden devam eder/i);
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
