import type { QueryClient } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from './auth-query-keys';

export function invalidateLinkedAccounts(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.linkedAccounts() });
}
