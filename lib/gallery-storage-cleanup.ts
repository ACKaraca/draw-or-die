import { APPWRITE_BUCKET_GALLERY_ID, getAdminStorage } from '@/lib/appwrite/server';
import { getAppwriteErrorDetails } from '@/lib/appwrite/error-utils';
import { logServerError, logServerInfo } from '@/lib/logger';

export type GalleryUploadCleanupReason =
  | 'moderation_rejected'
  | 'row_write_failed'
  | 'moderator_rejected'
  | 'orphan';

export type GalleryUploadCleanupResult = 'deleted' | 'already_gone' | 'failed' | 'skipped';

/**
 * Idempotent: deleting a file that is already gone (404) counts as success, so retries and
 * duplicate cleanup paths are safe. Every outcome is logged for orphan observability.
 */
export async function cleanupGalleryUpload(
  fileId: string | null | undefined,
  reason: GalleryUploadCleanupReason,
  scope: string,
): Promise<GalleryUploadCleanupResult> {
  const id = (fileId ?? '').trim();
  if (!id) return 'skipped';

  try {
    await getAdminStorage().deleteFile({ bucketId: APPWRITE_BUCKET_GALLERY_ID, fileId: id });
    logServerInfo(`${scope}.upload-cleanup`, { fileId: id, reason, result: 'deleted' });
    return 'deleted';
  } catch (error) {
    const details = getAppwriteErrorDetails(error);
    if ([details.code, details.status, details.responseStatus].includes(404)) {
      logServerInfo(`${scope}.upload-cleanup`, { fileId: id, reason, result: 'already_gone' });
      return 'already_gone';
    }

    logServerError(`${scope}.upload-cleanup`, error, { fileId: id, reason, result: 'failed' });
    return 'failed';
  }
}
