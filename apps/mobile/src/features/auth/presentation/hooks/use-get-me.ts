import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import type { AuthService } from '../../application/services/auth.service';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';
import { useAuthService } from '../providers/auth.provider';

export const getMeQueryOptions = (authService: AuthService) =>
  queryOptions({
    queryKey: AUTH_QUERY_KEYS.me(),
    queryFn: () => authService.getCurrentUser(),
  });

export const useGetMe = () => {
  const authService = useAuthService();

  return useSuspenseQuery(getMeQueryOptions(authService));
};
