import { useUserService } from '@src/bootstrap/providers/di-provider';
import type { User } from '@src/features/user/models/user.model';
import { unwrap } from '@src/shared/errors/result';
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

export const useGetMeQueryOptions = () => {
  const userService = useUserService();

  return queryOptions({
    queryKey: USER_QUERY_KEYS.me(),
    queryFn: async () => {
      const result = await userService.getCurrentUser();
      return unwrap(result);
    },
    select: (user) => ({
      ...user,
      name: user.name ?? '열정적인 사용자',
      tier: getUserTier(user),
    }),
  });
};
