import type { SubscriptionStatus } from '@aido/validators';
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  userTag: z.string(),
  subscriptionStatus: z.enum(['FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED']),
  isSubscribed: z.boolean(),
  createdAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const AuthTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

/** Auth 도메인 비즈니스 규칙 */
export const AuthPolicy = {
  /** 구독 상태가 활성 상태인지 확인 */
  isSubscriptionActive: (status: SubscriptionStatus): boolean => status === 'ACTIVE',
} as const;
