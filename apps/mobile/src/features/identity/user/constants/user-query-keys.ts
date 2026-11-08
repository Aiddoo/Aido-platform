import { queryOptions } from '@tanstack/react-query';

import type { User } from '../domains/user.model';

export const USER_QUERY_KEYS = {
  all: ['user'] as const,
  // 캐시를 직접 읽고 쓰는 키는 데이터 타입을 붙여 getQueryData·setQueryData가 타입을 안다
  me: () => queryOptions<User>({ queryKey: [...USER_QUERY_KEYS.all, 'me'] }).queryKey,
} as const;
