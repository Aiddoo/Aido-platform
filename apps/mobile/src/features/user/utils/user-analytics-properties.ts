import { PREMIUM_SOURCE, USER_ROLE } from '@aido/api';
import type {
  PremiumSourceProperty,
  UserPropertyMap,
} from '@src/shared/observability/telemetry-keys';
import { match } from 'ts-pattern';

import type { User } from '../domains/user.model';

type AnalyticsUser = Pick<User, 'role' | 'isPremium' | 'premiumAccess' | 'subscriptionStatus'>;

/** ADMIN은 출처와 무관하게 admin이다. 그 밖에는 지금 유효한 프리미엄 출처를 그대로 쓴다 */
function toPremiumSourceProperty({ role, premiumAccess }: AnalyticsUser): PremiumSourceProperty {
  if (role === USER_ROLE.ADMIN) {
    return 'admin';
  }
  return match(premiumAccess.source)
    .returnType<PremiumSourceProperty>()
    .with(PREMIUM_SOURCE.STORE, () => 'store')
    .with(PREMIUM_SOURCE.GRANT, () => 'grant')
    .with(null, () => 'none')
    .exhaustive();
}

/**
 * 내 정보를 GA 사용자 속성으로 바꾼다. `is_premium`·`subscription_status`는 대시보드 연속성을 위해 유지한다.
 * `is_premium`은 처음부터 ADMIN을 포함해 왔으므로 의미를 바꾸지 않는다(유료 전환은 premium_source로 센다)
 */
export function toUserAnalyticsProperties(user: AnalyticsUser): UserPropertyMap {
  return {
    is_premium: user.role === USER_ROLE.ADMIN || user.isPremium,
    subscription_status: user.subscriptionStatus,
    premium_source: toPremiumSourceProperty(user),
  };
}
