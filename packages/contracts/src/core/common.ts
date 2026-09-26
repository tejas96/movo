import { z } from 'zod';

export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const IsoDateSchema = z.iso.date();

/** Money is always integer paise. */
export const PaiseSchema = z.number().int().min(0);

export const LOCALES = ['en', 'hi', 'mr'] as const;
export const LocaleSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;
export const DEFAULT_LOCALE: Locale = 'en';

export const E164_PHONE = /^\+[1-9]\d{7,14}$/;
export const PhoneSchema = z
  .string()
  .regex(E164_PHONE, 'Phone must be E.164, for example +919876543210');
export const EmailSchema = z.email().max(254);

/** Login identifier: an email or a phone. The server normalises it. */
export const IdentifierSchema = z.string().trim().min(3).max(254);
export const PasswordSchema = z.string().min(8).max(128);
export const DisplayNameSchema = z.string().trim().min(2).max(60);

export const CursorQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type CursorQuery = z.infer<typeof CursorQuerySchema>;

export function page<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'MODULE_DISABLED',
  'MEMBERSHIP_INACTIVE',
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED',
  'IDENTIFIER_TAKEN',
  'INVITE_CODE_INVALID',
  'INVITE_EXPIRED',
  'JOIN_CODE_INVALID',
  'JOIN_REQUESTS_DISABLED',
  'ALREADY_MEMBER',
  'RESET_CODE_INVALID',
  'TOKEN_INVALID',
  'PASSWORD_INCORRECT',
  'LAST_ADMIN',
  'ROLE_IN_USE',
  'OUT_OF_STOCK',
  'ORDERS_CLOSED',
  'SLOT_TAKEN',
  'VEHICLE_EXISTS',
  'CATEGORY_NOT_EMPTY',
  'ALERT_COOLDOWN',
  'APP_UPDATE_REQUIRED',
  'INTERNAL',
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** A flat as other records refer to it: "A-101". */
export const FlatRefSchema = z.object({
  id: IdSchema,
  number: z.string(),
  buildingName: z.string().nullable(),
});
export type FlatRef = z.infer<typeof FlatRefSchema>;

/** Who did something, by name. */
export const ActorSchema = z.object({ membershipId: IdSchema, displayName: z.string() });
export type Actor = z.infer<typeof ActorSchema>;

export const OkSchema = z.object({ ok: z.literal(true) });
export const EmptySchema = z.object({}).strict();
