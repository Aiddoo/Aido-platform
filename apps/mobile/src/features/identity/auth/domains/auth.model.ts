import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const authTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
  accountRestored: z.boolean(),
  isNewUser: z.boolean().optional().default(false),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const registerResultSchema = z.object({
  message: z.string(),
  email: z.string(),
  isEmailSent: z.boolean(),
});
export type RegisterResult = z.infer<typeof registerResultSchema>;

export const resendVerificationResultSchema = z.object({
  message: z.string(),
  email: z.string(),
  retryAfterSeconds: z.number().optional(),
});
export type ResendVerificationResult = z.infer<typeof resendVerificationResultSchema>;

export const deleteAccountResultSchema = z.object({
  message: z.string(),
  deletedAt: instantSchema,
  gracePeriodDays: z.number(),
});
export type DeleteAccountResult = z.infer<typeof deleteAccountResultSchema>;

export const forgotPasswordResultSchema = z.object({
  message: z.string(),
});
export type ForgotPasswordResult = z.infer<typeof forgotPasswordResultSchema>;

export const resetPasswordResultSchema = z.object({
  message: z.string(),
});
export type ResetPasswordResult = z.infer<typeof resetPasswordResultSchema>;

export const changePasswordResultSchema = z.object({
  message: z.string(),
});
export type ChangePasswordResult = z.infer<typeof changePasswordResultSchema>;
