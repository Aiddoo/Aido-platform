import { PREMIUM_SOURCE } from '@aido/api/vocabulary';
import {
  type PremiumAccess,
  PremiumAccessPolicy,
} from '@src/features/identity/user/domains/premium-access.model';
import { match } from 'ts-pattern';

// 수락 뒤 다시 받은 내 정보로만 판단한다. 구독·다른 보상 기간 중이면 서버가 쌓아 두고 그 뒤에 잇는다
function getRewardStart(premiumAccess: PremiumAccess) {
  return match({
    source: premiumAccess.source,
    hasBankedDays: PremiumAccessPolicy.hasBankedDays(premiumAccess),
  })
    .with(
      { source: PREMIUM_SOURCE.STORE, hasBankedDays: true },
      () => 'after-subscription' as const,
    )
    .with(
      { source: PREMIUM_SOURCE.GRANT, hasBankedDays: true },
      () => 'after-current-reward' as const,
    )
    .otherwise(() => 'now' as const);
}

/** 초대받은 사람의 프리미엄 효력으로 보는 보상 시작 */
export const InviteePremiumAccessPolicy = {
  getRewardStart,
} as const;
