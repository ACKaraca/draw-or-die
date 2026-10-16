import type { Models } from 'node-appwrite';

import {
  APPWRITE_BUCKET_GALLERY_ID,
  APPWRITE_SERVER_ENDPOINT,
  APPWRITE_SERVER_PROJECT_ID,
} from '@/lib/appwrite/server';
import type { GalleryType } from '@/types';

export type GalleryRowStatus = 'approved' | 'pending' | 'archived' | 'rejected';

export type GalleryRow = Models.Row & {
  user_id: string;
  title: string;
  jury_quote: string;
  gallery_type: GalleryType;
  status: GalleryRowStatus;
  analysis_kind?: string;
  aspect_ratio_milli?: number;
  preview_width?: number;
  preview_height?: number;
  source_mime?: string;
  moderation_reason?: string;
  public_url?: string;
  storage_path?: string;
  consent_scope?: string | null;
  consent_version?: string | null;
  consented_at?: string | null;
  revoked_at?: string | null;
  archived_from_status?: string | null;
  moderated_by?: string | null;
  moderated_at?: string | null;
};

function sanitizeEnv(name: string): string {
  const raw = process.env[name];
  if (typeof raw !== 'string') return '';

  const value = raw.trim();
  if (!value) return '';

  return /[\r\n\0]/.test(value) ? '' : value;
}

const APPWRITE_PUBLIC_ENDPOINT = sanitizeEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT') || APPWRITE_SERVER_ENDPOINT;
const APPWRITE_PUBLIC_PROJECT_ID = sanitizeEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID') || APPWRITE_SERVER_PROJECT_ID;

/** Public preview URL for a file in the gallery bucket (bucket is world-readable). */
export function buildPreviewFileUrl(fileId: string): string {
  const endpoint = APPWRITE_PUBLIC_ENDPOINT.replace(/\/$/, '');
  const project = encodeURIComponent(APPWRITE_PUBLIC_PROJECT_ID);
  const safeFileId = encodeURIComponent(fileId.trim());
  return `${endpoint}/storage/buckets/${APPWRITE_BUCKET_GALLERY_ID}/files/${safeFileId}/preview?project=${project}&width=1400&height=1400&quality=76&output=webp`;
}

export function extractFileIdFromUrl(url: string): string | null {
  const match = url.match(/\/files\/([^/]+)\//i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Magic-byte check so a renamed non-image payload never reaches storage. */
export function hasAllowedImageSignature(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return buffer.length > 12
        && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    default:
      return false;
  }
}
