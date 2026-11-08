import type {
  PremiumSourceProperty,
  UserPropertyMap,
} from '@src/core/observability/telemetry-keys';

import { PremiumAccessPolicy } from '../domains/premium-access.model';
import { type User } from '../domains/user.model';
import { UserPolicy } from '../domains/user.model';

type AnalyticsUser = Pick<User, 'role' | 'isPremium' | 'premiumAccess' | 'subscriptionStatus'>;

function toPremiumSourceProperty(user: AnalyticsUser): PremiumSourceProperty {
  if (UserPolicy.isAdmin(user)) {
    return 'admin';
  }
  if (PremiumAccessPolicy.isStoreSubscribed(user.premiumAccess)) {
    return 'store';
  }
  return PremiumAccessPolicy.isGrantOnly(user.premiumAccess) ? 'grant' : 'none';
}

// is_premium은 대시보드 연속성을 위해 ADMIN을 포함해 온 의미를 유지한다
export function toUserAnalyticsProperties(user: AnalyticsUser): UserPropertyMap {
  return {
    is_premium: UserPolicy.hasPremiumAccess(user),
    subscription_status: user.subscriptionStatus,
    premium_source: toPremiumSourceProperty(user),
  };
}
