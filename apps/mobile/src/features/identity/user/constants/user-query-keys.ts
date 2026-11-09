import { queryOptions } from '@tanstack/react-query';

import type { User } from '../domains/user.model';

export const USER_QUERY_KEYS = {
  all: ['user'] as const,
  me: () => queryOptions<User>({ queryKey: [...USER_QUERY_KEYS.all, 'me'] }).queryKey,
} as const;
