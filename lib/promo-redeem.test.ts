const mockListRows = jest.fn();
const mockCreateRow = jest.fn();
const mockIncrementRowColumn = jest.fn();
const mockDecrementRowColumn = jest.fn();
const mockClaimOnce = jest.fn();
const mockReleaseClaim = jest.fn();
const mockCreditRapidoPens = jest.fn();

jest.mock('node-appwrite', () => ({
  ID: { unique: jest.fn(() => 'row_1') },
  Query: {
    equal: jest.fn(() => 'equal'),
    limit: jest.fn(() => 'limit'),
    isNull: jest.fn(() => 'isNull'),
    notEqual: jest.fn(() => 'notEqual'),
    or: jest.fn(() => 'or'),
  },
}));
jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_TABLE_PROMO_CODES_ID: 'promo_codes',
  APPWRITE_TABLE_PROMO_REDEMPTIONS_ID: 'promo_redemptions',
  getAdminTables: () => ({
    listRows: (...args: unknown[]) => mockListRows(...args),
    createRow: (...args: unknown[]) => mockCreateRow(...args),
    incrementRowColumn: (...args: unknown[]) => mockIncrementRowColumn(...args),
    decrementRowColumn: (...args: unknown[]) => mockDecrementRowColumn(...args),
  }),
  recordBillingEvent: jest.fn().mockResolvedValue({}),
  updateProfileById: jest.fn().mockResolvedValue({}),
}));
jest.mock('@/lib/idempotency', () => ({
  claimOnce: (...args: unknown[]) => mockClaimOnce(...args),
  releaseClaim: (...args: unknown[]) => mockReleaseClaim(...args),
}));
jest.mock('@/lib/rapido-balance', () => ({
  creditRapidoPens: (...args: unknown[]) => mockCreditRapidoPens(...args),
}));
jest.mock('@/lib/logger', () => ({ logServerError: jest.fn() }));

import type { AppwriteAuthUser, NormalizedUserProfile } from '@/lib/appwrite/server';
import { redeemPromoCode } from '@/lib/promo-codes';

const USER = { id: 'user_1', email: 'user@example.com', name: 'User' } as AppwriteAuthUser;
const PROFILE = { id: 'user_1', row_id: 'user_1', rapido_pens: 10, is_premium: false } as NormalizedUserProfile;

function promoRow(maxTotalUses: number | null) {
  return {
    $id: 'promo_1',
    code: 'FREE5',
    title: 'Free 5',
    active: true,
    reward_kind: 'rapido',
    reward_value: 5,
    target_scope: 'any',
    max_total_uses: maxTotalUses,
    max_uses_per_user: 1,
    used_count: 0,
  };
}

function mockLookups(maxTotalUses: number | null) {
  mockListRows.mockImplementation(async ({ tableId }: { tableId: string }) => (
    tableId === 'promo_codes'
      ? { total: 1, rows: [promoRow(maxTotalUses)] }
      : { total: 0, rows: [] }
  ));
}

describe('redeemPromoCode concurrency', () => {
  beforeEach(() => {
    // Legacy counter path; the journaled path is covered in lib/rapido-ledger-runtime.test.ts.
    process.env.RAPIDO_LEDGER_MODE = 'off';
    jest.clearAllMocks();
    mockClaimOnce.mockResolvedValue(true);
    mockIncrementRowColumn.mockResolvedValue({ used_count: 1 });
    mockCreditRapidoPens.mockResolvedValue(15);
    mockCreateRow.mockResolvedValue({ $id: 'redemption_1' });
  });

  it('grants the reward once the user slot and a global use are reserved', async () => {
    mockLookups(10);
    const result = await redeemPromoCode({ code: 'FREE5', user: USER, profile: PROFILE });

    expect(result.ok).toBe(true);
    expect(mockClaimOnce).toHaveBeenCalledWith('promo-redeem:promo_1:user_1:1');
    expect(mockCreditRapidoPens).toHaveBeenCalledWith('user_1', PROFILE, 5);
  });

  it('rejects a parallel duplicate that lost the slot claim without granting anything', async () => {
    mockLookups(10);
    mockClaimOnce.mockResolvedValue(false);

    const result = await redeemPromoCode({ code: 'FREE5', user: USER, profile: PROFILE });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'PROMO_USER_LIMIT' }));
    expect(mockIncrementRowColumn).not.toHaveBeenCalled();
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('stops at the global cap and gives the slot back', async () => {
    mockLookups(1);
    mockIncrementRowColumn.mockRejectedValue(new Error('max reached'));

    const result = await redeemPromoCode({ code: 'FREE5', user: USER, profile: PROFILE });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'PROMO_EXHAUSTED' }));
    expect(mockReleaseClaim).toHaveBeenCalledWith('promo-redeem:promo_1:user_1:1');
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('rolls back the counter and the slot when the grant fails', async () => {
    mockLookups(10);
    mockCreditRapidoPens.mockRejectedValue(new Error('appwrite down'));

    await expect(redeemPromoCode({ code: 'FREE5', user: USER, profile: PROFILE })).rejects.toThrow('appwrite down');
    expect(mockDecrementRowColumn).toHaveBeenCalledWith(expect.objectContaining({ column: 'used_count', value: 1 }));
    expect(mockReleaseClaim).toHaveBeenCalled();
  });
});
