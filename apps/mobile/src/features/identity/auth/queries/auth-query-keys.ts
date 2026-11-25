import { queryOptions } from '@tanstack/react-query';

import type { LinkedAccountsResult } from '../domains/linked-accounts.model';

export const AUTH_QUERY_KEYS = {
  all: ['auth'] as const,
  linkedAccounts: () =>
    queryOptions<LinkedAccountsResult>({
      queryKey: [...AUTH_QUERY_KEYS.all, 'linked-accounts'],
    }).queryKey,
} as const;
