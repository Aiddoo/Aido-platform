import type { SubscriptionPlanType } from '@aido/api/vocabulary';
import { z } from 'zod';

// 소문자는 앱이 기기 캐시·분석 이벤트에 이미 쓰는 표기라 서버 값에서 한 번만 바꾼다
const PLAN_TYPES = {
  ANNUAL: 'annual',
  MONTHLY: 'monthly',
} as const satisfies Record<SubscriptionPlanType, string>;

export const planTypeSchema = z.enum(PLAN_TYPES);
export type PlanType = z.infer<typeof planTypeSchema>;

export function toPlanType(serverPlanType: SubscriptionPlanType): PlanType {
  return PLAN_TYPES[serverPlanType];
}
