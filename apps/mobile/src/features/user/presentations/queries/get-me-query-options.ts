import { useUserService } from '@src/bootstrap/providers/di-context';
import type { User } from '@src/features/user/models/user.model';
import type { UserService } from '@src/features/user/services/user.service';
import { unwrap } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { queryOptions } from '@tanstack/react-query';

import { USER_QUERY_KEYS } from '../constants/user-query-keys.constant';

type UserTier = 'ADMIN' | 'PREMIUM' | 'BASIC';

const getUserTier = (user: User): UserTier => {
  if (user.role === 'ADMIN') {
    return 'ADMIN';
  }
  if (user.subscriptionStatus === 'ACTIVE') {
    return 'PREMIUM';
  }
  return 'BASIC';
};

export function getMeQueryOptions(
  userService: UserService,
  { defaultName }: { defaultName: string },
) {
  return queryOptions({
    queryKey: USER_QUERY_KEYS.me(),
    queryFn: async ({ signal }) => {
      const result = await userService.getCurrentUser(signal);
      return unwrap(result);
    },
    select: (user) => ({
      ...user,
      name: user.name ?? defaultName,
      tier: getUserTier(user),
    }),
  });
}

export function useGetMeQueryOptions() {
  const { t } = useTranslation('user');
  return getMeQueryOptions(useUserService(), {
    defaultName: t('profile.defaultName'),
  });
}
