import { getAppwriteErrorDetails, isAppwriteConflict, isAppwriteNotFound } from '@/lib/appwrite/error-utils';

describe('appwrite error utils', () => {
  it('prefers Appwrite status fields over misleading response values', () => {
    const details = getAppwriteErrorDetails({
      code: 409,
      status: 200,
      type: 'user_already_exists',
      response: {
        status: 200,
        code: 200,
        type: 'ok',
      },
    });

    expect(details.code).toBe(409);
    expect(details.status).toBe(200);
    expect(details.responseStatus).toBe(200);
    expect(details.responseCode).toBe(200);
    expect(isAppwriteConflict({ code: 409, status: 200, type: 'user_already_exists' })).toBe(true);
  });

  it('detects not found errors from status, type, or message', () => {
    expect(isAppwriteNotFound({ code: 404 })).toBe(true);
    expect(isAppwriteNotFound({ type: 'general_not_found' })).toBe(true);
    expect(isAppwriteNotFound({ message: 'Document does not exist' })).toBe(true);
  });

  it('detects conflict errors from response type and message', () => {
    expect(isAppwriteConflict({ type: 'document_already_exists' })).toBe(true);
    expect(isAppwriteConflict({ response: { type: 'user_already_exists' } })).toBe(true);
    expect(isAppwriteConflict({ response: { message: 'A user with the same id, email, or phone already exists in this project.' } })).toBe(true);
  });
});