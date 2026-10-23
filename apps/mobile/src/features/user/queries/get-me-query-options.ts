import { useUserService } from '@src/bootstrap/providers/di-context';
import type { UserService } from '@src/features/user/apis/user.service';
import { type User, UserPolicy } from '@src/features/user/domains/user.model';
import { unwrap } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { queryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import { USER_QUERY_KEYS } from '../constants/user-query-keys';

export function toMe(user: User, { defaultName }: { defaultName: string }) {
  return {
    ...user,
    name: user.name ?? defaultName,
    tier: UserPolicy.tier(user),
  };
}

export function getMeQueryOptions(
  userService: UserService,
  { select }: { select: (user: User) => ReturnType<typeof toMe> },
) {
  return queryOptions({
    queryKey: USER_QUERY_KEYS.me(),
    queryFn: async ({ signal }) => unwrap(await userService.getCurrentUser(signal)),
    select,
  });
}

export function useGetMeQueryOptions() {
  const { t } = useTranslation('user');
  const defaultName = t('profile.defaultName');
  const select = useCallback((user: User) => toMe(user, { defaultName }), [defaultName]);

  return getMeQueryOptions(useUserService(), { select });
}
