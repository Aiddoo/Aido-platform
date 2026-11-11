import {
  type PremiumAccess,
  PremiumAccessPolicy,
} from '@src/features/identity/user/domains/premium-access.model';
import { match } from 'ts-pattern';

import type { EntitlementSnapshot } from '../domains/entitlement.model';

/** 마이 탭 구독 관리 행의 값. 스토어 구독이면 요금제, 아니면 지금 등급이다 */
export function toPlanTypeLabelKey(
  access: PremiumAccess,
  snapshot: Pick<EntitlementSnapshot, 'tier'>,
) {
  if (PremiumAccessPolicy.isStoreSubscribed(access)) {
    return match(access.planType)
      .with('annual', () => 'plan.annual' as const)
      .with('monthly', () => 'plan.monthly' as const)
      .with(null, () => 'receipt.rows.planUnknown' as const)
      .exhaustive();
  }
  return match(snapshot.tier)
    .with('ADMIN', () => 'tier.admin' as const)
    .with('PREMIUM', () => 'tier.premium' as const)
    .with('FREE', () => 'upsell.free' as const)
    .exhaustive();
}
