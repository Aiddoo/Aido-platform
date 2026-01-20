import { z } from 'zod';

const datetimeSchema = z
  .string()
  .datetime({ offset: true })
  .transform((date) => new Date(date));

const nullableDatetimeSchema = datetimeSchema.nullable();
const userStatusSchema = z.enum(['ACTIVE', 'LOCKED', 'SUSPENDED', 'PENDING_VERIFY']);
const subscriptionStatusSchema = z.enum(['FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED']);

export const authTokensSchema = z.object({
  userId: z.string().cuid().describe('사용자 고유 ID'),
  accessToken: z.string().describe('JWT 액세스 토큰'),
  refreshToken: z.string().describe('JWT 리프레시 토큰'),
  name: z.string().nullable().describe('사용자 이름'),
  profileImage: z.string().nullable().describe('프로필 이미지 URL'),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

export const currentUserSchema = z.object({
  userId: z.string().cuid(),
  email: z.string().email(),
  sessionId: z.string().cuid(),
  userTag: z.string().length(8),
  status: userStatusSchema,
  emailVerifiedAt: nullableDatetimeSchema,
  subscriptionStatus: subscriptionStatusSchema,
  subscriptionExpiresAt: nullableDatetimeSchema,
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  createdAt: datetimeSchema,
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

export const exchangeCodeSchema = z.object({
  code: z.string().min(1, '교환 코드가 필요합니다'),
});

export type ExchangeCodeInput = z.infer<typeof exchangeCodeSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, '리프레시 토큰이 필요합니다'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
