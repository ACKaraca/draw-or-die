import { getFeatureFlag } from '@/lib/appwrite/server';
import { getArchBuilderAccessForUser, parseSessionIdFromArchBuilderPath } from '@/lib/archbuilder/api-utils';

jest.mock('@/lib/appwrite/server', () => ({
  getFeatureFlag: jest.fn(),
}));

const mockedGetFeatureFlag = jest.mocked(getFeatureFlag);

describe('archbuilder api-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FEATURE_ARCHBUILDER_ENABLED;
  });

  it('parses session id with trailing segment', () => {
    expect(parseSessionIdFromArchBuilderPath('/api/archbuilder/sessions/session-1/approve-step')).toBe('session-1');
  });

  it('parses session id with trailing slash', () => {
    expect(parseSessionIdFromArchBuilderPath('/api/archbuilder/sessions/session-2/')).toBe('session-2');
  });

  it('returns runtime enabled when FEATURE_ARCHBUILDER_ENABLED=true', async () => {
    process.env.FEATURE_ARCHBUILDER_ENABLED = 'true';

    await expect(getArchBuilderAccessForUser('user-1')).resolves.toBe('enabled');
    expect(mockedGetFeatureFlag).not.toHaveBeenCalled();
  });

  it('returns disabled when feature flag row is missing', async () => {
    mockedGetFeatureFlag.mockResolvedValueOnce(null);

    await expect(getArchBuilderAccessForUser('user-1')).resolves.toBe('disabled');
  });

  it('returns not-allowlisted when allowlist exists and user not present', async () => {
    mockedGetFeatureFlag.mockResolvedValueOnce({
      enabled: true,
      value_json: JSON.stringify({ allowlist: ['user-2', 'user-3'] }),
    } as never);

    await expect(getArchBuilderAccessForUser('user-1')).resolves.toBe('not-allowlisted');
  });

  it('returns enabled when allowlist contains user', async () => {
    mockedGetFeatureFlag.mockResolvedValueOnce({
      enabled: true,
      value_json: JSON.stringify({ allowlist: ['user-1'] }),
    } as never);

    await expect(getArchBuilderAccessForUser('user-1')).resolves.toBe('enabled');
  });
});
