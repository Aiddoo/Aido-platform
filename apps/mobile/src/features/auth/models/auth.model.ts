import type { SubscriptionStatus } from '@aido/validators';
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  userTag: z.string(),

  // 구독 정보
  subscriptionStatus: z.enum(['FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED']),
  isSubscribed: z.boolean(), // computed: subscriptionStatus === 'ACTIVE'

  // 메타데이터
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

// Policy
const isSubscriptionActive = (status: SubscriptionStatus): boolean => status === 'ACTIVE';

export const AuthPolicy = {
  isSubscriptionActive,
};
