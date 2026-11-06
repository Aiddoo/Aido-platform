import { premiumSourceSchema } from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const premiumAccessSchema = z.object({
  source: premiumSourceSchema.nullable(),
  /** 쌓아 둔 보상까지 모두 이어 붙인 프리미엄의 끝(서버 premiumEndsAt) */
  endsAt: instantSchema.nullable(),
  /** 지금 출처(스토어 구독 또는 진행 중인 보상 기간)만 끝나는 시각(서버 premiumPeriodEndsAt) */
  periodEndsAt: instantSchema.nullable(),
  willRenew: z.boolean(),
  /** 지금 기간이 끝난 뒤 받은 순서대로 이어서 시작하는 보상 일수. 출처와 상관없이 있을 수 있다 */
  bankedDays: z.number().int().nonnegative(),
  /** 프리미엄이 아닐 때 최근 @aido/api PREMIUM_GRANT_ENDED_WINDOW_DAYS일 안에 끝난 마지막 보상 기간의 끝. 그 뒤로는 서버가 null로 보낸다 */
  grantEndedAt: instantSchema.nullable(),
});
export type PremiumAccess = z.infer<typeof premiumAccessSchema>;
