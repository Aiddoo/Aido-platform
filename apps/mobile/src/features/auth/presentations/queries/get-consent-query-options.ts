import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { queryOptions } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const getConsentQueryOptions = () => {
  const authService = useAuthService();

  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.consent(),
    queryFn: () => authService.getConsent(),
  });
};
