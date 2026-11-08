import { currentUserSchema } from '@aido/api';
import type { z } from 'zod';

// 구버전 서버 때문에 계약은 선택 필드지만 지금 서버는 항상 보낸다
export const currentUserResponseSchema = currentUserSchema.required({
  premiumSource: true,
  premiumEndsAt: true,
  premiumPeriodEndsAt: true,
  willRenew: true,
  bankedPremiumDays: true,
  premiumGrantEndedAt: true,
  isPremium: true,
});
export type CurrentUserResponse = z.output<typeof currentUserResponseSchema>;
