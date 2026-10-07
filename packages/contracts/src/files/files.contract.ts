import { z } from 'zod';
import { IdSchema } from '../core/common';
import { defineRoute } from '../core/route';

/**
 * A stored photo. The url is a signed path on the API ("/v1/files/<id>?e=..&s=..") that works
 * for at least a day without a login. The app puts API_URL in front of it.
 */
export const FileRefSchema = z.object({ id: IdSchema, url: z.string() });
export type FileRef = z.infer<typeof FileRefSchema>;

/** Upload is multipart/form-data with one field "file". The app calls it with fetch + FormData. */
export const FILE_UPLOAD_PATH = '/v1/societies/:societyId/files';
export const AVATAR_UPLOAD_PATH = '/v1/me/avatar';
export const FILE_MAX_BYTES = 5 * 1024 * 1024;
export const FILE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** What a society upload is for. The thing it is attached to must match. */
export const UploadKindSchema = z.enum([
  'LISTING_IMAGE',
  'SOCIETY_LOGO',
  'EXPENSE_RECEIPT',
  'PAYMENT_PROOF',
  'TASK_PROOF',
]);
export type UploadKind = z.infer<typeof UploadKindSchema>;

export const MAX_LISTING_PHOTOS = 5;
export const MAX_EXPENSE_RECEIPTS = 5;
export const MAX_PAYMENT_PROOFS = 2;
export const MAX_TASK_PROOFS = 3;

const societyParams = z.object({ societyId: IdSchema });

export const filesContract = {
  upload: defineRoute({
    method: 'POST',
    path: FILE_UPLOAD_PATH,
    summary:
      'Upload one photo (JPEG, PNG or WebP, 5 MB at most) for a listing, logo, bill, payment or task. Unused uploads go after a day.',
    params: societyParams,
    // Older apps send no kind: their uploads are listing photos.
    query: z.object({ kind: UploadKindSchema.default('LISTING_IMAGE') }),
    response: FileRefSchema,
  }),
};
