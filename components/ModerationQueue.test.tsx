import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ModerationQueue } from '@/components/ModerationQueue';

const AUTH = { user: { id: 'mod' }, loading: false, getJWT: jest.fn().mockResolvedValue('jwt') };

jest.mock('@/hooks/useAuth', () => ({ useAuth: () => AUTH }));

function jsonResponse(status: number, body: unknown = {}) {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}

const QUEUE = {
  items: [{ id: 'g1', title: 'Library', jury: 'Weak section', type: 'COMMUNITY', createdAt: '2026-10-01', imageUrl: null }],
  confessions: [{ id: 'c1', text: 'No sleep again', createdAt: '2026-10-02', imageUrl: null }],
};

describe('ModerationQueue', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('shows only the regular 404 page when the API does not answer 200', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404));
    render(<ModerationQueue />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByText(/Sayfa bulunamadı/)).toBeInTheDocument();
    expect(screen.queryByText('Library')).not.toBeInTheDocument();
  });

  it('puts a decided item back in the queue when the decision fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, QUEUE)).mockResolvedValueOnce(jsonResponse(500));
    render(<ModerationQueue />);

    await screen.findByText('Library');
    await userEvent.type(screen.getByLabelText(/Ret notu/), 'spam');
    await userEvent.click(screen.getByRole('button', { name: /Reddet/ }));

    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      submissionId: 'g1',
      kind: 'gallery',
      action: 'REJECT',
      note: 'spam',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/kaydedilemedi/);
    expect(screen.getByText('Library')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /İtiraflar/ }));
    expect(screen.getByText('No sleep again')).toBeInTheDocument();
  });
});
