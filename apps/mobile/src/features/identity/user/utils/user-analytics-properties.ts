import type {
  PremiumSourceProperty,
  UserPropertyMap,
} from '@src/core/observability/telemetry-keys';

import { PremiumAccessPolicy } from '../domains/premium-access.model';
import { type User } from '../domains/user.model';
import { UserPolicy } from '../domains/user.model';

/** ADMIN은 출처와 무관하게 admin이다. 그 밖에는 지금 유효한 프리미엄 출처를 그대로 쓴다 */
function toPremiumSourceProperty(user: User): PremiumSourceProperty {
  if (UserPolicy.isAdmin(user)) {
    return 'admin';
  }
  if (PremiumAccessPolicy.isStoreSubscribed(user.premiumAccess)) {
    return 'store';
  }
  return PremiumAccessPolicy.isGrantOnly(user.premiumAccess) ? 'grant' : 'none';
}

/** `is_premium`은 처음부터 ADMIN을 포함해 대시보드 연속성을 위해 의미를 바꾸지 않는다(유료 전환은 premium_source로 센다) */
export function toUserAnalyticsProperties(user: User): UserPropertyMap {
  return {
    is_premium: UserPolicy.hasPremiumAccess(user),
    subscription_status: user.subscriptionStatus,
    premium_source: toPremiumSourceProperty(user),
  };
}
