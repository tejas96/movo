import { z } from 'zod';
import { IdSchema, SocietyParamsSchema } from '../core/common';
import { API_PREFIX, defineRoute } from '../core/route';

/**
 * A stored photo. The url is a signed path on the API ("/v1/files/<id>?e=..&s=..") that works
 * for at least a day without a login. The app puts API_URL in front of it.
 */
export const FileRefSchema = z.object({ id: IdSchema, url: z.string() });
export type FileRef = z.infer<typeof FileRefSchema>;

/** Upload is multipart/form-data with one field "file". The app calls it with fetch + FormData. */
export const FILE_UPLOAD_PATH = `${API_PREFIX}/societies/:societyId/files`;
/** meContract.setAvatar and removeAvatar use this path. */
export const AVATAR_UPLOAD_PATH = `${API_PREFIX}/me/avatar`;
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

export const filesContract = {
  upload: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/files',
    summary:
      'Upload one photo (JPEG, PNG or WebP, 5 MB at most) for a listing, logo, bill, payment or task. Unused uploads go after a day.',
    params: SocietyParamsSchema,
    // Older apps send no kind: their uploads are listing photos.
    query: z.object({ kind: UploadKindSchema.default('LISTING_IMAGE') }),
    response: FileRefSchema,
  }),
  get: defineRoute({
    method: 'GET',
    path: '/files/:fileId',
    summary:
      'The photo itself (image/jpeg, png or webp), not JSON. Public: the signature in the url from a FileRef is the permission. 404 when the link is wrong or ran out.',
    auth: 'none',
    params: z.object({ fileId: z.string() }),
    // A link with e or s missing is just a wrong link: 404, like a bad signature.
    query: z.object({ e: z.string().default(''), s: z.string().default('') }),
    response: z.unknown(),
  }),
};
