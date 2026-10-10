const mockDecrementRowColumn = jest.fn();
const mockGetRow = jest.fn();
const mockGetProfileRowForUser = jest.fn();
const mockUpdateProfileRowById = jest.fn();

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_TABLE_PROFILES_ID: 'profiles',
  getAdminTables: () => ({
    decrementRowColumn: mockDecrementRowColumn,
    getRow: mockGetRow,
  }),
  getProfileRowForUser: (...args: unknown[]) => mockGetProfileRowForUser(...args),
  updateProfileRowById: (...args: unknown[]) => mockUpdateProfileRowById(...args),
}));

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
}));

import { deductRapidoCents } from '@/lib/rapido-balance';

describe('deductRapidoCents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfileRowById.mockResolvedValue({});
  });

  it('does not touch the database for zero-cost operations', async () => {
    const remaining = await deductRapidoCents({
      userId: 'user_1',
      profileRowId: 'row_1',
      costCents: 0,
      knownBalanceCents: 1500,
    });

    expect(remaining).toBe(1500);
    expect(mockDecrementRowColumn).not.toHaveBeenCalled();
    expect(mockUpdateProfileRowById).not.toHaveBeenCalled();
  });

  it('uses an atomic decrement for whole-Rapido costs and reports the real balance', async () => {
    // A credit landed during the AI call: the row now holds more than the stale read.
    mockDecrementRowColumn.mockResolvedValue({ rapido_pens: 21, rapido_fraction_cents: 0 });

    const remaining = await deductRapidoCents({
      userId: 'user_1',
      profileRowId: 'row_1',
      costCents: 400,
      knownBalanceCents: 1500,
    });

    expect(mockDecrementRowColumn).toHaveBeenCalledWith(expect.objectContaining({
      rowId: 'row_1',
      column: 'rapido_pens',
      value: 4,
      min: 0,
    }));
    expect(remaining).toBe(2100);
    expect(mockUpdateProfileRowById).not.toHaveBeenCalled();
  });

  it('falls back to a fresh read-then-write when the atomic decrement fails', async () => {
    mockDecrementRowColumn.mockRejectedValue(new Error('below min'));
    mockGetRow.mockResolvedValue({ $id: 'row_1', rapido_pens: 2, rapido_fraction_cents: 0 });

    const remaining = await deductRapidoCents({
      userId: 'user_1',
      profileRowId: 'row_1',
      costCents: 400,
      knownBalanceCents: 1500,
    });

    expect(remaining).toBe(0);
    expect(mockUpdateProfileRowById).toHaveBeenCalledWith('row_1', { rapido_pens: 0, rapido_fraction_cents: 0 });
  });

  it('handles fractional costs with a fresh read instead of the stale balance', async () => {
    mockGetRow.mockResolvedValue({ $id: 'row_1', rapido_pens: 10, rapido_fraction_cents: 50 });

    const remaining = await deductRapidoCents({
      userId: 'user_1',
      profileRowId: 'row_1',
      costCents: 150,
      knownBalanceCents: 99999,
    });

    expect(mockDecrementRowColumn).not.toHaveBeenCalled();
    expect(remaining).toBe(900);
    expect(mockUpdateProfileRowById).toHaveBeenCalledWith('row_1', { rapido_pens: 9, rapido_fraction_cents: 0 });
  });

  it('clamps a negative atomic result to zero', async () => {
    mockDecrementRowColumn.mockResolvedValue({ rapido_pens: -2, rapido_fraction_cents: 0 });

    const remaining = await deductRapidoCents({
      userId: 'user_1',
      profileRowId: 'row_1',
      costCents: 400,
      knownBalanceCents: 200,
    });

    expect(remaining).toBe(0);
    expect(mockUpdateProfileRowById).toHaveBeenCalledWith('row_1', { rapido_pens: 0, rapido_fraction_cents: 0 });
  });
});
