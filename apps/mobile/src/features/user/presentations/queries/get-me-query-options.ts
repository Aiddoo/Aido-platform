import { useUserService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { USER_QUERY_KEYS } from '../constants/user-query-keys.constant';

export const getMeQueryOptions = () => {
  const userService = useUserService();

  return queryOptions({
    queryKey: USER_QUERY_KEYS.me(),
    queryFn: async () => {
      const result = await userService.getCurrentUser();
      return unwrap(result);
    },
  });
};
