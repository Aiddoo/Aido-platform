import { type CurrentUser, currentUserSchema } from '@aido/api';
import { createCurrentUserDto } from '@src/features/user/__tests__/user.factories';

import type { PremiumAccess } from '../domains/premium-access.model';

export const createPremiumAccess = (overrides?: Partial<PremiumAccess>): PremiumAccess => ({
  source: 'GRANT',
  // 11월 1일 14:30 KST
  endsAt: new Date('2026-11-01T05:30:00Z'),
  periodEndsAt: new Date('2026-11-01T05:30:00Z'),
  willRenew: false,
  bankedDays: 0,
  grantEndedAt: null,
  ...overrides,
});

/** 서버 /me 응답을 @aido/api 계약으로 검증해 만든다. 서버가 보낼 수 없는 모양은 여기서 실패한다 */
const premiumMe = (overrides: Partial<CurrentUser>) =>
  currentUserSchema.parse(createCurrentUserDto({ subscriptionStatus: 'ACTIVE', ...overrides }));

/**
 * 서버 PremiumAccessPolicy 예시 그대로의 /me 프리미엄 응답.
 * 보상은 2028-02-26T04:00Z에 시작했고 스토어 만료는 03-10T04:00Z다.
 * premiumEndsAt은 쌓아 둔 보상까지 넣은 전체 끝, premiumPeriodEndsAt은 지금 출처만의 끝이다.
 */
export const PREMIUM_ME_EXAMPLES = {
  /** A. 보상 기간 중에 구독했다. 남은 보상 5일이 구독 뒤로 쌓였다 */
  buyDuringReward: premiumMe({
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-03-10T04:00:00.000Z',
    premiumEndsAt: '2028-03-15T07:00:00.000Z',
    willRenew: true,
    bankedPremiumDays: 5,
    premiumGrantEndedAt: null,
  }),
  /** B. 보상 기간 중에 보상을 또 받았다. 새 7일이 지금 보상 뒤에 이어진다 */
  rewardDuringReward: premiumMe({
    premiumSource: 'GRANT',
    premiumPeriodEndsAt: '2028-03-04T04:00:00.000Z',
    premiumEndsAt: '2028-03-11T04:00:00.000Z',
    willRenew: false,
    bankedPremiumDays: 7,
    premiumGrantEndedAt: null,
  }),
  /** C. 자동 갱신 구독 중에 보상을 받았다 */
  rewardDuringRenewingSubscription: premiumMe({
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-03-10T04:00:00.000Z',
    premiumEndsAt: '2028-03-17T07:00:00.000Z',
    willRenew: true,
    bankedPremiumDays: 7,
    premiumGrantEndedAt: null,
  }),
  /** D. 보상이 끝난 뒤 무료로 돌아왔다(7일 안) */
  endedReward: premiumMe({
    subscriptionStatus: 'FREE',
    premiumSource: null,
    premiumPeriodEndsAt: null,
    premiumEndsAt: null,
    willRenew: false,
    bankedPremiumDays: 0,
    premiumGrantEndedAt: '2028-03-04T04:00:00.000Z',
  }),
  /** D. 끝난 뒤 새 보상을 받았다 */
  newRewardAfterEnded: premiumMe({
    premiumSource: 'GRANT',
    premiumPeriodEndsAt: '2028-03-12T04:00:00.000Z',
    premiumEndsAt: '2028-03-12T04:00:00.000Z',
    willRenew: false,
    bankedPremiumDays: 0,
    premiumGrantEndedAt: null,
  }),
  /** E. 구독을 취소했고 쌓아 둔 보상 7일이 있다 */
  cancelledWithBanked: premiumMe({
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-03-10T04:00:00.000Z',
    premiumEndsAt: '2028-03-17T04:00:00.000Z',
    willRenew: false,
    bankedPremiumDays: 7,
    premiumGrantEndedAt: null,
  }),
  /** E. 구독이 끝나 쌓아 둔 보상이 시작됐다 */
  bankedRewardStarted: premiumMe({
    premiumSource: 'GRANT',
    premiumPeriodEndsAt: '2028-03-17T04:00:00.000Z',
    premiumEndsAt: '2028-03-17T04:00:00.000Z',
    willRenew: false,
    bankedPremiumDays: 0,
    premiumGrantEndedAt: null,
  }),
  /** F. 쌓아 둔 보상이 시작된 뒤 다시 구독했다 */
  resubscribedAfterBankedStarted: premiumMe({
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-04-12T04:00:00.000Z',
    premiumEndsAt: '2028-04-17T07:00:00.000Z',
    willRenew: true,
    bankedPremiumDays: 5,
    premiumGrantEndedAt: null,
  }),
} as const satisfies Record<string, CurrentUser>;
