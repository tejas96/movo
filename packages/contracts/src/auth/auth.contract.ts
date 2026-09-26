import { z } from 'zod';
import {
  DisplayNameSchema,
  EmailSchema,
  IdentifierSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  OkSchema,
  PasswordSchema,
  PhoneSchema,
} from '../core/common';
import { defineRoute } from '../core/route';

export const UserSchema = z.object({
  id: IdSchema,
  displayName: z.string(),
  email: EmailSchema.nullable(),
  phone: PhoneSchema.nullable(),
  locale: LocaleSchema,
  avatarUrl: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type User = z.infer<typeof UserSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: IsoDateTimeSchema,
  refreshToken: z.string(),
  refreshTokenExpiresAt: IsoDateTimeSchema,
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const AuthSessionSchema = z.object({
  tokens: AuthTokensSchema,
  user: UserSchema,
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

const DeviceInfoSchema = z.object({
  deviceName: z.string().max(80).optional(),
  platform: z.enum(['ANDROID', 'IOS', 'WEB']).optional(),
});

export const RegisterBodySchema = z
  .object({
    identifier: IdentifierSchema,
    password: PasswordSchema,
    displayName: DisplayNameSchema,
    locale: LocaleSchema.default('en'),
    device: DeviceInfoSchema.optional(),
  })
  .strict();

export const LoginBodySchema = z
  .object({
    identifier: IdentifierSchema,
    password: PasswordSchema,
    device: DeviceInfoSchema.optional(),
  })
  .strict();

export const authContract = {
  register: defineRoute({
    method: 'POST',
    path: '/v1/auth/register',
    summary: 'Create an account with a phone or email and a password',
    auth: 'none',
    body: RegisterBodySchema,
    response: AuthSessionSchema,
  }),
  login: defineRoute({
    method: 'POST',
    path: '/v1/auth/login',
    summary: 'Sign in',
    auth: 'none',
    body: LoginBodySchema,
    response: AuthSessionSchema,
  }),
  refresh: defineRoute({
    method: 'POST',
    path: '/v1/auth/refresh',
    summary: 'Rotate the refresh token and get a new access token',
    auth: 'none',
    body: z.object({ refreshToken: z.string().min(20) }).strict(),
    response: AuthTokensSchema,
  }),
  logout: defineRoute({
    method: 'POST',
    path: '/v1/auth/logout',
    summary: 'Revoke the current session',
    body: z.object({ refreshToken: z.string().min(20).optional() }).strict(),
    response: OkSchema,
  }),
  forgotPassword: defineRoute({
    method: 'POST',
    path: '/v1/auth/forgot-password',
    summary: 'Send a reset link by email when the account has one. Always answers ok.',
    auth: 'none',
    body: z.object({ identifier: IdentifierSchema }).strict(),
    response: OkSchema,
  }),
  resetPassword: defineRoute({
    method: 'POST',
    path: '/v1/auth/reset-password',
    summary: 'Set a new password with an emailed token or an admin-issued code',
    auth: 'none',
    body: z
      .object({
        identifier: IdentifierSchema,
        code: z.string().trim().min(6).max(200),
        newPassword: PasswordSchema,
      })
      .strict(),
    response: OkSchema,
  }),
  changePassword: defineRoute({
    method: 'POST',
    path: '/v1/auth/change-password',
    summary: 'Change the password. Revokes every other session.',
    body: z.object({ currentPassword: PasswordSchema, newPassword: PasswordSchema }).strict(),
    response: OkSchema,
  }),
};
