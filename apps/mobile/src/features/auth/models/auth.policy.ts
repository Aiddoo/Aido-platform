import type { SubscriptionStatus } from './user.model';

/** Auth 도메인 비즈니스 규칙 */
export const AuthPolicy = {
  /** 구독 상태가 활성 상태인지 확인 */
  isSubscriptionActive: (status: SubscriptionStatus): boolean => status === 'ACTIVE',
} as const;
