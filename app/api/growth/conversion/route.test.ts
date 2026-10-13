/** @jest-environment node */
import { POST } from '@/app/api/growth/conversion/route';

function buildRequest(host: string, body: unknown = { eventName: 'signup_completed' }): Request {
  return new Request(`https://${host}/api/growth/conversion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-host': host },
    body: JSON.stringify(body),
  });
}

describe('POST /api/growth/conversion', () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = env.NODE_ENV;

  beforeEach(() => {
    env.NODE_ENV = 'production';
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('skips non-production hosts with 202 and logs the skip', async () => {
    const response = await POST(buildRequest('dev.drawordie.app'));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true, skipped: true });
    expect(console.info).toHaveBeenCalledWith('[server-info]', expect.stringContaining('non_production'));
  });

  it('accepts events on the production host', async () => {
    const response = await POST(buildRequest('drawordie.app'));

    expect(response.status).toBe(200);
    expect(console.info).not.toHaveBeenCalled();
  });

  it('rejects payloads without eventName', async () => {
    const response = await POST(buildRequest('drawordie.app', {}));

    expect(response.status).toBe(400);
  });
});
