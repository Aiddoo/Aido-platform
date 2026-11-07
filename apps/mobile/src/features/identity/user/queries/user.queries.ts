import { useUserService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import type { User } from '@src/features/identity/user/schemas/user.schema';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { useTranslation } from '@src/shared/i18n';
import { queryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import { USER_QUERY_KEYS } from '../constants/user-query-keys';

function toMe(user: User, { defaultName }: { defaultName: string }) {
  return {
    ...user,
    name: user.name ?? defaultName,
  };
}

export function useGetMeQueryOptions() {
  const userService = useUserService();
  const { t } = useTranslation('user');
  const defaultName = t('profile.defaultName');
  const select = useCallback((user: User) => toMe(user, { defaultName }), [defaultName]);

  return queryOptions({
    queryKey: USER_QUERY_KEYS.me(),
    queryFn: async ({ signal }) => unwrap(await userService.getCurrentUser(signal)),
    select,
    // 오프라인으로 다시 열어도 프로필·프리미엄 판정이 마지막 서버 값을 유지한다
    ...PERSISTED_QUERY_OPTIONS,
  });
}
