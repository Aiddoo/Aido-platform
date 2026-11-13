import { currentUserSchema } from '@aido/api';
import type { z } from 'zod';

/** 계약은 선택 필드지만, 지금 서버는 프리미엄 출처·기간·효력·체험 여부를 항상 보낸다. 기능 권한은 GET /v1/entitlements에서 읽는다 */
export const currentUserResponseSchema = currentUserSchema.required({
  premiumSource: true,
  premiumEndsAt: true,
  premiumPeriodEndsAt: true,
  willRenew: true,
  bankedPremiumDays: true,
  premiumGrantEndedAt: true,
  premiumIsTrial: true,
  isPremium: true,
});
export type CurrentUserResponse = z.output<typeof currentUserResponseSchema>;
