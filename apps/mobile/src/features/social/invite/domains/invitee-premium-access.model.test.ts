import { PREMIUM_ME_EXAMPLES } from '@src/features/identity/user/__tests__/premium-access.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';

import { InviteePremiumAccessPolicy } from './invitee-premium-access.model';

describe('getRewardStart', () => {
  it.each([
    ['무료였다가 보상을 받았으면 바로', PREMIUM_ME_EXAMPLES.newRewardAfterEnded, 'now'],
    [
      '자동 갱신 구독 중이면 구독이 끝난 뒤로',
      PREMIUM_ME_EXAMPLES.rewardDuringRenewingSubscription,
      'after-subscription',
    ],
    [
      '취소한 구독이 남아 있어도 구독이 끝난 뒤로',
      PREMIUM_ME_EXAMPLES.cancelledWithBanked,
      'after-subscription',
    ],
    [
      '다른 보상 기간 중이면 그 보상 뒤로',
      PREMIUM_ME_EXAMPLES.rewardDuringReward,
      'after-current-reward',
    ],
  ] as const)('%s 시작한다', (_case, me, expected) => {
    // Given
    // 수락 뒤 다시 불러온 내 정보(서버 /me 그대로)
    const { premiumAccess } = toUser(me);

    // When
    const result = InviteePremiumAccessPolicy.getRewardStart(premiumAccess);

    // Then
    expect(result).toBe(expected);
  });
});
