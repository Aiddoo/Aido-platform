import { USER_ROLE } from '@aido/api/vocabulary';

import type { User } from '../schemas/user.schema';
import { PremiumAccessPolicy } from './premium-access.model';

function hasCredential(user: Pick<User, 'providers'>) {
  return user.providers.includes('CREDENTIAL');
}

function isAdmin(user: Pick<User, 'role'>) {
  return user.role === USER_ROLE.ADMIN;
}

/** 서버의 isPremium은 ADMIN을 반영하지 않는다. 앱의 "결제 사용자" 판별은 여기 하나다 */
function hasPremiumAccess(user: Pick<User, 'role' | 'isPremium'>) {
  return isAdmin(user) || user.isPremium;
}

/** 역할·프리미엄 효력·기간이 바뀌면 서버가 주는 한도·사용량도 달라진다 */
function hasEntitlementChanged(
  previous: Pick<User, 'role' | 'isPremium' | 'premiumAccess'>,
  next: Pick<User, 'role' | 'isPremium' | 'premiumAccess'>,
) {
  return (
    previous.role !== next.role ||
    previous.isPremium !== next.isPremium ||
    PremiumAccessPolicy.hasChanged(previous.premiumAccess, next.premiumAccess)
  );
}

export const UserPolicy = {
  hasCredential,
  isAdmin,
  hasPremiumAccess,
  hasEntitlementChanged,
} as const;
